"use server";

import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";

const SEARCH_TAKE = 8;

// Compartilhado pelos 3 relatórios (Atendimentos/Comercial/Instalações) —
// busca de Contato/Empresa pro filtro específico (seção "procurar por
// apenas um contato, empresa..."). Basta ter acesso a qualquer um dos 3
// relatórios pra usar a busca, já que o filtro em si roda dentro da query
// já restrita por role de cada relatório.
async function requireReportsSession() {
  const session = await auth();
  if (!session?.user) return null;
  const hasAccess =
    canAccessModule(session.user.role, "relatorios_atendimento") ||
    canAccessModule(session.user.role, "relatorios_comercial") ||
    canAccessModule(session.user.role, "relatorios_instalacoes");
  return hasAccess ? session : null;
}

export type ReportSearchItem = { id: string; label: string; sublabel?: string };

export async function searchReportContacts(q: string): Promise<ReportSearchItem[]> {
  const session = await requireReportsSession();
  if (!session || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        ...(qDigits.length >= 3
          ? [{ phone: { contains: qDigits } }, { whatsapp: { contains: qDigits } }]
          : []),
      ],
    },
    select: { id: true, name: true, company: { select: { legalName: true, tradeName: true } } },
    take: SEARCH_TAKE,
    orderBy: { name: "asc" },
  });

  return contacts.map((c) => ({
    id: c.id,
    label: c.name,
    sublabel: c.company ? c.company.tradeName || c.company.legalName : undefined,
  }));
}

export async function searchReportCompanies(q: string): Promise<ReportSearchItem[]> {
  const session = await requireReportsSession();
  if (!session || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { legalName: { contains: q } },
        { tradeName: { contains: q } },
        ...(qDigits.length >= 4 ? [{ cnpj: { contains: qDigits } }] : []),
      ],
    },
    select: { id: true, legalName: true, tradeName: true },
    take: SEARCH_TAKE,
    orderBy: { legalName: "asc" },
  });

  return companies.map((c) => ({
    id: c.id,
    label: c.tradeName || c.legalName,
    sublabel: c.tradeName ? c.legalName : undefined,
  }));
}
