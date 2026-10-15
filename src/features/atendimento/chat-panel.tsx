"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Info, Lock, Mic, Paperclip, Send, Square, UserPlus, VenetianMask, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/components/entity-avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { cn } from "cn";
import { formatDate } from "@/lib/format";
import {
  addConversationParticipant,
  addInternalNote,
  assignConversation,
  changeConversationStatus,
  fetchNewMessages,
  markConversationRead,
  sendMediaMessage,
  sendMessage,
} from "@/features/atendimento/actions";
import { ConversationActionsMenu } from "@/features/atendimento/conversation-actions-menu";
import { EmojiPicker } from "@/features/atendimento/emoji-picker";
import { getConversationDisplayStatus, getConversationStatusDot, MESSAGE_TYPE_LABELS } from "@/features/atendimento/labels";
import { MessageBubble } from "@/features/atendimento/message-bubble";
import type { AssignableUser } from "@/features/leads/types";
import { CultureStrip } from "@/features/atendimento/conversation-culture-ui";
import { getConversationCulture } from "@/features/atendimento/conversation-culture";
import type { ConversationDetail, MessageItem } from "@/features/atendimento/types";
import type { QuickReplyListItem } from "@/features/quick-replies/queries";

const POLL_INTERVAL_MS = 5000;
// Mesmos limites do WhatsApp: foto/vídeo/áudio até 16 MB; qualquer outro
// arquivo vai como documento, até 100 MB.
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function isMediaFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/");
}

function dayKey(date: Date | string) {
  return formatDate(date);
}

// O polling (a cada 5s) e o envio manual (handleSend, que também busca a
// mensagem recém-criada pra aparecer na hora, sem esperar o próximo ciclo)
// podem pegar a mesma mensagem nova se caírem perto um do outro — sem
// dedupe por id, isso duplicava a bolha (reportado com fotos, mas vale pra
// qualquer envio).
function appendNewMessages(prev: MessageItem[], fresh: MessageItem[]): MessageItem[] {
  if (fresh.length === 0) return prev;
  const existingIds = new Set(prev.map((m) => m.id));
  const toAdd = fresh.filter((m) => !existingIds.has(m.id));
  return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
}

// O chamador (page.tsx) monta este componente com `key={conversation.id}` —
// trocar de conversa remonta o componente do zero em vez de sincronizar
// `initialMessages` via effect, então não precisa de nenhum estado
// "espelhando" a prop entre renders.
export function ChatPanel({
  conversation,
  initialMessages,
  assignableUsers,
  quickReplies,
  contextPanel,
  currentUser,
}: {
  conversation: ConversationDetail;
  initialMessages: MessageItem[];
  assignableUsers: AssignableUser[];
  quickReplies: QuickReplyListItem[];
  contextPanel: ReactNode;
  currentUser: { id: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  // "Modo anônimo": o que for enviado vira nota interna (não vai pro
  // cliente) — ver addInternalNote.
  const [noteMode, setNoteMode] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // id -> nome de quem foi escolhido na lista de @ (só vale se o "@Nome"
  // ainda estiver no texto na hora de enviar).
  const [mentioned, setMentioned] = useState<Record<string, string>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  // Estável (useCallback) porque MessageBubble é memo. Responder é falar com
  // o cliente, então sai do modo anônimo.
  const handleReply = useCallback((message: MessageItem) => {
    setNoteMode(false);
    setReplyingTo(message);
  }, []);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  // true só pra gravação do microfone — vai como mensagem de voz; um arquivo
  // de áudio anexado vai como arquivo comum.
  const [attachedIsVoiceNote, setAttachedIsVoiceNote] = useState(false);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);
  const [attendancePending, startAttendanceTransition] = useTransition();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [quickReplyIndex, setQuickReplyIndex] = useState(0);
  const [quickReplyDismissed, setQuickReplyDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    markConversationRead(conversation.id).catch(() => {});
  }, [conversation.id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const lastId = messages.at(-1)?.id;
      try {
        const fresh = await fetchNewMessages(conversation.id, lastId);
        if (fresh.length > 0) {
          setMessages((prev) => appendNewMessages(prev, fresh));
          markConversationRead(conversation.id).catch(() => {});
        }
      } catch {
        // silencioso — próximo ciclo tenta de novo
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Compartilhado entre o input de arquivo (Anexar), a gravação de áudio e
  // agora o Ctrl+V de imagem — os três terminam no mesmo estado
  // "anexo pronto pra enviar" (barra de preview + Enviar).
  function attachFile(file: File) {
    const limit = isMediaFile(file) ? MAX_MEDIA_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > limit) {
      toast.error("Arquivo muito grande", {
        description: isMediaFile(file)
          ? "Foto, vídeo e áudio podem ter até 16 MB (limite do WhatsApp)."
          : "Documentos podem ter até 100 MB (limite do WhatsApp).",
      });
      return;
    }
    setAttachedIsVoiceNote(false);
    if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    setAttachedFile(file);
    setAttachedPreviewUrl(
      file.type.startsWith("image/") || file.type.startsWith("audio/") ? URL.createObjectURL(file) : null
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois de remover
    if (file) attachFile(file);
  }

  // "colocar no CTRL+C de uma imagem, eu conseguir colar" — só intercepta
  // quando o clipboard realmente tem uma imagem; colar texto normal continua
  // funcionando do jeito padrão do navegador (não dá preventDefault nesse
  // caso).
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!canReply || attachedFile) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    attachFile(file);
  }

  function clearAttachedFile() {
    if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    setAttachedFile(null);
    setAttachedPreviewUrl(null);
  }

  // Insere no cursor (não sempre no fim) — reaproveita a posição de
  // seleção nativa do textarea, senão escolher um emoji no meio de uma
  // frase já digitada sempre jogaria ele pro final.
  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + emoji.length;
      el?.setSelectionRange(cursor, cursor);
    });
  }

  // Grava pelo microfone do navegador (getUserMedia + MediaRecorder) e
  // reaproveita o mesmo fluxo de "arquivo anexado" já usado por foto/vídeo —
  // ao parar, vira um File normal em attachedFile, mandado por sendMediaMessage
  // com ptt=true do lado do whatsapp-service (aparece como mensagem de voz).
  async function startRecording() {
    // Sem isso, um navegador sem getUserMedia disponível (ex: acessando por
    // http:// num IP da rede em vez de localhost/https — a API não existe
    // fora de um "contexto seguro") cai direto no catch genérico de baixo,
    // com uma mensagem que sugere "verifique a permissão" quando o problema
    // real é outro (não tem nem como pedir permissão).
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(
        window.isSecureContext
          ? "Este navegador não suporta gravação de áudio."
          : "Gravar áudio só funciona em conexão segura (https ou localhost)."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (error) {
      // O navegador só mostra o pop-up de permissão a partir desta chamada
      // (sempre no clique do botão, nunca antes) — não tem como "forçar" a
      // caixa de diálogo nativa a aparecer por código; o que dá pra fazer é
      // garantir que a chamada sempre acontece aqui (não muda) e explicar
      // exatamente o que fazer em cada erro, em vez de uma mensagem genérica.
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error(
          "Permissão de microfone bloqueada. Clique no ícone de cadeado/câmera ao lado do endereço do site, permita o microfone e tente de novo.",
          { duration: 8000 }
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        toast.error("Nenhum microfone encontrado neste dispositivo.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        toast.error("O microfone está sendo usado por outro programa. Feche-o e tente de novo.");
      } else {
        toast.error("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      }
    }
  }

  function stopRecordingInternal() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  }

  function finishRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const ext = recorder.mimeType.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `gravacao-${Date.now()}.${ext}`, { type: blob.type });
      setAttachedFile(file);
      setAttachedIsVoiceNote(true);
      setAttachedPreviewUrl(URL.createObjectURL(file));
    };
    stopRecordingInternal();
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = () => {
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };
    }
    stopRecordingInternal();
  }

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function formatRecordingTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // "/" no início do campo, sem espaço/quebra de linha ainda — enquanto
  // isso for verdade, o usuário ainda está escolhendo o atalho (pedido:
  // "ao digitar só / aparece todas disponíveis"). Um espaço ou quebra de
  // linha significa que ele já passou a digitar uma frase normal.
  const slashQuery =
    content.startsWith("/") && !/[\s\n]/.test(content) && !quickReplyDismissed ? content.slice(1).toLowerCase() : null;
  const quickReplyMatches =
    slashQuery === null ? [] : quickReplies.filter((q) => q.shortcut.toLowerCase().startsWith(slashQuery));

  // @menção (só em nota interna): o "@" logo antes do cursor abre a lista de
  // atendentes; escolher insere "@Nome " e guarda o id pra notificar.
  const mentionMatches = useMemo(() => {
    if (!noteMode || mentionQuery === null) return [];
    const query = normalizeForSearch(mentionQuery);
    return assignableUsers
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        const name = normalizeForSearch(user.name);
        return !query || name.startsWith(query) || name.split(/\s+/).some((part) => part.startsWith(query));
      })
      .slice(0, 8);
  }, [noteMode, mentionQuery, assignableUsers, currentUser.id]);
  // Nomes de quem pode ser mencionado — destacados nas notas internas.
  const mentionableNames = useMemo(() => assignableUsers.map((user) => user.name), [assignableUsers]);

  function handleContentChange(value: string, caret?: number) {
    setContent(value);
    setQuickReplyDismissed(false);
    setQuickReplyIndex(0);
    const beforeCaret = value.slice(0, caret ?? value.length);
    const match = noteMode ? beforeCaret.match(/(?:^|\s)@([^\s@]{0,30})$/) : null;
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
  }

  function selectMention(user: { id: string; name: string }) {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? content.length;
    const before = content.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${user.name} `);
    setContent(before + content.slice(caret));
    setMentioned((prev) => ({ ...prev, [user.id]: user.name }));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(before.length, before.length);
    });
  }

  function selectQuickReply(item: QuickReplyListItem) {
    setContent(item.message);
    setQuickReplyDismissed(true);
    textareaRef.current?.focus();
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (quickReplyMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setQuickReplyIndex((i) => (i + 1) % quickReplyMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setQuickReplyIndex((i) => (i - 1 + quickReplyMatches.length) % quickReplyMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectQuickReply(quickReplyMatches[quickReplyIndex] ?? quickReplyMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuickReplyDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if ((!trimmed && !attachedFile) || sending) return;

    if (noteMode) {
      if (!trimmed) return;
      setSending(true);
      const mentionIds = Object.entries(mentioned)
        .filter(([, name]) => trimmed.includes(`@${name}`))
        .map(([id]) => id);
      const noteResult = await addInternalNote(conversation.id, trimmed, mentionIds);
      setSending(false);
      if (!noteResult.success) {
        toast.error("Não foi possível salvar a nota", { description: noteResult.error });
        return;
      }
      setContent("");
      setMentioned({});
      setMentionQuery(null);
      if (mentionIds.length > 0) {
        toast.success("Nota salva", {
          description: "Quem foi mencionado recebeu uma notificação e passou a participar da conversa.",
        });
        router.refresh();
      }
      const freshNotes = await fetchNewMessages(conversation.id, messages.at(-1)?.id);
      setMessages((prev) => appendNewMessages(prev, freshNotes));
      return;
    }

    setSending(true);
    let result;
    if (attachedFile) {
      const formData = new FormData();
      formData.append("file", attachedFile);
      if (attachedIsVoiceNote) formData.append("voiceNote", "1");
      formData.append("caption", trimmed);
      if (replyingTo) formData.append("replyToId", replyingTo.id);
      result = await sendMediaMessage(conversation.id, formData);
    } else {
      result = await sendMessage(conversation.id, { content: trimmed, replyToId: replyingTo?.id });
    }
    setSending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) toast.error(result.warning);
    setContent("");
    setReplyingTo(null);
    clearAttachedFile();
    const fresh = await fetchNewMessages(conversation.id, messages.at(-1)?.id);
    setMessages((prev) => appendNewMessages(prev, fresh));
    router.refresh();
  }

  const isClosed = conversation.status === "CLOSED";
  const isUnassigned = !conversation.assigneeId;
  const canReply = !isClosed && !isUnassigned;
  const displayStatus = getConversationDisplayStatus(conversation);

  function handleStartAttendance() {
    startAttendanceTransition(async () => {
      const result = await assignConversation(conversation.id, currentUser.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Atendimento iniciado.");
      router.refresh();
    });
  }

  // "Participar": entra como atendente extra numa conversa que já tem
  // responsável (mais de um atendente na mesma conversa).
  const isAttending =
    conversation.assigneeId === currentUser.id || conversation.participants.some((p) => p.userId === currentUser.id);
  const canJoin = !isUnassigned && !isClosed && !isAttending;

  function handleJoin() {
    startAttendanceTransition(async () => {
      const result = await addConversationParticipant(conversation.id, currentUser.id);
      if (!result.success) {
        toast.error("Não foi possível participar", { description: result.error });
        return;
      }
      toast.success("Você agora participa desta conversa", {
        description: "Pode responder ao cliente com o seu nome e escrever notas internas.",
      });
      router.refresh();
    });
  }

  function handleCloseOrReopen() {
    startAttendanceTransition(async () => {
      const nextStatus = isClosed ? "OPEN" : "CLOSED";
      const result = await changeConversationStatus(conversation.id, nextStatus);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isClosed ? "Atendimento reaberto." : "Atendimento encerrado.");
      if (nextStatus === "CLOSED") {
        // Encerrada some da Central pra todo mundo — não faz sentido
        // continuar na tela dela; volta pra lista (mantendo a aba/filtro
        // ativo) como se nenhuma conversa tivesse sido selecionada.
        const qs = searchParams.toString();
        router.push(qs ? `/atendimento?${qs}` : "/atendimento");
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  // useMemo evita recalcular o agrupamento por dia a cada re-render deste
  // componente (ex: cada tecla digitada no textarea, já que `content` vive
  // no mesmo estado) — só recalcula quando a lista de mensagens muda de
  // verdade.
  const groupedMessages = useMemo(
    () =>
      messages.reduce<{ message: MessageItem; showDivider: boolean }[]>((acc, message) => {
        const key = dayKey(message.createdAt);
        const previousKey = acc.length > 0 ? dayKey(acc[acc.length - 1].message.createdAt) : null;
        acc.push({ message, showDivider: key !== previousKey });
        return acc;
      }, []),
    [messages]
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/atendimento" className="text-muted-foreground hover:text-foreground md:hidden">
            <ArrowLeft className="size-4" />
          </Link>
          {/* Foto do contato (mesma do painel lateral, já em cache do
              navegador) com o ponto de status da conversa — mesma cor do
              ponto da lista. */}
          <div className="relative shrink-0">
            <Avatar className="size-10">
              <AvatarImage
                src={`/api/atendimento/contact-photo/${conversation.contact.id}`}
                alt={`Foto de ${conversation.contact.name}`}
              />
              <AvatarFallback className="text-sm font-semibold">{getInitials(conversation.contact.name)}</AvatarFallback>
            </Avatar>
            <span
              title={displayStatus.label}
              className={cn(
                "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-card",
                getConversationStatusDot(conversation)
              )}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{conversation.contact.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {conversation.contact.company
                ? conversation.contact.company.tradeName || conversation.contact.company.legalName
                : "Sem empresa vinculada"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge
            label={displayStatus.label}
            tone={displayStatus.tone}
            className="hidden sm:inline-flex"
          />
          <PriorityBadge priority={conversation.priority} className="hidden sm:inline-flex" />
          {isUnassigned && !isClosed && (
            <Button size="xs" disabled={attendancePending} onClick={handleStartAttendance}>
              Iniciar atendimento
            </Button>
          )}
          {canJoin && (
            <Button
              size="xs"
              variant="outline"
              disabled={attendancePending}
              onClick={handleJoin}
              title={`${conversation.assignee?.name ?? "Outra pessoa"} está atendendo. Participe para responder junto.`}
            >
              <UserPlus className="size-3.5" />
              Participar
            </Button>
          )}
          {!isUnassigned && (
            <Button
              variant={isClosed ? "outline" : "destructive"}
              size="xs"
              disabled={attendancePending}
              onClick={handleCloseOrReopen}
              // Encerrar: vermelho cheio e em negrito, pra não passar batido.
              className={cn(
                !isClosed &&
                  "bg-red-600 font-bold text-white hover:bg-red-700 focus-visible:ring-red-600/40 dark:bg-red-600 dark:hover:bg-red-700"
              )}
            >
              {isClosed ? "Reabrir atendimento" : "Encerrar atendimento"}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" className="xl:hidden" onClick={() => setInfoOpen(true)}>
            <Info className="size-4" />
          </Button>
          <ConversationActionsMenu conversation={conversation} assignableUsers={assignableUsers} />
        </div>
      </div>

      <CultureStrip
        culture={getConversationCulture(conversation)}
        customerName={
          conversation.contact.company
            ? conversation.contact.company.tradeName || conversation.contact.company.legalName
            : conversation.contact.name
        }
      />

      <div ref={scrollRef} className="themed-scrollbar flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedMessages.map(({ message, showDivider }) => (
              <div key={message.id} className="flex flex-col gap-3">
                {showDivider && (
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      {dayKey(message.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  onReply={canReply ? handleReply : undefined}
                  mentionableNames={mentionableNames}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {isUnassigned && !isClosed && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          Ninguém está atendendo esta conversa ainda.
          <Button size="xs" disabled={attendancePending} onClick={handleStartAttendance}>
            Iniciar atendimento
          </Button>
        </div>
      )}

      {replyingTo && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/50 px-3 py-1.5">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <p className="text-xs font-medium text-primary">
              {replyingTo.direction === "OUTBOUND" ? replyingTo.senderUser?.name ?? "Você" : "Cliente"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {replyingTo.type !== "TEXT" ? MESSAGE_TYPE_LABELS[replyingTo.type] : replyingTo.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {isRecording && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-destructive/5 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-destructive">Gravando {formatRecordingTime(recordingSeconds)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={cancelRecording}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" size="xs" onClick={finishRecording}>
              <Square className="size-3" /> Parar
            </Button>
          </div>
        </div>
      )}

      {attachedFile && !isRecording && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/50 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {attachedFile.type.startsWith("audio/") ? (
              <audio src={attachedPreviewUrl ?? undefined} controls className="h-8 max-w-56" />
            ) : (
              <>
                {attachedPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attachedPreviewUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-xs text-muted-foreground">{attachedFile.name}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={clearAttachedFile}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-2.5 z-10 mb-1 flex max-h-64 w-64 flex-col overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            <span className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase">Mencionar</span>
            {mentionMatches.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // não tira o foco do textarea antes do onClick rodar
                onClick={() => selectMention(user)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  index === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{user.name}</span>
              </button>
            ))}
          </div>
        )}
        {quickReplyMatches.length > 0 && (
          <div className="absolute bottom-full left-2.5 z-10 mb-1 flex max-h-56 w-72 flex-col overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            {quickReplyMatches.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // não tira o foco do textarea antes do onClick rodar
                onClick={() => selectQuickReply(item)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left",
                  index === quickReplyIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <span className="text-xs font-medium text-primary">/{item.shortcut}</span>
                <span className="w-full truncate text-xs text-muted-foreground">{item.message}</span>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-2.5">
          <input
            ref={fileInputRef}
            type="file"
            // Qualquer arquivo que o WhatsApp aceita: foto/vídeo/áudio viram
            // mídia; o resto (PDF, Word, Excel, ZIP...) vai como documento.
            onChange={handleFileChange}
            className="hidden"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!canReply || isRecording || noteMode}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Anexar arquivo (foto, vídeo, áudio, PDF, Word, Excel...)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon-sm"
                  disabled={!canReply || !!attachedFile || noteMode}
                  onClick={isRecording ? finishRecording : startRecording}
                >
                  <Mic className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Gravar áudio</TooltipContent>
          </Tooltip>
          <EmojiPicker onSelect={insertEmoji} disabled={(!canReply && !noteMode) || isRecording} />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={noteMode}
                  disabled={isRecording || !!attachedFile}
                  onClick={() => {
                    setNoteMode((value) => !value);
                    setReplyingTo(null);
                    textareaRef.current?.focus();
                  }}
                  className={cn(noteMode && "bg-warning/15 text-warning hover:bg-warning/25 hover:text-warning")}
                >
                  <VenetianMask className="size-4" />
                </Button>
              }
            />
            <TooltipContent>
              {noteMode ? "Voltar a responder o cliente" : "Modo anônimo: nota interna, não vai para o cliente"}
            </TooltipContent>
          </Tooltip>
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart)}
            onKeyDown={handleTextareaKeyDown}
            onPaste={handlePaste}
            placeholder={
              noteMode
                ? "Nota interna — só a equipe vê, não vai para o cliente. Digite @ para mencionar alguém."
                : isClosed
                ? "Conversa encerrada — reabra para responder"
                : isUnassigned
                  ? "Inicie o atendimento para responder"
                  : 'Digite uma mensagem... ("/" para respostas rápidas)'
            }
            disabled={noteMode ? sending : !canReply || sending || isRecording}
            rows={1}
            className={cn(
              "max-h-32 min-h-8",
              noteMode && "border-warning/60 bg-warning/10 focus-visible:border-warning focus-visible:ring-warning/30"
            )}
          />
          <Button
            type="submit"
            size="icon-sm"
            title={noteMode ? "Salvar nota interna" : "Enviar"}
            disabled={
              noteMode
                ? sending || !content.trim()
                : !canReply || sending || isRecording || (!content.trim() && !attachedFile)
            }
            className={cn(noteMode && "bg-warning text-warning-foreground hover:bg-warning/90")}
          >
            {noteMode ? <Lock className="size-4" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-h-[85vh] w-full max-w-sm overflow-y-auto sm:max-w-md">
          <DialogTitle>Contexto do atendimento</DialogTitle>
          {contextPanel}
        </DialogContent>
      </Dialog>
    </div>
  );
}
