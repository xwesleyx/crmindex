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
import { OpportunityForm } from "@/features/opportunities/opportunity-form";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { AssignableUser } from "@/features/leads/types";
import type { CompanyOption } from "@/features/companies/types";
import type { ContactOption } from "@/features/contacts/types";

type StageOption = { id: string; name: string };

type OpportunityFormDialogBaseProps = {
  mode: "create" | "edit";
  opportunity?: OpportunityListItem;
  stages: StageOption[];
  contactOptions: ContactOption[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  defaultCompanyId?: string;
  defaultContactId?: string;
};

type OpportunityFormDialogProps =
  | (OpportunityFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (OpportunityFormDialogBaseProps & {
      trigger?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function OpportunityFormDialog(props: OpportunityFormDialogProps) {
  const { mode, opportunity, stages, contactOptions, companyOptions, assignableUsers, defaultCompanyId, defaultContactId } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova oportunidade" : "Editar oportunidade"}</DialogTitle>
        </DialogHeader>
        <OpportunityForm
          mode={mode}
          opportunity={opportunity}
          stages={stages}
          contactOptions={contactOptions}
          companyOptions={companyOptions}
          assignableUsers={assignableUsers}
          defaultCompanyId={defaultCompanyId}
          defaultContactId={defaultContactId}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
