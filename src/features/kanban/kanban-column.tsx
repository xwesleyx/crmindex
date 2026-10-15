"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { UserRole } from "@prisma/client";
import { memo, useMemo } from "react";

import { MoneyDisplay } from "@/components/money-display";
import { cn } from "cn";
import { KanbanCard } from "@/features/kanban/kanban-card";
import { KanbanEmptyState } from "@/features/kanban/kanban-empty-state";
import type { KanbanColumnData, NextTaskInfo } from "@/features/kanban/types";
import type { AssignableUser } from "@/features/leads/types";
import type { ResolvedPermissionOverrides } from "@/lib/permissions";

export const KanbanColumn = memo(function KanbanColumn({
  column,
  allStages,
  nextTaskByOpportunity,
  currentUser,
  onMoveToStage,
  assignableUsers,
  className,
  permissionOverrides,
}: {
  column: KanbanColumnData;
  allStages: KanbanColumnData["stage"][];
  nextTaskByOpportunity: Record<string, NextTaskInfo | undefined>;
  currentUser: { id: string; role: UserRole };
  onMoveToStage: (opportunityId: string, fromStageId: string, toStageId: string) => void;
  assignableUsers: AssignableUser[];
  className?: string;
  permissionOverrides?: ResolvedPermissionOverrides;
}) {
  // data: { type: "column" } — o collisionDetection do board (ver
  // features/kanban/reorder.ts) sempre aceita a coluna como alvo válido,
  // mesmo pra um card de prioridade diferente de tudo que já está nela
  // (entra no topo da própria faixa, sem violar a ordem).
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id, data: { type: "column" } });
  const itemIds = useMemo(() => column.opportunities.map((o) => o.id), [column.opportunities]);
  // Cor livre por etapa (Configurações > Kanbans — features/kanban-stages/),
  // não mais uma paleta fixa de classes Tailwind por key: aplicada via style
  // inline com alfa em hex (mesmo motivo de Region.color — hex arbitrário
  // escolhido pelo usuário não pode virar classe Tailwind em tempo de build).
  const color = column.stage.color;

  return (
    // A coluna inteira (cabeçalho + cards) é um único retângulo tingido na
    // cor da etapa — antes só o cabeçalho tinha cor e o resto "flutuava"
    // sem contorno, não dava pra ver onde uma coluna terminava e a próxima
    // começava.
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
        <MoneyDisplay cents={column.totalCents} size="md" style={{ color }} />
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-primary/10 outline-2 outline-dashed outline-primary/40"
        )}
      >
        {column.opportunities.length === 0 ? (
          <KanbanEmptyState label="Nenhuma oportunidade nesta etapa." />
        ) : (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {column.opportunities.map((opportunity) => (
              <KanbanCard
                key={opportunity.id}
                opportunity={opportunity}
                stages={allStages}
                nextTask={nextTaskByOpportunity[opportunity.id]}
                currentUser={currentUser}
                onMoveToStage={onMoveToStage}
                assignableUsers={assignableUsers}
                permissionOverrides={permissionOverrides}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
});
