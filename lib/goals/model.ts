import type { SalesEntry } from "@/lib/sales/dashboard";

export const GOAL_SECTORS = ["Balcão", "Perfumaria", "Caixa"] as const;
export const GOAL_METRICS = [
  { key: "sale", label: "Totais", unit: "money" },
  { key: "clients", label: "Clientes", unit: "number" },
  { key: "genSim", label: "Gen/Sim", unit: "money" },
  { key: "mp", label: "MP", unit: "money" },
  { key: "ticket", label: "Ticket médio", unit: "money" },
] as const;
export type GoalMetric = typeof GOAL_METRICS[number]["key"];
export type GoalSector = typeof GOAL_SECTORS[number];
export type MonthlyGoal = { month: string; sector: GoalSector; metric: GoalMetric; target: number };

export function validGoal(goal: MonthlyGoal) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(goal.month) && GOAL_SECTORS.includes(goal.sector) &&
    GOAL_METRICS.some((item) => item.key === goal.metric) && Number.isFinite(goal.target) && (goal.metric === "sale" ? goal.target >= 0 : goal.target > 0) &&
    (goal.metric !== "clients" || Number.isInteger(goal.target));
}

export function goalActual(entries: SalesEntry[], metric: GoalMetric): number | null {
  if (!entries.length) return null;
  if (metric === "ticket") {
    if (entries.some((entry) => entry.row.clients === null)) return null;
    const clients = entries.reduce((sum, entry) => sum + (entry.row.clients ?? 0), 0);
    return clients > 0 ? entries.reduce((sum, entry) => sum + entry.sale, 0) / clients : null;
  }
  if (metric !== "sale" && entries.some((entry) => entry.row[metric] === null)) return null;
  return entries.reduce((sum, entry) => sum + (metric === "sale" ? entry.sale : entry.row[metric] ?? 0), 0);
}

export function goalProgress(actual: number | null, target: number) {
  return { attainment: actual === null || target <= 0 ? null : actual / target * 100, remaining: actual === null ? null : Math.max(0, target - actual) };
}

export type AllocationMode = "percent" | "amount";
export function allocationPercentages(amounts: number[]) {
  const sum = amounts.reduce((total, value) => total + value, 0);
  if (sum <= 0) return amounts.map(() => 0);
  const raw = amounts.map((value) => value / sum * 10000);
  const parts = raw.map(Math.floor);
  const order = raw.map((value, index) => ({ index, remainder: value - parts[index] })).sort((a, b) => b.remainder - a.remainder);
  const remaining = 10000 - parts.reduce((total, value) => total + value, 0);
  for (let index = 0; index < remaining; index++) parts[order[index].index]++;
  return parts.map((value) => value / 100);
}
// Work in integer cents; distribute rounding leftovers by largest remainder.
export function allocateMonthlyGoal(total: number, mode: AllocationMode, values: number[]): number[] {
  const cents = Math.round(total * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || values.length !== GOAL_SECTORS.length || values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Informe a meta mensal e valores válidos para os três setores.");
  if (mode === "amount") {
    const parts = values.map((value) => Math.round(value * 100));
    if (parts.reduce((sum, value) => sum + value, 0) !== cents) throw new Error("A soma dos setores deve ser igual à meta do mês.");
    return parts.map((value) => value / 100);
  }
  const weights = values.map((value) => Math.round(value * 100));
  if (weights.reduce((sum, value) => sum + value, 0) !== 10000) throw new Error("A distribuição deve somar 100%.");
  const raw = weights.map((weight) => cents * weight / 10000);
  const parts = raw.map(Math.floor);
  const order = raw.map((value, index) => ({ index, remainder: value - parts[index] })).sort((a, b) => b.remainder - a.remainder);
  const leftover = cents - parts.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < leftover; index++) parts[order[index].index]++;
  return parts.map((value) => value / 100);
}
