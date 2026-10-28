/** Colisão 2D: círculos e retângulos sólidos, mais uma regra extra (ex.: água) e os limites do mapa. */

export interface CircleHandle {
  x: number;
  y: number;
  r: number;
  on: boolean;
}
export interface RectHandle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  on: boolean;
}

export class Collision {
  readonly circles: CircleHandle[] = [];
  readonly rects: RectHandle[] = [];
  /** Regra extra: devolve true se o ponto (x, y) é intransponível (ex.: dentro da lagoa). */
  extra?: (x: number, y: number) => boolean;
  bounds = { x0: 8, y0: 8, x1: 1000, y1: 1000 };

  constructor(w: number, h: number) {
    this.bounds = { x0: 8, y0: 8, x1: w - 8, y1: h - 8 };
  }

  addCircle(x: number, y: number, r: number): CircleHandle {
    const c = { x, y, r, on: true };
    this.circles.push(c);
    return c;
  }

  addRect(x0: number, y0: number, x1: number, y1: number): RectHandle {
    const r = { x0, y0, x1, y1, on: true };
    this.rects.push(r);
    return r;
  }

  remove(h: CircleHandle | RectHandle) {
    h.on = false;
  }

  /** O ponto, com um corpo de raio `r`, cabe aqui? */
  free(x: number, y: number, r: number): boolean {
    const b = this.bounds;
    if (x < b.x0 || y < b.y0 || x > b.x1 || y > b.y1) return false;
    if (this.extra?.(x, y)) return false;
    for (const c of this.circles) {
      if (!c.on) continue;
      const dx = x - c.x;
      const dy = y - c.y;
      const rr = c.r + r;
      if (dx * dx + dy * dy < rr * rr) return false;
    }
    for (const k of this.rects) {
      if (!k.on) continue;
      if (x > k.x0 - r && x < k.x1 + r && y > k.y0 - r && y < k.y1 + r) return false;
    }
    return true;
  }

  /** Empurra `p` para fora de tudo que é sólido (usado por inimigos e empurrões). */
  resolve(p: { x: number; y: number }, r: number) {
    const b = this.bounds;
    p.x = Math.min(Math.max(p.x, b.x0), b.x1);
    p.y = Math.min(Math.max(p.y, b.y0), b.y1);
    for (let i = 0; i < 3; i++) {
      for (const c of this.circles) {
        if (!c.on) continue;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.hypot(dx, dy);
        const min = c.r + r;
        if (d < min && d > 0.0001) {
          p.x = c.x + (dx / d) * min;
          p.y = c.y + (dy / d) * min;
        }
      }
      for (const k of this.rects) {
        if (!k.on) continue;
        if (p.x > k.x0 - r && p.x < k.x1 + r && p.y > k.y0 - r && p.y < k.y1 + r) {
          const left = p.x - (k.x0 - r);
          const right = k.x1 + r - p.x;
          const up = p.y - (k.y0 - r);
          const down = k.y1 + r - p.y;
          const m = Math.min(left, right, up, down);
          if (m === left) p.x = k.x0 - r;
          else if (m === right) p.x = k.x1 + r;
          else if (m === up) p.y = k.y0 - r;
          else p.y = k.y1 + r;
        }
      }
    }
  }
}
