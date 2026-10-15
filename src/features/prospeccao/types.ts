import type { CfoCompany } from "@/lib/cnpj-prospection-api";
import type { CnaeSecundario, Socio } from "@/lib/cnpj-lookup";

// Resultado de busca já anotado com a dedupe contra o CRM (ver
// findExistingByCnpj em queries.ts) — é isso que trafega entre a Server
// Action de busca, a tabela de resultados e a Server Action de importação.
//
// Os campos abaixo de `enrichedAt` só existem depois que alguém clica em
// "Buscar dados completos" no card de detalhe (features/cnpj-lookup.ts, via
// BrasilAPI) — a busca inicial (CFO.com.br) não traz isso, é uma consulta de
// lista, não de detalhe por CNPJ.
export type ProspectResult = CfoCompany & {
  existingCompanyId?: string;
  existingLeadId?: string;

  enrichedAt?: string; // ISO — presença marca que já foi enriquecido
  cnaeDescricao?: string;
  cnaesSecundarios?: CnaeSecundario[];
  naturezaJuridica?: string;
  porte?: string;
  situacaoData?: string; // ISO
  socios?: Socio[];
  // Endereço/telefone completos da consulta por CNPJ (mais confiáveis que os
  // que vêm soltos do CFO, quando disponíveis).
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  telefone2?: string;
  optanteSimples?: boolean;
  optanteMei?: boolean;
};
