"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import {ArrowDown,ArrowUp,ArrowUpRight,CalendarDays,Gift,Search,Trophy,X} from "lucide-react";
import {campaignRanking,campaignState,formatCampaignValue,normalizeSearch,type Campaign} from "@/lib/campaigns/model";

function RankingDialog({campaign,onClose}:{campaign:Campaign;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);const [search,setSearch]=useState("");const [page,setPage]=useState(0);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 const ranking=campaignRanking(campaign),filtered=ranking.filter(row=>normalizeSearch(row.seller).includes(normalizeSearch(search)));
 const pages=Math.max(1,Math.ceil(filtered.length/50)),current=Math.min(page,pages-1);
 return <dialog ref={dialog} className="campaign-dialog" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}} aria-labelledby="campaign-ranking-title">
  <div className="campaign-dialog-heading"><div><h2 id="campaign-ranking-title">{campaign.name}</h2><p>{ranking.length.toLocaleString("pt-BR")} vendedores · {campaign.metric==="money"?"Valor vendido":"Quantidade vendida"}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar ranking"><X size={20}/></button></div>
  {(campaign.rules||campaign.prize)&&<details className="campaign-rules"><summary>Regras e premiação</summary>{campaign.rules&&<p>{campaign.rules}</p>}{campaign.prize&&<p><strong>Premiação: </strong>{campaign.prize}</p>}</details>}
  <label className="campaign-search"><Search size={18} aria-hidden="true"/><input aria-label="Pesquisar vendedor no ranking" placeholder="Pesquise pelo nome" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
  <div className="campaign-ranking-scroll"><table className="campaign-ranking-table"><thead><tr><th aria-label="Posição">Pos.</th><th>Vendedor</th><th>{campaign.metric==="money"?"Vendas":"Quantidade"}</th></tr></thead><tbody>{filtered.slice(current*50,current*50+50).map((row,index)=><tr key={`${current}-${index}`}><td><span className={`campaign-rank ${row.rank<=3?"top-rank":""}`}>{row.rank}º</span></td><th scope="row">{row.seller}</th><td>{formatCampaignValue(row.value,campaign.metric)}</td></tr>)}</tbody></table>{!filtered.length&&<p className="campaign-empty-inline">{ranking.length?"Nenhum vendedor encontrado.":"O ranking aparecerá após a importação da planilha."}</p>}</div>
  <div className="campaign-pagination"><span>{filtered.length} resultados · Página {current+1} de {pages}</span><div><button type="button" className="button button-neutral" disabled={!current} onClick={()=>setPage(current-1)}>Anterior</button><button type="button" className="button button-neutral" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Próxima</button></div></div>
 </dialog>;
}

export function CampaignBoard({campaigns,onEdit,onMove,onDrop,busy=false}:{campaigns:Campaign[];onEdit?:(campaign:Campaign)=>void;onMove?:(id:string,direction:number)=>void;onDrop?:(id:string,targetId:string)=>void;busy?:boolean}) {
 const [selected,setSelected]=useState<string|null>(null);const active=campaigns.find(item=>item.id===selected);
 return <><div className="campaign-grid">{campaigns.map((campaign,index)=>{
  const ranking=campaignRanking(campaign),leader=ranking[0],status=campaignState(campaign);
  return <article className="panel campaign-card" key={campaign.id} draggable={!!onDrop&&!busy} onDragStart={event=>event.dataTransfer.setData("text/plain",campaign.id)} onDragOver={event=>{if(onDrop)event.preventDefault();}} onDrop={event=>{if(onDrop){event.preventDefault();onDrop(event.dataTransfer.getData("text/plain"),campaign.id);}}}>
   {campaign.imageData&&<button type="button" className="campaign-art" onClick={()=>setSelected(campaign.id)} aria-label={`Abrir ranking de ${campaign.name}`}><Image src={campaign.imageData} alt={`Arte da campanha ${campaign.name}`} width={600} height={360} unoptimized/></button>}
   <div className="campaign-card-top"><span className={`campaign-status status-${status}`}><span/>{status}</span><span className="campaign-sector">{campaign.sector==="Todos"?"Todos os setores":campaign.sector}</span></div>
   <button type="button" className="campaign-card-open" onClick={()=>setSelected(campaign.id)}><span><span className="campaign-card-name">{campaign.name}</span><span className="campaign-period"><CalendarDays size={14} aria-hidden="true"/>{campaign.startsAt.split("-").reverse().join("/")} — {campaign.endsAt.split("-").reverse().join("/")}</span></span><span className="campaign-arrow"><ArrowUpRight size={19} aria-hidden="true"/></span><span className="sr-only">Abrir ranking de {campaign.name}</span></button>
   <div className="campaign-leader">{leader?<><Trophy size={18} aria-hidden="true"/><div><small>1º lugar{ranking.filter(item=>item.rank===1).length>1?" · empate":""}</small><strong title={leader.seller}>{leader.seller}</strong></div><b>{formatCampaignValue(leader.value,campaign.metric)}</b></>:<><Gift size={20}/><span>Aguardando planilha do ranking</span></>}</div>
   <div className="campaign-card-bottom"><span>{ranking.length.toLocaleString("pt-BR")} vendedores</span>{onEdit&&<button type="button" className="button button-neutral" onClick={()=>onEdit(campaign)} disabled={busy}>Editar</button>}{onMove&&<div className="campaign-order"><button type="button" className="icon-button" aria-label={`Subir ${campaign.name}`} disabled={busy||index===0} onClick={()=>onMove(campaign.id,-1)}><ArrowUp size={17}/></button><button type="button" className="icon-button" aria-label={`Descer ${campaign.name}`} disabled={busy||index===campaigns.length-1} onClick={()=>onMove(campaign.id,1)}><ArrowDown size={17}/></button></div>}</div>
   {campaign.ranking&&<small className="campaign-updated">Ranking atualizado em {new Date(campaign.ranking.importedAt).toLocaleString("pt-BR")}</small>}
  </article>;
 })}</div>{active&&<RankingDialog key={active.id} campaign={active} onClose={()=>setSelected(null)}/>}</>;
}
