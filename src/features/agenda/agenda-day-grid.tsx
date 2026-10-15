"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, format, parseISO, setHours, setMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { AgendaDatePicker } from "@/features/agenda/agenda-date-picker";
import { AgendaDndProvider, AgendaDropArea, AgendaEventCard, slotDropId } from "@/features/agenda/agenda-dnd";
import type { AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;

// Visão "Grade" (pedido: "um grid na agenda com os horários para só clicar
// nele e acrescentar uma nova tarefa") — um dia por vez, horário comercial
// (06h-22h); o "+" de cada linha já abre a nova tarefa com aquele horário
// preenchido. Arrastar uma tarefa pra outra linha muda a hora.
export function AgendaDayGrid({
  date,
  events,
  assignableUsers,
  currentUserId,
}: {
  date: string;
  events: AgendaEvent[];
  assignableUsers: AssignableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createAt, setCreateAt] = useState<Date | null>(null);

  const day = startOfDay(parseISO(date));
  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);

  function goTo(nextDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gridDate", format(nextDate, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => goTo(addDays(day, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => goTo(new Date())}>
            Hoje
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => goTo(addDays(day, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <AgendaDatePicker value={date} onSelect={(next) => goTo(parseISO(next))} title="Ver a agenda de um dia" />
          <p className="text-sm font-medium capitalize">{format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>
      </div>

      <AgendaDndProvider>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {hours.map((hour) => {
            const hourEvents = events.filter((event) => event.when.getHours() === hour);
            const slotStart = setMinutes(setHours(day, hour), 0);
            return (
              <AgendaDropArea
                key={hour}
                id={slotDropId(date, hour)}
                className="flex items-start gap-3 px-3 py-2 transition-colors"
              >
                <span className="w-12 shrink-0 pt-1 text-xs text-muted-foreground tabular-nums">
                  {String(hour).padStart(2, "0")}:00
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                  {hourEvents.map((event) => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      assignableUsers={assignableUsers}
                      className="w-full sm:w-72"
                    />
                  ))}
                  {hourEvents.length === 0 && <span className="pt-1 text-xs text-muted-foreground/50">Livre</span>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  title="Nova tarefa neste horário"
                  onClick={() => setCreateAt(slotStart)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </AgendaDropArea>
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
