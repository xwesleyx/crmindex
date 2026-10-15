"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AgendaDatePicker } from "@/features/agenda/agenda-date-picker";

// Barra da Lista: por padrão mostra "próximos N dias"; escolhendo uma data
// no ícone de calendário, mostra só aquele dia (com botão pra voltar).
export function AgendaListDateBar({ listDate, days }: { listDate: string | null; days: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setListDate(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "lista");
    if (value) params.set("listDate", value);
    else params.delete("listDate");
    router.push(`/agenda?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {listDate && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setListDate(null)}>
          <X className="size-3.5" />
          Voltar para os próximos {days} dias
        </Button>
      )}
      <AgendaDatePicker
        value={listDate ?? format(new Date(), "yyyy-MM-dd")}
        onSelect={setListDate}
        title="Ver a agenda de um dia"
      />
      <p className="text-sm font-medium capitalize">
        {listDate ? format(parseISO(listDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : `Próximos ${days} dias`}
      </p>
    </div>
  );
}
