"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { changeConversationStatus } from "@/features/atendimento/actions";

// Único jeito de "reabrir" um atendimento encerrado agora que ele some da
// Central (queries.ts) — reaproveita a mesma action de sempre.
export function ReopenConversationButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleReopen() {
    startTransition(async () => {
      const result = await changeConversationStatus(conversationId, "OPEN");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento reaberto.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleReopen}>
      Reabrir atendimento
    </Button>
  );
}
