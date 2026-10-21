"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type TeamDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  invalid?: boolean;
};

function selectedDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

export function TeamDatePicker({ value, onChange, label, id, invalid }: TeamDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = selectedDate(value);
  const shown = selected ? selected.toLocaleDateString("pt-BR") : "dd/mm/aaaa";

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button id={id} type="button" className="form-control team-date-trigger" aria-label={label} data-invalid={invalid || undefined} aria-haspopup="dialog" aria-expanded={open}><span>{shown}</span><CalendarDays size={17} aria-hidden="true"/></button></PopoverTrigger>
    <PopoverContent className="team-date-popover" align="start" side="bottom" collisionPadding={12}>
      <DayPicker
        mode="single"
        selected={selected}
        defaultMonth={selected ?? new Date()}
        locale={ptBR}
        captionLayout="dropdown"
        navLayout="around"
        startMonth={new Date(1950, 0, 1)}
        endMonth={new Date(new Date().getFullYear() + 1, 11, 1)}
        showOutsideDays
        onSelect={(date) => {
          if (!date) return;
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          onChange(iso);
          setOpen(false);
        }}
      />
    </PopoverContent>
  </Popover>;
}
