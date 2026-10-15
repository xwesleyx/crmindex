"use client";

import { CheckCircle2, Clock, Headset, Hourglass, Loader2, MessageSquare, Play, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/priority-badge";
import { getInitials } from "@/components/entity-avatar";
import { cn } from "cn";
import { userColor } from "@/lib/user-color";
import { formatRelative, formatTime } from "@/lib/format";
import { assignConversation, changeConversationStatus } from "@/features/atendimento/actions";
import type { BoardCard } from "@/features/atendimento/queries";

const ALL_ATTENDANTS = "all";
// Quadro pensado pra ficar aberto: atualiza sozinho.
const BOARD_REFRESH_MS = 15_000;

type Columns = {
  queue: BoardCard[];
  inProgress: BoardCard[];
  waitingCustomer: BoardCard[];
  closedToday: BoardCard[];
};

// Cor de cada coluna — mesmo estilo dos Kanbans do CRM/Instalações (fundo
// com a cor bem clara, borda um pouco mais forte, título na cor).
const COLUMN_STYLE = {
  queue: "border-warning/30 bg-warning/10 [--col:var(--warning)]",
  inProgress: "border-primary/30 bg-primary/10 [--col:var(--primary)]",
  waitingCustomer: "border-success/30 bg-success/10 [--col:var(--success)]",
  closedToday: "border-muted-foreground/25 bg-muted-foreground/10 [--col:var(--muted-foreground)]",
} as const;


export function AtendimentoBoard({
  columns,
  attendants,
  selectedAttendantId,
  currentUserId,
}: {
  columns: Columns;
  currentUserId: string;
  // Só vem preenchido pra quem tem "Ver atendimento de todos" — os demais
  // veem sempre o próprio quadro, sem seletor.
  attendants: { id: string; name: string }[] | null;
  selectedAttendantId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), BOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  function selectAttendant(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_ATTENDANTS) params.delete("atendente");
    else params.set("atendente", value);
    const query = params.toString();
    router.push(query ? `/atendimento/quadro?${query}` : "/atendimento/quadro");
  }

  const total =
    columns.queue.length + columns.inProgress.length + columns.waitingCustomer.length + columns.closedToday.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {attendants
            ? selectedAttendantId
              ? "Atendimentos deste atendente hoje"
              : "Atendimentos de toda a equipe hoje"
            : "Seus atendimentos de hoje"}{" "}
          · <span className="font-medium text-foreground tabular-nums">{total}</span>
        </p>
        {attendants && (
          <Select value={selectedAttendantId ?? ALL_ATTENDANTS} onValueChange={(v) => selectAttendant(v ?? ALL_ATTENDANTS)}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ATTENDANTS}>Todos os atendentes</SelectItem>
              {attendants.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BoardColumn
          title="Na fila"
          icon={<Hourglass className="size-4" />}
          styleKey="queue"
          cards={columns.queue}
          empty="Ninguém esperando na fila."
          currentUserId={currentUserId}
          queue
        />
        <BoardColumn
          title="Em atendimento"
          icon={<Headset className="size-4" />}
          styleKey="inProgress"
          cards={columns.inProgress}
          empty="Nenhum atendimento em andamento."
          currentUserId={currentUserId}
        />
        <BoardColumn
          title="Aguardando cliente"
          icon={<Clock className="size-4" />}
          styleKey="waitingCustomer"
          cards={columns.waitingCustomer}
          empty="Ninguém aguardando resposta do cliente."
          currentUserId={currentUserId}
        />
        <BoardColumn
          title="Finalizados hoje"
          icon={<CheckCircle2 className="size-4" />}
          styleKey="closedToday"
          cards={columns.closedToday}
          empty="Nenhum atendimento finalizado hoje."
          currentUserId={currentUserId}
          finished
        />
      </div>
    </div>
  );
}

function BoardColumn({
  title,
  icon,
  styleKey,
  cards,
  empty,
  currentUserId,
  finished = false,
  queue = false,
}: {
  title: string;
  icon: ReactNode;
  styleKey: keyof typeof COLUMN_STYLE;
  cards: BoardCard[];
  empty: string;
  currentUserId: string;
  finished?: boolean;
  queue?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-64 flex-col overflow-hidden rounded-xl border md:min-h-0",
        COLUMN_STYLE[styleKey]
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-(--col)">
          <span className="size-2 rounded-full bg-(--col)" />
          {icon}
          {title}
        </span>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-(--col)">
          {cards.length}
        </span>
      </header>
      <div className="themed-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        {cards.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{empty}</p>
        ) : (
          cards.map((card) => (
            <BoardCardItem
              key={card.id}
              card={card}
              finished={finished}
              queue={queue}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCardItem({
  card,
  finished,
  queue,
  currentUserId,
}: {
  card: BoardCard;
  finished: boolean;
  queue: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const href = `/atendimento/${card.id}`;
  const extraAttendants = card.participants.map((p) => p.user.name);
  const color = userColor(card.assigneeId);

  // Reabrir direto do quadro e já abrir a conversa (com todo o histórico).
  function reopen() {
    startTransition(async () => {
      const result = await changeConversationStatus(card.id, "OPEN");
      if (!result.success) {
        toast.error("Não foi possível reabrir", { description: result.error });
        return;
      }
      toast.success("Atendimento reaberto", {
        description: `A conversa com ${card.contact.name} voltou para "Em atendimento".`,
      });
      router.push(href);
    });
  }

  // "Atender" direto da fila: assume a conversa e já abre.
  function takeFromQueue() {
    startTransition(async () => {
      const result = await assignConversation(card.id, currentUserId);
      if (!result.success) {
        toast.error("Não foi possível iniciar o atendimento", { description: result.error });
        return;
      }
      toast.success("Atendimento iniciado", {
        description: `Você agora é o responsável pela conversa com ${card.contact.name}.`,
      });
      router.push(href);
    });
  }

  return (
    <article
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-l-4 border-border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-md",
        finished && "opacity-90"
      )}
      // Faixa lateral + fundo bem leve na cor do atendente (por cima do
      // bg-card, pra continuar legível no tema escuro).
      style={{ borderLeftColor: color, backgroundImage: `linear-gradient(${color}12, ${color}12)` }}
    >
      <Link href={href} className="flex min-w-0 items-start gap-2.5" title={finished ? "Ver o que teve neste atendimento" : "Abrir conversa"}>
        <Avatar size="sm" className="mt-0.5">
          <AvatarImage src={`/api/atendimento/contact-photo/${card.contact.id}?cached=1`} alt="" />
          <AvatarFallback>{getInitials(card.contact.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium group-hover:text-primary">{card.contact.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {finished && card.closedAt ? `às ${formatTime(card.closedAt)}` : formatRelative(card.lastMessageAt)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            <MessageSquare className="mr-1 inline size-3" />
            {card.lastMessagePreview || "Sem mensagens"}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        {card.unreadCount > 0 && !finished && (
          <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
            {card.unreadCount} nova{card.unreadCount === 1 ? "" : "s"}
          </span>
        )}
        {card.priority !== "NORMAL" && <PriorityBadge priority={card.priority} className="text-[10px]" />}
        <span className="truncate text-xs font-bold" style={{ color }}>
          {card.assignee?.name ?? (queue ? "Na fila" : "Sem responsável")}
        </span>
        {extraAttendants.length > 0 && (
          <span
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground"
            title={`Participando: ${extraAttendants.join(", ")}`}
          >
            <Users className="size-3" />+{extraAttendants.length}
          </span>
        )}
        {queue && (
          <Button type="button" size="xs" disabled={isPending} onClick={takeFromQueue} className="ml-auto">
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
            Atender
          </Button>
        )}
        {finished && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={reopen}
            className="ml-auto"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
            Reabrir
          </Button>
        )}
      </div>
    </article>
  );
}
