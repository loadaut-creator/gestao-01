import type { ParsedTable } from "./parser";
import { isSalesRole, type Employee, type Role } from "@/lib/team/model";

export const FIELDS = [
  { key: "seller", label: "Vendedor / identificador BI", required: true },
  { key: "sale", label: "Venda → Totais (R$)", required: true },
  { key: "clients", label: "Clientes atendidos", required: false },
  { key: "ticket", label: "Ticket médio (R$)", required: false },
  { key: "genSim", label: "Gen/Sim (R$)", required: false },
  { key: "mp", label: "MP (R$)", required: false },
  { key: "date", label: "Data da venda", required: false },
  { key: "sector", label: "Setor", required: false },
  { key: "clientPremium", label: "Cliente premium (%)", required: false },
] as const;

export type Field = (typeof FIELDS)[number]["key"];
export type Mapping = Record<Field, string>;
export type PeriodKind = "day" | "month";
export type ImportSettings = { periodKind: PeriodKind; reference: string };
export type NormalizedRow = {
  sourceRow: number;
  seller: string;
  sale: number;
  saleWasBlank: boolean;
  clients: number | null;
  ticket: number | null;
  genSim: number | null;
  mp: number | null;
  date: string | null;
  sector: string | null;
  clientPremium: number | null;
  raw: Record<string, string>;
};
export type RowCheck = { sourceRow: number; errors: string[]; warnings: string[]; record: NormalizedRow | null };
export type ImportRecord = {
  id: string;
  importedAt: string;
  fileName: string;
  fileType: "csv" | "xlsx";
  sheetName?: string;
  periodKind: PeriodKind;
  reference: string;
  rowCount: number;
  totalSale: number;
  mapping: Mapping;
  displayColumns: string[];
  sellerRoles?: Record<string, Role>;
  columns: string[];
  records: NormalizedRow[];
};
export type MappingTemplate = { id: string; name: string; columns: string[]; mapping: Mapping; savedAt: string };

export const EMPTY_MAPPING: Mapping = {
  seller: "", sale: "", clients: "", ticket: "", genSim: "", mp: "",
  date: "", sector: "", clientPremium: "",
};

function normal(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function suggestMapping(columns: string[]): Mapping {
  const names: Partial<Record<Field, string[]>> = {
    seller: ["vendedor", "identificador do funcionario", "id vendedor"],
    sale: ["venda", "valor de venda", "valor vendido"],
    clients: ["clientes", "cliente"],
    ticket: ["ticket medio"],
    genSim: ["gen/sim", "gem/sim"],
    mp: ["mp"],
    date: ["data da venda", "data venda", "data"],
    sector: ["setor"],
    clientPremium: ["cliente premium", "% cliente premium"],
  };
  return Object.fromEntries(FIELDS.map(({ key }) => [key, columns.find((column) => names[key]?.includes(normal(column))) ?? ""])) as Mapping;
}

export function mappingErrors(mapping: Mapping, columns: string[]) {
  const errors: string[] = [];
  for (const field of FIELDS) {
    if (field.required && !mapping[field.key]) errors.push(`Mapeie ${field.label}.`);
    if (mapping[field.key] && !columns.includes(mapping[field.key])) errors.push(`A coluna de ${field.label} não existe no arquivo.`);
  }
  const selected = Object.values(mapping).filter(Boolean);
  if (selected.some((column) => normal(column) === "venda un")) errors.push("A coluna Venda Un não é utilizada neste sistema.");
  if (new Set(selected).size !== selected.length) errors.push("Cada coluna do arquivo só pode ser usada uma vez.");
  return errors;
}

export function parseLocaleNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value || normal(value) === "(em branco)") return null;
  let cleaned = value.replace(/R\$/gi, "").replace(/\s/g, "").replace(/%$/, "");
  if (cleaned.includes(",") && cleaned.includes(".")) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else if (cleaned.includes(",")) cleaned = cleaned.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value || normal(value) === "(em branco)") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return validIso(value) ? value : "invalid";
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return validIso(iso) ? iso : "invalid";
  }
  if (/^\d{5}$/.test(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return "invalid";
}

function validIso(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function settingsErrors(settings: ImportSettings) {
  if (settings.periodKind === "day") return validIso(settings.reference) ? [] : ["Informe uma data de referência válida."];
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(settings.reference) ? [] : ["Informe um mês de referência válido."];
}

export function validateRows(table: ParsedTable, mapping: Mapping, excluded: Set<number>, linkedIds: Set<string>): RowCheck[] {
  const indexes = Object.fromEntries(FIELDS.map(({ key }) => [key, table.columns.indexOf(mapping[key])])) as Record<Field, number>;
  const cell = (row: string[], key: Field) => indexes[key] < 0 ? "" : row[indexes[key]] ?? "";
  return table.rows.map((row, index) => {
    const sourceRow = index + 2;
    if (excluded.has(sourceRow)) return { sourceRow, errors: [], warnings: [], record: null };
    const errors: string[] = [], warnings: string[] = [];
    const seller = cell(row, "seller").trim();
    if (!seller || normal(seller) === "(em branco)") errors.push("Vendedor vazio.");
    const parsedSale = parseLocaleNumber(cell(row, "sale"));
    const saleWasBlank = parsedSale === null;
    const sale = parsedSale ?? 0;
    if (!Number.isFinite(sale)) errors.push("Venda inválida.");
    if (saleWasBlank) warnings.push("Venda vazia registrada como R$ 0,00.");
    const numeric = (key: "clients" | "ticket" | "genSim" | "mp" | "clientPremium", label: string) => {
      const result = parseLocaleNumber(cell(row, key));
      if (result !== null && !Number.isFinite(result)) errors.push(`${label} inválido.`);
      return result;
    };
    const clients = numeric("clients", "Clientes");
    if (clients !== null && Number.isFinite(clients) && (!Number.isInteger(clients) || clients < 0)) errors.push("Clientes deve ser uma contagem não negativa.");
    const ticket = numeric("ticket", "Ticket médio");
    const genSim = numeric("genSim", "Gen/Sim");
    const mp = numeric("mp", "MP");
    const clientPremium = numeric("clientPremium", "Cliente premium");
    if (clientPremium !== null && Number.isFinite(clientPremium) && (clientPremium < 0 || clientPremium > 100)) errors.push("Cliente premium deve estar entre 0% e 100%.");
    const date = parseDate(cell(row, "date"));
    if (date === "invalid") errors.push("Data inválida.");
    if (seller && !linkedIds.has(normal(seller))) warnings.push("Vendedor sem vínculo cadastrado na Equipe.");
    const raw = Object.fromEntries(table.columns.map((column, columnIndex) => [column, row[columnIndex] ?? ""]));
    return {
      sourceRow, errors, warnings,
      record: errors.length ? null : { sourceRow, seller, sale, saleWasBlank, clients, ticket, genSim, mp, date, sector: cell(row, "sector").trim() || null, clientPremium, raw },
    };
  });
}

export function normalizeIdentifier(value: string) { return normal(value); }

function nameTokens(value: string) {
  return normal(value).replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((part) => part && !["da", "de", "do", "das", "dos"].includes(part));
}

function withinOneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

function samePersonName(seller: string[], employee: string[]) {
  if (seller.length < 2 || seller.length !== employee.length) return false;
  const firstChanged = seller[0] !== employee[0];
  const lastChanged = seller.at(-1) !== employee.at(-1);
  if (Number(firstChanged) + Number(lastChanged) > 1) return false;
  if (!withinOneEdit(seller[0], employee[0]) || !withinOneEdit(seller.at(-1)!, employee.at(-1)!)) return false;
  return seller.slice(1, -1).every((part, index) => {
    const other = employee[index + 1];
    return part === other || (Math.min(part.length, other.length) === 1 && part[0] === other[0]);
  });
}

export function findEmployeeForSeller(seller: string, employees: Employee[]): Employee | null {
  const key = normalizeIdentifier(seller);
  if (!key) return null;
  const exact = employees.filter((employee) => [employee.biIdentifier, employee.name].some((value) => value && normalizeIdentifier(value) === key));
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const parts = nameTokens(seller);
  const candidates = employees.filter((employee) => [employee.biIdentifier, employee.name].some((value) => value && samePersonName(parts, nameTokens(value))));
  return candidates.length === 1 ? candidates[0] : null;
}

export function suggestSellerRoles(table: ParsedTable, sellerColumn: string, employees: Employee[]): Record<string, Role> {
  const sellerIndex = table.columns.indexOf(sellerColumn);
  if (sellerIndex < 0) return {};

  const roles: Record<string, Role> = {};
  for (const row of table.rows) {
    const key = normalizeIdentifier(row[sellerIndex] ?? "");
    if (!key || key === "(em branco)") continue;
    const employee = findEmployeeForSeller(row[sellerIndex] ?? "", employees);
    const role = employee?.status === "ativo" && isSalesRole(employee.role) ? employee.role : "";
    if (role) roles[key] = role;
  }
  return roles;
}
