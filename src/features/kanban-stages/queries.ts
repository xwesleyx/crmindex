import type { KanbanBoard } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listKanbanStagesForConfig(board: KanbanBoard) {
  return prisma.kanbanStage.findMany({
    where: { board },
    orderBy: { order: "asc" },
  });
}

export type KanbanStageConfigItem = Awaited<ReturnType<typeof listKanbanStagesForConfig>>[number];
