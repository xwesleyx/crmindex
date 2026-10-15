"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "cn";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { AgendaDatePicker } from "@/features/agenda/agenda-date-picker";
import {
  AgendaDndProvider,
  AgendaDropArea,
  AgendaEventCard,
  dayDropId,
} from "@/features/agenda/agenda-dnd";
import type { AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CATEGORY_DOT: Record<AgendaEvent["category"], string> = {
  atendimento: "bg-primary",
  crm: "bg-warning",
  instalacao: "bg-success",
  geral: "bg-muted-foreground",
};

// Visão "Calendário" (pedido: "uma outra visualização como se fosse um
// calendário mesmo grande, clicando na data em baixo aparece tudo o que tem
// pra fazer naquele dia") — mês inteiro em grid; o dia selecionado mostra a
// lista de compromissos logo abaixo, com opção de criar tarefa nesse dia.
export function AgendaMonthCalendar({
  month,
  selectedDate,
  events,
  assignableUsers,
  currentUserId,
}: {
  month: string;
  selectedDate: string;
  events: AgendaEvent[];
  assignableUsers: AssignableUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createAt, setCreateAt] = useState<Date | null>(null);

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selected = parseISO(selectedDate);

  const eventsByDay = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const key = format(event.when, "yyyy-MM-dd");
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  function goToMonth(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("calMonth", format(next, "yyyy-MM"));
    params.delete("calDate");
    router.push(`/agenda?${params.toString()}`);
  }

  function selectDay(day: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("calMonth", format(day, "yyyy-MM"));
    params.set("calDate", format(day, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  }

  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  return (
    <AgendaDndProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => goToMonth(subMonths(monthStart, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectDay(new Date())}
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => goToMonth(addMonths(monthStart, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <AgendaDatePicker
              value={selectedDate}
              onSelect={(date) => selectDay(parseISO(date))}
              title="Ver a agenda de um dia"
            />
            <p className="text-sm font-medium capitalize">{format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border sm:gap-px">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-muted px-0.5 py-1 text-center text-[10px] font-medium text-muted-foreground sm:px-1.5 sm:text-[11px]"
            >
              {label}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, monthStart);
            const active = isSameDay(day, selected);
            return (
              <AgendaDropArea
                key={key}
                id={dayDropId(key)}
                className="relative bg-background"
                // Camada por cima do botão do dia (o botão cobria o destaque
                // antigo): mostra onde a tarefa vai cair se soltar ali.
                activeClassName="after:pointer-events-none after:absolute after:inset-0.5 after:z-10 after:flex after:items-end after:justify-center after:rounded-md after:border-2 after:border-primary after:bg-primary/20 after:pb-1 after:text-[10px] after:font-semibold after:text-primary after:content-['Soltar_aqui']"
              >
                <button
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "flex h-full min-h-14 w-full flex-col items-start gap-1 bg-background p-1 text-left transition-colors hover:bg-muted sm:min-h-16 sm:p-1.5",
                    !inMonth && "text-muted-foreground/50",
                    active && "bg-primary/10 hover:bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs",
                      isToday(day) && "bg-primary text-primary-foreground",
                      active && !isToday(day) && "font-semibold text-primary",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="flex flex-wrap gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "size-1.5 rounded-full",
                            CATEGORY_DOT[event.category],
                          )}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </AgendaDropArea>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium capitalize">
              {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateAt(setMinutes(setHours(selected, 9), 0))}
            >
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          </div>

          {selectedEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nada nesse dia"
              description="Sem compromissos para a data selecionada."
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Arraste uma tarefa até outro dia do calendário para reagendar.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {selectedEvents.map((event) => (
                  <AgendaEventCard
                    key={event.id}
                    event={event}
                    assignableUsers={assignableUsers}
                  />
                ))}
              </div>
            </>
          )}
        </div>

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
    </AgendaDndProvider>
  );
}
