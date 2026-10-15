"use client";

import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCNPJ, formatPhone } from "@/lib/format";

type DuplicateCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
};

export function CompanyDuplicateDialog({
  duplicate,
  onClose,
  onUseExisting,
}: {
  duplicate: DuplicateCompany | null;
  onClose: () => void;
  onUseExisting: () => void;
}) {
  return (
    <Dialog open={!!duplicate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Já existe uma empresa com este CNPJ</DialogTitle>
          <DialogDescription>
            CNPJ é um identificador único — não é possível cadastrar duas empresas com o mesmo
            número. Use a empresa existente ou corrija o CNPJ informado.
          </DialogDescription>
        </DialogHeader>

        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4.5" />
            </div>
            <div className="flex flex-col text-sm">
              <span className="font-medium">{duplicate.tradeName || duplicate.legalName}</span>
              {duplicate.tradeName && (
                <span className="text-xs text-muted-foreground">{duplicate.legalName}</span>
              )}
              <span className="mt-1 text-muted-foreground">CNPJ: {formatCNPJ(duplicate.cnpj)}</span>
              {duplicate.phone && (
                <span className="text-muted-foreground">Telefone: {formatPhone(duplicate.phone)}</span>
              )}
              {duplicate.email && (
                <span className="text-muted-foreground">E-mail: {duplicate.email}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Corrigir CNPJ
          </Button>
          <Button onClick={onUseExisting}>Usar empresa existente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
