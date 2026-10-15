import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { findCompanyByCnpj } from "@/features/companies/queries";
import { DEFAULT_PROSPECCAO_FILTERS, type ProspeccaoFilters } from "@/features/prospeccao/storage";
import type { ProspectResult } from "@/features/prospeccao/types";

// Lead.companyCnpj não é normalizado nem indexado (diferente de
// Company.cnpj, que é @unique) — comparação feita em memória. Aceitável na
// escala de um CRM regional (poucos milhares de leads), evita depender de
// migration só pra essa checagem pontual.
export async function findExistingByCnpj(
  cnpjDigits: string
): Promise<{ existingCompanyId?: string; existingLeadId?: string }> {
  const [company, leadsWithCnpj] = await Promise.all([
    findCompanyByCnpj(cnpjDigits),
    prisma.lead.findMany({
      where: { companyCnpj: { not: null }, deletedAt: null },
      select: { id: true, companyCnpj: true },
    }),
  ]);

  const lead = leadsWithCnpj.find((l) => onlyDigits(l.companyCnpj ?? "") === cnpjDigits);

  return {
    existingCompanyId: company?.id,
    existingLeadId: lead?.id,
  };
}

export type ProspeccaoDraftData = {
  filters: ProspeccaoFilters;
  results: ProspectResult[];
};

// Nunca lança em cima de JSON corrompido — pior caso, volta como se não
// houvesse rascunho salvo (mesma postura de parseJsonArray na Empresa).
export async function getProspeccaoDraft(userId: string): Promise<ProspeccaoDraftData> {
  const row = await prisma.prospeccaoDraft.findUnique({ where: { userId } });
  if (!row) return { filters: DEFAULT_PROSPECCAO_FILTERS, results: [] };

  try {
    const filters = { ...DEFAULT_PROSPECCAO_FILTERS, ...JSON.parse(row.filters) };
    const results = JSON.parse(row.results);
    return {
      filters,
      results: Array.isArray(results) ? results : [],
    };
  } catch {
    return { filters: DEFAULT_PROSPECCAO_FILTERS, results: [] };
  }
}
