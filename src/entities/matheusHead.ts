import * as THREE from 'three';
import { projectPrint } from './hoodiePrint';
import { faceDecalTexture } from './tattoos';

/**
 * Personaliza a cabeça do Knight (KayKit) para ficar parecida com o Matheus (estilo fofo):
 *  - tira o topete e as sobrancelhas "bravas" do original
 *  - arredonda o maxilar, aumenta os olhos e diminui o nariz
 *  - cabelo: mechas onduladas em posições fixas (franja para o lado, volume no topo, nuca)
 *    + degradê na pele nas laterais
 *  - barba curta e bigode colados ao rosto (uma casca que acompanha a pele), com borda esfumada
 *  - sobrancelhas, brilho dos olhos, bochechas rosadas e os dois traços do rosto são PINTADOS na
 *    pele (projeção sobre a malha), então nada flutua; piercing na sobrancelha direita e brincos
 * Tudo é medido na própria malha, na pose de repouso, e preso ao osso da cabeça.
 */

/** Uma mecha: caminho sobre a cabeça a partir do centro, em azimute/elevação (graus). */
interface HairLock {
  /** Azimute inicial e final: 0 = frente, +90 = lado esquerdo dele (+X), 180 = nuca. */
  az: [number, number];
  /** Elevação inicial e final acima da horizontal (90 = topo). */
  el: [number, number];
  /** Meia largura na raiz (fração da largura da cabeça). */
  w: number;
  /** Altura sobre o couro cabeludo na raiz e na ponta (fração da largura da cabeça). */
  lift: [number, number];
  /** Quantas ondas ao longo da mecha e a amplitude delas (fração da largura da cabeça). */
  waves: number;
  amp: number;
  /** Onde a mecha para: 'brow' = acima das sobrancelhas; número = fração da altura do rosto acima dos olhos. */
  limit?: 'brow' | number;
}

const FRINGE = { w: 0.085, lift: [0.012, 0.03] as [number, number], waves: 1.25, amp: 0.045, limit: 'brow' as const };
const TOP = { w: 0.1, lift: [0.03, 0.05] as [number, number], waves: 1, amp: 0.05, limit: 0.12 };
const BACK = { w: 0.11, lift: [0.015, 0.03] as [number, number], waves: 1.25, amp: 0.035, limit: 0.12 };
const SIDE = { w: 0.08, lift: [0.012, 0.022] as [number, number], waves: 1, amp: 0.025, limit: 0.14 };

const HAIR_LOCKS: HairLock[] = [
  // franja: sai do alto da cabeça e cai na testa, penteada para o lado +X
  { ...FRINGE, az: [-40, -22], el: [78, -4] },
  { ...FRINGE, az: [-24, -4], el: [82, 2] },
  { ...FRINGE, az: [-8, 14], el: [84, -6] },
  { ...FRINGE, az: [8, 32], el: [84, 0] },
  { ...FRINGE, az: [24, 48], el: [82, -2] },
  { ...FRINGE, az: [40, 66], el: [78, 8] },
  // topo: volume
  { ...TOP, az: [-50, -34], el: [88, 56] },
  { ...TOP, az: [-20, -6], el: [90, 52] },
  { ...TOP, az: [10, 24], el: [90, 54] },
  { ...TOP, az: [38, 56], el: [86, 50] },
  { ...TOP, az: [-80, -64], el: [82, 46] },
  { ...TOP, az: [66, 86], el: [82, 46] },
  // nuca: descem da coroa até o início do degradê
  { ...BACK, az: [105, 115], el: [74, 20] },
  { ...BACK, az: [128, 138], el: [78, 20] },
  { ...BACK, az: [151, 161], el: [76, 20] },
  { ...BACK, az: [174, 184], el: [80, 20] },
  { ...BACK, az: [197, 207], el: [76, 20] },
  { ...BACK, az: [220, 230], el: [78, 20] },
  { ...BACK, az: [243, 253], el: [74, 20] },
  // laterais: curtas, acabam onde o degradê começa
  { ...SIDE, az: [72, 84], el: [62, 28] },
  { ...SIDE, az: [98, 110], el: [52, 26] },
  { ...SIDE, az: [276, 288], el: [62, 28] },
  { ...SIDE, az: [250, 262], el: [52, 26] },
];

export const HEAD_STYLE = {
  hair: 0x2a1a11, // mechas
  hairBase: 0x2e1d13, // base do cabelo (o degradê das laterais parte desta cor)
  beard: 0x47301f,
  noseSize: 0.45, // 1 = nariz original
  eyeSize: 1.05, // olhos grandes e fofos (1 = original)
  eyeStretchY: 1.12, // olho um pouco mais alto que largo
  jawRound: 0.35, // 0 = maxilar quadrado do original … 1 = bem redondo
  neckLift: 0.08, // a cabeça sobe isso para sobrar pescoço (senão a tatuagem do pescoço não aparece)
  mouthSize: 0.5, // largura visível da boca (a barba cobre os cantos)
  fadeLow: -0.38, // degradê: pele na altura dos olhos + fadeLow…
  fadeHigh: 0.2, // …até cabelo cheio em fadeHigh (frações da altura da cabeça)
  beardThickness: 0.012, // barba rente ao rosto
  beardCheekDrop: 0.12, // nas bochechas a barba só começa tanto abaixo do nariz (fração da altura do rosto)
  beardFuzz: 0.03, // largura da borda esfumada da barba
  brow: { len: 0.17, thick: 0.05, gap: 0.045 }, // frações: largura, altura e altura (folga acima do olho)
  locks: HAIR_LOCKS,
};

const cellOf = (u: number, v: number) => `r${Math.min(3, Math.floor(v * 4))}c${Math.min(7, Math.floor(u * 8))}`;

/** Gera números pseudo-aleatórios repetíveis (o visual não muda a cada carregamento). */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Nova geometria só com os triângulos aprovados por `keep` (sem índice). */
export function filterTriangles(geo: THREE.BufferGeometry, keep: (t: number) => boolean) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const tris: number[] = [];
  for (let t = 0; t < src.attributes.position.count; t += 3) if (keep(t)) tris.push(t);
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const a = src.attributes[name] as THREE.BufferAttribute;
    const arr = new (a.array.constructor as Float32ArrayConstructor)(tris.length * 3 * a.itemSize);
    tris.forEach((t, j) => {
      for (let q = 0; q < 3 * a.itemSize; q++) arr[j * 3 * a.itemSize + q] = a.array[t * a.itemSize + q];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  return out;
}

export interface HeadParts {
  /** Materiais criados aqui (para o chamador aplicar o ajuste de luz). */
  hairMaterial: THREE.MeshStandardMaterial;
  beardMaterial: THREE.MeshStandardMaterial;
  extraMaterials: THREE.MeshStandardMaterial[];
}

/**
 * `head` precisa estar na pose de repouso com matrizes atualizadas e o personagem na origem
 * (espaço do mundo = espaço do modelo).
 */
export function customizeHead(head: THREE.SkinnedMesh, headBone: THREE.Bone, skinColor: THREE.Color): HeadParts {
  const S = HEAD_STYLE;
  const rand = seeded(7);
  const base = head.geometry.index ? head.geometry.toNonIndexed() : head.geometry.clone();
  base.translate(0, S.neckLift, 0); // tudo o que é medido daqui em diante já conta com o pescoço
  const pos = base.attributes.position;
  const uv = base.attributes.uv;
  const cell = (i: number) => cellOf(uv.getX(i), uv.getY(i));
  const centroid = (t: number, out: THREE.Vector3) =>
    out.set(
      (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3,
      (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3,
      (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3,
    );

  // Na pose de repouso, posição da geometria → mundo é só a matrixWorld da malha.
  const toWorld = head.matrixWorld.clone();
  const skinBox = () => {
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) if (cell(i) === 'r0c0') b.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
    return b;
  };
  let box = skinBox();
  let size = box.getSize(new THREE.Vector3());
  let center = box.getCenter(new THREE.Vector3());

  // ---------- maxilar arredondado: "esferifica" só a metade de baixo da cabeça ----------
  {
    let eyeY0 = 0;
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      if (cell(i) !== 'r0c2') continue;
      eyeY0 += pos.getY(i);
      n++;
    }
    eyeY0 = n ? eyeY0 / n : center.y;
    const half = size.clone().multiplyScalar(0.5);
    const span = Math.max(1e-4, eyeY0 - box.min.y);
    const q = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((eyeY0 - pos.getY(i)) / span, 0, 1);
      if (t <= 0) continue;
      const weight = t * t * (3 - 2 * t) * S.jawRound;
      q.set((pos.getX(i) - center.x) / half.x, (pos.getY(i) - center.y) / half.y, (pos.getZ(i) - center.z) / half.z);
      const len = q.length();
      if (len < 1e-4) continue;
      const f = 1 + (Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z)) / len - 1) * weight;
      pos.setXYZ(i, center.x + q.x * half.x * f, center.y + q.y * half.y * f, center.z + q.z * half.z * f);
    }
    // as medidas seguintes já usam a forma nova
    box = skinBox();
    size = box.getSize(new THREE.Vector3());
    center = box.getCenter(new THREE.Vector3());
  }

  // ---------- olhos ----------
  const eyeL = new THREE.Vector3();
  const eyeR = new THREE.Vector3();
  let nL = 0;
  let nR = 0;
  let eyeFront = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (cell(i) !== 'r0c2') continue;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    eyeFront = Math.max(eyeFront, p.z);
    if (p.x > center.x) {
      eyeL.add(p);
      nL++;
    } else {
      eyeR.add(p);
      nR++;
    }
  }
  eyeL.divideScalar(Math.max(1, nL));
  eyeR.divideScalar(Math.max(1, nR));
  const eyeY = (eyeL.y + eyeR.y) / 2;
  // olhos maiores e um pouco mais altos: escala cada olho em torno do próprio centro
  const eyeBoxes = [new THREE.Box3(), new THREE.Box3()]; // [lado +X, lado −X]
  for (let i = 0; i < pos.count; i++) {
    if (cell(i) !== 'r0c2') continue;
    const left = pos.getX(i) > center.x;
    const e = left ? eyeL : eyeR;
    pos.setX(i, e.x + (pos.getX(i) - e.x) * S.eyeSize);
    pos.setY(i, e.y + (pos.getY(i) - e.y) * S.eyeSize * S.eyeStretchY);
    eyeBoxes[left ? 0 : 1].expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
  }
  const eyes = eyeBoxes.map((b) => {
    const s = b.getSize(new THREE.Vector3());
    const c = b.getCenter(new THREE.Vector3());
    return { x: c.x, y: c.y, rx: s.x / 2, ry: s.y / 2 };
  });
  const eyeRy = (eyes[0].ry + eyes[1].ry) / 2;

  // sobrancelhas: medidas em unidades da cabeça (o desenho é feito na textura do rosto)
  const browLen = size.x * S.brow.len;
  const browThick = size.y * S.brow.thick;
  const browOff = eyeRy + size.y * S.brow.gap + browThick / 2; // do centro do olho ao centro do traço
  const browTop = eyeY + browOff + browThick * 0.9;

  // ---------- nariz menor ----------
  const noseHalfW = size.x * 0.13;
  const noseTop = eyeY + size.y * 0.03;
  const noseBottomLimit = eyeY - size.y * 0.24;
  let noseBase = Infinity;
  let noseBottom = Infinity;
  const isNose = (x: number, y: number, z: number) =>
    Math.abs(x - center.x) < noseHalfW && y < noseTop && y > noseBottomLimit && z > eyeFront - 0.02;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (cell(i) === 'r0c0' && isNose(x, y, z)) {
      noseBase = Math.min(noseBase, z);
      noseBottom = Math.min(noseBottom, y);
    }
  }
  if (isFinite(noseBase)) {
    const noseCenterY = (noseTop + noseBottom) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (!isNose(x, y, z) || cell(i) !== 'r0c0') continue;
      const k = S.noseSize;
      pos.setXYZ(
        i,
        center.x + (x - center.x) * (0.4 + 0.6 * k),
        noseCenterY + (y - noseCenterY) * (0.5 + 0.5 * k),
        noseBase + (z - noseBase) * k,
      );
    }
  } else {
    noseBottom = eyeY - size.y * 0.18;
  }

  // ---------- boca: relevo abaixo do nariz com a face virada para cima ----------
  const mouth = new THREE.Box3();
  const c = new THREE.Vector3();
  {
    const tri = new THREE.Triangle();
    const fn = new THREE.Vector3();
    for (let t = 0; t < pos.count; t += 3) {
      if (cell(t) !== 'r0c0') continue;
      centroid(t, c);
      if (Math.abs(c.x - center.x) > size.x * 0.22) continue;
      if (c.y > noseBottom || c.y < noseBottom - size.y * 0.22) continue;
      if (c.z < center.z + size.z * 0.25) continue;
      tri.setFromAttributeAndIndices(pos, t, t + 1, t + 2).getNormal(fn);
      if (fn.y > 0.45) mouth.expandByPoint(c);
    }
    if (!mouth.isEmpty()) mouth.expandByVector(new THREE.Vector3(0.03, 0.025, 0.2));
  }

  // ---------- tira as sobrancelhas originais; o couro cabeludo (r0c1) fica ----------
  const isBrow = (t: number) => {
    centroid(t, c);
    return c.y < eyeY + size.y * 0.22 && c.z > center.z;
  };
  // a malha da cabeça fica só com pele, olhos, boca e a base do cabelo (couro cabeludo)
  const headGeo = filterTriangles(base, (t) => !(cell(t) === 'r0c1' && isBrow(t)));
  head.geometry = headGeo;

  // ---------- degradê: cor por vértice no cabelo-base (pele embaixo → cabelo em cima) ----------
  // A célula do cabelo na paleta fica branca (matheusModel) e a cor vem daqui.
  {
    const hp = headGeo.attributes.position;
    const hu = headGeo.attributes.uv;
    const colors = new Float32Array(hp.count * 3);
    const hairC = new THREE.Color(S.hairBase);
    const stubble = skinColor.clone().lerp(hairC, 0.72).multiplyScalar(0.8);
    const cc = new THREE.Color();
    const low = eyeY + size.y * S.fadeLow;
    const high = eyeY + size.y * S.fadeHigh;
    const fadeAt = (y: number) => {
      const t = THREE.MathUtils.smoothstep(y, low, high);
      return cc.copy(skinColor).lerp(stubble, Math.min(1, t * 2)).lerp(hairC, Math.max(0, t * 2 - 1) ** 0.7);
    };
    for (let i = 0; i < hp.count; i++) {
      const cl = cellOf(hu.getX(i), hu.getY(i));
      if (cl === 'r0c1') {
        fadeAt(hp.getY(i));
        colors.set([cc.r, cc.g, cc.b], i * 3);
        continue;
      }
      // pele da nuca e das laterais (atrás das orelhas) também escurece no degradê;
      // aqui a cor por vértice multiplica a textura da pele, então vai como fator
      const dx = Math.abs(hp.getX(i) - center.x);
      const behindFace = hp.getZ(i) < center.z - size.z * 0.05;
      if (cl === 'r0c0' && behindFace && dx < size.x * 0.44) {
        fadeAt(hp.getY(i));
        colors.set([cc.r / skinColor.r, cc.g / skinColor.g, cc.b / skinColor.b], i * 3);
        continue;
      }
      colors.set([1, 1, 1], i * 3);
    }
    headGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (head.material as THREE.MeshStandardMaterial).vertexColors = true;
  }

  // ---------- pintura do rosto: sobrancelhas, brilho dos olhos, bochechas e traços ----------
  const decalRect = {
    minX: center.x - size.x * 0.46,
    maxX: center.x + size.x * 0.46,
    minY: eyeY - size.y * 0.44,
    maxY: eyeY + size.y * 0.26,
  };
  const decal = projectPrint(
    head,
    { ...decalRect, facing: new THREE.Vector3(0, 0, 1), soft: true },
    faceDecalTexture({
      rect: decalRect,
      eyes,
      brow: { len: browLen, thick: browThick, y: browOff, color: '#2a1a11' },
      blush: { drop: eyeRy + size.y * 0.1, rx: size.x * 0.075, ry: size.y * 0.05, out: size.x * 0.02 },
      tattoo: { x: eyes[1].x - eyes[1].rx - size.x * 0.07, y: eyeY - size.y * 0.01, h: size.y * 0.075, gap: size.x * 0.028 },
      smile: mouth.isEmpty()
        ? undefined
        : { x: mouth.getCenter(c).x, y: mouth.getCenter(c).y, w: size.x * 0.085, thick: size.y * 0.012 },
    }),
  );
  decal.name = 'Matheus_FaceDecal';
  const decalMaterial = decal.material as THREE.MeshStandardMaterial;

  // ---------- cabelo: mechas onduladas sobre o couro cabeludo ----------
  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const boneInv = headBone.matrixWorld.clone().invert();
  {
    const hp = headGeo.attributes.position;
    // todos os triângulos da cabeça, para lançar raios a partir do centro
    const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const origin = new THREE.Box3().setFromBufferAttribute(hp as THREE.BufferAttribute).getCenter(new THREE.Vector3());
    for (let t = 0; t < hp.count; t += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(hp, t);
      const b = new THREE.Vector3().fromBufferAttribute(hp, t + 1);
      const d = new THREE.Vector3().fromBufferAttribute(hp, t + 2);
      const n = new THREE.Triangle(a, b, d).getNormal(new THREE.Vector3());
      const mid = a.clone().add(b).add(d).divideScalar(3);
      if (n.dot(mid.sub(origin)) < 0) n.negate();
      tris.push({ a, b, c: d, n });
    }
    const ray = new THREE.Ray(origin, new THREE.Vector3());
    const tmp = new THREE.Vector3();
    const DEG = Math.PI / 180;
    /** Ponto da superfície da cabeça e normal suave, na direção (azimute, elevação) a partir do centro. */
    const surface = (az: number, el: number) => {
      const a = az * DEG;
      const e = el * DEG;
      ray.direction.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      let best = Infinity;
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (const t of tris) {
        if (!ray.intersectTriangle(t.a, t.b, t.c, false, tmp)) continue;
        const d = tmp.distanceToSquared(origin);
        if (d < best) {
          best = d;
          p.copy(tmp);
          n.copy(t.n);
        }
      }
      if (!isFinite(best)) return null;
      // mistura a normal da face com a direção radial: a mecha não "pula" entre faces planas
      n.multiplyScalar(0.4).addScaledVector(ray.direction, 0.6).normalize();
      return { p, n };
    };

    const W = size.x;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const root = new THREE.Color();
    const tip = new THREE.Color();
    const col = new THREE.Color();
    const SEG = 6; // seção em forma de lente

    for (const lock of S.locks) {
      const limitY = lock.limit === 'brow' || lock.limit === undefined ? browTop + size.y * 0.035 : eyeY + size.y * lock.limit;
      // caminho sobre a superfície (para ao chegar no limite)
      const N = 18;
      let pts: THREE.Vector3[] = [];
      const nrm: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const hit = surface(THREE.MathUtils.lerp(lock.az[0], lock.az[1], t), THREE.MathUtils.lerp(lock.el[0], lock.el[1], t));
        if (!hit || (i > 0 && hit.p.y < limitY)) break;
        pts.push(hit.p);
        nrm.push(hit.n);
      }
      if (pts.length < 4) continue;
      // suaviza o caminho (a superfície é cheia de quinas)
      for (let pass = 0; pass < 2; pass++) {
        pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : pts[i - 1].clone().add(p.clone().multiplyScalar(2)).add(pts[i + 1]).multiplyScalar(0.25)));
      }
      const M = pts.length;
      const phase = rand() * Math.PI * 2;
      // linha central: sobe da pele (lift) e balança para o lado (onda)
      const cl: THREE.Vector3[] = [];
      const lat = new THREE.Vector3();
      const tan = new THREE.Vector3();
      for (let i = 0; i < M; i++) {
        const t = i / (M - 1);
        tan.copy(pts[Math.min(M - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
        lat.crossVectors(tan, nrm[i]).normalize();
        const lift = THREE.MathUtils.lerp(lock.lift[0], lock.lift[1], t) * W;
        const wave = Math.sin(t * lock.waves * Math.PI * 2 + phase) * lock.amp * W * THREE.MathUtils.smoothstep(t, 0, 0.3);
        cl.push(pts[i].clone().addScaledVector(nrm[i], lift).addScaledVector(lat, wave));
      }
      // variação de tom multiplicativa (offsetHSL em espaço linear clareia demais cores escuras)
      root.setHex(S.hair).multiplyScalar(0.85 + rand() * 0.3);
      tip.copy(root).multiplyScalar(1.35);

      const first = positions.length / 3;
      const up = new THREE.Vector3();
      for (let i = 0; i < M; i++) {
        const t = i / (M - 1);
        tan.copy(cl[Math.min(M - 1, i + 1)]).sub(cl[Math.max(0, i - 1)]).normalize();
        lat.crossVectors(tan, nrm[i]).normalize();
        up.crossVectors(lat, tan).normalize();
        const w = lock.w * W * Math.max(0.2, 1 - 0.78 * Math.pow(t, 1.6));
        const thick = w * 0.5 + 0.004;
        col.copy(root).lerp(tip, t);
        for (let k = 0; k < SEG; k++) {
          const a = (k / SEG) * Math.PI * 2;
          positions.push(
            cl[i].x + lat.x * Math.cos(a) * w + up.x * Math.sin(a) * thick,
            cl[i].y + lat.y * Math.cos(a) * w + up.y * Math.sin(a) * thick,
            cl[i].z + lat.z * Math.cos(a) * w + up.z * Math.sin(a) * thick,
          );
          colors.push(col.r, col.g, col.b);
        }
      }
      // ponta
      const last = cl[M - 1];
      tan.copy(last).sub(cl[M - 2]).normalize();
      positions.push(last.x + tan.x * lock.w * W * 0.5, last.y + tan.y * lock.w * W * 0.5, last.z + tan.z * lock.w * W * 0.5);
      colors.push(tip.r, tip.g, tip.b);
      const tipIndex = first + M * SEG;
      for (let i = 0; i < M - 1; i++) {
        for (let k = 0; k < SEG; k++) {
          const a = first + i * SEG + k;
          const b = first + i * SEG + ((k + 1) % SEG);
          const cc2 = first + (i + 1) * SEG + k;
          const d = first + (i + 1) * SEG + ((k + 1) % SEG);
          indices.push(a, cc2, b, b, cc2, d);
        }
      }
      for (let k = 0; k < SEG; k++) {
        indices.push(first + (M - 1) * SEG + k, tipIndex, first + (M - 1) * SEG + ((k + 1) % SEG));
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.applyMatrix4(boneInv.clone().multiply(toWorld)); // espaço da geometria → osso da cabeça
    geo.computeBoundingSphere();
    const hair = new THREE.Mesh(geo, hairMaterial);
    hair.name = 'Matheus_Hair';
    hair.castShadow = false;
    hair.frustumCulled = false;
    headBone.add(hair);
  }

  // ---------- barba curta e bigode: casca sobre a pele de baixo do rosto ----------
  // A casca cobre toda a parte de baixo do rosto; o desenho da barba (bochechas livres, vão da
  // boca, borda esfumada) é recortado por pixel no shader, para a borda ficar suave.
  const beardMaterial = new THREE.MeshStandardMaterial({ color: S.beard, roughness: 1, flatShading: true });
  {
    const mouthC = mouth.isEmpty() ? new THREE.Vector2(0, -99) : new THREE.Vector2(mouth.getCenter(c).x, c.y);
    const ms = mouth.isEmpty() ? new THREE.Vector3() : mouth.getSize(new THREE.Vector3());
    const uniforms = {
      uCenter: { value: center.clone() },
      uSize: { value: size.clone() },
      uNoseBottom: { value: noseBottom },
      uEyeY: { value: eyeY },
      uCheekY: { value: noseBottom - size.y * S.beardCheekDrop },
      uFuzz: { value: S.beardFuzz },
      uMouthC: { value: mouthC },
      uMouthR: { value: new THREE.Vector2(ms.x * 0.5 * S.mouthSize + 0.01, ms.y * 0.5 + 0.02) },
    };
    beardMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBeardPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBeardPos = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vBeardPos;
          uniform vec3 uCenter, uSize;
          uniform float uNoseBottom, uEyeY, uCheekY, uFuzz;
          uniform vec2 uMouthC, uMouthR;
          float beardHash(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }`,
        )
        .replace(
          'void main() {',
          `void main() {
          {
            vec3 p = vBeardPos;
            float dx = abs(p.x - uCenter.x) / (uSize.x * 0.5);
            // linha de cima: bigode rente ao nariz no meio, bochechas livres (a barba só começa
            // lá embaixo) e uma costeleta fina subindo junto da orelha
            float topY = mix(uNoseBottom - 0.004, uCheekY, smoothstep(0.2, 0.42, dx));
            topY = mix(topY, uEyeY - uSize.y * 0.22, smoothstep(0.72, 0.84, dx));
            // borda esfumada, como barba por fazer
            float fuzz = (beardHash(floor(p.xy * 160.0)) - 0.5) * uFuzz;
            if (p.y > topY + fuzz) discard;
            if (dx > 0.86) discard; // antes das orelhas
            if (p.z < uCenter.z - uSize.z * 0.15) discard; // nuca
            vec2 m = (p.xy - uMouthC) / uMouthR;
            if (dot(m, m) < 1.0) discard; // boca à mostra
          }`,
        );
    };
    beardMaterial.customProgramCacheKey = () => 'matheus-beard-2';

    const shell = filterTriangles(headGeo, (t) => {
      const hp = headGeo.attributes.position;
      const hu = headGeo.attributes.uv;
      if (cellOf(hu.getX(t), hu.getY(t)) !== 'r0c0') return false;
      c.set(
        (hp.getX(t) + hp.getX(t + 1) + hp.getX(t + 2)) / 3,
        (hp.getY(t) + hp.getY(t + 1) + hp.getY(t + 2)) / 3,
        (hp.getZ(t) + hp.getZ(t + 1) + hp.getZ(t + 2)) / 3,
      );
      return c.y < eyeY && c.z > center.z - size.z * 0.25 && Math.abs(c.x - center.x) < size.x * 0.46;
    });
    const sp = shell.attributes.position;
    const sn = shell.attributes.normal;
    for (let i = 0; i < sp.count; i++) {
      sp.setXYZ(
        i,
        sp.getX(i) + sn.getX(i) * S.beardThickness,
        sp.getY(i) + sn.getY(i) * S.beardThickness,
        sp.getZ(i) + sn.getZ(i) * S.beardThickness,
      );
    }
    shell.computeBoundingSphere();
    const beard = new THREE.SkinnedMesh(shell, beardMaterial);
    beard.name = 'Matheus_Beard';
    beard.frustumCulled = false;
    head.parent!.add(beard);
    beard.bind(head.skeleton, head.bindMatrix);
  }

  /** z da superfície do rosto em (x, y), medido nos triângulos de pele (espaço da geometria). */
  const surfaceZ = (x: number, y: number) => {
    const ray = new THREE.Ray(new THREE.Vector3(x, y, box.max.z + 1), new THREE.Vector3(0, 0, -1));
    const hp = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    let best = -Infinity;
    for (let t = 0; t < pos.count; t += 3) {
      if (cell(t) !== 'r0c0') continue;
      a.fromBufferAttribute(pos, t);
      b.fromBufferAttribute(pos, t + 1);
      d.fromBufferAttribute(pos, t + 2);
      if (ray.intersectTriangle(a, b, d, false, hp)) best = Math.max(best, hp.z);
    }
    return isFinite(best) ? best : eyeFront;
  };

  // ---------- piercing na ponta de fora da sobrancelha direita (lado −X) ----------
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 0.3, metalness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.3 });
  {
    const bx = eyes[1].x - browLen * 0.36;
    const byc = eyes[1].y + browOff;
    for (const dy of [browThick * 0.85, -browThick * 0.85]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.016, 8, 6), metal);
      ball.position.set(bx, byc + dy, surfaceZ(bx, byc + dy) + 0.012).applyMatrix4(toWorld);
      ball.updateMatrixWorld();
      headBone.attach(ball);
    }
  }

  // ---------- brincos: argola preta nas duas orelhas, cruz pendurada na direita ----------
  for (const side of [-1, 1]) {
    const ear = new THREE.Vector3();
    let n = 0;
    let lobe = Infinity;
    for (let i = 0; i < base.attributes.position.count; i++) {
      if (cell(i) !== 'r0c0') continue;
      const x = pos.getX(i);
      if ((x - center.x) * side < size.x * 0.46) continue;
      ear.add(new THREE.Vector3(x, pos.getY(i), pos.getZ(i)));
      lobe = Math.min(lobe, pos.getY(i));
      n++;
    }
    if (!n) continue;
    ear.divideScalar(n);
    const ringR = size.x * 0.045;
    const hoopPos = new THREE.Vector3(ear.x + side * 0.01, lobe - ringR * 0.4, ear.z);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(ringR, ringR * 0.25, 6, 14), black);
    hoop.rotation.y = Math.PI / 2;
    hoop.position.copy(hoopPos.clone().applyMatrix4(toWorld));
    hoop.updateMatrixWorld();
    headBone.attach(hoop);
    if (side < 0) {
      // cruz pendurada (lado direito dele)
      const cross = new THREE.Group();
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.09, 0.012), black);
      const hz = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.012), black);
      hz.position.y = 0.018;
      cross.add(v, hz);
      cross.rotation.y = Math.PI / 2;
      cross.position.copy(hoopPos.clone().add(new THREE.Vector3(0, -ringR - 0.05, 0)).applyMatrix4(toWorld));
      cross.updateMatrixWorld(true);
      headBone.attach(cross);
    }
  }

  return { hairMaterial, beardMaterial, extraMaterials: [decalMaterial, metal, black] };
}
