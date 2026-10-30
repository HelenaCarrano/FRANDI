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

/** Metade da abertura do cercado, em radianos (a boca fica a leste, no ângulo 0). Mantém igual ao anel de cerca da vila. */
export const PEN_MOUTH = 0.7;

const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Chick {
  penned = false;
  private tx: number;
  private ty: number;
  private pause = Math.random() * 2;
  private anim = Math.random() * 4;
  private face: 1 | -1 = 1;
  private moving = false;
  private peck = 0;
  /** Velocidade suavizada: evita que a galinha vire de um lado para o outro a cada quadro. */
  private vx = 0;
  private vy = 0;
  private stuck = 0;
  private lastX: number;
  private lastY: number;

  constructor(
    public x: number,
    public y: number,
    private readonly sprites: HTMLCanvasElement[],
    private readonly roam: { x: number; y: number; r: number },
    private readonly pen?: PenSpec,
  ) {
    this.tx = x;
    this.ty = y;
    this.lastX = x;
    this.lastY = y;
  }

  /** Dentro do cercado: passa a passear só lá. */
  enterPen() {
    this.penned = true;
    this.pause = 0.5;
  }

  /** Para onde a fugitiva deve ir para chegar à boca do cercado sem atravessar a cerca. */
  private penGoal(): { x: number; y: number; pull: number } {
    const pen = this.pen!;
    const ang = Math.atan2(this.y - pen.y, this.x - pen.x);
    const pd = Math.hypot(this.x - pen.x, this.y - pen.y);
    const off = angDiff(ang, 0);
    // na frente da boca (dentro do cone): entra direto, com um "ímã" que vence o susto
    if (Math.abs(off) < PEN_MOUTH * 0.9 && pd < pen.r + 70) return { x: pen.x, y: pen.y, pull: pd < pen.r + 40 ? 1.6 : 1 };
    // do lado de fora e longe da boca: contorna o cercado pelo caminho mais curto
    const ringR = pen.r + 28;
    const step = off > 0 ? -0.55 : 0.55;
    return { x: pen.x + Math.cos(ang + step) * ringR, y: pen.y + Math.sin(ang + step) * ringR, pull: 0.8 };
  }

  update(dt: number, player: { x: number; y: number; vx: number; vy: number }, scareR: number, col: Collision) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const dist = Math.hypot(dx, dy);
    let wx = 0;
    let wy = 0;
    let sp = 0;
    if (!this.penned && this.pen && dist < scareR) {
      // foge do Matheus, mas é conduzida para a boca do cercado quando está por perto
      let ax = dx / (dist || 1);
      let ay = dy / (dist || 1);
      const pd = Math.hypot(this.x - this.pen.x, this.y - this.pen.y);
      if (pd < 220) {
        const g = this.penGoal();
        const gx = g.x - this.x;
        const gy = g.y - this.y;
        const gl = Math.hypot(gx, gy) || 1;
        ax += (gx / gl) * g.pull;
        ay += (gy / gl) * g.pull;
        const l = Math.hypot(ax, ay) || 1;
        ax /= l;
        ay /= l;
      }
      wx = ax;
      wy = ay;
      sp = 60;
    } else if (this.penned) {
      // já no cercado: se algo a empurrar para fora, volta para dentro
      const pd = Math.hypot(this.x - this.pen!.x, this.y - this.pen!.y);
      if (pd > this.pen!.r - 6) {
        wx = (this.pen!.x - this.x) / (pd || 1);
        wy = (this.pen!.y - this.y) / (pd || 1);
        sp = 30;
      }
    } else if (!this.pen && dist < scareR * 0.6) {
      wx = dx / (dist || 1);
      wy = dy / (dist || 1);
      sp = 50;
    }
    if (sp === 0) {
      const ddx = this.tx - this.x;
      const ddy = this.ty - this.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < 3 || this.pause > 0) {
        this.pause -= dt;
        if (this.pause <= 0 && dd < 3) {
          const area = this.penned && this.pen ? { x: this.pen.x, y: this.pen.y, r: this.pen.r - 12 } : this.roam;
          // escolhe um ponto livre para passear (até 6 tentativas)
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random());
            const nx = area.x + Math.cos(a) * area.r * r;
            const ny = area.y + Math.sin(a) * area.r * r;
            if (col.free(nx, ny, 4)) {
              this.tx = nx;
              this.ty = ny;
              break;
            }
          }
          this.pause = 0.8 + Math.random() * 2.6;
          this.peck = 0.5;
        }
      } else {
        wx = ddx / dd;
        wy = ddy / dd;
        sp = 14;
      }
    }
    // suaviza a direção e a velocidade
    const k = 1 - Math.exp(-9 * dt);
    this.vx += (wx * sp - this.vx) * k;
    this.vy += (wy * sp - this.vy) * k;
    const speed = Math.hypot(this.vx, this.vy);
    if (this.peck > 0) this.peck -= dt;
    this.moving = speed > 3;
    if (this.moving) {
      const nx = this.x + this.vx * dt;
      const ny = this.y + this.vy * dt;
      if (col.free(nx, this.y, 3)) this.x = nx;
      if (col.free(this.x, ny, 3)) this.y = ny;
      this.anim += dt * (speed > 40 ? 9 : 6);
      if (Math.abs(this.vx) > 0.4 * Math.max(1, speed * 0.25)) this.face = this.vx < 0 ? -1 : 1;
    }
    // presa na parede: desliza de lado e escolhe outro destino
    if (sp > 0) {
      const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
      if (moved < sp * dt * 0.25) this.stuck += dt;
      else this.stuck = 0;
      if (this.stuck > 0.4) {
        this.stuck = 0;
        const a = Math.atan2(this.vy, this.vx) + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
        this.pause = 0;
        this.tx = this.x;
        this.ty = this.y;
      }
    } else this.stuck = 0;
    this.lastX = this.x;
    this.lastY = this.y;
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
        const hop = this.moving ? Math.round(Math.abs(Math.sin(this.anim * Math.PI)) * 1.5) : 0;
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
