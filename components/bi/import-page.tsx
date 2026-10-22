"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Save, Trash2, UploadCloud } from "lucide-react";
import { loadEmployees, subscribeToEmployeeChanges } from "@/lib/team/repository";
import type { Employee } from "@/lib/team/model";
import { EMPTY_MAPPING, findEmployeeForSeller, mappingErrors, normalizeIdentifier, settingsErrors, suggestMapping, suggestSellerRoles, validateRows, type ImportRecord, type ImportSettings, type Mapping } from "@/lib/bi/model";
import { parseBiFile, type ParsedTable } from "@/lib/bi/parser";
import { deleteImport, subscribeToImports, saveImport } from "@/lib/bi/repository";

type Step = 1 | 2 | 3;
const STEPS = ["Arquivo", "Validação", "Confirmação"];
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR");

function ImportFlow({ kind, employees, onSaved }: { kind: "day" | "month"; employees: Employee[]; onSaved: (record: ImportRecord) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [displayColumns, setDisplayColumns] = useState<string[]>([]);
  const [settings, setSettings] = useState<ImportSettings>({ periodKind: kind, reference: "" });
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const inputId = `bi-${kind}-file`;
  const titleId = `bi-${kind}-flow-title`;

  const mapProblems = table ? mappingErrors(mapping, table.columns) : [];
  const periodProblems = settingsErrors(settings);
  const linkedIds = useMemo(() => {
    const sellerIndex = table?.columns.indexOf(mapping.seller) ?? -1;
    if (!table || sellerIndex < 0) return new Set<string>();
    return new Set(table.rows.map((row) => row[sellerIndex] ?? "").filter((seller) => findEmployeeForSeller(seller, employees)).map(normalizeIdentifier));
  }, [table, mapping.seller, employees]);
  const sellerRoles = useMemo(() => table ? suggestSellerRoles(table, mapping.seller, employees) : {}, [table, mapping.seller, employees]);
  const checks = useMemo(() => table && mapProblems.length === 0 ? validateRows(table, mapping, excluded, linkedIds) : [], [table, mapping, excluded, linkedIds, mapProblems.length]);
  const included = checks.filter((item) => item.record);
  const invalid = checks.filter((item) => item.errors.length);
  const unmatched = checks.filter((item) => item.record && item.warnings.includes("Vendedor sem vínculo cadastrado na Equipe."));
  const blankSales = checks.filter((item) => item.record?.saleWasBlank);
  const totalSale = included.reduce((sum, item) => sum + (item.record?.sale ?? 0), 0);
  const sellerColumn = table?.columns.indexOf(mapping.seller) ?? -1;
  const sellers = useMemo(() => {
    if (!table || sellerColumn < 0) return [];
    const seen = new Set<string>();
    return table.rows.map((row) => (row[sellerColumn] ?? "").trim()).filter((name) => {
      const key = normalizeIdentifier(name);
      if (!key || key === "(em branco)" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [table, sellerColumn]);
  const unknownSellers = sellers.filter((name) => !sellerRoles[normalizeIdentifier(name)]);

  async function receiveFile(selected: File | null) {
    if (!selected) return;
    setBusy(true); setNotice(null); setStep(1); setFile(null); setTable(null); setExcluded(new Set());
    try {
      const parsed = await parseBiFile(selected);
      const suggestedMapping = suggestMapping(parsed.columns);
      setFile(selected); setTable(parsed); setMapping(suggestedMapping);
      setDisplayColumns(parsed.columns.filter((column) => ["Vendedor", "Venda", "Clientes", "Ticket Médio", "Gen/Sim", "MP"].includes(column)));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Não foi possível ler o arquivo." });
      if (inputRef.current) inputRef.current.value = "";
    } finally { setBusy(false); }
  }

  function toggleExcluded(sourceRow: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(sourceRow)) next.delete(sourceRow); else next.add(sourceRow);
      return next;
    });
  }

  function toggleDisplayColumn(column: string) {
    if (column === "Venda Un") return;
    setDisplayColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  }

  function advance() {
    setNotice(null);
    if (step === 1) {
      if (!table || !file) { setNotice({ type: "error", message: "Selecione um arquivo válido." }); return; }
      if (periodProblems.length) { setNotice({ type: "error", message: periodProblems[0] }); return; }
      if (kind === "day" && !displayColumns.length) { setNotice({ type: "error", message: "Selecione ao menos uma coluna para exibir na tela Início." }); return; }
      if (mapProblems.length) { setNotice({ type: "error", message: `Colunas obrigatórias não reconhecidas: ${mapProblems.join(" ")}` }); return; }
      setStep(2);
    } else if (step === 2) {
      if (invalid.length) { setNotice({ type: "error", message: "Corrija ou exclua as linhas inválidas antes de continuar." }); return; }
      if (!included.length) { setNotice({ type: "error", message: "Inclua pelo menos uma linha válida." }); return; }
      setStep(3);
    }
  }

  async function confirm() {
    if (!file || !table || mapProblems.length || periodProblems.length || invalid.length || !included.length || (kind === "day" && !displayColumns.length)) return;
    setBusy(true); setNotice(null);
    const record: ImportRecord = {
      id: crypto.randomUUID(), importedAt: new Date().toISOString(), fileName: file.name,
      fileType: file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv", sheetName: table.sheetName,
      periodKind: settings.periodKind, reference: settings.reference,
      rowCount: included.length, totalSale, mapping, columns: table.columns, displayColumns: table.columns.filter((column) => displayColumns.includes(column)), sellerRoles,
      records: included.map((item) => item.record!),
    };
    try {
      await saveImport(record);
      onSaved(record);
      setNotice({ type: "success", message: `Importação concluída: ${record.rowCount} linhas salvas.` });
      setFile(null); setTable(null); setMapping(EMPTY_MAPPING); setDisplayColumns([]); setExcluded(new Set()); setStep(1);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar a importação. Tente novamente." });
    } finally { setBusy(false); }
  }

  return <section className={`panel bi-flow${step > 1 ? " bi-flow-expanded" : ""}`} aria-labelledby={titleId}>
      <div className="bi-flow-head"><h2 id={titleId}>{kind === "day" ? "Importação venda diária" : "Importação período"}</h2><span className="bi-step-counter">Etapa {step} de 3</span></div>
      <ol className="bi-steps" aria-label="Etapas da importação">{STEPS.map((label, index) => <li key={label} className={index + 1 === step ? "current" : index + 1 < step ? "done" : ""} aria-current={index + 1 === step ? "step" : undefined}><span>{index + 1 < step ? <CheckCircle2 size={16}/> : index + 1}</span>{label}</li>)}</ol>
      {notice && <div className={`team-notice ${notice.type}`} role="status" aria-live="polite">{notice.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.message}</span></div>}

      {step === 1 && <div className="bi-stage">
        <label className="bi-upload" htmlFor={inputId} aria-label={`Importar arquivo ${kind === "day" ? "de venda diária" : "do período"}`}><span className="bi-upload-button"><UploadCloud size={25} aria-hidden="true"/></span>{file && <strong>{file.name}</strong>}{file && table && <span>{file.name.split(".").pop()?.toUpperCase()} · {table.columns.length} colunas{table.sheetName ? ` · Aba ${table.sheetName}` : ""}</span>}<input id={inputId} ref={inputRef} type="file" accept=".csv,.xlsx" onChange={(event) => receiveFile(event.target.files?.[0] ?? null)} disabled={busy}/></label>
        {kind === "day" && file && table && <div className="bi-column-panel"><div><h3>Colunas exibidas na tela Início</h3><p>Marque as colunas que deseja ver na tabela única de vendas diárias. A escolha será aplicada após confirmar a importação.</p></div><div className="bi-column-options">{table.columns.map((column) => <label key={column}><input type="checkbox" checked={displayColumns.includes(column)} onChange={() => toggleDisplayColumn(column)} disabled={column === "Venda Un"}/><span>{column}{column === "Venda Un" ? " (não utilizada)" : ""}</span></label>)}</div><span className="bi-column-count">{displayColumns.length} de {table.columns.length} colunas selecionadas</span></div>}
        {file && table && <div className="bi-sellers-panel"><div className="bi-sellers-heading"><div><h3>Vendedores reconhecidos</h3><p>Os cargos vêm da Equipe. Para corrigir um vínculo ou cargo, edite o funcionário na tela Equipe.</p></div><span>{sellers.length - unknownSellers.length} de {sellers.length} reconhecidos</span></div>{unknownSellers.length > 0 && <details className="bi-unknown-sellers"><summary>Ver {unknownSellers.length} nomes sem cargo reconhecido</summary><div>{unknownSellers.map((name) => <span key={normalizeIdentifier(name)}>{name}</span>)}</div></details>}</div>}
        <div className="bi-period"><h3>{kind === "day" ? "Dia de referência" : "Mês de referência"}</h3><div className="bi-period-controls"><div className="form-field"><label htmlFor={`bi-${kind}-reference`}>{kind === "day" ? "Data" : "Mês"}</label><input id={`bi-${kind}-reference`} className="form-control" type={kind === "day" ? "date" : "month"} value={settings.reference} onChange={(event) => setSettings({ periodKind: kind, reference: event.target.value })}/></div></div></div>
      </div>}

      {step === 2 && table && <div className="bi-stage"><div className="bi-section-heading"><h3>Validação e prévia</h3><p>Linhas com erro precisam ser excluídas ou corrigidas no arquivo antes da confirmação. Vendedores sem vínculo são apenas sinalizados.</p></div><div className="bi-validation-summary"><div><span>Válidas</span><strong>{included.length}</strong></div><div><span>Com erro</span><strong>{invalid.length}</strong></div><div><span>Sem vínculo</span><strong>{unmatched.length}</strong></div><div><span>Excluídas</span><strong>{excluded.size}</strong></div></div>{blankSales.length > 0 && <p className="bi-preview-note">{blankSales.length} {blankSales.length === 1 ? "linha com Venda vazia será mantida" : "linhas com Venda vazia serão mantidas"} com Totais de R$ 0,00.</p>}{invalid.length > 0 && <div className="bi-issue-list"><h4>Inconsistências</h4>{invalid.slice(0, 40).map((item) => <div key={item.sourceRow}><span>Linha {item.sourceRow}: {item.errors.join(" ")}</span><button type="button" onClick={() => toggleExcluded(item.sourceRow)}>Excluir linha</button></div>)}{invalid.length > 40 && <p>Há mais {invalid.length - 40} linhas com erro. Corrija o arquivo e selecione-o novamente.</p>}</div>}<p className="bi-preview-note">Prévia das primeiras 20 linhas. “Venda” corresponde ao valor vendido até o momento.</p><div className="table-scroll" role="region" tabIndex={0} aria-label="Prévia da importação"><table className="bi-preview-table"><thead><tr><th scope="col">Incluir</th><th scope="col">Linha</th><th scope="col">Vendedor</th><th scope="col">Totais</th><th scope="col">Clientes</th><th scope="col">Ticket médio</th><th scope="col">Gen/Sim</th><th scope="col">MP</th><th scope="col">Validação</th></tr></thead><tbody>{checks.slice(0, 20).map((item) => { const row = table.rows[item.sourceRow - 2]; const get = (key: keyof Mapping) => row[table.columns.indexOf(mapping[key])] ?? ""; return <tr key={item.sourceRow} className={excluded.has(item.sourceRow) ? "excluded" : ""}><td><input type="checkbox" checked={!excluded.has(item.sourceRow)} onChange={() => toggleExcluded(item.sourceRow)} aria-label={`Incluir linha ${item.sourceRow}`}/></td><td>{item.sourceRow}</td><th scope="row">{get("seller") || "—"}</th><td>{item.record ? currency(item.record.sale) : get("sale") || "—"}</td><td>{get("clients") || "—"}</td><td>{get("ticket") || "—"}</td><td>{get("genSim") || "—"}</td><td>{get("mp") || "—"}</td><td>{excluded.has(item.sourceRow) ? "Excluída" : item.errors.length ? <span className="bi-error-text">{item.errors.join(" ")}</span> : item.warnings.length ? <span className="bi-warning-text">{item.warnings.join(" ")}</span> : "Válida"}</td></tr>; })}</tbody></table></div><p className="table-scroll-hint">Deslize para ver todas as colunas →</p></div>}

      {step === 3 && file && table && <div className="bi-stage"><div className="bi-section-heading"><h3>Confirme a importação</h3><p>Os registros serão salvos no histórico local e ficarão disponíveis para os próximos blocos.</p></div><dl className="bi-confirm-grid"><div><dt>Arquivo</dt><dd>{file.name}</dd></div><div><dt>Referência</dt><dd>{settings.reference} ({settings.periodKind === "day" ? "dia" : "mês"})</dd></div><div><dt>Linhas válidas</dt><dd>{included.length}</dd></div><div><dt>Linhas excluídas</dt><dd>{excluded.size}</dd></div><div><dt>Vendas vazias como R$ 0,00</dt><dd>{blankSales.length}</dd></div><div><dt>Vendedores com cargo definido</dt><dd>{Object.keys(sellerRoles).length}</dd></div><div><dt>Vendedores sem vínculo</dt><dd>{unmatched.length}</dd></div><div><dt>Totais do arquivo</dt><dd>{currency(totalSale)}</dd></div>{kind === "day" && <div><dt>Colunas na tela Início</dt><dd>{displayColumns.join(", ")}</dd></div>}</dl>{blankSales.length === included.length && included.length > 0 && <p className="imported-sales-warning" role="alert">Todas as linhas estão com Venda vazia. O total será R$ 0,00. Confira o arquivo e a coluna selecionada antes de salvar.</p>}<p className="bi-confirm-note">Confira se linhas de totalização ou canais de venda devem ser excluídas. O sistema não presume que todos os valores da coluna “Vendedor” são pessoas.</p></div>}

      <div className="bi-flow-actions">{step > 1 && <button type="button" className="button button-neutral" onClick={() => { setStep((step - 1) as Step); setNotice(null); }} disabled={busy}><ChevronLeft size={17}/> Voltar</button>}{step < 3 ? <button type="button" className="button button-primary" onClick={advance} disabled={busy}>Continuar <ChevronRight size={17}/></button> : <button type="button" className="button button-primary" onClick={confirm} disabled={busy}><Save size={17}/>{busy ? "Salvando…" : "Salvar informações do arquivo"}</button>}</div>
    </section>;
}

export function ImportPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { setEmployees(loadEmployees()); }
      catch { setNotice({ type: "error", message: "Alguns dados locais não puderam ser lidos." }); }
    });
    const stopImports = subscribeToImports(setHistory, () => setNotice({ type: "error", message: "Não foi possível carregar o histórico local." }));
    const unsubscribe = subscribeToEmployeeChanges(setEmployees);
    return () => { active = false; unsubscribe(); stopImports(); };
  }, []);

  async function removeImport(record: ImportRecord) {
    if (!window.confirm(`Excluir a importação de ${record.fileName} (${record.reference})?`)) return;
    setDeleting(true); setNotice(null);
    try {
      await deleteImport(record.id);
      setHistory((current) => current.filter((item) => item.id !== record.id));
      setNotice({ type: "success", message: "Registro excluído do histórico." });
    } catch {
      setNotice({ type: "error", message: "Não foi possível excluir o registro." });
    } finally { setDeleting(false); }
  }

  return <div className="bi-page">
    <div className="bi-flow-grid">
      <ImportFlow kind="day" employees={employees} onSaved={(record) => setHistory((current) => [record, ...current.filter((item) => item.id !== record.id)])}/>
      <ImportFlow kind="month" employees={employees} onSaved={(record) => setHistory((current) => [record, ...current.filter((item) => item.id !== record.id)])}/>
    </div>
    {notice && <div className={`team-notice ${notice.type}`} role="status">{notice.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.message}</span></div>}
    <section className="panel bi-history" aria-labelledby="bi-history-title"><div className="panel-heading"><div><span className="panel-kicker">REGISTROS</span><h2 id="bi-history-title">Histórico de importações</h2><p>Importações confirmadas no ambiente de dados atual.</p></div></div>{history.length ? <div className="table-scroll" role="region" tabIndex={0} aria-label="Histórico de importações"><table className="bi-history-table"><thead><tr><th scope="col">Importado em</th><th scope="col">Tipo</th><th scope="col">Arquivo</th><th scope="col">Referência</th><th scope="col">Linhas</th><th scope="col">Totais</th><th scope="col">Excluir</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{dateTime(item.importedAt)}</td><td>{item.periodKind === "day" ? "Diária" : "Período"}</td><th scope="row">{item.fileName}</th><td>{item.reference}</td><td>{item.rowCount}</td><td>{currency(item.totalSale)}</td><td><button type="button" className="bi-delete-import" onClick={() => removeImport(item)} disabled={deleting} aria-label={`Excluir importação ${item.fileName} de ${item.reference}`} title="Excluir registro"><Trash2 size={16} aria-hidden="true"/></button></td></tr>)}</tbody></table></div> : <div className="bi-history-empty"><FileSpreadsheet size={24}/><strong>Nenhuma importação confirmada</strong><p>O histórico aparecerá aqui depois da confirmação.</p></div>}</section>
  </div>;
}
