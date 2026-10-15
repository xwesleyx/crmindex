"use client";

import { cn } from "cn";

// Seletor de etapa pro mobile (seção 5 do escopo de refinamento): "uma etapa
// por vez" em vez de 10 colunas espremidas na tela. O board mostra só a
// coluna selecionada aqui abaixo de md; o drag-and-drop continua existindo
// em telas maiores, e o menu "Mover para etapa" de cada card cobre o mobile.
export function KanbanMobileTabs({
  stages,
  activeStageId,
  onSelect,
  countByStage,
}: {
  stages: { id: string; name: string }[];
  activeStageId: string;
  onSelect: (stageId: string) => void;
  countByStage: Record<string, number>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
      {stages.map((stage) => {
        const isActive = stage.id === activeStageId;
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelect(stage.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {stage.name}
            <span className={cn("ml-1.5", isActive ? "opacity-80" : "opacity-60")}>
              {countByStage[stage.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
