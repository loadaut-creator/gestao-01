import { normalizeKey, type EmployeeStatus } from "./model";

export type RosterDraft = {
  registration: string;
  name: string;
  sourceRole: string;
  hiredAt: string;
  status: EmployeeStatus;
  biIdentifier: string;
  include: boolean;
};

const sourceRoles = /\s+(BALC\.?\s+MEDICAMENTOS?|BALCONISTA|CAIXA|PERFUMISTA|VENDEDOR(?:A)?\s+PERFUMARIA|PERFUMARIA|REPOSITOR(?:\s+MERCADORIA)?|FISCAL(?:\s+PREV(?:EN[ÇC][ÃA]O)?\s+PERDAS)?|OPERADOR(?:A)?\s+DE\s+CAIXA|FARMAC[EÊ]UTICO(?:A)?\s+CL[IÍ]NICO)\s*$/i;

function isoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const result = `${year}-${month}-${day}`;
  const date = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === result ? result : "";
}

export function parseRosterText(text: string): { drafts: RosterDraft[]; errors: string[] } {
  const drafts: RosterDraft[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || /^matr[ií]cula\b/i.test(line)) return;
    const match = line.match(/^(\S+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})$/);
    if (!match) { errors.push(`Linha ${index + 1}: informe matrícula, nome, cargo e data no formato dd/mm/aaaa.`); return; }
    const [, registration, middle, rawDate] = match;
    const hiredAt = isoDate(rawDate);
    if (!hiredAt) { errors.push(`Linha ${index + 1}: data de admissão inválida.`); return; }
    if (seen.has(normalizeKey(registration))) { errors.push(`Linha ${index + 1}: matrícula repetida.`); return; }
    seen.add(normalizeKey(registration));
    const cells = middle.split(/\t+| {2,}/).map((cell) => cell.trim()).filter(Boolean);
    let name = "";
    let sourceRole = "";
    if (cells.length >= 2) {
      [name, sourceRole] = [cells.slice(0, -1).join(" "), cells.at(-1)!];
    } else {
      const roleMatch = middle.match(sourceRoles);
      if (roleMatch) {
        name = middle.slice(0, roleMatch.index).trim();
        sourceRole = roleMatch[1].trim();
      }
    }
    if (!name || !sourceRole) { errors.push(`Linha ${index + 1}: não foi possível separar nome e cargo; use tabulações ou espaços duplos.`); return; }
    drafts.push({ registration, name, sourceRole, hiredAt, status: "ativo", biIdentifier: name, include: true });
  });
  return { drafts, errors };
}
