import * as THREE from 'three';
import type { CollisionWorld } from './collision';
import { THIRD_PERSON, type CameraStyle } from '../scenes/types';

/**
 * Câmera que segue o jogador, em dois estilos:
 *  - `third`: 3ª pessoa baixa. Órbita (yaw/pitch) em volta do Matheus; sozinha, gira devagar para ficar
 *    atrás dele; o jogador pode girar à mão (arrastar). Sobe com o terreno e se aproxima quando uma
 *    casa fica no caminho.
 *  - `iso`: diagonal fixa de cima (salão de testes e o antigo mapa-maquete).
 * Zoom (rodinha / pinça): ao aproximar, a câmera desce e mira o rosto do personagem.
 */

export const ZOOM = { min: 0.22, max: 1.5 };

const MIN_PITCH = 5;
const MAX_PITCH = 62;
/** Colisores desse tamanho para cima (casas, muros) empurram a câmera para perto do jogador. */
const BIG_COLLIDER = 1.3;

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Direção do alvo para a câmera (unitária). */
  readonly offsetDir = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();

  private style: CameraStyle;
  private yaw = Math.PI / 4;
  private pitch: number;
  /** 1 = enquadramento normal; menor = mais perto. */
  private zoomTarget = 1;
  private zoom = 1;
  /** Distância efetiva (já encurtada por casas e terreno). */
  private dist: number;
  /** Segundos até o giro automático voltar depois de o jogador girar à mão. */
  private manualHold = 0;

  /** Altura do terreno (o cenário atual informa). */
  ground: (x: number, z: number) => number = () => 0;
  /** Colisores do cenário atual, para a câmera não entrar nas casas. */
  world: CollisionWorld | null = null;

  constructor(
    style: CameraStyle = THIRD_PERSON,
    private readonly followSharpness = 6,
    /** Altura do rosto do personagem, para onde a câmera mira no zoom máximo. */
    private faceHeight = 1.65,
  ) {
    this.style = style;
    this.pitch = THREE.MathUtils.degToRad(style.pitch);
    this.dist = style.distance;
    this.camera = new THREE.PerspectiveCamera(style.fov, window.innerWidth / window.innerHeight, 0.15, 600);
    this.updateOffset();
  }

  /** Troca o estilo (ao entrar numa área). Mantém o giro atual no modo 3ª pessoa. */
  setStyle(style: CameraStyle) {
    this.style = style;
    this.pitch = THREE.MathUtils.degToRad(style.pitch);
    this.dist = style.distance;
    if (style.mode === 'iso') this.yaw = Math.PI / 4;
    this.camera.fov = style.fov;
    this.camera.updateProjectionMatrix();
  }

  /** Altura para onde a câmera mira no zoom máximo (padrão: rosto). */
  setFocusHeight(y: number) {
    this.faceHeight = y;
  }

  /** Multiplica o zoom (ex.: 0.9 aproxima, 1.1 afasta). */
  zoomBy(factor: number) {
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, ZOOM.min, ZOOM.max);
  }

  /** Gira à mão (pixels de arrasto). */
  lookBy(dx: number, dy: number) {
    if (this.style.mode !== 'third') return;
    this.yaw -= dx * 0.0052;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0042, THREE.MathUtils.degToRad(MIN_PITCH), THREE.MathUtils.degToRad(MAX_PITCH));
    this.manualHold = 2.2;
  }

  /** Para onde o centro da câmera olha no chão (o jogador usa para andar "para frente"). */
  get heading() {
    return this.yaw + Math.PI;
  }

  /** 0 = normal (ou mais longe), 1 = zoom máximo no rosto. */
  private closeness() {
    return THREE.MathUtils.clamp((1 - this.zoom) / (1 - ZOOM.min), 0, 1);
  }

  private updateOffset() {
    // ao aproximar, a câmera desce para ver o rosto de frente, não o topo da cabeça
    const el = THREE.MathUtils.lerp(this.pitch, THREE.MathUtils.degToRad(11), this.closeness() ** 0.8);
    this.offsetDir.set(Math.sin(this.yaw) * Math.cos(el), Math.sin(el), Math.cos(this.yaw) * Math.cos(el)).normalize();
  }

  /** Distância desejada: maior quando a tela está em pé. */
  private wantedDistance() {
    const aspect = window.innerWidth / window.innerHeight;
    const k = this.style.mode === 'third' ? 0.55 : 0.85;
    const portraitBoost = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 2.1) * k : 1;
    return this.style.distance * Math.max(1, portraitBoost) * this.zoom;
  }

  /** Ponto mirado: o alvo, subindo até o rosto conforme o zoom aproxima. */
  private aimAt(target: THREE.Vector3) {
    return this.aim.copy(target).setY(THREE.MathUtils.lerp(target.y, this.faceHeight + (target.y - 1), this.closeness()));
  }

  /** A maior distância (até `want`) em que a câmera não fica dentro de uma casa. */
  private clearDistance(want: number) {
    const world = this.world;
    if (!world || this.style.mode !== 'third') return want;
    for (let t = 1.4; t <= want; t += 0.5) {
      this.probe.copy(this.lookTarget).addScaledVector(this.offsetDir, t);
      for (const c of world.colliders) {
        if (c.kind === 'circle' && c.r >= BIG_COLLIDER) {
          if (Math.hypot(this.probe.x - c.x, this.probe.z - c.z) < c.r + 0.25) return Math.max(1.4, t - 0.6);
        } else if (c.kind === 'box') {
          if (this.probe.x > c.minX - 0.25 && this.probe.x < c.maxX + 0.25 && this.probe.z > c.minZ - 0.25 && this.probe.z < c.maxZ + 0.25) return Math.max(1.4, t - 0.6);
        }
      }
    }
    return want;
  }

  private place(dt: number, snap: boolean) {
    const want = this.clearDistance(this.wantedDistance());
    // aproxima rápido (para não atravessar a parede), afasta devagar
    const rate = want < this.dist ? 14 : 2.5;
    this.dist = snap ? want : this.dist + (want - this.dist) * (1 - Math.exp(-rate * dt));
    this.camera.position.copy(this.lookTarget).addScaledVector(this.offsetDir, this.dist);
    const floor = this.ground(this.camera.position.x, this.camera.position.z) + 0.55;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.camera.lookAt(this.lookTarget);
  }

  snapTo(target: THREE.Vector3, heading?: number) {
    this.zoom = this.zoomTarget;
    if (heading !== undefined && this.style.mode === 'third') this.yaw = heading + Math.PI;
    this.updateOffset();
    this.lookTarget.copy(this.aimAt(target));
    this.place(0, true);
  }

  /**
   * `motion`: direção do rosto do jogador e quão rápido ele anda. Andando, a câmera gira devagar para
   * ficar atrás dele (menos quando ele vem em direção à câmera, para não ficar girando de um lado a outro).
   */
  update(target: THREE.Vector3, dt: number, motion?: { heading: number; speed: number }) {
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-10 * dt));
    this.manualHold = Math.max(0, this.manualHold - dt);
    if (this.style.mode === 'third' && motion && this.manualHold <= 0 && motion.speed > 0.4) {
      const diff = Math.atan2(Math.sin(motion.heading + Math.PI - this.yaw), Math.cos(motion.heading + Math.PI - this.yaw));
      this.yaw += Math.sin(diff) * Math.min(1, motion.speed / 2.2) * 1.0 * dt;
    }
    this.updateOffset();
    const k = 1 - Math.exp(-this.followSharpness * dt);
    this.lookTarget.lerp(this.aimAt(target), k);
    this.place(dt, false);
  }

  /**
   * Converte um vetor de tela (x = direita, y = cima) em direção no chão (XZ),
   * relativa à câmera.
   */
  screenToWorld(x: number, y: number, out: THREE.Vector3) {
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP).normalize();
    out.set(0, 0, 0).addScaledVector(this.right, x).addScaledVector(this.forward, y);
    return out;
  }
}
