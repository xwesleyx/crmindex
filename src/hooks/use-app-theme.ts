"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "index-theme"; // "light" | "dark"

// Modo escuro escopado só ao painel autenticado (ver DashboardShell, que
// aplica a classe "dark" num wrapper próprio) — a tela de login não deve
// mudar de aparência, então essa classe nunca vai no <html>.
//
// O estado começa sempre em "light", mesmo no cliente — ler localStorage/
// matchMedia já no useState inicial fazia o primeiro render do cliente (o da
// hidratação) divergir do HTML vindo do servidor sempre que a preferência
// salva era "dark". A div em si tem suppressHydrationWarning e tolera essa
// divergência, mas ela se propaga pros componentes que leem `theme` (ex: o
// ícone/aria-label do ModeToggle), que não têm como ser "suprimidos" porque
// viram uma subárvore inteira diferente (Sun vs Moon) — daí o erro de
// hidratação. Por isso a preferência real só é aplicada depois, num efeito
// (roda só no cliente, depois da hidratação já ter terminado).
export function useAppTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Só dá pra ler a preferência salva depois de montado no cliente — não
    // existe durante o SSR. Ler isso ainda no useState inicial (lazy
    // initializer) evitaria esse setState-em-efeito, mas trocaria esse aviso
    // por um bug de verdade: o primeiro render do cliente (o da hidratação)
    // já sairia com o tema salvo e divergiria do HTML "light" vindo do
    // servidor, quebrando a hidratação de tudo que lê `theme` (ex: o ícone
    // do ModeToggle).
    //
    // Sem fallback pra matchMedia(prefers-color-scheme) de propósito: o
    // padrão é sempre claro, mesmo que o sistema operacional da pessoa
    // esteja no escuro — só muda se ela mesma apertar o botão, e aí fica
    // salvo (localStorage) pras próximas vezes.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return { theme, toggleTheme };
}
