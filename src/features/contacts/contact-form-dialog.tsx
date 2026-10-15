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
import { ContactForm } from "@/features/contacts/contact-form";
import type { ContactListItem } from "@/features/contacts/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

type ContactFormDialogBaseProps = {
  mode: "create" | "edit";
  contact?: ContactListItem;
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  defaultCompanyId?: string;
  // Título próprio (ex.: Atendimento > "Novo contato" completa o cadastro do
  // contato provisório do número, que tecnicamente é uma edição).
  title?: string;
};

type ContactFormDialogProps =
  | (ContactFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (ContactFormDialogBaseProps & {
      trigger?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function ContactFormDialog(props: ContactFormDialogProps) {
  const { mode, contact, companyOptions, assignableUsers, defaultCompanyId, title } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? (mode === "create" ? "Novo contato" : "Editar contato")}</DialogTitle>
        </DialogHeader>
        <ContactForm
          mode={mode}
          contact={contact}
          companyOptions={companyOptions}
          assignableUsers={assignableUsers}
          defaultCompanyId={defaultCompanyId}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
