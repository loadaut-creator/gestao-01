import { z } from "zod";
import { parseLocaleNumber, normalizeIdentifier } from "../bi/model";
import type { ParsedTable } from "../bi/parser";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
export const CAMPAIGN_SECTORS = ["Todos", "Balcão", "Perfumaria", "Caixa"] as const;
export const campaignSchema = z.object({
  id:z.string().min(1).max(100), name:z.string().trim().min(1).max(100),
  sector:z.enum(CAMPAIGN_SECTORS), metric:z.enum(["money","quantity"]),
  startsAt:date, endsAt:date, status:z.enum(["draft","published","closed"]),
  powerBiUrl:z.string().max(2000).refine(value=>!value || /^https:\/\/(app\.powerbi\.com|app\.fabric\.microsoft\.com)\//i.test(value),"Use um link HTTPS do Power BI."),
  rules:z.string().max(3000), prize:z.string().max(1000),
  imageData:z.string().max(550000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
  order:z.number().int().nonnegative(), createdAt:z.string().datetime(), updatedAt:z.string().datetime(),
  ranking:z.object({fileName:z.string().max(250),importedAt:z.string().datetime(),rows:z.array(z.object({seller:z.string().trim().min(1).max(500),value:z.number().finite().nonnegative()})).min(1).max(20000)}).nullable(),
}).superRefine((campaign,ctx)=>{
  if(campaign.endsAt<campaign.startsAt)ctx.addIssue({code:"custom",message:"O término deve ser igual ou posterior ao início."});
});
export type Campaign=z.infer<typeof campaignSchema>;
export type CampaignRow=NonNullable<Campaign["ranking"]>["rows"][number];
export function normalizeSearch(value:string) { return normalizeIdentifier(value); }
export function localDate() { return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
export function campaignState(campaign:Campaign,today=localDate()) {
  if(campaign.status==="draft")return "Rascunho";
  if(campaign.status==="closed"||campaign.endsAt<today)return "Encerrada";
  return campaign.startsAt>today?"Agendada":"Vigente";
}
export function visibleCampaigns(campaigns:Campaign[],today=localDate()) { return campaigns.filter(item=>campaignState(item,today)==="Vigente").map(item=>({...item,powerBiUrl:""})); }
export function campaignRanking(campaign:Campaign) {
  let rank=0,previous:number|undefined;
  return [...(campaign.ranking?.rows||[])].sort((a,b)=>b.value-a.value||a.seller.localeCompare(b.seller,"pt-BR")).map((row,index)=>{
    if(previous!==row.value)rank=index+1;previous=row.value;return {...row,rank};
  });
}
export function formatCampaignValue(value:number,metric:Campaign["metric"]) { return value.toLocaleString("pt-BR",metric==="money"?{style:"currency",currency:"BRL"}:{maximumFractionDigits:2}); }
export type RankingMapping={seller:string;value:string;group?:string};
export function suggestRankingMapping(columns:string[],metric:Campaign["metric"]):RankingMapping {
  const find=(names:string[])=>columns.find(column=>names.includes(normalizeIdentifier(column)))||"";
  return {seller:find(["vendedor","nome","funcionario","colaborador"]),value:find(metric==="money"?["vlr geral","valor vendido","venda","totais","valor"]:["venda un","quantidade","qtd","unidades"]),group:find(["cargo | vendedor | filial","cargo","setor"])};
}
export function inspectCampaignRanking(table:ParsedTable,mapping:RankingMapping,sector:Campaign["sector"]="Todos") {
  const sellerIndex=table.columns.indexOf(mapping.seller),valueIndex=table.columns.indexOf(mapping.value);
  if(sellerIndex<0||valueIndex<0||sellerIndex===valueIndex)return {rows:[] as CampaignRow[],errors:["Selecione colunas diferentes para vendedor e valor."],ignored:0};
  const rows:CampaignRow[]=[],errors:string[]=[];let ignored=0;
  const groupIndex=table.columns.indexOf(mapping.group||"");let currentGroup="";
  for(const [index,cells] of table.rows.entries()) {
    if(groupIndex>=0&&cells[groupIndex]?.trim())currentGroup=normalizeIdentifier(cells[groupIndex]);
    const groupSector=/balc|medicamento/.test(currentGroup)?"Balcão":/perfum/.test(currentGroup)?"Perfumaria":/caixa/.test(currentGroup)?"Caixa":"Outro";
    const seller=(cells[sellerIndex]||"").trim(),key=normalizeIdentifier(seller);
    if(!seller||["total","total geral","totais","(em branco)"].includes(key)){ignored++;continue;}
    if(groupIndex>=0&&sector!=="Todos"&&groupSector!==sector){ignored++;continue;}
    const value=parseLocaleNumber(cells[valueIndex]||"");
    if(value===null||value<0){ignored++;continue;}
    if(!Number.isFinite(value)){errors.push(`Linha ${index+2}: valor inválido.`);continue;}
    rows.push({seller,value});
  }
  if(!rows.length)errors.push("Nenhum vendedor com valor válido foi encontrado.");
  return {rows,errors,ignored};
}
