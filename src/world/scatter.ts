/**
 * Espalha pontos (árvores, pedras, arbustos) sem que fiquem um em cima do outro: sorteia candidatos e
 * recusa os que caem perto demais de um já aceito ou onde `accept` diz que não pode.
 */

export interface ScatterOptions {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Distância mínima entre pontos neste local (pode variar, ex.: mais denso na mata). */
  spacing: (x: number, z: number) => number;
  accept?: (x: number, z: number) => boolean;
  /** Quantas tentativas no total. */
  tries: number;
  max?: number;
}

export function scatter(rand: () => number, o: ScatterOptions): [number, number][] {
  const out: [number, number][] = [];
  const cell = 4;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cz: number) => cx * 73856093 + cz * 19349663 + ':' + cx;
  for (let t = 0; t < o.tries && out.length < (o.max ?? Infinity); t++) {
    const x = o.minX + rand() * (o.maxX - o.minX);
    const z = o.minZ + rand() * (o.maxZ - o.minZ);
    if (o.accept && !o.accept(x, z)) continue;
    const r = o.spacing(x, z);
    const reach = Math.ceil(Math.max(r, 6) / cell);
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    let ok = true;
    for (let dz = -reach; dz <= reach && ok; dz++) {
      for (let dx = -reach; dx <= reach && ok; dx++) {
        const list = grid.get(key(cx + dx, cz + dz));
        if (!list) continue;
        for (const i of list) {
          const px = out[i][0];
          const pz = out[i][1];
          if ((px - x) ** 2 + (pz - z) ** 2 < r * r) {
            ok = false;
            break;
          }
        }
      }
    }
    if (!ok) continue;
    const k = key(cx, cz);
    const list = grid.get(k);
    if (list) list.push(out.length);
    else grid.set(k, [out.length]);
    out.push([x, z]);
  }
  return out;
}
