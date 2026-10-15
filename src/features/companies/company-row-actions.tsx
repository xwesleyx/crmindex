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
import { toggleCompanyArchived } from "@/features/companies/actions";
import { CompanyFormDialog } from "@/features/companies/company-form-dialog";
import type { CompanyListItem } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

export function CompanyRowActions({
  company,
  assignableUsers,
  regions,
  canEdit,
}: {
  company: CompanyListItem;
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archived = !!company.deletedAt;

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
            render={<Link href={`/clientes/empresas/${company.id}`}>Ver detalhes</Link>}
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
        <CompanyFormDialog
          mode="edit"
          company={company}
          assignableUsers={assignableUsers}
          regions={regions}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canEdit && (
        <ArchiveConfirmDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          archived={archived}
          entityLabel="Empresa"
          onToggle={() => toggleCompanyArchived(company.id)}
        />
      )}
    </>
  );
}
