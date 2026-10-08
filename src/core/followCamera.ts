import * as THREE from 'three';

/**
 * Câmera isométrica (perspectiva com FOV baixo) seguindo um alvo com suavidade.
 * Com a tela em pé (retrato) a câmera se afasta para mostrar mais cena.
 * Zoom (rodinha do mouse / pinça): ao aproximar, a câmera desce e mira o rosto do personagem.
 */

export const ZOOM = { min: 0.22, max: 1.5 };

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Direção do alvo para a câmera (unitária); muda com o zoom. */
  readonly offsetDir = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly azimuth: number;
  private readonly elevation: number;
  /** 1 = enquadramento normal; menor = mais perto. */
  private zoomTarget = 1;
  private zoom = 1;

  constructor(
    private baseDistance = 17,
    azimuthDeg = 45,
    elevationDeg = 48,
    private followSharpness = 5,
    /** Altura do rosto do personagem, para onde a câmera mira no zoom máximo. */
    private faceHeight = 1.65,
  ) {
    this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 140);
    this.azimuth = THREE.MathUtils.degToRad(azimuthDeg);
    this.elevation = THREE.MathUtils.degToRad(elevationDeg);
    this.updateOffset();
  }

  /** Altura para onde a câmera mira no zoom máximo (padrão: rosto). */
  setFocusHeight(y: number) {
    this.faceHeight = y;
  }

  /** Multiplica o zoom (ex.: 0.9 aproxima, 1.1 afasta). */
  zoomBy(factor: number) {
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, ZOOM.min, ZOOM.max);
  }

  /** 0 = normal (ou mais longe), 1 = zoom máximo no rosto. */
  private closeness() {
    return THREE.MathUtils.clamp((1 - this.zoom) / (1 - ZOOM.min), 0, 1);
  }

  private updateOffset() {
    // ao aproximar, a câmera desce para ver o rosto de frente, não o topo da cabeça
    const el = THREE.MathUtils.lerp(this.elevation, THREE.MathUtils.degToRad(12), this.closeness() ** 0.8);
    this.offsetDir.set(Math.sin(this.azimuth) * Math.cos(el), Math.sin(el), Math.cos(this.azimuth) * Math.cos(el)).normalize();
  }

  /** Distância atual: maior quando a tela está em pé. */
  private distance() {
    const aspect = window.innerWidth / window.innerHeight;
    const portraitBoost = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 2.1) * 0.85 : 1;
    return this.baseDistance * Math.max(1, portraitBoost) * this.zoom;
  }

  /** Ponto mirado: o alvo, subindo até o rosto conforme o zoom aproxima. */
  private aimAt(target: THREE.Vector3) {
    return this.aim.copy(target).setY(THREE.MathUtils.lerp(target.y, this.faceHeight, this.closeness()));
  }

  snapTo(target: THREE.Vector3) {
    this.zoom = this.zoomTarget;
    this.updateOffset();
    this.lookTarget.copy(this.aimAt(target));
    this.camera.position.copy(this.lookTarget).addScaledVector(this.offsetDir, this.distance());
    this.camera.lookAt(this.lookTarget);
  }

  update(target: THREE.Vector3, dt: number) {
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-10 * dt));
    this.updateOffset();
    const k = 1 - Math.exp(-this.followSharpness * dt);
    this.lookTarget.lerp(this.aimAt(target), k);
    this.camera.position.copy(this.lookTarget).addScaledVector(this.offsetDir, this.distance());
    this.camera.lookAt(this.lookTarget);
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
