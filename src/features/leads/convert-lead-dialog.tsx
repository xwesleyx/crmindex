"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConvertLeadForm } from "@/features/leads/convert-lead-form";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

type StageOption = { id: string; name: string };

// Controlado (open/onOpenChange) — igual ao padrão de LostReasonDialog: vive
// dentro de um DropdownMenuItem ou botão solto, nunca dono do próprio
// trigger, pra não colidir com o menu que o abre.
export function ConvertLeadDialog({
  lead,
  stages,
  assignableUsers,
  open,
  onOpenChange,
}: {
  lead: LeadListItem;
  stages: StageOption[];
  assignableUsers: AssignableUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Converter lead em oportunidade</DialogTitle>
        </DialogHeader>
        <ConvertLeadForm
          lead={lead}
          stages={stages}
          assignableUsers={assignableUsers}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
