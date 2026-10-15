import type { OpportunityListItem } from "@/features/opportunities/types";

export type KanbanStageInfo = { id: string; name: string; key: string; order: number; color: string };

export type KanbanColumnData = {
  stage: KanbanStageInfo;
  opportunities: OpportunityListItem[];
  count: number;
  totalCents: number;
};

export type NextTaskInfo = { id: string; title: string; dueAt: Date | null };
