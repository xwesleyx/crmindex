"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ToggleResult = { success: true } | { success: false; error: string };

// Confirmação (seção 19 da Etapa 3) desacoplada do trigger — controlada de
// fora para poder viver dentro de um menu suspenso sem os dois overlays
// brigarem pelo próprio fechamento (mesmo problema resolvido em Leads).
export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  archived,
  entityLabel,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archived: boolean;
  entityLabel: string;
  onToggle: () => Promise<ToggleResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onToggle();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? `${entityLabel} restaurado(a).` : `${entityLabel} arquivado(a).`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {archived ? `Restaurar ${entityLabel}?` : `Arquivar ${entityLabel}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {archived
              ? `${entityLabel} voltará a aparecer nas listagens padrão.`
              : `${entityLabel} deixará de aparecer nas listagens padrão. Nada é apagado — você pode restaurar depois.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
            {archived ? "Restaurar" : "Arquivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ArchiveToggleButton({
  archived,
  entityLabel,
  onToggle,
  variant = "outline",
}: {
  archived: boolean;
  entityLabel: string;
  onToggle: () => Promise<ToggleResult>;
  variant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {archived ? "Restaurar" : "Arquivar"}
      </Button>
      <ArchiveConfirmDialog
        open={open}
        onOpenChange={setOpen}
        archived={archived}
        entityLabel={entityLabel}
        onToggle={onToggle}
      />
    </>
  );
}
