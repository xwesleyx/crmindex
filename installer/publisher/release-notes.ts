// Chamado pelo installer/build.ps1: grava as novidades da versão atual (a
// primeira entrada de src/lib/changelog.ts) num JSON ao lado do instalador.
// O Integra Publicador lê esse arquivo ao publicar a versão — é o texto do
// "Ver novidades" no aviso de versão nova dos clientes.
//
//   npx tsx installer/publisher/release-notes.ts <arquivo-de-saída.json>
import { writeFileSync } from "node:fs";

import { CHANGELOG } from "../../src/lib/changelog";

const target = process.argv[2];
if (!target) throw new Error("Informe o arquivo de saída.");

// Todas as entradas desta versão em diante seriam o ideal, mas o cliente pode
// estar várias versões atrás — o Publicador junta as que forem mais novas que
// a última publicada (ver publicador.js). Aqui vão as 30 mais recentes.
writeFileSync(
  target,
  JSON.stringify(
    {
      versao: CHANGELOG[0].version,
      titulo: CHANGELOG[0].title,
      entradas: CHANGELOG.slice(0, 30).map((entry) => ({
        versao: entry.version,
        titulo: entry.title,
        novidades: entry.changes,
      })),
    },
    null,
    2
  )
);
console.log(`Novidades gravadas em ${target}`);
