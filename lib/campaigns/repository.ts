import { cloud,isCloud,saveCloud } from "../cloud/client";
import {campaignSchema,type Campaign} from "./model";
export const CAMPAIGNS_KEY="visao308:campaigns:v1";
const EVENT="visao308:campaigns-changed";
export function loadCampaigns():Campaign[] {
 const data=isCloud()?cloud.data.campaigns:JSON.parse(localStorage.getItem(CAMPAIGNS_KEY)||"[]");
 return campaignSchema.array().parse(data).sort((a,b)=>a.order-b.order||a.createdAt.localeCompare(b.createdAt));
}
export async function saveCampaigns(campaigns:Campaign[]) {
 const next=campaignSchema.array().max(100).parse(campaigns);
 if(isCloud())await saveCloud("campaigns",next);else localStorage.setItem(CAMPAIGNS_KEY,JSON.stringify(next));
 window.dispatchEvent(new Event(EVENT));
}
export async function saveCampaign(campaign:Campaign) {await saveCampaigns([...loadCampaigns().filter(item=>item.id!==campaign.id),campaign]);}
export function subscribeToCampaigns(callback:()=>void) {
 const storage=(event:StorageEvent)=>{if(event.key===CAMPAIGNS_KEY||event.key===null)callback();};
 window.addEventListener(EVENT,callback);window.addEventListener("storage",storage);
 return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener("storage",storage);};
}
