"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { cleanupSettingsSchema, mediaFilterSchema, type CleanupSettingsInput } from "@/features/cleanup/schema";
import { saveCleanupSettings, setCleanupLastRun } from "@/features/cleanup/settings";
import { searchContactsForCustomer } from "@/features/customers/queries";
import {
  deleteMediaFiles,
  describeDeleteResult,
  filterMedia,
  listMediaFiles,
  type MediaFilter,
} from "@/features/cleanup/service";

type ActionResult = { success: true; message?: string } | { success: false; error: string };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const DENIED = { success: false as const, error: "Somente administradores podem fazer a limpeza." };

export async function updateCleanupSettings(input: CleanupSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;

  const parsed = cleanupSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.enabled && parsed.data.kinds.length === 0) {
    return { success: false, error: "Escolha pelo menos um tipo de mídia para a limpeza automática." };
  }

  await saveCleanupSettings(parsed.data, session.user.id);
  await logActivity({
    userId: session.user.id,
    action: "cleanup.settings_updated",
    entityType: "AppSetting",
    entityId: "cleanup",
    metadata: { enabled: parsed.data.enabled, months: parsed.data.months, kinds: parsed.data.kinds },
  });
  revalidatePath("/configuracoes/limpeza");
  return { success: true };
}

async function finishDelete(userId: string, names: string[], backupFirst: boolean, how: string) {
  const result = await deleteMediaFiles(names, backupFirst);
  const message = describeDeleteResult(result);
  await setCleanupLastRun(`Manual: ${message}`);
  await logActivity({
    userId,
    action: "cleanup.media_deleted",
    entityType: "AppSetting",
    entityId: "cleanup",
    metadata: { how, deleted: result.deleted, bytes: result.bytes, failed: result.failed },
  });
  revalidatePath("/configuracoes/limpeza");
  return result.deleted === 0 && result.failed > 0
    ? ({ success: false, error: message } as const)
    : ({ success: true, message } as const);
}

export type MediaContactOption = {
  id: string;
  name: string;
  phone: string | null;
  companyName: string | null;
  mediaCount: number;
};

// Busca de contato (nome ou telefone) da galeria da Limpeza — mostra
// quantas mídias cada um tem guardadas.
export async function searchMediaContacts(q: string): Promise<MediaContactOption[]> {
  const session = await requireAdminSession();
  if (!session) return [];
  const contacts = await searchContactsForCustomer(String(q ?? "").slice(0, 100));
  if (contacts.length === 0) return [];
  const counts = new Map<string, number>();
  for (const file of await listMediaFiles()) {
    if (file.contactId) counts.set(file.contactId, (counts.get(file.contactId) ?? 0) + 1);
  }
  return contacts
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.whatsapp ?? contact.phone,
      companyName: contact.company ? contact.company.tradeName || contact.company.legalName : null,
      mediaCount: counts.get(contact.id) ?? 0,
    }))
    .sort((a, b) => b.mediaCount - a.mediaCount);
}

export async function deleteSelectedMedia(names: string[], backupFirst: boolean): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;
  if (!Array.isArray(names) || names.length === 0) return { success: false, error: "Nenhuma mídia selecionada." };
  return finishDelete(session.user.id, names.map(String), Boolean(backupFirst), "selecionadas");
}

export async function deleteFilteredMedia(filter: MediaFilter, backupFirst: boolean): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;
  const parsed = mediaFilterSchema.safeParse(filter);
  if (!parsed.success) return { success: false, error: "Filtro inválido." };

  const targets = filterMedia(await listMediaFiles(), parsed.data);
  if (targets.length === 0) return { success: false, error: "Nenhuma mídia neste filtro." };
  return finishDelete(
    session.user.id,
    targets.map((file) => file.name),
    Boolean(backupFirst),
    "filtro"
  );
}
