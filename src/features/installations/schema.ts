import { Priority } from "@prisma/client";
import { z } from "zod";

import { optionalDate, optionalText } from "@/lib/zod-helpers";

// Igual ao padrão de Opportunity: a etapa NÃO muda por aqui, só pela ação
// dedicada de Kanban (changeInstallationStage), que tem a regra do checklist.
export const installationFormSchema = z.object({
  responsibleId: z.string().optional(),
  priority: z.nativeEnum(Priority),
  scheduledAt: optionalDate,
  dueAt: optionalDate,
  notes: optionalText,
});

export type InstallationFormInput = z.infer<typeof installationFormSchema>;

export const installationFiltersSchema = z.object({
  q: z.string().trim().optional(),
  responsibleId: z.string().optional(),
  stageId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.enum(["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["createdAt", "dueAt", "scheduledAt"]).optional().default("createdAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type InstallationFilters = z.infer<typeof installationFiltersSchema>;
