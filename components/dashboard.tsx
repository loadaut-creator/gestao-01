"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { TeamPage } from "@/components/team/team-page";
import { GoalsPage } from "@/components/goals/goals-page";
import { ImportPage } from "@/components/bi/import-page";
import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { subscribeToImports } from "@/lib/bi/repository";
import { findEmployeeForSeller, type ImportRecord } from "@/lib/bi/model";
import { ROLES, isSalesRole, type Employee, type Role } from "@/lib/team/model";
import { loadEmployees, subscribeToEmployeeChanges } from "@/lib/team/repository";
import { Activity, ArrowRight, ArrowUpRight, Award, BarChart3, CalendarDays, ChevronDown, CircleHelp, ClipboardList, FileBarChart2, Flag, Gift, LayoutDashboard, Menu, Settings2, Target, UploadCloud, Users, X } from "lucide-react";

export const pageKeys = ["inicio", "vendas", "metas", "campanhas", "rankings", "equipe", "importacao-bi", "relatorios", "configuracoes"] as const;
type Page = (typeof pageKeys)[number];

const navigation = [
  { key: "inicio", label: "Início", icon: LayoutDashboard },
  { key: "vendas", label: "Vendas", icon: BarChart3 },
  { key: "metas", label: "Metas", icon: Target },
  { key: "campanhas", label: "Campanhas", icon: Gift },
  { key: "rankings", label: "Rankings", icon: Award },
  { key: "equipe", label: "Equipe", icon: Users },
  { key: "importacao-bi", label: "Importação BI", icon: UploadCloud },
  { key: "relatorios", label: "Relatórios", icon: FileBarChart2 },
  { key: "configuracoes", label: "Configurações", icon: Settings2 },
] as const;

const details: Record<Page, { title: string; description: string; icon: typeof LayoutDashboard; cards: { title: string; text: string; icon: typeof LayoutDashboard }[] }> = {
  inicio: { title: "Visão geral", description: "Acompanhe os indicadores que movem sua operação.", icon: LayoutDashboard, cards: [] },
  vendas: { title: "Vendas", description: "Uma visão dedicada ao desempenho comercial da loja.", icon: BarChart3, cards: [
    { title: "Indicadores de vendas", text: "Resumo de vendas diárias e mensais com filtros por período.", icon: Activity },
    { title: "Desempenho por setor", text: "Comparativos entre perfumaria, balcão e caixa.", icon: BarChart3 },
    { title: "Evolução comercial", text: "Gráficos para observar tendências após a importação BI.", icon: ArrowUpRight },
  ] },
  metas: { title: "Metas", description: "Planejamento de metas da loja, setores e pessoas.", icon: Target, cards: [
    { title: "Meta mensal", text: "Distribuição planejada entre loja e setores.", icon: Target },
    { title: "Meta diária", text: "Acompanhamento visual das metas por dia.", icon: CalendarDays },
    { title: "Dia D", text: "Área reservada para eventos comerciais com meta específica.", icon: Flag },
  ] },
  campanhas: { title: "Campanhas", description: "Organize as dinâmicas comerciais em um só lugar.", icon: Gift, cards: [
    { title: "Campanhas ativas", text: "Visão das campanhas em andamento e seus períodos.", icon: Gift },
    { title: "Regras e critérios", text: "Espaço para acompanhar objetivos, participantes e prêmios.", icon: ClipboardList },
    { title: "Resultados", text: "Leitura visual do andamento das campanhas.", icon: Activity },
  ] },
  rankings: { title: "Rankings", description: "Compare desempenhos de forma clara e objetiva.", icon: Award, cards: [
    { title: "Ranking geral", text: "Classificação da equipe conforme o período selecionado.", icon: Award },
    { title: "Por cargo e setor", text: "Visões específicas para comparar grupos equivalentes.", icon: Users },
    { title: "Campanhas e Dia D", text: "Classificações ligadas às dinâmicas comerciais.", icon: Flag },
  ] },
  equipe: { title: "Equipe", description: "Acompanhe a estrutura de pessoas da loja.", icon: Users, cards: [
    { title: "Funcionários", text: "Lista de colaboradores e informações principais.", icon: Users },
    { title: "Cargos e setores", text: "Organização da equipe por função e área.", icon: ClipboardList },
    { title: "Vínculo com BI", text: "Identificação dos colaboradores nos dados importados.", icon: Activity },
  ] },
  "importacao-bi": { title: "Importação BI", description: "Área exclusiva para entrada de arquivos exportados do BI.", icon: UploadCloud, cards: [
    { title: "Enviar arquivo", text: "Etapa futura para selecionar planilhas .xlsx ou .csv.", icon: UploadCloud },
    { title: "Mapear e validar", text: "Etapa futura para conferir colunas e inconsistências.", icon: ClipboardList },
    { title: "Histórico", text: "Espaço para consultar as importações concluídas.", icon: CalendarDays },
  ] },
  relatorios: { title: "Relatórios", description: "Consultas gerenciais para apoiar decisões.", icon: FileBarChart2, cards: [
    { title: "Vendas", text: "Consultas por período, setor e funcionário.", icon: BarChart3 },
    { title: "Metas e campanhas", text: "Visões de resultado e comparativos.", icon: Target },
    { title: "Histórico", text: "Espaço reservado para relatórios anteriores.", icon: ClipboardList },
  ] },
  configuracoes: { title: "Configurações", description: "Preferências e administração da plataforma.", icon: Settings2, cards: [
    { title: "Dados da loja", text: "Informações e preferências da unidade.", icon: Settings2 },
    { title: "Perfis de acesso", text: "Área planejada para gerente e funcionários.", icon: Users },
    { title: "Segurança", text: "Configurações operacionais previstas para a etapa final.", icon: CircleHelp },
  ] },
};

function href(key: Page) { return key === "inicio" ? "/" : `/${key}`; }

function Sidebar({ page, close }: { page: Page; close: () => void }) {
  return <>
    <Link href="/" className="brand" onClick={close} aria-label="Visão 308, início"><span className="brand-mark"><Image src="/icon-diana.jpg" alt="" width={40} height={40}/></span><strong>Visão 308</strong></Link>
    <div className="sidebar-section">MENU PRINCIPAL</div>
    <nav className="nav-list" aria-label="Menu principal">{navigation.slice(0, 7).map(({ key, label, icon: Icon }) => <Link key={key} href={href(key)} className={`nav-item ${page === key ? "active" : ""}`} onClick={close} aria-current={page === key ? "page" : undefined}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
    <div className="sidebar-section sidebar-section-lower">SISTEMA</div>
    <nav className="nav-list" aria-label="Sistema">{navigation.slice(7).map(({ key, label, icon: Icon }) => <Link key={key} href={href(key)} className={`nav-item ${page === key ? "active" : ""}`} onClick={close} aria-current={page === key ? "page" : undefined}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
    <div className="sidebar-bottom"><div className="help-icon"><CircleHelp size={19}/></div><div><strong>Central de ajuda</strong><span>Suporte e orientações</span></div></div>
  </>;
}

function Header({ openMenu }: { openMenu: () => void }) {
  return <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={openMenu} aria-label="Abrir menu"><Menu size={22}/></button></div><div className="profile"><div className="avatar">G</div><div className="profile-text"><strong>Gerente da loja</strong><span>Administrador</span></div><ChevronDown size={16}/></div></header>;
}

function Intro({ page }: { page: Page }) {
  const item = details[page];
  return <div className="intro"><div><h1>{page === "inicio" ? <>Bom dia, <span>gerente.</span></> : item.title}</h1>{page !== "importacao-bi" && <p>{item.description}</p>}</div></div>;
}

function HomeContent() {
  const [latestImport, setLatestImport] = useState<ImportRecord | null | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState<Role | "Todos">("Todos");
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    let active = true;
    const stopImports = subscribeToImports((items) => setLatestImport(items.find((item) => item.periodKind === "day") ?? null), () => setLatestImport(null));
    queueMicrotask(() => { if (active) { try { setEmployees(loadEmployees()); } catch { setEmployees([]); } } });
    const unsubscribe = subscribeToEmployeeChanges(setEmployees);
    return () => { active = false; unsubscribe(); stopImports(); };
  }, []);
  const selectedColumns = latestImport?.displayColumns?.filter((column) => latestImport.columns.includes(column)) ?? [];
  const roleForRow = (row: ImportRecord["records"][number]) => {
    const employee = findEmployeeForSeller(row.seller, employees);
    return employee?.status === "ativo" && isSalesRole(employee.role) ? employee.role : "Não definido";
  };
  const filteredRows = latestImport?.records.filter((row) => { const role = roleForRow(row); return row.sale > 0 && role !== "Não definido" && (roleFilter === "Todos" || role === roleFilter); }) ?? [];
  const filteredTotal = filteredRows.reduce((sum, row) => sum + row.sale, 0);
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const integer = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
  const numericColumns = latestImport ? [latestImport.mapping.sale, latestImport.mapping.clients, latestImport.mapping.ticket, latestImport.mapping.genSim, latestImport.mapping.mp, latestImport.mapping.clientPremium] : [];
  const displayValue = (row: ImportRecord["records"][number], column: string) => {
    if (!latestImport) return row.raw[column] || "—";
    const { mapping } = latestImport;
    if (column === mapping.sale) return money(row.sale);
    if (column === mapping.clients) return row.clients === null ? "—" : integer(row.clients);
    if (column === mapping.ticket) return row.ticket === null ? "—" : money(row.ticket);
    if (column === mapping.genSim) return row.genSim === null ? "—" : money(row.genSim);
    if (column === mapping.mp) return row.mp === null ? "—" : money(row.mp);
    if (column === mapping.clientPremium) return row.clientPremium === null ? "—" : `${row.clientPremium}%`;
    return row.raw[column] || "—";
  };
  return <>
    {latestImport === undefined ? <section className="panel"><p>Carregando vendas…</p></section> : latestImport ? <>
      <section className="panel today-total"><div><span className="panel-kicker">DADOS IMPORTADOS</span><h2>Vendas até o momento</h2></div><strong>{money(latestImport.totalSale)}</strong></section>
      <section className="panel imported-sales-panel">
        <div className="panel-heading"><div><span className="panel-kicker">VENDEDORES</span><h2>Vendas diárias</h2><p>Colunas escolhidas na importação diária mais recente.</p></div></div>
        <div className="imported-role-filters" role="group" aria-label="Filtrar vendas por cargo">{(["Todos", ...ROLES] as const).map((role) => <button type="button" key={role} className={roleFilter === role ? "active" : ""} aria-pressed={roleFilter === role} onClick={() => setRoleFilter(role)}>{role}</button>)}</div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de vendas importadas"><table className="imported-sales-table"><thead><tr>{selectedColumns.map((column) => <th scope="col" className={numericColumns.includes(column) ? "numeric" : ""} key={column}>{column === latestImport.mapping.sale ? "Totais" : column}</th>)}<th scope="col">Cargo</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.sourceRow}>{selectedColumns.map((column) => <td className={numericColumns.includes(column) ? "numeric" : ""} key={column}>{displayValue(row, column)}</td>)}<td>{roleForRow(row)}</td></tr>)}</tbody></table>{filteredRows.length === 0 && <p className="imported-sales-empty">Nenhum vendedor nesta classificação.</p>}</div>
        <div className="imported-sales-total"><span>{roleFilter === "Todos" ? "Total dos vendedores" : `Total — ${roleFilter}`}</span><strong>{money(filteredTotal)}</strong></div>
      </section>
    </> : <section className="panel imported-sales-empty"><h2>Vendas diárias</h2><p>Nenhuma importação diária confirmada.</p><Link href="/importacao-bi" className="button button-primary">Importar vendas diárias</Link></section>}
    <section className="panel activity-panel home-activity"><div className="panel-heading"><div><span className="panel-kicker">EM FOCO</span><h2>Operação comercial</h2></div></div><div className="focus-items"><div className="focus-row"><div className="focus-icon"><Flag size={18}/></div><div><strong>Meta Dia D</strong><span>Área reservada para evento ativo</span></div><span className="coming">Em breve</span></div><div className="focus-row"><div className="focus-icon"><Gift size={18}/></div><div><strong>Campanhas ativas</strong><span>Acompanhamento de campanhas</span></div><Link href="/campanhas" aria-label="Ver campanhas"><ArrowRight size={18}/></Link></div><div className="focus-row"><div className="focus-icon"><Award size={18}/></div><div><strong>Ranking resumido</strong><span>Visão rápida da equipe</span></div><Link href="/rankings" aria-label="Ver rankings"><ArrowRight size={18}/></Link></div></div></section>
    {latestImport && <p className="data-note">O total usa todas as linhas da importação diária mais recente; a tabela mostra funcionários ativos com venda acima de zero classificados como Caixa, Balconista ou Perfumista.</p>}
  </>;
}

function SectionContent({ page }: { page: Page }) {
  const item = details[page]; const Icon = item.icon;
  return <><div className="section-banner"><div className="banner-icon"><Icon size={27}/></div><div><span>ESTRUTURA DA PÁGINA</span><h2>{item.title}</h2><p>Esta área está preparada visualmente para as funcionalidades do bloco correspondente.</p></div><span className="banner-tag">Bloco 01</span></div><div className="section-card-grid">{item.cards.map(({title,text,icon:CardIcon})=><article className="feature-card" key={title}><div className="feature-icon"><CardIcon size={22}/></div><h3>{title}</h3><p>{text}</p><div className="feature-footer"><span>Planejado para próxima etapa</span><ArrowRight size={17}/></div></article>)}</div><div className="section-bottom panel"><div className="section-bottom-icon"><ClipboardList size={21}/></div><div><strong>Próximos passos desta área</strong><p>As regras, cadastros, filtros e integração de dados serão adicionados no bloco específico, após sua aprovação.</p></div></div></>;
}

export function Dashboard({ page }: { page: Page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? "open" : ""}`}><button className="mobile-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={22}/></button><Sidebar page={page} close={() => setMenuOpen(false)}/></aside>{menuOpen && <button className="menu-overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}<div className="workspace"><Header openMenu={() => setMenuOpen(true)}/><main className="content"><Intro page={page}/>{page === "inicio" ? <HomeContent/> : page === "vendas" ? <SalesDashboard/> : page === "metas" ? <GoalsPage/> : page === "equipe" ? <TeamPage/> : page === "importacao-bi" ? <ImportPage/> : <SectionContent page={page}/>}</main></div></div>;
}
