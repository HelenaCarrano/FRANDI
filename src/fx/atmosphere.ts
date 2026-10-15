import * as THREE from 'three';
import { Sky } from './sky';
import type { AreaEnv, Grade, OutdoorEnv } from '../scenes/types';
import type { QualitySettings } from '../core/quality';

/**
 * Tudo o que faz uma área ao ar livre parecer "lugar": céu, sol com sombras longas, luz de céu,
 * névoa exponencial. As áreas só descrevem o clima (`OutdoorEnv`); esta classe cria e atualiza as luzes.
 * Também guarda os climas prontos (manhã dourada, pôr do sol, noite) e `lerpEnv` para misturá-los.
 */

// ---------- climas prontos ----------

/** Manhã dourada: sol baixo e quente, bruma cor de mel, sombras longas. */
export const GOLDEN_MORNING: AreaEnv = {
  exposure: 1.12,
  vignette: 0.9,
  grain: 0.03,
  bloom: { strength: 0.28, radius: 0.6, threshold: 1.05 },
  godRays: 0.6,
  grade: { shadow: 0xd9e8ee, highlight: 0xfff0d6, saturation: 1.12, contrast: 1.07 },
  outdoor: {
    skyTop: 0x4d86c8,
    skyHorizon: 0xf6d9a4,
    skyGround: 0xbba27a,
    sunDir: [-0.55, 0.3, -0.78],
    sunColor: 0xffc880,
    sunIntensity: 4.2,
    hemiSky: 0xa9c8ee,
    hemiGround: 0x8a7a55,
    hemiIntensity: 2.1,
    fogColor: 0xf0d3a0,
    fogDensity: 0.0085,
    stars: 0,
  },
};

/** Pôr do sol: laranja e rosa, mais perto do clima da Floresta no começo. */
export const SUNSET: AreaEnv = {
  exposure: 1.0,
  vignette: 1.0,
  grain: 0.035,
  bloom: { strength: 0.4, radius: 0.65, threshold: 0.9 },
  godRays: 0.85,
  grade: { shadow: 0xc8d6ee, highlight: 0xffe0bd, saturation: 1.18, contrast: 1.1 },
  outdoor: {
    skyTop: 0x3c5f9e,
    skyHorizon: 0xff9d5c,
    skyGround: 0x7a5a52,
    sunDir: [-0.6, 0.16, -0.78],
    sunColor: 0xff9a52,
    sunIntensity: 3.6,
    hemiSky: 0x8fa6d8,
    hemiGround: 0x6d5648,
    hemiIntensity: 1.0,
    fogColor: 0xe8a77c,
    fogDensity: 0.011,
    stars: 0,
  },
};

/** Noite verde-azulada da Floresta: luar frio, névoa escura e estrelas. */
export const NIGHT_FOREST: AreaEnv = {
  exposure: 1.18,
  vignette: 1.1,
  grain: 0.045,
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.8 },
  godRays: 0.0,
  grade: { shadow: 0xa9e0e4, highlight: 0xffe4c4, saturation: 1.12, contrast: 1.08 },
  outdoor: {
    skyTop: 0x06102a,
    skyHorizon: 0x1f4d5e,
    skyGround: 0x07131a,
    sunDir: [0.4, 0.55, 0.5],
    sunColor: 0x9fc4ff,
    sunIntensity: 0.9,
    hemiSky: 0x5f97bd,
    hemiGround: 0x1c3a33,
    hemiIntensity: 1.15,
    fogColor: 0x143c44,
    fogDensity: 0.022,
    stars: 1,
  },
};

const NEUTRAL_GRADE: Grade = { shadow: 0xffffff, highlight: 0xffffff, saturation: 1, contrast: 1 };
export const neutralGrade = () => ({ ...NEUTRAL_GRADE });

const _a = new THREE.Color();
const _b = new THREE.Color();
const mixHex = (a: number, b: number, t: number) => _a.setHex(a).lerp(_b.setHex(b), t).getHex();
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Mistura dois climas (t = 0 → a, t = 1 → b) em `out`, que é reaproveitado a cada quadro. */
export function lerpEnv(a: AreaEnv, b: AreaEnv, t: number, out: AreaEnv): AreaEnv {
  const oa = a.outdoor!;
  const ob = b.outdoor!;
  const ga = a.grade ?? NEUTRAL_GRADE;
  const gb = b.grade ?? NEUTRAL_GRADE;
  out.exposure = mix(a.exposure, b.exposure, t);
  out.vignette = mix(a.vignette, b.vignette, t);
  out.grain = mix(a.grain, b.grain, t);
  const ba = a.bloom ?? b.bloom!;
  const bb = b.bloom ?? a.bloom!;
  out.bloom = {
    strength: mix(ba.strength, bb.strength, t),
    radius: mix(ba.radius, bb.radius, t),
    threshold: mix(ba.threshold, bb.threshold, t),
  };
  out.godRays = mix(a.godRays ?? 0, b.godRays ?? 0, t);
  out.grade = {
    shadow: mixHex(ga.shadow, gb.shadow, t),
    highlight: mixHex(ga.highlight, gb.highlight, t),
    saturation: mix(ga.saturation, gb.saturation, t),
    contrast: mix(ga.contrast, gb.contrast, t),
  };
  const o = (out.outdoor ??= { ...oa });
  o.skyTop = mixHex(oa.skyTop, ob.skyTop, t);
  o.skyHorizon = mixHex(oa.skyHorizon, ob.skyHorizon, t);
  o.skyGround = mixHex(oa.skyGround, ob.skyGround, t);
  o.sunDir = [mix(oa.sunDir[0], ob.sunDir[0], t), mix(oa.sunDir[1], ob.sunDir[1], t), mix(oa.sunDir[2], ob.sunDir[2], t)];
  o.sunColor = mixHex(oa.sunColor, ob.sunColor, t);
  o.sunIntensity = mix(oa.sunIntensity, ob.sunIntensity, t);
  o.hemiSky = mixHex(oa.hemiSky, ob.hemiSky, t);
  o.hemiGround = mixHex(oa.hemiGround, ob.hemiGround, t);
  o.hemiIntensity = mix(oa.hemiIntensity, ob.hemiIntensity, t);
  o.fogColor = mixHex(oa.fogColor, ob.fogColor, t);
  o.fogDensity = mix(oa.fogDensity, ob.fogDensity, t);
  o.stars = mix(oa.stars, ob.stars, t);
  return out;
}

/** Cópia profunda de um clima (para a área poder alterá-lo sem mexer no original). */
export function cloneEnv(env: AreaEnv): AreaEnv {
  return {
    ...env,
    bloom: env.bloom ? { ...env.bloom } : null,
    grade: env.grade ? { ...env.grade } : undefined,
    outdoor: env.outdoor ? { ...env.outdoor, sunDir: [...env.outdoor.sunDir] } : undefined,
  };
}

// ---------- luzes, céu e névoa ----------

export class Outdoor {
  readonly sky = new Sky();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private readonly fog = new THREE.FogExp2(0xffffff, 0.01);
  private readonly dir = new THREE.Vector3();
  private readonly span: number;
  private readonly texel: number;
  private readonly center = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();

  constructor(scene: THREE.Scene, quality: QualitySettings, env: OutdoorEnv) {
    this.span = quality.shadowSpan;
    this.texel = (this.span * 2) / quality.shadowMapSize;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -this.span;
    cam.right = cam.top = this.span;
    cam.near = 1;
    cam.far = 150;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 3;

    scene.fog = this.fog;
    scene.add(this.hemi, this.sun, this.sun.target, this.sky.mesh);
    this.apply(env);
  }

  /** Aplica um clima (cores, intensidades, névoa). Barato: pode ser chamado a cada quadro. */
  apply(env: OutdoorEnv) {
    this.sky.apply(env);
    this.dir.set(...env.sunDir).normalize();
    this.sun.color.setHex(env.sunColor);
    this.sun.intensity = env.sunIntensity;
    this.hemi.color.setHex(env.hemiSky);
    this.hemi.groundColor.setHex(env.hemiGround);
    this.hemi.intensity = env.hemiIntensity;
    this.fog.color.setHex(env.fogColor);
    this.fog.density = env.fogDensity;
  }

  /** Céu acompanha a câmera; a caixa de sombra do sol acompanha o jogador, um pouco à frente da câmera. */
  update(playerPos: THREE.Vector3, camera: THREE.Camera) {
    this.sky.follow(camera);
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() > 1e-4) this.forward.normalize();
    this.center.copy(playerPos).addScaledVector(this.forward, this.span * 0.3);
    this.center.y = playerPos.y;

    // alinha ao pixel do mapa de sombras no espaço da luz: a sombra não "treme" ao andar
    this.right.crossVectors(THREE.Object3D.DEFAULT_UP, this.dir).normalize();
    this.up.crossVectors(this.dir, this.right);
    const r = Math.round(this.center.dot(this.right) / this.texel) * this.texel;
    const u = Math.round(this.center.dot(this.up) / this.texel) * this.texel;
    const d = this.center.dot(this.dir);
    this.sun.target.position.copy(this.right).multiplyScalar(r).addScaledVector(this.up, u).addScaledVector(this.dir, d);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.dir, 75);
  }

  /** Direção para o sol (unitária). */
  get sunDirection() {
    return this.dir;
  }

  dispose() {
    this.sky.dispose();
    this.sun.dispose();
  }
}
