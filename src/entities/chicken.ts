import * as THREE from 'three';
import { gltf, model } from '../core/assets';
import type { CollisionWorld } from '../core/collision';

/**
 * Galinha (Quaternius, CC0). Passeia, ciscando; foge batendo as asas de quem chega perto (o Matheus ou o cavalo)
 * e, quando tem um "lar" por perto (o galinheiro), corre meio de lado em direção a ele.
 */

export const CHICKEN_MODEL = 'animals/chicken';
const SCALE = 0.4;
const RADIUS = 0.35;

type State = 'idle' | 'peck' | 'walk' | 'flee';

const matCache = new Map<number, THREE.Material>();
/** Cópia do material do corpo com outra cor (branca, ruiva, preta...). */
function bodyMaterial(base: THREE.Material, tint: number) {
  let m = matCache.get(tint);
  if (!m) {
    m = base.clone() as THREE.MeshStandardMaterial;
    (m as THREE.MeshStandardMaterial).color.setHex(tint);
    matCache.set(tint, m);
  }
  return m;
}
/** Libera as cores criadas (ao sair da área). */
export function disposeChickenMaterials() {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
}

export interface ChickenOptions {
  x: number;
  z: number;
  /** Cor do corpo (multiplica a do modelo). */
  tint: number;
  /** Onde passeia quando ninguém assusta. */
  roam: { x: number; z: number; r: number };
  /** Ponto de fuga preferido (o galinheiro): quando assustada por perto, corre meio em direção a ele. */
  home?: { x: number; z: number; pull: number; near: number; /** Raio do cercado e ponto de fora, junto da entrada. */ r: number; gate: { x: number; z: number } };
}

export interface ChickenContext {
  /** Quem assusta: o jogador (e o cavalo, quando perto). */
  scare: THREE.Vector3[];
  scareRadius: number;
  world: CollisionWorld;
  ground: (x: number, z: number) => number;
}

export class Chicken {
  readonly object = new THREE.Group();
  readonly position = this.object.position;
  /** Foi para o cercado (a missão conta). */
  penned = false;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<State, THREE.AnimationAction>();
  private state: State = 'idle';
  private heading = Math.random() * Math.PI * 2;
  private speed = 0;
  private wait = Math.random() * 3;
  private target = new THREE.Vector2();
  private hasTarget = false;
  private stateTime = 0;

  constructor(private readonly o: ChickenOptions) {
    const root = model(CHICKEN_MODEL);
    root.scale.setScalar(SCALE * (0.9 + Math.random() * 0.25));
    root.traverse((m) => {
      const mesh = m as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      const mat = mesh.material as THREE.Material;
      if (mat.name === 'Chicken_Main') mesh.material = bodyMaterial(mat, o.tint);
    });
    this.object.add(root);
    this.position.set(o.x, 0, o.z);
    this.object.rotation.y = this.heading;
    this.mixer = new THREE.AnimationMixer(root);
    const clips = gltf(CHICKEN_MODEL).animations;
    const pick = (name: string) => clips.find((c) => c.name.endsWith('|' + name));
    const map: [State, string][] = [['idle', 'Idle'], ['peck', 'Bite_Front'], ['walk', 'Walk'], ['flee', 'Walk']];
    for (const [s, n] of map) {
      const clip = pick(n);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(s === 'idle' ? 1 : 0);
      a.time = Math.random() * clip.duration;
      this.actions.set(s, a);
    }
  }

  /** Entra no cercado: a partir daqui ela passeia só lá dentro e não foge mais. */
  enterPen(roam: { x: number; z: number; r: number }) {
    this.penned = true;
    this.o.roam = roam;
  }

  private setState(s: State) {
    if (s === this.state) return;
    const from = this.actions.get(this.state);
    const to = this.actions.get(s);
    if (to) {
      to.setEffectiveWeight(1);
      if (from && from !== to) to.crossFadeFrom(from, 0.18, false);
      to.timeScale = s === 'flee' ? 2.6 : 1;
    }
    this.state = s;
    this.stateTime = 0;
  }

  /** Move-se em direção a um ponto; devolve true se chegou. */
  private steer(x: number, z: number, speed: number, dt: number, ctx: ChickenContext, turn = 8) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    if (Math.hypot(dx, dz) < 0.3) {
      this.speed = 0;
      return true;
    }
    const want = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += diff * (1 - Math.exp(-turn * dt));
    this.speed += (speed - this.speed) * (1 - Math.exp(-9 * dt));
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;
    ctx.world.resolve(this.position, RADIUS);
    return false;
  }

  update(dt: number, ctx: ChickenContext) {
    this.stateTime += dt;
    const o = this.o;

    // o que assusta mais de perto
    let nearest = Infinity;
    let sx = 0;
    let sz = 0;
    for (const p of ctx.scare) {
      const d = Math.hypot(p.x - this.position.x, p.z - this.position.z);
      if (d < nearest) {
        nearest = d;
        sx = p.x;
        sz = p.z;
      }
    }

    const roamR = this.penned ? o.roam.r : o.roam.r;
    if (nearest < ctx.scareRadius && !this.penned) {
      // foge no sentido oposto, puxando de leve para o galinheiro quando está por perto
      let ax = this.position.x - sx;
      let az = this.position.z - sz;
      const l = Math.hypot(ax, az) || 1;
      ax /= l;
      az /= l;
      const h = o.home;
      if (h) {
        const hd0 = Math.hypot(h.x - this.position.x, h.z - this.position.z);
        if (hd0 < h.near) {
          // fora do cercado ela corre para a entrada; só quando chega lá vai para dentro
          let tx = h.x;
          let tz = h.z;
          if (hd0 > h.r + 0.6 && Math.hypot(h.gate.x - this.position.x, h.gate.z - this.position.z) > 3.4) {
            tx = h.gate.x;
            tz = h.gate.z;
          }
          const hx = tx - this.position.x;
          const hz = tz - this.position.z;
          const hd = Math.hypot(hx, hz) || 1;
          ax += (hx / hd) * h.pull;
          az += (hz / hd) * h.pull;
        }
      }
      // um tremor de lado: ninguém foge em linha reta
      const wob = Math.sin(this.stateTime * 9 + this.position.x) * 0.45;
      const bx = ax - az * wob;
      const bz = az + ax * wob;
      this.steer(this.position.x + bx * 3, this.position.z + bz * 3, 4.6, dt, ctx, 12);
      this.setState('flee');
      this.hasTarget = false;
      this.wait = 0.4;
      // depois do susto ela passeia por onde parou, não volta para o ponto de onde saiu
      o.roam = { x: this.position.x, z: this.position.z, r: o.roam.r };
    } else if (this.hasTarget) {
      const arrived = this.steer(this.target.x, this.target.y, 0.9, dt, ctx);
      this.setState('walk');
      if (arrived) {
        this.hasTarget = false;
        this.wait = 1 + Math.random() * 4;
      }
    } else {
      this.speed *= Math.exp(-8 * dt);
      this.wait -= dt;
      if (this.state === 'flee') this.setState('idle');
      if (this.wait <= 0) {
        if (Math.random() < 0.55) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * roamR;
          this.target.set(o.roam.x + Math.cos(a) * r, o.roam.z + Math.sin(a) * r);
          this.hasTarget = true;
        } else {
          this.setState(this.state === 'peck' ? 'idle' : 'peck');
          this.wait = 1 + Math.random() * 3;
        }
      }
    }

    const gy = ctx.ground(this.position.x, this.position.z);
    this.position.y += (gy - this.position.y) * (1 - Math.exp(-16 * dt));
    this.object.rotation.y = this.heading;
    this.mixer.update(dt);
  }
}
