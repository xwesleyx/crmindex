import fs from "node:fs/promises";
import path from "node:path";
import { subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { brasiliaNow, timeToMinutes } from "@/lib/brasilia-time";
import { formatBytes } from "@/lib/format-bytes";
import { getBackupSettings, resolveBackupDir } from "@/features/backup/settings";
import { MEDIA_MIRROR_FOLDER } from "@/features/backup/service";
import { MEDIA_FILE_PATTERN, resolveMediaDir } from "@/features/cleanup/media-dir";
import {
  CLEANUP_KEYS,
  MEDIA_KINDS,
  getCleanupSettings,
  setCleanupLastRun,
  type MediaKind,
} from "@/features/cleanup/settings";

// Mídias do WhatsApp (Configurações > Limpeza): os arquivos ficam na pasta
// do serviço do WhatsApp; cada um é ligado à mensagem que o usa pelo nome
// no fim do mediaUrl. Ao apagar, a mensagem continua no histórico e o balão
// passa a dizer que a mídia foi removida (Message.mediaDeletedAt).

export type MediaFile = {
  name: string;
  size: number;
  kind: MediaKind;
  // data da mensagem (ou do arquivo, se não achar a mensagem)
  date: string;
  contactId: string | null;
  contactName: string | null;
  conversationId: string | null;
  direction: "INBOUND" | "OUTBOUND" | null;
};

const EXTENSION_KIND: Record<string, MediaKind> = {
  jpg: "IMAGE",
  jpeg: "IMAGE",
  png: "IMAGE",
  gif: "IMAGE",
  webp: "IMAGE",
  heic: "IMAGE",
  mp4: "VIDEO",
  "3gp": "VIDEO",
  mov: "VIDEO",
  webm: "VIDEO",
  mkv: "VIDEO",
  ogg: "AUDIO",
  oga: "AUDIO",
  opus: "AUDIO",
  mp3: "AUDIO",
  m4a: "AUDIO",
  aac: "AUDIO",
  amr: "AUDIO",
  wav: "AUDIO",
};

function fileNameFromUrl(url: string): string {
  return url.split(/[/?#]/).filter(Boolean).at(-1) ?? "";
}

// Lista tudo o que está na pasta, com a mensagem de cada arquivo. Um CRM
// grande tem alguns milhares de arquivos — cabe tranquilo na memória.
export async function listMediaFiles(): Promise<MediaFile[]> {
  const dir = resolveMediaDir();
  if (!dir) return [];
  const names = (await fs.readdir(dir)).filter((name) => MEDIA_FILE_PATTERN.test(name));

  const messages = await prisma.message.findMany({
    where: { mediaUrl: { not: null }, mediaDeletedAt: null },
    select: {
      type: true,
      mediaUrl: true,
      createdAt: true,
      direction: true,
      conversationId: true,
      conversation: { select: { contact: { select: { id: true, name: true } } } },
    },
  });
  const byName = new Map(messages.map((message) => [fileNameFromUrl(message.mediaUrl!), message]));

  const files = await Promise.all(
    names.map(async (name): Promise<MediaFile | null> => {
      let stat;
      try {
        stat = await fs.stat(path.join(dir, name));
      } catch {
        return null;
      }
      if (!stat.isFile()) return null;
      const message = byName.get(name);
      const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
      const kind =
        message && (MEDIA_KINDS as readonly string[]).includes(message.type)
          ? (message.type as MediaKind)
          : (EXTENSION_KIND[extension] ?? "DOCUMENT");
      return {
        name,
        size: stat.size,
        kind,
        date: (message?.createdAt ?? stat.mtime).toISOString(),
        contactId: message?.conversation.contact.id ?? null,
        contactName: message?.conversation.contact.name ?? null,
        conversationId: message?.conversationId ?? null,
        direction: message?.direction ?? null,
      };
    })
  );
  return files.filter((file): file is MediaFile => file !== null);
}

// contactId: só as mídias das conversas desse contato (busca por nome/telefone).
export type MediaFilter = { kinds: MediaKind[]; olderThanMonths: number; contactId?: string | null };

export function filterMedia(files: MediaFile[], filter: MediaFilter, now = new Date()): MediaFile[] {
  const limit = filter.olderThanMonths > 0 ? subMonths(now, filter.olderThanMonths).getTime() : null;
  return files.filter(
    (file) =>
      filter.kinds.includes(file.kind) &&
      (limit === null || new Date(file.date).getTime() < limit) &&
      (!filter.contactId || file.contactId === filter.contactId)
  );
}

export type DeleteResult = { deleted: number; bytes: number; failed: number; backedUp: number };

// Apaga os arquivos (só nomes válidos, só de dentro da pasta de mídias) e
// marca as mensagens. backupFirst: copia antes pra pasta de backup\midias.
export async function deleteMediaFiles(names: string[], backupFirst: boolean): Promise<DeleteResult> {
  const dir = resolveMediaDir();
  const result: DeleteResult = { deleted: 0, bytes: 0, failed: 0, backedUp: 0 };
  if (!dir) return result;

  const valid = [...new Set(names)].filter((name) => MEDIA_FILE_PATTERN.test(name));
  const backupTarget = backupFirst ? path.join(resolveBackupDir(await getBackupSettings()), MEDIA_MIRROR_FOLDER) : null;
  if (backupTarget) await fs.mkdir(backupTarget, { recursive: true });

  const deletedNames: string[] = [];
  for (const name of valid) {
    const file = path.join(dir, name);
    try {
      const { size } = await fs.stat(file);
      if (backupTarget) {
        const copy = path.join(backupTarget, name);
        try {
          await fs.access(copy);
        } catch {
          await fs.copyFile(file, copy);
          result.backedUp++;
        }
      }
      await fs.unlink(file);
      result.deleted++;
      result.bytes += size;
      deletedNames.push(name);
    } catch {
      // Sem cópia de segurança não apaga — conta como falha.
      result.failed++;
    }
  }

  // SQLite limita a quantidade de condições por consulta — em lotes.
  const now = new Date();
  for (let i = 0; i < deletedNames.length; i += 200) {
    const chunk = deletedNames.slice(i, i + 200);
    await prisma.message.updateMany({
      where: { mediaDeletedAt: null, OR: chunk.map((name) => ({ mediaUrl: { endsWith: `/${name}` } })) },
      data: { mediaDeletedAt: now },
    });
  }
  return result;
}

export function describeDeleteResult(result: DeleteResult): string {
  const parts = [`${result.deleted} arquivo(s) apagado(s), ${formatBytes(result.bytes)} liberados`];
  if (result.backedUp > 0) parts.push(`${result.backedUp} copiado(s) antes para o backup`);
  if (result.failed > 0) parts.push(`${result.failed} não puderam ser apagados`);
  return parts.join(" · ");
}

// Chamado a cada minuto (instrumentation.ts), igual ao backup: uma vez por
// dia, depois do horário escolhido.
export async function runScheduledCleanup(): Promise<void> {
  const settings = await getCleanupSettings();
  if (!settings.enabled || settings.kinds.length === 0) return;
  const now = brasiliaNow();
  const at = timeToMinutes(settings.time);
  if (at === null || now.minutes < at) return;
  if ((await getAppSetting(CLEANUP_KEYS.lastRunDate)) === now.date) return;
  await setAppSetting(CLEANUP_KEYS.lastRunDate, now.date);

  const targets = filterMedia(await listMediaFiles(), { kinds: settings.kinds, olderThanMonths: settings.months });
  const result = await deleteMediaFiles(
    targets.map((file) => file.name),
    settings.backupFirst
  );
  await setCleanupLastRun(`Automática: ${describeDeleteResult(result)}`);
}
