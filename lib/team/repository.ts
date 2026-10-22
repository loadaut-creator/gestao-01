import { api, cloud, isCloud, saveCloud } from "../cloud/client";
import type { Employee } from "./model";

const STORAGE_KEY = "visao-comercial:employees:v1";
const CHANGE_EVENT = "visao308:employees-changed";

export function loadEmployees(): Employee[] {
  if (isCloud()) return cloud.data.employees;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error("Os dados locais da equipe estão inválidos.");
  return parsed as Employee[];
}

export async function saveEmployees(employees: Employee[]) {
  if (isCloud()) await saveCloud("employees", employees);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function deleteEmployee(id: string) {
  if (isCloud()) {
    const result = await api<{version:number}>(`employees/${encodeURIComponent(id)}`, {
      method: "DELETE", body: JSON.stringify({version: cloud.versions.employees || 0}),
    });
    cloud.data.employees = cloud.data.employees.filter(employee => employee.id !== id);
    cloud.versions.employees = result.version;
  } else {
    const remaining = loadEmployees().filter(employee => employee.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToEmployeeChanges(onChange: (employees: Employee[]) => void) {
  const refresh = () => onChange(loadEmployees());
  const listener = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) refresh();
  };
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, refresh);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(CHANGE_EVENT, refresh); };
}
