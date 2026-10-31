import { makeCanvas, outlineSprite } from './art';
import type { Collision } from './collision';
import type { Drawable } from './types';

/**
 * Bichos da fazenda em pixel art, de perfil (como o cavalo): vaca, porco e ovelha. Cada um vaga dentro do seu cercado,
 * para de vez em quando para pastar (cabeça baixa) e vira para o lado para onde anda.
 * Quadros: 0 = parado, 1 e 2 = andando (patas alternadas), 3 = cabeça baixa pastando.
 */

export type AnimalKind = 'cow' | 'pig' | 'sheep';

const px = (ctx: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

const leg = (frame: number, i: number) => {
  // pares diagonais: no quadro 1 sobem as patas 0 e 3; no 2, as patas 1 e 2
  if (frame === 1) return i === 0 || i === 3 ? 2 : 0;
  if (frame === 2) return i === 1 || i === 2 ? 2 : 0;
  return 0;
};

function drawCow(frame: number) {
  const { c, ctx } = makeCanvas(42, 32);
  const g = 29;
  const hd = frame === 3 ? 6 : 0;
  const WHITE = '#f4f0e8';
  const SHADE = '#d4cec0';
  const SPOT = '#2a2a30';
  [10, 14, 26, 30].forEach((x, i) => {
    const up = leg(frame, i);
    const far = i === 1 || i === 3;
    px(ctx, far ? SHADE : WHITE, x, 20, 3, g - 20 - 3 - up);
    px(ctx, '#3a2a24', x, g - 3 - up, 3, 3);
  });
  // cauda
  px(ctx, WHITE, 6, 9, 2, 12);
  px(ctx, SPOT, 5, 20, 4, 3);
  // corpo
  px(ctx, WHITE, 8, 8, 24, 13);
  px(ctx, SHADE, 8, 17, 24, 4);
  px(ctx, '#fff', 10, 8, 20, 1);
  px(ctx, SPOT, 11, 9, 7, 5);
  px(ctx, SPOT, 23, 11, 6, 6);
  px(ctx, SPOT, 17, 16, 4, 3);
  // úbere
  px(ctx, '#e8a0a0', 18, 21, 6, 3);
  // pescoço e cabeça
  px(ctx, WHITE, 30, 8 + hd / 2, 5, 9 + hd / 2);
  px(ctx, WHITE, 33, 8 + hd, 8, 9);
  px(ctx, SPOT, 33, 8 + hd, 2, 4);
  px(ctx, '#e8a0a0', 37, 13 + hd, 5, 5);
  px(ctx, '#a05a5a', 39, 14 + hd, 1, 1);
  px(ctx, '#1c1210', 36, 10 + hd, 2, 2);
  px(ctx, '#e8d8a0', 34, 5 + hd, 2, 4);
  px(ctx, '#e8d8a0', 38, 5 + hd, 2, 4);
  px(ctx, SPOT, 31, 9 + hd, 3, 2);
  return outlineSprite(c);
}

function drawPig(frame: number) {
  const { c, ctx } = makeCanvas(34, 24);
  const g = 21;
  const hd = frame === 3 ? 3 : 0;
  const PINK = '#f0a8a8';
  const DARK = '#d88888';
  [8, 11, 21, 24].forEach((x, i) => {
    const up = leg(frame, i);
    px(ctx, i === 1 || i === 3 ? DARK : PINK, x, 14, 3, g - 14 - 2 - up);
    px(ctx, '#6a3a3a', x, g - 2 - up, 3, 2);
  });
  // rabinho enrolado
  px(ctx, DARK, 4, 7, 2, 2);
  px(ctx, DARK, 3, 5, 2, 2);
  px(ctx, DARK, 5, 4, 2, 1);
  // corpo
  px(ctx, PINK, 5, 6, 21, 10);
  px(ctx, DARK, 5, 12, 21, 4);
  px(ctx, '#f8c8c8', 7, 6, 17, 2);
  // cabeça e focinho
  px(ctx, PINK, 24, 6 + hd, 7, 8);
  px(ctx, '#f8c8c8', 25, 6 + hd, 4, 1);
  px(ctx, '#e89090', 30, 9 + hd, 4, 5);
  px(ctx, '#8a4a4a', 31, 10 + hd, 1, 1);
  px(ctx, '#8a4a4a', 31, 12 + hd, 1, 1);
  px(ctx, '#1c1210', 27, 8 + hd, 2, 2);
  px(ctx, DARK, 24, 3 + hd, 4, 4);
  return outlineSprite(c);
}

function drawSheep(frame: number) {
  const { c, ctx } = makeCanvas(36, 28);
  const g = 25;
  const hd = frame === 3 ? 5 : 0;
  const WOOL = '#f4efe0';
  const SHADE = '#d4ccb4';
  const FACE = '#4a3a30';
  [9, 13, 22, 26].forEach((x, i) => {
    const up = leg(frame, i);
    px(ctx, FACE, x, 18, 2, g - 18 - up);
    px(ctx, '#2a1e18', x, g - 2 - up, 3, 2);
  });
  // lã fofinha: corpo com carocinhos nas bordas
  px(ctx, WOOL, 6, 6, 21, 13);
  for (const [x, y] of [[8, 4], [12, 3], [17, 4], [22, 4], [5, 9], [4, 13], [27, 9], [26, 14], [10, 19], [16, 19], [22, 19]]) px(ctx, WOOL, x, y, 4, 3);
  px(ctx, SHADE, 6, 15, 21, 4);
  px(ctx, SHADE, 10, 19, 14, 1);
  px(ctx, '#fff', 9, 6, 14, 2);
  // cabeça escura com tufo de lã
  px(ctx, FACE, 26, 9 + hd, 7, 8);
  px(ctx, '#6a584a', 27, 10 + hd, 5, 2);
  px(ctx, WOOL, 25, 6 + hd, 7, 4);
  px(ctx, FACE, 24, 10 + hd, 3, 2);
  px(ctx, '#fff', 30, 11 + hd, 1, 1);
  px(ctx, '#1c1210', 31, 11 + hd, 1, 1);
  px(ctx, '#c88c8c', 32, 14 + hd, 1, 1);
  return outlineSprite(c);
}

const SPRITES = new Map<AnimalKind, HTMLCanvasElement[]>();
function frames(kind: AnimalKind) {
  let f = SPRITES.get(kind);
  if (!f) {
    const make = kind === 'cow' ? drawCow : kind === 'pig' ? drawPig : drawSheep;
    f = [0, 1, 2, 3].map(make);
    SPRITES.set(kind, f);
  }
  return f;
}

const SPEED: Record<AnimalKind, number> = { cow: 9, pig: 14, sheep: 11 };
const SHADOW: Record<AnimalKind, number> = { cow: 15, pig: 12, sheep: 12 };

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Animal {
  face: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private tx: number;
  private ty: number;
  private pause = Math.random() * 3;
  private anim = Math.random() * 4;
  private moving = false;
  private graze = 0;
  private lastX: number;
  private lastY: number;
  private stuck = 0;

  constructor(
    readonly kind: AnimalKind,
    public x: number,
    public y: number,
    private readonly bounds: Bounds,
  ) {
    this.tx = x;
    this.ty = y;
    this.lastX = x;
    this.lastY = y;
  }

  update(dt: number, col: Collision) {
    this.graze = Math.max(0, this.graze - dt);
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 3 || this.pause > 0) {
      this.moving = false;
      this.pause -= dt;
      if (this.pause <= 0 && d < 3) {
        const b = this.bounds;
        for (let k = 0; k < 8; k++) {
          const nx = b.x0 + Math.random() * (b.x1 - b.x0);
          const ny = b.y0 + Math.random() * (b.y1 - b.y0);
          if (col.free(nx, ny, 8)) {
            this.tx = nx;
            this.ty = ny;
            break;
          }
        }
        this.pause = 1 + Math.random() * 3.5;
        if (Math.random() < 0.55) this.graze = 1.5 + Math.random() * 2.5;
      }
      return;
    }
    const sp = SPEED[this.kind];
    const nx = this.x + (dx / d) * sp * dt;
    const ny = this.y + (dy / d) * sp * dt;
    if (col.free(nx, this.y, 7)) this.x = nx;
    if (col.free(this.x, ny, 7)) this.y = ny;
    this.moving = true;
    this.anim += (dt * sp) / 4.5;
    if (Math.abs(dx) > 1) this.face = dx < 0 ? -1 : 1;
    // preso numa cerca ou em outro bicho: desiste desse destino
    if (Math.hypot(this.x - this.lastX, this.y - this.lastY) < sp * dt * 0.2) this.stuck += dt;
    else this.stuck = 0;
    if (this.stuck > 0.5) {
      this.stuck = 0;
      this.tx = this.x;
      this.ty = this.y;
      this.pause = 0.6;
    }
    this.lastX = this.x;
    this.lastY = this.y;
  }

  drawable(): Drawable {
    const set = frames(this.kind);
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), SHADOW[this.kind], 4, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy, t) => {
        const phase = Math.floor(this.anim) % 4;
        const idx = this.moving ? [1, 0, 2, 0][phase] : this.graze > 0 ? 3 : 0;
        const img = set[idx];
        // respira devagar quando está parado
        const breathe = !this.moving && Math.floor(t * 1.2 + this.x) % 2 === 0 ? 0 : 1;
        v.save();
        v.translate(Math.round(this.x - cx), Math.round(this.y - cy) - img.height + 3 - (this.moving ? 0 : breathe));
        v.scale(this.face, 1);
        v.drawImage(img, -Math.round(img.width / 2), 0);
        v.restore();
      },
    };
  }
}
