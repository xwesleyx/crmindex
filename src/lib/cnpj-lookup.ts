import { onlyDigits } from "@/lib/validators";

// Consulta pública da Receita Federal via BrasilAPI (espelha os mesmos dados
// oficiais, CORS liberado, sem chave/cadastro) — mesmo espírito de
// br-cep-lookup.ts (ViaCEP) e do hook de municípios do IBGE: chamada direto
// do client, sem proxy no servidor.
//
// Traz tudo que a API disponibiliza (não só o que preenche o formulário de
// cadastro) — usado tanto pela lupinha do form quanto pelo "Buscar dados
// completos" da Prospecção CNPJ, que existe justamente pra decisão de
// contato precisar de mais contexto que endereço/telefone.
export type CnaeSecundario = { codigo: string; descricao: string };
export type Socio = { nome: string; qualificacao?: string; dataEntrada?: string };

export type CnpjLookupResult = {
  razaoSocial: string;
  nomeFantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  telefone?: string;
  telefone2?: string;
  email?: string;
  situacao?: string;
  situacaoData?: string; // ISO
  cnae?: string;
  cnaeDescricao?: string;
  cnaesSecundarios?: CnaeSecundario[];
  naturezaJuridica?: string;
  porte?: string;
  capitalSocial?: number; // reais
  dataAbertura?: string; // ISO
  socios?: Socio[];
  optanteSimples?: boolean;
  optanteMei?: boolean;
};

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

// ddd_telefone_2 costuma vir como "000000000000" quando não tem — número
// real nunca é só zeros.
function asPhone(value: unknown): string | undefined {
  const text = asText(value);
  if (!text) return undefined;
  return /^0+$/.test(onlyDigits(text)) ? undefined : text;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// null na BrasilAPI = "não informado" (diferente de false) — não dá pra
// assumir "não optante" quando na verdade é "não sabemos".
function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export type CnpjLookupOutcome =
  | { ok: true; data: CnpjLookupResult }
  | { ok: false; reason: "invalid" | "not_found" | "rate_limited" | "error" };

// BrasilAPI não publica um limite fixo, mas bloqueia uso abusivo (429) —
// consultas repetidas em sequência rápida podem esbarrar nisso, por isso o
// motivo vem separado do "não encontrado" (mensagens diferentes pro usuário).
export async function fetchCompanyByCnpj(cnpj: string): Promise<CnpjLookupOutcome> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return { ok: false, reason: "invalid" };

  try {
    // O Cloudflare na frente da BrasilAPI devolve 403 pra fetch sem
    // User-Agent de navegador — inofensivo do client (o browser já manda um
    // de verdade), mas o fetch do Node (usado quando a importação da
    // Prospecção enriquece no servidor) precisa simular um, senão é
    // bloqueado sempre, silenciosamente virando "error" genérico.
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    if (response.status === 404) return { ok: false, reason: "not_found" };
    if (response.status === 429) return { ok: false, reason: "rate_limited" };
    if (!response.ok) return { ok: false, reason: "error" };

    const data = (await response.json()) as Record<string, unknown>;
    const razaoSocial = asText(data.razao_social);
    if (!razaoSocial) return { ok: false, reason: "not_found" };

    const cnaesSecundarios = Array.isArray(data.cnaes_secundarios)
      ? (data.cnaes_secundarios as unknown[])
          .map((raw) => {
            if (typeof raw !== "object" || raw === null) return null;
            const codigo = asText((raw as Record<string, unknown>).codigo) ?? String((raw as Record<string, unknown>).codigo ?? "");
            const descricao = asText((raw as Record<string, unknown>).descricao);
            return codigo && descricao ? { codigo, descricao } : null;
          })
          .filter((c): c is CnaeSecundario => c !== null)
      : undefined;

    const socios = Array.isArray(data.qsa)
      ? (data.qsa as unknown[])
          .map((raw) => {
            if (typeof raw !== "object" || raw === null) return null;
            const nome = asText((raw as Record<string, unknown>).nome_socio);
            if (!nome) return null;
            const socio: Socio = { nome };
            const qualificacao = asText((raw as Record<string, unknown>).qualificacao_socio);
            if (qualificacao) socio.qualificacao = qualificacao;
            const dataEntrada = asText((raw as Record<string, unknown>).data_entrada_sociedade);
            if (dataEntrada) socio.dataEntrada = dataEntrada;
            return socio;
          })
          .filter((s): s is Socio => s !== null)
      : undefined;

    return {
      ok: true,
      data: {
        razaoSocial,
        nomeFantasia: asText(data.nome_fantasia),
        cep: asText(data.cep),
        logradouro: asText(data.logradouro),
        numero: asText(data.numero),
        complemento: asText(data.complemento),
        bairro: asText(data.bairro),
        municipio: asText(data.municipio),
        uf: asText(data.uf),
        telefone: asPhone(data.ddd_telefone_1),
        telefone2: asPhone(data.ddd_telefone_2),
        email: asText(data.email),
        situacao: asText(data.descricao_situacao_cadastral),
        situacaoData: asText(data.data_situacao_cadastral),
        cnae: asText(data.cnae_fiscal != null ? String(data.cnae_fiscal) : undefined),
        cnaeDescricao: asText(data.cnae_fiscal_descricao),
        cnaesSecundarios: cnaesSecundarios && cnaesSecundarios.length > 0 ? cnaesSecundarios : undefined,
        naturezaJuridica: asText(data.natureza_juridica),
        porte: asText(data.porte),
        capitalSocial: asNumber(data.capital_social),
        dataAbertura: asText(data.data_inicio_atividade),
        socios: socios && socios.length > 0 ? socios : undefined,
        optanteSimples: asBoolean(data.opcao_pelo_simples),
        optanteMei: asBoolean(data.opcao_pelo_mei),
      },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}
