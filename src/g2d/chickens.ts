import { makeCanvas } from './art';
import type { Collision } from './collision';
import type { Kit } from './kit';
import type { Drawable } from './types';

/** Galinhas da vila: passeiam, fogem de quem se aproxima e, as fugitivas, entram no galinheiro quando levadas até lá. */

/** Cópia da galinha branca com outra cor de penas (só o corpo; crista e bico ficam). */
export function tintChicken(src: HTMLCanvasElement, color: string) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const k = parseInt(color.slice(1), 16);
  const tr = (k >> 16) & 255;
  const tg = (k >> 8) & 255;
  const tb = k & 255;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    if (img.data[i + 3] === 0) continue;
    // penas = tons claros e quase neutros
    if (r > 190 && g > 180 && b > 150 && Math.abs(r - g) < 30) {
      const l = (r + g + b) / 3 / 255;
      img.data[i] = Math.min(255, tr * l * 1.15);
      img.data[i + 1] = Math.min(255, tg * l * 1.15);
      img.data[i + 2] = Math.min(255, tb * l * 1.15);
    } else if (r > 200 && g > 190 && b > 150) {
      img.data[i] = tr;
      img.data[i + 1] = tg;
      img.data[i + 2] = tb;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface PenSpec {
  x: number;
  y: number;
  r: number;
  /** Ponto da abertura do cercado. */
  gate: { x: number; y: number };
}

export class Chick {
  penned = false;
  private tx: number;
  private ty: number;
  private pause = Math.random() * 2;
  private anim = Math.random() * 4;
  private face: 1 | -1 = 1;
  private moving = false;
  private peck = 0;

  constructor(
    public x: number,
    public y: number,
    private readonly sprites: HTMLCanvasElement[],
    private readonly roam: { x: number; y: number; r: number },
    private readonly pen?: PenSpec,
  ) {
    this.tx = x;
    this.ty = y;
  }

  /** Dentro do cercado: passa a passear só lá. */
  enterPen() {
    this.penned = true;
    this.pause = 0.5;
  }

  update(dt: number, player: { x: number; y: number; vx: number; vy: number }, scareR: number, col: Collision) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.hypot(dx, dy);
    let vx = 0;
    let vy = 0;
    let sp = 0;
    if (!this.penned && this.pen && dist < scareR) {
      // foge para longe do Matheus, com um empurrãozinho em direção ao cercado quando está perto dele
      let ax = dx / (dist || 1);
      let ay = dy / (dist || 1);
      const pd = Math.hypot(this.x - this.pen.x, this.y - this.pen.y);
      if (pd < 170) {
        const gx = this.pen.gate.x - this.x;
        const gy = this.pen.gate.y - this.y;
        const gl = Math.hypot(gx, gy) || 1;
        const inside = pd < this.pen.r ? -0.6 : 1;
        ax += (gx / gl) * 0.9 * inside;
        ay += (gy / gl) * 0.9 * inside;
        const l = Math.hypot(ax, ay) || 1;
        ax /= l;
        ay /= l;
      }
      vx = ax;
      vy = ay;
      sp = 64;
    } else if (this.penned || !this.pen) {
      if (dist < scareR * 0.6 && !this.penned) {
        vx = dx / (dist || 1);
        vy = dy / (dist || 1);
        sp = 52;
      }
    }
    if (sp === 0) {
      const ddx = this.tx - this.x;
      const ddy = this.ty - this.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < 3 || this.pause > 0) {
        this.pause -= dt;
        if (this.pause <= 0 && dd < 3) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random());
          const area = this.penned && this.pen ? { x: this.pen.x, y: this.pen.y, r: this.pen.r - 12 } : this.roam;
          this.tx = area.x + Math.cos(a) * area.r * r;
          this.ty = area.y + Math.sin(a) * area.r * r;
          this.pause = 0.8 + Math.random() * 2.6;
          this.peck = 0.5;
        }
      } else {
        vx = ddx / dd;
        vy = ddy / dd;
        sp = 14;
      }
    }
    if (this.peck > 0) this.peck -= dt;
    this.moving = sp > 0;
    if (sp > 0) {
      const nx = this.x + vx * sp * dt;
      const ny = this.y + vy * sp * dt;
      if (col.free(nx, this.y, 3)) this.x = nx;
      if (col.free(this.x, ny, 3)) this.y = ny;
      this.anim += dt * (sp > 40 ? 12 : 6);
      if (Math.abs(vx) > 0.15) this.face = vx < 0 ? -1 : 1;
    }
    if (this.pen && !this.penned && Math.hypot(this.x - this.pen.x, this.y - this.pen.y) < this.pen.r - 8) this.enterPen();
  }

  drawable(): Drawable {
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 6, 2, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy) => {
        const img = this.sprites[Math.floor(this.anim) & 1];
        const hop = this.moving ? Math.round(Math.abs(Math.sin(this.anim * Math.PI)) * 2) : 0;
        const dip = this.peck > 0 && Math.floor(this.peck * 8) % 2 === 0 ? 1 : 0;
        v.save();
        v.translate(Math.round(this.x - cx), Math.round(this.y - cy - 12 - hop + dip));
        v.scale(this.face, 1);
        v.drawImage(img, -8, 0);
        v.restore();
      },
    };
  }
}

export function henSprites(kit: Kit, color: string) {
  return kit.chicken.map((c) => tintChicken(c, color));
}
