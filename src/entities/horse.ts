import * as THREE from 'three';
import { gltf, model } from '../core/assets';
import type { CollisionWorld } from '../core/collision';

/**
 * O cavalo (Quaternius Ultimate Animated Animals, CC0). Anda sozinho no cercado, foge de quem corre,
 * vira companheiro (vem quando chamado) e pode ser montado: aí ele segue o Matheus, com o passo e o
 * galope acompanhando a velocidade.
 */

export const HORSE_MODEL = 'animals/horse';
/** O modelo tem ~5,7 m de comprimento; no jogo fica com ~3,3 m. */
export const HORSE_SCALE = 0.58;
/** Altura da sela (lombo) já na escala do jogo. */
export const SADDLE_Y = 3.05 * HORSE_SCALE;

/** Velocidades naturais das animações (m/s): a animação acelera ou desacelera em torno delas. */
const WALK_NATURAL = 1.7;
const GALLOP_NATURAL = 6.4;
const RADIUS = 0.95;

/** Cores do pelo, da crina e dos cascos (em vez do preto do modelo original). */
const COAT: Record<string, number> = {
  Main: 0x9a5a30,
  Main_Dark: 0x6f3d20,
  Main_Light: 0xc08a52,
  Hair: 0x2a1a12,
  Muzzle: 0x4a3426,
  Hooves: 0x3a3836,
};

type Gait = 'idle' | 'graze' | 'walk' | 'gallop';
const CLIP: Record<Gait, string> = { idle: 'Idle', graze: 'Eating', walk: 'Walk', gallop: 'Gallop' };

export type HorseBehavior =
  | { kind: 'wander'; x: number; z: number; r: number; skittish: boolean }
  | { kind: 'follow' }
  | { kind: 'stay' }
  | { kind: 'ridden' };

export interface HorseContext {
  player: THREE.Vector3;
  playerSpeed: number;
  world: CollisionWorld;
  ground: (x: number, z: number) => number;
}

export class Horse {
  readonly object = new THREE.Group();
  readonly position = this.object.position;
  behavior: HorseBehavior = { kind: 'stay' };
  heading = 0;
  /** 0..1, sobe quando o jogador se aproxima devagar. */
  trust = 0;

  private readonly owned: THREE.Material[] = [];
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<Gait, THREE.AnimationAction>();
  private gait: Gait = 'idle';
  private speed = 0;
  private target = new THREE.Vector2();
  private hasTarget = false;
  private wait = Math.random() * 3;
  private t = 0;

  constructor() {
    const root = model(HORSE_MODEL);
    root.scale.setScalar(HORSE_SCALE);
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      m.castShadow = true;
      // pelagem castanha (o modelo vem quase preto): cada material ganha uma cópia colorida
      const mat = m.material as THREE.MeshStandardMaterial;
      const color = COAT[mat.name];
      if (color !== undefined) {
        const c = mat.clone();
        c.color.setHex(color);
        m.material = c;
        this.owned.push(c);
      }
    });
    this.object.add(root);
    this.mixer = new THREE.AnimationMixer(root);
    const clips = gltf(HORSE_MODEL).animations;
    for (const gait of Object.keys(CLIP) as Gait[]) {
      const clip = clips.find((c) => c.name === CLIP[gait]);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(gait === 'idle' ? 1 : 0);
      this.actions.set(gait, a);
    }
    this.object.rotation.order = 'YXZ';
  }

  /** Muda de andar com transição suave. */
  private setGait(g: Gait) {
    if (g === this.gait) return;
    const from = this.actions.get(this.gait);
    const to = this.actions.get(g) ?? this.actions.get('idle')!;
    to.reset().play();
    to.setEffectiveWeight(1);
    if (from && from !== to) to.crossFadeFrom(from, 0.3, false);
    this.gait = g;
  }

  /** Ao ser montado, o jogador manda: copia posição, direção e velocidade. */
  ride(pos: THREE.Vector3, heading: number, speed: number, dt: number) {
    this.position.copy(pos);
    this.heading = heading;
    this.speed = speed;
    this.object.rotation.y = heading;
    this.animate(dt, speed < 0.3 ? 'idle' : speed < 4.4 ? 'walk' : 'gallop');
  }

  private animate(dt: number, gait: Gait) {
    this.setGait(gait);
    const a = this.actions.get(this.gait);
    if (a) {
      if (this.gait === 'walk') a.timeScale = THREE.MathUtils.clamp(this.speed / WALK_NATURAL, 0.5, 2.4);
      else if (this.gait === 'gallop') a.timeScale = THREE.MathUtils.clamp(this.speed / GALLOP_NATURAL, 0.6, 1.5);
      else a.timeScale = 1;
    }
    this.mixer.update(dt);
  }

  /** Anda em direção a (x, z) com a velocidade pedida; devolve true ao chegar perto. */
  private steer(x: number, z: number, speed: number, dt: number, ctx: HorseContext) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      this.speed = 0;
      return true;
    }
    const want = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += diff * (1 - Math.exp(-(speed > 4 ? 5 : 3.2) * dt));
    // só anda para frente quando já está mais ou menos virado
    const align = Math.max(0, Math.cos(diff));
    this.speed += (speed * align - this.speed) * (1 - Math.exp(-5 * dt));
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;
    ctx.world.resolve(this.position, RADIUS);
    return false;
  }

  update(dt: number, ctx: HorseContext) {
    this.t += dt;
    const b = this.behavior;
    if (b.kind === 'ridden') return; // quem chama `ride` cuida do resto

    const px = ctx.player.x;
    const pz = ctx.player.z;
    const dPlayer = Math.hypot(px - this.position.x, pz - this.position.z);
    let gait: Gait = 'idle';

    if (b.kind === 'follow') {
      if (dPlayer > 7) {
        this.steer(px, pz, 6.2, dt, ctx);
        gait = 'gallop';
      } else if (dPlayer > 3.4) {
        this.steer(px, pz, 1.9, dt, ctx);
        gait = 'walk';
      } else {
        this.speed *= Math.exp(-6 * dt);
        gait = this.wait > 0 ? 'idle' : 'graze';
        this.wait -= dt;
        if (this.wait < -4) this.wait = 2 + Math.random() * 4;
      }
    } else if (b.kind === 'wander') {
      const scared = b.skittish && dPlayer < 9 && ctx.playerSpeed > 2.7;
      if (scared) {
        // foge para o lado oposto, dentro do cercado
        let ax = this.position.x - px;
        let az = this.position.z - pz;
        const l = Math.hypot(ax, az) || 1;
        ax /= l;
        az /= l;
        this.target.set(THREE.MathUtils.clamp(this.position.x + ax * 8, b.x - b.r, b.x + b.r), THREE.MathUtils.clamp(this.position.z + az * 8, b.z - b.r, b.z + b.r));
        this.hasTarget = true;
        this.steer(this.target.x, this.target.y, 5.2, dt, ctx);
        gait = 'gallop';
        this.trust = Math.max(0, this.trust - dt * 0.4);
      } else if (this.hasTarget) {
        const arrived = this.steer(this.target.x, this.target.y, 1.6, dt, ctx);
        gait = arrived ? 'idle' : 'walk';
        if (arrived) {
          this.hasTarget = false;
          this.wait = 1.5 + Math.random() * 4;
        }
      } else {
        this.speed *= Math.exp(-6 * dt);
        this.wait -= dt;
        gait = Math.sin(this.t * 0.4 + this.position.x) > 0.1 ? 'graze' : 'idle';
        if (this.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * b.r;
          this.target.set(b.x + Math.cos(a) * r, b.z + Math.sin(a) * r);
          this.hasTarget = true;
        }
      }
    } else {
      this.speed *= Math.exp(-6 * dt);
      gait = 'idle';
    }

    // acompanha o relevo (inclinando de leve o focinho para cima/baixo)
    const gy = ctx.ground(this.position.x, this.position.z);
    this.position.y += (gy - this.position.y) * (1 - Math.exp(-14 * dt));
    this.object.rotation.y = this.heading;
    this.animate(dt, gait);
  }

  get radius() {
    return RADIUS;
  }

  dispose() {
    this.owned.forEach((m) => m.dispose());
  }
}
