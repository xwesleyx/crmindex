"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import type { AssignableUser } from "@/features/leads/types";

// Botão genérico de "Nova tarefa" no cabeçalho da Agenda — cria uma tarefa
// "General" (sem vínculo com nenhuma entidade, seção "a tarefa não precisa
// estar vinculada a um atendimento"), disponível em qualquer visualização.
export function AgendaNewTaskButton({
  assignableUsers,
  currentUserId,
}: {
  assignableUsers: AssignableUser[];
  currentUserId: string;
}) {
  return (
    <TaskFormDialog
      mode="create"
      entityType="General"
      entityId={currentUserId}
      assignableUsers={assignableUsers}
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          Nova tarefa
        </Button>
      }
    />
  );
}
