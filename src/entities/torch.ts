import * as THREE from 'three';
import { Sparks } from '../fx/particles';
import { DUNGEON, model } from '../core/assets';

/** Parâmetros da tocha, fáceis de ajustar. */
export const TORCH = {
  color: new THREE.Color(1.0, 0.62, 0.28),
  intensity: 20,
  distance: 16,
  decay: 1.8,
  flicker: 0.12, // amplitude relativa da oscilação
  shadowRadius: 5,
};

export const TORCH_MODEL = DUNGEON('torch');

/** Chama em billboard: gota com ruído subindo, núcleo quente e borda avermelhada (HDR → bloom). */
export function createFlame(size = 0.5, intensity = 4) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: Math.random() * 100 },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // billboard: mantém o centro do objeto e alinha o quad com a tela
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mv.xy += position.xy * scale;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float y = uv.y;
        // ruído subindo deforma a chama
        float n = fbm(vec2(uv.x * 3.0, y * 2.5 - uTime * 2.2));
        uv.x += (n - 0.5) * 0.35 * y;
        // gota: larga embaixo, pontuda em cima
        float width = mix(0.36, 0.02, pow(y, 0.9));
        float dx = abs(uv.x - 0.5) / max(width, 0.001);
        float body = smoothstep(1.0, 0.35, dx) * smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.55, y + n * 0.25);
        if (body < 0.01) discard;
        float core = smoothstep(0.75, 0.0, dx) * smoothstep(0.75, 0.15, y);
        vec3 edge = vec3(1.0, 0.25, 0.05);
        vec3 mid = vec3(1.0, 0.55, 0.15);
        vec3 hot = vec3(1.0, 0.92, 0.7);
        vec3 col = mix(edge, mid, body);
        col = mix(col, hot, core);
        gl_FragColor = vec4(col * uIntensity * body, body);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), material);
  mesh.scale.set(size * 0.6, size, 1);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.renderOrder = 10;
  return {
    mesh,
    update(dt: number) {
      material.uniforms.uTime.value += dt;
    },
  };
}

/**
 * Tocha de mão: cabo (modelo KayKit), chama em shader, luz pontual com sombra e faíscas.
 * Fica sempre em pé no mundo, não importa a rotação da mão.
 * As faíscas ficam em espaço de mundo: adicione `sparks.points` à cena.
 */
export class Torch {
  readonly object = new THREE.Group();
  readonly light: THREE.PointLight;
  readonly sparks: Sparks;
  private readonly flame: ReturnType<typeof createFlame>;
  private readonly flameAnchor = new THREE.Object3D();
  private readonly flameWorld = new THREE.Vector3();
  private readonly parentQ = new THREE.Quaternion();
  private t = Math.random() * 100;

  constructor(shadowMapSize: number) {
    const handle = model(TORCH_MODEL);
    handle.scale.setScalar(0.75);
    handle.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
      // metal escuro
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color.setHex(0x4a4a50);
        mesh.material = mat;
      }
    });
    this.object.add(handle);

    this.flame = createFlame(0.42, 4.5);
    this.flame.mesh.position.y = 0.42;
    this.object.add(this.flame.mesh);
    this.flameAnchor.position.y = 0.55;
    this.object.add(this.flameAnchor);

    this.light = new THREE.PointLight(TORCH.color, TORCH.intensity, TORCH.distance, TORCH.decay);
    // A luz fica acima da chama: na altura do ombro, o próprio corpo tamparia metade
    // da luz e jogaria uma sombra enorme no chão.
    this.light.position.y = 1.3;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.light.shadow.camera.near = 0.2;
    this.light.shadow.camera.far = TORCH.distance;
    this.light.shadow.bias = -0.002;
    this.light.shadow.normalBias = 0.03;
    this.light.shadow.radius = TORCH.shadowRadius;
    this.object.add(this.light);

    this.sparks = new Sparks(45);
  }

  /** Intensidade base da luz (0 apaga, usado no modo de inspeção). */
  baseIntensity = TORCH.intensity;

  private lit = true;

  get isLit() {
    return this.lit;
  }

  /**
   * Acende ou apaga a tocha (de dia ela fica apagada). Apagada, a luz sai da cena, então
   * ela também deixa de gastar o mapa de sombras de seis faces.
   */
  setLit(on: boolean) {
    this.lit = on;
    this.light.visible = on;
    this.flame.mesh.visible = on;
    this.sparks.points.visible = on;
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;

    // mantém a tocha em pé (anula a rotação herdada da mão)
    const parent = this.object.parent;
    if (parent) {
      parent.getWorldQuaternion(this.parentQ);
      this.object.quaternion.copy(this.parentQ).invert();
    }

    if (!this.lit) return;

    // ruído barato: soma de senos com frequências "quebradas"
    const n = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 15.7 + 1.3) * 0.3 + Math.sin(t * 23.3 + 2.1) * 0.2;
    this.light.intensity = this.baseIntensity * (1 + n * TORCH.flicker);
    this.light.position.x = Math.sin(t * 7.3) * 0.03;
    this.light.position.z = Math.cos(t * 6.1) * 0.03;
    this.flame.update(dt);

    this.flameAnchor.getWorldPosition(this.flameWorld);
    this.sparks.update(dt, this.flameWorld);
  }

  /** Posição da chama em espaço de mundo (atualizada em `update`). */
  get flamePosition() {
    return this.flameWorld;
  }
}
