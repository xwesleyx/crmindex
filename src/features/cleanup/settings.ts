import { getAppSetting, setAppSetting } from "@/lib/app-settings";

// Configurações > Limpeza — limpeza programada das mídias do WhatsApp.
export const CLEANUP_KEYS = {
  enabled: "cleanup.enabled",
  months: "cleanup.months",
  kinds: "cleanup.kinds",
  time: "cleanup.time",
  backupFirst: "cleanup.backupFirst",
  lastRunDate: "cleanup.lastRunDate",
  lastRunAt: "cleanup.lastRunAt",
  lastMessage: "cleanup.lastMessage",
} as const;

import { MEDIA_KINDS, type MediaKind } from "@/features/cleanup/kinds";

export { MEDIA_KINDS, MEDIA_KIND_LABELS, type MediaKind } from "@/features/cleanup/kinds";

export type CleanupSettings = {
  enabled: boolean;
  months: number;
  kinds: MediaKind[];
  time: string;
  backupFirst: boolean;
};

// Desligada por padrão: apagar arquivo é decisão do admin.
const DEFAULTS: CleanupSettings = {
  enabled: false,
  months: 6,
  kinds: [...MEDIA_KINDS],
  time: "12:30",
  backupFirst: true,
};

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const K = CLEANUP_KEYS;
  const [enabled, months, kinds, time, backupFirst] = await Promise.all([
    getAppSetting(K.enabled),
    getAppSetting(K.months),
    getAppSetting(K.kinds),
    getAppSetting(K.time),
    getAppSetting(K.backupFirst),
  ]);
  const parsedMonths = Number(months);
  return {
    enabled: enabled === "true",
    months: Number.isInteger(parsedMonths) && parsedMonths > 0 ? parsedMonths : DEFAULTS.months,
    kinds: kinds
      ? kinds === "none"
        ? []
        : (kinds.split(",").filter((kind) => (MEDIA_KINDS as readonly string[]).includes(kind)) as MediaKind[])
      : DEFAULTS.kinds,
    time: time ?? DEFAULTS.time,
    backupFirst: backupFirst === null ? DEFAULTS.backupFirst : backupFirst === "true",
  };
}

export async function saveCleanupSettings(settings: CleanupSettings, userId: string): Promise<void> {
  const K = CLEANUP_KEYS;
  await Promise.all([
    setAppSetting(K.enabled, String(settings.enabled), userId),
    setAppSetting(K.months, String(settings.months), userId),
    setAppSetting(K.kinds, settings.kinds.length ? settings.kinds.join(",") : "none", userId),
    setAppSetting(K.time, settings.time, userId),
    setAppSetting(K.backupFirst, String(settings.backupFirst), userId),
  ]);
}

export async function getCleanupStatus(): Promise<{ lastRunAt: string | null; lastMessage: string | null }> {
  const [lastRunAt, lastMessage] = await Promise.all([
    getAppSetting(CLEANUP_KEYS.lastRunAt),
    getAppSetting(CLEANUP_KEYS.lastMessage),
  ]);
  return { lastRunAt, lastMessage };
}

export async function setCleanupLastRun(message: string): Promise<void> {
  await Promise.all([
    setAppSetting(CLEANUP_KEYS.lastRunAt, new Date().toISOString()),
    setAppSetting(CLEANUP_KEYS.lastMessage, message),
  ]);
}
