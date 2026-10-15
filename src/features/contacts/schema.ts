import { ContactLinkType, LeadOrigin } from "@prisma/client";
import { z } from "zod";

import { optionalDate, optionalEmail, optionalPhone, optionalText } from "@/lib/zod-helpers";

// Seção 3 da Etapa 3: aceitar contatos que chegaram só com nome + telefone
// OU WhatsApp — nenhum dos dois é individualmente obrigatório, mas pelo
// menos um precisa existir (checado em superRefine, não dá pra expressar
// isso com um único campo .refine()).
export const contactFormSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome"),
    phone: optionalPhone,
    whatsapp: optionalPhone,
    email: optionalEmail,
    role: optionalText,
    department: optionalText,
    linkType: z.nativeEnum(ContactLinkType).optional(),
    isPrimaryContact: z.boolean().default(false),
    notes: optionalText,
    isActive: z.boolean(),
    origin: z.nativeEnum(LeadOrigin).optional(),
    companyId: z.string().optional(),
    responsibleId: z.string().optional(),
    lastInteractionAt: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.whatsapp) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Informe ao menos um telefone ou WhatsApp",
      });
    }
  });

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const contactFiltersSchema = z.object({
  q: z.string().trim().optional(),
  companyId: z.string().optional(),
  origin: z.nativeEnum(LeadOrigin).optional(),
  responsibleId: z.string().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["createdAt", "name", "lastInteractionAt"]).optional().default("createdAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ContactFilters = z.infer<typeof contactFiltersSchema>;
