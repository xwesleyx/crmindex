"use client";

import { ArrowRightLeft, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { ConvertLeadDialog } from "@/features/leads/convert-lead-dialog";
import { LeadArchiveButton } from "@/features/leads/lead-archive-button";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

type StageOption = { id: string; name: string };

export function LeadDetailActions({
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
  const [convertOpen, setConvertOpen] = useState(false);
  const alreadyConverted = lead.status === "CONVERTIDO";

  return (
    <div className="flex items-center gap-2">
      {canEdit && !alreadyConverted && (
        <Button size="sm" onClick={() => setConvertOpen(true)}>
          <ArrowRightLeft className="size-4" />
          Converter em oportunidade
        </Button>
      )}
      <AtendimentoButton
        entityType="LEAD"
        entityId={lead.id}
        defaultQueue="COMERCIAL"
        assignableUsers={atendimentoAssignableUsers}
        size="sm"
      />
      <LeadFormDialog
        mode="edit"
        lead={lead}
        assignableUsers={assignableUsers}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <LeadArchiveButton leadId={lead.id} archived={!!lead.deletedAt} variant="outline" />

      {canEdit && !alreadyConverted && (
        <ConvertLeadDialog
          lead={lead}
          stages={stages}
          assignableUsers={assignableUsers}
          open={convertOpen}
          onOpenChange={setConvertOpen}
        />
      )}
    </div>
  );
}
