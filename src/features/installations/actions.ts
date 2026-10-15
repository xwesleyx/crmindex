"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  INSTALLATION_CANCELED_STAGE_KEY,
  INSTALLATION_COMPLETED_STAGE_KEY,
} from "@/features/kanban/constants";
import { canEditInstallation } from "@/features/installations/permissions";
import {
  installationFormSchema,
  type InstallationFormInput,
} from "@/features/installations/schema";

type ActionResult = { success: true } | { success: false; error: string };

async function requireInstallationsSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "instalacoes")) return null;
  return session;
}

function revalidateInstallationPaths(id?: string) {
  revalidatePath("/instalacoes");
  revalidatePath("/instalacoes/kanban");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/instalacoes/${id}`);
}

export async function updateInstallation(
  id: string,
  input: InstallationFormInput
): Promise<ActionResult> {
  const session = await requireInstallationsSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar instalações." };

  const existing = await prisma.installation.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Instalação não encontrada." };

  if (!canEditInstallation(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar esta instalação." };
  }

  const parsed = installationFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = {
    responsibleId: parsed.data.responsibleId ?? null,
    priority: parsed.data.priority,
    scheduledAt: parsed.data.scheduledAt ?? null,
    dueAt: parsed.data.dueAt ?? null,
    notes: parsed.data.notes ?? null,
  };

  await prisma.installation.update({ where: { id }, data });

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
      action: "installation.responsible_change",
      entityType: "Installation",
      entityId: id,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }

  const otherFields = (["priority", "scheduledAt", "dueAt", "notes"] as const).filter((field) => {
    const before = existing[field];
    const after = data[field];
    const beforeTime = before instanceof Date ? before.getTime() : before;
    const afterTime = after instanceof Date ? after.getTime() : after;
    return beforeTime !== afterTime;
  });

  if (otherFields.length > 0) {
    await logActivity({
      userId: session.user.id,
      action: "installation.updated",
      entityType: "Installation",
      entityId: id,
      metadata: { fields: otherFields },
    });
  }

  revalidateInstallationPaths(id);
  return { success: true };
}

// Ação dedicada para o Kanban (seção 20/24) — bloqueia conclusão com item
// obrigatório pendente, validado no servidor, e ativa o cliente quando a
// instalação é concluída (seção 25). `kanbanOrder` é opcional: o menu
// "Mover para etapa" não informa (cai no topo da própria faixa de
// prioridade, calculado aqui); o drag-and-drop sempre informa a posição
// exata escolhida (calculada no cliente, que já tem os vizinhos em mão).
export async function changeInstallationStage(
  id: string,
  targetStageId: string,
  kanbanOrder?: number
): Promise<ActionResult> {
  const session = await requireInstallationsSession();
  if (!session) return { success: false, error: "Você não tem permissão para mover instalações." };

  const existing = await prisma.installation.findUnique({
    where: { id },
    include: { stage: true, checklistItems: true },
  });
  if (!existing) return { success: false, error: "Instalação não encontrada." };

  if (!canEditInstallation(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para mover esta instalação." };
  }

  // Mesma etapa = só reordenar dentro da coluna (arrastar sem trocar de
  // etapa) — não passa por nenhuma das validações/automações de transição
  // de etapa abaixo, que só fazem sentido numa mudança de etapa de verdade.
  if (targetStageId === existing.stageId) {
    if (kanbanOrder === undefined) return { success: true };
    await prisma.installation.update({ where: { id }, data: { kanbanOrder } });
    revalidateInstallationPaths(id);
    return { success: true };
  }

  const targetStage = await prisma.kanbanStage.findUnique({ where: { id: targetStageId } });
  if (!targetStage || targetStage.board !== "INSTALLATION") {
    return { success: false, error: "Etapa inválida." };
  }

  const isCompleting = targetStage.key === INSTALLATION_COMPLETED_STAGE_KEY;
  const isCanceling = targetStage.key === INSTALLATION_CANCELED_STAGE_KEY;

  if (isCompleting) {
    const pending = existing.checklistItems.filter((item) => item.required && !item.completed);
    if (pending.length > 0) {
      return {
        success: false,
        error: `Existem itens obrigatórios pendentes no checklist: ${pending.map((i) => i.label).join(", ")}.`,
      };
    }
  }

  // Sem posição explícita (menu "Mover para etapa", não drag): entra no
  // topo da própria faixa de prioridade na coluna de destino — mesmo
  // comportamento de sempre, só que agora com um valor de kanbanOrder real
  // em vez de depender de updatedAt.
  const resolvedOrder =
    kanbanOrder ??
    (await (async () => {
      const topOfTier = await prisma.installation.findFirst({
        where: { stageId: targetStageId, priority: existing.priority },
        orderBy: { kanbanOrder: "asc" },
        select: { kanbanOrder: true },
      });
      return topOfTier ? topOfTier.kanbanOrder - 1 : 0;
    })());

  try {
    await prisma.$transaction(async (tx) => {
      await tx.installation.update({
        where: { id },
        data: {
          stageId: targetStageId,
          kanbanOrder: resolvedOrder,
          stageEnteredAt: new Date(),
          status: isCompleting ? "CONCLUIDA" : isCanceling ? "CANCELADA" : "EM_ANDAMENTO",
          completedAt: isCompleting ? new Date() : existing.completedAt,
          // Primeira movimentação depois da criação = "instalação iniciada"
          // (campo existia no schema, mas nada o preenchia até agora).
          startedAt: existing.startedAt ?? new Date(),
        },
      });

      await logActivity(
        {
          userId: session.user.id,
          action: "installation.stage_change",
          entityType: "Installation",
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

      if (isCompleting) {
        await logActivity(
          { userId: session.user.id, action: "installation.completed", entityType: "Installation", entityId: id },
          tx
        );

        const customer = await tx.customer.findUnique({ where: { id: existing.customerId } });
        if (customer && customer.status !== "ATIVO") {
          await tx.customer.update({ where: { id: customer.id }, data: { status: "ATIVO" } });
          await logActivity(
            {
              userId: session.user.id,
              action: "customer.activated",
              entityType: "Customer",
              entityId: customer.id,
              metadata: { fromInstallationId: id },
            },
            tx
          );
        }
      }
    });
  } catch (error) {
    console.error(error);
    return { success: false, error: "Não foi possível mover a instalação. Tente novamente." };
  }

  revalidateInstallationPaths(id);
  revalidatePath("/clientes");
  return { success: true };
}

export async function toggleChecklistItem(itemId: string): Promise<ActionResult> {
  const session = await requireInstallationsSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const item = await prisma.installationChecklistItem.findUnique({
    where: { id: itemId },
    include: { installation: true },
  });
  if (!item) return { success: false, error: "Item não encontrado." };

  if (!canEditInstallation(session.user.role, session.user.id, item.installation)) {
    return { success: false, error: "Você não tem permissão para esta instalação." };
  }

  const completing = !item.completed;

  await prisma.installationChecklistItem.update({
    where: { id: itemId },
    data: {
      completed: completing,
      completedAt: completing ? new Date() : null,
      completedById: completing ? session.user.id : null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: completing ? "installation.checklist_item_completed" : "installation.checklist_item_reopened",
    entityType: "Installation",
    entityId: item.installationId,
    metadata: { itemId, label: item.label },
  });

  if (completing) {
    const remaining = await prisma.installationChecklistItem.count({
      where: { installationId: item.installationId, completed: false },
    });
    if (remaining === 0) {
      await logActivity({
        userId: session.user.id,
        action: "installation.checklist_finished",
        entityType: "Installation",
        entityId: item.installationId,
      });
    }
  }

  revalidateInstallationPaths(item.installationId);
  return { success: true };
}

// Checklist não pode ficar travado no template inicial (seção 7 do escopo:
// "não faça implementação que impeça adicionar itens posteriormente") — item
// novo entra opcional (required: false) e vai pro fim da lista.
export async function addChecklistItem(
  installationId: string,
  label: string
): Promise<ActionResult> {
  const session = await requireInstallationsSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const trimmed = label.trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Informe uma descrição para o item." };
  }

  const installation = await prisma.installation.findUnique({ where: { id: installationId } });
  if (!installation) return { success: false, error: "Instalação não encontrada." };

  if (!canEditInstallation(session.user.role, session.user.id, installation)) {
    return { success: false, error: "Você não tem permissão para esta instalação." };
  }

  const last = await prisma.installationChecklistItem.findFirst({
    where: { installationId },
    orderBy: { order: "desc" },
  });

  const item = await prisma.installationChecklistItem.create({
    data: {
      installationId,
      label: trimmed,
      order: (last?.order ?? 0) + 1,
      required: false,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "installation.checklist_item_added",
    entityType: "Installation",
    entityId: installationId,
    metadata: { itemId: item.id, label: item.label },
  });

  revalidateInstallationPaths(installationId);
  return { success: true };
}
