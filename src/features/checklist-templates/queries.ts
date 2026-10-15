import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ChecklistTemplateClient = PrismaClient | Prisma.TransactionClient;

// Mesmo padrão de RegionClient (features/regions/queries.ts) — permite
// chamar dentro de um $transaction (win-automation.ts) ou fora (a tela de
// Configurações).
export async function listChecklistTemplateItems(client: ChecklistTemplateClient = prisma) {
  return client.checklistTemplateItem.findMany({ orderBy: { order: "asc" } });
}

export type ChecklistTemplateItemListItem = Awaited<
  ReturnType<typeof listChecklistTemplateItems>
>[number];
