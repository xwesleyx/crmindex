"use client";

import { Clock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type UpdaterStatus = {
  estado: "agendado" | "baixando" | "instalando" | "ok" | "erro";
  versao?: string;
  inicioEm?: string;
};

const POLL_MS = 20_000;
const BUSY = ["baixando", "instalando"];

// Em todas as telas: consulta /api/system/status e
//  - atualização obrigatória agendada -> faixa com contagem regressiva;
//  - baixando/instalando -> tela "Sistema atualizando…" por cima de tudo;
//  - quando o CRM volta (servidor responde e não está mais instalando) ->
//    recarrega a página sozinho.
export function SystemUpdateWatcher() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const updatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Próxima consulta: a cada 5s durante a atualização, 20s no resto.
    async function loop() {
      await poll();
      if (!cancelled) timer = setTimeout(loop, updatingRef.current ? 5000 : POLL_MS);
    }
    async function poll() {
      try {
        const response = await fetch("/api/system/status", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { atualizador: UpdaterStatus | null };
        if (cancelled) return;
        const busy = Boolean(data.atualizador && BUSY.includes(data.atualizador.estado));
        // Estava atualizando e o servidor voltou já sem atualização: recarrega.
        if (updatingRef.current && !busy) {
          window.location.reload();
          return;
        }
        updatingRef.current = busy;
        setStatus(data.atualizador);
      } catch {
        // Servidor fora do ar: durante a atualização é o esperado — mantém o aviso.
      }
    }
    void loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const scheduled = status?.estado === "agendado" && status.inicioEm ? new Date(status.inicioEm).getTime() : null;

  // Relógio só enquanto há contagem regressiva.
  useEffect(() => {
    if (!scheduled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [scheduled]);

  if (status && BUSY.includes(status.estado)) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <h2 className="font-heading text-xl font-semibold">Sistema atualizando…</h2>
          <p className="text-sm text-muted-foreground">
            Instalando a versão {status.versao ?? "nova"}. Isso leva alguns minutos — esta tela volta sozinha quando
            terminar.
          </p>
        </div>
      </div>
    );
  }

  if (scheduled) {
    const seconds = Math.max(0, Math.round((scheduled - now) / 1000));
    const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    return (
      <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
        <Clock className="size-4 shrink-0" />
        Atualização obrigatória para a versão {status?.versao} em {label} — salve o que estiver fazendo. O sistema
        fica fora do ar por alguns minutos.
      </div>
    );
  }

  return null;
}
