import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Raios de sol: do ponto do sol na tela, borra para fora só o que é muito claro (céu, halo, bruma),
 * então os troncos e as copas à frente "cortam" os feixes. Roda sobre a imagem ainda em HDR, antes do tone mapping.
 */

const shader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uIntensity: { value: 0 },
    uTint: { value: new THREE.Color(1, 0.8, 0.55) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSun;
    uniform float uIntensity;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 delta = (vUv - uSun) * (0.85 / float(RAY_SAMPLES));
      vec2 uv = vUv - delta * hash(vUv * 713.0);
      float decay = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < RAY_SAMPLES; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, uv).rgb;
        float l = dot(s, vec3(0.3, 0.6, 0.1));
        acc += s * smoothstep(1.15, 2.8, l) * decay;
        decay *= 0.955;
      }
      acc /= float(RAY_SAMPLES) * 0.9;
      // some perto das bordas da tela e longe do sol, para o brilho não "vazar" para tudo
      float reach = smoothstep(1.4, 0.2, length(vUv - uSun));
      gl_FragColor = vec4(base.rgb + acc * uTint * uIntensity * reach, base.a);
    }
  `,
};

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1);

export class GodRaysPass extends ShaderPass {
  private samples: number;

  constructor(samples: number) {
    super({ ...shader, uniforms: THREE.UniformsUtils.clone(shader.uniforms), defines: { RAY_SAMPLES: samples } } as never);
    this.samples = samples;
    this.enabled = false;
  }

  /** Ajusta a posição do sol na tela e a força; desliga sozinho quando o sol está atrás da câmera. */
  setSun(camera: THREE.Camera, sunDir: THREE.Vector3, sunColor: THREE.Color, strength: number) {
    camera.getWorldDirection(_f);
    const facing = _f.dot(sunDir);
    const vis = THREE.MathUtils.smoothstep(facing, -0.05, 0.35);
    _v.copy(camera.position).addScaledVector(sunDir, 200).project(camera);
    const u = this.uniforms;
    u.uSun.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
    u.uTint.value.copy(sunColor).lerp(WHITE, 0.25);
    u.uIntensity.value = strength * vis;
    this.enabled = this.samples > 0 && u.uIntensity.value > 0.01;
  }

  /** Reduz as amostras (ou desliga com 0) na redução automática de qualidade. */
  setSamples(n: number) {
    this.samples = n;
    if (n <= 0) {
      this.enabled = false;
      return;
    }
    this.material.defines.RAY_SAMPLES = n;
    this.material.needsUpdate = true;
  }
}
