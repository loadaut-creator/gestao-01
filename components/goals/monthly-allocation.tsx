"use client";

import { useState } from "react";
import { allocateMonthlyGoal, allocationPercentages, GOAL_SECTORS, type AllocationMode, type MonthlyGoal } from "@/lib/goals/model";
import { saveMonthlyAllocation } from "@/lib/goals/repository";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function MonthlyAllocation({ month, goals, onSaved, onEdit, mode, onModeChange }: { month: string; goals: MonthlyGoal[]; onSaved: () => void; onEdit: () => void; mode: AllocationMode; onModeChange: (mode: AllocationMode) => void }) {
  const saved = GOAL_SECTORS.map((sector) => goals.find((goal) => goal.month === month && goal.sector === sector && goal.metric === "sale")?.target ?? 0);
  const savedTotal = saved.reduce((sum, value) => sum + value, 0);
  const [total, setTotal] = useState(savedTotal ? savedTotal.toFixed(2) : "");
  const [values, setValues] = useState(() => {
    if (!savedTotal) return ["", "", ""];
    if (mode === "amount") return saved.map((value) => value.toFixed(2));
    return allocationPercentages(saved).map((value) => value.toFixed(2));
  });
  const [error, setError] = useState("");
  const numeric = values.map(Number);
  const sum = numeric.reduce((acc, value) => acc + value, 0);
  let allocation: number[] | null = null;
  if (total && values.every((value) => value !== "")) try { allocation = allocateMonthlyGoal(Number(total), mode, numeric); } catch { /* Incomplete drafts remain editable. */ }
  const changeMode = (next: AllocationMode) => {
    if (next === mode) return;
    if (Number(total) > 0) {
      const converted = numeric.map((value) => next === "percent" ? value / Number(total) * 100 : value * Number(total) / 100);
      setValues((allocation ? next === "amount" ? allocation : allocationPercentages(allocation) : converted).map((value) => value.toFixed(2)));
    }
    else setValues(["", "", ""]);
    onModeChange(next); setError(""); onEdit();
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try { await saveMonthlyAllocation(month, Number(total), mode, numeric); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a distribuição."); }
  };
  const balance = mode === "percent" ? 100 - sum : Number(total) - sum;
  return <section className="panel monthly-allocation"><div className="sales-card-heading"><h2>Meta geral do mês</h2><p>Distribua a meta de vendas entre os setores. Você pode ajustar a divisão a qualquer momento.</p></div><form onSubmit={save}>
    <div className="allocation-controls"><label className="form-field"><span>Meta mensal (R$)</span><input type="number" min="0.01" step="0.01" required className="form-control" value={total} onChange={(event) => { setTotal(event.target.value); setError(""); onEdit(); }}/></label><fieldset className="allocation-mode"><legend>Distribuir por</legend>{(["amount", "percent"] as const).map((item) => <label key={item}><input type="radio" name="allocation-mode" checked={mode === item} onChange={() => changeMode(item)}/>{item === "amount" ? "Valor (R$)" : "Porcentagem (%)"}</label>)}</fieldset></div>
    <div className="allocation-sectors">{GOAL_SECTORS.map((sector, index) => <label className="allocation-sector" key={sector}><span>{sector}</span><div className="goal-value"><span>{mode === "percent" ? "%" : "R$"}</span><input className="form-control" aria-label={`Distribuição de ${sector}`} type="number" min="0" max={mode === "percent" ? "100" : undefined} step="0.01" required value={values[index]} onChange={(event) => { setValues((current) => current.map((value, position) => position === index ? event.target.value : value)); setError(""); onEdit(); }}/></div><small>{mode === "percent" ? money(allocation?.[index] ?? Number(total) * numeric[index] / 100) : `${(Number(total) > 0 ? numeric[index] / Number(total) * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da meta`}</small></label>)}</div>
    <div className={`allocation-footer ${allocation ? "is-complete" : ""}`}><p role="status">{!total || Number(total) <= 0 ? "Informe a meta mensal para distribuir." : values.some((value) => value === "") ? "Preencha a divisão dos três setores." : allocation ? "Distribuição completa" : `${balance < -0.001 ? "Excedente" : "Falta distribuir"}: ${mode === "percent" ? `${Math.abs(balance).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : money(Math.abs(balance))}`}</p><button type="submit" className="button button-primary">Aplicar distribuição</button></div>{error && <p className="form-error" role="alert">{error}</p>}
    <p className="form-help">Ao aplicar, as metas de Totais dos três setores serão atualizadas.</p>
  </form></section>;
}
