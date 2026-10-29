import { makeCanvas, outlineSprite } from './art';
import type { Collision } from './collision';
import type { Dir4, Drawable } from './types';

/**
 * Moradores da vila em pixel art: mesma proporção fofa do Matheus (cabeção, corpo curto), mas cada um com suas cores,
 * chapéu, avental ou lenço. Os sprites nascem de uma receita (`PersonSpec`) e ficam em cache.
 */

export interface PersonSpec {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'hood' | 'bun' | 'bald';
  /** Cor da roupa de cima: [base, luz, sombra]. */
  top: [string, string, string];
  pants: string;
  shoes?: string;
  apron?: string;
  scarf?: string;
  hat?: { kind: 'straw' | 'cap'; color: string };
  beard?: boolean;
  held?: 'axe' | 'mug' | null;
  kid?: boolean;
}

const px = (ctx: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

type View = 'down' | 'up' | 'side';

/** Contorno da cabeça (x inicial e final de cada linha): cantos cortados, bem redondinha. */
const HEAD_FRONT: [number, number][] = [[7, 14], [6, 15], [5, 16], [5, 16], [5, 16], [5, 16], [5, 16], [6, 15], [7, 14]];
const HEAD_SIDE: [number, number][] = [[8, 14], [7, 15], [6, 15], [6, 15], [6, 15], [6, 15], [6, 15], [7, 15], [8, 14]];

const span = (ctx: CanvasRenderingContext2D, col: string, y: number, a: number, b: number) => px(ctx, col, a, y, b - a + 1, 1);

/**
 * Uma pose. `frame`: 0 = parado, 1 e 2 = passos (um pé de cada vez), 3 = no ar entre os passos (pés recolhidos).
 * Pés em (11, 31). Formas arredondadas (cabeça, ombros, mãos, sapatos), em vez de caixas.
 */
export function drawPerson(s: PersonSpec, view: View, frame: number, blink = false) {
  const { c, ctx } = makeCanvas(22, 32);
  const legH = s.kid ? 2 : 5;
  const torsoH = s.kid ? 6 : 9;
  const legTop = 29 - legH;
  const torsoTop = legTop - torsoH;
  const headTop = torsoTop - 8;
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const air = frame === 3 ? 1 : 0;
  const skinS = shade(s.skin, 0.84);
  const hairL = shade(s.hair, 1.4);
  const hairD = shade(s.hair, 0.75);
  const shoes = s.shoes ?? '#3a2a22';
  const sole = shade(shoes, 1.7);
  const [top, topL, topD] = s.top;
  const pantsL = shade(s.pants, 1.3);
  const pantsD = shade(s.pants, 0.72);
  const hoodCol = s.hairStyle === 'hood';

  // pernas e sapatos (cada pé sobe um pouco no seu passo; no ar sobem os dois)
  const footUp = (n: 1 | 2) => (step === (n === 1 ? 1 : -1) ? 1 : 0) + air;
  const shoe = (x: number, up: number, wide: number) => {
    span(ctx, shoes, 29 - up, x + 1, x + wide - 2);
    px(ctx, shoes, x, 30 - up, wide, 2);
    px(ctx, sole, x, 31 - up, wide, 1);
    px(ctx, shade(shoes, 1.35), x + 1, 29 - up, 2, 1);
  };

  if (view === 'side') {
    // duas pernas: a de trás (escura) e a da frente; no passo abrem para os lados
    const spread = step * 3;
    const hip = legTop;
    const leg = (dx: number, dark: boolean, up: number) => {
      const lx = 9 + dx;
      px(ctx, dark ? pantsD : s.pants, lx, hip, 4, 29 - hip - up);
      px(ctx, dark ? pantsD : pantsL, lx, hip + 1, 1, 28 - hip - up);
      shoe(lx - 1 + (dx > 0 ? 1 : 0), up, 6);
    };
    leg(-spread, true, step === -1 ? 1 + air : air);
    leg(spread, false, step === 1 ? 1 + air : air);
    // tronco de lado, ombro redondo
    span(ctx, top, torsoTop, 8, 14);
    px(ctx, top, 7, torsoTop + 1, 8, torsoH - 2);
    span(ctx, topD, torsoTop + torsoH - 1, 8, 14);
    px(ctx, topD, 7, torsoTop + 1, 2, torsoH - 2);
    px(ctx, topL, 13, torsoTop + 1, 1, torsoH - 3);
    if (s.apron) {
      px(ctx, s.apron, 12, torsoTop + 3, 3, torsoH);
      px(ctx, shade(s.apron, 0.8), 12, torsoTop + 3, 1, torsoH);
    }
    if (s.scarf) {
      px(ctx, s.scarf, 7, torsoTop - 1, 8, 2);
      px(ctx, shade(s.scarf, 0.7), 7, torsoTop + 1, 2, 3);
    }
    // braço balançando ao contrário das pernas
    const sw = -step * 3;
    px(ctx, topD, 9 + sw, torsoTop + 1, 4, torsoH - 3);
    px(ctx, top, 9 + sw, torsoTop + 1, 3, torsoH - 3);
    px(ctx, topL, 9 + sw, torsoTop + 1, 1, torsoH - 4);
    px(ctx, s.skin, 9 + sw + 1, torsoTop + torsoH - 2, 3, 2);
    // pescoço e cabeça de perfil, olhando para a direita
    px(ctx, skinS, 9, torsoTop - 1, 4, 2);
    HEAD_SIDE.forEach(([a, b], i) => span(ctx, s.skin, headTop + i, a, b));
    span(ctx, skinS, headTop + 8, 8, 14);
    px(ctx, s.skin, 16, headTop + 5, 1, 2);
    px(ctx, skinS, 16, headTop + 6, 1, 1);
    if (blink) px(ctx, '#1c1210', 12, headTop + 5, 2, 1);
    else {
      px(ctx, '#1c1210', 12, headTop + 4, 2, 3);
      px(ctx, '#ffffff', 12, headTop + 4, 1, 1);
    }
    px(ctx, '#f09a96', 10, headTop + 7, 2, 1);
    px(ctx, '#d8685f', 14, headTop + 7, 1, 1);
    if (s.beard) {
      span(ctx, s.hair, headTop + 7, 8, 13);
      span(ctx, s.hair, headTop + 8, 8, 14);
      px(ctx, s.hair, 7, headTop + 5, 3, 2);
      px(ctx, s.hair, 14, headTop + 6, 2, 1);
    }
    if (hoodCol) {
      px(ctx, topD, 6, headTop - 1, 9, 3);
      px(ctx, topD, 5, headTop + 1, 5, 9);
      px(ctx, top, 7, headTop - 1, 6, 1);
    } else if (s.hairStyle !== 'bald') {
      span(ctx, s.hair, headTop - 1, 8, 14);
      span(ctx, s.hair, headTop, 7, 15);
      span(ctx, s.hair, headTop + 1, 6, 15);
      px(ctx, s.hair, 6, headTop + 2, 5, s.hairStyle === 'long' ? 13 : 5);
      px(ctx, s.hair, 11, headTop + 2, 4, 1);
      px(ctx, s.hair, 13, headTop + 3, 2, 1);
      px(ctx, hairL, 9, headTop - 1, 3, 1);
      px(ctx, hairL, 8, headTop, 2, 1);
      px(ctx, hairD, 6, headTop + 6, 3, 1);
      if (s.hairStyle === 'bun') {
        span(ctx, s.hair, headTop - 4, 6, 9);
        span(ctx, s.hair, headTop - 3, 5, 9);
        span(ctx, s.hair, headTop - 2, 6, 9);
        px(ctx, hairL, 6, headTop - 4, 2, 1);
      }
    }
  } else {
    const back = view === 'up';
    // pernas
    const lUp = footUp(1);
    const rUp = footUp(2);
    px(ctx, s.pants, 7, legTop, 4, 29 - legTop - lUp);
    px(ctx, s.pants, 11, legTop, 4, 29 - legTop - rUp);
    px(ctx, pantsL, 7, legTop, 1, 29 - legTop - lUp);
    px(ctx, pantsL, 11, legTop, 1, 29 - legTop - rUp);
    px(ctx, pantsD, 10, legTop, 1, 29 - legTop - lUp);
    px(ctx, pantsD, 14, legTop, 1, 29 - legTop - rUp);
    shoe(6, lUp, 5);
    shoe(11, rUp, 5);

    // tronco com ombros redondos e mangas; os braços balançam ao contrário dos pés
    span(ctx, top, torsoTop, 7, 14);
    px(ctx, top, 6, torsoTop + 1, 10, torsoH - 2);
    span(ctx, topD, torsoTop + torsoH - 1, 7, 14);
    px(ctx, topL, 7, torsoTop + 1, 1, torsoH - 3);
    px(ctx, topD, 14, torsoTop + 1, 2, torsoH - 2);
    const aL = -step - air;
    const aR = step - air;
    const arm = (x: number, dy: number, light: boolean) => {
      px(ctx, top, x, torsoTop + 2 + dy, 2, torsoH - 4);
      px(ctx, light ? topL : topD, light ? x : x + 1, torsoTop + 2 + dy, 1, torsoH - 4);
      px(ctx, top, x === 4 ? x + 1 : x, torsoTop + 1 + dy, 1, 1);
      px(ctx, s.skin, x, torsoTop + torsoH - 2 + dy, 2, 2);
      px(ctx, skinS, x, torsoTop + torsoH - 1 + dy, 2, 1);
    };
    arm(4, aL, true);
    arm(16, aR, false);
    if (!back) {
      if (s.apron) {
        px(ctx, s.apron, 8, torsoTop + 3, 6, torsoH);
        px(ctx, shade(s.apron, 1.2), 8, torsoTop + 3, 1, torsoH);
        px(ctx, shade(s.apron, 0.78), 13, torsoTop + 3, 1, torsoH);
        px(ctx, shade(s.apron, 0.7), 8, torsoTop + torsoH + 2, 6, 1);
        px(ctx, shade(s.apron, 0.7), 7, torsoTop + 1, 1, 3);
        px(ctx, shade(s.apron, 0.7), 14, torsoTop + 1, 1, 3);
      }
      // gola
      px(ctx, skinS, 9, torsoTop, 4, 1);
      px(ctx, s.skin, 10, torsoTop + 1, 2, 1);
    } else if (s.apron) {
      px(ctx, shade(s.apron, 0.75), 6, torsoTop + 4, 10, 1);
      px(ctx, shade(s.apron, 0.75), 11, torsoTop + 4, 1, 5);
    }
    if (s.scarf) {
      span(ctx, s.scarf, torsoTop - 1, 6, 15);
      px(ctx, s.scarf, 6, torsoTop, 10, 1);
      if (!back) px(ctx, shade(s.scarf, 0.7), 12, torsoTop + 1, 2, 3);
    }
    px(ctx, skinS, 9, torsoTop - 1, 4, 2);

    // cabeça redonda
    const hs = back ? hairD : s.skin;
    HEAD_FRONT.forEach(([a, b], i) => span(ctx, hs, headTop + i, a, b));
    if (!back) {
      span(ctx, skinS, headTop + 8, 7, 14);
      px(ctx, s.skin, 4, headTop + 4, 1, 2);
      px(ctx, s.skin, 17, headTop + 4, 1, 2);
      px(ctx, skinS, 4, headTop + 5, 1, 1);
      px(ctx, skinS, 17, headTop + 5, 1, 1);
      if (blink) {
        px(ctx, '#1c1210', 7, headTop + 6, 2, 1);
        px(ctx, '#1c1210', 13, headTop + 6, 2, 1);
      } else {
        px(ctx, '#1c1210', 7, headTop + 4, 2, 3);
        px(ctx, '#1c1210', 13, headTop + 4, 2, 3);
        px(ctx, '#ffffff', 7, headTop + 4, 1, 1);
        px(ctx, '#ffffff', 13, headTop + 4, 1, 1);
        px(ctx, '#5a3a7a', 8, headTop + 6, 1, 1);
        px(ctx, '#5a3a7a', 14, headTop + 6, 1, 1);
      }
      px(ctx, '#f4a09a', 6, headTop + 7, 2, 1);
      px(ctx, '#f4a09a', 14, headTop + 7, 2, 1);
      px(ctx, '#d8685f', 10, headTop + 7, 2, 1);
      if (s.beard) {
        px(ctx, s.hair, 5, headTop + 5, 1, 2);
        px(ctx, s.hair, 16, headTop + 5, 1, 2);
        span(ctx, s.hair, headTop + 7, 6, 8);
        span(ctx, s.hair, headTop + 7, 13, 15);
        span(ctx, s.hair, headTop + 8, 7, 14);
        px(ctx, s.hair, 9, headTop + 6, 4, 1);
        px(ctx, '#d8685f', 10, headTop + 8, 2, 1);
      }
    }
    // cabelo ou capuz
    if (hoodCol) {
      span(ctx, topD, headTop - 1, 6, 15);
      span(ctx, topD, headTop, 5, 16);
      px(ctx, topD, 4, headTop + 1, 14, 2);
      px(ctx, topD, 4, headTop + 3, 3, 7);
      px(ctx, topD, 15, headTop + 3, 3, 7);
      px(ctx, top, 7, headTop - 1, 8, 1);
      if (back) px(ctx, topD, 4, headTop, 14, 10);
    } else if (s.hairStyle !== 'bald') {
      span(ctx, s.hair, headTop - 1, 7, 14);
      span(ctx, s.hair, headTop, 6, 15);
      span(ctx, s.hair, headTop + 1, 5, 16);
      span(ctx, s.hair, headTop + 2, 5, 16);
      if (!back) {
        // franja para o lado e costeletas
        px(ctx, s.hair, 5, headTop + 3, 4, 1);
        px(ctx, s.hair, 12, headTop + 3, 5, 1);
        px(ctx, s.hair, 10, headTop + 3, 1, 1);
        px(ctx, s.hair, 5, headTop + 4, 1, s.hairStyle === 'long' ? 12 : 2);
        px(ctx, s.hair, 16, headTop + 4, 1, s.hairStyle === 'long' ? 12 : 2);
        if (s.hairStyle === 'long') {
          px(ctx, s.hair, 4, headTop + 6, 1, 10);
          px(ctx, s.hair, 17, headTop + 6, 1, 10);
        }
      } else {
        px(ctx, s.hair, 5, headTop + 3, 12, s.hairStyle === 'long' ? 14 : 5);
        span(ctx, s.hair, headTop + 8, 7, 14);
      }
      px(ctx, hairL, 8, headTop - 1, 3, 1);
      px(ctx, hairL, 7, headTop, 3, 1);
      px(ctx, hairL, 13, headTop + 1, 2, 1);
      if (s.hairStyle === 'bun') {
        span(ctx, s.hair, headTop - 4, 9, 12);
        span(ctx, s.hair, headTop - 3, 8, 13);
        span(ctx, s.hair, headTop - 2, 8, 13);
        px(ctx, hairL, 9, headTop - 4, 2, 1);
      }
    } else if (!back) {
      px(ctx, hairD, 5, headTop + 3, 1, 3);
      px(ctx, hairD, 16, headTop + 3, 1, 3);
    }
  }

  // chapéu por cima de tudo, redondinho
  if (s.hat) {
    const hc = s.hat.color;
    const hl = shade(hc, 1.3);
    const hd = shade(hc, 0.7);
    if (s.hat.kind === 'straw') {
      span(ctx, hd, headTop - 1, 3, 18);
      span(ctx, hc, headTop - 2, 2, 19);
      span(ctx, hl, headTop - 3, 4, 17);
      span(ctx, hc, headTop - 4, 6, 15);
      span(ctx, hc, headTop - 5, 7, 14);
      px(ctx, hl, 8, headTop - 5, 3, 1);
      span(ctx, '#a83a2a', headTop - 3, 6, 15);
    } else {
      span(ctx, hc, headTop - 3, 7, 14);
      span(ctx, hc, headTop - 2, 5, 16);
      span(ctx, hc, headTop - 1, 5, 16);
      px(ctx, hl, 7, headTop - 3, 3, 1);
      if (view !== 'up') span(ctx, hd, headTop, view === 'side' ? 9 : 5, view === 'side' ? 17 : 16);
    }
  }
  // objeto na mão
  if (s.held === 'mug') {
    const hx = view === 'side' ? 14 : 17;
    px(ctx, '#e6d2a0', hx - 1, torsoTop + torsoH - 3, 4, 4);
    px(ctx, '#fff6dc', hx - 1, torsoTop + torsoH - 3, 4, 1);
    px(ctx, '#8a5a30', hx + 3, torsoTop + torsoH - 2, 1, 2);
  } else if (s.held === 'axe') {
    const hx = view === 'side' ? 15 : 18;
    px(ctx, '#7a5230', hx, torsoTop - 3, 1, torsoH + 4);
    px(ctx, '#b8bec8', hx - 2, torsoTop - 3, 3, 4);
    px(ctx, '#e6eaf0', hx - 2, torsoTop - 3, 1, 4);
  }
  return outlineSprite(c);
}


export interface PersonOpts {
  /** Para onde olha quando não há ninguém por perto. */
  facing?: Dir4;
  /** Volta e meia faz um gesto (pulinho de trabalho). */
  work?: { every: number };
  /** Passeio por pontos, de um em um. */
  patrol?: [number, number][];
  mutters?: readonly string[];
  /** Vira para o jogador quando ele chega perto. */
  watchPlayer?: boolean;
}

const sheetCache = new Map<PersonSpec, Record<string, HTMLCanvasElement>>();

function sheet(spec: PersonSpec) {
  let s = sheetCache.get(spec);
  if (s) return s;
  s = {};
  for (const v of ['down', 'up', 'side'] as View[]) {
    for (const f of [0, 1, 2, 3]) {
      s[`${v}${f}`] = drawPerson(spec, v, f);
      s[`${v}${f}b`] = drawPerson(spec, v, f, true);
    }
  }
  for (const f of [0, 1, 2, 3]) {
    for (const b of ['', 'b']) {
      const src = s[`side${f}${b}`];
      const { c, ctx } = makeCanvas(src.width, src.height);
      ctx.translate(src.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0);
      s[`left${f}${b}`] = c;
    }
  }
  sheetCache.set(spec, s);
  return s;
}

/** Um morador: fica no lugar, trabalha, passeia ou fala sozinho. */
export class Person {
  dir: Dir4;
  private anim = 0;
  private moving = false;
  private vx = 0;
  private vy = 0;
  private hop = 0;
  private nextWork: number;
  private pi = 0;
  private wait = 1 + Math.random() * 2;
  private readonly sprites: Record<string, HTMLCanvasElement>;
  private readonly offset = Math.random() * 5;

  constructor(
    readonly spec: PersonSpec,
    public x: number,
    public y: number,
    readonly opts: PersonOpts = {},
  ) {
    this.dir = opts.facing ?? 'down';
    this.sprites = sheet(spec);
    this.nextWork = (opts.work?.every ?? 0) * (0.4 + Math.random() * 0.6);
  }

  get mutters() {
    return this.opts.mutters ?? [];
  }

  /** Gesto de alegria: dois pulinhos. */
  cheer() {
    this.hop = 1;
  }

  /** Um gesto curto (falar, mexer em algo). */
  gesture() {
    this.hop = 0.55;
  }

  faceToward(tx: number, ty: number) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    this.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  }

  update(dt: number, t: number, player: { x: number; y: number }, col: Collision, talking: boolean) {
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt * 1.6);
    const near = Math.hypot(player.x - this.x, player.y - this.y) < 64;
    const patrol = this.opts.patrol;
    if (patrol && !(talking && near) && !(this.opts.watchPlayer && near)) {
      if (this.wait > 0) {
        this.wait -= dt;
        this.moving = false;
        this.vx = this.vy = 0;
        this.anim = 0;
      } else {
        const [tx, ty] = patrol[this.pi];
        const dx = tx - this.x;
        const dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) {
          this.pi = (this.pi + 1) % patrol.length;
          this.wait = 1.4 + Math.random() * 2.4;
        } else {
          // acelera e freia suave, em vez de sair andando de uma vez
          const want = Math.min(24, 8 + d * 1.2);
          const ease = 1 - Math.exp(-7 * dt);
          this.vx += ((dx / d) * want - this.vx) * ease;
          this.vy += ((dy / d) * want - this.vy) * ease;
          const nx = this.x + this.vx * dt;
          const ny = this.y + this.vy * dt;
          if (col.free(nx, ny, 3)) {
            this.x = nx;
            this.y = ny;
          } else {
            this.pi = (this.pi + 1) % patrol.length;
            this.wait = 0.6;
            this.vx = this.vy = 0;
          }
          // só troca de lado quando o outro eixo claramente manda (evita ficar virando no diagonal)
          const horiz = this.dir === 'left' || this.dir === 'right';
          const ax = Math.abs(this.vx);
          const ay = Math.abs(this.vy);
          if (horiz ? ay > ax * 1.5 : ax > ay * 1.5) this.dir = ax > ay ? (this.vx < 0 ? 'left' : 'right') : this.vy < 0 ? 'up' : 'down';
          else if (horiz) this.dir = this.vx < 0 ? 'left' : 'right';
          else this.dir = this.vy < 0 ? 'up' : 'down';
        }
        this.moving = Math.hypot(this.vx, this.vy) > 4;
        this.anim = this.moving ? this.anim + (dt * Math.hypot(this.vx, this.vy)) / 7.5 : 0;
      }
    } else {
      this.moving = false;
      this.vx = this.vy = 0;
      this.anim = 0;
      if (this.opts.watchPlayer && near) this.faceToward(player.x, player.y);
      else if (!patrol) this.dir = this.opts.facing ?? this.dir;
    }
    if (this.opts.work && !near) {
      this.nextWork -= dt;
      if (this.nextWork <= 0) {
        this.nextWork = this.opts.work.every;
        this.gesture();
      }
    }
    void t;
  }

  drawable(): Drawable {
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 7, 2.6, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy, t) => {
        const view = this.dir === 'right' ? 'side' : this.dir;
        // mesmo andar de 4 quadros do Matheus: pé A, passagem, pé B, passagem (sobe 1 px nas passagens)
        const phase = Math.floor(this.anim) % 4;
        const f = !this.moving ? 0 : [1, 0, 2, 0][phase];
        const blink = !this.moving && (t + this.offset) % 4.6 < 0.13 ? 'b' : '';
        const img = this.sprites[`${view}${f}${blink}`];
        const breathe = !this.moving && Math.floor((t + this.offset) * 1.3) % 2 === 1 ? 1 : 0;
        const hop = this.moving && phase % 2 === 1 ? 1 : 0;
        const jump = this.hop > 0 ? Math.round(Math.abs(Math.sin(this.hop * Math.PI * 2)) * 3) : 0;
        v.drawImage(img, Math.round(this.x - cx) - 11, Math.round(this.y - cy) - 31 - jump - hop + breathe);
      },
    };
  }
}
