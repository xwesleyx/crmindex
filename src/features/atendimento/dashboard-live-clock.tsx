"use client";

import { useEffect, useState } from "react";

// Relógio ao vivo do painel de TV — reforça pra quem está vendo de longe que
// a tela está "viva", não uma captura parada. Só existe nesse painel (não é
// um componente genérico do app).
export function AtendimentoDashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // A hora real só existe no cliente, depois de montado — setState aqui
    // (em vez de num useState inicial) é de propósito, mesmo motivo
    // documentado em src/hooks/use-app-theme.ts: evita que o primeiro render
    // do cliente (hidratação) já saia com a hora divergindo do "--:--:--" do
    // servidor.
    /* eslint-disable react-hooks/set-state-in-effect */
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(id);
  }, []);

  // Primeiro render do cliente fica igual ao do servidor (null -> "--:--"):
  // a hora real só existe depois de montado, ver mesmo motivo documentado em
  // src/hooks/use-app-theme.ts.
  const time = now
    ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    : "";

  return (
    <div className="text-right">
      <p className="font-mono text-2xl leading-tight font-semibold tabular-nums text-foreground">{time}</p>
      <p className="text-xs text-muted-foreground capitalize">{date}</p>
    </div>
  );
}
