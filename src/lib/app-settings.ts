import { prisma } from "@/lib/prisma";

// Prioridade: valor salvo no banco (via UI de Configurações) > variável de
// ambiente (.env) — assim um .env já configurado continua funcionando sem
// precisar preencher de novo pela tela, mas a tela sempre pode sobrescrever.
export async function getAppSetting(key: string, envFallback?: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value) return row.value;
  return envFallback ?? null;
}

export async function setAppSetting(key: string, value: string, updatedBy?: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}

export async function deleteAppSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}
