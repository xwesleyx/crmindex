"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { AssignableUser } from "@/features/leads/types";
import type { CompanyOption } from "@/features/companies/types";
import type { ContactOption } from "@/features/contacts/types";

export function OpportunityRowActions({
  opportunity,
  stages,
  contactOptions,
  companyOptions,
  assignableUsers,
  canEdit,
}: {
  opportunity: OpportunityListItem;
  stages: { id: string; name: string }[];
  contactOptions: ContactOption[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

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
            render={<Link href={`/crm/oportunidades/${opportunity.id}`}>Ver detalhes</Link>}
          />
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <OpportunityFormDialog
          mode="edit"
          opportunity={opportunity}
          stages={stages}
          contactOptions={contactOptions}
          companyOptions={companyOptions}
          assignableUsers={assignableUsers}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}
