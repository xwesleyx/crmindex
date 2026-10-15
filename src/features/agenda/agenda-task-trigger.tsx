"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskForm } from "@/features/tasks/task-form";
import { fetchTask } from "@/features/tasks/actions";
import type { TaskItem } from "@/features/tasks/types";
import type { AssignableUser } from "@/features/leads/types";

// "Geral" (tarefa avulsa criada direto na Agenda) não tem uma tela própria
// pra abrir a partir do link do evento — diferente de Atendimento/CRM/
// Instalação, que levam pro registro dono (pedido: "não consigo abrir ela
// pra finalizar"). Busca a tarefa completa sob demanda (só no clique, não
// pré-carregada pra cada evento do período) e mostra o mesmo formulário de
// editar usado no resto do sistema, com concluir/reabrir já embutido nele.
export function AgendaTaskTrigger({
  taskId,
  assignableUsers,
  children,
  className,
}: {
  taskId: string;
  assignableUsers: AssignableUser[];
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setOpen(true);
    if (task) return;
    setLoading(true);
    const result = await fetchTask(taskId);
    setTask(result);
    setLoading(false);
  }

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tarefa</DialogTitle>
          </DialogHeader>
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!loading && !task && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar esta tarefa.
            </p>
          )}
          {task && (
            <TaskForm
              mode="edit"
              task={task}
              entityType={task.entityType}
              entityId={task.entityId}
              assignableUsers={assignableUsers}
              onSuccess={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
