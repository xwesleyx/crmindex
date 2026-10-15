import type { Priority, Temperature } from "@prisma/client";

// Motor de cálculo puro (sem I/O) da temperatura de Lead/Oportunidade —
// nunca escolhida à mão pelo vendedor, sempre derivada de sinais de
// comportamento comercial. Pesos/limiares num objeto só, pra ajustar depois
// sem mexer no algoritmo.
export const TEMPERATURE_WEIGHTS = {
  recency: [
    { maxDays: 1, points: 35 },
    { maxDays: 3, points: 25 },
    { maxDays: 7, points: 10 },
    { maxDays: 15, points: -10 },
    { maxDays: 30, points: -25 },
    { maxDays: Infinity, points: -45 },
  ],
  stageProgressMax: 25,
  priority: {
    URGENTE: 15,
    ALTA: 8,
    NORMAL: 0,
    BAIXA: -5,
  } satisfies Record<Priority, number>,
  expectedCloseAt: {
    within7Days: 15,
    within30Days: 5,
    overdue: -10,
  },
  signals: {
    pedeProposta: 18,
    perguntouPreco: 12,
    pedeDemo: 12,
    informouPrazo: 18,
    problemaUrgente: 15,
  },
  signalDecayDays: 30,
  thresholds: {
    quente: 55,
    morno: 15,
  },
} as const;

export type TemperatureSignals = {
  pedeProposta?: Date | null;
  perguntouPreco?: Date | null;
  pedeDemo?: Date | null;
  informouPrazo?: Date | null;
  problemaUrgente?: Date | null;
};

export type TemperatureInput = {
  // lastInteractionAt ?? stageEnteredAt/status change ?? createdAt — quem
  // chama decide o fallback, o motor só recebe uma data já resolvida.
  lastActivityAt: Date;
  // 0..1 — posição relativa na lista de etapas/status não-terminais. Quem
  // chama calcula (Oportunidade usa ordem de KanbanStage, Lead usa uma
  // escada fixa de LeadStatus — ver features/temperature/opportunity.ts e
  // lead.ts), porque a definição de "avançado" difere entre os dois.
  stageProgress: number;
  priority: Priority;
  expectedCloseAt: Date | null;
  signals: TemperatureSignals;
  now?: Date;
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function recencyScore(lastActivityAt: Date, now: Date): number {
  const days = daysBetween(lastActivityAt, now);
  const bucket = TEMPERATURE_WEIGHTS.recency.find((b) => days <= b.maxDays);
  return bucket?.points ?? 0;
}

function expectedCloseScore(expectedCloseAt: Date | null, now: Date): number {
  if (!expectedCloseAt) return 0;
  const days = (expectedCloseAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 0) return TEMPERATURE_WEIGHTS.expectedCloseAt.overdue;
  if (days <= 7) return TEMPERATURE_WEIGHTS.expectedCloseAt.within7Days;
  if (days <= 30) return TEMPERATURE_WEIGHTS.expectedCloseAt.within30Days;
  return 0;
}

function signalsScore(signals: TemperatureSignals, now: Date): number {
  const decayDays = TEMPERATURE_WEIGHTS.signalDecayDays;
  return (Object.keys(TEMPERATURE_WEIGHTS.signals) as (keyof typeof TEMPERATURE_WEIGHTS.signals)[]).reduce(
    (total, key) => {
      const at = signals[key];
      if (!at) return total;
      const daysSince = daysBetween(at, now);
      const decay = Math.max(0, 1 - daysSince / decayDays);
      return total + TEMPERATURE_WEIGHTS.signals[key] * decay;
    },
    0
  );
}

export function computeTemperature(input: TemperatureInput): { score: number; temperature: Temperature } {
  const now = input.now ?? new Date();

  const score = Math.round(
    recencyScore(input.lastActivityAt, now) +
      input.stageProgress * TEMPERATURE_WEIGHTS.stageProgressMax +
      TEMPERATURE_WEIGHTS.priority[input.priority] +
      expectedCloseScore(input.expectedCloseAt, now) +
      signalsScore(input.signals, now)
  );

  const temperature: Temperature =
    score >= TEMPERATURE_WEIGHTS.thresholds.quente
      ? "QUENTE"
      : score >= TEMPERATURE_WEIGHTS.thresholds.morno
        ? "MORNO"
        : "FRIO";

  return { score, temperature };
}
