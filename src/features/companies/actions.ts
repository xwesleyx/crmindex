"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditCompany } from "@/features/companies/permissions";
import {
  companyFormSchema,
  normalizeCnpj,
  type CompanyFormInput,
} from "@/features/companies/schema";
import { getDefaultRegionId } from "@/features/regions/queries";

type DuplicateCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
};

type CreateCompanyResult =
  | { status: "success"; id: string }
  | { status: "error"; error: string }
  | { status: "duplicate"; company: DuplicateCompany };

type ActionResult =
  | { success: true }
  | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "clientes")) {
    return null;
  }
  return session;
}

function toCompanyData(input: CompanyFormInput) {
  return {
    legalName: input.legalName,
    tradeName: input.tradeName ?? null,
    cnpj: normalizeCnpj(input.cnpj) ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    addressLine: input.addressLine ?? null,
    addressNumber: input.addressNumber ?? null,
    complement: input.complement ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zipCode: input.zipCode ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive,
    origin: input.origin ?? null,
    responsibleId: input.responsibleId ?? null,
    regionId: input.regionId ?? null,
  };
}

const DUPLICATE_SELECT = {
  id: true,
  legalName: true,
  tradeName: true,
  cnpj: true,
  phone: true,
  email: true,
} as const;

export async function createCompany(
  input: CompanyFormInput
): Promise<CreateCompanyResult> {
  const session = await requireCrmSession();
  if (!session) return { status: "error", error: "Você não tem permissão para criar empresas." };

  const parsed = companyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cnpj = normalizeCnpj(parsed.data.cnpj);

  // CNPJ é @unique no banco — se já existe, é sempre duplicidade real (não
  // como telefone de contato, que pode ser legitimamente compartilhado), por
  // isso não existe "continuar mesmo assim" aqui (seção 10 do escopo).
  if (cnpj) {
    const existing = await prisma.company.findUnique({
      where: { cnpj },
      select: DUPLICATE_SELECT,
    });
    if (existing) return { status: "duplicate", company: existing };
  }

  try {
    // Sem região escolhida no formulário, cai na região padrão (Cachoeiro)
    // — "qualquer empresa... virá nessa padrão".
    const data = toCompanyData(parsed.data);
    if (!data.regionId) data.regionId = await getDefaultRegionId();

    const company = await prisma.company.create({ data });

    await logActivity({
      userId: session.user.id,
      action: "company.created",
      entityType: "Company",
      entityId: company.id,
    });

    revalidatePath("/clientes/empresas");
    return { status: "success", id: company.id };
  } catch {
    // Nunca expor erro técnico do Prisma (seção 10) — cobre a corrida entre
    // o cheque de duplicidade acima e o create (dois usuários simultâneos).
    return { status: "error", error: "Já existe uma empresa com este CNPJ." };
  }
}

export async function updateCompany(
  id: string,
  input: CompanyFormInput
): Promise<CreateCompanyResult> {
  const session = await requireCrmSession();
  if (!session) return { status: "error", error: "Você não tem permissão para editar empresas." };

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { status: "error", error: "Empresa não encontrada." };

  if (!canEditCompany(session.user.role, session.user.id, existing)) {
    return { status: "error", error: "Você não tem permissão para editar esta empresa." };
  }

  const parsed = companyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cnpj = normalizeCnpj(parsed.data.cnpj);

  if (cnpj && cnpj !== existing.cnpj) {
    const duplicate = await prisma.company.findUnique({
      where: { cnpj },
      select: DUPLICATE_SELECT,
    });
    if (duplicate) return { status: "duplicate", company: duplicate };
  }

  const data = toCompanyData(parsed.data);
  if (!data.regionId) data.regionId = await getDefaultRegionId();

  try {
    await prisma.company.update({ where: { id }, data });
  } catch {
    return { status: "error", error: "Já existe uma empresa com este CNPJ." };
  }

  if (existing.cnpj !== data.cnpj) {
    await logActivity({
      userId: session.user.id,
      action: "company.updated",
      entityType: "Company",
      entityId: id,
      metadata: { field: "cnpj", from: existing.cnpj, to: data.cnpj },
    });
  }

  if (existing.responsibleId !== data.responsibleId) {
    const [fromUser, toUser] = await Promise.all([
      existing.responsibleId
        ? prisma.user.findUnique({ where: { id: existing.responsibleId }, select: { name: true } })
        : null,
      data.responsibleId
        ? prisma.user.findUnique({ where: { id: data.responsibleId }, select: { name: true } })
        : null,
    ]);

    await logActivity({
      userId: session.user.id,
      action: "company.responsible_change",
      entityType: "Company",
      entityId: id,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }

  const otherFields = (
    [
      "legalName", "tradeName", "phone", "whatsapp", "email", "website",
      "addressLine", "addressNumber", "complement", "neighborhood", "city",
      "state", "zipCode", "notes", "isActive", "origin", "regionId",
    ] as const
  ).filter((field) => existing[field] !== data[field]);

  if (otherFields.length > 0) {
    await logActivity({
      userId: session.user.id,
      action: "company.updated",
      entityType: "Company",
      entityId: id,
      metadata: { fields: otherFields },
    });
  }

  revalidatePath("/clientes/empresas");
  revalidatePath(`/clientes/empresas/${id}`);
  return { status: "success", id };
}

export async function toggleCompanyArchived(id: string): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para arquivar empresas." };

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Empresa não encontrada." };

  if (!canEditCompany(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para arquivar esta empresa." };
  }

  const isArchiving = !existing.deletedAt;

  await prisma.company.update({
    where: { id },
    data: { deletedAt: isArchiving ? new Date() : null },
  });

  await logActivity({
    userId: session.user.id,
    action: isArchiving ? "company.archived" : "company.restored",
    entityType: "Company",
    entityId: id,
  });

  revalidatePath("/clientes/empresas");
  revalidatePath(`/clientes/empresas/${id}`);
  return { success: true };
}
