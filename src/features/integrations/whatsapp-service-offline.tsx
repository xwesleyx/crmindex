"use client";

import { Loader2, Play, RefreshCw, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { restartWhatsappService, startWhatsappService } from "@/features/integrations/actions";
import type { WhatsappUnreachableReason } from "@/features/integrations/whatsapp-status";

const TITLES: Record<WhatsappUnreachableReason, string> = {
  offline: "Serviço parado",
  unauthorized: "Segredo não confere",
  error: "Erro no serviço",
};

type Props = {
  reason: WhatsappUnreachableReason;
  detail: string;
  canManage: boolean;
  manageBlockedReason: string | null;
  logTail: string | null;
};

// Estado "Serviço indisponível" do WhatsApp (Neonize) em Integrações: diz o
// motivo exato e oferece Iniciar/Reiniciar quando o serviço roda nesta
// mesma máquina (ver whatsapp-process.ts).
export function WhatsappServiceOffline({ reason, detail, canManage, manageBlockedReason, logTail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "restart" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  async function run(kind: "start" | "restart") {
    setBusy(kind);
    setActionError(null);
    const toastId = toast.loading(
      kind === "start"
        ? "Iniciando o serviço do WhatsApp... (leva alguns segundos)"
        : "Reiniciando o serviço do WhatsApp... (leva alguns segundos)"
    );
    const result = await (kind === "start" ? startWhatsappService() : restartWhatsappService());
    setBusy(null);

    if (!result.success) {
      setActionError(result.error);
      toast.error(kind === "start" ? "Não foi possível iniciar o serviço" : "Não foi possível reiniciar o serviço", {
        id: toastId,
        description: `${result.error} Os detalhes ficam no quadro vermelho desta tela.`,
        duration: 10000,
      });
    } else {
      toast.success(kind === "start" ? "Serviço do WhatsApp iniciado" : "Serviço do WhatsApp reiniciado", {
        id: toastId,
        description:
          "O serviço está rodando em segundo plano (sem janela). Se o número já estava pareado, ele reconecta sozinho; se não, o QR code aparece nesta tela.",
        duration: 8000,
      });
    }
    startTransition(() => router.refresh());
  }

  const disabled = busy !== null || isRefreshing;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold">{TITLES[reason]}</h4>
              <StatusBadge label="Indisponível" tone="destructive" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
            {reason === "unauthorized" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Iguale os dois valores e clique em Reiniciar serviço para ele reler o .env. Se mudou o .env do CRM,
                reinicie também o <code className="text-xs">npm run dev</code>.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && reason === "offline" && (
            <Button type="button" size="sm" disabled={disabled} onClick={() => run("start")}>
              {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {busy === "start" ? "Iniciando..." : "Iniciar serviço"}
            </Button>
          )}
          {canManage && reason !== "offline" && (
            <Button type="button" size="sm" disabled={disabled} onClick={() => run("restart")}>
              {busy === "restart" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {busy === "restart" ? "Reiniciando..." : "Reiniciar serviço"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
            Verificar de novo
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-background p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {!canManage && manageBlockedReason && (
        <p className="text-xs text-muted-foreground">
          Não dá para iniciar pelo CRM: {manageBlockedReason} Para subir manualmente, na pasta whatsapp-service:{" "}
          <code>uvicorn main:app --port 8787</code>
        </p>
      )}

      {logTail && (
        <details className="text-xs" open={actionError !== null}>
          <summary className="cursor-pointer text-muted-foreground">Detalhes do erro (último log do serviço)</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono whitespace-pre-wrap">
            {logTail}
          </pre>
        </details>
      )}
    </div>
  );
}
