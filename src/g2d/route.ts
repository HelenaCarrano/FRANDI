/** Caminhos suaves: curva por pontos (Catmull-Rom), distância até a trilha e progresso (0..1) ao longo dela. */

export type Pt = [number, number];

export function smoothPath(poly: Pt[], step = 8): Pt[] {
  if (poly.length < 3) return poly.slice();
  const out: Pt[] = [];
  const get = (i: number) => poly[Math.max(0, Math.min(poly.length - 1, i))];
  for (let i = 0; i < poly.length - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(poly[poly.length - 1]);
  return out;
}

export class Route {
  readonly pts: Pt[];
  private readonly cum: number[] = [0];
  readonly length: number;

  constructor(poly: Pt[], step = 8) {
    this.pts = smoothPath(poly, step);
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1] || 1;
  }

  /** Ponto na fração f (0..1) com a tangente (direção de quem avança). */
  at(f: number) {
    const d = Math.max(0, Math.min(1, f)) * this.length;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = this.pts[lo];
    const b = this.pts[Math.min(this.pts.length - 1, lo + 1)];
    const seg = this.cum[Math.min(this.cum.length - 1, lo + 1)] - this.cum[lo] || 1;
    const t = (d - this.cum[lo]) / seg;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    return { x: a[0] + tx * t, y: a[1] + ty * t, tx: tx / l, ty: ty / l };
  }

  /** Ponto na fração f deslocado `side` px para o lado (positivo = direita de quem avança). */
  spot(f: number, side = 0) {
    const p = this.at(f);
    return { x: p.x - p.ty * side, y: p.y + p.tx * side, tx: p.tx, ty: p.ty };
  }

  /** Distância até a trilha e fração do ponto mais próximo. */
  nearest(x: number, y: number) {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < this.pts.length; i++) {
      const d = (this.pts[i][0] - x) ** 2 + (this.pts[i][1] - y) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return { dist: Math.sqrt(best), f: this.cum[bi] / this.length };
  }

  progress(x: number, y: number) {
    return this.nearest(x, y).f;
  }
}

/** Grade de distâncias até um conjunto de trilhas (consulta rápida para saber se um ponto está na mata fechada). */
export class DistanceGrid {
  private readonly cell = 8;
  private readonly cols: number;
  private readonly rows: number;
  private readonly data: Float32Array;

  constructor(w: number, h: number, routes: Route[], reach: number) {
    this.cols = Math.ceil(w / this.cell);
    this.rows = Math.ceil(h / this.cell);
    this.data = new Float32Array(this.cols * this.rows).fill(reach + 1);
    const r = Math.ceil(reach / this.cell);
    for (const route of routes) {
      for (const [px, py] of route.pts) {
        const cx = Math.floor(px / this.cell);
        const cy = Math.floor(py / this.cell);
        for (let gy = Math.max(0, cy - r); gy <= Math.min(this.rows - 1, cy + r); gy++) {
          for (let gx = Math.max(0, cx - r); gx <= Math.min(this.cols - 1, cx + r); gx++) {
            const d = Math.hypot((gx + 0.5) * this.cell - px, (gy + 0.5) * this.cell - py);
            const i = gy * this.cols + gx;
            if (d < this.data[i]) this.data[i] = d;
          }
        }
      }
    }
  }

  distance(x: number, y: number) {
    const gx = Math.floor(x / this.cell);
    const gy = Math.floor(y / this.cell);
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return 9999;
    return this.data[gy * this.cols + gx];
  }
}
