import { Priority } from "@prisma/client";
import { z } from "zod";

import { optionalDate, optionalText } from "@/lib/zod-helpers";
import { isValidRecurrence } from "@/features/tasks/recurrence";

// Opções de duração do formulário (minutos).
export const TASK_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

export const taskFormSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da tarefa"),
  description: optionalText,
  dueAt: optionalDate,
  // Duração em minutos (início = dueAt). Vazio = sem duração.
  durationMinutes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || v === "none" ? undefined : Number(v)),
    z.number().int().min(5).max(24 * 60).optional()
  ),
  recurrence: z.preprocess(
    (v) => (v === "" || v === null || v === undefined || v === "none" ? undefined : v),
    z.string().refine(isValidRecurrence, "Repetição inválida").optional()
  ),
  priority: z.nativeEnum(Priority),
  assigneeId: z.string().optional(),
  // Minutos de antecedência de cada lembrete automático (WhatsApp pro
  // responsável) — padrão 30min antes (seção "faltando uns 30 minutos antes
  // como padrão"), mas o usuário pode adicionar mais alertas ou mudar o
  // tempo. Só faz sentido com prazo definido — sem dueAt, ignorado na action.
  reminderMinutesBefore: z.array(z.number().int().min(1).max(60 * 24 * 30)).default([30]),
});

export type TaskFormInput = z.infer<typeof taskFormSchema>;
