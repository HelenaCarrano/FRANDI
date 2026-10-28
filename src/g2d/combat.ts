import { audio } from '../core/audio';
import { content } from '../content';
import type { GameState } from '../core/gameState';
import type { UI } from '../ui/ui';
import { ringPx } from './art';
import type { Collision, CircleHandle } from './collision';
import type { Fx } from './fx';
import type { Player } from './player';
import type { Dir4, Drawable } from './types';

/**
 * Combate: espíritos da névoa (fiapo, sombra, corvo), corações do Matheus, golpe em cone, esquiva e derrota gentil
 * (a tela escurece, ele "acorda" no último ponto seguro com a vida cheia, sem perder nada).
 * Cada encontro vencido grava `foe_<id>` e não volta. Uma muralha de névoa pode fechar o caminho até o fim da luta.
 */

export const MAX_HEARTS = 3;
export type SpiritKind = 'fiapo' | 'sombra' | 'corvo';

interface Stats {
  hp: number;
  speed: number;
  radius: number;
  reach: number;
  windup: number;
  recover: number;
}
// 1 metro ≈ 18 px
const STATS: Record<SpiritKind, Stats> = {
  fiapo: { hp: 2, speed: 59, radius: 9, reach: 23, windup: 0.55, recover: 0.7 },
  sombra: { hp: 8, speed: 36, radius: 17, reach: 49, windup: 0.95, recover: 1.1 },
  corvo: { hp: 2, speed: 76, radius: 9, reach: 22, windup: 0.6, recover: 1.2 },
};

type State = 'rise' | 'chase' | 'windup' | 'attack' | 'recover' | 'dying' | 'orbit' | 'dive';

export interface SpiritOptions {
  kind: SpiritKind;
  x: number;
  y: number;
  hp?: number;
}

interface SpiritContext {
  player: Player;
  col: Collision;
  torchLit: boolean;
  hitPlayer: (damage: number, fromX: number, fromY: number) => void;
  fx: Fx;
}

export class Spirit {
  readonly kind: SpiritKind;
  x: number;
  y: number;
  /** Altura no ar (só o corvo). */
  alt = 0;
  hp: number;
  dead = false;
  gone = false;
  lastSwing = -1;
  readonly s: Stats;
  private state: State = 'rise';
  private t = 0;
  private aim = { x: 0, y: 1 };
  private knock = { x: 0, y: 0 };
  private hitDone = false;
  private orbitAngle = 0;
  private orbitWait = 2;
  private flashT = 0;
  private readonly phase = Math.random() * 6;
  private warn = 0;

  constructor(o: SpiritOptions) {
    this.kind = o.kind;
    this.s = STATS[o.kind];
    this.x = o.x;
    this.y = o.y;
    this.hp = o.hp ?? this.s.hp;
    if (o.kind === 'corvo') this.alt = 30;
  }

  get radius() {
    return this.s.radius;
  }

  /** Dá para acertá-lo agora? (O corvo só quando está baixo.) */
  get vulnerable() {
    if (this.dead || this.state === 'rise') return false;
    if (this.kind === 'corvo') return this.alt < 14;
    return true;
  }

  /** Leva `damage`; é empurrado para longe de (fromX, fromY). Devolve true se morreu. */
  hit(damage: number, fromX: number, fromY: number, ctx: SpiritContext): boolean {
    if (!this.vulnerable) return false;
    this.hp -= damage;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    const push = this.kind === 'sombra' ? 45 : 126;
    this.knock = { x: (dx / l) * push, y: (dy / l) * push };
    ctx.fx.burst(this.x, this.y - 10 - this.alt, 10, 0.8);
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dying';
      this.t = 0;
      ctx.fx.burst(this.x, this.y - 10 - this.alt, 30, 1.4);
      return true;
    }
    // a sombra aguenta o golpe sem interromper o ataque; os outros se assustam
    if (this.kind !== 'sombra' && (this.state === 'windup' || this.state === 'attack' || this.state === 'dive')) {
      this.state = 'recover';
      this.t = 0;
      this.hitDone = true;
    }
    this.flashT = 0.2;
    return false;
  }

  update(dt: number, time: number, ctx: SpiritContext) {
    this.t += dt;
    const p = ctx.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.flashT > 0) this.flashT -= dt;

    if (Math.hypot(this.knock.x, this.knock.y) > 1) {
      this.x += this.knock.x * dt;
      this.y += this.knock.y * dt;
      const k = Math.exp(-9 * dt);
      this.knock.x *= k;
      this.knock.y *= k;
      ctx.col.resolve(this, this.radius * 0.6);
    }
    const slow = ctx.torchLit && dist < 117 ? 0.72 : 1;
    const step = (ux: number, uy: number, speed: number) => {
      this.x += ux * speed * dt;
      this.y += uy * speed * dt;
      ctx.col.resolve(this, this.radius * 0.6);
    };
    const ux = dx / (dist || 1);
    const uy = dy / (dist || 1);

    switch (this.state) {
      case 'rise': {
        const k = Math.min(1, this.t / 0.9);
        this.warn = 0;
        if (k >= 1) {
          this.state = this.kind === 'corvo' ? 'orbit' : 'chase';
          this.t = 0;
          this.orbitAngle = Math.atan2(this.y - p.y, this.x - p.x);
        }
        break;
      }
      case 'chase': {
        const stop = this.s.reach * 0.8 + p.radius;
        if (dist > stop) step(ux, uy, this.s.speed * slow);
        this.warn = 0;
        if (dist < this.s.reach + (this.kind === 'fiapo' ? 32 : 7) && this.t > 0.5) {
          this.state = 'windup';
          this.t = 0;
          this.hitDone = false;
        }
        break;
      }
      case 'windup': {
        this.warn = Math.min(1, this.t / this.s.windup);
        if (this.t >= this.s.windup) {
          this.state = 'attack';
          this.t = 0;
          this.aim = { x: ux, y: uy };
        }
        break;
      }
      case 'attack': {
        if (this.kind === 'sombra') {
          // pancada em área, de uma vez
          if (!this.hitDone) {
            this.hitDone = true;
            if (dist < this.s.reach + p.radius) ctx.hitPlayer(1, this.x, this.y);
            ctx.fx.burst(this.x, this.y, 22, 1.6, '#8a98c8');
          }
          this.warn = 0;
          if (this.t > 0.25) {
            this.state = 'recover';
            this.t = 0;
          }
        } else if (this.kind === 'fiapo') {
          step(this.aim.x, this.aim.y, 171);
          if (!this.hitDone && dist < this.radius + p.radius + 6) {
            this.hitDone = true;
            ctx.hitPlayer(1, this.x, this.y);
          }
          if (this.t > 0.38) {
            this.state = 'recover';
            this.t = 0;
          }
        } else {
          // corvo: troca o ataque por mergulho
          this.state = 'dive';
          this.t = 0;
          this.aim = { x: ux, y: uy };
        }
        break;
      }
      case 'recover': {
        this.warn = Math.max(0, 1 - this.t * 3);
        if (this.kind === 'corvo') {
          this.alt += (4 - this.alt) * (1 - Math.exp(-8 * dt));
          if (this.t > this.s.recover) {
            this.state = 'orbit';
            this.t = 0;
            this.orbitWait = 2 + Math.random() * 1.5;
          }
        } else if (this.t > this.s.recover) {
          this.state = 'chase';
          this.t = 0;
        }
        break;
      }
      case 'orbit': {
        this.orbitAngle += dt * 1.3;
        const tx = p.x + Math.cos(this.orbitAngle) * 80;
        const ty = p.y + Math.sin(this.orbitAngle) * 50;
        this.x += (tx - this.x) * (1 - Math.exp(-3 * dt));
        this.y += (ty - this.y) * (1 - Math.exp(-3 * dt));
        this.alt += (30 - this.alt) * (1 - Math.exp(-3 * dt));
        this.warn = 0;
        this.orbitWait -= dt;
        if (this.orbitWait <= 0) {
          this.state = 'windup';
          this.t = 0;
          this.hitDone = false;
        }
        break;
      }
      case 'dive': {
        step(this.aim.x, this.aim.y, 225);
        this.alt += (3 - this.alt) * (1 - Math.exp(-9 * dt));
        if (!this.hitDone && dist < this.radius + p.radius + 5) {
          this.hitDone = true;
          ctx.hitPlayer(1, this.x, this.y);
        }
        if (this.t > 0.75) {
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'dying': {
        if (this.t >= 0.5) this.gone = true;
        break;
      }
    }
    void time;
  }

  drawable(time: number): Drawable {
    const sizeK = this.kind === 'sombra' ? 1.9 : this.kind === 'corvo' ? 0.9 : 1;
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        if (this.state === 'rise' && this.t < 0.2) return;
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 7 * sizeK, 2.5 * sizeK, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy) => {
        const sx = Math.round(this.x - cx);
        const sy = Math.round(this.y - cy);
        let k = 1;
        if (this.state === 'rise') k = Math.max(0.05, Math.min(1, this.t / 0.9));
        if (this.state === 'dying') k = Math.max(0.01, 1 - this.t / 0.5);
        // círculo de aviso da pancada da sombra
        if (this.kind === 'sombra' && this.state === 'windup') {
          v.fillStyle = `rgba(255,90,90,${0.2 + 0.5 * this.warn})`;
          ringPx(v, sx, sy, this.s.reach, this.s.reach * 0.55, 2);
        }
        v.globalAlpha = 0.85 * k;
        const bob = Math.round(Math.sin(time * 3 + this.phase) * 1.2);
        if (this.kind === 'corvo') this.drawBird(v, sx, sy - this.alt + bob, time, k);
        else this.drawGhost(v, sx, sy + bob, sizeK * k, time);
        v.globalAlpha = 1;
      },
    };
  }

  private drawGhost(v: CanvasRenderingContext2D, sx: number, sy: number, k: number, time: number) {
    const hot = this.warn;
    const flash = this.flashT > 0;
    const body = flash ? '#ffffff' : hot > 0.2 ? '#f0a8a8' : this.kind === 'sombra' ? '#56689a' : '#a9c0ee';
    const light = flash ? '#ffffff' : hot > 0.2 ? '#ffd0d0' : this.kind === 'sombra' ? '#7a8ec0' : '#d8e6ff';
    const dark = hot > 0.2 ? '#b06868' : this.kind === 'sombra' ? '#34426e' : '#6f88c0';
    const outline = '#222f5a';
    const H = Math.round(18 * k);
    const Wd = Math.round(8 * k);
    for (let i = 0; i < H; i++) {
      const t = i / H;
      let half = t < 0.4 ? Math.round(Wd * Math.sqrt(1 - ((0.4 - t) / 0.4) ** 2)) : Wd;
      // bainha rasgada embaixo
      if (t > 0.78) half = Math.max(1, half - Math.round(((i + Math.floor(time * 6)) % 4 < 2 ? 1 : 3) * k));
      const y = sy - H + i;
      v.fillStyle = outline;
      v.fillRect(sx - half - 1, y, half * 2 + 2, 1);
      v.fillStyle = body;
      v.fillRect(sx - half, y, half * 2, 1);
      v.fillStyle = light;
      v.fillRect(sx - half, y, Math.max(1, Math.round(half * 0.5)), 1);
      v.fillStyle = dark;
      v.fillRect(sx + half - Math.max(1, Math.round(half * 0.4)), y, Math.max(1, Math.round(half * 0.4)), 1);
    }
    // olhos (brilham vermelhos ao avisar o ataque)
    v.fillStyle = hot > 0.2 ? '#ff4040' : this.kind === 'sombra' ? '#ffe070' : '#1a2448';
    const ey = sy - Math.round(H * 0.68);
    const ex = Math.max(2, Math.round(3 * k));
    v.fillRect(sx - ex - 1, ey, Math.max(2, Math.round(2 * k)), Math.max(2, Math.round(3 * k)));
    v.fillRect(sx + ex - 1, ey, Math.max(2, Math.round(2 * k)), Math.max(2, Math.round(3 * k)));
  }

  private drawBird(v: CanvasRenderingContext2D, sx: number, sy: number, time: number, k: number) {
    const flap = Math.sin(time * 18 + this.phase) > 0 ? 1 : -1;
    const hot = this.warn > 0.2;
    const flash = this.flashT > 0;
    const body = flash ? '#ffffff' : hot ? '#6a3450' : '#2c3550';
    const wing = flash ? '#ffffff' : hot ? '#8a4a68' : '#3c4a72';
    v.fillStyle = '#10162c';
    v.fillRect(sx - 6 * k, sy - 5 * k, 12 * k, 8 * k);
    v.fillStyle = body;
    v.fillRect(sx - 5 * k, sy - 4 * k, 10 * k, 6 * k);
    v.fillStyle = wing;
    v.fillRect(sx - 12 * k, sy - 4 * k - flap * 3, 7 * k, 3);
    v.fillRect(sx + 5 * k, sy - 4 * k - flap * 3, 7 * k, 3);
    v.fillStyle = '#e8a030';
    v.fillRect(sx + 5 * k, sy - 2 * k, 3, 2);
    v.fillStyle = hot ? '#ff4040' : '#c8d8ff';
    v.fillRect(sx + 2 * k, sy - 3 * k, 2, 2);
  }
}

export interface EncounterDef {
  id: string;
  /** Centro e raio do gatilho: a luta começa quando o Matheus chega perto. */
  x: number;
  y: number;
  radius: number;
  enemies: SpiritOptions[];
  /** Pilares de névoa que fecham o caminho até o encontro acabar. */
  barrier?: { x: number; y: number }[];
  /** Para onde ele volta se perder / onde passa a "acordar" depois de vencer. */
  checkpoint?: { x: number; y: number; dir?: Dir4 };
  /** O encontro só vale quando isto devolve true (ex.: depois de pegar o galho). */
  enabled?: () => boolean;
  onStart?: () => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

interface Runtime {
  def: EncounterDef;
  state: 'idle' | 'active' | 'cleared';
  spirits: Spirit[];
  colliders: CircleHandle[];
  fade: number;
  defeats: number;
}

export interface CombatOptions {
  col: Collision;
  player: Player;
  ui: UI;
  game: GameState;
  fx: Fx;
  teleport: (x: number, y: number, dir?: Dir4) => void;
  /** Ponto seguro inicial (a chegada na área). */
  start: { x: number; y: number; dir?: Dir4 };
  /** A tocha acesa deixa os espíritos mais lentos. */
  torchLit?: () => boolean;
}

export class CombatSystem {
  hearts = MAX_HEARTS;
  /** Depuração: não leva dano. */
  god = false;
  private readonly runs: Runtime[] = [];
  private checkpoint: { x: number; y: number; dir?: Dir4 };
  private paused = false;
  private shown = false;
  private readonly ctx: SpiritContext;

  constructor(private readonly o: CombatOptions) {
    this.checkpoint = o.start;
    this.ctx = {
      player: o.player,
      col: o.col,
      torchLit: false,
      hitPlayer: (d, x, y) => this.hitPlayer(d, x, y),
      fx: o.fx,
    };
  }

  add(def: EncounterDef) {
    const done = this.o.game.flag(`foe_${def.id}`);
    const run: Runtime = { def, state: done ? 'cleared' : 'idle', spirits: [], colliders: [], fade: done ? 0 : 1, defeats: 0 };
    if (!done && def.barrier) for (const b of def.barrier) run.colliders.push(this.o.col.addCircle(b.x, b.y, 8));
    this.runs.push(run);
    return run;
  }

  /** Algum encontro em andamento? */
  get fighting() {
    return this.runs.some((r) => r.state === 'active');
  }
  get enemies(): Spirit[] {
    return this.runs.flatMap((r) => r.spirits);
  }

  private weaponNow(): 'sword' | 'stick' | null {
    const g = this.o.game;
    return g.has('espada') ? 'sword' : g.has('galho') ? 'stick' : null;
  }

  attack() {
    const { player } = this.o;
    if (this.paused || this.o.ui.inDialog) return;
    player.weapon = this.weaponNow();
    // mira assistida: vira para o espírito mais perto, se houver um por perto
    let best: Spirit | null = null;
    let bestD = 61;
    for (const s of this.enemies) {
      if (s.dead) continue;
      const d = Math.hypot(s.x - player.x, s.y - player.y);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (best && !player.dodging) player.face(Math.atan2(best.y - player.y, best.x - player.x));
    if (player.attack()) audio.play('swing');
  }

  dodge(dx: number, dy: number) {
    const { player } = this.o;
    if (this.paused || this.o.ui.inDialog) return;
    if (player.dodge(dx, dy)) {
      audio.play('dodge');
      this.o.fx.burst(player.x, player.y - 6, 10, 0.6);
    }
  }

  private hitPlayer(damage: number, fromX: number, fromY: number) {
    const { player, ui, col } = this.o;
    if (this.paused || player.invulnerable || this.god) return;
    this.hearts = Math.max(0, this.hearts - damage);
    audio.play('hurt');
    player.hurt();
    ui.hurtFlash();
    ui.setHearts(this.hearts, MAX_HEARTS);
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    for (let i = 1; i <= 6; i++) {
      const nx = player.x + (dx / l) * 3;
      const ny = player.y + (dy / l) * 3;
      if (col.free(nx, player.y, player.radius)) player.x = nx;
      if (col.free(player.x, ny, player.radius)) player.y = ny;
    }
    if (this.hearts <= 0) void this.defeat();
  }

  private async defeat() {
    const { player, ui } = this.o;
    this.paused = true;
    player.frozen = true;
    audio.play('defeat');
    await ui.fade(true, content.combat.defeat);
    for (const r of this.runs) {
      if (r.state !== 'active') continue;
      r.spirits.length = 0;
      r.state = 'idle';
      r.defeats++;
    }
    player.resetCombat();
    this.o.teleport(this.checkpoint.x, this.checkpoint.y, this.checkpoint.dir);
    this.hearts = MAX_HEARTS;
    ui.setHearts(this.hearts, MAX_HEARTS);
    await ui.fade(false);
    player.frozen = false;
    this.paused = false;
    ui.toast(content.combat.wake);
  }

  private start(r: Runtime) {
    r.state = 'active';
    audio.play('rise');
    // depois de muitas derrotas seguidas a luta fica um pouco mais branda
    const soften = r.defeats >= 3 ? 1 : 0;
    for (const e of r.def.enemies) {
      const s = new Spirit({ ...e, hp: e.hp !== undefined ? Math.max(1, e.hp - soften) : undefined });
      if (soften && e.hp === undefined) s.hp = Math.max(1, s.hp - soften);
      r.spirits.push(s);
    }
    void r.def.onStart?.();
  }

  private finish(r: Runtime) {
    r.state = 'cleared';
    r.defeats = 0;
    this.o.game.setFlag(`foe_${r.def.id}`);
    for (const c of r.colliders) this.o.col.remove(c);
    r.colliders.length = 0;
    this.checkpoint = r.def.checkpoint ?? { x: this.o.player.x, y: this.o.player.y, dir: this.o.player.dir };
    if (this.hearts < MAX_HEARTS) {
      this.hearts = MAX_HEARTS;
      this.o.ui.setHearts(this.hearts, MAX_HEARTS);
      this.o.ui.toast(content.combat.rest);
      audio.play('rest');
    }
    void r.def.onClear?.();
  }

  /** Larga a luta em andamento (o jogador saiu da zona): os espíritos somem e o encontro recomeça quando ele voltar. */
  abort() {
    for (const r of this.runs) {
      if (r.state !== 'active') continue;
      r.spirits.length = 0;
      r.state = 'idle';
    }
  }

  heal() {
    this.hearts = MAX_HEARTS;
    this.o.ui.setHearts(this.shown ? this.hearts : null, MAX_HEARTS);
  }

  killAll() {
    for (const s of this.enemies) {
      s.hp = 0;
      s.dead = true;
      s.gone = true;
    }
  }

  update(dt: number, time: number) {
    const { player, ui } = this.o;
    player.weapon = this.weaponNow();
    const show = player.armed;
    if (show !== this.shown) {
      this.shown = show;
      ui.setHearts(show ? this.hearts : null, MAX_HEARTS);
    }
    this.ctx.torchLit = this.o.torchLit?.() ?? false;

    for (const r of this.runs) {
      if (r.state === 'cleared' && r.fade > 0) r.fade = Math.max(0, r.fade - dt * 1.4);
      if (r.state === 'idle' && !this.paused && (!r.def.enabled || r.def.enabled())) {
        const d = Math.hypot(player.x - r.def.x, player.y - r.def.y);
        if (d < r.def.radius && !this.fighting) this.start(r);
      }
      if (r.state !== 'active') continue;
      if (!this.paused) for (const s of r.spirits) s.update(dt, time, this.ctx);

      // golpe do Matheus: cone à frente
      if (player.swinging && !this.paused) {
        const sword = this.weaponNow() === 'sword';
        const reach = sword ? 49 : 41;
        const fx = Math.cos(player.facing);
        const fy = Math.sin(player.facing);
        for (const s of r.spirits) {
          if (s.dead || s.lastSwing === player.swingId) continue;
          const dx = s.x - player.x;
          const dy = s.y - player.y;
          const d = Math.hypot(dx, dy);
          if (d > reach + s.radius) continue;
          const cos = (dx * fx + dy * fy) / (d || 1);
          if (cos < Math.cos(1.0) && d > s.radius + 11) continue;
          if (!s.vulnerable) continue;
          s.lastSwing = player.swingId;
          audio.play(s.hit(sword ? 2 : 1, player.x, player.y, this.ctx) ? 'kill' : 'hit');
        }
      }
      for (let i = r.spirits.length - 1; i >= 0; i--) if (r.spirits[i].gone) r.spirits.splice(i, 1);
      if (r.spirits.length === 0 && !this.paused) this.finish(r);
    }
  }

  /** Espíritos e muralhas de névoa, para o desenho em ordem de profundidade. */
  drawables(out: Drawable[], time: number) {
    for (const r of this.runs) {
      for (const s of r.spirits) out.push(s.drawable(time));
      if (r.def.barrier && r.fade > 0) {
        r.def.barrier.forEach((b, i) => {
          out.push({
            y: b.y,
            draw: (v, cx, cy, t) => {
              const sx = Math.round(b.x - cx);
              const sy = Math.round(b.y - cy);
              const h = Math.round((26 + Math.sin(t * 2 + i) * 3) * r.fade);
              for (let k = 0; k < 6; k++) {
                const yy = sy - (k * h) / 6;
                const w = 9 + Math.sin(t * 1.6 + i * 2 + k) * 3;
                v.fillStyle = `rgba(190,220,255,${0.16 * (1 - k / 7) * r.fade + 0.05})`;
                v.fillRect(Math.round(sx - w), Math.round(yy - 5), Math.round(w * 2), 8);
                v.fillStyle = `rgba(235,245,255,${0.1 * (1 - k / 7) * r.fade})`;
                v.fillRect(Math.round(sx - w * 0.6 + Math.sin(t + k) * 2), Math.round(yy - 4), Math.round(w * 1.2), 4);
              }
            },
          });
        });
      }
    }
  }

  dispose() {
    for (const r of this.runs) r.spirits.length = 0;
  }
}
