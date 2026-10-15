"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadForm } from "@/features/leads/lead-form";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

type LeadFormDialogBaseProps = {
  mode: "create" | "edit";
  lead?: LeadListItem;
  assignableUsers: AssignableUser[];
};

// Uso autônomo (`trigger`) para botões soltos, ou controlado
// (`open`/`onOpenChange`) para viver dentro de outro overlay (ex: um item de
// dropdown menu) — Dialog aninhado dentro de Menu quebra abertura/fechamento
// se os dois tentarem controlar o próprio estado.
type LeadFormDialogProps =
  | (LeadFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (LeadFormDialogBaseProps & {
      trigger?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function LeadFormDialog(props: LeadFormDialogProps) {
  const { mode, lead, assignableUsers } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo lead" : "Editar lead"}</DialogTitle>
        </DialogHeader>
        <LeadForm
          mode={mode}
          lead={lead}
          assignableUsers={assignableUsers}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
