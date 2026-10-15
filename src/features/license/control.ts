import { createPublicKey, verify } from "node:crypto";

import { CONTROL_PUBLIC_KEY, CONTROL_URL } from "@/features/license/remote-config";

// Arquivo de controle publicado pelo Integra Publicador no GitHub:
//   { "conteudo": { ... }, "assinatura": "<base64 Ed25519>" }
// A assinatura é sobre JSON.stringify(conteudo) e só confere com a chave
// privada que fica no computador do fornecedor — ninguém mais consegue
// publicar um "desbloqueado" ou uma "atualização" falsa.
export type ControlVersion = {
  numero: string;
  titulo?: string;
  novidades?: string[];
  instalador: string;
  sha256: string;
  tamanho?: number;
  forcar: boolean;
};

export type ControlContent = {
  geradoEm: string;
  contato?: string;
  // hashes de CNPJ (cnpj-hash.ts) dos clientes ativos
  ativos: string[];
  versao?: ControlVersion | null;
};

export type SignedControl = { conteudo: ControlContent; assinatura: string };

export function isRemoteControlConfigured(): boolean {
  return Boolean(CONTROL_URL && CONTROL_PUBLIC_KEY);
}

export function verifySignedControl(raw: unknown): ControlContent {
  const signed = raw as SignedControl;
  if (!signed || typeof signed !== "object" || !signed.conteudo || typeof signed.assinatura !== "string") {
    throw new Error("Arquivo de controle em formato inválido.");
  }
  const ok = verify(
    null,
    Buffer.from(JSON.stringify(signed.conteudo)),
    createPublicKey(CONTROL_PUBLIC_KEY),
    Buffer.from(signed.assinatura, "base64")
  );
  if (!ok) throw new Error("Assinatura do arquivo de controle não confere.");
  if (!Array.isArray(signed.conteudo.ativos)) throw new Error("Lista de ativos ausente.");
  return signed.conteudo;
}

// Busca no GitHub (sem cache) e confere a assinatura. Devolve também o
// texto original, que é guardado pra consulta offline e pro atualizador.
export async function fetchControl(): Promise<{ content: ControlContent; raw: string }> {
  const url = `${CONTROL_URL}${CONTROL_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}.`);
  const raw = await response.text();
  return { content: verifySignedControl(JSON.parse(raw)), raw };
}

// "1.66" < "1.70" < "1.100" — compara número a número.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
