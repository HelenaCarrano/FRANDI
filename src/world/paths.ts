import * as THREE from 'three';
import { noise2 } from './noise';

/**
 * Trilha de terra: uma curva suave (spline) por pontos no chão. Serve para pintar a terra no terreno,
 * espalhar pedrinhas ao longo dela e tirar grama e árvores de cima.
 */
export class Path {
  /** Pontos da curva (x, z), espaçados cerca de `step` metros. */
  readonly pts: THREE.Vector2[] = [];
  readonly length: number;

  constructor(
    control: readonly [number, number][],
    /** Largura da trilha em metros (a de terra batida; a borda desbota além disso). */
    readonly width = 3.2,
    step = 1.2,
    private readonly seed = 1,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      control.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'centripetal',
    );
    this.length = curve.getLength();
    const n = Math.max(2, Math.ceil(this.length / step));
    for (const p of curve.getSpacedPoints(n)) this.pts.push(new THREE.Vector2(p.x, p.z));
  }

  /** Largura real no ponto da curva (ondula um pouco, para a borda não ficar reta). */
  private widthAt(i: number) {
    return this.width * (0.82 + 0.36 * noise2(i * 0.35, this.seed * 7.1, this.seed));
  }

  /**
   * Distância de (x, z) à trilha, descontada a meia-largura: negativo ou zero = em cima da terra batida.
   * Devolve também, em `out`, o ponto mais próximo se for pedido.
   */
  distance(x: number, z: number) {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const len2 = dx * dx + dz * dz;
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.y) * dz) / len2));
      const d = Math.hypot(x - (a.x + dx * t), z - (a.y + dz * t));
      if (d < best) {
        best = d;
        bi = i + t;
      }
    }
    return best - this.widthAt(Math.round(bi)) / 2;
  }

  /** Ponto na fração f (0 a 1) do comprimento (interpolado entre as amostras). */
  at(f: number) {
    const x = Math.min(this.pts.length - 1, Math.max(0, f * (this.pts.length - 1)));
    const i = Math.min(this.pts.length - 2, Math.floor(x));
    return this.pts[i].clone().lerp(this.pts[i + 1], x - i);
  }

  /** Fração (0 a 1) do ponto da trilha mais perto de (x, z). */
  progress(x: number, z: number) {
    let best = Infinity;
    let at = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const len2 = dx * dx + dz * dz;
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.y) * dz) / len2));
      const d = Math.hypot(x - (a.x + dx * t), z - (a.y + dz * t));
      if (d < best) {
        best = d;
        at = i + t;
      }
    }
    return at / (this.pts.length - 1);
  }

  /** Direção (unitária) da trilha na fração f. */
  tangent(f: number) {
    const i = Math.min(this.pts.length - 2, Math.max(0, Math.round(f * (this.pts.length - 1))));
    return this.pts[i + 1].clone().sub(this.pts[i]).normalize();
  }
}

/** Menor distância a qualquer uma das trilhas (descontada a meia-largura). */
export function nearestPath(paths: readonly Path[], x: number, z: number) {
  let d = Infinity;
  for (const p of paths) d = Math.min(d, p.distance(x, z));
  return d;
}
