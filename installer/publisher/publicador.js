// Integra Publicador — roda no computador do fornecedor (não vai para os
// clientes). Publica no GitHub o arquivo de controle que todos os CRMs
// instalados consultam de hora em hora:
//   - lista de CNPJs ativos (embaralhados — hash), e
//   - a versão mais nova do instalador (normal ou obrigatória).
// Também cria o Release com o instalador .exe.
//
// Tudo é assinado com a chave privada que fica só aqui
// (%APPDATA%\IntegraPublicador\chave-privada.pem). Os CRMs têm a chave
// pública e ignoram qualquer arquivo sem a assinatura certa.
//
// Vira um .exe com installer/publisher/build-publicador.ps1. Também roda com
// `node installer/publisher/publicador.js`.

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { spawnSync } = require("node:child_process");

const CONFIG_DIR = path.join(process.env.APPDATA || process.env.HOME || ".", "IntegraPublicador");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const CLIENTS_FILE = path.join(CONFIG_DIR, "clientes.json");
const VERSION_FILE = path.join(CONFIG_DIR, "versao-publicada.json");
const PRIVATE_KEY_FILE = path.join(CONFIG_DIR, "chave-privada.pem");
const PUBLIC_KEY_FILE = path.join(CONFIG_DIR, "chave-publica.pem");
const CONTROL_PATH = "controle.json";

// Igual a src/features/license/cnpj-hash.ts — os dois precisam bater.
const CNPJ_SALT = "crm-index:licenca:v1:";

let rl;

// ---------------------------------------------------------------------------
// utilitários
// ---------------------------------------------------------------------------

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function ask(question, fallback = "") {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function confirm(question, defaultYes = true) {
  const answer = (await rl.question(`${question} ${defaultYes ? "(S/n)" : "(s/N)"}: `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer.startsWith("s");
}

async function pause() {
  await rl.question("\nEnter para continuar...");
}

function title(text) {
  console.log(`\n=== ${text} ===\n`);
}

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

function formatCnpj(digits) {
  const d = onlyDigits(digits);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
}

function isValidCnpj(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digit = (len) => {
    let sum = 0;
    let weight = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const result = 11 - (sum % 11);
    return result >= 10 ? 0 : result;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

function cnpjHash(cnpj) {
  return crypto.createHash("sha256").update(CNPJ_SALT + onlyDigits(cnpj)).digest("hex");
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

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

function config() {
  return readJson(CONFIG_FILE, null);
}

async function github(method, url, { body, headers, raw } = {}) {
  const cfg = config();
  const response = await fetch(url.startsWith("http") ? url : `https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "IntegraPublicador",
      ...(body && !raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok && response.status !== 404) {
    const message = data && data.message ? data.message : text;
    throw new Error(`GitHub ${response.status}: ${message}`);
  }
  return { status: response.status, data };
}

const repoPath = () => `/repos/${config().owner}/${config().repo}`;

// ---------------------------------------------------------------------------
// arquivo de controle
// ---------------------------------------------------------------------------

function buildControl() {
  const cfg = config();
  const clients = readJson(CLIENTS_FILE, []);
  const versao = readJson(VERSION_FILE, null);
  const conteudo = {
    geradoEm: new Date().toISOString(),
    contato: cfg.contato || "",
    ativos: clients.filter((c) => c.ativo).map((c) => cnpjHash(c.cnpj)),
    versao: versao || null,
  };
  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_FILE, "utf8"));
  const assinatura = crypto.sign(null, Buffer.from(JSON.stringify(conteudo)), privateKey).toString("base64");
  return { conteudo, assinatura };
}

async function publishControl(message) {
  const cfg = config();
  const signed = buildControl();
  const current = await github("GET", `${repoPath()}/contents/${CONTROL_PATH}?ref=${cfg.branch}`);
  await github("PUT", `${repoPath()}/contents/${CONTROL_PATH}`, {
    body: {
      message,
      branch: cfg.branch,
      content: Buffer.from(JSON.stringify(signed, null, 2)).toString("base64"),
      ...(current.status === 200 && current.data.sha ? { sha: current.data.sha } : {}),
    },
  });
  console.log(
    `\nPublicado: ${signed.conteudo.ativos.length} CNPJ(s) ativo(s)` +
      (signed.conteudo.versao
        ? `, versão ${signed.conteudo.versao.numero}${signed.conteudo.versao.forcar ? " (obrigatória)" : ""}`
        : ", sem versão publicada") +
      ".\nOs CRMs aplicam em até 1 hora (ou ao clicar em \"Verificar agora\" no menu Licença)."
  );
}

// ---------------------------------------------------------------------------
// telas
// ---------------------------------------------------------------------------

function detectProjectDir() {
  let dir = path.dirname(process.execPath.endsWith("node.exe") ? process.argv[1] || "." : process.execPath);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "src", "lib", "changelog.ts"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

async function configure() {
  title("Configurar");
  const current = config() || {};
  console.log("Precisa de: um repositório no GitHub (pode ser público) e um token com permissão de escrita nele.");
  console.log("O passo a passo está no README do projeto (seção Licença e atualizações).\n");

  const projeto = await ask("Pasta do projeto do CRM", current.projeto || detectProjectDir());
  if (!fs.existsSync(path.join(projeto, "src", "features", "license"))) {
    console.log("Essa pasta não parece ser o projeto do CRM (falta src/features/license).");
    return pause();
  }
  const owner = await ask("Usuário (ou organização) do GitHub", current.owner);
  const repo = await ask("Nome do repositório", current.repo || "crm-index-atualizacoes");
  const branch = await ask("Branch", current.branch || "main");
  const token = await ask("Token do GitHub (Enter mantém o atual)", current.token ? "manter" : "");
  const contato = await ask(
    "Contato do suporte (aparece na tela de sistema suspenso)",
    current.contato || "Suporte: (00) 00000-0000"
  );
  const cfg = { projeto, owner, repo, branch, token: token === "manter" ? current.token : token, contato };
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    console.log("Usuário, repositório e token são obrigatórios.");
    return pause();
  }
  writeJson(CONFIG_FILE, cfg);

  // Testa o acesso.
  try {
    const repoInfo = await github("GET", repoPath());
    if (repoInfo.status === 404) throw new Error("repositório não encontrado (confira o nome e o token).");
    if (repoInfo.data.private) {
      console.log("\nATENÇÃO: o repositório é PRIVADO — os CRMs não conseguem ler o arquivo. Deixe-o público.");
    } else {
      console.log(`\nAcesso ao GitHub OK: ${repoInfo.data.full_name}`);
    }
  } catch (error) {
    console.log(`\nNão consegui acessar o GitHub: ${error.message}`);
  }

  // Chaves: geradas uma vez só. Perder a privada = não dá mais pra mandar
  // atualização para os CRMs já instalados.
  if (!fs.existsSync(PRIVATE_KEY_FILE)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(PRIVATE_KEY_FILE, privateKey.export({ type: "pkcs8", format: "pem" }));
    fs.writeFileSync(PUBLIC_KEY_FILE, publicKey.export({ type: "spki", format: "pem" }));
    console.log("\nChave de assinatura criada.");
  }
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_FILE, "utf8").trim();
  const controlUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${CONTROL_PATH}`;

  fs.writeFileSync(
    path.join(projeto, "src", "features", "license", "remote-config.ts"),
    [
      "// GERADO PELO INTEGRA PUBLICADOR (opção \"Configurar\") — não editar à mão.",
      "// Endereço do arquivo de controle (licenças + atualizações) no GitHub e a",
      "// chave pública que confere a assinatura dele. Vazio = controle remoto",
      "// desligado (ambiente de desenvolvimento): nada trava e não há atualização.",
      `export const CONTROL_URL = ${JSON.stringify(controlUrl)};`,
      `export const CONTROL_PUBLIC_KEY = ${JSON.stringify(publicKeyPem)};`,
      "",
    ].join("\n")
  );
  writeJson(path.join(projeto, "installer", "launcher", "remote-config.json"), { controlUrl, publicKey: publicKeyPem });

  console.log("\nProjeto configurado (src/features/license/remote-config.ts e installer/launcher/remote-config.json).");
  console.log("Gere um instalador novo (installer\\build.ps1) para os clientes passarem a usar este controle.");
  console.log(`\nIMPORTANTE: faça uma cópia de segurança da pasta ${CONFIG_DIR}`);
  console.log("(principalmente chave-privada.pem). Sem ela você não consegue mais mandar atualizações.");
  await pause();
}

async function clientsMenu() {
  for (;;) {
    title("Clientes (CNPJ)");
    const clients = readJson(CLIENTS_FILE, []);
    if (clients.length === 0) console.log("Nenhum cliente cadastrado.");
    clients.forEach((c, i) =>
      console.log(`${String(i + 1).padStart(3)}) ${formatCnpj(c.cnpj)}  ${c.ativo ? "ATIVO  " : "BLOQUEADO"}  ${c.nome}`)
    );
    console.log("\n a) Adicionar   b) Bloquear/desbloquear   r) Remover   p) Publicar   v) Voltar");
    const option = (await ask("Opção")).toLowerCase();

    if (option === "v" || option === "") return;
    if (option === "p") {
      await publishControl("Atualiza lista de clientes");
      await pause();
      continue;
    }
    if (option === "a") {
      const cnpj = onlyDigits(await ask("CNPJ"));
      if (!isValidCnpj(cnpj)) {
        console.log("CNPJ inválido.");
        await pause();
        continue;
      }
      if (clients.some((c) => c.cnpj === cnpj)) {
        console.log("Esse CNPJ já está cadastrado.");
        await pause();
        continue;
      }
      const nome = await ask("Nome do cliente (fica só aqui, não vai para o GitHub)");
      clients.push({ cnpj, nome, ativo: true, criadoEm: new Date().toISOString() });
      writeJson(CLIENTS_FILE, clients);
      if (await confirm("Publicar agora?")) await publishControl(`Ativa cliente`);
      continue;
    }
    if (option === "b" || option === "r") {
      const index = Number(await ask("Número do cliente")) - 1;
      const client = clients[index];
      if (!client) continue;
      if (option === "b") {
        client.ativo = !client.ativo;
        console.log(`${client.nome}: ${client.ativo ? "DESBLOQUEADO" : "BLOQUEADO"}.`);
      } else {
        if (!(await confirm(`Remover ${client.nome} (${formatCnpj(client.cnpj)})? Ele fica bloqueado.`, false))) continue;
        clients.splice(index, 1);
      }
      writeJson(CLIENTS_FILE, clients);
      if (await confirm("Publicar agora?")) await publishControl("Atualiza lista de clientes");
    }
  }
}

function findLatestInstaller() {
  const out = path.join(config().projeto, "installer", "output");
  if (!fs.existsSync(out)) return null;
  const candidates = fs
    .readdirSync(out)
    .map((name) => /^IntegraCRM-Setup-([\d.]+)\.exe$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => compareVersions(b[1], a[1]));
  if (candidates.length === 0) return null;
  const [name, version] = candidates[0];
  return { file: path.join(out, name), name, version, notesFile: path.join(out, `IntegraCRM-Setup-${version}.json`) };
}

function releaseNotes(notesFile, previous) {
  const notes = readJson(notesFile, null);
  if (!notes) return { titulo: "", novidades: [] };
  // Junta as novidades de todas as versões depois da última publicada.
  const entries = (notes.entradas || []).filter((e) => !previous || compareVersions(e.versao, previous) > 0);
  const list = (entries.length ? entries : (notes.entradas || []).slice(0, 1)).flatMap((e) =>
    e.novidades.map((n) => (entries.length > 1 ? `v${e.versao}: ${n}` : n))
  );
  return { titulo: notes.titulo || "", novidades: list.slice(0, 40) };
}

async function publishVersion() {
  title("Publicar nova versão");
  const installer = findLatestInstaller();
  if (!installer) {
    console.log("Nenhum instalador em installer\\output. Rode antes: installer\\build.ps1");
    return pause();
  }
  const published = readJson(VERSION_FILE, null);
  console.log(`Instalador: ${installer.name} (${(fs.statSync(installer.file).size / 1024 / 1024).toFixed(0)} MB)`);
  console.log(`Versão publicada hoje: ${published ? published.numero : "nenhuma"}`);
  if (published && compareVersions(installer.version, published.numero) < 0) {
    console.log("Esse instalador é mais ANTIGO que o publicado — os CRMs não instalam versão mais antiga.");
    return pause();
  }
  if (!(await confirm(`Publicar a versão ${installer.version}?`))) return;
  const forcar = await confirm("Atualização OBRIGATÓRIA (instala sozinho em todos os clientes)?", false);

  console.log("\nCalculando o código de verificação (sha256)...");
  const buffer = fs.readFileSync(installer.file);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const tag = `v${installer.version}`;
  const notes = releaseNotes(installer.notesFile, published && published.numero);
  console.log(`Criando o Release ${tag} no GitHub...`);
  let release = await github("GET", `${repoPath()}/releases/tags/${tag}`);
  if (release.status === 404) {
    release = await github("POST", `${repoPath()}/releases`, {
      body: {
        tag_name: tag,
        target_commitish: config().branch,
        name: `Versão ${installer.version}${notes.titulo ? ` — ${notes.titulo}` : ""}`,
        body: notes.novidades.map((n) => `- ${n}`).join("\n"),
      },
    });
  }
  const existing = (release.data.assets || []).find((asset) => asset.name === installer.name);
  if (existing) await github("DELETE", `${repoPath()}/releases/assets/${existing.id}`);

  console.log("Enviando o instalador (pode demorar alguns minutos)...");
  const uploadUrl = release.data.upload_url.replace(/\{.*\}$/, "");
  const asset = await github("POST", `${uploadUrl}?name=${encodeURIComponent(installer.name)}`, {
    body: buffer,
    raw: true,
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(buffer.length) },
  });

  writeJson(VERSION_FILE, {
    numero: installer.version,
    titulo: notes.titulo,
    novidades: notes.novidades,
    instalador: asset.data.browser_download_url,
    sha256,
    tamanho: buffer.length,
    forcar,
  });
  await publishControl(`Publica versão ${installer.version}${forcar ? " (obrigatória)" : ""}`);
  await pause();
}

async function toggleForced() {
  title("Obrigatória / normal");
  const published = readJson(VERSION_FILE, null);
  if (!published) {
    console.log("Nenhuma versão publicada ainda.");
    return pause();
  }
  console.log(`Versão publicada: ${published.numero} — ${published.forcar ? "OBRIGATÓRIA" : "normal (o cliente escolhe)"}`);
  if (!(await confirm(published.forcar ? "Tornar normal?" : "Tornar OBRIGATÓRIA (instala sozinho em todos)?", false))) return;
  published.forcar = !published.forcar;
  writeJson(VERSION_FILE, published);
  await publishControl(`Versão ${published.numero} ${published.forcar ? "obrigatória" : "normal"}`);
  await pause();
}

async function showPublished() {
  title("O que está publicado no GitHub");
  const cfg = config();
  const response = await fetch(
    `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${CONTROL_PATH}?t=${Date.now()}`
  );
  if (!response.ok) {
    console.log(`Ainda não há arquivo publicado (GitHub respondeu ${response.status}).`);
    return pause();
  }
  const signed = await response.json();
  const publicKey = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_FILE, "utf8"));
  const ok = crypto.verify(null, Buffer.from(JSON.stringify(signed.conteudo)), publicKey, Buffer.from(signed.assinatura, "base64"));
  const clients = readJson(CLIENTS_FILE, []);
  const byHash = new Map(clients.map((c) => [cnpjHash(c.cnpj), c]));
  console.log(`Assinatura: ${ok ? "OK" : "NÃO CONFERE"}`);
  console.log(`Gerado em: ${signed.conteudo.geradoEm}`);
  console.log(`Contato: ${signed.conteudo.contato}`);
  const v = signed.conteudo.versao;
  console.log(`Versão: ${v ? `${v.numero}${v.forcar ? " (obrigatória)" : ""}` : "nenhuma"}`);
  console.log(`\nCNPJs ativos (${signed.conteudo.ativos.length}):`);
  for (const hash of signed.conteudo.ativos) {
    const client = byHash.get(hash);
    console.log(`  ${client ? `${formatCnpj(client.cnpj)}  ${client.nome}` : `(desconhecido) ${hash.slice(0, 12)}...`}`);
  }
  console.log("\n(O GitHub pode levar até 5 minutos para mostrar a última publicação.)");
  await pause();
}

async function main() {
  // Acentos certos no console do Windows.
  if (process.platform === "win32") spawnSync("cmd", ["/c", "chcp 65001 >nul"], { stdio: "inherit" });
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (;;) {
    const cfg = config();
    title("Integra Publicador");
    if (!cfg) {
      console.log("Primeiro uso: vamos configurar.");
      await configure();
      continue;
    }
    const clients = readJson(CLIENTS_FILE, []);
    const published = readJson(VERSION_FILE, null);
    console.log(`Repositório: ${cfg.owner}/${cfg.repo}`);
    console.log(`Clientes: ${clients.filter((c) => c.ativo).length} ativo(s), ${clients.filter((c) => !c.ativo).length} bloqueado(s)`);
    console.log(`Versão publicada: ${published ? `${published.numero}${published.forcar ? " (obrigatória)" : ""}` : "nenhuma"}\n`);
    console.log(" 1) Clientes (CNPJ) — ativar, bloquear");
    console.log(" 2) Publicar nova versão");
    console.log(" 3) Tornar a versão publicada obrigatória / normal");
    console.log(" 4) Publicar de novo o arquivo de controle");
    console.log(" 5) Ver o que está publicado no GitHub");
    console.log(" 6) Configurar");
    console.log(" 0) Sair");
    const option = await ask("\nOpção");
    try {
      if (option === "0") break;
      if (option === "1") await clientsMenu();
      if (option === "2") await publishVersion();
      if (option === "3") await toggleForced();
      if (option === "4") {
        await publishControl("Republica controle");
        await pause();
      }
      if (option === "5") await showPublished();
      if (option === "6") await configure();
    } catch (error) {
      console.log(`\nERRO: ${error.message}`);
      await pause();
    }
  }
  rl.close();
}

// PUBLICADOR_TEST: só expõe as funções (teste automatizado), sem abrir o menu.
if (process.env.PUBLICADOR_TEST) {
  module.exports = { buildControl, cnpjHash, isValidCnpj, compareVersions, releaseNotes };
} else {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
