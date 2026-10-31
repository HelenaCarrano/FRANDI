/**
 * Arte em pixels gerada em código: paletas, árvores, pedras, arbustos, o Matheus e a galinha.
 * (Extraído do protótipo forest2d.ts: tudo que várias áreas reaproveitam.)
 */

const params = new URLSearchParams(location.search);
export const AUTUMN = params.get('estacao') !== 'verao';

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

export type RGB = [number, number, number];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// ---------------------------------------------------------------- paletas

export const PAL = AUTUMN
  ? {
      grass: ['#76862e', '#6a7a2a', '#8a9a36', '#5a6a24'],
      bladeLight: '#c8c456',
      bladeDark: '#3c4c1c',
      path: ['#a8825a', '#96724c', '#bc966a'],
      pathEdge: '#5e4228',
      trees: [
        { ramp: ['#5a2018', '#9a3a1c', '#d8741e', '#f8b840'], outline: '#3c1410' },
        { ramp: ['#4a1a22', '#8a2c28', '#c85630', '#f08840'], outline: '#32101a' },
        { ramp: ['#6a4a10', '#a8801e', '#d8b030', '#f8e068'], outline: '#463208' },
        { ramp: ['#2c3c16', '#48621e', '#74922c', '#b4c850'], outline: '#1e2a0e' },
      ],
      leaves: ['#a8381c', '#d8741e', '#f0b030'],
    }
  : {
      grass: ['#4a8c3c', '#549844', '#5ea44a', '#427e36'],
      bladeLight: '#86c458',
      bladeDark: '#3f7a30',
      path: ['#cfa66c', '#c29a5e', '#dcb87c'],
      pathEdge: '#8a6a40',
      trees: [
        { ramp: ['#1f5a34', '#2f7e3e', '#4aa24a', '#7cc85c'], outline: '#16422a' },
        { ramp: ['#25623a', '#37883f', '#58ae4a', '#92d462'], outline: '#183f28' },
        { ramp: ['#2b5a3a', '#3c8450', '#5aa862', '#8ccc84'], outline: '#1b4030' },
        { ramp: ['#9a4a6a', '#cc7a98', '#f0a4bc', '#ffd2e0'], outline: '#6a2e48' }, // cerejeira
        { ramp: ['#7a5a1c', '#b08a28', '#dcb844', '#f4e07a'], outline: '#523c14' }, // dourada
      ],
      leaves: ['#d8c040', '#e89a3a', '#a8d060'],
    };

export const TRUNK = ['#46281c', '#6a3e26', '#8c5a38', '#a87348'];
export const ROCK = ['#4e5662', '#707a88', '#98a2b0', '#c4ccd6'];
export const BUSH = AUTUMN ? ['#4a5a22', '#6a7c2e', '#8c9c3c', '#b4c456'] : ['#2a6a36', '#3a8a42', '#5cac52', '#8cd070'];
export const WATER = ['#2a6484', '#3a82a0', '#5aa6bc', '#b0e0e8'];
export const MUD = AUTUMN ? '#765234' : '#a47c52';
export const COBBLE = AUTUMN ? '#80603e' : '#8a6a40';
export const CLIFF = ['#34304c', '#524e6c', '#78748f', '#a4a0b8'];
export const CLEAR = ['#5f4650', '#6e5460', '#816570', '#46343e'];
export const OUTLINE = '#2a1a14';


/** Elipse preenchida em pixels (sem serrilhado suavizado). */
export function discPx(v: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const r = Math.round(ry);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / Math.max(1, ry)) ** 2)));
    v.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2, 1);
  }
}
/** Anel de elipse em pixels, com `th` de espessura. */
export function ringPx(v: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, th: number) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const r = Math.round(ry);
  for (let dy = -r; dy <= r; dy++) {
    const oh = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / Math.max(1, ry)) ** 2)));
    const iry = ry - th;
    const ih = iry > 0 && Math.abs(dy) < iry ? Math.round((rx - th) * Math.sqrt(Math.max(0, 1 - (dy / iry) ** 2))) : 0;
    if (ih > 0) {
      v.fillRect(cx - oh, cy + dy, oh - ih, 1);
      v.fillRect(cx + ih, cy + dy, oh - ih, 1);
    } else v.fillRect(cx - oh, cy + dy, oh * 2, 1);
  }
}


// ---------------------------------------------------------------- sombreamento de formas

export interface Ball {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * Desenha um aglomerado de bolas com luz vinda de cima à esquerda: cada pixel pega a bola mais alta ali,
 * o brilho vira um de 4 tons (com um tiquinho de ruído) e a beirada ganha contorno escuro.
 */
export function shadedBalls(w: number, h: number, balls: Ball[], ramp: string[], outline: string, rng: Rng, tex = 0.14) {
  const { c, ctx } = makeCanvas(w, h);
  const L = [-0.5, -0.72, 0.48];
  const inside = new Uint8Array(w * h);
  const tone = new Int8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = -1;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (const b of balls) {
        const dx = (x + 0.5 - b.x) / b.rx;
        const dy = (y + 0.5 - b.y) / b.ry;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const z = Math.sqrt(1 - d2);
        // bolas mais abaixo na tela ficam na frente
        const h2 = z + (b.y / h) * 0.6;
        if (h2 > best) {
          best = h2;
          nx = dx;
          ny = dy;
          nz = z;
        }
      }
      if (best < 0) continue;
      inside[y * w + x] = 1;
      const lit = nx * L[0] + ny * L[1] + nz * L[2] + (rng() - 0.5) * tex * 2;
      tone[y * w + x] = lit > 0.5 ? 3 : lit > 0.12 ? 2 : lit > -0.3 ? 1 : 0;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : inside[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside[y * w + x]) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      ctx.fillStyle = edge ? outline : ramp[tone[y * w + x]];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return { c, ctx };
}

/** Pinheiro cheio e cônico: tronco aparecendo entre ramos longos que caem, mais curtos no topo e compridos embaixo. */
export function buildPineCanopy(w: number, h: number, scheme: { ramp: string[]; outline: string }, rng: Rng) {
  const { c, ctx } = makeCanvas(w, h);
  const cx = Math.floor(w / 2);
  const filled = new Uint8Array(w * h);
  const put = (x: number, y: number, col: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
    filled[y * w + x] = 1;
  };
  // tronco avermelhado
  for (let y = 8; y < h - 12; y++) {
    const tw = y > h * 0.55 ? 5 : 4;
    for (let i = 0; i < tw; i++) put(cx - 1 + i, y, i === 0 ? TRUNK[2] : i === tw - 1 ? TRUNK[0] : TRUNK[1]);
  }
  // ponta do topo
  for (let i = 0; i < 12; i++) {
    const half = i > 4 ? Math.floor((i - 4) / 3) : 0;
    for (let dx = -half; dx <= half; dx++) put(cx + dx, 2 + i, dx < 0 ? scheme.ramp[3] : dx > 0 ? scheme.ramp[1] : scheme.ramp[2]);
  }
  // ramos que caem, com a luz vindo de cima e da esquerda
  const maxY = h - 26;
  let y = 14;
  while (y < maxY) {
    const t = (y - 8) / (maxY - 8);
    const L = Math.min(w / 2 - 4, Math.round(7 + Math.pow(t, 0.8) * (w / 2 - 10) * (0.85 + rng() * 0.3)));
    for (const side of [-1, 1]) {
      const Ls = L - Math.floor(rng() * 4);
      for (let dx = 1; dx <= Ls; dx++) {
        const droop = Math.floor((dx * dx) / (Ls * 4.2));
        const yy = y + droop + Math.floor(dx * 0.1);
        const thick = dx < Ls * 0.35 ? 7 : dx < Ls * 0.7 ? 5 : 3;
        for (let d = 0; d < thick; d++) {
          const lit = (d === 0 ? 0.55 : d === thick - 1 ? -0.5 : 0) + (side < 0 ? 0.25 : -0.25) + (rng() - 0.5) * 0.5;
          put(cx + side * dx, yy + d, scheme.ramp[lit > 0.45 ? 3 : lit > 0 ? 2 : lit > -0.45 ? 1 : 0]);
        }
        if (dx > Ls * 0.6 && rng() < 0.45) put(cx + side * dx, yy + thick, scheme.ramp[0]);
      }
    }
    y += 4 + Math.floor(rng() * 2);
  }
  // contorno escuro só por fora
  const edge: number[] = [];
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (filled[yy * w + xx]) continue;
      if ((xx > 0 && filled[yy * w + xx - 1]) || (xx < w - 1 && filled[yy * w + xx + 1]) || (yy > 0 && filled[(yy - 1) * w + xx]) || (yy < h - 1 && filled[(yy + 1) * w + xx])) edge.push(yy * w + xx);
    }
  }
  ctx.fillStyle = scheme.outline;
  for (const idx of edge) ctx.fillRect(idx % w, Math.floor(idx / w), 1, 1);
  return { c, ctx };
}

export interface TreeSprite {
  trunk: HTMLCanvasElement;
  canopy: HTMLCanvasElement;
  footX: number;
  footY: number;
  canopyX: number;
  canopyY: number;
  big: boolean;
  pine: boolean;
}

export function buildTree(rng: Rng, scheme: { ramp: string[]; outline: string }, big: boolean, kind: 'round' | 'pine' = 'round'): TreeSprite {
  const pine = kind === 'pine';
  const fl = pine ? 5 : big ? 11 : 8;
  const tw = pine ? 30 : big ? 44 : 34;
  const th = pine ? 40 : big ? 60 : 46;
  const trunk = makeCanvas(tw, th);
  const t = trunk.ctx;
  const cx = tw / 2;
  const topW = pine ? 7 : big ? 12 : 9;
  for (let y = 0; y < th; y++) {
    const k = y / th;
    const flare = Math.pow(Math.max(0, k - 0.72) / 0.28, 2) * fl;
    const half = topW / 2 + flare + Math.sin(y / 6) * 0.5;
    const x0 = Math.floor(cx - half);
    const x1 = Math.ceil(cx + half);
    for (let x = x0; x <= x1; x++) {
      const rel = (x - x0) / Math.max(1, x1 - x0);
      let col = rel < 0.22 ? TRUNK[3] : rel < 0.5 ? TRUNK[2] : rel < 0.8 ? TRUNK[1] : TRUNK[0];
      if (rng() < 0.07) col = TRUNK[Math.max(0, Math.min(3, Math.floor(rel * 4) + (rng() < 0.5 ? -1 : 1)))];
      if (x === x0 || x === x1) col = OUTLINE;
      t.fillStyle = col;
      t.fillRect(x, y, 1, 1);
    }
  }
  t.fillStyle = OUTLINE;
  t.fillRect(Math.floor(cx - topW / 2 - fl), th - 1, Math.round(topW + fl * 2) + 2, 1);
  for (const side of [-1, 1]) {
    t.fillStyle = TRUNK[1];
    for (let j = 0; j < 5; j++) t.fillRect(Math.round(cx + side * (topW / 2 + fl - 2 + j)), th - 3 + Math.floor(j / 2), 1, 2);
  }
  // copa de bolas, com folhinhas claras
  const cw = pine ? 96 : big ? 132 : 100;
  const ch = pine ? 128 : big ? 104 : 80;
  const n = big ? 10 : 7;
  const balls: Ball[] = [];
  for (let i = 0; !pine && i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    const rr = (i === 0 ? 0 : 0.55 + rng() * 0.4) * cw * 0.27;
    const r = (big ? 24 : 18) + rng() * (big ? 10 : 7);
    balls.push({ x: cw / 2 + Math.cos(a) * rr, y: ch * 0.5 + Math.sin(a) * rr * 0.62, rx: r, ry: r * 0.92 });
  }
  const canopy = pine ? buildPineCanopy(cw, ch, scheme, rng) : shadedBalls(cw, ch, balls, scheme.ramp, scheme.outline, rng, 0.08);
  for (let i = 0; i < (pine ? 0 : big ? 60 : 36); i++) {
    const b = balls[Math.floor(rng() * balls.length)];
    const x = Math.floor(b.x + (rng() - 0.5) * b.rx * 1.3);
    const y = Math.floor(b.y + (rng() - 0.5) * b.ry * 1.3);
    if (x < 0 || y < 1 || x >= cw || y >= ch) continue;
    if (canopy.ctx.getImageData(x, y, 1, 1).data[3] === 0) continue;
    const upper = y < b.y;
    canopy.ctx.fillStyle = upper ? scheme.ramp[3] : scheme.ramp[0];
    canopy.ctx.fillRect(x, y, 2, 1);
    if (upper) canopy.ctx.fillRect(x + 1, y - 1, 1, 1);
  }
  return { trunk: trunk.c, canopy: canopy.c, footX: cx, footY: th - 2, canopyX: cw / 2, canopyY: pine ? ch + 18 - th : ch * 0.74, big, pine };
}

/**
 * Pedra facetada: silhueta irregular de cantos firmes, dividida em planos que pegam a luz de cima à esquerda,
 * com arestas escuras entre os planos, rachaduras, base na sombra e musgo no topo.
 */
function facetRock(rng: Rng, w: number, h: number, ramp: string[], cracks: number, moss: number) {
  const W = w + 4;
  const H = h + 4;
  const { c, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = 2 + h * 0.52;
  const rx = (w / 2) * 0.9;
  const ry = h * 0.5;
  const p = 2.3 + rng() * 0.6;
  const harm = [0, 1, 2].map((k) => ({ f: 2 + k, a: (0.05 + rng() * 0.06) / (1 + k * 0.4), ph: rng() * 6.28 }));
  const radius = (ang: number) => 1 + harm.reduce((t, k) => t + Math.sin(ang * k.f + k.ph) * k.a, 0);
  const L = [-0.55, -0.7, 0.45];
  const n = 5 + Math.round(w / 14);
  const seeds = Array.from({ length: n }, () => {
    const u = (rng() - 0.5) * 1.5;
    const v = (rng() - 0.5) * 1.4;
    const nx = u * 0.6 + (rng() - 0.5) * 0.9;
    const ny = v * 0.6 + (rng() - 0.5) * 0.9 - 0.15;
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx * 0.5 - ny * ny * 0.5));
    return { x: cx + u * rx, y: cy + v * ry, lit: nx * L[0] + ny * L[1] + nz * L[2] };
  });
  const inside = new Uint8Array(W * H);
  const cell = new Int8Array(W * H).fill(-1);
  const tone = new Int8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (v > 0.92) continue;
      const vv = v < 0 ? v : v * 0.85;
      const d = Math.pow(Math.abs(u), p) + Math.pow(Math.abs(vv), p);
      const ang = Math.atan2(vv, u);
      if (d > Math.pow(radius(ang), p)) continue;
      inside[y * W + x] = 1;
      let bi = 0;
      let bd = Infinity;
      seeds.forEach((sd, i) => {
        const dd = (sd.x - x) ** 2 + ((sd.y - y) * 1.2) ** 2;
        if (dd < bd) {
          bd = dd;
          bi = i;
        }
      });
      cell[y * W + x] = bi;
      const dz = Math.sqrt(Math.max(0, 1 - Math.min(1, u * u * 0.8 + v * v * 0.8)));
      const dome = u * 0.5 * L[0] + v * 0.5 * L[1] + dz * L[2];
      const lit = seeds[bi].lit * 0.6 + dome * 0.5 + (rng() - 0.5) * 0.05;
      tone[y * W + x] = lit > 0.5 ? 3 : lit > 0.18 ? 2 : lit > -0.12 ? 1 : 0;
    }
  }
  const ins = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && inside[y * W + x] === 1;
  // arestas entre planos: o lado mais escuro do encontro ganha uma linha um tom abaixo
  const t2 = Int8Array.from(tone);
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (!inside[i]) continue;
      for (const j of [i - 1, i - W]) {
        if (inside[j] && cell[j] !== cell[i] && tone[i] <= tone[j] && tone[i] > 0) t2[i] = tone[i] - 1;
      }
    }
  }
  // musgo e rachaduras
  const mossy = new Uint8Array(W * H);
  for (let k = 0; k < moss; k++) {
    const mx = cx + (rng() - 0.5) * rx * 1.4;
    const my = cy - ry * (0.15 + rng() * 0.6);
    const mr = 1.2 + rng() * Math.max(1, w / 18);
    for (let y = Math.floor(my - mr); y <= my + mr; y++) {
      for (let x = Math.floor(mx - mr * 1.6); x <= mx + mr * 1.6; x++) {
        if (!ins(x, y) || t2[y * W + x] < 2) continue;
        if (((x - mx) / 1.6) ** 2 + (y - my) ** 2 < mr * mr * (0.55 + rng() * 0.45)) mossy[y * W + x] = 1;
      }
    }
  }
  const crack = new Uint8Array(W * H);
  for (let k = 0; k < cracks; k++) {
    let x = Math.round(cx + (rng() - 0.5) * rx * 1.1);
    let y = Math.round(cy - ry * (0.3 + rng() * 0.3));
    const len = Math.round(ry * (0.5 + rng() * 0.5));
    for (let i = 0; i < len; i++) {
      if (ins(x, y)) crack[y * W + x] = 1;
      y++;
      if (rng() < 0.45) x += rng() < 0.5 ? -1 : 1;
    }
  }
  const MOSS = ['#2f4a1e', '#486e2a', '#659638', '#8abc4c'];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!inside[i]) continue;
      let col = ramp[t2[i]];
      if (mossy[i]) col = MOSS[Math.min(3, t2[i])];
      if (crack[i]) col = ramp[0];
      // base na sombra: a pedra assenta no chão
      if (!ins(x, y + 2)) col = ramp[0];
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return outlineSprite(c);
}

export function buildRock(rng: Rng, w: number) {
  const h = Math.max(6, Math.round(w * 0.72));
  return facetRock(rng, w, h, ROCK, w >= 18 ? 1 : 0, w >= 12 ? 1 : 0);
}
export function buildBush(rng: Rng, w: number, berries: string | null) {
  const h = Math.round(w * 0.7);
  const { c, ctx } = shadedBalls(
    w + 2,
    h + 2,
    [
      { x: w * 0.32, y: h * 0.6, rx: w * 0.3, ry: h * 0.42 },
      { x: w * 0.66, y: h * 0.58, rx: w * 0.32, ry: h * 0.44 },
      { x: w * 0.5, y: h * 0.4, rx: w * 0.3, ry: h * 0.4 },
    ],
    BUSH,
    '#17402a',
    rng,
    0.2,
  );
  if (berries) {
    for (let i = 0; i < Math.round(w / 3); i++) {
      const x = Math.floor(3 + rng() * (w - 6));
      const y = Math.floor(3 + rng() * (h - 5));
      if (ctx.getImageData(x, y, 1, 1).data[3] === 0) continue;
      ctx.fillStyle = berries;
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function buildMushroom(glow: boolean) {
  const { c, ctx } = makeCanvas(11, 10);
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  px('#efe2c4', 4, 5, 3, 4);
  px('#c8b894', 6, 5, 1, 4);
  const cap = glow ? ['#2a5aa8', '#4a8cf0', '#a8e0ff'] : ['#8a2a30', '#c8403c', '#f08870'];
  px(cap[0], 1, 2, 9, 3);
  px(cap[1], 2, 1, 7, 3);
  px(cap[2], 3, 1, 3, 1);
  px(glow ? '#e8faff' : '#ffffff', 3, 2, 1, 1);
  px(glow ? '#e8faff' : '#ffffff', 7, 3, 1, 1);
  return outlineSprite(c);
}

export function buildBoulder(rng: Rng, w: number) {
  return facetRock(rng, w, Math.round(w * 0.78), CLIFF, 3, 2 + Math.round(w / 24));
}

export function buildStone(rng: Rng, tall: number) {
  const w = 14;
  const { c, ctx } = shadedBalls(w, tall, [{ x: 7, y: tall * 0.7, rx: 6.5, ry: tall * 0.3 }, { x: 7, y: tall * 0.4, rx: 5.6, ry: tall * 0.34 }], ROCK, OUTLINE, rng, 0.2);
  // runa que brilha
  ctx.fillStyle = '#9af4ff';
  ctx.fillRect(6, Math.round(tall * 0.42), 2, 1);
  ctx.fillRect(7, Math.round(tall * 0.42) - 1, 1, 4);
  ctx.fillRect(5, Math.round(tall * 0.42) + 2, 1, 1);
  ctx.fillStyle = '#4a8a4a';
  ctx.fillRect(3, 3, 3, 1);
  ctx.fillRect(9, Math.round(tall * 0.6), 2, 2);
  return c;
}

export function buildFern(rng: Rng) {
  const { c, ctx } = makeCanvas(24, 16);
  const bx = 12;
  const by = 14;
  const cols = AUTUMN ? ['#3c4c1c', '#5e7a26', '#8ca836', '#d0b848'] : ['#2a6a36', '#3a8a42', '#5cac52', '#8cd070'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2.5 + (rng() - 0.5) * 0.3;
    const len = 7 + rng() * 5;
    for (let t = 0; t <= 1; t += 0.06) {
      const x = bx + Math.sin(a) * len * t;
      const y = by - Math.cos(a) * len * t * 0.9 + t * t * len * 0.35;
      ctx.fillStyle = cols[t < 0.35 ? 0 : t < 0.7 ? 1 : a < 0 ? 3 : 2];
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (t > 0.25 && t < 0.95) {
        ctx.fillRect(Math.round(x) + (a < 0 ? -1 : 1), Math.round(y) + 1, 1, 1);
      }
    }
  }
  return outlineSprite(c, [0x1c, 0x28, 0x10]);
}

export function buildStump(rng: Rng) {
  const { c, ctx } = makeCanvas(22, 20);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 22; x++) {
      const topDx = (x - 10.5) / 10;
      const topDy = (y - 6) / 5;
      const onTop = topDx * topDx + topDy * topDy < 1;
      const onSide = y >= 6 && y < 17 && Math.abs(x - 10.5) < 9.4 - (y > 14 ? (y - 14) * 0.3 : 0);
      if (!onTop && !onSide) continue;
      let col = TRUNK[1];
      if (onTop) {
        const ring = Math.hypot(topDx, topDy * 1.2);
        col = Math.floor(ring * 4) % 2 === 0 ? '#c8985c' : '#b4824c';
        if (ring > 0.88) col = TRUNK[2];
      } else {
        col = x < 6 ? TRUNK[2] : x > 15 ? TRUNK[0] : TRUNK[1];
        if (rng() < 0.12) col = TRUNK[0];
      }
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return outlineSprite(c);
}

// ---------------------------------------------------------------- personagens

export type Dir = 'down' | 'up' | 'side';

export function outlineSprite(src: HTMLCanvasElement, color = [0x2a, 0x1a, 0x14]) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  const data = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
  const out = ctx.createImageData(src.width, src.height);
  const idx = (x: number, y: number) => (y * src.width + x) * 4;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = idx(x, y);
      if (data.data[i + 3] > 0) {
        out.data.set(data.data.subarray(i, i + 4), i);
        continue;
      }
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < src.width && ny < src.height && data.data[idx(nx, ny) + 3] > 0;
      });
      if (near) out.data.set([color[0], color[1], color[2], 255], i);
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

export const SKIN = '#f0bc92';
export const SKIN_S = '#d49872';
export const HAIR = '#3a2316';
export const HAIR_M = '#4e2f1c';
export const HAIR_L = '#6a4428';
export const HOOD = '#22222b';
export const HOOD_L = '#3a3a48';
export const HOOD_D = '#14141a';
export const PANTS = '#2e2e36';
export const PANTS_L = '#434350';
export const INK = '#5a7488';
export const RED = '#d0443a';
export const SHOE = '#1b1b22';
export const SOLE = '#6c6c7c';

/** Como o Matheus está vestido: normal, descalço de calça arregaçada (pisando uvas) ou com a barra da calça manchada de roxo. */
export type Look = 'normal' | 'bare' | 'stain';
const STAIN = '#5a2a7a';
const STAIN_L = '#8a4aae';

/** Matheus em 24x34 (pés em 12,33): cabeção fofo, cabelo cacheado, barba curta, tatuagens, moletom preto e tênis branco. */
export function drawMatheus(dir: Dir, frame: number, blink = false, look: Look = 'normal') {
  const { c, ctx } = makeCanvas(24, 34);
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = frame === 3 ? 1 : 0; // só a respiração sobe o tronco; o pulo é feito no desenho
  /** Quadro 4 = passagem: os pés se encontram no meio do passo (o corpo sobe 1 px no desenho). */
  const passing = frame === 4;
  const bare = look === 'bare';
  const stain = look === 'stain';
  /** Barra da calça (parte de baixo da perna), tênis e sola conforme o visual. */
  const hem = bare ? SKIN : stain ? STAIN : PANTS;
  const hemL = bare ? '#f6c8a0' : stain ? STAIN_L : PANTS_L;
  const shoeCol = bare ? SKIN : stain ? '#2a1838' : SHOE;
  const soleCol = bare ? SKIN_S : stain ? '#5a4a6c' : SOLE;

  // pernas e tênis
  if (dir === 'side') {
    px(PANTS, 9, 25, 7, 4);
    px(PANTS_L, 10, 26, 2, 2);
    // perna de longe (mais escura) e de perto: no passo elas abrem e trocam de lugar, como no Stardew
    const farX = step === 1 ? 6 : step === -1 ? 14 : passing ? 10 : 8;
    const nearX = step === 1 ? 14 : step === -1 ? 6 : passing ? 10 : 11;
    const nearUp = passing ? 1 : 0;
    px(bare ? SKIN_S : stain ? '#3a1e4e' : '#24242c', farX + 1, 28, 3, 2);
    px(bare ? SKIN_S : stain ? '#1e1028' : '#16161c', farX, 29, 6, 3);
    px(bare ? '#a87858' : '#46465a', farX, 31, 6, 1);
    px(hem, nearX + 1, 28 - nearUp, 3, 2);
    px(hemL, nearX + 1, 28 - nearUp, 1, 2);
    if (bare) px('#4a4a58', nearX + 1, 27 - nearUp, 3, 1);
    px(shoeCol, nearX, 29 - nearUp, 6, 3);
    px(soleCol, nearX, 31 - nearUp, 6, 1);
    if (bare) for (const d of [3, 4, 5]) px('#f6c8a0', nearX + d, 29 - nearUp, 1, 1);
    if (stain) {
      px(STAIN_L, nearX + 1, 29 - nearUp, 2, 1);
      px(STAIN, nearX + 4, 30 - nearUp, 2, 1);
    }
  } else {
    px(PANTS, 8, 25, 8, 4);
    px(PANTS_L, 8, 26, 1, 3);
    px(PANTS_L, 15, 26, 1, 3);
    px(HOOD_D, 11, 27, 2, 2);
    const lf = step === 1 ? -1 : 0;
    const rf = step === -1 ? -1 : 0;
    if (bare) {
      // calça arregaçada: a barra dobrada no joelho e as canelas de fora
      px('#4a4a58', 8, 26, 3, 1);
      px('#4a4a58', 13, 26, 3, 1);
      px(SKIN, 8, 27, 3, 2);
      px(SKIN, 13, 27, 3, 2);
    }
    if (stain) {
      // a barra da calça manchada de roxo, com pingos escorrendo
      px(STAIN, 8, 27, 3, 2);
      px(STAIN, 13, 27, 3, 2);
      px(STAIN_L, 8, 27, 1, 2);
      px(STAIN_L, 13, 27, 1, 2);
      px(STAIN, 9, 26, 1, 1);
      px(STAIN, 14, 26, 1, 1);
    }
    px(hem, 8, 28 + lf, 3, 1);
    px(hem, 13, 28 + rf, 3, 1);
    px(shoeCol, 7, 29 + lf, 5, 3);
    px(soleCol, 7, 31 + lf, 5, 1);
    px(shoeCol, 12, 29 + rf, 5, 3);
    px(soleCol, 12, 31 + rf, 5, 1);
    if (bare) {
      for (const x of [7, 9, 11]) px('#f6c8a0', x, 29 + lf, 1, 1);
      for (const x of [12, 14, 16]) px('#f6c8a0', x, 29 + rf, 1, 1);
    }
    if (stain) {
      px(STAIN_L, 8, 29 + lf, 2, 1);
      px(STAIN_L, 14, 29 + rf, 2, 1);
      px(STAIN, 10, 30 + lf, 1, 1);
      px(STAIN, 13, 30 + rf, 1, 1);
    }
  }

  ctx.save();
  ctx.translate(0, -bob);
  if (dir === 'down') {
    // moletom reto, até o quadril, com capuz caído atrás do pescoço
    px(HOOD, 7, 16, 10, 9);
    px(HOOD_D, 14, 17, 3, 8);
    px(HOOD_L, 8, 17, 1, 7);
    px(HOOD_L, 8, 16, 8, 1);
    const aL = -step;
    const aR = step;
    px(HOOD, 5, 17 + aL, 2, 8);
    px(HOOD, 17, 17 + aR, 2, 8);
    px(HOOD_L, 5, 17 + aL, 1, 7);
    px(HOOD_D, 18, 18 + aR, 1, 7);
    // cruzinha vermelha e estampa cinza
    px(RED, 12, 19, 1, 4);
    px(RED, 11, 20, 3, 1);
    px('#7c7c8c', 9, 22, 2, 1);
    px('#7c7c8c', 14, 22, 1, 1);
    px('#7c7c8c', 6, 20, 1, 3);
    // mãos: a direita dele (esquerda da imagem) é toda tatuada
    px(INK, 5, 25 + aL, 2, 2);
    px('#2e3e50', 5, 26 + aL, 1, 1);
    px(SKIN, 17, 25 + aR, 2, 2);
    // pescoço tatuado
    px(SKIN_S, 10, 15, 4, 2);
    px(INK, 10, 16, 1, 1);
    px(INK, 12, 16, 2, 1);
    // rosto
    px(SKIN, 7, 7, 10, 8);
    px(SKIN, 6, 9, 1, 4);
    px(SKIN, 17, 9, 1, 4);
    px(SKIN_S, 7, 14, 10, 1);
    // cabelo: volume cacheado no topo, franja para o lado, degradê nas laterais
    px(HAIR, 6, 4, 12, 4);
    px(HAIR, 7, 3, 4, 1);
    px(HAIR, 12, 3, 4, 1);
    px(HAIR, 8, 2, 3, 1);
    px(HAIR, 13, 2, 2, 1);
    px(HAIR, 5, 5, 1, 3);
    px(HAIR, 18, 5, 1, 3);
    px(HAIR_L, 8, 3, 2, 1);
    px(HAIR_L, 13, 3, 2, 1);
    px(HAIR_L, 7, 5, 2, 1);
    px(HAIR_L, 14, 5, 2, 1);
    px(HAIR_M, 10, 4, 2, 1);
    px(HAIR, 7, 8, 7, 1);
    px(HAIR_M, 9, 8, 2, 1);
    px(HAIR_L, 12, 8, 1, 1);
    px('#6e4e3e', 6, 9, 1, 2);
    px('#6e4e3e', 17, 9, 1, 2);
    // sobrancelhas grossas, olhos grandes com brilho
    px(HAIR, 9, 9, 3, 1);
    px(HAIR, 13, 9, 3, 1);
    if (blink) {
      px('#1c1210', 9, 11, 2, 1);
      px('#1c1210', 14, 11, 2, 1);
    } else {
      px('#1c1210', 9, 10, 2, 3);
      px('#1c1210', 14, 10, 2, 3);
      px('#ffffff', 9, 10, 1, 1);
      px('#ffffff', 14, 10, 1, 1);
      px('#6a4a8a', 10, 12, 1, 1);
      px('#6a4a8a', 15, 12, 1, 1);
    }
    // bochechas rosadas e nariz pequeno
    px('#f09a96', 7, 12, 2, 1);
    px('#f09a96', 16, 12, 2, 1);
    px(SKIN_S, 12, 12, 1, 1);
    // barba curta que contorna o rosto, bigode e sorrisinho
    px(HAIR, 7, 13, 1, 2);
    px(HAIR, 16, 13, 1, 2);
    px(HAIR, 8, 14, 8, 1);
    px(HAIR, 10, 13, 4, 1);
    px('#d8685f', 11, 14, 2, 1);
    px(HAIR, 9, 15, 6, 1);
    // orelhas com argola
    px(SKIN, 5, 11, 1, 2);
    px(SKIN, 18, 11, 1, 2);
    px('#101010', 5, 13, 1, 1);
    px('#101010', 18, 13, 1, 1);
  } else if (dir === 'up') {
    px(HOOD, 7, 16, 10, 9);
    px(HOOD_D, 14, 17, 3, 8);
    px(HOOD_L, 8, 17, 1, 7);
    px(HOOD, 5, 17, 2, 8);
    px(HOOD, 17, 17, 2, 8);
    px(HOOD_L, 5, 17, 1, 7);
    // capuz caído
    px(HOOD_L, 8, 15, 8, 3);
    px(HOOD, 9, 16, 6, 1);
    // cruz vermelha com asas cinza nas costas
    px(RED, 12, 18, 1, 6);
    px(RED, 10, 19, 5, 1);
    px('#8a8a9a', 8, 18, 2, 1);
    px('#8a8a9a', 15, 18, 2, 1);
    px('#8a8a9a', 8, 20, 1, 2);
    px('#8a8a9a', 16, 20, 1, 2);
    px(INK, 5, 25, 2, 2);
    px(SKIN, 17, 25, 2, 2);
    // nuca tatuada
    px(SKIN_S, 10, 14, 4, 2);
    px(INK, 11, 14, 1, 2);
    px(INK, 10, 15, 3, 1);
    // cabelo cobrindo a cabeça
    px(HAIR, 6, 4, 12, 11);
    px(HAIR, 7, 3, 4, 1);
    px(HAIR, 12, 3, 4, 1);
    px(HAIR, 8, 2, 3, 1);
    px(HAIR, 13, 2, 2, 1);
    px(HAIR, 5, 5, 1, 6);
    px(HAIR, 18, 5, 1, 6);
    px(HAIR_L, 8, 3, 2, 1);
    px(HAIR_L, 14, 4, 2, 1);
    px(HAIR_L, 10, 7, 3, 1);
    px(HAIR_M, 8, 10, 2, 1);
    px(HAIR_M, 14, 10, 2, 1);
    px('#6e4e3e', 8, 12, 3, 3);
    px('#6e4e3e', 13, 12, 3, 3);
    px(SKIN, 5, 11, 1, 2);
    px(SKIN, 18, 11, 1, 2);
    px('#101010', 5, 13, 1, 1);
    px('#101010', 18, 13, 1, 1);
  } else {
    // de lado, olhando para a direita
    px(HOOD, 8, 16, 8, 9);
    px(HOOD_D, 8, 17, 2, 8);
    px(HOOD_L, 14, 17, 1, 7);
    px(HOOD_L, 9, 16, 6, 1);
    px(RED, 8, 19, 1, 3);
    px('#7c7c8c', 8, 22, 1, 2);
    const sw = -step * 2;
    px(HOOD, 10 + sw, 17, 4, 8);
    px(HOOD_L, 10 + sw, 17, 1, 7);
    px(INK, 10 + sw, 25, 4, 2);
    px(SKIN_S, 11, 15, 3, 2);
    px(INK, 11, 16, 1, 1);
    px(INK, 13, 16, 1, 1);
    // rosto de perfil
    px(SKIN, 9, 7, 8, 8);
    px(SKIN, 17, 10, 1, 2);
    // cabelo
    px(HAIR, 7, 4, 11, 4);
    px(HAIR, 8, 3, 4, 1);
    px(HAIR, 13, 3, 4, 1);
    px(HAIR, 9, 2, 3, 1);
    px(HAIR, 7, 8, 3, 6);
    px(HAIR_L, 9, 3, 2, 1);
    px(HAIR_L, 14, 3, 2, 1);
    px(HAIR_L, 12, 5, 2, 1);
    px(HAIR_M, 8, 10, 1, 2);
    px(HAIR, 10, 8, 7, 1);
    px('#6e4e3e', 8, 12, 2, 2);
    // sobrancelha, olho grande, bochecha
    px(HAIR, 13, 9, 4, 1);
    if (blink) px('#1c1210', 14, 11, 2, 1);
    else {
      px('#1c1210', 14, 10, 2, 3);
      px('#ffffff', 14, 10, 1, 1);
    }
    px('#f09a96', 12, 12, 2, 1);
    // barba e sorrisinho
    px(HAIR, 10, 13, 6, 2);
    px(HAIR, 9, 12, 2, 3);
    px(HAIR, 11, 15, 4, 1);
    px('#d8685f', 16, 13, 1, 1);
    px(HAIR, 15, 12, 1, 1);
    // argola
    px(SKIN, 9, 11, 1, 2);
    px('#101010', 9, 13, 1, 1);
  }
  ctx.restore();
  return outlineSprite(c);
}

/** Matheus desacordado, deitado de lado como no Stardew (34x24, cabeça à esquerda): o mesmo sprite de pé, girado 90°. */
export function drawMatheusLying(open: boolean) {
  const front = drawMatheus('down', 0, !open);
  const { c, ctx } = makeCanvas(34, 24);
  ctx.translate(0, 24);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(front, 0, 0);
  return c;
}

/** Matheus sentado no chão, tonto, de frente (24x34, pés em 12,33): meio caminho entre deitado e em pé. */
export function drawMatheusSitting(blink = false) {
  const { c, ctx } = makeCanvas(28, 38);
  const body = drawMatheus('down', 3, blink);
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  // pernas finas e curtas à frente (como no Stardew), com tênis pequenos
  px(PANTS, 8, 24, 3, 3);
  px(PANTS, 16, 24, 3, 3);
  px(PANTS_L, 8, 24, 1, 3);
  px(PANTS_L, 16, 24, 1, 3);
  px(SHOE, 7, 26, 5, 3);
  px(SHOE, 15, 26, 5, 3);
  px(SOLE, 7, 28, 5, 1);
  px(SOLE, 15, 28, 5, 1);
  px(HAIR_L, 0, 0, 0, 0);
  const legs = outlineSprite(c);
  const out = makeCanvas(28, 38);
  // tronco por cima das coxas, 2 px mais baixo (o corpo afunda ao sentar)
  out.ctx.drawImage(legs, 0, 0);
  out.ctx.drawImage(body, 0, 0, 24, 24, 2, 1, 24, 24);
  return out.c;
}

export function drawChicken(frame: number) {
  const { c, ctx } = makeCanvas(16, 14);
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const hop = frame ? 1 : 0;
  px('#fbf6ea', 3, 5 - hop, 8, 6);
  px('#e6dcc6', 3, 9 - hop, 8, 2);
  px('#d4c8ae', 5, 10 - hop, 4, 1);
  px('#fbf6ea', 10, 2 - hop, 4, 4);
  px('#d4382c', 11, 1 - hop, 2, 1);
  px('#d4382c', 12, 4 - hop, 1, 2);
  px('#eaa42e', 14, 3 - hop, 2, 1);
  px('#111', 12, 3 - hop, 1, 1);
  px('#e6dcc6', 2, 6 - hop, 3, 4);
  px('#c8bc9e', 4, 7 - hop, 1, 2);
  px('#eaa42e', 6, 11, 1, 2 - (frame ? 1 : 0));
  px('#eaa42e', 9, 11, 1, 2 - (frame ? 0 : 1));
  return outlineSprite(c);
}

/** Galho retorcido que invade a tela por um canto, com folhas de outono (profundidade e aconchego). */
export function buildOverhang(rng: Rng, w: number, h: number, leafCols: string[]) {
  const { c, ctx } = makeCanvas(w, h);
  const bark = ['#24121a', '#442620', '#6a4230', '#92603c'];
  const tips: { x: number; y: number }[] = [];
  const limb = (x0: number, y0: number, ang: number, len: number, th0: number, depth: number) => {
    let x = x0;
    let y = y0;
    let a = ang;
    for (let i = 0; i < len; i++) {
      const th = Math.max(1, Math.round(th0 * (1 - i / len)) + 1);
      for (let d = 0; d < th; d++) {
        ctx.fillStyle = d === 0 ? bark[3] : d === th - 1 ? bark[0] : d < th / 2 ? bark[2] : bark[1];
        ctx.fillRect(Math.round(x), Math.round(y) + d - (th >> 1), 1, 1);
      }
      a += (rng() - 0.5) * 0.14;
      if (y > h - 12) a -= 0.08;
      if (x > w - 14) break;
      x += Math.cos(a);
      y += Math.sin(a);
      if (depth < 3 && i % 12 === 8 && th > 2 && rng() < 0.85) limb(x, y, a + (rng() < 0.5 ? -0.85 : 0.85), Math.floor(len * 0.5), th * 0.6, depth + 1);
      if (i % 9 === 4 && rng() < 0.6) tips.push({ x, y });
    }
    tips.push({ x, y });
  };
  limb(-4, 11, 0.3, w * 0.85, 6, 0);
  limb(-4, h * 0.42, 0.7, w * 0.45, 4, 1);
  for (const t of tips) {
    const n = 6 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const x = Math.max(0, Math.min(w - 4, Math.round(t.x + (rng() - 0.5) * 12)));
      const y = Math.max(1, Math.min(h - 5, Math.round(t.y + (rng() - 0.3) * 8)));
      ctx.fillStyle = '#3a1c14';
      ctx.fillRect(x, y + 2, 3, 1);
      ctx.fillStyle = leafCols[Math.floor(rng() * leafCols.length)];
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return outlineSprite(c, [0x18, 0x0c, 0x10]);
}

