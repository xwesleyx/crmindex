import { Trophy } from "lucide-react";

import { EntityAvatar } from "@/components/entity-avatar";
import { RankBadge } from "@/features/atendimento/dashboard-rank-badge";
import type { AttendanceLeaderboardEntry } from "@/features/atendimento/queries";

// Ranking de quem mais encerrou atendimento hoje — a barra proporcional dá
// leitura à distância (tela de TV), sem precisar aproximar pra ler números.
export function AtendimentoLeaderboard({ entries }: { entries: AttendanceLeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
        <Trophy className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Ninguém encerrou atendimento ainda hoje</p>
        <p className="max-w-[22rem] text-xs text-muted-foreground">
          O ranking aparece assim que o primeiro atendimento do dia for concluído.
        </p>
      </div>
    );
  }

  const max = entries[0].count;

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry, i) => (
        <li key={entry.userId} className="flex items-center gap-3">
          <RankBadge position={i + 1} />
          <EntityAvatar name={entry.name} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {entry.count}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(6, (entry.count / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
