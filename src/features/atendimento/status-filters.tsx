"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import type { ConversationFilterKey, ConversationSortKey } from "@/features/atendimento/types";

// "Sem responsável" e "Aguardando atendimento" saíram daqui (pedido do
// usuário) — conversas sem ninguém atendendo ficam na aba "Novas".
const STATUS_OPTIONS: { value: ConversationFilterKey; label: string; countKey: keyof AttendanceCounts }[] = [
  { value: "in_progress", label: "Em atendimento", countKey: "inProgress" },
  { value: "waiting_customer", label: "Aguardando cliente", countKey: "waitingCustomer" },
];

const SORT_OPTIONS: { value: ConversationSortKey; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "unread_first", label: "Não lidos primeiro" },
  { value: "waiting_first", label: "Aguardando atendimento primeiro" },
];

type AttendanceCounts = {
  unassigned: number;
  waitingInternal: number;
  inProgress: number;
  waitingCustomer: number;
};

// Grid de status (seção 4) + recolher (seção 7) + ordenação (seção 8). Fica
// dentro da sidebar de conversas, abaixo do "Todas/Não lidas/Minhas" — mesmo
// param `filter` da URL que aquelas abas já usam, só que aqui é sempre um
// dos 5 valores derivados de getConversationDisplayStatus (labels.ts).
export function AttendanceStatusFilters({
  counts,
  selectedId,
}: {
  counts: AttendanceCounts;
  selectedId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);
  // Status é independente da aba. Sem `status` na URL = todos marcados
  // (estado inicial); com `status` = lista do que foi escolhido.
  const statusParam = searchParams.get("status");
  const chosen = statusParam ? statusParam.split(",").filter(Boolean) : null;
  const activeSort = (searchParams.get("sort") as ConversationSortKey) ?? "recent";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "mine" || value === "recent") params.delete(key);
      else params.set(key, value);
    }
    const base = selectedId ? `/atendimento/${selectedId}` : "/atendimento";
    router.push(`${base}?${params.toString()}`);
  }

  // Estado inicial (nada clicado, todos marcados): clicar num → só ele.
  // Depois disso cada status funciona como caixa de marcar: clicar num
  // desmarcado soma ele; clicar num marcado tira só ele. Tirar o último
  // volta ao estado inicial (todos), pra lista nunca ficar sem status.
  function toggleStatus(value: ConversationFilterKey) {
    let next: string[];
    if (!chosen) next = [value];
    else if (chosen.includes(value)) next = chosen.filter((item) => item !== value);
    else next = [...chosen, value];
    updateParams({ status: next.length > 0 ? next.join(",") : null });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border p-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase"
      >
        Status
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      <div
        className={cn(
          "grid grid-cols-2 gap-1.5 overflow-hidden transition-all duration-150",
          !open && "grid-rows-[0fr] gap-0 opacity-0"
        )}
        style={{ display: open ? "grid" : "none" }}
      >
        {STATUS_OPTIONS.map((option) => {
          const isSelected = !chosen || chosen.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              title={
                !chosen
                  ? `Mostrar só "${option.label}"`
                  : isSelected
                    ? `Tirar "${option.label}" do filtro`
                    : `Incluir "${option.label}" no filtro`
              }
              onClick={() => toggleStatus(option.value)}
              className={cn(
                "flex h-8 items-center justify-between gap-1 rounded-[8px] border px-2 text-xs whitespace-nowrap transition-colors",
                isSelected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="truncate">{option.label}</span>
              <span className="shrink-0 tabular-nums opacity-70">{counts[option.countKey]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-xs text-muted-foreground">Ordenar por</span>
        <Select value={activeSort} onValueChange={(v) => updateParams({ sort: v })}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
