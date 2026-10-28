/** Partículas do jogo: poeirinha dos passos, estouros de névoa e faíscas (somadas por cima da luz). */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  col: string;
  size: number;
  grav: number;
  fade: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Fx {
  private readonly parts: Particle[] = [];
  private readonly sparks: Spark[] = [];

  /** Poeirinha: pequenos pontos que sobem e caem. */
  dust(x: number, y: number, n: number, col: string, vxBias = 0) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x: x + (Math.random() - 0.5) * 6, y: y - 1, vx: (Math.random() - 0.5) * 14 - vxBias * 0.12, vy: -6 - Math.random() * 8, life: 1, col, size: 1, grav: 14, fade: 2.4 });
    }
  }

  /** Estouro de névoa (espíritos se desfazendo, esquiva): quadradinhos claros que se espalham. */
  burst(x: number, y: number, n: number, power: number, col = '#bcd4ff') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * 26 * power;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 10, life: 1, col, size: Math.random() < 0.4 ? 2 : 1, grav: -4, fade: 1.6 });
    }
  }

  spark(x: number, y: number, vx = (Math.random() - 0.5) * 10) {
    this.sparks.push({ x, y, vx, vy: -12 - Math.random() * 12, life: 0.7 + Math.random() * 0.6 });
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt * p.fade;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= Math.exp(-2 * dt);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  }

  drawView(v: CanvasRenderingContext2D, cx: number, cy: number) {
    for (const p of this.parts) {
      v.globalAlpha = Math.min(1, p.life);
      v.fillStyle = p.col;
      v.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size);
    }
    v.globalAlpha = 1;
  }

  drawScreen(g: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
    g.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      g.fillStyle = `rgba(255,${150 + Math.round(s.life * 50)},60,${Math.min(1, s.life)})`;
      g.fillRect(Math.round((s.x - cx) * scale), Math.round((s.y - cy) * scale), scale, scale);
    }
    g.globalCompositeOperation = 'source-over';
  }
}
