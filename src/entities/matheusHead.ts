import * as THREE from 'three';

/**
 * Personaliza a cabeça do Knight (KayKit) para ficar parecida com o Matheus:
 *  - tira o topete e as sobrancelhas "bravas" do original
 *  - diminui o nariz
 *  - cabelo: mechas bagunçadas no topo caindo para a frente + degradê na pele nas laterais
 *  - barba curta e bigode colados ao rosto (uma casca que acompanha a pele)
 *  - sobrancelhas grossas e retas, piercing na sobrancelha direita, brincos pretos
 * Tudo é medido na própria malha, na pose de repouso, e preso ao osso da cabeça.
 */

export const HEAD_STYLE = {
  hair: 0x2a1a11, // mechas do topo
  hairBase: 0x2e1d13, // base do cabelo (o degradê das laterais parte desta cor)
  beard: 0x35221a,
  noseSize: 0.45, // 1 = nariz original
  eyeSize: 0.6, // olhos menores e simples (1 = original)
  mouthSize: 0.55, // largura visível da boca (a barba cobre os cantos)
  tuftCount: 170, // mechas do topo
  tuftLength: [0.13, 0.24] as [number, number],
  tuftWidth: [0.045, 0.07] as [number, number],
  fadeLow: -0.38, // degradê: pele na altura dos olhos + fadeLow…
  fadeHigh: 0.2, // …até cabelo cheio em fadeHigh (frações da altura da cabeça)
  tuftStart: 0.3, // mechas só acima desta altura
  beardThickness: 0.018, // barba rente ao rosto
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
  const pos = base.attributes.position;
  const uv = base.attributes.uv;
  const nrm = base.attributes.normal;
  const cell = (i: number) => cellOf(uv.getX(i), uv.getY(i));
  const centroid = (t: number, out: THREE.Vector3) =>
    out.set(
      (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3,
      (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3,
      (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3,
    );

  // Na pose de repouso, posição da geometria → mundo é só a matrixWorld da malha.
  const toWorld = head.matrixWorld.clone();
  const box = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) if (cell(i) === 'r0c0') box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

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
  // olhos menores (minimalistas): encolhe cada olho em torno do próprio centro
  for (let i = 0; i < pos.count; i++) {
    if (cell(i) !== 'r0c2') continue;
    const e = pos.getX(i) > center.x ? eyeL : eyeR;
    pos.setX(i, e.x + (pos.getX(i) - e.x) * S.eyeSize);
    pos.setY(i, e.y + (pos.getY(i) - e.y) * S.eyeSize);
  }

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
  {
    const tri = new THREE.Triangle();
    const fn = new THREE.Vector3();
    const cc = new THREE.Vector3();
    for (let t = 0; t < pos.count; t += 3) {
      if (cell(t) !== 'r0c0') continue;
      centroid(t, cc);
      if (Math.abs(cc.x - center.x) > size.x * 0.22) continue;
      if (cc.y > noseBottom || cc.y < noseBottom - size.y * 0.22) continue;
      if (cc.z < center.z + size.z * 0.25) continue;
      tri.setFromAttributeAndIndices(pos, t, t + 1, t + 2).getNormal(fn);
      if (fn.y > 0.45) mouth.expandByPoint(cc);
    }
    if (!mouth.isEmpty()) mouth.expandByVector(new THREE.Vector3(0.03, 0.025, 0.2));
  }

  // ---------- separa cabelo, sobrancelhas originais e resto ----------
  const c = new THREE.Vector3();
  const isBrow = (t: number) => {
    centroid(t, c);
    return c.y < eyeY + size.y * 0.22 && c.z > center.z;
  };
  const hairTris: number[] = [];
  for (let t = 0; t < pos.count; t += 3) if (cell(t) === 'r0c1' && !isBrow(t)) hairTris.push(t);

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

  // ---------- mechas bagunçadas no topo, caindo para a frente ----------
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const tuftGeo = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0); // base na origem, ponta em +Y
  const tufts = new THREE.InstancedMesh(tuftGeo, hairMaterial, S.tuftCount);
  const areas = hairTris.map((t) => {
    const a = new THREE.Vector3().fromBufferAttribute(pos, t);
    const b = new THREE.Vector3().fromBufferAttribute(pos, t + 1);
    const d = new THREE.Vector3().fromBufferAttribute(pos, t + 2);
    return new THREE.Triangle(a, b, d).getArea();
  });
  const total = areas.reduce((s, a) => s + a, 0);
  const boneInv = headBone.matrixWorld.clone().invert();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const col = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  for (let k = 0, tries = 0; k < S.tuftCount && tries < S.tuftCount * 30; tries++) {
    let r = rand() * total;
    let idx = 0;
    while (idx < areas.length - 1 && r > areas[idx]) r -= areas[idx++];
    const t = hairTris[idx];
    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    p.set(0, 0, 0)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, t), w)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, t + 1), u)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, t + 2), v);
    n.set(0, 0, 0)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, t), w)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, t + 1), u)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, t + 2), v)
      .normalize();
    if (p.y < eyeY + size.y * S.tuftStart) continue;
    // direção da mecha: deitada sobre a cabeça, penteada para a frente e um pouco para baixo
    const front = (p.z - center.z) / (size.z * 0.5); // -1 nuca … +1 testa
    dir.set((p.x - center.x) / size.x * 0.6 + (rand() - 0.5) * 0.5, -0.15 - Math.max(0, front) * 0.5, 1)
      .normalize()
      .addScaledVector(n, 0.35 + rand() * 0.25)
      .normalize();
    p.addScaledVector(n, -0.01);
    p.applyMatrix4(toWorld);
    q.setFromUnitVectors(UP, dir.transformDirection(toWorld));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI));
    const wdt = S.tuftWidth[0] + rand() * (S.tuftWidth[1] - S.tuftWidth[0]);
    const len = S.tuftLength[0] + rand() * (S.tuftLength[1] - S.tuftLength[0]);
    scl.set(wdt, len, wdt * 0.55);
    m.compose(p, q, scl).premultiply(boneInv);
    tufts.setMatrixAt(k, m);
    col.setHex(S.hair).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    tufts.setColorAt(k, col);
    k++;
  }
  tufts.castShadow = false;
  tufts.name = 'Matheus_Hair';
  headBone.add(tufts);

  // ---------- barba curta e bigode: casca sobre a pele de baixo do rosto ----------
  // A casca cobre toda a parte de baixo do rosto; o desenho da barba (linha das bochechas,
  // vão da boca) é recortado por pixel no shader, para a borda ficar suave.
  const beardMaterial = new THREE.MeshStandardMaterial({ color: S.beard, roughness: 1, flatShading: true });
  {
    const mouthC = mouth.isEmpty() ? new THREE.Vector2(0, -99) : new THREE.Vector2(mouth.getCenter(c).x, c.y);
    const ms = mouth.isEmpty() ? new THREE.Vector3() : mouth.getSize(new THREE.Vector3());
    const uniforms = {
      uCenter: { value: center.clone() },
      uSize: { value: size.clone() },
      uNoseBottom: { value: noseBottom },
      uEyeY: { value: eyeY },
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
          uniform float uNoseBottom, uEyeY;
          uniform vec2 uMouthC, uMouthR;`,
        )
        .replace(
          'void main() {',
          `void main() {
          {
            vec3 p = vBeardPos;
            float dx = abs(p.x - uCenter.x) / (uSize.x * 0.5);
            // linha de cima: rente ao nariz no meio, subindo até as costeletas nas laterais
            float topY = mix(uNoseBottom - 0.004, uEyeY - uSize.y * 0.05, smoothstep(0.3, 0.72, dx));
            if (p.y > topY) discard;
            if (dx > 0.86) discard; // antes das orelhas
            if (p.z < uCenter.z - uSize.z * 0.15) discard; // nuca
            vec2 m = (p.xy - uMouthC) / uMouthR;
            if (dot(m, m) < 1.0) discard; // boca à mostra
          }`,
        );
    };
    beardMaterial.customProgramCacheKey = () => 'matheus-beard';

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

  // ---------- sobrancelhas: grossas e retas ----------
  const browMat = new THREE.MeshStandardMaterial({ color: S.hair, roughness: 0.9 });
  const browGeo = new THREE.BoxGeometry(size.x * 0.16, size.y * 0.045, 0.025);
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
  for (const eye of [eyeL, eyeR]) {
    const brow = new THREE.Mesh(browGeo, browMat);
    const by = eye.y + size.y * 0.1;
    const bp = new THREE.Vector3(eye.x, by, surfaceZ(eye.x, by) + 0.01).applyMatrix4(toWorld);
    brow.position.copy(bp);
    brow.updateMatrixWorld();
    headBone.attach(brow);
  }

  // ---------- piercing na ponta de fora da sobrancelha direita (lado -X) ----------
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 0.3, metalness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.3 });
  {
    const bx = eyeR.x - size.x * 0.07;
    const byTop = eyeR.y + size.y * 0.14;
    for (const dy of [0, -size.y * 0.08]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.016, 8, 6), metal);
      const y = byTop + dy;
      ball.position.set(bx, y, surfaceZ(bx, y) + 0.012).applyMatrix4(toWorld);
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

  return { hairMaterial, beardMaterial, extraMaterials: [browMat, metal, black] };
}
