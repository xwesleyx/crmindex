import type { UserRole } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkTableRow } from "@/components/link-table-row";
import { formatDateTime, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ACTIVE_STATUS_LABEL, ACTIVE_STATUS_TONE } from "@/features/contacts/labels";
import { ContactRowActions } from "@/features/contacts/contact-row-actions";
import { canEditContact } from "@/features/contacts/permissions";
import type { ContactListItem } from "@/features/contacts/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

export function ContactsTable({
  contacts,
  companyOptions,
  assignableUsers,
  currentUser,
}: {
  contacts: ContactListItem[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  currentUser: { id: string; role: UserRole };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Última interação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <LinkTableRow
              key={contact.id}
              href={`/clientes/contatos/${contact.id}`}
              className={contact.deletedAt ? "opacity-60" : undefined}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{contact.name}</span>
                  {contact.role && (
                    <span className="text-xs text-muted-foreground">{contact.role}</span>
                  )}
                  {contact.deletedAt && (
                    <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                      Arquivado
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {contact.company ? contact.company.tradeName || contact.company.legalName : "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatPhone(contact.phone || contact.whatsapp)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={ACTIVE_STATUS_LABEL[String(contact.isActive) as "true" | "false"]}
                  tone={ACTIVE_STATUS_TONE[String(contact.isActive) as "true" | "false"]}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {contact.responsible?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(contact.lastInteractionAt)}
              </TableCell>
              <TableCell className="text-right">
                <ContactRowActions
                  contact={contact}
                  companyOptions={companyOptions}
                  assignableUsers={assignableUsers}
                  canEdit={canEditContact(currentUser.role, currentUser.id, contact)}
                />
              </TableCell>
            </LinkTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
