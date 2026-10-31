/**
 * Teste de estilo (forest2d.html): a Floresta em pixel art 2D vista de cima, no espírito de Stardew Valley / Omori.
 * Tudo é desenhado em código: chão, árvores sombreadas, flores, o Matheus, a galinha, e um sistema de luzes
 * (luz ambiente por hora do dia, tocha, fogueira, lanternas, cogumelos, vagalumes, raios de sol e brilho).
 *
 * Parâmetros: ?hora=amanhecer|dia|entardecer|noite · ?ciclo (o dia passa sozinho) · ?estacao=outono · ?em=x,y
 */

/** Tamanho (em pixels do jogo) da imagem; muda com a janela: pixels grandes, uns 200 de altura. */
let VIEW_W = 360;
let VIEW_H = 202;
const WORLD_W = 1800;
const WORLD_H = 1200;
const params = new URLSearchParams(location.search);
const AUTUMN = params.get('estacao') !== 'verao';

type Rng = () => number;
function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// ---------------------------------------------------------------- paletas

const PAL = AUTUMN
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

const TRUNK = ['#46281c', '#6a3e26', '#8c5a38', '#a87348'];
const ROCK = ['#4e5662', '#707a88', '#98a2b0', '#c4ccd6'];
const BUSH = AUTUMN ? ['#4a5a22', '#6a7c2e', '#8c9c3c', '#b4c456'] : ['#2a6a36', '#3a8a42', '#5cac52', '#8cd070'];
const WATER = ['#2a6484', '#3a82a0', '#5aa6bc', '#b0e0e8'];
const MUD = AUTUMN ? '#765234' : '#a47c52';
const COBBLE = AUTUMN ? '#80603e' : '#8a6a40';
const CLIFF = ['#34304c', '#524e6c', '#78748f', '#a4a0b8'];
const CLEAR = ['#5f4650', '#6e5460', '#816570', '#46343e'];
const OUTLINE = '#2a1a14';

// ---------------------------------------------------------------- terreno

/** Elipse preenchida em pixels (sem serrilhado suavizado). */
function discPx(v: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const r = Math.round(ry);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / Math.max(1, ry)) ** 2)));
    v.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2, 1);
  }
}
/** Anel de elipse em pixels, com `th` de espessura. */
function ringPx(v: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, th: number) {
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

function pathY(x: number) {
  return 620 + 140 * Math.sin(x / 290) + 60 * Math.sin(x / 110 + 1.3);
}
function pathHalf(x: number) {
  return 24 + 7 * Math.sin(x / 150 + 0.7);
}
const POND = { x: 1300, y: 1010, rx: 380, ry: 130 };
function inPond(x: number, y: number, grow = 0) {
  // contorno irregular, com enseadas e pontas
  const w = 14 * Math.sin(x / 41) + 9 * Math.sin(x / 17 + y / 29);
  const dx = (x - POND.x) / (POND.rx + grow + w);
  const dy = (y - POND.y) / (POND.ry + grow + w * 0.45);
  return dx * dx + dy * dy < 1;
}
const CAMP = { x: 330, y: 0 };
CAMP.y = pathY(CAMP.x) - 70;
/** Círculo de pedras no fim da trilha: o portal para a Vila. */
const PORTAL = { x: 1680, y: 0 };
/** Paredão de pedras ao norte, com uma cachoeirinha, e a clareira de terra em volta da fogueira. */
const WALL = { x0: 560, x1: 1190, y: 66, fallX: 880 };
function inClearing(x: number, y: number) {
  const dx = (x - CAMP.x) / 150;
  const dy = (y - CAMP.y) / 92;
  const a = Math.atan2(dy, dx);
  return dx * dx + dy * dy < 0.8 + 0.22 * Math.sin(a * 5 + 1) + 0.12 * Math.sin(a * 9);
}
function inWallZone(x: number, y: number, m = 0) {
  return x > WALL.x0 - 70 - m && x < WALL.x1 + 70 + m && y < 170 + m;
}
PORTAL.y = pathY(PORTAL.x);
/** Píer de madeira que entra na lagoa. */
const PIER = { x: POND.x, y0: POND.y - POND.ry - 20, y1: POND.y - 34, hw: 11 };
function onPier(x: number, y: number, m = 0) {
  return Math.abs(x - PIER.x) < PIER.hw + m && y > PIER.y0 - m && y < PIER.y1 + m;
}

function buildGround(rng: Rng, glow: { x: number; y: number }[]) {
  const { c, ctx } = makeCanvas(WORLD_W, WORLD_H);
  const fill = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const isPath = (x: number, y: number) => Math.abs(y - pathY(x) + Math.sin(x / 9) * 2) < pathHalf(x) + (hash(Math.floor(x / 3), Math.floor(y / 3)) - 0.5) * 6;

  // gramado em tons chapados (poucas cores, manchas grandes); trilha com poças de lama escura e contorno marcado
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const big = Math.sin(x / 83 + Math.sin(y / 61) * 1.6) * Math.sin(y / 71 + Math.cos(x / 97) * 1.2);
      const n = hash(x >> 1, y >> 1);
      let col = PAL.grass[1];
      if (big > 0.32) col = PAL.grass[2];
      else if (big < -0.38) col = PAL.grass[3];
      else if (n > 0.985) col = PAL.grass[2];
      if (inClearing(x, y)) {
        const patch = Math.sin(x / 13 + Math.sin(y / 9) * 2) * Math.sin(y / 11 + x / 23);
        col = patch > 0.45 ? CLEAR[0] : patch < -0.5 ? CLEAR[2] : CLEAR[1];
        if (!inClearing(x, y + 2)) col = CLEAR[3];
      }
      if (isPath(x, y)) {
        const mud = Math.sin(x / 17 + Math.sin(y / 7) * 2.2) * Math.sin(y / 9 + Math.cos(x / 29) * 1.5);
        col = mud > 0.34 ? MUD : n > 0.965 ? PAL.path[2] : PAL.path[0];
        const crow = Math.floor(y / 7);
        const coff = (crow % 2) * 4 + Math.floor(hash(crow, 3) * 3);
        if ((y % 7 === 0 || (x + coff) % 9 === 0) && hash(x >> 2, y >> 2) < 0.5) col = COBBLE; // junta entre as pedras do calçamento
        if (!isPath(x, y - 1)) col = PAL.pathEdge; // contorno de cima
        else if (!isPath(x, y + 2)) col = PAL.pathEdge; // beiral de baixo dá volume à trilha
      }
      const wv = Math.sin(x / 19 + Math.sin(y / 8) * 2) * Math.sin(y / 6 + x / 33);
      if (inPond(x, y, 9) && !inPond(x, y, 6)) col = '#3a7a30'; // franja de grama escura na beira
      if (inPond(x, y, 6)) col = !inPond(x, y, 3) ? '#5e3a2a' : '#8a5c3c'; // barranco de terra
      if (inPond(x, y)) col = wv > 0.4 ? WATER[2] : WATER[1];
      if (inPond(x, y, -9)) col = wv > 0.5 ? WATER[1] : WATER[0];
      if (inPond(x, y, -34)) col = wv > 0.6 ? WATER[1] : WATER[0];
      if (inPond(x, y) && !inPond(x, y, -2) && hash(x >> 1, y) < 0.8) col = '#e6fbfb'; // espuma na margem
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // luz refletida e ondas na água (WATER[3] é a cor clara)
  for (let i = 0; i < 380; i++) {
    const x = POND.x + (rng() - 0.5) * POND.rx * 2;
    const y = POND.y + (rng() - 0.5) * POND.ry * 2;
    if (inPond(x, y, -14)) fill(rng() < 0.6 ? WATER[2] : WATER[3], x, y, 3 + Math.floor(rng() * 6), 1);
  }
  // vitórias-régias com flor
  for (let i = 0; i < 30; i++) {
    const x = POND.x + (rng() - 0.5) * POND.rx * 1.7;
    const y = POND.y + (rng() - 0.5) * POND.ry * 1.6;
    if (!inPond(x, y, -22) || onPier(x, y, 14)) continue;
    ctx.fillStyle = WATER[3];
    discPx(ctx, x, y + 1, 8, 4);
    ctx.fillStyle = '#245a34';
    discPx(ctx, x, y + 1, 6, 3);
    ctx.fillStyle = '#58a04a';
    discPx(ctx, x, y, 6, 3);
    fill('#7cc062', x - 3, y - 1, 3, 1);
    fill(WATER[1], x + 1, y, 5, 1);
    if (rng() < 0.55) {
      fill('#ffb0cc', x - 1, y - 2, 3, 2);
      fill('#fff0f4', x, y - 2, 1, 1);
    }
  }
  // píer de madeira
  for (let y = PIER.y0; y <= PIER.y1; y++) {
    for (let x = PIER.x - PIER.hw; x <= PIER.x + PIER.hw; x++) {
      const edge = x === PIER.x - PIER.hw || x === PIER.x + PIER.hw;
      let col = Math.floor((y - PIER.y0) / 3) % 2 === 0 ? '#b07c4c' : '#9a6a40';
      if ((y - PIER.y0) % 3 === 2) col = '#6a4026';
      if (edge) col = '#46281c';
      if (x === PIER.x - PIER.hw + 1 && (y - PIER.y0) % 3 !== 2) col = '#c89460';
      fill(col, x, y);
    }
  }
  for (let y = PIER.y0 + 4; y <= PIER.y1; y += 26) {
    for (const sx of [PIER.x - PIER.hw - 2, PIER.x + PIER.hw]) {
      fill('#46281c', sx, y - 2, 4, 6);
      fill('#8c5a38', sx + 1, y - 2, 2, 4);
    }
  }
  fill('#46281c', PIER.x - PIER.hw, PIER.y1 + 1, PIER.hw * 2 + 1, 2);
  for (let i = 0; i < 18; i++) {
    const mx = PIER.x - PIER.hw + 2 + Math.floor(rng() * (PIER.hw * 2 - 3));
    const my = PIER.y0 + 2 + Math.floor(rng() * (PIER.y1 - PIER.y0 - 4));
    fill('#5f9a3a', mx, my, 2 + Math.floor(rng() * 3), 1);
    fill('#86c05a', mx, my - 1, 1, 1);
  }
  for (let y = PIER.y0 + 4; y <= PIER.y1; y += 26) {
    for (const sx of [PIER.x - PIER.hw - 2, PIER.x + PIER.hw]) fill('#e6fbfb', sx - 1, y + 4, 6, 1);
  }
  // cachoeirinha saindo do paredão, com poça e espuma
  for (let y = WALL.y - 14; y < 150; y++) {
    for (let x = WALL.fallX - 22; x <= WALL.fallX + 22; x++) {
      const inFall = Math.abs(x - WALL.fallX) < 8 && y > WALL.y - 4;
      let col = '';
      if (Math.abs(x - WALL.fallX) < 22 && y < WALL.y + 36) col = CLIFF[x % 3 === 0 ? 0 : 1];
      if (inFall) col = (x * 3 + y) % 7 < 2 ? '#e6fbfb' : hash(x, y) < 0.5 ? WATER[2] : WATER[3];
      if (col) fill(col, x, y);
    }
  }
  ctx.fillStyle = WATER[1];
  discPx(ctx, WALL.fallX, 156, 30, 9);
  ctx.fillStyle = WATER[2];
  discPx(ctx, WALL.fallX, 155, 22, 6);
  ctx.fillStyle = '#e6fbfb';
  ringPx(ctx, WALL.fallX, 156, 30, 9, 1);
  ringPx(ctx, WALL.fallX, 155, 14, 4, 1);
  // tufos escuros contornando a clareira
  for (let i = 0; i < 1500; i++) {
    const x = Math.floor(CAMP.x - 170 + rng() * 340);
    const y = Math.floor(CAMP.y - 110 + rng() * 220);
    if (!inClearing(x, y) || (inClearing(x + 6, y) && inClearing(x - 6, y) && inClearing(x, y + 6) && inClearing(x, y - 6))) continue;
    fill('#26562c', x - 2, y, 1, 1);
    fill('#26562c', x + 2, y, 1, 1);
    fill('#3f8a40', x - 1, y - 1, 1, 2);
    fill('#3f8a40', x + 1, y - 1, 1, 2);
    fill('#5cb04c', x, y - 2, 1, 2);
  }
  // flores azuis que brilham (ficam em volta das pedras, da clareira e da lagoa)
  for (const f of glow) {
    fill('#2a7a5a', f.x, f.y + 1, 1, 1);
    fill('#6ae0ff', f.x, f.y - 1, 1, 1);
    fill('#6ae0ff', f.x - 1, f.y, 1, 1);
    fill('#6ae0ff', f.x + 1, f.y, 1, 1);
    fill('#ffffff', f.x, f.y, 1, 1);
  }
  // pedrinhas e marcas na trilha
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rng() * WORLD_W);
    const y = pathY(x) + (rng() - 0.5) * pathHalf(x) * 1.6;
    if (!isPath(x, Math.round(y))) continue;
    fill('#e8d0a0', x, y, 2, 1);
    fill(PAL.pathEdge, x, y + 1, 2, 1);
  }
  for (let x = 20; x < WORLD_W; x += 9) {
    if (rng() < 0.5) fill(PAL.path[1], x, pathY(x) + (rng() - 0.5) * 16, 4, 1);
  }
  // tufos de grama desenhados como marcas "^^" escuras, como nas referências
  for (let i = 0; i < 3000; i++) {
    const x = Math.floor(rng() * WORLD_W);
    const y = Math.floor(rng() * WORLD_H);
    if (isPath(x, y) || isPath(x, y + 4) || inPond(x, y, 10) || inClearing(x, y)) continue;
    const col = rng() < 0.82 ? PAL.bladeDark : PAL.bladeLight;
    fill(col, x, y, 1, 1);
    fill(col, x + 1, y - 1, 1, 1);
    fill(col, x + 2, y, 1, 1);
    if (rng() < 0.65) {
      fill(col, x + 4, y, 1, 1);
      fill(col, x + 5, y - 1, 1, 1);
      fill(col, x + 6, y, 1, 1);
    }
  }
  // grama que invade a beirada da trilha
  for (let x = 0; x < WORLD_W; x += 2) {
    for (const side of [-1, 1]) {
      if (rng() < 0.55) continue;
      const y = Math.round(pathY(x) + side * (pathHalf(x) + 1));
      if (isPath(x, y) || inPond(x, y)) continue;
      fill(PAL.bladeDark, x, y - 1, 1, 2);
      fill(PAL.bladeLight, x + 1, y - 2, 1, 2);
    }
  }
  // flores
  const FLOWERS = ['#ffffff', '#ffe36a', '#ff9ec0', '#9ec8ff', '#ff8a6a'];
  for (let i = 0; i < 110; i++) {
    const cx = rng() * WORLD_W;
    const cy = rng() * WORLD_H;
    if (isPath(cx, cy) || inPond(cx, cy, 14)) continue;
    const col = FLOWERS[Math.floor(rng() * FLOWERS.length)];
    const n = 2 + Math.floor(rng() * 5);
    for (let j = 0; j < n; j++) {
      const x = Math.round(cx + (rng() - 0.5) * 18);
      const y = Math.round(cy + (rng() - 0.5) * 10);
      if (isPath(x, y) || inPond(x, y, 6)) continue;
      fill(PAL.bladeDark, x, y + 1, 1, 1);
      fill(col, x, y - 1, 1, 1);
      fill(col, x - 1, y, 1, 1);
      fill(col, x + 1, y, 1, 1);
      fill('#f0a020', x, y, 1, 1);
    }
  }
  // folhas caídas
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rng() * WORLD_W);
    const y = Math.floor(rng() * WORLD_H);
    if (inPond(x, y, 6)) continue;
    fill(PAL.leaves[Math.floor(rng() * PAL.leaves.length)], x, y, 2, 1);
  }
  return c;
}

// ---------------------------------------------------------------- sombreamento de formas

interface Ball {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * Desenha um aglomerado de bolas com luz vinda de cima à esquerda: cada pixel pega a bola mais alta ali,
 * o brilho vira um de 4 tons (com um tiquinho de ruído) e a beirada ganha contorno escuro.
 */
function shadedBalls(w: number, h: number, balls: Ball[], ramp: string[], outline: string, rng: Rng, tex = 0.14) {
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

/** Pinheiro alto e fino: tronco aparecendo entre ramos longos que caem, mais curtos no topo e compridos embaixo. */
function buildPineCanopy(w: number, h: number, scheme: { ramp: string[]; outline: string }, rng: Rng) {
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
    const tw = y > h * 0.55 ? 4 : 3;
    for (let i = 0; i < tw; i++) put(cx - 1 + i, y, i === 0 ? TRUNK[2] : i === tw - 1 ? TRUNK[0] : TRUNK[1]);
  }
  // ponta do topo
  for (let i = 0; i < 12; i++) {
    const half = i > 4 ? Math.floor((i - 4) / 3) : 0;
    for (let dx = -half; dx <= half; dx++) put(cx + dx, 2 + i, dx < 0 ? scheme.ramp[3] : dx > 0 ? scheme.ramp[1] : scheme.ramp[2]);
  }
  // ramos que caem, com a luz vindo de cima e da esquerda
  const maxY = h - 14;
  let y = 14;
  while (y < maxY) {
    const t = (y - 8) / (maxY - 8);
    const L = Math.min(w / 2 - 2, Math.round(4 + t * (w / 2 - 7) * (0.78 + rng() * 0.4)));
    for (const side of [-1, 1]) {
      const Ls = L - Math.floor(rng() * 4);
      for (let dx = 1; dx <= Ls; dx++) {
        const droop = Math.floor((dx * dx) / (Ls * 4.2));
        const yy = y + droop + Math.floor(dx * 0.1);
        const thick = dx < Ls * 0.35 ? 4 : dx < Ls * 0.7 ? 3 : 2;
        for (let d = 0; d < thick; d++) {
          const lit = (d === 0 ? 0.55 : d === thick - 1 ? -0.5 : 0) + (side < 0 ? 0.25 : -0.25) + (rng() - 0.5) * 0.5;
          put(cx + side * dx, yy + d, scheme.ramp[lit > 0.45 ? 3 : lit > 0 ? 2 : lit > -0.45 ? 1 : 0]);
        }
        if (dx > Ls * 0.6 && rng() < 0.45) put(cx + side * dx, yy + thick, scheme.ramp[0]);
      }
    }
    y += 5 + Math.floor(rng() * 3);
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

interface TreeSprite {
  trunk: HTMLCanvasElement;
  canopy: HTMLCanvasElement;
  footX: number;
  footY: number;
  canopyX: number;
  canopyY: number;
  big: boolean;
  pine: boolean;
}

function buildTree(rng: Rng, scheme: { ramp: string[]; outline: string }, big: boolean, kind: 'round' | 'pine' = 'round'): TreeSprite {
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

function buildRock(rng: Rng, w: number) {
  const h = Math.round(w * 0.66);
  return shadedBalls(w + 2, h + 2, [{ x: w / 2 + 1, y: h * 0.58 + 1, rx: w / 2, ry: h * 0.56 }], ROCK, OUTLINE, rng, 0.08).c;
}
function buildBush(rng: Rng, w: number, berries: string | null) {
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

function buildMushroom(glow: boolean) {
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

function buildBoulder(rng: Rng, w: number) {
  const h = Math.round(w * 0.82);
  const { c, ctx } = shadedBalls(
    w + 2,
    h + 2,
    [
      { x: w * 0.3, y: h * 0.62, rx: w * 0.3, ry: h * 0.4 },
      { x: w * 0.68, y: h * 0.6, rx: w * 0.32, ry: h * 0.42 },
      { x: w * 0.5, y: h * 0.4, rx: w * 0.36, ry: h * 0.4 },
    ],
    CLIFF,
    '#1e1a30',
    rng,
    0.22,
  );
  // rachaduras e musgo
  ctx.fillStyle = '#26223c';
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(w * (0.2 + rng() * 0.6));
    const y = Math.floor(h * (0.35 + rng() * 0.4));
    ctx.fillRect(x, y, 1, 3 + Math.floor(rng() * 4));
    ctx.fillRect(x + 1, y + 2, 2, 1);
  }
  for (let i = 0; i < Math.round(w / 3); i++) {
    const x = Math.floor(3 + rng() * (w - 6));
    const y = Math.floor(2 + rng() * h * 0.5);
    if (ctx.getImageData(x, y, 1, 1).data[3] === 0) continue;
    ctx.fillStyle = rng() < 0.5 ? '#5f9a3a' : '#86c05a';
    ctx.fillRect(x, y, 3, 1);
    if (rng() < 0.5) ctx.fillRect(x + 1, y + 1, 2, 1);
  }
  return c;
}

function buildStone(rng: Rng, tall: number) {
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

function buildFern(rng: Rng) {
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

function buildStump(rng: Rng) {
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

type Dir = 'down' | 'up' | 'side';

function outlineSprite(src: HTMLCanvasElement, color = [0x2a, 0x1a, 0x14]) {
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

const SKIN = '#f0bc92';
const SKIN_S = '#d49872';
const HAIR = '#3a2316';
const HAIR_M = '#4e2f1c';
const HAIR_L = '#6a4428';
const HOOD = '#22222b';
const HOOD_L = '#3a3a48';
const HOOD_D = '#14141a';
const PANTS = '#2e2e36';
const PANTS_L = '#434350';
const INK = '#5a7488';
const RED = '#d0443a';
const SHOE = '#1b1b22';
const SOLE = '#6c6c7c';

/** Matheus em 24x34 (pés em 12,33): cabeção fofo, cabelo cacheado, barba curta, tatuagens, moletom preto e tênis branco. */
function drawMatheus(dir: Dir, frame: number, blink = false) {
  const { c, ctx } = makeCanvas(24, 34);
  const px = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = frame === 3 ? 1 : 0; // só a respiração sobe o tronco; o pulo é feito no desenho
  const air = frame === 4;

  // pernas e tênis
  if (dir === 'side') {
    px(PANTS, 9, 25, 7, 4);
    px(PANTS_L, 10, 26, 2, 2);
    // contato: passo aberto; no ar: pernas recolhidas
    const lift = air ? -2 : 0;
    const fa = air ? 10 : step !== 0 ? 6 : 9;
    const fb = air ? 12 : step !== 0 ? 16 : 13;
    px(PANTS, fa + 1, 28 + lift, 3, 2);
    px(PANTS, fb - 1, 28 + lift, 3, 2);
    px(SHOE, fa, 29 + lift, 6, 3);
    px(SOLE, fa, 31 + lift, 6, 1);
    px(SHOE, fb - 2, 29 + lift, 6, 3);
    px(SOLE, fb - 2, 31 + lift, 6, 1);
  } else {
    px(PANTS, 8, 25, 8, 4);
    px(PANTS_L, 8, 26, 1, 3);
    px(PANTS_L, 15, 26, 1, 3);
    px(HOOD_D, 11, 27, 2, 2);
    const lf = air ? -2 : step === 1 ? -2 : 0;
    const rf = air ? -2 : step === -1 ? -2 : 0;
    px(PANTS, 8, 28 + lf, 3, 1);
    px(PANTS, 13, 28 + rf, 3, 1);
    px(SHOE, 7, 29 + lf, 5, 3);
    px(SOLE, 7, 31 + lf, 5, 1);
    px(SHOE, 12, 29 + rf, 5, 3);
    px(SOLE, 12, 31 + rf, 5, 1);
  }

  ctx.save();
  ctx.translate(0, -bob);
  if (dir === 'down') {
    // moletom reto, até o quadril, com capuz caído atrás do pescoço
    px(HOOD, 7, 16, 10, 9);
    px(HOOD_D, 14, 17, 3, 8);
    px(HOOD_L, 8, 17, 1, 7);
    px(HOOD_L, 8, 16, 8, 1);
    const aL = air ? -2 : -step * 2;
    const aR = air ? -2 : step * 2;
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
    const sw = air ? 0 : step * 2;
    px(HOOD, 10 + sw, 17 + (air ? -2 : 0), 4, 8);
    px(HOOD_L, 10 + sw, 17 + (air ? -2 : 0), 1, 7);
    px(INK, 10 + sw, 25 + (air ? -2 : 0), 4, 2);
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

function drawChicken(frame: number) {
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
function buildOverhang(rng: Rng, w: number, h: number, leafCols: string[]) {
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
      x += Math.cos(a);
      y += Math.sin(a);
      if (depth < 3 && i % 12 === 8 && th > 2 && rng() < 0.85) limb(x, y, a + (rng() < 0.5 ? -0.85 : 0.85), Math.floor(len * 0.5), th * 0.6, depth + 1);
      if (i % 9 === 4 && rng() < 0.6) tips.push({ x, y });
    }
    tips.push({ x, y });
  };
  limb(-4, 5, 0.3, w * 0.95, 6, 0);
  limb(-4, h * 0.42, 0.7, w * 0.5, 4, 1);
  for (const t of tips) {
    const n = 6 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const x = Math.round(t.x + (rng() - 0.5) * 12);
      const y = Math.round(t.y + (rng() - 0.3) * 8);
      ctx.fillStyle = '#3a1c14';
      ctx.fillRect(x, y + 2, 3, 1);
      ctx.fillStyle = leafCols[Math.floor(rng() * leafCols.length)];
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return outlineSprite(c, [0x18, 0x0c, 0x10]);
}

// ---------------------------------------------------------------- jogo

interface Solid {
  x: number;
  y: number;
  r: number;
}
interface Prop {
  kind: 'tree' | 'rock' | 'bush' | 'mushroom' | 'stump' | 'grass' | 'lantern' | 'camp' | 'reed' | 'stone' | 'sign' | 'fern';
  x: number;
  y: number;
  tree?: TreeSprite;
  img?: HTMLCanvasElement;
  phase?: number;
  glow?: boolean;
}

interface Stage {
  name: string;
  amb: RGB;
  dark: number;
  shaft: number;
  shaftCol: RGB;
  grade: RGB;
  gradeA: number;
  mist: number;
}
const STAGES: Record<string, Stage> = {
  amanhecer: { name: 'Amanhecer', amb: [255, 218, 182], dark: 0.2, shaft: 1, shaftCol: [255, 210, 150], grade: [255, 176, 120], gradeA: 0.1, mist: 0.8 },
  dia: { name: 'Dia', amb: [255, 246, 224], dark: 0, shaft: 0.95, shaftCol: [255, 238, 188], grade: [255, 214, 150], gradeA: 0.06, mist: 0.1 },
  entardecer: { name: 'Entardecer', amb: [255, 218, 178], dark: 0.4, shaft: 0.9, shaftCol: [255, 200, 130], grade: [255, 170, 100], gradeA: 0.06, mist: 0.2 },
  noite: { name: 'Noite', amb: [104, 112, 182], dark: 0.9, shaft: 0.4, shaftCol: [170, 190, 255], grade: [70, 70, 170], gradeA: 0.14, mist: 0.45 },
};
const ORDER = ['amanhecer', 'dia', 'entardecer', 'noite'];

interface Light {
  x: number;
  y: number;
  r: number;
  col: RGB;
  a: number;
  night?: boolean;
}

export function start() {
  const screen = document.getElementById('screen') as HTMLCanvasElement;
  const sctx = screen.getContext('2d')!;
  const view = makeCanvas(VIEW_W, VIEW_H);
  const light = makeCanvas(10, 10);
  const bloom = makeCanvas(10, 10);
  const rng = mulberry32(AUTUMN ? 20261022 : 31415);

  // flores azuis brilhantes em grupinhos: perto do paredão, da clareira e espalhadas
  const glowFlowers: { x: number; y: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const near = rng();
    const cx = near < 0.4 ? WALL.x0 + rng() * (WALL.x1 - WALL.x0) : near < 0.6 ? CAMP.x + (rng() - 0.5) * 300 : rng() * WORLD_W;
    const cy = near < 0.4 ? WALL.y + 100 + rng() * 80 : near < 0.6 ? CAMP.y + (rng() - 0.5) * 160 : rng() * WORLD_H;
    const n = 4 + Math.floor(rng() * 6);
    for (let j = 0; j < n; j++) {
      const x = Math.round(cx + (rng() - 0.5) * 26);
      const y = Math.round(cy + (rng() - 0.5) * 14);
      if (inPond(x, y, 12) || Math.abs(y - pathY(x)) < pathHalf(x) + 2 || x < 4 || y < 4 || x > WORLD_W - 4 || y > WORLD_H - 4) continue;
      glowFlowers.push({ x, y });
    }
  }
  const ground = buildGround(rng, glowFlowers);
  const pineSchemes = AUTUMN
    ? [
        { ramp: ['#102818', '#1a4024', '#2e5e32', '#6a9040'], outline: '#0a1a10' },
        { ramp: ['#1a301a', '#2a4a24', '#46682c', '#98a840'], outline: '#102010' },
      ]
    : [
        { ramp: ['#14402e', '#1e5c3c', '#2e7e4c', '#58a868'], outline: '#0e2e20' },
        { ramp: ['#1c4a3a', '#2a6a50', '#3c8a66', '#68b488'], outline: '#12362a' },
        { ramp: ['#1f5a52', '#2f7a6a', '#4aa088', '#7cc8aa'], outline: '#123a36' }, // azul-esverdeado
        { ramp: ['#4a2418', '#7a3c20', '#a8602c', '#d89a50'], outline: '#2e1610' }, // pinheiro marrom, como nas referências
      ];
  const trees = [
    ...PAL.trees.flatMap((s) => [buildTree(rng, s, true), buildTree(rng, s, false), buildTree(rng, s, true)]),
    ...pineSchemes.flatMap((s) => [buildTree(rng, s, true, 'pine'), buildTree(rng, s, false, 'pine'), buildTree(rng, s, true, 'pine'), buildTree(rng, s, true, 'pine'), buildTree(rng, s, false, 'pine'), buildTree(rng, s, true, 'pine')]),
  ];
  const stones = [buildStone(rng, 28), buildStone(rng, 22)];
  const boulders = [buildBoulder(rng, 64), buildBoulder(rng, 84), buildBoulder(rng, 52), buildBoulder(rng, 72)];
  const rocks = [8, 12, 18, 26].map((w) => buildRock(rng, w));
  const bushes = [buildBush(rng, 22, null), buildBush(rng, 30, '#e0405a'), buildBush(rng, 18, null), buildBush(rng, 26, '#f0d850')];
  const mushRed = buildMushroom(false);
  const mushGlow = buildMushroom(true);
  const stump = buildStump(rng);
  const ferns = [buildFern(rng), buildFern(rng), buildFern(rng)];

  // sombra de folhas em movimento sobre o chão
  const dapple = makeCanvas(192, 192);
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 192; x++) {
      const tau = Math.PI * 2 / 192;
      const n = Math.sin(x * tau * 5 + Math.sin(y * tau * 4) * 2) * Math.sin(y * tau * 6 + Math.cos(x * tau * 3) * 2) + (rng() - 0.5) * 0.5;
      if (n > 0.38) {
        dapple.ctx.fillStyle = 'rgb(150,170,140)';
        dapple.ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const dapplePattern = view.ctx.createPattern(dapple.c, 'repeat')!;
  // manchas de sol que passam entre as folhas (o contrário das sombras acima)
  const sunSpots = makeCanvas(192, 192);
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 192; x++) {
      const tau = (Math.PI * 2) / 192;
      const n = Math.sin(x * tau * 4 + Math.sin(y * tau * 5) * 2 + 1) * Math.sin(y * tau * 5 + Math.cos(x * tau * 3) * 2 + 2);
      if (n < -0.52) {
        sunSpots.ctx.fillStyle = 'rgb(255,236,170)';
        sunSpots.ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const sunPattern = view.ctx.createPattern(sunSpots.c, 'repeat')!;
  // silhuetas escuras de folhagem perto da câmera, nas bordas da tela (profundidade)
  const fgTile = makeCanvas(512, 320);
  fgTile.ctx.filter = 'blur(9px)';
  fgTile.ctx.fillStyle = '#0a1810';
  for (let i = 0; i < 24; i++) {
    const bx = rng() * 512;
    const by = rng() * 320;
    const br = 22 + rng() * 38;
    for (const ox of [-512, 0, 512]) {
      for (const oy of [-320, 0, 320]) {
        fgTile.ctx.beginPath();
        fgTile.ctx.ellipse(bx + ox, by + oy, br * 1.3, br, 0, 0, Math.PI * 2);
        fgTile.ctx.fill();
      }
    }
  }
  fgTile.ctx.filter = 'none';
  const leafCols = PAL.trees.flatMap((t) => [t.ramp[2], t.ramp[3], t.ramp[1]]);
  const overL = buildOverhang(rng, 104, 56, leafCols);
  const overR = buildOverhang(rng, 84, 50, leafCols);
  const fgTmp = makeCanvas(10, 10);
  const fgPattern = fgTmp.ctx.createPattern(fgTile.c, 'repeat')!;

  const props: Prop[] = [];
  const solids: Solid[] = [];
  const offPath = (x: number, y: number, m: number) => Math.abs(y - pathY(x)) > pathHalf(x) + m;
  const far = (kind: Prop['kind'], x: number, y: number, d: number) => !props.some((p) => p.kind === kind && Math.hypot(p.x - x, p.y - y) < d);
  const nearCamp = (x: number, y: number, d: number) => Math.hypot(x - CAMP.x, y - CAMP.y) < d || Math.hypot(x - PORTAL.x, y - PORTAL.y) < d + 50;

  let tries = 0;
  const treeCount = () => props.filter((p) => p.kind === 'tree').length;
  while (treeCount() < 70 && tries++ < 8000) {
    const x = 36 + rng() * (WORLD_W - 72);
    const y = rng() < 0.5 ? 50 + rng() * 300 : 50 + rng() * (WORLD_H - 100);
    if (!offPath(x, y, 44) || inPond(x, y, 44) || nearCamp(x, y, 90) || inWallZone(x, y) || inClearing(x, y) || !far('tree', x, y, 64)) continue;
    props.push({ kind: 'tree', x, y, tree: trees[Math.floor(rng() * trees.length)] });
    solids.push({ x, y, r: 8 });
  }
  // faixa de árvores nas bordas: o mundo parece cercado de mata
  const ringTree = (x: number, y: number) => {
    if (!offPath(x, y, 36) || inPond(x, y, 30) || nearCamp(x, y, 50) || inWallZone(x, y, -40)) return;
    props.push({ kind: 'tree', x, y, tree: trees[Math.floor(rng() * trees.length)] });
    solids.push({ x, y, r: 8 });
  };
  for (let x = 24; x < WORLD_W; x += 46 + rng() * 22) {
    ringTree(x, 22 + rng() * 26);
    ringTree(x, WORLD_H - 12 - rng() * 22);
  }
  for (let y = 80; y < WORLD_H - 40; y += 50 + rng() * 22) {
    ringTree(14 + rng() * 22, y);
    ringTree(WORLD_W - 14 - rng() * 22, y);
  }
  // paredão de pedras ao norte (com uma abertura para a cachoeirinha) e trepadeiras em cima
  for (const row of [0, 1]) {
    for (let x = WALL.x0 + (row ? 30 : 0); x < WALL.x1; x += 62 + rng() * 14) {
      if (Math.abs(x - WALL.fallX) < 40) continue;
      const img = boulders[Math.floor(rng() * boulders.length)];
      const y = WALL.y + row * 44 + rng() * 10 + img.height * 0.5;
      props.push({ kind: 'rock', x, y, img });
      solids.push({ x, y: y - 8, r: img.width * 0.38 });
    }
  }
  for (let x = WALL.x0 - 20; x < WALL.x1 + 20; x += 38 + rng() * 20) {
    if (Math.abs(x - WALL.fallX) < 30) continue;
    props.push({ kind: 'bush', x, y: WALL.y - 6 + rng() * 8, img: bushes[Math.floor(rng() * bushes.length)] });
  }
  solids.push({ x: WALL.fallX - 16, y: 152, r: 11 }, { x: WALL.fallX + 16, y: 152, r: 11 });
  // pedras dentro da lagoa, com marolas em volta
  const pondRocks: { x: number; y: number; w: number }[] = [];
  for (let i = 0, t = 0; i < 7 && t < 400; t++) {
    const x = POND.x + (rng() - 0.5) * POND.rx * 1.5;
    const y = POND.y + (rng() - 0.5) * POND.ry * 1.3;
    if (!inPond(x, y, -36) || onPier(x, y, 30)) continue;
    const img = rocks[2 + Math.floor(rng() * 2)];
    props.push({ kind: 'rock', x, y, img });
    pondRocks.push({ x, y, w: img.width });
    i++;
  }
  // pedras rúnicas em volta do portal (deixam aberta a entrada pela trilha, a oeste)
  for (let i = 0; i < 8; i++) {
    if (i === 4) continue;
    const a = (i / 8) * Math.PI * 2;
    const x = PORTAL.x + Math.cos(a) * 44;
    const y = PORTAL.y + Math.sin(a) * 23;
    props.push({ kind: 'stone', x, y, img: stones[i % 2] });
    solids.push({ x, y: y - 2, r: 5 });
  }
  const scatter = (kind: Prop['kind'], count: number, make: () => Partial<Prop>, solid?: (img: HTMLCanvasElement) => number, margin = 14) => {
    let t = 0;
    let n = 0;
    while (n < count && t++ < 8000) {
      const x = 20 + rng() * (WORLD_W - 40);
      const y = 20 + rng() * (WORLD_H - 40);
      if (inPond(x, y, -6) || Math.abs(y - pathY(x)) < pathHalf(x) + margin || nearCamp(x, y, 40)) continue;
      if (props.some((p) => p.kind !== 'grass' && p.kind !== 'reed' && p.kind !== 'fern' && Math.hypot(p.x - x, p.y - y) < 22)) continue;
      const extra = make();
      props.push({ kind, x, y, ...extra });
      if (solid && extra.img) solids.push({ x, y: y - 2, r: solid(extra.img) });
      n++;
    }
  };
  scatter('rock', 34, () => ({ img: rocks[Math.floor(rng() * rocks.length)] }), (i) => (i.width > 16 ? i.width / 2 - 2 : 0));
  scatter('bush', 40, () => ({ img: bushes[Math.floor(rng() * bushes.length)] }), (i) => i.width / 2 - 3);
  scatter('fern', 110, () => ({ img: ferns[Math.floor(rng() * ferns.length)] }), undefined, 10);
  scatter('stump', 8, () => ({ img: stump }), () => 8);
  scatter('mushroom', 34, () => {
    const glow = rng() < 0.5;
    return { img: glow ? mushGlow : mushRed, glow };
  });
  // mato alto que balança
  for (let i = 0; i < 520; i++) {
    const x = 10 + rng() * (WORLD_W - 20);
    const y = 10 + rng() * (WORLD_H - 20);
    if (inPond(x, y, 4) || Math.abs(y - pathY(x)) < pathHalf(x) + 6) continue;
    props.push({ kind: 'grass', x, y, phase: rng() * 6.28 });
  }
  // juncos na beira da lagoa
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const x = POND.x + Math.cos(a) * (POND.rx - 4 + rng() * 14);
    const y = POND.y + Math.sin(a) * (POND.ry - 2 + rng() * 10);
    if (y > WORLD_H - 8) continue;
    props.push({ kind: 'reed', x, y, phase: rng() * 6.28 });
  }
  // lanternas ao longo da trilha e a fogueira do acampamento
  for (const lx of [150, 560, 900, 1250, 1580]) {
    const y = pathY(lx) - pathHalf(lx) - 8;
    props.push({ kind: 'lantern', x: lx, y });
    solids.push({ x: lx, y, r: 3 });
  }
  // placa de madeira apontando o caminho para o leste, ao lado da trilha
  props.push({ kind: 'sign', x: 500, y: pathY(500) - pathHalf(500) - 5 });
  solids.push({ x: 500, y: pathY(500) - pathHalf(500) - 5, r: 3 });
  props.push({ kind: 'lantern', x: PIER.x + PIER.hw + 4, y: PIER.y1 - 4 });
  solids.push({ x: PIER.x + PIER.hw + 4, y: PIER.y1 - 4, r: 3 });
  props.push({ kind: 'camp', x: CAMP.x, y: CAMP.y });
  solids.push({ x: CAMP.x, y: CAMP.y, r: 7 });

  const sprites: Record<string, HTMLCanvasElement> = {};
  for (const d of ['down', 'up', 'side'] as Dir[]) for (const f of [0, 1, 2, 3, 4]) for (const b of [false, true]) sprites[`${d}${f}${b ? 'b' : ''}`] = drawMatheus(d, f, b);
  for (const f of [0, 1, 2, 3, 4]) {
    for (const b of ['', 'b']) {
      const src = sprites[`side${f}${b}`];
      const { c, ctx } = makeCanvas(src.width, src.height);
      ctx.translate(src.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0);
      sprites[`left${f}${b}`] = c;
    }
  }
  const chickenSprites = [drawChicken(0), drawChicken(1)];

  const at = params.get('em')?.split(',').map(Number);
  const startX = at?.[0] ?? CAMP.x - 40;
  const startY = at?.[1] ?? pathY(CAMP.x - 40) - 10;
  const player = { x: startX, y: startY, dir: 'down' as 'down' | 'up' | 'left' | 'right', anim: 0, moving: false, vx: 0, vy: 0, run: false };
  const hen = { x: startX - 26, y: startY + 8, anim: 0, face: 1 };
  const keys = new Set<string>();

  let stageIdx = Math.max(0, ORDER.indexOf(params.get('hora') ?? 'entardecer'));
  const cycle = params.has('ciclo');
  let cycleT = 0;
  const first = STAGES[ORDER[stageIdx]];
  const cur = {
    amb: [...first.amb] as RGB,
    dark: first.dark,
    shaft: first.shaft,
    shaftCol: [...first.shaftCol] as RGB,
    grade: [...first.grade] as RGB,
    gradeA: first.gradeA,
    mist: first.mist,
  };
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyT' && !e.repeat) stageIdx = (stageIdx + 1) % ORDER.length;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const flies = Array.from({ length: 170 }, () => {
    // vagalumes se juntam perto de árvores, mato e da lagoa
    const anchor = props[Math.floor(rng() * props.length)];
    return { x: anchor.x + (rng() - 0.5) * 120, y: anchor.y + (rng() - 0.5) * 80, p: rng() * 6.28, s: 0.35 + rng() * 0.7 };
  });
  const dust = Array.from({ length: 40 }, () => ({ x: rng() * VIEW_W, y: rng() * VIEW_H, p: rng() * 6.28 }));
  const falling = Array.from({ length: 22 }, () => ({ x: rng() * VIEW_W, y: rng() * VIEW_H, p: rng() * 6.28, c: PAL.leaves[Math.floor(rng() * PAL.leaves.length)] }));
  const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  const cam = {
    x: Math.min(Math.max(player.x - VIEW_W / 2, 0), WORLD_W - VIEW_W),
    y: Math.min(Math.max(player.y - 10 - VIEW_H / 2, 0), WORLD_H - VIEW_H),
  };
  function blocked(x: number, y: number) {
    if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return true;
    if (inPond(x, y, -8) && !onPier(x, y, -2)) return true;
    return solids.some((s) => s.r > 0 && Math.hypot(s.x - x, s.y - y) < s.r + 4);
  }

  let scale = 4;
  function resize() {
    scale = Math.max(2, Math.round(innerHeight / Number(params.get('linhas') ?? 200)));
    VIEW_W = Math.ceil(innerWidth / scale);
    VIEW_H = Math.ceil(innerHeight / scale);
    view.c.width = VIEW_W;
    view.c.height = VIEW_H;
    view.ctx.imageSmoothingEnabled = false;
    screen.width = VIEW_W * scale;
    screen.height = VIEW_H * scale;
    screen.style.width = `${VIEW_W * scale}px`;
    screen.style.height = `${VIEW_H * scale}px`;
    screen.style.left = `${(innerWidth - VIEW_W * scale) / 2}px`;
    screen.style.top = `${(innerHeight - VIEW_H * scale) / 2}px`;
    fgTmp.c.width = VIEW_W * scale;
    fgTmp.c.height = VIEW_H * scale;
    light.c.width = Math.round(VIEW_W * 2);
    light.c.height = Math.round(VIEW_H * 2);
    bloom.c.width = Math.round(VIEW_W / 2);
    bloom.c.height = Math.round(VIEW_H / 2);
  }
  addEventListener('resize', resize);
  resize();

  const hud = document.getElementById('help')!;
  let last = performance.now();
  let time = 0;
  let lastStep = 0;
  const puffs: { x: number; y: number; vx: number; vy: number; life: number; col: string }[] = [];
  const ripples = Array.from({ length: 12 }, () => ({ x: POND.x + (rng() - 0.5) * POND.rx * 1.6, y: POND.y + (rng() - 0.5) * POND.ry * 1.5, p: rng() * 6 }));
  function frame(now: number) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    time += dt;
    if (cycle) {
      cycleT += dt;
      if (cycleT > 14) {
        cycleT = 0;
        stageIdx = (stageIdx + 1) % ORDER.length;
      }
    }

    // ---- movimento: acelera e freia com suavidade, e cada passo é um pulinho
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    const wants = mx !== 0 || my !== 0;
    const running = wants && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const topSpeed = running ? 84 : 50;
    const ilen = Math.hypot(mx, my) || 1;
    const ease = 1 - Math.exp(-(wants ? 12 : 16) * dt);
    player.vx += ((wants ? (mx / ilen) * topSpeed : 0) - player.vx) * ease;
    player.vy += ((wants ? (my / ilen) * topSpeed : 0) - player.vy) * ease;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed < 2) player.vx = player.vy = 0;
    const nx = player.x + player.vx * dt;
    const ny = player.y + player.vy * dt;
    if (!blocked(nx, player.y)) player.x = nx;
    else player.vx = 0;
    if (!blocked(player.x, ny)) player.y = ny;
    else player.vy = 0;
    player.moving = speed > 9;
    player.run = running && player.moving;
    if (wants) player.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 'left' : 'right') : my < 0 ? 'up' : 'down';
    if (player.moving) player.anim += (dt * speed) / 7.2;
    else player.anim = 0;
    // fase do passo: 0..0.5 com o pé no chão, 0.5..1 no ar (o pulinho)
    const stride = (player.anim + 0.25) % 1;
    const airborne = player.moving && stride >= 0.5;
    const hopH = player.moving && airborne ? Math.round(Math.sin(Math.PI * ((stride - 0.5) / 0.5)) * (player.run ? 4.2 : 2.8)) : 0;
    const squash = player.moving && stride < 0.2 ? 1 : 0;
    const stepNo = Math.floor(player.anim + 0.25);
    if (player.moving && stepNo !== lastStep) {
      const onPath = Math.abs(player.y - pathY(player.x)) < pathHalf(player.x);
      for (let i = 0; i < (player.run ? 5 : 3); i++) {
        puffs.push({ x: player.x + (Math.random() - 0.5) * 6, y: player.y - 1, vx: (Math.random() - 0.5) * 14 - player.vx * 0.12, vy: -6 - Math.random() * 8, life: 1, col: onPath ? '#ecd8a8' : '#9cd064' });
      }
    }
    lastStep = stepNo;
    const dx = player.x - hen.x;
    const dy = player.y + 5 - hen.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 24) {
      const sp = Math.min(76, 28 + dist * 1.4);
      hen.x += (dx / dist) * sp * dt;
      hen.y += (dy / dist) * sp * dt;
      hen.anim += dt * Math.min(10, sp / 7);
      hen.face = dx < 0 ? -1 : 1;
    } else hen.anim = 0;
    const hhop = hen.anim > 0 ? Math.round(Math.abs(Math.sin(hen.anim * Math.PI)) * 3) : 0;

    // ---- hora do dia: tudo escorrega suavemente para a etapa escolhida
    const st = STAGES[ORDER[stageIdx]];
    const k = 1 - Math.exp(-1.6 * dt);
    cur.amb = lerpRGB(cur.amb, st.amb, k);
    cur.shaftCol = lerpRGB(cur.shaftCol, st.shaftCol, k);
    cur.grade = lerpRGB(cur.grade, st.grade, k);
    cur.dark = lerp(cur.dark, st.dark, k);
    cur.shaft = lerp(cur.shaft, st.shaft, k);
    cur.gradeA = lerp(cur.gradeA, st.gradeA, k);
    cur.mist = lerp(cur.mist, st.mist, k);
    const dark = cur.dark;

    // a câmera olha um pouquinho à frente de quem anda
    const lookX = player.vx * 0.3;
    const lookY = player.vy * 0.22;
    cam.x += (Math.min(Math.max(player.x + lookX - VIEW_W / 2, 0), WORLD_W - VIEW_W) - cam.x) * (1 - Math.exp(-6 * dt));
    cam.y += (Math.min(Math.max(player.y + lookY - 10 - VIEW_H / 2, 0), WORLD_H - VIEW_H) - cam.y) * (1 - Math.exp(-6 * dt));
    const camX = Math.round(cam.x);
    const camY = Math.round(cam.y);

    // ---- cena em pixels
    const v = view.ctx;
    v.globalCompositeOperation = 'source-over';
    v.globalAlpha = 1;
    v.drawImage(ground, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    // sombras no chão: das árvores, arbustos e dos personagens
    v.fillStyle = 'rgba(52,34,96,0.30)';
    const shadowOn = (x: number, y: number, rx: number, ry: number) => {
      v.beginPath();
      v.ellipse(Math.round(x - camX), Math.round(y - camY), rx, ry, 0, 0, Math.PI * 2);
      v.fill();
    };
    for (const p of props) {
      if (p.x < camX - 100 || p.x > camX + VIEW_W + 100 || p.y < camY - 60 || p.y > camY + VIEW_H + 100) continue;
      if (p.kind === 'tree' && p.tree) {
        shadowOn(p.x + 4, p.y + 2, p.tree.big ? 16 : 12, 5);
        // sombra comprida para a direita e para baixo (sol baixo, vindo da esquerda e de cima)
        v.fillStyle = 'rgba(52,34,96,0.2)';
        v.beginPath();
        v.ellipse(Math.round(p.x - camX + (p.tree.pine ? 34 : 28)), Math.round(p.y - camY + (p.tree.pine ? 12 : 10)), p.tree.pine ? 38 : p.tree.big ? 40 : 30, p.tree.pine ? 6 : p.tree.big ? 15 : 12, 0.3, 0, Math.PI * 2);
        v.fill();
        v.fillStyle = 'rgba(52,34,96,0.30)';
      } else if (p.kind === 'bush' && p.img) shadowOn(p.x + 3, p.y + 1, p.img.width * 0.5, 4);
      else if (p.kind === 'rock' && p.img) shadowOn(p.x + 2, p.y + 1, p.img.width * 0.55, Math.max(3, p.img.width * 0.1));
      else if (p.kind === 'stump') shadowOn(p.x + 2, p.y, 11, 4);
      else if (p.kind === 'stone') shadowOn(p.x + 3, p.y + 1, 8, 3);
      else if (p.kind === 'sign') shadowOn(p.x + 4, p.y + 1, 10, 3);
    }
    v.fillStyle = 'rgba(52,34,96,0.34)';
    // a sombra encolhe no pulo e foge da luz mais próxima
    let sox = 0;
    let soy = 0;
    for (const p of props) {
      if (p.kind !== 'lantern' && p.kind !== 'camp') continue;
      const dxl = player.x - p.x;
      const dyl = player.y - p.y;
      const dl = Math.hypot(dxl, dyl);
      if (dl > 170 || dl < 1) continue;
      const w = (1 - dl / 170) * (0.35 + 0.65 * dark);
      sox += (dxl / dl) * w * 5;
      soy += (dyl / dl) * w * 2.5;
    }
    shadowOn(player.x + sox, player.y + soy, 8 - hopH * 0.9, 3 - hopH * 0.25);
    shadowOn(hen.x, hen.y, 6 - hhop * 0.7, 2);

    // brilho da água
    for (let i = 0; i < 26; i++) {
      const sx = POND.x + Math.sin(i * 12.9898) * POND.rx * 0.9;
      const sy = POND.y + Math.cos(i * 78.233) * POND.ry * 0.8;
      if (!inPond(sx, sy, -16) || Math.sin(time * 1.6 + i * 2.1) < 0.55) continue;
      v.fillStyle = 'rgba(210,240,255,0.85)';
      v.fillRect(Math.round(sx - camX), Math.round(sy - camY), 2, 1);
    }

    // ondas que se abrem na lagoa
    for (const r of ripples) {
      if (r.x < camX - 30 || r.x > camX + VIEW_W + 30 || r.y < camY - 20 || r.y > camY + VIEW_H + 20) continue;
      const ph = (time * 0.45 + r.p) % 1;
      v.fillStyle = `rgba(225,248,255,${(1 - ph) * 0.55})`;
      ringPx(v, r.x - camX, r.y - camY, 2 + ph * 13, 1 + ph * 5, 1);
    }
    // marolas em volta das pedras da lagoa
    for (const r of pondRocks) {
      if (r.x < camX - 40 || r.x > camX + VIEW_W + 40 || r.y < camY - 30 || r.y > camY + VIEW_H + 30) continue;
      v.fillStyle = 'rgba(235,252,252,0.8)';
      ringPx(v, r.x - camX, r.y - camY + 1, r.w * 0.6 + 2, r.w * 0.2 + 2, 1);
      const ph = (time * 0.4 + r.x * 0.01) % 1;
      v.fillStyle = `rgba(235,252,252,${(1 - ph) * 0.55})`;
      ringPx(v, r.x - camX, r.y - camY + 1, r.w * 0.6 + 2 + ph * 9, r.w * 0.2 + 2 + ph * 4, 1);
    }
    // cachoeirinha: filetes de água descendo
    if (Math.abs(WALL.fallX - (camX + VIEW_W / 2)) < VIEW_W / 2 + 30 && WALL.y - camY < VIEW_H) {
      for (let i = 0; i < 9; i++) {
        const ph = (time * 0.9 + i * 0.37) % 1;
        v.fillStyle = 'rgba(236,252,252,0.85)';
        v.fillRect(Math.round(WALL.fallX - camX - 7 + ((i * 5) % 15)), Math.round(WALL.y - camY - 2 + ph * 98), 1, 4);
      }
      for (let i = 0; i < 6; i++) {
        const ph = (time * 0.5 + i * 0.23) % 1;
        v.fillStyle = `rgba(236,252,252,${1 - ph})`;
        v.fillRect(Math.round(WALL.fallX - camX - 24 + ph * 48), Math.round(156 - camY + Math.sin(i * 3.1) * 4), 2, 1);
      }
    }
    // círculo mágico do portal, no chão
    if (Math.abs(PORTAL.x - (camX + VIEW_W / 2)) < VIEW_W / 2 + 80) {
      const pu = 0.7 + 0.3 * Math.sin(time * 2);
      const px0 = PORTAL.x - camX;
      const py0 = PORTAL.y - camY;
      v.fillStyle = `rgba(90,200,240,${0.2 * pu})`;
      discPx(v, px0, py0, 34, 17);
      v.fillStyle = `rgba(140,240,255,${0.65 * pu})`;
      ringPx(v, px0, py0, 34, 17, 2);
      v.fillStyle = `rgba(140,240,255,${0.45 * pu})`;
      ringPx(v, px0, py0, 22, 11, 1);
      for (let i = 0; i < 8; i++) {
        const a = time * 0.7 + (i * Math.PI) / 4;
        v.fillStyle = `rgba(220,255,255,${0.5 + 0.5 * Math.sin(time * 3 + i)})`;
        v.fillRect(Math.round(px0 + Math.cos(a) * 28), Math.round(py0 + Math.sin(a) * 14), 2, 2);
      }
    }
    const frameIdx = player.moving ? (airborne ? 4 : Math.floor(player.anim + 0.25) % 2 === 0 ? 1 : 2) : Math.floor(time * 1.3) % 2 === 1 ? 3 : 0;
    const blinkNow = time % 4.3 < 0.13;
    const key = `${player.dir === 'right' ? 'side' : player.dir}${frameIdx}${blinkNow ? 'b' : ''}`;
    const drawables: { y: number; draw: () => void }[] = [];
    for (const p of props) {
      if (p.x < camX - 100 || p.x > camX + VIEW_W + 100 || p.y < camY - 20 || p.y > camY + VIEW_H + 100) continue;
      const sx = Math.round(p.x - camX);
      const sy = Math.round(p.y - camY);
      if (p.kind === 'tree' && p.tree) {
        const t = p.tree;
        drawables.push({ y: p.y, draw: () => v.drawImage(t.trunk, sx - t.footX, sy - t.footY) });
      } else if (p.kind === 'grass') {
        const pd = Math.hypot(p.x - player.x, p.y - player.y);
        const push = pd < 16 ? Math.sign(p.x - player.x || 1) * Math.round((16 - pd) / 6) : 0;
        const sway = Math.round(Math.sin(time * 1.8 + p.phase! + p.x / 40) * 1.2) + push;
        drawables.push({
          y: p.y,
          draw: () => {
            v.fillStyle = PAL.bladeDark;
            v.fillRect(sx - 1 + sway, sy - 5, 1, 5);
            v.fillRect(sx + 1 + sway, sy - 4, 1, 4);
            v.fillStyle = PAL.bladeLight;
            v.fillRect(sx + sway, sy - 7, 1, 7);
            v.fillRect(sx - 2, sy - 3, 1, 3);
            v.fillRect(sx + 2 + sway, sy - 5, 1, 2);
          },
        });
      } else if (p.kind === 'reed') {
        const sway = Math.round(Math.sin(time * 1.4 + p.phase!) * 1);
        drawables.push({
          y: p.y,
          draw: () => {
            v.fillStyle = '#4a7a38';
            v.fillRect(sx, sy - 9, 1, 9);
            v.fillRect(sx + 2, sy - 6, 1, 6);
            v.fillStyle = '#7ab050';
            v.fillRect(sx + sway, sy - 12, 1, 4);
            v.fillStyle = '#6a3a20';
            v.fillRect(sx - 1 + sway, sy - 12, 3, 4);
          },
        });
      } else if (p.kind === 'sign') {
        drawables.push({
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 15, 5, 16);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 14, 3, 14);
            v.fillStyle = '#a87348';
            v.fillRect(sx - 1, sy - 14, 1, 14);
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 13, sy - 29, 26, 15);
            v.fillStyle = '#b8743c';
            v.fillRect(sx - 12, sy - 28, 24, 13);
            v.fillStyle = '#d4904e';
            v.fillRect(sx - 12, sy - 28, 24, 2);
            v.fillStyle = '#8a5028';
            v.fillRect(sx - 12, sy - 17, 24, 2);
            v.fillStyle = '#2e1812';
            v.fillRect(sx - 8, sy - 22, 14, 2);
            v.fillRect(sx + 3, sy - 25, 2, 8);
            v.fillRect(sx + 5, sy - 24, 2, 6);
            v.fillRect(sx + 7, sy - 23, 2, 4);
          },
        });
      } else if (p.kind === 'lantern') {
        drawables.push({
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 22, 5, 1);
            v.fillRect(sx - 1, sy - 21, 3, 17);
            v.fillStyle = '#7a4a2a';
            v.fillRect(sx - 1, sy - 12, 2, 12);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 12, 1, 12);
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 4, sy - 22, 9, 9);
            v.fillStyle = '#ffd77a';
            v.fillRect(sx - 3, sy - 21, 7, 7);
            v.fillStyle = '#fff2c0';
            v.fillRect(sx - 1, sy - 20, 3, 4);
          },
        });
      } else if (p.kind === 'camp') {
        drawables.push({
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 8, sy - 3, 16, 5);
            v.fillStyle = '#6a3e26';
            v.fillRect(sx - 7, sy - 2, 14, 3);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 6, sy - 2, 5, 1);
            v.fillStyle = ROCK[1];
            for (let a = 0; a < 8; a++) v.fillRect(Math.round(sx + Math.cos(a * 0.785) * 10) - 1, Math.round(sy - 1 + Math.sin(a * 0.785) * 4), 3, 2);
            const f = Math.sin(time * 14) + Math.sin(time * 23);
            v.fillStyle = '#d83a20';
            v.fillRect(sx - 4, sy - 8, 8, 6);
            v.fillRect(sx - 2, sy - 12 + Math.round(f * 0.5), 5, 5);
            v.fillStyle = '#ff9a2a';
            v.fillRect(sx - 3, sy - 7, 6, 5);
            v.fillRect(sx - 1, sy - 11 + Math.round(f * 0.5), 3, 5);
            v.fillStyle = '#ffe070';
            v.fillRect(sx - 2, sy - 6, 4, 4);
            v.fillRect(sx, sy - 9 + Math.round(f * 0.5), 1, 3);
          },
        });
      } else if (p.img) {
        const img = p.img;
        const pdist = Math.hypot(p.x - player.x, p.y - player.y);
        const wob = p.kind === 'bush' && pdist < 24 && player.moving ? Math.round(Math.sin(time * 24 + p.x) * ((24 - pdist) / 14)) : 0;
        drawables.push({ y: p.y, draw: () => v.drawImage(img, sx - Math.round(img.width / 2) + wob, sy - img.height + 2) });
      }
    }
    const pimg = sprites[key];
    const pdx = Math.round(player.x - camX - 12);
    const pdy = Math.round(player.y - camY - 33);
    const lean = player.run ? Math.sign(player.vx) : 0;
    // tocha na mão: aparece quando escurece
    const tA = Math.max(0, Math.min(1, (dark - 0.1) * 3));
    const handX = player.dir === 'right' ? pdx + 17 : player.dir === 'left' ? pdx + 4 : pdx + 3;
    const handY = pdy + 25 - hopH + squash;
    const torchWX = camX + handX + 1.5;
    const torchWY = camY + handY - 13;
    drawables.push({
      y: player.y,
      draw: () => {
        // pernas ficam no ar com o corpo; o tronco afunda 1px na aterrissagem e inclina ao correr
        v.drawImage(pimg, 0, 24, 24, 10, pdx, pdy + 24 - hopH, 24, 10);
        v.drawImage(pimg, 0, 0, 24, 25, pdx + lean, pdy - hopH + squash, 24, 25);
        if (tA > 0.03) {
          v.globalAlpha = tA;
          const fx = Math.round(Math.sin(time * 17) + Math.sin(time * 29));
          v.fillStyle = OUTLINE;
          v.fillRect(handX - 1, handY - 8, 5, 10);
          v.fillStyle = '#7a4a2a';
          v.fillRect(handX, handY - 7, 3, 8);
          v.fillStyle = '#a87348';
          v.fillRect(handX, handY - 7, 1, 8);
          v.fillStyle = '#3a2a22';
          v.fillRect(handX - 1, handY - 9, 5, 2);
          v.fillStyle = '#d83a20';
          v.fillRect(handX - 1, handY - 14 + (fx > 0 ? -1 : 0), 5, 5);
          v.fillRect(handX, handY - 16 + fx, 3, 3);
          v.fillStyle = '#ff9a2a';
          v.fillRect(handX, handY - 13, 3, 4);
          v.fillRect(handX + 1, handY - 15 + fx, 1, 2);
          v.fillStyle = '#ffe070';
          v.fillRect(handX + 1, handY - 12, 1, 3);
          v.globalAlpha = 1;
        }
      },
    });
    const himg = chickenSprites[Math.floor(hen.anim * 2) & 1];
    drawables.push({
      y: hen.y,
      draw: () => {
        v.save();
        v.translate(Math.round(hen.x - camX), Math.round(hen.y - camY - 12 - hhop));
        v.scale(hen.face, 1);
        v.drawImage(himg, -8, 0);
        v.restore();
      },
    });
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    // poeirinha dos passos
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.life -= dt * 2.4;
      if (q.life <= 0) {
        puffs.splice(i, 1);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 14 * dt;
      v.globalAlpha = Math.min(1, q.life);
      v.fillStyle = q.col;
      v.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 1, 1);
    }
    v.globalAlpha = 1;
    // faíscas de luz subindo do portal
    if (Math.abs(PORTAL.x - (camX + VIEW_W / 2)) < VIEW_W / 2 + 60) {
      for (let i = 0; i < 26; i++) {
        const ph = (time * 0.22 + i / 26) % 1;
        const a = i * 2.4;
        v.globalAlpha = Math.sin(ph * Math.PI);
        v.fillStyle = i % 3 === 0 ? '#ffffff' : '#8af0ff';
        v.fillRect(Math.round(PORTAL.x - camX + Math.cos(a) * 30 * (1 - ph * 0.5)), Math.round(PORTAL.y - camY + Math.sin(a) * 15 - ph * 80), 1, i % 2 === 0 ? 2 : 1);
      }
      v.globalAlpha = 1;
    }

    // manchas de luz e sombra das folhas, passeando pelo chão (mais fortes de dia)
    const dap = 0.3 * (1 - dark * 0.85);
    if (dap > 0.02) {
      v.save();
      v.globalCompositeOperation = 'multiply';
      v.globalAlpha = dap;
      v.translate(-camX + Math.sin(time * 0.3) * 6 + time * 2.2, -camY + Math.cos(time * 0.27) * 4);
      v.fillStyle = dapplePattern;
      v.fillRect(camX - 300, camY - 300, VIEW_W + 600, VIEW_H + 600);
      v.restore();
    }

    // manchas de sol passando pelas folhas (de dia)
    const sunA = 0.085 * (1 - dark) * (0.4 + 0.6 * cur.shaft);
    if (sunA > 0.01) {
      v.save();
      v.globalCompositeOperation = 'lighter';
      v.globalAlpha = sunA;
      v.translate(-camX - Math.sin(time * 0.22) * 8 - time * 1.6, -camY + Math.cos(time * 0.2) * 5);
      v.fillStyle = sunPattern;
      v.fillRect(camX - 300, camY - 300, VIEW_W + 600, VIEW_H + 600);
      v.restore();
    }

    // copas por cima, balançando de leve; transparentes quando o Matheus passa por baixo
    for (const p of props) {
      if (p.kind !== 'tree' || !p.tree) continue;
      const t = p.tree;
      const sway = Math.round(Math.sin(time * 0.9 + p.x * 0.05) * 1);
      const x = Math.round(p.x - camX - t.canopyX) + sway;
      const y = Math.round(p.y - camY - t.footY - t.canopyY + 22);
      if (x > VIEW_W || x + t.canopy.width < 0 || y > VIEW_H || y + t.canopy.height < 0) continue;
      const under = Math.abs(player.x - p.x) < t.canopy.width * 0.42 && player.y < p.y + 4 && player.y > p.y - t.canopy.height * 0.85;
      v.globalAlpha = under ? 0.45 : 1;
      v.drawImage(t.canopy, x, y);
    }
    v.globalAlpha = 1;

    // galhos retorcidos invadindo os cantos de cima da tela
    {
      const sway = Math.round(Math.sin(time * 0.7) * 1);
      v.drawImage(overL, 0, -2 + sway);
      v.save();
      v.translate(VIEW_W, 0);
      v.scale(-1, 1);
      v.drawImage(overR, 0, -2 - sway);
      v.restore();
    }

    // folhas caindo e poeirinha no ar
    for (const l of falling) {
      l.y += dt * 12;
      l.x += Math.sin(time * 1.3 + l.p) * dt * 12 + dt * 6;
      if (l.y > VIEW_H + 2) {
        l.y = -3;
        l.x = Math.random() * VIEW_W;
      }
      v.fillStyle = l.c;
      v.fillRect(Math.round(l.x), Math.round(l.y), 2, 1);
    }
    for (const d of dust) {
      d.x += Math.sin(time * 0.5 + d.p) * dt * 4 + dt * 3;
      d.y += Math.cos(time * 0.4 + d.p) * dt * 3;
      if (d.x > VIEW_W) d.x = 0;
      if (d.y > VIEW_H || d.y < 0) d.y = Math.random() * VIEW_H;
      v.fillStyle = `rgba(255,250,220,${0.25 + 0.2 * Math.sin(time + d.p)})`;
      v.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }

    // ---- passa a cena para a tela com pixels nítidos
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(view.c, 0, 0, screen.width, screen.height);

    // ---- iluminação: mapa de luz = cor ambiente + luzes somadas, multiplicado sobre a imagem
    const lights: Light[] = [];
    const tfl = 0.9 + 0.1 * Math.sin(time * 17) * Math.sin(time * 9);
    lights.push({ x: torchWX, y: torchWY, r: 108 * tfl, col: [255, 176, 100], a: tA * (0.16 + 0.42 * dark) * tfl });
    lights.push({ x: player.x, y: player.y - 12, r: 70, col: [255, 196, 140], a: 0.1 + 0.14 * dark });
    if (tA > 0.3 && Math.random() < dt * 9) sparks.push({ x: torchWX + (Math.random() - 0.5) * 3, y: torchWY - 2, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 12, life: 0.7 + Math.random() * 0.6 });
    for (const p of props) {
      if (p.x < camX - 140 || p.x > camX + VIEW_W + 140 || p.y < camY - 140 || p.y > camY + VIEW_H + 140) continue;
      if (p.kind === 'lantern') lights.push({ x: p.x, y: p.y - 18, r: 90, col: [255, 214, 120], a: 0.05 + 0.6 * dark });
      else if (p.kind === 'camp') {
        const fl = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
        lights.push({ x: p.x, y: p.y - 6, r: 130 * fl, col: [255, 150, 60], a: (0.1 + 0.46 * dark) * fl });
      } else if (p.kind === 'mushroom' && p.glow) lights.push({ x: p.x, y: p.y - 4, r: 40, col: [90, 170, 255], a: 0.7 * dark, night: true });
    }
    if (Math.hypot(PORTAL.x - (camX + VIEW_W / 2), PORTAL.y - (camY + VIEW_H / 2)) < 380) {
      const pu = 0.75 + 0.25 * Math.sin(time * 2);
      lights.push({ x: PORTAL.x, y: PORTAL.y - 8, r: 140, col: [120, 220, 255], a: (0.3 + 0.55 * dark) * pu });
    }
    for (const f of flies) {
      const fx = f.x + Math.sin(time * f.s + f.p) * 22;
      const fy = f.y + Math.cos(time * f.s * 0.8 + f.p) * 14;
      if (fx < camX - 20 || fx > camX + VIEW_W + 20 || fy < camY - 20 || fy > camY + VIEW_H + 20) continue;
      const blink = 0.5 + 0.5 * Math.sin(time * 2.2 * f.s + f.p * 3);
      lights.push({ x: fx, y: fy, r: 15, col: [210, 255, 120], a: 0.55 * dark * blink, night: true });
    }

    const lm = light.ctx;
    const lw = light.c.width;
    const lh = light.c.height;
    const ls = lw / VIEW_W;
    lm.globalCompositeOperation = 'source-over';
    lm.fillStyle = `rgb(${Math.round(cur.amb[0])},${Math.round(cur.amb[1])},${Math.round(cur.amb[2])})`;
    lm.fillRect(0, 0, lw, lh);
    lm.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const lx = (L.x - camX) * ls;
      const ly = (L.y - camY) * ls;
      const r = L.r * ls;
      const g = lm.createRadialGradient(lx, ly, 0, lx, ly, r);
      const la = Math.min(1, L.a);
      g.addColorStop(0, rgba(L.col, la));
      g.addColorStop(0.2, rgba(L.col, la * 0.7));
      g.addColorStop(0.4, rgba(L.col, la * 0.42));
      g.addColorStop(0.6, rgba(L.col, la * 0.2));
      g.addColorStop(0.8, rgba(L.col, la * 0.07));
      g.addColorStop(1, rgba(L.col, 0));
      lm.fillStyle = g;
      lm.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    sctx.imageSmoothingEnabled = true;
    sctx.globalCompositeOperation = 'multiply';
    sctx.drawImage(light.c, 0, 0, screen.width, screen.height);

    // brilho colorido das luzes por cima (dá a sensação de luz de verdade, não só de claridade)
    sctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const sx = (L.x - camX) * scale;
      const sy = (L.y - camY) * scale;
      const r = L.r * scale * (L.night ? 0.55 : 0.7);
      const g = sctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const a = Math.min(1, L.a) * (L.night ? 0.3 : 0.1) * (0.2 + 0.8 * dark);
      if (a < 0.01) continue;
      g.addColorStop(0, rgba(L.col, a));
      g.addColorStop(1, rgba(L.col, 0));
      sctx.fillStyle = g;
      sctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    // flores azuis brilhantes
    for (const f of glowFlowers) {
      if (f.x < camX - 4 || f.x > camX + VIEW_W + 4 || f.y < camY - 4 || f.y > camY + VIEW_H + 4) continue;
      const pulse = 0.65 + 0.35 * Math.sin(time * 1.6 + f.x * 0.37);
      const a = (0.2 + 0.8 * dark) * pulse;
      const sx = (f.x - camX) * scale;
      const sy = (f.y - camY) * scale;
      sctx.fillStyle = `rgba(80,200,255,${0.1 * a})`;
      sctx.fillRect(sx - 3 * scale, sy - 3 * scale, 7 * scale, 7 * scale);
      sctx.fillStyle = `rgba(120,236,255,${0.55 * a})`;
      sctx.fillRect(sx - scale, sy - scale, scale, scale);
      sctx.fillRect(sx + scale, sy - scale, scale, scale);
      sctx.fillRect(sx, sy, scale, scale);
    }
    // os próprios vagalumes, pontinhos brilhantes
    for (const f of flies) {
      const fx = f.x + Math.sin(time * f.s + f.p) * 22 - camX;
      const fy = f.y + Math.cos(time * f.s * 0.8 + f.p) * 14 - camY;
      if (fx < -4 || fx > VIEW_W + 4 || fy < -4 || fy > VIEW_H + 4) continue;
      const blink = 0.5 + 0.5 * Math.sin(time * 2.2 * f.s + f.p * 3);
      const a = (0.12 + 0.88 * dark) * blink;
      if (a < 0.05) continue;
      sctx.fillStyle = `rgba(240,255,160,${a})`;
      sctx.fillRect(Math.round(fx * scale), Math.round(fy * scale), scale, scale);
    }

    // brilho quente do sol, vindo do canto de cima à esquerda (a mesma direção da luz nas árvores)
    if (cur.shaft > 0.03) {
      const sg = sctx.createRadialGradient(0, 0, 0, 0, 0, screen.width * 0.85);
      sg.addColorStop(0, rgba(cur.shaftCol, 0.16 * cur.shaft * (1 - dark * 0.5)));
      sg.addColorStop(0.5, rgba(cur.shaftCol, 0.04 * cur.shaft * (1 - dark * 0.5)));
      sg.addColorStop(1, rgba(cur.shaftCol, 0));
      sctx.fillStyle = sg;
      sctx.fillRect(0, 0, screen.width, screen.height);
    }

    // raios de sol atravessando as copas
    if (cur.shaft > 0.03) {
      const W = screen.width;
      const H = screen.height;
      for (let i = 0; i < 6; i++) {
        const baseX = (((i * 0.23 + 0.05 + Math.sin(time * 0.15 + i) * 0.03) % 1.2) + 0.1) * W;
        const wid = W * (0.05 + 0.03 * ((i * 7) % 3));
        const pulse = 0.55 + 0.45 * Math.sin(time * 0.5 + i * 1.7);
        const g = sctx.createLinearGradient(baseX, 0, baseX - H * 0.5, H);
        g.addColorStop(0, rgba(cur.shaftCol, 0.24 * cur.shaft * pulse));
        g.addColorStop(0.7, rgba(cur.shaftCol, 0.07 * cur.shaft * pulse));
        g.addColorStop(1, rgba(cur.shaftCol, 0));
        sctx.fillStyle = g;
        sctx.beginPath();
        sctx.moveTo(baseX, 0);
        sctx.lineTo(baseX + wid, 0);
        sctx.lineTo(baseX + wid - H * 0.5, H);
        sctx.lineTo(baseX - H * 0.5 - wid * 0.4, H);
        sctx.closePath();
        sctx.fill();
      }
    }

    // coluna de luz do portal
    {
      const bx = (PORTAL.x - camX) * scale;
      const by = (PORTAL.y - camY) * scale;
      if (bx > -300 && bx < screen.width + 300) {
        const pu = 0.75 + 0.25 * Math.sin(time * 2);
        const hgt = 190 * scale;
        for (const [wd, al] of [[34, 0.07], [18, 0.12], [8, 0.16]]) {
          const g = sctx.createLinearGradient(0, by, 0, by - hgt);
          g.addColorStop(0, rgba([150, 235, 255], al * (0.4 + 0.6 * dark) * pu));
          g.addColorStop(1, rgba([150, 235, 255], 0));
          sctx.fillStyle = g;
          sctx.fillRect(bx - wd * scale, by - hgt, wd * 2 * scale, hgt);
        }
      }
    }

    // névoa baixa passando devagar (forte ao amanhecer)
    if (cur.mist > 0.02) {
      const W = screen.width;
      const H = screen.height;
      const mc = lerpRGB(cur.amb, [255, 255, 255], 0.5);
      sctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) {
        const cx = (((i * 0.23 + time * (0.006 + i * 0.002)) % 1.4) - 0.2) * W;
        const cy = H * (0.28 + 0.13 * i) + Math.sin(time * 0.25 + i) * H * 0.03;
        sctx.save();
        sctx.translate(cx, cy);
        sctx.scale(2.4, 0.7);
        const g = sctx.createRadialGradient(0, 0, 0, 0, 0, H * 0.5);
        g.addColorStop(0, rgba(mc, 0.2 * cur.mist));
        g.addColorStop(1, rgba(mc, 0));
        sctx.fillStyle = g;
        sctx.fillRect(-H, -H, H * 2, H * 2);
        sctx.restore();
      }
    }

    // folhagem escura perto da câmera, só nas bordas
    {
      const t = fgTmp.ctx;
      const W = screen.width;
      const H = screen.height;
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, W, H);
      t.save();
      t.imageSmoothingEnabled = true;
      t.translate(-camX * 1.45 * scale, -camY * 1.45 * scale);
      t.scale(scale, scale);
      t.fillStyle = fgPattern;
      t.fillRect(camX * 1.45, camY * 1.45, VIEW_W, VIEW_H);
      t.restore();
      t.globalCompositeOperation = 'destination-out';
      const R = Math.hypot(W, H) * 0.5;
      const eg = t.createRadialGradient(W / 2, H / 2, R * 0.4, W / 2, H / 2, R);
      eg.addColorStop(0, 'rgba(0,0,0,1)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = eg;
      t.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 0.5 + 0.2 * dark;
      sctx.drawImage(fgTmp.c, 0, 0);
      sctx.globalAlpha = 1;
    }

    // brilho (bloom): as partes claras vazam um pouco para volta
    sctx.globalCompositeOperation = 'source-over';
    try {
      const b = bloom.ctx;
      b.imageSmoothingEnabled = true;
      b.filter = 'none';
      b.clearRect(0, 0, bloom.c.width, bloom.c.height);
      b.filter = 'brightness(1.05) contrast(1.9) blur(1.5px)';
      b.drawImage(screen, 0, 0, bloom.c.width, bloom.c.height);
      b.filter = 'none';
      sctx.globalCompositeOperation = 'lighter';
      sctx.globalAlpha = 0.1 + 0.18 * dark;
      sctx.drawImage(bloom.c, 0, 0, screen.width, screen.height);
      sctx.globalAlpha = 1;
    } catch {
      /* navegadores sem filtros no canvas ficam sem o brilho extra */
    }

    // cor final e cantos mais escuros
    sctx.globalCompositeOperation = 'soft-light';
    sctx.fillStyle = rgba(cur.grade, cur.gradeA * 3);
    sctx.fillRect(0, 0, screen.width, screen.height);
    sctx.globalCompositeOperation = 'source-over';
    const vg = sctx.createRadialGradient(screen.width / 2, screen.height / 2, screen.height * 0.5, screen.width / 2, screen.height / 2, screen.height * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(40,18,52,${0.3 + 0.22 * dark})`);
    sctx.fillStyle = vg;
    sctx.fillRect(0, 0, screen.width, screen.height);

    // faíscas da fogueira
    if (Math.hypot(player.x - CAMP.x, player.y - CAMP.y) < 400 && Math.random() < dt * 14) {
      sparks.push({ x: CAMP.x + (Math.random() - 0.5) * 6, y: CAMP.y - 10, vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 16, life: 1 + Math.random() });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      sctx.globalCompositeOperation = 'lighter';
      sctx.fillStyle = `rgba(255,${150 + Math.round(s.life * 50)},60,${Math.min(1, s.life)})`;
      sctx.fillRect(Math.round((s.x - camX) * scale), Math.round((s.y - camY) * scale), scale, scale);
    }
    sctx.globalCompositeOperation = 'source-over';

    hud.textContent = `${st.name} · WASD/setas andam · Shift corre · T muda a hora · siga a trilha para o leste até o círculo de luz`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
