import * as THREE from 'three';

/**
 * Estampa do moletom do Matheus (baseada na foto de referência):
 * costas com cruz vermelha "enfaixada" e um coração, sobre moldura gótica cinza com asas;
 * mangas com ornamento cinza.
 * A estampa é projetada sobre a própria malha (acompanha a curvatura e a animação).
 */

const GREY = '#8d8a86';
const GREY_DARK = '#55524f';
const RED = '#b3221d';
const RED_DARK = '#6a0e0b';
const RED_LIGHT = '#d8473b';

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g, w, h);
  // borda transparente: fora da região a textura "esticada" não aparece
  g.clearRect(0, 0, w, 3);
  g.clearRect(0, h - 3, w, 3);
  g.clearRect(0, 0, 3, h);
  g.clearRect(w - 3, 0, 3, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wing(g: CanvasRenderingContext2D, x: number, y: number, s: number, dir: 1 | -1) {
  // asa: leque de penas saindo do centro para o lado
  for (let i = 0; i < 6; i++) {
    const a = (-0.2 + i * 0.22) * dir;
    const len = s * (1 - i * 0.09);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + Math.cos(a) * len * 0.6 * dir,
      y - Math.sin(Math.abs(a) + 0.6) * len * 0.5,
      x + Math.cos(a) * len * dir,
      y + i * s * 0.12 - s * 0.25,
    );
    g.lineWidth = s * 0.1;
    g.strokeStyle = i % 2 ? GREY : GREY_DARK;
    g.stroke();
  }
}

/** Desenho das costas (proporção 4:5). */
export function backPrintTexture() {
  return canvas(512, 640, (g, w, h) => {
    const cx = w / 2;

    // moldura gótica: arco apontado com bordas
    g.fillStyle = GREY_DARK;
    g.beginPath();
    g.moveTo(cx - w * 0.3, h * 0.82);
    g.lineTo(cx - w * 0.3, h * 0.3);
    g.quadraticCurveTo(cx - w * 0.28, h * 0.1, cx, h * 0.03);
    g.quadraticCurveTo(cx + w * 0.28, h * 0.1, cx + w * 0.3, h * 0.3);
    g.lineTo(cx + w * 0.3, h * 0.82);
    g.closePath();
    g.fill();
    g.lineWidth = w * 0.025;
    g.strokeStyle = GREY;
    g.stroke();
    // rendado da moldura (pontinhos)
    g.fillStyle = GREY;
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      g.beginPath();
      g.arc(cx - w * 0.3 + t * w * 0.6, h * 0.85, w * 0.012, 0, Math.PI * 2);
      g.fill();
    }

    // asas cinza saindo de trás da cruz
    wing(g, cx - w * 0.06, h * 0.5, w * 0.42, -1);
    wing(g, cx + w * 0.06, h * 0.5, w * 0.42, 1);

    // base: fileira de "estátuas" arredondadas
    g.fillStyle = GREY;
    for (let i = 0; i < 5; i++) {
      const x = cx - w * 0.32 + i * w * 0.16;
      g.beginPath();
      g.arc(x, h * 0.9, w * 0.065, Math.PI, 0);
      g.fill();
      g.fillStyle = GREY_DARK;
      g.beginPath();
      g.arc(x, h * 0.9, w * 0.03, Math.PI, 0);
      g.fill();
      g.fillStyle = GREY;
    }
    g.fillRect(cx - w * 0.4, h * 0.9, w * 0.8, h * 0.05);

    // cruz vermelha (travessa em cima, como na foto)
    const bar = w * 0.16;
    const top = h * 0.12;
    const bottom = h * 0.8;
    const armY = h * 0.27;
    const armL = cx - w * 0.27;
    const armR = cx + w * 0.27;
    g.fillStyle = RED;
    g.fillRect(cx - bar / 2, top, bar, bottom - top);
    g.fillRect(armL, armY, armR - armL, bar);
    g.lineWidth = w * 0.012;
    g.strokeStyle = RED_DARK;
    g.strokeRect(cx - bar / 2, top, bar, bottom - top);
    g.strokeRect(armL, armY, armR - armL, bar);
    // faixas enroladas na cruz
    g.save();
    g.beginPath();
    g.rect(cx - bar / 2, top, bar, bottom - top);
    g.rect(armL, armY, armR - armL, bar);
    g.clip();
    g.strokeStyle = RED_DARK;
    g.lineWidth = w * 0.01;
    for (let y = top - w; y < bottom + w; y += w * 0.045) {
      g.beginPath();
      g.moveTo(armL, y);
      g.lineTo(armR, y + w * 0.12);
      g.stroke();
    }
    g.restore();

    // coração no cruzamento
    const hx = cx;
    const hy = h * 0.47;
    const hs = w * 0.13;
    g.beginPath();
    g.moveTo(hx, hy + hs * 0.9);
    g.bezierCurveTo(hx - hs * 1.3, hy + hs * 0.1, hx - hs * 0.9, hy - hs * 0.9, hx, hy - hs * 0.35);
    g.bezierCurveTo(hx + hs * 0.9, hy - hs * 0.9, hx + hs * 1.3, hy + hs * 0.1, hx, hy + hs * 0.9);
    g.fillStyle = RED_LIGHT;
    g.fill();
    g.lineWidth = w * 0.014;
    g.strokeStyle = RED_DARK;
    g.stroke();
    // veias do coração
    g.beginPath();
    g.moveTo(hx - hs * 0.4, hy - hs * 0.2);
    g.quadraticCurveTo(hx, hy + hs * 0.1, hx + hs * 0.2, hy + hs * 0.5);
    g.moveTo(hx + hs * 0.45, hy - hs * 0.25);
    g.quadraticCurveTo(hx + hs * 0.1, hy, hx, hy + hs * 0.3);
    g.lineWidth = w * 0.008;
    g.stroke();
  });
}

/** Espiral que afina na ponta (redemoinhos barrocos). */
function spiral(g: CanvasRenderingContext2D, x: number, y: number, r: number, turns: number, dir: 1 | -1, width: number) {
  const steps = 40 * turns;
  let px = x;
  let py = y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = dir * t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.85);
    const nx = x + Math.cos(a) * rr;
    const ny = y + Math.sin(a) * rr;
    g.lineWidth = width * (1 - t * 0.7);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(nx, ny);
    g.stroke();
    px = nx;
    py = ny;
  }
}

/** Serpente: curva grossa com escamas (traços cruzados). */
function serpent(g: CanvasRenderingContext2D, pts: [number, number][], width: number) {
  g.lineWidth = width;
  g.strokeStyle = GREY;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i + 2 < pts.length + 1; i += 3) g.bezierCurveTo(...pts[i], ...pts[i + 1], ...pts[i + 2]);
  g.stroke();
  g.lineWidth = width * 0.55;
  g.strokeStyle = GREY_DARK;
  g.setLineDash([width * 0.35, width * 0.25]);
  g.stroke();
  g.setLineDash([]);
}

/** Frente (proporção 1:1): cruzinha vermelha no peito e estampa barroca cinza no meio. */
export function frontPrintTexture() {
  return canvas(512, 512, (g, w, h) => {
    const cx = w / 2;
    // cruzinha vermelha no peito, perto da gola
    g.fillStyle = RED;
    g.fillRect(cx - w * 0.016, h * 0.2, w * 0.032, h * 0.12);
    g.fillRect(cx - w * 0.045, h * 0.23, w * 0.09, h * 0.028);

    // estampa espalhada para os lados (sem eixo vertical no meio, que parecia gravata)
    // plumas nas laterais de cima
    wing(g, w * 0.3, h * 0.42, w * 0.22, -1);
    wing(g, w * 0.7, h * 0.42, w * 0.22, 1);

    // serpentes atravessando de um lado ao outro, em "S"
    serpent(g, [[w * 0.06, h * 0.55], [w * 0.3, h * 0.42], [w * 0.4, h * 0.72], [w * 0.62, h * 0.6], [w * 0.8, h * 0.5], [w * 0.85, h * 0.75], [w * 0.95, h * 0.68]], w * 0.05);
    serpent(g, [[w * 0.94, h * 0.86], [w * 0.7, h * 0.95], [w * 0.62, h * 0.72], [w * 0.4, h * 0.82], [w * 0.22, h * 0.9], [w * 0.15, h * 0.7], [w * 0.05, h * 0.78]], w * 0.045);

    // redemoinhos
    g.strokeStyle = GREY;
    spiral(g, w * 0.18, h * 0.62, w * 0.09, 1.6, 1, w * 0.02);
    spiral(g, w * 0.82, h * 0.6, w * 0.09, 1.6, -1, w * 0.02);
    g.strokeStyle = GREY_DARK;
    spiral(g, w * 0.5, h * 0.66, w * 0.07, 1.8, 1, w * 0.018);
    spiral(g, w * 0.3, h * 0.82, w * 0.06, 1.4, -1, w * 0.016);
    spiral(g, w * 0.7, h * 0.82, w * 0.06, 1.4, 1, w * 0.016);
  });
}

/** Mangas: corrente de estrelas pontudas ("arame farpado") com contorno claro. u = ao longo do braço. */
export function sleevePrintTexture() {
  return canvas(512, 128, (g, w, h) => {
    const star = (x: number, y: number, r: number) => {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? r * 0.28 : r;
        g.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr * 0.85);
      }
      g.closePath();
    };
    for (let i = 0; i < 4; i++) {
      const x = w * (0.14 + i * 0.24);
      star(x, h / 2, h * 0.4);
      g.fillStyle = '#5b5956';
      g.fill();
      g.lineWidth = h * 0.06;
      g.strokeStyle = '#e8e4dc';
      g.stroke();
    }
    // fio ligando as estrelas
    g.strokeStyle = '#e8e4dc';
    g.lineWidth = h * 0.035;
    g.beginPath();
    g.moveTo(w * 0.04, h / 2);
    g.lineTo(w * 0.96, h / 2);
    g.stroke();
  });
}

export interface PrintRegion {
  /** Retângulo no plano XY (espaço da geometria) onde a imagem é estampada. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Só estampa faces viradas para este lado (ex.: (0,0,-1) = costas). */
  facing: THREE.Vector3;
  /** Espelha a imagem na horizontal (vista de trás). */
  mirrorX?: boolean;
  /** Plano da projeção: 'xy' (frente/costas), 'xz' (de cima) ou 'zy' (laterais). Padrão 'xy'. */
  plane?: 'xy' | 'xz' | 'zy';
}

/**
 * Cria uma casca com esqueleto sobre `mesh`, só nas faces da região, com UV projetado
 * no plano escolhido para mostrar `texture`. Fica 3 mm acima da superfície.
 * Os limites "X/Y" da região referem-se aos dois eixos do plano (ex.: em 'zy', X = z).
 */
export function projectPrint(mesh: THREE.SkinnedMesh, region: PrintRegion, texture: THREE.Texture, material?: (m: THREE.MeshStandardMaterial) => THREE.Material) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = src.attributes.position;
  const tri = new THREE.Triangle();
  const fn = new THREE.Vector3();
  const plane = region.plane ?? 'xy';
  const U = (i: number, a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => (plane === 'zy' ? a.getZ(i) : a.getX(i));
  const V = (i: number, a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => (plane === 'xz' ? a.getZ(i) : a.getY(i));
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    tri.setFromAttributeAndIndices(pos, t, t + 1, t + 2).getNormal(fn);
    if (fn.dot(region.facing) < 0.15) continue;
    let inside = false;
    for (let k = 0; k < 3; k++) {
      const x = U(t + k, pos);
      const y = V(t + k, pos);
      if (x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY) inside = true;
    }
    if (inside) keep.push(t);
  }

  const geo = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    if (name === 'uv') continue;
    const a = src.attributes[name] as THREE.BufferAttribute;
    const arr = new (a.array.constructor as Float32ArrayConstructor)(keep.length * 3 * a.itemSize);
    keep.forEach((t, j) => {
      for (let q = 0; q < 3 * a.itemSize; q++) arr[j * 3 * a.itemSize + q] = a.array[t * a.itemSize + q];
    });
    geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    let u = (U(i, p) - region.minX) / (region.maxX - region.minX);
    if (region.mirrorX) u = 1 - u;
    uv[i * 2] = u;
    uv[i * 2 + 1] = (V(i, p) - region.minY) / (region.maxY - region.minY);
    p.setXYZ(i, p.getX(i) + n.getX(i) * 0.003, p.getY(i) + n.getY(i) * 0.003, p.getZ(i) + n.getZ(i) * 0.003);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();

  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  const base = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.4,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const print = new THREE.SkinnedMesh(geo, material ? material(base) : base);
  print.frustumCulled = false;
  print.castShadow = false;
  mesh.parent!.add(print);
  print.bind(mesh.skeleton, mesh.bindMatrix);
  return print;
}
