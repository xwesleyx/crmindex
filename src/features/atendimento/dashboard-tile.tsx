import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

const TONE_CLASS = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  purple: "bg-chart-3/10 text-chart-3",
  blue: "bg-chart-1/10 text-chart-1",
} as const;

// Tile grande pro painel de TV (features/atendimento/atendimento-metrics.tsx
// já cobre a versão compacta, pro topo da Central) — número em destaque,
// legível à distância.
export function AtendimentoDashboardTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", TONE_CLASS[tone])}>
          <Icon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-3xl leading-none font-bold tabular-nums text-foreground">{value}</span>
          <span className="text-sm leading-tight text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
