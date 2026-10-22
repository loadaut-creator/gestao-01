import { findEmployeeForSeller, type ImportRecord, type NormalizedRow } from "@/lib/bi/model";
import { isSalesRole, type Employee } from "@/lib/team/model";

export const SALES_SECTORS = ["Balcão", "Perfumaria", "Caixa"] as const;
export type SalesSector = (typeof SALES_SECTORS)[number] | "Outros";
export type SalesEntry = {
  row: NormalizedRow;
  sale: number;
  sector: SalesSector;
  employeeId: string | null;
  employeeName: string | null;
};
export type SalesFilter = { sector: SalesSector | "Todos"; employeeId: string };

export function monthOf(record: ImportRecord) { return record.reference.slice(0, 7); }

export function latestDailyImports(imports: ImportRecord[], month?: string) {
  const seen = new Set<string>();
  return [...imports].filter((item) => item.periodKind === "day" && (!month || monthOf(item) === month))
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
    .filter((item) => { if (seen.has(item.reference)) return false; seen.add(item.reference); return true; })
    .sort((a, b) => a.reference.localeCompare(b.reference));
}

export function monthImports(imports: ImportRecord[], month: string) {
  const period = imports.filter((item) => item.periodKind === "month" && item.reference === month)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  return period ? [period] : latestDailyImports(imports, month);
}

export function classifyRows(records: Pick<ImportRecord, "records">[], employees: Employee[]): SalesEntry[] {
  return records.flatMap((record) => record.records.map((row) => {
    const employee = findEmployeeForSeller(row.seller, employees);
    const eligible = employee?.status === "ativo" && isSalesRole(employee.role);
    const sector: SalesSector = eligible ? employee.role === "Balconista" ? "Balcão" : employee.role === "Perfumista" ? "Perfumaria" : "Caixa" : "Outros";
    return { row, sale: row.sale, sector, employeeId: eligible ? employee.id : null, employeeName: eligible ? employee.name : null };
  }));
}

export function validSalesEntries(records: Pick<ImportRecord, "records">[], employees: Employee[]): SalesEntry[] {
  return classifyRows(records, employees).filter(entry => entry.employeeId !== null && entry.sale > 0);
}

export function applySalesFilter(entries: SalesEntry[], filter: SalesFilter) {
  return entries.filter((entry) =>
    (filter.sector === "Todos" || entry.sector === filter.sector) &&
    (!filter.employeeId || entry.employeeId === filter.employeeId)
  );
}

export function sumSales(entries: SalesEntry[]) { return entries.reduce((sum, entry) => sum + entry.sale, 0); }

export function rankEmployees(entries: SalesEntry[]) {
  const totals = new Map<string, { name: string; value: number }>();
  for (const entry of entries) {
    if (!entry.employeeId || !entry.employeeName) continue;
    const previous = totals.get(entry.employeeId)?.value ?? 0;
    totals.set(entry.employeeId, { name: entry.employeeName, value: previous + entry.sale });
  }
  return [...totals.values()].filter((employee) => employee.value > 0).sort((a, b) => b.value - a.value);
}

export function monthKeys(imports: ImportRecord[]) {
  return [...new Set(imports.map(monthOf).filter((month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month)))].sort().reverse();
}

export function monthProjection(realized: number, month: string, todayIso: string) {
  if (month !== todayIso.slice(0, 7) || realized <= 0) return null;
  const [year, number] = month.split("-").map(Number);
  const daysInMonth = new Date(year, number, 0).getDate();
  const elapsedDays = Number(todayIso.slice(8, 10));
  return elapsedDays > 0 ? realized / elapsedDays * daysInMonth : null;
}
