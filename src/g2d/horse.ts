import { makeCanvas, outlineSprite } from './art';
import type { Collision } from './collision';
import type { Drawable } from './types';

/**
 * O cavalo (Trovão): sprite de perfil em pixel art, com três modos. Solto no cercado ele vagueia (e foge de quem corre);
 * depois das ferraduras ele segue o Matheus; montado, ele é o próprio Matheus mais rápido.
 */

const px = (ctx: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

const BODY = '#8a4a2a';
const BODY_L = '#b0683a';
const BODY_D = '#62321c';
const MANE = '#241410';
const HOOF = '#1e1410';

/** Quadro 0 = parado, 1 e 2 = trote, 3 = respirando (cabeça mais baixa). */
export function drawHorse(frame: number, saddle: boolean) {
  const { c, ctx } = makeCanvas(52, 40);
  const g = 38; // chão
  const legA = frame === 1 ? 2 : frame === 2 ? -2 : 0;
  const lift = (n: number) => (frame === 1 ? (n ? 3 : 0) : frame === 2 ? (n ? 0 : 3) : 0);
  // pernas de trás (a de longe é mais escura) e da frente
  const leg = (x: number, dx: number, up: number, dark: boolean) => {
    px(ctx, dark ? BODY_D : BODY, x + dx, 26, 4, g - 26 - up - 3);
    px(ctx, dark ? '#4a2614' : BODY_D, x + dx + 3, 26, 1, g - 26 - up - 3);
    px(ctx, '#e8dcc4', x + dx, g - 6 - up, 4, 3);
    px(ctx, HOOF, x + dx - 1, g - 3 - up, 5, 3);
  };
  leg(12, -legA, lift(1), true);
  leg(32, legA, lift(0), true);
  leg(16, legA, lift(0), false);
  leg(36, -legA, lift(1), false);
  // cauda
  const tw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  px(ctx, MANE, 4 + tw, 15, 5, 14);
  px(ctx, '#4a2c20', 5 + tw, 17, 1, 11);
  px(ctx, MANE, 2 + tw * 2, 22, 3, 9);
  // corpo
  px(ctx, BODY, 8, 14, 32, 14);
  px(ctx, BODY, 7, 16, 1, 9);
  px(ctx, BODY_L, 10, 14, 28, 3);
  px(ctx, BODY_L, 9, 16, 2, 4);
  px(ctx, BODY_D, 10, 25, 30, 3);
  px(ctx, BODY_D, 34, 18, 5, 8);
  px(ctx, '#7a3c22', 22, 20, 8, 1);
  // pescoço e cabeça
  const hd = frame === 3 ? 2 : 0;
  px(ctx, BODY, 36, 6 + hd, 8, 14);
  px(ctx, BODY_L, 37, 6 + hd, 2, 12);
  px(ctx, BODY_D, 42, 10 + hd, 2, 10);
  px(ctx, BODY, 38, 3 + hd, 10, 8);
  px(ctx, BODY_L, 39, 3 + hd, 7, 2);
  px(ctx, BODY, 44, 9 + hd, 6, 6);
  px(ctx, '#a07858', 46, 11 + hd, 5, 4);
  px(ctx, '#f0e6d2', 41, 4 + hd, 2, 8);
  px(ctx, '#1c1210', 44, 12 + hd, 1, 1);
  px(ctx, '#2a1a14', 49, 12 + hd, 1, 1);
  px(ctx, '#1c1210', 42, 6 + hd, 2, 2);
  px(ctx, '#ffffff', 42, 6 + hd, 1, 1);
  px(ctx, BODY_D, 39, 0 + hd, 3, 4);
  px(ctx, '#d08a70', 40, 1 + hd, 1, 2);
  // crina
  px(ctx, MANE, 34, 4 + hd, 4, 16);
  px(ctx, '#4a2c20', 35, 5 + hd, 1, 12);
  px(ctx, MANE, 37, 1 + hd, 3, 4);
  if (saddle) {
    px(ctx, '#e8d4a0', 18, 12, 14, 4);
    px(ctx, '#a83a2a', 19, 10, 12, 4);
    px(ctx, '#d0584a', 19, 10, 12, 1);
    px(ctx, '#6a2018', 29, 10, 2, 5);
    px(ctx, '#3a2218', 17, 15, 16, 1);
    // bolsa de couro com o bilhete
    px(ctx, '#7a5230', 21, 17, 8, 7);
    px(ctx, '#a8784a', 21, 17, 8, 2);
    px(ctx, '#f4ecd8', 23, 16, 4, 2);
  }
  return outlineSprite(c);
}

const SPRITES = new Map<string, HTMLCanvasElement[]>();
function frames(saddle: boolean) {
  const key = saddle ? 's' : 'n';
  let f = SPRITES.get(key);
  if (!f) {
    f = [0, 1, 2, 3].map((i) => drawHorse(i, saddle));
    SPRITES.set(key, f);
  }
  return f;
}

export type HorseBehavior = { kind: 'wander'; x: number; y: number; rx: number; ry: number; skittish: boolean } | { kind: 'follow' } | { kind: 'ridden' };

export class Horse {
  face: 1 | -1 = 1;
  behavior: HorseBehavior = { kind: 'follow' };
  saddled = false;
  /** 0..1: confiança ganha com a aproximação calma. */
  trust = 0;
  private anim = 0;
  private moving = false;
  private tx = 0;
  private ty = 0;
  private pause = 1;
  private flee = 0;

  constructor(
    public x: number,
    public y: number,
  ) {
    this.tx = x;
    this.ty = y;
  }

  /** Posição da sela em relação aos pés (o Matheus senta aqui). */
  static readonly SADDLE_Y = 22;

  update(dt: number, player: { x: number; y: number; run: boolean; dir: string; moving: boolean; anim: number }, col: Collision) {
    const b = this.behavior;
    if (b.kind === 'ridden') {
      this.x = player.x;
      this.y = player.y + 1;
      this.moving = player.moving;
      this.anim = player.anim * 1.3;
      if (player.dir === 'left') this.face = -1;
      else if (player.dir === 'right') this.face = 1;
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (b.kind === 'follow') {
      this.moving = false;
      if (dist > 38) {
        const sp = Math.min(80, 26 + dist * 1.2);
        const nx = this.x + (dx / dist) * sp * dt;
        const ny = this.y + (dy / dist) * sp * dt;
        this.x = nx;
        this.y = ny;
        col.resolve(this, 6);
        this.moving = true;
        this.anim += (dt * sp) / 6;
        this.face = dx < 0 ? -1 : 1;
      }
      return;
    }
    // vagueia no cercado; se for assustadiço e vir alguém correndo, trota para longe
    if (b.skittish && player.run && dist < 100) this.flee = 1.2;
    if (this.flee > 0) {
      this.flee -= dt;
      const ax = this.x - player.x;
      const ay = this.y - player.y;
      const l = Math.hypot(ax, ay) || 1;
      this.tx = b.x + Math.max(-b.rx, Math.min(b.rx, (ax / l) * b.rx * 1.5));
      this.ty = b.y + Math.max(-b.ry, Math.min(b.ry, (ay / l) * b.ry * 1.5));
      this.pause = 0;
    }
    const tdx = this.tx - this.x;
    const tdy = this.ty - this.y;
    const td = Math.hypot(tdx, tdy);
    if (td < 4 || this.pause > 0) {
      this.moving = false;
      this.pause -= dt;
      if (this.pause <= 0 && td < 4) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        this.tx = b.x + Math.cos(a) * b.rx * r;
        this.ty = b.y + Math.sin(a) * b.ry * r;
        this.pause = 1.5 + Math.random() * 3.5;
      }
      return;
    }
    const sp = this.flee > 0 ? 54 : 18;
    this.x += (tdx / td) * sp * dt;
    this.y += (tdy / td) * sp * dt;
    col.resolve(this, 6);
    this.moving = true;
    this.anim += (dt * sp) / 6;
    this.face = tdx < 0 ? -1 : 1;
  }

  drawable(): Drawable {
    return {
      y: this.behavior.kind === 'ridden' ? this.y - 1.5 : this.y,
      shadow: (v, cx, cy) => {
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 17, 4, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy, t) => {
        const set = frames(this.saddled);
        // trote em 4 quadros: par diagonal A, passagem (sobe 1 px), par diagonal B, passagem
        const phase = Math.floor(this.anim) % 4;
        const idx = this.moving ? [1, 0, 2, 0][phase] : Math.floor(t * 0.7) % 2 === 1 ? 3 : 0;
        const img = set[idx];
        const bob = this.moving && phase % 2 === 1 ? 1 : 0;
        v.save();
        v.translate(Math.round(this.x - cx), Math.round(this.y - cy) - 38 + 1 - bob);
        v.scale(this.face, 1);
        v.drawImage(img, -26, 0);
        v.restore();
      },
    };
  }
}
