import type { Prisma } from "@prisma/client";

// Região da oportunidade é sempre "emprestada" da Empresa (direta, ou via
// Contato) — nunca um campo próprio (ver src/features/regions/query-helpers.ts,
// opportunityRegionWhere). Por isso `contact` aqui ganha `company.region`
// aninhado, mesmo esse `contact` normalmente só carregar campos de exibição.
const OPPORTUNITY_INCLUDE = {
  contact: {
    select: {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      company: { select: { id: true, region: { select: { id: true, name: true, color: true } } } },
    },
  },
  company: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      region: { select: { id: true, name: true, color: true } },
    },
  },
  owner: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, key: true, order: true } },
} as const;

export type OpportunityListItem = Prisma.OpportunityGetPayload<{
  include: typeof OPPORTUNITY_INCLUDE;
}>;

export type OpportunityDetail = Prisma.OpportunityGetPayload<{
  include: typeof OPPORTUNITY_INCLUDE & {
    sourceLead: { select: { id: true; name: true } };
  };
}>;

export { OPPORTUNITY_INCLUDE };

// Próxima tarefa não concluída — calculada em lote (uma query pra todas as
// oportunidades do board/lista), nunca por card (seção 24: evitar N+1).
export type NextTaskByEntity = Record<
  string,
  { id: string; title: string; dueAt: Date | null } | undefined
>;
