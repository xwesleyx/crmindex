import Link from "next/link";
import type { Temperature } from "@prisma/client";

import { TemperatureBadge } from "@/components/temperature-badge";
import { cn } from "cn";
import type { KanbanColumnData } from "@/features/kanban/types";

const TOP_N = 5;

// Mesmo mapeamento de cor da TemperatureBadge (vermelho/amarelo/azul), só que
// aplicado direto no texto do nome — pedido: "em linha com o nome do
// cliente... e só com o nome dele", sem badge/chip ao lado.
const TEMPERATURE_TEXT_CLASS: Record<Temperature, string> = {
  QUENTE: "text-destructive",
  MORNO: "text-warning",
  FRIO: "text-primary",
};

// Sem query nova — deriva tudo da mesma lista de colunas que a página já
// buscou (getKanbanData). Oportunidades fechadas (Ganha/Perdida) nunca têm
// temperature (ver recomputeOpportunityTemperature), então já saem de fora
// das contagens/ranking naturalmente.
export function KanbanPriorityPanel({ columns }: { columns: KanbanColumnData[] }) {
  const opportunities = columns.flatMap((c) => c.opportunities).filter((o) => o.temperature !== null);

  if (opportunities.length === 0) return null;

  const counts = { QUENTE: 0, MORNO: 0, FRIO: 0 } as Record<"QUENTE" | "MORNO" | "FRIO", number>;
  for (const o of opportunities) {
    if (o.temperature) counts[o.temperature]++;
  }

  const topRanked = [...opportunities]
    .sort((a, b) => (b.temperatureScore ?? 0) - (a.temperatureScore ?? 0))
    .slice(0, TOP_N);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold">Prioridade de hoje</span>
        <span className="flex items-center gap-1.5 text-sm">
          <TemperatureBadge temperature="QUENTE" /> {counts.QUENTE}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <TemperatureBadge temperature="MORNO" /> {counts.MORNO}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <TemperatureBadge temperature="FRIO" /> {counts.FRIO}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {topRanked.map((opportunity) => {
          const name = opportunity.company
            ? opportunity.company.tradeName || opportunity.company.legalName
            : (opportunity.contact?.name ?? opportunity.title);
          return (
            <Link
              key={opportunity.id}
              href={`/crm/oportunidades/${opportunity.id}`}
              className={cn(
                "truncate text-sm font-medium hover:underline",
                opportunity.temperature && TEMPERATURE_TEXT_CLASS[opportunity.temperature]
              )}
            >
              {name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
