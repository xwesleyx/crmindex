"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { ArchiveConfirmDialog } from "@/components/archive-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleContactArchived } from "@/features/contacts/actions";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import type { ContactListItem } from "@/features/contacts/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

export function ContactRowActions({
  contact,
  companyOptions,
  assignableUsers,
  canEdit,
}: {
  contact: ContactListItem;
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archived = !!contact.deletedAt;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/clientes/contatos/${contact.id}`}>Ver detalhes</Link>}
          />
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              {archived ? "Restaurar" : "Arquivar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <ContactFormDialog
          mode="edit"
          contact={contact}
          companyOptions={companyOptions}
          assignableUsers={assignableUsers}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canEdit && (
        <ArchiveConfirmDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          archived={archived}
          entityLabel="Contato"
          onToggle={() => toggleContactArchived(contact.id)}
        />
      )}
    </>
  );
}
