import { z } from "zod";
import { validGoal } from "../goals/model";
import { campaignSchema } from "../campaigns/model";
import {dailyGoalSchema} from "../goals/daily";

const text = z.string().max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
export const employeeSchema = z.object({
  id: text.min(1), name: text.min(1), registration: text.min(1), role: z.enum(["Caixa","Balconista","Perfumista","Outro"]),
  jobTitle: text.optional(), sector: z.enum(["Caixa","Balcão","Perfumaria","Outro"]), status: z.enum(["ativo","inativo"]),
  hiredAt: date, biIdentifier: text, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const goalSchema = z.object({month:z.string(),sector:z.enum(["Balcão","Perfumaria","Caixa"]),metric:z.enum(["sale","clients","genSim","mp","ticket"]),target:z.number().finite(),days:z.number().int().min(1).max(31).optional()}).refine(validGoal,"Meta inválida.");
const optionalNumber = z.number().finite().nullable();
const rowSchema = z.object({sourceRow:z.number().int().min(2),seller:text.min(1),sale:z.number().finite(),saleWasBlank:z.boolean(),clients:z.number().int().nonnegative().nullable(),ticket:optionalNumber,genSim:optionalNumber,mp:optionalNumber,date:z.string().nullable(),sector:text.nullable(),clientPremium:optionalNumber,raw:z.record(z.string(),z.string().max(10000))});
const mapping = z.object({seller:text,sale:text,clients:text,ticket:text,genSim:text,mp:text,date:text,sector:text,clientPremium:text});
export const importSchema = z.object({id:text.min(1), importedAt:z.string().datetime(),fileName:text.min(1),fileType:z.enum(["csv","xlsx"]),sheetName:text.optional(),periodKind:z.enum(["day","month"]),reference:z.string(),rowCount:z.number().int().min(1).max(2000),totalSale:z.number().finite(),mapping,displayColumns:z.array(text).max(100),columns:z.array(text).max(100),records:z.array(rowSchema).min(1).max(2000)}).superRefine((value,ctx)=>{
  const referenceValid = value.periodKind === "month" ? /^\d{4}-(0[1-9]|1[0-2])$/.test(value.reference) : date.safeParse(value.reference).success;
  if(!referenceValid || value.rowCount !== value.records.length || Math.abs(value.totalSale-value.records.reduce((sum,row)=>sum+row.sale,0))>0.02 || new Set(value.records.map(row=>row.sourceRow)).size!==value.records.length) ctx.addIssue({code:"custom",message:"Período, linhas ou total da importação inválidos."});
});
export const userSchema = z.object({email:z.string().email().transform(s=>s.toLowerCase()),role:z.enum(["admin","manager","viewer"]),active:z.boolean()});
export const templateSchema = z.object({id:text.min(1),name:text.min(1),columns:z.array(text).max(100),mapping,savedAt:z.string().datetime()});
export const resources = ["employees","goals","templates","users","campaigns","dailyGoals"] as const;
export type Resource = typeof resources[number];
export function parseDocuments(resource:Resource, value:unknown) {
  const schema = {employees:employeeSchema,goals:goalSchema,templates:templateSchema,users:userSchema,campaigns:campaignSchema,dailyGoals:dailyGoalSchema}[resource];
  const data = z.array(schema).max(resource==="campaigns"?100:5000).parse(value);
  const key = (item:typeof data[number]) => "email" in item ? item.email : "id" in item ? item.id : "employeeId" in item ? `${item.date}:${item.employeeId}` : `${item.month}:${item.sector}:${item.metric}`;
  if(new Set(data.map(key)).size !== data.length) throw new Error("Há registros repetidos.");
  if(resource === "employees") {
    const people = z.array(employeeSchema).parse(data);
    for(const field of ["registration","biIdentifier"] as const) {
      const values=people.map(item=>item[field].trim().toLocaleLowerCase("pt-BR")).filter(Boolean);
      if(new Set(values).size !== values.length) throw new Error("Matrícula ou identificador BI repetido.");
    }
  }
  return data.map(item=>({id:key(item),data:item}));
}
