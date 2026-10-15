import { cn } from "cn";

const POSITION_TONE = [
  "bg-warning text-warning-foreground", // 1º — ouro
  "bg-muted-foreground/70 text-white", // 2º — prata
  "bg-chart-3 text-white", // 3º — sem tom de bronze na paleta, usa um tom bem distinto do 1º
];

// Círculo de posição (1º/2º/3º em ouro/prata/bronze, resto neutro) — usado
// nos dois rankings de atendente do painel de TV (hoje e geral).
export function RankBadge({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        POSITION_TONE[position - 1] ?? "bg-muted text-muted-foreground"
      )}
    >
      {position}
    </span>
  );
}
