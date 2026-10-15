"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { formatDateTime } from "@/lib/format";
import { addChecklistItem, toggleChecklistItem } from "@/features/installations/actions";
import { checklistProgress } from "@/features/installations/types";

type ChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt: Date | null;
  completedBy: { id: string; name: string } | null;
};

export function InstallationChecklist({
  installationId,
  items,
  canManage,
}: {
  installationId: string;
  items: ChecklistItem[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const router = useRouter();
  const progress = checklistProgress(items);

  function handleToggle(itemId: string) {
    startTransition(async () => {
      const result = await toggleChecklistItem(itemId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleAddItem() {
    const label = newLabel.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await addChecklistItem(installationId, label);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setNewLabel("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {progress.done}/{progress.total} · {progress.percent}%
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <Checkbox
              checked={item.completed}
              disabled={!canManage || isPending}
              onCheckedChange={() => handleToggle(item.id)}
              className="mt-0.5"
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className={cn("text-sm", item.completed && "text-muted-foreground line-through")}>
                {item.label}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {item.required && (
                  <Badge variant="outline" className="text-[10px]">
                    Obrigatório
                  </Badge>
                )}
                {item.completed && item.completedBy && (
                  <span>
                    {item.completedBy.name} · {formatDateTime(item.completedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddItem();
              }
            }}
            placeholder="Adicionar item ao checklist..."
            disabled={isPending}
            className="h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !newLabel.trim()}
            onClick={handleAddItem}
          >
            <Plus className="size-3.5" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
