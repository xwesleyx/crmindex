export type ChangelogEntry = {
  version: string;
  date: string; // AAAA-MM-DD
  title: string;
  changes: string[];
};

// Histórico de versões do sistema, mostrado na Central de Ajuda (/ajuda).
// Convenção: toda alteração relevante entregue ganha uma entrada nova no
// topo desta lista (mais recente primeiro) e a versão sobe (1.0 -> 1.1 ->
// 1.2..., ou vira 2.0 numa revisão grande). Nunca editar uma entrada já
// publicada — sempre adicionar uma nova.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.67",
    date: "2026-10-14",
    title: "Atualizações automáticas e licença por CNPJ",
    changes: [
      "Quando sai uma versão nova, os administradores veem no topo das telas o aviso \"Nova versão disponível\", com \"Ver novidades\", \"Atualizar agora\" e a opção de deixar para depois.",
      "Durante a atualização, todas as telas mostram \"Sistema atualizando…\" e voltam sozinhas quando termina. Um backup do banco é feito antes e, se a versão nova não subir, o sistema volta para a anterior.",
      "Atualização obrigatória: um aviso com contagem regressiva de 5 minutos aparece em todas as telas antes de começar, para dar tempo de salvar o que estiver fazendo.",
      "A instalação agora é vinculada ao CNPJ do cliente, informado no instalador, e o sistema confere a licença periodicamente.",
      "O instalador não mostra mais dados de acesso na tela final.",
    ],
  },
  {
    version: "1.66",
    date: "2026-10-14",
    title: "Atendimento: Encerrar em destaque e Criar oportunidade por permissão",
    changes: [
      "O botão \"Encerrar atendimento\" ficou vermelho cheio e em negrito.",
      "\"Criar oportunidade\" foi para o fim do painel lateral da conversa e só aparece quando a empresa do contato ainda não é cliente.",
      "Nova permissão \"Criar oportunidade pelo Atendimento\" (Configurações > Usuários > Permissões): ligada por padrão para Vendedor e Administrador, e pode ser ligada ou desligada por usuário. Sem ela, o botão não aparece.",
    ],
  },
  {
    version: "1.65",
    date: "2026-10-14",
    title: "Limpeza: mídias de um contato",
    changes: [
      "Na galeria de mídias (Configurações > Backup > Limpeza), novo campo \"Buscar mídias de um contato\": digite o nome ou o telefone, escolha o contato certo na lista (cada um mostra quantas mídias tem guardadas) e a galeria passa a mostrar só as mídias das conversas dele.",
      "Os outros filtros (tipo, idade, ordenação) continuam valendo junto, e \"Apagar todas do filtro\" apaga só as desse contato. O X ao lado do nome volta a mostrar as mídias de todos.",
    ],
  },
  {
    version: "1.64",
    date: "2026-10-14",
    title: "Limpeza virou aba do Backup",
    changes: [
      "A Limpeza de mídias saiu do menu de Configurações e virou uma aba ao lado do Backup: Configurações > Backup, abas Backup | Limpeza.",
    ],
  },
  {
    version: "1.63",
    date: "2026-10-14",
    title: "Clientes: aba Cultura/Modelo, também visível no Atendimento",
    changes: [
      "Nova aba \"Cultura/Modelo\" no detalhe do cliente (ao lado de \"Visão geral\"): um documento sobre como a empresa funciona — regras (ex.: \"não criar funcionário\"), acessos (ex.: \"usa VPN própria\"), pessoas-chave e observações.",
      "Editor como o do Word: título 1/2/3, fonte, tamanho, cor do texto, marca-texto, negrito, itálico, sublinhado, tachado, alinhamento, listas com marcadores, numeradas e de verificação, citação, linha divisória, link e tabela. \"Inserir modelo\" coloca um roteiro com seções sugeridas para começar.",
      "Aviso em destaque: uma frase curta (ex.: \"Não criar usuários sem autorização do Carlos\") que aparece em amarelo no topo do detalhe do cliente e em toda conversa com esse cliente.",
      "No Atendimento: quando a conversa é de um cliente com Cultura/Modelo, aparece uma faixa logo abaixo do cabeçalho do chat com o aviso e o botão \"Ver Cultura/Modelo\", que abre o documento num pop-up. Também fica no painel lateral da conversa.",
      "O cliente da conversa é encontrado pelo vínculo da conversa, pela empresa do contato ou pelo próprio contato. Cada alteração fica no histórico do cliente, com autor e data.",
    ],
  },
  {
    version: "1.62",
    date: "2026-10-14",
    title: "Configurações > Limpeza: mídias do WhatsApp",
    changes: [
      "Nova tela Configurações > Limpeza (só Administrador): mostra o espaço ocupado pelas mídias do WhatsApp — total e por tipo (imagens, vídeos, áudios, documentos, figurinhas).",
      "Galeria com todas as mídias: filtros por tipo e idade (mais de 1, 3, 6 meses ou 1 ano), ordenação por mais recentes, mais antigas ou maiores. Clicar abre a pré-visualização com o contato, a data e o atalho para a conversa.",
      "Apagar mídias selecionadas, a página toda ou todas as do filtro, sempre com confirmação. Por padrão, cada arquivo é copiado para a pasta de Backup antes de ser apagado.",
      "Limpeza programada: apaga sozinha, uma vez por dia no horário escolhido, as mídias com mais de N meses dos tipos marcados. Vem desligada; a tela mostra quanto a regra apagaria hoje.",
      "A mensagem continua no histórico do atendimento — só o arquivo some, e o balão avisa \"Arquivo removido na limpeza de mídias em <data>\".",
    ],
  },
  {
    version: "1.61",
    date: "2026-10-14",
    title: "Configurações > Backup",
    changes: [
      "Nova tela Configurações > Backup (só Administrador): backup automático do banco de dados com horário, dias da semana, pasta de destino e quantidade de backups guardados. Já vem ligado (12:00, todos os dias, guardando os 7 últimos).",
      "A pasta pode ser um HD externo, uma pasta da rede ou uma pasta sincronizada com Google Drive/OneDrive — assim os dados sobrevivem a um defeito no computador. O CRM confere se consegue gravar na pasta antes de salvar.",
      "Opção de copiar também as mídias do WhatsApp (só as novas a cada backup).",
      "Botão \"Fazer backup agora\", lista dos backups com Baixar, Restaurar e Apagar. Restaurar (no CRM instalado) guarda antes o banco atual e reinicia o CRM sozinho.",
      "O backup é feito sem parar o sistema. Com o computador desligado no horário, ele roda assim que o CRM ligar no mesmo dia; se falhar, os administradores recebem um aviso no sino.",
    ],
  },
  {
    version: "1.60",
    date: "2026-10-14",
    title: "Instalador e banco preparados para atualizações",
    changes: [
      "Instalação nova vem só com o usuário administrador do suporte.",
      "Senha mínima passou de 8 para 7 caracteres (login, cadastro de usuários e Meu perfil).",
      "O banco agora tem migrações versionadas: ao instalar uma versão nova por cima, o CRM faz um backup automático e atualiza a estrutura do banco sozinho, sem perder nenhum dado — inclusive em instalações antigas.",
      "Banco em modo WAL: vários atendentes usando o CRM ao mesmo tempo, com mensagens chegando, sem travar.",
    ],
  },
  {
    version: "1.59",
    date: "2026-10-14",
    title: "Nome da tela na aba do navegador",
    changes: [
      "A aba do navegador agora mostra em qual menu você está: \"CRM INDEX - ATENDIMENTO\", \"CRM INDEX - AGENDA\", \"CRM INDEX - CONFIGURAÇÕES\" etc. Fica mais fácil achar a aba certa com várias abertas.",
      "Vendas aparece como \"CRM\" (é um item desse menu); a Central de Ajuda e o Histórico de versões aparecem como \"AJUDA\". A tela de login continua \"CRM INDEX\".",
    ],
  },
  {
    version: "1.58",
    date: "2026-10-14",
    title: "Histórico de versões em página própria",
    changes: [
      "O Histórico de versões deixou de ser um pop-up e virou uma página própria (Central de Ajuda > Histórico de versões, ou clicando na versão no topo da Ajuda).",
      "Mesmo formato da Central de Ajuda: as versões ficam num menu à esquerda (número, data e título) e o que mudou em cada uma aparece à direita. O menu destaca sozinho a versão que está na tela enquanto você rola.",
      "Busca no menu: digite um número de versão ou uma palavra (ex.: \"figurinha\") para achar em qual versão algo mudou.",
      "Corrigido: a data de atualização aparecia um dia antes (ex.: 13/10 em vez de 14/10).",
    ],
  },
  {
    version: "1.57",
    date: "2026-10-14",
    title: "Atendimento: figurinhas e todo tipo de mensagem do cliente aparecem no chat",
    changes: [
      "Corrigido: figurinhas, fotos, áudios, vídeos e documentos recebidos não carregavam no chat. Agora as mídias passam pelo próprio CRM, funcionam em qualquer computador da rede e não dependem mais do IP da máquina do serviço do WhatsApp.",
      "Mensagens que antes chegavam vazias agora aparecem: mensagem temporária e de visualização única (foto/vídeo), contato compartilhado (nome e telefone), localização (com link \"Abrir no mapa\"), enquete (pergunta e opções), respostas de botões/listas, convites de grupo, eventos e figurinhas animadas.",
      "Reações, mensagens apagadas e editadas pelo cliente viram avisos na conversa (\"Reagiu com 👍\", \"O cliente apagou uma mensagem\", \"Mensagem editada: …\").",
      "Controles internos do WhatsApp deixaram de criar balões vazios; qualquer tipo ainda não suportado aparece com um aviso em vez de em branco.",
      "Links nas mensagens agora são clicáveis; se uma mídia não carregar, aparece um aviso com o link do arquivo.",
    ],
  },
  {
    version: "1.56",
    date: "2026-10-14",
    title: "Agenda: repetições em todos os dias e escolha de data",
    changes: [
      "Tarefas que repetem agora aparecem na Agenda em todos os dias da repetição (Lista, Grade, Semana e Calendário), com borda tracejada e \"repetição\". Clicar abre a tarefa; concluir a ocorrência atual cria a próxima.",
      "\"Repetir\" ficou mais completo: em \"Toda semana\" dá para marcar os dias (ex.: segunda, quarta e sexta) e em \"Todo mês\" escolher o dia (ex.: todo dia 18 — em meses mais curtos, cai no último dia).",
      "O resumo do dia (7h) também conta as repetições daquele dia.",
      "Novo ícone de calendário ao lado da data em todas as abas da Agenda: na Semana mostra a semana da data escolhida; na Grade e no Calendário, o dia; na Lista, só aquele dia (com botão para voltar aos próximos dias).",
    ],
  },
  {
    version: "1.55",
    date: "2026-10-14",
    title: "Agenda: destaque de onde a tarefa vai cair ao arrastar",
    changes: [
      "Ao arrastar uma tarefa no Calendário, o dia sob o mouse fica destacado em azul com \"Soltar aqui\".",
      "O dia/horário escolhido agora é sempre o que está sob o ponteiro do mouse (antes podia pegar o dia vizinho, porque o card arrastado é mais largo que um dia).",
      "O destaque da coluna na Semana e da linha na Grade ficou mais forte.",
    ],
  },
  {
    version: "1.54",
    date: "2026-10-14",
    title: "Agenda: arrastar corrigido e caixa de concluir mais visível",
    changes: [
      "Corrigido o erro que aparecia ao abrir o Calendário da Agenda.",
      "Ao arrastar uma tarefa (Semana, Grade ou Calendário), o card agora acompanha o mouse por cima de todas as colunas — antes ficava escondido atrás dos outros dias. O lugar original fica marcado em transparência até soltar.",
      "A caixa de concluir ficou maior, com borda mais forte e verde quando a tarefa está concluída.",
    ],
  },
  {
    version: "1.53",
    date: "2026-10-14",
    title: "Agenda: visão Semana, arrastar, duração, recorrência, filtro por pessoa e resumo do dia",
    changes: [
      "Nova visão \"Semana\": um quadro com uma coluna por dia (segunda a domingo) e os compromissos de cada dia embaixo, com navegação entre semanas e \"+\" para criar tarefa no dia.",
      "Estrela em cada aba (Lista, Grade, Semana, Calendário): marca a visão que abre sempre que você entra na Agenda. Clicar de novo tira o padrão.",
      "Arrastar para reagendar: na Semana (muda o dia, mantém o horário), na Grade (muda a hora) e no Calendário (arraste da lista do dia até outro dia). O responsável é avisado. Instalações e próximas ações de lead continuam sendo reagendadas no próprio registro.",
      "Tarefas ganharam \"Duração\" (a Grade e a Semana mostram início–fim) e \"Repetir\" (todo dia, toda semana, a cada 15 dias ou todo mês — ao concluir, a próxima é criada sozinha com os mesmos lembretes).",
      "Aviso de conflito: ao criar, editar ou arrastar uma tarefa para um horário em que o responsável já tem outra, aparece um aviso (não impede salvar).",
      "Filtro por pessoa (Administrador e Gerente): ver a agenda de uma pessoa específica.",
      "Cada pessoa tem uma cor própria nos compromissos (faixa lateral e nome em negrito), a mesma do Quadro do Atendimento.",
      "Resumo do dia: às 7h (Brasília), quem tem compromissos no dia recebe no sino a lista do dia. Opcionalmente também pelo WhatsApp (Configurações > Mensagens automáticas > Lembretes da Agenda).",
      "Concluir direto do calendário: caixa de concluir nos compromissos da Grade, da Semana e do Calendário.",
    ],
  },
  {
    version: "1.52",
    date: "2026-10-14",
    title: "Atendimento: qualquer anexo, @menções, notificações e fotos na lista",
    changes: [
      "O anexo (clipe) agora aceita qualquer arquivo que o WhatsApp aceita: além de foto, vídeo e áudio, PDF, Word, Excel, ZIP etc. Documentos podem ter até 100 MB; foto, vídeo e áudio até 16 MB (limites do WhatsApp).",
      "Um arquivo de áudio anexado (MP3 etc.) vai como arquivo; só a gravação pelo microfone vai como mensagem de voz.",
      "Documentos mostram o nome do arquivo na conversa.",
      "Nas notas internas, digitar @ abre a lista de atendentes para mencionar. Quem é mencionado recebe uma notificação e passa a participar da conversa (se ainda não participava); o @Nome fica destacado na nota.",
      "Novas notificações no sininho: quando alguém menciona você numa nota, adiciona você como participante ou passa/transfere uma conversa para você. Conversa nova na fila e mensagem nova não geram notificação.",
      "A lista de conversas e o Quadro mostram a foto do contato, sem consultar o WhatsApp: a foto aparece depois que a conversa daquele contato é aberta uma vez (o que evita qualquer risco de bloqueio do número).",
    ],
  },
  {
    version: "1.51",
    date: "2026-10-14",
    title: "Foto de perfil dos usuários",
    changes: [
      "Em Meu perfil (clicando no avatar, no canto superior direito) agora dá para adicionar, trocar ou remover a sua foto de perfil.",
      "Administradores também podem colocar a foto de qualquer usuário em Configurações > Usuários > Editar.",
      "A foto é recortada em quadrado e reduzida automaticamente — pode usar foto do celular sem se preocupar com o tamanho (JPG, PNG ou WEBP, até 15 MB).",
      "A foto aparece no avatar do topo da tela e nas listas de Usuários e Permissões. Sem foto, continuam as iniciais do nome.",
    ],
  },
  {
    version: "1.50",
    date: "2026-10-13",
    title: "Quadro: coluna \"Na fila\"",
    changes: [
      "Nova primeira coluna \"Na fila\" (laranja) no Quadro do Atendimento: conversas abertas que ninguém está atendendo, com quem espera há mais tempo no topo.",
      "Cada card da fila tem o botão \"Atender\", que torna você o responsável e já abre a conversa.",
      "A fila é a mesma para todos (não depende do atendente escolhido no seletor), já que essas conversas ainda não têm atendente.",
    ],
  },
  {
    version: "1.49",
    date: "2026-10-13",
    title: "Quadro de atendimentos colorido",
    changes: [
      "As colunas do Quadro ganharam cor de fundo, no mesmo estilo dos Kanbans do CRM e de Instalações: azul em Em atendimento, verde em Aguardando cliente e cinza em Finalizados hoje.",
      "Cada atendente tem uma cor própria (sempre a mesma): o card ganha uma faixa lateral e um fundo leve nessa cor.",
      "O nome do atendente agora aparece sempre no card, em negrito e na cor dele.",
    ],
  },
  {
    version: "1.48",
    date: "2026-10-13",
    title: "Quadro de atendimentos, permissões de Administrador e \"Ver atendimento de todos\"",
    changes: [
      "Nova aba \"Quadro\" no Atendimento (ao lado do título, junto de \"Conversas\"): um Kanban com três colunas — Em atendimento, Aguardando cliente e Finalizados hoje — dos atendimentos do atendente. O quadro se atualiza sozinho a cada 15 segundos.",
      "Clicar num card abre a conversa com todo o histórico. Nos finalizados, o botão \"Reabrir\" volta o atendimento para \"Em atendimento\" e já abre a conversa.",
      "Em Configurações > Permissões, agora dá para ajustar as permissões de Administradores também. Configurações continua sempre liberada para eles, então ninguém perde acesso à tela de Permissões.",
      "Nova permissão \"Ver atendimento de todos\": quem tem vê e interage com todos os atendimentos de todo mundo (lista, conversas e o Quadro, com seletor de atendente). Quem não tem vê só o que atende e as conversas novas sem ninguém.",
      "Por padrão a permissão vem ligada para Administrador e Gerente (como já funcionava) e desligada para os outros perfis — dá para mudar por pessoa.",
    ],
  },
  {
    version: "1.47",
    date: "2026-10-13",
    title: "Atendimento: Status com seleção múltipla",
    changes: [
      "Depois de escolher um status, clicar no outro (desmarcado) seleciona os dois.",
      "Clicar num status já selecionado tira só ele e deixa o outro.",
      "Sem clicar em nada continua tudo marcado; o primeiro clique ainda mostra só o status clicado, e desmarcar o último volta a mostrar todos.",
    ],
  },
  {
    version: "1.46",
    date: "2026-10-13",
    title: "Atendimento: filtro de Status combinado com as abas",
    changes: [
      "No painel Status, sem clicar em nada todos os status ficam marcados e a lista mostra todos.",
      "Clicar em um status mostra só ele; clicar de novo no mesmo volta a mostrar todos.",
      "O status agora se soma à aba aberta (ex.: Minhas + Aguardando cliente) em vez de substituí-la, e os números de cada status contam dentro da aba aberta.",
    ],
  },
  {
    version: "1.45",
    date: "2026-10-13",
    title: "Atendimento: notas internas, vários atendentes por conversa e novas abas",
    changes: [
      "Abas da lista reorganizadas: \"Todas\" saiu. Agora são \"Minhas\" (primeira e padrão — conversas que você atende, como responsável ou participante), \"Não lidas\" (só as suas com mensagem nova) e \"Novas\" (sem ninguém atendendo).",
      "No painel Status saíram \"Sem responsável\" e \"Aguardando atendimento\" (essas conversas estão na aba \"Novas\"); ficaram \"Em atendimento\" e \"Aguardando cliente\".",
      "Novo modo anônimo (ícone de máscara ao lado do emoji): o que você escrever vira uma nota interna, destacada em amarelo com cadeado na conversa. Ela NUNCA vai para o cliente — só quem atende a conversa vê.",
      "Notas internas não mudam o status, a última mensagem nem a ordem da lista, e não podem ser citadas numa resposta ao cliente.",
      "Novo \"Participar\": uma conversa pode ter mais de um atendente. O botão \"Participar\" aparece no topo da conversa para quem vê mas não atende; em Informações > Participantes dá para adicionar outro atendente ou remover.",
      "Todos os participantes respondem ao cliente, e cada mensagem continua saindo com o nome de quem mandou. Os participantes também veem e escrevem notas internas, e a conversa aparece em \"Minhas\" para eles.",
      "Entrar, adicionar e remover participantes fica registrado no Histórico da conversa.",
    ],
  },
  {
    version: "1.44",
    date: "2026-10-13",
    title: "Atendimento com visual novo",
    changes: [
      "O botão \"Nova conversa\" foi para o canto superior direito da Central, ao lado do título (que ganhou um ícone).",
      "Os indicadores do topo viraram cartões separados, cada um com seu ícone: Atendimentos abertos, Não lidos (fica vermelho quando há algo), Aguardando atendimento, Aguardando cliente e Meus atendimentos.",
      "As abas Todas / Não lidas / Minhas / Novas mostram a quantidade de cada uma; \"Novas\" fica vermelha quando chega atendimento sem responsável.",
      "Novo botão de filtro ao lado da busca, que mostra/esconde o painel de Status e Ordenação (um ponto azul avisa quando há filtro ativo com o painel escondido).",
      "O cabeçalho da conversa mostra a foto do contato (ou as iniciais) com um ponto colorido indicando o status do atendimento.",
      "O azul da Central de Atendimento ficou um pouco mais escuro.",
    ],
  },
  {
    version: "1.43",
    date: "2026-10-13",
    title: "Atendimento: criar cliente direto do \"Vincular a cliente\"",
    changes: [
      "No quadro \"Número não identificado\", a janela de Cliente ganhou o botão \"Novo\" ao lado da busca.",
      "Ele abre o mesmo formulário de Novo Cliente da tela Clientes, já com o contato da conversa (e a empresa dele, se tiver) preenchidos — dá para trocar, escolher o responsável e escrever observações, e também criar uma empresa ou contato novo ali mesmo.",
      "Ao cadastrar, a conversa já fica vinculada ao cliente novo.",
      "O \"Cadastro rápido\" que aparece quando a busca não encontra nada continua disponível.",
    ],
  },
  {
    version: "1.42",
    date: "2026-10-13",
    title: "Atendimento: quadro de número não identificado reorganizado",
    changes: [
      "O quadro \"Número não identificado\" ganhou uma explicação curta e os botões foram organizados em dois grupos: \"Já existe no CRM?\" (Contato existente, Cliente) e \"É alguém novo?\" (Novo contato, Novo lead).",
      "Os botões agora têm o mesmo tamanho, ícone e ficam em grade de duas colunas; \"Novo lead\" mostra \"Criando...\" enquanto cria.",
      "\"Novo contato\" abre o formulário com o título \"Cadastrar contato deste número\" (antes dizia \"Editar contato\").",
      "Os avisos de criar lead explicam onde o lead foi parar.",
      "Corrigido: a linha \"No WhatsApp:\" aparecia vazia em contatos que ainda não tinham o nome do WhatsApp registrado.",
    ],
  },
  {
    version: "1.41",
    date: "2026-10-13",
    title: "Empresas: marca de Cliente e botão \"Tornar cliente\"",
    changes: [
      "A listagem de Empresas ganhou a coluna \"Cliente\": empresas que já são clientes mostram a marca \"Cliente\" (ou \"Cliente inativo\"), e clicar nela abre o cadastro do cliente.",
      "Empresas que ainda não são clientes mostram o botão \"Tornar cliente\". Depois de confirmar, o cliente é criado na hora, com status Ativo e o mesmo responsável e região da empresa.",
      "A mesma marca/botão aparece na tela da empresa, ao lado do nome.",
      "Tornar cliente por aqui não cria venda nem instalação — essas continuam vindo de uma oportunidade ganha.",
      "Só aparece o botão para quem pode editar a empresa. A conversão fica registrada no Histórico da empresa e do cliente.",
    ],
  },
  {
    version: "1.40",
    date: "2026-10-13",
    title: "Renomear contato (com volta ao nome do WhatsApp) e Clientes com linha clicável",
    changes: [
      "O nome do contato agora pode ser trocado direto no painel do Atendimento e na tela do contato: clique no lápis ao lado do nome, digite e confirme (Enter salva, Esc cancela).",
      "Por padrão o contato usa o nome do perfil do WhatsApp, e acompanha esse nome se a pessoa mudar no celular. Depois de renomear no CRM, o nome escolhido fica, mesmo que o WhatsApp mude.",
      "Quando o nome no CRM é diferente do WhatsApp, aparece \"No WhatsApp: …\" com o botão \"Usar este nome\" para voltar ao nome do WhatsApp.",
      "Renomear e voltar ao nome do WhatsApp ficam registrados no Histórico do contato.",
      "O nome do WhatsApp passa a ser guardado a partir da próxima mensagem de cada contato — contatos antigos mostram a opção de voltar assim que mandarem uma mensagem.",
      "Na listagem de Clientes, clicar em qualquer parte da linha abre o detalhe do cliente (Ctrl+clique abre em nova aba), como já acontece em Contatos e Empresas.",
    ],
  },
  {
    version: "1.39",
    date: "2026-10-13",
    title: "Contatos e Empresas: clicar na linha abre o detalhe",
    changes: [
      "Nas listagens de Contatos e de Empresas, clicar em qualquer parte da linha abre a tela de detalhes (o mesmo que \"Ver detalhes\" no menu ⋯).",
      "Ctrl+clique (ou o botão do meio do mouse) abre o detalhe em uma nova aba; pelo teclado, Tab até a linha e Enter.",
      "O menu ⋯ da linha continua funcionando normalmente, e selecionar texto da linha (para copiar um telefone, por exemplo) não abre o detalhe.",
    ],
  },
  {
    version: "1.38",
    date: "2026-10-13",
    title: "Tela do contato completa: foto, informações e últimos atendimentos",
    changes: [
      "A tela de um contato agora mostra a foto de perfil do WhatsApp ao lado do nome (com a Neonize; sem foto, aparecem as iniciais), além das marcas \"Contato principal\" e \"Não identificado\" quando for o caso.",
      "Novos totais no topo: Atendimentos, Oportunidades, Vendas e Instalações do contato.",
      "Informações mais completas: departamento, tipo de vínculo, data de cadastro e de atualização. O WhatsApp abre a conversa no wa.me e o e-mail abre o programa de e-mail.",
      "Novo bloco \"Últimos atendimentos\" com os 10 mais recentes: data, status, fila, atendente, quantidade de mensagens, duração e a última mensagem. Clicar abre a conversa no Atendimento.",
      "Novos blocos \"Empresa\" (razão social, nome fantasia, CNPJ, telefone, e-mail, cidade e situação na Receita) e \"Comercial\" (cadastro de cliente e as últimas oportunidades, vendas e instalações, com link para cada uma).",
    ],
  },
  {
    version: "1.37",
    date: "2026-10-13",
    title: "Kanbans em abas: CRM e Instalação",
    changes: [
      "Em Configurações > Kanbans, a sanfona deu lugar a duas abas ao lado do título: \"CRM\" e \"Instalação\", no mesmo estilo das abas de Usuários e Atendimento.",
      "O botão \"Nova etapa\" foi para o topo da tela e cria a etapa no Kanban da aba aberta.",
      "Cada aba tem seu próprio link (ex.: /configuracoes/kanbans?board=instalacao), então dá para abrir direto no Kanban de Instalação.",
    ],
  },
  {
    version: "1.36",
    date: "2026-10-13",
    title: "Configurações organizadas em abas",
    changes: [
      "Usuários e Permissões viraram abas da mesma tela: em Configurações > Usuários, as abas \"Usuários\" e \"Permissões\" ficam ao lado do título.",
      "Respostas rápidas e Mensagens automáticas viraram abas de uma nova entrada \"Atendimento\" no menu de Configurações.",
      "O menu lateral de Configurações ficou mais curto (Permissões e Mensagens automáticas saíram dele) e continua destacando a entrada certa em qualquer aba.",
      "Os links antigos continuam funcionando — cada aba tem o mesmo endereço de antes.",
    ],
  },
  {
    version: "1.35",
    date: "2026-10-13",
    title: "Editar já traz as datas e o responsável preenchidos",
    changes: [
      "Ao editar uma tarefa (Agenda, Atendimento, Leads, Oportunidades, Instalações), o Prazo já vem com o dia e o horário que estavam salvos — antes o campo aparecia em branco.",
      "O Responsável da tarefa sempre aparece preenchido ao editar, mesmo que a pessoa seja de um perfil fora da lista normal de responsáveis ou esteja inativa.",
      "A mesma correção vale para as datas ao editar Leads (Última interação e Próxima ação), Oportunidades (Previsão de fechamento e Última interação) e Instalações (Agendamento e Prazo).",
    ],
  },
  {
    version: "1.34",
    date: "2026-10-13",
    title: "WhatsApp: status correto depois de reiniciar e avisos mais completos",
    changes: [
      "Reiniciar serviço e Gerar QR novamente esperam o WhatsApp terminar de conectar antes de atualizar a tela, então não aparece mais \"Aguardando pareamento\" à toa com o número já pareado.",
      "Novo estado \"Conectando...\" enquanto a sessão salva é restaurada, e \"Desconectado\" depois de deslogar (com a orientação de gerar um QR novo).",
      "A tela de Integrações se atualiza sozinha enquanto o WhatsApp conecta ou o QR code está à mostra — o QR novo aparece sem clicar em Atualizar, e o pareamento é detectado sozinho.",
      "Se a conexão com os servidores do WhatsApp falhar (instabilidade de rede), o serviço tenta de novo sozinho após 25 segundos, em vez de ficar parado em \"conectando\".",
      "Os pop-ups das ações do WhatsApp agora mostram o que está acontecendo enquanto a ação roda e, no fim, um título e uma explicação do resultado (ficam 8 segundos na tela).",
    ],
  },
  {
    version: "1.33",
    date: "2026-10-13",
    title: "WhatsApp: serviço roda sem janela de terminal",
    changes: [
      "No Windows, o serviço do WhatsApp iniciado pelo CRM roda em segundo plano, sem abrir janela de CMD (antes, fechar essa janela derrubava o WhatsApp).",
      "Ações do WhatsApp com o serviço fora do ar mostram uma mensagem clara em vez de \"TypeError: fetch failed\".",
      "Parar serviço e Reiniciar serviço não acusam mais erro falso quando o serviço encerra antes de terminar de responder.",
    ],
  },
  {
    version: "1.32",
    date: "2026-10-13",
    title: "WhatsApp (Neonize): iniciar e reiniciar o serviço pelo CRM",
    changes: [
      "Quando o serviço do WhatsApp está fora do ar, Configurações > Integrações agora diz o motivo exato: serviço parado, segredo diferente entre o CRM e o serviço, ou outro erro.",
      "Novo botão \"Iniciar serviço\" sobe o whatsapp-service direto pela tela, sem abrir terminal. Se ele cair na subida, o erro e o log do serviço aparecem ali mesmo.",
      "Novo botão \"Reiniciar serviço\", tanto com o WhatsApp conectado quanto no estado de erro (útil depois de mudar o .env do serviço).",
      "Iniciar/Reiniciar só aparecem quando o serviço roda no mesmo computador do CRM; em produção (Render) a tela explica que isso é feito no painel do servidor.",
    ],
  },
  {
    version: "1.31",
    date: "2026-10-09",
    title: "Lembrete por WhatsApp some das telas quando está desativado",
    changes: [
      "Com os lembretes da Agenda por WhatsApp desligados (Configurações > Mensagens automáticas), o campo \"Lembrete automático (WhatsApp para o responsável)\" deixa de aparecer em todos os formulários de tarefa (Agenda, Atendimento, Leads, Oportunidades, Instalações).",
      "No mesmo caso, o campo de telefone do cadastro de usuários e de Meu perfil passa a se chamar só \"Telefone\", sem a menção a lembretes.",
      "Os lembretes já configurados nas tarefas não são apagados — voltam a aparecer ao religar a opção.",
    ],
  },
  {
    version: "1.30",
    date: "2026-10-09",
    title: "Atendimento: foto do contato e painel lateral mais enxuto",
    changes: [
      "O painel lateral da conversa agora mostra a foto de perfil do WhatsApp do contato ao lado do nome e do telefone. Sem foto (ou com foto privada), aparecem as iniciais.",
      "A foto só vem pela Neonize — a API oficial da Meta não disponibiliza a foto do cliente. Ela é atualizada a cada 6 horas.",
      "Os blocos \"Comercial\" (oportunidade/venda) e \"Implantação\" (instalação) saíram do painel do Atendimento. O botão de criar oportunidade continua aparecendo quando o contato ainda não tem uma.",
    ],
  },
  {
    version: "1.29",
    date: "2026-10-09",
    title: "Permissões com interruptores on/off e Administrador como super usuário",
    changes: [
      "Configurações > Permissões foi reformulada: cada usuário tem um botão \"Permissões\" que mostra todas as telas e ações com um interruptor on/off, já marcado com o que a pessoa tem hoje. Antes era preciso escolher entre \"Herdar do perfil / Conceder / Remover\" em cada item.",
      "Itens que ficaram diferentes do padrão do perfil aparecem sinalizados, e o botão \"Voltar ao padrão do perfil\" desfaz todos os ajustes de uma vez.",
      "A tabela agora mostra quantas telas cada pessoa vê e marca quem tem permissões personalizadas.",
      "Administrador passa a ser o super usuário: sempre tem acesso total, não pode ser restringido por ajustes, e qualquer Administrador pode editar as permissões dos outros usuários.",
    ],
  },
  {
    version: "1.28",
    date: "2026-10-09",
    title: "Opção para desativar os lembretes da Agenda por WhatsApp",
    changes: [
      "Em Configurações > Mensagens automáticas, novo card \"Lembretes da Agenda\" para ligar/desligar o envio dos lembretes de tarefas pelo WhatsApp do responsável (continua ligado por padrão).",
      "Com o envio desligado, o lembrete ainda aparece no sino de notificações do sistema — só não sai pelo WhatsApp. Ao religar, os lembretes que venceram nesse período não são disparados de uma vez.",
    ],
  },
  {
    version: "1.27",
    date: "2026-10-09",
    title: "Escolha da API do WhatsApp: Neonize ou API oficial da Meta",
    changes: [
      "Em Configurações > Integrações, o card do WhatsApp agora tem a opção \"Qual API usar?\": Neonize (QR code, como antes), API oficial (Meta) ou Nenhum (manual). A escolha fica salva no banco — não precisa mais mexer no WHATSAPP_PROVIDER do .env.",
      "Nova integração com a API oficial do WhatsApp (WhatsApp Cloud API): envio de texto, foto, vídeo, áudio, documento e figurinha, resposta citando mensagem, recebimento de mensagens e atualização de entregue/lido.",
      "Ao escolher a API oficial, a tela mostra o passo a passo para criar o app na Meta, os campos para Phone Number ID, token permanente e App Secret, e a URL de webhook + verify token prontos para copiar.",
      "A troca de API vale para conversas novas; uma conversa já aberta passa para o canal novo assim que o cliente escrever por ele.",
      "Limitação da API oficial: só dá para mandar mensagem livre até 24h depois da última mensagem do cliente (regra da Meta). Modelos (templates) ainda não são suportados.",
    ],
  },
  {
    version: "1.26",
    date: "2026-09-17",
    title: "Abrir e concluir tarefas avulsas na Agenda",
    changes: [
      "Uma tarefa \"Geral\" (criada direto na Agenda, sem vínculo com atendimento/CRM/instalação) agora abre num pop-up ao clicar, em qualquer visão (Lista, Grade, Calendário ou na seção Pendentes) — mostra os dados, permite editar e tem um botão para concluir (ou reabrir). Antes não tinha como abrir essa tarefa para finalizá-la.",
      "O botão \"Concluir tarefa\"/\"Reabrir tarefa\" também passou a aparecer ao editar qualquer tarefa em qualquer tela do sistema, não só na Agenda.",
    ],
  },
  {
    version: "1.25",
    date: "2026-09-17",
    title: "Correções: mensagens automáticas, pop-up de notificação e mídia pela rede",
    changes: [
      "Corrigido: o texto das mensagens automáticas (boas-vindas/encerramento/fora do horário) não ficava salvo ao desmarcar a opção de ativar — agora o texto é sempre salvo, mesmo desativado.",
      "O pop-up de notificação de tarefa ficou mais legível e com layout melhor: letra preta no modo claro, branca no modo escuro (antes podia ficar quase invisível dependendo do tema).",
      "Corrigida a causa de foto/vídeo/áudio/figurinha do Atendimento não aparecer em outros computadores da rede — o link estava sempre apontando para \"localhost\", que só funciona no computador que roda o serviço de WhatsApp (nada a ver com o banco de dados).",
    ],
  },
  {
    version: "1.24",
    date: "2026-09-17",
    title: "Encerrar atendimento sem mensagem automática",
    changes: [
      "Novo item \"Encerrar sem Mensagem\" no menu \"...\" da conversa (Atendimento) — encerra o atendimento normalmente, mas sem disparar a mensagem automática de encerramento configurada em Mensagens automáticas.",
    ],
  },
  {
    version: "1.23",
    date: "2026-09-17",
    title: "Respostas rápidas, mensagens automáticas e melhorias no chat do Atendimento",
    changes: [
      "Novo: Respostas rápidas (Configurações > Respostas rápidas) — crie atalhos como \"/p\" para uma mensagem pronta. No campo de mensagem do Atendimento, digite \"/\" para ver todos, ou \"/\" + parte do atalho para filtrar; escolher preenche o campo, e Enter envia.",
      "Novo: Mensagens automáticas (Configurações > Mensagens automáticas) — configure, cada uma podendo ser ligada/desligada: boas-vindas para contato novo que chega sem nenhum atendimento em andamento, mensagem ao encerrar o atendimento, e mensagem fora do horário (a partir de um horário configurável, no máximo uma vez por dia por conversa).",
      "Emoji: o botão de emoji no chat agora funciona de verdade (estava desativado) — escolha entre várias categorias, insere no ponto do cursor.",
      "Colar imagem: agora dá para colar uma imagem copiada (Ctrl+V) direto no campo de mensagem, sem precisar anexar por arquivo.",
      "Corrigido o motivo real de mensagens de voz não chegarem ao WhatsApp do cliente (dependência que faltava no servidor). Falhas de envio (qualquer tipo de mensagem) agora avisam na hora, em vez de só aparecer um ícone discreto na bolha.",
      "Erros de permissão do microfone agora mostram a causa exata (bloqueado, sem microfone, em uso por outro programa) em vez de uma mensagem genérica.",
      "Performance: a lista de conversas do Atendimento não recarrega mais a cada 5 segundos sem necessidade — só atualiza quando realmente há algo novo.",
    ],
  },
  {
    version: "1.22",
    date: "2026-09-17",
    title: "Quadro de prioridade do Kanban mais enxuto",
    changes: [
      "O quadro \"Prioridade de hoje\" do Kanban comercial agora mostra só o nome dos clientes, em linha, coloridos conforme a temperatura (vermelho/quente, amarelo/morno, azul/frio) — sem número de ranking nem valor.",
    ],
  },
  {
    version: "1.21",
    date: "2026-09-17",
    title: "Notificações e pendências na Agenda",
    changes: [
      "O sino de notificações agora funciona de verdade: toda vez que uma tarefa é agendada (ou reagendada) para alguém, a pessoa recebe uma notificação — e se estiver com o sistema aberto na hora, aparece um aviso no canto da tela por 10 segundos.",
      "Lembretes de tarefa (o mesmo lembrete que já mandava WhatsApp) agora também geram uma notificação dentro do sistema.",
      "Nova seção \"Pendentes\" na Agenda (visão Lista): tarefas não concluídas que ficaram para trás (sem prazo ou atrasadas de dias anteriores) continuam aparecendo ali até serem concluídas, com um checkbox pra marcar como feita direto da Agenda. Quem tem permissão de ver tudo (Admin/Gerente) vê as pendências de todo mundo; os demais veem só as suas.",
    ],
  },
  {
    version: "1.20",
    date: "2026-09-17",
    title: "Kanban com posição livre e detalhe de instalação sem financeiro",
    changes: [
      "Arrastar um card no Kanban (Comercial e Instalação) agora deixa soltar em qualquer posição dentro da coluna ou trocando de coluna — antes só dava pra mover entre etapas, sempre indo pro topo. A prioridade continua sendo respeitada: não dá pra intercalar um card de prioridade diferente entre os de outra faixa.",
      "O arrastar ficou bem mais suave — os outros cards deslizam para o lado no lugar de só \"pular\" pra nova posição.",
      "A tela de detalhe de uma instalação não mostra mais o valor da venda (esse dado já aparece na tela do Cliente).",
    ],
  },
  {
    version: "1.19",
    date: "2026-09-17",
    title: "Ranking geral de atendentes no Painel de Atendimento",
    changes: [
      "Novo quadro \"Top 5 atendentes\" no Painel de Atendimento: ranking geral (não só do dia), com foto/inicial, 1º/2º/3º em ouro/prata/bronze, e as colunas \"Este mês\" e \"Total\" lado a lado.",
    ],
  },
  {
    version: "1.18",
    date: "2026-09-17",
    title: "Painel de Atendimento e ajuste no Kanban de Instalação",
    changes: [
      "Novo Dashboard em Atendimento (no lugar de Tickets, que nunca saiu do \"Em breve\"): números do dia, ranking de quem mais atendeu e gráfico por hora, feito pra ficar numa tela do escritório — atualiza sozinho a cada minuto.",
      "Os cards e o cabeçalho das colunas do Kanban de Instalação não mostram mais o valor da negociação.",
    ],
  },
  {
    version: "1.17",
    date: "2026-09-16",
    title: "Modo escuro e ajustes de marca",
    changes: [
      "Novo botão de modo escuro/claro no topo, ao lado do \"?\" de Ajuda — a preferência fica salva e volta a valer da próxima vez que você entra.",
      "A logo (livro + caneta) no topo do menu lateral ficou maior, mais fácil de reconhecer.",
      "A aba do navegador agora mostra \"CRM INDEX\" em vez de só \"INDEX\".",
    ],
  },
  {
    version: "1.16",
    date: "2026-09-16",
    title: "Correção na animação de assinatura do login",
    changes: [
      "Corrigido: nomes com letra maiúscula decorativa (ex: Gabriel, Jheniffer) apareciam cortados na assinatura animada do login, mostrando só a primeira letra — trocada a forma de desenhar o traço por uma mais confiável, testada com nomes reais.",
      "A assinatura volta a aparecer sendo escrita progressivamente (não mais tudo de uma vez).",
    ],
  },
  {
    version: "1.15",
    date: "2026-09-16",
    title: "Cena de escritório na tela de login",
    changes: [
      "A ilustração ao lado do login virou uma foto de cena de escritório (documento, caneta, planta, notebook) — o nome de quem entra continua sendo desenhado ao vivo por cima, na mesma linha de assinatura do documento.",
    ],
  },
  {
    version: "1.14",
    date: "2026-09-16",
    title: "Tela de login redesenhada",
    changes: [
      "Novo visual do login: formulário à esquerda com ícones nos campos, botão de mostrar/ocultar senha e estados de foco/erro mais claros; documento assinado à direita, com fundo levemente decorado e o nome de quem entra 'assinado' à mão com uma caneta.",
      "A animação da assinatura ganhou mais acabamento (a caneta toca o papel, acompanha o traço e sai com um pequeno movimento ao final) e agora respeita a preferência de 'reduzir movimento' do sistema operacional.",
      "No celular a ilustração da assinatura fica oculta para priorizar o formulário; em todos os tamanhos de tela o login continua funcionando normalmente.",
    ],
  },
  {
    version: "1.13",
    date: "2026-09-16",
    title: "Novo nome: INDEX",
    changes: [
      "O sistema passa a se chamar INDEX — nova marca (livro + caneta) na tela de login e no menu lateral, no lugar de \"CRM Comercial\".",
      "Ao entrar, uma animação assina o seu nome com uma caneta sobre um livro aberto antes de abrir o painel.",
    ],
  },
  {
    version: "1.12",
    date: "2026-09-15",
    title: "Permissões granulares por usuário",
    changes: [
      "Nova tela Configurações > Permissões: por pessoa, além do perfil, dá pra conceder/remover acesso a telas específicas (aba Telas) e permitir/bloquear ações específicas como editar Kanban (aba Ações).",
      "Um menu que a pessoa não pode ver simplesmente não aparece mais pra ela — antes era só por perfil fixo, agora dá pra fazer exceção por pessoa.",
      "Aplica na próxima navegação da pessoa afetada, sem precisar relogar. Toda alteração fica registrada no histórico de atividades.",
    ],
  },
  {
    version: "1.11",
    date: "2026-09-15",
    title: "Tarefas em Leads, filtros de Relatórios mais específicos e correção no encerrar atendimento",
    changes: [
      "Leads agora têm o mesmo card de Tarefas já usado em Oportunidades e Instalações — dá pra criar, atribuir e concluir tarefas direto do Lead.",
      "Relatórios (Atendimentos, Comercial e Instalações): o botão Filtros ganhou busca específica por Contato e por Empresa (nome, telefone, razão social, CNPJ...), além de um campo \"Um dia específico\" ao lado do período. Mesmo critério nos 3 relatórios.",
      "Corrigido: ao encerrar um atendimento (pela Central ou pela lista), a conversa às vezes continuava aparecendo na listagem até um F5 manual — a navegação de volta não forçava a atualização dos dados.",
    ],
  },
  {
    version: "1.10",
    date: "2026-09-14",
    title: "Busca da Prospecção CNPJ sincroniza entre aparelhos",
    changes: [
      "A busca da Prospecção CNPJ (filtros e resultados) agora fica salva na sua conta, no servidor — não mais só no navegador onde foi feita. Buscar no computador e depois abrir pelo celular mostra a mesma busca.",
      "\"Limpar resultados\" também limpa esse rascunho salvo na conta.",
    ],
  },
  {
    version: "1.9",
    date: "2026-09-14",
    title: "Corrigida listagem da Prospecção CNPJ no celular",
    changes: [
      "A tabela de resultados da Prospecção CNPJ não aparecia no celular — o contêiner estava cortando o conteúdo (\"overflow-hidden\") em vez de deixar rolar de lado, diferente de toda outra tabela do sistema. Agora rola normalmente, igual às demais.",
    ],
  },
  {
    version: "1.8",
    date: "2026-09-14",
    title: "Opção de revelar telefone/e-mail de verdade na Prospecção",
    changes: [
      "Nova opção na busca da Prospecção CNPJ: \"Revelar telefone e e-mail de verdade\", usando o parâmetro oficial da CFO.com.br pra desmascarar o contato (em vez de \"(28) 9***-**72\").",
      "Fica desligada por padrão porque cada empresa revelada consome 1 \"lead\" da cota mensal da CFO (empresas já reveladas nos últimos 30 dias não cobram de novo) — só ativa quando você decide gastar a cota.",
    ],
  },
  {
    version: "1.7",
    date: "2026-09-14",
    title: "Correção grande na leitura dos dados da CFO.com.br",
    changes: [
      "Corrigida a leitura da resposta da CFO.com.br — o formato real (objetos aninhados para situação, CNAE, porte e endereço) era diferente do que o código assumia, então praticamente nenhum desses campos estava vindo corretamente antes. Agora vêm certos desde a primeira busca, sem precisar de \"Buscar dados completos\".",
      "Telefone e e-mail mascarados pelo plano gratuito da CFO (ex: \"(28) 9***-**72\") agora aparecem identificados como mascarados na tela, em vez de parecerem um dado completo.",
      "Um telefone/e-mail mascarado nunca mais é salvo no cadastro da Empresa/Lead — só entra um valor de verdade.",
      "Corrigido: ao clicar em \"Buscar dados completos\", campos de endereço que a CFO já tinha (rua, número, bairro, CEP) não são mais apagados quando a BrasilAPI não tem aquele dado (comum em MEI).",
    ],
  },
  {
    version: "1.6",
    date: "2026-09-14",
    title: "Card de dados completos reorganizado + Regime Tributário",
    changes: [
      "Card \"Buscar dados completos\" da Prospecção reorganizado em seções (Dados gerais, Contato, Endereço, Regime tributário, CNAEs secundários, Sócios), com todo campo sempre visível (mostra \"—\" quando a Receita não tem aquele dado).",
      "Endereço agora aparece em campos separados (Logradouro, Número, Complemento, Bairro, Cidade/UF, CEP) em vez de uma linha só.",
      "Novo: Optante pelo Simples Nacional e Optante pelo MEI, tanto no card da Prospecção quanto na tela de detalhe da Empresa.",
      "Corrigido: a BrasilAPI estava sendo bloqueada quando a busca completa rodava no servidor (durante a importação) — o \"Transformar em Lead\" às vezes ficava sem esses dados extras mesmo tentando buscar.",
    ],
  },
  {
    version: "1.5",
    date: "2026-09-14",
    title: "Todos os dados da Receita na Prospecção CNPJ",
    changes: [
      "Botão \"Buscar dados completos\" no card de detalhe da Prospecção: traz CNAE (+ secundários), natureza jurídica, porte, sócios e endereço completo, além do que a busca por cidade já trazia.",
      "\"Transformar em Lead\" agora busca esses dados completos automaticamente (mesmo sem clicar antes), e grava tudo na Empresa criada.",
      "A busca da Prospecção CNPJ (filtros e resultados) agora fica salva no navegador — sair da tela e voltar não apaga mais nada; só some ao clicar em \"Limpar resultados\" ou pesquisar de novo.",
      "Tela de detalhe da Empresa passa a mostrar natureza jurídica, porte, CNAEs secundários e sócios, quando disponíveis.",
    ],
  },
  {
    version: "1.4",
    date: "2026-09-14",
    title: "Detalhes completos e criação de Empresa na Prospecção CNPJ",
    changes: [
      "Clicar numa empresa nos resultados da Prospecção CNPJ agora abre todos os dados disponíveis (CNAE, capital social, situação cadastral, endereço etc.).",
      "\"Transformar em Lead\" agora também cria a Empresa de verdade (com todos os dados da Receita) e já vincula o Lead a ela — antes só existiam os dados informais do Lead.",
      "Tela de detalhe da Empresa passa a mostrar os dados da Receita Federal quando disponíveis.",
    ],
  },
  {
    version: "1.3",
    date: "2026-09-14",
    title: "API key da Prospecção CNPJ configurável pela tela",
    changes: [
      "Configurações > Integrações agora tem um campo para colar a API key da CFO.com.br direto na tela, em vez de precisar editar o .env e reiniciar o servidor.",
      "É possível trocar ou remover a API key a qualquer momento pela mesma tela.",
    ],
  },
  {
    version: "1.2",
    date: "2026-09-14",
    title: "Correções e ajustes de mobile",
    changes: [
      "Corrigido o popup de foto/vídeo do Atendimento, que abria fora da caixa branca em telas maiores.",
      "Corrigido acesso pelo navegador de outro computador na mesma rede (login não funcionava).",
      "No celular, o topo da tela agora mostra o nome da página atual (antes ficava um espaço vazio).",
      "Pequenos ajustes de layout mobile: nomes longos de etapa do Kanban não estouram mais a tela em Configurações > Kanbans, e o calendário mensal da Agenda ficou menos apertado em telas pequenas.",
    ],
  },
  {
    version: "1.1",
    date: "2026-09-14",
    title: "Editar perfil e trocar senha",
    changes: [
      "Novo \"Meu perfil\" no menu do usuário (avatar, canto superior direito): qualquer pessoa pode mudar o próprio nome, e-mail e WhatsApp, e trocar a própria senha (confirmando a senha atual).",
      "Em Configurações > Usuários, o Administrador agora pode editar nome, e-mail e WhatsApp de qualquer usuário, e resetar a senha de qualquer um sem precisar da senha antiga.",
    ],
  },
  {
    version: "1.0",
    date: "2026-09-13",
    title: "Central de Ajuda e versão inicial documentada",
    changes: [
      "Criada a Central de Ajuda (ícone \"?\" no topo) com o funcionamento detalhado de cada tela do sistema.",
      "Temperatura calculada (🔥 Quente / 🟡 Morno / ❄️ Frio) para Leads e Oportunidades, com sinalizadores manuais e opção de travar a temperatura.",
      "Painel \"Prioridade de hoje\" no Kanban comercial, com o ranking das oportunidades mais quentes.",
      "Relatórios divididos em Atendimentos, Comercial e Instalações, cada um com busca por responsável/nome/período e exportação em PDF (prévia na tela, download ou abrir WhatsApp Web).",
      "Checklist de instalação configurável em Configurações > Checklist de Instalação.",
      "Etapas dos Kanbans Comercial e de Instalação configuráveis (criar, editar, reordenar, colorir e arquivar) em Configurações > Kanbans.",
      "Consulta automática de CNPJ (ícone de lupa) nos cadastros de Lead e Empresa.",
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
export const LAST_UPDATED = CHANGELOG[0].date;
