"use client";
import Image from "next/image";
import { CampaignsPage } from "../campaigns/campaigns-page";
import { ProfileMenu } from "./profile-menu";
import { useEffect, useState } from "react";
import { cloud } from "@/lib/cloud/client";
import { subscribeToImports } from "@/lib/bi/repository";
import type { ImportRecord } from "@/lib/bi/model";
const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function EmployeeDashboard() {
 const [imports,setImports]=useState<ImportRecord[]|null>(null);const [selected,setSelected]=useState("");const [error,setError]=useState("");
 useEffect(()=>subscribeToImports(setImports,()=>setError("Não foi possível carregar suas vendas. Atualize para tentar novamente.")),[]);
 const record=imports?.find(item=>item.id===selected)||imports?.[0];
 return <div className="employee-workspace"><header className="employee-topbar"><div className="login-brand"><Image src="/icon-diana.jpg" width={36} height={36} alt=""/><span>Visão 308</span></div><ProfileMenu/></header><main className="employee-content"><div className="intro"><div><h1>Olá, <span>{cloud.session.name?.split(" ")[0]}.</span></h1><p>Acompanhe as vendas vinculadas à sua matrícula {cloud.session.username}.</p></div></div><section className="panel"><div className="goals-toolbar"><div><h2>Minhas vendas</h2><p>Somente os seus resultados nos períodos importados.</p></div>{!!imports?.length&&<label className="form-field"><span>Período importado</span><select className="form-control" value={record?.id||""} onChange={event=>setSelected(event.target.value)}>{imports.map(item=><option value={item.id} key={item.id}>{item.periodKind==="day"?"Dia":"Mês"} · {item.reference.split("-").reverse().join("/")}</option>)}</select></label>}</div>{error?<p role="alert">{error}</p>:imports===null?<p role="status">Carregando suas vendas…</p>:!record?<p>Nenhuma venda vinculada à sua matrícula nos arquivos importados.</p>:<><div className="employee-total"><span>Total do período selecionado</span><strong>{money(record.totalSale)}</strong></div><div className="table-scroll" role="region" aria-label="Minhas vendas importadas" tabIndex={0}><table className="bi-history-table"><thead><tr><th>Vendedor</th><th>Totais</th><th>Clientes</th><th>Ticket médio</th><th>Gen/Sim</th><th>MP</th></tr></thead><tbody>{record.records.map(row=><tr key={row.sourceRow}><td>{row.seller}</td><td>{money(row.sale)}</td><td>{row.clients??"—"}</td><td>{row.ticket===null?"—":money(row.ticket)}</td><td>{row.genSim===null?"—":money(row.genSim)}</td><td>{row.mp===null?"—":money(row.mp)}</td></tr>)}</tbody></table></div></>}</section><CampaignsPage employeeMode/></main></div>;
}
