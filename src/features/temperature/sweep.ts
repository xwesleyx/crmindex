import { prisma } from "@/lib/prisma";
import { recomputeLeadTemperature } from "@/features/temperature/lead";
import { recomputeOpportunityTemperature } from "@/features/temperature/opportunity";

const LEAD_TERMINAL_STATUSES = ["NAO_QUALIFICADO", "CONVERTIDO", "PERDIDO"] as const;

// Chamado periodicamente por src/instrumentation.ts — sem isso, um registro
// que ninguém toca só esfria de verdade quando alguém abre a tela dele (o
// score depende de "dias desde a última atividade", que muda sozinho com o
// tempo). Barato: leitura + cálculo em JS, e cada recompute só grava se algo
// realmente mudou.
export async function recomputeStaleTemperatures() {
  const [openOpportunities, activeLeads] = await Promise.all([
    prisma.opportunity.findMany({ where: { status: "OPEN", deletedAt: null }, select: { id: true } }),
    prisma.lead.findMany({
      where: { status: { notIn: [...LEAD_TERMINAL_STATUSES] }, deletedAt: null },
      select: { id: true },
    }),
  ]);

  for (const { id } of openOpportunities) {
    await recomputeOpportunityTemperature(id);
  }
  for (const { id } of activeLeads) {
    await recomputeLeadTemperature(id);
  }
}
