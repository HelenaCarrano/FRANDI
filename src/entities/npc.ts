import * as THREE from 'three';
import { CHARACTER, gltf, model } from '../core/assets';
import { exclamationMarker } from '../fx/markers';
import { TORCH_MODEL, createFlame } from './torch';

/**
 * Pessoa da vila, feita com os modelos do KayKit Adventurers (CC0): fica "parada" com um gesto de
 * trabalho de vez em quando, vira o rosto para o Matheus quando ele chega perto, pode caminhar em
 * ronda e mostra um "!" quando tem algo a dizer. Cada uma recebe uma cor e acessórios próprios
 * (chapéu de palha, avental, lenço) para não parecerem clones.
 */

export type NpcCharacter = 'Barbarian' | 'Rogue_Hooded' | 'Rogue' | 'Mage';

export interface NpcProp {
  /** Modelo (ver CHARACTER) preso à mão. */
  asset: string;
  hand: 'r' | 'l';
  scale?: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}

export interface NpcAccessory {
  kind: 'strawHat' | 'cap' | 'apron' | 'scarf';
  color: number;
}

export interface NpcConfig {
  character: NpcCharacter;
  position: THREE.Vector3;
  /** Rotação em Y quando ninguém está por perto. */
  facing: number;
  props?: NpcProp[];
  /** Multiplica as cores do corpo (1 = original). */
  tint?: number;
  accessories?: NpcAccessory[];
  /** Tamanho em relação ao padrão. */
  scale?: number;
  /** Gesto repetido de tempos em tempos (trabalhando). */
  work?: { clip: 'Interact' | 'PickUp' | 'Use_Item' | 'Cheer'; every: number };
  /** Anda em ronda por esses pontos (x, z), parando um pouco em cada um. */
  patrol?: readonly [number, number][];
  /** Frases soltas quando o Matheus passa por perto. */
  mutters?: readonly string[];
  /** Pode andar até um ponto com `walkTo` (cenas). */
  walker?: boolean;
  /** Segura uma tocha acesa na mão direita (com luz própria). */
  torch?: boolean;
}

export const NPC_ASSETS = ['Barbarian', 'Rogue_Hooded', 'Rogue', 'Mage', 'axe_1handed', 'mug_full', 'dagger'].map(CHARACTER);
/** Modelos extras de quem usa `torch: true`. */
export const NPC_TORCH_ASSETS = [TORCH_MODEL];

const LOOK_RADIUS = 5.5;
const PATROL_SPEED = 1.15;

const tintCache = new Map<string, THREE.Material>();
function tinted(mat: THREE.Material, tint: number) {
  const key = mat.uuid + ':' + tint;
  let m = tintCache.get(key);
  if (!m) {
    m = mat.clone();
    const std = m as THREE.MeshStandardMaterial;
    if (std.color) std.color.multiply(new THREE.Color(tint));
    tintCache.set(key, m);
  }
  return m;
}
/** Libera as cores criadas (ao sair da área). */
export function disposeNpcMaterials() {
  tintCache.forEach((m) => m.dispose());
  tintCache.clear();
}

function accessory(a: NpcAccessory): { part: THREE.Object3D; bone: 'head' | 'chest' } {
  const mat = new THREE.MeshStandardMaterial({ color: a.color, roughness: 0.9, flatShading: true });
  const g = new THREE.Group();
  if (a.kind === 'strawHat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.04, 12), mat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 10), mat);
    crown.position.y = 0.13;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.355, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0xa02a22, flatShading: true }));
    band.position.y = 0.04;
    g.add(brim, crown, band);
    g.position.set(0, 0.56, 0.02);
    g.rotation.x = -0.08;
    return { part: g, bone: 'head' };
  }
  if (a.kind === 'cap') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.34), mat);
    peak.position.set(0, 0.03, 0.46);
    g.add(crown, peak);
    g.position.set(0, 0.5, 0);
    return { part: g, bone: 'head' };
  }
  if (a.kind === 'scarf') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 12), mat);
    ring.rotation.x = Math.PI / 2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), mat);
    tail.position.set(0.12, -0.28, 0.28);
    g.add(ring, tail);
    g.position.set(0, 0.28, 0);
    return { part: g, bone: 'chest' };
  }
  // avental: pano na frente do tronco
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.74, 0.05), mat);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), mat);
  strap.position.set(0, 0.34, -0.2);
  cloth.position.set(0, -0.08, 0.3);
  g.add(cloth, strap);
  return { part: g, bone: 'chest' };
}

export class Npc {
  readonly object = new THREE.Group();
  readonly position: THREE.Vector3;
  /** Mostra o "!" sobre a cabeça. */
  alert = false;
  /** Vira o rosto para o Matheus quando ele chega perto (desligue em cenas). */
  lookAtPlayer = true;
  readonly mutters: readonly string[];
  /** Altura do terreno (a área informa); sem isso o chão é plano. */
  ground: (x: number, z: number) => number = () => 0;

  private readonly mixer: THREE.AnimationMixer;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly idle: THREE.AnimationAction;
  private walkAction: THREE.AnimationAction | null = null;
  private readonly marker = exclamationMarker();
  private heading: number;
  private home: number;
  private t = Math.random() * 10;
  private workTimer: number;
  private patrolIndex = 0;
  private patrolWait = Math.random() * 3;
  private walking = false;
  private busy = false;
  private readonly owned: THREE.Object3D[] = [];
  private script: { x: number; z: number; speed: number; resolve: () => void } | null = null;
  private readonly flames: ReturnType<typeof createFlame>[] = [];
  private torchLight: THREE.PointLight | null = null;

  constructor(private readonly cfg: NpcConfig) {
    const path = CHARACTER(cfg.character);
    const root = model(path);
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      if (cfg.tint !== undefined) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const out = mats.map((x) => tinted(x, cfg.tint!));
        m.material = Array.isArray(m.material) ? out : out[0];
      }
    });
    if (cfg.scale) root.scale.setScalar(cfg.scale);
    this.object.add(root);
    this.object.position.copy(cfg.position);
    this.position = this.object.position;
    this.heading = this.home = cfg.facing;
    this.object.rotation.y = cfg.facing;
    this.mutters = cfg.mutters ?? [];
    this.workTimer = cfg.work ? Math.random() * cfg.work.every : Infinity;

    for (const clip of gltf(path).animations) this.clips.set(clip.name, clip);
    this.mixer = new THREE.AnimationMixer(root);
    this.idle = this.mixer.clipAction(this.clips.get('Idle')!);
    this.idle.time = Math.random() * this.idle.getClip().duration;
    this.idle.play();
    if (cfg.patrol || cfg.walker) {
      this.walkAction = this.mixer.clipAction(this.clips.get('Walking_A')!);
      this.walkAction.play();
      this.walkAction.setEffectiveWeight(0);
    }

    for (const p of cfg.props ?? []) {
      const bone = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`handslot.${p.hand}`));
      if (!bone) continue;
      const prop = model(p.asset);
      prop.scale.setScalar(p.scale ?? 1);
      if (p.rotation) prop.rotation.set(...p.rotation);
      if (p.position) prop.position.set(...p.position);
      bone.add(prop);
    }
    if (cfg.torch) {
      const bone = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('handslot.r'));
      if (bone) {
        const handle = model(TORCH_MODEL);
        handle.scale.setScalar(0.75);
        handle.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
            mat.color.setHex(0x4a4a50);
            mesh.material = mat;
            this.owned.push(mesh);
          }
        });
        const flame = createFlame(0.42, 4.5);
        flame.mesh.position.y = 0.42;
        this.flames.push(flame);
        this.torchLight = new THREE.PointLight(0xffb070, 7, 11, 2);
        this.torchLight.position.y = 0.9;
        const holder = new THREE.Group();
        holder.add(handle, flame.mesh, this.torchLight);
        bone.add(holder);
      }
    }
    for (const a of cfg.accessories ?? []) {
      const { part, bone } = accessory(a);
      const target = root.getObjectByName(bone);
      if (target) {
        target.add(part);
        this.owned.push(part);
      }
    }

    this.marker.position.y = 2.6;
    this.marker.visible = false;
    this.object.add(this.marker);
  }

  /** Anda até (x, z) e resolve ao chegar (para cenas). Precisa de `walker: true`. */
  walkTo(x: number, z: number, speed = 1.7): Promise<void> {
    return new Promise((resolve) => {
      this.script = { x, z, speed, resolve };
    });
  }

  /** Para onde ela olha quando ninguém está por perto (rotação em Y). */
  face(rot: number) {
    this.home = rot;
  }

  /** Toca um gesto uma vez e volta ao "parado". */
  play(name: string) {
    const clip = this.clips.get(name);
    if (!clip) return;
    this.busy = true;
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
      this.busy = false;
    };
    this.mixer.addEventListener('finished', back);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    this.mixer.update(dt);

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const near = this.lookAtPlayer && Math.hypot(dx, dz) < LOOK_RADIUS;

    // ronda: anda até o próximo ponto, para um pouco, segue
    const patrol = this.cfg.patrol;
    let target = near ? Math.atan2(dx, dz) : this.home;
    const sc = this.script;
    if (sc) {
      const ex = sc.x - this.position.x;
      const ez = sc.z - this.position.z;
      const d = Math.hypot(ex, ez);
      if (d < 0.15) {
        this.script = null;
        this.setWalking(false);
        sc.resolve();
      } else {
        target = Math.atan2(ex, ez);
        this.setWalking(true);
        const step = Math.min(d, sc.speed * dt);
        this.position.x += (ex / d) * step;
        this.position.z += (ez / d) * step;
      }
    }
    if (sc) {
      /* andando em cena: a ronda espera */
    } else if (patrol && patrol.length > 1 && !near) {
      if (this.patrolWait > 0) {
        this.patrolWait -= dt;
        this.setWalking(false);
      } else {
        const [px, pz] = patrol[this.patrolIndex];
        const ex = px - this.position.x;
        const ez = pz - this.position.z;
        const d = Math.hypot(ex, ez);
        if (d < 0.4) {
          this.patrolIndex = (this.patrolIndex + 1) % patrol.length;
          this.patrolWait = 2 + Math.random() * 4;
        } else {
          target = Math.atan2(ex, ez);
          this.setWalking(true);
          this.position.x += (ex / d) * PATROL_SPEED * dt;
          this.position.z += (ez / d) * PATROL_SPEED * dt;
        }
      }
    } else if (patrol) {
      this.setWalking(false);
    }
    this.position.y += (this.ground(this.position.x, this.position.z) - this.position.y) * (1 - Math.exp(-14 * dt));

    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-(this.walking ? 5 : 6) * dt));
    this.object.rotation.y = this.heading;

    // gesto de trabalho de vez em quando
    const w = this.cfg.work;
    if (w && !this.busy && !this.walking) {
      this.workTimer -= dt;
      if (this.workTimer <= 0) {
        this.play(w.clip);
        this.workTimer = w.every * (0.8 + Math.random() * 0.5);
      }
    }

    for (const f of this.flames) f.update(dt);
    this.marker.visible = this.alert;
    if (this.alert) this.marker.position.y = 2.55 + Math.sin(this.t * 3.2) * 0.07;
  }

  private setWalking(on: boolean) {
    if (on === this.walking || !this.walkAction) return;
    this.walking = on;
    if (on) {
      this.walkAction.reset().play();
      this.walkAction.crossFadeFrom(this.idle, 0.25, false);
    } else {
      this.idle.reset().play();
      this.idle.crossFadeFrom(this.walkAction, 0.25, false);
    }
  }

  /** Libera o que o NPC criou por conta própria (acessórios). */
  dispose() {
    this.torchLight?.dispose();
    for (const o of this.owned) {
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
  }
}
