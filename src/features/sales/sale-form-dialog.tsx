"use client";

import { type ReactElement, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SaleForm } from "@/features/sales/sale-form";
import type { SaleDetail } from "@/features/sales/types";

export function SaleFormDialog({ sale, trigger }: { sale: SaleDetail; trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar venda</DialogTitle>
        </DialogHeader>
        <SaleForm
          sale={sale}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
