"use client";

import type { ConversationQueue } from "@prisma/client";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AtendimentoEntityType } from "@/features/atendimento/actions";
import { useAtendimentoTrigger } from "@/features/atendimento/use-atendimento-trigger";
import type { AssignableUser } from "@/features/leads/types";

// Botão 💬 visível (seção 10/17) reaproveitado nos cards do Kanban e nas
// páginas de detalhe — para a tabela de Leads (100% dropdown hoje), usar
// useAtendimentoTrigger direto com um DropdownMenuItem no lugar deste botão.
export function AtendimentoButton({
  entityType,
  entityId,
  defaultQueue,
  assignableUsers,
  size = "icon-sm",
  className,
}: {
  entityType: AtendimentoEntityType;
  entityId: string;
  defaultQueue?: ConversationQueue;
  assignableUsers: AssignableUser[];
  size?: "icon-sm" | "sm";
  className?: string;
}) {
  const { trigger, dialogs, pending } = useAtendimentoTrigger({
    entityType,
    entityId,
    defaultQueue,
    assignableUsers,
  });

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size={size}
              className={className}
              disabled={pending}
              onClick={trigger}
            >
              <MessageCircle className="size-3.5" />
              {size === "sm" && "Atendimento"}
            </Button>
          }
        />
        <TooltipContent>Atendimento</TooltipContent>
      </Tooltip>
      {dialogs}
    </>
  );
}
