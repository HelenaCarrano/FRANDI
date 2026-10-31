/**
 * TODOS os textos do jogo ficam aqui.
 * Para mudar um diálogo, pergunta ou a carta final, edite só este arquivo.
 * Textos marcados com [EXEMPLO] devem ser trocados pelo conteúdo real.
 */

export const content = {
  game: {
    tagline: 'Um presente da Helena',
    title: 'A Aventura do Matheus',
    subtitle: 'Um presente foi escondido. Só você pode encontrá-lo.',
    start: 'Toque para começar',
    startDesktop: 'Clique ou aperte qualquer tecla para começar',
    loading: 'Acendendo as tochas...',
    loadError: 'Algo deu errado ao carregar o mundo. Recarregue a página.',
  },

  controls: {
    desktop: 'WASD ou setas para andar · E para interagir · rodinha do mouse para zoom',
    mobile: 'Arraste o dedo para andar · dois dedos para zoom · toque no botão para interagir',
    actionButton: 'Ação',
    dialogContinue: 'Toque para continuar',
  },

  // Cena de teste da etapa 1 (acessível por ?area=teste)
  testScene: {
    areaName: 'Salão de Testes',
    intro: [
      'Uma mensagem misteriosa ecoa pelas pedras...',
      '"Seu presente foi escondido. Atravesse este mundo para encontrá-lo."',
    ],
    crystal: {
      prompt: 'Examinar o cristal',
      lines: [
        'O cristal pulsa com uma luz azul e fria.',
        'Parece guardar uma memória... mas ainda não é hora de despertá-la.',
      ],
    },
    chest: {
      prompt: 'Abrir baú',
      lines: ['Este tesouro não pode ser aberto sozinho.'],
    },
  },

  // ---------- interface comum ----------
  ui: {
    inventory: 'Mochila',
    coins: 'moedas',
    continue: 'Continuar',
    newGame: 'Recomeçar',
    confirmNew: 'Recomeçar apaga todo o seu progresso. Tem certeza?',
    yes: 'Sim, recomeçar',
    no: 'Voltar',
    close: 'Fechar',
    memoryKeep: 'Guardar memória',
    memoryNoPhoto: 'foto em breve',
    buy: 'Comprar',
    owned: 'Comprado',
    notEnough: 'Faltam moedas',
    notEnoughToast: 'Moedas insuficientes. Ajude os moradores para ganhar mais.',
    newQuest: 'Missão: {title}',
    questDone: 'Concluída: {title}',
    gotItem: '+ {name}',
    gotCoins: '+{n} moedas',
    spentCoins: '-{n} moedas',
    usedIn: 'Usado em: {where}',
  },

  // ---------- itens ----------
  // Cada item tem uso real mais adiante (usedIn). [EXEMPLO] nas piadas internas.
  items: {
    galho: { name: 'Galho firme', icon: '🌿', desc: 'Um galho resistente achado na trilha. Não é uma espada, mas serve para se defender da névoa.', usedIn: 'Floresta' },
    fita: { name: 'Fita da Helena', icon: '🎀', desc: 'Uma fita que você reconhece de algum lugar. Só não lembra de onde.', usedIn: 'Lembranças' },
    bilhete: { name: 'Bilhete da Helena', icon: '📜', desc: 'A letra dela: uma lista de coisas para buscar na vila e um pedido para voltar para casa.', usedIn: 'Vila' },
    maca: { name: 'Maçã do Tito', icon: '🍎', desc: 'Vermelha e brilhante. Cavalos desconfiados costumam mudar de ideia por uma maçã.', usedIn: 'Estábulo' },
    ferradura: { name: 'Ferraduras novas', icon: '🧲', desc: 'Quatro ferraduras forjadas pelo Brutus, ainda mornas. Cada uma tem um "M" riscado.', usedIn: 'Estábulo' },
    espada: { name: 'Espada do Ferreiro', icon: '🗡️', desc: 'Forjada para você. Golpeia espíritos, corta teias e, quem sabe, pão.', usedIn: 'Ruínas e Vinhedo' },
    chapeu_palha: { name: 'Chapéu de palha', icon: '👒', desc: 'Caiu do espantalho depois de tanto golpe. Leve, fresco e meio torto, mas combina com você.', usedIn: 'Vila' },
    mochila: { name: 'Mochila', icon: '🎒', desc: 'Leva tudo o que você coletar pelo caminho.', usedIn: 'Toda a aventura' },
    chave_trigo: { name: 'Chave de trigo', icon: '🌾', desc: 'Uma chave em forma de espiga de trigo: a chave do portão da vila.', usedIn: 'Portão da vila' },
    mapa: { name: 'Mapa do Reino', icon: '🗺️', desc: 'Mostra o caminho para além da vila.', usedIn: 'Portão da vila e mapa central' },
    ovos: { name: 'Ovos da Pipoca', icon: '🥚', desc: 'Frescos, ainda quentinhos, botados pela sua companheira de viagem. Receitas especiais começam com ingredientes simples.', usedIn: 'Taverna e surpresa final' },
    pao: { name: 'Pão quentinho', icon: '🍞', desc: 'Saído do forno agora há pouco. Ainda solta vapor.', usedIn: 'Taverna' },
    farinha: { name: 'Farinha do Seu Alvim', icon: '🌫️', desc: 'Farinha fininha, moída agora no moinho que você consertou. Cheira a pão... e a lembrança.', usedIn: 'Taverna e surpresa final' },
    cristal: { name: 'Cristal das Ruínas', icon: '💎', desc: 'Pulsa devagar, como se lembrasse de tudo o que viu. Os três altares das Ruínas deixaram uma luz dentro dele.', usedIn: 'Ruínas' },
    chave_estrela: { name: 'Chave de estrela', icon: '⭐', desc: 'Uma chave com a ponta em forma de estrela, que o cristal deixou cair quando você o pegou. Fica de lembrança.', usedIn: 'Lembrança' },
    queijo: { name: 'Queijo curado do Zé', icon: '🧀', desc: 'A melhor peça da casa, separada pelo Zé para um jantar especial.', usedIn: 'Jantar em casa' },
    garrafa: { name: 'Garrafa do Vinhedo', icon: '🍷', desc: 'A última garrafa da safra, com a rolha ainda úmida de cera. Guardada para um brinde importante.', usedIn: 'Jantar em casa' },
  },

  // ---------- combate ----------
  combat: {
    defeat: 'Tudo fica escuro de novo…',
    wake: 'Você acorda tonto.',
    rest: 'Corações recuperados',
    tutorialDesktop: 'Clique do mouse para golpear · Ctrl para esquivar · Shift para correr',
    tutorialTouch: 'Toque em ⚔️ para golpear e em 💨 para esquivar',
    foesNear: 'Algo se mexe na névoa à sua frente…',
  },

  // ---------- Vila ----------
  // Tudo aqui é texto de exemplo ([EXEMPLO]): troque pelos nomes, bichos e piadas reais.
  village: {
    areaName: 'Vila do Amanhecer',
    /** Chegada: o jogador reconhece o lugar de que se lembrava vagamente. */
    arrival: [
      '"Finalmente… a vila!"',
      'Você reconhece as casas, a praça e o caminho até a ferraria. Aos poucos, tudo começa a voltar.',
      '"Certo. A Helena me pediu para buscar algumas coisas aqui. Preciso encontrar meu cavalo, conseguir os itens e voltar para casa antes que seja tarde."',
      'Você olha ao redor.',
      '"Agora… por onde eu começo?"',
    ],

    letter: {
      title: 'O bilhete da Helena',
      // linhas começando com "• " viram itens da lista
      paragraphs: [
        'Oi amor,',
        'Bilhete da lista de coisas para trazer da vila:',
        '• Ferradura nova para o Armin',
        '• Farinha fresca do Seu Alvim',
        '• A encomenda da Dona Pimenta',
        'Te amo, não demora muito. Estou esperando por você com uma surpresa.',
      ],
      close: 'Guardar o bilhete',
    },

    quests: {
      horse: { title: 'O reencontro com o Armin', coins: 6 },
      shoes: { title: 'Ferraduras novas', coins: 12 },
      mill: { title: 'O moinho emperrado', coins: 10 },
      order: { title: 'A encomenda esquecida', coins: 12 },
      hens: { title: 'Fuga das galinhas', coins: 15 },
    },

    /** Nome do cavalo. [EXEMPLO] */
    horseName: 'Armin',
    /** Nome da galinha companheira. [EXEMPLO] */
    henName: 'Pipoca',

    npcs: {
      stable: { name: 'Tito, o Cavalariço', prompt: 'Falar com o Tito' },
      smith: { name: 'Brutus, o Ferreiro', prompt: 'Falar com o Ferreiro' },
      miller: { name: 'Seu Alvim, o Moleiro', prompt: 'Falar com o Moleiro' },
      hens: { name: 'Dona Clotilde', prompt: 'Falar com a Dona Clotilde' },
      merchant: { name: 'Dona Pimenta', prompt: 'Falar com a Comerciante' },
      villagerA: { name: 'Morador', prompt: 'Falar com o morador' },
      kid: { name: 'Criança', prompt: 'Falar com a criança' },
    },

    scarecrow: {
      prompt: 'Testar a arma no espantalho',
      stick: 'Com o graveto ele só balança. Mas o chapéu parece solto... talvez uma espada de verdade resolva.',
      loosen: 'O chapéu de palha está quase caindo. Mais um pouco!',
      drop: 'O chapéu de palha despenca e rola pelo chão!',
      pick: 'Pegar o chapéu de palha',
      got: 'Você pegou o chapéu de palha e já colocou na cabeça.',
      hatOn: 'Chapéu de palha colocado',
      hatOff: 'Chapéu de palha guardado',
    },

    // ----- Tito e o cavalo -----
    stable: {
      first: [
        'Bom dia, forasteiro! Não conheço o seu rosto por aqui. Está de passagem?',
        'Que bom que apareceu alguém. Esse cavalo chegou sozinho ao amanhecer, trotando pela estrada como quem tem hora marcada.',
        '(É o meu cavalo! Mas como ele chegou antes de mim?)',
        '(Digo meu nome a ele: Matheus. E que acho que o cavalo estava me esperando.)',
        'Matheus, é? Então só pode ser. Desde que chegou, ele ficou no cercado olhando para a estrada, e não deixou ninguém se aproximar.',
        'Vá lá cumprimentá-lo, mas com jeito. Ele anda tão triste, parece que está com saudade de alguém. Eu cuido do estábulo, me chamam de Tito.',
      ],
      offer: 'Ele só vai deixar chegar quem se aproxima com calma, segurando a maçã.',
      yes: 'Deixa comigo',
      no: 'Preciso de um minuto',
      decline: ['Sem pressa. Ele também não tem.'],
      accepted: ['Isso! Passo de caracol, voz baixa e a maçã à mostra. Ele vai decidir.'],
      waiting: ['Ele está no cercado, de olho na estrada. Vá lá, ele já sabe quem você é.'],
      afterTrust: [
        'Nunca vi um cavalo tão feliz de rever alguém. Dá para ver a saudade dele daqui. Ele é seu mesmo, hein.',
        'Só tem um detalhe: ele veio de longe e está sem ferraduras. Assim não passa muito da cerca.',
        'Fale com o Brutus, o ferreiro. Se ele estiver de bom humor, faz um jogo novo.',
      ],
      idleBeforeShoes: ['O Brutus fica na ferraria, perto da praça. A que solta fumaça e barulho.'],
      shoeFit: [
        'Ferraduras forjadas pelo Brutus! Deixa eu ver...',
        '*tuc* *tuc* *tuc*',
        'Pronto. Olha só como ele pisa firme. Agora vocês dois vão para onde quiserem, Matheus.',
        'Chegue perto dele e use o botão do cavalo para montar. Segure firme: ele é mais rápido do que parece.',
      ],
      done: ['Se for ao galope, cuidado com as galinhas da Clotilde. Elas não perdoam.'],
    },

    horse: {
      greet: 'Cumprimentar {name}',
      approachHint: 'Aproxime-se devagar, com a maçã',
      tooFast: 'Ele se assustou: vá mais devagar',
      trustLabel: 'Confiança de {name}',
      reunion: [
        '{name} levanta a cabeça assim que te vê, relincha alto e vem trotando até a cerca, bufando como quem reclama da demora e chora de saudade ao mesmo tempo.',
        '"Eu sei, eu sei. Também senti a sua falta. Mas você também não facilitou, hein?"',
        'Ele esfrega o focinho no seu ombro e não quer mais soltar. Na sela, a bolsa com o seu nome se abre com um clique. Dentro, um bilhete dobrado com a letra de alguém que você conhece bem.',
      ],
      trusted: [
        '{name} abaixa a cabeça e cheira a maçã. Depois cheira você, demora, e respira fundo, como quem matava a saudade.',
        '"Aí está você, cabeça-dura. Senti tanta saudade. Eu sabia que a gente se encontrava."',
        'A bolsa da sela se solta com um clique. Dentro, um bilhete dobrado com a letra de alguém que você conhece bem.',
      ],
      mount: 'Montar em {name}',
      dismount: 'Desmontar',
    },

    // ----- Brutus e a forja -----
    smith: {
      noLetter: [
        'Hmpf. Você parece ter pressa de aventura.',
        'Mas antes resolva a bolsa do cavalo, aquele lá do estábulo.',
      ],
      notYet: ['Ainda não tenho o que fazer por você. Resolva o negócio do cavalo primeiro.'],
      offer: [
        'Então é você o dono do cavalo que o Tito não para de falar. Ele só chegou perto de você, dizem.',
        'Cavalo sem ferradura é pé sem sapato. Eu faço quatro novas, mas a forja precisa de braço.',
        'Você bate o ferro quando o brilho passar pela faixa dourada. A faixa encolhe e o ferro esfria se errar: são cinco marteladas boas para a ferradura nascer. Topa?',
      ],
      yes: 'Bora forjar',
      no: 'Daqui a pouco',
      decline: ['Sem pressa. O ferro esfria, mas eu esquento de novo.'],
      forgeTitle: 'Forja do Brutus',
      forgeHint: 'Bata quando o brilho passar pela faixa dourada. Errar esfria o ferro!',
      forgeButton: 'Martelar!',
      forgeMiss: [
        'Foi no ar. O ferro nem sentiu.',
        'Essa passou longe. Respira e tenta de novo.',
        'Quase! Quase só vale em ferradura de cavalo muito pequeno.',
        'O martelo ficou com vergonha. Outra vez!',
      ],
      forgeHit: ['CLANG! Primeira, e já saiu faísca.', 'CLANG! Isso aí, o ferro está cedendo.', 'CLANG! Agora a forma apareceu.', 'CLANG! Falta pouco, o ferro está no ponto.', 'CLANG! A forja sorriu.'],
      forgeCold: 'O ferro esfriou de vez! Vou reaquecer. Respira e começa de novo.',
      forged: [
        'Pronto! Quatro ferraduras novas, e uma delas ficou até bonita.',
        'E para a estrada vai precisar de algo mais que cenoura: esta espada. Dizem que tem uma névoa estranha rondando o reino. Forjei hoje cedo sem saber para quem. Agora sei.',
        'Leve as ferraduras ao Tito. Ele sabe colocar.',
      ],
      progress: ['As ferraduras já estão com você. Leve ao Tito, no estábulo.'],
      done: ['Cuide bem dessa espada. Ela já cortou muita coisa... principalmente pão.'],
    },

    // ----- Seu Alvim e o moinho -----
    miller: {
      noLetter: ['Hm? Visita? Estou ocupado olhando para o moinho. Ele me ignora, eu ignoro ele.'],
      offer: [
        'Ainda bem que apareceu! O moinho parou bem na hora em que eu precisava preparar um lote de farinha. As engrenagens saíram do encaixe.',
        'São três rodas, e cada uma que eu mexo arrasta a vizinha. Sem farinha, não há pão. E, sem o moinho, não consigo preparar nada.',
        'Você me dá uma mão?',
      ],
      yes: 'Acho que consigo ajudar',
      no: 'Agora não',
      decline: ['Tudo bem. O moinho não vai a lugar nenhum. É esse o problema.'],
      accepted: ['Não prometo entender de moinhos, mas já sobrevivi a uma floresta inteira hoje.', 'Então temos esperança! A casa de máquinas fica aos pés do moinho. É só chegar e mexer nas rodas.'],
      progress: ['As engrenagens ficam na casa de máquinas, aos pés do moinho. Toque nelas até as marcas ficarem para cima.'],
      ready: [
        'ELE VOLTOU A GIRAR! Escute só esse rangido bom. Agora falta o principal: moer o trigo.',
        'Muito bem! Às vezes, basta colocar cada peça no lugar certo para tudo voltar a funcionar.',
        'Prometi uma chave, e aqui está: a espiga de trigo, a chave do portão da vila. E leve um pouco da farinha fresca também.',
        'Leve esta mochila resistente. Uma boa viagem exige espaço para carregar aquilo que você encontrar pelo caminho.',
      ],
      fragment: {
        title: 'FRAGMENTO DE MEMÓRIA 03',
        lines: [
          'Você observa a farinha fina sobre a mesa.',
          'Por um instante, uma lembrança surge: uma bancada coberta de farinha, mãos trabalhando uma massa e alguém rindo ao seu lado.',
          '"De novo essa imagem… farinha, uma cozinha… Por que continuo me lembrando disso?"',
        ],
      },
      done: ['O moinho agora gira tão bem que a farinha chega sozinha. Meus braços estão agradecendo.'],
      millIntro: ['A manivela da mó está ali. É só girar em círculo (ou apertar E várias vezes) e o moinho gira junto. Eu seguro o saco.'],
      millTitle: 'Moer o trigo',
      millHint: 'Segure a manivela e arraste em círculos. Quanto mais rápido, mais o moinho gira.',
      millDone: 'Farinha fresca, branquinha como neve!',
      gearsTitle: 'Engrenagens do moinho',
      gearsHint: 'Tocar numa roda gira ela e a vizinha ao contrário. Estale cada uma até a marca ficar para cima.',
      gearsGoal: 'Objetivo: todas as marcas amarelas apontando para cima.',
      gearsSolved: 'Clic! As rodas se encaixam e o moinho estremece.',
    },

    gears: { prompt: 'Mexer nas engrenagens', fixed: ['O moinho gira devagar, rangendo satisfeito. Volte ao Seu Alvim.'] },

    // ----- Dona Clotilde e as galinhas -----
    hens: {
      first: [
        'MEU DEUS, UM VISITANTE! Rápido, rápido, por favor, uma emergência!',
        'As minhas meninas fugiram! O portão ficou aberto por três segundos, TRÊS, e quando eu vi só restava a Beyoncé.',
        'Há seis delas soltas pela vila: a Nuggets, a Bela Adormecida, a Dona Frango, a Frida, a Maria Fofoca e o Bartolomeu (é menina, não pergunte).',
        'Elas fogem de quem corre atrás, mas voltam para casa se você chegar de mansinho. Tente conduzir elas para o cercado, ali ao lado.',
      ],
      offer: 'Me ajuda a levar as minhas meninas de volta para o cercado?',
      yes: 'Claro, vamos lá',
      no: 'Agora não',
      decline: ['Eu entendo. Mas, por favor, se vir alguma, diga que a mamãe não está brava.'],
      accepted: ['Gratidão eterna! O cercado é este aqui do lado, com a entrada aberta. Elas fogem de você, então use isso a seu favor.'],
      progress: 'Ainda faltam {n} galinhas soltas. Cuidado para não correr atrás delas: elas correm mais!',
      ready: [
        'TODAS AQUI! Nuggets, Bela Adormecida, Dona Frango, Frida, Maria Fofoca e... Bartolomeu, vem cá, meu bem.',
        'Você salvou a minha manhã. Tome as moedas, é o mínimo.',
        'E quando precisar de ovos, é só dizer. Quer dizer... pelo jeito você já tem fornecedora própria.',
      ],
      done: ['A Beyoncé conta pra todo mundo da fuga. Ela é dramática como a dona.'],
      penToast: 'Cercado: {n}/{total}',
    },

    // ----- a galinha companheira -----
    hen: {
      prompt: 'Chegar perto da galinha',
      meet: [
        'Você está atravessando a praça quando escuta um cacarejo atrás de uma barraca.',
        'Uma galinha aparece, olha para você e começa a andar na sua direção.',
        '"Oi, pequenininha. Cadê o seu dono?"',
        'Você continua andando. Ela vai atrás.',
        '"Ah, não. Você também vai me seguir agora?"',
        'A galinha cacareja como se tivesse acabado de tomar uma decisão muito importante.',
        '"Tudo bem. Mas não espere que eu saiba cuidar de você. Eu mal estou conseguindo cuidar de mim!"',
      ],
      joined: 'A {name} agora viaja com você',
      eggFirst: [
        '"Espera… você botou um ovo?"',
        'Você olha para a galinha.',
        '"Você vem comigo, me segue por todo lugar e ainda me dá provisões? Acho que encontrei a melhor companheira de viagem possível."',
      ],
      eggMore: ['Mais um ovo! A {name} não para.', 'Outro ovo quentinho na mochila.', 'A {name} cacareja, orgulhosa: ovo novo!'],
      eggToast: 'Ovo da {name}',
    },

    // ----- Dona Pimenta e a loja -----
    merchant: {
      greet: ['Bem-vindo, bem-vindo! Tenho de tudo um pouco. E um pouco de tudo também.'],
      menuShop: 'Ver a loja',
      menuChat: 'Conversar',
      menuBye: 'Até logo',
      bye: ['Volte sempre! Ou nunca mais, mas deixando uma gorjeta.'],
      chat: [
        'Aquele cavalo? Passou aqui antes de o sol nascer, parou na frente da minha barraca e ficou me olhando.',
        'Cavalo que sabe o que quer é raro. Cavalo que sabe o que você quer... é de outro mundo.',
      ],
      chatDone: ['Agora a vila toda fala de você e do {name}. Você é o novo assunto preferido. Parabéns?'],
      chatEggs: ['Ora, ovos frescos! Cuide bem deles. Um bom cozinheiro sabe que receitas especiais começam com ingredientes simples.'],
      shopTitle: 'Loja da Dona Pimenta',
      shopHint: 'Dica: poções e pão ajudam em viagens longas.',
    },

    // ----- A encomenda esquecida (Dona Pimenta) -----
    order: {
      intro: [
        'Ora, ora… olha quem apareceu! Faz tempo que não vejo alguém tão perdido dentro da minha loja.',
        '(Estou procurando algumas coisas, mas, para ser sincero, nem lembro direito o quê.)',
        'Isso acontece quando a cabeça está cheia de preocupações. Vamos por partes. Uma boa viagem começa com boas provisões.',
        'Ah! Antes que eu me esqueça, tenho uma encomenda que preciso separar. Mas, com esse movimento todo, acabei misturando as etiquetas.',
        'Você parece estar precisando de alguma coisa para fazer. E eu preciso de alguém que saiba distinguir o que vai na mochila do que fica na prateleira. Me ajuda?',
      ],
      yes: 'Claro, eu separo',
      no: 'Mais tarde',
      decline: ['Sem pressa. As etiquetas não vão a lugar nenhum. Infelizmente.'],
      accepted: ['Maravilha! Provisões vão na mochila, ferramentas no cesto das ferramentas e o que não serve para a viagem volta para a prateleira.'],
      resume: ['A encomenda ainda está toda misturada. Vamos lá?'],
      title: 'Encomenda da Dona Pimenta',
      hint: 'Arraste cada item para o cesto certo. Toque num item já guardado para devolvê-lo à bancada.',
      confirm: 'Conferir',
      incomplete: 'Ainda tem coisa sobrando na bancada. Guarde tudo antes de conferir.',
      wrong: 'Hmm, {n} coisa(s) foram para o cesto errado. Elas voltaram para a bancada: pense no que realmente vai na viagem.',
      bins: [
        { id: 'provisoes', icon: '🎒', name: 'Provisões' },
        { id: 'ferramentas', icon: '🧰', name: 'Ferramentas' },
        { id: 'prateleira', icon: '🪑', name: 'Fica na prateleira' },
      ],
      items: [
        { id: 'pao', icon: '🍞', name: 'Pão', bin: 'provisoes' },
        { id: 'queijo', icon: '🧀', name: 'Queijo', bin: 'provisoes' },
        { id: 'maca', icon: '🍎', name: 'Maçãs', bin: 'provisoes' },
        { id: 'corda', icon: '🪢', name: 'Corda', bin: 'ferramentas' },
        { id: 'martelo', icon: '🔨', name: 'Martelo', bin: 'ferramentas' },
        { id: 'lanterna', icon: '🏮', name: 'Lanterna', bin: 'ferramentas' },
        { id: 'vaso', icon: '🏺', name: 'Vaso enfeitado', bin: 'prateleira' },
        { id: 'vela', icon: '🕯️', name: 'Velas de enfeite', bin: 'prateleira' },
        { id: 'boneca', icon: '🪆', name: 'Boneca de pano', bin: 'prateleira' },
      ],
      solved: ['Perfeito! Cada coisa no seu lugar. Você tem olho de comerciante.'],
      reward: [
        'Aqui está o mapa do reino, com os meus agradecimentos. Sem ele você se perderia no primeiro cruzamento.',
        'E leve um pão quentinho para a estrada. Uma boa viagem começa com boas provisões.',
      ],
      done: ['A encomenda seguiu viagem. E o mapa, pelo jeito, também.'],
    },

    /** Itens da loja, na ordem exibida, e o preço. */
    shop: [
      { id: 'pao', price: 4 },
      { id: 'pocao', price: 8 },
    ],

    gate: {
      prompt: 'Examinar o portão',
      /** Texto do botão quando o portão já está aberto. */
      promptOpen: 'Seguir para o mapa',
      noKey: [
        'O portão está trancado. A fechadura tem formato de espiga de trigo.',
        'Quem sabe o dono do moinho tenha uma chave assim?',
      ],
      noMap: [
        'A chave de trigo gira na fechadura, mas você hesita.',
        'Sem um mapa, você se perderia no primeiro cruzamento. A Dona Pimenta tem uma encomenda para você resolver, e o mapa vem junto.',
      ],
      open: [
        'A chave de trigo gira na fechadura. Com o mapa na mão, você respira fundo.',
        'O portão se abre devagar. Hora de recuperar o resto das lembranças.',
      ],
    },

    mutters: {
      villagerA: ['Bom dia! O cavalo do cercado é seu, não é? Ele não parava de olhar a estrada.', 'Que manhã bonita para procurar presente.'],
      villagerB: ['Dizem que o Brutus chora quando termina uma ferradura.', 'Eu não falei nada...'],
      kid: ['Queria fazer carinho no cavalo que chegou hoje, mas ele é muito bravo.', 'A Beyoncé é a galinha mais fofoqueira da vila!'],
    },

    objective: {
      talkStable: 'Fale com o Tito, perto do cercado do cavalo',
      approachHorse: 'Vá ao cercado e cumprimente o Armin',
      talkSmith: 'Fale com o Ferreiro, na ferraria',
      forgeShoes: 'Forje as ferraduras com o Brutus',
      bringShoes: 'Leve as ferraduras ao Tito',
      talkMiller: 'Fale com o Moleiro, no moinho',
      fixMill: 'Conserte as engrenagens do moinho',
      returnMiller: 'Volte ao Seu Alvim',
      order: 'Resolva a encomenda da Dona Pimenta, na barraca do mercado',
      gate: 'Atravesse o portão norte da vila',
      done: 'Siga pelo portão até o mapa do reino',
      hens: 'Leve as galinhas ao cercado ({n}/6)',
    },
  },

  // ---------- Floresta dos Sussurros (o começo da história) ----------
  // Textos de exemplo ([EXEMPLO]).
  forest: {
    areaName: 'Floresta dos Sussurros',
    wake: {
      header: 'FLORESTA DOS SUSSURROS · INÍCIO',
      lines: [
        'Está frio.',
        'Você abre os olhos devagar. O chão está úmido, as árvores parecem muito mais altas do que deveriam e uma névoa fina cobre tudo ao seu redor.',
        'Você tenta se levantar, ainda tonto.',
        '"Onde eu estou?"',
        'Você se lembra de estar em algum lugar familiar. Havia luzes, vozes… alguém estava falando com você.',
        'Mas, por mais que tente, as lembranças escapam.',
        '"Como foi que eu vim parar aqui?"',
        'Uma trilha estreita desaparece entre as árvores. Pequenos vagalumes iluminam o caminho.',
      ],
    },
    objective: {
      follow: 'Siga a trilha pela floresta',
      ribbon: 'Algo brilha ao lado da trilha',
      horse: 'Procure o seu cavalo',
      stick: 'Encontre algo para se defender',
      fight: 'Enfrente os espíritos da névoa',
      fireflies: 'Siga os vagalumes',
      portal: 'Chegue ao portal de pedra',
      done: 'Atravesse o portal em direção à vila',
    },
    back: {
      prompt: 'Voltar ao mapa',
    },
    ribbon: {
      prompt: 'Examinar a fita',
      lines: ['Presa num galho baixo, uma fita de cetim balança sozinha, mesmo sem vento.', '"Espera… eu conheço isso."'],
      fragment: {
        title: 'FRAGMENTO DE MEMÓRIA 01',
        lines: [
          'Uma voz surge vagamente em sua cabeça.',
          '— Ah, Helena tinha falado alguma coisa…',
          'Você fecha os olhos, tentando se lembrar.',
          '— Ela pediu para eu ir até a vila buscar umas coisas. Eu acho que era isso…',
          'A lembrança desaparece tão rápido quanto surgiu.',
          '"Mas por que eu vim por essa floresta?"',
        ],
      },
    },
    tracks: {
      prompt: 'Examinar as pegadas',
      lines: [
        'Você para de repente.',
        '"Pera aí…"',
        'Olha para os lados, procurando algo familiar.',
        '"E o meu cavalo?!"',
        'Você se lembra de ter vindo montado. Pelo menos, acha que estava montado. Há marcas de ferraduras no chão, mas nenhum sinal do animal.',
        'As pegadas seguem em direções diferentes, até desaparecerem na terra úmida.',
        '"Ótimo. Estou perdido no meio de uma floresta e agora estou sem cavalo."',
        'Você respira fundo.',
        '"Primeiro eu preciso sair daqui. Depois encontro esse cabeça-dura."',
      ],
    },
    stick: {
      prompt: 'Pegar o galho',
      lines: ['Caído junto de um tronco, um galho firme, do tamanho certo para a mão.', '"Não é uma espada. Mas é melhor que nada."', 'A névoa mais à frente parece se mexer…'],
    },
    horseStops: [
      '{name} para na beira da sombra, bufa e recua dois passos.',
      'Ele tem medo do escuro. Vai esperar aqui por você, e vai estar aqui na volta.',
    ],
    mist: {
      wall: 'A névoa se fecha à sua frente, densa como uma parede. Algo se mexe dentro dela.',
    },
    deadEnd: [
      [
        'A trilha termina numa clareira vazia, com um tronco caído e cogumelos tímidos.',
        'Os vagalumes não vieram para cá. Quem sabe eles brilhem em outro caminho.',
      ],
      [
        'Mais uma clareira sem saída, com uma caixa de abelhas zumbindo baixinho. Os vagalumes passaram direto por aqui, sem nem olhar.',
        'Hora de voltar até a bifurcação e escolher o outro lado.',
      ],
    ],
    hive: {
      prompt: 'Caixa de abelhas',
      lines: [
        'Uma caixa de madeira, cheia de abelhas. Elas rodeiam você, curiosas, e pousam na sua manga sem ferrar.',
        'São abelhas mansas. Alguém cuida delas com carinho: o zumbido soa quase como uma canção de ninar.',
        'A Helena ia gostar de ver elas.',
      ],
    },
    shroom: {
      prompt: 'Cogumelo estranho',
      ask: '...comer o cogumelo?',
      options: ['Comer', 'Deixar quieto'],
      eat: ['Tem gosto de chuva e de moeda velha.', 'O chão parece respirar. Melhor ficar parado um instante...'],
      after: ['A floresta volta ao lugar, devagar. Você jura ter visto um chapéu vermelho passar correndo.'],
    },
    portal: {
      prompt: 'Examinar o portal',
      lines: ['No fim da trilha, um arco de pedra muito antigo brilha com símbolos azuis.', 'Ao tocar as pedras antigas, você sente uma pontada na cabeça.'],
      fragment: {
        title: 'FRAGMENTO DE MEMÓRIA 02',
        lines: [
          'Dessa vez, a lembrança é mais nítida.',
          'Você está em casa. Há uma conversa, uma lista de coisas para buscar e uma sensação estranha de que alguém está escondendo alguma coisa de você.',
          '— Eu precisava buscar alguns itens na vila…',
          'Você começa a entender.',
          '— Isso! Eu tinha que pegar tudo e voltar para casa.',
          'Uma última imagem aparece: algo embrulhado, guardado cuidadosamente, longe dos seus olhos. Você sorri, sem saber exatamente por quê.',
          '— E tinha alguma coisa sobre o meu aniversário…',
          'A imagem desaparece.',
          '"Espera. Meu aniversário? O que a Helena está aprontando?"',
        ],
      },
      after: ['O arco se abre para a luz da manhã. Do outro lado, uma estradinha desce até a Vila do Amanhecer.'],
      done: 'O portal pulsa devagar, como um coração. A estrada para a vila está logo ali.',
    },
  },

  // ---------- Ruínas Esquecidas ----------
  // Textos de exemplo ([EXEMPLO]): troque pelas perguntas e memórias reais.
  ruins: {
    areaName: 'Ruínas Esquecidas',
    intro: [
      'Do outro lado do arco, a noite é clara e fria. Colunas quebradas cercam um pátio de pedra muito antigo.',
      'Três altares esperam ao fundo, cada um com um cristal apagado. Dizem que eles guardam o que o reino não quer esquecer.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    objective: {
      explore: 'Explore o pátio das ruínas',
      altars: 'Acenda os altares ({n}/3)',
      fight: 'Enfrente os espíritos que despertaram',
      crystal: 'Pegue o cristal no centro do pátio',
      done: 'Volte ao mapa: novos caminhos se abriram',
    },
    altarLit: 'O cristal acende. Uma lembrança vem à tona...',
    ambush: 'Os três altares acesos acordam o pátio. A névoa sobe do chão, e vultos se levantam em volta do cristal.',
    altarDone: 'O cristal deste altar já está aceso.',
    flames: {
      name: 'Altar das Chamas',
      prompt: 'Examinar o altar',
      brazier: 'Acender o braseiro',
      intro: [
        'Quatro braseiros apagados cercam o altar. Na parede, quatro símbolos pintados em azul brilham numa ordem.',
        'Acenda os braseiros na mesma ordem dos símbolos, lendo a parede da esquerda para a direita.',
      ],
      wrong: [
        'As chamas tremem e se apagam de uma vez. A ordem não era essa.',
        'Olhe de novo os símbolos da parede: cada braseiro tem o seu, no poste ao lado.',
      ],
      step: 'Uma chama acende. Faltam {n}.',
    },
    runes: {
      name: 'Altar dos Símbolos',
      prompt: 'Examinar o altar',
      intro: ['Três anéis de pedra giram em volta do cristal. Cada um traz os mesmos seis símbolos.'],
      title: 'Os três anéis',
      hint: 'Toque num anel para girá-lo. Alinhe o mesmo símbolo no alto dos três.',
      goal: 'Símbolo do alto: ✦',
      solved: 'Os anéis se encaixam com um estalo grave. A luz sobe.',
    },
    echo: {
      name: 'Altar do Eco',
      prompt: 'Examinar o altar',
      intro: ['Uma voz muito baixa vem do cristal, como um eco da sua própria cabeça. Ela faz uma pergunta.'],
      question: 'Qual é a primeira coisa que o Matheus faz de manhã, antes de qualquer outra?',
      options: ['Toma um café bem forte', 'Procura o celular', 'Abraça o travesseiro mais um pouquinho'],
      answer: 0,
      wrong: ['O eco ri baixinho. "Quase. Pense na manhã mais comum de todas e tente outra vez."'],
    },
    crystal: {
      prompt: 'Pegar o cristal',
      lines: [
        'Os três altares acesos soltam uma coluna de luz no centro do pátio. No alto dela, um cristal do tamanho de um punho flutua devagar.',
        'Ele pesa quase nada e esquenta na mão. Dentro dele, as três memórias giram como pequenas estrelas.',
        'Quando você o pega, uma chave com a ponta em forma de estrela desliza para a sua outra mão, como se estivesse esperando por isso.',
      ],
    },
    done: 'O pedestal está vazio, mas o pátio ainda guarda um brilho azul. O caminho de volta está livre.',
  },

  // ---------- Taverna do Zé ----------
  // Textos de exemplo ([EXEMPLO]): troque pelos pedidos e pelas piadas reais.
  tavern: {
    areaName: 'Taverna do Zé',
    intro: [
      'Nossa, estou morrendo de sede... Nem sei há quanto tempo estou na rua.',
      'O cheiro de lenha e pão quentinho vem lá de dentro. Um copo de qualquer coisa gelada cairia muito bem.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    waiter: { name: 'Dudu, o Garçom' },
    cook: {
      name: 'Zé, o Cozinheiro',
      prompt: 'Falar com o Zé',
      hello: ['Boa noite, forasteiro! Você tem cara de quem andou o dia inteiro. Em que posso servir?'],
      buyAsk: 'Quer comprar uma água? Custa {price} moedas.',
      buyOptions: ['Comprar água', 'Agora não'],
      bought: ['Zé enche um copo grande de água fresca e desliza pelo balcão.', 'Você bebe tudo de uma vez. Nada na vida foi tão bom.'],
      free: ['Sem trocado? Pode levar, essa é por conta da casa. Ninguém sai da minha taverna com sede.'],
      noBuy: ['Se a sede apertar, é só chamar.'],
      offer: [
        'Aliás, você parece alguém que sabe se virar. Meu ajudante sumiu e a casa está cheia de gente com fome.',
        'Pode me ajudar aqui no restaurante por uns trocos? São três clientes, três pedidos.',
      ],
      offerAsk: 'Ajudar o Zé na cozinha?',
      offerOptions: ['Ajudar', 'Agora não'],
      greet: [
        'Maravilha! Converse com cada cliente, leia a comanda e prepare o prato na cozinha: corte, grelhe, torre.',
        'Quando o prato ficar pronto, o garçom leva até a mesa. Cada pedido rende uns trocos, e se acertar os três eu te dou uma coisa guardada aqui há anos: o meu melhor queijo curado.',
      ],
      later: ['Sem pressa. Quando quiser ajudar, é só me avisar.'],
      waiting: ['Fale com os clientes, escute o pedido e prepare o prato no fogão. Nada de pressa. Quer dizer, um pouco de pressa.'],
      reward: [
        'Os três pratos voltaram limpos. Limpíssimos! Nunca vi tanto sorriso junto nesta casa.',
        'Prometi e cumpro. Este é o queijo mais curado da casa: leve para um jantar especial.',
      ],
      done: ['A casa está sempre aberta para você. Mas, por favor, avise antes de trazer fome.'],
    },
    counter: {
      prompt: 'Cozinhar no fogão',
      noOrder: ['O fogão está apagado. Antes de cozinhar, descubra o que cada cliente quer: converse com eles.'],
      allServed: ['Todos já foram servidos. Falta só falar com o Zé.'],
    },
    ingredients: {
      pao: { icon: '🍞', name: 'Pão de forma' },
      queijo: { icon: '🧀', name: 'Queijo' },
      carne: { icon: '🥩', name: 'Carne' },
      alface: { icon: '🥬', name: 'Alface' },
      tomate: { icon: '🍅', name: 'Tomate' },
      cebola: { icon: '🧅', name: 'Cebola' },
      peixe: { icon: '🐟', name: 'Peixe' },
      batata: { icon: '🥔', name: 'Batata' },
      cogumelo: { icon: '🍄', name: 'Cogumelo' },
      cenoura: { icon: '🥕', name: 'Cenoura' },
      ovo: { icon: '🥚', name: 'Ovo caipira' },
      pao_quente: { icon: '🥖', name: 'Baguete da vila' },
      farinha: { icon: '🌫️', name: 'Farinha misteriosa' },
    },
    plating: {
      title: 'Cozinha do Zé',
      hint: 'Escolha na despensa e prepare: corte no ritmo, vire e tire da chapa no verde, tire a torrada no verde. Depois chame o garçom!',
      empty: 'O prato está vazio',
      serve: 'Chamar o garçom',
      clear: 'Limpar prato',
      missing: 'Hmm, ainda falta alguma coisa no prato. Confira a comanda.',
      extra: 'Tem coisa demais no prato. Releia a comanda: nem tudo que é bom combina.',
      empty_plate: 'O prato está vazio. Prepare algum ingrediente primeiro.',
      ticket: 'Comanda',
      pantry: 'Despensa do Zé',
      extras: 'Da sua mochila (extras)',
      patience: 'Paciência do cliente',
      stations: { chop: 'Tábua', grill: 'Chapa', toast: 'Torradeira' },
      cut: 'Cortar!',
      flip: 'Virar!',
      take: 'Tirar!',
      raw: 'Ainda está cru! Espere mais um pouco.',
      tooLate: 'Passou do ponto! Esse foi para o lixo. Tente de novo.',
      burnt: 'Queimou! Pegue outro na despensa.',
      busy: 'Essa estação está ocupada.',
      already: 'Esse ingrediente já está no prato ou sendo preparado.',
      perfect: 'Perfeito!',
      good: 'Bom!',
      miss: 'Errou o ritmo!',
      done: 'Prato pronto! O garçom já vem buscar.',
      tipLabel: 'Gorjeta',
    },
    orders: [
      {
        name: 'Dona Berenice, a Viajante',
        prompt: 'Falar com a Viajante',
        request: [
          'Boa noite. Estou de passagem e com pressa, mas com fome ainda maior.',
          'Quero algo simples: um pão com queijo e tomate. Nada de carne, eu juro que não aguento.',
        ],
        waiting: ['O prato ainda não chegou? Pão, queijo e tomate. Nada de carne!'],
        recipe: ['pao', 'queijo', 'tomate'],
        loves: 'ovo',
        thanks: ['Perfeito! Simples e quentinho. Pode me chamar de cliente fiel.'],
        bonusThanks: ['E esse ovo por cima? Quase chorei. Tome uma gorjeta, é o mínimo.'],
        done: ['Já vou. Mas volto, viu?'],
        coins: 8,
        bonusCoins: 6,
      },
      {
        name: 'Seu Teodoro, o Pescador',
        prompt: 'Falar com o Pescador',
        request: [
          'Passei o dia no rio e voltei com um peixe e com um apetite.',
          'Quero o peixe com batata e cebola. E nada de queijo, que queijo com peixe é crime.',
        ],
        waiting: ['Peixe, batata e cebola. Queijo, jamais.'],
        recipe: ['peixe', 'batata', 'cebola'],
        loves: 'pao_quente',
        thanks: ['Isso sim é prato de pescador! O rio agradece.'],
        bonusThanks: ['Com a baguete da vila para molhar? O senhor é um gênio. Tome aqui.'],
        done: ['Quem come peixe com batata nunca desiste do rio.'],
        coins: 8,
        bonusCoins: 6,
      },
      {
        name: 'Madame Cogumela, a Colecionadora',
        prompt: 'Falar com a Colecionadora',
        request: [
          'Colecionei receitas por todo o reino e hoje quero a minha preferida.',
          'Carne com cogumelo, cenoura e cebola. O segredo é a cenoura, não esqueça.',
        ],
        waiting: ['Carne, cogumelo, cenoura e cebola. A cenoura é o segredo!'],
        recipe: ['carne', 'cogumelo', 'cenoura', 'cebola'],
        loves: 'farinha',
        thanks: ['Maravilhoso! Esta receita vai direto para o meu caderno.'],
        bonusThanks: ['Uma pitada de farinha misteriosa... Entendi tudo. Agora faz sentido. Tome algo pela ousadia.'],
        done: ['Cada prato conta uma história. Este contou a sua.'],
        coins: 10,
        bonusCoins: 8,
      },
    ],
    objective: {
      drink: 'Compre algo para beber no balcão',
      talkCook: 'Converse com o Zé sobre ajudar na cozinha',
      takeOrder: 'Converse com os clientes e descubra os pedidos ({n}/3)',
      plate: 'Prepare o prato de {name} no fogão',
      deliver: 'O garçom está levando o prato...',
      reward: 'Volte ao Zé para pegar o queijo curado',
      done: 'Volte ao mapa: o queijo do Zé está com você',
    },
    done: 'O balcão está limpo e o cheiro de comida boa ainda enche a casa. O queijo curado já está com você.',
  },

  // ---------- Vinhedo Dourado ----------
  // Textos de exemplo ([EXEMPLO]): troque pelos nomes, pelas uvas e pelas piadas reais.
  // Cada uva tem doçura, acidez e corpo (0 a 3). A mistura certa deixa a média de cada um dentro da faixa de `blend.solution`.
  vineyard: {
    areaName: 'Vinhedo Dourado',
    intro: [
      'O sol baixo pinta as videiras de dourado.',
      'No fundo, uma mulher de lenço pisa em alguma coisa e canta sozinha.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    horseWait: 'Espere aí, {name}. Vou ver se consigo umas uvas para levar para casa. Acho que a Helena comentou que queria também.',
    crows: 'Corvos de névoa descem das videiras, atraídos pelo cacho brilhante!',
    keeper: {
      name: 'Dona Vitória, a Vinicultora',
      prompt: 'Falar com a Dona Vitória',
      greet: [
        'Que bom que apareceu! Preciso de quatro cachos especiais: roxo, verde, rosa e dourado.',
        'Eles brilham entre as fileiras, mas os corvos vigiam. Traga todos e a última garrafa da safra é sua.',
      ],
      waiting: ['Procure os cachos que brilham entre as fileiras.'],
      ready: ['Os quatro! Agora o lagar: misture até o sabor ficar certo.'],
      reward: ['Perfeito! Aqui está a última garrafa da safra. Guarde para um brinde importante.'],
      done: ['Faça um bom brinde com aquela garrafa!'],
    },
    stomp: {
      before: ['Agora a parte divertida: sapatos fora, calça arregaçada e pise nas uvas!', 'Ande por cima de todas, até virar suco.'],
      cut: 'Mais tarde, dentro da tina...',
      hint: 'Ande por cima das uvas para pisar todas!',
      progress: 'Uvas pisadas',
      later: 'Algum tempo depois...',
      after: ['A tina está cheia de suco roxo e o Matheus, de pés roxos até o joelho. A Helena ia rir muito disso.'],
    },
    press: {
      prompt: 'Usar o lagar',
      notReady: ['O lagar está parado. Falta colher os quatro cachos especiais nas fileiras.'],
      notStarted: ['Um lagar de madeira, manchado de roxo. Melhor falar com a dona do vinhedo antes de mexer em alguma coisa.'],
      done: ['O lagar está limpo e o cheiro de uva ainda paira no ar.'],
    },
    grapes: {
      roxa: { icon: '🍇', name: 'Uva roxa', prompt: 'Colher o cacho roxo', picked: 'Um cacho roxo, pesado e escuro. Encorpado.', doce: 2, acido: 1, corpo: 3 },
      verde: { icon: '🍏', name: 'Uva verde', prompt: 'Colher o cacho verde', picked: 'Um cacho verde e firme. Ácido de fazer careta.', doce: 1, acido: 3, corpo: 1 },
      rosada: { icon: '🌸', name: 'Uva rosada', prompt: 'Colher o cacho rosado', picked: 'Um cacho rosado, quase um doce de tão macio.', doce: 3, acido: 1, corpo: 1 },
      dourada: { icon: '✨', name: 'Uva dourada', prompt: 'Colher o cacho dourado', picked: 'Um cacho dourado que brilha sozinho. Doce, sem um pingo de acidez.', doce: 3, acido: 0, corpo: 2 },
    },
    blend: {
      title: 'Lagar da Dona Vitória',
      hint: 'Toque nas uvas para pôr cachos no barril (até 6). Toque num cacho do barril para tirá-lo. Deixe as três barras dentro da faixa marcada.',
      empty: 'O barril está vazio',
      taste: 'Provar',
      clear: 'Esvaziar',
      emptyBarrel: 'O barril está vazio. Toque nas uvas para pôr cachos nele.',
      labels: { doce: 'Doçura', acido: 'Acidez', corpo: 'Corpo' },
      high: {
        doce: 'Doce demais, enjoa. Ponha menos uva doce.',
        acido: 'Ácido demais, até a língua franze. Tire um pouco da verde.',
        corpo: 'Pesado demais, parece sopa. Tire um pouco da roxa.',
      },
      low: {
        doce: 'Faltou doçura, está seco como poeira.',
        acido: 'Faltou acidez, está sem graça e sem vida.',
        corpo: 'Faltou corpo, está aguado. Falta alguma coisa encorpada.',
      },
      /** Receita de referência (roxa + verde + dourada). A faixa de cada barra é a média dela ± `tolerance`. */
      solution: ['roxa', 'verde', 'dourada'],
      tolerance: 0.4,
      max: 6,
      ok: 'Perfeito! O barril brilha dourado.',
    },
    objective: {
      talk: 'Fale com a Dona Vitória, no lagar',
      harvest: 'Colha os cachos que brilham entre as fileiras ({n}/4)',
      press: 'Leve os cachos ao lagar e faça a mistura',
      reward: 'Volte à Dona Vitória para pegar a garrafa',
      done: 'Volte ao mapa: a garrafa está com você',
    },
    done: 'A safra está guardada e a última garrafa já está com você.',
  },

  // ---------- Fazenda (voltar para casa) ----------
  farm: {
    areaName: 'Nossa Fazenda',
    intro: [
      'Casa. Finalmente.',
      'O sol já quase se foi, e a fazenda está do jeitinho de sempre: galinhas, vacas, porcos e ovelhas. As janelas estão acesas, e tem um cheiro muito bom saindo da chaminé.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    door: { prompt: 'Entrar em casa' },
    objective: 'Entre em casa: tem algo cheirando muito bem',
    horse: 'O Armin relincha, contente. Ele também está em casa.',
    animals: {
      chickens: { prompt: 'Ver as galinhas', lines: ['As galinhas cacarejam em coro. Uma delas te olha como quem diz "demorou".'] },
      cows: { prompt: 'Fazer carinho nas vacas', lines: ['Muuu. A vaca esfrega a cabeça na sua mão e continua mastigando, sem pressa nenhuma.'] },
      pigs: { prompt: 'Ver os porquinhos', lines: ['Os porquinhos rolam na lama, felizes. Um deles te sujou de propósito. Tem certeza.'] },
      sheep: { prompt: 'Fazer carinho nas ovelhas', lines: ['Beeee. A lã é tão macia que você quase esquece de entrar em casa.'] },
    },
  },

  // ---------- Casa (final) ----------
  home: {
    areaName: 'Casa',
    intro: ['A casa está quentinha, iluminada por velas.', 'Na cozinha, de costas, alguém de avental termina de arrumar a mesa.'],
    back: { prompt: 'Sair para a fazenda' },
    objective: { go: 'Vá até a mesa', done: 'Feliz aniversário, Matheus!' },
    mirror: {
      prompt: 'Olhar no espelho',
      lines: [['Sou lindo.'], ['Continuo lindo.'], ['Hmm... esse cabelo hoje está impecável.'], ['Ok, chega de se admirar. A Helena está esperando.']],
    },
    helena: {
      name: 'Helena',
      prompt: 'Falar com a Helena',
      done: ['Vem, a massa não se faz sozinha!', 'Eu te amo.'],
    },
    scene: {
      hello: ['Amor!'],
      kiss: ['Ela corre até você e te dá um beijo daqueles de saudade.'],
      welcome: ['Que bom que você chegou!'],
      table: ['Você coloca na mesa tudo o que trouxe: a farinha, os ovos, o queijo do Zé e a garrafa de vinho do vinhedo.'],
      takes: ['Ela pega duas taças e um rolo de massa e entrega o rolo para você.'],
      rolling: 'Rolo de massa recebido',
      ask: ['Vamos começar a fazer as massas para o jantar?'],
      matheus: ['Mas amor, eu não sei fazer massa caseira.'],
      answer: ['Ah, eu também não...', 'Mas então você vai aprender, e vai aprender na vida real. Eu também.'],
      unlocked: 'Presente desbloqueado!',
      love: ['Te amo. Feliz aniversário!'],
    },
    voucher: {
      title: 'Workshop de Massas e Vinhos',
      place: 'La Mia Cuzina',
      lines: [
        'Válido para: Matheus e a Helena',
        'Uma tarde de massas frescas feitas à mão, harmonizadas com vinhos.',
        'Data: a combinar',
        'Local: La Mia Cuzina',
      ],
      footer: 'Com amor, H.',
      save: 'Salvar o voucher',
      close: 'Guardar',
      fileName: 'voucher-workshop-matheus.png',
    },
    endTitle: 'Feliz aniversário, Matheus!',
    endText: 'Fim da aventura. O presente de verdade começa agora.',
    endButton: 'Continuar em casa',
  },

  // ---------- Memórias (aparecem quando um altar acende) ----------
  // Textos de exemplo ([EXEMPLO]). `photo` é o nome do arquivo em public/photos/ (sem foto, mostra a moldura vazia).
  memories: {
    ruinas_chamas: {
      title: 'A primeira vez',
      text: ['Lembra do dia em que tudo começou? A gente nem imaginava onde isso ia dar.', 'Foi aí que a luz acendeu pela primeira vez.'],
      caption: 'Onde tudo começou',
      photo: 'ruinas_chamas.jpg',
    },
    ruinas_simbolos: {
      title: 'Um dia qualquer',
      text: ['Nem foi um dia especial. Foi só um dia bom, desses que a gente guarda sem perceber.'],
      caption: 'Um dia bom',
      photo: 'ruinas_simbolos.jpg',
    },
    ruinas_eco: {
      title: 'A risada',
      text: ['Aquela risada que ninguém consegue explicar, mas todo mundo lembra.'],
      caption: 'A risada',
      photo: 'ruinas_eco.jpg',
    },
    taverna_jantar: {
      title: 'O jantar',
      text: [
        'Uma mesa de madeira, luz baixinha, o prato bonito na frente e a Helena do outro lado, feliz da vida.',
        'Todo restaurante que a gente vai acaba sendo assim: comida boa, conversa até esfriar o prato, e ela amando cada pedaço.',
      ],
      caption: 'Jantar com a Helena',
      photo: 'taverna_jantar.jpg',
    },
    vinhedo_brinde: {
      title: 'O brinde',
      text: ['A gente brindou com qualquer coisa e achou que era o melhor vinho do mundo. Era só a companhia.'],
      caption: 'a gente ama beber',
      photo: 'vinhedo_brinde.jpg',
    },
  },

  // ---------- Mapa do Reino (pergaminho) ----------
  // Textos de exemplo ([EXEMPLO]): troque pelos nomes e piadas reais.
  kingdomMap: {
    title: 'Mapa do Reino',
    openButton: 'Mapa',
    close: 'Fechar o mapa',
    here: 'Você está aqui',
    travel: 'Viajar para {name}',
    preparing: 'Este caminho ainda está sendo preparado',
    done: 'Concluído',
    /** Aviso quando uma área nova se revela no pergaminho. */
    newPath: '{name}',
    firstOpen: [
      'Você desdobra o mapa. É um pergaminho velho, riscado a tinta: uma estrada de terra sai da floresta, passa pela vila e se abre num cruzamento.',
      'A maior parte do reino está coberta de nuvens pintadas. Elas vão sumindo conforme você avança.',
    ],
    locked: {
      forest: 'O portão da vila ainda não se abriu para este caminho.',
      middle: 'Uma nuvem espessa cobre este lugar. Quem sabe, depois de resolver as pendências da vila, ela se dissipe.',
      farm: 'O caminho de casa ainda está coberto de nuvens. Antes, passe por todos os lugares do reino: as ruínas, a taverna e o vinhedo.',
    },
    objective: {
      forest: 'Abra o mapa e siga a estrada até a Floresta',
      explore: 'Explore o reino: {n} de 4 lugares concluídos',
      farm: 'O caminho de casa está aberto',
    },
  },

  areas: {
    village: 'Vila do Amanhecer',
    map: 'Mapa do Reino',
    forest: 'Floresta dos Sussurros',
    ruins: 'Ruínas Esquecidas',
    tavern: 'Taverna do Zé',
    vineyard: 'Vinhedo Dourado',
    farm: 'Nossa Fazenda',
    home: 'Casa',
    visual: 'Teste visual',
  },
} as const;

export type Content = typeof content;
export type ItemId = keyof typeof content.items;

/** Troca {chave} por valores: fmt('Faltam {n}', { n: 2 }). */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
