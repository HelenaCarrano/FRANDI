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
    cookieOption: '🥠 Quebrar o biscoito da sorte',
    cookieUsed: 'O biscoito se parte: uma resposta errada some.',
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
    maca: { name: 'Maçã do Tito', icon: '🍎', desc: 'Vermelha e brilhante. Cavalos desconfiados costumam mudar de ideia por uma maçã.', usedIn: 'Estábulo' },
    ferradura: { name: 'Ferraduras novas', icon: '🧲', desc: 'Quatro ferraduras forjadas pelo Brutus, ainda mornas. Cada uma tem um "M" riscado.', usedIn: 'Estábulo' },
    espada: { name: 'Espada do Ferreiro', icon: '🗡️', desc: 'Forjada para você. Corta arbustos, teias e, quem sabe, pão.', usedIn: 'Floresta e Castelo' },
    mochila: { name: 'Mochila', icon: '🎒', desc: 'Leva tudo o que você coletar pelo caminho.', usedIn: 'Toda a aventura' },
    chave_trigo: { name: 'Chave de trigo', icon: '🌾', desc: 'Uma chave em forma de espiga de trigo. A primeira das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    mapa: { name: 'Mapa do Reino', icon: '🗺️', desc: 'Mostra o caminho para além da vila.', usedIn: 'Portão da vila e mapa central' },
    ovos: { name: 'Ovos da Clotilde', icon: '🥚', desc: 'Meia dúzia de ovos caipiras, ainda quentinhos. "Os melhores do vale", segundo ela.', usedIn: 'Taverna' },
    pocao: { name: 'Poção de Coragem', icon: '🧪', desc: 'Tem gosto de morango. Dizem que cura o medo do escuro.', usedIn: 'Castelo' },
    pao: { name: 'Pão quentinho', icon: '🍞', desc: 'Saído do forno agora há pouco. Ainda solta vapor.', usedIn: 'Taverna' },
    farinha: { name: 'Pacote de farinha misterioso', icon: '🌫️', desc: 'A Dona Pimenta jura que "vai ser importante mais tarde". Não faz sentido nenhum... por enquanto.', usedIn: 'Taverna' },
    biscoito: { name: 'Biscoito da sorte', icon: '🥠', desc: 'O papelzinho dentro diz: "Você vai comer este biscoito." Acertou.', usedIn: 'Torre' },
    cristal: { name: 'Cristal das Ruínas', icon: '💎', desc: 'Pulsa devagar, como se lembrasse de tudo o que viu. Os três altares das Ruínas deixaram uma luz dentro dele.', usedIn: 'Castelo' },
    chave_estrela: { name: 'Chave de estrela', icon: '⭐', desc: 'Uma chave com a ponta em forma de estrela, ainda fria do alto da torre. A segunda das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    chave_cobre: { name: 'Chave de cobre', icon: '🗝️', desc: 'Uma chave de cobre com cheiro de pão e de lenha. A terceira das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    garrafa: { name: 'Garrafa do Vinhedo', icon: '🍷', desc: 'A última garrafa da safra, com a rolha ainda úmida de cera. Guardada para um brinde importante.', usedIn: 'Castelo' },
  },

  // ---------- Vila ----------
  // Tudo aqui é texto de exemplo ([EXEMPLO]): troque pelos nomes, bichos e piadas reais.
  village: {
    areaName: 'Vila do Amanhecer',
    intro: [
      'Uma mensagem misteriosa ecoa pelo vale...',
      '"Seu presente foi escondido. Atravesse este mundo para encontrá-lo."',
      'Ao amanhecer, um cavalo chegou sozinho à vila. Na sela, uma bolsa com o seu nome.',
    ],

    letter: {
      title: 'Uma carta sem remetente',
      paragraphs: [
        'Matheus,',
        'Seu presente foi escondido em algum lugar deste mundo.',
        'Para encontrá-lo, você vai atravessar florestas, ruínas, torres e castelos.',
        'Este cavalo veio buscar você. Cuide bem dele: ele sabe o caminho.',
        '— H.',
      ],
      close: 'Guardar a carta',
    },

    quests: {
      horse: { title: 'O cavalo desconfiado', coins: 6 },
      shoes: { title: 'Ferraduras novas', coins: 12 },
      mill: { title: 'O moinho parado', coins: 10 },
      hens: { title: 'Fuga das galinhas', coins: 15 },
    },

    /** Nome do cavalo. [EXEMPLO] */
    horseName: 'Trovão',

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
        'Ah, graças a Deus, alguém! O senhor é o Matheus? Aquele da bolsa?',
        'Esse cavalo chegou sozinho ao amanhecer, trotando pela estrada como quem tem hora marcada.',
        'Na sela, uma bolsa com seu nome. Só que ele morde quem chega perto. Perdi um chapéu e metade da paciência.',
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
        'A bolsa da sela se solta com um clique. Dentro, um envelope com a letra de alguém que você conhece bem.',
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
        'E para a estrada vai precisar de algo mais que cenoura: esta espada. Forjei hoje cedo sem saber para quem. Agora sei.',
        'Leve as ferraduras ao Tito. Ele sabe colocar.',
      ],
      progress: ['As ferraduras já estão com você. Leve ao Tito, no estábulo.'],
      done: ['Cuide bem dessa espada. Ela já cortou muita coisa... principalmente pão.'],
    },

    // ----- Seu Alvim e o moinho -----
    miller: {
      noLetter: ['Hm? Visita? Estou ocupado olhando para o moinho. Ele me ignora, eu ignoro ele.'],
      offer: [
        'Você é o do cavalo? Ótimo, notícia corre mais que o vento por aqui, e o vento anda parado.',
        'O moinho emperrou na semana passada. As engrenagens da casa de máquinas saíram do encaixe: três rodas, e cada uma que eu mexo arrasta a vizinha.',
        'Se conseguir alinhar as marcas todas para cima, eu devolvo o favor com a chave da despensa de trigo.',
      ],
      yes: 'Eu dou uma olhada',
      no: 'Agora não',
      decline: ['Tudo bem. O moinho não vai a lugar nenhum. É esse o problema.'],
      accepted: ['A casa de máquinas fica aos pés do moinho. É só chegar e mexer nas rodas. Elas giram quando você toca.'],
      progress: ['As engrenagens ficam na casa de máquinas, aos pés do moinho. Toque nelas até as marcas ficarem para cima.'],
      ready: [
        'ELE VOLTOU A GIRAR! Escute só esse rangido bom.',
        'Prometi uma chave, e aqui está: a chave em forma de espiga, a primeira das três do castelo.',
        'E aceite esta mochila de couro. Foi do meu avô e carregou mais farinha que histórias.',
      ],
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
        'Você salvou a minha manhã. Tome as moedas e estes ovos: os melhores do vale, rigorosamente.',
        'E uma dica de ouro: quem leva ovos à taverna ganha o respeito do cozinheiro.',
      ],
      done: ['A Beyoncé conta pra todo mundo da fuga. Ela é dramática como a dona.'],
      penToast: 'Galinha no cercado: {n} de {total}',
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
      shopTitle: 'Loja da Dona Pimenta',
      shopHint: 'Dica: o mapa é obrigatório para passar pelo portão da vila.',
    },

    /** Itens da loja, na ordem exibida, e o preço. As quests pagam bem mais que o mapa. */
    shop: [
      { id: 'mapa', price: 10 },
      { id: 'pao', price: 4 },
      { id: 'pocao', price: 8 },
      { id: 'farinha', price: 6 },
      { id: 'biscoito', price: 7 },
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
        'Sem um mapa, você se perderia no primeiro cruzamento. A Dona Pimenta vende um.',
      ],
      open: [
        'A chave de trigo gira na fechadura. Com o mapa na mão, você respira fundo.',
        'O portão se abre devagar. A aventura de verdade começa agora.',
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
      needMap: 'Compre um mapa com a Dona Pimenta',
      needCoins: 'Ganhe moedas ajudando os moradores',
      gate: 'Atravesse o portão norte da vila',
      done: 'Siga pelo portão até o mapa do reino',
      hens: 'Leve as galinhas ao cercado ({n}/6)',
    },
  },

  // ---------- Floresta dos Sussurros ----------
  // Textos de exemplo ([EXEMPLO]).
  forest: {
    areaName: 'Floresta dos Sussurros',
    intro: [
      'A estrada de terra entra na mata. A luz do fim de tarde ainda atravessa as copas.',
      'Mas a floresta escurece depressa. Dizem que, quando a noite cai, os vagalumes mostram o caminho a quem sabe segui-los.',
    ],
    objective: {
      follow: 'Siga a trilha pela floresta',
      fireflies: 'Siga os vagalumes',
      thorns: 'Corte os espinhos com a espada',
      portal: 'Chegue ao portal de pedra',
      done: 'Volte ao mapa: novos caminhos se abriram',
    },
    back: {
      prompt: 'Voltar ao mapa',
    },
    horseStops: [
      '{name} para na beira da sombra, bufa e recua dois passos.',
      'Ele tem medo do escuro. Vai esperar aqui por você, e vai estar aqui na volta.',
    ],
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
    thorns: {
      prompt: 'Cortar os espinhos',
      noSword: ['Os espinhos são grossos demais para passar. Algo bem afiado resolveria.'],
      cut: ['Você abre caminho a golpes de espada. Folhas e gravetos voam para todo lado.'],
    },
    portal: {
      prompt: 'Examinar o portal',
      lines: [
        'No fim da trilha, um arco de pedra muito antigo brilha com símbolos azuis.',
        'Os símbolos lembram uma escrita que você já viu... mas ainda não sabe onde.',
        'Do outro lado do arco, o ar tem cheiro de memória. As Ruínas esperam.',
      ],
      done: 'O portal pulsa devagar, como um coração. O caminho para as Ruínas está aberto.',
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
      crystal: 'Pegue o cristal no centro do pátio',
      done: 'Volte ao mapa: novos caminhos se abriram',
    },
    altarLit: 'O cristal acende. Uma lembrança vem à tona...',
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
        'Algo no castelo vai querer saber disso.',
      ],
    },
    done: 'O pedestal está vazio, mas o pátio ainda guarda um brilho azul. O caminho de volta está livre.',
  },

  // ---------- Torre do Saber ----------
  // Textos de exemplo ([EXEMPLO]): troque pelas perguntas e pelas memórias reais.
  tower: {
    areaName: 'Torre do Saber',
    intro: [
      'A porta da torre range sozinha. Lá dentro, uma escada de pedra sobe de sala em sala.',
      'Cada andar tem um guardião, e cada guardião faz uma pergunta. Quem acerta ganha a escada. Quem erra ganha uma dica.',
    ],
    floorNames: ['Biblioteca', 'Sala dos Relógios', 'Laboratório', 'Salão dos Espelhos', 'Observatório'],
    floorLabel: '{n}º andar · {name}',
    door: {
      up: 'Subir para o {n}º andar',
      down: 'Descer para o {n}º andar',
      exit: 'Voltar ao mapa',
      sealedPrompt: 'Examinar o selo',
      sealed: ['A passagem está selada por uma luz vermelha. O guardião deste andar sabe como abri-la.'],
      opened: 'O selo se desfaz. A escada está livre.',
    },
    guardians: [
      {
        name: 'Madame Lívia, a Bibliotecária',
        prompt: 'Falar com a Bibliotecária',
        greet: ['Shhh! Aqui se lê em silêncio, mas se responde em voz alta. [EXEMPLO]', 'Uma pergunta fácil para aquecer, e a escada é sua.'],
        after: ['Pode subir, querido. E leve um livro, se quiser.'],
        quiz: {
          question: 'Qual é a cor favorita do Matheus? [EXEMPLO]',
          options: ['Azul', 'Verde', 'Vermelho'],
          answer: 0,
          hint: ['Tente pensar na cor do céu numa tarde sem nuvens.'],
          right: ['Isso! Está tudo escrito nos livros. Pode subir.'],
        },
      },
      {
        name: 'Relojoeiro Ambrósio',
        prompt: 'Falar com o Relojoeiro',
        greet: ['Tique, taque. Tudo aqui tem hora, menos a minha paciência. [EXEMPLO]'],
        after: ['O tempo passa, mas você já passou. Suba.'],
        quiz: {
          question: 'Em que mês o Matheus faz aniversário? [EXEMPLO]',
          options: ['Março', 'Julho', 'Outubro'],
          answer: 1,
          hint: ['Pense nas férias de inverno.'],
          right: ['Pontual como um relógio suíço!'],
        },
      },
      {
        name: 'Alquimista Bruma',
        prompt: 'Falar com a Alquimista',
        greet: ['Cuidado com o caldeirão! Ele borbulha quando mente. [EXEMPLO]'],
        after: ['A poção aprovou você. Siga em frente.'],
        quiz: {
          question: 'Qual é a comida preferida do Matheus? [EXEMPLO]',
          options: ['Pizza', 'Churrasco', 'Lasanha'],
          answer: 1,
          hint: ['O cheiro da brasa já diz tudo.'],
          right: ['O caldeirão borbulhou de alegria. Acertou!'],
        },
      },
      {
        name: 'O Espelho Falante',
        prompt: 'Falar com o Espelho',
        greet: ['Eu só mostro o que você já sabe. Vamos ver se sabe mesmo. [EXEMPLO]'],
        after: ['Seu reflexo sorri. Pode seguir.'],
        quiz: {
          question: 'Qual é o bicho de estimação do Matheus? [EXEMPLO]',
          options: ['Um gato', 'Um cachorro', 'Um papagaio'],
          answer: 0,
          hint: ['Ele ronrona e dorme em cima do teclado.'],
          right: ['O reflexo concorda. A escada se abre.'],
        },
      },
      {
        name: 'Astrônomo Orion',
        prompt: 'Falar com o Astrônomo',
        greet: ['Cheguei até aqui contando estrelas. Última pergunta, e o baú é seu. [EXEMPLO]'],
        after: ['As estrelas estão a seu favor. O baú espera.'],
        quiz: {
          question: 'Onde foi a primeira viagem do Matheus e da H.? [EXEMPLO]',
          options: ['Na praia', 'Na serra', 'Numa cidade grande'],
          answer: 1,
          hint: ['Fazia frio e tinha lareira.'],
          right: ['Ah, essa constelação eu conheço! Pode abrir o baú.'],
        },
      },
    ],
    chest: {
      prompt: 'Abrir o baú',
      locked: ['O baú está trancado por um feitiço. O Astrônomo sabe a palavra.'],
      lines: [
        'O baú abre devagar. Dentro, sobre um tecido azul, há uma chave com a ponta em forma de estrela.',
        'Ela brilha como se tivesse guardado uma lembrança.',
      ],
    },
    objective: {
      talk: 'Fale com o guardião do {n}º andar',
      climb: 'Suba para o {n}º andar',
      chest: 'Abra o baú no observatório',
      done: 'Volte ao mapa: a segunda chave está com você',
    },
    done: 'O baú está vazio, mas a torre ainda cintila. A chave de estrela já está com você.',
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
    torre_topo: {
      title: 'Lá do alto',
      text: ['[EXEMPLO] De cima a gente enxerga longe. Foi num lugar alto assim que a gente teve a certeza.'],
      caption: '[EXEMPLO] Lá do alto',
      photo: 'torre_topo.jpg',
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
      middle: 'Uma nuvem espessa cobre este lugar. Talvez a floresta guarde uma pista de como dissipá-la.',
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
    tower: 'Torre do Saber',
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
