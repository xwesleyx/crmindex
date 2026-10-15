# CRM Comercial

ERP/CRM comercial: acompanha o ciclo completo desde o primeiro contato
(WhatsApp/atendimento) até lead, oportunidade, proposta, venda, cliente,
instalação e pós-venda em uma única plataforma.

Este repositório está na **Fase 1** (fundação): autenticação, permissões,
layout, banco de dados e estrutura de API. Os módulos de CRM, Comercial,
Instalações, Atendimento/WhatsApp e Relatórios chegam nas fases seguintes —
veja [Roadmap](#roadmap) e o menu lateral, onde os itens ainda não
implementados aparecem marcados como "Em breve".

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (Base UI)
- [Prisma 6](https://www.prisma.io) + PostgreSQL (ver [Banco de dados](#banco-de-dados))
- [Auth.js (NextAuth v5)](https://authjs.dev) — autenticação por credenciais (e-mail/senha)
- [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com)
- [TanStack Query](https://tanstack.com/query) — preparado para os módulos com dados client-side (Kanban, etc.)
- [dnd-kit](https://dndkit.com) — preparado para o Kanban comercial/instalação (Fase 2+)
- [Recharts](https://recharts.org) — preparado para os gráficos do dashboard (Fase 3+)

## Requisitos

- Node.js 20+
- npm

## Instalação

```bash
npm install
cp .env.example .env
```

Edite o `.env` gerado (veja a seção abaixo) antes de continuar.

## Configuração do `.env`

| Variável         | Obrigatória | Descrição                                                                 |
| ---------------- | :---------: | --------------------------------------------------------------------------- |
| `DATABASE_URL`   |     sim     | String de conexão do PostgreSQL (`postgresql://usuario:senha@host:5432/banco`). |
| `AUTH_SECRET`    |     sim     | Segredo do Auth.js. Gere com `npx auth secret` ou `openssl rand -base64 32`. |
| `ADMIN_EMAIL`    | só no seed  | E-mail do primeiro administrador (usado por `npm run db:seed`).            |
| `ADMIN_PASSWORD` | só no seed  | Senha do primeiro administrador (mínimo 7 caracteres).                     |
| `ADMIN_NAME`     |     não     | Nome de exibição do primeiro administrador. Padrão: "Administrador".        |

`ADMIN_EMAIL`/`ADMIN_PASSWORD` nunca ficam hardcoded em código — são lidos
apenas pelo script de seed (`prisma/seed.ts`) a partir do `.env`.

## Banco de dados

Usamos **PostgreSQL** (Render Postgres em produção; pode ser o mesmo banco
remoto ou uma instância local em desenvolvimento). A string de conexão vive
só em `DATABASE_URL`, nunca hardcoded.

### Migrations

```bash
npm run db:migrate      # cria/aplica migrations em desenvolvimento
npm run db:studio       # abre o Prisma Studio (explorar o banco visualmente)
```

Toda mudança no `schema.prisma` precisa virar uma migration
(`npm run db:migrate -- --name descricao`) — **não use `prisma db push`**.
O instalador Windows leva a pasta `prisma/migrations` e o launcher aplica
as que faltam em cada computador ao atualizar (com backup antes); sem a
migration, quem instalar a versão nova fica com o banco desatualizado.
Ver [`installer/launcher/database.js`](installer/launcher/database.js).

### Criando o primeiro administrador (seed)

1. Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.
2. Rode:

   ```bash
   npm run db:seed
   ```

O script cria (ou promove) o usuário com perfil `ADMIN`. Ele pode então
entrar em `/login` e criar os demais usuários pela tela
**Configurações → Usuários**.

## Executando localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) — redireciona para
`/login` se não autenticado, ou `/dashboard` se já estiver logado.

## Estrutura de pastas

```
prisma/
  schema.prisma        # modelos de banco (User, Activity, Notification, Auth.js)
  seed.ts               # cria o primeiro administrador a partir do .env
src/
  app/
    (auth)/login/        # tela de login
    (dashboard)/          # área autenticada (layout com sidebar/header)
    api/auth/[...nextauth]/  # rotas do Auth.js
  components/
    layout/               # Sidebar, Header, DashboardShell, config de navegação
    ui/                   # design system (shadcn/ui + Empty/Loading/Error states)
    dashboard/             # componentes específicos do dashboard
  features/                # lógica de domínio por módulo (auth/, users/, ...)
    <modulo>/
      actions.ts           # server actions (autorização validada no servidor)
      schema.ts             # validação Zod
  services/                 # integrações externas isoladas por contrato
    whatsapp/                # interface preparada para a Fase 7 (sem provedor conectado ainda)
  lib/                       # infraestrutura (prisma client, auth, permissões, auditoria)
  types/                     # augmentations de tipos (next-auth.d.ts)
  proxy.ts                   # proteção de rotas (redireciona não autenticados para /login)
```

Nenhuma lógica de negócio fica dentro de páginas — páginas chamam
`features/<modulo>/actions.ts`, que valida (Zod), autoriza (checa a sessão
e o `role`) e acessa o Prisma.

## Permissões

Perfis: `ADMIN`, `GERENTE`, `VENDEDOR`, `ATENDIMENTO`, `INSTALADOR`,
`FINANCEIRO`. O mapeamento de quais módulos cada perfil acessa está em
[`src/lib/permissions.ts`](src/lib/permissions.ts) e é validado no
servidor (nas server actions e nas páginas), não apenas escondido na UI.

## Comandos principais

| Comando             | Descrição                                    |
| -------------------- | --------------------------------------------- |
| `npm run dev`         | inicia o servidor de desenvolvimento          |
| `npm run build`       | build de produção                             |
| `npm run start`       | serve o build de produção                     |
| `npm run lint`        | ESLint                                        |
| `npm run db:migrate`  | cria/aplica migrations do Prisma              |
| `npm run db:seed`     | cria o primeiro administrador (via `.env`)    |
| `npm run db:studio`   | abre o Prisma Studio                          |

## Licença e atualizações (CRM instalado nos clientes)

Cada CRM instalado consulta, ao ligar e depois de hora em hora, o arquivo
`controle.json` de um repositório **público** no GitHub. O arquivo traz a
lista de CNPJs ativos (embaralhados — hash, a lista não revela os clientes)
e a versão mais nova do instalador. Ele é **assinado**: os CRMs só aceitam o
que foi assinado com a chave privada do fornecedor. Quem publica é o
**Integra Publicador** (`installer/output/IntegraPublicador.exe`, gerado
por `installer/publisher/build-publicador.ps1`), que roda só na máquina do
fornecedor.

- CNPJ fora da lista → o CRM trava (tela "Sistema suspenso") para todos,
  menos o usuário do suporte `admin@crm.index`, que vê o menu
  Configurações > Licença (CNPJ vinculado, situação, "Verificar agora").
  Sem internet vale a última resposta — nunca trava por falta de conexão.
- Versão nova normal → aviso "Nova versão disponível" para os
  administradores, com "Atualizar agora". Versão obrigatória → contagem de
  5 minutos nas telas, depois "Sistema atualizando…" e volta sozinho.
- Quem instala é `installer/launcher/updater.js` (tarefa do Windows "IntegraCRM
  Atualizador", roda como SYSTEM a cada minuto). Confere a assinatura e o
  sha256, faz backup do banco (launcher) e volta para a versão anterior se
  a nova não subir.

### Uma vez só (preparação)

1. No GitHub, crie um repositório **público** (ex.: `crm-index-atualizacoes`)
   marcando **Add a README file** (precisa ter pelo menos um commit).
2. Crie um token: GitHub > Settings > Developer settings > Personal access
   tokens > **Fine-grained tokens** > Generate new token. Em *Repository
   access* escolha *Only select repositories* → o repositório acima; em
   *Permissions* > *Contents* → **Read and write**. Copie o token.
3. Gere o Publicador (se ainda não existir):
   `powershell -ExecutionPolicy Bypass -File installer\publisher\build-publicador.ps1`
4. Abra `installer\output\IntegraPublicador.exe` → **Configurar**: pasta do
   projeto, usuário do GitHub, repositório, branch (`main`), token e o
   contato do suporte (aparece na tela de bloqueio). Ele cria a chave de
   assinatura e grava `src/features/license/remote-config.ts` e
   `installer/launcher/remote-config.json`.
5. **Faça backup da pasta `%APPDATA%\IntegraPublicador`** (principalmente
   `chave-privada.pem`). Sem ela não dá mais para mandar atualização para os
   CRMs já instalados. O token também fica salvo ali.
6. Gere o instalador (`installer\build.ps1`) e publique a versão (Publicador
   > **2**). Isso cria o `controle.json` no GitHub.

### Instalar num cliente novo

1. Publicador > **1 Clientes** > **a** (CNPJ + nome — o nome fica só no seu
   computador) > publicar.
2. Rode `IntegraCRM-Setup-<versão>.exe` no computador do cliente; ele pede o
   CNPJ.
3. Entre com `admin@crm.index`, crie o administrador do cliente em
   Configurações > Usuários e confira Configurações > Licença ("Liberado").

### Bloquear / desbloquear

Publicador > **1 Clientes** > **b** (número do cliente) > publicar. Vale em
até 1 hora (ou na hora, com "Verificar agora" em Configurações > Licença).

### Mandar uma atualização

1. `powershell -ExecutionPolicy Bypass -File installer\build.ps1` — gera
   `installer\output\IntegraCRM-Setup-<versão>.exe` e o `.json` de novidades
   (do `src/lib/changelog.ts`).
2. Publicador > **2 Publicar nova versão** → normal (o cliente escolhe) ou
   obrigatória (instala sozinho). Para mudar depois: opção **3**.
3. Os CRMs veem a versão em até 1 hora. O GitHub pode levar até 5 minutos para
   servir o arquivo novo.

A versão só sobe: para corrigir uma versão publicada, publique uma de número
maior. Instalações feitas com instaladores de antes deste recurso precisam
ser reinstaladas uma vez com o instalador novo (aí ele pede o CNPJ).

## Identidade visual

Todas as cores/tokens do design system vivem em
[`src/app/globals.css`](src/app/globals.css) (`--primary`, `--background`,
`--muted`, etc.) — nenhum componente usa cor "crua". Os valores atuais são
um **placeholder neutro (slate/gray)** até a identidade visual oficial do
produto ser definida; quando isso acontecer, a troca é só nesse arquivo.

## Roadmap

Fase 1 (esta) cobre a fundação. As próximas fases, na ordem planejada:

2. CRM — leads, contatos, empresas, oportunidades, Kanban comercial
3. Comercial — produtos/serviços/planos, propostas, vendas
4. Conversão automática — venda ganha → cliente → instalação
5. Instalações — Kanban, checklist, tarefas
6. Atendimento — conversas, tickets (estrutura pronta para WhatsApp)
7. WhatsApp — integração real (webhook, envio/recebimento)
8. Relatórios — vendas, conversão, instalação, atendimento, financeiro
9. Automação — regras, notificações, alertas
