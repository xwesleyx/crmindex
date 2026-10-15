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
import { InstallationForm } from "@/features/installations/installation-form";
import type { InstallationListItem } from "@/features/installations/types";
import type { AssignableUser } from "@/features/leads/types";

type InstallationFormDialogProps = {
  installation: InstallationListItem;
  assignableUsers: AssignableUser[];
} & (
  | { trigger: ReactElement; open?: never; onOpenChange?: never }
  | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
);

export function InstallationFormDialog(props: InstallationFormDialogProps) {
  const { installation, assignableUsers } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar instalação</DialogTitle>
        </DialogHeader>
        <InstallationForm
          installation={installation}
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
