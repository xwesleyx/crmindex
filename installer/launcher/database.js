// Banco do Integra CRM instalado: prepara o crm.db antes de cada subida do
// CRM (launcher.js chama prepareDatabase toda vez que vai iniciar o
// servidor, inclusive quando ele reinicia sozinho).
//
//   1. Primeira execução: copia o banco limpo do instalador (só o admin).
//   2. Restauração pendente (Configurações > Backup > Restaurar): troca o
//      banco pelo backup escolhido — guardando antes uma cópia do atual.
//   3. Migrações: aplica as que faltam (pasta migrations\ do instalador),
//      com backup automático antes. É isso que deixa instalar uma versão
//      nova por cima sem perder nada.
//   4. Rede de segurança: compara com o banco modelo da versão instalada e
//      cria tabela/coluna/índice que estiver faltando (instalações antigas,
//      de antes das migrações existirem).
//   5. Modo WAL: leitura e escrita ao mesmo tempo (vários atendentes +
//      mensagens chegando) sem "database is locked".
//
// Usa o SQLite embutido no próprio Node (node:sqlite) — nada a mais no
// instalador. Formato da tabela _prisma_migrations igual ao do Prisma, então
// `prisma migrate` continua entendendo o banco.

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

function openDb(file, options = {}) {
  // require aqui (e não no topo): node:sqlite ainda emite um aviso de
  // "experimental" em algumas versões — só carrega quando vai usar.
  const { DatabaseSync } = require("node:sqlite");
  // Chaves estrangeiras desligadas: as migrações do Prisma recriam tabelas
  // (DROP + RENAME) e, com elas ligadas, o DROP dispararia ON DELETE
  // CASCADE/SET NULL nas tabelas filhas.
  return new DatabaseSync(file, { enableForeignKeyConstraints: false, ...options });
}

function timestamp() {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

function removeSidecars(dbFile) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    try {
      fs.unlinkSync(dbFile + suffix);
    } catch {
      // não existia
    }
  }
}

// Cópia consistente mesmo com o banco em WAL (copiar só o .db perderia o
// que ainda está no -wal).
function snapshot(db, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // VACUUM INTO não sobrescreve — dois backups no mesmo segundo ganham sufixo.
  let file = target;
  for (let i = 2; fs.existsSync(file); i++) file = target.replace(/\.db$/, `-${i}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  return file;
}

function listMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, "migration.sql")))
    .map((entry) => {
      const sql = fs.readFileSync(path.join(migrationsDir, entry.name, "migration.sql"));
      return {
        name: entry.name,
        sql: sql.toString("utf8"),
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function recordMigration(db, migration, steps) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`
  ).run(crypto.randomUUID(), migration.checksum, now, migration.name, now, steps);
}

// Cria o que existir no banco modelo (mesma versão do programa) e faltar no
// banco do cliente. Só acrescenta — nunca apaga nem altera nada.
function addMissingFromTemplate(db, templateDb, log) {
  if (!fs.existsSync(templateDb)) return [];
  const template = openDb(templateDb, { readOnly: true });
  const added = [];
  try {
    const tables = template
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'"
      )
      .all();
    for (const table of tables) {
      if (!tableExists(db, table.name)) {
        db.exec(table.sql);
        added.push(`tabela ${table.name}`);
        continue;
      }
      const existing = new Set(db.prepare(`PRAGMA table_info("${table.name}")`).all().map((c) => c.name));
      for (const column of template.prepare(`PRAGMA table_info("${table.name}")`).all()) {
        if (existing.has(column.name)) continue;
        // ADD COLUMN não aceita default "não constante" (CURRENT_TIMESTAMP)
        // nem NOT NULL sem default — nesses casos só registra no log.
        const dynamicDefault = /current_(timestamp|date|time)/i.test(String(column.dflt_value ?? ""));
        if (dynamicDefault || (column.notnull && column.dflt_value === null)) {
          log(`AVISO: coluna ${table.name}.${column.name} não pôde ser criada automaticamente.`);
          continue;
        }
        let definition = `"${column.name}" ${column.type}`;
        if (column.dflt_value !== null) definition += ` DEFAULT ${column.dflt_value}`;
        if (column.notnull) definition += " NOT NULL";
        db.exec(`ALTER TABLE "${table.name}" ADD COLUMN ${definition}`);
        added.push(`coluna ${table.name}.${column.name}`);
      }
    }
    const indexes = template
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL")
      .all();
    for (const index of indexes) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(index.name)) continue;
      try {
        db.exec(index.sql);
        added.push(`índice ${index.name}`);
      } catch (error) {
        log(`AVISO: índice ${index.name} não pôde ser criado: ${error.message}`);
      }
    }
  } finally {
    template.close();
  }
  return added;
}

function applyPendingRestore({ dbFile, dataRoot, backupRoot, log }) {
  const marker = path.join(dataRoot, "restore-pending.json");
  if (!fs.existsSync(marker)) return;
  let request;
  try {
    request = JSON.parse(fs.readFileSync(marker, "utf8"));
  } catch {
    request = null;
  }
  fs.unlinkSync(marker);
  const source = request && request.file;
  if (!source || !fs.existsSync(source)) {
    log(`Restauração cancelada: backup não encontrado (${source}).`);
    return;
  }
  // Valida o arquivo antes de trocar: tem que abrir e ter a tabela de
  // usuários — senão o CRM nem subiria.
  try {
    const check = openDb(source, { readOnly: true });
    const ok = tableExists(check, "users");
    check.close();
    if (!ok) throw new Error("não parece um banco do Integra CRM");
  } catch (error) {
    log(`Restauração cancelada: ${source} inválido (${error.message}).`);
    return;
  }
  if (fs.existsSync(dbFile)) {
    const current = openDb(dbFile);
    snapshot(current, path.join(backupRoot, "antes-de-restaurar", `crm-${timestamp()}.db`));
    current.close();
  }
  removeSidecars(dbFile);
  fs.copyFileSync(source, dbFile);
  log(`Banco restaurado a partir de ${source} (o anterior ficou em backups\\antes-de-restaurar).`);
}

function prepareDatabase({ dbFile, templateDb, migrationsDir, dataRoot, backupRoot, log }) {
  if (!fs.existsSync(dbFile)) {
    fs.copyFileSync(templateDb, dbFile);
    log("Banco novo criado a partir da instalação limpa.");
  }

  applyPendingRestore({ dbFile, dataRoot, backupRoot, log });

  const migrations = listMigrations(migrationsDir);
  const db = openDb(dbFile);
  try {
    db.exec("PRAGMA busy_timeout = 10000");
    const applied = tableExists(db, "_prisma_migrations")
      ? new Set(
          db
            .prepare('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
            .all()
            .map((row) => row.migration_name)
        )
      : new Set();
    // "Antigo" = banco de antes das migrações atuais (sem a tabela, ou só
    // com nomes que não existem mais). Banco novo (só a estrutura vazia do
    // modelo) nunca cai aqui: o modelo já vem com as migrações registradas.
    const legacy = migrations.length > 0 && !migrations.some((migration) => applied.has(migration.name));
    const pending = legacy ? [] : migrations.filter((migration) => !applied.has(migration.name));

    if (legacy || pending.length > 0) {
      const target = path.join(backupRoot, "atualizacoes", `crm-antes-da-atualizacao-${timestamp()}.db`);
      log(`Backup antes de atualizar o banco: ${snapshot(db, target)}`);
    }

    if (legacy) {
      // Instalação de antes das migrações: o banco veio do modelo daquela
      // versão. Completa pelo modelo atual e marca todas como aplicadas.
      db.exec("BEGIN");
      try {
        const added = addMissingFromTemplate(db, templateDb, log);
        db.exec(MIGRATIONS_TABLE_SQL);
        db.exec('DELETE FROM "_prisma_migrations"');
        for (const migration of migrations) recordMigration(db, migration, 0);
        db.exec("COMMIT");
        log(`Banco antigo atualizado (${added.length} itens criados: ${added.join(", ") || "nenhum"}).`);
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }

    for (const migration of pending) {
      db.exec("BEGIN");
      try {
        db.exec(migration.sql);
        recordMigration(db, migration, 1);
        db.exec("COMMIT");
        log(`Migração aplicada: ${migration.name}`);
      } catch (error) {
        db.exec("ROLLBACK");
        // Para nas que faltam: aplicar a próxima sem esta quebraria o banco.
        log(`ERRO na migração ${migration.name}: ${error.message}. O banco ficou como estava.`);
        break;
      }
    }

    // Rede de segurança (normalmente não acha nada).
    const fixed = addMissingFromTemplate(db, templateDb, log);
    if (fixed.length > 0) log(`Estrutura completada pelo modelo: ${fixed.join(", ")}`);

    const violations = db.prepare("PRAGMA foreign_key_check").all();
    if (violations.length > 0) log(`AVISO: ${violations.length} referência(s) inválida(s) no banco.`);

    // Persistente no arquivo — basta uma vez, mas é barato repetir.
    db.exec("PRAGMA journal_mode = WAL");
  } finally {
    db.close();
  }
}

module.exports = { prepareDatabase };
