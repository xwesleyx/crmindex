"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

// Ícone de calendário ao lado da data nas abas da Agenda: abre o seletor de
// data do navegador e devolve "yyyy-MM-dd" — cada aba decide o que mostrar
// (Semana: a semana daquela data; nas outras, o dia).
export function AgendaDatePicker({
  value,
  onSelect,
  title = "Escolher data",
}: {
  value: string;
  onSelect: (date: string) => void;
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function open() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <span className="relative inline-flex">
      <Button type="button" variant="outline" size="icon-sm" title={title} aria-label={title} onClick={open}>
        <CalendarDays className="size-4" />
      </Button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => e.target.value && onSelect(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}
