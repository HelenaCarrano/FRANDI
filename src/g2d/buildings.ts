import { makeCanvas, mulberry32, outlineSprite, type Rng } from './art';

/**
 * Construções e objetos da vila em pixel art, vistos de frente e um pouco de cima: parede embaixo, telhado em cima.
 * Todos os sprites têm a âncora no meio da base (pés da construção); `Sprite.w/h` são as medidas da imagem.
 */

type Ramp3 = [string, string, string];

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  /** Largura e altura da parede de baixo (a parte que bloqueia o caminho). */
  wallW: number;
  wallH: number;
  /** Pontos úteis em relação à âncora (meio da base). */
  chimney?: { x: number; y: number };
  forge?: { x: number; y: number };
  hub?: { x: number; y: number };
}

const fill = (ctx: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

export const PLASTER: Ramp3 = ['#e2cba0', '#f2dfb8', '#bda27a'];
export const STONE: Ramp3 = ['#8a8498', '#aaa4b8', '#625c76'];
export const WOOD: Ramp3 = ['#8c5a38', '#a87348', '#6a3e26'];
export const ROOF_RED = ['#5e2420', '#8c3a2c', '#b85238', '#dc7a4a'];
export const ROOF_BROWN = ['#40261c', '#6a4028', '#8c5c38', '#b88450'];
export const ROOF_SLATE = ['#2c2c3c', '#454558', '#62627a', '#82829a'];
export const ROOF_THATCH = ['#7a5a20', '#a8802c', '#d0a844', '#ecd070'];

/** Telhado em trapézio (vista de frente): fileiras de telhas com costuras alternadas. */
function drawRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inset: number, ramp: string[]) {
  for (let r = 0; r < h; r++) {
    const ins = Math.round(inset * (1 - r / h));
    const x0 = x + ins;
    const x1 = x + w - ins;
    const within = r % 5;
    const band = Math.floor(r / 5);
    fill(ctx, within === 0 ? ramp[3] : within === 4 ? ramp[0] : within === 3 ? ramp[1] : ramp[2], x0, y + r, x1 - x0, 1);
    if (within > 0 && within < 4) for (let xx = x0 + (band % 2) * 4 + 3; xx < x1 - 1; xx += 8) fill(ctx, ramp[0], xx, y + r, 1, 1);
    fill(ctx, ramp[3], x0, y + r, 1, 1);
    fill(ctx, ramp[0], x1 - 1, y + r, 1, 1);
  }
  fill(ctx, ramp[3], x + inset, y, w - inset * 2, 1);
  // sombra do beiral na parede
  fill(ctx, 'rgba(30,18,40,0.38)', x + 2, y + h, w - 4, 3);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pal: Ramp3, rng: Rng, kind: 'plaster' | 'stone' | 'wood', timber?: string) {
  fill(ctx, pal[0], x, y, w, h);
  if (kind === 'stone') {
    for (let r = 0; r * 6 < h; r++) {
      const yy = y + r * 6;
      fill(ctx, pal[2], x, yy + 5, w, 1);
      const off = (r % 2) * 6;
      for (let xx = x + off; xx < x + w; xx += 12) fill(ctx, pal[2], xx, yy, 1, 6);
      for (let xx = x + off + 2; xx < x + w - 2; xx += 12) fill(ctx, pal[1], xx, yy + 1, 5, 1);
    }
  } else if (kind === 'wood') {
    for (let xx = x; xx < x + w; xx += 5) {
      fill(ctx, pal[2], xx, y, 1, h);
      fill(ctx, pal[1], xx + 1, y, 1, h);
    }
    for (let i = 0; i < w * h * 0.02; i++) fill(ctx, pal[2], x + rng() * w, y + rng() * h, 2, 1);
  } else {
    for (let i = 0; i < w * h * 0.05; i++) fill(ctx, rng() < 0.5 ? pal[1] : pal[2], x + rng() * w, y + rng() * h, 1, 1);
    if (timber) {
      fill(ctx, timber, x, y, 3, h);
      fill(ctx, timber, x + w - 3, y, 3, h);
      fill(ctx, timber, x, y, w, 3);
      fill(ctx, timber, x + w / 2 - 1, y, 2, 6);
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 6; k++) {
          fill(ctx, timber, x + 4 + k + i * (w - 18), y + 3 + k, 1, 1);
          fill(ctx, timber, x + w - 5 - k - i * (w - 18), y + 3 + k, 1, 1);
        }
      }
    }
  }
  fill(ctx, pal[1], x, y, 2, h);
  fill(ctx, pal[2], x + w - 3, y, 3, h);
  fill(ctx, pal[2], x, y + h - 2, w, 2);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: boolean) {
  fill(ctx, '#3a2218', x - 1, y - 1, w + 2, h + 2);
  fill(ctx, lit ? '#ffd778' : '#7aa0b8', x, y, w, h);
  if (lit) {
    fill(ctx, '#fff0b8', x, y, w, 2);
    fill(ctx, '#f0a850', x, y + h - 2, w, 2);
  } else fill(ctx, '#b8d4e0', x, y, w, 2);
  fill(ctx, '#3a2218', x + Math.floor(w / 2), y, 1, h);
  fill(ctx, '#3a2218', x, y + Math.floor(h / 2), w, 1);
  fill(ctx, '#6a3e26', x - 2, y + h + 1, w + 4, 2);
  fill(ctx, '#c8503a', x - 1, y + h + 3, 2, 2);
  fill(ctx, '#f0d850', x + w - 1, y + h + 3, 2, 2);
}

function drawDoor(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, dark: boolean) {
  const x = cx - Math.floor(w / 2);
  const y = baseY - h;
  fill(ctx, '#3a2218', x - 2, y - 2, w + 4, h + 2);
  fill(ctx, dark ? '#1c1218' : '#8c5a38', x, y, w, h);
  if (!dark) {
    for (let xx = x; xx < x + w; xx += 4) fill(ctx, '#6a3e26', xx, y, 1, h);
    fill(ctx, '#a87348', x + 1, y, 1, h);
    fill(ctx, '#4a2c1c', x, y + 5, w, 1);
    fill(ctx, '#4a2c1c', x, y + h - 6, w, 1);
    fill(ctx, '#f0c858', x + w - 4, y + Math.floor(h / 2), 2, 2);
  } else {
    fill(ctx, '#2c2028', x, y, w, 3);
  }
  fill(ctx, '#9a949c', x - 3, baseY - 2, w + 6, 2);
}

export interface BuildingSpec {
  w: number;
  wallH: number;
  roofH: number;
  over?: number;
  inset?: number;
  wall: Ramp3;
  wallKind?: 'plaster' | 'stone' | 'wood';
  timber?: string;
  roof: string[];
  door: { w: number; h: number; dark?: boolean; dx?: number };
  windows?: { n: 2 | 4; y?: number; w?: number; h?: number };
  chimney?: { x: number; w: number; h: number };
  seed: number;
  /** Decoração extra (placa, barris pintados...): recebe a origem da parede. */
  extra?: (ctx: CanvasRenderingContext2D, wallX: number, wallY: number) => void;
}

export function buildBuilding(o: BuildingSpec): Sprite {
  const rng = mulberry32(o.seed);
  const over = o.over ?? 5;
  const top = 18;
  const W = o.w + over * 2;
  const H = top + o.roofH + o.wallH - 4;
  const { c, ctx } = makeCanvas(W, H);
  const wallTop = top + o.roofH - 4;
  drawWall(ctx, over, wallTop, o.w, o.wallH, o.wall, rng, o.wallKind ?? 'plaster', o.timber);
  // base de pedra
  if (o.wallKind !== 'stone') {
    fill(ctx, '#7c7890', over, H - 6, o.w, 6);
    fill(ctx, '#a29eb4', over, H - 6, o.w, 1);
    for (let xx = over + 4; xx < over + o.w; xx += 9) fill(ctx, '#5a566c', xx, H - 5, 1, 5);
  }
  const doorCx = Math.round(W / 2 + (o.door.dx ?? 0));
  drawDoor(ctx, doorCx, H, o.door.w, o.door.h, !!o.door.dark);
  if (o.windows) {
    const ww = o.windows.w ?? 11;
    const wh = o.windows.h ?? 11;
    const fr = o.windows.n === 2 ? [0.2, 0.8] : [0.1, 0.3, 0.7, 0.9];
    for (const f of fr) drawWindow(ctx, Math.round(over + o.w * f - ww / 2), wallTop + (o.windows.y ?? 9), ww, wh, true);
  }
  o.extra?.(ctx, over, wallTop);
  drawRoof(ctx, 0, top, W, o.roofH, o.inset ?? Math.round(W * 0.2), o.roof);
  let chimney: Sprite['chimney'];
  if (o.chimney) {
    const cx = Math.round(W / 2 + o.chimney.x);
    const cy = top + o.roofH - o.chimney.h - 4;
    fill(ctx, '#6a5a64', cx, cy, o.chimney.w, o.chimney.h);
    fill(ctx, '#8c7a84', cx, cy, 2, o.chimney.h);
    fill(ctx, '#4a3c46', cx + o.chimney.w - 2, cy, 2, o.chimney.h);
    fill(ctx, '#3a2c36', cx - 1, cy - 2, o.chimney.w + 2, 3);
    fill(ctx, '#7c6a74', cx - 1, cy - 2, o.chimney.w + 2, 1);
    chimney = { x: cx + o.chimney.w / 2 - W / 2, y: cy - 3 - H };
  }
  return { img: outlineSprite(c), w: W, h: H, wallW: o.w, wallH: o.wallH, chimney };
}

// ---------------------------------------------------------------- prédios especiais

export function buildSmith(): Sprite {
  const s = buildBuilding({
    w: 96,
    wallH: 44,
    roofH: 34,
    over: 6,
    wall: STONE,
    wallKind: 'stone',
    roof: ROOF_SLATE,
    door: { w: 14, h: 24, dx: -14 },
    windows: { n: 2, w: 10, h: 9, y: 9 },
    chimney: { x: 26, w: 14, h: 28 },
    seed: 11,
    extra: (ctx, wx, wy) => {
      // nicho da forja: arco escuro com bigorna
      fill(ctx, '#2a1a14', wx + 62, wy + 14, 28, 30);
      fill(ctx, '#1a0e0c', wx + 64, wy + 16, 24, 28);
      fill(ctx, '#54505c', wx + 60, wy + 12, 32, 3);
      fill(ctx, '#54505c', wx + 60, wy + 12, 3, 32);
      fill(ctx, '#54505c', wx + 89, wy + 12, 3, 32);
      fill(ctx, '#3c3844', wx + 68, wy + 36, 16, 3);
      fill(ctx, '#3c3844', wx + 72, wy + 39, 8, 5);
      fill(ctx, '#7c788a', wx + 66, wy + 33, 20, 3);
      fill(ctx, '#aaa6b8', wx + 66, wy + 33, 20, 1);
    },
  });
  return { ...s, forge: { x: 28, y: -24 } };
}

export function buildTavern(): Sprite {
  return buildBuilding({
    w: 104,
    wallH: 48,
    roofH: 38,
    over: 6,
    wall: PLASTER,
    timber: '#5a3422',
    roof: ROOF_BROWN,
    door: { w: 16, h: 26 },
    windows: { n: 4, w: 10, h: 10, y: 10 },
    chimney: { x: -28, w: 12, h: 26 },
    seed: 21,
    extra: (ctx, wx, wy) => {
      // placa pendurada com uma caneca
      fill(ctx, '#3a2218', wx + 70, wy + 2, 2, 12);
      fill(ctx, '#3a2218', wx + 64, wy + 2, 14, 2);
      fill(ctx, '#2a1a14', wx + 63, wy + 12, 16, 14);
      fill(ctx, '#c8903c', wx + 64, wy + 13, 14, 12);
      fill(ctx, '#f0e0a0', wx + 68, wy + 16, 6, 7);
      fill(ctx, '#fff6dc', wx + 68, wy + 16, 6, 2);
      fill(ctx, '#f0e0a0', wx + 74, wy + 18, 2, 4);
    },
  });
}

export function buildHouse(variant: 0 | 1, seed: number): Sprite {
  return variant === 0
    ? buildBuilding({ w: 70, wallH: 40, roofH: 34, wall: PLASTER, timber: '#6a3e26', roof: ROOF_RED, door: { w: 13, h: 23 }, windows: { n: 2, w: 10, h: 10, y: 10 }, chimney: { x: 16, w: 11, h: 22 }, seed })
    : buildBuilding({ w: 62, wallH: 38, roofH: 32, wall: ['#d8c4a6', '#ecdcc0', '#b49a7c'], timber: '#5a3a28', roof: ROOF_BROWN, door: { w: 12, h: 22 }, windows: { n: 2, w: 9, h: 10, y: 10 }, chimney: { x: -14, w: 10, h: 20 }, seed, over: 6 });
}

export function buildBarn(): Sprite {
  const s = buildBuilding({
    w: 112,
    wallH: 46,
    roofH: 36,
    over: 6,
    wall: WOOD,
    wallKind: 'wood',
    roof: ROOF_THATCH,
    door: { w: 34, h: 34, dark: true },
    seed: 31,
    extra: (ctx, wx, wy) => {
      // palha dentro da porta e cruz no portão
      fill(ctx, '#d8b04a', wx + 40, wy + 34, 32, 12);
      for (let i = 0; i < 14; i++) fill(ctx, '#f0d070', wx + 41 + i * 2, wy + 32 + (i % 3), 1, 6);
      fill(ctx, '#3a2218', wx + 38, wy + 8, 36, 2);
      fill(ctx, '#3a2218', wx + 55, wy + 8, 2, 8);
    },
  });
  return s;
}

export function buildChurch(): Sprite {
  const nave = buildBuilding({
    w: 70,
    wallH: 44,
    roofH: 32,
    over: 5,
    wall: ['#dcd0c0', '#f0e6d6', '#b0a494'],
    roof: ROOF_SLATE,
    door: { w: 14, h: 26, dx: 8 },
    windows: { n: 2, w: 8, h: 14, y: 8 },
    seed: 41,
  });
  const W = nave.w + 18;
  const H = nave.h + 52;
  const { c, ctx } = makeCanvas(W, H);
  ctx.drawImage(nave.img, 18, H - nave.h);
  // torre
  const tx = 2;
  const ty = 40;
  fill(ctx, '#d0c4b0', tx, ty, 26, H - ty);
  for (let r = 0; r * 6 < H - ty; r++) {
    fill(ctx, '#a89c8c', tx, ty + r * 6 + 5, 26, 1);
    for (let xx = tx + (r % 2) * 6; xx < tx + 26; xx += 12) fill(ctx, '#a89c8c', xx, ty + r * 6, 1, 6);
  }
  fill(ctx, '#ece2d2', tx, ty, 2, H - ty);
  fill(ctx, '#8c8070', tx + 23, ty, 3, H - ty);
  fill(ctx, '#2a1a14', tx + 8, ty + 8, 10, 14);
  fill(ctx, '#1a1012', tx + 9, ty + 9, 8, 12);
  fill(ctx, '#e0b84a', tx + 11, ty + 13, 4, 5);
  // pontas do campanário
  for (let r = 0; r < 34; r++) {
    const half = Math.max(1, Math.round(15 * (r / 34)));
    fill(ctx, r % 4 === 0 ? '#82829a' : r % 4 === 3 ? '#2c2c3c' : '#62627a', tx + 13 - half, ty - 34 + r, half * 2, 1);
  }
  fill(ctx, '#e0c050', tx + 12, ty - 44, 2, 10);
  fill(ctx, '#e0c050', tx + 9, ty - 41, 8, 2);
  return { img: outlineSprite(c), w: W, h: H, wallW: W - 4, wallH: 44 };
}

export function buildMarket(): Sprite {
  const W = 118;
  const H = 74;
  const { c, ctx } = makeCanvas(W, H);
  // parede de trás
  fill(ctx, '#8c5a38', 10, 22, 98, 36);
  for (let xx = 10; xx < 108; xx += 5) {
    fill(ctx, '#6a3e26', xx, 22, 1, 36);
    fill(ctx, '#a87348', xx + 1, 22, 1, 36);
  }
  // toldo listrado
  for (let r = 0; r < 20; r++) {
    const ins = Math.round(8 * (1 - r / 20));
    for (let xx = ins; xx < W - ins; xx++) {
      const stripe = Math.floor(xx / 8) % 2 === 0;
      fill(ctx, stripe ? (r < 2 ? '#e8705a' : r > 16 ? '#8a2a28' : '#c8403a') : r < 2 ? '#fff2dc' : r > 16 ? '#b8a688' : '#ecdcbc', xx, 2 + r, 1, 1);
    }
  }
  for (let xx = 0; xx < W; xx += 8) {
    const stripe = Math.floor(xx / 8) % 2 === 0;
    fill(ctx, stripe ? '#c8403a' : '#ecdcbc', xx, 22, 8, 3);
    fill(ctx, stripe ? '#8a2a28' : '#b8a688', xx + 1, 25, 6, 1);
  }
  fill(ctx, 'rgba(30,18,40,0.35)', 6, 26, W - 12, 3);
  // postes
  for (const x of [6, W - 10]) {
    fill(ctx, '#3a2218', x - 1, 24, 6, 50);
    fill(ctx, '#8c5a38', x, 25, 4, 49);
    fill(ctx, '#b88050', x, 25, 1, 49);
  }
  // balcão com mercadorias
  fill(ctx, '#3a2218', 8, 52, 102, 22);
  fill(ctx, '#7a4a2c', 9, 53, 100, 20);
  for (let xx = 9; xx < 109; xx += 6) fill(ctx, '#5e3820', xx, 56, 1, 17);
  fill(ctx, '#c08a54', 8, 50, 102, 4);
  fill(ctx, '#e0b078', 8, 50, 102, 1);
  // cestas de frutas, pães e potes
  const fruits = ['#d8402e', '#f0a42a', '#8cb83a', '#c8403a'];
  for (let i = 0; i < 4; i++) {
    const bx = 16 + i * 24;
    fill(ctx, '#6a4a28', bx, 44, 18, 7);
    for (let k = 0; k < 6; k++) fill(ctx, fruits[(i + k) % 4], bx + 1 + k * 3, 41 + (k % 2), 3, 3);
  }
  fill(ctx, '#d89a4a', 84, 42, 14, 6);
  fill(ctx, '#f0c070', 85, 41, 12, 2);
  return { img: outlineSprite(c), w: W, h: H, wallW: 100, wallH: 22 };
}

/** Moinho: torre de pedra com chapéu vermelho; as pás giram na hora do desenho (`hub` é o centro). */
export function buildMill(): Sprite {
  const W = 84;
  const H = 128;
  const { c, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const topY = 46;
  for (let y = topY; y < H; y++) {
    const k = (y - topY) / (H - topY);
    const half = Math.round(18 + 12 * k);
    fill(ctx, '#d4c8b4', cx - half, y, half * 2, 1);
    fill(ctx, '#f0e6d4', cx - half, y, 3, 1);
    fill(ctx, '#9c8e7c', cx + half - 4, y, 4, 1);
    if ((y - topY) % 7 === 6) fill(ctx, '#a89c88', cx - half, y, half * 2, 1);
    else for (let xx = cx - half + ((Math.floor((y - topY) / 7) % 2) * 6); xx < cx + half; xx += 12) fill(ctx, '#a89c88', xx, y, 1, 1);
  }
  fill(ctx, '#3a2218', cx - 7, H - 24, 14, 24);
  fill(ctx, '#8c5a38', cx - 6, H - 23, 12, 23);
  for (let xx = cx - 6; xx < cx + 6; xx += 4) fill(ctx, '#6a3e26', xx, H - 23, 1, 23);
  fill(ctx, '#f0c858', cx + 3, H - 12, 2, 2);
  drawWindow(ctx, cx - 5, topY + 24, 10, 10, true);
  // telhado cônico
  for (let r = 0; r < 34; r++) {
    const half = Math.round(26 * (r / 34)) + 2;
    const w = r % 6;
    fill(ctx, w === 0 ? '#dc7a4a' : w === 5 ? '#5e2420' : w < 3 ? '#b85238' : '#8c3a2c', cx - half, topY - 30 + r, half * 2, 1);
    fill(ctx, '#dc7a4a', cx - half, topY - 30 + r, 2, 1);
  }
  fill(ctx, 'rgba(30,18,40,0.38)', cx - 28, topY + 4, 56, 3);
  fill(ctx, '#3a2218', cx - 1, topY - 36, 2, 8);
  return { img: outlineSprite(c), w: W, h: H, wallW: 58, wallH: 30, hub: { x: 0, y: -(H - topY) - 2 + 8 } };
}

/** Desenha as 4 pás do moinho girando em torno de (hx, hy). */
export function drawFan(v: CanvasRenderingContext2D, hx: number, hy: number, angle: number, broken = false) {
  const L = 42;
  for (let b = 0; b < 4; b++) {
    // estragado: uma pá pende torta, outra sem vela, e o conjunto não gira
    const a = broken ? (b * Math.PI) / 2 + 0.25 + (b === 1 ? 0.55 : b === 3 ? -0.3 : 0) : angle + (b * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let i = 3; i < L; i++) {
      const x = Math.round(hx + dx * i);
      const y = Math.round(hy + dy * i);
      v.fillStyle = '#4a2c1c';
      v.fillRect(x - 1, y - 1, 3, 3);
      v.fillStyle = '#8c5a38';
      v.fillRect(x, y, 1, 1);
      if (i > 12 && !(broken && (b === 2 || (b === 3 && i > 24)))) {
        // a vela de pano
        const nx = -dy;
        const ny = dx;
        for (let j = 2; j < 8; j++) {
          v.fillStyle = (i + j) % 6 < 3 ? '#f4ecd8' : '#d8ccb0';
          v.fillRect(Math.round(x + nx * j), Math.round(y + ny * j), 1, 1);
        }
      }
    }
  }
  v.fillStyle = '#2a1a14';
  v.fillRect(hx - 3, hy - 3, 7, 7);
  v.fillStyle = '#c8903c';
  v.fillRect(hx - 2, hy - 2, 5, 5);
  v.fillStyle = '#f0d070';
  v.fillRect(hx - 1, hy - 1, 2, 2);
}

export function buildWell(): Sprite {
  const W = 40;
  const H = 52;
  const { c, ctx } = makeCanvas(W, H);
  // base de pedra
  fill(ctx, '#7c7890', 4, 30, 32, 20);
  for (let r = 0; r < 3; r++) {
    fill(ctx, '#5a566c', 4, 34 + r * 6, 32, 1);
    for (let xx = 4 + (r % 2) * 5; xx < 36; xx += 10) fill(ctx, '#5a566c', xx, 30 + r * 6 - (r ? 0 : 0), 1, 6);
  }
  fill(ctx, '#aaa4b8', 4, 30, 32, 3);
  fill(ctx, '#1a2a3a', 8, 31, 24, 3);
  fill(ctx, '#3a6a84', 10, 32, 20, 2);
  // postes e telhadinho
  for (const x of [5, 32]) {
    fill(ctx, '#6a3e26', x, 8, 3, 28);
    fill(ctx, '#a87348', x, 8, 1, 28);
  }
  for (let r = 0; r < 10; r++) {
    const half = 20 - r * 1;
    fill(ctx, r % 5 === 0 ? '#dc7a4a' : r % 5 === 4 ? '#5e2420' : '#b85238', 20 - half, 2 + r, half * 2, 1);
  }
  fill(ctx, '#3a2218', 19, 12, 2, 12);
  fill(ctx, '#8c5a38', 14, 22, 12, 6);
  return { img: outlineSprite(c), w: W, h: H, wallW: 32, wallH: 16 };
}

export function buildWallPiece(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(28, 40);
  fill(ctx, '#8a8498', 0, 8, 28, 32);
  for (let r = 0; r * 7 < 32; r++) {
    fill(ctx, '#5a566c', 0, 14 + r * 7, 28, 1);
    for (let xx = (r % 2) * 7; xx < 28; xx += 14) fill(ctx, '#5a566c', xx, 8 + r * 7, 1, 7);
  }
  fill(ctx, '#aaa4b8', 0, 8, 28, 2);
  fill(ctx, '#a29eb4', 0, 0, 10, 8);
  fill(ctx, '#a29eb4', 18, 0, 10, 8);
  fill(ctx, '#d0cadc', 0, 0, 10, 1);
  fill(ctx, '#d0cadc', 18, 0, 10, 1);
  fill(ctx, '#625c76', 26, 0, 2, 40);
  return outlineSprite(c);
}

export function buildGatePillar(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(22, 74);
  fill(ctx, '#8a8498', 2, 10, 18, 64);
  for (let r = 0; r * 8 < 64; r++) {
    fill(ctx, '#5a566c', 2, 17 + r * 8, 18, 1);
    for (let xx = 2 + (r % 2) * 6; xx < 20; xx += 12) fill(ctx, '#5a566c', xx, 10 + r * 8, 1, 8);
  }
  fill(ctx, '#aaa4b8', 2, 10, 3, 64);
  fill(ctx, '#625c76', 17, 10, 3, 64);
  fill(ctx, '#b0aac0', 0, 4, 22, 8);
  fill(ctx, '#d0cadc', 0, 4, 22, 1);
  fill(ctx, '#625c76', 0, 11, 22, 1);
  fill(ctx, '#e0b84a', 8, 0, 6, 5);
  fill(ctx, '#fff0a0', 8, 0, 2, 5);
  return outlineSprite(c);
}

// ---------------------------------------------------------------- objetos pequenos

export interface SmallProps {
  barrel: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  crateSmall: HTMLCanvasElement;
  sack: HTMLCanvasElement;
  hay: HTMLCanvasElement;
  lumber: HTMLCanvasElement;
  barrow: HTMLCanvasElement;
  bucket: HTMLCanvasElement;
  rack: HTMLCanvasElement;
  flag: HTMLCanvasElement;
  trough: HTMLCanvasElement;
  scarecrow: HTMLCanvasElement;
  scarecrowBare: HTMLCanvasElement;
  coop: Sprite;
}

export function buildSmallProps(): SmallProps {
  const mk = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const { c, ctx } = makeCanvas(w, h);
    draw(ctx);
    return outlineSprite(c);
  };
  const barrel = mk(14, 18, (ctx) => {
    fill(ctx, '#7a4a2c', 1, 2, 12, 15);
    fill(ctx, '#a87348', 2, 2, 3, 15);
    fill(ctx, '#5a3420', 10, 2, 3, 15);
    fill(ctx, '#3a3a48', 1, 5, 12, 2);
    fill(ctx, '#3a3a48', 1, 12, 12, 2);
    fill(ctx, '#8c5a38', 2, 0, 10, 3);
    fill(ctx, '#c08a54', 3, 0, 8, 1);
  });
  const crate = mk(18, 16, (ctx) => {
    fill(ctx, '#a87348', 1, 1, 16, 14);
    fill(ctx, '#d0985c', 1, 1, 16, 2);
    fill(ctx, '#6a3e26', 1, 6, 16, 1);
    fill(ctx, '#6a3e26', 1, 11, 16, 1);
    fill(ctx, '#6a3e26', 1, 1, 2, 14);
    fill(ctx, '#6a3e26', 15, 1, 2, 14);
    fill(ctx, '#8c5a38', 8, 1, 2, 14);
  });
  const crateSmall = mk(13, 11, (ctx) => {
    fill(ctx, '#a87348', 1, 1, 11, 9);
    fill(ctx, '#d0985c', 1, 1, 11, 2);
    fill(ctx, '#6a3e26', 1, 5, 11, 1);
    fill(ctx, '#6a3e26', 1, 1, 2, 9);
    fill(ctx, '#6a3e26', 10, 1, 2, 9);
  });
  const sack = mk(13, 14, (ctx) => {
    fill(ctx, '#d8c08a', 2, 3, 9, 10);
    fill(ctx, '#ecd8a4', 3, 3, 3, 9);
    fill(ctx, '#b09a68', 9, 5, 2, 8);
    fill(ctx, '#d8c08a', 3, 1, 7, 3);
    fill(ctx, '#7a5a38', 4, 3, 5, 1);
    fill(ctx, '#8c6a3c', 5, 7, 3, 2);
  });
  const hay = mk(26, 20, (ctx) => {
    for (let y = 0; y < 18; y++) {
      const half = 13 - Math.round(Math.abs(y - 9) * 0.15) - (y < 4 ? 4 - y : 0);
      fill(ctx, y % 3 === 0 ? '#f4dc84' : '#e0b84a', 13 - half, 1 + y, half * 2, 1);
    }
    for (let i = 0; i < 14; i++) fill(ctx, '#b8902c', 3 + ((i * 7) % 20), 3 + ((i * 5) % 14), 3, 1);
    fill(ctx, '#7a5a20', 2, 16, 22, 1);
  });
  const lumber = mk(32, 18, (ctx) => {
    for (let r = 0; r < 4; r++) {
      fill(ctx, r % 2 ? '#8c5a38' : '#a87348', 1, 2 + r * 4, 30, 4);
      fill(ctx, '#d0a066', 1, 2 + r * 4, 30, 1);
      fill(ctx, '#e0b078', 28, 3 + r * 4, 3, 2);
      fill(ctx, '#6a3e26', 1, 5 + r * 4, 30, 1);
    }
  });
  const barrow = mk(28, 18, (ctx) => {
    fill(ctx, '#8c5a38', 3, 4, 17, 8);
    fill(ctx, '#b88050', 3, 4, 17, 2);
    fill(ctx, '#d8c08a', 5, 2, 12, 3);
    fill(ctx, '#6a3e26', 18, 9, 9, 2);
    fill(ctx, '#3a3a48', 8, 11, 7, 7);
    fill(ctx, '#6a6a7a', 10, 13, 3, 3);
    fill(ctx, '#6a3e26', 3, 12, 2, 5);
  });
  const bucket = mk(10, 10, (ctx) => {
    fill(ctx, '#7a4a2c', 1, 2, 8, 7);
    fill(ctx, '#a87348', 2, 2, 2, 7);
    fill(ctx, '#3a3a48', 1, 4, 8, 1);
    fill(ctx, '#3a6a84', 2, 2, 6, 1);
  });
  const rack = mk(26, 24, (ctx) => {
    fill(ctx, '#6a3e26', 1, 6, 3, 17);
    fill(ctx, '#6a3e26', 22, 6, 3, 17);
    fill(ctx, '#8c5a38', 1, 6, 24, 3);
    fill(ctx, '#8c5a38', 1, 14, 24, 2);
    for (const x of [6, 11, 16]) {
      fill(ctx, '#c8ccd8', x, 0, 2, 14);
      fill(ctx, '#e8ecf4', x, 0, 1, 14);
      fill(ctx, '#e0c050', x - 1, 12, 4, 2);
    }
  });
  const flag = mk(16, 40, (ctx) => {
    fill(ctx, '#6a3e26', 2, 2, 2, 38);
    fill(ctx, '#a87348', 2, 2, 1, 38);
    fill(ctx, '#c8403a', 4, 3, 11, 14);
    fill(ctx, '#e8705a', 4, 3, 11, 2);
    fill(ctx, '#8a2a28', 4, 14, 11, 3);
    fill(ctx, '#f0d070', 7, 8, 5, 3);
    fill(ctx, '#e0b84a', 1, 0, 4, 3);
  });
  const trough = mk(30, 12, (ctx) => {
    fill(ctx, '#7a4a2c', 1, 3, 28, 8);
    fill(ctx, '#a87348', 1, 3, 28, 2);
    fill(ctx, '#3a6a84', 3, 3, 24, 3);
    fill(ctx, '#6a3e26', 3, 9, 3, 3);
    fill(ctx, '#6a3e26', 24, 9, 3, 3);
  });
  const scarecrowBody = (ctx: CanvasRenderingContext2D, hat: boolean) => {
    fill(ctx, '#6a3e26', 13, 10, 3, 30);
    fill(ctx, '#6a3e26', 2, 14, 25, 3);
    fill(ctx, '#c8503a', 8, 14, 13, 12);
    fill(ctx, '#e0705a', 8, 14, 3, 12);
    fill(ctx, '#e8c898', 11, 2, 8, 8);
    fill(ctx, '#1c1210', 13, 5, 1, 2);
    fill(ctx, '#1c1210', 17, 5, 1, 2);
    if (hat) {
      fill(ctx, '#d9b45a', 7, 0, 16, 3);
      fill(ctx, '#d9b45a', 11, -1, 8, 2);
    } else {
      // sem o chapéu: palha desgrenhada no alto da cabeça
      fill(ctx, '#e0b84a', 10, 1, 10, 2);
      fill(ctx, '#e0b84a', 12, 0, 1, 2);
      fill(ctx, '#e0b84a', 16, 0, 1, 2);
    }
    for (const x of [1, 24]) fill(ctx, '#e0b84a', x, 16, 3, 5);
  };
  const scarecrow = mk(28, 40, (ctx) => scarecrowBody(ctx, true));
  const scarecrowBare = mk(28, 40, (ctx) => scarecrowBody(ctx, false));
  // galinheiro: casinha de brinquedo com poleiro
  const coop = buildBuilding({ w: 36, wallH: 22, roofH: 18, over: 3, wall: WOOD, wallKind: 'wood', roof: ROOF_RED, door: { w: 10, h: 12, dark: true }, seed: 51, inset: 6 });
  return { barrel, crate, crateSmall, sack, hay, lumber, barrow, bucket, rack, flag, trough, scarecrow, scarecrowBare, coop };
}
