import type { Lead } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getDefaultRegionId } from "@/features/regions/queries";
import { onlyDigits } from "@/lib/validators";

// Match ampliado (telefone OU WhatsApp) — mesmo princípio já usado em
// convertLeadToOpportunity (leads/actions.ts). Nunca escolhe sozinho quando
// há mais de um resultado — devolve a lista inteira, quem decide é quem
// chamou (seção 7 do adendo: "não escolher arbitrariamente").
export async function findMatchingContacts(rawPhone: string) {
  const phone = onlyDigits(rawPhone);
  if (!phone) return [];

  return prisma.contact.findMany({
    where: { deletedAt: null, OR: [{ phone }, { whatsapp: phone }] },
    include: {
      company: { include: { customer: { select: { id: true, status: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export type ContactResolutionResult =
  | { type: "single"; contactId: string }
  | { type: "candidates"; candidates: Awaited<ReturnType<typeof findMatchingContacts>> }
  | { type: "none" };

// Contato principal da empresa se houver um marcado, senão o único contato,
// senão a lista pra desambiguação, senão nenhum — usado quando uma
// Opportunity/Sale/Installation só tem companyId (sem contactId direto).
export async function resolveContactForCompany(companyId: string): Promise<ContactResolutionResult> {
  const contacts = await prisma.contact.findMany({
    where: { companyId, deletedAt: null },
    include: {
      company: { include: { customer: { select: { id: true, status: true } } } },
    },
    orderBy: { name: "asc" },
  });

  if (contacts.length === 0) return { type: "none" };

  const primary = contacts.find((c) => c.isPrimaryContact);
  if (primary) return { type: "single", contactId: primary.id };
  if (contacts.length === 1) return { type: "single", contactId: contacts[0].id };

  return { type: "candidates", candidates: contacts };
}

// Usado só por resolveConversationForEntity (atendimento/actions.ts) pro
// entityType "LEAD" — encontrar-ou-criar aqui não é ambíguo como um WhatsApp
// desconhecido chegando: o Lead já é um registro conhecido do CRM, então é
// o mesmo princípio de dedupe de convertLeadToOpportunity (leads/actions.ts),
// só que sem criar a Opportunity junto.
export async function findOrCreateContactForLead(lead: Lead) {
  const phone = onlyDigits(lead.phone);
  const whatsapp = lead.whatsapp ? onlyDigits(lead.whatsapp) : null;

  const include = {
    company: { include: { customer: { select: { id: true, status: true } } } },
  } as const;

  const existing = await prisma.contact.findFirst({
    where: { deletedAt: null, OR: [{ phone }, ...(whatsapp ? [{ whatsapp }] : [])] },
    include,
  });
  if (existing) return existing;

  let companyId: string | null = null;
  if (lead.companyName) {
    const cnpj = lead.companyCnpj ? onlyDigits(lead.companyCnpj) : null;
    let company = cnpj ? await prisma.company.findUnique({ where: { cnpj } }) : null;
    if (!company) {
      company = await prisma.company.create({
        data: {
          legalName: lead.companyName,
          cnpj: cnpj || null,
          origin: lead.origin,
          responsibleId: lead.responsibleId,
          regionId: await getDefaultRegionId(),
        },
      });
    }
    companyId = company.id;
  }

  return prisma.contact.create({
    data: {
      name: lead.name,
      phone,
      whatsapp,
      email: lead.email,
      companyId,
      origin: lead.origin,
      responsibleId: lead.responsibleId,
    },
    include,
  });
}
