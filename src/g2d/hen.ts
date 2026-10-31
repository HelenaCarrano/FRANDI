import { audio } from '../core/audio';
import { content, fmt } from '../content';
import type { GameState } from '../core/gameState';
import type { UI } from '../ui/ui';
import type { Collision } from './collision';
import type { Kit } from './kit';
import type { Player } from './player';
import type { Drawable } from './types';

/**
 * A galinha companheira: depois do encontro na vila ela segue o Matheus por todas as áreas e, de tempos em tempos,
 * bota um ovo que vai direto para a mochila. Os ovos são controlados pelo jogo: cada um depende de um marco da história
 * (consertar o moinho, entregar a encomenda, chegar a uma área nova) e só vem uma vez, então nunca passam de seis.
 */

const EGGS: [string, (g: GameState) => boolean][] = [
  ['egg_mill', (g) => g.quest('mill') === 'done'],
  ['egg_order', (g) => g.quest('order') === 'done'],
  ['egg_ruins', (g) => g.flag('ruins_seen')],
  ['egg_tavern', (g) => g.flag('tavern_seen')],
  ['egg_vineyard', (g) => g.flag('vineyard_seen')],
  ['egg_farm', (g) => g.flag('farm_seen')],
];
const COOLDOWN = 7;

export class Hen {
  x = 0;
  y = 0;
  visible = false;
  private anim = 0;
  private face = 1;
  private cooldown = 4;
  private wiggle = 0;
  private busy = false;
  private flying: { t: number; fx: number; fy: number } | null = null;
  private col: Collision | null = null;

  constructor(
    private readonly kit: Kit,
    private readonly ui: UI,
    private readonly game: GameState,
    private readonly player: Player,
  ) {}

  get name() {
    return content.village.henName;
  }

  /** Coloca a galinha na área atual (se o Matheus já a conheceu). */
  enter(col: Collision, at?: { x: number; y: number }) {
    this.col = col;
    this.visible = this.game.flag('henMet');
    if (!this.visible) return;
    this.x = at?.x ?? this.player.x - 24;
    this.y = at?.y ?? this.player.y + 10;
    this.flying = null;
  }

  update(dt: number, time: number) {
    if (!this.visible || !this.col) return;
    const dx = this.player.x - this.x;
    const dy = this.player.y + 5 - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 24) {
      const sp = Math.min(76, 28 + dist * 1.4);
      this.x += (dx / dist) * sp * dt;
      this.y += (dy / dist) * sp * dt;
      this.anim += dt * Math.min(10, sp / 7);
      this.face = dx < 0 ? -1 : 1;
      this.col.resolve(this, 3);
    } else this.anim = 0;
    if (this.wiggle > 0) this.wiggle = Math.max(0, this.wiggle - dt);

    const f = this.flying;
    if (f) {
      f.t += dt / 0.9;
      if (f.t >= 1) {
        this.flying = null;
        void this.deliver();
      }
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown > 0 || this.busy || this.ui.inDialog || this.player.frozen) return;
    for (const [flag, cond] of EGGS) {
      if (!this.game.flag(flag) && cond(this.game)) {
        this.game.setFlag(flag);
        this.lay(time);
        break;
      }
    }
  }

  private lay(_time: number) {
    this.cooldown = COOLDOWN;
    this.wiggle = 0.6;
    audio.play('cluck');
    const from = { x: this.x, y: this.y - 8 };
    setTimeout(() => {
      this.flying = { t: 0, fx: from.x, fy: from.y };
    }, 600);
  }

  private async deliver() {
    this.game.addItem('ovos');
    audio.play('egg');
    this.ui.toast(fmt(content.village.hen.eggToast, { name: this.name }));
    if (!this.game.flag('egg_told')) {
      this.game.setFlag('egg_told');
      this.busy = true;
      await this.ui.tell(content.village.hen.eggFirst);
      this.busy = false;
    } else {
      const more = content.village.hen.eggMore;
      this.ui.toast(fmt(more[Math.floor(Math.random() * more.length)], { name: this.name }));
    }
  }

  drawable(): Drawable | null {
    if (!this.visible) return null;
    const hop = this.anim > 0 ? Math.round(Math.abs(Math.sin(this.anim * Math.PI)) * 3) : 0;
    return {
      y: this.y,
      shadow: (v, cx, cy) => {
        v.beginPath();
        v.ellipse(Math.round(this.x - cx), Math.round(this.y - cy), 6 - hop * 0.7, 2, 0, 0, Math.PI * 2);
        v.fill();
      },
      draw: (v, cx, cy) => {
        const img = this.kit.chicken[Math.floor(this.anim * 2) & 1];
        const tremble = this.wiggle > 0 ? Math.round(Math.sin(this.wiggle * 90) * 1) : 0;
        v.save();
        v.translate(Math.round(this.x - cx) + tremble, Math.round(this.y - cy - 12 - hop));
        v.scale(this.face, 1);
        v.drawImage(img, -8, 0);
        v.restore();
        // o ovo sobe em arco até a mochila
        const f = this.flying;
        if (f) {
          const k = Math.min(1, f.t);
          const ex = f.fx + (this.player.x - f.fx) * k;
          const ey = f.fy + (this.player.y - 18 - f.fy) * k - Math.sin(Math.PI * k) * 22;
          v.fillStyle = '#2a1a14';
          v.fillRect(Math.round(ex - cx) - 2, Math.round(ey - cy) - 3, 4, 6);
          v.fillStyle = '#faf3e0';
          v.fillRect(Math.round(ex - cx) - 1, Math.round(ey - cy) - 2, 2, 4);
        }
      },
    };
  }
}
