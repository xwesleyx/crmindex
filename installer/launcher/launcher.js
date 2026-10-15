// Launcher do Integra CRM instalado (Windows). Roda com o node.exe que vem
// junto no instalador — nada precisa estar instalado na máquina.
//
//   node launcher.js start  -> sobe o CRM e o serviço do WhatsApp (fica
//                              vigiando e reinicia o que cair) e abre o
//                              navegador. Se já estiver rodando, só abre o
//                              navegador.
//   node launcher.js stop   -> para tudo.
//   node launcher.js open   -> só abre o navegador.
//
// Dados (banco, sessão do WhatsApp, mídias, logs, segredos) ficam em
// %ProgramData%\IntegraCRM — fora da pasta do programa, então sobrevivem a
// atualização/reinstalação.

"use strict";

const { spawn, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { prepareDatabase } = require("./database");

const APP_ROOT = path.resolve(__dirname, "..");
const NODE_EXE = process.execPath;
const SERVER_JS = path.join(APP_ROOT, "app", "server.js");
const WHATSAPP_EXE = path.join(APP_ROOT, "whatsapp", "whatsapp-service.exe");
const TEMPLATE_DB = path.join(APP_ROOT, "template", "crm.db");
const MIGRATIONS_DIR = path.join(APP_ROOT, "migrations");

const DATA_ROOT = path.join(process.env.ProgramData || "C:\\ProgramData", "IntegraCRM");
const DB_FILE = path.join(DATA_ROOT, "crm.db");
const CONFIG_FILE = path.join(DATA_ROOT, "config.json");
const PID_FILE = path.join(DATA_ROOT, "launcher.pid");
const LOG_DIR = path.join(DATA_ROOT, "logs");
const MEDIA_DIR = path.join(DATA_ROOT, "whatsapp-media");
const SESSION_FILE = path.join(DATA_ROOT, "whatsapp-session.db");
// Backups automáticos de atualização/restauração ficam sempre aqui; o
// backup agendado (Configurações > Backup) usa esta pasta como padrão, mas
// o admin pode apontar outra.
const BACKUP_DIR = path.join(DATA_ROOT, "backups");

const MAX_LOG_BYTES = 5 * 1024 * 1024;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(path.join(LOG_DIR, "launcher.log"), line);
  } catch {
    // sem log não é motivo pra parar
  }
}

function ensureDirs() {
  for (const dir of [DATA_ROOT, LOG_DIR, MEDIA_DIR]) fs.mkdirSync(dir, { recursive: true });
}

// Segredos gerados na primeira execução, por máquina — nunca vêm no
// instalador.
function loadConfig() {
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    // primeira execução
  }
  const defaults = {
    port: 3100,
    whatsappPort: 8787,
    authSecret: crypto.randomBytes(32).toString("base64"),
    whatsappSecret: crypto.randomBytes(32).toString("hex"),
  };
  const merged = { ...defaults, ...config };
  if (JSON.stringify(merged) !== JSON.stringify(config)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  }
  return merged;
}

function ensureDatabase() {
  try {
    prepareDatabase({
      dbFile: DB_FILE,
      templateDb: TEMPLATE_DB,
      migrationsDir: MIGRATIONS_DIR,
      dataRoot: DATA_ROOT,
      backupRoot: BACKUP_DIR,
      log,
    });
  } catch (error) {
    // Sobe mesmo assim — o erro fica no log e o CRM mostra o que conseguir.
    log(`ERRO ao preparar o banco: ${error && error.stack ? error.stack : error}`);
  }
}

// IP desta máquina na rede local — usado no link das mídias do WhatsApp,
// senão foto/áudio não carregam em outro computador (localhost seria o
// computador de quem está olhando, não este).
function lanAddress() {
  const candidates = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) candidates.push(address.address);
    }
  }
  const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return candidates.find(isPrivate) || candidates[0] || "127.0.0.1";
}

async function isUp(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
    return response.status > 0;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

function openLogFile(name) {
  const file = path.join(LOG_DIR, name);
  try {
    if (fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, `${file}.old`);
  } catch {
    // arquivo ainda não existe
  }
  return fs.openSync(file, "a");
}

// Sobe um processo filho e reinicia sozinho se ele cair (espera crescente,
// até 1 min, pra não ficar num loop apertado se algo estiver quebrado).
function supervise(name, command, args, env, logName, beforeStart) {
  let delay = 2000;
  let child = null;

  const start = () => {
    if (beforeStart) beforeStart();
    const out = openLogFile(logName);
    const startedAt = Date.now();
    child = spawn(command, args, {
      cwd: path.dirname(command === NODE_EXE ? SERVER_JS : command),
      env: { ...process.env, ...env },
      stdio: ["ignore", out, out],
      windowsHide: true,
    });
    log(`${name} iniciado (PID ${child.pid}).`);
    child.on("exit", (code) => {
      fs.closeSync(out);
      if (stopping) return;
      if (Date.now() - startedAt > 60_000) delay = 2000;
      log(`${name} parou (código ${code}). Reiniciando em ${delay / 1000}s.`);
      setTimeout(start, delay);
      delay = Math.min(delay * 2, 60_000);
    });
  };

  start();
  return () => child && !child.killed && child.kill();
}

let stopping = false;

function runningLauncherPid() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
    if (!pid || pid === process.pid) return null;
    process.kill(pid, 0); // só testa se o processo existe
    return pid;
  } catch {
    return null;
  }
}

async function startCommand() {
  ensureDirs();
  const config = loadConfig();
  const url = `http://localhost:${config.port}`;

  // Já rodando (ou ainda subindo, iniciado pelo Windows ou por outro
  // clique): não sobe uma segunda cópia — só espera e abre o navegador.
  if ((await isUp(`${url}/login`)) || runningLauncherPid()) {
    for (let i = 0; i < 90 && !(await isUp(`${url}/login`)); i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    openBrowser(url);
    return;
  }

  fs.writeFileSync(PID_FILE, String(process.pid));
  log("Iniciando Integra CRM...");

  const stopWhatsapp = supervise(
    "WhatsApp",
    WHATSAPP_EXE,
    [],
    {
      PORT: String(config.whatsappPort),
      HOST: "0.0.0.0",
      WEBHOOK_SECRET: config.whatsappSecret,
      NEXTJS_WEBHOOK_URL: `http://127.0.0.1:${config.port}/api/webhooks/whatsapp`,
      SESSION_NAME: SESSION_FILE,
      MEDIA_DIR,
      PUBLIC_URL: `http://${lanAddress()}:${config.whatsappPort}`,
    },
    "whatsapp.log"
  );

  const stopServer = supervise(
    "CRM",
    NODE_EXE,
    [SERVER_JS],
    {
      NODE_ENV: "production",
      PORT: String(config.port),
      HOSTNAME: "0.0.0.0",
      DATABASE_URL: `file:${DB_FILE.replace(/\\/g, "/")}`,
      AUTH_SECRET: config.authSecret,
      AUTH_TRUST_HOST: "true",
      WHATSAPP_PROVIDER: "neonize",
      WHATSAPP_SERVICE_URL: `http://127.0.0.1:${config.whatsappPort}`,
      WHATSAPP_SERVICE_SECRET: config.whatsappSecret,
      // Backup, Limpeza e restauração (Configurações) precisam saber onde
      // ficam os dados desta instalação.
      INTEGRA_INSTALLED: "1",
      INTEGRA_DATA_DIR: DATA_ROOT,
      INTEGRA_BACKUP_DIR: BACKUP_DIR,
      WHATSAPP_MEDIA_DIR: MEDIA_DIR,
    },
    "crm.log",
    // Antes de cada subida (inclusive reinício): restauração pendente,
    // migrações de versão nova e modo WAL — ver database.js.
    ensureDatabase
  );

  const shutdown = () => {
    stopping = true;
    stopServer();
    stopWhatsapp();
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      // já removido
    }
    setTimeout(() => process.exit(0), 1500);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Espera o CRM responder (primeira subida pode levar alguns segundos) e
  // abre o navegador.
  for (let i = 0; i < 90; i++) {
    if (await isUp(`${url}/login`)) {
      log(`CRM no ar em ${url} (rede: http://${lanAddress()}:${config.port}).`);
      openBrowser(url);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  log("O CRM não respondeu em 90s — veja logs\\crm.log.");
}

function stopCommand() {
  let pid = null;
  try {
    pid = Number(fs.readFileSync(PID_FILE, "utf8"));
  } catch {
    // nada rodando
  }
  if (pid) {
    try {
      // /T derruba o launcher e os filhos (CRM + WhatsApp) juntos.
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {
      // processo já tinha saído
    }
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // já removido
  }
  log("Integra CRM parado.");
}

const command = process.argv[2] || "start";

if (command === "stop") {
  ensureDirs();
  stopCommand();
} else if (command === "open") {
  ensureDirs();
  openBrowser(`http://localhost:${loadConfig().port}`);
} else {
  startCommand().catch((error) => {
    log(`Erro ao iniciar: ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  });
}
