import {cloud,isCloud,saveCloud} from "../cloud/client";
import {dailyGoalSchema,dailyGoalKey,type DailyGoal} from "./daily";
export const DAILY_GOALS_KEY="visao308:daily-goals:v1";
const EVENT="visao308:daily-goals-changed";
export function loadDailyGoals():DailyGoal[] {return dailyGoalSchema.array().parse(isCloud()?cloud.data.dailyGoals:JSON.parse(localStorage.getItem(DAILY_GOALS_KEY)||"[]"));}
export async function saveDailyGoal(goal:DailyGoal){
 const parsed=dailyGoalSchema.parse(goal),key=dailyGoalKey(parsed);
 const next=[...loadDailyGoals().filter(item=>dailyGoalKey(item)!==key),parsed];
 if(isCloud())await saveCloud("dailyGoals",next);else localStorage.setItem(DAILY_GOALS_KEY,JSON.stringify(next));
 window.dispatchEvent(new Event(EVENT));
}
export function subscribeToDailyGoals(callback:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===DAILY_GOALS_KEY||event.key===null)callback();};
 window.addEventListener(EVENT,callback);window.addEventListener("storage",storage);
 return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener("storage",storage);};
}
