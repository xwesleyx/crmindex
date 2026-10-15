import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

const ICON_TONE_CLASS = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  blue: "bg-chart-1/10 text-chart-1",
  amber: "bg-chart-2/10 text-chart-2",
  purple: "bg-chart-3/10 text-chart-3",
  orange: "bg-chart-4/10 text-chart-4",
  green: "bg-chart-5/10 text-chart-5",
} as const;

export type MetricTone = keyof typeof ICON_TONE_CLASS;

type MetricCardProps = {
  label: string;
  icon: LucideIcon;
  value?: number | string;
  pendingPhase?: string;
  tone?: MetricTone;
};

// Mostra o valor real quando existir; caso o módulo ainda não tenha backend
// (fase futura), mostra um estado "pendente" honesto em vez de dado
// inventado. `tone` só muda a cor do ícone (mesmos tokens do design system,
// nunca cor nova) — é o que dá variedade visual ao grid de KPIs sem inventar
// paleta. `size="sm"` (--card-spacing menor) + tipografia contida: o valor
// deve ser identificado de imediato sem o card virar um bloco alto.
export function MetricCard({ label, icon: Icon, value, pendingPhase, tone = "primary" }: MetricCardProps) {
  return (
    <Card size="sm" className="gap-0">
      <CardContent className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs text-muted-foreground">
            {label}
          </span>
          {value !== undefined ? (
            <span className="text-xl leading-tight font-semibold tabular-nums">
              {value}
            </span>
          ) : (
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="h-2 w-14 rounded-full bg-muted" />
              <span className="text-[11px] text-muted-foreground">
                {pendingPhase}
              </span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            ICON_TONE_CLASS[tone]
          )}
        >
          <Icon className="size-3.5" />
        </div>
      </CardContent>
    </Card>
  );
}
