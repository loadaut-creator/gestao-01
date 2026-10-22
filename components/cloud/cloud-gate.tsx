"use client";
import Link from "next/link";
import { SiteLogin } from "./site-login";
import { useEffect, useState } from "react";
import { api, bootstrapCloud, cloud, isCloud } from "@/lib/cloud/client";
export function CloudGate({children}:{children:React.ReactNode}) {
  const [loginRequired,setLoginRequired]=useState(false);
  const [ready,setReady]=useState(false);const [error,setError]=useState("");const [updated,setUpdated]=useState(false);
  useEffect(()=>{
    let active=true,checking=false;
    bootstrapCloud().then(()=>{if(active){setLoginRequired(cloud.session.authenticated===false);setReady(true);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Serviço indisponível.");});
    const check=async()=>{if(!active||!isCloud()||cloud.session.authenticated===false||document.hidden||checking)return;checking=true;try{
      const state=await api<{versions:Record<string,number>}>("state");
      if(active&&Object.keys(state.versions).some(key=>state.versions[key]>(cloud.versions[key]||0)))setUpdated(true);
      window.dispatchEvent(new Event("visao308:imports-changed"));
    }catch(cause){if(active){if((cause as {status?:number}).status===401)setLoginRequired(true);else setError(cause instanceof Error?cause.message:"Conexão indisponível. Tente novamente.");}}finally{checking=false;}};
    const timer=setInterval(check,30000);window.addEventListener("focus",check);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",check);};
  },[]);
  if(loginRequired)return <SiteLogin/>;
  if(error)return <main className="cloud-state panel" role="alert"><h1>Acesso ao sistema</h1><p>{error}</p><div className="cloud-actions"><button className="button button-primary" onClick={()=>location.reload()}>Tentar novamente</button><button className="button button-neutral" onClick={()=>location.assign(new URL("/cdn-cgi/access/login/",location.origin).href)}>Entrar com e-mail</button></div></main>;
  if(!ready)return <main className="cloud-state panel" role="status">Conectando ao ambiente de dados…</main>;
  return <>{(!isCloud()||updated)&&<div className="cloud-banner" role="status">{!isCloud()&&<>Dados locais neste navegador <Link href="/configuracoes/">Exportar backup e configurar nuvem</Link></>}{updated&&<span>Há atualizações de outro aparelho. <button type="button" onClick={()=>location.reload()}>Atualizar dados</button> — copie alterações em edição antes de atualizar.</span>}</div>}{children}</>;
}
