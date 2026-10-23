"use client";
import {useState} from "react";
import {Save,Target} from "lucide-react";
import {cloud,isCloud} from "@/lib/cloud/client";
import {goalDays,sectorDailyBase} from "@/lib/goals/daily";
import {saveGoalDays} from "@/lib/goals/repository";
import {GOAL_SECTORS,type MonthlyGoal} from "@/lib/goals/model";
import type {Employee} from "@/lib/team/model";
const money=(value:number|null)=>value===null?"Não definida":value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function DailyDistribution({month,goals,employees}:{month:string;goals:MonthlyGoal[];employees:Employee[]}) {
 const [days,setDays]=useState(String(goalDays(goals,month))),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const canEdit=!isCloud()||cloud.session.role==="admin";
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");try{await saveGoalDays(month,Number(days));setMessage("Quantidade de dias salva. Metas individuais recalculadas.");}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar os dias.");}finally{setBusy(false);}}
 return <section className="panel daily-distribution"><div className="daily-distribution-heading"><div><h2><Target size={20}/> Distribuição das metas por colaborador</h2><p>Meta mensal do setor ÷ dias informados ÷ colaboradores ativos do setor.</p></div><form onSubmit={save}><label className="form-field"><span>Quantidade de dias do mês</span><input aria-label="Quantidade de dias do mês" className="form-control" type="number" min="1" max="31" step="1" required value={days} disabled={busy||!canEdit} onChange={event=>{setDays(event.target.value);setMessage("");}}/></label>{canEdit&&<button className="button button-primary" disabled={busy} type="submit"><Save size={16}/>{busy?"Salvando…":"Salvar dias"}</button>}</form></div><p className="form-help">Sem ajuste, são usados os dias corridos do mês. A divisão abaixo usa a quantidade salva.</p><div className="daily-distribution-grid">{GOAL_SECTORS.map(sector=>{const base=sectorDailyBase(goals,employees,month,sector);return <article key={sector}><h3>{sector}</h3><p>{base.activeEmployees} colaboradores ativos · {base.days} dias</p><div><span>Meta mensal por pessoa</span><strong>{money(base.monthlyTarget)}</strong></div><div><span>Meta diária por pessoa</span><strong>{money(base.target)}</strong></div>{!base.activeEmployees&&<small>Cadastre colaboradores ativos neste setor.</small>}</article>;})}</div>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="goal-success" role="status">{message}</p>}</section>;
}
