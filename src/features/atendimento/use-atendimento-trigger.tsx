"use client";

import type { ConversationQueue } from "@prisma/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  resolveConversationForEntity,
  transferConversation,
  type AtendimentoEntityType,
} from "@/features/atendimento/actions";
import { ActiveConversationDialog } from "@/features/atendimento/active-conversation-dialog";
import {
  ContactDisambiguationDialog,
  type ContactCandidate,
} from "@/features/atendimento/contact-disambiguation-dialog";
import { StartConversationDialog, type ReadyToStart } from "@/features/atendimento/start-conversation-dialog";
import type { AssignableUser } from "@/features/leads/types";

// Hook único reaproveitado por todo lugar que precisa do botão 💬 (seção 17):
// cards do Kanban, linha do Lead, páginas de detalhe, contatos do Cliente.
// trigger() resolve o contato conforme a origem e decide sozinho qual dos
// três diálogos mostrar — quem usa o hook só precisa renderizar `dialogs`
// em algum lugar da árvore e chamar `trigger()` num onClick.
export function useAtendimentoTrigger({
  entityType,
  entityId,
  defaultQueue,
  assignableUsers,
}: {
  entityType: AtendimentoEntityType;
  entityId: string;
  defaultQueue?: ConversationQueue;
  assignableUsers: AssignableUser[];
}) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<{ conversationId: string } | null>(null);
  const [candidates, setCandidates] = useState<ContactCandidate[] | null>(null);
  const [ready, setReady] = useState<ReadyToStart | null>(null);

  function resolveAndAct(type: AtendimentoEntityType, id: string) {
    startTransition(async () => {
      const result = await resolveConversationForEntity(type, id);
      if (result.type === "error") {
        toast.error(result.message);
        return;
      }
      if (result.type === "active") {
        setActive({ conversationId: result.conversationId });
        return;
      }
      if (result.type === "candidates") {
        setCandidates(result.candidates);
        return;
      }
      setReady({ contact: result.contact, companyName: result.companyName });
    });
  }

  function trigger() {
    resolveAndAct(entityType, entityId);
  }

  function handleCandidateSelected(contactId: string) {
    setCandidates(null);
    // Reaproveita a mesma resolução, agora sem ambiguidade — o contactId já
    // foi escolhido pelo atendente, entityType/entityId originais continuam
    // sendo o que startConversationFromEntity usa pra derivar lead/oportunidade.
    resolveAndAct("CUSTOMER_CONTACT", contactId);
  }

  function handleTransferToMyQueue() {
    if (!active) return;
    startTransition(async () => {
      const result = await transferConversation(active.conversationId, { queue: defaultQueue });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento transferido.");
      setActive(null);
    });
  }

  function handleTransferToMe() {
    if (!active) return;
    startTransition(async () => {
      const result = await transferConversation(active.conversationId, { assigneeMode: "me" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento transferido para você.");
      setActive(null);
    });
  }

  const dialogs = (
    <>
      {active && (
        <ActiveConversationDialog
          open
          onOpenChange={(open) => !open && setActive(null)}
          conversationId={active.conversationId}
          onTransferToMyQueue={handleTransferToMyQueue}
          onTransferToMe={handleTransferToMe}
          showTransferToQueue={!!defaultQueue}
          pending={isPending}
        />
      )}
      {candidates && (
        <ContactDisambiguationDialog
          open
          onOpenChange={(open) => !open && setCandidates(null)}
          candidates={candidates}
          onSelect={handleCandidateSelected}
        />
      )}
      <StartConversationDialog
        open={!!ready}
        onOpenChange={(open) => !open && setReady(null)}
        entityType={entityType}
        entityId={entityId}
        data={ready}
        defaultQueue={defaultQueue}
        assignableUsers={assignableUsers}
      />
    </>
  );

  return { trigger, dialogs, pending: isPending };
}
