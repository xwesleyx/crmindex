import type { Prisma } from "@prisma/client";

export const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  reminders: { orderBy: { minutesBefore: "asc" } },
} as const satisfies Prisma.TaskInclude;

export type TaskItem = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;
