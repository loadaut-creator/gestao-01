export const ROLES = ["Caixa", "Balconista", "Perfumista"] as const;
export const SECTORS = ["Caixa", "Balcão", "Perfumaria", "Outro"] as const;

export type Role = (typeof ROLES)[number];
export type EmployeeRole = Role | "Outro";
export type Sector = (typeof SECTORS)[number];
export type EmployeeStatus = "ativo" | "inativo";

export type EmployeeInput = {
  name: string;
  registration: string;
  role: EmployeeRole;
  jobTitle?: string;
  sector: Sector;
  status: EmployeeStatus;
  hiredAt: string;
  biIdentifier: string;
};

export type Employee = EmployeeInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeField = keyof EmployeeInput;
export type EmployeeErrors = Partial<Record<EmployeeField, string>>;

export const EMPTY_EMPLOYEE: EmployeeInput = {
  name: "",
  registration: "",
  role: "Caixa",
  jobTitle: "Caixa",
  sector: "Caixa",
  status: "ativo",
  hiredAt: "",
  biIdentifier: "",
};

export function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function salesRoleFromTitle(value: string): EmployeeRole {
  const title = normalizeKey(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bcaixa\b/.test(title)) return "Caixa";
  if (/\bbalc\b|\bbalcao\b|\bbalconista\b|\bmedicamento\b/.test(title)) return "Balconista";
  if (/\bperfum/.test(title)) return "Perfumista";
  return "Outro";
}

export function isSalesRole(role: EmployeeRole): role is Role {
  return ROLES.some((item) => item === role);
}

export function sectorFromRole(role: EmployeeRole): Sector {
  return role === "Balconista" ? "Balcão" : role === "Perfumista" ? "Perfumaria" : role === "Caixa" ? "Caixa" : "Outro";
}

export function cleanEmployeeInput(input: EmployeeInput): EmployeeInput {
  const jobTitle = (input.jobTitle === undefined ? input.role : input.jobTitle).trim().replace(/\s+/g, " ");
  const role = salesRoleFromTitle(jobTitle);
  return {
    ...input,
    name: input.name.trim().replace(/\s+/g, " "),
    registration: input.registration.trim(),
    biIdentifier: input.biIdentifier.trim(),
    jobTitle,
    role,
    sector: sectorFromRole(role),
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateEmployee(input: EmployeeInput, employees: Employee[], editingId?: string): EmployeeErrors {
  const errors: EmployeeErrors = {};
  const clean = cleanEmployeeInput(input);
  if (!clean.name) errors.name = "Informe o nome completo.";
  if (!clean.registration) errors.registration = "Informe a matrícula ou código.";
  if (!clean.jobTitle) errors.jobTitle = "Informe o cargo.";
  if (clean.status !== "ativo" && clean.status !== "inativo") errors.status = "Selecione um status válido.";
  if (!validDate(clean.hiredAt)) errors.hiredAt = "Informe uma data de admissão válida.";
  if (clean.registration && employees.some((employee) => employee.id !== editingId && normalizeKey(employee.registration) === normalizeKey(clean.registration))) {
    errors.registration = "Esta matrícula já está cadastrada.";
  }
  if (clean.biIdentifier && employees.some((employee) => employee.id !== editingId && normalizeKey(employee.biIdentifier) === normalizeKey(clean.biIdentifier))) {
    errors.biIdentifier = "Este identificador do BI já está vinculado.";
  }
  return errors;
}

export function findUnlinkedBiIdentifiers(raw: string, employees: Employee[]) {
  const linked = new Set(employees.map((employee) => normalizeKey(employee.biIdentifier)).filter(Boolean));
  const seen = new Set<string>();
  return raw.split(/[\n,;]+/).map((value) => value.trim()).filter((value) => {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return !linked.has(key);
  });
}
