import type { Priority } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

// Priority é um enum compartilhado por Lead/Opportunity/Task/Installation —
// vive em lib/, não em features/leads/, porque não é conceito exclusivo de
// lead (era reexportado de lá antes, o que confundia a origem).
export const PRIORITY_LABELS: Record<Priority, string> = {
  BAIXA: "Baixa",
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  BAIXA: "neutral",
  NORMAL: "neutral",
  ALTA: "warning",
  URGENTE: "destructive",
};

// Quanto maior, mais urgente — usado pra ordenar cards de kanban (urgente e
// alta primeiro) sem depender da ordem de declaração do enum (SQLite não
// tem enum nativo pra usar como ORDER BY direto).
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENTE: 3,
  ALTA: 2,
  NORMAL: 1,
  BAIXA: 0,
};

export function sortByPriorityThen<T extends { priority: Priority }>(
  items: T[],
  tiebreak: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    return diff !== 0 ? diff : tiebreak(a, b);
  });
}
