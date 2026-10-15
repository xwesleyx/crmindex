"""
Ponte HTTP entre o WhatsApp real (Neonize/whatsmeow) e a Central de
Atendimento do CRM (Next.js). Este processo:

  - mantém a sessão do WhatsApp Web viva (QR code só é necessário 1x;
    depois fica salvo em disco, nesta mesma pasta);
  - repassa toda mensagem recebida pro webhook do Next.js
    (POST /api/webhooks/whatsapp);
  - expõe /send pro Next.js mandar mensagem pra fora, e /status + /qr
    pra tela de Integrações mostrar o estado da conexão.

Não tem nenhuma lógica de CRM aqui (fila, cliente, oportunidade, etc.) —
isso é tudo do lado do Next.js. Este serviço só fala WhatsApp.
"""

import asyncio
import base64
import io
import logging
import mimetypes
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
import segno
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from neonize.aioze.client import NewAClient
from neonize.events import ConnectedEv, DisconnectedEv, LoggedOutEv, MessageEv, PairStatusEv
from neonize.proto.Neonize_pb2 import Message as NeonizeMessageEv, MessageInfo, MessageSource
from neonize.proto.waE2E.WAWebProtobufsE2E_pb2 import Message as WAE2EMessage
from neonize.utils import build_jid, extract_text
from neonize.utils.enum import ReceiptType
from neonize.utils.jid import jid_is_lid

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("whatsapp-service")

NEXTJS_WEBHOOK_URL = os.environ.get("NEXTJS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/whatsapp")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
SESSION_NAME = os.environ.get("SESSION_NAME", "integra-crm.db")
# URL pela qual o Next.js (e o navegador, ao renderizar <img>/<video>/<audio>)
# enxerga este serviço — o CRM só guarda essa URL completa, nunca baixa o
# arquivo pra dentro do banco.
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:8787")
# Em produção (Render), aponte MEDIA_DIR pra dentro do disco persistente
# (ex.: "/data/media") — sem isso, a mídia some a cada novo deploy.
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR") or (Path(__file__).parent / "media"))
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

if not WEBHOOK_SECRET:
    log.warning(
        "WEBHOOK_SECRET não definido — configure o mesmo valor aqui e em "
        "WHATSAPP_SERVICE_SECRET no .env do Next.js antes de usar em produção."
    )

# Estado da conexão, em memória — consultado por /status e /qr (seção
# "Integrações" do CRM). Nada disso precisa sobreviver a um restart: se o
# processo cair, a sessão do WhatsApp (arquivo em disco) continua válida e
# reconecta sozinha; só o "qr_png_base64" alguém teria que buscar de novo se
# ainda não tivesse pareado.
state = {
    "connected": False,
    "number": None,
    "qr_png_base64": None,
    # True depois de um logout (pelo CRM ou pelo celular): nesse estado não
    # vem QR sozinho, alguém precisa pedir "Gerar QR novamente". Sem isso, o
    # CRM não diferencia "deslogado" de "ainda conectando".
    "logged_out": False,
}

client = NewAClient(SESSION_NAME)

# Vigia da conexão: client.connect() só agenda a conexão numa task em
# segundo plano — se a rede falhar ao abrir o websocket do WhatsApp (ou a
# tentativa ficar pendurada, o que no Windows leva ~90s pra estourar), nada
# tenta de novo e o serviço fica "conectando" pra sempre. O vigia refaz a
# tentativa quando passa CONNECT_STALL_SECONDS sem conectar, sem QR na tela
# e sem logout.
CONNECT_STALL_SECONDS = 25
last_connect_attempt = {"at": 0.0}


def _on_connect_task_done(task: asyncio.Task) -> None:
    if task.cancelled():
        return
    error = task.exception()
    if error:
        log.warning("Falha ao conectar ao WhatsApp (o vigia tenta de novo): %s", error)


async def start_connection() -> None:
    last_connect_attempt["at"] = time.monotonic()
    task = await client.connect()
    if isinstance(task, asyncio.Task):
        task.add_done_callback(_on_connect_task_done)


async def connection_watchdog() -> None:
    while True:
        await asyncio.sleep(5)
        if state["connected"] or state["qr_png_base64"] or state["logged_out"]:
            continue
        if time.monotonic() - last_connect_attempt["at"] < CONNECT_STALL_SECONDS:
            continue
        log.warning("Sem conexão com o WhatsApp há %ss; tentando de novo.", CONNECT_STALL_SECONDS)
        try:
            await client.disconnect()
        except Exception:
            pass
        try:
            await start_connection()
        except Exception:
            log.exception("Nova tentativa de conexão falhou")
            last_connect_attempt["at"] = time.monotonic()


def require_secret(authorization: Optional[str]) -> None:
    expected = f"Bearer {WEBHOOK_SECRET}"
    if not WEBHOOK_SECRET or authorization != expected:
        raise HTTPException(status_code=401, detail="Segredo inválido ou ausente.")


async def resolve_jid(phone: str):
    # build_jid(phone) sozinho monta sempre "@s.whatsapp.net" — o WhatsApp vem
    # migrando parte dos contatos pra endereçamento "@lid" (privacidade), e
    # mandar pro JID errado "funciona" (a API não erra) mas a mensagem nunca
    # chega no aparelho de verdade. is_on_whatsapp devolve o JID correto (PN
    # ou LID) pra esse número; só cai pro build_jid manual se a checagem
    # falhar por algum motivo.
    jid = build_jid(phone)
    try:
        results = await client.is_on_whatsapp(phone)
        if results and results[0].IsIn and results[0].JID:
            return results[0].JID
    except Exception:
        log.warning("is_on_whatsapp falhou pra %s, usando JID construído manualmente", phone)
    return jid


def build_quoted(stanza_id: str, sender_jid: str, text: str) -> NeonizeMessageEv:
    # Pra o WhatsApp do cliente mostrar "respondendo a: ..." de verdade (não
    # só uma citação visual dentro do CRM), precisa de um objeto no mesmo
    # formato de um evento de mensagem recebida — stanzaID (ID da mensagem
    # original), participant (quem mandou ela) e o conteúdo citado. Não
    # precisa ser byte-a-byte igual à mensagem original: o WhatsApp usa
    # stanzaID+participant pra linkar a resposta, e quotedMessage só pro
    # preview — um texto simples aqui já é suficiente mesmo citando mídia.
    user, _, server = sender_jid.partition("@")
    server = server or "s.whatsapp.net"
    return NeonizeMessageEv(
        Info=MessageInfo(ID=stanza_id, MessageSource=MessageSource(Sender=build_jid(user, server))),
        Message=WAE2EMessage(conversation=text or ""),
    )


# ---------------------------------------------------------------------------
# Eventos do WhatsApp
# ---------------------------------------------------------------------------


@client.qr
async def on_qr(_client: NewAClient, data_qr: bytes) -> None:
    # NewAClient (cliente async) exige handler async — o dispatcher interno
    # do neonize faz run_coroutine_threadsafe(handler(...), loop), e isso só
    # funciona se handler(...) devolver uma coroutine (ou seja, "async def").
    # Um handler síncrono "funciona por acidente" (o corpo roda na hora de
    # chamar) mas gera uma exceção engolida a cada evento — por isso todos
    # os handlers abaixo são async, mesmo sem nenhum await de verdade.
    qr_text = data_qr.decode()
    buf = io.BytesIO()
    segno.make_qr(qr_text).save(buf, kind="png", scale=8)
    state["qr_png_base64"] = base64.b64encode(buf.getvalue()).decode()
    state["connected"] = False
    state["logged_out"] = False
    log.info("Novo QR code gerado — abra Configurações > Integrações no CRM para escanear.")


@client.event(ConnectedEv)
async def on_connected(_client: NewAClient, _ev: ConnectedEv) -> None:
    state["connected"] = True
    state["qr_png_base64"] = None
    state["logged_out"] = False
    log.info("Conectado ao WhatsApp.")


@client.event(PairStatusEv)
async def on_pair_status(_client: NewAClient, ev: PairStatusEv) -> None:
    state["connected"] = True
    state["qr_png_base64"] = None
    state["number"] = ev.ID.User if ev.ID else None
    log.info("Pareado com o número %s", state["number"])


@client.event(DisconnectedEv)
async def on_disconnected(_client: NewAClient, _ev: DisconnectedEv) -> None:
    state["connected"] = False
    # A lib reconecta sozinha após uma queda; o vigia só entra se isso não
    # acontecer em CONNECT_STALL_SECONDS.
    last_connect_attempt["at"] = time.monotonic()
    log.warning("Desconectado do WhatsApp.")


@client.event(LoggedOutEv)
async def on_logged_out(_client: NewAClient, _ev: LoggedOutEv) -> None:
    state["connected"] = False
    state["number"] = None
    state["qr_png_base64"] = None
    state["logged_out"] = True
    log.warning("Sessão encerrada (logout) — será necessário escanear o QR novamente.")


# Embrulhos que só carregam outra mensagem dentro (mensagem temporária,
# visualização única, documento com legenda...) — abre e classifica o miolo.
MESSAGE_WRAPPERS = (
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "associatedChildMessage",
)

# Controles internos do WhatsApp (sincronização, chaves, votos de enquete…):
# não são algo que o cliente "mandou" — não viram balão no CRM.
IGNORED_FIELDS = {
    "senderKeyDistributionMessage",
    "messageContextInfo",
    "keepInChatMessage",
    "pollUpdateMessage",
    "encReactionMessage",
    "albumMessage",
}


def unwrap_message(message):
    for _ in range(5):
        for field, value in message.ListFields():
            if field.name in MESSAGE_WRAPPERS and value.HasField("message"):
                message = value.message
                break
        else:
            return message
    return message


def _vcard_phone(vcard: str) -> str:
    for line in (vcard or "").splitlines():
        if line.upper().startswith("TEL"):
            return line.split(":", 1)[-1].strip()
    return ""


def classify_message(message):
    """(type, text, mimetype) a partir do protobuf Message do whatsmeow, ou
    None quando é um controle interno que não deve virar mensagem no CRM.
    `text` é o conteúdo que aparece no balão (legenda, texto, descrição)."""
    message = unwrap_message(message)
    fields = [(field.name, value) for field, value in message.ListFields()]

    for name, value in fields:
        if name in ("conversation", "extendedTextMessage"):
            return "TEXT", extract_text(message) or "", None
        if name == "imageMessage":
            return "IMAGE", getattr(value, "caption", ""), getattr(value, "mimetype", None)
        if name in ("videoMessage", "ptvMessage"):
            return "VIDEO", getattr(value, "caption", ""), getattr(value, "mimetype", None)
        if name == "audioMessage":
            return "AUDIO", "", getattr(value, "mimetype", None)
        if name == "documentMessage":
            return (
                "DOCUMENT",
                getattr(value, "caption", "") or getattr(value, "fileName", ""),
                getattr(value, "mimetype", None),
            )
        if name in ("stickerMessage", "lottieStickerMessage"):
            return "STICKER", "", getattr(value, "mimetype", None) or "image/webp"
        if name in ("locationMessage", "liveLocationMessage"):
            lat, lng = value.degreesLatitude, value.degreesLongitude
            label = " — ".join(part for part in (getattr(value, "name", ""), getattr(value, "address", "")) if part)
            maps = f"https://maps.google.com/?q={lat},{lng}"
            return "LOCATION", f"{label}\n{maps}" if label else maps, None
        if name == "contactMessage":
            phone = _vcard_phone(value.vcard)
            return "TEXT", f"📇 Contato: {value.displayName}" + (f"\n{phone}" if phone else ""), None
        if name == "contactsArrayMessage":
            lines = [f"📇 {c.displayName}" + (f" — {_vcard_phone(c.vcard)}" if _vcard_phone(c.vcard) else "") for c in value.contacts]
            return "TEXT", "Contatos compartilhados:\n" + "\n".join(lines), None
        if name in ("pollCreationMessage", "pollCreationMessageV2", "pollCreationMessageV3"):
            options = "\n".join(f"• {o.optionName}" for o in value.options)
            return "TEXT", f"📊 Enquete: {value.name}\n{options}", None
        if name in ("buttonsResponseMessage", "templateButtonReplyMessage"):
            return "TEXT", getattr(value, "selectedDisplayText", "") or "Respondeu a um botão", None
        if name == "listResponseMessage":
            return "TEXT", getattr(value, "title", "") or "Escolheu uma opção da lista", None
        if name == "interactiveResponseMessage":
            body = getattr(value, "body", None)
            return "TEXT", (getattr(body, "text", "") if body else "") or "Respondeu a uma mensagem interativa", None
        if name == "reactionMessage":
            if not value.text:
                return None  # reação removida
            return "SYSTEM", f"Reagiu com {value.text} a uma mensagem", None
        if name == "groupInviteMessage":
            return "TEXT", f"Convite para o grupo {getattr(value, 'groupName', '')}".strip(), None
        if name == "eventMessage":
            return "TEXT", f"📅 Evento: {getattr(value, 'name', '')}".strip(), None
        if name == "protocolMessage":
            if value.type == value.REVOKE:
                return "SYSTEM", "🗑️ O cliente apagou uma mensagem", None
            if value.HasField("editedMessage"):
                edited = extract_text(value.editedMessage) or ""
                return "TEXT", f"✏️ Mensagem editada: {edited}" if edited else "✏️ O cliente editou uma mensagem", None
            return None

    names = [name for name, _ in fields if name not in IGNORED_FIELDS]
    if not names:
        return None
    log.info("Tipo de mensagem não suportado: %s", ", ".join(names))
    return "SYSTEM", f"Mensagem não suportada pelo CRM ({names[0]}) — veja no WhatsApp do celular.", None


# Baixa o conteúdo binário (foto/vídeo/áudio/documento) e salva localmente —
# devolve a URL pública (servida em /media) pro Next.js só guardar o link.
async def download_media(message, mimetype: Optional[str]) -> Optional[str]:
    try:
        data = await client.download_any(message)
    except Exception:
        log.exception("Falha ao baixar mídia da mensagem")
        return None
    if not data:
        return None

    clean_mime = (mimetype or "").split(";")[0].strip()
    # mimetypes do Windows nem sempre conhece webp/opus — sem extensão o
    # navegador não sabe o que é o arquivo.
    ext = {"image/webp": ".webp", "audio/ogg": ".ogg", "audio/opus": ".ogg"}.get(clean_mime) or (
        mimetypes.guess_extension(clean_mime) or ""
    )
    filename = f"{uuid.uuid4().hex}{ext}"
    (MEDIA_DIR / filename).write_bytes(data)
    return f"{PUBLIC_URL}/media/{filename}"


# O WhatsApp vem migrando contatos pro endereçamento "@lid" (privacidade) —
# quando isso acontece, Sender.User é um LID (um número artificial tipo
# "132212666151012", não o telefone de verdade), e SenderAlt.User é quem
# normalmente carrega o telefone real. Usar o LID como telefone quebra tudo:
# dedupe de contato (cria um contato "novo" pra alguém que já conversava),
# busca por telefone, e o envio de resposta. SenderAlt nem sempre vem
# preenchido (casos observados com mensagens de resposta/citação) — quando
# isso acontece, resolve o LID pro telefone de verdade via get_pn_from_lid
# (consulta o store local do whatsmeow) em vez de aceitar o LID como se
# fosse um telefone.
async def resolve_sender_phone(source) -> str:
    if source.SenderAlt.User:
        return source.SenderAlt.User
    if jid_is_lid(source.Sender):
        try:
            pn_jid = await client.get_pn_from_lid(source.Sender)
            if pn_jid and pn_jid.User:
                return pn_jid.User
        except Exception:
            log.warning(
                "get_pn_from_lid falhou pro LID %s — usando o LID como identificador, "
                "pode criar um contato duplicado.",
                source.Sender.User,
            )
    return source.Sender.User


# Chat/remetente exatos (podem ser "@lid") de cada mensagem recebida, pra
# /mark-read mandar o "lido" (tique azul) pro JID certo quando o atendente
# abrir/responder a conversa no CRM. Só em memória e limitado — se o
# processo reiniciar, /mark-read cai no JID montado a partir do telefone.
READ_TARGETS_MAX = 5000
read_targets: dict = {}


@client.event(MessageEv)
async def on_message(_client: NewAClient, ev: MessageEv) -> None:
    if ev.Info.MessageSource.IsFromMe or ev.Info.MessageSource.IsGroup:
        # Mensagem enviada por nós mesmos (eco) ou de grupo — a Central de
        # Atendimento é 1:1 por contato, grupos ficam fora do escopo.
        return

    read_targets[ev.Info.ID] = (ev.Info.MessageSource.Chat, ev.Info.MessageSource.Sender)
    while len(read_targets) > READ_TARGETS_MAX:
        read_targets.pop(next(iter(read_targets)))

    classified = classify_message(ev.Message)
    if classified is None:
        return  # controle interno do WhatsApp — nada pra mostrar no CRM
    msg_type, content, mimetype = classified

    media_url = None
    if msg_type in ("IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"):
        # Baixa do miolo (mensagem temporária/visualização única vêm embrulhadas).
        media_url = await download_media(unwrap_message(ev.Message), mimetype)

    source = ev.Info.MessageSource
    from_phone = await resolve_sender_phone(source)

    payload = {
        "fromPhone": from_phone,
        "fromName": ev.Info.Pushname or None,
        "content": content,
        "type": msg_type,
        "mediaUrl": media_url,
        "channelIdentifier": state.get("number"),
        "providerMessageId": ev.Info.ID,
    }

    await forward_to_webhook(payload)


async def forward_to_webhook(payload: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                NEXTJS_WEBHOOK_URL,
                json=payload,
                headers={"Authorization": f"Bearer {WEBHOOK_SECRET}"},
            )
            if resp.status_code >= 400:
                log.error("Webhook do Next.js respondeu %s: %s", resp.status_code, resp.text)
    except Exception:
        log.exception("Falha ao repassar mensagem pro webhook do Next.js")


# ---------------------------------------------------------------------------
# HTTP API consumida pelo Next.js
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await start_connection()
    log.info("Cliente Neonize iniciado (aguardando QR ou sessão salva).")
    watchdog = asyncio.create_task(connection_watchdog())
    yield
    watchdog.cancel()
    await client.disconnect()


app = FastAPI(title="Integra CRM — WhatsApp bridge", lifespan=lifespan)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


@app.get("/health")
def health():
    return {"ok": True}


# Foto de perfil do contato (painel do Atendimento no CRM). Cache em
# memória de 6h por número: a URL do WhatsApp vale por bastante tempo, e
# consultar a cada abertura de conversa seria pedido demais pro WhatsApp
# (risco de limite/bloqueio). Sem foto ou com foto privada -> url None.
PROFILE_PICTURE_TTL_SECONDS = 6 * 60 * 60
profile_picture_cache: dict[str, tuple[float, Optional[str]]] = {}


@app.get("/profile-picture")
async def profile_picture(phone: str, authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        raise HTTPException(status_code=400, detail="Telefone inválido.")

    cached = profile_picture_cache.get(digits)
    if cached and time.monotonic() - cached[0] < PROFILE_PICTURE_TTL_SECONDS:
        return {"url": cached[1]}

    if not state["connected"]:
        return {"url": None}

    url: Optional[str] = None
    try:
        jid = await resolve_jid(digits)
        picture = await client.get_profile_picture(jid)
        url = picture.URL or None
    except Exception as error:  # sem foto, foto privada, número fora do WhatsApp...
        log.info("Sem foto de perfil para %s: %s", digits, error)

    profile_picture_cache[digits] = (time.monotonic(), url)
    return {"url": url}


class MarkReadRequest(BaseModel):
    to: str
    messageIds: list[str]


@app.post("/mark-read")
async def mark_read(body: MarkReadRequest, authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    if not state["connected"]:
        raise HTTPException(status_code=503, detail="WhatsApp não conectado.")
    if not body.messageIds:
        return {"ok": True}

    # Agrupa por (chat, remetente) — o recibo de leitura vai por conversa.
    groups: dict = {}
    fallback_ids = []
    for message_id in body.messageIds:
        target = read_targets.get(message_id)
        if target:
            key = (target[0].SerializeToString(), target[1].SerializeToString())
            groups.setdefault(key, (target[0], target[1], []))[2].append(message_id)
        else:
            fallback_ids.append(message_id)

    try:
        for chat, sender, ids in groups.values():
            await client.mark_read(*ids, chat=chat, sender=sender, receipt=ReceiptType.READ)
        if fallback_ids:
            jid = await resolve_jid(body.to)
            await client.mark_read(*fallback_ids, chat=jid, sender=jid, receipt=ReceiptType.READ)
    except Exception as error:
        log.warning("Falha ao marcar como lida (%s): %s", body.to, error)
        raise HTTPException(status_code=500, detail=str(error))

    for message_id in body.messageIds:
        read_targets.pop(message_id, None)
    return {"ok": True}


@app.get("/status")
def status(authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    # client.me é preenchido pela própria lib assim que conecta (mesmo numa
    # reconexão com sessão salva, quando PairStatusEv não dispara de novo) —
    # usado como respaldo pra state["number"], que só é setado no pareamento.
    number = state["number"]
    if not number and client.me and client.me.JID:
        number = client.me.JID.User
    return {
        "connected": state["connected"],
        "number": number,
        "qrPending": state["qr_png_base64"] is not None,
        "loggedOut": state["logged_out"],
    }


@app.get("/qr")
def qr(authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    if state["connected"] or not state["qr_png_base64"]:
        return {"available": False}
    return {"available": True, "qr": f"data:image/png;base64,{state['qr_png_base64']}"}


@app.post("/logout")
async def logout_route(authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    try:
        await client.logout()
    except Exception:
        log.exception("Falha ao executar logout do WhatsApp")

    state["connected"] = False
    state["number"] = None
    state["qr_png_base64"] = None
    state["logged_out"] = True
    return {"status": "LOGGED_OUT"}


@app.post("/reconnect")
async def reconnect_route(authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    try:
        await client.disconnect()
    except Exception:
        log.warning("disconnect() falhou durante reconnect; seguindo mesmo assim.")

    state["connected"] = False
    state["number"] = None
    state["qr_png_base64"] = None
    state["logged_out"] = False

    try:
        await start_connection()
        return {"status": "RECONNECTING"}
    except Exception as error:
        log.exception("Falha ao reconectar o WhatsApp")
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/shutdown")
async def shutdown_route(authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    try:
        await client.disconnect()
    except Exception:
        log.warning("disconnect() falhou durante shutdown; seguindo mesmo assim.")

    log.warning("Shutdown solicitado pelo CRM; encerrando processo do whatsapp-service.")
    # call_later (e não call_soon) dá tempo de a resposta HTTP chegar ao CRM
    # antes do processo sumir.
    loop = asyncio.get_running_loop()
    loop.call_later(0.5, os._exit, 0)
    return {"status": "SHUTTING_DOWN"}


class SendMessageRequest(BaseModel):
    to: str
    text: str
    # Preenchidos quando o Next.js está respondendo a uma mensagem específica
    # (seção "Responder" do chat) — os três juntos permitem montar um quote
    # de verdade (build_quoted), sem precisar do objeto de evento original.
    quotedProviderMessageId: Optional[str] = None
    quotedParticipant: Optional[str] = None
    quotedText: Optional[str] = None


@app.post("/send")
async def send(body: SendMessageRequest, authorization: Optional[str] = Header(default=None)):
    require_secret(authorization)
    if not state["connected"]:
        return JSONResponse(
            status_code=409,
            content={"status": "FAILED", "error": "WhatsApp não está conectado. Escaneie o QR em Integrações."},
        )
    try:
        jid = await resolve_jid(body.to)

        if body.quotedProviderMessageId and body.quotedParticipant:
            quoted = build_quoted(body.quotedProviderMessageId, body.quotedParticipant, body.quotedText or "")
            response = await client.reply_message(body.text, quoted, to=jid)
        else:
            response = await client.send_message(jid, body.text)

        return {"status": "SENT", "providerMessageId": response.ID}
    except Exception as error:
        log.exception("Falha ao enviar mensagem")
        return JSONResponse(status_code=502, content={"status": "FAILED", "error": str(error)})


@app.post("/send-media")
async def send_media(
    to: str = Form(...),
    type: str = Form(...),  # IMAGE | VIDEO | AUDIO | DOCUMENT
    caption: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    quotedProviderMessageId: Optional[str] = Form(None),
    quotedParticipant: Optional[str] = Form(None),
    quotedText: Optional[str] = Form(None),
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    require_secret(authorization)
    if not state["connected"]:
        return JSONResponse(
            status_code=409,
            content={"status": "FAILED", "error": "WhatsApp não está conectado. Escaneie o QR em Integrações."},
        )

    data = await file.read()

    # Guarda uma cópia local própria (mesma pasta que já serve mídia
    # recebida) — a bolha da mensagem no CRM usa essa URL, não depende do CDN
    # do WhatsApp nem de o whatsapp-service continuar de pé depois.
    ext = Path(filename or file.filename or "").suffix or (mimetypes.guess_extension(file.content_type or "") or "")
    saved_name = f"{uuid.uuid4().hex}{ext}"
    (MEDIA_DIR / saved_name).write_bytes(data)
    media_url = f"{PUBLIC_URL}/media/{saved_name}"

    try:
        jid = await resolve_jid(to)
        quoted = (
            build_quoted(quotedProviderMessageId, quotedParticipant, quotedText or "")
            if quotedProviderMessageId and quotedParticipant
            else None
        )

        if type == "IMAGE":
            response = await client.send_image(jid, data, caption=caption or None, quoted=quoted)
        elif type == "VIDEO":
            response = await client.send_video(jid, data, caption=caption or None, quoted=quoted)
        elif type == "AUDIO":
            # ptt=True faz o WhatsApp do cliente mostrar como mensagem de voz
            # (bolha com forma de onda), não como anexo de áudio genérico —
            # é sempre gravação pelo microfone do atendente, nunca um arquivo.
            response = await client.send_audio(jid, data, ptt=True, quoted=quoted)
        elif type == "DOCUMENT":
            response = await client.send_document(
                jid, data, caption=caption or None, filename=filename or file.filename, quoted=quoted
            )
        else:
            return JSONResponse(status_code=400, content={"status": "FAILED", "error": "Tipo de mídia inválido."})

        return {"status": "SENT", "providerMessageId": response.ID, "mediaUrl": media_url}
    except Exception as error:
        log.exception("Falha ao enviar mídia")
        return JSONResponse(
            status_code=502, content={"status": "FAILED", "error": str(error), "mediaUrl": media_url}
        )
