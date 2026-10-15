import {
  Boxes,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  Settings,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { ModuleKey } from "@/lib/permissions";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  atendimento: "Atendimento",
  clientes: "Clientes",
  instalacoes: "Instalações",
  financeiro: "Financeiro",
  catalogo: "Catálogo",
  relatorios_atendimento: "Relatórios: Atendimentos",
  relatorios_comercial: "Relatórios: Comercial",
  relatorios_instalacoes: "Relatórios: Instalações",
  agenda: "Agenda",
  configuracoes: "Configurações",
};

export type ScreenDoc = {
  id: string;
  title: string;
  path?: string;
  status: "ready" | "soon";
  roles?: string; // só quando difere do acesso padrão do grupo
  purpose: string;
  fields?: string[];
  filters?: string[];
  actions?: string[];
  notes?: string[];
};

export type GroupDoc = {
  id: string;
  title: string;
  icon: LucideIcon;
  roles: string;
  intro?: string;
  screens: ScreenDoc[];
};

export const HELP_GROUPS: GroupDoc[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    roles: "Todos os perfis",
    screens: [
      {
        id: "dashboard-home",
        title: "Visão geral",
        path: "/dashboard",
        status: "ready",
        purpose:
          "Painel executivo com o resumo do funil comercial e dos números operacionais, filtrável por região.",
        filters: ["Região (chips no topo — clique para ligar/desligar cada região)"],
        actions: [] as string[],
        fields: [
          "Cartões principais: Leads novos, Oportunidades abertas, Pipeline (R$), Oportunidades ganhas, Vendido (R$)",
          "Faixa secundária: Perdidas, Clientes ativos, MRR, Instalações pendentes, Implantações atrasadas (destacado em vermelho quando > 0), Instalações concluídas",
          "4 gráficos: Evolução de vendas (6 meses), Pipeline por etapa, Ganhas x perdidas (6 meses), Valor comercial por status",
        ],
        notes: [
          "Cada número já respeita a visibilidade do seu perfil — um Vendedor só vê a contagem das próprias oportunidades/leads (+ os sem responsável), por exemplo.",
          "O rodapé do próprio painel avisa: relatórios de Atendimento/WhatsApp e Financeiro no dashboard ainda não existem — ver Financeiro em breve.",
        ],
      },
    ],
  },
  {
    id: "crm",
    title: "CRM",
    icon: LineChart,
    roles: "Administrador, Gerente, Vendedor",
    intro:
      "Funil comercial: dos Leads (contatos ainda não qualificados) até as Oportunidades (negociações em andamento) e as Vendas que elas geram.",
    screens: [
      {
        id: "crm-leads",
        title: "Leads",
        path: "/crm/leads",
        status: "ready",
        purpose: "Gerenciar contatos ainda não qualificados, antes de virarem uma oportunidade de venda.",
        fields: [
          "Nome, Telefone, WhatsApp, E-mail",
          "Empresa, CNPJ (com lupa de consulta automática — preenche nome, telefone, e-mail e endereço)",
          "Origem (WhatsApp, Indicação, Instagram, Facebook, Site, Google, Telefone, Evento, Prospecção, Outro)",
          "Prioridade (Baixa, Normal, Alta, Urgente) e Status",
          "Responsável",
          "Última interação, Próxima ação (data/hora) e observação da próxima ação",
          "Observações gerais",
        ],
        filters: [
          "Busca livre (nome, telefone, e-mail, empresa)",
          "Status, Prioridade, Origem, Responsável",
          "Mostrar arquivados (checkbox)",
          "Ordenação: mais recentes/antigos, nome A-Z, última interação",
        ],
        actions: [
          "Novo Lead",
          "Converter em oportunidade (some depois de convertido)",
          "Atendimento (abre/inicia a conversa de WhatsApp com esse lead)",
          "Editar",
          "Arquivar / Restaurar",
        ],
        notes: [
          "Arquivar é reversível (exclusão suave) — veja \"Arquivar em vez de excluir\" nos conceitos gerais.",
          "A tela de detalhe do Lead traz o card \"Sinais comerciais\" com a Temperatura calculada — veja o conceito de Temperatura mais abaixo.",
          "A tela de detalhe também tem um card de Tarefas (mesmo modelo de Oportunidades e Instalações): título, prazo, prioridade, responsável e lembrete automático por WhatsApp.",
          "Administrador e Gerente veem todos os leads; Vendedor só vê os seus e os sem responsável.",
        ],
      },
      {
        id: "crm-prospeccao",
        title: "Prospecção CNPJ",
        path: "/crm/prospeccao",
        status: "ready",
        purpose:
          "Buscar empresas recém-abertas numa cidade (via base pública de CNPJ) e importar em lote como Leads novos.",
        fields: [
          "Estado (UF) e Cidade (a lista de cidades carrega depois de escolher o estado)",
          "Período (últimos 7 / 15 / 30 / 60 / 90 dias)",
          "CNAE (opcional, filtra por atividade econômica)",
        ],
        actions: [
          "Clicar numa linha abre um card com os dados disponíveis daquela empresa; o botão \"Buscar dados completos\" nesse card busca CNAE, sócios, natureza jurídica, porte e endereço completo na Receita",
          "Buscar (resultado fica salvo na sua conta — sair da tela, trocar de aparelho e voltar não apaga, só \"Limpar resultados\" ou uma nova busca apagam)",
          "Selecionar linhas e clicar em \"Transformar em Lead\" (importação em lote)",
          "Limpar seleção / Limpar resultados",
        ],
        notes: [
          "Plano gratuito da base usada: até 25 resultados por busca e 100 buscas por mês.",
          "Empresas que já são Cliente ou já viraram Lead aparecem marcadas (\"Já é cliente\"/\"Já é lead\") e não podem ser selecionadas de novo — a proteção contra duplicidade é automática.",
          "\"Transformar em Lead\" já cria a Empresa de verdade junto, buscando os dados completos da Receita automaticamente (CNAE, sócios, natureza jurídica, porte, capital social, endereço) — não é preciso esperar a conversão em Oportunidade pra isso existir. O Lead fica linkado a essa Empresa desde já.",
          "Depende da integração estar configurada em Configurações > Integrações (card \"Prospecção CNPJ\").",
          "Telefone e e-mail vêm mascarados por padrão (ex: \"(28) 9***-**72\") — é limitação do plano gratuito da CFO, não bug. A checkbox \"Revelar telefone e e-mail de verdade\" na busca desmascara, mas cada empresa revelada consome 1 \"lead\" da cota mensal — deixe desmarcado pra só navegar sem gastar cota.",
        ],
      },
      {
        id: "crm-oportunidades",
        title: "Oportunidades",
        path: "/crm/oportunidades",
        status: "ready",
        purpose: "Tabela de todas as negociações em andamento (mesma base de dados do Kanban, em formato de lista).",
        fields: [
          "Título, Valor estimado, Valor recorrente (mensal)",
          "Prioridade, Etapa inicial (só na criação — depois só muda pelo Kanban ou pelo menu de ações)",
          "Origem, Empresa, Contato, Responsável",
          "Previsão de fechamento, Última interação",
          "Descrição, Observações",
        ],
        filters: [
          "Busca livre (título, empresa, contato, telefone)",
          "Etapa, Status (Em aberto/Ganha/Perdida), Prioridade, Origem, Responsável",
          "Valor mínimo/máximo (R$), Criada de/até (período)",
          "Região (chips) e ordenação (atualizadas recentemente, mais recentes, maior/menor valor, previsão de fechamento, título A-Z)",
        ],
        actions: [
          "Nova oportunidade",
          "Editar",
          "Marcar como ganha",
          "Marcar como perdida (exige motivo: Preço, Concorrente, Sem interesse, Sem orçamento, Prazo ou Outro — este último pede uma nota)",
          "Mover para etapa",
          "Atendimento",
        ],
        notes: [
          "\"Marcar como ganha\" dispara uma automação: cria (ou reaproveita) o Cliente, gera a Venda e cria a Instalação já com o checklist padrão copiado — tudo em uma única operação, sem risco de duplicar se for clicado de novo.",
          "Só é possível marcar como ganha se a oportunidade já tiver uma Empresa ou Contato vinculado.",
          "Marcar como perdida nunca apaga a oportunidade — ela fica visível, com o motivo registrado.",
          "Card de detalhe traz \"Sinais comerciais\" (Temperatura) e a lista de Tarefas da oportunidade.",
        ],
      },
      {
        id: "crm-kanban",
        title: "Kanban Comercial",
        path: "/crm/kanban",
        status: "ready",
        purpose: "Visão de funil arrasta-e-solta das mesmas oportunidades, agrupadas por etapa.",
        filters: ["Os mesmos filtros da tela de Oportunidades (sem ordenação, já que aqui agrupa por etapa) + região"],
        actions: [
          "Nova oportunidade",
          "Arrastar o card pra qualquer posição — dentro da mesma coluna (reordena) ou pra outra coluna — ou usar \"Mover para etapa\" no menu \"...\" do card, sem arrastar",
          "Atendimento (atalho no card)",
        ],
        fields: [
          "Painel \"Prioridade de hoje\": contagem de 🔥Quente/🟡Morno/❄️Frio e os nomes dos 5 clientes mais quentes em linha, coloridos conforme a temperatura",
          "Cada card mostra: valor, temperatura, prioridade, região, responsável, tempo na etapa e a próxima tarefa pendente",
        ],
        notes: [
          "Mover um card para a etapa \"Perdida\" sempre abre o formulário de motivo de perda, igual à tela de lista.",
          "Se o servidor recusar o movimento (por permissão, por exemplo), o card volta pro lugar e aparece um aviso explicando o motivo.",
          "Quem não pode editar uma oportunidade simplesmente não consegue arrastar aquele card.",
          "A ordem dentro de uma coluna sempre respeita a prioridade primeiro (Urgente > Alta > Normal > Baixa) — arrastar deixa reposicionar livremente dentro da própria faixa de prioridade, mas não dá pra intercalar com uma faixa diferente.",
        ],
      },
      {
        id: "crm-propostas",
        title: "Propostas",
        path: "/crm/propostas",
        status: "soon",
        purpose: "Geração de propostas comerciais formais a partir de uma oportunidade. Ainda não implementado.",
      },
      {
        id: "crm-vendas",
        title: "Vendas",
        path: "/vendas",
        status: "ready",
        purpose:
          "Consultar e ajustar detalhes das vendas — não existe criação manual: uma Venda só nasce quando uma Oportunidade é marcada como ganha.",
        fields: [
          "Editável: Desconto, Valor recorrente (mensal), Forma de pagamento (Pix, Boleto, Cartão de crédito/débito, Transferência, Dinheiro, Outro), Observações",
          "Não editável aqui: valor total, cliente e oportunidade de origem",
        ],
        filters: [
          "Busca livre (oportunidade, empresa, contato)",
          "Status (Confirmada/Cancelada), Responsável",
          "Valor mínimo/máximo, período (de/até)",
          "Ordenação: mais recentes/antigas, maior/menor valor",
        ],
        actions: ["Editar", "Atendimento"],
        notes: [
          "Administrador e Gerente veem todas as vendas; os demais perfis só veem as próprias (+ sem responsável).",
          "A tela de detalhe da venda linka direto para a Oportunidade, o Cliente e a Instalação gerada.",
        ],
      },
    ],
  },
  {
    id: "atendimento",
    title: "Atendimento",
    icon: MessageCircle,
    roles: "Administrador, Gerente, Vendedor, Atendimento",
    screens: [
      {
        id: "atendimento-conversas",
        title: "Conversas",
        path: "/atendimento",
        status: "ready",
        purpose: "Central de atendimento via WhatsApp, ligada a Contatos, Empresas, Leads, Oportunidades e Instalações.",
        filters: [
          "Busca livre (nome, telefone, empresa)",
          "Abas rápidas: Todas / Não lidas / Minhas / Novas (sem responsável)",
          "Painel de status: Sem responsável, Aguardando atendimento, Em atendimento, Aguardando cliente (cada um com contador)",
          "Ordenação: mais recentes/antigos, não lidos primeiro, aguardando atendimento primeiro",
        ],
        actions: [
          "Nova conversa, no canto superior direito (registro manual: contato existente ou novo, mensagem e prioridade)",
          "Abas Minhas (padrão: conversas que você atende, como responsável ou participante) / Não lidas (só as suas com mensagem nova) / Novas (sem ninguém atendendo), cada uma com a quantidade; o botão de filtro ao lado da busca mostra/esconde o painel de Status (Em atendimento, Aguardando cliente — sem clicar, todos marcados; o primeiro clique mostra só o status clicado; depois, clicar num desmarcado soma ele e clicar num marcado tira só ele (desmarcar o último volta a todos); soma com a aba aberta) e Ordenação",
          "Modo anônimo (ícone de máscara ao lado do emoji): escreve uma nota interna, destacada em amarelo com cadeado, que nunca vai para o cliente — só quem atende a conversa vê; digitar @ abre a lista de atendentes para mencionar — quem é mencionado recebe notificação e passa a participar da conversa",
          "Aba Quadro (ao lado do título): Kanban com Na fila (laranja — conversas sem ninguém atendendo, as mais antigas no topo, com botão Atender que assume e abre a conversa), Em atendimento (azul), Aguardando cliente (verde) e Finalizados hoje (cinza); cada atendente tem uma cor própria no card, com o nome dele em negrito nessa cor; clicar num card abre a conversa, e nos finalizados o botão Reabrir volta o atendimento. Com a permissão \"Ver atendimento de todos\", mostra a equipe toda e tem seletor de atendente; sem ela, só os seus. Atualiza sozinho a cada 15s",
          "Notificações (sininho) do Atendimento: menção numa nota, ser adicionado como participante e conversa atribuída/transferida para você. Conversa nova na fila e mensagem nova não notificam",
          "Fotos dos contatos na lista e no Quadro: aparecem depois que a conversa do contato é aberta uma vez (a lista nunca consulta o WhatsApp, para não arriscar bloqueio)",
          "Participar: botão no topo da conversa para entrar como atendente extra; em Informações > Participantes, adicionar outro atendente ou remover (cada participante pode sair sozinho). Todos respondem ao cliente com o próprio nome e veem as notas internas",
          "Iniciar atendimento / Encerrar / Reabrir",
          "\"Encerrar sem Mensagem\" (menu \"...\"): encerra sem disparar a mensagem automática de encerramento, se ela estiver ligada",
          "Atribuir responsável, mudar prioridade, mudar status manualmente",
          "Enviar mensagem de texto, com emoji (categorias, insere no cursor), anexar qualquer arquivo aceito pelo WhatsApp (foto/vídeo/áudio até 16MB; PDF, Word, Excel, ZIP e outros documentos até 100MB) por arquivo ou colando (Ctrl+V) uma imagem copiada, gravar áudio pelo microfone",
          "Digitar \"/\" no campo de mensagem abre a lista de respostas rápidas cadastradas em Configurações — \"/\" + parte do atalho filtra; escolher preenche o campo, Enter envia",
          "Criar oportunidade direto da conversa (se o contato já estiver identificado)",
          "Número não identificado (quadro amarelo no painel lateral, quando o número não bate com nenhum cadastro): \"Já existe no CRM?\" → Contato existente (liga a conversa a um contato já cadastrado) ou Cliente (liga a um cliente — o botão \"Novo\" ao lado da busca abre o cadastro de cliente com este contato e a empresa dele já preenchidos e, ao salvar, já liga a conversa ao cliente novo); \"É alguém novo?\" → Novo contato (completa o cadastro deste número) ou Novo lead (cria um lead com os dados do contato)",
          "Renomear o contato pelo lápis ao lado do nome, ou voltar ao nome do WhatsApp em \"Usar este nome\"",
        ],
        fields: [
          "Mensagens recebidas: texto, foto, vídeo, áudio, documento, figurinha (inclusive animada), localização (com link Abrir no mapa), contato compartilhado, enquete, respostas de botão/lista, mensagem temporária e de visualização única; reação, mensagem apagada e editada viram avisos na conversa. Tipos ainda não suportados aparecem com um aviso (\"veja no WhatsApp do celular\")",
          "Painel lateral do contato: foto de perfil do WhatsApp (quando o contato tem e usa a Neonize; senão, as iniciais) ao lado do nome, telefone, empresa, cliente vinculado, lead, tarefas e histórico de conversas anteriores — oportunidade e instalação ficam no cadastro do Cliente, não aparecem mais aqui",
        ],
        notes: [
          "Só é possível responder numa conversa que já tenha um responsável e não esteja encerrada.",
          "Criar oportunidade: botão no fim do painel lateral, só quando a empresa do contato ainda não é cliente e para quem tem a permissão \"Criar oportunidade pelo Atendimento\" (padrão Vendedor e Administrador).",
          "Se o envio de uma mensagem (texto, foto, áudio etc.) falhar de verdade no WhatsApp, aparece um aviso na hora — não só o ícone discreto de falha na bolha.",
          "Uma conversa Encerrada some da Central para todo mundo — só é possível reabri-la pelo Relatório de Atendimentos ou pelo menu \"...\" se você ainda tiver o link direto.",
          "O status mostrado na tela (Aguardando atendimento, Em atendimento etc.) é calculado a partir de quem está atribuído — não é um campo solto que se define sozinho.",
          "Atendimento e Vendedor só veem conversas próprias ou sem responsável; Administrador e Gerente veem todas.",
          "Mensagens automáticas de boas-vindas, encerramento e fora do horário são configuradas em Configurações > Atendimento, aba Mensagens automáticas (só Administrador).",
          "Cultura/Modelo: quando a conversa é de um cliente (pelo vínculo da conversa, pela empresa do contato ou pelo próprio contato) que tem algo escrito na aba Cultura/Modelo da ficha, aparece uma faixa logo abaixo do cabeçalho do chat — amarela com o aviso em destaque, se houver — e o botão \"Ver Cultura/Modelo\" abre o documento num pop-up. O mesmo fica no painel lateral, no bloco Cultura/Modelo.",
          "Mídia apagada em Configurações > Limpeza continua como mensagem no histórico, com o aviso \"Arquivo removido na limpeza de mídias em <data>\".",
        ],
      },
      {
        id: "atendimento-dashboard",
        title: "Dashboard",
        path: "/atendimento/dashboard",
        status: "ready",
        purpose:
          "Painel visual pensado pra ficar numa tela do escritório: números grandes, ranking de quem mais atendeu no dia e gráfico de atendimentos por hora. Atualiza sozinho a cada minuto, sem precisar de ninguém mexendo.",
        fields: [
          "Atendimentos concluídos hoje, novas conversas hoje, em atendimento agora, aguardando atendimento e tempo médio de atendimento",
          "Ranking de quem mais encerrou atendimento hoje (top 6)",
          "Gráfico de atendimentos concluídos por hora (7h às 20h)",
          "Quadro \"Top 5 atendentes\": ranking geral (não só hoje) por total de atendimentos concluídos, com 1º/2º/3º em ouro/prata/bronze e as colunas \"Este mês\" e \"Total\"",
        ],
        notes: [
          "É uma visão da equipe inteira (não escopada por usuário) — todo perfil com acesso à Central vê os mesmos números.",
        ],
      },
    ],
  },
  {
    id: "clientes",
    title: "Clientes",
    icon: Building2,
    roles: "Todos, exceto quando o módulo específico não se aplica (ver cada tela)",
    intro:
      "Empresa, Contato e Cliente são três coisas diferentes aqui dentro — veja a explicação em \"Conceitos gerais\" antes de usar estas três telas.",
    screens: [
      {
        id: "clientes-clientes",
        title: "Clientes",
        path: "/clientes",
        status: "ready",
        purpose: "Lista de quem já é cliente (empresa ou contato avulso), seja porque ganhou uma venda ou foi cadastrado manualmente.",
        fields: [
          "Empresa e/ou Contato vinculado (pelo menos um dos dois é obrigatório)",
          "Status (Ativo/Inativo), Responsável, Região, Observações",
        ],
        filters: [
          "Busca livre (nome, empresa, CNPJ, telefone, WhatsApp)",
          "Status, Responsável, \"Cliente desde\" (período)",
          "Ordenação: cliente desde (recente/antigo), criado recentemente",
        ],
        actions: ["Novo Cliente (com atalho para criar Empresa/Contato na hora)", "Editar"],
        notes: [
          "Clicar na linha da listagem abre o detalhe do cliente; Ctrl+clique abre em nova aba.",
          "Não existe arquivar/excluir um Cliente — só editar o status para Inativo.",
          "Detalhe do cliente reúne contatos da empresa, vendas, instalações e histórico, tudo num só lugar.",
          "Aba Cultura/Modelo (ao lado de Visão geral, no detalhe do cliente): um documento sobre como esta empresa funciona — regras (ex.: \"não criar funcionário\"), acessos (ex.: \"usa VPN própria\"), pessoas-chave e observações. Editor como o do Word: estilos de título, fonte, tamanho, cor, marca-texto, negrito/itálico/sublinhado/tachado, alinhamento, listas (inclusive de verificação), citação, linha divisória, link e tabela. \"Inserir modelo\" coloca um roteiro com seções sugeridas.",
          "Aviso em destaque (na aba Cultura/Modelo): uma frase curta que aparece em amarelo no topo do detalhe do cliente e em toda conversa do Atendimento com este cliente.",
          "Quem pode editar o cliente pode editar a Cultura/Modelo; quem atende a conversa só lê. Cada alteração fica no histórico do cliente com autor e data.",
          "Só o Vendedor tem visão restrita (próprios + sem responsável); os outros perfis com acesso veem todos os clientes.",
        ],
      },
      {
        id: "clientes-contatos",
        title: "Contatos",
        path: "/clientes/contatos",
        status: "ready",
        purpose: "Cadastro de pessoas físicas, ligadas ou não a uma empresa.",
        fields: [
          "Nome, Telefone, WhatsApp, E-mail",
          "Cargo, Departamento, Tipo de vínculo (Funcionário, Gerente, Diretor, Sócio, Responsável, Financeiro, Técnico, Outro)",
          "\"Contato principal da empresa\" (checkbox), Empresa (ou sem empresa)",
          "Origem, Responsável, \"Contato ativo\" (checkbox), Observações",
        ],
        filters: [
          "Busca livre (nome, telefone, WhatsApp, e-mail, empresa)",
          "Empresa, Origem, Responsável, Mostrar arquivados",
          "Ordenação: mais recentes/antigos, nome A-Z, última interação",
        ],
        actions: ["Novo contato", "Editar", "Arquivar / Restaurar", "Atendimento"],
        notes: [
          "Ao salvar, o sistema avisa se já existe um contato parecido (telefone/WhatsApp/e-mail igual) e deixa escolher entre usar o já existente ou continuar mesmo assim.",
          "\"Contato ativo\" é um status de negócio; \"Arquivar\" é a exclusão suave — são coisas diferentes.",
          "Renomear: na tela do contato e no painel do Atendimento, o lápis ao lado do nome troca o nome na hora. O padrão é o nome do perfil do WhatsApp; se o nome no CRM for diferente, aparece \"No WhatsApp: …\" com o botão \"Usar este nome\" para voltar a ele.",
          "Tela do contato (clicar na linha da listagem, ou ⋯ > Ver detalhes): foto do WhatsApp (só com a Neonize; sem foto, mostra as iniciais), totais de Atendimentos/Oportunidades/Vendas/Instalações, todas as informações do cadastro (WhatsApp e e-mail clicáveis), dados da empresa, o bloco Comercial (cliente, últimas oportunidades, vendas e instalações) e os 10 atendimentos mais recentes — data, status, fila, atendente, quantidade de mensagens, duração e a última mensagem. Clicar num atendimento abre a conversa no Atendimento.",
        ],
      },
      {
        id: "clientes-empresas",
        title: "Empresas",
        path: "/clientes/empresas",
        status: "ready",
        purpose: "Cadastro de pessoas jurídicas (a entidade da empresa em si, separada dos contatos que trabalham nela).",
        fields: [
          "Razão social, Nome fantasia, CNPJ (com lupa de consulta automática)",
          "Telefone, WhatsApp, E-mail, Site",
          "Origem, Responsável, Região, \"Empresa ativa\" (checkbox)",
          "Endereço, Número, Complemento, Bairro, CEP (auto-completa UF/cidade/bairro/logradouro), Estado, Cidade",
          "Observações",
        ],
        filters: [
          "Busca livre (razão social, nome fantasia, CNPJ, telefone, e-mail)",
          "Origem, Responsável, Mostrar arquivadas",
          "Ordenação: mais recentes/antigas, razão social A-Z",
        ],
        actions: ["Nova empresa", "Editar", "Arquivar / Restaurar"],
        notes: [
          "Clicar na linha da listagem abre a tela da empresa (o mesmo que ⋯ > Ver detalhes); Ctrl+clique abre em nova aba.",
          "Coluna Cliente (e ao lado do nome, na tela da empresa): \"Cliente\" quando a empresa já é cliente — clicar abre o cadastro do cliente; senão, o botão \"Tornar cliente\" cria o cliente na hora (status Ativo, mesmo responsável e região da empresa, sem criar venda nem instalação).",
          "Mesmo aviso de possível duplicidade que existe em Contatos, disparado por CNPJ/telefone/e-mail iguais.",
          "A lupa ao lado do CNPJ preenche razão social, nome fantasia, telefone, e-mail e endereço completo automaticamente.",
        ],
      },
    ],
  },
  {
    id: "instalacoes",
    title: "Instalações",
    icon: Wrench,
    roles: "Administrador, Gerente, Instalador",
    screens: [
      {
        id: "instalacoes-kanban",
        title: "Kanban de Instalação",
        path: "/instalacoes/kanban",
        status: "ready",
        purpose: "Funil arrasta-e-solta das instalações em andamento, por etapa.",
        filters: ["Etapa, Status, Prioridade, Responsável, busca livre, região"],
        actions: [
          "Arrastar pra qualquer posição — dentro da mesma etapa (reordena) ou pra outra etapa — ou usar \"Mover para etapa\" no menu \"...\", sem arrastar",
          "Atendimento (atalho no card)",
        ],
        fields: ["Cada card mostra a barra de progresso do checklist e fica com borda vermelha (\"atrasada\") quando o prazo já passou — não mostra mais o valor da venda (fica só na tela do Cliente e na lista de Instalações)"],
        notes: [
          "Não existe criação manual aqui — instalações só nascem quando uma oportunidade vira venda.",
          "Mover para a etapa \"Concluída\" é bloqueado se algum item obrigatório do checklist ainda estiver pendente — a mensagem de erro lista exatamente quais itens faltam.",
          "Instalador só vê as instalações próprias + sem responsável; Administrador e Gerente veem todas.",
          "A ordem dentro de uma etapa sempre respeita a prioridade primeiro (Urgente > Alta > Normal > Baixa) — arrastar deixa reposicionar livremente dentro da própria faixa de prioridade, mas não dá pra intercalar com uma faixa diferente.",
        ],
      },
      {
        id: "instalacoes-lista",
        title: "Instalações",
        path: "/instalacoes",
        status: "ready",
        purpose: "Tabela das instalações (mesma base do Kanban), com o detalhe de cada uma abrindo o checklist completo.",
        fields: [
          "Editável na lista: Responsável, Prioridade, Data agendada, Prazo, Observações",
          "Coluna de valor da venda na própria tabela",
          "Detalhe: dados da venda/oportunidade de origem, checklist item a item (quem marcou e quando), tarefas e histórico — sem os valores financeiros, que já aparecem na tabela e na tela do Cliente",
        ],
        filters: ["Busca livre (empresa/contato), Etapa, Status (Em andamento/Concluída/Cancelada), Prioridade, Responsável, ordenação por data/prazo"],
        actions: [
          "Editar",
          "Marcar/desmarcar itens do checklist",
          "Adicionar item extra ao checklist da instalação (não obrigatório por padrão, vale só para essa instalação)",
          "Atendimento",
        ],
        notes: [
          "O checklist de cada instalação é uma cópia feita no momento da criação — editar o modelo em Configurações não muda instalações que já existem.",
        ],
      },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    roles: "Administrador, Gerente, Financeiro",
    screens: [
      {
        id: "financeiro-home",
        title: "Financeiro",
        path: "/financeiro",
        status: "soon",
        purpose: "Contas a receber, comissões e relatório financeiro consolidado. Ainda não implementado — hoje o menu existe, mas a tela não.",
      },
    ],
  },
  {
    id: "catalogo",
    title: "Catálogo",
    icon: Boxes,
    roles: "Administrador, Gerente, Vendedor",
    screens: [
      {
        id: "catalogo-produtos",
        title: "Produtos",
        path: "/catalogo/produtos",
        status: "soon",
        purpose: "Cadastro de produtos vendáveis, para vincular a propostas/oportunidades. Ainda não implementado.",
      },
      {
        id: "catalogo-servicos",
        title: "Serviços",
        path: "/catalogo/servicos",
        status: "soon",
        purpose: "Cadastro de serviços vendáveis. Ainda não implementado.",
      },
      {
        id: "catalogo-planos",
        title: "Planos",
        path: "/catalogo/planos",
        status: "soon",
        purpose: "Cadastro de planos recorrentes. Ainda não implementado.",
      },
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios",
    icon: LineChart,
    roles: "Varia por tipo de relatório — ver cada um abaixo",
    intro:
      "Os três relatórios têm a mesma lógica: tabela filtrável + botão \"Exportar PDF\" (abre uma prévia real na tela, com opção de baixar o arquivo ou abrir o WhatsApp Web para anexar manualmente — o navegador não permite anexar automaticamente numa outra aba). O botão \"Filtros\" é igual nos três: busca específica por Contato e por Empresa (digite 2+ letras e escolha na lista), um campo \"Um dia específico\" para um único dia sem precisar preencher De/Até, período (De/Até) e Responsável — além dos filtros próprios de cada relatório (Status, Origem etc.).",
    screens: [
      {
        id: "relatorios-atendimentos",
        title: "Relatório de Atendimentos",
        path: "/relatorios/atendimentos",
        status: "ready",
        roles: "Administrador, Gerente, Atendimento",
        purpose: "Consultar (somente leitura) o histórico completo de conversas de WhatsApp.",
        filters: [
          "Busca livre (nome, telefone, empresa, conteúdo da conversa)",
          "Status (Todas/Em andamento/Encerradas), quem atendeu",
          "Contato específico, Empresa específica, um dia específico, período (de/até)",
        ],
        fields: ["Colunas: Contato, Empresa, Quem atendeu, Status, Última mensagem"],
        actions: ["Abrir conversa (transcrição completa, sem opção de responder)", "Reabrir (se a conversa estiver encerrada)", "Exportar PDF"],
      },
      {
        id: "relatorios-comercial",
        title: "Relatório Comercial",
        path: "/relatorios/comercial",
        status: "ready",
        roles: "Administrador, Gerente, Vendedor, Financeiro",
        purpose: "Consultar oportunidades com filtros mais amplos que a tela de Oportunidades, pensado para análise e exportação.",
        filters: [
          "Busca livre (título, empresa, contato), Status (Em aberto/Ganha/Perdida), Responsável, Origem",
          "Contato específico, Empresa específica, um dia específico, período (de/até)",
        ],
        fields: [
          "Colunas na tela: Título, Empresa/Contato, Responsável, Etapa, Valor, Status, Temperatura, Criada em",
          "Colunas no PDF: as mesmas, trocando Temperatura por Origem",
        ],
        actions: ["Exportar PDF"],
        notes: ["Region chips também disponíveis para filtrar por região."],
      },
      {
        id: "relatorios-instalacoes",
        title: "Relatório de Instalações",
        path: "/relatorios/instalacoes",
        status: "ready",
        roles: "Administrador, Gerente, Instalador",
        purpose: "Consultar instalações com filtro por responsável, status e período, com o percentual de checklist concluído.",
        filters: [
          "Busca livre (cliente/empresa), Status (Em andamento/Concluída/Cancelada), Responsável",
          "Contato específico, Empresa específica, um dia específico, período (de/até)",
        ],
        fields: ["Colunas: Cliente, Responsável, Etapa, Status, Checklist (feito/total e %), Agendada, Concluída, Criada em"],
        actions: ["Exportar PDF"],
      },
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: CalendarDays,
    roles: "Todos os perfis",
    screens: [
      {
        id: "agenda-home",
        title: "Agenda",
        path: "/agenda",
        status: "ready",
        purpose:
          "Calendário único que reúne tarefas, instalações agendadas e a próxima ação de cada lead — tudo num só lugar. Clicar num compromisso leva de volta pro registro original (Atendimento/CRM/Instalação); uma tarefa \"Geral\", que não tem registro dono, abre num pop-up com os dados, edição e concluir/reabrir.",
        fields: [
          "Categorias (ligar/desligar como no Google Agenda): Atendimento, CRM, Instalação, Geral",
          "4 visões: Lista (com seletor de \"próximos N dias\"), Grade (dia único, clique num horário pra já criar tarefa naquele horário), Semana (quadro com uma coluna por dia, de segunda a domingo) e Calendário (mês)",
          "Ícone de calendário ao lado da data: na Semana mostra a semana da data escolhida; na Grade e no Calendário, o dia; na Lista, só aquele dia (com botão para voltar aos próximos dias)",
          "Estrela em cada aba de visão: marca a visão padrão, que abre sempre que você entra na Agenda (clicar de novo tira)",
          "Filtro por pessoa (só Administrador e Gerente), ao lado das categorias",
          "Cada pessoa tem uma cor própria nos compromissos (faixa lateral e nome em negrito)",
          "Na visão Lista, um quadro \"Pendentes\" acima do calendário lista as tarefas não concluídas que ficaram para trás (sem prazo definido ou atrasadas de dias anteriores) — continuam aparecendo ali até serem concluídas, com um checkbox pra marcar como feita direto dali.",
        ],
        actions: [
          "Nova tarefa (cria uma tarefa \"Geral\", com Título, Descrição, Prazo, Duração, Repetir, Prioridade, Responsável)",
          "Arrastar uma tarefa para reagendar: na Semana muda o dia (mantém o horário), na Grade muda a hora, no Calendário arraste da lista do dia até outro dia. O responsável é avisado",
          "Concluir direto pela caixa no compromisso (Grade, Semana e Calendário). Tarefa que repete cria a próxima ocorrência ao ser concluída",
          "Repetir: todo dia, toda semana (marcando os dias, ex.: seg/qua/sex), a cada 15 dias ou todo mês (escolhendo o dia, ex.: todo dia 18). As próximas repetições aparecem na Agenda em todos os dias, com borda tracejada e \"repetição\" — não dá para arrastar ou concluir a repetição futura, só a ocorrência atual",
          "Lembrete automático por WhatsApp: escolha 15min/30min/1h/1 dia antes do prazo, ou um valor customizado — dá pra empilhar mais de um lembrete na mesma tarefa",
        ],
        notes: [
          "O lembrete só chega se o responsável tiver telefone cadastrado em Configurações > Usuários.",
          "Conflito de horário: ao salvar ou arrastar uma tarefa para um horário em que o responsável já tem outra, aparece um aviso (não impede salvar). Sem duração, a tarefa conta como 30 minutos.",
          "Resumo do dia: às 7h (Brasília), quem tem compromissos no dia recebe a lista no sino; pelo WhatsApp só com a opção ligada em Configurações > Mensagens automáticas.",
          "Só tarefas podem ser arrastadas — instalação agendada e próxima ação de lead se reagendam no próprio registro.",
          "Administrador e Gerente veem a agenda (e o quadro Pendentes) de todo mundo; os demais perfis só veem a própria (+ tarefas sem responsável).",
          "Só aparecem as categorias que fazem sentido pro seu perfil — por exemplo, quem não acessa Instalações não vê a categoria Instalação aqui.",
          "Toda vez que uma tarefa é agendada (ou reagendada) para alguém, essa pessoa recebe uma notificação no sino do cabeçalho — e um aviso rápido na tela, se estiver com o sistema aberto na hora. O lembrete de prazo (WhatsApp) também gera uma notificação no sino.",
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    roles: "Somente Administrador",
    screens: [
      {
        id: "config-usuarios",
        title: "Usuários",
        path: "/configuracoes/usuarios",
        status: "ready",
        purpose: "Criar contas de acesso e controlar quem está ativo no sistema.",
        fields: ["Nome, E-mail, Senha provisória, Telefone (usado só pra mandar lembrete de agenda no WhatsApp — nunca aparece pro cliente)", "Perfil (Administrador, Gerente, Vendedor, Atendimento, Instalador, Financeiro)"],
        actions: [
          "Novo usuário",
          "Editar (ícone de lápis): muda a foto de perfil (Adicionar/Trocar/Remover — salva na hora), Nome, E-mail e Telefone de qualquer usuário, e pode definir uma senha nova pra ele (reset — não pede a senha antiga)",
          "Ativar / Desativar",
        ],
        notes: [
          "Não existe editar o perfil de um usuário depois de criado, nem excluir — só desativar.",
          "Ninguém consegue desativar a própria conta.",
          "Não existe editar o Perfil (função) de um usuário depois de criado — isso continua fixo.",
        ],
      },
      {
        id: "config-regioes",
        title: "Regiões",
        path: "/configuracoes/regioes",
        status: "ready",
        purpose: "Cadastro das regiões usadas para filtrar Kanban/Dashboard/Relatórios e marcar Empresas/Clientes.",
        fields: ["Nome, Cor (seletor de cor + campo hex)"],
        actions: ["Nova região", "Editar", "Arquivar / Restaurar"],
        notes: [
          "Nome de região não pode repetir — se já existir uma arquivada com o mesmo nome, o sistema sugere restaurá-la em vez de criar outra.",
          "A região marcada como padrão não pode ser arquivada (ela é o fallback de quem não tem região definida).",
        ],
      },
      {
        id: "config-checklist",
        title: "Checklist de Instalação",
        path: "/configuracoes/checklist",
        status: "ready",
        purpose: "Modelo padrão de checklist que é copiado para toda instalação nova.",
        fields: ["Texto do item", "Obrigatório (checkbox — bloqueia concluir a instalação enquanto o item estiver pendente)"],
        actions: ["Novo item", "Editar", "Reordenar (subir/descer)", "Excluir"],
        notes: ["Editar o modelo aqui não muda instalações que já existem — a cópia é feita só no momento da criação."],
      },
      {
        id: "config-permissoes",
        title: "Permissões (aba de Usuários)",
        path: "/configuracoes/permissoes",
        status: "ready",
        purpose:
          "Escolher, para cada pessoa, quais telas ela vê e quais ações pode fazer, ligando ou desligando cada uma (on/off). Um menu que a pessoa não pode ver simplesmente não aparece mais pra ela.",
        fields: [
          "Tabela: usuário, perfil e acesso (quantas telas a pessoa vê, e a marca \"Personalizado\" quando algo difere do padrão do perfil). Administradores sem ajuste aparecem como \"Acesso total\"",
          "Telas — o que pode ver: um interruptor on/off por módulo (Dashboard, CRM, Atendimento, Clientes, Instalações, Financeiro, Catálogo, cada tipo de Relatório, Agenda)",
          "Ações — o que pode fazer: um interruptor on/off por ação (editar etapas do Kanban, arquivar Leads/Oportunidades, exportar PDF dos Relatórios, ver valores no Financeiro)",
        ],
        actions: [
          "Permissões (botão por usuário): abre a lista de interruptores, já marcada com o que a pessoa tem hoje",
          "Voltar ao padrão do perfil: desfaz todos os ajustes da pessoa (só vale depois de Salvar)",
          "Salvar",
        ],
        notes: [
          "Administrador é o super usuário: sempre tem acesso total, não pode ser restringido, e qualquer Administrador pode editar as permissões dos demais usuários.",
          "Configurações (usuários, permissões, integrações) é exclusiva de Administrador — não aparece na lista de interruptores e continua sempre liberada para Administradores.",
          "Administradores também podem ter telas e ações ajustadas (botão Permissões na linha deles).",
          "Ação \"Ver atendimento de todos\": vê e interage com os atendimentos de todo mundo (lista, conversas e Quadro com seletor de atendente). Padrão: ligada para Administrador e Gerente.",
          "Ação \"Criar oportunidade pelo Atendimento\": mostra o botão Criar oportunidade no fim do painel da conversa (só quando a empresa do contato ainda não é cliente). Padrão: ligada para Vendedor e Administrador.",
          "Só é gravado o que difere do padrão do perfil: se o perfil da pessoa mudar depois, o resto acompanha o padrão novo.",
          "Aplica na próxima navegação da pessoa, sem precisar ela relogar.",
          "Toda alteração fica registrada no histórico de atividades.",
        ],
      },
      {
        id: "config-kanbans",
        title: "Kanbans",
        path: "/configuracoes/kanbans",
        status: "ready",
        purpose: "Etapas (colunas) do Kanban Comercial e do Kanban de Instalação — criar, editar, reordenar, colorir e arquivar.",
        fields: ["Nome, Cor (mesmo seletor de cor das Regiões)"],
        actions: ["Nova etapa", "Editar", "Reordenar (subir/descer)", "Remover / Restaurar"],
        notes: [
          "As etapas \"Ganha\"/\"Perdida\" (comercial) e \"Concluída\"/\"Cancelada\" (instalação) são usadas pelo próprio sistema e não podem ser removidas — só renomeadas e recoloridas.",
          "Uma etapa só pode ser removida se não tiver nenhum registro nela no momento; mesmo assim, a remoção é reversível.",
          "A tela tem uma aba para cada Kanban (CRM e Instalação), ao lado do título. \"Nova etapa\" cria a etapa no Kanban da aba aberta.",
        ],
      },
      {
        id: "config-respostas-rapidas",
        title: "Respostas rápidas (aba de Atendimento)",
        path: "/configuracoes/respostas-rapidas",
        status: "ready",
        purpose: "Atalhos de mensagem pronta usados no campo de texto do Atendimento (digitar \"/\" abre a lista).",
        fields: ["Atalho (sem a barra, ex: \"p\")", "Mensagem"],
        actions: ["Nova resposta rápida", "Editar", "Remover"],
        notes: ["O atalho é único — não dá para cadastrar duas respostas rápidas com o mesmo atalho."],
      },
      {
        id: "config-atendimento-automatico",
        title: "Mensagens automáticas (aba de Atendimento)",
        path: "/configuracoes/atendimento-automatico",
        status: "ready",
        purpose: "Mensagens que o sistema manda sozinho pelo WhatsApp — três do Atendimento e os lembretes da Agenda — cada uma com seu próprio liga/desliga.",
        fields: [
          "Boas-vindas: texto enviado quando um contato novo chega sem nenhum atendimento em andamento",
          "Encerramento: texto enviado ao encerrar o atendimento",
          "Fora do horário: a partir de que horário considerar fora do expediente, e o texto enviado (no máximo 1x por dia por conversa)",
          "Lembretes da Agenda: liga/desliga o envio dos lembretes de tarefas pelo WhatsApp do responsável (ligado por padrão)",
        ],
        notes: [
          "Cada uma é independente — dá para ligar só uma, todas, ou nenhuma.",
          "Com os lembretes da Agenda desligados, o aviso continua aparecendo no sino de notificações; só não sai pelo WhatsApp. Lembretes que vencerem nesse período não são reenviados ao religar.",
          "Com os lembretes da Agenda desligados, o campo \"Lembrete automático (WhatsApp para o responsável)\" some de todos os formulários de tarefa, e o telefone no cadastro de usuários e em Meu perfil passa a se chamar só \"Telefone\".",
        ],
      },
      {
        id: "config-integracoes",
        title: "Integrações",
        path: "/configuracoes/integracoes",
        status: "ready",
        purpose: "Configura as integrações externas: qual API o WhatsApp usa (Neonize ou API oficial da Meta) e a API key da Prospecção CNPJ.",
        fields: [
          "WhatsApp > Qual API usar?: Neonize (QR code), API oficial (Meta) ou Nenhum (manual) — a opção marcada como \"Ativo\" é usada nas conversas novas",
          "Neonize: mostra Não configurado, Conectando... (restaurando a sessão salva), Conectado, Desconectado (depois de deslogar), Aguardando pareamento (com QR code para escanear em \"Aparelhos conectados\" do WhatsApp, atualizado sozinho), ou o erro com o motivo (Serviço parado, Segredo não confere, Erro no serviço) e o último log do serviço",
          "API oficial: status (Não configurado, Erro na conexão ou Conectado com nome/número/qualidade), URL de callback e Verify token para copiar, campos Phone Number ID, Token de acesso permanente e App Secret, e o passo a passo de configuração na Meta",
          "Prospecção CNPJ: mostra Configurado/não configurado, e um campo para colar a API key da CFO.com.br",
        ],
        actions: [
          "Trocar a API do WhatsApp (clicar na opção desejada)",
          "Neonize: Atualizar (recarrega o QR code, que expira em ~20s), Deslogar, Gerar QR novamente, Reiniciar serviço, Parar serviço",
          "Neonize com o serviço fora do ar: Iniciar serviço (quando está parado), Reiniciar serviço (quando responde com erro) e Verificar de novo",
          "API oficial: Gerar verify token, Salvar credenciais (campo em branco mantém o valor já salvo), Remover configuração",
          "Salvar/Trocar/Remover a API key da CFO (fica salva no banco, sem precisar mexer no .env nem reiniciar o servidor)",
        ],
        notes: [
          "Somente administradores acessam esta tela.",
          "Iniciar/Reiniciar serviço só funcionam quando o whatsapp-service roda no mesmo computador do CRM (WHATSAPP_SERVICE_URL em localhost). Em produção, o serviço é iniciado no painel do servidor (ex.: Render).",
          "Uma conversa já aberta continua no canal antigo até o cliente mandar uma mensagem pelo canal novo.",
          "API oficial: só é possível mandar mensagem livre até 24h depois da última mensagem do cliente (regra da Meta); fora disso a Meta exige modelo aprovado, que o CRM ainda não envia. Mídias recebidas ficam disponíveis por ~30 dias (prazo da Meta).",
        ],
      },
      {
        id: "config-atualizacoes",
        title: "Atualizações do sistema",
        status: "ready",
        roles: "Aviso e botão: Administrador. Tela de \"Sistema atualizando…\": todos",
        purpose: "Como o CRM recebe versões novas — sem precisar reinstalar nada à mão.",
        actions: [
          "Ver novidades: abre a lista do que mudou na versão nova",
          "Atualizar agora: instala a versão nova (pede confirmação)",
          "X (Depois): esconde o aviso até a próxima versão",
        ],
        notes: [
          "O sistema confere de hora em hora se há versão nova; quando há, os administradores veem o aviso \"Nova versão disponível\" no topo das telas.",
          "Durante a instalação o CRM fica fora do ar por alguns minutos para todos: as telas mostram \"Sistema atualizando…\" e voltam sozinhas no fim. As mensagens do WhatsApp que chegarem nesse meio-tempo aparecem quando o sistema voltar (o WhatsApp entrega as pendentes ao reconectar).",
          "Antes de atualizar é feito um backup do banco; se a versão nova não subir, o sistema volta para a anterior sozinho.",
          "Atualização obrigatória: aparece em todas as telas uma faixa amarela com contagem regressiva de 5 minutos e depois a instalação começa sozinha.",
          "A versão instalada aparece no rodapé da Central de Ajuda e no Histórico de versões.",
        ],
      },
      {
        id: "config-backup",
        title: "Backup",
        path: "/configuracoes/backup",
        status: "ready",
        purpose: "Cópias de segurança do banco de dados do CRM (clientes, conversas, tarefas, usuários, configurações), automáticas e manuais.",
        fields: [
          "Fazer backup automático (liga/desliga — ligado por padrão)",
          "Horário e dias da semana (horário de Brasília; padrão 12:00, todos os dias)",
          "Pasta onde salvar (em branco = pasta padrão; pode ser HD externo, pasta da rede como \\\\SERVIDOR\\Backups ou pasta sincronizada com Google Drive/OneDrive)",
          "Quantos backups guardar (os mais antigos são apagados; padrão 7)",
          "Copiar também as mídias do WhatsApp (subpasta \"midias\", só as novas a cada backup)",
        ],
        actions: [
          "Fazer backup agora",
          "Baixar um backup (arquivo .db)",
          "Restaurar um backup (só no CRM instalado): o CRM volta a ficar como estava naquele momento e reinicia sozinho",
          "Apagar um backup",
        ],
        notes: [
          "Somente administradores acessam esta tela.",
          "O backup é feito sem parar o sistema e sai sempre consistente, mesmo com gente usando o CRM na hora.",
          "Computador desligado no horário: o backup é feito assim que o CRM ligar, no mesmo dia. Roda no máximo uma vez por dia.",
          "Se o backup automático falhar (ex.: HD externo desconectado), os administradores recebem um aviso no sino.",
          "Restaurar não perde o banco atual: ele é guardado antes em backups\\antes-de-restaurar. Ao instalar uma versão nova do CRM, um backup também é feito sozinho em backups\\atualizacoes antes de atualizar o banco.",
        ],
      },
      {
        id: "config-limpeza",
        title: "Limpeza (aba de Backup)",
        path: "/configuracoes/limpeza",
        status: "ready",
        purpose: "Ver e apagar as mídias do WhatsApp guardadas neste computador (fotos, vídeos, áudios, documentos, figurinhas) e programar a limpeza automática das antigas.",
        fields: [
          "Resumo: espaço total e por tipo de mídia",
          "Limpeza programada: liga/desliga (desligada por padrão), apagar mídias com mais de N meses, horário, tipos de mídia",
          "Copiar para a pasta de backup antes de apagar (ligado por padrão)",
        ],
        filters: [
          "Mídias de um contato: digitar nome ou telefone e escolher o contato na lista (com a quantidade de mídias de cada um) — a galeria mostra só as das conversas dele; o X volta para todos",
          "Tipo (Imagens, Vídeos, Áudios, Documentos, Figurinhas — nenhum marcado = todos)",
          "Idade (qualquer data, + de 1, 3, 6 meses ou 1 ano)",
          "Ordenação (mais recentes, mais antigas, maiores)",
        ],
        actions: [
          "Clicar numa mídia: abre a pré-visualização (imagem, vídeo, áudio ou link do documento) com o contato, a data e o atalho \"Abrir conversa\"",
          "Selecionar mídias (ou a página toda) e Apagar selecionadas",
          "Apagar todas do filtro (inclui as outras páginas)",
        ],
        notes: [
          "Somente administradores acessam esta tela.",
          "Fica numa aba ao lado de Backup (Configurações > Backup > Limpeza).",
          "A mensagem continua no histórico do atendimento — só o arquivo é apagado; o balão passa a avisar que a mídia foi removida.",
          "Com \"Copiar para a pasta de backup antes de apagar\", o arquivo continua guardado na subpasta \"midias\" da pasta de Backup.",
          "A limpeza programada roda no máximo uma vez por dia, depois do horário escolhido (e depois do backup do dia). A tela mostra quantos arquivos a regra salva apagaria hoje.",
        ],
      },
    ],
  },
];

export const FUTURE_ITEMS: string[] = [
  "Busca global (a barra de busca no topo já existe visualmente, mas ainda está desativada)",
  "Notificações reais (o sininho já mostra contagem, mas nenhuma notificação é gerada ainda)",
  "Emoji no composer do Atendimento",
  "Mensagens prontas / modelos de resposta no Atendimento",
  "Financeiro (contas a receber, comissões, relatório financeiro)",
  "Catálogo de Produtos, Serviços e Planos",
  "Propostas comerciais geradas a partir de uma Oportunidade",
  "Edição fina de Permissões por perfil",
];
