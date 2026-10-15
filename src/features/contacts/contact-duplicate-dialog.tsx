"use client";

import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhone } from "@/lib/format";

type DuplicateContact = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: { legalName: string; tradeName: string | null } | null;
};

export function ContactDuplicateDialog({
  duplicate,
  onClose,
  onUseExisting,
  onContinueAnyway,
}: {
  duplicate: DuplicateContact | null;
  onClose: () => void;
  onUseExisting: () => void;
  onContinueAnyway: () => void;
}) {
  return (
    <Dialog open={!!duplicate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Já existe um contato com esses dados</DialogTitle>
          <DialogDescription>
            Telefone, WhatsApp ou e-mail podem ser compartilhados legitimamente — confira antes
            de decidir.
          </DialogDescription>
        </DialogHeader>

        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4.5" />
            </div>
            <div className="flex flex-col text-sm">
              <span className="font-medium">{duplicate.name}</span>
              {duplicate.company && (
                <span className="text-xs text-muted-foreground">
                  {duplicate.company.tradeName || duplicate.company.legalName}
                </span>
              )}
              <span className="mt-1 text-muted-foreground">
                Telefone: {formatPhone(duplicate.phone)}
              </span>
              {duplicate.whatsapp && (
                <span className="text-muted-foreground">
                  WhatsApp: {formatPhone(duplicate.whatsapp)}
                </span>
              )}
              {duplicate.email && (
                <span className="text-muted-foreground">E-mail: {duplicate.email}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onContinueAnyway}>
            Continuar mesmo assim
          </Button>
          <Button onClick={onUseExisting}>Usar contato existente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
