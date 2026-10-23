"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import { Dialog as CalendarDialog } from "radix-ui";

const fromIso = (value: string) => value ? new Date(`${value}T12:00:00`) : undefined;
const iso = (date?: Date) => date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` : "";
const short = (date?: Date) => date?.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }) ?? "—";

export function ImportDayPicker({ value, onChange }: { value:string; onChange:(value:string)=>void }) {
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<Date>();
  return <CalendarDialog.Root open={open} onOpenChange={next=>{setOpen(next);if(next)setDraft(fromIso(value));}}>
    <CalendarDialog.Trigger asChild><button id="bi-day-reference" type="button" className="form-control team-date-trigger bi-range-trigger" aria-label="Selecionar dia da importação"><CalendarDays size={20} aria-hidden="true"/><span>{fromIso(value)?.toLocaleDateString("pt-BR") ?? "Selecione uma data"}</span></button></CalendarDialog.Trigger>
    <CalendarDialog.Portal><CalendarDialog.Overlay className="bi-calendar-overlay"/><CalendarDialog.Content className="team-date-popover bi-range-popover" aria-describedby={undefined} aria-label="Calendário do dia">
      <div className="bi-range-header"><div className="bi-range-header-actions"><button type="button" aria-label="Fechar calendário" onClick={()=>setOpen(false)}><X size={20}/></button><button type="button" disabled={!draft} onClick={()=>{if(draft){onChange(iso(draft));setOpen(false);}}}>Aplicar</button></div><CalendarDialog.Title className="bi-calendar-title">DIA DA IMPORTAÇÃO</CalendarDialog.Title><strong>{draft?.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}) ?? "Escolha uma data"}</strong></div>
      <p className="bi-range-hint">Selecione o dia coberto pela planilha.</p>
      <DayPicker mode="single" selected={draft} onSelect={setDraft} defaultMonth={fromIso(value) ?? new Date()} locale={ptBR} captionLayout="dropdown" navLayout="around" startMonth={new Date(2020,0,1)} endMonth={new Date(new Date().getFullYear()+2,11,1)} showOutsideDays labels={{labelNext:()=>"Próximo mês",labelPrevious:()=>"Mês anterior",labelMonthDropdown:()=>"Escolher mês",labelYearDropdown:()=>"Escolher ano"}}/>
      <div className="bi-range-footer"><button type="button" onClick={()=>setDraft(undefined)}>Limpar seleção</button><span>Uma data</span></div>
    </CalendarDialog.Content></CalendarDialog.Portal>
  </CalendarDialog.Root>;
}

export function PeriodPicker({ start, end, onChange }: { start:string; end:string; onChange:(start:string,end:string)=>void }) {
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<DateRange>();
  const complete = !!draft?.from && !!draft.to;
  const sameMonth = !complete || iso(draft.from).slice(0,7) === iso(draft.to).slice(0,7);
  const shown = start && end ? `${fromIso(start)!.toLocaleDateString("pt-BR")} a ${fromIso(end)!.toLocaleDateString("pt-BR")}` : "Selecione o início e o fim";

  return <CalendarDialog.Root open={open} onOpenChange={value=>{setOpen(value);if(value)setDraft(start ? {from:fromIso(start),to:fromIso(end)} : undefined);}}>
    <CalendarDialog.Trigger asChild><button id="bi-range-reference" type="button" className="form-control team-date-trigger bi-range-trigger" aria-label="Selecionar período da importação"><CalendarDays size={20} aria-hidden="true"/><span>{shown}</span></button></CalendarDialog.Trigger>
    <CalendarDialog.Portal><CalendarDialog.Overlay className="bi-calendar-overlay"/><CalendarDialog.Content className="team-date-popover bi-range-popover" aria-describedby={undefined} aria-label="Calendário do período">
      <div className="bi-range-header"><div className="bi-range-header-actions"><button type="button" aria-label="Fechar calendário" onClick={()=>setOpen(false)}><X size={20}/></button><button type="button" onClick={()=>{if(complete && sameMonth){onChange(iso(draft.from),iso(draft.to));setOpen(false);}}} disabled={!complete||!sameMonth}>Aplicar</button></div><CalendarDialog.Title className="bi-calendar-title">PERÍODO DA IMPORTAÇÃO</CalendarDialog.Title><strong>{short(draft?.from)} — {short(draft?.to)}</strong></div>
      <p className="bi-range-hint" aria-live="polite">{!sameMonth ? "Escolha datas do mesmo mês." : draft?.from && !draft.to ? "Agora selecione a data final." : "Selecione o primeiro e o último dia."}</p>
      <DayPicker mode="range" selected={draft} onSelect={(_range,day)=>setDraft(current=>!current?.from || current.to ? {from:day,to:undefined} : day < current.from ? {from:day,to:current.from} : {from:current.from,to:day})} defaultMonth={fromIso(start) ?? new Date()} locale={ptBR} captionLayout="dropdown" navLayout="around" startMonth={new Date(2020,0,1)} endMonth={new Date(new Date().getFullYear()+2,11,1)} showOutsideDays labels={{labelNext:()=>"Próximo mês",labelPrevious:()=>"Mês anterior",labelMonthDropdown:()=>"Escolher mês",labelYearDropdown:()=>"Escolher ano"}}/>
      <div className="bi-range-footer"><button type="button" onClick={()=>setDraft(undefined)}>Limpar seleção</button><span>Intervalo no mesmo mês</span></div>
    </CalendarDialog.Content></CalendarDialog.Portal>
  </CalendarDialog.Root>;
}
