"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Priority } from "@prisma/client";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { createTask, toggleTaskStatus, updateTask } from "@/features/tasks/actions";
import { TASK_DURATION_OPTIONS, taskFormSchema, type TaskFormInput } from "@/features/tasks/schema";
import { RecurrencePicker } from "@/features/tasks/recurrence-picker";
import type { TaskItem } from "@/features/tasks/types";
import type { AssignableUser } from "@/features/leads/types";
import { PRIORITY_LABELS } from "@/features/leads/labels";
import { useAgendaWhatsappRemindersEnabled } from "@/features/atendimento-automation/agenda-reminders-context";

type TaskFormRawValues = z.input<typeof taskFormSchema>;

function toDateTimeLocalValue(date?: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

const REMINDER_PRESETS = [
  { minutes: 15, label: "15 min antes" },
  { minutes: 30, label: "30 min antes" },
  { minutes: 60, label: "1h antes" },
  { minutes: 60 * 24, label: "1 dia antes" },
];

function reminderLabel(minutes: number): string {
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d antes`;
  if (minutes % 60 === 0) return `${minutes / 60}h antes`;
  return `${minutes}min antes`;
}

// Mensagem automática pro responsável (seção "mandar uma mensagem
// automática... com tudo detalhado. Faltando uns 30 minutos antes como
// padrão, mas posso definir mais alertas ou o tempo") — cada chip aqui vira
// uma linha em TaskReminder; o agendador dispara uma pra cada, faltando
// esse tanto de minutos pro prazo. Sem prazo definido, isso é ignorado (não
// tem "faltando X minutos" pra calcular sem uma data de referência).
function ReminderPicker({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  const [customMinutes, setCustomMinutes] = useState("");

  function toggle(minutes: number) {
    onChange(value.includes(minutes) ? value.filter((m) => m !== minutes) : [...value, minutes].sort((a, b) => a - b));
  }

  function addCustom() {
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    if (!value.includes(minutes)) onChange([...value, minutes].sort((a, b) => a - b));
    setCustomMinutes("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {REMINDER_PRESETS.map((preset) => (
          <button
            key={preset.minutes}
            type="button"
            onClick={() => toggle(preset.minutes)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              value.includes(preset.minutes)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {value.filter((m) => !REMINDER_PRESETS.some((p) => p.minutes === m)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value
            .filter((m) => !REMINDER_PRESETS.some((p) => p.minutes === m))
            .map((minutes) => (
              <span
                key={minutes}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                {reminderLabel(minutes)}
                <button type="button" onClick={() => toggle(minutes)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={1}
          placeholder="Minutos personalizados"
          value={customMinutes}
          onChange={(e) => setCustomMinutes(e.target.value)}
          className="h-7 w-40 text-xs"
        />
        <Button type="button" variant="outline" size="xs" onClick={addCustom}>
          Adicionar
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum lembrete automático será enviado.</p>
      )}
    </div>
  );
}

export function TaskForm({
  mode,
  task,
  entityType,
  entityId,
  assignableUsers,
  defaultDueAt,
  onSuccess,
}: {
  mode: "create" | "edit";
  task?: TaskItem;
  entityType: string;
  entityId: string;
  assignableUsers: AssignableUser[];
  // Prazo pré-preenchido (ex: clique num horário da Grade ou num dia do
  // Calendário) — só se aplica na criação, quando ainda não existe `task`.
  defaultDueAt?: Date;
  onSuccess: () => void;
}) {
  const whatsappRemindersEnabled = useAgendaWhatsappRemindersEnabled();
  // O responsável atual pode não estar na lista (ex.: usuário inativo ou de
  // outro perfil) — sem ele nas opções, o campo aparecia vazio ao editar.
  const assigneeOptions =
    task?.assignee && !assignableUsers.some((user) => user.id === task.assignee!.id)
      ? [...assignableUsers, { id: task.assignee.id, name: task.assignee.name }]
      : assignableUsers;
  const [togglePending, startToggleTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormRawValues, unknown, TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? undefined,
      // O input datetime-local só aceita "AAAA-MM-DDTHH:mm" — um Date aqui
      // deixava o campo em branco ao editar (dia e horário "sumiam").
      dueAt: toDateTimeLocalValue(task?.dueAt ?? defaultDueAt) || undefined,
      priority: task?.priority ?? Priority.NORMAL,
      assigneeId: task?.assigneeId ?? undefined,
      reminderMinutesBefore: task?.reminders.map((r) => r.minutesBefore) ?? [30],
      durationMinutes: task?.durationMinutes ?? undefined,
      recurrence: task?.recurrence ?? undefined,
    },
  });

  // Prazo atual do formulário — padrão do dia da semana/do mês na repetição.
  const dueAtValue = useWatch({ control, name: "dueAt" });

  async function onSubmit(data: TaskFormInput) {
    const result =
      mode === "create"
        ? await createTask(entityType, entityId, data)
        : await updateTask(task!.id, data);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Tarefa criada." : "Tarefa atualizada.");
    // Conflito de horário não impede salvar — só avisa.
    if (result.warning) toast.warning("Conflito de horário", { description: result.warning, duration: 8000 });
    onSuccess();
  }

  // "editar caso precise e/ou finalizar" — dá pra concluir/reabrir direto
  // deste mesmo pop-up, sem precisar de outra tela (única forma de finalizar
  // uma tarefa "Geral" antes, já que ela não tem uma tela própria pra
  // abrir/voltar depois).
  function handleToggleStatus() {
    if (!task) return;
    startToggleTransition(async () => {
      const result = await toggleTaskStatus(task.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        task.status === "CONCLUIDA" ? "Tarefa reaberta." : "Tarefa concluída.",
        result.info ? { description: result.info } : undefined
      );
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" placeholder="Ex: Ligar para o cliente" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueAt">Prazo</Label>
          <Input id="dueAt" type="datetime-local" {...register("dueAt")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Prioridade</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Priority).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Responsável</Label>
          <Controller
            control={control}
            name="assigneeId"
            render={({ field }) => (
              <Select
                value={field.value ?? "unassigned"}
                onValueChange={(v) => field.onChange(v === "unassigned" ? undefined : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {assigneeOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Duração</Label>
          <Controller
            control={control}
            name="durationMinutes"
            render={({ field }) => (
              <Select
                value={field.value ? String(field.value) : "none"}
                onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem duração</SelectItem>
                  {TASK_DURATION_OPTIONS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {formatDurationLabel(minutes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Repetir</Label>
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <RecurrencePicker
                value={(field.value as string | undefined) ?? undefined}
                onChange={field.onChange}
                dueAt={dueAtValue as string | Date | undefined}
              />
            )}
          />
          <p className="text-[11px] text-muted-foreground">
            Aparece na Agenda em todos os dias da repetição; ao concluir, a próxima vira tarefa sozinha (precisa de prazo).
          </p>
        </div>
      </div>

      {/* Some quando os lembretes por WhatsApp estão desligados em
          Configurações > Mensagens automáticas — o valor já salvo na tarefa
          continua indo no submit (defaultValues), nada é apagado. */}
      {whatsappRemindersEnabled && (
        <div className="flex flex-col gap-1.5">
          <Label>Lembrete automático (WhatsApp para o responsável)</Label>
          <Controller
            control={control}
            name="reminderMinutesBefore"
            render={({ field }) => <ReminderPicker value={field.value ?? []} onChange={field.onChange} />}
          />
        </div>
      )}

      <DialogFooter>
        {mode === "edit" && task && (
          <Button
            type="button"
            variant="outline"
            disabled={togglePending}
            onClick={handleToggleStatus}
          >
            {togglePending
              ? "Salvando..."
              : task.status === "CONCLUIDA"
                ? "Reabrir tarefa"
                : "Concluir tarefa"}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : mode === "create" ? "Criar tarefa" : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}
