"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { formatPhone } from "@/lib/format";

type Props = {
  connected: boolean;
  loggedOut: boolean;
  number: string | null;
  qr: string | null;
};

// Intervalos de atualização automática: rápido enquanto conecta (estado de
// poucos segundos), mais lento com o QR na tela (pega o QR novo, que expira
// em ~20s, e percebe sozinho quando o celular termina de parear).
const CONNECTING_REFRESH_MS = 2000;
const QR_REFRESH_MS = 10000;
const CONNECTING_SLOW_AFTER_MS = 30000;

export function WhatsappConnectionState({ connected, loggedOut, number, qr }: Props) {
  const router = useRouter();
  const connecting = !connected && !loggedOut && !qr;
  const [connectingSince] = useState(() => Date.now());
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (connected || loggedOut) return;
    const interval = setInterval(
      () => {
        if (connecting && Date.now() - connectingSince > CONNECTING_SLOW_AFTER_MS) setSlow(true);
        router.refresh();
      },
      connecting ? CONNECTING_REFRESH_MS : QR_REFRESH_MS
    );
    return () => clearInterval(interval);
  }, [connected, loggedOut, connecting, connectingSince, router]);

  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label="Conectado" tone="success" solid />
        {number && <span className="text-sm text-muted-foreground">{formatPhone(number)}</span>}
      </div>
    );
  }

  if (loggedOut) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label="Desconectado" tone="neutral" />
        <span className="text-sm text-muted-foreground">
          Nenhum número conectado. Clique em Gerar QR novamente para parear um celular.
        </span>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label="Conectando..." tone="info" />
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {slow
            ? "Está demorando mais que o normal. Se não conectar, use Reiniciar serviço."
            : "Restaurando a sessão salva do WhatsApp. Leva poucos segundos."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <StatusBadge label="Aguardando pareamento" tone="warning" />
      <div className="flex flex-wrap items-center gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Escaneie com o WhatsApp do celular em Configurações, Aparelhos conectados. O código expira em cerca de 20
          segundos e é atualizado sozinho nesta tela.
        </p>
        {qr && (
          <Image
            src={qr}
            alt="QR code para parear o WhatsApp"
            width={180}
            height={180}
            unoptimized
            className="rounded-lg border border-border"
          />
        )}
      </div>
    </div>
  );
}
