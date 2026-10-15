# WhatsApp bridge (Neonize)

Serviço Python separado que mantém a conexão real com o WhatsApp (via
[Neonize](https://github.com/krypton-byte/neonize), que usa o mesmo protocolo
do WhatsApp Web) e repassa mensagens de/para a Central de Atendimento do CRM.
Não tem nenhuma lógica de CRM aqui — só fala WhatsApp e conversa por HTTP com
o Next.js.

## Como rodar

```bash
cd whatsapp-service
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edite o `.env`:
- `WEBHOOK_SECRET`: gere um valor aleatório (`openssl rand -hex 32`) e coloque
  o **mesmo valor** em `WHATSAPP_SERVICE_SECRET` no `.env` da raiz do projeto
  (Next.js).
- `NEXTJS_WEBHOOK_URL`: normalmente não precisa mudar em desenvolvimento
  (`http://localhost:3000/api/webhooks/whatsapp`).
- `PUBLIC_URL`: opcional. As mídias (foto, vídeo, áudio, figurinha,
  documento) chegam ao navegador **pelo próprio CRM**
  (`/api/atendimento/media/...`, que busca o arquivo aqui por
  `WHATSAPP_SERVICE_URL`), então funcionam em qualquer computador da rede e
  não dependem do IP desta máquina — o serviço pode escutar só em
  `localhost`.

Depois:

```bash
uvicorn main:app --port 8787
```

## Parear o WhatsApp (só precisa fazer 1x)

1. Com o Next.js e este serviço rodando, abra **Configurações → Integrações**
   no CRM.
2. Escaneie o QR code mostrado ali com o WhatsApp do celular
   (Configurações → Aparelhos conectados → Conectar um aparelho).
3. Depois de parear, a sessão fica salva num arquivo nesta pasta (o nome vem
   de `SESSION_NAME` no `.env`, por padrão `integra-crm.db`) — reiniciar o
   serviço não pede o QR de novo, só reconecta sozinho. Isso só volta a
   acontecer se você apagar esse arquivo ou desconectar pelo próprio celular.

## No CRM (Next.js)

Depois de parear, defina no `.env` da raiz do projeto:

```
WHATSAPP_PROVIDER="neonize"
WHATSAPP_SERVICE_URL="http://localhost:8787"
WHATSAPP_SERVICE_SECRET="<mesmo valor do WEBHOOK_SECRET acima>"
```

e reinicie o `npm run dev`. A partir daí, toda conversa nova (recebida ou
iniciada pela Central/Kanban) passa a sair de verdade pelo WhatsApp.

## Produção

Este serviço precisa ficar rodando o tempo todo (é ele que mantém a conexão
com o WhatsApp Web ativa) — trate como um processo de longa duração
(systemd, pm2, Docker, etc.), não como algo que sobe e desce a cada deploy.
O arquivo de sessão (`integra-crm.db` por padrão) e a pasta `media/`
precisam persistir entre reinicializações — não podem ficar num disco
efêmero, senão a cada deploy o WhatsApp desconecta (pede QR de novo) e as
mídias já recebidas somem.

### Deploy no Render

1. **New → Web Service**, apontando pro mesmo repositório Git, com **Root
   Directory** = `whatsapp-service`.
2. Runtime: **Python 3**. Build Command: `pip install -r requirements.txt`.
   Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT` (Render
   injeta `$PORT`; sem `--host 0.0.0.0` o serviço fica inacessível de fora).
3. **Add Disk** (Settings → Disks — exige plano pago, não tem no free):
   Mount Path `/data`, 1 GB já é de sobra.
4. Variáveis de ambiente (Settings → Environment):
   - `SESSION_NAME` = `/data/integra-crm.db`
   - `MEDIA_DIR` = `/data/media`
   - `WEBHOOK_SECRET` = mesmo valor gerado (`openssl rand -hex 32`)
   - `NEXTJS_WEBHOOK_URL` = `https://<seu-servico-nextjs>.onrender.com/api/webhooks/whatsapp`
   - `PUBLIC_URL` = `https://<url-deste-serviço>.onrender.com` (a própria
     URL pública que o Render dá a este serviço)
5. Depois do primeiro deploy, abra **Configurações → Integrações** no CRM
   (já em produção) e escaneie o QR — só precisa 1x, a sessão fica em
   `/data`.
