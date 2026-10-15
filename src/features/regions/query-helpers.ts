import type { Prisma } from "@prisma/client";

// "Região efetiva" de cada model — resolvida pela cadeia de relações que já
// existe (Company/Customer têm regionId próprio; Opportunity/Installation/
// Sale/Conversation não têm campo de região direto, então a região vem de
// quem eles apontam). `regionIds: null` (ou array vazio) = sem filtro, o
// mesmo padrão "Todas" já usado no filtro de categorias da Agenda.
// Cada função devolve um fragmento pra entrar no `AND: [...]` que toda
// query já monta — nunca substitui o where existente.

export function opportunityRegionWhere(regionIds: string[] | null): Prisma.OpportunityWhereInput {
  if (!regionIds || regionIds.length === 0) return {};
  return {
    OR: [
      { company: { regionId: { in: regionIds } } },
      { contact: { company: { regionId: { in: regionIds } } } },
    ],
  };
}

export function customerRegionWhere(regionIds: string[] | null): Prisma.CustomerWhereInput {
  if (!regionIds || regionIds.length === 0) return {};
  return {
    OR: [
      { regionId: { in: regionIds } },
      { company: { regionId: { in: regionIds } } },
      { contact: { company: { regionId: { in: regionIds } } } },
    ],
  };
}

// Instalação não tem região própria — sempre resolvida pelo cliente dela.
export function installationRegionWhere(regionIds: string[] | null): Prisma.InstallationWhereInput {
  if (!regionIds || regionIds.length === 0) return {};
  return {
    OR: [
      { customer: { regionId: { in: regionIds } } },
      { customer: { company: { regionId: { in: regionIds } } } },
      { customer: { contact: { company: { regionId: { in: regionIds } } } } },
    ],
  };
}

export function saleRegionWhere(regionIds: string[] | null): Prisma.SaleWhereInput {
  if (!regionIds || regionIds.length === 0) return {};
  return {
    OR: [
      { company: { regionId: { in: regionIds } } },
      { customer: { regionId: { in: regionIds } } },
      { customer: { company: { regionId: { in: regionIds } } } },
    ],
  };
}

export function conversationRegionWhere(regionIds: string[] | null): Prisma.ConversationWhereInput {
  if (!regionIds || regionIds.length === 0) return {};
  return {
    OR: [
      { contact: { company: { regionId: { in: regionIds } } } },
      { customer: { regionId: { in: regionIds } } },
      { customer: { company: { regionId: { in: regionIds } } } },
    ],
  };
}
