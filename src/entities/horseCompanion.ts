import * as THREE from 'three';
import { Horse, SADDLE_Y } from './horse';
import { content, fmt } from '../content';
import { audio } from '../core/audio';
import type { CollisionWorld } from '../core/collision';
import type { Player } from './player';
import type { UI } from '../ui/ui';
import type { GameState } from '../core/gameState';

/**
 * O cavalo do Matheus fora da vila: ele segue o jogador, pode ser montado e desmontado (botão do cavalo / tecla H)
 * e, quando a área não deixa (a mata escura), para e espera. Quem usa chama `update` a cada quadro.
 */
export class HorseCompanion {
  readonly horse = new Horse();
  riding = false;
  private placed = false;
  private btn = '';
  private readonly ctx = { player: new THREE.Vector3(), playerSpeed: 0, world: null as unknown as CollisionWorld, ground: (_x: number, _z: number) => 0 };

  constructor(
    scene: THREE.Scene,
    private readonly ui: UI,
    private readonly game: GameState,
    private readonly player: Player,
    world: CollisionWorld,
    ground: (x: number, z: number) => number,
    /** Pode montar e seguir aqui e agora? */
    private readonly allowed: () => boolean,
  ) {
    scene.add(this.horse.object);
    this.ctx.world = world;
    this.ctx.ground = ground;
    this.horse.behavior = { kind: 'follow' };
  }

  get name() {
    return content.village.horseName;
  }

  /** Está ao alcance para montar? */
  near(p: THREE.Vector3, r = 9) {
    return Math.hypot(p.x - this.horse.position.x, p.z - this.horse.position.z) < r;
  }

  mount() {
    if (this.riding || !this.allowed()) return;
    this.riding = true;
    audio.play('mount');
    const h = this.horse;
    this.player.position.set(h.position.x, this.player.position.y, h.position.z);
    this.player.face(h.heading);
    this.player.setRiding(SADDLE_Y);
    h.behavior = { kind: 'ridden' };
    this.game.setFlag('riding', true);
  }

  dismount() {
    if (!this.riding) return;
    this.riding = false;
    this.player.setRiding(null);
    this.horse.behavior = this.allowed() ? { kind: 'follow' } : { kind: 'stay' };
    this.player.position.x += Math.cos(this.horse.heading) * 2.0;
    this.player.position.z -= Math.sin(this.horse.heading) * 2.0;
    this.ctx.world.resolve(this.player.position, this.player.radius);
    this.game.setFlag('riding', false);
  }

  /** Mostra o botão certo (montar / desmontar) e move o cavalo. */
  update(dt: number, playerPos: THREE.Vector3) {
    if (!this.placed) {
      this.horse.position.set(playerPos.x + 2.5, 0, playerPos.z + 2.5);
      this.horse.position.y = this.ctx.ground(this.horse.position.x, this.horse.position.z);
      this.placed = true;
    }
    const ok = this.allowed();
    if (!ok && this.riding) {
      this.dismount();
      void this.ui.tell(content.forest.horseStops.map((l) => fmt(l, { name: this.name })));
    }
    if (!ok && this.horse.behavior.kind === 'follow') this.horse.behavior = { kind: 'stay' };
    if (ok && this.horse.behavior.kind === 'stay') this.horse.behavior = { kind: 'follow' };

    this.ctx.player.copy(playerPos);
    this.ctx.playerSpeed = this.player.speed;
    if (this.riding) this.horse.ride(playerPos, this.player.facing, this.player.speed, dt);
    else this.horse.update(dt, this.ctx);

    let want = '';
    if (ok && !this.ui.inDialog) {
      if (this.riding) want = content.village.horse.dismount;
      else if (this.near(playerPos)) want = fmt(content.village.horse.mount, { name: this.name });
    }
    if (want !== this.btn) {
      this.btn = want;
      this.ui.setHorseButton(want || null, this.riding ? () => this.dismount() : () => this.mount());
    }
  }

  dispose() {
    this.ui.setHorseButton(null);
    this.horse.dispose();
  }
}
