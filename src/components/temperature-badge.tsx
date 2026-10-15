import type { Temperature } from "@prisma/client";

import { StatusBadge, type BadgeTone } from "@/components/status-badge";

// Gradiente de calor intuitivo: vermelho (quente) → amarelo (morno) → azul
// (frio) — nunca escolhida à mão, sempre resultado do cálculo em
// features/temperature/engine.ts.
export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  QUENTE: "🔥 Quente",
  MORNO: "🟡 Morno",
  FRIO: "❄️ Frio",
};

export const TEMPERATURE_TONE: Record<Temperature, BadgeTone> = {
  QUENTE: "destructive",
  MORNO: "warning",
  FRIO: "info",
};

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: Temperature | null;
  className?: string;
}) {
  if (!temperature) return null;
  return (
    <StatusBadge
      label={TEMPERATURE_LABELS[temperature]}
      tone={TEMPERATURE_TONE[temperature]}
      className={className}
    />
  );
}
