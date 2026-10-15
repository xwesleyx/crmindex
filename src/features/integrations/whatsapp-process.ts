import { spawn } from "node:child_process";
import { existsSync, openSync, closeSync, readFileSync } from "node:fs";
import path from "node:path";

// Controle do processo do whatsapp-service/ a partir do próprio CRM (botões
// "Iniciar serviço"/"Reiniciar serviço" em Integrações). Só funciona quando o
// serviço roda NA MESMA MÁQUINA que o Next.js (WHATSAPP_SERVICE_URL apontando
// pra localhost) e a pasta whatsapp-service/ tem o venv instalado — em
// produção (Render) o serviço é outro container, e quem sobe/derruba é o
// próprio Render.
const SERVICE_DIR = path.join(process.cwd(), "whatsapp-service");
const LOG_FILE = path.join(SERVICE_DIR, "service.log");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type LocalServiceInfo = { canManage: true; port: string } | { canManage: false; reason: string };

function venvPython(): string {
  return process.platform === "win32"
    ? path.join(SERVICE_DIR, "venv", "Scripts", "python.exe")
    : path.join(SERVICE_DIR, "venv", "bin", "python");
}

// No Windows, python.exe sempre ganha uma janela de console (e fechá-la mata
// o serviço) — pythonw.exe roda sem janela nenhuma; a saída vai pro log.
function venvPythonNoConsole(): string {
  const pythonw = path.join(SERVICE_DIR, "venv", "Scripts", "pythonw.exe");
  return process.platform === "win32" && existsSync(pythonw) ? pythonw : venvPython();
}

function serviceBaseUrl(): string | null {
  const base = process.env.WHATSAPP_SERVICE_URL;
  return base ? base.replace(/\/$/, "") : null;
}

export function getLocalServiceInfo(): LocalServiceInfo {
  const base = serviceBaseUrl();
  if (!base) return { canManage: false, reason: "WHATSAPP_SERVICE_URL não está definido no .env do CRM." };

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return { canManage: false, reason: `WHATSAPP_SERVICE_URL inválido: ${base}` };
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    return {
      canManage: false,
      reason: `O serviço roda em outro servidor (${url.host}); inicie/reinicie por lá (ex.: painel do Render).`,
    };
  }
  if (!existsSync(path.join(SERVICE_DIR, "main.py"))) {
    return { canManage: false, reason: "Pasta whatsapp-service/ não encontrada nesta instalação." };
  }
  if (!existsSync(venvPython())) {
    return {
      canManage: false,
      reason: "O venv do whatsapp-service não está instalado (veja o README da pasta: python -m venv venv e pip install -r requirements.txt).",
    };
  }

  return { canManage: true, port: url.port || (url.protocol === "https:" ? "443" : "80") };
}

// Últimas linhas do log do serviço quando ele foi iniciado pelo CRM — é o
// que aparece em "Detalhes do erro" quando o processo cai na subida.
export function readServiceLogTail(maxLines = 25): string | null {
  if (!existsSync(LOG_FILE)) return null;
  try {
    const lines = readFileSync(LOG_FILE, "utf8").trimEnd().split(/\r?\n/);
    const tail = lines.slice(-maxLines).join("\n").trim();
    return tail || null;
  } catch {
    return null;
  }
}

export async function isServiceHealthy(): Promise<boolean> {
  const base = serviceBaseUrl();
  if (!base) return false;
  try {
    const response = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitUntilStopped(timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isServiceHealthy())) return true;
    await sleep(400);
  }
  return false;
}

// Logo depois de subir/reconectar, o serviço passa ~1-3s autenticando a
// sessão salva (nem conectado, nem com QR). Esperar esse estado assentar
// evita a tela mostrar "Aguardando pareamento" à toa.
export async function waitUntilSettled(timeoutMs = 12000): Promise<void> {
  const base = serviceBaseUrl();
  const secret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!base || !secret) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/status`, {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return;
      const status = (await response.json()) as { connected: boolean; qrPending: boolean; loggedOut?: boolean };
      if (status.connected || status.qrPending || status.loggedOut) return;
    } catch {
      return;
    }
    await sleep(500);
  }
}

export async function startLocalService(): Promise<{ success: true } | { success: false; error: string }> {
  const info = getLocalServiceInfo();
  if (!info.canManage) return { success: false, error: info.reason };

  // Log novo a cada subida: o que interessa é o erro desta tentativa.
  const logFd = openSync(LOG_FILE, "w");
  let exitCode: number | null = null;
  let spawnError: string | null = null;

  try {
    const child = spawn(venvPythonNoConsole(), ["-m", "uvicorn", "main:app", "--port", info.port], {
      cwd: SERVICE_DIR,
      // Processo independente: continua rodando se o `next dev` reiniciar.
      detached: true,
      windowsHide: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    });
    child.on("error", (error) => {
      spawnError = error.message;
    });
    child.on("exit", (code) => {
      exitCode = code ?? -1;
    });
    child.unref();
  } finally {
    closeSync(logFd);
  }

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await sleep(500);
    if (spawnError) return { success: false, error: `Não foi possível executar o Python: ${spawnError}` };
    if (exitCode !== null) {
      return {
        success: false,
        error: `O serviço encerrou logo ao iniciar (código ${exitCode}). Veja os detalhes do log abaixo.`,
      };
    }
    if (await isServiceHealthy()) {
      await waitUntilSettled();
      return { success: true };
    }
  }

  return {
    success: false,
    error: "O serviço não respondeu em 20 segundos. Veja os detalhes do log abaixo ou tente novamente.",
  };
}
