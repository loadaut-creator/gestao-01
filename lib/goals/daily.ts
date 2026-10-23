import {z} from "zod";
import type {ImportRecord} from "../bi/model";
import type {MonthlyGoal} from "./model";
import type {Employee} from "../team/model";

export function calendarDays(month:string) {const [year,value]=month.split("-").map(Number);return new Date(Date.UTC(year,value,0)).getUTCDate();}
export function goalDays(goals:MonthlyGoal[],month:string) {return goals.find(goal=>goal.month===month&&goal.days!==undefined)?.days??calendarDays(month);}
export function withGoalDays(goals:MonthlyGoal[],month:string,days:number) {
 if(!Number.isInteger(days)||days<1||days>31)throw Error("Informe uma quantidade de dias entre 1 e 31.");
 return goals.map(goal=>goal.month===month?{...goal,days}:goal);
}
export function sectorDailyBase(goals:MonthlyGoal[],employees:Employee[],month:string,sector:string) {
 const goal=goals.find(goal=>goal.month===month&&goal.sector===sector&&goal.metric==="sale");
 const activeEmployees=employees.filter(employee=>employee.status==="ativo"&&employee.sector===sector).length;
 const days=goal?.days??goalDays(goals,month);
 const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
 return {month,sector,days,activeEmployees,sectorTarget:goal?.target??null,monthlyTarget:goal&&goal.target>0&&activeEmployees?round(goal.target/activeEmployees):null,target:goal&&goal.target>0&&activeEmployees?round(goal.target/days/activeEmployees):null};
}
export type DailyGoalBase=ReturnType<typeof sectorDailyBase>;
export function employeeDailyGoalBases(goals:MonthlyGoal[],employees:Employee[],employee:Employee) {
 return [...new Set(goals.map(goal=>goal.month))].map(month=>sectorDailyBase(goals,employees,month,employee.sector));
}

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
