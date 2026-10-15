import { redirect } from "next/navigation";
import { MapPin, Plus, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegionArchiveToggle } from "@/features/regions/region-archive-toggle";
import { RegionFormDialog } from "@/features/regions/region-form-dialog";
import { listRegions } from "@/features/regions/queries";
import { auth } from "@/lib/auth";

export default async function RegionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar regiões."
      />
    );
  }

  const regions = await listRegions(true);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Regiões"
        description="Agrupe clientes e empresas por local — use pra filtrar Kanban, Dashboard e Relatórios."
        action={
          <RegionFormDialog
            mode="create"
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova região
              </Button>
            }
          />
        }
      />

      {regions.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nenhuma região cadastrada"
          description="Crie a primeira região pra poder vincular a clientes e empresas."
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Região</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((region) => (
                <TableRow key={region.id} className={region.deletedAt ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-4 shrink-0 rounded-full border border-border/50"
                        style={{ backgroundColor: region.color }}
                      />
                      <span className="text-sm font-medium">{region.name}</span>
                      {region.isDefault && <Badge variant="secondary">Padrão</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={region.deletedAt ? "outline" : "default"}>
                      {region.deletedAt ? "Arquivada" : "Ativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!region.deletedAt && (
                        <RegionFormDialog
                          mode="edit"
                          region={region}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Editar
                            </Button>
                          }
                        />
                      )}
                      <RegionArchiveToggle regionId={region.id} archived={!!region.deletedAt} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
