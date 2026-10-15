import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LOST_STAGE_KEY, WON_STAGE_KEY } from "@/features/kanban/constants";
import { computeTemperature } from "@/features/temperature/engine";

type TemperatureClient = PrismaClient | Prisma.TransactionClient;

// Oportunidade fechada (Ganha/Perdida) sai da fila de prioridade — não faz
// mais sentido ter temperatura. Recalculado sempre que algo relevante muda
// (ver chamadas em features/opportunities/actions.ts).
export async function recomputeOpportunityTemperature(id: string, client: TemperatureClient = prisma) {
  const opportunity = await client.opportunity.findUnique({
    where: { id },
    select: {
      status: true,
      priority: true,
      expectedCloseAt: true,
      lastInteractionAt: true,
      stageEnteredAt: true,
      createdAt: true,
      temperatureOverride: true,
      stageId: true,
      stage: { select: { order: true, board: true } },
      signalPedeProposta: true,
      signalPerguntouPreco: true,
      signalPedeDemo: true,
      signalInformouPrazo: true,
      signalProblemaUrgente: true,
    },
  });
  if (!opportunity) return;

  const now = new Date();

  if (opportunity.status !== "OPEN") {
    await client.opportunity.update({
      where: { id },
      data: { temperature: null, temperatureScore: null, temperatureUpdatedAt: now },
    });
    return;
  }

  const nonTerminalStages = await client.kanbanStage.findMany({
    where: { board: opportunity.stage.board, deletedAt: null, key: { notIn: [WON_STAGE_KEY, LOST_STAGE_KEY] } },
    select: { order: true },
  });
  const maxOrder = Math.max(1, ...nonTerminalStages.map((s) => s.order));
  const stageProgress = Math.min(1, opportunity.stage.order / maxOrder);

  const { score, temperature } = computeTemperature({
    lastActivityAt: opportunity.lastInteractionAt ?? opportunity.stageEnteredAt ?? opportunity.createdAt,
    stageProgress,
    priority: opportunity.priority,
    expectedCloseAt: opportunity.expectedCloseAt,
    signals: {
      pedeProposta: opportunity.signalPedeProposta,
      perguntouPreco: opportunity.signalPerguntouPreco,
      pedeDemo: opportunity.signalPedeDemo,
      informouPrazo: opportunity.signalInformouPrazo,
      problemaUrgente: opportunity.signalProblemaUrgente,
    },
    now,
  });

  await client.opportunity.update({
    where: { id },
    data: {
      temperatureScore: score,
      temperatureUpdatedAt: now,
      ...(opportunity.temperatureOverride ? {} : { temperature }),
    },
  });
}
