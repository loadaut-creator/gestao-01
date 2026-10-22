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
 const localRequire=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):id.startsWith('@/')?load(id.slice(2)+'.ts'):require(id);
 vm.runInNewContext(source,{exports,require:localRequire,crypto:webcrypto,Request,Response,TextEncoder,TextDecoder,atob,console,URL,Error,fetch:async()=>Response.json({keys:[publicJwk]})});return exports;
}
const handler=load('functions/api/[[path]].ts').onRequest;
const biNumbers=load('lib/bi/numbers.ts');
const biModel=load('lib/bi/model.ts');
const campaigns=load('lib/campaigns/model.ts');
const campaignGroups=load('lib/campaigns/rankings.ts');
const campaign={id:'campaign-test',name:'Teste MP',sector:'Balcão',metric:'money',startsAt:'2020-01-01',endsAt:'2099-12-31',status:'published',powerBiUrl:'https://app.powerbi.com/report/test',rules:'',prize:'',order:0,createdAt:'2026-10-22T12:00:00.000Z',updatedAt:'2026-10-22T12:00:00.000Z',ranking:{fileName:'teste.csv',importedAt:'2026-10-22T12:00:00.000Z',rows:[{seller:'Pessoa externa',value:31146}]}};
test('rankings agrupam linhas e setores, mantendo somente campanhas vigentes',()=>{
 const records=[{...campaign,id:'c1',name:'CAMPANHA CIMED',sector:'Balcão'}, {...campaign,id:'c2',name:'CIMED — PERFUMISTA',sector:'Perfumaria',order:1}, {...campaign,id:'c3',name:'Cimed - Caixa',sector:'Caixa',order:2}, {...campaign,id:'mp',name:'MP - BALCAO',order:3}, {...campaign,id:'draft',name:'Cimed',status:'draft'}, {...campaign,id:'closed',name:'Cimed',status:'closed'}, {...campaign,id:'future',name:'Cimed',startsAt:'2027-01-01'}, {...campaign,id:'past',name:'Cimed',endsAt:'2026-10-21'}];
 const groups=campaignGroups.groupActiveRankings(records,'2026-10-22');
 assert.equal(groups.length,2);assert.equal(groups[0].name,'CIMED');assert.equal(groups[0].campaigns.map(c=>c.sector).join(','),'Balcão,Perfumaria,Caixa');assert.equal(groups[1].campaigns.length,1);
 assert.equal(groups[0].campaigns[0].ranking.rows[0].seller,'Pessoa externa');
 assert.equal(campaignGroups.campaignLine({...campaign,name:'EMS & Culturelle'}),'EMS & Culturelle');
 assert.equal(campaignGroups.campaignLine({...campaign,line:'Linha especial'}),'Linha especial');
 assert.equal(campaignGroups.groupActiveRankings([{...campaign,name:'Nome A',line:'CIMED'},{...campaign,id:'b',name:'Nome B',line:'cimed'}],'2026-10-22').length,1);
 assert.equal(campaignGroups.groupActiveRankings([]).length,0);
});
test('campanhas: planilha agrupada, células vazias, totais e lista sem cadastro',()=>{
 const columns=['Cargo | Vendedor | Filial','Vendedor','Venda'];
 const table={columns,rows:[['BALC. MEDICAMENTO','Total','1254641,77'],['','Renata','31146'],['','Anna','4581,56'],['','Homônimo','0'],['','Devolução','-2'],['','Sem valor',''],['PERFUMARIA','Total','90'],['','Outra pessoa','90']]};
 const mapping=campaigns.suggestRankingMapping(columns,'money');
 const result=campaigns.inspectCampaignRanking(table,mapping,'Balcão');
 assert.equal(result.errors.length,0);assert.equal(result.rows.length,3);assert.equal(result.rows[0].value,31146);assert.equal(result.rows[1].value,4581.56);assert.equal(result.ignored,5);
 assert.equal(campaigns.inspectCampaignRanking(table,mapping,'Todos').rows.length,4);
 assert.equal(campaigns.inspectCampaignRanking(table,{seller:'Venda',value:'Venda'}).errors.length,1);
 const ranked=campaigns.campaignRanking({...campaign,ranking:{...campaign.ranking,rows:[{seller:'Bia',value:10},{seller:'Ana',value:10},{seller:'Caio',value:5}]}});
 assert.equal(ranked.map(row=>row.rank).join(','),'1,1,3');assert.equal(ranked[0].seller,'Ana');
 assert.equal(campaigns.normalizeSearch('João'),'joao');
 assert.equal(campaigns.campaignSchema.safeParse({...campaign,endsAt:'2019-01-01'}).success,false);
 assert.equal(campaigns.campaignSchema.safeParse({...campaign,powerBiUrl:'https://other.example/'}).success,false);
});
const salesDashboard=load('lib/sales/dashboard.ts');
test('decimais numéricos do Excel não viram milhares na leitura em português',()=>{
 for(const [raw,expected] of [['261.243',261.243],['145.044',145.044],['2.985',2.985],['93.8949',93.8949],['1234',1234],['-2.985',-2.985],['0',0]]) {
  assert.equal(biModel.parseLocaleNumber(biNumbers.excelNumericText(raw)),expected);
 }
 assert.equal(biModel.parseLocaleNumber('1.234,56'),1234.56);
 assert.equal(biModel.parseLocaleNumber('1.234'),1234);
 assert.equal(biModel.parseLocaleNumber(biNumbers.excelNumericText('')),null);
});
const migration=load('lib/cloud/migration.ts');
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0001_cloud.sql','utf8').replace(/^\uFEFF/,''));
db.exec(fs.readFileSync('migrations/0002_site_login.sql','utf8'));
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
const siteAuth=load('lib/cloud/site-auth.ts');
const siteEnv={...env,SITE_LOGIN_ENABLED:'1',ADMIN_USERNAME:'admin-test',ADMIN_PASSWORD_HASH:'pbkdf2-sha256-100000$adminsalt$'+await siteAuth.passwordHash('test-admin-password','adminsalt'),EMPLOYEE_PASSWORD_HASH:'pbkdf2-sha256-100000$employeesalt$'+await siteAuth.passwordHash('test-staff-password','employeesalt')};
async function siteRequest(route,method='GET',body,cookie='',ip='198.51.100.7',origin='https://app.example.com'){
 return handler({env:siteEnv,params:{path:route.split('?')[0].split('/')},request:new Request('https://app.example.com/api/'+route,{method,headers:{'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':ip,Cookie:cookie},...body!==undefined?{body:JSON.stringify(body)}:{}})});
}
const person=(id,name,registration,status='ativo')=>({id,name,registration,status,role:'Balconista',jobTitle:'BALC. MEDICAMENTO',sector:'Balcão',hiredAt:'2020-01-01',biIdentifier:name,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'});
function addPerson(employee){db.prepare("INSERT OR REPLACE INTO documents VALUES(?,?,?,?)").run('visao-308','employees',employee.id,JSON.stringify(employee));}
test('login próprio: credenciais, cookies seguros, logout e bloqueio de sessão falsa',async()=>{
 const unauth=await(await siteRequest('session')).json();assert.equal(unauth.authenticated,false);
 assert.equal((await siteRequest('state')).status,401);
 assert.equal((await siteRequest('auth/login','POST',{username:'admin-test',password:'wrong'})).status,401);
 assert.equal((await siteRequest('auth/login','POST',{username:'admin-test',password:'test-admin-password'},'','198.51.100.7','https://evil.example')).status,403);
 const login=await siteRequest('auth/login','POST',{username:'admin-test',password:'test-admin-password',remember:true});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Max-Age=604800/);
 const session=await login.json();assert.equal(session.role,'admin');assert.equal(session.password,undefined);
 assert.equal((await siteRequest('state','GET',undefined,cookie.split(';')[0])).status,200);
 assert.equal((await siteRequest('state','GET',undefined,'__Host-visao_session='+ 'a'.repeat(64))).status,401);
 assert.equal((await siteRequest('auth/logout','POST',{},cookie.split(';')[0])).status,200);
 assert.equal((await siteRequest('state','GET',undefined,cookie.split(';')[0])).status,401);
});
test('matrícula: só suas vendas e dados, bloqueio de escrita e de funcionário inativo',async()=>{
 addPerson(person('employee-1','Ana','100'));addPerson(person('employee-2','Beatriz','200'));
 const mixed={...record,id:'scope1',rowCount:2,totalSale:1000,records:[record.records[0],{...record.records[0],sourceRow:3,seller:'Beatriz',sale:900,raw:{Vendedor:'Beatriz',Venda:'900'}}]};
 assert.equal((await request('imports','POST',mixed,admin)).status,201);
 const login=await siteRequest('auth/login','POST',{username:'100',password:'test-staff-password'});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const state=await(await siteRequest('state','GET',undefined,cookie)).json();assert.equal(state.data.employees.length,1);assert.equal(state.data.employees[0].id,'employee-1');assert.equal(state.data.goals.length,0);
 const imports=await(await siteRequest('imports?employeeId=employee-2','GET',undefined,cookie)).json();
 assert.equal(imports.length,1);assert.equal(imports[0].totalSale,100);assert.equal(imports[0].rowCount,1);assert.equal(imports[0].records[0].seller,'Ana');assert.equal(JSON.stringify(imports).includes('Beatriz'),false);
 for(const [route,method] of [['employees','PUT'],['goals','PUT'],['imports','POST'],['imports/scope1','DELETE'],['users','PUT'],['validate-migration','POST']]) assert.equal((await siteRequest(route,method,{},cookie)).status,403);
 assert.equal((await siteRequest('audit','GET',undefined,cookie)).status,404);
 addPerson(person('employee-1','Ana','100','inativo'));
 assert.equal((await siteRequest('state','GET',undefined,cookie)).status,401);
 assert.equal((await siteRequest('auth/login','POST',{username:'100',password:'test-staff-password'})).status,401);
});
test('tentativas de login limitadas no servidor',async()=>{
 for(let i=0;i<10;i++)assert.equal((await siteRequest('auth/login','POST',{username:'absent',password:'wrong'},'','198.51.100.99')).status,401);
 const blocked=await siteRequest('auth/login','POST',{username:'absent',password:'wrong'},'','198.51.100.99');assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'900');
});

test('exclusão de funcionário: permissões, concorrência, remoção no banco e revogação de sessões',async()=>{
 addPerson(person('delete-me','Teste Exclusão','9030'));
 addPerson(person('keep-me','Teste Preservado','9040'));
 const login=await siteRequest('auth/login','POST',{username:'9030',password:'test-staff-password'},'','198.51.100.31');
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const version=db.prepare("SELECT version FROM revisions WHERE store_id='visao-308' AND resource='employees'").get()?.version||0;
 const countImports=db.prepare('SELECT count(*) AS n FROM imports').get().n;
 assert.equal((await siteRequest('employees/delete-me','DELETE',{version},cookie)).status,403);
 assert.equal((await request('employees/delete-me','DELETE',{version},await token('manager@example.com'))).status,403);
 assert.equal((await request('employees/delete-me','DELETE',{version},admin,'https://evil.example')).status,403);
 assert.equal((await request('employees/delete-me','DELETE',{version:version+3},admin)).status,409);
 assert.equal(db.prepare("SELECT count(*) AS n FROM documents WHERE resource='employees' AND id='delete-me'").get().n,1);
 assert.equal((await siteRequest('state','GET',undefined,cookie)).status,200);
 const result=await request('employees/delete-me','DELETE',{version},admin);
 assert.equal(result.status,200);assert.equal((await result.json()).version,version+1);
 assert.equal(db.prepare("SELECT count(*) AS n FROM documents WHERE resource='employees' AND id='delete-me'").get().n,0);
 assert.equal(db.prepare("SELECT count(*) AS n FROM site_sessions WHERE identity='delete-me'").get().n,0);
 assert.equal(db.prepare("SELECT count(*) AS n FROM documents WHERE resource='employees' AND id='keep-me'").get().n,1);
 assert.equal(db.prepare('SELECT count(*) AS n FROM imports').get().n,countImports);
 assert.equal(db.prepare("SELECT count(*) AS n FROM audit_log WHERE action='delete' AND resource='employees/delete-me'").get().n,1);
 assert.equal((await siteRequest('state','GET',undefined,cookie)).status,401);
 assert.equal((await siteRequest('auth/login','POST',{username:'9030',password:'test-staff-password'},'','198.51.100.31')).status,401);
 assert.equal((await request('employees/delete-me','DELETE',{version:version+1},admin)).status,404);
});

test('vendas do mês e gráficos usam somente vendedores válidos dos dias importados',()=>{
 const employees=[person('seller-a','Ana','510'),{...person('seller-b','Bia','520'),role:'Perfumista'}, {...person('seller-c','Caio','530'),role:'Caixa'},person('inactive','Davi','540','inativo')];
 const rows=[['Ana',50000],['Bia',20020.55],['Caio',7055.58],['TOTAL',77076.13],['Canal externo',20726.57],['Davi',500],['Ana',0],['Bia',-100]].map(([seller,sale],index)=>({...record.records[0],sourceRow:index+2,seller,sale}));
 const daily={...record,id:'day21',reference:'2026-10-21',records:rows};
 const old={...daily,id:'old21',importedAt:'2026-10-21T08:00:00.000Z',records:[{...rows[0],sale:1}]};
 const chosen=salesDashboard.monthImports([old,daily],'2026-10');
 assert.equal(chosen.length,1);assert.equal(chosen[0].id,'day21');
 const entries=salesDashboard.validSalesEntries(chosen,employees);
 assert.equal(entries.length,3);
 assert.ok(Math.abs(salesDashboard.sumSales(entries)-77076.13)<.001);
 const sectors=salesDashboard.SALES_SECTORS.map(sector=>salesDashboard.sumSales(salesDashboard.applySalesFilter(entries,{sector,employeeId:''})));
 assert.ok(Math.abs(sectors.reduce((a,b)=>a+b,0)-77076.13)<.001);
 assert.equal(sectors[2],7055.58);
 assert.equal(salesDashboard.sumSales(salesDashboard.applySalesFilter(entries,{sector:'Todos',employeeId:'seller-a'})),50000);
 const monthly={...daily,id:'month',periodKind:'month',reference:'2026-10'};
 assert.equal(salesDashboard.monthImports([daily,monthly],'2026-10')[0].id,'month');
});

test('campanhas persistem com revisão e funcionário só consulta publicadas vigentes',async()=>{
 const data=[campaign,{...campaign,id:'draft',status:'draft'},{...campaign,id:'closed',status:'closed'},{...campaign,id:'future',startsAt:'2099-01-01'}];
 assert.equal((await request('campaigns','PUT',{version:0,data},admin)).status,200);
 assert.equal((await request('campaigns','PUT',{version:0,data:[]},admin)).status,409);
 const state=await(await request('state','GET',undefined,admin)).json();assert.equal(state.data.campaigns.length,4);assert.equal(state.versions.campaigns,1);
 assert.equal((await request('campaigns','PUT',{version:1,data:[]},await token('viewer@example.com'))).status,403);
 addPerson(person('campaign-employee','Teste Ranking','9088'));
 const login=await siteRequest('auth/login','POST',{username:'9088',password:'test-staff-password'},'','198.51.100.88');
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const staff=await(await siteRequest('state','GET',undefined,cookie)).json();
 assert.equal(staff.data.campaigns.length,1);assert.equal(staff.versions.campaigns,1);assert.equal(staff.data.campaigns[0].powerBiUrl,'');assert.equal(staff.data.campaigns[0].ranking.rows[0].seller,'Pessoa externa');
 assert.equal((await siteRequest('campaigns','PUT',{version:1,data:[]},cookie)).status,403);
 const backup={schemaVersion:1,employees:[],goals:[],templates:[],imports:[],campaigns:data};
 assert.equal(migration.backupSchema.parse(backup).campaigns.length,4);
 const old={...backup};delete old.campaigns;assert.equal(migration.backupSchema.parse(old).campaigns.length,0);
 assert.equal(migration.mergeMigration(backup,{...backup,campaigns:[]}).campaigns.length,4);
 assert.equal((await request('validate-migration','POST',backup,admin)).status,200);
});
