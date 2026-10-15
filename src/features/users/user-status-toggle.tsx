"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleUserStatus } from "@/features/users/actions";

export function UserStatusToggle({
  userId,
  status,
  disabled,
}: {
  userId: string;
  status: "ACTIVE" | "INACTIVE";
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleUserStatus(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "ACTIVE" ? "Usuário desativado." : "Usuário ativado."
      );
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled || isPending}
      onClick={handleClick}
    >
      {status === "ACTIVE" ? "Desativar" : "Ativar"}
    </Button>
  );
}
