import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type LogActivityInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

type ActivityClient = PrismaClient | Prisma.TransactionClient;

// Registra ações de auditoria (seção 19/24 do escopo). Nunca deve lançar —
// uma falha ao gravar log não pode derrubar a operação principal, nem dentro
// de uma transação (passe `tx` como segundo argumento para o registro fazer
// parte do mesmo commit/rollback — seção 30 da Etapa 5).
export async function logActivity(
  input: LogActivityInput,
  client: ActivityClient = prisma
): Promise<void> {
  try {
    await client.activity.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar activity", error);
  }
}
