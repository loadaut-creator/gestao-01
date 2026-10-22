"use client";
import {useEffect,useState} from "react";
import {visibleCampaigns} from "@/lib/campaigns/model";
import {loadCampaigns,subscribeToCampaigns} from "@/lib/campaigns/repository";
export function CampaignHomeSummary(){
 const [count,setCount]=useState(0);
 useEffect(()=>{const refresh=()=>{try{setCount(visibleCampaigns(loadCampaigns()).length);}catch{setCount(0);}};queueMicrotask(refresh);return subscribeToCampaigns(refresh);},[]);
 return <span>{count?`${count} ${count===1?"campanha vigente":"campanhas vigentes"}`:"Nenhuma campanha vigente"}</span>;
}
