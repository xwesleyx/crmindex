import type { LeadStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeTemperature } from "@/features/temperature/engine";

type TemperatureClient = PrismaClient | Prisma.TransactionClient;

// Escada fixa de avanço do funil de Lead (diferente da Oportunidade, que usa
// a ordem das etapas do Kanban — Lead não tem Kanban próprio, só o enum
// LeadStatus). Status terminal nem entra aqui.
const LEAD_STAGE_PROGRESS: Partial<Record<LeadStatus, number>> = {
  NOVO: 0,
  CONTATO_REALIZADO: 0.33,
  EM_ATENDIMENTO: 0.66,
  QUALIFICADO: 1,
};

const LEAD_TERMINAL_STATUSES: LeadStatus[] = ["NAO_QUALIFICADO", "CONVERTIDO", "PERDIDO"];

export async function recomputeLeadTemperature(id: string, client: TemperatureClient = prisma) {
  const lead = await client.lead.findUnique({
    where: { id },
    select: {
      status: true,
      priority: true,
      lastInteractionAt: true,
      createdAt: true,
      temperatureOverride: true,
      signalPedeProposta: true,
      signalPerguntouPreco: true,
      signalPedeDemo: true,
      signalInformouPrazo: true,
      signalProblemaUrgente: true,
    },
  });
  if (!lead) return;

  const now = new Date();

  if (LEAD_TERMINAL_STATUSES.includes(lead.status)) {
    await client.lead.update({
      where: { id },
      data: { temperature: null, temperatureScore: null, temperatureUpdatedAt: now },
    });
    return;
  }

  const { score, temperature } = computeTemperature({
    lastActivityAt: lead.lastInteractionAt ?? lead.createdAt,
    stageProgress: LEAD_STAGE_PROGRESS[lead.status] ?? 0,
    priority: lead.priority,
    expectedCloseAt: null,
    signals: {
      pedeProposta: lead.signalPedeProposta,
      perguntouPreco: lead.signalPerguntouPreco,
      pedeDemo: lead.signalPedeDemo,
      informouPrazo: lead.signalInformouPrazo,
      problemaUrgente: lead.signalProblemaUrgente,
    },
    now,
  });

  await client.lead.update({
    where: { id },
    data: {
      temperatureScore: score,
      temperatureUpdatedAt: now,
      ...(lead.temperatureOverride ? {} : { temperature }),
    },
  });
}
