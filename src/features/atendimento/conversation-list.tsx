"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListFilter, MessageSquare, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "cn";
import { formatRelative } from "@/lib/format";
import { changeConversationStatus, fetchConversationListSignature } from "@/features/atendimento/actions";
import { getConversationDisplayStatus, getConversationStatusDot } from "@/features/atendimento/labels";
import { AttendanceStatusFilters } from "@/features/atendimento/status-filters";
import type { ConversationFilterKey, ConversationListItem } from "@/features/atendimento/types";

// Mesmo intervalo do polling de mensagens dentro de uma conversa
// (chat-panel.tsx) — a lista precisa se atualizar sozinha (conversa nova
// chegando, mensagem não lida, atendimento encerrado por outra pessoa) sem
// precisar de F5.
const LIST_POLL_INTERVAL_MS = 5000;

// Navegação principal (sem "Todas"): Minhas = conversas que eu atendo
// (responsável ou participante) e é o padrão; Não lidas = só as minhas com
// mensagem nova; Novas = sem ninguém atendendo.
const DEFAULT_FILTER: ConversationFilterKey = "mine";
const FILTER_OPTIONS: { value: ConversationFilterKey; label: string; countKey: keyof ListCounts }[] = [
  { value: "mine", label: "Minhas", countKey: "mine" },
  { value: "unread", label: "Não lidas", countKey: "unread" },
  { value: "unassigned", label: "Novas", countKey: "unassigned" },
];

type ListCounts = {
  open: number;
  unread: number;
  mine: number;
  unassigned: number;
  waitingInternal: number;
  inProgress: number;
  waitingCustomer: number;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ConversationList({
  conversations,
  selectedId,
  currentUser,
  statusCounts,
}: {
  conversations: ConversationListItem[];
  selectedId?: string;
  currentUser: { id: string };
  statusCounts: ListCounts;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFilter = (searchParams.get("filter") as ConversationFilterKey) ?? DEFAULT_FILTER;
  const [closingConversationId, setClosingConversationId] = useState<string | null>(null);
  const [, startCloseTransition] = useTransition();
  // Preserva a aba/filtro/busca atual ao entrar numa conversa — sem isso o
  // clique voltava sempre para "Todas".
  const listQueryString = searchParams.toString();
  // Botão de filtro ao lado da busca mostra/esconde o painel de Status e
  // Ordenação; o ponto azul avisa quando há filtro/ordenação ativos nele.
  const [showFilters, setShowFilters] = useState(true);
  const hasPanelFilter = !!searchParams.get("status") || (searchParams.get("sort") ?? "recent") !== "recent";

  function handleQuickClose(conversationId: string) {
    setClosingConversationId(conversationId);
    startCloseTransition(async () => {
      const result = await changeConversationStatus(conversationId, "CLOSED");
      setClosingConversationId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento encerrado.");
      if (selectedId === conversationId) {
        router.push(listQueryString ? `/atendimento?${listQueryString}` : "/atendimento");
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === DEFAULT_FILTER) params.delete(key);
      else params.set(key, value);
    }
    const base = selectedId ? `/atendimento/${selectedId}` : "/atendimento";
    router.push(`${base}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) updateParams({ q: q || null });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    // `lastSignature` é uma variável comum de closure (não state) — a mesma
    // função `tick` roda em todo tick do setInterval, então ela persiste
    // sozinha entre chamadas sem precisar de ref/state pra isso.
    let lastSignature: string | null = null;

    async function tick() {
      const signature = await fetchConversationListSignature();
      if (cancelled || signature === null) return;
      // Só chama o router.refresh() completo (reexecuta listConversations,
      // métricas etc.) quando essa assinatura barata realmente mudou —
      // antes era um refresh incondicional a cada 5s, mesmo sem nada novo.
      if (lastSignature !== null && signature !== lastSignature) router.refresh();
      lastSignature = signature;
    }

    const interval = setInterval(tick, LIST_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant={showFilters ? "secondary" : "outline"}
            size="icon"
            title={showFilters ? "Esconder status e ordenação" : "Mostrar status e ordenação"}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((value) => !value)}
            className="relative shrink-0"
          >
            <ListFilter className="size-4" />
            {!showFilters && hasPanelFilter && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
            )}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5">
          {FILTER_OPTIONS.map((option) => {
            const active = activeFilter === option.value;
            const count = statusCounts[option.countKey];
            // "Novas" chama atenção em vermelho quando chega atendimento sem
            // responsável, mesmo com outra aba aberta.
            const urgent = option.value === "unassigned" && count > 0 && !active;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateParams({ filter: option.value })}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <span className="truncate">{option.label}</span>
                <span
                  className={cn(
                    "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-primary-foreground/25 text-primary-foreground"
                      : urgent
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-background text-muted-foreground"
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showFilters && <AttendanceStatusFilters counts={statusCounts} selectedId={selectedId} />}

      <div className="themed-scrollbar flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma conversa"
            description="Ajuste os filtros ou inicie uma nova conversa."
          />
        ) : (
          <ul className="flex flex-col">
            {conversations.map((conversation) => {
              const isSelected = conversation.id === selectedId;
              const isMine = conversation.assigneeId === currentUser.id;
              const isUnread = conversation.unreadCount > 0;
              const displayStatus = getConversationDisplayStatus(conversation);
              const href = `/atendimento/${conversation.id}${listQueryString ? `?${listQueryString}` : ""}`;
              return (
                <li key={conversation.id} className="group/item relative">
                  <Link
                    href={href}
                    className={cn(
                      "flex items-start gap-2.5 border-b border-l-2 border-border/60 border-l-transparent px-2.5 py-2.5 pr-8 transition-colors hover:bg-muted",
                      isSelected && "border-l-primary bg-primary/5 hover:bg-primary/5"
                    )}
                  >
                    <Avatar size="sm" className="mt-0.5">
                      {/* Só a cópia já guardada (?cached=1) — a lista nunca
                          consulta o WhatsApp, pra não arriscar bloqueio. */}
                      <AvatarImage
                        src={`/api/atendimento/contact-photo/${conversation.contact.id}?cached=1`}
                        alt=""
                      />
                      <AvatarFallback>{initials(conversation.contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn("size-1.5 shrink-0 rounded-full", getConversationStatusDot(conversation))}
                          />
                          {/* Notificação de não lida "no nome" (pedido do usuário) — nome
                              em negrito + contador logo ao lado, não só um badge solto
                              embaixo, que passava despercebido. */}
                          <span className={cn("truncate text-sm", isUnread ? "font-bold text-foreground" : "font-medium")}>
                            {conversation.contact.name}
                          </span>
                          {isUnread && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatRelative(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className={cn("truncate text-xs", isUnread ? "text-foreground/80" : "text-muted-foreground")}>
                        {conversation.lastMessagePreview || "Sem mensagens"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          label={displayStatus.label}
                          tone={displayStatus.tone}
                          className="px-1.5 py-0 text-[10px]"
                        />
                        {isMine && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                            Minha
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  {/* Encerrar sem precisar abrir a conversa — só aparece pra quem já
                      tem responsável, igual à regra do botão dentro do chat. */}
                  {conversation.assigneeId && (
                    <button
                      type="button"
                      title="Encerrar atendimento"
                      disabled={closingConversationId === conversation.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleQuickClose(conversation.id);
                      }}
                      className="absolute top-2.5 right-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/item:opacity-100 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
