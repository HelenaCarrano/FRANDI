import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { QualitySettings } from './quality';
import { DARK_ENV, type AreaEnv } from '../scenes/types';
import { pointScale } from '../fx/particles';

/** Vinheta escura + granulado leve, aplicados depois do tone mapping. */
const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 1.15 },
    uGrain: { value: 0.045 },
    uAspect: { value: 1 },
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
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 c = vUv - 0.5;
      c.x *= mix(1.0, uAspect, 0.5);
      float v = smoothstep(0.85, 0.2, length(c) * uVignette);
      color.rgb *= v;
      float n = hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5;
      color.rgb += n * uGrain;
      gl_FragColor = color;
    }
  `,
};

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly aoPass: GTAOPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly finalPass: ShaderPass;
  private bloomAllowed = true;

  constructor(
    container: HTMLElement,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private quality: QualitySettings,
  ) {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // suavizado via light.shadow.radius
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: quality.msaaSamples,
    });
    const composer = new EffectComposer(renderer, target);
    this.composer = composer;

    this.renderPass = new RenderPass(scene, camera);
    composer.addPass(this.renderPass);

    this.aoPass = new GTAOPass(scene, camera, size.x, size.y);
    this.aoPass.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
    this.aoPass.blendIntensity = 1;
    this.aoPass.enabled = quality.ambientOcclusion;
    composer.addPass(this.aoPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.45, 1.0);
    this.bloomPass.enabled = quality.bloom;
    composer.addPass(this.bloomPass);

    composer.addPass(new OutputPass()); // tone mapping ACES + sRGB

    this.finalPass = new ShaderPass(VignetteGrainShader);
    composer.addPass(this.finalPass);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applyEnv(DARK_ENV);
  }

  /** Aplica o clima gráfico da área (exposição, vinheta, granulado, bloom). */
  applyEnv(env: AreaEnv) {
    this.renderer.toneMappingExposure = env.exposure;
    this.finalPass.uniforms.uVignette.value = env.vignette;
    this.finalPass.uniforms.uGrain.value = env.grain;
    if (env.bloom) {
      this.bloomPass.strength = env.bloom.strength;
      this.bloomPass.radius = env.bloom.radius;
      this.bloomPass.threshold = env.bloom.threshold;
    }
    this.bloomPass.enabled = !!env.bloom && this.quality.bloom && this.bloomAllowed;
  }

  /** Degraus de redução de qualidade usados pelo AdaptiveQuality. */
  downgrade(step: number) {
    if (step === 1) {
      this.aoPass.enabled = false;
    } else if (step === 2) {
      this.quality.pixelRatio = Math.max(1, this.quality.pixelRatio * 0.75);
      this.renderer.setPixelRatio(this.quality.pixelRatio);
      this.resize();
    } else if (step === 3) {
      this.bloomAllowed = false;
      this.bloomPass.enabled = false;
    }
    console.info(`[qualidade] reduzida para o degrau ${step}`);
  }

  resize() {
    const camera = this.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.quality.pixelRatio);
    this.composer.setSize(w, h);
    this.finalPass.uniforms.uAspect.value = w / h;
    pointScale.value = (h * this.quality.pixelRatio) / 2;
  }

  render(time: number) {
    this.finalPass.uniforms.uTime.value = time;
    this.composer.render();
  }
}
