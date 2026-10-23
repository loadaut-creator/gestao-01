import { sectorCampaigns, campaignSchema, type Campaign } from "../../lib/campaigns/model";
import {dailyGoalSchema,type DailyGoal} from "../../lib/goals/daily";
import { authenticate, type CloudEnv } from "../../lib/cloud/auth";
import { importSchema, parseDocuments, resources, userSchema, type Resource } from "../../lib/cloud/validation";
import { z } from "zod";
import { allEmployees, siteIdentity, siteLogin, siteLoginEnabled, siteLogout, siteSession } from "../../lib/cloud/site-auth";
import { scopeEmployeeImports } from "../../lib/cloud/employee-scope";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
async function readJson(request:Request):Promise<unknown> {
  const reader=request.body?.getReader();if(!reader)throw new Response("Envie os dados da operação.",{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>12000000){await reader.cancel();throw new Response("Dados maiores que 12 MB. Divida o arquivo.",{status:413});}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Response("JSON inválido.",{status:400});}
}
export const onRequest: PagesFunction<CloudEnv> = async ({request,env,params}) => {
  try {
    const path=Array.isArray(params.path)?params.path.join("/"):params.path??"";
    if(path==="session" && env.CLOUD_ENABLED!=="1") return json({mode:"local"});
    if(env.CLOUD_ENABLED!=="1") return json({error:"Serviço na nuvem ainda não ativado."},503);
    if(siteLoginEnabled(env)&&path==="auth/login"&&request.method==="POST")return await siteLogin(request,env);
    if(siteLoginEnabled(env)&&path==="auth/logout"&&request.method==="POST")return await siteLogout(request,env);
    const siteUser=siteLoginEnabled(env)?await siteIdentity(request,env):null;
    if(siteLoginEnabled(env)&&path==="session")return json(siteSession(siteUser));
    if(siteLoginEnabled(env)&&!siteUser)return json({error:"Entre no sistema para continuar."},401);
    const email=siteUser?siteUser.identity:await authenticate(request,env);
    const store=env.STORE_ID || "visao-308";
    const user=siteUser?null:await env.DB.prepare("SELECT data FROM documents WHERE store_id=? AND resource='users' AND id=?").bind(store,email).first<{data:string}>();
    const permission = siteUser ? {email,role:siteUser.kind,active:true} : user ? userSchema.parse(JSON.parse(user.data)) : email===env.ADMIN_EMAIL.trim().toLowerCase() ? {email,role:"admin",active:true} : null;
    if(!permission?.active) return json({error:"Seu usuário não tem acesso ao sistema."},403);
    const q=(sql:string,...values:(string|number|null)[])=>env.DB.prepare(sql).bind(...values);
    const audit=(action:string,resource:string)=>q("INSERT INTO audit_log VALUES(?,?,?,?,?,?)",crypto.randomUUID(),store,email,action,resource,new Date().toISOString());
    if(path==="session") return json({mode:"cloud",email,role:permission.role});
    if(request.method!=="GET") {
      if(request.headers.get("Origin")!==new URL(request.url).origin || request.headers.get("Content-Type")?.split(";")[0]!=="application/json") return json({error:"Origem ou formato inválido."},403);
      if(permission.role==="viewer"||permission.role==="employee") return json({error:"Seu perfil permite apenas consulta."},403);
      if(Number(request.headers.get("Content-Length")||0)>12000000) return json({error:"Arquivo muito grande. Divida a migração."},413);
    }
    const documents=async(resource:Resource)=>(await q("SELECT data FROM documents WHERE store_id=? AND resource=? ORDER BY id",store,resource).all<{data:string}>()).results.map(item=>JSON.parse(item.data));
    if(path==="validate-migration" && request.method==="POST") {
      if(permission.role!=="admin") return json({error:"Apenas o administrador pode migrar dados."},403);
      const backup=z.object({schemaVersion:z.literal(1),employees:z.array(z.unknown()),goals:z.array(z.unknown()),templates:z.array(z.unknown()),imports:z.array(importSchema).max(1000),campaigns:z.array(campaignSchema).max(100).default([]),dailyGoals:z.array(dailyGoalSchema).max(5000).default([])}).parse(await readJson(request));
      for(const resource of ["employees","goals","templates","campaigns","dailyGoals"] as const) parseDocuments(resource,backup[resource]);
      if(new Set(backup.imports.map(record=>record.id)).size!==backup.imports.length) return json({error:"Backup com importações repetidas."},400);
      return json({ok:true});
    }
    if(path==="state" && request.method==="GET") {
      if(siteUser?.kind==="employee") {
        const revisions=(await q("SELECT resource,version FROM revisions WHERE store_id=? AND resource IN ('campaigns','dailyGoals')",store).all<{resource:string;version:number}>()).results;
        const dailyGoals=(await documents("dailyGoals") as DailyGoal[]).filter(goal=>goal.employeeId===siteUser.identity);
        return json({data:{employees:[siteUser.employee],goals:[],templates:[],users:[],dailyGoals,campaigns:sectorCampaigns(await documents("campaigns") as Campaign[],siteUser.employee?.sector)},versions:Object.fromEntries(revisions.map(item=>[item.resource,item.version]))});
      }
      const revisions=(await q("SELECT resource,version FROM revisions WHERE store_id=?",store).all<{resource:string;version:number}>()).results;
      const entries=await Promise.all(resources.filter(resource=>resource!=="users"||permission.role==="admin").map(async resource=>[resource,await documents(resource)]));
      return json({data:Object.fromEntries(entries),versions:Object.fromEntries(revisions.map(item=>[item.resource,item.version]))});
    }
    if(path.startsWith("employees/") && request.method==="DELETE") {
      if(permission.role!=="admin") return json({error:"Apenas o administrador exclui funcionários."},403);
      const id=path.slice("employees/".length);
      const body=z.object({version:z.number().int().nonnegative()}).parse(await readJson(request));
      const employee=await q("SELECT id FROM documents WHERE store_id=? AND resource='employees' AND id=?",store,id).first();
      if(!employee) return json({error:"Funcionário não encontrado. Atualize a página."},404);
      await env.DB.batch([
        q("INSERT OR IGNORE INTO revisions VALUES(?,?,0)",store,"employees"),
        q("UPDATE revisions SET version=? WHERE store_id=? AND resource='employees'",body.version+1,store),
        q("DELETE FROM documents WHERE store_id=? AND resource='employees' AND id=?",store,id),
        q("DELETE FROM site_sessions WHERE store_id=? AND kind='employee' AND identity=?",store,id),
        audit("delete",`employees/${id}`),
      ]);
      return json({version:body.version+1});
    }
    if(resources.includes(path as Resource) && request.method==="PUT") {
      const resource=path as Resource;
      if(resource==="dailyGoals"&&permission.role!=="admin")return json({error:"Apenas o administrador define metas diárias."},403);
      if(resource==="users"&&permission.role!=="admin") return json({error:"Apenas o administrador gerencia acessos."},403);
      const body=z.object({version:z.number().int().nonnegative(),data:z.unknown()}).parse(await readJson(request));
      const rows=parseDocuments(resource,body.data);
      if(resource==="users" && !rows.some(row=>"email" in row.data && row.data.email===email && row.data.active && row.data.role==="admin")) return json({error:"Mantenha seu próprio acesso de administrador ativo."},400);
      await env.DB.batch([
        q("INSERT OR IGNORE INTO revisions VALUES(?,?,0)",store,resource),
        q("UPDATE revisions SET version=? WHERE store_id=? AND resource=?",body.version+1,store,resource),
        q("DELETE FROM documents WHERE store_id=? AND resource=?",store,resource),
        ...rows.map(row=>q("INSERT INTO documents VALUES(?,?,?,?)",store,resource,row.id,JSON.stringify(row.data))),audit("replace",resource),
      ]);
      return json({version:body.version+1});
    }
    if(path==="imports" && request.method==="GET") {
      const imports=(await q("SELECT id,data FROM imports WHERE store_id=?",store).all<{id:string;data:string}>()).results;
      const rows=(await q("SELECT import_id,data FROM sales_rows WHERE store_id=? ORDER BY import_id,position",store).all<{import_id:string;data:string}>()).results;
      const grouped=new Map<string,unknown[]>();for(const row of rows){const list=grouped.get(row.import_id)||[];list.push(JSON.parse(row.data));grouped.set(row.import_id,list);}
      const result=imports.map(item=>({...JSON.parse(item.data),records:grouped.get(item.id)||[]})).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));
      return json(siteUser?.kind==="employee"?scopeEmployeeImports(result,siteUser.identity,await allEmployees(env)):result);
    }
    if(path==="imports" && request.method==="POST") {
      const record=importSchema.parse(await readJson(request));
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({kind:record.periodKind,reference:record.reference,columns:record.columns,records:record.records}))))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
      const previous=await q("SELECT id,fingerprint FROM imports WHERE store_id=? AND (id=? OR fingerprint=?)",store,record.id,fingerprint).first<{id:string;fingerprint:string}>();
      if(previous) return previous.fingerprint===fingerprint ? json({id:previous.id,duplicate:true}) : json({error:"Já existe uma importação diferente com este identificador."},409);
      const {records,...metadata}=record;
      await env.DB.batch([q("INSERT INTO imports VALUES(?,?,?,?)",store,record.id,fingerprint,JSON.stringify(metadata)),...records.map((row,index)=>q("INSERT INTO sales_rows VALUES(?,?,?,?)",store,record.id,index,JSON.stringify(row))),audit("create",`imports/${record.id}`)]);
      return json({id:record.id,duplicate:false},201);
    }
    if(path.startsWith("imports/") && request.method==="DELETE") {
      if(permission.role!=="admin") return json({error:"Apenas o administrador exclui importações."},403);
      const id=path.slice(8);
      await env.DB.batch([q("DELETE FROM imports WHERE store_id=? AND id=?",store,id),audit("delete",`imports/${id}`)]);
      return json({ok:true});
    }
    if(path==="audit"&&request.method==="GET"&&permission.role==="admin") return json((await q("SELECT actor,action,resource,created_at FROM audit_log WHERE store_id=? ORDER BY created_at DESC LIMIT 100",store).all()).results);
    return json({error:"Recurso não encontrado."},404);
  } catch(error) {
    if(error instanceof Response) return json({error:await error.text()},error.status);
    if(error instanceof z.ZodError) return json({error:"Revise os dados enviados.",details:error.issues.map(issue=>issue.message).slice(0,5)},400);
    const message=error instanceof Error?error.message:"";
    if(message.includes("revision_conflict")) return json({error:"Os dados foram alterados em outro aparelho. Atualize a página e revise antes de salvar."},409);
    if(message.includes("UNIQUE constraint")) return json({error:"Registro já cadastrado. Atualize a página antes de repetir."},409);
    if(message.includes("repetid")) return json({error:message},400);
    console.error("cloud-api",message);
    return json({error:"Não foi possível concluir a operação. Seus dados não foram confirmados como salvos."},500);
  }
};
