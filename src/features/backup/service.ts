import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { setAppSetting, getAppSetting } from "@/lib/app-settings";
import { createNotification } from "@/lib/notifications";
import { brasiliaNow, timeToMinutes } from "@/lib/brasilia-time";
import { BACKUP_KEYS, getBackupSettings, resolveBackupDir } from "@/features/backup/settings";
import { resolveMediaDir } from "@/features/cleanup/media-dir";

// Backup do banco (Configurações > Backup). Cópia feita pelo próprio
// SQLite (VACUUM INTO): consistente mesmo com gente usando o CRM na hora e
// com o banco em modo WAL — copiar o arquivo .db na mão poderia sair
// corrompido. Os arquivos ficam como crm-backup-AAAA-MM-DD_HH-MM-SS.db.
export const BACKUP_FILE_PATTERN = /^crm-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.db$/;
export const MEDIA_MIRROR_FOLDER = "midias";

export type BackupFile = { name: string; size: number; createdAt: string };

export type BackupResult =
  | { ok: true; file: string; size: number; mediaCopied: number | null; removed: number }
  | { ok: false; error: string };

const stampFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function backupFileName(now = new Date()): string {
  const p = Object.fromEntries(stampFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `crm-backup-${p.year}-${p.month}-${p.day}_${p.hour}-${p.minute}-${p.second}.db`;
}

// Cria a pasta e confere se dá pra gravar nela (HD externo desconectado,
// pasta de rede fora do ar, sem permissão...). null = tudo certo.
export async function checkWritableDir(dir: string): Promise<string | null> {
  if (!path.isAbsolute(dir)) return "Informe o caminho completo da pasta (ex.: D:\\Backups\\CRM).";
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.teste-gravacao-${process.pid}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
    return null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") return "Sem permissão para gravar nessa pasta.";
    if (code === "ENOENT") return "Caminho não encontrado (o disco ou a pasta de rede está conectado?).";
    return `Não foi possível usar essa pasta (${code ?? "erro desconhecido"}).`;
  }
}

export async function listBackups(dir: string): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names
      .filter((name) => BACKUP_FILE_PATTERN.test(name))
      .map(async (name) => {
        const stat = await fs.stat(path.join(dir, name));
        return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
  );
  return files.sort((a, b) => b.name.localeCompare(a.name));
}

// Caminho de um backup da lista — só nomes no formato esperado e dentro da
// pasta configurada (nada de "..\..\").
export async function backupFilePath(name: string): Promise<string | null> {
  if (!BACKUP_FILE_PATTERN.test(name)) return null;
  const dir = resolveBackupDir(await getBackupSettings());
  const file = path.join(dir, name);
  try {
    await fs.access(file);
    return file;
  } catch {
    return null;
  }
}

// Cópia incremental: os nomes das mídias são aleatórios e o conteúdo nunca
// muda, então basta copiar o que ainda não está lá. Nunca apaga — o que a
// Limpeza remover do CRM continua guardado no backup.
async function mirrorMedia(target: string): Promise<number | null> {
  const source = resolveMediaDir();
  if (!source) return null;
  await fs.mkdir(target, { recursive: true });
  const [sourceNames, targetNames] = await Promise.all([fs.readdir(source), fs.readdir(target)]);
  const existing = new Set(targetNames);
  let copied = 0;
  for (const name of sourceNames) {
    if (existing.has(name)) continue;
    const from = path.join(source, name);
    if (!(await fs.stat(from)).isFile()) continue;
    await fs.copyFile(from, path.join(target, name));
    copied++;
  }
  return copied;
}

async function applyRetention(dir: string, keep: number): Promise<number> {
  const files = await listBackups(dir);
  let removed = 0;
  for (const file of files.slice(keep)) {
    try {
      await fs.unlink(path.join(dir, file.name));
      removed++;
    } catch {
      // arquivo aberto/sumiu — tenta de novo no próximo backup
    }
  }
  return removed;
}

const globalState = globalThis as typeof globalThis & { __backupRunning?: boolean };

export async function runBackup(trigger: "manual" | "auto"): Promise<BackupResult> {
  if (globalState.__backupRunning) return { ok: false, error: "Já tem um backup em andamento." };
  globalState.__backupRunning = true;
  const settings = await getBackupSettings();
  const dir = resolveBackupDir(settings);
  let result: BackupResult;
  try {
    const problem = await checkWritableDir(dir);
    if (problem) throw new Error(problem);

    let file = path.join(dir, backupFileName());
    for (let i = 2; await exists(file); i++) file = file.replace(/(-\d+)?\.db$/, `-${i}.db`);
    await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const size = (await fs.stat(file)).size;

    const mediaCopied = settings.includeMedia ? await mirrorMedia(path.join(dir, MEDIA_MIRROR_FOLDER)) : null;
    const removed = await applyRetention(dir, settings.keep);
    result = { ok: true, file: path.basename(file), size, mediaCopied, removed };
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    globalState.__backupRunning = false;
  }

  const K = BACKUP_KEYS;
  await Promise.all([
    setAppSetting(K.lastRunAt, new Date().toISOString()),
    setAppSetting(K.lastStatus, result.ok ? "ok" : "error"),
    setAppSetting(
      K.lastMessage,
      result.ok
        ? `${trigger === "auto" ? "Automático" : "Manual"}: ${result.file}`
        : `${trigger === "auto" ? "Automático" : "Manual"}: ${result.error}`
    ),
  ]);

  // Falha do automático ninguém veria — avisa os administradores no sino.
  if (!result.ok && trigger === "auto") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          title: "Backup automático falhou",
          message: (result as { error: string }).error,
          link: "/configuracoes/backup",
        })
      )
    );
  }
  return result;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Chamado a cada minuto (instrumentation.ts). Passou do horário num dia
// marcado e ainda não rodou hoje -> faz. Se o computador estava desligado
// no horário, faz assim que o CRM subir no mesmo dia.
export async function runScheduledBackup(): Promise<void> {
  const settings = await getBackupSettings();
  if (!settings.enabled) return;
  const now = brasiliaNow();
  const at = timeToMinutes(settings.time);
  if (at === null || now.minutes < at || !settings.days.includes(now.weekday)) return;
  if ((await getAppSetting(BACKUP_KEYS.lastRunDate)) === now.date) return;
  // Marca antes de rodar: se falhar, não fica tentando a cada minuto (o
  // admin é avisado e pode rodar na mão).
  await setAppSetting(BACKUP_KEYS.lastRunDate, now.date);
  await runBackup("auto");
}

// Restaurar só no CRM instalado: o launcher troca o banco enquanto o CRM
// está parado (ver installer/launcher/database.js). Aqui só grava o pedido
// e encerra o servidor — o launcher sobe de novo em seguida.
export function canRestoreHere(): boolean {
  return process.env.INTEGRA_INSTALLED === "1" && Boolean(process.env.INTEGRA_DATA_DIR);
}

export async function requestRestore(file: string): Promise<void> {
  const dataDir = process.env.INTEGRA_DATA_DIR!;
  await fs.writeFile(path.join(dataDir, "restore-pending.json"), JSON.stringify({ file, requestedAt: new Date() }));
  setTimeout(() => process.exit(0), 1500);
}
