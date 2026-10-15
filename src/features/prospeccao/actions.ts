"use server";

import { revalidatePath } from "next/cache";

import { isMaskedValue, searchNewCompanies } from "@/lib/cnpj-prospection-api";
import { fetchCompanyByCnpj } from "@/lib/cnpj-lookup";
import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isValidCNPJ, isValidPhone, onlyDigits, stripBrazilCountryCode } from "@/lib/validators";
import { findExistingByCnpj } from "@/features/prospeccao/queries";
import { prospeccaoSearchSchema, type ProspeccaoSearchInput } from "@/features/prospeccao/schema";
import type { ProspeccaoFilters } from "@/features/prospeccao/storage";
import type { ProspectResult } from "@/features/prospeccao/types";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "crm")) return null;
  return session;
}

export async function searchCnpjProspects(
  input: ProspeccaoSearchInput
): Promise<ActionResult<ProspectResult[]>> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para prospectar CNPJs." };

  const parsed = prospeccaoSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await searchNewCompanies(parsed.data);
  if (!result.ok) return { success: false, error: result.error };

  const annotated = await Promise.all(
    result.data.map(async (company) => ({
      ...company,
      ...(await findExistingByCnpj(company.cnpj)),
    }))
  );

  await logActivity({
    userId: session.user.id,
    action: "prospeccao.search",
    entityType: "Lead",
    metadata: {
      uf: parsed.data.uf,
      cidade: parsed.data.cidade,
      dias: parsed.data.dias,
      found: annotated.length,
      revelarContatos: !!parsed.data.revelarContatos,
    },
  });

  return { success: true, data: annotated };
}

export async function importProspectsAsLeads(
  items: ProspectResult[]
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para criar leads." };

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const cnpj = onlyDigits(item.cnpj);
    if (!isValidCNPJ(cnpj) || !item.razaoSocial) {
      skipped++;
      continue;
    }

    // Revalida a dedupe no servidor — nunca confia no que veio do client
    // (a lista pode estar desatualizada em relação a leads/empresas criados
    // entre a busca e o clique em "Transformar em Lead").
    const existing = await findExistingByCnpj(cnpj);
    if (existing.existingCompanyId || existing.existingLeadId) {
      skipped++;
      continue;
    }

    // Se o item já veio enriquecido (usuário clicou "Buscar dados completos"
    // antes de importar), reaproveita — evita bater na BrasilAPI de novo.
    // Senão, tenta buscar agora, mas nunca bloqueia a criação do lead por
    // isso: sem chave/limite formal, a BrasilAPI pode devolver 429 numa
    // importação em lote, e nesse caso segue só com o que o CFO já deu.
    let enriched = item;
    if (!item.enrichedAt) {
      const outcome = await fetchCompanyByCnpj(cnpj);
      if (outcome.ok) {
        const d = outcome.data;
        // Telefone/e-mail da CFO vêm mascarados no plano gratuito — mascarado
        // não serve pra gravar no cadastro, prioriza o da BrasilAPI (que
        // também falha silenciosamente aqui, só continua vazio).
        const cfoTelefoneUsavel = item.telefone && !isMaskedValue(item.telefone) ? item.telefone : undefined;
        const cfoEmailUsavel = item.email && !isMaskedValue(item.email) ? item.email : undefined;
        enriched = {
          ...item,
          enrichedAt: new Date().toISOString(),
          nomeFantasia: item.nomeFantasia || d.nomeFantasia,
          telefone: cfoTelefoneUsavel ?? d.telefone,
          telefone2: d.telefone2,
          email: cfoEmailUsavel ?? d.email,
          situacao: item.situacao || d.situacao,
          situacaoData: d.situacaoData,
          cnae: item.cnae || d.cnae,
          cnaeDescricao: item.cnaeDescricao || d.cnaeDescricao,
          cnaesSecundarios: d.cnaesSecundarios,
          naturezaJuridica: d.naturezaJuridica,
          porte: item.porte || d.porte,
          capitalSocial: item.capitalSocial ?? d.capitalSocial,
          dataAbertura: item.dataAbertura || d.dataAbertura,
          // BrasilAPI só entra onde a CFO não tinha — a CFO já vem com
          // endereço estruturado, e sobrescrever com um campo vazio da
          // BrasilAPI (comum em MEI) jogaria fora um dado bom.
          logradouro: item.logradouro || d.logradouro,
          numero: item.numero || d.numero,
          complemento: item.complemento || d.complemento,
          bairro: item.bairro || d.bairro,
          cep: item.cep || d.cep,
          optanteSimples: d.optanteSimples,
          optanteMei: d.optanteMei,
        };
      }
      // outcome.ok === false: segue com `item` como estava, sem erro pro usuário.
    }

    let phone = "";
    if (enriched.telefone) {
      const digits = stripBrazilCountryCode(enriched.telefone);
      if (isValidPhone(digits)) phone = digits;
    }

    const foundedAt = enriched.dataAbertura ? new Date(enriched.dataAbertura) : null;
    const capitalSocialCents =
      typeof enriched.capitalSocial === "number" && Number.isFinite(enriched.capitalSocial)
        ? BigInt(Math.round(enriched.capitalSocial * 100))
        : null;
    const taxStatusDate = enriched.situacaoData ? new Date(enriched.situacaoData) : null;

    // A busca já traz tudo que a Receita disponibiliza pra essa empresa —
    // criar a Company agora (em vez de só na conversão em Oportunidade, como
    // o resto do CRM faz) evita perder esses dados; esperar a conversão
    // significaria ter que buscar de novo depois (e a API pode não trazer o
    // mesmo resultado passado o período de "empresa recém-aberta").
    const { lead } = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          legalName: enriched.razaoSocial,
          tradeName: enriched.nomeFantasia || null,
          cnpj,
          phone: phone || null,
          email: enriched.email ?? null,
          addressLine: enriched.logradouro || enriched.endereco || null,
          addressNumber: enriched.numero || null,
          complement: enriched.complemento || null,
          neighborhood: enriched.bairro || null,
          zipCode: enriched.cep || null,
          city: enriched.cidade || null,
          state: enriched.uf || null,
          cnae: enriched.cnae || null,
          cnaeDescricao: enriched.cnaeDescricao || null,
          cnaesSecundarios: enriched.cnaesSecundarios ? JSON.stringify(enriched.cnaesSecundarios) : null,
          naturezaJuridica: enriched.naturezaJuridica || null,
          porte: enriched.porte || null,
          foundedAt,
          capitalSocialCents,
          taxStatus: enriched.situacao || null,
          taxStatusDate,
          socios: enriched.socios ? JSON.stringify(enriched.socios) : null,
          optanteSimples: enriched.optanteSimples ?? null,
          optanteMei: enriched.optanteMei ?? null,
          receitaEnrichedAt: enriched.enrichedAt ? new Date(enriched.enrichedAt) : null,
          origin: "PROSPECCAO",
          responsibleId: session.user.id,
        },
      });

      const lead = await tx.lead.create({
        data: {
          name: item.razaoSocial,
          phone, // "deixa em branco se não tiver" — só esta importação permite string vazia
          email: enriched.email ?? null,
          companyName: item.razaoSocial,
          companyCnpj: cnpj,
          sourceCompanyId: company.id,
          origin: "PROSPECCAO",
          status: "NOVO",
          priority: "NORMAL",
          notes: [
            "Importado via prospecção CNPJ",
            item.cidade || item.uf ? `(${[item.cidade, item.uf].filter(Boolean).join("/")})` : null,
            item.dataAbertura ? `— abertura: ${item.dataAbertura}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          responsibleId: session.user.id,
        },
      });

      return { company, lead };
    });

    await logActivity({
      userId: session.user.id,
      action: "lead.created_from_prospeccao",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { cnpj, companyId: lead.sourceCompanyId },
    });

    created++;
  }

  revalidatePath("/crm/leads");
  return { success: true, data: { created, skipped } };
}

// Rascunho da busca (filtros + resultados ainda não importados) salvo por
// usuário — acessar de outro aparelho mostra a mesma busca (era localStorage
// antes, que não saía do navegador onde foi feita).
export async function saveProspeccaoDraft(filters: ProspeccaoFilters, results: ProspectResult[]): Promise<void> {
  const session = await requireCrmSession();
  if (!session) return;

  try {
    await prisma.prospeccaoDraft.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, filters: JSON.stringify(filters), results: JSON.stringify(results) },
      update: { filters: JSON.stringify(filters), results: JSON.stringify(results) },
    });
  } catch (error) {
    // Autosave em segundo plano — uma falha aqui não pode quebrar a tela.
    console.error("Falha ao salvar rascunho da prospecção", error);
  }
}

export async function clearProspeccaoDraft(): Promise<void> {
  const session = await requireCrmSession();
  if (!session) return;

  await prisma.prospeccaoDraft.deleteMany({ where: { userId: session.user.id } });
}
