"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { canEditContact } from "@/features/contacts/permissions";
import { canEditConversation, getAtendimentoViewer } from "@/features/atendimento/permissions";
import { findContactDuplicate } from "@/features/contacts/queries";
import { contactFormSchema, type ContactFormInput } from "@/features/contacts/schema";
import type { ContactListItem } from "@/features/contacts/types";

type CreateContactResult =
  | { status: "success"; id: string }
  | { status: "error"; error: string }
  | { status: "duplicate"; contact: ContactListItem };

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

// identified:true sempre no update — editar um contato pelo formulário É a
// confirmação humana da identidade (seção 6 do adendo de Atendimento: um
// "contato-sombra" criado por um WhatsApp desconhecido vira identificado
// assim que alguém revisa e salva os dados reais).
function toContactData(input: ContactFormInput) {
  return {
    name: input.name,
    phone: input.phone ? onlyDigits(input.phone) : null,
    whatsapp: input.whatsapp ? onlyDigits(input.whatsapp) : null,
    email: input.email ?? null,
    role: input.role ?? null,
    department: input.department ?? null,
    linkType: input.linkType ?? null,
    isPrimaryContact: input.isPrimaryContact,
    identified: true,
    notes: input.notes ?? null,
    isActive: input.isActive,
    origin: input.origin ?? null,
    companyId: input.companyId ?? null,
    responsibleId: input.responsibleId ?? null,
    lastInteractionAt: input.lastInteractionAt ?? null,
  };
}

// "Só um contato principal por empresa" (seção 3 do adendo de Atendimento) —
// regra de aplicação, não constraint de banco: ao marcar um como principal,
// desmarca os outros da mesma empresa na mesma transação.
async function enforceSinglePrimaryContact(contactId: string, companyId: string | null) {
  if (!companyId) return;
  await prisma.contact.updateMany({
    where: { companyId, id: { not: contactId }, isPrimaryContact: true },
    data: { isPrimaryContact: false },
  });
}

export async function createContact(
  input: ContactFormInput,
  options?: { skipDuplicateCheck?: boolean }
): Promise<CreateContactResult> {
  const session = await requireCrmSession();
  if (!session) return { status: "error", error: "Você não tem permissão para criar contatos." };

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = toContactData(parsed.data);

  if (!options?.skipDuplicateCheck) {
    const duplicate = await findContactDuplicate({
      phone: data.phone ?? undefined,
      whatsapp: data.whatsapp ?? undefined,
      email: data.email ?? undefined,
    });
    if (duplicate) return { status: "duplicate", contact: duplicate };
  }

  const contact = await prisma.contact.create({ data });

  if (data.isPrimaryContact) {
    await enforceSinglePrimaryContact(contact.id, data.companyId);
  }

  await logActivity({
    userId: session.user.id,
    action: "contact.created",
    entityType: "Contact",
    entityId: contact.id,
  });

  revalidatePath("/clientes/contatos");
  return { status: "success", id: contact.id };
}

export async function updateContact(
  id: string,
  input: ContactFormInput,
  options?: { skipDuplicateCheck?: boolean }
): Promise<CreateContactResult> {
  const session = await requireCrmSession();
  if (!session) return { status: "error", error: "Você não tem permissão para editar contatos." };

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { status: "error", error: "Contato não encontrado." };

  if (!canEditContact(session.user.role, session.user.id, existing)) {
    return { status: "error", error: "Você não tem permissão para editar este contato." };
  }

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = toContactData(parsed.data);

  const phoneChanged = data.phone !== existing.phone;
  const whatsappChanged = data.whatsapp !== existing.whatsapp;
  const emailChanged = data.email !== existing.email;

  if (!options?.skipDuplicateCheck && (phoneChanged || whatsappChanged || emailChanged)) {
    const duplicate = await findContactDuplicate({
      phone: phoneChanged ? (data.phone ?? undefined) : undefined,
      whatsapp: whatsappChanged ? (data.whatsapp ?? undefined) : undefined,
      email: emailChanged ? (data.email ?? undefined) : undefined,
      excludeId: id,
    });
    if (duplicate) return { status: "duplicate", contact: duplicate };
  }

  await prisma.contact.update({ where: { id }, data });

  if (data.isPrimaryContact) {
    await enforceSinglePrimaryContact(id, data.companyId);
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
      action: "contact.responsible_change",
      entityType: "Contact",
      entityId: id,
      metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
    });
  }

  const otherFields = (
    [
      "name",
      "phone",
      "whatsapp",
      "email",
      "role",
      "department",
      "linkType",
      "isPrimaryContact",
      "notes",
      "isActive",
      "origin",
      "companyId",
      "lastInteractionAt",
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
      action: "contact.updated",
      entityType: "Contact",
      entityId: id,
      metadata: { fields: otherFields },
    });
  }

  revalidatePath("/clientes/contatos");
  revalidatePath(`/clientes/contatos/${id}`);
  return { status: "success", id };
}

export async function toggleContactArchived(id: string): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!session) return { success: false, error: "Você não tem permissão para arquivar contatos." };

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Contato não encontrado." };

  if (!canEditContact(session.user.role, session.user.id, existing)) {
    return { success: false, error: "Você não tem permissão para arquivar este contato." };
  }

  const isArchiving = !existing.deletedAt;

  await prisma.contact.update({
    where: { id },
    data: { deletedAt: isArchiving ? new Date() : null },
  });

  await logActivity({
    userId: session.user.id,
    action: isArchiving ? "contact.archived" : "contact.restored",
    entityType: "Contact",
    entityId: id,
  });

  revalidatePath("/clientes/contatos");
  revalidatePath(`/clientes/contatos/${id}`);
  return { success: true };
}

// Renomear o contato (Atendimento e tela do contato). Pode quem edita o
// contato pelo módulo Clientes OU quem pode mexer em alguma conversa dele no
// Atendimento — o atendente precisa conseguir corrigir o nome de quem está
// falando sem ter acesso ao cadastro de Clientes.
async function requireRenamePermission(contactId: string) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Você não tem permissão para renomear este contato." } as const;

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.deletedAt) return { ok: false, error: "Contato não encontrado." } as const;

  const { role, id: userId } = session.user;
  if (canAccessModule(role, "clientes") && canEditContact(role, userId, contact)) return { ok: true, session, contact } as const;

  if (canAccessModule(role, "atendimento")) {
    const conversations = await prisma.conversation.findMany({
      where: { contactId },
      select: { assigneeId: true, participants: { select: { userId: true } } },
    });
    const viewer = await getAtendimentoViewer({ id: userId, role });
    if (conversations.some((conversation) => canEditConversation(viewer, conversation))) {
      return { ok: true, session, contact } as const;
    }
  }

  return { ok: false, error: "Você não tem permissão para renomear este contato." } as const;
}

async function applyContactName(
  contactId: string,
  name: string,
  userId: string | undefined,
  previousName: string,
  revert: boolean
) {
  await prisma.contact.update({ where: { id: contactId }, data: { name } });
  await logActivity({
    userId,
    action: revert ? "contact.name_reverted" : "contact.renamed",
    entityType: "Contact",
    entityId: contactId,
    metadata: { from: previousName, to: name },
  });
  revalidatePath("/clientes/contatos");
  revalidatePath(`/clientes/contatos/${contactId}`);
  revalidatePath("/atendimento", "layout");
}

export async function renameContact(contactId: string, rawName: string): Promise<ActionResult> {
  const name = rawName.trim();
  if (name.length < 2) return { success: false, error: "Informe um nome com pelo menos 2 letras." };
  if (name.length > 120) return { success: false, error: "Nome muito longo (máximo 120 caracteres)." };

  const permission = await requireRenamePermission(contactId);
  if (!permission.ok) return { success: false, error: permission.error };
  if (permission.contact.name === name) return { success: true };

  await applyContactName(contactId, name, permission.session.user.id, permission.contact.name, false);
  return { success: true };
}

export async function resetContactNameToWhatsapp(contactId: string): Promise<ActionResult> {
  const permission = await requireRenamePermission(contactId);
  if (!permission.ok) return { success: false, error: permission.error };

  const { whatsappName, name } = permission.contact;
  if (!whatsappName) {
    return { success: false, error: "Ainda não recebemos o nome do WhatsApp deste contato." };
  }
  if (name === whatsappName) return { success: true };

  await applyContactName(contactId, whatsappName, permission.session.user.id, name, true);
  return { success: true };
}
