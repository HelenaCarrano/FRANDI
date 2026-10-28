import { AUTUMN, CLEAR, COBBLE, MUD, PAL, WATER, makeCanvas, mulberry32, type Rng } from './art';

/**
 * Pintor de chão genérico: gramado em tons chapados, trilhas (com lama e calçamento), clareiras de terra e lagoas
 * com margem, barranco e espuma. Trabalha com máscaras e escreve direto na imagem (rápido mesmo em mapas grandes).
 */

export interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface GroundSpec {
  w: number;
  h: number;
  seed: number;
  paths?: { pts: [number, number][]; width: number }[];
  clearings?: Blob[];
  waters?: Blob[];
  tufts?: number;
  flowers?: number;
  leaves?: number;
  glow?: { x: number; y: number }[];
  cobble?: boolean;
  /** Troca a base de gramado por outro tom (ex.: terra do vinhedo, pedra). */
  base?: 'grass' | 'dirt';
  /** Desenho extra depois da pintura (píer, cachoeira, runas...). */
  decor?: (ctx: CanvasRenderingContext2D, rng: Rng, g: GroundInfo) => void;
}

export interface GroundInfo {
  w: number;
  h: number;
  isPath(x: number, y: number): boolean;
  inWater(x: number, y: number, grow?: number): boolean;
  inClear(x: number, y: number): boolean;
}

export interface GroundResult extends GroundInfo {
  canvas: HTMLCanvasElement;
}

const abgr = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255);
};

function hash(x: number, y: number) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Contorno irregular de uma mancha (clareira, lagoa): raio multiplicado por ondas. */
function blobRadius(b: Blob, x: number, y: number, grow: number) {
  const dx = x - b.x;
  const dy = y - b.y;
  const a = Math.atan2(dy / b.ry, dx / b.rx);
  const w = 0.1 * Math.sin(a * 5 + b.x * 0.01) + 0.06 * Math.sin(a * 9 + b.y * 0.02) + 0.05 * Math.sin(a * 3);
  const rx = b.rx * (1 + w) + grow;
  const ry = b.ry * (1 + w) + grow;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
}

export function paintGround(spec: GroundSpec): GroundResult {
  const { w, h } = spec;
  const rng = mulberry32(spec.seed);
  const { c, ctx } = makeCanvas(w, h);

  // ---- máscaras
  const pathM = new Uint8Array(w * h);
  const clearM = new Uint8Array(w * h);
  const waterM = new Uint8Array(w * h);
  for (const p of spec.paths ?? []) {
    for (let i = 1; i < p.pts.length; i++) {
      const [x0, y0] = p.pts[i - 1];
      const [x1, y1] = p.pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s <= len; s += 2) {
        const t = s / len;
        const px = x0 + (x1 - x0) * t;
        const py = y0 + (y1 - y0) * t;
        const hw = (p.width / 2) * (1 + 0.14 * Math.sin(px / 41 + py / 37) + 0.08 * Math.sin(px / 13));
        const r = Math.ceil(hw);
        for (let dy = -r; dy <= r; dy++) {
          const yy = Math.round(py + dy);
          if (yy < 0 || yy >= h) continue;
          const half = Math.floor(Math.sqrt(Math.max(0, hw * hw - dy * dy)));
          const xa = Math.max(0, Math.round(px - half));
          const xb = Math.min(w - 1, Math.round(px + half));
          pathM.fill(1, yy * w + xa, yy * w + xb + 1);
        }
      }
    }
  }
  const stampBlobs = (list: Blob[] | undefined, mask: Uint8Array) => {
    for (const b of list ?? []) {
      const x0 = Math.max(0, Math.floor(b.x - b.rx * 1.3));
      const x1 = Math.min(w - 1, Math.ceil(b.x + b.rx * 1.3));
      const y0 = Math.max(0, Math.floor(b.y - b.ry * 1.3));
      const y1 = Math.min(h - 1, Math.ceil(b.y + b.ry * 1.3));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (blobRadius(b, x, y, 0) < 1) mask[y * w + x] = 1;
    }
  };
  stampBlobs(spec.clearings, clearM);
  stampBlobs(spec.waters, waterM);

  // desvios por célula de 8 px: dão beiras irregulares às máscaras
  const cw = Math.ceil(w / 8);
  const ch = Math.ceil(h / 8);
  const jx = new Int8Array(cw * ch);
  const jy = new Int8Array(cw * ch);
  for (let i = 0; i < jx.length; i++) {
    jx[i] = Math.round((hash(i, 7) - 0.5) * 5);
    jy[i] = Math.round((hash(i, 13) - 0.5) * 5);
  }
  const at = (m: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);

  // ---- cores
  const grass = PAL.grass.map(abgr);
  const dirtBase = [abgr('#7a5a3c'), abgr('#6c4e34'), abgr('#8a6844'), abgr('#5a4028')];
  const base = spec.base === 'dirt' ? dirtBase : grass;
  const pathC = PAL.path.map(abgr);
  const pathEdge = abgr(PAL.pathEdge);
  const mud = abgr(MUD);
  const cobble = abgr(COBBLE);
  const clearC = CLEAR.map(abgr);
  const W = WATER.map(abgr);
  const bankHi = abgr('#8a5c3c');
  const bankLo = abgr('#5e3a2a');
  const rim = abgr(AUTUMN ? '#4a6a28' : '#3a7a30');
  const foam = abgr('#e6fbfb');

  const img = ctx.createImageData(w, h);
  const out = new Uint32Array(img.data.buffer);
  const hasWater = (spec.waters?.length ?? 0) > 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y >> 3) * cw + (x >> 3);
      const sx = x + jx[k];
      const sy = y + jy[k];
      const big = Math.sin(x / 83 + Math.sin(y / 61) * 1.6) * Math.sin(y / 71 + Math.cos(x / 97) * 1.2);
      const n = hash(x >> 1, y >> 1);
      let col = base[1];
      if (big > 0.32) col = base[2];
      else if (big < -0.38) col = base[3];
      else if (n > 0.985) col = base[2];

      if (at(clearM, sx, sy)) {
        const patch = Math.sin(x / 13 + Math.sin(y / 9) * 2) * Math.sin(y / 11 + x / 23);
        col = patch > 0.45 ? clearC[0] : patch < -0.5 ? clearC[2] : clearC[1];
        if (!at(clearM, sx, sy + 2)) col = clearC[3];
      }
      if (at(pathM, sx, sy)) {
        const m = Math.sin(x / 17 + Math.sin(y / 7) * 2.2) * Math.sin(y / 9 + Math.cos(x / 29) * 1.5);
        col = m > 0.34 ? mud : n > 0.965 ? pathC[2] : pathC[0];
        if (spec.cobble !== false) {
          const row = Math.floor(y / 7);
          const off = (row % 2) * 4 + Math.floor(hash(row, 3) * 3);
          if ((y % 7 === 0 || (x + off) % 9 === 0) && hash(x >> 2, y >> 2) < 0.5) col = cobble;
        }
        if (!at(pathM, sx, sy - 1) || !at(pathM, sx, sy + 2)) col = pathEdge;
      }
      if (hasWater) {
        const wv = Math.sin(x / 19 + Math.sin(y / 8) * 2) * Math.sin(y / 6 + x / 33);
        if (at(waterM, sx, sy)) {
          // dentro da água: raso perto da margem, fundo no meio, espuma na borda
          const r2 = at(waterM, sx - 2, sy) && at(waterM, sx + 2, sy) && at(waterM, sx, sy - 2) && at(waterM, sx, sy + 2);
          const r9 = at(waterM, sx - 9, sy) && at(waterM, sx + 9, sy) && at(waterM, sx, sy - 9) && at(waterM, sx, sy + 9);
          const r30 = r9 && at(waterM, sx - 30, sy) && at(waterM, sx + 30, sy) && at(waterM, sx, sy - 30) && at(waterM, sx, sy + 30);
          col = r30 ? (wv > 0.6 ? W[1] : W[0]) : r9 ? (wv > 0.5 ? W[1] : W[0]) : wv > 0.4 ? W[2] : W[1];
          if (!r2 && hash(x >> 1, y) < 0.8) col = foam;
        } else {
          const near3 = at(waterM, sx - 3, sy) || at(waterM, sx + 3, sy) || at(waterM, sx, sy - 3) || at(waterM, sx, sy + 3) || at(waterM, sx - 2, sy - 2) || at(waterM, sx + 2, sy + 2);
          const near6 = near3 || at(waterM, sx - 6, sy) || at(waterM, sx + 6, sy) || at(waterM, sx, sy - 6) || at(waterM, sx, sy + 6) || at(waterM, sx - 4, sy - 4) || at(waterM, sx + 4, sy + 4);
          const near9 = near6 || at(waterM, sx - 9, sy) || at(waterM, sx + 9, sy) || at(waterM, sx, sy - 9) || at(waterM, sx, sy + 9);
          if (near3) col = bankHi;
          else if (near6) col = bankLo;
          else if (near9) col = rim;
        }
      }
      out[y * w + x] = col;
    }
  }

  // ---- decoração direto nos pixels
  const free = (x: number, y: number) => x > 4 && y > 4 && x < w - 5 && y < h - 5 && !pathM[y * w + x] && !waterM[y * w + x] && !clearM[y * w + x];
  const dot = (x: number, y: number, hex: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) out[y * w + x] = hex;
  };
  const dark = abgr(PAL.bladeDark);
  const light = abgr(PAL.bladeLight);
  const tuftCount = spec.tufts ?? Math.round((w * h) / 700);
  for (let i = 0; i < tuftCount; i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!free(x, y) || !free(x, y + 4)) continue;
    const col = rng() < 0.82 ? dark : light;
    dot(x, y, col);
    dot(x + 1, y - 1, col);
    dot(x + 2, y, col);
    if (rng() < 0.65) {
      dot(x + 4, y, col);
      dot(x + 5, y - 1, col);
      dot(x + 6, y, col);
    }
  }
  // grama dos dois lados da trilha invadindo a beirada
  for (const p of spec.paths ?? []) {
    for (let i = 1; i < p.pts.length; i++) {
      const [x0, y0] = p.pts[i - 1];
      const [x1, y1] = p.pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s < len; s += 4) {
        const t = s / len;
        const px = x0 + (x1 - x0) * t;
        const py = y0 + (y1 - y0) * t;
        for (const side of [-1, 1]) {
          if (rng() < 0.5) continue;
          const nx = -(y1 - y0) / len;
          const ny = (x1 - x0) / len;
          const gx = Math.round(px + nx * side * (p.width / 2 + 2));
          const gy = Math.round(py + ny * side * (p.width / 2 + 2));
          if (!free(gx, gy)) continue;
          dot(gx, gy, dark);
          dot(gx, gy - 1, dark);
          dot(gx + 1, gy - 2, light);
        }
      }
    }
  }
  const FLOWERS = ['#ffffff', '#ffe36a', '#ff9ec0', '#9ec8ff', '#ff8a6a'].map(abgr);
  const yel = abgr('#f0a020');
  for (let i = 0; i < (spec.flowers ?? Math.round((w * h) / 20000)); i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const col = FLOWERS[Math.floor(rng() * FLOWERS.length)];
    const cnt = 2 + Math.floor(rng() * 5);
    for (let j = 0; j < cnt; j++) {
      const x = Math.round(cx + (rng() - 0.5) * 18);
      const y = Math.round(cy + (rng() - 0.5) * 10);
      if (!free(x, y)) continue;
      dot(x, y + 1, dark);
      dot(x, y - 1, col);
      dot(x - 1, y, col);
      dot(x + 1, y, col);
      dot(x, y, yel);
    }
  }
  const leafCols = PAL.leaves.map(abgr);
  for (let i = 0; i < (spec.leaves ?? Math.round((w * h) / 10000)); i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!free(x, y)) continue;
    const col = leafCols[Math.floor(rng() * leafCols.length)];
    dot(x, y, col);
    dot(x + 1, y, col);
  }
  // pedrinhas claras na trilha
  const pebble = abgr('#e8d0a0');
  for (let i = 0; i < (spec.paths?.length ?? 0) * 200; i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!pathM[y * w + x]) continue;
    dot(x, y, pebble);
    dot(x + 1, y, pebble);
    dot(x, y + 1, pathEdge);
  }
  // flores azuis que brilham
  const gc = abgr('#6ae0ff');
  const gw = abgr('#ffffff');
  const gs = abgr('#2a7a5a');
  for (const f of spec.glow ?? []) {
    dot(f.x, f.y + 1, gs);
    dot(f.x, f.y - 1, gc);
    dot(f.x - 1, f.y, gc);
    dot(f.x + 1, f.y, gc);
    dot(f.x, f.y, gw);
  }
  // tufos escuros contornando as clareiras
  if (spec.clearings?.length) {
    const d1 = abgr('#26562c');
    const d2 = abgr('#3f8a40');
    const d3 = abgr('#5cb04c');
    for (let i = 0; i < spec.clearings.length * 1500; i++) {
      const b = spec.clearings[i % spec.clearings.length];
      const x = Math.floor(b.x - b.rx * 1.2 + rng() * b.rx * 2.4);
      const y = Math.floor(b.y - b.ry * 1.2 + rng() * b.ry * 2.4);
      if (x < 2 || y < 4 || x >= w - 3 || y >= h - 2 || !clearM[y * w + x]) continue;
      if (clearM[y * w + x + 6] && clearM[y * w + x - 6] && clearM[(y + 6) * w + x] && clearM[(y - 6) * w + x]) continue;
      dot(x - 2, y, d1);
      dot(x + 2, y, d1);
      dot(x - 1, y - 1, d2);
      dot(x + 1, y - 1, d2);
      dot(x, y - 2, d3);
    }
  }
  ctx.putImageData(img, 0, 0);

  const info: GroundInfo = {
    w,
    h,
    isPath: (x, y) => at(pathM, Math.round(x), Math.round(y)) === 1,
    inWater: (x, y, grow = 0) => {
      let hit = false;
      for (const b of spec.waters ?? []) if (blobRadius(b, x, y, grow) < 1) hit = true;
      return hit;
    },
    inClear: (x, y) => at(clearM, Math.round(x), Math.round(y)) === 1,
  };
  spec.decor?.(ctx, rng, info);
  return { canvas: c, ...info };
}
