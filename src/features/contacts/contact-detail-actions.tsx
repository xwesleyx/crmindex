"use client";

import { Pencil } from "lucide-react";

import { ArchiveToggleButton } from "@/components/archive-toggle";
import { Button } from "@/components/ui/button";
import { toggleContactArchived } from "@/features/contacts/actions";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import type { ContactListItem } from "@/features/contacts/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

export function ContactDetailActions({
  contact,
  companyOptions,
  assignableUsers,
}: {
  contact: ContactListItem;
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
}) {
  return (
    <div className="flex items-center gap-2">
      <ContactFormDialog
        mode="edit"
        contact={contact}
        companyOptions={companyOptions}
        assignableUsers={assignableUsers}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <ArchiveToggleButton
        archived={!!contact.deletedAt}
        entityLabel="Contato"
        onToggle={() => toggleContactArchived(contact.id)}
      />
    </div>
  );
}
