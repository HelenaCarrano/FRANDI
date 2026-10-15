import * as THREE from 'three';
import type { OutdoorEnv } from '../scenes/types';

/**
 * Domo de céu em shader: degradê do zênite ao horizonte, bruma e halo em volta do sol, disco do sol
 * (valores acima de 1, então o bloom o acende) e estrelas à noite. Acompanha a câmera, então nunca
 * se aproxima. Fica no fundo (profundidade máxima) e não entra no passe de oclusão ambiente: o AO
 * desenha só faces da frente, e o domo é visto por dentro.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly sunDir = new THREE.Vector3();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uGround: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uStars: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // no plano mais distante
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uGround, uSunColor, uSunDir;
        uniform float uStars;
        varying vec3 vDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
          col = mix(col, uGround, smoothstep(0.02, -0.3, h));
          float sd = max(dot(d, uSunDir), 0.0);
          float low = 1.0 - clamp(h * 1.6, 0.0, 1.0);
          col += uSunColor * pow(sd, 5.0) * 0.30 * low;
          col += uSunColor * pow(sd, 24.0) * 0.55;
          col += uSunColor * pow(sd, 180.0) * 1.4;
          col += uSunColor * smoothstep(0.9990, 0.9997, sd) * 7.0;
          if (uStars > 0.01 && h > 0.05) {
            vec3 cell = floor(d * 220.0);
            float s = step(0.9965, hash(cell));
            col += vec3(0.85, 0.92, 1.0) * s * uStars * smoothstep(0.05, 0.4, h) * 1.6;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  apply(env: OutdoorEnv) {
    const u = this.material.uniforms;
    u.uTop.value.setHex(env.skyTop);
    u.uHorizon.value.setHex(env.skyHorizon);
    u.uGround.value.setHex(env.skyGround);
    u.uSunColor.value.setHex(env.sunColor);
    u.uSunDir.value.set(...env.sunDir).normalize();
    u.uStars.value = env.stars;
    this.sunDir.copy(u.uSunDir.value);
  }

  /** Acompanha a câmera. */
  follow(camera: THREE.Camera) {
    this.mesh.position.copy(camera.position);
    this.mesh.scale.setScalar((camera as THREE.PerspectiveCamera).far * 0.5);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
