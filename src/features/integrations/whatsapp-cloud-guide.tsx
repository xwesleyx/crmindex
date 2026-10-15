import { ChevronDown } from "lucide-react";

// Passo a passo de configuração da API oficial do WhatsApp (Meta) — texto
// estático mostrado na tela de Integrações quando "API oficial" está ativa.
const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Crie o app na Meta",
    body: (
      <>
        Acesse{" "}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          developers.facebook.com/apps
        </a>{" "}
        → <b>Criar app</b> → caso de uso <b>Conectar-se com clientes pelo WhatsApp</b> (tipo Empresa) e vincule ao
        Portfólio empresarial (Business Manager) da empresa.
      </>
    ),
  },
  {
    title: "Adicione o número e copie o Phone Number ID",
    body: (
      <>
        No app, vá em <b>WhatsApp → Configuração da API</b> → <b>Adicionar número de telefone</b>. O número{" "}
        <b>não pode estar ativo</b> no aplicativo WhatsApp/WhatsApp Business do celular (apague a conta do app antes) e
        recebe um código por SMS ou ligação. Depois, copie o <b>Phone Number ID</b> desse número (não é o número em si,
        é um código de ~15 dígitos).
      </>
    ),
  },
  {
    title: "Gere um token permanente",
    body: (
      <>
        O token que aparece na tela da API <b>expira em 24h</b> — não use. Em{" "}
        <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          Configurações do negócio → Usuários do sistema
        </a>
        , crie um usuário do sistema (Admin), em <b>Atribuir ativos</b> dê controle total do app e da conta do WhatsApp,
        e clique em <b>Gerar token</b>: escolha o app, validade <b>Nunca</b> e marque as permissões{" "}
        <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>.
      </>
    ),
  },
  {
    title: "Copie o App Secret",
    body: (
      <>
        No app, <b>Configurações do app → Básico → Chave secreta do app → Mostrar</b>.
      </>
    ),
  },
  {
    title: "Salve as credenciais aqui",
    body: <>Cole Phone Number ID, token e App Secret no formulário ao lado e clique em Salvar. O status deve ficar “Conectado”.</>,
  },
  {
    title: "Configure o webhook na Meta",
    body: (
      <>
        Gere o verify token ao lado. Na Meta, <b>WhatsApp → Configuração → Webhook → Editar</b>: cole a URL de callback e
        o verify token e clique em <b>Verificar e salvar</b>. Em seguida, em <b>Campos do webhook</b>, assine{" "}
        <b>messages</b>. A URL precisa ser HTTPS pública (o CRM em produção).
      </>
    ),
  },
  {
    title: "Publique o app e cadastre o pagamento",
    body: (
      <>
        Mude o app para o modo <b>Ao vivo (Live)</b> e adicione uma forma de pagamento no{" "}
        <a href="https://business.facebook.com/wa/manage/home" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          WhatsApp Manager
        </a>{" "}
        — a Meta cobra por conversa iniciada pela empresa.
      </>
    ),
  },
];

export function WhatsappCloudGuide() {
  return (
    <details className="group rounded-xl border border-border" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        Como configurar a API oficial (passo a passo)
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-medium">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs leading-5 text-foreground">
          <b>Regra das 24 horas:</b> pela API oficial, o CRM só consegue mandar mensagem livre até 24h depois da última
          mensagem do cliente. Fora dessa janela a Meta exige um modelo (template) aprovado, que o CRM ainda não envia —
          então iniciar conversa com quem não escreveu recentemente, e os lembretes internos por WhatsApp, podem falhar.
        </div>
      </div>
    </details>
  );
}
