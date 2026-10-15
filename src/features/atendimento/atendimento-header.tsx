import { MessageSquareText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { AtendimentoViewTabs } from "@/features/atendimento/atendimento-view-tabs";
import { NewConversationDialog } from "@/features/atendimento/new-conversation-dialog";

// Cabeçalho da Central (lista e conversa aberta): ícone, título e o botão
// "Nova conversa" no canto superior direito.
export function AtendimentoHeader() {
  return (
    <PageHeader
      title={
        <>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageSquareText className="size-5" />
          </span>
          Atendimento
        </>
      }
      tabs={<AtendimentoViewTabs />}
      description="Central de atendimento e conversas"
      action={<NewConversationDialog />}
    />
  );
}
