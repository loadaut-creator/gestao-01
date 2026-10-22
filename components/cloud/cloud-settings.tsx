"use client";
import { useState } from "react";
import { cloud, api, isCloud, refreshCloud, saveCloud } from "@/lib/cloud/client";
import { listImports, listLocalImports } from "@/lib/bi/repository";
import { backupSchema, mergeMigration, type Backup } from "@/lib/cloud/migration";

async function backup(local:boolean):Promise<Backup> {
  return {schemaVersion:1,exportedAt:new Date().toISOString(),
    employees:local?JSON.parse(localStorage.getItem("visao-comercial:employees:v1")||"[]"):cloud.data.employees,
    goals:local?JSON.parse(localStorage.getItem("visao308:monthly-goals:v1")||"[]"):cloud.data.goals,
    templates:local?JSON.parse(localStorage.getItem("visao-comercial:bi-mapping-templates:v1")||"[]"):cloud.data.templates,
    imports:await (local?listLocalImports():listImports())};
}
function download(data:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=`visao308-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function CloudSettings() {
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const [source,setSource]=useState<Backup|null>(null);
  const [preview,setPreview]=useState<ReturnType<typeof mergeMigration>|null>(null);
  const [users,setUsers]=useState(()=>cloud.data.users.length?cloud.data.users:[{email:cloud.session.email||"",role:"admin",active:true}]);
  const [email,setEmail]=useState("");const [role,setRole]=useState("viewer");
  const admin=isCloud()&&cloud.session.role==="admin";
  async function run(task:()=>Promise<void>) {setBusy(true);setMessage("");try{await task();}catch(error){setMessage(error instanceof Error?error.message:"Operação não concluída.");}finally{setBusy(false);}}
  async function inspect(data:unknown) {
    const parsed=backupSchema.parse(data);await api("validate-migration",{method:"POST",body:JSON.stringify(parsed)});
    await refreshCloud();const remote=await backup(false);setSource(parsed);setPreview(mergeMigration(parsed,remote));
  }
  async function migrate() {
    if(!source||!preview||preview.conflicts.length)return;
    await refreshCloud();const remote=await backup(false);const plan=mergeMigration(source,remote);
    if(plan.conflicts.length){setPreview(plan);throw Error("Há conflitos. Confira a prévia atualizada.");}
    // One collection or import is committed atomically. A retry resumes after the last success.
    await saveCloud("employees",plan.employees);await saveCloud("goals",plan.goals);await saveCloud("templates",plan.templates);
    for(const record of source.imports) await api("imports",{method:"POST",body:JSON.stringify(record)});
    await refreshCloud();window.dispatchEvent(new Event("visao308:imports-changed"));
    setSource(null);setPreview(null);setMessage("Migração concluída. Dados locais preservados. Confira equipe, metas e totais de vendas.");
  }
  return <div className="goals-page"><section className="panel"><h2>Dados e segurança</h2><p>{isCloud()?`Conectado como ${cloud.session.email}. Dados compartilhados na nuvem.`:"Modo local: os dados permanecem neste navegador. Exporte o backup antes de ativar a nuvem."}</p><div className="cloud-actions"><button className="button button-primary" disabled={busy} onClick={()=>run(async()=>{download(await backup(!isCloud()));setMessage("Backup gerado. Guarde o arquivo em local seguro.");})}>Exportar backup {isCloud()?"da nuvem":"deste navegador"}</button>{isCloud()&&<button className="button button-neutral" disabled={busy} onClick={()=>run(async()=>{download(await backup(true));setMessage("Backup local gerado.");})}>Exportar dados locais antigos</button>}</div><p className="form-help">O arquivo contém dados de funcionários e vendas. Cada navegador e endereço tem seu próprio armazenamento local; exporte também pelo localhost ou pages.dev se você utilizou esses endereços.</p></section>
    {admin&&<section className="panel"><h2>Migrar dados para a nuvem</h2><p>Selecione um backup ou confira os dados locais deste navegador. Registros existentes com diferenças precisam ser resolvidos antes da transferência.</p><div className="cloud-actions"><label className="form-field"><span>Arquivo de backup (.json)</span><input type="file" accept=".json,application/json" disabled={busy} onChange={event=>{const file=event.target.files?.[0];setPreview(null);setSource(null);if(file)run(async()=>{if(file.size>12000000)throw Error("Backup maior que 12 MB. Divida por origem ou período.");await inspect(JSON.parse(await file.text()));});}}/></label><button className="button button-neutral" disabled={busy} onClick={()=>run(async()=>{await inspect(await backup(true));})}>Conferir dados deste navegador</button></div>{preview&&<div><p>Após a migração: {preview.employees.length} funcionários, {preview.goals.length} metas e {preview.imports.length} importações.</p>{preview.conflicts.length?<div role="alert"><p>Não é possível aplicar enquanto existirem conflitos:</p><ul>{preview.conflicts.slice(0,20).map(item=><li key={item}>{item}</li>)}</ul></div>:<button className="button button-primary" disabled={busy} onClick={()=>run(migrate)}>Confirmar transferência para a nuvem</button>}</div>}</section>}
    {admin&&cloud.session.login!=="site"&&<section className="panel"><h2>Usuários autorizados</h2><p>Além deste cadastro, o e-mail deve estar autorizado na política do Cloudflare Access.</p><div className="cloud-actions"><label className="form-field"><span>E-mail</span><input className="form-control" type="email" value={email} onChange={event=>setEmail(event.target.value)}/></label><label className="form-field"><span>Permissão</span><select className="form-control" value={role} onChange={event=>setRole(event.target.value)}><option value="viewer">Consulta</option><option value="manager">Gerente</option><option value="admin">Administrador</option></select></label><button className="button button-neutral" disabled={busy||!email} onClick={()=>{setUsers(current=>[...current.filter(user=>user.email!==email.trim().toLowerCase()),{email:email.trim().toLowerCase(),role,active:true}]);setEmail("");}}>Adicionar à lista</button></div><ul>{users.map(user=><li key={user.email}>{user.email} — {user.role} <label><input type="checkbox" checked={user.active} disabled={user.email===cloud.session.email} onChange={event=>setUsers(current=>current.map(item=>item.email===user.email?{...item,active:event.target.checked}:item))}/> Ativo</label></li>)}</ul><button className="button button-primary" disabled={busy} onClick={()=>run(async()=>{await saveCloud("users",users);setMessage("Permissões salvas.");})}>Salvar acessos</button></section>}
    {busy&&<p role="status">Processando. Aguarde a confirmação antes de fechar a página.</p>}{message&&<p role="status" className="panel">{message}</p>}
  </div>;
}
