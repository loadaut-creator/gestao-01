import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);const ts=require('typescript');
const cache=new Map();let publicJwk;
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id);
 vm.runInNewContext(source,{exports,require:localRequire,crypto:webcrypto,Request,Response,TextEncoder,TextDecoder,atob,console,URL,Error,fetch:async()=>Response.json({keys:[publicJwk]})});return exports;
}
const handler=load('functions/api/[[path]].ts').onRequest;
const migration=load('lib/cloud/migration.ts');
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0001_cloud.sql','utf8').replace(/^\uFEFF/,''));
const binding={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}} ,run(){return db.prepare(sql).run(...args)}}}}},async batch(statements){db.exec('BEGIN');try{for(const statement of statements)statement.run();db.exec('COMMIT');return[]}catch(e){db.exec('ROLLBACK');throw e}}};
const env={DB:binding,CLOUD_ENABLED:'1',ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'aud-test',ADMIN_EMAIL:'admin@example.com'};
const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
publicJwk={...await webcrypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(email,extra={}){const data=encode({alg:'RS256',kid:'test-key'})+'.'+encode({email,iss:'https://test.cloudflareaccess.com',aud:['aud-test'],iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,...extra});return data+'.'+Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url')}
async function request(route,method='GET',body,auth,origin='https://app.example.com') {return handler({env,params:{path:route.split('/')},request:new Request('https://app.example.com/api/'+route,{method,headers:{'Content-Type':'application/json',Origin:origin,...auth?{'Cf-Access-Jwt-Assertion':auth}:{}},...body!==undefined?{body:JSON.stringify(body)}:{}})});}
const admin=await token('admin@example.com');
const record={id:'imp1',importedAt:'2026-10-22T12:00:00.000Z',fileName:'vendas.csv',fileType:'csv',periodKind:'day',reference:'2026-10-22',rowCount:1,totalSale:100,mapping:{seller:'Vendedor',sale:'Venda',clients:'',ticket:'',genSim:'',mp:'',date:'',sector:'',clientPremium:''},displayColumns:['Vendedor','Venda'],columns:['Vendedor','Venda'],records:[{sourceRow:2,seller:'Ana',sale:100,saleWasBlank:false,clients:null,ticket:null,genSim:null,mp:null,date:null,sector:null,clientPremium:null,raw:{Vendedor:'Ana',Venda:'100'}}]};
test('API protegida, sessão e assinatura',async()=>{
 assert.equal((await request('state')).status,401);
 assert.equal((await request('state','GET',undefined,await token('admin@example.com',{exp:1}))).status,401);
 const forged=admin.slice(0,-15)+'AAAAAAAAAAAAAAA';assert.equal((await request('state','GET',undefined,forged)).status,401);
 assert.equal((await request('state','GET',undefined,await token('admin@example.com',{aud:['wrong']}))).status,401);
 assert.equal((await request('session','GET',undefined,admin)).status,200);
 assert.equal((await request('state','GET',undefined,await token('other@example.com'))).status,403);
});
test('revisões impedem sobrescrita e preservam transações',async()=>{
 const data=[{month:'2026-10',sector:'Balcão',metric:'sale',target:100}];
 assert.equal((await request('goals','PUT',{version:0,data},admin)).status,200);
 assert.equal((await request('goals','PUT',{version:0,data:[]},admin)).status,409);
 const state=await(await request('state','GET',undefined,admin)).json();assert.equal(state.data.goals.length,1);assert.equal(state.versions.goals,1);
 assert.equal(db.prepare("SELECT count(*) AS n FROM audit_log WHERE resource='goals'").get().n,1);
 assert.equal((await request('goals','PUT',{version:1,data:[]},admin,'https://other.example.com')).status,403);
 assert.equal((await request('goals','PUT',{version:1,data:[{...data[0],target:-1}]},admin)).status,400);
});
test('importação atômica, deduplicação, conferência dos totais e exclusão',async()=>{
 assert.equal((await request('imports','POST',record,admin)).status,201);
 const duplicate=await(await request('imports','POST',{...record,id:'imp2'},admin)).json();assert.equal(duplicate.duplicate,true);
 assert.equal((await(await request('imports','GET',undefined,admin)).json()).length,1);
 assert.equal((await request('imports','POST',{...record,totalSale:999},admin)).status,400);
 assert.equal((await request('imports/imp1','DELETE',undefined,admin)).status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM sales_rows').get().n,0);
});
test('consulta não pode gravar e gerente não pode gerenciar acessos ou excluir',async()=>{
 db.prepare("INSERT INTO documents VALUES(?,?,?,?)").run('visao-308','users','viewer@example.com',JSON.stringify({email:'viewer@example.com',role:'viewer',active:true}));
 db.prepare("INSERT INTO documents VALUES(?,?,?,?)").run('visao-308','users','manager@example.com',JSON.stringify({email:'manager@example.com',role:'manager',active:true}));
 const viewer=await token('viewer@example.com');const manager=await token('manager@example.com');
 assert.equal((await request('state','GET',undefined,viewer)).status,200);
 assert.equal((await request('goals','PUT',{version:1,data:[]},viewer)).status,403);
 assert.equal((await request('users','PUT',{version:0,data:[]},manager)).status,403);
 assert.equal((await request('imports/imp1','DELETE',undefined,manager)).status,403);
});
test('migração identifica conflitos e permite retomar dados idênticos',()=>{
 const empty={schemaVersion:1,employees:[],goals:[],templates:[],imports:[]};
 const first={...empty,imports:[record]};
 assert.equal(migration.mergeMigration(first,first).imports.length,1);
 assert.equal(migration.mergeMigration(first,first).conflicts.length,0);
 assert.equal(migration.mergeMigration({...first,imports:[{...record,totalSale:99}]},first).conflicts.length,1);
});
test('prévia da migração valida tudo antes de transferir',async()=>{
 const body={schemaVersion:1,employees:[],goals:[],templates:[],imports:[record]};
 assert.equal((await request('validate-migration','POST',body,admin)).status,200);
 assert.equal((await request('validate-migration','POST',{...body,imports:[{...record,totalSale:999}]},admin)).status,400);
 assert.equal(db.prepare('SELECT count(*) AS n FROM imports').get().n,0);
});
test('sem ativação, o deploy preserva o modo local e não expõe dados',async()=>{
 const session=await handler({env:{CLOUD_ENABLED:'0'},params:{path:['session']},request:new Request('https://app.example.com/api/session')});
 assert.equal((await session.json()).mode,'local');
 const state=await handler({env:{CLOUD_ENABLED:'0'},params:{path:['state']},request:new Request('https://app.example.com/api/state')});
 assert.equal(state.status,503);
});
