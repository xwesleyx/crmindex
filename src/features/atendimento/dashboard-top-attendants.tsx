import { Users } from "lucide-react";

import { EntityAvatar } from "@/components/entity-avatar";
import { RankBadge } from "@/features/atendimento/dashboard-rank-badge";
import type { TopAttendantEntry } from "@/features/atendimento/queries";

// Quadro dos 5 atendentes que mais atenderam (ranking geral, não só hoje) —
// coluna do mês atual ao lado do total acumulado.
export function AtendimentoTopAttendants({ entries }: { entries: TopAttendantEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
        <Users className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nenhum atendimento encerrado ainda</p>
        <p className="max-w-[22rem] text-xs text-muted-foreground">
          O ranking geral aparece assim que os primeiros atendimentos forem concluídos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span className="w-6 shrink-0" />
        <span className="w-8 shrink-0" />
        <span className="flex-1">Atendente</span>
        <span className="w-16 shrink-0 text-right">Este mês</span>
        <span className="w-16 shrink-0 text-right">Total</span>
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((entry, i) => (
          <li key={entry.userId} className="flex items-center gap-3 rounded-lg px-1 py-2 odd:bg-muted/40">
            <RankBadge position={i + 1} />
            <EntityAvatar name={entry.name} size="md" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{entry.name}</span>
            <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {entry.monthCount}
            </span>
            <span className="w-16 shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
              {entry.totalCount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
