"use client";

import { useRouter } from "next/navigation";
import { Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { markOpportunityLost, markOpportunityWon } from "@/features/opportunities/actions";
import { LostReasonDialog } from "@/features/opportunities/lost-reason-dialog";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { AssignableUser } from "@/features/leads/types";
import type { CompanyOption } from "@/features/companies/types";
import type { ContactOption } from "@/features/contacts/types";

export function OpportunityDetailActions({
  opportunity,
  stages,
  contactOptions,
  companyOptions,
  assignableUsers,
  atendimentoAssignableUsers,
}: {
  opportunity: OpportunityListItem;
  stages: { id: string; name: string }[];
  contactOptions: ContactOption[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  atendimentoAssignableUsers: AssignableUser[];
}) {
  const [lostOpen, setLostOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isClosed = opportunity.status !== "OPEN";

  function handleWin() {
    startTransition(async () => {
      const result = await markOpportunityWon(opportunity.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Oportunidade marcada como ganha.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {(opportunity.contactId || opportunity.companyId) && (
        <AtendimentoButton
          entityType="OPPORTUNITY"
          entityId={opportunity.id}
          defaultQueue="COMERCIAL"
          assignableUsers={atendimentoAssignableUsers}
          size="sm"
        />
      )}
      <OpportunityFormDialog
        mode="edit"
        opportunity={opportunity}
        stages={stages}
        contactOptions={contactOptions}
        companyOptions={companyOptions}
        assignableUsers={assignableUsers}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      {!isClosed && (
        <>
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleWin}>
            <ThumbsUp className="size-4" />
            Marcar como ganha
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLostOpen(true)}>
            <ThumbsDown className="size-4" />
            Marcar como perdida
          </Button>
        </>
      )}

      <LostReasonDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={async (data) => {
          const result = await markOpportunityLost(opportunity.id, data);
          if (result.success) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
