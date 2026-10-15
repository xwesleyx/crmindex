"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditSale } from "@/features/sales/permissions";
import { updateSaleSchema, type UpdateSaleInput } from "@/features/sales/schema";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireCrmSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "crm")) return null;
  return session;
}

// Só ajusta os campos comerciais complementares (desconto, forma de
// pagamento, valor recorrente, observações) — o valor principal
// (amountCents), status e vínculos (cliente/oportunidade) continuam
// intocáveis aqui, só a automação de Venda Ganha os define (seção 16).
export async function updateSale(id: string, input: UpdateSaleInput): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para editar vendas." };
  }

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Venda não encontrada." };
  }

  if (!canEditSale(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para editar esta venda." };
  }

  const parsed = updateSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = {
    discountCents: parsed.data.discountCents ?? existing.discountCents,
    recurringAmountCents: parsed.data.recurringAmountCents ?? existing.recurringAmountCents,
    paymentMethod: parsed.data.paymentMethod ?? existing.paymentMethod,
    notes: parsed.data.notes ?? null,
  };

  await prisma.sale.update({ where: { id }, data });

  const fieldsChanged = (
    ["discountCents", "recurringAmountCents", "paymentMethod", "notes"] as const
  ).filter((field) => existing[field] !== data[field]);

  if (fieldsChanged.length > 0) {
    await logActivity({
      userId: session.user.id,
      action: "sale.updated",
      entityType: "Sale",
      entityId: id,
      metadata: { fields: fieldsChanged },
    });
  }

  revalidatePath("/vendas");
  revalidatePath(`/vendas/${id}`);
  return { success: true, data: undefined };
}
