"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { CheckSquare, Clock, MoreHorizontal } from "lucide-react";
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
import { EntityAvatar } from "@/components/entity-avatar";
import { MoneyDisplay } from "@/components/money-display";
import { PriorityBadge } from "@/components/priority-badge";
import { TemperatureBadge } from "@/components/temperature-badge";
import { cn } from "cn";
import { formatRelative } from "@/lib/format";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import type { AssignableUser } from "@/features/leads/types";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { KanbanStageInfo, NextTaskInfo } from "@/features/kanban/types";
import { CAPABILITIES, type ResolvedPermissionOverrides } from "@/lib/permissions";

// React.memo (+ props estáveis vindas de KanbanBoard/KanbanColumn — ver
// comentários lá) evita que TODOS os cards do board rerenderizem a cada
// pointermove durante um drag (dnd-kit atualiza o DndContext inteiro nesse
// evento) — antes disso era a causa principal do board "travar" ao
// selecionar/arrastar com várias dezenas de cards.
export const KanbanCard = memo(function KanbanCard({
  opportunity,
  stages,
  nextTask,
  currentUser,
  onMoveToStage,
  assignableUsers,
  dragDisabled,
  permissionOverrides,
}: {
  opportunity: OpportunityListItem;
  stages: KanbanStageInfo[];
  nextTask?: NextTaskInfo;
  currentUser: { id: string; role: UserRole };
  onMoveToStage: (opportunityId: string, fromStageId: string, toStageId: string) => void;
  assignableUsers: AssignableUser[];
  dragDisabled?: boolean;
  permissionOverrides?: ResolvedPermissionOverrides;
}) {
  // kanban.edit é um override explícito por cima da regra de posse — se
  // definido (true/false), vence; se ausente ("herdar do perfil"), cai na
  // mesma regra de sempre (dono/sem responsável ou ADMIN/GERENTE). Diferente
  // de hasCapability() porque aqui a "base" já é uma função existente
  // (canEditOpportunity), não a tabela ROLE_CAPABILITIES.
  const capabilityOverride = permissionOverrides?.capabilities[CAPABILITIES.kanbanEdit];
  const canEdit =
    capabilityOverride ?? canEditOpportunity(currentUser.role, currentUser.id, opportunity);
  // "type: card" + priority: usados pelo collisionDetection do board
  // (features/kanban/reorder.ts) pra só deixar soltar sobre outro card da
  // mesma prioridade — a "posição livre, respeitando a prioridade" pedida.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
    data: { type: "card", stageId: opportunity.stageId, priority: opportunity.priority },
    disabled: !canEdit || dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const primaryName = opportunity.company
    ? opportunity.company.tradeName || opportunity.company.legalName
    : (opportunity.contact?.name ?? null);
  const region = opportunity.company?.region ?? opportunity.contact?.company?.region ?? null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-kanban-card
      {...(canEdit && !dragDisabled ? { ...listeners, ...attributes } : {})}
      className={cn(
        "flex touch-none flex-col gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md",
        canEdit && !dragDisabled && "cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          {primaryName && (
            <p className="truncate text-sm font-semibold text-foreground">{primaryName}</p>
          )}
          <Link
            href={`/crm/oportunidades/${opportunity.id}`}
            className={cn(
              "truncate hover:text-primary hover:underline",
              primaryName ? "text-xs text-muted-foreground" : "text-sm font-medium text-foreground"
            )}
          >
            {opportunity.title}
          </Link>
        </div>
        <div className="-mt-1 -mr-1 flex shrink-0 items-center">
          {(opportunity.contact || opportunity.company) && (
            <AtendimentoButton
              entityType="OPPORTUNITY"
              entityId={opportunity.id}
              defaultQueue="COMERCIAL"
              assignableUsers={assignableUsers}
            />
          )}
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
                render={<Link href={`/crm/oportunidades/${opportunity.id}`}>Ver detalhes</Link>}
              />
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Mover para etapa</DropdownMenuLabel>
                    {stages
                      .filter((s) => s.id !== opportunity.stageId)
                      .map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => onMoveToStage(opportunity.id, opportunity.stageId, s.id)}
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

      <div className="flex items-baseline gap-1.5">
        <MoneyDisplay cents={opportunity.estimatedValueCents} size="lg" />
        {opportunity.recurringValueCents > 0 && (
          <span className="text-xs text-muted-foreground">
            + <MoneyDisplay cents={opportunity.recurringValueCents} size="sm" muted /> /mês
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TemperatureBadge temperature={opportunity.temperature} className="text-[10px]" />
          <PriorityBadge priority={opportunity.priority} className="text-[10px]" />
          {region && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
              <span className="font-semibold">{region.name}</span>
            </span>
          )}
        </div>
        {opportunity.owner && (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="truncate text-xs text-muted-foreground">{opportunity.owner.name}</span>
            <EntityAvatar name={opportunity.owner.name} size="sm" tone="muted" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {/* formatDistanceToNowStrict depende de "agora" — o servidor e o
              cliente hidratam em instantes diferentes, então esse texto
              pode legitimamente divergir por um segundo/minuto (não é bug
              de dado, é o React avisando sobre isso). */}
          <span suppressHydrationWarning>{formatRelative(opportunity.stageEnteredAt)}</span> na etapa
        </span>
      </div>

      {nextTask && (
        <p className="flex items-center gap-1.5 truncate rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          <CheckSquare className="size-3 shrink-0" />
          <span className="truncate">{nextTask.title}</span>
        </p>
      )}
    </div>
  );
});
