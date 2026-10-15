import { ConversationQueue, ConversationStatus, Priority } from "@prisma/client";
import { z } from "zod";

// "Nova conversa" (seção 8/25): ou reaproveita um contato já existente
// (contactId), ou cria um novo a partir de nome/telefone — nunca os dois ao
// mesmo tempo. Reaproveita findContactDuplicate (contacts/queries.ts) antes
// de criar, mesmo princípio de dedupe das outras conversões do sistema.
export const createConversationSchema = z
  .object({
    contactId: z.string().optional(),
    name: z.string().trim().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    direction: z.enum(["INBOUND", "OUTBOUND"]).default("INBOUND"),
    content: z.string().trim().min(1, "Escreva a mensagem"),
    priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  })
  .superRefine((data, ctx) => {
    if (data.contactId) return;
    if (!data.name || data.name.length < 2) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Informe o nome do contato" });
    }
    if (!data.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe o telefone" });
    }
  });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Escreva uma mensagem").max(4000, "Mensagem muito longa"),
  replyToId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Mesmos campos de convertLeadSchema (leads/schema.ts) — a criação de
// oportunidade pelo atendimento reaproveita convertLeadToOpportunity, então
// pede exatamente o que aquela action espera (seção 14).
export const createOpportunityFromConversationSchema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  stageId: z.string().min(1, "Selecione a etapa"),
  priority: z.nativeEnum(Priority),
  estimatedValueCents: z.number().int().min(0, "Valor não pode ser negativo"),
  ownerId: z.string().optional(),
});

export type CreateOpportunityFromConversationInput = z.infer<
  typeof createOpportunityFromConversationSchema
>;

export const ATTENDANCE_STATUS_KEYS = ["in_progress", "waiting_customer"] as const;
export type AttendanceStatusKey = (typeof ATTENDANCE_STATUS_KEYS)[number];

export const conversationFiltersSchema = z.object({
  q: z.string().trim().optional(),
  filter: z
    .enum([
      "all",
      "unread",
      "mine",
      "unassigned",
      "waiting_customer",
      "waiting_internal",
      "in_progress",
    ])
    .optional()
    // Sem "Todas" na Central: o padrão é "Minhas" (o que eu estou atendendo).
    .default("mine"),
  // Status, separado da aba (filter): lista separada por vírgula
  // ("in_progress,waiting_customer"); sem valor = todos os status.
  status: z
    .string()
    .optional()
    .transform((value) => {
      const valid = (value ?? "")
        .split(",")
        .filter((item): item is AttendanceStatusKey => (ATTENDANCE_STATUS_KEYS as readonly string[]).includes(item));
      return valid.length > 0 ? Array.from(new Set(valid)) : undefined;
    }),
  sort: z
    .enum(["recent", "oldest", "unread_first", "waiting_first"])
    .optional()
    .default("recent"),
});

export type ConversationFilters = z.infer<typeof conversationFiltersSchema>;

export const changeConversationStatusSchema = z.nativeEnum(ConversationStatus);

// "Iniciar atendimento" a partir de um Lead/Opportunity/Sale/Installation/
// contato de Cliente (seção 10-14 do adendo). entityType/entityId dizem de
// onde veio o clique — a action resolve contato/cliente/lead/oportunidade
// a partir disso, nunca recebidos prontos do cliente (evita spoof).
export const startConversationFromEntitySchema = z.object({
  entityType: z.enum(["LEAD", "OPPORTUNITY", "SALE", "INSTALLATION", "CUSTOMER_CONTACT"]),
  entityId: z.string().min(1),
  contactId: z.string().min(1), // resolvido no passo anterior (resolveConversationForEntity)
  queue: z.nativeEnum(ConversationQueue).optional(),
  assigneeMode: z.enum(["unassigned", "me", "user"]),
  assigneeUserId: z.string().optional(),
  initialMessage: z.string().trim().optional(),
});

export type StartConversationFromEntityInput = z.infer<typeof startConversationFromEntitySchema>;

export const transferConversationSchema = z.object({
  queue: z.nativeEnum(ConversationQueue).optional(),
  // Ausente = não mexe no responsável (ex: "Transferir para minha fila" só
  // muda a fila, seção 15/16). Presente = muda pro modo escolhido.
  assigneeMode: z.enum(["unassigned", "me", "user"]).optional(),
  assigneeUserId: z.string().optional(),
  reason: z.string().trim().optional(),
});

export type TransferConversationInput = z.infer<typeof transferConversationSchema>;
