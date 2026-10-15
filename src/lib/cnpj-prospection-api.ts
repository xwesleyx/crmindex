import { getAppSetting } from "@/lib/app-settings";
import { onlyDigits } from "@/lib/validators";

// Cliente da API de prospecção de CNPJ (CFO.com.br — dados abertos da
// Receita Federal, ver plano em C:\Users\WESLEY\.claude\plans). Não existe
// endpoint oficial do governo pra buscar empresas por cidade/período; este é
// um provedor terceiro escolhido pelo usuário por ter plano gratuito.
//
// Formato confirmado com uma key real (resource=empresas): objetos aninhados
// pra situação/cnae/porte/endereço, e contato.telefone/contato.email vêm
// MASCARADOS no plano gratuito (ex: "(28) 9***-**72") — não é bug daqui,
// é limitação do plano; ver isMaskedValue.
export type CfoCompany = {
  cnpj: string; // sempre normalizado (só dígitos)
  razaoSocial: string;
  nomeFantasia?: string;
  dataAbertura?: string; // ISO, se a API trouxer
  uf?: string;
  cidade?: string;
  cnae?: string;
  cnaeDescricao?: string;
  telefone?: string; // pode vir mascarado — ver isMaskedValue
  email?: string; // idem
  endereco?: string; // texto pronto pra exibir (logradouro, número — bairro)
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  capitalSocial?: number;
  situacao?: string;
  porte?: string;
};

export type SearchNewCompaniesResult =
  | { ok: true; data: CfoCompany[] }
  | { ok: false; error: string };

// Contato mascarado pelo plano gratuito da CFO sempre tem "*" no meio (ex:
// "(28) 9***-**72", "JUC***@GMA***.COM") — nunca um telefone/e-mail real.
export function isMaskedValue(value: string | undefined): boolean {
  return !!value && value.includes("*");
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

// situacao/cnae_principal/porte/endereco/contato vêm como objeto aninhado —
// esse helper lê uma chave de dentro deles sem lançar se o objeto não vier.
function nested(raw: unknown, key: string): unknown {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>)[key] : undefined;
}

function parseCompany(raw: Record<string, unknown>): CfoCompany | null {
  const cnpjRaw = asString(raw.cnpj_raw) ?? asString(raw.cnpj);
  if (!cnpjRaw) return null;
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return null;

  const razaoSocial = asString(raw.razao_social ?? raw.razaoSocial ?? raw.nome);
  if (!razaoSocial) return null;

  const endereco = raw.endereco;
  const logradouro = asString(nested(endereco, "logradouro"));
  const numero = asString(nested(endereco, "numero"));
  const complemento = asString(nested(endereco, "complemento"));
  const bairro = asString(nested(endereco, "bairro"));
  const municipio = asString(nested(endereco, "municipio")) ?? asString(raw.cidade ?? raw.municipio);
  const uf = asString(nested(endereco, "uf")) ?? asString(raw.uf);
  const cep = asString(nested(endereco, "cep"));

  const enderecoTexto =
    [[logradouro, numero].filter(Boolean).join(", "), bairro].filter(Boolean).join(" — ") || undefined;

  const contato = raw.contato;

  return {
    cnpj,
    razaoSocial,
    nomeFantasia: asString(raw.nome_fantasia ?? raw.nomeFantasia ?? raw.fantasia),
    dataAbertura: asString(raw.data_inicio ?? raw.dataAbertura ?? raw.data_abertura),
    uf,
    cidade: municipio,
    cnae: asString(nested(raw.cnae_principal, "codigo") ?? raw.cnae ?? raw.cnae_principal),
    cnaeDescricao: asString(nested(raw.cnae_principal, "descricao")),
    telefone: asString(nested(contato, "telefone") ?? raw.telefone),
    email: asString(nested(contato, "email") ?? raw.email),
    endereco: enderecoTexto,
    logradouro,
    numero,
    complemento,
    bairro,
    cep,
    capitalSocial: asNumber(raw.capital_social ?? raw.capitalSocial),
    situacao: asString(nested(raw.situacao, "descricao") ?? raw.situacao),
    porte: asString(nested(raw.porte, "descricao") ?? raw.porte),
  };
}

export async function searchNewCompanies(params: {
  uf: string;
  cidade: string;
  dias: number;
  cnae?: string;
  // reveal=1 desmascara telefone/e-mail, mas consome 1 "lead revelado" da
  // cota mensal por empresa retornada na busca (documentação da CFO) — por
  // isso é opt-in, nunca ligado por padrão.
  revelarContatos?: boolean;
}): Promise<SearchNewCompaniesResult> {
  const apiKey = await getAppSetting("CFO_API_KEY", process.env.CFO_API_KEY);
  const baseUrl = process.env.CFO_API_URL || "https://cfo.com.br/api";
  if (!apiKey) {
    return { ok: false, error: "Prospecção CNPJ não configurada — veja Configurações > Integrações." };
  }

  const query = new URLSearchParams({
    resource: "empresas",
    uf: params.uf,
    cidade: params.cidade,
    dias: String(params.dias),
    per_page: "25",
  });
  if (params.cnae) query.set("cnae", params.cnae);
  if (params.revelarContatos) query.set("reveal", "1");

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "API key da CFO recusada — confira em Configurações > Integrações." };
      }
      if (response.status === 429) {
        return { ok: false, error: "Cota de buscas gratuitas da CFO esgotada neste mês." };
      }
      return { ok: false, error: `Falha ao consultar a CFO (status ${response.status}).` };
    }

    const body = (await response.json()) as unknown;
    const list = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: unknown })?.data)
        ? ((body as { data: unknown[] }).data)
        : Array.isArray((body as { empresas?: unknown })?.empresas)
          ? ((body as { empresas: unknown[] }).empresas)
          : [];

    const data = list
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(parseCompany)
      .filter((c): c is CfoCompany => c !== null);

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
