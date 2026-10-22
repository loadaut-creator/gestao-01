"use client";

import Link from "next/link";
import { GOAL_SECTORS, goalProgress, type MonthlyGoal } from "@/lib/goals/model";
import { loadGoals, subscribeToGoals } from "@/lib/goals/repository";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { subscribeToImports } from "@/lib/bi/repository";
import type { ImportRecord } from "@/lib/bi/model";
import { loadEmployees, subscribeToEmployeeChanges } from "@/lib/team/repository";
import type { Employee } from "@/lib/team/model";
import { SALES_SECTORS, applySalesFilter, rankEmployees, validSalesEntries, latestDailyImports, monthImports, monthKeys, monthProjection, sumSales, type SalesFilter } from "@/lib/sales/dashboard";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compact = (value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
const monthLabel = (month: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const dayLabel = (day: string) => day.slice(8, 10);
const todayLocal = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <article className="sales-metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="panel sales-chart-card"><div className="sales-card-heading"><h2>{title}</h2>{note && <p>{note}</p>}</div>{children}</section>;
}

export function SalesDashboard() {
  const [imports, setImports] = useState<ImportRecord[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const [requestedFilter, setFilter] = useState<SalesFilter>({ sector: "Todos", employeeId: "" });

  useEffect(() => {
    let active = true;
    const stopImports = subscribeToImports(setImports, () => setError("Não foi possível ler as importações."));
    queueMicrotask(() => { if (active) try { setEmployees(loadEmployees()); } catch { setError("Não foi possível ler a equipe."); } });
    const unsubscribe = subscribeToEmployeeChanges(setEmployees);
    const refreshGoals = () => { if (active) try { setGoals(loadGoals()); } catch { setError("Não foi possível ler as metas."); } };
    queueMicrotask(refreshGoals);
    const stopGoals = subscribeToGoals(refreshGoals);
    return () => { active = false; unsubscribe(); stopGoals(); stopImports(); };
  }, []);

  const months = useMemo(() => monthKeys(imports ?? []), [imports]);
  const selectedMonth = month && months.includes(month) ? month : months[0] ?? "";
  const today = todayLocal();
  const daily = useMemo(() => latestDailyImports(imports ?? [], selectedMonth), [imports, selectedMonth]);
  const monthRecords = useMemo(() => monthImports(imports ?? [], selectedMonth), [imports, selectedMonth]);
  const monthSnapshot = monthRecords.some((item) => item.periodKind === "month");
  const monthEntries = useMemo(() => validSalesEntries(monthRecords, employees), [monthRecords, employees]);
  const filter = useMemo(() => requestedFilter.employeeId && !monthEntries.some((entry) => entry.employeeId === requestedFilter.employeeId && (requestedFilter.sector === "Todos" || entry.sector === requestedFilter.sector)) ? { ...requestedFilter, employeeId: "" } : requestedFilter, [requestedFilter, monthEntries]);
  const entries = useMemo(() => applySalesFilter(monthEntries, filter), [monthEntries, filter]);
  const total = sumSales(entries);
  const targetSectors = GOAL_SECTORS.filter((sector) => filter.sector === "Todos" || filter.sector === sector);
  const saleGoals = goals.filter((goal) => goal.month === selectedMonth && goal.metric === "sale" && targetSectors.includes(goal.sector));
  const hasTarget = !filter.employeeId && targetSectors.length > 0 && targetSectors.every((sector) => saleGoals.some((goal) => goal.sector === sector));
  const target = hasTarget ? saleGoals.reduce((sum, goal) => sum + goal.target, 0) : null;
  const targetEntries = entries.filter((entry) => targetSectors.some((sector) => sector === entry.sector));
  const progress = goalProgress(targetEntries.length ? sumSales(targetEntries) : null, target ?? 1);
  const targetNote = filter.employeeId ? "Meta cadastrada por setor" : target === null ? "Cadastre a meta de Totais em Metas" : filter.sector === "Todos" ? "Balcão, Perfumaria e Caixa" : filter.sector;
  const todayImport = daily.find((item) => item.reference === today);
  const todaySale = todayImport ? sumSales(applySalesFilter(validSalesEntries([todayImport], employees), filter)) : null;
  const elapsedDays = Number(today.slice(8, 10));
  const latestDailyDate = daily.at(-1)?.reference ?? "";
  const hasProjectionCoverage = selectedMonth === today.slice(0, 7) && daily.length >= Math.max(5, Math.ceil(elapsedDays * 0.7)) &&
    latestDailyDate >= `${selectedMonth}-${String(Math.max(1, elapsedDays - 2)).padStart(2, "0")}`;
  const projection = hasProjectionCoverage ? monthProjection(total, selectedMonth, today) : null;

  const employeeChoices = useMemo(() => {
    const ids = new Set(monthEntries.filter((entry) => filter.sector === "Todos" || entry.sector === filter.sector).map((entry) => entry.employeeId));
    return employees.filter((employee) => ids.has(employee.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [employees, filter.sector, monthEntries]);

  const dailyData = daily.map((record) => ({ day: dayLabel(record.reference), date: record.reference, value: sumSales(applySalesFilter(validSalesEntries([record], employees), filter)) }));
  const sectors = SALES_SECTORS.map((sector) => ({ name: sector, value: sumSales(entries.filter((entry) => entry.sector === sector)) }));
  const ranking = rankEmployees(entries);
  const compareMonths = months.length > 1 || dailyData.length === 0;
  const comparison = compareMonths
    ? months.slice(0, 6).reverse().map((key) => ({ name: `${monthLabel(key).slice(0, 3)}/${key.slice(2, 4)}`, value: sumSales(applySalesFilter(validSalesEntries(monthImports(imports ?? [], key), employees), filter)) }))
    : dailyData.map((item) => ({ name: `${item.date.slice(8, 10)}/${item.date.slice(5, 7)}`, value: item.value }));

  if (error) return <section className="panel sales-state" role="alert">{error}</section>;
  if (!imports) return <section className="panel sales-state">Carregando vendas…</section>;
  if (!months.length) return <section className="panel sales-state"><h2>Sem vendas importadas</h2><p>Importe vendas diárias ou de um período para montar o painel.</p><Link href="/importacao-bi" className="button button-primary">Ir para importação</Link></section>;

  return <div className="sales-dashboard">
    <section className="panel sales-filter-panel" aria-label="Filtros de vendas">
      <div className="sales-filter-title"><strong>Painel de vendas</strong><span>{monthSnapshot ? "Total mensal: importação do período" : "Total mensal: soma dos dias importados"}</span></div>
      <div className="sales-filters">
        <label className="form-field"><span>Mês</span><select className="form-control" value={selectedMonth} onChange={(event) => { setMonth(event.target.value); setFilter((current) => ({ ...current, employeeId: "" })); }}>{months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></label>
        <label className="form-field"><span>Setor</span><select className="form-control" value={filter.sector} onChange={(event) => setFilter({ sector: event.target.value as SalesFilter["sector"], employeeId: "" })}><option value="Todos">Todos os setores</option>{SALES_SECTORS.map((sector) => <option key={sector} value={sector}>{sector}</option>)}</select></label>
        <label className="form-field"><span>Funcionário</span><select className="form-control" value={filter.employeeId} onChange={(event) => setFilter((current) => ({ ...current, employeeId: event.target.value }))}><option value="">Todos os funcionários</option>{employeeChoices.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
      </div>
    </section>

    <div className="sales-metrics">
      <Metric label="Vendas de hoje" value={todaySale === null ? "—" : money(todaySale)} note={selectedMonth !== today.slice(0, 7) ? "Fora do mês selecionado" : todaySale === null ? "Sem importação de hoje" : today.split("-").reverse().join("/")}/>
      <Metric label="Vendas do mês" value={money(total)} note={monthSnapshot ? monthLabel(selectedMonth) : `${daily.length} ${daily.length === 1 ? "dia importado" : "dias importados"} · ${monthLabel(selectedMonth)}`}/>
      <Metric label="Meta mensal de vendas" value={target === null ? "—" : money(target)} note={targetNote}/>
      <Metric label="Atingimento" value={target === null || progress.attainment === null ? "—" : percent(progress.attainment)} note={targetNote}/>
      <Metric label="Valor faltante" value={target === null || progress.remaining === null ? "—" : money(progress.remaining)} note={targetNote}/>
      <Metric label="Projeção do mês" value={projection === null ? "—" : money(projection)} note={selectedMonth !== today.slice(0, 7) ? "Disponível para o mês atual" : projection === null ? "Aguardando mais dias importados" : "Ritmo médio até hoje"}/>
    </div>

    <div className="sales-charts-grid">
      <ChartCard title="Vendas diárias" note="Uma importação mais recente por dia; os filtros afetam os valores.">
        {dailyData.length ? <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyData} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}><CartesianGrid stroke="#e5ecf5" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false}/><YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={52}/><Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => `Dia ${label}`}/><Line type="monotone" dataKey="value" name="Vendas" stroke="#168beb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }}/></LineChart></ResponsiveContainer></div> : <p className="sales-chart-empty">Sem importações diárias neste mês.</p>}
      </ChartCard>
      <ChartCard title="Vendas por setor" note="Vendas dos funcionários ativos por setor."><div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sectors} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}><CartesianGrid stroke="#e5ecf5" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false}/><YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={52}/><Tooltip formatter={(value) => money(Number(value))}/><Bar dataKey="value" name="Vendas" radius={[5, 5, 0, 0]}>{sectors.map((sector, index) => <Cell key={sector.name} fill={["#123bd9", "#248ff0", "#66b7f3", "#a9b9d4"][index]}/>)}</Bar></BarChart></ResponsiveContainer></div></ChartCard>
      <section className="panel sales-list-card"><div className="sales-card-heading"><h2>Resumo por setor</h2><p>Participação nas vendas do mês filtrado.</p></div><div className="sales-list">{sectors.map((sector) => <div key={sector.name}><span>{sector.name}</span><strong>{money(sector.value)}</strong><small>{total > 0 ? percent(sector.value / total * 100) : "0%"}</small></div>)}</div></section>
      <ChartCard title="Comparativo por período" note={compareMonths ? "Meses com importação; cada período usa o registro mensal ou os dias disponíveis." : "Dias importados no mês selecionado."}><div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}><CartesianGrid stroke="#e5ecf5" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false}/><YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={52}/><Tooltip formatter={(value) => money(Number(value))}/><Bar dataKey="value" name="Vendas" fill="#248ff0" radius={[5, 5, 0, 0]}/></BarChart></ResponsiveContainer></div></ChartCard>
    </div>

    <div className="sales-lower-grid">
      <section className="panel sales-list-card"><div className="sales-card-heading"><h2>Desempenho individual</h2><p>Os 8 funcionários ativos com maior valor de vendas.</p></div>{ranking.length ? <div className="sales-chart sales-individual-chart" style={{ height: Math.max(150, Math.min(ranking.length, 8) * 36 + 36) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={ranking.slice(0, 8)} layout="vertical" margin={{ top: 2, right: 20, bottom: 2, left: 4 }}><CartesianGrid stroke="#e5ecf5" horizontal={false}/><XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(name: string) => { const parts = name.split(" "); return `${parts[0]} ${parts.at(-1)}`; }}/><Tooltip formatter={(value) => money(Number(value))}/><Bar dataKey="value" name="Vendas" fill="#248ff0" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer></div> : <p className="sales-chart-empty">Nenhum funcionário com venda neste filtro.</p>}</section>
    </div>
    <p className="data-note">Totais consideram funcionários ativos de Balcão, Perfumaria e Caixa com vendas acima de zero. Importações mensais substituem a soma diária no total do mês para evitar duplicação.</p>
  </div>;
}
