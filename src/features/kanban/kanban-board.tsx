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
import { changeOpportunityStage, markOpportunityLost } from "@/features/opportunities/actions";
import type { OpportunityListItem } from "@/features/opportunities/types";
import { LOST_STAGE_KEY } from "@/features/kanban/constants";
import { KanbanCard } from "@/features/kanban/kanban-card";
import { KanbanColumn } from "@/features/kanban/kanban-column";
import { KanbanMobileTabs } from "@/features/kanban/kanban-mobile-tabs";
import {
  computeReorderValue,
  computeTopOfTierOrder,
  priorityAwareCollisionDetection,
  resolveInsertIndex,
} from "@/features/kanban/reorder";
import type { KanbanColumnData, NextTaskInfo } from "@/features/kanban/types";
import { useDragToScroll } from "@/features/kanban/use-drag-to-scroll";
import { LostReasonDialog } from "@/features/opportunities/lost-reason-dialog";
import type { AssignableUser } from "@/features/leads/types";
import type { ResolvedPermissionOverrides } from "@/lib/permissions";

export function KanbanBoard({
  initialColumns,
  nextTaskByOpportunity,
  currentUser,
  assignableUsers,
  permissionOverrides,
}: {
  initialColumns: KanbanColumnData[];
  nextTaskByOpportunity: Record<string, NextTaskInfo | undefined>;
  currentUser: { id: string; role: UserRole };
  assignableUsers: AssignableUser[];
  permissionOverrides?: ResolvedPermissionOverrides;
}) {
  const [columns, setColumns] = useState(initialColumns);
  // Reconcilia com a verdade do servidor quando o server component pai
  // re-renderiza com dados novos (após router.refresh() — outro usuário
  // moveu algo, ou o próprio refresh pós-mutação). setState durante o
  // render, não num efeito — padrão documentado do React para "ajustar
  // estado quando uma prop muda", sem o round-trip extra de um useEffect.
  const [prevInitialColumns, setPrevInitialColumns] = useState(initialColumns);
  if (initialColumns !== prevInitialColumns) {
    setPrevInitialColumns(initialColumns);
    setColumns(initialColumns);
  }

  const [activeOpportunity, setActiveOpportunity] = useState<OpportunityListItem | null>(null);
  const [lostTarget, setLostTarget] = useState<{
    opportunityId: string;
    fromStageId: string;
  } | null>(null);
  const [activeMobileStageId, setActiveMobileStageId] = useState(
    initialColumns[0]?.stage.id ?? ""
  );
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useDragToScroll<HTMLDivElement>();
  const router = useRouter();

  // Deriva da prop (initialColumns), não do state local `columns` — a lista
  // de etapas não muda quando um card é só arrastado entre elas, e mantendo
  // essa referência estável entre re-renders de drag, handleMoveRequest
  // (abaixo) também fica estável, o que permite React.memo funcionar de
  // verdade em KanbanColumn/KanbanCard (perf — antes tudo recalculava e
  // reredenrizava a cada drag, mesmo cards fora da coluna afetada).
  const allStages = useMemo(() => initialColumns.map((c) => c.stage), [initialColumns]);

  const countByStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const column of columns) map[column.stage.id] = column.count;
    return map;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  // Estável entre renders (sem deps) — só filtra por prioridade, não lê state.
  const collisionDetection = useMemo(() => priorityAwareCollisionDetection(), []);

  // Navegação explícita pro mobile (seção 5 do escopo de refinamento): a
  // aba rola o carrossel até a coluna, sem depender de arrastar. Não há
  // drag-and-drop duplicado — é o mesmo <KanbanColumn>, só um scroll com
  // snap por trás.
  const scrollToStage = useCallback((stageId: string) => {
    setActiveMobileStageId(stageId);
    columnRefs.current[stageId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, []);

  const moveLocally = useCallback(
    (opportunityId: string, fromStageId: string, toStageId: string, newOrder: number) => {
      setColumns((prev) => {
        let moved: OpportunityListItem | undefined;
        const withoutCard = prev.map((col) => {
          if (col.stage.id !== fromStageId) return col;
          moved = col.opportunities.find((o) => o.id === opportunityId);
          const remaining = col.opportunities.filter((o) => o.id !== opportunityId);
          return {
            ...col,
            opportunities: remaining,
            count: remaining.length,
            totalCents: remaining.reduce((sum, o) => sum + o.estimatedValueCents, 0),
          };
        });
        if (!moved) return prev;
        // Reaproveita pra reordenar DENTRO da mesma coluna também: o passo
        // acima já tirou o card de lá, este bota de volta na posição certa —
        // funciona igual seja fromStageId === toStageId ou não.
        return withoutCard.map((col) => {
          if (col.stage.id !== toStageId) return col;
          const movedCard = { ...moved!, stageId: toStageId, kanbanOrder: newOrder };
          const withCard = sortByPriorityThen([movedCard, ...col.opportunities], (a, b) =>
            a.kanbanOrder - b.kanbanOrder
          );
          return {
            ...col,
            opportunities: withCard,
            count: withCard.length,
            totalCents: withCard.reduce((sum, o) => sum + o.estimatedValueCents, 0),
          };
        });
      });
    },
    []
  );

  // Ref espelhando `columns` (sincronizado durante o render, mesmo padrão já
  // usado acima pra `prevInitialColumns`) — persistStageChange lê daqui em
  // vez de fechar sobre o state `columns` diretamente, senão a função
  // mudaria de referência a cada drag e quebraria o React.memo dos cards.
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const persistMove = useCallback(
    (opportunityId: string, fromStageId: string, toStageId: string, newOrder: number) => {
      const snapshot = columnsRef.current;
      moveLocally(opportunityId, fromStageId, toStageId, newOrder);

      changeOpportunityStage(opportunityId, toStageId, newOrder)
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
          toast.error("Não foi possível mover a oportunidade. Tente novamente.");
        });
    },
    [moveLocally, router]
  );

  // Menu "Mover para etapa" (sem drag) — sempre entra no topo da própria
  // faixa de prioridade na coluna de destino, mesmo comportamento de antes.
  // "Venda Perdida" continua interceptado pelo diálogo de motivo.
  const handleMoveRequest = useCallback(
    (opportunityId: string, fromStageId: string, toStageId: string) => {
      if (fromStageId === toStageId) return;
      const targetStage = allStages.find((s) => s.id === toStageId);
      if (targetStage?.key === LOST_STAGE_KEY) {
        setLostTarget({ opportunityId, fromStageId });
        return;
      }
      const moving = columnsRef.current
        .find((c) => c.stage.id === fromStageId)
        ?.opportunities.find((o) => o.id === opportunityId);
      const targetColumn = columnsRef.current.find((c) => c.stage.id === toStageId);
      if (!moving || !targetColumn) return;
      const newOrder = computeTopOfTierOrder(targetColumn.opportunities, moving.priority);
      persistMove(opportunityId, fromStageId, toStageId, newOrder);
    },
    [allStages, persistMove]
  );

  function handleDragStart(event: DragStartEvent) {
    const oppId = String(event.active.id);
    for (const column of columnsRef.current) {
      const found = column.opportunities.find((o) => o.id === oppId);
      if (found) {
        setActiveOpportunity(found);
        break;
      }
    }
  }

  // Drag livre: pode soltar sobre outro card (entra bem naquela posição,
  // antes ou depois dependendo de qual metade do card foi solta) ou sobre a
  // coluna vazia/fim da lista (entra no topo da própria faixa de
  // prioridade). O collisionDetection do DndContext já garante que "over"
  // só é um card da MESMA prioridade — nunca precisa validar/desfazer aqui.
  // "Venda Perdida" continua interceptado pelo diálogo de motivo, igual ao
  // menu.
  function handleDragEnd(event: DragEndEvent) {
    setActiveOpportunity(null);
    const { active, over } = event;
    if (!over) return;

    const opportunityId = String(active.id);
    const fromStageId = (active.data.current?.stageId as string) ?? "";
    const overData = over.data.current as { type?: string; stageId?: string } | undefined;
    const toStageId = overData?.type === "column" ? String(over.id) : overData?.stageId;
    if (!toStageId) return;

    if (fromStageId === toStageId) {
      const targetColumn = columnsRef.current.find((c) => c.stage.id === toStageId);
      if (!targetColumn) return;
      const withoutActive = targetColumn.opportunities.filter((o) => o.id !== opportunityId);
      const insertIndex = resolveInsertIndex(event, withoutActive);
      const newOrder = computeReorderValue(
        withoutActive[insertIndex - 1]?.kanbanOrder,
        withoutActive[insertIndex]?.kanbanOrder
      );
      const moving = targetColumn.opportunities.find((o) => o.id === opportunityId);
      // Soltou de volta exatamente onde já estava — nada a fazer.
      if (moving && moving.kanbanOrder === newOrder) return;
      persistMove(opportunityId, fromStageId, toStageId, newOrder);
      return;
    }

    const targetStage = allStages.find((s) => s.id === toStageId);
    if (targetStage?.key === LOST_STAGE_KEY) {
      setLostTarget({ opportunityId, fromStageId });
      return;
    }

    const targetColumn = columnsRef.current.find((c) => c.stage.id === toStageId);
    if (!targetColumn) return;
    const withoutActive = targetColumn.opportunities.filter((o) => o.id !== opportunityId);
    const insertIndex = resolveInsertIndex(event, withoutActive);
    const newOrder = computeReorderValue(
      withoutActive[insertIndex - 1]?.kanbanOrder,
      withoutActive[insertIndex]?.kanbanOrder
    );
    persistMove(opportunityId, fromStageId, toStageId, newOrder);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <KanbanMobileTabs
          stages={allStages}
          activeStageId={activeMobileStageId}
          onSelect={scrollToStage}
          countByStage={countByStage}
        />

        <DndContext
          id="commercial-kanban"
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
                <KanbanColumn
                  column={column}
                  allStages={allStages}
                  nextTaskByOpportunity={nextTaskByOpportunity}
                  currentUser={currentUser}
                  onMoveToStage={handleMoveRequest}
                  assignableUsers={assignableUsers}
                  className="w-full"
                  permissionOverrides={permissionOverrides}
                />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeOpportunity && (
              <div className="w-80">
                <KanbanCard
                  opportunity={activeOpportunity}
                  stages={allStages}
                  nextTask={nextTaskByOpportunity[activeOpportunity.id]}
                  currentUser={currentUser}
                  onMoveToStage={() => {}}
                  assignableUsers={assignableUsers}
                  dragDisabled
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <LostReasonDialog
        open={!!lostTarget}
        onOpenChange={(open) => !open && setLostTarget(null)}
        onConfirm={async (data) => {
          if (!lostTarget) return { success: false, error: "Nada selecionado." };
          const result = await markOpportunityLost(lostTarget.opportunityId, data);
          if (result.success) {
            const lostStage = allStages.find((s) => s.key === LOST_STAGE_KEY);
            if (lostStage) {
              const targetColumn = columnsRef.current.find((c) => c.stage.id === lostStage.id);
              const moving = columnsRef.current
                .find((c) => c.stage.id === lostTarget.fromStageId)
                ?.opportunities.find((o) => o.id === lostTarget.opportunityId);
              const newOrder = targetColumn && moving
                ? computeTopOfTierOrder(targetColumn.opportunities, moving.priority)
                : 0;
              moveLocally(lostTarget.opportunityId, lostTarget.fromStageId, lostStage.id, newOrder);
            }
            router.refresh();
          }
          setLostTarget(null);
          return result;
        }}
      />
    </>
  );
}
