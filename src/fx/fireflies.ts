import * as THREE from 'three';
import { pointScale } from './particles';

/**
 * Vagalumes da floresta. Duas coisas:
 *  - `Fireflies`: um enxame ao redor do jogador. As posições "dão a volta" numa caixa que acompanha o
 *    Matheus, então há sempre vagalumes por perto sem precisar de milhares espalhados pelo mapa. Piscam e flutuam.
 *  - `GuideFireflies`: um fio de vagalumes mais brilhantes que corre pela trilha certa, à frente do jogador.
 * São `Points` (e não Sprites) porque o passe de oclusão ambiente ignora Points.
 */

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class Fireflies {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count: number, box = 62) {
    const seeds = new Float32Array(count * 4);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uPlayer: { value: new THREE.Vector3() },
        uBox: { value: box },
        uColor: { value: new THREE.Color(0.9, 1.0, 0.32).multiplyScalar(3.2) },
        uScale: pointScale,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uAmount, uScale, uBox;
        uniform vec3 uPlayer;
        varying float vA;
        void main() {
          vec2 base = aSeed.xz * uBox;
          vec2 xz = mod(base - uPlayer.xz + uBox * 0.5, uBox) - uBox * 0.5 + uPlayer.xz;
          float t = uTime;
          float s = aSeed.w;
          vec3 p = vec3(xz.x, uPlayer.y + 0.5 + aSeed.y * 3.4, xz.y);
          p += vec3(sin(t * 0.6 + s * 30.0) * 1.3, sin(t * 1.3 + s * 17.0) * 0.4, cos(t * 0.5 + s * 23.0) * 1.3);
          float blink = smoothstep(0.35, 0.92, sin(t * (0.9 + s) + s * 50.0) * 0.5 + 0.5);
          float d = distance(p.xz, uPlayer.xz);
          vA = blink * uAmount * smoothstep(uBox * 0.5, uBox * 0.28, d);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_PointSize = max(2.0, 0.17 * projectionMatrix[1][1] * uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /** `amount`: 0 (de dia) a 1 (noite fechada). */
  update(time: number, player: THREE.Vector3, amount: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uAmount.value = amount;
    this.material.uniforms.uPlayer.value.copy(player);
    this.points.visible = amount > 0.01;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

/** Vagalumes-guia: correm pela trilha certa, um pouco à frente do jogador, devagar, como quem chama. */
export class GuideFireflies {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly pos: Float32Array;
  private readonly seed: Float32Array;
  private readonly count: number;

  constructor(count = 34) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) this.seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uColor: { value: new THREE.Color(0.7, 1.0, 0.75).multiplyScalar(4.2) },
        uScale: pointScale,
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uAmount, uScale;
        varying float vA;
        void main() {
          float blink = 0.55 + 0.45 * sin(uTime * (1.4 + aSeed) + aSeed * 40.0);
          vA = blink * uAmount;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.5, 0.26 * projectionMatrix[1][1] * uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /**
   * `at(f)`: ponto (x, z) da trilha na fração f. Os vagalumes ocupam o trecho [from, to] e correm para o fim dele.
   * `ground`: altura do terreno.
   */
  update(time: number, amount: number, from: number, to: number, at: (f: number) => THREE.Vector2, ground: (x: number, z: number) => number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uAmount.value = amount;
    this.points.visible = amount > 0.01;
    if (amount <= 0.01) return;
    for (let i = 0; i < this.count; i++) {
      const phase = (i / this.count + time * 0.045 + this.seed[i] * 0.02) % 1;
      const p = at(from + (to - from) * phase);
      const wob = Math.sin(time * 1.7 + this.seed[i] * 40) * 0.9;
      const x = p.x + Math.cos(this.seed[i] * 6.28) * 1.0 + wob * 0.6;
      const z = p.y + Math.sin(this.seed[i] * 6.28) * 1.0 + wob * 0.4;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = ground(x, z) + 0.9 + this.seed[i] * 1.5 + Math.sin(time * 2.1 + this.seed[i] * 20) * 0.25;
      this.pos[i * 3 + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
