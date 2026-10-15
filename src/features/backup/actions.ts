"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { formatBytes } from "@/lib/format-bytes";
import { backupSettingsSchema, type BackupSettingsInput } from "@/features/backup/schema";
import { saveBackupSettings } from "@/features/backup/settings";
import {
  backupFilePath,
  canRestoreHere,
  checkWritableDir,
  requestRestore,
  runBackup,
} from "@/features/backup/service";

type ActionResult = { success: true; message?: string } | { success: false; error: string };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

const DENIED = { success: false as const, error: "Somente administradores podem mexer no backup." };

export async function updateBackupSettings(input: BackupSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;

  const parsed = backupSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (parsed.data.dir) {
    const problem = await checkWritableDir(parsed.data.dir);
    if (problem) return { success: false, error: problem };
  }

  await saveBackupSettings(parsed.data, session.user.id);
  await logActivity({
    userId: session.user.id,
    action: "backup.settings_updated",
    entityType: "AppSetting",
    entityId: "backup",
    metadata: { enabled: parsed.data.enabled, time: parsed.data.time, keep: parsed.data.keep },
  });
  revalidatePath("/configuracoes/backup");
  return { success: true };
}

export async function runBackupNow(): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;

  const result = await runBackup("manual");
  revalidatePath("/configuracoes/backup");
  if (!result.ok) return { success: false, error: result.error };

  await logActivity({
    userId: session.user.id,
    action: "backup.created",
    entityType: "AppSetting",
    entityId: "backup",
    metadata: { file: result.file },
  });
  const details = [`${result.file} (${formatBytes(result.size)})`];
  if (result.mediaCopied !== null) details.push(`${result.mediaCopied} mídia(s) nova(s) copiada(s)`);
  if (result.removed > 0) details.push(`${result.removed} backup(s) antigo(s) removido(s)`);
  return { success: true, message: details.join(" · ") };
}

export async function deleteBackup(name: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;

  const file = await backupFilePath(name);
  if (!file) return { success: false, error: "Backup não encontrado." };
  await fs.unlink(file);
  await logActivity({
    userId: session.user.id,
    action: "backup.deleted",
    entityType: "AppSetting",
    entityId: "backup",
    metadata: { file: name },
  });
  revalidatePath("/configuracoes/backup");
  return { success: true };
}

export async function restoreBackup(name: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return DENIED;
  if (!canRestoreHere()) {
    return { success: false, error: "Restaurar só está disponível no CRM instalado pelo instalador." };
  }

  const file = await backupFilePath(name);
  if (!file) return { success: false, error: "Backup não encontrado." };

  // Registra antes: depois da troca este registro some junto com o banco
  // atual (que fica guardado em backups\antes-de-restaurar).
  await logActivity({
    userId: session.user.id,
    action: "backup.restored",
    entityType: "AppSetting",
    entityId: "backup",
    metadata: { file: name },
  });
  await requestRestore(file);
  return { success: true };
}
