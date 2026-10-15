"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { sortByPriorityThen } from "@/lib/priority";
import { changeInstallationStage } from "@/features/installations/actions";
import { InstallationKanbanCard } from "@/features/installations/installation-kanban-card";
import { InstallationKanbanColumn, type InstallationColumnData } from "@/features/installations/installation-kanban-column";
import type { InstallationListItem } from "@/features/installations/types";
import { KanbanMobileTabs } from "@/features/kanban/kanban-mobile-tabs";
import {
  computeReorderValue,
  computeTopOfTierOrder,
  priorityAwareCollisionDetection,
  resolveInsertIndex,
} from "@/features/kanban/reorder";
import { useDragToScroll } from "@/features/kanban/use-drag-to-scroll";
import type { AssignableUser } from "@/features/leads/types";

export function InstallationKanbanBoard({
  initialColumns,
  currentUser,
  atendimentoAssignableUsers,
}: {
  initialColumns: InstallationColumnData[];
  currentUser: { id: string; role: UserRole };
  atendimentoAssignableUsers: AssignableUser[];
}) {
  const [columns, setColumns] = useState(initialColumns);

  const [prevInitialColumns, setPrevInitialColumns] = useState(initialColumns);
  if (initialColumns !== prevInitialColumns) {
    setPrevInitialColumns(initialColumns);
    setColumns(initialColumns);
  }

  const [activeInstallation, setActiveInstallation] = useState<InstallationListItem | null>(null);
  const [activeMobileStageId, setActiveMobileStageId] = useState(initialColumns[0]?.stage.id ?? "");
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useDragToScroll<HTMLDivElement>();
  const router = useRouter();

  // Deriva de initialColumns (prop), não do state local `columns" — mesma
  // razão do kanban comercial (kanban-board.tsx): fica estável entre
  // re-renders de drag, o que deixa handleMoveRequest estável e permite o
  // React.memo dos cards funcionar de verdade.
  const allStages = useMemo(() => initialColumns.map((c) => c.stage), [initialColumns]);

  const countByStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const column of columns) map[column.stage.id] = column.count;
    return map;
  }, [columns]);

  const scrollToStage = useCallback((stageId: string) => {
    setActiveMobileStageId(stageId);
    columnRefs.current[stageId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Estável entre renders (sem deps) — só filtra por prioridade, não lê state.
  const collisionDetection = useMemo(() => priorityAwareCollisionDetection(), []);

  const moveLocally = useCallback((installationId: string, fromStageId: string, toStageId: string, newOrder: number) => {
    setColumns((prev) => {
      let moved: InstallationListItem | undefined;
      const withoutCard = prev.map((col) => {
        if (col.stage.id !== fromStageId) return col;
        moved = col.installations.find((i) => i.id === installationId);
        const remaining = col.installations.filter((i) => i.id !== installationId);
        return {
          ...col,
          installations: remaining,
          count: remaining.length,
        };
      });
      if (!moved) return prev;
      // Reaproveita pra reordenar DENTRO da mesma coluna também: o passo
      // acima já tirou o card de lá, este bota de volta na posição certa —
      // funciona igual seja fromStageId === toStageId ou não.
      return withoutCard.map((col) => {
        if (col.stage.id !== toStageId) return col;
        const movedCard = { ...moved!, stageId: toStageId, kanbanOrder: newOrder };
        const withCard = sortByPriorityThen([movedCard, ...col.installations], (a, b) =>
          a.kanbanOrder - b.kanbanOrder
        );
        return {
          ...col,
          installations: withCard,
          count: withCard.length,
        };
      });
    });
  }, []);

  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const persistMove = useCallback(
    (installationId: string, fromStageId: string, toStageId: string, newOrder: number) => {
      const snapshot = columnsRef.current;
      moveLocally(installationId, fromStageId, toStageId, newOrder);

      changeInstallationStage(installationId, toStageId, newOrder)
        .then((result) => {
          if (!result.success) {
            setColumns(snapshot);
            toast.error(result.error);
            return;
          }
          router.refresh();
        })
        .catch(() => {
          setColumns(snapshot);
          toast.error("Não foi possível mover a instalação. Tente novamente.");
        });
    },
    [moveLocally, router]
  );

  // Menu "Mover para etapa" (sem drag) — sempre entra no topo da própria
  // faixa de prioridade na coluna de destino, mesmo comportamento de antes.
  const handleMoveRequest = useCallback(
    (installationId: string, fromStageId: string, toStageId: string) => {
      if (fromStageId === toStageId) return;
      const moving = columnsRef.current
        .find((c) => c.stage.id === fromStageId)
        ?.installations.find((i) => i.id === installationId);
      const targetColumn = columnsRef.current.find((c) => c.stage.id === toStageId);
      if (!moving || !targetColumn) return;
      const newOrder = computeTopOfTierOrder(targetColumn.installations, moving.priority);
      persistMove(installationId, fromStageId, toStageId, newOrder);
    },
    [persistMove]
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    for (const column of columnsRef.current) {
      const found = column.installations.find((i) => i.id === id);
      if (found) {
        setActiveInstallation(found);
        break;
      }
    }
  }

  // Drag livre: pode soltar sobre outro card (entra bem naquela posição,
  // antes ou depois dependendo de qual metade do card foi solta) ou sobre a
  // coluna vazia/fim da lista (entra no topo da própria faixa de
  // prioridade). O collisionDetection do DndContext já garante que "over"
  // só é um card da MESMA prioridade — nunca precisa validar/desfazer aqui.
  function handleDragEnd(event: DragEndEvent) {
    setActiveInstallation(null);
    const { active, over } = event;
    if (!over) return;

    const installationId = String(active.id);
    const fromStageId = (active.data.current?.stageId as string) ?? "";
    const overData = over.data.current as { type?: string; stageId?: string } | undefined;
    const toStageId = overData?.type === "column" ? String(over.id) : overData?.stageId;
    if (!toStageId) return;

    const targetColumn = columnsRef.current.find((c) => c.stage.id === toStageId);
    if (!targetColumn) return;

    const withoutActive = targetColumn.installations.filter((i) => i.id !== installationId);
    const insertIndex = resolveInsertIndex(event, withoutActive);
    const newOrder = computeReorderValue(
      withoutActive[insertIndex - 1]?.kanbanOrder,
      withoutActive[insertIndex]?.kanbanOrder
    );

    const moving = columnsRef.current
      .find((c) => c.stage.id === fromStageId)
      ?.installations.find((i) => i.id === installationId);
    // Soltou de volta exatamente onde já estava — nada a fazer.
    if (moving && fromStageId === toStageId && moving.kanbanOrder === newOrder) return;

    persistMove(installationId, fromStageId, toStageId, newOrder);
  }

  return (
    <div className="flex flex-col gap-2">
      <KanbanMobileTabs
        stages={allStages}
        activeStageId={activeMobileStageId}
        onSelect={scrollToStage}
        countByStage={countByStage}
      />

      <DndContext
        id="installation-kanban"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={scrollRef}
          className="themed-scrollbar flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto pb-4 md:snap-none"
        >
          {columns.map((column) => (
            <div
              key={column.stage.id}
              ref={(el) => {
                columnRefs.current[column.stage.id] = el;
              }}
              className="w-[85vw] shrink-0 snap-center sm:w-80"
            >
              <InstallationKanbanColumn
                column={column}
                allStages={allStages}
                currentUser={currentUser}
                onMoveToStage={handleMoveRequest}
                atendimentoAssignableUsers={atendimentoAssignableUsers}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeInstallation && (
            <div className="w-80">
              <InstallationKanbanCard
                installation={activeInstallation}
                stages={allStages}
                currentUser={currentUser}
                onMoveToStage={() => {}}
                assignableUsers={atendimentoAssignableUsers}
                dragDisabled
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
