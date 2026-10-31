import { content, fmt, type ItemId } from '../../content';
import { audio } from '../../core/audio';
import { doneFlag } from '../../core/areas';
import { dishCanvas } from '../../ui/dish';
import { playKitchen, type KitchenIngredient } from '../../ui/kitchen';
import { OUTLINE, mulberry32 } from '../art';
import { buildSmallProps } from '../buildings';
import { Collision } from '../collision';
import { INDOOR_WARM, cloneEnv } from '../env';
import { paintInterior } from '../ground';
import type { AreaContext } from '../manager';
import { Person, type PersonSpec } from '../people';
import type { Area2D, Drawable, Interactable, Light, Prop } from '../types';

/**
 * Taverna do Zé: um bar aconchegante (como o Saloon do Stardew). O Matheus chega morrendo de sede, compra uma água no
 * balcão e o Zé, sem ajudante, pede ajuda no restaurante por uns trocos. Cada cliente faz um pedido; o jogador prepara o
 * prato na cozinha (`playKitchen`), o garçom leva até a mesa e o cliente paga. Servidos os três, o Zé entrega a chave de cobre.
 *
 * Organização deste arquivo: constantes -> cena (chão, colisão, peças e luzes) -> personagens e garçom -> regras da história
 * -> objeto da área.
 */

const T = content.tavern;
const W = 400;
const H = 300;
const WALL = 72;
const ORDERS = T.orders.length;

const orderFlag = (n: number) => `tavern_order_${n}`;
const STARTED = 'tavern_started';
const DRANK = 'tavern_drank';
/** Preço da água do Zé. */
const WATER_PRICE = 2;

/** Ingrediente-bônus -> item da Vila que ele gasta. */
const BONUS_ITEM: Record<string, ItemId> = { ovo: 'ovos', pao_quente: 'pao', farinha: 'farinha' };
type IngredientId = keyof typeof T.ingredients;

const COOK: PersonSpec = { skin: '#e8c8a8', hair: '#6a4a2a', hairStyle: 'short', top: ['#f2ece0', '#ffffff', '#c8c0b0'], pants: '#4a4038', apron: '#e8e0d0', hat: { kind: 'cap', color: '#f2ece0' }, held: null };
const WAITER: PersonSpec = { skin: '#e4bc98', hair: '#2a1a14', hairStyle: 'short', top: ['#f4f0e8', '#ffffff', '#c8c4b8'], pants: '#26262e', apron: '#26262e', scarf: '#a02a3a', held: null };
const CLIENT_SPECS: PersonSpec[] = [
  { skin: '#e8c8b0', hair: '#4a2a3a', hairStyle: 'hood', top: ['#9a3a4a', '#c05a6a', '#6e2634'], pants: '#4a3a40', scarf: '#d8a040' },
  { skin: '#c8a888', hair: '#5a5a5a', hairStyle: 'short', beard: true, top: ['#3a5a7a', '#5a7e9e', '#264058'], pants: '#4a4a52', hat: { kind: 'cap', color: '#3a5a7a' } },
  { skin: '#f0d0b0', hair: '#c8c8c0', hairStyle: 'bun', top: ['#5a7a3a', '#7ea05a', '#3e5a26'], pants: '#5a4a3a', scarf: '#5a7a3a' },
];
/** Salão em grade: duas colunas de mesas dos lados e um corredor livre no meio, da porta até o balcão. A mesa de canto à esquerda fica vazia. */
const TABLES = [
  { x: 84, y: 196, cloth: ['#a83a2a', '#c8503e'] },
  { x: 316, y: 196, cloth: ['#3a5a8a', '#58779f'] },
  { x: 316, y: 252, cloth: ['#4a7a3a', '#659a52'] },
  { x: 84, y: 252, cloth: ['#c8a040', '#e0bc5c'] },
];
/** Mesa de cada cliente; a quarta mesa é só enfeite. */
const SEAT = [0, 1, 2];
const BAR_STOOLS = [146, 173, 227, 254];
/** Rostinho de cada cliente na comanda. */
const AVATARS = ['🧳', '🎣', '🍄'];
const BOTTLE_COLS = ['#2e7a3e', '#c8892a', '#a02a3a', '#2e5a9a', '#d8d0b0', '#6a3a7a', '#3a8a8a'];

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, openMap } = ctx;
  const rng = mulberry32(31);
  const sp = buildSmallProps();

  // ---------- chão e paredes ----------
  const ground = paintInterior({
    w: W,
    h: H,
    seed: 31,
    floor: 'wood',
    wallH: WALL,
    rugs: [{ x: 200, y: 212, w: 44, h: 116, col: ['#7a2a24', '#a8423a'] }],
    decor: (g) => {
      // janelas na parede do fundo (luz fria entrando)
      for (const x of [338, 368]) {
        g.fillStyle = '#2a1a14';
        g.fillRect(x - 11, 12, 22, 30);
        g.fillStyle = '#6a4428';
        g.fillRect(x - 10, 13, 20, 28);
        g.fillStyle = '#9ec4dc';
        g.fillRect(x - 8, 15, 7, 11);
        g.fillRect(x + 1, 15, 7, 11);
        g.fillRect(x - 8, 28, 7, 11);
        g.fillRect(x + 1, 28, 7, 11);
        g.fillStyle = '#d4ecf8';
        g.fillRect(x - 8, 15, 7, 2);
        g.fillRect(x + 1, 15, 7, 2);
      }
    },
  });

  // ---------- colisão ----------
  const col = new Collision(W, H);
  col.bounds = { x0: 20, y0: WALL + 14, x1: W - 20, y1: H - 16 };
  col.addRect(36, WALL, 94, WALL + 12); // lareira
  col.addRect(124, 108, 276, 124); // balcão
  col.addRect(298, 88, 336, 102); // fogão
  TABLES.forEach((t) => col.addRect(t.x - 26, t.y - 8, t.x + 26, t.y + 4));
  BAR_STOOLS.forEach((x) => col.addCircle(x, 144, 4));

  const props: Prop[] = [];
  const lights: ((t: number, dk: number) => Light | null)[] = [];

  const solidProp = (img: HTMLCanvasElement, x: number, y: number, r: number) => {
    props.push({ kind: 'custom', x, y, shadowRx: img.width * 0.5, shadowRy: 3, draw: (v, sx, sy) => v.drawImage(img, sx - Math.round(img.width / 2), sy - img.height + 2) });
    col.addCircle(x, y - 2, r);
  };
  // barris de chope encostados na parede da direita e caixas nos cantos
  solidProp(sp.barrel, 366, 112, 7);
  solidProp(sp.barrel, 384, 112, 7);
  solidProp(sp.barrel, 375, 128, 7);
  solidProp(sp.crate, 372, 286, 9);
  solidProp(sp.sack, 38, 286, 7);
  solidProp(sp.crateSmall, 54, 288, 6);

  /** Garrafa de vidro: `kind` 0 = vinho (gargalo longo), 1 = frasco redondo, 2 = alta e fina. */
  const bottle = (v: CanvasRenderingContext2D, x: number, y: number, kind: number, c: string) => {
    v.fillStyle = OUTLINE;
    if (kind === 0) {
      v.fillRect(x + 2, y - 15, 4, 5);
      v.fillRect(x, y - 11, 8, 12);
    } else if (kind === 1) {
      v.fillRect(x + 2, y - 12, 4, 4);
      v.fillRect(x - 1, y - 9, 10, 10);
    } else {
      v.fillRect(x + 2, y - 18, 3, 6);
      v.fillRect(x + 1, y - 13, 5, 14);
    }
    v.fillStyle = c;
    if (kind === 0) {
      v.fillRect(x + 3, y - 14, 2, 4);
      v.fillRect(x + 1, y - 10, 6, 10);
    } else if (kind === 1) {
      v.fillRect(x + 3, y - 11, 2, 3);
      v.fillRect(x, y - 8, 8, 8);
    } else {
      v.fillRect(x + 3, y - 17, 1, 5);
      v.fillRect(x + 2, y - 12, 3, 12);
    }
    v.fillStyle = '#e8dcc0';
    v.fillRect(x + (kind === 1 ? 1 : 2), y - 5, kind === 1 ? 6 : 4, 3);
    v.fillStyle = 'rgba(255,255,255,0.45)';
    v.fillRect(x + 1, y - (kind === 2 ? 11 : 8), 1, 3);
  };
  const mug = (v: CanvasRenderingContext2D, x: number, y: number, foam = true) => {
    v.fillStyle = OUTLINE;
    v.fillRect(x - 1, y - 8, 9, 9);
    v.fillRect(x + 7, y - 6, 3, 5);
    v.fillStyle = '#d08a2a';
    v.fillRect(x, y - 6, 7, 6);
    v.fillStyle = '#e8b04a';
    v.fillRect(x, y - 6, 2, 6);
    if (foam) {
      v.fillStyle = '#f8f4e8';
      v.fillRect(x, y - 8, 7, 3);
    }
    v.fillStyle = '#b8bcc4';
    v.fillRect(x + 8, y - 5, 1, 3);
  };

  // lareira de pedra com fogo animado
  props.push({
    kind: 'custom',
    x: 65,
    y: WALL + 12,
    shadowRx: 28,
    shadowRy: 3,
    draw: (v, sx, sy, t) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => {
        v.fillStyle = c;
        v.fillRect(sx + x, sy + y, w, h);
      };
      r(OUTLINE, -29, -56, 58, 57);
      r('#7a7488', -28, -55, 56, 55);
      r('#9a94a8', -28, -55, 56, 3);
      for (let y = -50; y < -4; y += 8) {
        r('#5a546a', -28, y, 56, 1);
        for (let x = -28 + ((y / 8) & 1) * 8; x < 28; x += 16) r('#5a546a', x, y, 1, 8);
      }
      r(OUTLINE, -16, -34, 32, 34);
      r('#120a06', -15, -33, 30, 33);
      r('#3a2418', -15, -3, 30, 3);
      const fl = Math.sin(t * 13) + Math.sin(t * 21 + 1);
      r('#d83a20', -10, -10, 20, 9);
      r('#d83a20', -7, -17 + Math.round(fl * 0.6), 14, 9);
      r('#ff9a2a', -8, -9, 16, 8);
      r('#ff9a2a', -5, -15 + Math.round(fl * 0.6), 10, 8);
      r('#ffe070', -4, -8, 8, 6);
      r('#ffe070', -1, -12 + Math.round(fl * 0.6), 3, 5);
      r('#6a4428', -22, -42, 44, 4);
      r('#8a5a36', -22, -42, 44, 1);
    },
  });
  lights.push((t) => ({ x: 65, y: WALL - 14, r: 130 + Math.sin(t * 9) * 6, col: [255, 150, 70], a: 0.75 + 0.1 * Math.sin(t * 13), night: true }));

  // prateleiras de garrafas na parede do fundo, com um barrilzinho de cerveja no meio
  props.push({
    kind: 'custom',
    x: 200,
    y: WALL - 2,
    draw: (v, sx, sy) => {
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 72, sy - 60, 144, 56);
      v.fillStyle = '#3a2416';
      v.fillRect(sx - 71, sy - 59, 142, 54);
      v.fillStyle = '#4a2e1c';
      v.fillRect(sx - 71, sy - 59, 142, 3);
      for (const [row, by] of [[0, -38], [1, -18]]) {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 71, sy + by, 142, 4);
        v.fillStyle = '#8a5a36';
        v.fillRect(sx - 70, sy + by, 140, 2);
        v.fillStyle = '#b07c4c';
        v.fillRect(sx - 70, sy + by, 140, 1);
        for (let b = 0; b < 12; b++) {
          const x = sx - 66 + b * 11;
          if (b >= 5 && b <= 6 && row === 0) continue;
          bottle(v, x, sy + by, (b + row) % 3, BOTTLE_COLS[(b * 3 + row * 2) % BOTTLE_COLS.length]);
        }
      }
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 11, sy - 54, 22, 16);
      v.fillStyle = '#9a6a3c';
      v.fillRect(sx - 10, sy - 53, 20, 14);
      v.fillStyle = '#c08a54';
      v.fillRect(sx - 10, sy - 53, 20, 2);
      v.fillStyle = '#3a3a48';
      v.fillRect(sx - 10, sy - 49, 20, 2);
      v.fillRect(sx - 10, sy - 43, 20, 2);
      v.fillStyle = '#c8ccd4';
      v.fillRect(sx - 2, sy - 46, 4, 4);
    },
  });
  // lampiões de parede
  for (const lx of [112, 288]) {
    props.push({
      kind: 'custom',
      x: lx,
      y: WALL - 3,
      draw: (v, sx, sy, t) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 4, sy - 40, 8, 11);
        v.fillStyle = '#3a3a48';
        v.fillRect(sx - 3, sy - 39, 6, 9);
        v.fillStyle = '#ffd070';
        v.fillRect(sx - 2, sy - 38 + (Math.floor(t * 7 + lx) % 2), 4, 6);
        v.fillStyle = '#fff4b0';
        v.fillRect(sx - 1, sy - 36, 2, 3);
      },
    });
    lights.push((t) => ({ x: lx, y: WALL - 36, r: 52, col: [255, 196, 110], a: 0.45 + 0.05 * Math.sin(t * 7 + lx) }));
  }

  // balcão do bar: tampo largo, frente de tábuas com apoio de latão, torneiras, garrafas e canecas
  props.push({
    kind: 'custom',
    x: 200,
    y: 124,
    shadowRx: 76,
    shadowRy: 4,
    draw: (v, sx, sy, t) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => {
        v.fillStyle = c;
        v.fillRect(sx + x, sy + y, w, h);
      };
      r(OUTLINE, -77, -26, 154, 27);
      r('#5a3a22', -76, -18, 152, 18);
      r('#6e4a2c', -76, -18, 152, 3);
      for (let x = -76; x < 76; x += 19) r('#3a2416', x, -15, 1, 15);
      r('#c8a040', -76, -4, 152, 2);
      r('#e8c868', -76, -4, 152, 1);
      r('#8a5e38', -78, -27, 156, 9);
      r('#b07c4c', -78, -27, 156, 2);
      mug(v, sx - 46, sy - 27);
      mug(v, sx - 30, sy - 27, false);
      mug(v, sx + 10, sy - 27);
      bottle(v, sx - 64, sy - 27, 0, BOTTLE_COLS[2]);
      bottle(v, sx - 58, sy - 27, 2, BOTTLE_COLS[0]);
      bottle(v, sx + 62, sy - 27, 1, BOTTLE_COLS[1]);
      ['#d03a2a', '#e0b84a', '#3a8a4a'].forEach((hc, i) => {
        const x = 28 + i * 11;
        r(OUTLINE, x - 2, -37, 6, 11);
        r('#c8ccd4', x - 1, -35, 4, 8);
        r(hc, x - 1, -39, 4, 4);
        r('#e6eaf0', x - 1, -35, 1, 8);
      });
      for (const cx of [-8, 70]) {
        r('#f4ecd8', cx, -36, 3, 9);
        r('#ffd070', cx, -39 + (Math.floor(t * 8 + cx) % 2), 3, 3);
      }
    },
  });

  // banquinhos do balcão
  for (const bx of BAR_STOOLS) {
    props.push({
      kind: 'custom',
      x: bx,
      y: 146,
      shadowRx: 6,
      shadowRy: 2,
      draw: (v, sx, sy) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 6, sy - 14, 12, 7);
        v.fillRect(sx - 4, sy - 8, 8, 9);
        v.fillStyle = '#a83a2a';
        v.fillRect(sx - 5, sy - 13, 10, 5);
        v.fillStyle = '#d0584a';
        v.fillRect(sx - 5, sy - 13, 10, 1);
        v.fillStyle = '#5a3a22';
        v.fillRect(sx - 1, sy - 8, 2, 8);
        v.fillStyle = '#8a5e38';
        v.fillRect(sx - 3, sy - 1, 6, 1);
      },
    });
  }
  lights.push((t) => ({ x: 144, y: 84, r: 44, col: [255, 200, 120], a: 0.35 + 0.05 * Math.sin(t * 8) }));
  lights.push((t) => ({ x: 252, y: 84, r: 44, col: [255, 200, 120], a: 0.35 + 0.05 * Math.sin(t * 8 + 2) }));

  props.push({
    kind: 'custom',
    x: 317,
    y: 102,
    shadowRx: 20,
    shadowRy: 3,
    draw: (v, sx, sy, t) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => {
        v.fillStyle = c;
        v.fillRect(sx + x, sy + y, w, h);
      };
      r(OUTLINE, -20, -26, 40, 27);
      r('#3a3a44', -19, -25, 38, 25);
      r('#54545e', -19, -25, 38, 3);
      r('#1a1a20', -12, -14, 12, 10);
      r('#ff9a2a', -10, -8, 8, 3);
      // panela com vapor
      r(OUTLINE, 4, -34, 14, 10);
      r('#5a5a68', 5, -33, 12, 8);
      for (let i = 0; i < 3; i++) {
        const k = (t * 14 + i * 7) % 20;
        r(`rgba(240,240,240,${0.5 - k * 0.022})`, 8 + Math.round(Math.sin(t * 2 + i) * 2), -36 - Math.round(k), 3, 3);
      }
    },
  });

  /** O prato que está em cada mesa agora (null = só o prato vazio de enfeite). */
  const tableDish: (HTMLCanvasElement | null)[] = TABLES.map(() => null);

  // mesas: cadeira com encosto atrás (onde o cliente senta), toalha xadrez, banquinhos na frente, prato e caneca
  TABLES.forEach((tb, i) => {
    props.push({
      kind: 'custom',
      x: tb.x,
      y: tb.y - 20,
      draw: (v, sx, sy) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 14, sy - 26, 28, 22);
        v.fillStyle = '#6a4428';
        v.fillRect(sx - 13, sy - 25, 26, 20);
        v.fillStyle = '#8a5e38';
        v.fillRect(sx - 13, sy - 25, 26, 3);
        v.fillStyle = '#4a2c18';
        v.fillRect(sx - 13, sy - 8, 26, 3);
        for (const x of [-9, -3, 3, 9]) v.fillRect(sx + x, sy - 21, 1, 12);
      },
    });
    props.push({
      kind: 'custom',
      x: tb.x,
      y: tb.y,
      shadowRx: 28,
      shadowRy: 4,
      draw: (v, sx, sy, t) => {
        const r = (c: string, x: number, y: number, w: number, h: number) => {
          v.fillStyle = c;
          v.fillRect(sx + x, sy + y, w, h);
        };
        r(OUTLINE, -27, -15, 54, 22);
        r(tb.cloth[0], -26, -14, 52, 11);
        for (let x = 0; x < 13; x++) for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0) r(tb.cloth[1], -26 + x * 4, -14 + y * 4, 4, y === 2 ? 3 : 4);
        r('rgba(255,255,255,0.28)', -26, -14, 52, 1);
        r(tb.cloth[0], -26, -3, 52, 6);
        for (let x = -26; x < 26; x += 6) r(tb.cloth[1], x, 3, 3, 2);
        r('rgba(0,0,0,0.22)', -26, 0, 52, 2);
        r('#4a2c18', -24, 5, 3, 2);
        r('#4a2c18', 21, 5, 3, 2);
        const dish = tableDish[i];
        if (dish) {
          v.imageSmoothingEnabled = false;
          v.drawImage(dish, sx - 23, sy - 20, 24, 14);
        } else {
          r('#e8e0c8', -17, -11, 10, 4);
          r('#fff8e8', -16, -12, 8, 1);
        }
        mug(v, sx + 7, sy - 4, i % 2 === 0);
        r('#f0e8d4', -2, -18, 3, 6);
        r('#ffd070', -2, -21 + (Math.floor(t * 8 + i) % 2), 3, 3);
      },
    });
    for (const dx of [-14, 14]) {
      props.push({
        kind: 'custom',
        x: tb.x + dx,
        y: tb.y + 18,
        shadowRx: 6,
        shadowRy: 2,
        draw: (v, sx, sy) => {
          v.fillStyle = OUTLINE;
          v.fillRect(sx - 6, sy - 9, 12, 6);
          v.fillRect(sx - 4, sy - 4, 8, 6);
          v.fillStyle = '#8a5e38';
          v.fillRect(sx - 5, sy - 8, 10, 4);
          v.fillStyle = '#b07c4c';
          v.fillRect(sx - 5, sy - 8, 10, 1);
          v.fillStyle = '#4a2c18';
          v.fillRect(sx - 3, sy - 4, 6, 5);
        },
      });
    }
    lights.push((t) => ({ x: tb.x, y: tb.y - 24, r: 38, col: [255, 200, 120], a: 0.3 + 0.05 * Math.sin(t * 8 + i) }));
  });

  // a porta, no meio da parede de baixo
  props.push({
    kind: 'custom',
    x: W / 2,
    y: H - 1,
    draw: (v, sx, sy) => {
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 15, sy - 30, 30, 30);
      v.fillStyle = '#5a3a22';
      v.fillRect(sx - 13, sy - 28, 26, 28);
      v.fillStyle = '#7a5232';
      v.fillRect(sx - 13, sy - 28, 26, 3);
      for (const x of [-4, 4]) {
        v.fillStyle = '#3a2416';
        v.fillRect(sx + x, sy - 25, 1, 25);
      }
      v.fillStyle = '#e0b84a';
      v.fillRect(sx + 7, sy - 14, 3, 3);
    },
  });
  lights.push(() => ({ x: W / 2, y: H - 18, r: 46, col: [150, 190, 255], a: 0.18 }));

  // ---------- personagens ----------
  const cook = new Person(COOK, 200, 100, { facing: 'down', work: { every: 7 }, watchPlayer: true });
  const clients = SEAT.map((t, i) => new Person(CLIENT_SPECS[i], TABLES[t].x, TABLES[t].y - 14, { facing: 'down', watchPlayer: true }));
  const WAITER_HOME = { x: 150, y: 100 };
  const waiter = new Person(WAITER, WAITER_HOME.x, WAITER_HOME.y, { facing: 'down', work: { every: 9 } });
  const folks = [cook, ...clients];

  // ---------- garçom: leva o prato até a mesa ----------
  /** Prato nas mãos do garçom (null = de mãos vazias). */
  let carrying: HTMLCanvasElement | null = null;
  let route: [number, number][] = [];
  let routeDone: (() => void) | null = null;
  const walk = (pts: [number, number][]) =>
    new Promise<void>((res) => {
      route = pts.slice();
      routeDone = res;
    });
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  /** Trajeto do bar até a mesa: sai pela passagem ao lado da lareira, desce até o corredor e para ao lado da mesa. */
  const pathTo = (t: number): [number, number][] => {
    const tb = TABLES[t];
    const sideX = tb.x < W / 2 ? 126 : 274;
    return [[108, 104], [108, 158], [sideX, 160], [sideX, tb.y - 2]];
  };
  const sideOf = (t: number) => (TABLES[t].x < W / 2 ? 'left' : 'right');

  async function deliver(n: number, ids: readonly string[]) {
    const t = SEAT[n];
    const path = pathTo(t);
    carrying = dishCanvas(ids, 1);
    audio.play('coin', 0.8);
    await walk(path);
    waiter.stand(sideOf(t));
    await sleep(350);
    tableDish[t] = carrying;
    carrying = null;
    audio.play('pickup', 0.9);
    clients[n].cheer();
    await sleep(700);
    await walk([...path].reverse().slice(1).concat([[WAITER_HOME.x, WAITER_HOME.y]]));
    waiter.stand('down');
  }
  /** Depois de um tempo, o cliente termina de comer: fica só o prato vazio na mesa. */
  const eatLater = (n: number) =>
    setTimeout(() => {
      tableDish[SEAT[n]] = dishCanvas([], 1);
    }, 9000);
  // pedidos já servidos em visitas anteriores: mesa com o prato vazio
  SEAT.forEach((t, n) => {
    if (game.flag(orderFlag(n))) tableDish[t] = dishCanvas([], 1);
  });

  // ---------- estado ----------
  const served = (n: number) => game.flag(orderFlag(n));
  const servedCount = () => T.orders.filter((_, n) => served(n)).length;
  const allServed = () => servedCount() === ORDERS;
  const isDone = () => game.flag(doneFlag('tavern'));
  const started = () => game.flag(STARTED);
  const drank = () => game.flag(DRANK);
  /** Pedido em andamento (só vive na cena: ao voltar, o jogador conversa de novo com o cliente). */
  let active: number | null = null;
  /** O garçom está levando um prato: o resto da conversa espera. */
  let delivering = false;

  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, mark?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled: () => !delivering && (enabled?.() ?? true), mark });

  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  // ---------- história: a sede, a água e o convite do Zé ----------
  add(W / 2, H - 30, 34, T.back.prompt, () => void openMap());

  async function buyWater() {
    const name = T.cook.name;
    await ui.tell(T.cook.hello, name);
    const choice = await ui.ask(fmt(T.cook.buyAsk, { price: WATER_PRICE }), T.cook.buyOptions, name);
    if (choice !== 0) {
      await ui.tell(T.cook.noBuy, name);
      return false;
    }
    if (game.spend(WATER_PRICE)) ui.toast(fmt(content.ui.spentCoins, { n: WATER_PRICE }));
    else await ui.tell(T.cook.free, name);
    await ui.tell(T.cook.bought);
    game.setFlag(DRANK);
    return true;
  }

  async function offerJob() {
    const name = T.cook.name;
    await ui.tell(T.cook.offer, name);
    const choice = await ui.ask(T.cook.offerAsk, T.cook.offerOptions, name);
    if (choice !== 0) {
      await ui.tell(T.cook.later, name);
      return;
    }
    await ui.tell(T.cook.greet, name);
    game.setFlag(STARTED);
  }

  async function talkCook() {
    cook.faceToward(player.x, player.y);
    const name = T.cook.name;
    if (isDone()) return void (await ui.tell(T.cook.done, name));
    if (!drank() && !(await buyWater())) return;
    if (!started()) return void (await offerJob());
    if (!allServed()) return void (await ui.tell(T.cook.waiting, name));
    await ui.tell(T.cook.reward, name);
    giveItem('queijo');
    game.setFlag('mem_taverna_jantar');
    game.setFlag(doneFlag('tavern'));
    await ui.showMemory(content.memories.taverna_jantar);
    await openMap();
  }
  add(200, 112, 54, T.cook.prompt, () => void talkCook(), undefined, () => !drank() || !started() || (allServed() && !isDone()));

  // ---------- clientes e cozinha ----------
  async function talkClient(n: number) {
    const o = T.orders[n];
    clients[n].faceToward(player.x, player.y);
    if (served(n)) return void (await ui.tell(o.done, o.name));
    if (active === n) return void (await ui.tell(o.waiting, o.name));
    await ui.tell(o.request, o.name);
    active = n;
  }
  SEAT.forEach((t, n) => add(TABLES[t].x, TABLES[t].y - 8, 40, T.orders[n].prompt, () => void talkClient(n), started, () => started() && !served(n) && active !== n));

  /** Despensa do Zé e, à parte, os extras que o jogador trouxe da Vila (ovo, baguete, farinha). */
  function shelves(): { pantry: KitchenIngredient[]; extras: KitchenIngredient[] } {
    const all = (Object.keys(T.ingredients) as IngredientId[]).map((id) => ({ id, icon: T.ingredients[id].icon, name: T.ingredients[id].name }));
    return { pantry: all.filter((i) => !(i.id in BONUS_ITEM)), extras: all.filter((i) => i.id in BONUS_ITEM && game.has(BONUS_ITEM[i.id])) };
  }

  async function cookDish() {
    if (active === null) {
      await ui.tell(allServed() ? T.counter.allServed : T.counter.noOrder);
      return;
    }
    const n = active;
    const o = T.orders[n];
    const recipe: readonly string[] = o.recipe;
    const { pantry, extras } = shelves();
    const result = await playKitchen(
      ui,
      { ...T.plating, emptyPlate: T.plating.empty_plate },
      pantry,
      extras,
      (ids) => {
        if (ids.some((id) => !recipe.includes(id) && id !== o.loves)) return 'extra';
        return recipe.every((id) => ids.includes(id)) ? 'ok' : 'missing';
      },
      { who: o.name, avatar: AVATARS[n], lines: o.request },
    );
    const bonus = result.ids.includes(o.loves);
    if (bonus) game.removeItem(BONUS_ITEM[o.loves]);
    active = null;
    delivering = true;
    try {
      await deliver(n, result.ids);
    } finally {
      delivering = false;
    }
    eatLater(n);
    game.setFlag(orderFlag(n));
    await ui.tell(bonus ? [...o.thanks, ...o.bonusThanks] : o.thanks, o.name);
    const tip = (result.stars - 1) * 2;
    const coins = o.coins + (bonus ? o.bonusCoins : 0) + tip;
    game.addCoins(coins);
    ui.toast(fmt(content.ui.gotCoins, { n: coins }));
    if (allServed()) ui.toast(T.objective.reward);
  }
  add(317, 116, 40, T.counter.prompt, () => void cookDish(), started, () => started() && active !== null);

  // ---------- objetivo ----------
  const objective = () => {
    if (isDone()) return T.objective.done;
    if (!drank()) return T.objective.drink;
    if (!started()) return T.objective.talkCook;
    if (delivering) return T.objective.deliver;
    if (allServed()) return T.objective.reward;
    if (active !== null) return fmt(T.objective.plate, { name: T.orders[active].name });
    return fmt(T.objective.takeOrder, { n: servedCount() });
  };
  let lastObjective = '';
  let objTimer = 0;

  const env = cloneEnv(INDOOR_WARM);
  env.dark = 0.7;

  /** O garçom (com o prato nas mãos, se estiver levando um). */
  const waiterDrawable = (): Drawable => {
    const base = waiter.drawable();
    return {
      y: waiter.y,
      shadow: base.shadow,
      draw: (v, cx, cy, t) => {
        base.draw(v, cx, cy, t);
        if (!carrying) return;
        const x = Math.round(waiter.x - cx);
        const y = Math.round(waiter.y - cy);
        v.fillStyle = OUTLINE;
        v.fillRect(x - 11, y - 9, 22, 4);
        v.fillStyle = '#c8ccd4';
        v.fillRect(x - 10, y - 9, 20, 2);
        v.imageSmoothingEnabled = false;
        v.drawImage(carrying, x - 12, y - 20, 24, 14);
      },
    };
  };

  void rng;
  return {
    id: 'tavern',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: { start: { x: W / 2, y: H - 36, dir: 'up' } },
    interactables,
    env,
    torchLit: () => false,
    drawables(out) {
      for (const n of folks) out.push(n.drawable());
      out.push(waiterDrawable());
    },
    lights(out, t) {
      for (const l of lights) {
        const r = l(t, 0);
        if (r) out.push(r);
      }
    },
    update(dt, t, pl) {
      const talking = ui.inDialog;
      for (const n of folks) n.update(dt, t, pl, col, talking);
      if (route.length) {
        if (waiter.walkToward(route[0][0], route[0][1], dt)) route.shift();
        if (!route.length) {
          const done = routeDone;
          routeDone = null;
          done?.();
        }
      } else waiter.update(dt, t, pl, col, false);
      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.4;
        const o = objective();
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
    },
    onEnter() {
      if (!game.flag('tavern_seen')) {
        game.setFlag('tavern_seen');
        void ui.say(T.intro);
      }
    },
    dispose() {
      ui.setObjective(null);
    },
    debug: {
      solveAll: () => {
        game.setFlag(DRANK);
        game.setFlag(STARTED);
        for (let n = 0; n < ORDERS; n++) game.setFlag(orderFlag(n));
      },
    },
  };
}
