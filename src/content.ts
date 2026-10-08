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

  // Cena de teste da etapa 1 (será substituída pelas áreas reais)
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
} as const;

export type Content = typeof content;
