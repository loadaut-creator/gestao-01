"use client";
import {useEffect,useState} from "react";
import {TeamDatePicker} from "../team/team-date-picker";
import {Save,Target} from "lucide-react";
import {cloud,isCloud} from "@/lib/cloud/client";
import {localDate} from "@/lib/campaigns/model";
import {loadDailyGoals,saveDailyGoal,subscribeToDailyGoals} from "@/lib/goals/daily-repository";
import type {DailyGoal} from "@/lib/goals/daily";
import type {Employee} from "@/lib/team/model";

export function DailyGoalsEditor({employees}:{employees:Employee[]}) {
 const [date,setDate]=useState(localDate),[employeeId,setEmployeeId]=useState(""),[target,setTarget]=useState<string|null>(null);
 const [goals,setGoals]=useState<DailyGoal[]>([]),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const canEdit=!isCloud()||cloud.session.role==="admin";
 useEffect(()=>{const refresh=()=>{try{setGoals(loadDailyGoals());}catch{setError("Não foi possível carregar as metas diárias.");}};queueMicrotask(refresh);return subscribeToDailyGoals(refresh);},[]);
 const people=employees.filter(person=>person.status==="ativo").sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 const selectedId=employeeId||people[0]?.id||"";
 const shownTarget=target??String(goals.find(goal=>goal.employeeId===selectedId&&goal.date===date)?.target??"");
 function select(personId:string,nextDate=date){setEmployeeId(personId);setDate(nextDate);setTarget(String(goals.find(goal=>goal.employeeId===personId&&goal.date===nextDate)?.target??""));setMessage("");setError("");}
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");try{if(!people.some(person=>person.id===selectedId))throw Error("Selecione um colaborador ativo.");await saveDailyGoal({date,employeeId:selectedId,target:Number(shownTarget),updatedAt:new Date().toISOString()});setMessage("Meta diária salva. O valor já está disponível para o colaborador.");}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar a meta.");}finally{setBusy(false);}}
 const saved=goals.filter(goal=>goal.date===date).map(goal=>({goal,person:employees.find(person=>person.id===goal.employeeId)})).filter(item=>item.person).sort((a,b)=>a.person!.name.localeCompare(b.person!.name,"pt-BR"));
 return <section className="panel daily-goals-editor"><div className="goal-sector-heading"><div><span className="goal-sector-icon"><Target size={20}/></span><h2>Metas diárias por colaborador</h2></div></div><p className="form-help">Defina a meta de vendas de cada pessoa para uma data específica.</p>
 <form onSubmit={save} className="daily-goal-form"><label className="form-field"><span>Dia da meta</span><TeamDatePicker label="Dia da meta" heading="Dia da meta" value={date} disabled={busy} onChange={value=>select(selectedId,value)}/></label><label className="form-field"><span>Colaborador</span><select className="form-control" required value={selectedId} disabled={busy||!canEdit} onChange={event=>select(event.target.value)}>{!people.length&&<option value="">Nenhum colaborador ativo</option>}{people.map(person=><option key={person.id} value={person.id}>{person.name} · {person.registration}</option>)}</select></label><label className="form-field"><span>Meta de vendas (R$)</span><input className="form-control" type="number" min="0.01" max="1000000000" step="0.01" placeholder="Ex.: 1500,00" required value={shownTarget} disabled={busy||!canEdit} onChange={event=>{setTarget(event.target.value);setMessage("");}}/></label>{canEdit&&<button type="submit" className="button button-primary" disabled={busy||!selectedId}><Save size={17}/>{busy?"Salvando…":"Salvar meta diária"}</button>}</form>
 {!canEdit&&<p className="form-help">Somente o administrador pode definir metas diárias.</p>}{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="goal-success" role="status">{message}</p>}
 {!!saved.length?<div className="table-scroll daily-goals-list"><table><thead><tr><th>Colaborador</th><th>Meta diária</th>{canEdit&&<th><span className="sr-only">Ações</span></th>}</tr></thead><tbody>{saved.map(({goal,person})=><tr key={goal.employeeId}><th scope="row">{person!.name}<small>{person!.registration} · {person!.jobTitle||person!.role}</small></th><td>{goal.target.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>{canEdit&&<td><button type="button" className="button button-neutral" disabled={busy} onClick={()=>select(goal.employeeId)}>Editar</button></td>}</tr>)}</tbody></table></div>:<p className="form-help">Nenhuma meta diária definida para esta data.</p>}
 </section>;
}
