"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleLeadArchived } from "@/features/leads/actions";

export function LeadArchiveButton({
  leadId,
  archived,
  variant = "ghost",
}: {
  leadId: string;
  archived: boolean;
  variant?: "ghost" | "outline";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleLeadArchived(leadId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Lead restaurado." : "Lead arquivado.");
      router.refresh();
    });
  }

  return (
    <Button variant={variant} size="sm" disabled={isPending} onClick={handleClick}>
      {archived ? "Restaurar" : "Arquivar"}
    </Button>
  );
}
