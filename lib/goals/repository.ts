import { allocateMonthlyGoal, GOAL_SECTORS, validGoal, type AllocationMode, type MonthlyGoal, type GoalSector } from "./model";

import { cloud, isCloud, saveCloud } from "../cloud/client";

const KEY = "visao308:monthly-goals:v1";
const EVENT = "visao308:goals-changed";
export function loadGoals(): MonthlyGoal[] {
  if (isCloud()) return cloud.data.goals;
  const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (!Array.isArray(data) || !data.every((item) => item && validGoal(item))) throw new Error("Não foi possível ler as metas salvas.");
  return data;
}
export async function saveSectorGoals(month: string, sector: GoalSector, goals: MonthlyGoal[]) {
  if (goals.some((goal) => !validGoal(goal) || goal.month !== month || goal.sector !== sector) || new Set(goals.map((goal) => goal.metric)).size !== goals.length) throw new Error("Confira os valores das metas.");
  const next = [...loadGoals().filter((goal) => goal.month !== month || goal.sector !== sector), ...goals];
  if (isCloud()) await saveCloud("goals", next);
  else localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
  return next;
}
export function subscribeToGoals(onChange: () => void) {
  const listener = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(EVENT, onChange); };
}

export async function saveMonthlyAllocation(month: string, total: number, mode: AllocationMode, values: number[]) {
  const amounts = allocateMonthlyGoal(total, mode, values);
  const goals: MonthlyGoal[] = GOAL_SECTORS.map((sector, index) => ({ month, sector, metric: "sale", target: amounts[index] }));
  if (!goals.every(validGoal)) throw new Error("Informe um mês válido.");
  const next = [...loadGoals().filter((goal) => goal.month !== month || goal.metric !== "sale"), ...goals];
  if (isCloud()) await saveCloud("goals", next);
  else localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
  return next;
}
