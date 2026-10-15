# Design System — CRM Integra

Documenta as convenções visuais já implementadas no projeto. Não é uma proposta —
é o retrato do que existe hoje em `src/app/globals.css` e nos componentes de
`src/components/`. Ao criar uma tela nova, reutilize o que está aqui antes de
inventar um padrão novo.

## 1. Identidade e tokens de cor

Toda cor do sistema vem de custom properties CSS definidas em
`src/app/globals.css` (`:root`) e mapeadas para utilitários Tailwind via
`@theme inline` (`--color-*`). **Nunca usar hex direto em um componente** — só
os tokens abaixo (ou os utilitários Tailwind que eles geram: `bg-primary`,
`text-muted-foreground`, `border-border` etc.).

| Token | Uso |
|---|---|
| `--primary` / `--primary-foreground` | Ações principais, links ativos, valores monetários em destaque |
| `--background` | Fundo da página |
| `--card` / `--card-foreground` | Fundo de cards, tabelas, popovers |
| `--border` / `--input` | Bordas e contornos de campos |
| `--muted` / `--muted-foreground` | Texto secundário, fundos neutros (badges, pills de contagem) |
| `--success` / `--warning` / `--destructive` (+ `-foreground`) | Estados semânticos (ganho, atenção, erro/perdido) |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border` | Exclusivos da barra lateral (azul-marinho escuro) |
| `--chart-1` a `--chart-5` | Acentos categóricos (Kanban de instalação, gráficos do dashboard, `MetricCard` colorido) — usar só onde a variedade tem significado (uma cor por categoria), nunca como decoração aleatória |

Não existem gradientes, glassmorphism ou sombras decorativas no sistema. Sombra
só aparece em `shadow-sm`/`shadow-md` (cards de Kanban) e é sutil.

## 2. Tipografia e espaçamento

- Fonte única: `--font-sans` (Geist Sans), aplicada globalmente via `body`.
- Escala de texto usada consistentemente: `text-[11px]` (metadados/rodapé de
  card) → `text-xs` (labels, descrições) → `text-sm` (corpo padrão) → `text-base`
  → `text-xl`/`text-2xl` (títulos de página, valores em destaque).
- Título de página: `text-xl font-semibold` (ver `PageHeader`).
- Espaçamento em grade de 4px via classes Tailwind padrão (`gap-2`, `gap-3`,
  `gap-4`, `p-3`, `px-4`). Containers de página usam `flex flex-col gap-4`.
- Raio de borda: `--radius` (0.625rem) e derivados `--radius-sm/md/lg/xl`.
  Cards e inputs usam `rounded-lg`/`rounded-xl`; badges e pills usam
  `rounded-full`.

## 3. Componentes compartilhados

Antes de criar um componente novo, verifique se um destes já resolve o caso.

### `PageHeader` (`src/components/page-header.tsx`)
Cabeçalho padrão de toda página (lista, detalhe, Kanban): `title` (aceita
badges inline), `description` opcional, `action` (botão/formulário à direita),
`backHref`/`backLabel` opcional (páginas de detalhe). Usado em todas as
páginas de lista e detalhe do sistema.

### `MoneyDisplay` (`src/components/money-display.tsx`)
Único componente que exibe valor monetário formatado (usa `formatMoneyCents`
de `src/lib/money.ts` por baixo). Prop `size` (`sm`|`md`|`lg`|`xl`) define a
hierarquia visual — `lg`/`xl` para o valor principal de um card/cabeçalho,
`md` para totais de coluna, `sm` para contextos compactos. `muted` para
valores secundários.

### `StatusBadge` / `PriorityBadge` (`src/components/status-badge.tsx`,
`src/components/priority-badge.tsx`)
Vocabulário único de "tom" (`BadgeTone`: `neutral`|`info`|`success`|`warning`|
`destructive`) mapeado uma vez para classes Tailwind. Cada feature mantém só
um `Record<Enum, BadgeTone>` em `labels.ts` (`LEAD_STATUS_TONE`,
`OPPORTUNITY_STATUS_TONE`, `SALE_STATUS_TONE` etc.) em vez de reimplementar
cor por feature. `solid` deixa o badge com fundo cheio (ex.: status "Ganha").
`PriorityBadge` é um wrapper de `StatusBadge` fixado no enum `Priority`
(`src/lib/priority.ts`).

### `EntityAvatar` (`src/components/entity-avatar.tsx`)
Iniciais de pessoa em avatar circular (`getInitials` + `Avatar`/`AvatarFallback`
do shadcn). `size` (`sm`|`md`|`lg`), `tone` (`primary`|`muted`). Usado no
header, tabela de usuários e cards de Kanban (responsável).

### `MetricCard` (`src/components/metric-card.tsx`)
Substitui o antigo `KpiCard`. Mostra `value` quando existe; se o dado ainda
não tem fonte real (feature futura), mostra um estado "pendente" honesto via
`pendingPhase` em vez de inventar número. `tone` (`primary`|`success`|
`warning`|`destructive`|`blue`|`amber`|`purple`|`orange`|`green`) só troca a
cor do ícone, reaproveitando os tokens semânticos e `--chart-1..5` — nunca cor
nova.

### `FilterBar` + `SortSelect` (`src/components/filter-bar.tsx`,
`src/components/sort-select.tsx`)
Layout compacto `[Buscar] [Filtros] [Ordenar]` em uma linha. `searchSlot` é o
campo de busca (sempre visível); `popoverSlot` recebe os filtros secundários
(selects, datas, checkboxes) dentro de um `Popover`; `activeCount` mostra um
badge numérico no botão "Filtros" quando há filtro(s) ativo(s); `sortSlot`
(opcional) é o `SortSelect`. Usado pelos 7 `*-filters.tsx` do sistema
(Leads, Empresas, Contatos, Oportunidades, Clientes, Vendas, Instalações).
Nenhum filtro existente foi removido nessa reorganização — só migrou de um
card sempre expandido para o popover.

### `EmptyState` (`src/components/ui/empty-state.tsx`)
Estado vazio de página inteira (lista sem resultados, sem permissão). Ícone +
título + descrição + ação opcional.

### `KanbanEmptyState` (`src/features/kanban/kanban-empty-state.tsx`)
Estado vazio **de uma coluna** do Kanban — deliberadamente discreto (não pode
"ocupar metade da tela" quando uma etapa está vazia). Só texto pequeno
("Nenhuma oportunidade nesta etapa.") + ação opcional.

### `KanbanMobileTabs` (`src/features/kanban/kanban-mobile-tabs.tsx`)
Seletor de etapa em abas horizontais, visível só abaixo do breakpoint `md`.
Ver seção 5 (Responsividade).

## 4. Tabelas

`src/components/ui/table.tsx` (shadcn) dentro de um wrapper
`overflow-x-auto rounded-xl border border-border`. Linha arquivada/inativa usa
`opacity-60`. Colunas de valor monetário são alinhadas à direita
(`text-right`) e usam `tabular-nums`.

## 5. Kanban (centro visual do CRM)

- **Coluna** (`KanbanColumn`/`InstallationKanbanColumn`): cabeçalho com nome da
  etapa + pill de contagem (`rounded-full bg-muted`) + `MoneyDisplay` do total
  da coluna (colorido `text-primary`, exceto etapas terminais Ganha/Perdida
  que usam a cor neutra do texto). Corpo mostra os cards ou `KanbanEmptyState`.
- **Card** (`KanbanCard`/`InstallationKanbanCard`): empresa/contato em negrito
  no topo, título da oportunidade abaixo (menor), `MoneyDisplay size="lg"` em
  destaque, `PriorityBadge`, responsável (nome + `EntityAvatar`), rodapé com
  ícone de relógio + tempo na etapa (`formatRelative`), chip opcional com a
  próxima tarefa pendente.
- **Responsividade**: desktop/tablet = todas as colunas lado a lado com
  scroll horizontal (`overflow-x-auto`, `snap-x snap-mandatory`). Mobile
  (abaixo de `md`) = `KanbanMobileTabs` no topo para pular direto para uma
  etapa (`scrollIntoView`) + o menu "Mover para etapa" de cada card (já
  existente desde a Etapa 4) como ação explícita — o Kanban nunca depende só
  de arrastar em touch.
- Nunca substituir o Kanban por uma tabela.

## 6. Dashboard e gráficos

Gráficos usam **Recharts** (já uma dependência do projeto) e ficam em
`src/features/dashboard/charts.tsx`. Cada gráfico:
- Busca dado real via `src/features/dashboard/queries.ts` (nunca número
  inventado).
- Mostra `EmptyState` compacto (`ChartEmptyState`, dentro do próprio arquivo
  de charts) quando não há dado suficiente, em vez de renderizar um gráfico
  vazio ou zerado.
- Usa só cores dos tokens (`var(--color-primary)`, `var(--color-success)`,
  `var(--color-destructive)`, `var(--color-chart-1..5)`) — nunca hex direto.
- Eixo de valor usa `formatMoneyCompact` (`src/lib/money.ts`) para caber
  labels como "R$ 12,5 mil"; tooltip usa `formatMoneyCents` (valor completo).

## 7. Valores monetários

Fonte única: `src/lib/money.ts`. `Int` em centavos em todo o banco — nunca
float. `formatMoneyCents` para exibição completa (tabelas, cabeçalhos,
tooltips), `formatMoneyCompact` só para eixos de gráfico. Hierarquia visual
por `MoneyDisplay size`: `xl`/`lg` = valor principal de uma entidade
(oportunidade, venda, instalação), `md` = totais agregados (coluna de Kanban),
`sm` = contexto secundário.

## 8. Sidebar e Header

- Sidebar (`src/components/layout/sidebar.tsx`): fundo `bg-sidebar` (azul-
  marinho), item ativo usa `bg-sidebar-primary`/`text-sidebar-primary-foreground`,
  hover usa `hover:bg-sidebar-accent`. Grupo é considerado ativo se a rota
  atual começa com o `href` de algum item do grupo.
- Header (`src/components/layout/header.tsx`): breadcrumb à esquerda
  (derivado da rota via `NAV_GROUPS`), busca global (`Input` desabilitado —
  chega em fase futura, não inventado), notificações e menu do usuário
  (`EntityAvatar` + `DropdownMenu`) à direita.

## 9. Responsividade

- Filtros: `FilterBar` empilha em telas estreitas (`flex-wrap`); o botão
  "Filtros" sempre visível, popover com `max-w-[calc(100vw-2rem)]`.
- Grids de cards/KPIs: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`.
- Tabelas: sempre dentro de `overflow-x-auto` — nunca quebram o layout da
  página em telas estreitas.
- Kanban: ver seção 5.

## 10. O que evitar

- Hex direto em qualquer componente (só tokens).
- Gradientes, glassmorphism, sombras decorativas fora de `shadow-sm`/`shadow-md`.
- Badge/cor "inventada" fora do vocabulário `BadgeTone`.
- Estado vazio de coluna de Kanban ocupando mais que um bloco discreto.
- Gráfico com dado fictício — sempre `ChartEmptyState` quando não há dado real.
