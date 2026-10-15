import path from "node:path";

import { getAppSetting, setAppSetting } from "@/lib/app-settings";

// Configurações > Backup — guardado em AppSetting como as demais configs.
export const BACKUP_KEYS = {
  enabled: "backup.enabled",
  time: "backup.time",
  days: "backup.days",
  dir: "backup.dir",
  keep: "backup.keep",
  includeMedia: "backup.includeMedia",
  lastRunDate: "backup.lastRunDate",
  lastRunAt: "backup.lastRunAt",
  lastStatus: "backup.lastStatus",
  lastMessage: "backup.lastMessage",
} as const;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export type BackupSettings = {
  enabled: boolean;
  time: string; // HH:MM (Brasília)
  days: number[]; // 0 = domingo
  dir: string; // "" = pasta padrão
  keep: number;
  includeMedia: boolean;
};

export type BackupStatus = {
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | null;
  lastMessage: string | null;
};

// Ligado por padrão: numa instalação nova o cliente já fica protegido sem
// precisar lembrar de configurar.
const DEFAULTS: BackupSettings = {
  enabled: true,
  time: "12:00",
  days: ALL_WEEKDAYS,
  dir: "",
  keep: 7,
  includeMedia: false,
};

// Pasta padrão: a do CRM instalado (%ProgramData%\IntegraCRM\backups, vem
// do launcher) ou, no desenvolvimento, ./backups.
export function defaultBackupDir(): string {
  return process.env.INTEGRA_BACKUP_DIR || path.join(process.cwd(), "backups");
}

export function resolveBackupDir(settings: Pick<BackupSettings, "dir">): string {
  return settings.dir.trim() || defaultBackupDir();
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const K = BACKUP_KEYS;
  const [enabled, time, days, dir, keep, includeMedia] = await Promise.all([
    getAppSetting(K.enabled),
    getAppSetting(K.time),
    getAppSetting(K.days),
    getAppSetting(K.dir),
    getAppSetting(K.keep),
    getAppSetting(K.includeMedia),
  ]);
  const parsedDays = days
    ? days
        .split(",")
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : DEFAULTS.days;
  const parsedKeep = Number(keep);
  return {
    enabled: enabled === null ? DEFAULTS.enabled : enabled === "true",
    time: time ?? DEFAULTS.time,
    days: days === "none" ? [] : parsedDays,
    dir: dir ?? DEFAULTS.dir,
    keep: Number.isInteger(parsedKeep) && parsedKeep > 0 ? parsedKeep : DEFAULTS.keep,
    includeMedia: includeMedia === "true",
  };
}

export async function saveBackupSettings(settings: BackupSettings, userId: string): Promise<void> {
  const K = BACKUP_KEYS;
  await Promise.all([
    setAppSetting(K.enabled, String(settings.enabled), userId),
    setAppSetting(K.time, settings.time, userId),
    // "" seria lido como "não configurado" (getAppSetting ignora vazio).
    setAppSetting(K.days, settings.days.length ? settings.days.join(",") : "none", userId),
    setAppSetting(K.dir, settings.dir.trim(), userId),
    setAppSetting(K.keep, String(settings.keep), userId),
    setAppSetting(K.includeMedia, String(settings.includeMedia), userId),
  ]);
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const K = BACKUP_KEYS;
  const [lastRunAt, lastStatus, lastMessage] = await Promise.all([
    getAppSetting(K.lastRunAt),
    getAppSetting(K.lastStatus),
    getAppSetting(K.lastMessage),
  ]);
  return {
    lastRunAt,
    lastStatus: lastStatus === "ok" || lastStatus === "error" ? lastStatus : null,
    lastMessage,
  };
}
