"use client";

import type { CustomerStatus } from "@prisma/client";
import { BadgeCheck, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TONE_CLASS } from "@/components/status-badge";
import { cn } from "cn";
import { convertCompanyToCustomer } from "@/features/customers/actions";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_TONE } from "@/features/customers/labels";

// Empresa já é cliente → marca "Cliente" (com o status) que abre o cadastro
// do cliente. Ainda não é → botão "Tornar cliente" com confirmação.
// Usado na listagem e na tela da Empresa.
export function CompanyCustomerStatus({
  companyId,
  companyName,
  customer,
  canConvert,
  size = "sm",
}: {
  companyId: string;
  companyName: string;
  customer: { id: string; status: CustomerStatus } | null;
  canConvert: boolean;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (customer) {
    const inactive = customer.status !== "ATIVO";
    return (
      <Link
        href={`/clientes/${customer.id}`}
        title="Abrir o cadastro de cliente"
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity hover:opacity-80",
          TONE_CLASS[inactive ? CUSTOMER_STATUS_TONE[customer.status] : "success"]
        )}
      >
        <BadgeCheck className="size-3.5" />
        {inactive ? `Cliente ${CUSTOMER_STATUS_LABELS[customer.status].toLowerCase()}` : "Cliente"}
      </Link>
    );
  }

  if (!canConvert) return null;

  function convert() {
    startTransition(async () => {
      const result = await convertCompanyToCustomer(companyId);
      if (!result.success) {
        toast.error("Não foi possível tornar cliente", { description: result.error, duration: 8000 });
        return;
      }
      setOpen(false);
      toast.success(`${companyName} agora é cliente`, {
        description: "O cadastro de cliente foi criado com o mesmo responsável e região da empresa.",
        duration: 8000,
        action: { label: "Abrir cliente", onClick: () => router.push(`/clientes/${result.data.id}`) },
      });
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" size={size}>
            <UserPlus className="size-3.5" />
            Tornar cliente
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tornar {companyName} cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            A empresa passa a aparecer em Clientes, com status Ativo, o mesmo responsável e a mesma região dela. Venda e
            instalação não são criadas — elas continuam vindo de uma oportunidade ganha.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={convert}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Tornar cliente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
