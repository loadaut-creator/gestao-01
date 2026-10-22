import type { CloudEnv } from "./auth";
import { employeeSchema } from "./validation";
import type { Employee } from "../team/model";
export type SiteIdentity = {kind:"admin"|"employee";identity:string;name:string;employee?:Employee};
const COOKIE="__Host-visao_session";
export const siteLoginEnabled=(env:CloudEnv)=>env.SITE_LOGIN_ENABLED==="1";
export async function digest(value:string) {
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function passwordHash(password:string,salt:string) {
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:100000},key,256);
 return Array.from(new Uint8Array(bits)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function verifyPassword(password:string,encoded:string) {
 const [scheme,salt,expected]=encoded.split("$");
 if(scheme!=="pbkdf2-sha256-100000"||!salt||!expected||!/^[a-f0-9]{64}$/.test(expected))throw new Response("Configure as credenciais do login no servidor.",{status:503});
 const actual=await passwordHash(password,salt);let mismatch=0;
 for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^actual.charCodeAt(i);
 return mismatch===0;
}
export async function allEmployees(env:CloudEnv) {
 const result=await env.DB.prepare("SELECT data FROM documents WHERE store_id=? AND resource='employees'").bind(env.STORE_ID||"visao-308").all<{data:string}>();
 return result.results.map(row=>employeeSchema.parse(JSON.parse(row.data)));
}
function sessionToken(request:Request) {return request.headers.get("Cookie")?.split(";").map(item=>item.trim()).find(item=>item.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||"";}
export async function siteIdentity(request:Request,env:CloudEnv):Promise<SiteIdentity|null> {
 const token=sessionToken(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await env.DB.prepare("SELECT identity,kind FROM site_sessions WHERE token_hash=? AND store_id=? AND expires_at>?").bind(await digest(token),env.STORE_ID||"visao-308",Date.now()).first<{identity:string;kind:"admin"|"employee"}>();
 if(!row)return null;
 if(row.kind==="admin")return row.identity===(env.ADMIN_USERNAME||"indiana@308")?{kind:"admin",identity:row.identity,name:"Administrador"}:null;
 const employee=(await allEmployees(env)).find(person=>person.id===row.identity);
 return employee?.status==="ativo"?{kind:"employee",identity:employee.id,name:employee.name,employee}:null;
}
export function siteSession(identity:SiteIdentity|null) {
 return identity?{mode:"cloud",authenticated:true,login:"site",role:identity.kind,email:undefined,username:identity.kind==="admin"?identity.identity:identity.employee?.registration,name:identity.name,jobTitle:identity.employee?.jobTitle||identity.employee?.role,employeeId:identity.employee?.id}:{mode:"cloud",authenticated:false,login:"site"};
}
function originValid(request:Request) {return request.headers.get("Origin")===new URL(request.url).origin && request.headers.get("Content-Type")?.split(";")[0]==="application/json";}
export async function siteLogin(request:Request,env:CloudEnv):Promise<Response> {
 const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...headers}});
 if(!originValid(request))return reply({error:"Origem inválida."},403);
 if(!env.DB||!env.ADMIN_PASSWORD_HASH||!env.EMPLOYEE_PASSWORD_HASH)return reply({error:"O login está aguardando a configuração do administrador."},503);
 const reader=request.body?.getReader();if(!reader)return reply({error:"Informe suas credenciais."},400);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();return reply({error:"Dados de acesso inválidos."},400);}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
 const raw=new TextDecoder().decode(bytes);
 let body: {username?:unknown;password?:unknown;remember?:unknown};try{body=JSON.parse(raw);}catch{return reply({error:"Dados inválidos."},400);}
 if(typeof body.username!=="string"||typeof body.password!=="string"||!body.username.trim()||body.username.length>150||body.password.length>256)return reply({error:"Informe o usuário ou matrícula e a senha."},400);
 const username=body.username.trim();const now=Date.now();const store=env.STORE_ID||"visao-308";
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 for(const [key,limit] of [[`${store}:ip:${ip}`,60],[`${store}:login:${ip}:${username.toLowerCase()}`,10]] as const){
  const bucket=await digest(key);
  await env.DB.prepare("INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END").bind(bucket,now+900000,now,now).run();
  const attempt=await env.DB.prepare("SELECT attempts FROM login_attempts WHERE bucket=?").bind(bucket).first<{attempts:number}>();
  if((attempt?.attempts||0)>limit)return reply({error:"Muitas tentativas. Aguarde 15 minutos antes de tentar novamente."},429,{"Retry-After":"900"});
 }
 const admin=username.toLowerCase()===(env.ADMIN_USERNAME||"indiana@308").toLowerCase();
 const valid=await verifyPassword(body.password,admin?env.ADMIN_PASSWORD_HASH:env.EMPLOYEE_PASSWORD_HASH);
 let identity:SiteIdentity|null=null;
 if(admin&&valid)identity={kind:"admin",identity:env.ADMIN_USERNAME||"indiana@308",name:"Administrador"};
 if(!admin&&valid){
  const matches=(await allEmployees(env)).filter(person=>person.registration.trim()===username&&person.status==="ativo");
  if(matches.length===1)identity={kind:"employee",identity:matches[0].id,name:matches[0].name,employee:matches[0]};
 }
 if(!identity)return reply({error:"Usuário ou senha inválidos, ou cadastro sem acesso ativo."},401);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
 const ttl=body.remember===true?7*86400:8*3600;
 const previous=sessionToken(request);
 await env.DB.batch([
  env.DB.prepare("DELETE FROM site_sessions WHERE expires_at<=? OR token_hash=?").bind(now,await digest(previous)),
  env.DB.prepare("DELETE FROM login_attempts WHERE reset_at<=?").bind(now),
  env.DB.prepare("INSERT INTO site_sessions VALUES(?,?,?,?,?,?)").bind(await digest(token),store,identity.identity,identity.kind,now+ttl*1000,now),
  env.DB.prepare("INSERT INTO audit_log VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),store,identity.identity,"login",identity.kind,new Date(now).toISOString()),
 ]);
 return reply(siteSession(identity),200,{"Set-Cookie":`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`});
}
export async function siteLogout(request:Request,env:CloudEnv) {
 if(!originValid(request))return Response.json({error:"Origem inválida."},{status:403,headers:{"Cache-Control":"no-store"}});
 await env.DB.prepare("DELETE FROM site_sessions WHERE token_hash=? AND store_id=?").bind(await digest(sessionToken(request)),env.STORE_ID||"visao-308").run();
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}});
}
