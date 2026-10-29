import { OUTLINE } from './art';
import type { Collision } from './collision';
import type { Fx } from './fx';
import type { Kit } from './kit';
import type { Dir4, Drawable, Light } from './types';

const ANGLE: Record<Dir4, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const ATTACK_TIME = 0.34;
const DODGE_TIME = 0.26;

/**
 * O Matheus: anda com aceleração suave, cada passo é um pulinho, golpeia (cone à frente) e esquiva.
 * Unidades em pixels do jogo; 1 metro ≈ 18 px.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  dir: Dir4 = 'down';
  anim = 0;
  moving = false;
  run = false;
  frozen = false;
  readonly radius = 5;
  weapon: 'stick' | 'sword' | null = null;
  torchOn = false;
  /** A mochila e a espada nas costas (itens do jogo). */
  backpack = false;
  sword = false;
  /** Montado no cavalo: mais rápido, sentado em cima dele (sem pulinhos nem pernas). */
  riding = false;

  private attackT = -1;
  private dodgeT = -1;
  private dodgeDir = { x: 0, y: 1 };
  private invul = 0;
  private hurtT = 0;
  swingId = 0;
  private lastStep = 0;
  private hopH = 0;
  private squash = 0;
  private time = 0;

  constructor(private readonly kit: Kit, private readonly fx: Fx) {}

  place(x: number, y: number, dir: Dir4 = 'down') {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.dir = dir;
    this.anim = 0;
    this.resetCombat();
  }

  resetCombat() {
    this.attackT = -1;
    this.dodgeT = -1;
    this.invul = 0;
    this.hurtT = 0;
  }

  get armed() {
    return this.weapon !== null;
  }
  get swinging() {
    return this.attackT >= 0.08 && this.attackT <= 0.24;
  }
  get attacking() {
    return this.attackT >= 0;
  }
  get dodging() {
    return this.dodgeT >= 0;
  }
  get invulnerable() {
    return this.invul > 0 || this.dodgeT >= 0;
  }
  get facing() {
    return ANGLE[this.dir];
  }
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  face(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.dir = Math.abs(c) > Math.abs(s) ? (c < 0 ? 'left' : 'right') : s < 0 ? 'up' : 'down';
  }

  attack(): boolean {
    if (!this.weapon || this.attackT >= 0 || this.dodgeT >= 0 || this.frozen) return false;
    this.attackT = 0;
    this.swingId++;
    return true;
  }

  dodge(dx: number, dy: number): boolean {
    if (this.dodgeT >= 0 || this.attackT >= 0.12 || this.frozen) return false;
    const l = Math.hypot(dx, dy);
    if (l > 0.1) this.dodgeDir = { x: dx / l, y: dy / l };
    else this.dodgeDir = { x: Math.cos(this.facing), y: Math.sin(this.facing) };
    this.dodgeT = 0;
    this.attackT = -1;
    this.invul = Math.max(this.invul, 0.36);
    return true;
  }

  hurt() {
    this.invul = 1.1;
    this.hurtT = 0.25;
    this.attackT = -1;
  }

  /** `move`: vetor da entrada (x para a direita, y para cima), comprimento 0..1. */
  update(dt: number, move: { x: number; y: number }, col: Collision, time: number) {
    this.time = time;
    if (this.invul > 0) this.invul -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (this.attackT > ATTACK_TIME) this.attackT = -1;
    }
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      if (this.dodgeT > DODGE_TIME) this.dodgeT = -1;
    }

    let mx = this.frozen ? 0 : move.x;
    let my = this.frozen ? 0 : -move.y;
    const m = Math.hypot(mx, my);
    const wants = m > 0.12;
    const running = wants && m > 0.9;
    const base = !wants ? 0 : m < 0.75 ? 50 * (m / 0.75) : 50 + 34 * ((m - 0.75) / 0.25);
    const target = this.riding ? base * 1.7 : base;
    const slow = this.attackT >= 0 ? 0.4 : 1;
    if (m > 0) {
      mx /= m;
      my /= m;
    }
    if (this.dodgeT >= 0) {
      const k = this.dodgeT / DODGE_TIME;
      const sp = 150 * (0.35 + 0.65 * (1 - k));
      this.vx = this.dodgeDir.x * sp;
      this.vy = this.dodgeDir.y * sp;
    } else {
      const ease = 1 - Math.exp(-(wants ? 12 : 16) * dt);
      this.vx += (mx * target * slow - this.vx) * ease;
      this.vy += (my * target * slow - this.vy) * ease;
    }
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 2) this.vx = this.vy = 0;
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (col.free(nx, this.y, this.radius)) this.x = nx;
    else this.vx = 0;
    if (col.free(this.x, ny, this.radius)) this.y = ny;
    else this.vy = 0;

    this.moving = speed > 9;
    this.run = running && this.moving;
    if (wants && this.attackT < 0 && this.dodgeT < 0) this.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 'left' : 'right') : my < 0 ? 'up' : 'down';
    // andar em 4 quadros, como no Stardew: pé A, passagem, pé B, passagem (o quadro muda a cada 7,5 px andados)
    if (this.moving) this.anim += (dt * speed) / 7.5;
    else this.anim = 0;
    const phase = Math.floor(this.anim) % 4;
    this.hopH = this.moving && phase % 2 === 1 ? 1 : 0;
    this.squash = 0;
    const stepNo = Math.floor(this.anim);
    if (this.moving && stepNo !== this.lastStep && phase % 2 === 0 && this.dodgeT < 0) {
      this.fx.dust(this.x, this.y, this.run ? 4 : 2, this.onPath ? '#ecd8a8' : '#9cd064', this.vx);
    }
    this.lastStep = stepNo;
    if (this.dodgeT >= 0 && Math.random() < dt * 40) this.fx.burst(this.x, this.y - 6, 2, 0.4, '#d8e4ff');
  }

  /** Preenchido pela área: o chão aqui é trilha (poeira clara em vez de verde)? */
  onPath = false;

  torchPos() {
    const base = this.handPos();
    return { x: base.x + 1.5, y: base.y - 13 };
  }

  private handPos() {
    const dx = Math.round(this.x - 12);
    const dy = Math.round(this.y - 33);
    const hx = this.dir === 'right' ? dx + 17 : this.dir === 'left' ? dx + 4 : dx + 3;
    return { x: hx, y: dy + 25 - this.hopH + this.squash };
  }

  /** Luz da tocha (acesa no escuro) e um brilho acolhedor em volta do Matheus. */
  lights(out: Light[], time: number, dark: number) {
    const tA = this.torchOn ? Math.max(0, Math.min(1, (dark - 0.1) * 3)) : 0;
    const tp = this.torchPos();
    const tfl = 0.9 + 0.1 * Math.sin(time * 17) * Math.sin(time * 9);
    if (tA > 0.02) {
      out.push({ x: tp.x, y: tp.y, r: 108 * tfl, col: [255, 176, 100], a: tA * (0.16 + 0.42 * dark) * tfl });
      if (Math.random() < 0.15) this.fx.spark(tp.x + (Math.random() - 0.5) * 3, tp.y - 2);
    }
    out.push({ x: this.x, y: this.y - 12, r: 70, col: [255, 196, 140], a: 0.1 + 0.14 * dark });
  }

  private spriteKey(blinkNow: boolean) {
    const d = this.dir === 'right' ? 'side' : this.dir;
    let f = 0;
    if (this.moving) f = [1, 4, 2, 4][Math.floor(this.anim) % 4];
    else f = Math.floor(this.time * 1.3) % 2 === 1 ? 3 : 0;
    return `${d}${f}${blinkNow ? 'b' : ''}`;
  }

  drawable(darkOf: () => number): Drawable {
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        if (this.riding) return;
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 8 - this.hopH * 0.9, 3 - this.hopH * 0.25, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy, t) => {
        if (this.invul > 0 && this.hurtT <= 0 && Math.floor(t * 14) % 2 === 0 && this.dodgeT < 0) return;
        const img = this.kit.matheus[this.spriteKey(t % 4.3 < 0.13)];
        const pdx = Math.round(this.x - cx - 12);
        const dodging = this.dodgeT >= 0;
        const pdy = Math.round(this.y - cy - 33) + (dodging ? 4 : 0);
        const lean = 0;
        const hop = this.hopH;
        if (this.hurtT > 0) v.globalAlpha = 0.65;
        if (dodging) v.globalAlpha = 0.7;
        if (this.riding) {
          // montado: só o tronco, sentado na sela (as pernas ficam atrás do cavalo)
          v.drawImage(img, 0, 0, 24, 25, pdx, pdy - 12 + (this.moving ? Math.round(Math.sin(this.anim * 6.28) * 0.6) : 0), 24, 25);
        } else {
          // as pernas ficam no ar com o corpo; o tronco afunda 1 px ao aterrissar e inclina ao correr
          v.drawImage(img, 0, 24, 24, 10, pdx, pdy + 24 - hop, 24, 10);
          v.drawImage(img, 0, 0, 24, 25, pdx + lean, pdy - hop + this.squash, 24, 25);
        }
        v.globalAlpha = 1;
        this.drawBack(v, pdx, pdy - hop);
        this.drawTorch(v, darkOf());
        this.drawWeapon(v, pdx, pdy - hop);
      },
    };
  }

  /** Mochila e cabo da espada aparecendo atrás dos ombros. */
  private drawBack(v: CanvasRenderingContext2D, pdx: number, pdy: number) {
    if (this.backpack && this.dir !== 'down') {
      const bx = this.dir === 'up' ? pdx + 8 : this.dir === 'right' ? pdx + 5 : pdx + 12;
      v.fillStyle = OUTLINE;
      v.fillRect(bx - 1, pdy + 15, this.dir === 'up' ? 10 : 6, 11);
      v.fillStyle = '#9a6a3c';
      v.fillRect(bx, pdy + 16, this.dir === 'up' ? 8 : 4, 9);
      v.fillStyle = '#c08a54';
      v.fillRect(bx, pdy + 16, 2, 9);
    }
    if (this.sword && this.dir !== 'down' && this.weapon === 'sword') {
      v.fillStyle = '#d8dce6';
      v.fillRect(pdx + (this.dir === 'up' ? 16 : this.dir === 'right' ? 6 : 17), pdy + 6, 1, 9);
      v.fillStyle = '#e6c25a';
      v.fillRect(pdx + (this.dir === 'up' ? 15 : this.dir === 'right' ? 5 : 16), pdy + 15, 3, 1);
    }
  }

  private drawTorch(v: CanvasRenderingContext2D, dark: number) {
    const tA = this.torchOn ? Math.max(0, Math.min(1, (dark - 0.1) * 3)) : 0;
    if (tA < 0.03) return;
    const hp = this.handPos();
    const handX = hp.x;
    const handY = hp.y;
    v.globalAlpha = tA;
    const fx = Math.round(Math.sin(this.time * 17) + Math.sin(this.time * 29));
    v.fillStyle = OUTLINE;
    v.fillRect(handX - 1, handY - 8, 5, 10);
    v.fillStyle = '#7a4a2a';
    v.fillRect(handX, handY - 7, 3, 8);
    v.fillStyle = '#a87348';
    v.fillRect(handX, handY - 7, 1, 8);
    v.fillStyle = '#3a2a22';
    v.fillRect(handX - 1, handY - 9, 5, 2);
    v.fillStyle = '#d83a20';
    v.fillRect(handX - 1, handY - 14 + (fx > 0 ? -1 : 0), 5, 5);
    v.fillRect(handX, handY - 16 + fx, 3, 3);
    v.fillStyle = '#ff9a2a';
    v.fillRect(handX, handY - 13, 3, 4);
    v.fillRect(handX + 1, handY - 15 + fx, 1, 2);
    v.fillStyle = '#ffe070';
    v.fillRect(handX + 1, handY - 12, 1, 3);
    v.globalAlpha = 1;
  }

  /** Arma girando no golpe: série de pixels ao longo do ângulo. */
  private drawWeapon(v: CanvasRenderingContext2D, pdx: number, pdy: number) {
    if (this.attackT < 0 || !this.weapon) return;
    const k = Math.min(1, this.attackT / ATTACK_TIME);
    const a = this.facing - 1.15 + 2.3 * k;
    const px = pdx + 12 + Math.cos(this.facing) * 3;
    const py = pdy + 24 + Math.sin(this.facing) * 2;
    const len = this.weapon === 'sword' ? 17 : 14;
    for (let i = 3; i < len; i++) {
      const x = Math.round(px + Math.cos(a) * i);
      const y = Math.round(py + Math.sin(a) * i);
      if (this.weapon === 'sword') {
        v.fillStyle = i < 5 ? '#e6c25a' : i > len - 3 ? '#ffffff' : '#d8dce6';
        v.fillRect(x, y, 2, 2);
      } else {
        v.fillStyle = i % 5 === 0 ? '#5a3a22' : '#7a5230';
        v.fillRect(x, y, 2, 2);
      }
    }
    // arco do golpe, bem de leve
    if (this.attackT > 0.06 && this.attackT < 0.26) {
      v.fillStyle = 'rgba(255,255,255,0.35)';
      for (let j = 0; j < 8; j++) {
        const aa = a - j * 0.14;
        v.fillRect(Math.round(px + Math.cos(aa) * (len + 1)), Math.round(py + Math.sin(aa) * (len + 1)), 1, 1);
      }
    }
  }
}
