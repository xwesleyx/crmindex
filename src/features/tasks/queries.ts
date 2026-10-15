import { prisma } from "@/lib/prisma";
import { TASK_INCLUDE } from "@/features/tasks/types";

export async function getTasksForEntity(entityType: string, entityId: string) {
  return prisma.task.findMany({
    where: { entityType, entityId },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    include: TASK_INCLUDE,
  });
}
