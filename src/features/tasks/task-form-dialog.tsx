"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TaskForm } from "@/features/tasks/task-form";
import type { TaskItem } from "@/features/tasks/types";
import type { AssignableUser } from "@/features/leads/types";

type TaskFormDialogBaseProps = {
  mode: "create" | "edit";
  task?: TaskItem;
  entityType: string;
  entityId: string;
  assignableUsers: AssignableUser[];
  defaultDueAt?: Date;
};

type TaskFormDialogProps =
  | (TaskFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (TaskFormDialogBaseProps & {
      trigger?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    });

export function TaskFormDialog(props: TaskFormDialogProps) {
  const { mode, task, entityType, entityId, assignableUsers, defaultDueAt } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova tarefa" : "Editar tarefa"}</DialogTitle>
        </DialogHeader>
        <TaskForm
          mode={mode}
          task={task}
          entityType={entityType}
          entityId={entityId}
          assignableUsers={assignableUsers}
          defaultDueAt={defaultDueAt}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
