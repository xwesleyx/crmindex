// Atualizador do Integra CRM instalado (Windows). Roda com o node.exe que vem
// no instalador, como SYSTEM, por uma tarefa agendada do Windows a cada
// minuto (criada pelo instalador — por isso instala sem pedir permissão a
// ninguém).
//
//   node updater.js                 -> verificação (a cada minuto)
//   node updater.js install-task    -> cria/atualiza a tarefa (instalador)
//   node updater.js uninstall-task  -> remove a tarefa (desinstalador)
//   node updater.js --apply <exe> <versão>  -> instala (cópia temporária)
//
// De onde vem a versão nova: o CRM baixa de hora em hora o arquivo de
// controle do GitHub e grava em %ProgramData%\IntegraCRM\controle.json. Aqui
// a ASSINATURA é conferida de novo (aquela pasta qualquer usuário grava) e
// só é instalado o instalador daquele arquivo, conferido pelo sha256.
//
// Quando instala:
//   - "Atualizar agora" (um administrador pediu: update-request.json), ou
//   - versão marcada como obrigatória ("forcar") — aí avisa as telas e
//     espera 5 minutos antes de começar.
// Situação de cada etapa vai pra update-status.json — as telas leem e mostram
// "Sistema atualizando…" e voltam sozinhas no fim.

"use strict";

const { execFileSync, spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TASK_NAME = "IntegraCRM Atualizador";
const FORCED_DELAY_MS = 5 * 60_000;
const LOCK_STALE_MS = 45 * 60_000;

const APP_ROOT = process.env.INTEGRA_APP_ROOT || path.resolve(__dirname, "..");
const DATA_ROOT = path.join(process.env.ProgramData || "C:\\ProgramData", "IntegraCRM");
// Pasta só de SYSTEM/Administradores (o instalador baixado e a cópia do
// atualizador ficam aqui — nunca numa pasta que qualquer usuário grava).
const SECURE_ROOT = path.join(process.env.ProgramData || "C:\\ProgramData", "IntegraCRM-Atualizador");

const CONTROL_FILE = path.join(DATA_ROOT, "controle.json");
const REQUEST_FILE = path.join(DATA_ROOT, "update-request.json");
const STATUS_FILE = path.join(DATA_ROOT, "update-status.json");
const LOCK_FILE = path.join(SECURE_ROOT, "atualizador.lock");
const STATE_FILE = path.join(SECURE_ROOT, "estado.json");
const LOG_FILE = path.join(DATA_ROOT, "logs", "atualizador.log");

function log(message) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // sem log não é motivo pra parar
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...status, em: new Date().toISOString() }));
  } catch (error) {
    log(`Não foi possível gravar a situação: ${error.message}`);
  }
}

function installedVersion() {
  try {
    return fs.readFileSync(path.join(APP_ROOT, "version.txt"), "utf8").trim();
  } catch {
    return "0";
  }
}

function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Mesma conferência do CRM (src/features/license/control.ts).
function verifiedVersion() {
  const remote = readJson(path.join(APP_ROOT, "launcher", "remote-config.json"));
  if (!remote || !remote.publicKey) return null;
  const signed = readJson(CONTROL_FILE);
  if (!signed || !signed.conteudo || typeof signed.assinatura !== "string") return null;
  const ok = crypto.verify(
    null,
    Buffer.from(JSON.stringify(signed.conteudo)),
    crypto.createPublicKey(remote.publicKey),
    Buffer.from(signed.assinatura, "base64")
  );
  if (!ok) {
    log("Assinatura do controle.json não confere — ignorado.");
    return null;
  }
  const versao = signed.conteudo.versao;
  if (!versao || !versao.numero || !versao.instalador || !/^[a-f0-9]{64}$/i.test(versao.sha256 || "")) return null;
  if (!/^https:\/\//i.test(versao.instalador)) return null;
  return versao;
}

function crmPort() {
  const config = readJson(path.join(DATA_ROOT, "config.json"));
  return (config && config.port) || 3100;
}

function ensureSecureRoot() {
  fs.mkdirSync(SECURE_ROOT, { recursive: true });
  try {
    // Herança cortada: só SYSTEM e Administradores.
    execFileSync(
      "icacls",
      [SECURE_ROOT, "/inheritance:r", "/grant:r", "*S-1-5-18:(OI)(CI)F", "*S-1-5-32-544:(OI)(CI)F"],
      { stdio: "ignore", windowsHide: true }
    );
  } catch (error) {
    log(`icacls falhou: ${error.message}`);
  }
}

function takeLock() {
  try {
    const stat = fs.statSync(LOCK_FILE);
    if (Date.now() - stat.mtimeMs < LOCK_STALE_MS) return false;
  } catch {
    // sem lock
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // já removido
  }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function download(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`download respondeu ${response.status}`);
  const partial = `${target}.parcial`;
  const out = fs.createWriteStream(partial);
  for await (const chunk of response.body) {
    if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
  }
  await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
  fs.renameSync(partial, target);
}

function setTaskEnabled(enabled) {
  try {
    execFileSync("schtasks", ["/Change", "/TN", TASK_NAME, enabled ? "/ENABLE" : "/DISABLE"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    // tarefa não existe (ex.: rodando à mão)
  }
}

async function waitForCrm(timeoutMs) {
  const url = `http://127.0.0.1:${crmPort()}/login`;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(3000) });
      if (response.status > 0) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}

function runInstaller(installer, version) {
  const result = spawnSync(
    installer,
    [
      "/VERYSILENT",
      "/SUPPRESSMSGBOXES",
      "/NORESTART",
      "/SP-",
      `/LOG=${path.join(DATA_ROOT, "logs", `instalacao-${version}.log`)}`,
    ],
    { windowsHide: true, timeout: 30 * 60_000 }
  );
  return result.status === 0;
}

function startCrm() {
  const child = spawn(
    path.join(APP_ROOT, "runtime", "node.exe"),
    [path.join(APP_ROOT, "launcher", "launcher.js"), "start"],
    { detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();
}

// ---------------------------------------------------------------------------

async function check() {
  const versao = verifiedVersion();
  if (!versao) return;
  const current = installedVersion();
  if (compareVersions(versao.numero, current) <= 0) {
    // Já está na versão (ou mais nova): pedido antigo não vale mais.
    if (fs.existsSync(REQUEST_FILE)) fs.unlinkSync(REQUEST_FILE);
    const status = readJson(STATUS_FILE);
    if (status && status.estado === "agendado") fs.unlinkSync(STATUS_FILE);
    return;
  }

  const requested = fs.existsSync(REQUEST_FILE);
  if (!requested && !versao.forcar) return;

  if (!requested && versao.forcar) {
    const status = readJson(STATUS_FILE);
    // Falhou há pouco nesta versão: tenta de novo só depois de 1 hora.
    if (status && status.estado === "erro" && status.versao === versao.numero && status.em) {
      if (Date.now() - new Date(status.em).getTime() < 60 * 60_000) return;
    }
    if (!status || status.estado !== "agendado" || status.versao !== versao.numero) {
      const inicioEm = new Date(Date.now() + FORCED_DELAY_MS).toISOString();
      writeStatus({ estado: "agendado", versao: versao.numero, inicioEm });
      log(`Atualização obrigatória para ${versao.numero} agendada para ${inicioEm}.`);
      return;
    }
    if (Date.now() < new Date(status.inicioEm).getTime()) return;
  }

  ensureSecureRoot();
  if (!takeLock()) return;
  try {
    log(`Atualizando ${current} -> ${versao.numero} (${requested ? "pedido de um administrador" : "obrigatória"}).`);
    writeStatus({ estado: "baixando", versao: versao.numero });
    const downloads = path.join(SECURE_ROOT, "instaladores");
    fs.mkdirSync(downloads, { recursive: true });
    const installer = path.join(downloads, `IntegraCRM-Setup-${versao.numero}.exe`);
    if (!fs.existsSync(installer) || sha256File(installer).toLowerCase() !== versao.sha256.toLowerCase()) {
      await download(versao.instalador, installer);
    }
    if (sha256File(installer).toLowerCase() !== versao.sha256.toLowerCase()) {
      fs.unlinkSync(installer);
      throw new Error("o arquivo baixado não confere (sha256) — não instalado");
    }

    // Instala a partir de uma cópia do node + atualizador fora da pasta do
    // programa — senão o instalador não consegue substituir o node.exe em uso.
    const runner = path.join(SECURE_ROOT, "executor");
    fs.mkdirSync(runner, { recursive: true });
    fs.copyFileSync(process.execPath, path.join(runner, "node.exe"));
    fs.copyFileSync(__filename, path.join(runner, "updater.js"));
    fs.writeFileSync(LOCK_FILE, String(process.pid)); // renova
    const child = spawn(path.join(runner, "node.exe"), [path.join(runner, "updater.js"), "--apply", installer, versao.numero], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, INTEGRA_APP_ROOT: APP_ROOT },
    });
    child.unref();
    // o lock fica com o executor
  } catch (error) {
    log(`ERRO: ${error.message}`);
    writeStatus({ estado: "erro", versao: versao.numero, mensagem: error.message });
    if (fs.existsSync(REQUEST_FILE)) fs.unlinkSync(REQUEST_FILE);
    releaseLock();
  }
}

async function apply(installer, version) {
  const state = readJson(STATE_FILE) || {};
  setTaskEnabled(false);
  try {
    writeStatus({ estado: "instalando", versao: version });
    log(`Instalando ${path.basename(installer)}...`);
    const installed = runInstaller(installer, version);
    if (installed) startCrm();
    if (installed && (await waitForCrm(4 * 60_000))) {
      log(`Versão ${version} instalada e no ar.`);
      // Guarda este instalador como "anterior" pra uma próxima volta atrás.
      fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, instaladorAtual: installer, versaoAtual: version }));
      for (const name of fs.readdirSync(path.dirname(installer))) {
        const file = path.join(path.dirname(installer), name);
        if (file !== installer && file !== state.instaladorAtual) fs.rmSync(file, { force: true });
      }
      writeStatus({ estado: "ok", versao: version });
    } else {
      // Volta para a versão anterior, se o instalador dela estiver guardado.
      let message = installed ? "o CRM não subiu depois de instalar" : "o instalador falhou";
      if (state.instaladorAtual && fs.existsSync(state.instaladorAtual)) {
        log(`${message} — voltando para a versão ${state.versaoAtual}.`);
        runInstaller(state.instaladorAtual, state.versaoAtual);
        startCrm();
        await waitForCrm(4 * 60_000);
        message += ` — voltou para a versão ${state.versaoAtual}`;
      } else {
        startCrm();
      }
      log(`ERRO: ${message}.`);
      writeStatus({ estado: "erro", versao: version, mensagem: message });
    }
  } catch (error) {
    log(`ERRO ao instalar: ${error.message}`);
    writeStatus({ estado: "erro", versao: version, mensagem: error.message });
    startCrm();
  } finally {
    if (fs.existsSync(REQUEST_FILE)) fs.rmSync(REQUEST_FILE, { force: true });
    setTaskEnabled(true);
    releaseLock();
  }
}

function installTask() {
  ensureSecureRoot();
  const command = `"${path.join(APP_ROOT, "runtime", "node.exe")}" "${path.join(APP_ROOT, "launcher", "updater.js")}"`;
  execFileSync(
    "schtasks",
    ["/Create", "/F", "/TN", TASK_NAME, "/SC", "MINUTE", "/MO", "1", "/RU", "SYSTEM", "/RL", "HIGHEST", "/TR", command],
    { stdio: "ignore", windowsHide: true }
  );
}

function uninstallTask() {
  try {
    execFileSync("schtasks", ["/Delete", "/F", "/TN", TASK_NAME], { stdio: "ignore", windowsHide: true });
  } catch {
    // já não existia
  }
}

const [command, ...args] = process.argv.slice(2);
const run =
  command === "install-task"
    ? Promise.resolve().then(installTask)
    : command === "uninstall-task"
      ? Promise.resolve().then(uninstallTask)
      : command === "--apply"
        ? apply(args[0], args[1])
        : check();

run.catch((error) => {
  log(`ERRO inesperado: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
});
