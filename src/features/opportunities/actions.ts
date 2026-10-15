"use server";

import type { KanbanStage, Opportunity, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { CAPABILITIES, canAccessModule } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { prisma } from "@/lib/prisma";
import { LOST_STAGE_KEY, WON_STAGE_KEY } from "@/features/kanban/constants";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import {
  lostReasonSchema,
  opportunityFormSchema,
  type LostReasonInput,
  type OpportunityFormInput,
} from "@/features/opportunities/schema";
import { AutomationError, runOpportunityWonAutomation } from "@/features/sales/win-automation";
import { recomputeOpportunityTemperature } from "@/features/temperature/opportunity";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "crm")) return null;
  return session;
}

function toOpportunityData(input: OpportunityFormInput) {
  return {
    title: input.title,
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    ownerId: input.ownerId ?? null,
    stageId: input.stageId,
    priority: input.priority,
    estimatedValueCents: input.estimatedValueCents,
    recurringValueCents: input.recurringValueCents ?? 0,
    origin: input.origin,
    expectedCloseAt: input.expectedCloseAt ?? null,
    lastInteractionAt: input.lastInteractionAt ?? null,
    description: input.description ?? null,
    notes: input.notes ?? null,
  };
}

function revalidateOpportunityPaths(id?: string) {
  revalidatePath("/crm/oportunidades");
  revalidatePath("/crm/kanban");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/crm/oportunidades/${id}`);
}

function revalidateWinPaths() {
  revalidatePath("/clientes");
  revalidatePath("/vendas");
  revalidatePath("/instalacoes");
  revalidatePath("/instalacoes/kanban");
}

// Compartilhado por markOpportunityWon e changeOpportunityStage (quando o
// alvo é a etapa "Venda Ganha") — evita duplicar a lógica de "marcar como
// ganha" em dois lugares. Roda dentro da transação aberta pelo chamador.
async function winOpportunityTx(
  tx: Prisma.TransactionClient,
  existing: Opportunity,
  fromStage: { id: string; name: string },
  wonStage: KanbanStage,
  userId: string,
  kanbanOrder?: number
) {
  const alreadyOnWonStage = existing.stageId === wonStage.id;

  await tx.opportunity.update({
    where: { id: existing.id },
    data: {
      status: "WON",
      wonAt: existing.wonAt ?? new Date(),
      stageId: wonStage.id,
      stageEnteredAt: alreadyOnWonStage ? existing.stageEnteredAt : new Date(),
      ...(kanbanOrder !== undefined ? { kanbanOrder } : {}),
    },
  });

  if (!alreadyOnWonStage) {
    await logActivity(
      {
        userId,
        action: "opportunity.stage_change",
        entityType: "Opportunity",
        entityId: existing.id,
        metadata: {
          fromStageId: fromStage.id,
          fromStageName: fromStage.name,
          toStageId: wonStage.id,
          toStageName: wonStage.name,
        },
      },
      tx
    );
  }

  if (existing.status !== "WON") {
    await logActivity(
      { userId, action: "opportunity.won", entityType: "Opportunity", entityId: existing.id },
      tx
    );
  }

  return runOpportunityWonAutomation(tx, existing, userId);
}

export async function createOpportunity(
  input: OpportunityFormInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para criar oportunidades." };
  }

  const parsed = opportunityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const stage = await prisma.kanbanStage.findUnique({ where: { id: parsed.data.stageId } });
  if (!stage || stage.board !== "COMMERCIAL") {
    return { success: false, error: "Etapa inválida." };
  }

  const opportunity = await prisma.opportunity.create({
    data: toOpportunityData(parsed.data),
  });

  await logActivity({
    userId: session.user.id,
    action: "opportunity.created",
    entityType: "Opportunity",
    entityId: opportunity.id,
  });

  await recomputeOpportunityTemperature(opportunity.id);
  revalidateOpportunityPaths(opportunity.id);
  return { success: true, data: { id: opportunity.id } };
}

export async function updateOpportunity(
  id: string,
  input: OpportunityFormInput
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para editar oportunidades." };
  }

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return { success: false, error: "Oportunidade não encontrada." };
  }

  if (!canEditOpportunity(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar esta oportunidade." };
  }

  const parsed = opportunityFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.stageId !== existing.stageId) {
    return {
      success: false,
      error: "Use a ação de mudar etapa (Kanban) para alterar a etapa da oportunidade.",
    };
  }

  const data = toOpportunityData(parsed.data);
  await prisma.opportunity.update({ where: { id }, data });

  if (existing.estimatedValueCents !== data.estimatedValueCents) {
    await logActivity({
      userId: session.user.id,
      action: "opportunity.value_change",
      entityType: "Opportunity",
      entityId: id,
      metadata: { from: existing.estimatedValueCents, to: data.estimatedValueCents },
    });
  }

  if (existing.priority !== data.priority) {
    await logActivity({
      userId: session.user.id,
      action: "opportunity.priority_change",
      entityType: "Opportunity",
      entityId: id,
      metadata: { from: existing.priority, to: data.priority },
    });
  }

  if (existing.ownerId !== data.ownerId) {
    const [fromUser, toUser] = await Promise.all([
      existing.ownerId
        ? prisma.user.findUnique({ where: { id: existing.ownerId }, select: { name: true } })
        : null,
      data.ownerId
        ? prisma.user.findUnique({ where: { id: data.ownerId }, select: { name: true } })
        : null,
    ]);
    await logActivity({
      userId: session.user.id,
      action: "opportunity.responsible_change",
      entityType: "Opportunity",
      entityId: id,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }

  const otherFields = (
    [
      "title",
      "contactId",
      "companyId",
      "origin",
      "recurringValueCents",
      "expectedCloseAt",
      "lastInteractionAt",
      "description",
      "notes",
    ] as const
  ).filter((field) => {
    const before = existing[field];
    const after = data[field];
    const beforeTime = before instanceof Date ? before.getTime() : before;
    const afterTime = after instanceof Date ? after.getTime() : after;
    return beforeTime !== afterTime;
  });

  if (otherFields.length > 0) {
    await logActivity({
      userId: session.user.id,
      action: "opportunity.updated",
      entityType: "Opportunity",
      entityId: id,
      metadata: { fields: otherFields },
    });
  }

  await recomputeOpportunityTemperature(id);
  revalidateOpportunityPaths(id);
  return { success: true, data: undefined };
}

// Ação dedicada para o drag & drop do Kanban (seção 12) — separada de
// updateOpportunity porque tem regras próprias (enteredStageAt, bloqueio de
// ir direto para "Venda Perdida" sem motivo, ganho automático ao cair em
// "Venda Ganha").
// `kanbanOrder` é opcional: o menu "Mover para etapa" não informa (cai no
// topo da própria faixa de prioridade, calculado aqui); o drag-and-drop
// sempre informa a posição exata escolhida (calculada no cliente, que já
// tem os vizinhos em mão).
export async function changeOpportunityStage(
  id: string,
  targetStageId: string,
  kanbanOrder?: number
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para mover oportunidades." };
  }

  const existing = await prisma.opportunity.findUnique({
    where: { id },
    include: { stage: true },
  });
  if (!existing || existing.deletedAt) {
    return { success: false, error: "Oportunidade não encontrada." };
  }

  // kanban.edit é um override explícito por cima da regra de posse — mesma
  // lógica de src/features/kanban/kanban-card.tsx, repetida aqui porque o
  // servidor nunca confia só na checagem do cliente.
  const overrides = await getResolvedPermissionOverrides(session.user.id);
  const capabilityOverride = overrides.capabilities[CAPABILITIES.kanbanEdit];
  const canEdit = capabilityOverride ?? canEditOpportunity(session.user.role, session.user.id, existing);
  if (!canEdit) {
    return { success: false, error: "Você não tem permissão para mover esta oportunidade." };
  }

  // Mesma etapa = só reordenar dentro da coluna — não passa por nenhuma das
  // validações/automações de transição de etapa abaixo.
  if (targetStageId === existing.stageId) {
    if (kanbanOrder === undefined) return { success: true, data: undefined };
    await prisma.opportunity.update({ where: { id }, data: { kanbanOrder } });
    revalidateOpportunityPaths(id);
    return { success: true, data: undefined };
  }

  const targetStage = await prisma.kanbanStage.findUnique({ where: { id: targetStageId } });
  if (!targetStage || targetStage.board !== "COMMERCIAL") {
    return { success: false, error: "Etapa inválida." };
  }

  // Validado no servidor, não só bloqueado na interface (seção 14/21): mover
  // para "Venda Perdida" sem motivo não é permitido por esta ação.
  if (targetStage.key === LOST_STAGE_KEY) {
    return {
      success: false,
      error: "Informe o motivo da perda para mover para esta etapa.",
    };
  }

  const isWinning = targetStage.key === WON_STAGE_KEY;

  // Sem posição explícita (menu "Mover para etapa", não drag): entra no
  // topo da própria faixa de prioridade na coluna de destino.
  const resolvedOrder =
    kanbanOrder ??
    (await (async () => {
      const topOfTier = await prisma.opportunity.findFirst({
        where: { stageId: targetStageId, priority: existing.priority, deletedAt: null },
        orderBy: { kanbanOrder: "asc" },
        select: { kanbanOrder: true },
      });
      return topOfTier ? topOfTier.kanbanOrder - 1 : 0;
    })());

  try {
    await prisma.$transaction(async (tx) => {
      if (isWinning) {
        await winOpportunityTx(tx, existing, existing.stage, targetStage, session.user.id, resolvedOrder);
        return;
      }

      const wasClosed = existing.status !== "OPEN";
      await tx.opportunity.update({
        where: { id },
        data: {
          stageId: targetStageId,
          kanbanOrder: resolvedOrder,
          stageEnteredAt: new Date(),
          ...(wasClosed
            ? { status: "OPEN", wonAt: null, lostReason: null, lostNote: null, lostAt: null }
            : {}),
        },
      });

      await logActivity(
        {
          userId: session.user.id,
          action: "opportunity.stage_change",
          entityType: "Opportunity",
          entityId: id,
          metadata: {
            fromStageId: existing.stageId,
            fromStageName: existing.stage.name,
            toStageId: targetStage.id,
            toStageName: targetStage.name,
          },
        },
        tx
      );
    });
  } catch (error) {
    if (error instanceof AutomationError) return { success: false, error: error.message };
    console.error(error);
    return { success: false, error: "Não foi possível mover a oportunidade. Tente novamente." };
  }

  await recomputeOpportunityTemperature(id);
  revalidateOpportunityPaths(id);
  if (isWinning) revalidateWinPaths();
  return { success: true, data: undefined };
}

export async function markOpportunityWon(id: string): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const existing = await prisma.opportunity.findUnique({ where: { id }, include: { stage: true } });
  if (!existing || existing.deletedAt) return { success: false, error: "Oportunidade não encontrada." };
  if (!canEditOpportunity(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para esta oportunidade." };
  }

  const wonStage = await prisma.kanbanStage.findFirst({
    where: { board: "COMMERCIAL", key: WON_STAGE_KEY },
  });
  if (!wonStage) return { success: false, error: "Etapa 'Venda Ganha' não está configurada." };

  try {
    // Transação real (seção 30): opportunity → customer → sale →
    // installation → checklist, tudo ou nada.
    await prisma.$transaction(async (tx) => {
      await winOpportunityTx(tx, existing, existing.stage, wonStage, session.user.id);
    });
  } catch (error) {
    if (error instanceof AutomationError) return { success: false, error: error.message };
    console.error(error);
    return { success: false, error: "Não foi possível concluir a venda. Tente novamente." };
  }

  await recomputeOpportunityTemperature(id);
  revalidateOpportunityPaths(id);
  revalidateWinPaths();
  return { success: true, data: undefined };
}

export async function markOpportunityLost(
  id: string,
  input: LostReasonInput
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = lostReasonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Informe o motivo." };
  }

  const existing = await prisma.opportunity.findUnique({ where: { id }, include: { stage: true } });
  if (!existing || existing.deletedAt) return { success: false, error: "Oportunidade não encontrada." };
  if (!canEditOpportunity(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para esta oportunidade." };
  }

  const lostStage = await prisma.kanbanStage.findFirst({
    where: { board: "COMMERCIAL", key: LOST_STAGE_KEY },
  });
  if (!lostStage) return { success: false, error: "Etapa 'Venda Perdida' não está configurada." };

  // Esse fluxo sempre passa pelo diálogo de motivo (arrastar pra cá também
  // abre o diálogo em vez de soltar direto), então a posição exata do drag
  // já se perdeu — entra no topo da própria faixa de prioridade, mesmo
  // padrão do menu "Mover para etapa" em changeOpportunityStage.
  const topOfTier = await prisma.opportunity.findFirst({
    where: { stageId: lostStage.id, priority: existing.priority, deletedAt: null },
    orderBy: { kanbanOrder: "asc" },
    select: { kanbanOrder: true },
  });
  const resolvedOrder = topOfTier ? topOfTier.kanbanOrder - 1 : 0;

  await prisma.opportunity.update({
    where: { id },
    data: {
      status: "LOST",
      lostReason: parsed.data.reason,
      lostNote: parsed.data.note ?? null,
      lostAt: new Date(),
      stageId: lostStage.id,
      kanbanOrder: resolvedOrder,
      stageEnteredAt: new Date(),
    },
  });

  if (existing.stageId !== lostStage.id) {
    await logActivity({
      userId: session.user.id,
      action: "opportunity.stage_change",
      entityType: "Opportunity",
      entityId: id,
      metadata: {
        fromStageId: existing.stageId,
        fromStageName: existing.stage.name,
        toStageId: lostStage.id,
        toStageName: lostStage.name,
      },
    });
  }

  await logActivity({
    userId: session.user.id,
    action: "opportunity.lost",
    entityType: "Opportunity",
    entityId: id,
    metadata: { reason: parsed.data.reason, note: parsed.data.note ?? null },
  });

  await recomputeOpportunityTemperature(id);
  revalidateOpportunityPaths(id);
  return { success: true, data: undefined };
}
