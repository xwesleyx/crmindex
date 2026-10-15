"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, addWeeks, format, isToday, parseISO, setHours, setMinutes, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { AgendaDatePicker } from "@/features/agenda/agenda-date-picker";
import { AgendaDndProvider, AgendaDropArea, AgendaEventCard, dayDropId } from "@/features/agenda/agenda-dnd";
import type { AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

// Visão "Semana": um quadro com uma coluna por dia (segunda a domingo) e os
// compromissos daquele dia embaixo, por horário. Arrastar uma tarefa pra
// outra coluna muda o dia (mantém o horário); o "+" cria tarefa naquele dia.
export function AgendaWeekBoard({
  weekDate,
  events,
  assignableUsers,
  currentUserId,
}: {
  weekDate: string;
  events: AgendaEvent[];
  assignableUsers: AssignableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createAt, setCreateAt] = useState<Date | null>(null);

  const weekStart = startOfWeek(parseISO(weekDate), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  const eventsByDay = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const key = format(event.when, "yyyy-MM-dd");
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  function goTo(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "semana");
    params.set("weekDate", format(date, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => goTo(addWeeks(weekStart, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => goTo(new Date())}>
            Esta semana
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => goTo(addWeeks(weekStart, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <AgendaDatePicker
            value={format(weekStart, "yyyy-MM-dd")}
            onSelect={(date) => goTo(parseISO(date))}
            title="Ver a semana de uma data"
          />
          <p className="text-sm font-medium">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} – {format(weekEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      <AgendaDndProvider>
        <div className="themed-scrollbar flex gap-2.5 overflow-x-auto pb-2">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const today = isToday(day);
            return (
              <section
                key={key}
                className={cn(
                  "flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border xl:w-auto xl:min-w-0 xl:flex-1",
                  today ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40"
                )}
              >
                <header className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
                  <span className="flex flex-col">
                    <span className={cn("text-sm font-semibold capitalize", today && "text-primary")}>
                      {format(day, "EEEE", { locale: ptBR }).replace("-feira", "")}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {today ? "Hoje · " : ""}
                      {format(day, "dd/MM")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                      {dayEvents.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="Nova tarefa neste dia"
                      onClick={() => setCreateAt(setMinutes(setHours(day, 9), 0))}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </span>
                </header>
                <AgendaDropArea
                  id={dayDropId(key)}
                  className="flex min-h-40 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition-colors"
                >
                  {dayEvents.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground/70">Livre</p>
                  ) : (
                    dayEvents.map((event) => (
                      <AgendaEventCard key={event.id} event={event} assignableUsers={assignableUsers} />
                    ))
                  )}
                </AgendaDropArea>
              </section>
            );
          })}
        </div>
      </AgendaDndProvider>

      <TaskFormDialog
        mode="create"
        entityType="General"
        entityId={currentUserId}
        assignableUsers={assignableUsers}
        defaultDueAt={createAt ?? undefined}
        open={createAt !== null}
        onOpenChange={(open) => {
          if (!open) setCreateAt(null);
        }}
      />
    </div>
  );
}
