import * as THREE from 'three';
import { pointScale } from './particles';

/**
 * Baforada de névoa: partículas pálidas que sobem e somem quando um espírito se desfaz (ou leva um golpe).
 * São `Points` (o passe de AO ignora Points).
 */
export class MistPuff {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly alpha: Float32Array;
  private cursor = 0;

  constructor(private readonly count = 90) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.alpha = new Float32Array(count);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: pointScale, uColor: { value: new THREE.Color(0.75, 0.9, 1.3) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        uniform float uScale;
        varying float vA;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, (0.25 + 0.35 * aAlpha) * projectionMatrix[1][1] * uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5 || vA < 0.02) discard;
          gl_FragColor = vec4(uColor, vA * (1.0 - d * 1.6) * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  burst(x: number, y: number, z: number, n = 24, power = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.5;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.3) * 0.7;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 1.6) * power;
      this.vel[i * 3] = Math.cos(a) * sp;
      this.vel[i * 3 + 1] = 0.5 + Math.random() * 1.6 * power;
      this.vel[i * 3 + 2] = Math.sin(a) * sp;
      this.life[i] = 0.7 + Math.random() * 0.8;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3] *= 1 - 1.4 * dt;
      this.vel[i * 3 + 2] *= 1 - 1.4 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, this.life[i] * 1.5);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
