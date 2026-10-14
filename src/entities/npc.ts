import * as THREE from 'three';
import { CHARACTER, gltf, model } from '../core/assets';
import { exclamationMarker } from '../fx/markers';

/**
 * Personagem não jogável da vila, feito com os modelos do KayKit Adventurers (CC0):
 * fica em animação "parado", vira o rosto para o Matheus quando ele chega perto,
 * pode tocar um gesto (Interact, Cheer...) e mostra um "!" quando tem algo a dizer.
 */

export type NpcCharacter = 'Barbarian' | 'Rogue_Hooded' | 'Rogue';

export interface NpcProp {
  /** Modelo (ver CHARACTER) preso à mão. */
  asset: string;
  hand: 'r' | 'l';
  scale?: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}

export interface NpcConfig {
  character: NpcCharacter;
  position: THREE.Vector3;
  /** Rotação em Y quando ninguém está por perto. */
  facing: number;
  props?: NpcProp[];
}

export const NPC_ASSETS = ['Barbarian', 'Rogue_Hooded', 'Rogue', 'axe_1handed', 'mug_full', 'dagger'].map(CHARACTER);

const LOOK_RADIUS = 4.5;

export class Npc {
  readonly object = new THREE.Group();
  readonly position: THREE.Vector3;
  /** Mostra o "!" sobre a cabeça. */
  alert = false;

  private readonly mixer: THREE.AnimationMixer;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly idle: THREE.AnimationAction;
  private readonly marker = exclamationMarker();
  private heading: number;
  private readonly home: number;
  private t = Math.random() * 10;

  constructor(cfg: NpcConfig) {
    const path = CHARACTER(cfg.character);
    const root = model(path);
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isMesh) m.frustumCulled = false;
    });
    this.object.add(root);
    this.object.position.copy(cfg.position);
    this.position = this.object.position;
    this.heading = this.home = cfg.facing;
    this.object.rotation.y = cfg.facing;

    for (const clip of gltf(path).animations) this.clips.set(clip.name, clip);
    this.mixer = new THREE.AnimationMixer(root);
    this.idle = this.mixer.clipAction(this.clips.get('Idle')!);
    this.idle.time = Math.random() * this.idle.getClip().duration;
    this.idle.play();

    for (const p of cfg.props ?? []) {
      const bone = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`handslot.${p.hand}`));
      if (!bone) continue;
      const prop = model(p.asset);
      prop.scale.setScalar(p.scale ?? 1);
      if (p.rotation) prop.rotation.set(...p.rotation);
      if (p.position) prop.position.set(...p.position);
      bone.add(prop);
    }

    this.marker.position.y = 2.6;
    this.marker.visible = false;
    this.object.add(this.marker);
  }

  /** Toca um gesto uma vez e volta ao "parado". */
  play(name: string) {
    const clip = this.clips.get(name);
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.crossFadeFrom(this.idle, 0.2, false);
    const back = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener('finished', back);
      this.idle.reset().play();
      this.idle.crossFadeFrom(action, 0.25, false);
    };
    this.mixer.addEventListener('finished', back);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    this.mixer.update(dt);

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const near = Math.hypot(dx, dz) < LOOK_RADIUS;
    const target = near ? Math.atan2(dx, dz) : this.home;
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-6 * dt));
    this.object.rotation.y = this.heading;

    this.marker.visible = this.alert;
    if (this.alert) this.marker.position.y = 2.55 + Math.sin(this.t * 3.2) * 0.07;
  }
}
