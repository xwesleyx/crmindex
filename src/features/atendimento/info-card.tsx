"use client";

import { useRouter } from "next/navigation";
import { Building2, CircleDot, Flag, UserCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { assignConversation } from "@/features/atendimento/actions";
import { ConversationParticipants } from "@/features/atendimento/conversation-participants";
import { getConversationDisplayStatus } from "@/features/atendimento/labels";
import type { AssignableUser } from "@/features/leads/types";
import type { ConversationDetail } from "@/features/atendimento/types";

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm first:pt-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  );
}

// Bloco "Informações" do painel direito (seção 14): empresa, responsável
// (com ação rápida de atribuir, seção 15), status e prioridade — reaproveita
// assignConversation (mesma action do menu "..." do cabeçalho), sem regra
// de negócio nova.
export function AttendanceInfoCard({
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
  const displayStatus = getConversationDisplayStatus(conversation);

  function handleAssign(userId: string) {
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

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border px-2.5">
      <InfoRow icon={Building2} label="Empresa">
        <span className="truncate text-xs font-medium">
          {conversation.contact.company
            ? conversation.contact.company.tradeName || conversation.contact.company.legalName
            : "Não informado"}
        </span>
      </InfoRow>

      <InfoRow icon={UserCircle} label="Responsável">
        {conversation.assignee ? (
          <span className="truncate text-xs font-medium">{conversation.assignee.name}</span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isPending}
                  className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                >
                  Atribuir
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {assignableUsers.map((user) => (
                <DropdownMenuItem key={user.id} onClick={() => handleAssign(user.id)}>
                  {user.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </InfoRow>

      <ConversationParticipants
        conversation={conversation}
        assignableUsers={assignableUsers}
        currentUser={currentUser}
        canSupervise={canSupervise}
      />

      <InfoRow icon={CircleDot} label="Status">
        <StatusBadge label={displayStatus.label} tone={displayStatus.tone} className="text-[11px]" />
      </InfoRow>

      <InfoRow icon={Flag} label="Prioridade">
        <PriorityBadge priority={conversation.priority} className="text-[11px]" />
      </InfoRow>
    </div>
  );
}
