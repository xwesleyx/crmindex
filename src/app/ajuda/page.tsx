import { redirect } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@prisma/client";
import { ArrowLeft, LifeBuoy } from "lucide-react";

import { ROLE_LABELS } from "@/components/layout/nav-config";
import { CURRENT_VERSION, LAST_UPDATED } from "@/lib/changelog";
import { formatChangelogDate } from "@/lib/changelog-format";
import { canAccessModule, MODULES } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { FUTURE_ITEMS, HELP_GROUPS, MODULE_LABELS } from "@/features/help/content";
import { ConceptCard, GroupSection, TocNav } from "@/features/help/help-ui";
import { PrintButton } from "@/features/help/print-button";

const ROLES: UserRole[] = ["ADMIN", "GERENTE", "VENDEDOR", "ATENDIMENTO", "INSTALADOR", "FINANCEIRO"];
const MODULE_KEYS = Object.values(MODULES);

const CONCEPT_LINKS = [
  { id: "conceito-perfis", title: "Perfis de acesso" },
  { id: "conceito-modelo-dados", title: "Empresa, Contato e Cliente" },
  { id: "conceito-temperatura", title: "Temperatura calculada" },
  { id: "conceito-arquivar", title: "Arquivar em vez de excluir" },
  { id: "conceito-atendimento-atalho", title: "O botão \"Atendimento\"" },
  { id: "conceito-meu-perfil", title: "Meu perfil (trocar senha)" },
];

export default async function AjudaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-full bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LifeBuoy className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg font-semibold text-foreground">Central de Ajuda</h1>
            <Link
              href="/ajuda/versoes"
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              CRM Integra · versão {CURRENT_VERSION} · atualizado em {formatChangelogDate(LAST_UPDATED)}
            </Link>
          </div>
          <PrintButton />
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Voltar ao sistema
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block print:hidden">
          <div className="sticky top-20">
            <TocNav groups={HELP_GROUPS} conceptIds={CONCEPT_LINKS} />
          </div>
        </aside>

        <details className="mb-2 w-full rounded-xl bg-card p-3 ring-1 ring-foreground/10 lg:hidden print:hidden">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Sumário</summary>
          <div className="mt-3">
            <TocNav groups={HELP_GROUPS} conceptIds={CONCEPT_LINKS} />
          </div>
        </details>

        <main className="min-w-0 flex-1 space-y-12">
          <section>
            <h2 className="font-heading text-2xl font-semibold text-foreground">Bem-vindo(a) à Central de Ajuda</h2>
            <p className="mt-2 max-w-3xl text-sm text-foreground/80">
              Esta página reúne o funcionamento detalhado de cada tela e menu do sistema: para que serve, quais campos
              e filtros existem, quais ações estão disponíveis e quem pode acessar. Use o sumário ao lado (ou o botão
              acima em telas menores) para pular direto para o que precisa. O{" "}
              <Link href="/ajuda/versoes" className="text-primary underline underline-offset-2">
                histórico de versões
              </Link>{" "}
              do sistema tem uma página própria (clique na versão no topo, ou no sumário).
            </p>
          </section>

          <section id="conceitos" className="scroll-mt-20 space-y-5">
            <div className="border-b border-border pb-3">
              <h2 className="font-heading text-2xl font-semibold text-foreground">Conceitos e regras gerais</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Vale entender estas 5 ideias antes de navegar pelas telas — elas se repetem em vários lugares do
                sistema.
              </p>
            </div>

            <ConceptCard id="conceito-perfis" title="Perfis de acesso">
              <p>
                Cada usuário tem um perfil fixo, definido em Configurações &gt; Usuários, que decide quais menus
                aparecem para ele. A tabela abaixo é gerada a partir da configuração real do sistema:
              </p>
              <div className="mt-1 flex flex-col gap-2.5">
                {ROLES.map((role) => (
                  <div key={role} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {MODULE_KEYS.filter((moduleKey) => canAccessModule(role, moduleKey)).map((moduleKey) => (
                        <span
                          key={moduleKey}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {MODULE_LABELS[moduleKey]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Configurações é sempre restrito ao Administrador, mesmo que um perfil apareça listado em outras
                permissões — essa regra é fixa no código, não dá pra mudar por aqui.
              </p>
              <p className="text-xs text-muted-foreground">
                Além do menu aparecer ou não, boa parte das telas também filtra os próprios dados: Vendedor,
                Atendimento e Instalador em geral só veem os registros que são deles ou que ainda não têm
                responsável — Administrador e Gerente sempre veem tudo. Isso está detalhado em “Bom saber” de cada
                tela quando muda o padrão.
              </p>
            </ConceptCard>

            <ConceptCard id="conceito-modelo-dados" title="Empresa, Contato e Cliente — qual a diferença">
              <p>
                São três cadastros diferentes, e o sistema não deixa eles se confundirem:
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                <li>
                  <strong className="text-foreground">Empresa</strong> — a pessoa jurídica: razão social, CNPJ,
                  endereço. É a entidade “de papel”.
                </li>
                <li>
                  <strong className="text-foreground">Contato</strong> — uma pessoa física, que pode (ou não) estar
                  ligada a uma Empresa. É quem você realmente fala com no dia a dia.
                </li>
                <li>
                  <strong className="text-foreground">Cliente</strong> — não é um cadastro novo, é um “carimbo”: marca
                  que uma Empresa (ou um Contato avulso, sem empresa) virou cliente. Nasce sozinho quando uma
                  oportunidade é ganha, ou pode ser criado manualmente em Clientes &gt; Novo Cliente ou pelo botão “Tornar cliente” em Empresas. Só existe um
                  Cliente por Empresa (ou por Contato avulso) — nunca duplica.
                </li>
              </ul>
            </ConceptCard>

            <ConceptCard id="conceito-temperatura" title="Temperatura calculada (🔥 Quente / 🟡 Morno / ❄️ Frio)">
              <p>
                Presente no card <strong className="text-foreground">“Sinais comerciais”</strong> de todo Lead e toda
                Oportunidade em aberto. Não é o vendedor quem escolhe a temperatura — ela é <strong className="text-foreground">calculada
                automaticamente</strong> a partir de:
              </p>
              <ul className="flex flex-col gap-1 pl-1">
                <li>há quanto tempo houve a última interação;</li>
                <li>o quão avançado está no funil (etapa da Oportunidade ou status do Lead);</li>
                <li>a prioridade definida e a previsão de fechamento;</li>
                <li>
                  5 sinalizadores manuais, de 1 clique: <em>Pediu proposta</em>, <em>Perguntou preço</em>, <em>Pediu
                  demonstração</em>, <em>Informou prazo</em> e <em>Problema urgente</em> — cada um vai perdendo peso
                  aos poucos até somar zero depois de 30 dias.
                </li>
              </ul>
              <p>
                Quem tem permissão de editar o registro pode <strong className="text-foreground">travar</strong> a
                temperatura manualmente (escolhendo Quente/Morno/Frio) quando souber de algo que o sistema não
                capta — o cálculo automático continua rodando por baixo, só não sobrescreve o rótulo enquanto estiver
                travado. Basta clicar em “Destravar” para voltar ao automático. Oportunidades ganhas/perdidas e leads
                convertidos/perdidos não têm mais temperatura — não faz sentido priorizar o que já fechou.
              </p>
            </ConceptCard>

            <ConceptCard id="conceito-arquivar" title="Arquivar em vez de excluir">
              <p>
                Leads, Contatos, Empresas, Regiões e Etapas de Kanban usam{" "}
                <strong className="text-foreground">exclusão suave</strong>: o botão “Excluir”/“Arquivar”/“Remover”
                nunca apaga o registro de verdade, só marca como arquivado e some das listas por padrão. Dá pra
                restaurar a qualquer momento (checkbox “Mostrar arquivados” nas listas, ou botão “Restaurar”). Isso
                evita perder histórico por engano — nada relacionado a um registro arquivado (vendas, conversas,
                atividades) deixa de existir. A única exceção franca é o item de Checklist de Instalação
                (Configurações &gt; Checklist), que exclui de verdade, porque um item de checklist não tem histórico
                próprio.
              </p>
            </ConceptCard>

            <ConceptCard id="conceito-atendimento-atalho" title='O botão "Atendimento" espalhado pelo sistema'>
              <p>
                Você vai encontrar um botão/ícone de conversa (💬 Atendimento) em Leads, Oportunidades, Vendas,
                Clientes, Contatos e Instalações. Ele é um atalho: abre (ou começa) a conversa de WhatsApp daquele
                contato direto na Central de Atendimento, sem precisar procurar a conversa manualmente lá.
              </p>
            </ConceptCard>

            <ConceptCard id="conceito-meu-perfil" title="Meu perfil (trocar a própria senha)">
              <p>
                Qualquer pessoa logada — de qualquer perfil — pode mudar os próprios dados clicando no avatar (canto
                superior direito) e depois em <strong className="text-foreground">“Meu perfil”</strong>. Dá pra
                trocar a foto de perfil (botão “Adicionar foto”/“Trocar foto” — a imagem é recortada em quadrado; “Remover”
                volta às iniciais), Nome, E-mail e Telefone livremente; para trocar a senha, o sistema pede a senha atual antes de
                aceitar a nova (por segurança). Isso é diferente de quando um Administrador edita outra pessoa em
                Configurações &gt; Usuários — ali é um reset, não precisa da senha antiga, porque é gestão de conta
                alheia.
              </p>
            </ConceptCard>
          </section>

          {HELP_GROUPS.map((group) => (
            <GroupSection key={group.id} group={group} />
          ))}

          <section id="em-breve" className="scroll-mt-20 space-y-3">
            <div className="border-b border-border pb-3">
              <h2 className="font-heading text-2xl font-semibold text-foreground">Funcionalidades futuras</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Lista honesta do que ainda não existe, pra ninguém procurar em vão.
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FUTURE_ITEMS.map((item, i) => (
                <li
                  key={i}
                  className="rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground ring-1 ring-foreground/10"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
