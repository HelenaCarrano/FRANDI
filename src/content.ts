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
    backToVillage: 'Voltar para a vila',
  },

  // ---------- itens ----------
  // Cada item tem uso real mais adiante (usedIn). [EXEMPLO] nas piadas internas.
  items: {
    ferro: { name: 'Barra de ferro', icon: '🔩', desc: 'Ferro bruto, ainda frio. O Ferreiro precisa dele para forjar a espada.', usedIn: 'Ferraria' },
    carvao: { name: 'Carvão', icon: '⚫', desc: 'Pedras negras que mantêm a forja acesa por horas.', usedIn: 'Ferraria' },
    couro: { name: 'Pedaço de couro', icon: '🟤', desc: 'Couro curtido. Vai virar a alça da mochila.', usedIn: 'Ferraria' },
    espada: { name: 'Espada do Ferreiro', icon: '🗡️', desc: 'Forjada para você. Corta arbustos, teias e, quem sabe, pão.', usedIn: 'Floresta e Castelo' },
    mochila: { name: 'Mochila', icon: '🎒', desc: 'Leva tudo o que você coletar pelo caminho.', usedIn: 'Toda a aventura' },
    chave_trigo: { name: 'Chave de trigo', icon: '🌾', desc: 'Uma chave em forma de espiga de trigo. A primeira das três chaves do castelo.', usedIn: 'Portão do Castelo' },
    mapa: { name: 'Mapa do Reino', icon: '🗺️', desc: 'Mostra o caminho para além da vila.', usedIn: 'Portão da vila e mapa central' },
    carta: { name: 'Carta do Mensageiro', icon: '✉️', desc: 'Uma carta lacrada para entregar a um morador.', usedIn: 'Casas da vila' },
    pocao: { name: 'Poção de Coragem', icon: '🧪', desc: 'Tem gosto de morango. Dizem que cura o medo do escuro.', usedIn: 'Castelo' },
    pao: { name: 'Pão quentinho', icon: '🍞', desc: 'Saído do forno agora há pouco. Ainda solta vapor.', usedIn: 'Taverna' },
    farinha: { name: 'Pacote de farinha misterioso', icon: '🌫️', desc: 'A Dona Pimenta jura que "vai ser importante mais tarde". Não faz sentido nenhum... por enquanto.', usedIn: 'Taverna' },
    biscoito: { name: 'Biscoito da sorte', icon: '🥠', desc: 'O papelzinho dentro diz: "Você vai comer este biscoito." Acertou.', usedIn: 'Torre' },
  },

  // ---------- Vila ----------
  // Tudo aqui é texto de exemplo ([EXEMPLO]): troque pelas piadas e nomes reais.
  village: {
    areaName: 'Vila do Amanhecer',
    intro: [
      'Uma mensagem misteriosa ecoa pelo vale...',
      '"Seu presente foi escondido. Atravesse este mundo para encontrá-lo."',
      'Na praça, um mensageiro acena como quem corre atrás de você há dias.',
    ],

    letter: {
      title: 'Uma carta sem remetente',
      paragraphs: [
        'Matheus,',
        'Seu presente foi escondido em algum lugar deste mundo.',
        'Para encontrá-lo, você vai atravessar florestas, ruínas, torres e castelos.',
        'Comece pela vila. Alguém aí sabe por onde.',
        '— H.',
      ],
      close: 'Guardar a carta',
    },

    quests: {
      smith: { title: 'Três materiais', coins: 12 },
      mail: { title: 'Cartas da vila', coins: 15 },
      pet: { title: 'O fugitivo Fubá', coins: 10 },
    },

    npcs: {
      messenger: { name: 'Tico, o Mensageiro', prompt: 'Falar com o Mensageiro' },
      smith: { name: 'Brutus, o Ferreiro', prompt: 'Falar com o Ferreiro' },
      merchant: { name: 'Dona Pimenta', prompt: 'Falar com a Comerciante' },
    },

    messenger: {
      first: [
        'Ei, ei, ei! Você é o Matheus? Graças aos céus!',
        'Corri a noite inteira atravessando o vale para te achar.',
        'Entregaram isto na minha porta. Dizia: "só para o Matheus".',
      ],
      afterLetter: [
        'Não sei o que significa, mas o Ferreiro pareceu saber de algo.',
        'Vá falar com ele, na ferraria, a que solta fumaça.',
      ],
      mailOffer: [
        'Já que você está aqui... tenho três cartas para entregar e minhas pernas pedem folga.',
        'Entrega para mim? Eu pago com moedas!',
      ],
      mailYes: 'Claro, deixa comigo!',
      mailNo: 'Agora não',
      mailDecline: ['Sem problema. Se mudar de ideia, minhas pernas e eu estaremos aqui.'],
      mailAccepted: [
        'Maravilha! Uma é para a Dona Rosa, outra para o Seu Antônio e a última para o Zé, da taverna.',
        'E não leia. (Ninguém nunca lê. Mentira, todo mundo lê.)',
      ],
      mailProgress: 'Ainda faltam {n} cartas: Dona Rosa, Seu Antônio e o Zé da taverna.',
      mailDone: [
        'Todas entregues? Você é rápido!',
        'Aqui estão suas moedas. Gaste bem... ou com farinha.',
      ],
      idle: ['Se precisar de mim, estarei aqui. Descansando. Muito.'],
    },

    houses: {
      allDelivered: 'Todas entregues! Volte ao Mensageiro.',
      rosa: {
        prompt: 'Entregar a carta',
        lines: ['Dona Rosa: "Uma carta? Faz anos que ninguém me escreve! Obrigada, querido."'],
      },
      antonio: {
        prompt: 'Entregar a carta',
        lines: ['Seu Antônio: "Finalmente! Já achava que tinham esquecido de mim. Boa sorte aí na sua aventura!"'],
      },
      ze: {
        prompt: 'Entregar a carta',
        lines: ['Zé da taverna: "Carta pra mim? Deve ser a conta do fornecedor de vinho. Abre você."', '(sussurrando) "...Brincadeira. Obrigado!"'],
      },
    },

    smith: {
      noLetter: [
        'Hmpf. Você parece ter pressa de aventura.',
        'Mas o Mensageiro estava te procurando. Fale com ele primeiro.',
      ],
      offer: [
        'Então você é o Matheus. Li a carta por cima do ombro do Tico. Perdão.',
        'Seu presente está longe e o caminho é perigoso. Não vai sair daqui desarmado.',
        'Eu forjo uma espada para você, mas preciso de três coisas escondidas pela vila: ferro, carvão e couro.',
        'Procure em barris, caixas e cantos esquecidos. O brilho dourado denuncia.',
      ],
      yes: 'Pode deixar!',
      no: 'Preciso pensar',
      decline: ['Sem pressa. Só lembre que o fogo da forja não espera ninguém.'],
      accepted: ['Boa! Ferro, carvão e couro. Volte quando tiver os três.'],
      progress: 'Você já tem {n} de 3 materiais.',
      ready: [
        'Isso! É exatamente o que eu precisava.',
        '*clang* *clang* *clang*',
        'Pronto! Uma espada de verdade e uma mochila de couro para carregar suas coisas.',
        'E esta chave em forma de espiga de trigo. O portão da vila só abre com ela.',
        'Ah, e para passar pelo portão você também vai precisar de um mapa. A Dona Pimenta vende.',
      ],
      done: ['Cuide bem dessa espada. Ela já cortou muita coisa... principalmente pão.'],
    },

    merchant: {
      greet: ['Bem-vindo, bem-vindo! Tenho de tudo um pouco. E um pouco de tudo também.'],
      menuShop: 'Ver a loja',
      menuChat: 'Conversar',
      menuBye: 'Até logo',
      bye: ['Volte sempre! Ou nunca mais, mas deixando uma gorjeta.'],
      petOffer: [
        'Ando preocupada. Meu gatinho, o Fubá, fugiu hoje cedo.',
        'Se achar ele, eu pago com moedas. Ele é laranja, gordinho e finge que não me conhece.',
      ],
      petYes: 'Eu procuro!',
      petNo: 'Agora não',
      petDecline: ['Tudo bem. Se o vir por aí, grite "Fubá!". Ele não vem, mas faz bem.'],
      petAccepted: ['Obrigada! Ele gosta de se esconder longe do barulho, onde ninguém procura.'],
      petWaiting: ['Nada do Fubá ainda? Ele deve estar dormindo em algum canto sossegado da vila.'],
      petReturned: [
        'Fubá! Meu pãozinho! Onde você estava?',
        'Tome as moedas, você mereceu. E uma dica de ouro: guarde algumas para o mapa.',
      ],
      chatIdle: ['O Fubá agora só quer saber de dormir. Eu também.'],
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

    /** Materiais escondidos e o gatinho. A posição de cada um fica em scenes/village.ts. */
    finds: {
      ferro: {
        prompt: 'Vasculhar as tralhas',
        lines: ['Entre as tralhas, algo brilha: uma barra de ferro!'],
        hint: 'O ferro deve estar entre as tralhas guardadas perto da ferraria.',
      },
      carvao: {
        prompt: 'Olhar dentro do barril',
        lines: ['Dentro do barril, pedras negras e quentinhas: carvão!'],
        hint: 'Carvão... tente os barris perto do poço.',
      },
      couro: {
        prompt: 'Vasculhar os sacos',
        lines: ['Debaixo dos sacos, um pedaço de couro bem curtido.'],
        hint: 'Couro? Procure perto da barraca da Dona Pimenta.',
      },
      gato: {
        prompt: 'Pegar o gatinho',
        lines: ['Miau! Lá está o Fubá, enrolado e fingindo que não é com ele.', 'Você o pega no colo. Hora de levá-lo para casa.'],
      },
    },

    gate: {
      prompt: 'Examinar o portão',
      noKey: [
        'O portão está trancado. A fechadura tem formato de espiga de trigo.',
        'Quem sabe o Ferreiro tenha uma chave assim?',
      ],
      noMap: [
        'A chave de trigo gira na fechadura, mas você hesita.',
        'Sem um mapa, você se perderia no primeiro cruzamento. A Dona Pimenta vende um.',
      ],
      open: [
        'A chave de trigo gira na fechadura. Com o mapa na mão, você respira fundo.',
        'O portão se abre devagar. A aventura de verdade começa agora.',
      ],
      endTitle: 'A vila ficou para trás',
      endText: 'A floresta espera por você. (A aventura continua na próxima etapa.)',
    },

    objective: {
      talkMessenger: 'Fale com o Mensageiro',
      talkSmith: 'Fale com o Ferreiro',
      findMaterials: 'Encontre ferro, carvão e couro ({n}/3)',
      bringMaterials: 'Leve os materiais ao Ferreiro',
      needMap: 'Compre um mapa com a Dona Pimenta',
      needCoins: 'Ganhe moedas ajudando os moradores (cartas, o gatinho Fubá)',
      gate: 'Atravesse o portão da vila',
      done: 'Siga para a floresta',
    },
  },
} as const;

export type Content = typeof content;
export type ItemId = keyof typeof content.items;

/** Troca {chave} por valores: fmt('Faltam {n}', { n: 2 }). */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
