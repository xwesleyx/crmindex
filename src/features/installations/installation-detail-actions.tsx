"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { InstallationFormDialog } from "@/features/installations/installation-form-dialog";
import type { InstallationListItem } from "@/features/installations/types";
import type { AssignableUser } from "@/features/leads/types";

export function InstallationDetailActions({
  installation,
  assignableUsers,
  atendimentoAssignableUsers,
}: {
  installation: InstallationListItem;
  assignableUsers: AssignableUser[];
  atendimentoAssignableUsers: AssignableUser[];
}) {
  return (
    <div className="flex items-center gap-2">
      <AtendimentoButton
        entityType="INSTALLATION"
        entityId={installation.id}
        defaultQueue="IMPLANTACAO"
        assignableUsers={atendimentoAssignableUsers}
        size="sm"
      />
      <InstallationFormDialog
        installation={installation}
        assignableUsers={assignableUsers}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
    </div>
  );
}
