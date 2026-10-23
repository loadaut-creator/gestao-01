import {z} from "zod";
import type {ImportRecord} from "../bi/model";

export const dailyGoalSchema=z.object({
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value),
 employeeId:z.string().min(1).max(500),
 target:z.number().finite().positive().max(1000000000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001,"Use até duas casas decimais."),
 updatedAt:z.string().datetime(),
});
export type DailyGoal=z.infer<typeof dailyGoalSchema>;
export const dailyGoalKey=(goal:Pick<DailyGoal,"date"|"employeeId">)=>`${goal.date}:${goal.employeeId}`;
// Employee imports are already scoped by the server. Use the latest import for the exact day.
export function dailyActual(imports:ImportRecord[],date:string) {
 const record=imports.filter(item=>item.periodKind==="day"&&item.reference===date).sort((a,b)=>b.importedAt.localeCompare(a.importedAt))[0];
 return record?record.records.reduce((sum,row)=>sum+row.sale,0):null;
}
