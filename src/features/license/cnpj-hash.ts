import { createHash } from "node:crypto";

// CNPJ "embaralhado" (hash) — é assim que ele aparece na lista pública de
// ativos no GitHub, pra lista não revelar quem são os clientes. O mesmo
// cálculo existe no Integra Publicador (installer/publisher/publicador.js);
// os dois precisam ficar iguais.
const SALT = "crm-index:licenca:v1:";

export function cnpjHash(cnpj: string): string {
  return createHash("sha256").update(SALT + cnpj.replace(/\D/g, "")).digest("hex");
}
