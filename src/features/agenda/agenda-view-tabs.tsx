"use client";

import { Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "cn";
import { setAgendaDefaultView } from "@/features/agenda/actions";
import { AGENDA_VIEWS, type AgendaView } from "@/features/agenda/schema";

const VIEW_LABELS: Record<AgendaView, string> = {
  lista: "Lista",
  grade: "Grade",
  semana: "Semana",
  calendario: "Calendário",
};

// Abas de visão da Agenda. A estrela de cada aba marca a visão padrão da
// pessoa (a que abre ao entrar na Agenda); clicar na estrela já marcada
// tira o padrão (volta à Lista).
export function AgendaViewTabs({ view, defaultView }: { view: AgendaView; defaultView: AgendaView | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setView(next: AgendaView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.push(`/agenda?${params.toString()}`);
  }

  function toggleDefault(next: AgendaView) {
    const value = defaultView === next ? null : next;
    startTransition(async () => {
      const result = await setAgendaDefaultView(value);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? `"${VIEW_LABELS[next]}" é sua visão padrão` : "Visão padrão removida", {
        description: value
          ? "A Agenda vai abrir sempre nesta visão."
          : "A Agenda volta a abrir na Lista.",
      });
      router.refresh();
    });
  }

  return (
    <div role="tablist" className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {AGENDA_VIEWS.map((option) => {
        const active = option === view;
        const isDefault = option === defaultView;
        return (
          <div
            key={option}
            className={cn(
              "flex items-center rounded-md transition-colors",
              active ? "bg-background shadow-sm" : "hover:bg-background/60"
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(option)}
              className={cn(
                "py-1 pr-1 pl-3 text-sm font-medium",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {VIEW_LABELS[option]}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => toggleDefault(option)}
              title={isDefault ? "Visão padrão — clique para remover" : "Tornar esta a visão padrão"}
              aria-label={isDefault ? `Remover ${VIEW_LABELS[option]} como padrão` : `Tornar ${VIEW_LABELS[option]} a visão padrão`}
              aria-pressed={isDefault}
              className="rounded p-1 pr-2 disabled:opacity-50"
            >
              <Star
                className={cn(
                  "size-3.5 transition-colors",
                  isDefault ? "fill-warning text-warning" : "text-muted-foreground/50 hover:text-warning"
                )}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
