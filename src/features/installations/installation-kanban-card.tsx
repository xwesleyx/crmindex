"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { AlertTriangle, Clock, MoreHorizontal } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/priority-badge";
import { cn } from "cn";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { canEditInstallation } from "@/features/installations/permissions";
import {
  checklistProgress,
  isInstallationOverdue,
  type InstallationListItem,
} from "@/features/installations/types";
import type { KanbanStageInfo } from "@/features/kanban/types";
import type { AssignableUser } from "@/features/leads/types";

// Mesmo motivo do kanban comercial (kanban-card.tsx): React.memo com props
// estáveis evita rerender de todos os cards a cada pointermove durante um
// drag.
export const InstallationKanbanCard = memo(function InstallationKanbanCard({
  installation,
  stages,
  currentUser,
  onMoveToStage,
  assignableUsers,
  dragDisabled,
}: {
  installation: InstallationListItem;
  stages: KanbanStageInfo[];
  currentUser: { id: string; role: UserRole };
  onMoveToStage: (installationId: string, fromStageId: string, toStageId: string) => void;
  assignableUsers: AssignableUser[];
  dragDisabled?: boolean;
}) {
  const canEdit = canEditInstallation(currentUser.role, currentUser.id, installation);
  // "type: card" + priority: usados pelo collisionDetection do board
  // (features/kanban/reorder.ts) pra só deixar soltar sobre outro card da
  // mesma prioridade — a "posição livre, respeitando a prioridade" pedida.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: installation.id,
    data: { type: "card", stageId: installation.stageId, priority: installation.priority },
    disabled: !canEdit || dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const progress = checklistProgress(installation.checklistItems);
  const overdue = isInstallationOverdue(installation);
  const region =
    installation.customer.region ??
    installation.customer.company?.region ??
    installation.customer.contact?.company?.region ??
    null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-kanban-card
      {...(canEdit && !dragDisabled ? { ...listeners, ...attributes } : {})}
      className={cn(
        "flex touch-none flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-sm transition-shadow",
        overdue ? "border-destructive/40" : "border-border",
        canEdit && !dragDisabled && "cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/instalacoes/${installation.id}`}
          className="text-sm font-medium hover:text-primary hover:underline"
        >
          {getCustomerDisplayName(installation.customer)}
        </Link>
        <div className="-mt-1 -mr-1 flex shrink-0 items-center">
          <AtendimentoButton
            entityType="INSTALLATION"
            entityId={installation.id}
            defaultQueue="IMPLANTACAO"
            assignableUsers={assignableUsers}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={<Link href={`/instalacoes/${installation.id}`}>Ver detalhes</Link>}
              />
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Mover para etapa</DropdownMenuLabel>
                    {stages
                      .filter((s) => s.id !== installation.stageId)
                      .map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => onMoveToStage(installation.id, installation.stageId, s.id)}
                        >
                          {s.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <PriorityBadge priority={installation.priority} className="text-[10px]" />
        {region && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
            <span className="font-semibold">{region.name}</span>
          </span>
        )}
        {installation.responsible && <span>{installation.responsible.name}</span>}
        {installation.sale.owner && (
          <span className="truncate">Vendedor: {installation.sale.owner.name}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
      </div>

      {(installation.scheduledAt || installation.dueAt) && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          {installation.scheduledAt && <span>Agendada: {formatDate(installation.scheduledAt)}</span>}
          {installation.dueAt && <span>Prazo: {formatDateTime(installation.dueAt)}</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {/* formatDistanceToNowStrict depende de "agora" — servidor e cliente
              hidratam em instantes diferentes, divergência esperada, não é bug. */}
          <span suppressHydrationWarning>{formatRelative(installation.createdAt)}</span> em implantação
        </span>
        {overdue && installation.dueAt && (
          <span className="flex items-center gap-1 font-medium text-destructive">
            <AlertTriangle className="size-3" />
            <span suppressHydrationWarning>{formatRelative(installation.dueAt)}</span> atrasada
          </span>
        )}
      </div>
    </div>
  );
});
