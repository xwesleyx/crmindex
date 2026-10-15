import { ListTodo, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { TaskRow } from "@/features/tasks/task-row";
import type { TaskItem } from "@/features/tasks/types";
import type { AssignableUser } from "@/features/leads/types";

export function TaskList({
  tasks,
  entityType,
  entityId,
  assignableUsers,
  canManage,
}: {
  tasks: TaskItem[];
  entityType: string;
  entityId: string;
  assignableUsers: AssignableUser[];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {canManage && (
        <div className="flex justify-end">
          <TaskFormDialog
            mode="create"
            entityType={entityType}
            entityId={entityId}
            assignableUsers={assignableUsers}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Nova tarefa
              </Button>
            }
          />
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nenhuma tarefa" description="Crie a primeira tarefa desta oportunidade." />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              entityType={entityType}
              entityId={entityId}
              assignableUsers={assignableUsers}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
