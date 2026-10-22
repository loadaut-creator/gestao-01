"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Link2, Trash2, UserCheck, Users, X } from "lucide-react";
import {
  cleanEmployeeInput, EMPTY_EMPLOYEE, normalizeKey, salesRoleFromTitle, sectorFromRole, validateEmployee,
  type Employee, type EmployeeErrors, type EmployeeInput, type EmployeeStatus,
} from "@/lib/team/model";
import { deleteEmployee, loadEmployees, saveEmployees, subscribeToEmployeeChanges } from "@/lib/team/repository";
import { cloud, isCloud } from "@/lib/cloud/client";
import { parseRosterText, type RosterDraft } from "@/lib/team/roster";
import { TeamDatePicker } from "@/components/team/team-date-picker";

type Notice = { kind: "success" | "error"; text: string };

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function TeamPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_EMPLOYEE);
  const [errors, setErrors] = useState<EmployeeErrors>({});
  const [biText, setBiText] = useState("");
  const [roster, setRoster] = useState<RosterDraft[]>([]);
  const [rosterErrors, setRosterErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const canDelete = !isCloud() || cloud.session.role === "admin";

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { setEmployees(loadEmployees()); }
      catch { setNotice({ kind: "error", text: "Não foi possível ler os dados locais da equipe." }); }
      finally { setLoaded(true); }
    });
    const unsubscribe = subscribeToEmployeeChanges(setEmployees);
    return () => { active = false; unsubscribe(); };
  }, []);

  const filtered = useMemo(() => employees.filter((employee) =>
    (roleFilter === "todos" || (employee.jobTitle || employee.role) === roleFilter) &&
    (statusFilter === "todos" || employee.status === statusFilter)
  ), [employees, roleFilter, statusFilter]);
  const jobTitles = useMemo(() => [...new Set(employees.map((employee) => employee.jobTitle || employee.role))].sort((a, b) => a.localeCompare(b, "pt-BR")), [employees]);
  const activeCount = employees.filter((employee) => employee.status === "ativo").length;
  const withoutBi = employees.filter((employee) => !employee.biIdentifier).length;

  function inspectRoster() {
    const parsed = parseRosterText(biText);
    const drafts = parsed.drafts.map((draft) => {
      const existing = employees.find((employee) => normalizeKey(employee.registration) === normalizeKey(draft.registration));
      return existing ? { ...draft, status: existing.status, biIdentifier: existing.biIdentifier || draft.name, include: true } : draft;
    });
    setRoster(drafts);
    setRosterErrors(parsed.errors);
    setNotice(null);
  }

  function updateRoster(index: number, changes: Partial<RosterDraft>) {
    setRoster((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  }

  async function saveRoster() {
    const selected = roster.filter((row) => row.include);
    if (!selected.length) { setNotice({ kind: "error", text: "Selecione ao menos um funcionário." }); return; }
    if (rosterErrors.length) { setNotice({ kind: "error", text: "Corrija as linhas não reconhecidas antes de salvar." }); return; }
    if (new Set(selected.map((row) => normalizeKey(row.registration))).size !== selected.length) { setNotice({ kind: "error", text: "Há matrículas repetidas na revisão." }); return; }
    const next = [...employees];
    const now = new Date().toISOString();
    for (const row of selected) {
      const existing = next.find((employee) => normalizeKey(employee.registration) === normalizeKey(row.registration));
      const role = salesRoleFromTitle(row.sourceRole);
      const input: EmployeeInput = { name: row.name, registration: row.registration, jobTitle: row.sourceRole, role, sector: sectorFromRole(role), status: row.status, hiredAt: row.hiredAt, biIdentifier: row.biIdentifier };
      const found = validateEmployee(input, next, existing?.id);
      if (Object.keys(found).length) { setNotice({ kind: "error", text: `Revise ${row.name}: ${Object.values(found)[0]}` }); return; }
      if (existing) next.splice(next.indexOf(existing), 1, { ...existing, ...cleanEmployeeInput(input), updatedAt: now });
      else next.push({ ...cleanEmployeeInput(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    }
    if (await persist(next, `${selected.length} ${selected.length === 1 ? "funcionário salvo" : "funcionários salvos"} na Equipe.`)) {
      setRoster([]); setRosterErrors([]); setBiText("");
    }
  }

  async function persist(next: Employee[], message: string) {
    try {
      await saveEmployees(next);
      setEmployees(next);
      setNotice({ kind: "success", text: message });
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." });
      return false;
    }
  }

  function openEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({ name: employee.name, registration: employee.registration, role: employee.role, jobTitle: employee.jobTitle || employee.role, sector: employee.sector, status: employee.status, hiredAt: employee.hiredAt, biIdentifier: employee.biIdentifier });
    setErrors({});
    setNotice(null);
    setFormOpen(true);
  }

  function change<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateEmployee(form, employees, editingId ?? undefined);
    if (Object.keys(found).length) { setErrors(found); setNotice({ kind: "error", text: "Revise os campos indicados no formulário." }); return; }
    const now = new Date().toISOString();
    const clean = cleanEmployeeInput(form);
    const next = editingId
      ? employees.map((employee) => employee.id === editingId ? { ...employee, ...clean, updatedAt: now } : employee)
      : [...employees, { ...clean, id: crypto.randomUUID(), createdAt: now, updatedAt: now }];
    if (await persist(next, editingId ? "Funcionário atualizado." : "Funcionário cadastrado.")) {
      setFormOpen(false);
      setEditingId(null);
    }
  }

  async function toggleStatus(employee: Employee) {
    const status: EmployeeStatus = employee.status === "ativo" ? "inativo" : "ativo";
    const next = employees.map((item) => item.id === employee.id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
    await persist(next, status === "ativo" ? "Funcionário reativado." : "Funcionário inativado.");
  }

  async function removeEmployee(employee: Employee) {
    if (deleting || !window.confirm(`Excluir definitivamente ${employee.name} (matrícula ${employee.registration}) da Equipe?\n\nO cadastro será removido do banco de dados e o acesso ao site será encerrado. O histórico de vendas importadas será preservado. Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setNotice(null);
    try {
      await deleteEmployee(employee.id);
      setEmployees(loadEmployees());
      if (editingId === employee.id) { setFormOpen(false); setEditingId(null); }
      setNotice({ kind: "success", text: "Funcionário excluído." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível excluir o funcionário." });
    } finally { setDeleting(false); }
  }

  return <div className="team-page">
    <section className="team-summary" aria-label="Resumo da equipe">
      <div className="panel team-summary-card"><span>Cadastrados</span><strong>{employees.length}</strong><Users size={21}/></div>
      <div className="panel team-summary-card"><span>Ativos</span><strong>{activeCount}</strong><UserCheck size={21}/></div>
      <div className="panel team-summary-card"><span>Sem vínculo BI</span><strong>{withoutBi}</strong><Link2 size={21}/></div>
    </section>

    {notice && <div className={`team-notice ${notice.kind}`} role="status" aria-live="polite">{notice.kind === "success" && <CheckCircle2 size={18}/>}<span>{notice.text}</span></div>}

    <section className="panel team-list-panel" aria-labelledby="team-list-title">
      <div className="team-list-header"><div><span className="panel-kicker">PESSOAS</span><h2 id="team-list-title">Funcionários</h2><p>Cadastre, edite e gerencie o acesso da equipe.</p></div></div>

      {formOpen && <form className="team-form" onSubmit={submit} noValidate>
        <div className="team-form-heading"><div><h3>{editingId ? "Editar funcionário" : "Novo funcionário"}</h3><p>Preencha os dados do colaborador.</p></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário"><X size={19}/></button></div>
        <div className="team-form-grid">
          <div className="form-field team-field-wide"><label htmlFor="team-name">Nome completo</label><input id="team-name" className="form-control" value={form.name} onChange={(e) => change("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "team-name-error" : undefined}/>{errors.name && <span id="team-name-error" className="form-error">{errors.name}</span>}</div>
          <div className="form-field"><label htmlFor="team-registration">Matrícula / código</label><input id="team-registration" className="form-control" value={form.registration} onChange={(e) => change("registration", e.target.value)} aria-invalid={!!errors.registration} aria-describedby={errors.registration ? "team-registration-error" : undefined}/>{errors.registration && <span id="team-registration-error" className="form-error">{errors.registration}</span>}</div>
          <div className="form-field"><label htmlFor="team-bi">Identificador no BI <span className="optional">(opcional)</span></label><input id="team-bi" className="form-control" value={form.biIdentifier} onChange={(e) => change("biIdentifier", e.target.value)} aria-invalid={!!errors.biIdentifier} aria-describedby={errors.biIdentifier ? "team-bi-error" : "team-bi-help"}/>{errors.biIdentifier ? <span id="team-bi-error" className="form-error">{errors.biIdentifier}</span> : <span id="team-bi-help" className="form-help">Use o código que identifica este funcionário no BI.</span>}</div>
          <div className="form-field"><label htmlFor="team-role">Cargo</label><input id="team-role" className="form-control" value={form.jobTitle ?? ""} onChange={(e) => change("jobTitle", e.target.value)} aria-invalid={!!errors.jobTitle}/>{errors.jobTitle && <span className="form-error">{errors.jobTitle}</span>}</div>
          <div className="form-field"><label htmlFor="team-hired">Data de admissão</label><TeamDatePicker id="team-hired" value={form.hiredAt} onChange={(value) => change("hiredAt", value)} label="Data de admissão" invalid={!!errors.hiredAt}/>{errors.hiredAt && <span id="team-hired-error" className="form-error">{errors.hiredAt}</span>}</div>
          <div className="form-field"><label htmlFor="team-status">Status</label><label className="team-status-toggle"><input id="team-status" type="checkbox" role="switch" aria-label="Funcionário ativo" checked={form.status === "ativo"} onChange={(e) => change("status", e.target.checked ? "ativo" : "inativo")}/><span aria-hidden="true"/></label></div>
        </div>
        <div className="team-form-actions"><button type="button" className="button button-neutral" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="button button-primary">{editingId ? "Salvar alterações" : "Cadastrar funcionário"}</button></div>
      </form>}

      <div className="team-filters"><div className="form-field"><label htmlFor="filter-role">Cargo</label><select id="filter-role" className="form-control" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="todos">Todos os cargos</option>{jobTitles.map((title) => <option key={title} value={title}>{title}</option>)}</select></div><div className="form-field"><label htmlFor="filter-status">Status</label><select id="filter-status" className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | "todos")}><option value="todos">Todos os status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div><span className="team-filter-count">{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</span></div>

    </section>

      {!loaded ? <p className="panel team-empty">Carregando equipe…</p> : filtered.length === 0 ? <div className="panel team-empty"><Users size={25}/><strong>{employees.length ? "Nenhum funcionário neste filtro" : "Nenhum funcionário cadastrado"}</strong><p>{employees.length ? "Altere os filtros para ver outros colaboradores." : "Cole os dados do BI abaixo para cadastrar os colaboradores."}</p></div> : jobTitles.map((role) => {
        const group = filtered.filter((employee) => (employee.jobTitle || employee.role) === role).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        if (!group.length) return null;
        return <section className="panel team-group" key={role} aria-label={`Equipe: ${role}`}><div className="team-group-heading"><h3>{role}</h3><span>{group.length} {group.length === 1 ? "pessoa" : "pessoas"}</span></div><div className="table-scroll" tabIndex={0} role="region" aria-label={`Funcionários do cargo ${role}`}><table className="team-table"><thead><tr><th scope="col">Nome</th><th scope="col">Matrícula</th><th scope="col">Admissão</th><th scope="col">Ativo</th>{canDelete && <th scope="col">Excluir</th>}</tr></thead><tbody>{group.map((employee) => <tr key={employee.id}><th scope="row"><button type="button" className="team-name-edit" onClick={() => openEdit(employee)} aria-label={`Editar ${employee.name}`}>{employee.name}</button></th><td>{employee.registration}</td><td>{formatDate(employee.hiredAt)}</td><td><label className="team-status-toggle"><input type="checkbox" role="switch" checked={employee.status === "ativo"} onChange={() => toggleStatus(employee)} aria-label={`${employee.status === "ativo" ? "Desativar" : "Ativar"} ${employee.name}`}/><span aria-hidden="true"/></label></td>{canDelete && <td><button type="button" className="team-delete-employee" onClick={() => removeEmployee(employee)} disabled={deleting} aria-label={`Excluir ${employee.name}, matrícula ${employee.registration}`} title="Excluir funcionário"><Trash2 size={18} aria-hidden="true"/></button></td>}</tr>)}</tbody></table></div><p className="table-scroll-hint">Deslize para ver todas as colunas →</p></section>;
      })}

    <section className="panel bi-reconciliation" aria-labelledby="bi-reconciliation-title">
      <div className="panel-heading"><div><span className="panel-kicker">EQUIPE</span><h2 id="bi-reconciliation-title">Cadastrar a partir do BI</h2><p>Cole as colunas Matrícula, Nome, Cargo e Data Admissão. Confira os dados antes de salvar.</p></div></div>
      <div className="bi-check-controls"><div className="form-field"><label htmlFor="bi-identifiers">Dados de funcionários</label><textarea id="bi-identifiers" className="form-control" rows={6} value={biText} onChange={(e) => { setBiText(e.target.value); setRoster([]); setRosterErrors([]); }} placeholder={"Matrícula\tNome\tCargo\tData Admissão\n302981\tGUSTAVO DE JESUS COSTA\tBALC. MEDICAMENTO\t23/11/2017"}/></div><button className="button button-secondary" type="button" onClick={inspectRoster} disabled={!biText.trim()}>Revisar cadastro</button></div>
      {rosterErrors.length > 0 && <div className="bi-results" role="alert"><strong>{rosterErrors.length} linhas precisam de correção no texto colado.</strong><ul>{rosterErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      {roster.length > 0 && <div className="team-roster-review">
        <div className="team-roster-heading"><strong>{roster.length} {roster.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}</strong><span>O cargo será salvo exatamente como aparece no arquivo.</span></div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Revisão dos funcionários colados"><table className="team-roster-table"><thead><tr><th>Incluir</th><th>Matrícula</th><th>Nome</th><th>Cargo no arquivo</th><th>Admissão</th><th>ID no BI</th><th>Status</th></tr></thead><tbody>{roster.map((row, index) => <tr key={`${row.registration}-${index}`}><td><input type="checkbox" checked={row.include} onChange={(event) => updateRoster(index, { include: event.target.checked })} aria-label={`Incluir ${row.name}`}/></td><td><input className="form-control" value={row.registration} onChange={(event) => updateRoster(index, { registration: event.target.value })} aria-label={`Matrícula de ${row.name}`}/></td><td><input className="form-control" value={row.name} onChange={(event) => updateRoster(index, { name: event.target.value })} aria-label={`Nome de ${row.registration}`}/></td><td>{row.sourceRole}</td><td><TeamDatePicker value={row.hiredAt} onChange={(value) => updateRoster(index, { hiredAt: value })} label={`Admissão de ${row.name}`}/></td><td><input className="form-control" value={row.biIdentifier} onChange={(event) => updateRoster(index, { biIdentifier: event.target.value })} aria-label={`Identificador BI de ${row.name}`}/></td><td><label className="team-status-toggle"><input type="checkbox" role="switch" checked={row.status === "ativo"} onChange={(event) => updateRoster(index, { status: event.target.checked ? "ativo" : "inativo" })} aria-label={`${row.status === "ativo" ? "Desativar" : "Ativar"} ${row.name}`}/><span aria-hidden="true"/></label></td></tr>)}</tbody></table></div>
        <div className="team-form-actions"><button type="button" className="button button-primary" onClick={saveRoster}>Salvar funcionários na Equipe</button></div>
      </div>}
    </section>
  </div>;
}
