import * as THREE from 'three';
import type { CollisionWorld } from '../core/collision';

/**
 * Espíritos da névoa, feitos em código: corpo translúcido com olhos que brilham.
 *  - fiapo: rápido e frágil; avisa com um brilho vermelho e investe em linha reta.
 *  - sombra: grande e lenta; avisa com um círculo no chão e dá uma pancada em área.
 *  - corvo: voa em círculos e mergulha; só dá para acertá-lo quando está baixo.
 * Os golpes do Matheus empurram o espírito; a luz da tocha o deixa mais lento.
 */

export type SpiritKind = 'fiapo' | 'sombra' | 'corvo';

interface Stats {
  hp: number;
  speed: number;
  radius: number;
  scale: number;
  reach: number;
  windup: number;
  recover: number;
}

const STATS: Record<SpiritKind, Stats> = {
  fiapo: { hp: 2, speed: 3.3, radius: 0.5, scale: 1, reach: 1.3, windup: 0.55, recover: 0.7 },
  sombra: { hp: 8, speed: 2.0, radius: 0.95, scale: 1.9, reach: 2.7, windup: 0.95, recover: 1.1 },
  corvo: { hp: 2, speed: 4.2, radius: 0.5, scale: 0.9, reach: 1.2, windup: 0.6, recover: 1.2 },
};

type State = 'rise' | 'chase' | 'windup' | 'attack' | 'recover' | 'dying' | 'orbit' | 'dive';

export interface SpiritContext {
  player: THREE.Vector3;
  playerRadius: number;
  world: CollisionWorld;
  ground: (x: number, z: number) => number;
  /** A tocha acesa deixa os espíritos mais lentos. */
  torchLit: boolean;
  /** O espírito acertou o Matheus (a área decide se ele está invulnerável). */
  hitPlayer: (damage: number, fromX: number, fromZ: number) => void;
  puff: (x: number, y: number, z: number, n?: number, power?: number) => void;
}

// geometrias e materiais compartilhados por todos os espíritos da área
let shared: { bodyGeo: THREE.BufferGeometry; tailGeo: THREE.BufferGeometry; eyeGeo: THREE.BufferGeometry; eyeMat: THREE.Material; ringGeo: THREE.BufferGeometry; wingGeo: THREE.BufferGeometry; hornGeo: THREE.BufferGeometry } | null = null;
let users = 0;

function acquire() {
  users++;
  if (!shared) {
    const tail = new THREE.ConeGeometry(0.42, 1.15, 10, 1, true);
    tail.rotateX(Math.PI);
    tail.translate(0, 0.42, 0);
    const body = new THREE.SphereGeometry(0.44, 14, 10);
    body.scale(1, 1.18, 1);
    body.translate(0, 1.05, 0);
    const wing = new THREE.PlaneGeometry(0.9, 0.38);
    wing.translate(0.5, 0, 0);
    const horn = new THREE.ConeGeometry(0.07, 0.3, 5);
    shared = {
      bodyGeo: body,
      tailGeo: tail,
      eyeGeo: new THREE.SphereGeometry(0.09, 8, 6),
      eyeMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.8, 2.0), toneMapped: false, fog: false }),
      ringGeo: new THREE.RingGeometry(0.92, 1, 40),
      wingGeo: wing,
      hornGeo: horn,
    };
  }
  return shared;
}

export function releaseSpiritResources() {
  users = Math.max(0, users - 1);
  if (users === 0 && shared) {
    Object.values(shared).forEach((r) => r.dispose());
    shared = null;
  }
}

export interface SpiritOptions {
  kind: SpiritKind;
  x: number;
  z: number;
  /** Vida em "pontos de golpe" (galho = 1, espada = 2). Padrão: o do tipo. */
  hp?: number;
}

export class MistSpirit {
  readonly object = new THREE.Group();
  readonly kind: SpiritKind;
  readonly position = this.object.position;
  readonly radius: number;
  hp: number;
  dead = false;
  /** Terminou de se desfazer: pode ser tirado da cena. */
  gone = false;
  /** Último golpe do Matheus que o acertou (para não levar dano duas vezes pelo mesmo golpe). */
  lastSwing = -1;

  private readonly s: Stats;
  private readonly body = new THREE.Group();
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly wings: THREE.Mesh[] = [];
  private ring: THREE.Mesh | null = null;
  private ringMat: THREE.MeshBasicMaterial | null = null;
  private state: State;
  private t = 0;
  private heading = Math.random() * 6.28;
  private readonly aim = new THREE.Vector3();
  private readonly knock = new THREE.Vector2();
  private hitDone = false;
  private phase = Math.random() * 10;
  private orbitAngle = Math.random() * 6.28;
  private orbitWait = 1.5 + Math.random() * 2;
  private flyY = 3.2;

  constructor(o: SpiritOptions) {
    this.kind = o.kind;
    this.s = STATS[o.kind];
    this.hp = o.hp ?? this.s.hp;
    this.radius = this.s.radius;
    const sh = acquire();

    this.mat = new THREE.MeshStandardMaterial({
      color: o.kind === 'corvo' ? 0x2c3550 : o.kind === 'sombra' ? 0x4a5a82 : 0x7f95c0,
      emissive: o.kind === 'corvo' ? 0x1a2c60 : 0x2a4a80,
      emissiveIntensity: 0.55,
      roughness: 1,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    if (o.kind === 'corvo') {
      const torso = new THREE.Mesh(sh.bodyGeo, this.mat);
      torso.scale.set(0.8, 0.55, 1.5);
      torso.position.y = -0.6;
      const tail = new THREE.Mesh(sh.tailGeo, this.mat);
      tail.scale.set(0.45, 0.4, 0.45);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 0.15, -0.55);
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(sh.wingGeo, this.mat);
        w.scale.x = side;
        w.rotation.x = -Math.PI / 2;
        w.position.set(0, 0.5, 0);
        w.userData.side = side;
        this.wings.push(w);
        this.body.add(w);
      }
      this.body.add(torso, tail);
    } else {
      this.body.add(new THREE.Mesh(sh.bodyGeo, this.mat), new THREE.Mesh(sh.tailGeo, this.mat));
      if (o.kind === 'sombra') {
        for (const x of [-0.26, 0, 0.26]) {
          const h = new THREE.Mesh(sh.hornGeo, this.mat);
          h.position.set(x, 1.62 + (x === 0 ? 0.08 : 0), 0);
          h.rotation.z = -x * 1.2;
          this.body.add(h);
        }
      }
    }
    for (const x of [-0.15, 0.15]) {
      const eye = new THREE.Mesh(sh.eyeGeo, sh.eyeMat);
      eye.position.set(x, o.kind === 'corvo' ? -0.45 : 1.1, o.kind === 'corvo' ? 0.7 : 0.38);
      this.body.add(eye);
    }
    this.body.traverse((m) => ((m as THREE.Mesh).isMesh && ((m as THREE.Mesh).castShadow = false)));
    this.body.scale.setScalar(this.s.scale);
    this.object.add(this.body);
    this.object.position.set(o.x, 0, o.z);

    if (o.kind === 'sombra') {
      this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 0.3), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      this.ring = new THREE.Mesh(sh.ringGeo, this.ringMat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.scale.setScalar(this.s.reach);
      this.ring.visible = false;
      this.ring.renderOrder = 6;
      this.object.add(this.ring);
    }

    if (o.kind === 'corvo') {
      this.state = 'rise';
      this.object.position.y = this.flyY;
    } else this.state = 'rise';
    this.body.scale.multiplyScalar(0.01);
  }

  /** Dá para acertá-lo agora? (O corvo só quando está baixo.) */
  get vulnerable() {
    if (this.dead || this.state === 'rise') return false;
    if (this.kind === 'corvo') return this.position.y < 2.3;
    return true;
  }

  /** Leva `damage`; o espírito é empurrado para longe de (fromX, fromZ). Devolve true se morreu. */
  hit(damage: number, fromX: number, fromZ: number, ctx: SpiritContext): boolean {
    if (!this.vulnerable) return false;
    this.hp -= damage;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    const push = this.kind === 'sombra' ? 2.5 : 7;
    this.knock.set((dx / l) * push, (dz / l) * push);
    ctx.puff(this.position.x, this.position.y + 0.9, this.position.z, 14, 0.8);
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dying';
      this.t = 0;
      ctx.puff(this.position.x, this.position.y + 0.9, this.position.z, 40, 1.4);
      if (this.ring) this.ring.visible = false;
      return true;
    }
    // a sombra aguenta o golpe sem interromper o ataque; os outros se assustam
    if (this.kind !== 'sombra' && (this.state === 'windup' || this.state === 'attack' || this.state === 'dive')) {
      this.state = this.kind === 'corvo' ? 'recover' : 'recover';
      this.t = 0;
      this.hitDone = true;
    }
    this.flash(2.5);
    return false;
  }

  private flashT = 0;
  private flash(t: number) {
    this.flashT = Math.max(this.flashT, t * 0.08);
  }

  private setGlow(red: number) {
    // 0 = azulado, 1 = brilho vermelho de aviso
    this.mat.emissive.setRGB(0.16 + red * 1.2, 0.3 - red * 0.2, 0.5 - red * 0.4);
    this.mat.emissiveIntensity = 0.55 + red * 1.6;
  }

  update(dt: number, time: number, ctx: SpiritContext) {
    this.t += dt;
    const p = this.position;
    const px = ctx.player.x;
    const pz = ctx.player.z;
    const dx = px - p.x;
    const dz = pz - p.z;
    const dist = Math.hypot(dx, dz);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.mat.emissiveIntensity = 2.2;
    }

    // empurrão do golpe que acabou de receber
    if (this.knock.lengthSq() > 0.01) {
      p.x += this.knock.x * dt;
      p.z += this.knock.y * dt;
      this.knock.multiplyScalar(Math.exp(-9 * dt));
      ctx.world.resolve(p, this.radius);
    }

    const slow = ctx.torchLit && dist < 6.5 ? 0.72 : 1;
    const face = (tx: number, tz: number, rate = 10) => {
      const want = Math.atan2(tx - p.x, tz - p.z);
      const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += diff * (1 - Math.exp(-rate * dt));
    };
    const step = (dirx: number, dirz: number, speed: number) => {
      p.x += dirx * speed * dt;
      p.z += dirz * speed * dt;
      ctx.world.resolve(p, this.radius);
    };

    switch (this.state) {
      case 'rise': {
        const k = Math.min(1, this.t / 0.9);
        this.body.scale.setScalar(this.s.scale * Math.max(0.01, k));
        this.mat.opacity = 0.82 * k;
        if (k >= 1) {
          this.state = this.kind === 'corvo' ? 'orbit' : 'chase';
          this.t = 0;
          this.orbitAngle = Math.atan2(p.z - pz, p.x - px);
        }
        break;
      }
      case 'chase': {
        face(px, pz);
        const stop = this.s.reach * 0.8 + ctx.playerRadius;
        if (dist > stop) step(Math.sin(this.heading), Math.cos(this.heading), this.s.speed * slow);
        this.setGlow(0);
        // ataca quando está perto o bastante e já "pensou" um instante
        if (dist < this.s.reach + (this.kind === 'fiapo' ? 1.8 : 0.4) && this.t > 0.5) {
          this.state = 'windup';
          this.t = 0;
          this.hitDone = false;
        }
        break;
      }
      case 'windup': {
        face(px, pz, 14);
        const k = Math.min(1, this.t / this.s.windup);
        this.setGlow(k);
        if (this.kind === 'sombra' && this.ring && this.ringMat) {
          this.ring.visible = true;
          this.ringMat.opacity = 0.25 + 0.5 * k;
        }
        this.body.scale.y = this.s.scale * (1 - 0.18 * k);
        if (this.t >= this.s.windup) {
          this.state = 'attack';
          this.t = 0;
          this.aim.set(dx / (dist || 1), 0, dz / (dist || 1));
          this.body.scale.y = this.s.scale;
        }
        break;
      }
      case 'attack': {
        if (this.kind === 'sombra') {
          // pancada em área, de uma vez, e o círculo some
          if (!this.hitDone) {
            this.hitDone = true;
            if (dist < this.s.reach + ctx.playerRadius) ctx.hitPlayer(1, p.x, p.z);
            ctx.puff(p.x, 0.3, p.z, 30, 1.8);
          }
          if (this.ring) this.ring.visible = false;
          if (this.t > 0.25) {
            this.state = 'recover';
            this.t = 0;
          }
        } else {
          // fiapo: investida em linha reta
          step(this.aim.x, this.aim.z, 9.5);
          this.heading = Math.atan2(this.aim.x, this.aim.z);
          if (!this.hitDone && dist < this.radius + ctx.playerRadius + 0.35) {
            this.hitDone = true;
            ctx.hitPlayer(1, p.x, p.z);
          }
          if (this.t > 0.38) {
            this.state = 'recover';
            this.t = 0;
          }
        }
        break;
      }
      case 'recover': {
        this.setGlow(Math.max(0, 1 - this.t * 3));
        if (this.ring) this.ring.visible = false;
        if (this.kind === 'corvo') {
          // fica baixo e vulnerável, depois sobe
          p.y += (1.0 - p.y) * (1 - Math.exp(-8 * dt));
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
        // corvo: gira em volta do Matheus, no alto
        this.orbitAngle += dt * 1.3;
        const tx = px + Math.cos(this.orbitAngle) * 5.5;
        const tz = pz + Math.sin(this.orbitAngle) * 5.5;
        p.x += (tx - p.x) * (1 - Math.exp(-3 * dt));
        p.z += (tz - p.z) * (1 - Math.exp(-3 * dt));
        p.y += (this.flyY - p.y) * (1 - Math.exp(-3 * dt));
        face(px, pz, 6);
        this.setGlow(0);
        this.orbitWait -= dt;
        if (this.orbitWait <= 0) {
          this.state = 'windup';
          this.t = 0;
          this.hitDone = false;
        }
        break;
      }
      case 'dive': {
        step(this.aim.x, this.aim.z, 12.5);
        p.y += (0.9 - p.y) * (1 - Math.exp(-9 * dt));
        this.heading = Math.atan2(this.aim.x, this.aim.z);
        if (!this.hitDone && dist < this.radius + ctx.playerRadius + 0.3) {
          this.hitDone = true;
          ctx.hitPlayer(1, p.x, p.z);
        }
        if (this.t > 0.75) {
          this.state = 'recover';
          this.t = 0;
        }
        break;
      }
      case 'dying': {
        const k = Math.min(1, this.t / 0.5);
        this.body.scale.setScalar(this.s.scale * (1 - k) + 0.001);
        this.mat.opacity = 0.82 * (1 - k);
        this.body.rotation.y += dt * 9;
        if (k >= 1) this.gone = true;
        break;
      }
    }

    // o corvo "mergulha" depois do aviso: troca o ataque por mergulho
    if (this.kind === 'corvo' && this.state === 'attack') {
      this.state = 'dive';
      this.t = 0;
      this.aim.set(dx / (dist || 1), 0, dz / (dist || 1));
    }

    // altura e movimento do corpo
    if (this.kind !== 'corvo') {
      const gy = ctx.ground(p.x, p.z);
      p.y += (gy - p.y) * (1 - Math.exp(-14 * dt));
      this.body.position.y = 0.12 * Math.sin(time * 3 + this.phase);
    } else {
      this.body.position.y = 0.1 * Math.sin(time * 5 + this.phase);
      const flap = Math.sin(time * 18 + this.phase) * 0.7;
      for (const w of this.wings) w.rotation.z = flap * (w.userData.side as number);
    }
    this.object.rotation.y = this.heading;
  }

  dispose() {
    this.mat.dispose();
    this.ringMat?.dispose();
    releaseSpiritResources();
  }
}
