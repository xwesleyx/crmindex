import type { InstallationStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const INSTALLATION_STATUS_LABELS: Record<InstallationStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const INSTALLATION_STATUS_TONE: Record<InstallationStatus, BadgeTone> = {
  EM_ANDAMENTO: "info",
  CONCLUIDA: "success",
  CANCELADA: "destructive",
};
