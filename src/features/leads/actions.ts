"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { canEditLead } from "@/features/leads/permissions";
import { getDefaultRegionId } from "@/features/regions/queries";
import { recomputeLeadTemperature } from "@/features/temperature/lead";
import {
  convertLeadSchema,
  leadFormSchema,
  type ConvertLeadInput,
  type LeadFormInput,
} from "@/features/leads/schema";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "crm")) {
    return null;
  }
  return session;
}

// Só para convertLeadToOpportunity: a Central de Atendimento (Fase 6, seção
// 14) também converte lead em oportunidade a partir de uma conversa, e o
// papel ATENDIMENTO tem acesso ao módulo "atendimento" mas não ao "crm"
// (src/lib/permissions.ts). Em vez de duplicar toda a lógica de conversão
// em outro arquivo, esta ação aceita quem tem qualquer um dos dois módulos.
async function requireCrmOrAtendimentoSession() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  if (!canAccessModule(role, "crm") && !canAccessModule(role, "atendimento")) {
    return null;
  }
  return session;
}

function toLeadData(input: LeadFormInput) {
  return {
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    companyName: input.companyName ?? null,
    companyCnpj: input.companyCnpj ?? null,
    origin: input.origin,
    priority: input.priority,
    status: input.status,
    notes: input.notes ?? null,
    responsibleId: input.responsibleId ?? null,
    nextActionAt: input.nextActionAt ?? null,
    nextActionNote: input.nextActionNote ?? null,
    lastInteractionAt: input.lastInteractionAt ?? null,
  };
}

export async function createLead(
  input: LeadFormInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para criar leads." };
  }

  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const lead = await prisma.lead.create({
    data: toLeadData(parsed.data),
  });

  await logActivity({
    userId: session.user.id,
    action: "lead.create",
    entityType: "Lead",
    entityId: lead.id,
  });

  await recomputeLeadTemperature(lead.id);
  revalidatePath("/crm/leads");
  return { success: true, data: { id: lead.id } };
}

export async function updateLead(
  id: string,
  input: LeadFormInput
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para editar leads." };
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return { success: false, error: "Lead não encontrado." };
  }

  if (!canEditLead(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar este lead." };
  }

  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = toLeadData(parsed.data);

  await prisma.lead.update({ where: { id }, data });

  await logStatusPriorityResponsibleChanges({
    userId: session.user.id,
    leadId: id,
    before: existing,
    after: data,
  });

  const otherFieldsChanged = (
    ["name", "phone", "whatsapp", "email", "companyName", "companyCnpj", "notes", "nextActionAt", "nextActionNote", "lastInteractionAt"] as const
  ).filter((field) => {
    const beforeValue = existing[field];
    const afterValue = data[field];
    const beforeTime = beforeValue instanceof Date ? beforeValue.getTime() : beforeValue;
    const afterTime = afterValue instanceof Date ? afterValue.getTime() : afterValue;
    return beforeTime !== afterTime;
  });

  if (otherFieldsChanged.length > 0) {
    await logActivity({
      userId: session.user.id,
      action: "lead.update",
      entityType: "Lead",
      entityId: id,
      metadata: { fields: otherFieldsChanged },
    });
  }

  await recomputeLeadTemperature(id);
  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${id}`);
  return { success: true, data: undefined };
}

// Converte um lead em oportunidade (seção "fase futura" do enum LeadStatus,
// agora implementada): localiza-ou-cria Company/Contact a partir dos dados
// informais do lead — mesmo princípio de dedupe idempotente do
// runOpportunityWonAutomation — depois cria a Opportunity (sourceLeadId) e
// marca o lead como CONVERTIDO, tudo na mesma transação.
export async function convertLeadToOpportunity(
  id: string,
  input: ConvertLeadInput
): Promise<ActionResult<{ opportunityId: string }>> {
  const session = await requireCrmOrAtendimentoSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para converter leads." };
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return { success: false, error: "Lead não encontrado." };
  }
  if (!canEditLead(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para converter este lead." };
  }
  if (existing.status === "CONVERTIDO") {
    return { success: false, error: "Este lead já foi convertido em oportunidade." };
  }

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const stage = await prisma.kanbanStage.findUnique({ where: { id: parsed.data.stageId } });
  if (!stage || stage.board !== "COMMERCIAL") {
    return { success: false, error: "Etapa inválida." };
  }

  try {
    const opportunityId = await prisma.$transaction(async (tx) => {
      let companyId: string | null = null;
      if (existing.companyName) {
        const cnpj = existing.companyCnpj ? onlyDigits(existing.companyCnpj) : null;
        let company = cnpj ? await tx.company.findUnique({ where: { cnpj } }) : null;

        if (!company) {
          company = await tx.company.create({
            data: {
              legalName: existing.companyName,
              cnpj: cnpj || null,
              origin: existing.origin,
              responsibleId: existing.responsibleId,
              regionId: await getDefaultRegionId(tx),
            },
          });
          await logActivity(
            {
              userId: session.user.id,
              action: "company.created_from_lead",
              entityType: "Company",
              entityId: company.id,
              metadata: { leadId: existing.id },
            },
            tx
          );
        }
        companyId = company.id;
      }

      // Casa por telefone OU WhatsApp (não só telefone): um contato criado
      // "só com WhatsApp" (contacts schema — telefone pode ser nulo) não
      // seria encontrado só pelo campo phone, e um novo Contact duplicado
      // seria criado. Usado também pelo fluxo de Atendimento (seção 14 da
      // Fase 6), onde isso é comum — conversa chega só com WhatsApp.
      const phone = onlyDigits(existing.phone);
      const whatsapp = existing.whatsapp ? onlyDigits(existing.whatsapp) : null;
      let contact = await tx.contact.findFirst({
        where: {
          deletedAt: null,
          OR: [{ phone }, ...(whatsapp ? [{ whatsapp }] : [])],
        },
      });

      if (!contact) {
        contact = await tx.contact.create({
          data: {
            name: existing.name,
            phone,
            whatsapp: existing.whatsapp ? onlyDigits(existing.whatsapp) : null,
            email: existing.email,
            companyId,
            origin: existing.origin,
            responsibleId: existing.responsibleId,
          },
        });
        await logActivity(
          {
            userId: session.user.id,
            action: "contact.created_from_lead",
            entityType: "Contact",
            entityId: contact.id,
            metadata: { leadId: existing.id },
          },
          tx
        );
      }

      const opportunity = await tx.opportunity.create({
        data: {
          title: parsed.data.title,
          companyId,
          contactId: contact.id,
          ownerId: parsed.data.ownerId ?? existing.responsibleId,
          stageId: parsed.data.stageId,
          priority: parsed.data.priority,
          estimatedValueCents: parsed.data.estimatedValueCents,
          origin: existing.origin,
          sourceLeadId: existing.id,
        },
      });

      await logActivity(
        {
          userId: session.user.id,
          action: "opportunity.created_from_lead",
          entityType: "Opportunity",
          entityId: opportunity.id,
          metadata: { sourceLeadId: existing.id },
        },
        tx
      );

      await tx.lead.update({
        where: { id: existing.id },
        data: {
          status: "CONVERTIDO",
          convertedContactId: contact.id,
          convertedCompanyId: companyId,
          convertedAt: new Date(),
        },
      });

      await logActivity(
        {
          userId: session.user.id,
          action: "lead.converted",
          entityType: "Lead",
          entityId: existing.id,
          metadata: { opportunityId: opportunity.id },
        },
        tx
      );

      return opportunity.id;
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${id}`);
    revalidatePath("/crm/oportunidades");
    revalidatePath("/crm/kanban");
    revalidatePath("/dashboard");
    revalidatePath("/clientes/empresas");
    revalidatePath("/clientes/contatos");

    return { success: true, data: { opportunityId } };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Não foi possível converter o lead. Tente novamente." };
  }
}

async function logStatusPriorityResponsibleChanges({
  userId,
  leadId,
  before,
  after,
}: {
  userId: string;
  leadId: string;
  before: { status: string; priority: string; responsibleId: string | null };
  after: { status: string; priority: string; responsibleId: string | null };
}) {
  if (before.status !== after.status) {
    await logActivity({
      userId,
      action: "lead.status_change",
      entityType: "Lead",
      entityId: leadId,
      metadata: { from: before.status, to: after.status },
    });
  }

  if (before.priority !== after.priority) {
    await logActivity({
      userId,
      action: "lead.priority_change",
      entityType: "Lead",
      entityId: leadId,
      metadata: { from: before.priority, to: after.priority },
    });
  }

  if (before.responsibleId !== after.responsibleId) {
    const [fromUser, toUser] = await Promise.all([
      before.responsibleId
        ? prisma.user.findUnique({ where: { id: before.responsibleId }, select: { name: true } })
        : null,
      after.responsibleId
        ? prisma.user.findUnique({ where: { id: after.responsibleId }, select: { name: true } })
        : null,
    ]);

    await logActivity({
      userId,
      action: "lead.responsible_change",
      entityType: "Lead",
      entityId: leadId,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }
}

export async function toggleLeadArchived(id: string): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para arquivar leads." };
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Lead não encontrado." };
  }

  if (!canEditLead(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para arquivar este lead." };
  }

  const isArchiving = !existing.deletedAt;

  await prisma.lead.update({
    where: { id },
    data: { deletedAt: isArchiving ? new Date() : null },
  });

  await logActivity({
    userId: session.user.id,
    action: isArchiving ? "lead.archive" : "lead.restore",
    entityType: "Lead",
    entityId: id,
  });

  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${id}`);
  return { success: true, data: undefined };
}
