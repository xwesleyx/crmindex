import type { ReactNode } from "react";

// Estado vazio discreto de coluna (seção 3 do escopo de refinamento) — não
// pode "ocupar metade da tela", então é compacto e some assim que a coluna
// tiver algum card.
export function KanbanEmptyState({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      {action}
    </div>
  );
}
