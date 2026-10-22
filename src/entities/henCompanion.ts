import * as THREE from 'three';
import { Chicken } from './chicken';
import { content, fmt } from '../content';
import type { CollisionWorld } from '../core/collision';
import type { GameState } from '../core/gameState';
import type { Player } from './player';
import type { UI } from '../ui/ui';

/**
 * A galinha companheira: depois do encontro na vila ela segue o Matheus por todas as áreas e, de tempos em tempos,
 * bota um ovo que vai direto para a mochila. Os ovos são controlados pelo jogo: cada um depende de um marco da história
 * (consertar o moinho, entregar a encomenda, chegar a uma área nova) e só vem uma vez, então nunca passam de seis.
 */

/** Cada ovo: marca que guarda que ele já foi botado e a condição que o libera. */
const EGGS: [string, (g: GameState) => boolean][] = [
  ['egg_mill', (g) => g.quest('mill') === 'done'],
  ['egg_order', (g) => g.quest('order') === 'done'],
  ['egg_ruins', (g) => g.flag('ruins_seen')],
  ['egg_tavern', (g) => g.flag('tavern_seen')],
  ['egg_vineyard', (g) => g.flag('vineyard_seen')],
  ['egg_castle', (g) => g.flag('castle_seen')],
];

const HEN_TINT = 0xf4efe6;
const COOLDOWN = 7;

interface FlyingEgg {
  mesh: THREE.Mesh;
  t: number;
  from: THREE.Vector3;
}

export class HenCompanion {
  private chicken: Chicken | null = null;
  private scene: THREE.Scene | null = null;
  private world: CollisionWorld | null = null;
  private ground: (x: number, z: number) => number = () => 0;
  private readonly scare: THREE.Vector3[] = [];
  private readonly eggGeo = new THREE.SphereGeometry(0.1, 10, 8);
  private readonly eggMat = new THREE.MeshStandardMaterial({ color: 0xfaf3e0, roughness: 0.7 });
  private flying: FlyingEgg | null = null;
  private cooldown = 4;
  private wiggle = 0;
  private busy = false;

  constructor(
    private readonly ui: UI,
    private readonly game: GameState,
    private readonly player: Player,
  ) {
    this.eggGeo.scale(1, 1.3, 1);
  }

  get name() {
    return content.village.henName;
  }

  /** Coloca a galinha na área atual (se o Matheus já a conheceu). `at` define onde ela aparece. */
  enter(scene: THREE.Scene, world: CollisionWorld, ground: (x: number, z: number) => number, at?: { x: number; z: number }) {
    if (!this.game.flag('henMet')) return;
    this.scene = scene;
    this.world = world;
    this.ground = ground;
    if (!this.chicken) {
      this.chicken = new Chicken({ x: 0, z: 0, tint: HEN_TINT, roam: { x: 0, z: 0, r: 2 } });
      this.chicken.followTarget = this.player.position;
    }
    const c = this.chicken;
    scene.add(c.object);
    const px = at?.x ?? this.player.position.x - 1.6;
    const pz = at?.z ?? this.player.position.z - 1.6;
    c.teleport(px, pz, ground(px, pz));
    this.flying = null;
  }

  update(dt: number, time: number) {
    const c = this.chicken;
    if (!c || !this.world || !this.scene) return;
    c.update(dt, { scare: this.scare, scareRadius: 0, world: this.world, ground: this.ground });

    // saltinho de quem está botando
    if (this.wiggle > 0) {
      this.wiggle = Math.max(0, this.wiggle - dt);
      c.object.scale.setScalar(1 + 0.18 * Math.sin(time * 40) * (this.wiggle / 0.6));
    } else c.object.scale.setScalar(1);

    // o ovo sobe em arco até a mochila
    const f = this.flying;
    if (f) {
      f.t += dt / 0.9;
      const k = Math.min(1, f.t);
      const p = this.player.position;
      f.mesh.position.set(
        f.from.x + (p.x - f.from.x) * k,
        f.from.y + (p.y + 1.1 - f.from.y) * k + Math.sin(Math.PI * k) * 1.1,
        f.from.z + (p.z - f.from.z) * k,
      );
      f.mesh.rotation.z += dt * 8;
      if (k >= 1) {
        this.scene.remove(f.mesh);
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
        this.lay();
        break;
      }
    }
  }

  private lay() {
    const c = this.chicken!;
    this.cooldown = COOLDOWN;
    this.wiggle = 0.6;
    const mesh = new THREE.Mesh(this.eggGeo, this.eggMat);
    mesh.castShadow = true;
    const from = c.position.clone();
    from.y += 0.35;
    mesh.position.copy(from);
    this.scene!.add(mesh);
    // o ovo só sai depois do tremelique
    setTimeout(() => {
      if (!this.scene) return;
      this.flying = { mesh, t: 0, from };
    }, 600);
  }

  private async deliver() {
    this.game.addItem('ovos');
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

  dispose() {
    this.eggGeo.dispose();
    this.eggMat.dispose();
    this.chicken?.object.removeFromParent();
  }
}
