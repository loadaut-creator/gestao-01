"use client";
import {useEffect,useMemo,useState} from "react";
import {Award,ChevronLeft,ChevronRight,Search} from "lucide-react";
import {campaignRanking,formatCampaignValue,normalizeSearch,type Campaign} from "@/lib/campaigns/model";
import {groupActiveRankings} from "@/lib/campaigns/rankings";
import {loadCampaigns,subscribeToCampaigns} from "@/lib/campaigns/repository";
import {isCloud,refreshCloud} from "@/lib/cloud/client";

function RankingPanel({campaign}:{campaign:Campaign}) {
 const [search,setSearch]=useState(""),[page,setPage]=useState(0);
 const ranking=useMemo(()=>campaignRanking(campaign),[campaign]);
 const filtered=useMemo(()=>ranking.filter(row=>normalizeSearch(row.seller).includes(normalizeSearch(search))),[ranking,search]);
 const pages=Math.max(1,Math.ceil(filtered.length/20)),current=Math.min(page,pages-1);
 const title=campaign.sector==="Todos"?"Todos os setores":campaign.sector;
 return <article className="rank-sector-panel" aria-label={`${campaign.name} — ${title}`}>
  <header className="rank-sector-heading"><div><h3>{title}</h3><p>{campaign.name}</p></div><span>{ranking.length.toLocaleString("pt-BR")} vendedores</span></header>
  <div className="rank-sector-meta"><span>{campaign.startsAt.split("-").reverse().join("/")} a {campaign.endsAt.split("-").reverse().join("/")}</span><span>{campaign.metric==="money"?"Valor vendido":"Quantidade"}</span></div>
  <label className="campaign-search rank-search"><Search size={17} aria-hidden="true"/><input aria-label={`Pesquisar vendedor em ${campaign.name} — ${title}`} placeholder="Pesquise pelo nome" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
  <div className="rank-table-scroll" role="region" aria-label={`Classificação de ${campaign.name} — ${title}`} tabIndex={0}>
   <table className="campaign-ranking-table rank-table"><thead><tr><th scope="col" aria-label="Posição">Pos.</th><th scope="col">Vendedor</th><th scope="col">{campaign.metric==="money"?"Vendas":"Qtd."}</th></tr></thead><tbody>{filtered.slice(current*20,current*20+20).map((row,index)=><tr key={`${current}-${index}`}><td><span className={`campaign-rank ${row.rank<=3?"top-rank":""}`}>{row.rank}º</span></td><th scope="row">{row.seller}</th><td>{formatCampaignValue(row.value,campaign.metric)}</td></tr>)}</tbody></table>
   {!filtered.length&&<p className="campaign-empty-inline">{ranking.length?"Nenhum vendedor encontrado.":"Aguardando a planilha desta campanha."}</p>}
  </div>
  <footer className="rank-pagination"><span aria-live="polite">{filtered.length.toLocaleString("pt-BR")} resultados · {current+1}/{pages}</span><div><button type="button" className="button button-neutral" aria-label={`Página anterior de ${campaign.name} — ${title}`} disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft size={17}/></button><button type="button" className="button button-neutral" aria-label={`Próxima página de ${campaign.name} — ${title}`} disabled={current>=pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={17}/></button></div></footer>
 </article>;
}

export function RankingsPage() {
 const [campaigns,setCampaigns]=useState<Campaign[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false),[filter,setFilter]=useState("");
 useEffect(()=>{
  let active=true,checking=false;
  const refresh=()=>{if(!active)return;try{setCampaigns(loadCampaigns());setError("");}catch{setError("Não foi possível carregar os rankings. Atualize a página para tentar novamente.");}finally{setLoaded(true);}};
  const sync=async()=>{if(!active||checking||document.hidden)return;checking=true;try{if(isCloud())await refreshCloud();refresh();}catch{if(active)setError("Não foi possível atualizar os rankings. Os últimos dados continuam exibidos.");}finally{checking=false;}};
  queueMicrotask(()=>{refresh();void sync();});const unsubscribe=subscribeToCampaigns(refresh);const timer=setInterval(()=>void sync(),60000);
  window.addEventListener("focus",sync);document.addEventListener("visibilitychange",sync);
  return()=>{active=false;unsubscribe();clearInterval(timer);window.removeEventListener("focus",sync);document.removeEventListener("visibilitychange",sync);};
 },[]);
 const groups=groupActiveRankings(campaigns),filtered=groups.filter(group=>!filter||group.key===filter);
 return <div className="rankings-page">
  {error&&<p className="team-notice error" role="alert">{error}</p>}
  {groups.length>1&&<div className="rankings-toolbar"><label className="form-field"><span>Linha da campanha</span><select className="form-control" value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Todas as linhas</option>{groups.map(group=><option key={group.key} value={group.key}>{group.name}</option>)}</select></label><span>{groups.reduce((sum,group)=>sum+group.campaigns.length,0)} campanhas vigentes</span></div>}
  {filtered.map(group=><section key={group.key} className="panel rank-line-panel" aria-label={`Rankings ${group.name}`}><header className="rank-line-heading"><div className="rank-line-title"><span className="rank-line-icon"><Award size={21}/></span><div><h2>{group.name}</h2><p>Rankings das campanhas ativas por setor</p></div></div><span className="rank-live"><span/>Vigente</span></header><div className="rank-sector-grid">{group.campaigns.map(campaign=><RankingPanel key={campaign.id} campaign={campaign}/>)}</div></section>)}
  {!loaded&&!error&&<p role="status">Carregando rankings…</p>}
  {loaded&&!error&&!filtered.length&&<section className="panel campaign-empty"><Award size={30}/><h2>Nenhum ranking ativo</h2><p>As campanhas publicadas aparecem aqui durante o período de vigência.</p></section>}
 </div>;
}
