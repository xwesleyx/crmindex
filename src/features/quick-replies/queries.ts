import { prisma } from "@/lib/prisma";

// Lista completa pra tela de Configurações (CRUD) e pro autocomplete do
// composer do Atendimento — o volume de atalhos é sempre pequeno (uma
// dezena, talvez algumas dezenas), então não precisa de busca no banco por
// prefixo: a Central busca tudo uma vez e filtra em memória por tecla.
export async function listQuickReplies() {
  return prisma.quickReply.findMany({ orderBy: { shortcut: "asc" } });
}

export type QuickReplyListItem = Awaited<ReturnType<typeof listQuickReplies>>[number];
