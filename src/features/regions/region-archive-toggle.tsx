"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleRegionArchived } from "@/features/regions/actions";

export function RegionArchiveToggle({ regionId, archived }: { regionId: string; archived: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleRegionArchived(regionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Região restaurada." : "Região arquivada.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClick}>
      {archived ? "Restaurar" : "Arquivar"}
    </Button>
  );
}
