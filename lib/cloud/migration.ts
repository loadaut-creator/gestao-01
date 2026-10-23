import { z } from "zod";
import { employeeSchema, goalSchema, importSchema, templateSchema } from "./validation";
import {campaignSchema} from "../campaigns/model";
import {dailyGoalSchema,dailyGoalKey} from "../goals/daily";
export const backupSchema=z.object({schemaVersion:z.literal(1),exportedAt:z.string().optional(),employees:z.array(employeeSchema),goals:z.array(goalSchema),templates:z.array(templateSchema),imports:z.array(importSchema),campaigns:z.array(campaignSchema).max(100).default([]),dailyGoals:z.array(dailyGoalSchema).max(5000).default([])});
export type Backup=z.infer<typeof backupSchema>;
export function mergeMigration(local:Backup,remote:Backup) {
  const conflicts:string[]=[];
  function merge<T>(incoming:T[],existing:T[],key:(row:T)=>string,resource:string) {
    const result=[...existing];const byKey=new Map(existing.map(row=>[key(row),row]));
    for(const row of incoming) {
      const id=key(row); const current=byKey.get(id);
      if(current && JSON.stringify(current)!==JSON.stringify(row)) conflicts.push(`${resource}: ${id}`);
      else if(!current){result.push(row);byKey.set(id,row);}
    }
    return result;
  }
  const employees=merge(local.employees,remote.employees,row=>row.registration.trim().toLowerCase(),"Funcionário");
  const goals=merge(local.goals,remote.goals,row=>`${row.month}/${row.sector}/${row.metric}`,"Meta");
  const templates=merge(local.templates,remote.templates,row=>row.id,"Modelo");
  const imports=merge(local.imports,remote.imports,row=>row.id,"Importação");
  const campaigns=merge(local.campaigns||[],remote.campaigns||[],row=>row.id,"Campanha");
  const dailyGoals=merge(local.dailyGoals||[],remote.dailyGoals||[],dailyGoalKey,"Meta diária");
  return {employees,goals,templates,imports,campaigns,dailyGoals,conflicts};
}
