"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Painel pensado pra ficar ligado numa tela do escritório, sem ninguém
// interagindo — sem isso os números ficam parados na hora em que a página
// foi aberta. Busca dados novos do servidor a cada minuto.
export function AtendimentoDashboardAutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
