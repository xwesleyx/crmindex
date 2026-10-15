import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { customerWhereForRole } from "@/features/customers/permissions";
import { installationWhereForRole } from "@/features/installations/permissions";
import { leadWhereForRole } from "@/features/leads/permissions";
import { opportunityWhereForRole } from "@/features/opportunities/permissions";
import {
  customerRegionWhere,
  installationRegionWhere,
  opportunityRegionWhere,
  saleRegionWhere,
} from "@/features/regions/query-helpers";
import { saleWhereForRole } from "@/features/sales/permissions";

// KPIs reais (seção 23/35) — cada número vem de uma query, nunca inventado.
// Se um dado ainda não existir no sistema (financeiro, atendimento), o card
// correspondente continua "em breve". `regionIds` filtra o painel por uma
// ou mais Regiões (seção "Regiões" — "ver o dashboard de um local só");
// Lead fica fora do filtro porque não tem vínculo real de Empresa antes de
// converter (só campos informais companyName/companyCnpj).
export async function getDashboardKpis(
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const leadWhere = leadWhereForRole(currentUser.role, currentUser.id);
  const oppWhere: Prisma.OpportunityWhereInput = {
    AND: [opportunityWhereForRole(currentUser.role, currentUser.id), opportunityRegionWhere(regionIds)],
  };
  const customerWhere: Prisma.CustomerWhereInput = {
    AND: [customerWhereForRole(currentUser.role, currentUser.id), customerRegionWhere(regionIds)],
  };
  const saleWhere: Prisma.SaleWhereInput = {
    AND: [saleWhereForRole(currentUser.role, currentUser.id), saleRegionWhere(regionIds)],
  };
  const installationWhere: Prisma.InstallationWhereInput = {
    AND: [installationWhereForRole(currentUser.role, currentUser.id), installationRegionWhere(regionIds)],
  };

  const [
    newLeads,
    openOpportunities,
    pipeline,
    won,
    lost,
    activeCustomers,
    salesAggregate,
    installationsPending,
    installationsCompleted,
    installationsOverdue,
  ] = await Promise.all([
    prisma.lead.count({ where: { AND: [leadWhere, { status: "NOVO", deletedAt: null }] } }),
    prisma.opportunity.count({
      where: { AND: [oppWhere, { status: "OPEN", deletedAt: null }] },
    }),
    prisma.opportunity.aggregate({
      where: { AND: [oppWhere, { status: "OPEN", deletedAt: null }] },
      _sum: { estimatedValueCents: true },
    }),
    prisma.opportunity.aggregate({
      where: { AND: [oppWhere, { status: "WON", deletedAt: null }] },
      _sum: { estimatedValueCents: true },
      _count: true,
    }),
    prisma.opportunity.count({
      where: { AND: [oppWhere, { status: "LOST", deletedAt: null }] },
    }),
    prisma.customer.count({ where: { AND: [customerWhere, { status: "ATIVO" }] } }),
    prisma.sale.aggregate({
      where: { AND: [saleWhere, { status: "CONFIRMADA" }] },
      _sum: { amountCents: true, recurringAmountCents: true },
      _count: true,
    }),
    prisma.installation.count({
      where: { AND: [installationWhere, { status: "EM_ANDAMENTO" }] },
    }),
    prisma.installation.count({
      where: { AND: [installationWhere, { status: "CONCLUIDA" }] },
    }),
    // Atrasada = prazo vencido e ainda em andamento — mesma regra de
    // isInstallationOverdue (features/installations/types.ts), só que
    // agregada no banco em vez de por instalação.
    prisma.installation.count({
      where: {
        AND: [installationWhere, { status: "EM_ANDAMENTO", dueAt: { lt: new Date() } }],
      },
    }),
  ]);

  return {
    newLeads,
    openOpportunities,
    pipelineCents: pipeline._sum.estimatedValueCents ?? 0,
    wonCents: won._sum.estimatedValueCents ?? 0,
    wonCount: won._count,
    lostCount: lost,
    activeCustomers,
    salesCount: salesAggregate._count,
    salesAmountCents: salesAggregate._sum.amountCents ?? 0,
    mrrCents: salesAggregate._sum.recurringAmountCents ?? 0,
    installationsPending,
    installationsCompleted,
    installationsOverdue,
  };
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function lastNMonths(n: number) {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] });
  }
  return months;
}

// Evolução de vendas confirmadas nos últimos 6 meses (seção do dashboard) —
// só soma o que já está no banco; meses sem venda aparecem com 0, nunca com
// número inventado.
export async function getSalesEvolution(
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const saleWhere = saleWhereForRole(currentUser.role, currentUser.id);
  const months = lastNMonths(6);
  const rangeStart = new Date(months[0].year, months[0].month, 1);

  const sales = await prisma.sale.findMany({
    where: {
      AND: [saleWhere, saleRegionWhere(regionIds), { status: "CONFIRMADA", soldAt: { gte: rangeStart } }],
    },
    select: { amountCents: true, soldAt: true },
  });

  return months.map(({ year, month, label }) => {
    const totalCents = sales
      .filter((s) => s.soldAt.getFullYear() === year && s.soldAt.getMonth() === month)
      .reduce((sum, s) => sum + s.amountCents, 0);
    return { month: label, totalCents };
  });
}

// Pipeline por etapa (só oportunidades em aberto) do quadro comercial.
export async function getPipelineByStage(
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const oppWhere = opportunityWhereForRole(currentUser.role, currentUser.id);

  const stages = await prisma.kanbanStage.findMany({
    where: { board: "COMMERCIAL", active: true },
    orderBy: { order: "asc" },
  });

  const opportunities = await prisma.opportunity.findMany({
    where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "OPEN", deletedAt: null }] },
    select: { stageId: true, estimatedValueCents: true },
  });

  return stages.map((stage) => {
    const inStage = opportunities.filter((o) => o.stageId === stage.id);
    return {
      stage: stage.name,
      totalCents: inStage.reduce((sum, o) => sum + o.estimatedValueCents, 0),
      count: inStage.length,
    };
  });
}

// Ganhas x perdidas por mês, últimos 6 meses.
export async function getWonLostSummary(
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const oppWhere = opportunityWhereForRole(currentUser.role, currentUser.id);
  const months = lastNMonths(6);
  const rangeStart = new Date(months[0].year, months[0].month, 1);

  const [won, lost] = await Promise.all([
    prisma.opportunity.findMany({
      where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "WON", wonAt: { gte: rangeStart } }] },
      select: { wonAt: true },
    }),
    prisma.opportunity.findMany({
      where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "LOST", lostAt: { gte: rangeStart } }] },
      select: { lostAt: true },
    }),
  ]);

  return months.map(({ year, month, label }) => ({
    month: label,
    won: won.filter((o) => o.wonAt && o.wonAt.getFullYear() === year && o.wonAt.getMonth() === month).length,
    lost: lost.filter((o) => o.lostAt && o.lostAt.getFullYear() === year && o.lostAt.getMonth() === month)
      .length,
  }));
}

// Valor comercial por status (aberto / ganho / perdido) — visão de valor,
// não de contagem, complementar ao gráfico de ganhos x perdidos acima.
export async function getCommercialValueByStatus(
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const oppWhere = opportunityWhereForRole(currentUser.role, currentUser.id);

  const [open, won, lost] = await Promise.all([
    prisma.opportunity.aggregate({
      where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "OPEN", deletedAt: null }] },
      _sum: { estimatedValueCents: true },
    }),
    prisma.opportunity.aggregate({
      where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "WON" }] },
      _sum: { estimatedValueCents: true },
    }),
    prisma.opportunity.aggregate({
      where: { AND: [oppWhere, opportunityRegionWhere(regionIds), { status: "LOST" }] },
      _sum: { estimatedValueCents: true },
    }),
  ]);

  return [
    { status: "Em aberto", totalCents: open._sum.estimatedValueCents ?? 0 },
    { status: "Ganha", totalCents: won._sum.estimatedValueCents ?? 0 },
    { status: "Perdida", totalCents: lost._sum.estimatedValueCents ?? 0 },
  ];
}
