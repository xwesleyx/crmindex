"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditCustomer } from "@/features/customers/permissions";
import { canEditCompany } from "@/features/companies/permissions";
import {
  getCustomerByCompanyId,
  getCustomerByContactId,
  searchCompaniesForCustomer,
  searchContactsForCustomer,
} from "@/features/customers/queries";
import {
  createCustomerSchema,
  customerFormSchema,
  type CreateCustomerInput,
  type CustomerFormInput,
} from "@/features/customers/schema";
import { getDefaultRegionId } from "@/features/regions/queries";

type ActionResult = { success: true } | { success: false; error: string };
type ActionResultWithData<T> = { success: true; data: T } | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "clientes")) return null;
  return session;
}

export async function searchCompanies(q: string) {
  const session = await requireCrmSession();
  if (!session) return [];
  return searchCompaniesForCustomer(q);
}

export async function searchContacts(q: string) {
  const session = await requireCrmSession();
  if (!session) return [];
  return searchContactsForCustomer(q);
}

// Cadastro manual (seção pedida pelo usuário: Atendimento precisa vincular
// contato a um cliente que ainda não existe). Empresa/Contato continuam
// sendo a identidade — aqui só cria o Customer que os relaciona.
export async function createCustomer(input: CreateCustomerInput): Promise<ActionResultWithData<{ id: string }>> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para cadastrar clientes." };

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { companyId, contactId, responsibleId, notes } = parsed.data;

  // Erro amigável em vez de estourar a constraint @unique do banco — seção
  // 522 do schema: no máximo um Customer por Company e por Contact.
  if (companyId) {
    const existing = await getCustomerByCompanyId(companyId);
    if (existing) return { success: false, error: "Esta empresa já é cliente." };
  }
  if (contactId) {
    const existing = await getCustomerByContactId(contactId);
    if (existing) return { success: false, error: "Este contato já é cliente." };
  }

  // "qualquer... cliente... virá nessa padrão" — cadastro manual não pede
  // região, então já nasce com a padrão (Cachoeiro).
  const customer = await prisma.customer.create({
    data: {
      companyId: companyId ?? null,
      contactId: contactId ?? null,
      responsibleId: responsibleId ?? null,
      regionId: await getDefaultRegionId(),
      notes: notes ?? null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "customer.created_manually",
    entityType: "Customer",
    entityId: customer.id,
  });

  revalidatePath("/clientes");
  return { success: true, data: { id: customer.id } };
}

// "Tornar cliente" direto da empresa (listagem e tela da Empresa): cria o
// Customer só com a empresa, herdando responsável e região dela (região
// padrão se a empresa não tiver).
export async function convertCompanyToCustomer(companyId: string): Promise<ActionResultWithData<{ id: string }>> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para cadastrar clientes." };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, deletedAt: true, responsibleId: true, regionId: true, customer: { select: { id: true } } },
  });
  if (!company || company.deletedAt) return { success: false, error: "Empresa não encontrada." };
  if (!canEditCompany(session.user.role, session.user.id, company)) {
    return { success: false, error: "Esta empresa pertence a outro responsável." };
  }
  if (company.customer) return { success: false, error: "Esta empresa já é cliente." };

  const customer = await prisma.customer.create({
    data: {
      companyId,
      responsibleId: company.responsibleId,
      regionId: company.regionId ?? (await getDefaultRegionId()),
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "customer.created_from_company",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { companyId },
  });
  await logActivity({
    userId: session.user.id,
    action: "company.converted_to_customer",
    entityType: "Company",
    entityId: companyId,
    metadata: { customerId: customer.id },
  });

  revalidatePath("/clientes");
  revalidatePath("/clientes/empresas");
  revalidatePath(`/clientes/empresas/${companyId}`);
  return { success: true, data: { id: customer.id } };
}

export async function updateCustomer(id: string, input: CustomerFormInput): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar clientes." };

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Cliente não encontrado." };

  if (!canEditCustomer(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar este cliente." };
  }

  const parsed = customerFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = {
    status: parsed.data.status,
    responsibleId: parsed.data.responsibleId ?? null,
    regionId: parsed.data.regionId ?? (await getDefaultRegionId()),
    notes: parsed.data.notes ?? null,
  };

  await prisma.customer.update({ where: { id }, data });

  if (existing.status !== data.status) {
    await logActivity({
      userId: session.user.id,
      action: data.status === "ATIVO" ? "customer.activated" : "customer.deactivated",
      entityType: "Customer",
      entityId: id,
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
      action: "customer.responsible_change",
      entityType: "Customer",
      entityId: id,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }

  if (existing.notes !== data.notes) {
    await logActivity({
      userId: session.user.id,
      action: "customer.updated",
      entityType: "Customer",
      entityId: id,
      metadata: { fields: ["notes"] },
    });
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { success: true };
}
