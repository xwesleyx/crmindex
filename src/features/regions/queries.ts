import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listRegions(includeArchived = false) {
  return prisma.region.findMany({
    where: includeArchived ? {} : { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export type RegionListItem = Awaited<ReturnType<typeof listRegions>>[number];

type RegionClient = PrismaClient | Prisma.TransactionClient;

// Região usada quando uma Empresa/Cliente é criado sem escolher uma (seção
// "qualquer empresa, cliente... virá nessa padrão") — aceita um client de
// transação (mesmo padrão de logActivity em src/lib/activity.ts) pra ser
// chamada de dentro da automação de Venda Ganha, que roda tudo num só
// $transaction.
export async function getDefaultRegionId(client: RegionClient = prisma): Promise<string | null> {
  const region = await client.region.findFirst({ where: { isDefault: true } });
  return region?.id ?? null;
}
