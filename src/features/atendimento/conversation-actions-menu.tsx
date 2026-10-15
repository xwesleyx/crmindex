"use client";

import { ConversationStatus, Priority } from "@prisma/client";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  assignConversation,
  changeConversationPriority,
  changeConversationStatus,
} from "@/features/atendimento/actions";
import { CONVERSATION_STATUS_LABELS } from "@/features/atendimento/labels";
import { PRIORITY_LABELS } from "@/lib/priority";
import type { AssignableUser } from "@/features/leads/types";
import type { ConversationDetail } from "@/features/atendimento/types";

// Menu de ações da conversa (seção 13): responsável, prioridade, status,
// encerrar — tudo reaproveitando as actions server-side já testadas.
export function ConversationActionsMenu({
  conversation,
  assignableUsers,
}: {
  conversation: ConversationDetail;
  assignableUsers: AssignableUser[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAssign(userId: string | null) {
    startTransition(async () => {
      const result = await assignConversation(conversation.id, userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Responsável atualizado.");
      router.refresh();
    });
  }

  function handleStatus(status: ConversationStatus) {
    startTransition(async () => {
      const result = await changeConversationStatus(conversation.id, status);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Status atualizado.");
      router.refresh();
    });
  }

  // "Encerrar sem Mensagem" (pedido do usuário) — mesmo encerramento do
  // botão normal, só sem disparar a mensagem automática de encerramento
  // (Configurações > Mensagens automáticas), pra quando ela não faz
  // sentido nesta conversa específica.
  function handleCloseWithoutMessage() {
    startTransition(async () => {
      const result = await changeConversationStatus(conversation.id, "CLOSED", { skipAutomaticMessage: true });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento encerrado sem mensagem.");
      router.refresh();
    });
  }

  function handlePriority(priority: Priority) {
    startTransition(async () => {
      const result = await changeConversationPriority(conversation.id, priority);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Prioridade atualizada.");
      router.refresh();
    });
  }

  const isClosed = conversation.status === "CLOSED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" disabled={isPending} aria-label="Mais ações da conversa">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Responsável</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAssign(null)}>Sem responsável</DropdownMenuItem>
            {assignableUsers.map((user) => (
              <DropdownMenuItem key={user.id} onClick={() => handleAssign(user.id)}>
                {user.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Prioridade</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {Object.values(Priority).map((priority) => (
              <DropdownMenuItem key={priority} onClick={() => handlePriority(priority)}>
                {PRIORITY_LABELS[priority]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {Object.values(ConversationStatus).map((status) => (
              <DropdownMenuItem key={status} onClick={() => handleStatus(status)}>
                {CONVERSATION_STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant={isClosed ? "default" : "destructive"}
          onClick={() => handleStatus(isClosed ? "OPEN" : "CLOSED")}
        >
          {isClosed ? "Reabrir conversa" : "Encerrar conversa"}
        </DropdownMenuItem>
        {!isClosed && (
          <DropdownMenuItem variant="destructive" onClick={handleCloseWithoutMessage}>
            Encerrar sem Mensagem
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
