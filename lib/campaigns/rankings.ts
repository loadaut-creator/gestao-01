import {normalizeSearch,visibleCampaigns,type Campaign} from "./model";

export function campaignLine(campaign:Campaign) {
  if(campaign.line?.trim())return campaign.line.trim();
  // Remove only an isolated sector suffix; names such as EMS & Culturelle stay intact.
  const name=campaign.name.trim().replace(/\s*(?:[-–—|:]\s*|\s+)(?:balc[aã]o|balconistas?|perfumaria|perfumistas?|caixa)(?:\s*)$/i,"").replace(/^campanha\s+/i,"").trim();
  return name||campaign.name.trim();
}
export function groupActiveRankings(campaigns:Campaign[],today?:string) {
  const groups=new Map<string,{key:string;name:string;campaigns:Campaign[]}>();
  const sectors=["Balcão","Perfumaria","Caixa","Todos"];
  for(const campaign of visibleCampaigns(campaigns,today).sort((a,b)=>a.order-b.order||a.createdAt.localeCompare(b.createdAt))) {
    const name=campaignLine(campaign),key=normalizeSearch(name);
    if(!groups.has(key))groups.set(key,{key,name,campaigns:[]});
    groups.get(key)!.campaigns.push(campaign);
  }
  return [...groups.values()].map(group=>({...group,campaigns:group.campaigns.sort((a,b)=>sectors.indexOf(a.sector)-sectors.indexOf(b.sector)||a.order-b.order)}));
}
