"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Repeat } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { cn } from "cn";
import { formatTime } from "@/lib/format";
import { userColor } from "@/lib/user-color";
import { rescheduleTask, toggleTaskStatus } from "@/features/tasks/actions";
import { AgendaTaskTrigger } from "@/features/agenda/agenda-task-trigger";
import { AGENDA_CATEGORY_LABELS, agendaEventEnd, type AgendaEvent } from "@/features/agenda/types";
import type { AssignableUser } from "@/features/leads/types";

export const CATEGORY_TONE: Record<AgendaEvent["category"], BadgeTone> = {
  atendimento: "info",
  crm: "warning",
  instalacao: "success",
  geral: "neutral",
};

// Alvos de soltar: "day:yyyy-MM-dd" (troca o dia, mantém o horário) ou
// "slot:yyyy-MM-dd:HH" (Grade: troca dia e hora, mantém os minutos).
export function dayDropId(day: string) {
  return `day:${day}`;
}
export function slotDropId(day: string, hour: number) {
  return `slot:${day}:${String(hour).padStart(2, "0")}`;
}

function targetDate(dropId: string, original: Date): Date | null {
  const [kind, day, hour] = dropId.split(":");
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(original);
  next.setFullYear(y, m - 1, d);
  if (kind === "slot" && hour) next.setHours(Number(hour));
  else if (kind !== "day") return null;
  return next;
}

type DragData = { event: AgendaEvent };

// O alvo é o dia/horário que está sob o ponteiro do mouse (não o que
// encosta mais no card arrastado, que é bem mais largo que um dia do mês);
// fora de qualquer área, cai na interseção normal.
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

// Envolve uma visão da Agenda: só tarefas (fonte "task") podem ser
// arrastadas; instalação e próxima ação de lead se reagendam no próprio
// registro. Mesmo padrão do Kanban do CRM:
// - `id` fixo no DndContext: sem ele os ids de acessibilidade gerados pelo
//   dnd-kit diferem entre servidor e navegador (erro de hidratação);
// - DragOverlay: o card arrastado é desenhado por cima de tudo (num portal),
//   senão ele ficava preso/cortado atrás das outras colunas.
// Distância mínima de 6px pra arrastar — clique simples continua abrindo.
export function AgendaDndProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeEvent, setActiveEvent] = useState<AgendaEvent | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveEvent((event.active.data.current as DragData | undefined)?.event ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEvent(null);
    const dragged = (event.active.data.current as DragData | undefined)?.event;
    if (!event.over || !dragged?.taskId) return;
    const next = targetDate(String(event.over.id), dragged.when);
    if (!next || next.getTime() === dragged.when.getTime()) return;

    startTransition(async () => {
      const result = await rescheduleTask(dragged.taskId!, next.toISOString());
      if (!result.success) {
        toast.error("Não foi possível reagendar", { description: result.error });
        return;
      }
      toast.success("Tarefa reagendada", {
        description: `Novo horário: ${next.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} às ${formatTime(next)}. O responsável foi avisado.`,
      });
      if (result.warning) toast.warning("Conflito de horário", { description: result.warning, duration: 8000 });
      router.refresh();
    });
  }

  return (
    <DndContext
      id="agenda-dnd"
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveEvent(null)}
    >
      {children}
      <DragOverlay>
        {activeEvent && (
          <EventCardView
            event={activeEvent}
            className="w-60 rotate-1 cursor-grabbing shadow-xl ring-2 ring-primary/40"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function AgendaDropArea({
  id,
  className,
  activeClassName = "ring-2 ring-inset ring-primary bg-primary/15",
  children,
}: {
  id: string;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && activeClassName)}>
      {children}
    </div>
  );
}

// Caixa de concluir direto da Agenda (só tarefas) — maior e com borda forte
// pra ser fácil de achar; verde quando concluída.
export function AgendaTaskCheckbox({ taskId, done, title }: { taskId: string; done: boolean; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Checkbox
      checked={done}
      disabled={isPending}
      title={done ? "Reabrir tarefa" : "Concluir tarefa"}
      aria-label={done ? `Reabrir "${title}"` : `Concluir "${title}"`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onCheckedChange={() =>
        startTransition(async () => {
          const result = await toggleTaskStatus(taskId);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(done ? "Tarefa reaberta." : "Tarefa concluída.", result.info ? { description: result.info } : undefined);
          router.refresh();
        })
      }
      className="mt-0.5 size-5 shrink-0 rounded-md border-2 border-muted-foreground/50 bg-background shadow-xs hover:border-success hover:bg-success/10 data-checked:border-success data-checked:bg-success data-checked:text-white [&_svg]:size-4"
    />
  );
}

// Conteúdo visual do card — usado no card de verdade e na "cópia" que
// acompanha o mouse ao arrastar (DragOverlay, sem interação).
function EventCardView({
  event,
  assignableUsers,
  interactive = false,
  className,
}: {
  event: AgendaEvent;
  assignableUsers?: AssignableUser[];
  interactive?: boolean;
  className?: string;
}) {
  const color = userColor(event.responsibleId);
  const end = agendaEventEnd(event);

  const body = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
        {formatTime(event.when)}
        {end ? `–${formatTime(end)}` : ""}
        {event.recurrence && <Repeat className="ml-1 inline size-3" aria-label="Repete" />}
        {event.virtual && <span className="ml-1 font-normal">· repetição</span>}
      </span>
      <span className={cn("text-sm leading-snug font-medium", event.done && "text-muted-foreground line-through")}>
        {event.title}
      </span>
      {event.subtitle && <span className="truncate text-xs text-muted-foreground">{event.subtitle}</span>}
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {event.responsibleName && (
          <span className="truncate text-xs font-bold" style={{ color }}>
            {event.responsibleName}
          </span>
        )}
        <StatusBadge
          label={AGENDA_CATEGORY_LABELS[event.category]}
          tone={CATEGORY_TONE[event.category]}
          className="px-1.5 py-0 text-[10px]"
        />
      </span>
    </div>
  );

  return (
    <div
      style={{ borderLeftColor: color, backgroundImage: `linear-gradient(${color}12, ${color}12)` }}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-l-4 border-border bg-card p-2 shadow-xs",
        event.done && "opacity-70",
        // Repetição futura: tracejado, pra diferenciar da tarefa "de verdade".
        event.virtual && "border-dashed opacity-80",
        className
      )}
    >
      {interactive && event.source === "task" && event.taskId && !event.virtual && (
        <AgendaTaskCheckbox taskId={event.taskId} done={event.done} title={event.title} />
      )}
      {!interactive ? (
        body
      ) : event.source === "task" && event.category === "geral" && event.taskId ? (
        <AgendaTaskTrigger taskId={event.taskId} assignableUsers={assignableUsers ?? []} className="min-w-0 flex-1">
          {body}
        </AgendaTaskTrigger>
      ) : (
        <Link href={event.href} className="min-w-0 flex-1">
          {body}
        </Link>
      )}
    </div>
  );
}

// Card de compromisso (Grade, Semana e Calendário): faixa na cor do
// responsável, horário (início–fim quando tem duração), título,
// cliente/registro, responsável em negrito na cor dele, categoria e — se for
// tarefa — caixa de concluir e arrastar pra reagendar.
export function AgendaEventCard({
  event,
  assignableUsers,
  className,
}: {
  event: AgendaEvent;
  assignableUsers: AssignableUser[];
  className?: string;
}) {
  const draggable = event.source === "task" && !!event.taskId && !event.done && !event.virtual;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event } satisfies DragData,
    disabled: !draggable,
  });
  // O pop-up da tarefa "Geral" é filho deste card no React (portal) — sem
  // isso, arrastar/selecionar texto dentro do pop-up arrastaria o card.
  const dragListeners =
    draggable && listeners
      ? {
          ...listeners,
          onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.target as Node)) return;
            listeners.onPointerDown?.(e);
          },
        }
      : {};

  return (
    <div
      ref={setNodeRef}
      {...dragListeners}
      {...(draggable ? attributes : {})}
      className={cn(
        "rounded-lg transition-[opacity,box-shadow] hover:shadow-md",
        draggable && "cursor-grab active:cursor-grabbing",
        // A cópia que se move é o DragOverlay; o original fica marcando o lugar.
        isDragging && "opacity-35",
        className
      )}
    >
      <EventCardView event={event} assignableUsers={assignableUsers} interactive />
    </div>
  );
}
