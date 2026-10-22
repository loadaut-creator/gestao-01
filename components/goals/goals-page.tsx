"use client";

import { useEffect, useMemo, useState } from "react";
import { Target, Check } from "lucide-react";
import { MonthlyAllocation } from "./monthly-allocation";
import { subscribeToImports } from "@/lib/bi/repository";
import type { ImportRecord } from "@/lib/bi/model";
import { loadEmployees, subscribeToEmployeeChanges } from "@/lib/team/repository";
import type { Employee } from "@/lib/team/model";
import { classifyRows, monthImports, type SalesEntry } from "@/lib/sales/dashboard";
import { GOAL_METRICS, GOAL_SECTORS, goalActual, goalProgress, type AllocationMode, type MonthlyGoal, type GoalMetric, type GoalSector } from "@/lib/goals/model";
import { loadGoals, saveSectorGoals, subscribeToGoals } from "@/lib/goals/repository";

const format = (value: number, metric: GoalMetric) => new Intl.NumberFormat("pt-BR", metric === "clients" ? { maximumFractionDigits: 0 } : { style: "currency", currency: "BRL" }).format(value);
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function SectorGoals({ month, sector, goals, entries }: { month: string; sector: GoalSector; goals: MonthlyGoal[]; entries: SalesEntry[] }) {
  const metrics = GOAL_METRICS.filter(({ key }) => (sector !== "Caixa" || ["sale", "mp", "ticket"].includes(key)) && (sector !== "Perfumaria" || key !== "genSim"));
  const [draft, setDraft] = useState<Partial<Record<GoalMetric, string>>>(() => Object.fromEntries(goals.map((goal) => [goal.metric, String(goal.target)])));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(!goals.some((goal) => metrics.some((metric) => metric.key === goal.metric)));
  const savedSale = goals.find((goal) => goal.metric === "sale")?.target;
  useEffect(() => {
    let active = true;
    if (savedSale !== undefined) queueMicrotask(() => { if (active) setDraft((current) => ({ ...current, sale: String(savedSale) })); });
    return () => { active = false; };
  }, [savedSale]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const next = metrics.filter(({ key }) => draft[key] !== undefined).map(({ key }) => ({ month, sector, metric: key, target: Number(draft[key]) }));
      await saveSectorGoals(month, sector, next);
      setEditing(next.length === 0); setMessage("Metas salvas.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
  };
  return <section className="panel goal-sector-card">
    <div className="goal-sector-heading"><div><span className="goal-sector-icon"><Target size={20}/></span><h2>{sector}</h2></div>{goals.length > 0 && <button type="button" className="button button-neutral" onClick={() => { setDraft(Object.fromEntries(goals.map((goal) => [goal.metric, String(goal.target)]))); setEditing(!editing); setError(""); setMessage(""); }}>{editing ? "Cancelar" : "Editar metas"}</button>}</div>
    {editing ? <form onSubmit={save}><p className="form-help">Selecione os indicadores e informe a meta mensal.</p><div className="goal-fields">{metrics.map(({ key, label, unit }) => <div className={`goal-field ${draft[key] !== undefined ? "selected" : ""}`} key={key}><label className="goal-checkbox"><input type="checkbox" checked={draft[key] !== undefined} onChange={(event) => setDraft((current) => { const next = { ...current }; if (event.target.checked) next[key] = ""; else delete next[key]; return next; })}/><span>{label}</span></label>{draft[key] !== undefined && <label className="goal-value"><span>{unit === "money" ? "R$" : "Quantidade"}</span><input className="form-control" aria-label={`Meta de ${label} — ${sector}`} type="number" min={key === "sale" ? "0" : key === "clients" ? "1" : "0.01"} step={key === "clients" ? "1" : "0.01"} required value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}/></label>}</div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="goal-save"><button className="button button-primary" type="submit">Salvar metas</button></div></form> : <div className="goal-results">{goals.filter((goal) => metrics.some((metric) => metric.key === goal.metric)).map((goal) => {
      const actual = goalActual(entries, goal.metric);
      const { attainment, remaining } = goalProgress(actual, goal.target);
      return <article className="goal-result" key={goal.metric}><div className="goal-result-heading"><h3>{metrics.find((metric) => metric.key === goal.metric)?.label}</h3><strong>{goal.target === 0 ? "Sem meta definida" : attainment === null ? "Sem dados" : pct(attainment)}</strong></div><div className="goal-numbers"><div><span>Realizado</span><strong>{actual === null ? "—" : format(actual, goal.metric)}</strong></div><div><span>Meta</span><strong>{format(goal.target, goal.metric)}</strong></div></div><progress aria-label={`Atingimento de ${goal.metric} — ${sector}`} value={Math.max(0, Math.min(100, attainment ?? 0))} max={100}/><p>{goal.target === 0 ? "Defina um valor de meta para acompanhar o atingimento." : remaining === null ? "Aguardando dados completos da importação." : remaining === 0 ? <><Check size={14}/> Meta atingida</> : `Faltam ${format(remaining, goal.metric)}`}</p></article>;
    })}</div>}
    {message && <p className="goal-success" role="status">{message}</p>}
  </section>;
}

export function GoalsPage() {
  const [month, setMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; });
  const [goals, setGoals] = useState<MonthlyGoal[] | null>(null);
  const [allocationSaved, setAllocationSaved] = useState("");
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("amount");
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) try { setGoals(loadGoals()); setEmployees(loadEmployees()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados."); } };
    queueMicrotask(refresh);
    const stopImports = subscribeToImports(setImports, () => setError("Não foi possível carregar as vendas."));
    const stopGoals = subscribeToGoals(refresh);
    const stopEmployees = subscribeToEmployeeChanges(setEmployees);
    return () => { active = false; stopGoals(); stopEmployees(); stopImports(); };
  }, []);
  const entries = useMemo(() => classifyRows(monthImports(imports, month), employees), [imports, month, employees]);
  if (error) return <section className="panel" role="alert">{error}</section>;
  if (!goals) return <section className="panel">Carregando metas…</section>;
  return <div className="goals-page"><section className="panel goals-toolbar"><div><h2>Metas por setor</h2><p>Defina o mês e os indicadores acompanhados em cada setor.</p></div><label className="form-field"><span>Mês de referência</span><input type="month" className="form-control" required value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }}/></label></section><MonthlyAllocation key={month + JSON.stringify(goals.filter((goal) => goal.month === month && goal.metric === "sale"))} month={month} goals={goals} mode={allocationMode} onModeChange={setAllocationMode} onSaved={() => setAllocationSaved(month)} onEdit={() => setAllocationSaved("")}/>{allocationSaved === month && <p className="goal-success" role="status">Distribuição salva. Metas de vendas dos setores atualizadas.</p>}<div className="goals-grid">{GOAL_SECTORS.map((sector) => <SectorGoals key={`${month}-${sector}`} month={month} sector={sector} goals={goals.filter((goal) => goal.month === month && goal.sector === sector)} entries={entries.filter((entry) => entry.sector === sector)}/>)}</div><p className="data-note">Resultados usam os funcionários ativos vinculados na Equipe e a importação mensal, ou a soma dos dias disponíveis. Ticket médio = vendas ÷ clientes. Valores ausentes na importação aparecem como sem dados.</p></div>;
}
