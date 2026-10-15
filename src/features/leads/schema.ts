import { LeadOrigin, LeadStatus, Priority } from "@prisma/client";
import { z } from "zod";

import {
  optionalCnpj,
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredPhone,
} from "@/lib/zod-helpers";

// CONVERTIDO é definido só pela conversão (fase futura) — nunca escolhido
// manualmente no formulário (seção 6: "não permitir combinações incoerentes").
export const EDITABLE_LEAD_STATUSES = [
  LeadStatus.NOVO,
  LeadStatus.CONTATO_REALIZADO,
  LeadStatus.EM_ATENDIMENTO,
  LeadStatus.QUALIFICADO,
  LeadStatus.NAO_QUALIFICADO,
  LeadStatus.PERDIDO,
] as const;

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  phone: requiredPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  companyName: optionalText,
  companyCnpj: optionalCnpj,
  origin: z.nativeEnum(LeadOrigin, { message: "Selecione a origem" }),
  priority: z.nativeEnum(Priority),
  status: z.enum(EDITABLE_LEAD_STATUSES),
  notes: optionalText,
  // Sem preprocess: o Select nunca envia string vazia, o Controller já
  // mapeia o sentinel "unassigned" para undefined antes de chegar aqui.
  responsibleId: z.string().optional(),
  nextActionAt: optionalDate,
  nextActionNote: optionalText,
  lastInteractionAt: optionalDate,
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;

export const leadFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  origin: z.nativeEnum(LeadOrigin).optional(),
  responsibleId: z.string().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["createdAt", "name", "lastInteractionAt"]).optional().default("createdAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

// Conversão de lead em oportunidade — só os campos que a conversão em si
// decide (etapa, valor, prioridade, responsável); contato/empresa/origem
// vêm do próprio lead (ver convertLeadToOpportunity em actions.ts).
export const convertLeadSchema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  stageId: z.string().min(1, "Selecione a etapa"),
  priority: z.nativeEnum(Priority),
  estimatedValueCents: z.number().int().min(0, "Valor não pode ser negativo"),
  ownerId: z.string().optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
