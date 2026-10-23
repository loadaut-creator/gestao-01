"use client";
import {useEffect,useState} from "react";
import {TeamDatePicker} from "../team/team-date-picker";
import {Target} from "lucide-react";
import {cloud,isCloud,refreshCloud} from "@/lib/cloud/client";
import {localDate} from "@/lib/campaigns/model";
import {dailyActual,type DailyGoal} from "@/lib/goals/daily";
import {loadDailyGoals,subscribeToDailyGoals} from "@/lib/goals/daily-repository";
import type {ImportRecord} from "@/lib/bi/model";
const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function EmployeeDailyGoal({imports}:{imports:ImportRecord[]|null}) {
 const [date,setDate]=useState(localDate),[goals,setGoals]=useState<DailyGoal[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true,checking=false;const read=()=>{if(active)try{setGoals(loadDailyGoals());setError("");}catch{setError("Não foi possível carregar sua meta diária.");}};const sync=async()=>{if(!active||checking||document.hidden)return;checking=true;try{if(isCloud())await refreshCloud();read();}catch{if(active)setError("Não foi possível atualizar a meta diária.");}finally{checking=false;}};queueMicrotask(read);const stop=subscribeToDailyGoals(read),timer=setInterval(()=>void sync(),60000);window.addEventListener("focus",sync);document.addEventListener("visibilitychange",sync);return()=>{active=false;stop();clearInterval(timer);window.removeEventListener("focus",sync);document.removeEventListener("visibilitychange",sync);};},[]);
 const goal=goals.find(item=>item.employeeId===cloud.session.employeeId&&item.date===date);
 const actual=imports===null?null:dailyActual(imports,date),attainment=goal&&actual!==null?actual/goal.target*100:null,remaining=goal&&actual!==null?Math.max(0,goal.target-actual):null;
 return <section className="panel employee-daily-goal"><div className="daily-goal-heading"><div><span className="goal-sector-icon"><Target size={20}/></span><h2>Meta diária</h2></div><label className="form-field"><span>Dia da meta</span><TeamDatePicker label="Dia da meta" heading="Minha meta diária" value={date} onChange={setDate}/></label></div>{error?<p role="alert">{error}</p>:<><div className="daily-goal-stats"><div><span>Sua meta</span><strong>{goal?money(goal.target):"Meta não definida"}</strong></div><div><span>Vendas do dia</span><strong>{actual===null?"—":money(actual)}</strong></div><div><span>Faltam para a meta</span><strong>{remaining===null?"—":money(remaining)}</strong></div></div>{goal&&<progress max={100} value={Math.min(100,Math.max(0,attainment??0))} aria-label="Atingimento da sua meta diária"/>}<p className="form-help">{!goal?"O administrador ainda não definiu sua meta para este dia.":actual===null?"Aguardando a importação das vendas deste dia.":remaining===0?"Meta atingida!":`${attainment!.toLocaleString("pt-BR",{maximumFractionDigits:1})}% da meta atingida.`}</p></>}</section>;
}
