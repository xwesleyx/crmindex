import { LeadOrigin, LossReason, Priority } from "@prisma/client";
import { z } from "zod";

import { optionalDate, optionalText } from "@/lib/zod-helpers";

export const opportunityFormSchema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  stageId: z.string().min(1, "Selecione a etapa"),
  priority: z.nativeEnum(Priority),
  estimatedValueCents: z.number().int().min(0, "Valor não pode ser negativo"),
  recurringValueCents: z.number().int().min(0, "Valor não pode ser negativo").optional(),
  origin: z.nativeEnum(LeadOrigin, { message: "Selecione a origem" }),
  expectedCloseAt: optionalDate,
  lastInteractionAt: optionalDate,
  description: optionalText,
  notes: optionalText,
});

export type OpportunityFormInput = z.infer<typeof opportunityFormSchema>;

export const lostReasonSchema = z.object({
  reason: z.nativeEnum(LossReason, { message: "Selecione o motivo" }),
  note: z.string().trim().optional(),
});

export type LostReasonInput = z.infer<typeof lostReasonSchema>;

const opportunityBaseFilters = {
  q: z.string().trim().optional(),
  ownerId: z.string().optional(),
  stageId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  origin: z.nativeEnum(LeadOrigin).optional(),
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  minValueCents: z.coerce.number().int().min(0).optional(),
  maxValueCents: z.coerce.number().int().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

export const opportunityFiltersSchema = z.object({
  ...opportunityBaseFilters,
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z
    .enum(["createdAt", "updatedAt", "estimatedValueCents", "expectedCloseAt", "title"])
    .optional()
    .default("updatedAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;

export const kanbanFiltersSchema = z.object(opportunityBaseFilters);

export type KanbanFilters = z.infer<typeof kanbanFiltersSchema>;
