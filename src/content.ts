/**
 * TODOS os textos do jogo ficam aqui.
 * Para mudar um diálogo, pergunta ou a carta final, edite só este arquivo.
 * Textos marcados com [EXEMPLO] devem ser trocados pelo conteúdo real.
 */

export const content = {
  game: {
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
    newQuest: 'Nova missão: {title}',
    questDone: 'Missão concluída: {title}',
    gotItem: 'Item recebido: {name}',
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
    espada: { name: 'Espada do Ferreiro', icon: '🗡️', desc: 'Forjada para você. Golpeia espíritos, corta teias e, quem sabe, pão.', usedIn: 'Ruínas, Vinhedo e Castelo' },
    mochila: { name: 'Mochila', icon: '🎒', desc: 'Leva tudo o que você coletar pelo caminho.', usedIn: 'Toda a aventura' },
    chave_trigo: { name: 'Chave de trigo', icon: '🌾', desc: 'Uma chave em forma de espiga de trigo. A primeira das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    mapa: { name: 'Mapa do Reino', icon: '🗺️', desc: 'Mostra o caminho para além da vila.', usedIn: 'Portão da vila e mapa central' },
    ovos: { name: 'Ovos da Pipoca', icon: '🥚', desc: 'Frescos, ainda quentinhos, botados pela sua companheira de viagem. Receitas especiais começam com ingredientes simples.', usedIn: 'Taverna e surpresa final' },
    pocao: { name: 'Poção de Coragem', icon: '🧪', desc: 'Tem gosto de morango. Dizem que cura o medo do escuro.', usedIn: 'Castelo' },
    pao: { name: 'Pão quentinho', icon: '🍞', desc: 'Saído do forno agora há pouco. Ainda solta vapor.', usedIn: 'Taverna' },
    farinha: { name: 'Farinha do Seu Alvim', icon: '🌫️', desc: 'Farinha fininha, moída agora no moinho que você consertou. Cheira a pão... e a lembrança.', usedIn: 'Taverna e surpresa final' },
    cristal: { name: 'Cristal das Ruínas', icon: '💎', desc: 'Pulsa devagar, como se lembrasse de tudo o que viu. Os três altares das Ruínas deixaram uma luz dentro dele.', usedIn: 'Castelo' },
    chave_estrela: { name: 'Chave de estrela', icon: '⭐', desc: 'Uma chave com a ponta em forma de estrela, que o cristal deixou cair quando você o pegou. A segunda das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    chave_cobre: { name: 'Chave de cobre', icon: '🗝️', desc: 'Uma chave de cobre com cheiro de pão e de lenha. A terceira das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    garrafa: { name: 'Garrafa do Vinhedo', icon: '🍷', desc: 'A última garrafa da safra, com a rolha ainda úmida de cera. Guardada para um brinde importante.', usedIn: 'Castelo' },
  },

  // ---------- combate ----------
  combat: {
    defeat: 'Tudo fica escuro de novo…',
    wake: 'Você acorda tonto, mas inteiro. Respire fundo e tente outra vez.',
    rest: 'Você respira fundo. Os corações se enchem de novo.',
    tutorialDesktop: 'J ou F para golpear · K para esquivar · Shift para correr',
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
      paragraphs: [
        'Amor,',
        'Se você está lendo isto, o cavalo chegou antes de você. Eu sabia que ele sabia o caminho.',
        'Passe pela vila e resolva a lista: ferraduras novas para ele, farinha fresca do Seu Alvim e a encomenda da Dona Pimenta. Ela te entrega o mapa.',
        'Depois volte para casa. Tem uma coisa esperando por você. Nada de espiar!',
        '— H.',
      ],
      close: 'Guardar o bilhete',
    },

    quests: {
      horse: { title: 'O cavalo desconfiado', coins: 6 },
      shoes: { title: 'Ferraduras novas', coins: 12 },
      mill: { title: 'O moinho emperrado', coins: 10 },
      order: { title: 'A encomenda esquecida', coins: 12 },
      hens: { title: 'Fuga das galinhas', coins: 15 },
    },

    /** Nome do cavalo. [EXEMPLO] */
    horseName: 'Trovão',
    /** Nome da galinha companheira. [EXEMPLO] */
    henName: 'Pipoca',

    npcs: {
      stable: { name: 'Tito, o Cavalariço', prompt: 'Falar com o Tito' },
      smith: { name: 'Brutus, o Ferreiro', prompt: 'Falar com o Ferreiro' },
      miller: { name: 'Seu Alvim, o Moleiro', prompt: 'Falar com o Moleiro' },
      hens: { name: 'Dona Clotilde', prompt: 'Falar com a Dona Clotilde' },
      merchant: { name: 'Dona Pimenta', prompt: 'Falar com a Comerciante' },
    },

    // ----- Tito e o cavalo -----
    stable: {
      first: [
        'Ah, graças a Deus, alguém! O senhor é o Matheus? Esse cavalo chegou sozinho ao amanhecer, trotando pela estrada como quem tem hora marcada.',
        '(É o meu cavalo! Mas como ele chegou antes de mim?)',
        'Na sela, uma bolsa com o seu nome. Só que ele morde quem chega perto. Perdi um chapéu e metade da paciência.',
        'Mas ele me parece um cavalo que quer ser ganho, não pego. Leve esta maçã e vá DEVAGAR. Cavalo sente pressa de longe.',
      ],
      offer: 'Ele só vai deixar chegar quem se aproxima com calma, segurando a maçã.',
      yes: 'Deixa comigo',
      no: 'Preciso de um minuto',
      decline: ['Sem pressa. Ele também não tem.'],
      accepted: ['Isso! Passo de caracol, voz baixa e a maçã à mostra. Ele vai decidir.'],
      waiting: ['Chegue perto bem devagar. Se ele sair galopando, é porque você veio com pressa. Respira e tenta de novo.'],
      afterTrust: [
        'Eu NUNCA vi ele deixar alguém encostar. Você tem jeito, hein.',
        'Só tem um detalhe: ele veio de longe e está sem ferraduras. Assim ele não vai muito além da cerca.',
        'Fale com o Brutus, o ferreiro. Se ele estiver de bom humor, faz um jogo novo.',
      ],
      idleBeforeShoes: ['O Brutus fica na ferraria, perto da praça. A que solta fumaça e barulho.'],
      shoeFit: [
        'Ferraduras forjadas pelo Brutus! Deixa eu ver...',
        '*tuc* *tuc* *tuc*',
        'Pronto. Olha só como ele pisa firme. Agora ele é seu, Matheus.',
        'Chegue perto dele e use o botão do cavalo para montar. Segure firme: ele é mais rápido do que parece.',
      ],
      done: ['Se for ao galope, cuidado com as galinhas da Clotilde. Elas não perdoam.'],
    },

    horse: {
      approachHint: 'Aproxime-se devagar, com a maçã',
      tooFast: 'Ele se assustou: vá mais devagar',
      trustLabel: 'Confiança de {name}',
      trusted: [
        '{name} abaixa a cabeça e cheira a maçã. Depois cheira você. Respira fundo.',
        '"Aí está você, cabeça-dura. Eu sabia que a gente se encontrava."',
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
        'Então é você que o Tito não para de falar. Dizem que o cavalo deixou você chegar perto.',
        'Cavalo sem ferradura é pé sem sapato. Eu faço quatro novas, mas a forja precisa de braço.',
        'Você bate o ferro quando o brilho passar pela faixa verde. Três marteladas boas e a ferradura nasce. Topa?',
      ],
      yes: 'Bora forjar',
      no: 'Daqui a pouco',
      decline: ['Sem pressa. O ferro esfria, mas eu esquento de novo.'],
      forgeTitle: 'Forja do Brutus',
      forgeHint: 'Toque quando o brilho passar pela faixa verde.',
      forgeButton: 'Martelar!',
      forgeMiss: [
        'Foi no ar. O ferro nem sentiu.',
        'Essa passou longe. Respira e tenta de novo.',
        'Quase! Quase só vale em ferradura de cavalo muito pequeno.',
        'O martelo ficou com vergonha. Outra vez!',
      ],
      forgeHit: ['CLANG! Primeira, e já saiu faísca.', 'CLANG! Isso aí, agora o ferro entendeu.', 'CLANG! A forja sorriu.'],
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
        'ELE VOLTOU A GIRAR! Escute só esse rangido bom. A farinha já está caindo no recipiente.',
        'Muito bem! Às vezes, basta colocar cada peça no lugar certo para tudo voltar a funcionar.',
        'Prometi uma chave, e aqui está: a espiga de trigo, a primeira das três do castelo. E leve um pouco da farinha fresca também.',
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
      gearsTitle: 'Engrenagens do moinho',
      gearsHint: 'Tocar numa roda gira ela e a vizinha ao contrário.',
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
      penToast: 'Galinha no cercado: {n} de {total}',
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
      eggToast: 'Ovo da {name} guardado na mochila',
    },

    // ----- Dona Pimenta e a loja -----
    merchant: {
      greet: ['Bem-vindo, bem-vindo! Tenho de tudo um pouco. E um pouco de tudo também.'],
      menuShop: 'Ver a loja',
      menuChat: 'Conversar',
      menuBye: 'Até logo',
      bye: ['Volte sempre! Ou nunca mais, mas deixando uma gorjeta.'],
      chat: [
        'Aquele cavalo preto? Passou aqui antes de o sol nascer, parou na frente da minha barraca e ficou me olhando.',
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
      villagerA: ['Bom dia! O cavalo preto é seu?', 'Que manhã bonita para procurar presente.'],
      villagerB: ['Dizem que o Brutus chora quando termina uma ferradura.', 'Eu não falei nada...'],
      kid: ['Posso fazer carinho no cavalo?', 'A Beyoncé é a galinha mais fofoqueira da vila!'],
    },

    objective: {
      talkStable: 'Fale com o Tito, perto do cercado do cavalo',
      approachHorse: 'Aproxime-se do cavalo devagar, com a maçã',
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
        'Mais uma clareira sem saída. Os vagalumes passaram direto por aqui, sem nem olhar.',
        'Hora de voltar até a bifurcação e escolher o outro lado.',
      ],
    ],
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
      question: 'Qual é a primeira coisa que o Matheus faz de manhã, antes de qualquer outra? [EXEMPLO]',
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
        'Algo no castelo vai querer saber disso.',
      ],
    },
    done: 'O pedestal está vazio, mas o pátio ainda guarda um brilho azul. O caminho de volta está livre.',
  },

  // ---------- Taverna do Zé ----------
  // Textos de exemplo ([EXEMPLO]): troque pelos pedidos e pelas piadas reais.
  tavern: {
    areaName: 'Taverna do Zé',
    intro: [
      'A porta da taverna cheira a lenha, pão e alguma coisa queimada. Lá dentro, três clientes esperam de cara fechada.',
      'Atrás do balcão, um cozinheiro enorme enxuga as mãos no avental e olha para você como quem vê um ajudante chegar.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    cook: {
      name: 'Zé, o Cozinheiro',
      prompt: 'Falar com o Zé',
      greet: [
        'Ah, finalmente! Meu ajudante sumiu e a casa está cheia de gente com fome. [EXEMPLO]',
        'São três clientes, três pedidos. Converse com cada um, escute com atenção e monte o prato no balcão.',
        'Acertou os três, e eu te dou uma coisa que está guardada aqui há anos: a chave de cobre.',
      ],
      waiting: ['Fale com os clientes, escute o pedido e monte o prato no balcão. Nada de pressa. Quer dizer, um pouco de pressa.'],
      reward: [
        'Os três pratos voltaram limpos. Limpíssimos! Nunca vi tanto sorriso junto nesta casa.',
        'Prometi e cumpro. Esta chave de cobre abre uma das três fechaduras do portão do castelo.',
      ],
      done: ['A casa está sempre aberta para você. Mas, por favor, avise antes de trazer fome.'],
    },
    counter: {
      prompt: 'Montar o prato',
      noOrder: ['O balcão está vazio. Antes de cozinhar, descubra o que cada cliente quer: converse com eles.'],
      allServed: ['Todos já foram servidos. Falta só falar com o Zé.'],
    },
    ingredients: {
      pao: { icon: '🍞', name: 'Pão' },
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
      pao_quente: { icon: '🥖', name: 'Pão quentinho' },
      farinha: { icon: '🌫️', name: 'Farinha misteriosa' },
    },
    plating: {
      title: 'Balcão do Zé',
      hint: 'Arraste os ingredientes para o prato. Toque num ingrediente do prato para tirá-lo.',
      empty: 'Arraste aqui',
      serve: 'Servir',
      clear: 'Limpar',
      missing: 'Hmm, ainda falta alguma coisa no prato. Lembre do que o cliente disse.',
      extra: 'Tem coisa demais no prato. Releia o pedido: nem tudo que é bom combina.',
      empty_plate: 'O prato está vazio. Arraste alguma coisa para ele.',
    },
    orders: [
      {
        name: 'Dona Berenice, a Viajante',
        prompt: 'Falar com a Viajante',
        request: [
          'Boa noite. Estou de passagem e com pressa, mas com fome ainda maior. [EXEMPLO]',
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
          'Passei o dia no rio e voltei com um peixe e com um apetite. [EXEMPLO]',
          'Quero o peixe com batata e cebola. E nada de queijo, que queijo com peixe é crime.',
        ],
        waiting: ['Peixe, batata e cebola. Queijo, jamais.'],
        recipe: ['peixe', 'batata', 'cebola'],
        loves: 'pao_quente',
        thanks: ['Isso sim é prato de pescador! O rio agradece.'],
        bonusThanks: ['Com pão quentinho para molhar? O senhor é um gênio. Tome aqui.'],
        done: ['Quem come peixe com batata nunca desiste do rio.'],
        coins: 8,
        bonusCoins: 6,
      },
      {
        name: 'Madame Cogumela, a Colecionadora',
        prompt: 'Falar com a Colecionadora',
        request: [
          'Colecionei receitas por todo o reino e hoje quero a minha preferida. [EXEMPLO]',
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
      talkCook: 'Fale com o Zé, atrás do balcão',
      takeOrder: 'Converse com os clientes e descubra os pedidos ({n}/3)',
      plate: 'Monte o prato de {name} no balcão',
      reward: 'Volte ao Zé para pegar a chave de cobre',
      done: 'Volte ao mapa: a terceira chave está com você',
    },
    done: 'O balcão está limpo e o cheiro de comida boa ainda enche a casa. A chave de cobre já está com você.',
  },

  // ---------- Vinhedo Dourado ----------
  // Textos de exemplo ([EXEMPLO]): troque pelos nomes, pelas uvas e pelas piadas reais.
  // Cada uva tem doçura, acidez e corpo (0 a 3). A mistura certa deixa a média de cada um dentro da faixa de `blend.solution`.
  vineyard: {
    areaName: 'Vinhedo Dourado',
    intro: [
      'O sol baixo pinta as fileiras de videira de dourado. O cheiro de uva madura vem junto com o vento.',
      'Lá no fundo, debaixo de um galpão de pedra, uma mulher de lenço na cabeça pisa em alguma coisa e canta sozinha.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    crows: 'Corvos de névoa descem das videiras, atraídos pelo cacho brilhante!',
    keeper: {
      name: 'Dona Vitória, a Vinicultora',
      prompt: 'Falar com a Dona Vitória',
      greet: [
        'Que bom que alguém apareceu! A colheita está madura e eu estou sozinha. [EXEMPLO]',
        'Preciso de quatro cachos especiais, um de cada tipo: roxa, verde, rosada e dourada. Cada um está escondido entre as fileiras e brilha quando você chega perto.',
        'Com eles, a gente faz a mistura no lagar. Se der certo, a última garrafa da safra é sua. Ela abre uma porta do castelo.',
      ],
      waiting: ['Os cachos brilham entre as fileiras. Procure nos corredores de videira, um de cada tipo.'],
      ready: ['Os quatro! Agora é com o lagar: misture os cachos até o sabor ficar redondo. Prove quantas vezes quiser.'],
      reward: [
        'Isso! Doce na medida, ácido na medida, corpo de sobra. É assim que se faz um vinho de gente grande.',
        'Prometi e cumpro. Esta é a última garrafa da safra. Guarde para um brinde importante.',
      ],
      done: ['A safra foi boa, a vinha está feliz e eu também. Faça um bom brinde com aquela garrafa.'],
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
      harvest: 'Colha os cachos especiais entre as fileiras ({n}/4)',
      press: 'Leve os cachos ao lagar e faça a mistura',
      reward: 'Volte à Dona Vitória para pegar a garrafa',
      done: 'Volte ao mapa: a garrafa está com você',
    },
    done: 'A safra está guardada e a última garrafa já está com você.',
  },

  // ---------- Castelo ----------
  // Textos de exemplo ([EXEMPLO]): troque pelas falas e pelas pistas reais.
  castle: {
    areaName: 'Castelo',
    zoneNames: ['Pátio do Portão', 'Labirinto Escuro', 'Salão das Memórias'],
    intro: [
      'O castelo se ergue contra o céu escuro, enorme e silencioso. Um portão de ferro e madeira fecha o pátio.',
      'Ao lado dele, três fechaduras brilham fracas: espiga, estrela e cobre. Você já conhece essas chaves.',
    ],
    back: { prompt: 'Voltar ao mapa' },
    gate: {
      examinePrompt: 'Examinar o portão',
      sealed: ['O portão não se mexe. Três fechaduras seguram as trancas, e todas precisam girar.'],
      enterPrompt: 'Entrar no castelo',
      opened: ['As três trancas caem juntas, e o portão se abre devagar, rangendo como quem acorda.', 'Lá dentro, só escuridão. Os corredores esperam.'],
    },
    locks: {
      trigo: {
        name: 'Fechadura de trigo',
        key: 'chave_trigo',
        prompt: 'Usar a chave de trigo',
        missing: ['A fechadura tem o desenho de uma espiga de trigo. Falta a chave que o moleiro guardava.'],
        turned: ['A chave de trigo gira e se desfaz em grãos dourados. Um clique ecoa pelo pátio.'],
      },
      estrela: {
        name: 'Fechadura de estrela',
        key: 'chave_estrela',
        prompt: 'Usar a chave de estrela',
        missing: ['Uma fechadura em forma de estrela. A chave certa estava guardada junto do cristal das Ruínas.'],
        turned: ['A chave de estrela gira e se apaga como uma estrela cadente. Outro clique ecoa.'],
      },
      cobre: {
        name: 'Fechadura de cobre',
        key: 'chave_cobre',
        prompt: 'Usar a chave de cobre',
        missing: ['Uma fechadura de cobre, manchada de fumaça. Essa chave cheira a pão e a lenha.'],
        turned: ['A chave de cobre gira e esquenta na mão antes de sumir. O último clique é o mais grave.'],
      },
    },
    maze: {
      intro: [
        'O corredor é estreito e a tocha só alcança alguns passos. Atrás de cada esquina, outra esquina.',
        'No chão, junto à entrada, um pedestal vazio com a forma de um cristal.',
      ],
      pedestalPrompt: 'Pôr o cristal no pedestal',
      pedestalNoCrystal: ['Um pedestal com a forma de um cristal. Quem sabe as Ruínas tenham algo que encaixe aqui.'],
      pedestalLit: ['O cristal encaixa e pulsa. No chão, setas de luz azul acendem nas bifurcações, apontando o caminho.'],
      potionPrompt: 'Beber a Poção de Coragem',
      potionLines: ['Tem gosto de morango. A tocha parece queimar mais alto, e a escuridão recua alguns passos.', 'Seus corações se enchem de coragem.'],
      foes: 'Algo se arrasta no corredor à frente. A névoa daqui tem olhos.',
      webPrompt: 'Cortar a teia',
      webNoSword: ['Uma teia grossa bloqueia o corredor. Algo bem afiado resolveria.'],
      webCut: ['Um golpe de espada, e a teia se abre como uma cortina velha.'],
      exitPrompt: 'Subir ao Salão das Memórias',
      backPrompt: 'Descer ao pátio',
    },
    hall: {
      intro: [
        'O salão é largo e quieto. Nas paredes, cinco molduras douradas esperam por lembranças.',
        'Ao centro, uma mesa posta com dois cálices vazios. No fundo, uma porta alta com um selo de luz.',
      ],
      downPrompt: 'Descer ao labirinto',
      guardian: {
        name: 'Guardiã Aurora',
        prompt: 'Falar com a Guardiã',
        greet: [
          'Seja bem-vindo, Matheus. Eu cuido do que o castelo não pode esquecer. [EXEMPLO]',
          'Cada moldura guarda uma lembrança sua. Para a porta do trono se abrir, elas precisam estar na ordem em que aconteceram.',
          'Eu vou lembrar a ordem, uma pista por vez.',
        ],
        clueLine: '{n}ª: {clue}',
        noMemories: ['Você ainda não reuniu lembranças suficientes. Visite as ruínas, a taverna e o vinhedo.'],
        right: ['Isso! Todas no lugar. As molduras acenderam por inteiro.', 'Falta o brinde. A mesa está pronta e a garrafa certa já está com você.'],
        after: ['As lembranças estão em ordem. Faça o brinde, e a porta do trono se abre.'],
      },
      order: [
        { id: 'ruinas_chamas', clue: 'Onde tudo começou.' },
        { id: 'ruinas_simbolos', clue: 'Um dia qualquer, desses que a gente guarda sem perceber.' },
        { id: 'ruinas_eco', clue: 'Uma risada que ninguém explica.' },
        { id: 'taverna_jantar', clue: 'Uma mesa, comida boa e conversa até esfriar o prato.' },
        { id: 'vinhedo_brinde', clue: 'A primeira vez que brindaram com qualquer coisa.' },
      ],
      memoryGame: {
        title: 'Molduras do Salão',
        hint: 'Toque nas lembranças na ordem em que aconteceram. Toque numa lembrança já escolhida para tirá-la.',
        empty: 'Escolha as lembranças',
        confirm: 'Conferir',
        clear: 'Limpar',
        incomplete: 'Ainda faltam lembranças na sequência.',
        wrong: 'Só {n} estão no lugar certo. Releia as pistas da Guardiã e tente de novo.',
        icon: '🖼️',
      },
      framePrompt: 'Examinar a moldura',
      frameDark: 'Uma moldura apagada. Ainda falta reunir essa lembrança.',
      table: {
        prompt: 'Fazer o brinde',
        locked: ['A mesa está posta, mas o brinde só faz sentido depois que as lembranças estiverem em ordem. Fale com a Guardiã.'],
        noBottle: ['Os cálices esperam por um vinho especial. Será que você guardou a garrafa do vinhedo?'],
        lines: [
          'Você enche dois cálices com a última garrafa do vinhedo. O vinho é dourado e cheira a tarde de sol.',
          '"Às lembranças", diz a Guardiã. O brinde tilinta pelo salão inteiro, e o selo da porta do trono se desfaz.',
        ],
        done: ['Os cálices ainda estão quentes de brinde. A porta do trono já está livre.'],
      },
      throne: {
        sealedPrompt: 'Examinar a porta do trono',
        sealed: ['Um selo de luz fecha a porta do trono. Falta uma coisa que só se faz em boa companhia: o brinde.'],
        prompt: 'Abrir a porta do trono',
        finale: [
          'A porta alta se abre sem um som. Do outro lado, uma luz quente, como a de uma lareira acesa.',
          'Você respira fundo. Foi um longo caminho até aqui, e cada passo dele tinha um motivo.',
        ],
        endTitle: 'Você chegou ao fim do caminho',
        endText: 'A porta do trono se abriu. O que o espera na Sala do Tesouro merece uma entrada à altura.',
        endButton: 'Seguir em frente',
        done: ['A porta do trono está aberta. A Sala do Tesouro espera.'],
      },
    },
    objective: {
      gate: 'Abra as três fechaduras do portão ({n}/3)',
      enter: 'Entre no castelo pelo portão aberto',
      maze: 'Encontre a saída do labirinto escuro',
      crystal: 'Ponha o cristal no pedestal para ver o caminho',
      webs: 'Corte as teias com a espada ({n}/{total})',
      memories: 'Fale com a Guardiã e ponha as lembranças em ordem',
      toast: 'Faça o brinde na mesa do salão',
      throne: 'Abra a porta do trono',
      done: 'A porta do trono está aberta: siga para a Sala do Tesouro',
    },
  },

  // ---------- Sala do Tesouro (final) ----------
  // Textos de exemplo ([EXEMPLO]): troque pela carta, pelos dados do voucher e pelas falas reais.
  ending: {
    areaName: 'Sala do Tesouro',
    intro: [
      'A porta do trono se abre para uma sala quente, cheia de ouro e de velas.',
      'No fundo, sobre um degrau de pedra, um baú dourado espera por você.',
    ],
    objective: {
      chest: 'Abra o baú dourado, no fundo da sala',
      voucher: 'Veja o seu presente no baú',
      done: 'Feliz aniversário, Matheus!',
    },
    chest: {
      prompt: 'Abrir o baú',
      promptDone: 'Ver o voucher',
      try: [
        'Você segura a tampa e puxa. Nada. Empurra. Nada.',
        'O baú tem duas fechaduras, e você só alcança uma. Este tesouro não pode ser aberto sozinho.',
      ],
      company: [
        'Atrás de você, a porta da sala range.',
        'Passos. Uma luz quente de tocha corre pelas paredes.',
        'E você já sabe de quem é a sombra no chão antes mesmo de virar.',
      ],
      open: [
        'Vocês viram as duas chaves ao mesmo tempo.',
        'A tampa se ergue devagar, e uma luz dourada enche a sala inteira.',
      ],
    },
    helena: {
      name: 'Helena',
      prompt: 'Falar com a Helena',
      greet: [
        'Demorou, hein?',
        'Eu sabia que você ia conseguir. Cada chave, cada lembrança, cada passo... tudo isso tinha um motivo.',
        'Feliz aniversário, Matheus.',
        'Esse baú tem duas fechaduras. Uma é sua. A outra sempre foi minha. Vamos abrir juntos?',
      ],
      after: ['Ainda não acredito que você chegou até aqui. Estou orgulhosa de você. [EXEMPLO]'],
    },
    reveal: [
      'Dentro do baú, um envelope dourado e um cheirinho de cozinha.',
      '"Farinha, ovos, vinho... então era isso! As lembranças de massa, a bancada, a risada."',
      'Tudo fazia sentido agora: cada ingrediente da viagem era uma pista.',
    ],
    letter: {
      title: 'Para o Matheus',
      paragraphs: [
        'Matheus,',
        'Se você chegou até aqui, então atravessou florestas, ruínas e um castelo inteiro por mim. [EXEMPLO]',
        'Eu queria te dar um presente que não coubesse numa caixa: uma tarde só nossa, de mãos na massa, rindo e fazendo bagunça.',
        'Feliz aniversário. Obrigada por ser o meu melhor companheiro de aventura.',
        '— H.',
      ],
      close: 'Guardar a carta',
    },
    voucher: {
      title: 'Workshop de Massas e Vinhos',
      place: 'La Mia Cuzina',
      lines: [
        'Válido para: Matheus e a Helena',
        'Uma tarde de massas frescas feitas à mão, harmonizadas com vinhos.',
        'Data: a combinar [EXEMPLO]',
        'Local: La Mia Cuzina [EXEMPLO: endereço]',
      ],
      footer: 'Com amor, H.',
      save: 'Salvar o voucher',
      close: 'Guardar',
      fileName: 'voucher-workshop-matheus.png',
    },
    finale: [
      'Vocês ficam lado a lado, diante do baú aberto, com o ouro brilhando nas paredes.',
      '"E agora?", você pergunta.',
      '"Agora a gente vai cozinhar.", ela responde, sorrindo.',
    ],
    endTitle: 'Feliz aniversário, Matheus!',
    endText: 'Fim da aventura. O presente de verdade começa agora.',
    endButton: 'Continuar na sala',
    done: ['A sala está quieta, quente e cheia de ouro. O melhor tesouro está ao seu lado.'],
  },

  // ---------- Memórias (aparecem quando um altar acende) ----------
  // Textos de exemplo ([EXEMPLO]). `photo` é o nome do arquivo em public/photos/ (sem foto, mostra a moldura vazia).
  memories: {
    ruinas_chamas: {
      title: 'A primeira vez',
      text: ['[EXEMPLO] Lembra do dia em que tudo começou? A gente nem imaginava onde isso ia dar.', 'Foi aí que a luz acendeu pela primeira vez.'],
      caption: '[EXEMPLO] Onde tudo começou',
      photo: 'ruinas_chamas.jpg',
    },
    ruinas_simbolos: {
      title: 'Um dia qualquer',
      text: ['[EXEMPLO] Nem foi um dia especial. Foi só um dia bom, desses que a gente guarda sem perceber.'],
      caption: '[EXEMPLO] Um dia bom',
      photo: 'ruinas_simbolos.jpg',
    },
    ruinas_eco: {
      title: 'A risada',
      text: ['[EXEMPLO] Aquela risada que ninguém consegue explicar, mas todo mundo lembra.'],
      caption: '[EXEMPLO] A risada',
      photo: 'ruinas_eco.jpg',
    },
    taverna_jantar: {
      title: 'O jantar',
      text: ['[EXEMPLO] Nada de especial: uma mesa, comida boa e conversa até esfriar o prato. Foi tudo.'],
      caption: '[EXEMPLO] O jantar',
      photo: 'taverna_jantar.jpg',
    },
    vinhedo_brinde: {
      title: 'O brinde',
      text: ['[EXEMPLO] A gente brindou com qualquer coisa e achou que era o melhor vinho do mundo. Era só a companhia.'],
      caption: '[EXEMPLO] O brinde',
      photo: 'vinhedo_brinde.jpg',
    },
    castelo_brinde: {
      title: 'Às lembranças',
      text: ['[EXEMPLO] Teve um brinde que não precisou de motivo. Foi só a gente, e já era o bastante.'],
      caption: '[EXEMPLO] O brinde final',
      photo: 'castelo_brinde.jpg',
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
    newPath: 'Novo caminho: {name}',
    firstOpen: [
      'Você desdobra o mapa. É um pergaminho velho, riscado a tinta, com uma estrada de terra saindo da vila.',
      'A maior parte do reino está coberta de nuvens pintadas. Elas vão sumindo conforme você avança.',
    ],
    locked: {
      forest: 'O portão da vila ainda não se abriu para este caminho.',
      middle: 'Uma nuvem espessa cobre este lugar. Quem sabe, depois de resolver as pendências da vila, ela se dissipe.',
      castle: 'Nuvens escuras envolvem o castelo. Só quem passar por todos os lugares do reino chegará até aqui.',
      ending: 'Ainda não é hora de abrir este lugar.',
    },
    objective: {
      forest: 'Abra o mapa e siga a estrada até a Floresta',
      explore: 'Explore o reino: {n} de 4 lugares concluídos',
      castle: 'O Castelo espera por você',
      ending: 'Entre na Sala do Tesouro',
    },
  },

  areas: {
    village: 'Vila do Amanhecer',
    map: 'Mapa do Reino',
    forest: 'Floresta dos Sussurros',
    ruins: 'Ruínas Esquecidas',
    tavern: 'Taverna do Zé',
    vineyard: 'Vinhedo Dourado',
    castle: 'Castelo',
    ending: 'Sala do Tesouro',
    visual: 'Teste visual',
  },
} as const;

export type Content = typeof content;
export type ItemId = keyof typeof content.items;

/** Troca {chave} por valores: fmt('Faltam {n}', { n: 2 }). */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
