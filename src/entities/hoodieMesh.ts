import * as THREE from 'three';

/**
 * Corpo de moletom gerado sob medida, no lugar da túnica do Mage:
 * liso (sem botões, cinto ou gola), reto (sem abrir na barra) e na altura do quadril.
 * A forma segue as medidas da túnica original (para encaixar nos braços e na cabeça)
 * e cada vértice copia os pesos de animação do vértice mais próximo da túnica,
 * então ele se mexe exatamente como ela.
 */

export const HOODIE_SHAPE = {
  /** Altura da barra: 0 = cintura (cinto do Mage), 1 = barra original da túnica. */
  hem: 0.3,
  /** Largura máxima abaixo da cintura em relação à cintura (1 = reto). */
  hemFlare: 1.03,
  rings: 16,
  segments: 18,
};

const cellOf = (u: number, v: number) => `r${Math.min(3, Math.floor(v * 4))}c${Math.min(7, Math.floor(u * 8))}`;

export function buildHoodieMesh(body: THREE.SkinnedMesh, material: THREE.Material): THREE.SkinnedMesh {
  const S = HOODIE_SHAPE;
  const src = body.geometry;
  const pos = src.attributes.position;
  const uv = src.attributes.uv;
  const skinIndex = src.attributes.skinIndex;
  const skinWeight = src.attributes.skinWeight;

  src.computeBoundingBox();
  const bb = src.boundingBox!;
  const H = bb.max.y - bb.min.y;

  // cintura = faixa do cinto (célula r0c5)
  let beltMin = Infinity;
  let beltMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (cellOf(uv.getX(i), uv.getY(i)) !== 'r0c5') continue;
    beltMin = Math.min(beltMin, pos.getY(i));
    beltMax = Math.max(beltMax, pos.getY(i));
  }
  if (!isFinite(beltMin)) {
    beltMin = bb.min.y + H * 0.3;
    beltMax = beltMin + H * 0.08;
  }
  const waistY = (beltMin + beltMax) / 2;
  const bottomY = waistY - (waistY - bb.min.y) * S.hem;

  // Medidas exatas: raios saindo do eixo do corpo, em cada altura e ângulo, contra o tecido
  // (sem botões, cinto, bolsa, livro e barra). Onde não há tecido (sob o cinto), interpola.
  const PARTS = new Set(['r0c3', 'r0c5', 'r2c2', 'r2c0', 'r0c4']);
  const tris: THREE.Triangle[] = [];
  const idx = src.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (PARTS.has(cellOf(uv.getX(i0), uv.getY(i0)))) continue;
    tris.push(new THREE.Triangle().setFromAttributeAndIndices(pos, i0, i1, i2));
  }
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const ray = new THREE.Ray();
  const hitP = new THREE.Vector3();
  const radiusAt = (y: number, a: number) => {
    ray.origin.set(cx, y, cz);
    ray.direction.set(Math.sin(a), 0, Math.cos(a));
    let best = NaN;
    for (const t of tris) {
      if (ray.intersectTriangle(t.a, t.b, t.c, false, hitP)) {
        const d = hitP.distanceTo(ray.origin);
        if (isNaN(best) || d > best) best = d;
      }
    }
    return best;
  };

  const seg = S.segments;
  const collarY = bb.max.y - H * 0.16; // acima disto é a gola larga do Mage: ignorada
  const ringY: number[] = [];
  for (let r = 0; r < S.rings; r++) ringY.push(bottomY + ((collarY - bottomY) * r) / (S.rings - 1));
  const radii: number[][] = ringY.map((y) => Array.from({ length: seg }, (_, s) => radiusAt(y, (s / seg) * Math.PI * 2)));
  // preenche buracos (sem tecido) pelo anel vizinho mais próximo
  for (let s = 0; s < seg; s++) {
    for (let r = 0; r < radii.length; r++) {
      if (!isNaN(radii[r][s])) continue;
      for (let d = 1; d < radii.length; d++) {
        const up = radii[Math.min(radii.length - 1, r + d)]?.[s];
        const dn = radii[Math.max(0, r - d)]?.[s];
        if (!isNaN(up) || !isNaN(dn)) {
          radii[r][s] = isNaN(up) ? dn : isNaN(dn) ? up : (up + dn) / 2;
          break;
        }
      }
      if (isNaN(radii[r][s])) radii[r][s] = 0.3;
    }
  }
  // suaviza em volta (tira relevos) e na vertical
  for (let pass = 0; pass < 2; pass++) {
    for (const ring of radii) {
      const copy = [...ring];
      for (let s = 0; s < seg; s++) ring[s] = (copy[(s + seg - 1) % seg] + copy[s] * 2 + copy[(s + 1) % seg]) / 4;
    }
    for (let r = 1; r < radii.length - 1; r++) {
      for (let s = 0; s < seg; s++) radii[r][s] = (radii[r - 1][s] + radii[r][s] * 2 + radii[r + 1][s]) / 4;
    }
  }
  // reto da cintura para baixo (sem abrir na barra)
  const waistRing = radii[ringY.findIndex((y) => y >= waistY)] ?? radii[0];
  ringY.forEach((y, r) => {
    if (y >= waistY) return;
    for (let s = 0; s < seg; s++) radii[r][s] = Math.min(radii[r][s], waistRing[s] * S.hemFlare);
  });
  // ombros arredondados fechando no pescoço, sem gola
  const extra = 3;
  const lastR = radii[radii.length - 1];
  for (let e = 1; e <= extra; e++) {
    const t = e / extra;
    ringY.push(collarY + H * 0.03 * Math.sin((t * Math.PI) / 2));
    radii.push(lastR.map((r) => r * (1 - 0.42 * t * t)));
  }
  const rings = ringY.map((y, r) => ({ y, rs: radii[r] }));

  // malha: anéis + tampas em cima e embaixo
  const verts: number[] = [];
  const index: number[] = [];
  for (const ring of rings) {
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      verts.push(cx + Math.sin(a) * ring.rs[s], ring.y, cz + Math.cos(a) * ring.rs[s]);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * seg + s;
      const b = r * seg + ((s + 1) % seg);
      const c = (r + 1) * seg + s;
      const d = (r + 1) * seg + ((s + 1) % seg);
      index.push(a, b, d, a, d, c);
    }
  }
  const capTop = verts.length / 3;
  const top = rings[rings.length - 1];
  verts.push(cx, top.y + 0.01, cz);
  const capBottom = verts.length / 3;
  verts.push(cx, rings[0].y, cz);
  const last = (rings.length - 1) * seg;
  for (let s = 0; s < seg; s++) {
    index.push(last + s, last + ((s + 1) % seg), capTop);
    index.push((s + 1) % seg, s, capBottom);
  }

  // pesos de animação: copia do vértice mais próximo da túnica original
  const count = verts.length / 3;
  const si = new (skinIndex.array.constructor as Uint16ArrayConstructor)(count * 4);
  const sw = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2 + (pos.getZ(i) - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    for (let k = 0; k < 4; k++) {
      si[v * 4 + k] = skinIndex.getComponent(best, k);
      sw[v * 4 + k] = skinWeight.getComponent(best, k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const hoodie = new THREE.SkinnedMesh(geo, material);
  hoodie.name = 'Matheus_Hoodie';
  hoodie.frustumCulled = false;
  hoodie.castShadow = true;
  body.parent!.add(hoodie);
  hoodie.bind(body.skeleton, body.bindMatrix);
  return hoodie;
}
