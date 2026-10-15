"use client";

import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Lock,
  Image,
  MapPin,
  Mic,
  Reply,
  Sticker,
  Video,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "cn";
import { formatDate, formatTime } from "@/lib/format";
import { MESSAGE_TYPE_LABELS } from "@/features/atendimento/labels";
import { resolveMediaUrl } from "@/features/atendimento/media-url";
import type { MessageItem } from "@/features/atendimento/types";

// Mídia sem download (documento sem preview possível, ou falha no download
// no whatsapp-service) ainda cai aqui — ícone + legenda em vez de bolha vazia.
const MEDIA_ICON = {
  IMAGE: Image,
  VIDEO: Video,
  AUDIO: Mic,
  DOCUMENT: FileText,
  STICKER: Sticker,
  LOCATION: MapPin,
} as const;

function StatusIcon({ status }: { status: MessageItem["status"] }) {
  switch (status) {
    case "PENDING":
      return <Clock className="size-3" />;
    case "SENT":
      return <Check className="size-3" />;
    case "DELIVERED":
      return <CheckCheck className="size-3" />;
    case "READ":
      return <CheckCheck className="size-3 text-primary" />;
    case "FAILED":
      return <AlertTriangle className="size-3 text-destructive" />;
    default:
      return null;
  }
}

// Citação da mensagem original, mostrada dentro da bolha da resposta.
function QuotedMessage({ replyTo, isOutbound }: { replyTo: NonNullable<MessageItem["replyTo"]>; isOutbound: boolean }) {
  const label = replyTo.type !== "TEXT" ? MESSAGE_TYPE_LABELS[replyTo.type] : replyTo.content;
  return (
    <div
      className={cn(
        "mb-1.5 truncate rounded-md border-l-2 px-2 py-1 text-xs",
        isOutbound
          ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/80"
          : "border-primary/40 bg-background/60 text-muted-foreground"
      )}
    >
      <span className="font-medium">
        {replyTo.direction === "OUTBOUND" ? replyTo.senderUser?.name ?? "Atendente" : "Cliente"}
      </span>
      <span className="block truncate">{label || "Mensagem"}</span>
    </div>
  );
}

// Zoom com a roda do mouse no pop-up da foto — precisa de um listener nativo
// (não o onWheel do React) porque o preventDefault de um wheel listener
// "passive" (padrão do React/navegador) é ignorado, e sem preventDefault a
// página rola por trás do pop-up em vez de dar zoom.
//
// O bug do zoom "preso num quadrado pequeno": o container antigo tinha
// max-h/max-w (só um teto) sem tamanho mínimo — pra uma foto pequena, a
// caixa nascia do tamanho da própria imagem, e transform:scale só afeta o
// desenho (não o layout), então o overflow-hidden cortava tudo que passasse
// da caixa original e pequena. Aqui o container ocupa sempre o pop-up
// inteiro (h-full/w-full, o próprio DialogContent já é quase tela cheia) —
// a imagem tem espaço de verdade pra crescer, e overflow-auto permite rolar
// pra ver o resto quando o zoom passa do que cabe na tela.
function ZoomableImage({ src }: { src: string }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.0015 * s)));
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div ref={containerRef} className="flex h-[88vh] w-[92vw] items-center justify-center overflow-auto">
      <img
        src={src}
        alt="Imagem recebida"
        draggable={false}
        style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        className="max-h-full max-w-full shrink-0 rounded-md object-contain transition-transform duration-75 select-none"
      />
    </div>
  );
}

function MediaContent({ message }: { message: MessageItem }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  // Link da Neonize passa pelo CRM (/api/atendimento/media/...) — ver media-url.ts.
  const src = resolveMediaUrl(message.mediaUrl);
  if (!src) return null;

  // Arquivo apagado em Configurações > Limpeza — a mensagem fica no histórico.
  if (message.mediaDeletedAt) {
    return (
      <span className="text-xs italic opacity-70">
        Arquivo ({MESSAGE_TYPE_LABELS[message.type].toLowerCase()}) removido na limpeza de mídias em{" "}
        {formatDate(message.mediaDeletedAt)}
      </span>
    );
  }

  // Arquivo não carregou (apagado, serviço fora do ar…): avisa e oferece o link.
  if (broken) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs italic underline opacity-80">
        {MESSAGE_TYPE_LABELS[message.type]} indisponível — tentar abrir o arquivo
      </a>
    );
  }

  if (message.type === "IMAGE") {
    return (
      <>
        <button type="button" onClick={() => setPopupOpen(true)} className="block overflow-hidden rounded-md">
          {/* Mídia vem de um serviço local (whatsapp-service) — next/image exigiria
              configurar domínio remoto pra um host que muda por ambiente; <img> direto evita isso. */}
          <img src={src} alt="Imagem recebida" className="max-h-64 w-full object-cover" onError={() => setBroken(true)} />
        </button>
        <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
          {/* O DialogContent padrão embute "sm:max-w-sm" — sobrescrever só
              "max-w-none" (sem o prefixo sm:) não cancela essa variante em
              telas >=640px, então a caixa ficava presa em 384px enquanto a
              imagem (que tem largura própria) transbordava pra fora dela.
              Precisa repetir o override com o prefixo sm: também. */}
          <DialogContent className="w-fit max-w-none p-2 sm:max-w-none">
            <DialogTitle className="sr-only">Imagem</DialogTitle>
            {/* Montar/desmontar junto com popupOpen (em vez de sempre presente
                + um efeito resetando o zoom) garante que reabrir a imagem
                sempre comece em 1x, sem precisar de setState dentro de effect. */}
            {popupOpen && <ZoomableImage src={src} />}
            <p className="text-center text-[11px] text-muted-foreground">Role a roda do mouse para dar zoom</p>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (message.type === "VIDEO") {
    return (
      <>
        <button type="button" onClick={() => setPopupOpen(true)} className="block overflow-hidden rounded-md">
          <video src={src} className="max-h-64 w-full" muted preload="metadata" onError={() => setBroken(true)} />
        </button>
        <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
          <DialogContent className="w-fit max-w-[90vw] p-2 sm:max-w-[90vw]">
            <DialogTitle className="sr-only">Vídeo</DialogTitle>
            <video src={src} controls autoPlay className="max-h-[80vh] max-w-full rounded-md" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (message.type === "STICKER") {
    // Figurinha: webp pequeno, geralmente com fundo transparente — sem o
    // crop/object-cover das fotos normais, e sem popup de zoom (não faz
    // sentido pra um sticker).
    return <img src={src} alt="Figurinha" className="h-32 w-32 object-contain" onError={() => setBroken(true)} />;
  }

  if (message.type === "AUDIO") {
    return <audio src={src} controls preload="metadata" className="h-9 max-w-56" onError={() => setBroken(true)} />;
  }

  if (message.type === "DOCUMENT") {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md bg-background/20 px-2 py-1.5 text-xs font-medium underline-offset-2 hover:underline"
      >
        <FileText className="size-4 shrink-0" />
        Abrir documento
      </a>
    );
  }

  return null;
}

// Bolha de mensagem (seção 11): inbound/outbound visualmente diferentes,
// citação (responder) e mídia real quando disponível. `memo` evita
// re-renderizar cada bolha já existente a cada poll/keystroke do painel —
// Destaca "@Nome" (de quem pode ser mencionado) dentro da nota interna.
function NoteContent({ content, names }: { content: string; names: string[] }) {
  if (names.length === 0 || !content.includes("@")) return <>{content}</>;
  const escaped = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = content.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="rounded bg-warning/20 px-0.5 font-semibold text-warning">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

// Texto com links clicáveis (ex.: localização → Google Maps, sites).
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function LinkifiedText({ text }: { text: string }) {
  if (!text.includes("http")) return <>{text}</>;
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 break-all"
          >
            {part.includes("maps.google.com") ? "📍 Abrir no mapa" : part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}

// só a mensagem que realmente mudou (ex: status PENDING -> SENT) refaz.
export const MessageBubble = memo(function MessageBubble({
  message,
  onReply,
  mentionableNames,
}: {
  message: MessageItem;
  onReply?: (message: MessageItem) => void;
  // Nomes que viram destaque "@Nome" nas notas internas.
  mentionableNames?: string[];
}) {
  const isOutbound = message.direction === "OUTBOUND";

  // Nota interna ("modo anônimo"): só a equipe vê — destaque próprio, sem
  // "Responder" (nunca pode ser citada numa mensagem ao cliente).
  if (message.internal) {
    return (
      <div className="flex justify-end">
        <div className="flex min-w-0 max-w-[75%] flex-col items-end gap-0.5">
          <div className="min-w-0 rounded-xl rounded-br-sm border border-dashed border-warning/60 bg-warning/10 px-3 py-2 text-sm whitespace-pre-wrap break-words text-foreground">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warning">
              <Lock className="size-3" />
              Nota interna · só a equipe vê
            </span>
            <NoteContent content={message.content} names={mentionableNames ?? []} />
          </div>
          <span className="px-1 text-[11px] text-muted-foreground">
            {message.senderUser ? `${message.senderUser.name} · ` : ""}
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  const MediaIcon = message.type !== "TEXT" ? MEDIA_ICON[message.type as keyof typeof MEDIA_ICON] : null;
  const hasRenderableMedia = message.mediaUrl && message.type !== "LOCATION" && message.type !== "SYSTEM";

  return (
    <div className={cn("group flex items-end gap-1", isOutbound ? "flex-row-reverse" : "flex-row")}>
      {onReply && (
        <button
          type="button"
          onClick={() => onReply(message)}
          className="mb-1 shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          title="Responder"
        >
          <Reply className="size-3.5" />
        </button>
      )}
      {/* max-w-[75%] fica aqui (não na bolha lá dentro) de propósito: essa
          div é item direto da linha (que tem largura definida, esticada
          pelo flex-col da lista de mensagens) — % de largura calculado
          contra um item que também está encolhendo (como a bolha estava
          antes) é ambíguo, e foi isso que fez o texto quebrar a cada
          palavra depois do ajuste anterior pra mensagem grande não estourar
          a tela. Com o teto aqui em cima, a bolha só precisa preencher a
          própria largura (sem % nenhum) e quebrar linha normalmente. */}
      <div className={cn("flex min-w-0 max-w-[75%] flex-col gap-0.5", isOutbound ? "items-end" : "items-start")}>
        <div
          className={cn(
            "min-w-0 rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
            isOutbound
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground"
          )}
        >
          {message.replyTo && <QuotedMessage replyTo={message.replyTo} isOutbound={isOutbound} />}

          {MediaIcon && !hasRenderableMedia && (
            <span
              className={cn(
                "mb-1 flex items-center gap-1.5 text-xs font-medium",
                isOutbound ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              <MediaIcon className="size-3.5" />
              {MESSAGE_TYPE_LABELS[message.type]}
            </span>
          )}

          {hasRenderableMedia && (
            <div className={cn(message.content && "mb-1.5")}>
              <MediaContent message={message} />
            </div>
          )}

          {message.content ? (
            <LinkifiedText text={message.content} />
          ) : MediaIcon && !hasRenderableMedia ? (
            // Mídia sem arquivo (download falhou no serviço).
            <span className="italic opacity-70">Não foi possível baixar — veja no WhatsApp do celular</span>
          ) : !hasRenderableMedia ? (
            <span className="italic opacity-70">Mensagem sem conteúdo para mostrar — veja no WhatsApp do celular</span>
          ) : null}
        </div>
        <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          {isOutbound && message.senderUser && <span>{message.senderUser.name} ·</span>}
          {formatTime(message.createdAt)}
          {isOutbound && <StatusIcon status={message.status} />}
        </span>
      </div>
    </div>
  );
});
