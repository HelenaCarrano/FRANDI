import * as THREE from 'three';
import { pointScale } from './particles';

/**
 * Efeito de corte: uma explosão de folhas e gravetos que voam e caem, mais um arco branco do golpe de espada
 * que some depressa. Usado quando o Matheus corta os espinhos da floresta. Folhas são `Points` (o AO ignora Points).
 */
export class LeafBurst {
  readonly points: THREE.Points;
  readonly slash: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly col: Float32Array;
  private readonly alpha: Float32Array;
  private readonly count: number;
  private cursor = 0;
  private slashT = 1;

  constructor(count = 120) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.col = new Float32Array(count * 3);
    this.alpha = new Float32Array(count);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: pointScale },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aAlpha;
        uniform float uScale;
        varying vec3 vC;
        varying float vA;
        void main() {
          vC = aColor;
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, 0.22 * projectionMatrix[1][1] * uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        varying float vA;
        void main() {
          vec2 d = abs(gl_PointCoord - 0.5);
          if (d.x + d.y * 1.4 > 0.5 || vA < 0.02) discard;
          gl_FragColor = vec4(vC, vA);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;

    this.slash = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.35, 28, 1, 0, Math.PI * 0.85),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.8), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.slash.visible = false;
    this.slash.renderOrder = 8;
  }

  /** Dispara a explosão em `p`, com o arco do golpe virado para `facing` (rotação em Y). */
  burst(p: THREE.Vector3, facing: number, n = 70) {
    const palette = [0x3f7a35, 0x5f9a3a, 0x8fc548, 0x6b4527, 0x3a2438, 0x8b2c3b].map((h) => new THREE.Color(h));
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * 2.4;
      this.pos[i * 3 + 1] = p.y + 0.4 + Math.random() * 1.8;
      this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 2.4;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      this.vel[i * 3] = Math.cos(a) * sp;
      this.vel[i * 3 + 1] = 1.5 + Math.random() * 3.2;
      this.vel[i * 3 + 2] = Math.sin(a) * sp;
      this.life[i] = 0.9 + Math.random() * 0.9;
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
    }
    this.slash.position.set(p.x, p.y + 1.3, p.z);
    this.slash.rotation.set(0.5, facing + Math.PI / 2, (Math.random() - 0.5) * 0.8);
    this.slash.scale.setScalar(2.4);
    this.slashT = 0;
    this.slash.visible = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 7.5 * dt;
      this.vel[i * 3] *= 1 - 0.9 * dt;
      this.vel[i * 3 + 2] *= 1 - 0.9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, this.life[i] * 1.6);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;

    if (this.slashT < 1) {
      this.slashT = Math.min(1, this.slashT + dt / 0.28);
      (this.slash.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * this.slashT) * 0.95;
      this.slash.scale.setScalar(2.4 + this.slashT * 0.9);
      if (this.slashT >= 1) this.slash.visible = false;
    }
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.slash.geometry.dispose();
    (this.slash.material as THREE.Material).dispose();
  }
}
