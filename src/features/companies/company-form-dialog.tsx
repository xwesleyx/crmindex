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
import { CompanyForm } from "@/features/companies/company-form";
import type { CompanyListItem } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

type CompanyFormDialogBaseProps = {
  mode: "create" | "edit";
  company?: CompanyListItem;
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
};

type CompanyFormDialogProps =
  | (CompanyFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (CompanyFormDialogBaseProps & {
      trigger?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function CompanyFormDialog(props: CompanyFormDialogProps) {
  const { mode, company, assignableUsers, regions } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova empresa" : "Editar empresa"}</DialogTitle>
        </DialogHeader>
        <CompanyForm
          mode={mode}
          company={company}
          assignableUsers={assignableUsers}
          regions={regions}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
