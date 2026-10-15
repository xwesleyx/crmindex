import { Clock, MessageCircleWarning, MessageSquare, MessagesSquare, UserRoundCheck, type LucideIcon } from "lucide-react";

import { cn } from "cn";

// Indicadores do topo da Central — um cartão por número, com ícone, no
// mesmo azul da Central. "Não lidos" fica vermelho quando tem algo.
export function AtendimentoMetrics({
  metrics,
}: {
  metrics: { open: number; unread: number; waitingInternal: number; waitingCustomer: number; mine: number };
}) {
  const stats: { label: string; value: number; icon: LucideIcon; alert?: boolean }[] = [
    { label: "Atendimentos abertos", value: metrics.open, icon: MessageSquare },
    { label: "Não lidos", value: metrics.unread, icon: MessageCircleWarning, alert: metrics.unread > 0 },
    { label: "Aguardando atendimento", value: metrics.waitingInternal, icon: Clock },
    { label: "Aguardando cliente", value: metrics.waitingCustomer, icon: UserRoundCheck },
    { label: "Meus atendimentos", value: metrics.mine, icon: MessagesSquare },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                stat.alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-lg leading-tight font-semibold tabular-nums",
                  stat.alert && "text-destructive"
                )}
              >
                {stat.value}
              </span>
              <span className="truncate text-xs text-muted-foreground">{stat.label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
