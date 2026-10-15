import { closestCenter, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import type { Priority } from "@prisma/client";

// Dado onde o card caiu, calcula um kanbanOrder numérico que o posiciona
// exatamente ali — a técnica de "índice fracionário" (média entre os
// vizinhos) evita ter que renumerar a coluna inteira a cada arraste: só o
// card movido ganha um valor novo.
export function computeReorderValue(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 0;
}

// Posição "padrão" ao mover pro menu "Mover para etapa" (sem drag, então sem
// vizinho escolhido à mão) — topo da própria faixa de prioridade na coluna
// de destino. Mesma regra usada no servidor (changeInstallationStage /
// changeOpportunityStage) quando kanbanOrder não é informado; replicada aqui
// só pro estado otimista do cliente já nascer com o valor certo, em vez de
// ficar defasado até o próximo refresh.
export function computeTopOfTierOrder<T extends { priority: Priority; kanbanOrder: number }>(
  items: T[],
  priority: Priority
): number {
  const sameTier = items.filter((i) => i.priority === priority);
  if (sameTier.length === 0) return 0;
  return Math.min(...sameTier.map((i) => i.kanbanOrder)) - 1;
}

// Cards carregam `data: { type: "card", stageId, priority }` e colunas
// `data: { type: "column" }` (ver *-kanban-card.tsx / *-kanban-column.tsx).
type DroppableData = { type?: "card" | "column"; stageId?: string; priority?: Priority };

// Só deixa um card ser solto sobre outro card da MESMA prioridade (ou sobre
// a coluna em si, pra "jogar no fim da própria faixa") — assim a prioridade
// nunca é quebrada pelo próprio gesto de arrastar: um alvo de prioridade
// diferente simplesmente não fica "over" disponível, sem precisar validar e
// desfazer depois de soltar.
export function priorityAwareCollisionDetection(): CollisionDetection {
  return (args) => {
    const activeData = args.active.data.current as DroppableData | undefined;
    const activePriority = activeData?.priority;
    const filtered = args.droppableContainers.filter((container) => {
      const data = container.data.current as DroppableData | undefined;
      if (!data || data.type === "column") return true;
      return data.priority === activePriority;
    });
    return closestCenter({ ...args, droppableContainers: filtered });
  };
}

// A partir do resultado de um dragEnd, decide em que índice da coluna de
// destino (já sem o próprio card arrastado) o card deve entrar — usado
// pelos dois boards (comercial e instalação), que só diferem no tipo do
// item da lista.
export function resolveInsertIndex(
  event: DragEndEvent,
  targetItemsWithoutActive: { id: string }[]
): number {
  const { over } = event;
  if (!over) return targetItemsWithoutActive.length;

  const overData = over.data.current as DroppableData | undefined;
  if (overData?.type === "column") return targetItemsWithoutActive.length;

  const overId = String(over.id);
  const idx = targetItemsWithoutActive.findIndex((i) => i.id === overId);
  if (idx === -1) return targetItemsWithoutActive.length;

  // Solto na metade de baixo do card-alvo = depois dele; metade de cima =
  // antes. Sem isso, soltar em cima de qualquer card sempre empurraria pra
  // antes dele, e nunca daria pra colocar um card na última posição parando
  // exatamente sobre o último card.
  const activeRect = event.active.rect.current.translated;
  const overRect = over.rect;
  const isAfter = !!(activeRect && activeRect.top > overRect.top + overRect.height / 2);
  return isAfter ? idx + 1 : idx;
}
