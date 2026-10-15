import type { TaskStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  PENDENTE: "neutral",
  EM_ANDAMENTO: "info",
  CONCLUIDA: "success",
};
