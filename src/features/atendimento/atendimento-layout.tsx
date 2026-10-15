import type { ReactNode } from "react";

import { cn } from "cn";

// Três painéis (seção 8): conversas | conversa | cliente. Desktop é
// prioridade (seção 23) — no mobile vira navegação sequencial: lista OU
// conversa por vez (o painel de contexto vira um botão "Info" dentro do
// ChatPanel nesse caso, não faz parte deste grid).
export function AtendimentoLayout({
  list,
  main,
  context,
  hasSelection,
}: {
  list: ReactNode;
  main: ReactNode;
  context?: ReactNode;
  hasSelection: boolean;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_300px]">
      <div className={cn("min-h-0", hasSelection && "hidden md:block")}>{list}</div>
      <div className={cn("min-h-0", !hasSelection && "hidden md:block")}>{main}</div>
      {context && <div className="hidden min-h-0 xl:block">{context}</div>}
    </div>
  );
}
