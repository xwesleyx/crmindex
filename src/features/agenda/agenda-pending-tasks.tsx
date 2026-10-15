"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { toggleTaskStatus } from "@/features/tasks/actions";
import { AgendaTaskTrigger } from "@/features/agenda/agenda-task-trigger";
import { AGENDA_CATEGORY_LABELS, type AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

const CATEGORY_TONE: Record<AgendaEvent["category"], BadgeTone> = {
  atendimento: "info",
  crm: "warning",
  instalacao: "success",
  geral: "neutral",
};

// "os atendimentos não concluídos dele sejam listados em algum lugar até
// serem concluídos" — fica só na visão Lista (pedido explícito). Cada linha
// tem um checkbox pra marcar como concluída direto daqui (sem isso, uma
// tarefa "Geral" — sem entidade própria pra abrir — não teria como ser
// finalizada a partir da Agenda).
export function AgendaPendingTasks({
  events,
  assignableUsers,
}: {
  events: AgendaEvent[];
  assignableUsers: AssignableUser[];
}) {
  const [items, setItems] = useState(events);
  const [prevEvents, setPrevEvents] = useState(events);
  if (events !== prevEvents) {
    setPrevEvents(events);
    setItems(events);
  }

  if (items.length === 0) return null;

  async function handleComplete(event: AgendaEvent) {
    const taskId = event.id.replace(/^task:/, "");
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== event.id));

    const result = await toggleTaskStatus(taskId);
    if (!result.success) {
      toast.error(result.error);
      setItems(previous);
      return;
    }
    toast.success("Tarefa concluída.", result.info ? { description: result.info } : undefined);
  }

  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase dark:text-amber-400">
        <AlertTriangle className="size-3.5" />
        Pendentes ({items.length})
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((event) => (
          <li key={event.id} className="flex items-center gap-3 py-2 first:pt-1 last:pb-1">
            <Checkbox checked={false} onCheckedChange={() => handleComplete(event)} />
            {event.category === "geral" ? (
              <AgendaTaskTrigger
                taskId={event.id.replace(/^task:/, "")}
                assignableUsers={assignableUsers}
                className="min-w-0 flex-1 text-left hover:underline"
              >
                <p className="truncate text-sm font-medium">{event.title}</p>
                {event.subtitle && <p className="truncate text-xs text-muted-foreground">{event.subtitle}</p>}
              </AgendaTaskTrigger>
            ) : (
              <Link href={event.href} className="min-w-0 flex-1 hover:underline">
                <p className="truncate text-sm font-medium">{event.title}</p>
                {event.subtitle && <p className="truncate text-xs text-muted-foreground">{event.subtitle}</p>}
              </Link>
            )}
            <StatusBadge
              label={AGENDA_CATEGORY_LABELS[event.category]}
              tone={CATEGORY_TONE[event.category]}
              className="shrink-0 text-[10px]"
            />
            <span className="w-28 shrink-0 truncate text-right text-xs font-medium text-destructive">
              {event.dueAt ? `Atrasado — ${formatDate(event.dueAt)}` : "Sem prazo"}
            </span>
            <span className="w-24 shrink-0 truncate text-right text-xs text-muted-foreground">
              {event.responsibleName ?? "Sem responsável"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
