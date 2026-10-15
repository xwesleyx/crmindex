"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { UserRole } from "@prisma/client";
import { memo, useMemo } from "react";

import { cn } from "cn";
import { KanbanEmptyState } from "@/features/kanban/kanban-empty-state";
import type { KanbanStageInfo } from "@/features/kanban/types";
import { InstallationKanbanCard } from "@/features/installations/installation-kanban-card";
import type { InstallationListItem } from "@/features/installations/types";
import type { AssignableUser } from "@/features/leads/types";

export type InstallationColumnData = {
  stage: KanbanStageInfo;
  installations: InstallationListItem[];
  count: number;
};

export const InstallationKanbanColumn = memo(function InstallationKanbanColumn({
  column,
  allStages,
  currentUser,
  onMoveToStage,
  atendimentoAssignableUsers,
  className,
}: {
  column: InstallationColumnData;
  allStages: KanbanStageInfo[];
  currentUser: { id: string; role: UserRole };
  onMoveToStage: (installationId: string, fromStageId: string, toStageId: string) => void;
  atendimentoAssignableUsers: AssignableUser[];
  className?: string;
}) {
  // data: { type: "column" } — o collisionDetection do board (ver
  // features/kanban/reorder.ts) sempre aceita a coluna como alvo válido,
  // mesmo pra um card de prioridade diferente de tudo que já está nela
  // (entra no topo da própria faixa, sem violar a ordem).
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id, data: { type: "column" } });
  const itemIds = useMemo(() => column.installations.map((i) => i.id), [column.installations]);
  // Cor livre por etapa (Configurações > Kanbans) — mesmo tratamento do
  // Kanban comercial (kanban-column.tsx).
  const color = column.stage.color;

  return (
    // Mesmo tratamento do Kanban comercial (kanban-column.tsx): a coluna
    // inteira é um único retângulo tingido, não só o cabeçalho.
    <div
      className={cn("flex w-80 shrink-0 flex-col gap-2 rounded-lg border p-2", className)}
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}4D` }}
    >
      <div className="flex flex-col gap-1 px-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate text-sm font-semibold" style={{ color }}>
              {column.stage.name}
            </span>
          </span>
          <span
            className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ color }}
          >
            {column.count}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-primary/10 outline-2 outline-dashed outline-primary/40"
        )}
      >
        {column.installations.length === 0 ? (
          <KanbanEmptyState label="Nenhuma instalação nesta etapa." />
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {column.installations.map((installation) => (
              <InstallationKanbanCard
                key={installation.id}
                installation={installation}
                stages={allStages}
                currentUser={currentUser}
                onMoveToStage={onMoveToStage}
                assignableUsers={atendimentoAssignableUsers}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
});
