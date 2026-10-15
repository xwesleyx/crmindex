"use client";

import { Pencil } from "lucide-react";

import { ArchiveToggleButton } from "@/components/archive-toggle";
import { Button } from "@/components/ui/button";
import { toggleCompanyArchived } from "@/features/companies/actions";
import { CompanyFormDialog } from "@/features/companies/company-form-dialog";
import type { CompanyListItem } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

export function CompanyDetailActions({
  company,
  assignableUsers,
  regions,
}: {
  company: CompanyListItem;
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
}) {
  return (
    <div className="flex items-center gap-2">
      <CompanyFormDialog
        mode="edit"
        company={company}
        assignableUsers={assignableUsers}
        regions={regions}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Editar
          </Button>
        }
      />
      <ArchiveToggleButton
        archived={!!company.deletedAt}
        entityLabel="Empresa"
        onToggle={() => toggleCompanyArchived(company.id)}
      />
    </div>
  );
}
