"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditCustomer } from "@/features/customers/permissions";
import { cultureAlertSchema, cultureContentSchema, hasCultureContent } from "@/features/customers/culture/schema";

type ActionResult = { success: true } | { success: false; error: string };

async function loadEditable(customerId: string) {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "clientes")) return null;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, responsibleId: true },
  });
  if (!customer || !canEditCustomer(session.user.role, session.user.id, customer)) return null;
  return { session, customer };
}

function revalidate(customerId: string) {
  revalidatePath(`/clientes/${customerId}`);
  // O Atendimento mostra a Cultura/Modelo do cliente da conversa.
  revalidatePath("/atendimento", "layout");
}

export async function saveCustomerCulture(customerId: string, content: string): Promise<ActionResult> {
  const ctx = await loadEditable(customerId);
  if (!ctx) return { success: false, error: "Você não tem permissão para editar este cliente." };

  const parsed = cultureContentSchema.safeParse(content);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Conteúdo inválido." };

  // Só é mostrado pelo próprio editor (modo leitura), que descarta qualquer
  // tag/atributo fora do que ele conhece — nunca vai pra innerHTML.
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      cultureContent: hasCultureContent(parsed.data) ? parsed.data : null,
      cultureUpdatedAt: new Date(),
      cultureUpdatedById: ctx.session.user.id,
    },
  });
  await logActivity({
    userId: ctx.session.user.id,
    action: "customer.culture_updated",
    entityType: "Customer",
    entityId: customerId,
  });
  revalidate(customerId);
  return { success: true };
}

export async function saveCustomerCultureAlert(customerId: string, alert: string): Promise<ActionResult> {
  const ctx = await loadEditable(customerId);
  if (!ctx) return { success: false, error: "Você não tem permissão para editar este cliente." };

  const parsed = cultureAlertSchema.safeParse(alert);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Aviso inválido." };

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      cultureAlert: parsed.data || null,
      cultureUpdatedAt: new Date(),
      cultureUpdatedById: ctx.session.user.id,
    },
  });
  await logActivity({
    userId: ctx.session.user.id,
    action: parsed.data ? "customer.culture_alert_updated" : "customer.culture_alert_removed",
    entityType: "Customer",
    entityId: customerId,
    metadata: parsed.data ? { alert: parsed.data } : undefined,
  });
  revalidate(customerId);
  return { success: true };
}
