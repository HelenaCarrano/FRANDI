/**
 * Pratos em pixel art: cada ingrediente tem um desenhinho e o prato mostra o que foi posto nele, na ordem.
 * Usado na janela da cozinha (prévia do prato) e na taverna (o prato que o garçom leva e deixa na mesa).
 */

type Ctx = CanvasRenderingContext2D;

/** Posições (em pixels do desenho) dos ingredientes no prato, da base para cima. */
const SLOTS: [number, number][] = [
  [0, 1],
  [-9, 0],
  [9, 0],
  [-5, -3],
  [5, -3],
  [0, -4],
];

export const DISH_W = 46;
export const DISH_H = 26;

/** Desenha um ingrediente centrado em (x, y) (unidades do desenho, multiplicadas por `s`). */
function food(ctx: Ctx, id: string, cx: number, cy: number, s: number) {
  const r = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.round(w * s), Math.round(h * s));
  };
  switch (id) {
    case 'pao':
      r('#7a4a20', -6, -3, 12, 6);
      r('#d8a050', -5, -3, 10, 5);
      r('#f0c078', -5, -3, 10, 1);
      r('#b88038', -5, 1, 10, 1);
      for (const [x, y] of [[-3, -2], [0, -2], [3, -2], [-1, 0]]) r('#fff0c8', x, y);
      break;
    case 'queijo':
      r('#a87818', -5, -2, 10, 4);
      r('#f4cc48', -4, -2, 8, 3);
      r('#fce080', -4, -2, 8, 1);
      r('#c89a20', -2, -1);
      r('#c89a20', 2, 0);
      break;
    case 'tomate':
      for (const x of [-4, 0, 4]) {
        r('#7a1810', x - 2, -2, 5, 4);
        r('#d83a2a', x - 1, -2, 4, 3);
        r('#f07a62', x - 1, -2, 2, 1);
      }
      break;
    case 'alface':
      r('#3a6a28', -7, -1, 14, 3);
      r('#6aaa48', -7, -2, 14, 3);
      r('#9ad468', -5, -2, 3, 1);
      r('#9ad468', 1, -2, 4, 1);
      r('#4a8a38', -6, 1, 3, 1);
      break;
    case 'carne':
      r('#3a180e', -6, -3, 12, 6);
      r('#7a3a22', -5, -3, 10, 5);
      r('#a05a38', -5, -3, 10, 1);
      for (const x of [-3, 0, 3]) r('#2a1008', x, -2, 1, 3);
      break;
    case 'peixe':
      r('#3a5068', -7, -3, 12, 6);
      r('#8aa8c0', -6, -3, 10, 5);
      r('#c8dce8', -6, -3, 10, 1);
      r('#8aa8c0', 4, -2, 4, 1);
      r('#8aa8c0', 5, 0, 3, 1);
      r('#14181c', -4, -2);
      r('#5a7890', -2, -1, 5, 1);
      break;
    case 'batata':
      for (let i = 0; i < 5; i++) {
        r('#a87818', -6 + i * 3, -3, 2, 7);
        r('#f0c850', -6 + i * 3, -3, 2, 6);
        r('#fce088', -6 + i * 3, -3, 1, 6);
      }
      break;
    case 'cebola':
      for (const x of [-4, 3]) {
        r('#8a5a8a', x - 1, -2, 5, 4);
        r('#e8c8e0', x, -2, 3, 3);
        r('#8a5a8a', x + 1, -1, 1, 1);
      }
      break;
    case 'cogumelo':
      for (const x of [-4, 3]) {
        r('#6a5a42', x - 2, -3, 6, 3);
        r('#d8c8a8', x - 1, -3, 4, 2);
        r('#f4ecd4', x, 0, 2, 3);
        r('#a89878', x - 1, -1, 4, 1);
      }
      break;
    case 'cenoura':
      for (let i = 0; i < 3; i++) {
        r('#a84a10', -6, -3 + i * 2, 12, 2);
        r('#f08a2a', -6, -3 + i * 2, 11, 1);
      }
      break;
    case 'ovo':
      r('#c8c0a8', -6, -3, 12, 7);
      r('#fffaf0', -5, -3, 10, 6);
      r('#ffc830', -2, -2, 5, 4);
      r('#fff0a0', -1, -2, 2, 1);
      break;
    case 'pao_quente':
      r('#6a3a14', -9, -2, 18, 5);
      r('#c88a40', -8, -2, 16, 4);
      r('#e8b068', -8, -2, 16, 1);
      for (const x of [-5, -1, 3]) r('#f0d098', x, -1, 2, 1);
      break;
    case 'farinha':
      r('#b8b098', -5, -1, 10, 3);
      r('#f4eedc', -4, -3, 8, 4);
      r('#ffffff', -2, -3, 4, 1);
      break;
    default:
      r('#c8a060', -3, -2, 6, 4);
  }
}

/** Prato com os ingredientes por cima. (cx, cy) é o centro do prato; `s` é o tamanho de cada pixel. */
export function drawDish(ctx: Ctx, ids: readonly string[], cx: number, cy: number, s: number) {
  const rr = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.round(w * s), Math.round(h * s));
  };
  // sombra, borda e fundo do prato (elipse em retângulos)
  for (const [c, grow, dy] of [['rgba(0,0,0,0.3)', 1, 2], ['#a89878', 0, 0], ['#f4eedc', -1, 0], ['#e0d8c0', -4, 0]] as const) {
    const rx = 21 + grow;
    const ry = 9 + grow;
    for (let y = -ry; y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      rr(c, -half, y + dy, half * 2, 1);
    }
  }
  rr('#ffffff', -14, -8, 8, 1);
  ids.slice(0, SLOTS.length).forEach((id, i) => food(ctx, id, cx + SLOTS[i][0] * s, cy + SLOTS[i][1] * s, s));
}

/** O mesmo prato numa imagem à parte (para desenhar no mundo ou no HTML). */
export function dishCanvas(ids: readonly string[], s = 1) {
  const c = document.createElement('canvas');
  c.width = DISH_W * s;
  c.height = DISH_H * s;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawDish(ctx, ids, (DISH_W / 2) * s, (DISH_H / 2) * s, s);
  return c;
}
