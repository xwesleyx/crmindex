"use client";

import type { Temperature } from "@prisma/client";
import { Lock, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemperatureBadge } from "@/components/temperature-badge";
import { formatDateTime } from "@/lib/format";
import {
  setLeadTemperatureOverride,
  setOpportunityTemperatureOverride,
  toggleLeadSignal,
  toggleOpportunitySignal,
} from "@/features/temperature/actions";
import { SIGNAL_LABELS, SIGNAL_TYPES, type SignalType } from "@/features/temperature/schema";

type EntityKind = "opportunity" | "lead";

const OVERRIDE_OPTIONS: Temperature[] = ["QUENTE", "MORNO", "FRIO"];

export function TemperatureSignalsCard({
  entityKind,
  entityId,
  temperature,
  score,
  override,
  signals,
  canManage,
}: {
  entityKind: EntityKind;
  entityId: string;
  temperature: Temperature | null;
  score: number | null;
  override: boolean;
  signals: Record<SignalType, Date | null>;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggleSignal(signal: SignalType) {
    startTransition(async () => {
      const action = entityKind === "opportunity" ? toggleOpportunitySignal : toggleLeadSignal;
      const result = await action(entityId, signal);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleOverride(value: Temperature | null) {
    startTransition(async () => {
      const action = entityKind === "opportunity" ? setOpportunityTemperatureOverride : setLeadTemperatureOverride;
      const result = await action(entityId, value);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Temperatura travada." : "Temperatura destravada — volta a ser calculada.");
      router.refresh();
    });
  }

  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Sinais comerciais</CardTitle>
        <div className="flex items-center gap-2">
          <TemperatureBadge temperature={temperature} />
          {score !== null && <span className="text-xs text-muted-foreground">score {score}</span>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_TYPES.map((signal) => {
            const active = !!signals[signal];
            return (
              <Button
                key={signal}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={!canManage || isPending}
                onClick={() => handleToggleSignal(signal)}
                title={active ? `Marcado ${formatDateTime(signals[signal])}` : undefined}
              >
                {SIGNAL_LABELS[signal]}
              </Button>
            );
          })}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-xs text-muted-foreground">
              {override ? "Travado manualmente:" : "Travar manualmente:"}
            </span>
            {override ? (
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleOverride(null)}>
                <Unlock className="size-3.5" />
                Destravar
              </Button>
            ) : (
              OVERRIDE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleOverride(option)}
                >
                  <Lock className="size-3.5" />
                  <TemperatureBadge temperature={option} />
                </Button>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
