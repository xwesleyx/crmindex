import fs from "node:fs/promises";
import path from "node:path";

import { CURRENT_VERSION } from "@/lib/changelog";
import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { cnpjHash } from "@/features/license/cnpj-hash";
import {
  compareVersions,
  fetchControl,
  isRemoteControlConfigured,
  verifySignedControl,
  type ControlContent,
  type ControlVersion,
} from "@/features/license/control";

// Licença por CNPJ: o instalador pede o CNPJ do cliente; de hora em hora o
// CRM lê o arquivo de controle no GitHub — CNPJ na lista de ativos =
// funciona, fora da lista = trava (menos para o usuário do suporte). Sem
// internet/GitHub fora do ar, vale a última resposta válida (nunca trava
// por falta de conexão).

const KEYS = {
  cnpj: "license.cnpj",
  control: "license.control", // texto assinado da última consulta válida
  lastCheckAt: "license.lastCheckAt",
  lastOkAt: "license.lastOkAt",
  lastError: "license.lastError",
} as const;

export type LicenseReason = "ok" | "nao_configurado" | "sem_cnpj" | "aguardando" | "cnpj_inativo";

export type LicenseState = {
  configured: boolean;
  cnpj: string | null;
  locked: boolean;
  reason: LicenseReason;
  lastCheckAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  contato: string | null;
  latest: ControlVersion | null;
};

function dataDir(): string | null {
  return process.env.INTEGRA_DATA_DIR || null;
}

// CNPJ digitado no instalador ({ProgramData}\IntegraCRM\instalacao.json) —
// usado enquanto ninguém definiu outro no menu Licença.
async function installerCnpj(): Promise<string | null> {
  const dir = dataDir();
  if (!dir) return null;
  try {
    const data = JSON.parse(await fs.readFile(path.join(dir, "instalacao.json"), "utf8")) as { cnpj?: string };
    const digits = (data.cnpj ?? "").replace(/\D/g, "");
    return digits.length === 14 ? digits : null;
  } catch {
    return null;
  }
}

export async function getLicenseCnpj(): Promise<string | null> {
  return (await getAppSetting(KEYS.cnpj)) ?? (await installerCnpj());
}

export async function setLicenseCnpj(cnpj: string, userId: string): Promise<void> {
  await setAppSetting(KEYS.cnpj, cnpj.replace(/\D/g, ""), userId);
  invalidateLicenseCache();
}

// Guarda o arquivo assinado também na pasta de dados — o atualizador
// (installer/launcher/updater.js, roda como SYSTEM) lê de lá e confere a
// assinatura de novo antes de instalar qualquer coisa.
async function shareWithUpdater(raw: string): Promise<void> {
  const dir = dataDir();
  if (!dir) return;
  try {
    await fs.writeFile(path.join(dir, "controle.json"), raw);
  } catch (error) {
    console.error("[licença] não foi possível gravar controle.json:", error);
  }
}

export async function checkLicenseNow(): Promise<{ ok: boolean; error?: string }> {
  if (!isRemoteControlConfigured()) return { ok: true };
  const now = new Date().toISOString();
  try {
    const { raw } = await fetchControl();
    await Promise.all([
      setAppSetting(KEYS.control, raw),
      setAppSetting(KEYS.lastCheckAt, now),
      setAppSetting(KEYS.lastOkAt, now),
      setAppSetting(KEYS.lastError, "-"),
    ]);
    await shareWithUpdater(raw);
    invalidateLicenseCache();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([setAppSetting(KEYS.lastCheckAt, now), setAppSetting(KEYS.lastError, message)]);
    invalidateLicenseCache();
    return { ok: false, error: message };
  }
}

// Última resposta válida — conferida de novo aqui (o texto fica no banco do
// cliente; sem a assinatura certa, é ignorado).
async function storedControl(): Promise<ControlContent | null> {
  const raw = await getAppSetting(KEYS.control);
  if (!raw) return null;
  try {
    return verifySignedControl(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function computeLicenseState(): Promise<LicenseState> {
  const configured = isRemoteControlConfigured();
  const [cnpj, control, lastCheckAt, lastOkAt, lastError] = await Promise.all([
    getLicenseCnpj(),
    configured ? storedControl() : null,
    getAppSetting(KEYS.lastCheckAt),
    getAppSetting(KEYS.lastOkAt),
    getAppSetting(KEYS.lastError),
  ]);
  const base = {
    configured,
    cnpj,
    lastCheckAt,
    lastOkAt,
    lastError: lastError && lastError !== "-" ? lastError : null,
    contato: control?.contato ?? null,
    latest: control?.versao ?? null,
  };
  if (!configured) return { ...base, locked: false, reason: "nao_configurado" };
  if (!cnpj) return { ...base, locked: true, reason: "sem_cnpj" };
  // Nunca conseguiu consultar (instalação nova sem internet): libera.
  if (!control) return { ...base, locked: false, reason: "aguardando" };
  const active = control.ativos.includes(cnpjHash(cnpj));
  return { ...base, locked: !active, reason: active ? "ok" : "cnpj_inativo" };
}

// O layout consulta a cada navegação — cache curto em memória.
const CACHE_MS = 30_000;
const cache = globalThis as typeof globalThis & { __licenseState?: { at: number; value: LicenseState } };

export function invalidateLicenseCache(): void {
  cache.__licenseState = undefined;
}

export async function getLicenseState(): Promise<LicenseState> {
  const cached = cache.__licenseState;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = await computeLicenseState();
  cache.__licenseState = { at: Date.now(), value };
  return value;
}

// ---------------------------------------------------------------------------
// Atualizações
// ---------------------------------------------------------------------------

export type UpdaterStatus = {
  estado: "agendado" | "baixando" | "instalando" | "ok" | "erro";
  versao?: string;
  mensagem?: string;
  inicioEm?: string;
  em?: string;
};

export function canUpdateHere(): boolean {
  return process.env.INTEGRA_INSTALLED === "1" && Boolean(dataDir());
}

export function isNewerVersion(version: ControlVersion | null): version is ControlVersion {
  return Boolean(version && compareVersions(version.numero, CURRENT_VERSION) > 0);
}

// Situação escrita pelo atualizador (installer/launcher/updater.js).
export async function readUpdaterStatus(): Promise<UpdaterStatus | null> {
  const dir = dataDir();
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, "update-status.json"), "utf8")) as UpdaterStatus;
  } catch {
    return null;
  }
}

// "Atualizar agora": só deixa o pedido — quem instala é o atualizador
// (tarefa do Windows que roda como SYSTEM a cada minuto). Ele confere de
// novo a versão e a assinatura; o pedido em si não diz o que instalar.
export async function requestUpdate(userName: string): Promise<void> {
  const dir = dataDir();
  if (!dir) throw new Error("Atualização só funciona no CRM instalado.");
  await fs.writeFile(
    path.join(dir, "update-request.json"),
    JSON.stringify({ pedidoEm: new Date().toISOString(), por: userName })
  );
}
