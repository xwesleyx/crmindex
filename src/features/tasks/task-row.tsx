"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/priority-badge";
import { cn } from "cn";
import { formatDateTime } from "@/lib/format";
import { toggleTaskStatus } from "@/features/tasks/actions";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import type { TaskItem } from "@/features/tasks/types";
import type { AssignableUser } from "@/features/leads/types";

export function TaskRow({
  task,
  entityType,
  entityId,
  assignableUsers,
  canManage,
}: {
  task: TaskItem;
  entityType: string;
  entityId: string;
  assignableUsers: AssignableUser[];
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const done = task.status === "CONCLUIDA";

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleTaskStatus(task.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.info) toast.success("Tarefa concluída", { description: result.info });
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <Checkbox
        checked={done}
        disabled={!canManage || isPending}
        onCheckedChange={handleToggle}
        className="mt-0.5"
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        {task.description && (
          <span className="text-xs text-muted-foreground">{task.description}</span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {task.dueAt && <span>Prazo: {formatDateTime(task.dueAt)}</span>}
          {task.assignee && <span>· {task.assignee.name}</span>}
          <PriorityBadge priority={task.priority} className="text-[10px]" />
        </div>
      </div>
      {canManage && (
        <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5" />
        </Button>
      )}
      {canManage && (
        <TaskFormDialog
          mode="edit"
          task={task}
          entityType={entityType}
          entityId={entityId}
          assignableUsers={assignableUsers}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
