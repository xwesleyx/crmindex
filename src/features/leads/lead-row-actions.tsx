"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleLeadArchived } from "@/features/leads/actions";
import { useAtendimentoTrigger } from "@/features/atendimento/use-atendimento-trigger";
import { ConvertLeadDialog } from "@/features/leads/convert-lead-dialog";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

type StageOption = { id: string; name: string };

export function LeadRowActions({
  lead,
  assignableUsers,
  stages,
  canEdit,
  atendimentoAssignableUsers,
}: {
  lead: LeadListItem;
  assignableUsers: AssignableUser[];
  stages: StageOption[];
  canEdit: boolean;
  atendimentoAssignableUsers: AssignableUser[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const archived = !!lead.deletedAt;
  const alreadyConverted = lead.status === "CONVERTIDO";
  const atendimento = useAtendimentoTrigger({
    entityType: "LEAD",
    entityId: lead.id,
    defaultQueue: "COMERCIAL",
    assignableUsers: atendimentoAssignableUsers,
  });

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await toggleLeadArchived(lead.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Lead restaurado." : "Lead arquivado.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/crm/leads/${lead.id}`}>Ver detalhes</Link>}
          />
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
          )}
          {canEdit && !alreadyConverted && !archived && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                Converter em oportunidade
              </DropdownMenuItem>
            </>
          )}
          {!archived && (
            <DropdownMenuItem disabled={atendimento.pending} onClick={atendimento.trigger}>
              Atendimento
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem disabled={isPending} onClick={handleArchiveToggle}>
              {archived ? "Restaurar" : "Arquivar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {atendimento.dialogs}

      {canEdit && (
        <LeadFormDialog
          mode="edit"
          lead={lead}
          assignableUsers={assignableUsers}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canEdit && !alreadyConverted && (
        <ConvertLeadDialog
          lead={lead}
          stages={stages}
          assignableUsers={assignableUsers}
          open={convertOpen}
          onOpenChange={setConvertOpen}
        />
      )}
    </>
  );
}
