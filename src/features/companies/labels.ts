import type { BadgeTone } from "@/components/status-badge";

export { LEAD_ORIGIN_LABELS as ORIGIN_LABELS } from "@/features/leads/labels";

export const ACTIVE_STATUS_TONE: Record<"true" | "false", BadgeTone> = {
  true: "success",
  false: "neutral",
};

export const ACTIVE_STATUS_LABEL = {
  true: "Ativo",
  false: "Inativo",
} as const;
