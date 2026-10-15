import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './noise';
import { applyWind } from './wind';

/**
 * Natureza low poly feita em código: pinheiros de camadas serrilhadas, árvores redondas, arbustos,
 * pedras, flores, troncos, cercas rústicas. Cada tipo é UMA geometria (cores por vértice, faces retas)
 * desenhada em muitas instâncias, então a floresta inteira custa poucas chamadas de desenho.
 */

// ---------- utilidades de geometria ----------

type Rand = () => number;

/** Só posição + cor, sem índice: o que `mergeGeometries` precisa. */
function bake(geo: THREE.BufferGeometry, color: (x: number, y: number, z: number, ny: number) => THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = color(pos.getX(i), pos.getY(i), pos.getZ(i), nor ? nor.getY(i) : 0);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos.clone());
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Cada triângulo ganha um tom um pouco diferente: a cara de "talhado à mão" do low poly. */
function facetVariation(geo: THREE.BufferGeometry, rand: Rand, amount: number) {
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  for (let t = 0; t < col.count; t += 3) {
    const k = 1 + (rand() - 0.5) * 2 * amount;
    for (let v = 0; v < 3; v++) col.setXYZ(t + v, col.getX(t + v) * k, col.getY(t + v) * k, col.getZ(t + v) * k);
  }
}

const hex = (h: number) => new THREE.Color(h);

function finish(parts: THREE.BufferGeometry[], rand: Rand, facet = 0.07) {
  const g = mergeGeometries(parts, false)!;
  facetVariation(g, rand, facet);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  parts.forEach((p) => p.dispose());
  return g;
}

// ---------- pinheiro ----------

export interface PineStyle {
  /** Cor da ponta clara de cada camada e da base escura. */
  light: number;
  dark: number;
  /** Cor da parte de baixo das camadas (print 2: amarelada). */
  under: number;
  trunk?: number;
}

export const PINE_STYLES: Record<'sunny' | 'green' | 'deep', PineStyle> = {
  sunny: { light: 0xb4d65a, dark: 0x74a838, under: 0x4d7a26 },
  green: { light: 0x86c04a, dark: 0x468a30, under: 0x2f5f25 },
  deep: { light: 0x4f9e4a, dark: 0x1f6234, under: 0xb9a944 },
};

/** Pinheiro de 10 m de altura: tronco + camadas de cones serrilhados que diminuem para o topo. */
export function pineGeometry(seed: number, style: PineStyle, tiers = 5, radial = 9): THREE.BufferGeometry {
  const rand = rng(seed);
  const H = 10;
  const R = 2.9;
  const parts: THREE.BufferGeometry[] = [];
  const light = hex(style.light);
  const dark = hex(style.dark);
  const under = hex(style.under);

  const trunk = new THREE.CylinderGeometry(0.16, 0.34, H * 0.34, 5, 1, true).translate(0, H * 0.17, 0);
  parts.push(bake(trunk, (_x, y) => hex(style.trunk ?? 0x6b4527).multiplyScalar(0.8 + 0.4 * (y / (H * 0.34)))));

  for (let i = 0; i < tiers; i++) {
    const t = tiers === 1 ? 0 : i / (tiers - 1);
    const th = H * (0.31 - 0.03 * t);
    const yb = H * 0.15 + t * H * 0.55;
    const r = R * (1 - 0.8 * t) * (0.94 + rand() * 0.12) + 0.15;
    const cone = new THREE.ConeGeometry(r, th, radial, 1, false);
    cone.rotateY(rand() * Math.PI);
    const pos = cone.getAttribute('position');
    for (let v = 0; v < pos.count; v++) {
      if (pos.getY(v) > -th / 2 + 1e-4) continue; // só o anel da base
      const a = Math.atan2(pos.getZ(v), pos.getX(v));
      const flap = Math.round(a / ((Math.PI * 2) / radial)) % 2 === 0;
      const k = flap ? 1 : 0.74;
      pos.setX(v, pos.getX(v) * k * (0.93 + rand() * 0.14));
      pos.setZ(v, pos.getZ(v) * k * (0.93 + rand() * 0.14));
      pos.setY(v, pos.getY(v) + (flap ? -0.08 : 0.28) * th * 0.5);
    }
    cone.translate(0, yb + th / 2, 0);
    const lift = 0.78 + 0.22 * t;
    parts.push(
      bake(cone, (_x, y, _z, ny) => {
        if (ny < -0.5) return under.clone().multiplyScalar(0.9);
        const f = THREE.MathUtils.clamp((y - yb) / th, 0, 1);
        return dark.clone().lerp(light, f * 0.9).multiplyScalar(lift + 0.2 * f);
      }),
    );
  }
  return finish(parts, rand);
}

// ---------- árvore redonda, arbusto, pedra ----------

function blob(rand: Rand, radius: number, detail: number, squash: number, jitter: number) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.getAttribute('position');
  const seen = new Map<string, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    // vértices repetidos (mesma posição) precisam do mesmo deslocamento
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = seen.get(key);
    if (!d) {
      d = new THREE.Vector3((rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter);
      seen.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d.x, (pos.getY(i) + d.y) * squash, pos.getZ(i) + d.z);
  }
  return g;
}

/** Árvore redonda de 7 m: tronco curto e copa de blocos. */
export function roundTreeGeometry(seed: number, leaf = 0x5aa83a, leafLight = 0x9ccf4a): THREE.BufferGeometry {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  parts.push(bake(new THREE.CylinderGeometry(0.22, 0.4, 3.2, 6, 1, true).translate(0, 1.6, 0), (_x, y) => hex(0x6e4a2a).multiplyScalar(0.8 + y * 0.08)));
  const dark = hex(leaf);
  const lite = hex(leafLight);
  for (const [x, y, z, r] of [
    [0, 5.1, 0, 2.5],
    [1.3, 4.3, 0.5, 1.7],
    [-1.2, 4.6, -0.4, 1.8],
    [0.1, 6.5, -0.2, 1.5],
  ] as const) {
    const b = blob(rand, r, 1, 0.85, r * 0.22).translate(x, y, z);
    parts.push(bake(b, (_x, py) => dark.clone().lerp(lite, THREE.MathUtils.clamp((py - 3) / 4.5, 0, 1))));
  }
  return finish(parts, rand, 0.08);
}

/** Arbusto de 1 m. */
export function bushGeometry(seed: number, base = 0x4f9a34, tip = 0x8fc548): THREE.BufferGeometry {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const dark = hex(base);
  const lite = hex(tip);
  for (const [x, z, r] of [[0, 0, 0.7], [0.55, 0.2, 0.5], [-0.5, -0.15, 0.55]] as const) {
    parts.push(bake(blob(rand, r, 1, 0.8, r * 0.3).translate(x, r * 0.55, z), (_x, y) => dark.clone().lerp(lite, THREE.MathUtils.clamp(y / 1.0, 0, 1))));
  }
  return finish(parts, rand, 0.09);
}

/** Pedra de ~1 m, achatada, de faces cinza em tons variados. */
export function rockGeometry(seed: number, tone = 0x8d8c86): THREE.BufferGeometry {
  const rand = rng(seed);
  const base = hex(tone);
  const g = blob(rand, 0.7, 0, 0.72, 0.5).translate(0, 0.28, 0);
  return finish([bake(g, (_x, y) => base.clone().multiplyScalar(0.8 + 0.35 * THREE.MathUtils.clamp(y / 0.6, 0, 1)))], rand, 0.1);
}

/** Pedrinha da trilha (~0,25 m). */
export function pebbleGeometry(seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const base = hex(0xa39e92);
  const g = blob(rand, 0.14, 0, 0.6, 0.12).translate(0, 0.05, 0);
  return finish([bake(g, () => base.clone())], rand, 0.14);
}

// ---------- flores, troncos, cogumelos ----------

/** Tremoço: haste verde e espiga colorida (a cor vem da instância). */
export function lupineGeometry(): THREE.BufferGeometry {
  const stem = bake(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4, 1, true).translate(0, 0.22, 0), () => hex(0x4d8a2f));
  const spike = bake(new THREE.ConeGeometry(0.075, 0.42, 5).translate(0, 0.62, 0), (_x, y) => new THREE.Color(1, 1, 1).multiplyScalar(0.7 + 0.5 * THREE.MathUtils.clamp((0.83 - y) * 3, 0, 1)));
  return finish([stem, spike], rng(3), 0.05);
}

/** Margarida: haste curta e miolo achatado (a cor da pétala vem da instância). */
export function daisyGeometry(): THREE.BufferGeometry {
  const stem = bake(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 4, 1, true).translate(0, 0.11, 0), () => hex(0x4d8a2f));
  const head = bake(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 7).translate(0, 0.23, 0), (_x, y, _z, ny) => (ny > 0.5 ? new THREE.Color(1, 1, 1) : hex(0xffc23a)).multiplyScalar(y > 0.23 ? 1 : 0.8));
  return finish([stem, head], rng(4), 0.04);
}

/** Tronco caído de 3 m, deitado ao longo de x. */
export function logGeometry(seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const g = new THREE.CylinderGeometry(0.3, 0.36, 3.2, 7).rotateZ(Math.PI / 2).translate(0, 0.32, 0);
  return finish([bake(g, (x, _y, _z, ny) => (Math.abs(ny) < 0.5 && Math.abs(x) > 1.59 ? hex(0xcaa46a) : hex(0x6e4a2a)))], rand, 0.08);
}

/** Toco de árvore de 0,5 m. */
export function stumpGeometry(): THREE.BufferGeometry {
  const rand = rng(8);
  const g = new THREE.CylinderGeometry(0.34, 0.44, 0.55, 7).translate(0, 0.27, 0);
  return finish([bake(g, (_x, _y, _z, ny) => (ny > 0.5 ? hex(0xcaa46a) : hex(0x6e4a2a)))], rand, 0.08);
}

/** Cogumelo de 0,35 m (a cor do chapéu vem da instância). */
export function mushroomGeometry(): THREE.BufferGeometry {
  const stem = bake(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 5, 1, true).translate(0, 0.1, 0), () => hex(0xe8dcc0));
  const cap = bake(new THREE.SphereGeometry(0.13, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.2, 0), () => new THREE.Color(1, 1, 1));
  return finish([stem, cap], rng(9), 0.04);
}

// ---------- cerca rústica ----------

export const FENCE_SEGMENT = 2.6;

/** Um vão de cerca de 2,6 m ao longo de +x: um mourão torto à esquerda e duas travessas. */
export function fenceGeometry(seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const wood = hex(0xa5612c);
  const parts: THREE.BufferGeometry[] = [];
  const post = new THREE.BoxGeometry(0.2, 1.35, 0.2).translate(0, 0.62, 0);
  post.rotateZ((rand() - 0.5) * 0.08);
  parts.push(bake(post, (_x, y, _z, ny) => (ny > 0.5 ? hex(0xc59258) : wood.clone().multiplyScalar(0.8 + 0.25 * (y / 1.3)))));
  for (const [y, tilt] of [[0.5, 0.03], [0.95, -0.025]] as const) {
    const rail = new THREE.BoxGeometry(FENCE_SEGMENT, 0.13, 0.09).translate(FENCE_SEGMENT / 2, y, 0);
    rail.rotateZ(tilt);
    parts.push(bake(rail, () => wood.clone().multiplyScalar(0.92)));
  }
  return finish(parts, rand, 0.06);
}

// ---------- instâncias ----------

export interface Inst {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  /** Escala uniforme. */
  scale?: number;
  /** Escala só na altura (somada à uniforme). */
  tall?: number;
  /** Inclinação em torno do eixo x (radianos). */
  tilt?: number;
  color?: THREE.Color;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function natureMaterial(sway = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
  if (sway > 0) applyWind(m, { sway });
  return m;
}

/** Um InstancedMesh com todas as instâncias da lista. */
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: readonly Inst[], opts: { cast?: boolean; receive?: boolean } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  list.forEach((it, i) => {
    const s = it.scale ?? 1;
    _e.set(it.tilt ?? 0, it.rotY ?? 0, 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(it.x, it.y, it.z);
    _s.set(s, s * (it.tall ?? 1), s);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    if (it.color) mesh.setColorAt(i, it.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Como `instanced`, mas separa as instâncias em blocos de `size` metros: cada bloco é um InstancedMesh com
 * a própria esfera de visibilidade, então o que está fora da tela (ou fora da caixa de sombra do sol) não é desenhado.
 */
export function instancedChunked(geo: THREE.BufferGeometry, mat: THREE.Material, list: readonly Inst[], opts: { cast?: boolean; receive?: boolean; size?: number } = {}) {
  const size = opts.size ?? 44;
  const cells = new Map<string, Inst[]>();
  for (const it of list) {
    const k = `${Math.floor(it.x / size)}:${Math.floor(it.z / size)}`;
    const a = cells.get(k);
    if (a) a.push(it);
    else cells.set(k, [it]);
  }
  const group = new THREE.Group();
  for (const part of cells.values()) group.add(instanced(geo, mat, part, opts));
  return group;
}

/** Variação de tom por instância (perto de branco: multiplica a cor da geometria). */
export function tint(rand: Rand, amount = 0.14, warm = 0.04) {
  const k = 1 + (rand() - 0.5) * 2 * amount;
  return new THREE.Color(k * (1 + warm * (rand() - 0.3)), k, k * (1 - warm * (rand() - 0.3)));
}

/**
 * Cerca ao longo de uma linha de pontos: um InstancedMesh de vãos que acompanham o terreno.
 * Devolve também onde pôr colisores (um círculo a cada ~1,3 m).
 */
export function fenceLine(points: readonly [number, number][], ground: (x: number, z: number) => number, seed = 21) {
  const rand = rng(seed);
  const geo = fenceGeometry(seed);
  const list: Inst[] = [];
  const blockers: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / FENCE_SEGMENT));
    const ang = Math.atan2(-(bz - az), bx - ax); // +x local → direção do trecho
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const y0 = ground(x0, z0);
      const y1 = ground(x1, z1);
      const horizontal = Math.hypot(x1 - x0, z1 - z0);
      list.push({
        x: x0,
        y: y0 - 0.05,
        z: z0,
        rotY: ang + (rand() - 0.5) * 0.04,
        scale: 1,
        tall: 1,
        color: tint(rand, 0.08),
      });
      // acompanha a inclinação do terreno: a escala em x estica o vão até o próximo mourão
      const last = list[list.length - 1];
      last.tilt = 0;
      (last as Inst & { sx?: number; slope?: number }).sx = horizontal / FENCE_SEGMENT;
      (last as Inst & { sx?: number; slope?: number }).slope = Math.atan2(y1 - y0, horizontal);
      for (let c = 0; c <= horizontal; c += 1.3) blockers.push([x0 + (x1 - x0) * (c / horizontal), z0 + (z1 - z0) * (c / horizontal)]);
    }
  }

  const mesh = new THREE.InstancedMesh(geo, natureMaterial(0), Math.max(1, list.length));
  mesh.count = list.length;
  list.forEach((it, i) => {
    const sx = (it as Inst & { sx?: number }).sx ?? 1;
    const slope = (it as Inst & { slope?: number }).slope ?? 0;
    _e.set(0, it.rotY ?? 0, slope, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(it.x, it.y, it.z);
    _s.set(sx, 1, 1);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    mesh.setColorAt(i, it.color!);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return { mesh, blockers };
}
