import * as THREE from 'three';
import { Torch } from './torch';
import { buildMatheus, type MatheusRig } from './matheusModel';
import { buildBackpack } from './backpack';
import { CHARACTER, model } from '../core/assets';
import type { CollisionWorld } from '../core/collision';

/**
 * Personagem jogável: modelo do Matheus (matheusModel.ts) com animações do KayKit
 * (parado / andar / correr misturadas pela velocidade). O braço direito usa uma pose
 * fixa segurando a tocha, independente da locomoção.
 */

const WALK_SPEED = 2.2;
const RUN_SPEED = 4.4;
const RADIUS = 0.4;
const RIDING_RADIUS = 1.0;
/** Montado: velocidades de passo e galope (m/s). */
const RIDE_WALK = 4;
const RIDE_RUN = 9;

/** Ossos do braço direito: ficam fora da locomoção e seguem a pose de "segurar tocha". */
// (o GLTFLoader remove os pontos dos nomes: "upperarm.r" vira "upperarmr")
const ARM_BONES = ['upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r', 'handslot.r'].map((n) =>
  THREE.PropertyBinding.sanitizeNodeName(n),
);
/** Clipe e instante usados como pose do braço da tocha. */
export const TORCH_POSE = { clip: 'Throw', time: 0.25 };

function filterTracks(clip: THREE.AnimationClip, keep: (boneName: string) => boolean, name: string) {
  const tracks = clip.tracks.filter((t) => keep(t.name.split('.').slice(0, -1).join('.')));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

export class Player {
  readonly object = new THREE.Group();
  readonly torch: Torch;
  readonly rig: MatheusRig;
  /** Ponto de encaixe nas costas (espada, mochila) para a evolução visual. */
  readonly backSlot = new THREE.Group();
  private sword: THREE.Object3D | null = null;
  private backpack: THREE.Object3D | null = null;

  private readonly velocity = new THREE.Vector3();
  private readonly targetVel = new THREE.Vector3();
  private heading = 0;
  private readonly idle: THREE.AnimationAction;
  private readonly walk: THREE.AnimationAction;
  private readonly run: THREE.AnimationAction;
  private armPose: THREE.AnimationAction | null = null;
  /** Quando true, o personagem não é controlado (cutscenes, visualizador). */
  frozen = false;
  /** Montado no cavalo: anda e corre mais rápido, de corpo parado e raio maior. */
  riding = false;
  /** Altura do terreno (a área atual informa); o Matheus acompanha o relevo. */
  ground: (x: number, z: number) => number = () => 0;

  constructor(shadowMapSize: number) {
    this.rig = buildMatheus();
    this.object.add(this.rig.root);

    const { mixer, clips } = this.rig;
    const body = (n: string) => filterTracks(clips.get(n)!, (b) => !ARM_BONES.includes(b), n + '_body');
    this.idle = mixer.clipAction(body('Idle'));
    this.walk = mixer.clipAction(body('Walking_A'));
    this.run = mixer.clipAction(body('Running_A'));
    for (const a of [this.idle, this.walk, this.run]) {
      a.play();
      a.setEffectiveWeight(0);
    }
    this.idle.setEffectiveWeight(1);
    this.setArmPose(TORCH_POSE.clip, TORCH_POSE.time);

    this.torch = new Torch(shadowMapSize);
    this.rig.bones.handR.add(this.torch.object);

    this.backSlot.position.set(0, 0, -0.35);
    this.rig.bones.chest.add(this.backSlot);
  }

  /** Mostra ou esconde a espada e a mochila nas costas (evolução visual do Matheus). */
  setEquipment(eq: { sword: boolean; backpack: boolean }) {
    if (eq.backpack && !this.backpack) {
      this.backpack = buildBackpack();
      this.backSlot.add(this.backpack);
    }
    if (eq.sword && !this.sword) {
      // espada atravessada nas costas: cabo embaixo à esquerda, ponta sobre o ombro direito
      const blade = model(CHARACTER('sword_1handed'));
      blade.traverse((o) => (o.castShadow = true));
      blade.scale.setScalar(0.5);
      blade.position.set(0, -0.12, 0);
      this.sword = new THREE.Group();
      this.sword.add(blade);
      this.sword.position.set(0.02, 0.0, -0.1);
      this.sword.rotation.z = -0.55;
      this.backSlot.add(this.sword);
    }
    if (this.backpack) this.backpack.visible = eq.backpack;
    if (this.sword) this.sword.visible = eq.sword;
  }

  /** Define a pose do braço direito a partir de um instante de qualquer clipe. */
  setArmPose(clipName: string, time: number) {
    const clip = this.rig.clips.get(clipName);
    if (!clip) return;
    this.armPose?.stop();
    const arm = filterTracks(clip, (b) => ARM_BONES.includes(b), clipName + '_arm');
    this.armPose = this.rig.mixer.clipAction(arm);
    this.armPose.play();
    this.armPose.paused = true;
    this.armPose.time = time * clip.duration;
  }

  /** Toca um clipe de corpo inteiro (para o visualizador e cutscenes). */
  playFullBody(clipName: string) {
    const clip = this.rig.clips.get(clipName);
    if (!clip) return;
    this.rig.mixer.stopAllAction();
    this.armPose = null;
    this.rig.mixer.clipAction(clip).play();
  }

  /** Para o movimento e vira o personagem para `rot` (usado ao entrar numa área). */
  face(rot: number) {
    this.velocity.set(0, 0, 0);
    this.heading = rot;
    this.object.rotation.y = rot;
  }

  get position() {
    return this.object.position;
  }

  get radius() {
    return this.riding ? RIDING_RADIUS : RADIUS;
  }

  /** Sobe no cavalo (`saddleY`: altura da sela) ou desce (`null`). */
  setRiding(saddleY: number | null) {
    this.riding = saddleY !== null;
    this.rideY = saddleY === null ? 0 : saddleY - 0.62;
  }
  private rideY = 0;

  /** Rotação em Y do rosto (mesma convenção de `Object3D.rotation.y`). */
  get facing() {
    return this.heading;
  }

  /** Velocidade atual no chão (m/s). */
  get speed() {
    return this.velocity.length();
  }

  /** `moveDir`: direção desejada no chão (XZ), comprimento 0..1. */
  update(dt: number, moveDir: THREE.Vector3, world: CollisionWorld) {
    if (!this.frozen) {
      // Joystick parcial = andar; empurrado até o fim = correr.
      const input = Math.min(1, moveDir.length());
      const walk = this.riding ? RIDE_WALK : WALK_SPEED;
      const run = this.riding ? RIDE_RUN : RUN_SPEED;
      const speed = input < 0.75 ? input * (walk / 0.75) : THREE.MathUtils.lerp(walk, run, (input - 0.75) / 0.25);
      this.targetVel.copy(moveDir).setLength(input > 0.01 ? speed : 0);
      this.velocity.lerp(this.targetVel, 1 - Math.exp(-12 * dt));

      this.object.position.addScaledVector(this.velocity, dt);
      world.resolve(this.object.position, this.radius);
      const gy = this.ground(this.object.position.x, this.object.position.z);
      this.object.position.y += (gy - this.object.position.y) * (1 - Math.exp(-20 * dt));

      if (moveDir.lengthSq() > 0.01) {
        const target = Math.atan2(moveDir.x, moveDir.z);
        const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
        this.heading += diff * (1 - Math.exp(-14 * dt));
        this.object.rotation.y = this.heading;
      }

      // mistura das animações pela velocidade real
      const v = this.riding ? 0 : this.velocity.length();
      const wWalk = THREE.MathUtils.clamp(v / WALK_SPEED, 0, 1) * (1 - THREE.MathUtils.clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1));
      const wRun = THREE.MathUtils.clamp((v - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
      const wIdle = 1 - Math.min(1, wWalk + wRun);
      this.idle.setEffectiveWeight(wIdle);
      this.walk.setEffectiveWeight(wWalk);
      this.run.setEffectiveWeight(wRun);
      // acerta o ritmo dos passos com a velocidade para os pés não "patinarem"
      this.walk.timeScale = THREE.MathUtils.clamp(v / WALK_SPEED, 0.6, 1.3);
      this.run.timeScale = THREE.MathUtils.clamp(v / RUN_SPEED, 0.8, 1.2);
    }

    // montado: o corpo sobe até a sela (as pernas somem dentro do cavalo)
    this.rig.root.position.y = this.rideY;
    this.rig.mixer.update(dt);
    this.torch.update(dt);
  }
}
