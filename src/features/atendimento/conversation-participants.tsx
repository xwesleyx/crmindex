"use client";

import { Plus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addConversationParticipant, removeConversationParticipant } from "@/features/atendimento/actions";
import type { AssignableUser } from "@/features/leads/types";
import type { ConversationDetail } from "@/features/atendimento/types";

// Linha "Participantes" do bloco Informações: atendentes extras da conversa
// (além do responsável). Mesmas regras do servidor: quem atende (ou
// supervisiona) adiciona; o responsável/supervisor remove qualquer um; cada
// participante pode sair sozinho.
export function ConversationParticipants({
  conversation,
  assignableUsers,
  currentUser,
  canSupervise,
}: {
  conversation: ConversationDetail;
  assignableUsers: AssignableUser[];
  currentUser: { id: string };
  canSupervise: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isClosed = conversation.status === "CLOSED" || conversation.status === "RESOLVED";
  const participantIds = new Set(conversation.participants.map((p) => p.userId));
  const isAssignee = conversation.assigneeId === currentUser.id;
  const attending = isAssignee || participantIds.has(currentUser.id);
  const canAdd = !isClosed && !!conversation.assigneeId && (attending || canSupervise);
  const candidates = assignableUsers.filter(
    (user) => user.id !== conversation.assigneeId && !participantIds.has(user.id)
  );

  function add(userId: string, name: string) {
    startTransition(async () => {
      const result = await addConversationParticipant(conversation.id, userId);
      if (!result.success) {
        toast.error("Não foi possível adicionar", { description: result.error });
        return;
      }
      toast.success(`${name} agora participa desta conversa`, {
        description: "Pode responder ao cliente (com o próprio nome) e vê as notas internas.",
      });
      router.refresh();
    });
  }

  function remove(userId: string, name: string) {
    const self = userId === currentUser.id;
    startTransition(async () => {
      const result = await removeConversationParticipant(conversation.id, userId);
      if (!result.success) {
        toast.error(self ? "Não foi possível sair da conversa" : "Não foi possível remover", {
          description: result.error,
        });
        return;
      }
      toast.success(self ? "Você saiu desta conversa" : `${name} saiu desta conversa`);
      if (self && !canSupervise) router.push("/atendimento");
      router.refresh();
    });
  }

  if (!conversation.assigneeId) return null;

  return (
    <div className="flex flex-col gap-1.5 py-1.5 text-sm last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5 shrink-0" />
          Participantes
        </span>
        {canAdd && candidates.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="xs" variant="outline" disabled={isPending}>
                  <Plus className="size-3" />
                  Adicionar
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {candidates.map((user) => (
                <DropdownMenuItem key={user.id} onClick={() => add(user.id, user.name)}>
                  {user.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {conversation.participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">Só o responsável está atendendo.</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {conversation.participants.map((participant) => {
            const self = participant.userId === currentUser.id;
            const canRemove = !isClosed && (self || isAssignee || canSupervise);
            return (
              <li
                key={participant.userId}
                className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium text-primary"
              >
                {self ? `${participant.user.name} (você)` : participant.user.name}
                {canRemove && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => remove(participant.userId, participant.user.name)}
                    title={self ? "Sair da conversa" : `Remover ${participant.user.name}`}
                    className="rounded-full p-0.5 hover:bg-primary/15 disabled:opacity-50"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
