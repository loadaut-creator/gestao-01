import { cloud, isCloud, api, saveCloud } from "../cloud/client";
import type { ImportRecord, MappingTemplate } from "./model";

const DATABASE = "visao-comercial-bi";
const STORE = "imports";
const TEMPLATES_KEY = "visao-comercial:bi-mapping-templates:v1";
const IMPORTS_EVENT = "visao308:imports-changed";

function notifyImportsChanged() {
  window.dispatchEvent(new Event(IMPORTS_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(IMPORTS_EVENT);
    channel.postMessage("changed");
    channel.close();
  }
}

export function subscribeToImports(onChange: (records: ImportRecord[]) => void, onError: () => void) {
  let active = true;
  let revision = 0;
  const refresh = () => {
    const current = ++revision;
    listImports().then((records) => { if (active && current === revision) onChange(records); })
      .catch(() => { if (active && current === revision) onError(); });
  };
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(IMPORTS_EVENT) : null;
  if (channel) channel.onmessage = refresh;
  window.addEventListener(IMPORTS_EVENT, refresh);
  refresh();
  return () => { active = false; channel?.close(); window.removeEventListener(IMPORTS_EVENT, refresh); };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o histórico local."));
  });
}

export async function listLocalImports(): Promise<ImportRecord[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as ImportRecord[]).sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
      request.onerror = () => reject(request.error ?? new Error("Não foi possível ler o histórico."));
    });
  } finally { database.close(); }
}

export async function listImports(): Promise<ImportRecord[]> {
  return isCloud() ? api<ImportRecord[]>("imports") : listLocalImports();
}

export async function saveImport(record: ImportRecord): Promise<void> {
  if (isCloud()) {
    const result = await api<{duplicate:boolean}>("imports", { method: "POST", body: JSON.stringify(record) });
    notifyImportsChanged();
    if(result.duplicate) throw new Error("Esta importação já estava salva na nuvem. O histórico foi atualizado sem duplicar os dados.");
    return;
  }
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).add(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar a importação."));
      transaction.onabort = () => reject(transaction.error ?? new Error("A importação foi cancelada."));
    });
    notifyImportsChanged();
  } finally { database.close(); }
}

export async function deleteImport(id: string): Promise<void> {
  if (isCloud()) { await api(`imports/${encodeURIComponent(id)}`, {method:"DELETE"}); notifyImportsChanged(); return; }
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível excluir a importação."));
      transaction.onabort = () => reject(transaction.error ?? new Error("A exclusão foi cancelada."));
    });
    notifyImportsChanged();
  } finally { database.close(); }
}

export function loadTemplates(): MappingTemplate[] {
  if (isCloud()) return cloud.data.templates;
  const saved = localStorage.getItem(TEMPLATES_KEY);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as MappingTemplate[] : [];
}

export async function saveTemplate(template: MappingTemplate): Promise<MappingTemplate[]> {
  const next = [template, ...loadTemplates().filter((item) => item.name !== template.name)];
  if (isCloud()) await saveCloud("templates",next);
  else localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  return next;
}
