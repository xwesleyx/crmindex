import type { Prisma, UserRole } from "@prisma/client";

import { CAPABILITIES, hasCapability } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

// Quem está olhando a Central. `viewAll` vem da permissão "Ver atendimento
// de todos" (atendimento.view_all — por padrão Admin e Gerente, ajustável
// por usuário em Configurações > Permissões). Sem ela, a pessoa só enxerga o
// que atende (responsável ou participante) e o que ainda não tem ninguém.
// `canCreateOpportunity`: permissão "Criar oportunidade pelo Atendimento"
// (atendimento.create_opportunity — padrão Vendedor e Administrador).
export type AtendimentoViewer = { id: string; role: UserRole; viewAll: boolean; canCreateOpportunity: boolean };

export async function getAtendimentoViewer(user: { id: string; role: UserRole }): Promise<AtendimentoViewer> {
  const overrides = await getResolvedPermissionOverrides(user.id);
  return {
    id: user.id,
    role: user.role,
    viewAll: hasCapability(user.role, CAPABILITIES.atendimentoViewAll, overrides),
    canCreateOpportunity: hasCapability(user.role, CAPABILITIES.atendimentoCreateOpportunity, overrides),
  };
}

export function conversationWhereForViewer(viewer: AtendimentoViewer): Prisma.ConversationWhereInput {
  if (viewer.viewAll) return {};
  return {
    OR: [{ assigneeId: viewer.id }, { assigneeId: null }, { participants: { some: { userId: viewer.id } } }],
  };
}

// Inclua isto ao carregar uma conversa que vai passar por
// canEditConversation — participantes ("Participar") agem como o responsável.
export const CONVERSATION_PARTICIPANT_IDS = {
  participants: { select: { userId: true } },
} as const satisfies Prisma.ConversationInclude;

// "Estou atendendo esta conversa": responsável ou participante.
export function whereAttendedBy(userId: string): Prisma.ConversationWhereInput {
  return { OR: [{ assigneeId: userId }, { participants: { some: { userId } } }] };
}

export function isAttendingConversation(
  userId: string,
  conversation: { assigneeId: string | null; participants: { userId: string }[] }
): boolean {
  return conversation.assigneeId === userId || conversation.participants.some((p) => p.userId === userId);
}

export function canEditConversation(
  viewer: AtendimentoViewer,
  conversation: { assigneeId: string | null; participants: { userId: string }[] }
): boolean {
  if (viewer.viewAll) return true;
  return conversation.assigneeId === null || isAttendingConversation(viewer.id, conversation);
}
