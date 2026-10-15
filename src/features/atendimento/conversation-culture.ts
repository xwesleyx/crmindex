import type { CustomerCulture } from "@/features/customers/culture/queries";
import { hasCultureContent } from "@/features/customers/culture/schema";
import type { ConversationDetail } from "@/features/atendimento/types";

type CultureSource = {
  id: string;
  cultureContent: string | null;
  cultureAlert: string | null;
  cultureUpdatedAt: Date | null;
  cultureUpdatedBy: { name: string } | null;
};

// Cliente cuja Cultura/Modelo vale para a conversa: o vinculado à conversa;
// senão o da empresa do contato; senão o próprio contato como cliente.
export function getConversationCulture(conversation: ConversationDetail): CustomerCulture | null {
  const source: CultureSource | null =
    conversation.customer ?? conversation.contact.company?.customer ?? conversation.contact.customer ?? null;
  if (!source) return null;
  return {
    customerId: source.id,
    content: hasCultureContent(source.cultureContent) ? source.cultureContent : null,
    alert: source.cultureAlert,
    updatedAt: source.cultureUpdatedAt,
    updatedByName: source.cultureUpdatedBy?.name ?? null,
  };
}
