import { prisma } from "@/lib/prisma";
import type { CapabilityKey, ModuleKey, ResolvedPermissionOverrides } from "@/lib/permissions";

const EMPTY_OVERRIDES: ResolvedPermissionOverrides = {
  modulesGranted: [],
  modulesRevoked: [],
  capabilities: {},
};

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends object>(raw: string): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

// Ponto único de leitura dos overrides — usado tanto no layout autenticado
// (menu da sidebar) quanto nos guards de página e nas Server Actions que
// checam uma capacidade específica. Sempre por request, nunca cacheado no
// JWT (ver justificativa no plano: quem edita é o ADMIN, não o próprio
// usuário, então não há como disparar useSession().update() na sessão dele).
export async function getResolvedPermissionOverrides(
  userId: string
): Promise<ResolvedPermissionOverrides> {
  const row = await prisma.userPermissionOverride.findUnique({ where: { userId } });
  if (!row) return EMPTY_OVERRIDES;

  return {
    modulesGranted: parseJsonArray<ModuleKey>(row.modulesGranted),
    modulesRevoked: parseJsonArray<ModuleKey>(row.modulesRevoked),
    capabilities: parseJsonObject<Partial<Record<CapabilityKey, boolean>>>(row.capabilities),
  };
}
