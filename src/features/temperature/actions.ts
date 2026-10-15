"use server";

import type { Temperature } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditLead } from "@/features/leads/permissions";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import { recomputeLeadTemperature } from "@/features/temperature/lead";
import { recomputeOpportunityTemperature } from "@/features/temperature/opportunity";
import { SIGNAL_FIELD, type SignalType } from "@/features/temperature/schema";

type ActionResult = { success: true } | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "crm")) return null;
  return session;
}

export async function toggleOpportunitySignal(id: string, signal: SignalType): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "Oportunidade não encontrada." };
  if (!canEditOpportunity(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar esta oportunidade." };
  }

  const field = SIGNAL_FIELD[signal];
  const isActive = !!(existing as unknown as Record<string, Date | null>)[field];

  await prisma.opportunity.update({
    where: { id },
    data: { [field]: isActive ? null : new Date() },
  });
  await recomputeOpportunityTemperature(id);

  await logActivity({
    userId: session.user.id,
    action: isActive ? "opportunity.signal_removed" : "opportunity.signal_added",
    entityType: "Opportunity",
    entityId: id,
    metadata: { signal },
  });

  revalidatePath(`/crm/oportunidades/${id}`);
  revalidatePath("/crm/kanban");
  return { success: true };
}

export async function setOpportunityTemperatureOverride(
  id: string,
  temperature: Temperature | null
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "Oportunidade não encontrada." };
  if (!canEditOpportunity(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar esta oportunidade." };
  }

  await prisma.opportunity.update({
    where: { id },
    data: temperature
      ? { temperatureOverride: true, temperature }
      : { temperatureOverride: false },
  });
  await recomputeOpportunityTemperature(id);

  await logActivity({
    userId: session.user.id,
    action: temperature ? "opportunity.temperature_override" : "opportunity.temperature_unlock",
    entityType: "Opportunity",
    entityId: id,
    metadata: { temperature },
  });

  revalidatePath(`/crm/oportunidades/${id}`);
  revalidatePath("/crm/kanban");
  return { success: true };
}

export async function toggleLeadSignal(id: string, signal: SignalType): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "Lead não encontrado." };
  if (!canEditLead(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar este lead." };
  }

  const field = SIGNAL_FIELD[signal];
  const isActive = !!(existing as unknown as Record<string, Date | null>)[field];

  await prisma.lead.update({
    where: { id },
    data: { [field]: isActive ? null : new Date() },
  });
  await recomputeLeadTemperature(id);

  await logActivity({
    userId: session.user.id,
    action: isActive ? "lead.signal_removed" : "lead.signal_added",
    entityType: "Lead",
    entityId: id,
    metadata: { signal },
  });

  revalidatePath(`/crm/leads/${id}`);
  revalidatePath("/crm/leads");
  return { success: true };
}

export async function setLeadTemperatureOverride(
  id: string,
  temperature: Temperature | null
): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { success: false, error: "Lead não encontrado." };
  if (!canEditLead(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar este lead." };
  }

  await prisma.lead.update({
    where: { id },
    data: temperature
      ? { temperatureOverride: true, temperature }
      : { temperatureOverride: false },
  });
  await recomputeLeadTemperature(id);

  await logActivity({
    userId: session.user.id,
    action: temperature ? "lead.temperature_override" : "lead.temperature_unlock",
    entityType: "Lead",
    entityId: id,
    metadata: { temperature },
  });

  revalidatePath(`/crm/leads/${id}`);
  revalidatePath("/crm/leads");
  return { success: true };
}
