import type { CustomerStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

export const CUSTOMER_STATUS_TONE: Record<CustomerStatus, BadgeTone> = {
  ATIVO: "success",
  INATIVO: "neutral",
};
