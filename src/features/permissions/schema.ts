import { z } from "zod";

import { MODULES, type ModuleKey } from "@/lib/permissions";

const MODULE_KEYS = Object.values(MODULES) as [ModuleKey, ...ModuleKey[]];

// Espelha ResolvedPermissionOverrides (src/lib/permissions.ts) — é o formato
// já pronto pra virar as 3 colunas JSON-como-texto do UserPermissionOverride.
// capabilities fica com chave string solta (não z.enum) porque só chaves
// divergentes de "inherit" são enviadas — validar como Record fechado
// forçaria todas as chaves presentes; quem realmente restringe a um
// CapabilityKey conhecido é hasCapability() no ponto de uso.
export const updatePermissionOverrideSchema = z.object({
  modulesGranted: z.array(z.enum(MODULE_KEYS)),
  modulesRevoked: z.array(z.enum(MODULE_KEYS)),
  capabilities: z.record(z.string(), z.boolean()),
});

export type UpdatePermissionOverrideInput = z.infer<typeof updatePermissionOverrideSchema>;
