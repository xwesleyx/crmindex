import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { cn } from "cn";
import { formatDate, formatTime } from "@/lib/format";
import { AgendaTaskTrigger } from "@/features/agenda/agenda-task-trigger";
import { AGENDA_CATEGORY_LABELS, type AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

const CATEGORY_TONE: Record<AgendaEvent["category"], BadgeTone> = {
  atendimento: "info",
  crm: "warning",
  instalacao: "success",
  geral: "neutral",
};

const ROW_CLASSNAME = "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted";

// Visão "Agenda" (lista agrupada por dia — o mesmo modelo da própria aba
// "Agenda" do Google Calendar, mais simples de entregar bem do que um grid
// mensal e já cobre o pedido: tudo que tem horário + responsável, num só
// lugar).
export function AgendaList({
  events,
  now,
  assignableUsers,
}: {
  events: AgendaEvent[];
  now: number;
  assignableUsers: AssignableUser[];
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nada agendado"
        description="Ajuste os filtros ou o período — ou não há compromissos por aqui."
      />
    );
  }

  const byDay = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const key = formatDate(event.when);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(event);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byDay.entries()].map(([day, dayEvents]) => (
        <section key={day} className="flex flex-col gap-1.5">
          <h3 className="sticky top-0 bg-background py-1 text-xs font-semibold text-muted-foreground uppercase">
            {day}
          </h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {dayEvents.map((event) => {
              const overdue = !event.done && event.when.getTime() < now;
              const content = (
                <>
                  <span
                    className={cn(
                      "w-12 shrink-0 tabular-nums",
                      overdue ? "font-medium text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {formatTime(event.when)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", event.done && "text-muted-foreground line-through")}>
                      {event.title}
                    </p>
                    {event.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{event.subtitle}</p>
                    )}
                  </div>
                  <StatusBadge
                    label={AGENDA_CATEGORY_LABELS[event.category]}
                    tone={CATEGORY_TONE[event.category]}
                    className="shrink-0 text-[10px]"
                  />
                  <span className="w-28 shrink-0 truncate text-right text-xs text-muted-foreground">
                    {event.responsibleName ?? "Sem responsável"}
                  </span>
                </>
              );
              // Tarefa "Geral" não tem registro dono pra abrir (o href dela
              // aponta pra própria Agenda) — em vez de um link que não leva a
              // lugar nenhum, abre o pop-up de editar/concluir.
              const isGeneralTask = event.source === "task" && event.category === "geral";
              return (
                <li key={event.id}>
                  {isGeneralTask ? (
                    <AgendaTaskTrigger
                      taskId={event.id.replace(/^task:/, "")}
                      assignableUsers={assignableUsers}
                      className={ROW_CLASSNAME}
                    >
                      {content}
                    </AgendaTaskTrigger>
                  ) : (
                    <Link href={event.href} className={ROW_CLASSNAME}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
