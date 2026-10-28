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
import { GodRaysPass } from '../fx/godRays';
import { urlParams } from './quality';

/** ?estilo=pixel: desenha em baixa resolução com pixels grandes, paleta reduzida, contorno e tela de tubo (CRT). */
export const PIXEL_STYLE = urlParams.get('estilo') === 'pixel';
/** Altura aproximada (em pixels do jogo) da imagem no estilo pixel; os pixels crescem com a janela. */
const PIXEL_ROWS = 270;

/** Vinheta escura + granulado leve, aplicados depois do tone mapping. */
const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 1.15 },
    uGrain: { value: 0.045 },
    uAspect: { value: 1 },
    uShadow: { value: new THREE.Color(1, 1, 1) },
    uHighlight: { value: new THREE.Color(1, 1, 1) },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uPixel: { value: 0 },
    uRes: { value: new THREE.Vector2(320, 180) },
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
    uniform vec3 uShadow;
    uniform vec3 uHighlight;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uPixel;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    // matriz de Bayer 4x4 (valores 0..1) para o pontilhado da paleta reduzida
    float bayer(vec2 p) {
      ivec2 i = ivec2(mod(p, 4.0));
      int idx = i.x + i.y * 4;
      float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return (m[idx] + 0.5) / 16.0;
    }

    vec3 grade(vec3 rgb) {
      float luma = lum(rgb);
      rgb = mix(vec3(luma), rgb, uSaturation);
      rgb = (rgb - 0.5) * uContrast + 0.5;
      return rgb * mix(uShadow, uHighlight, smoothstep(0.08, 0.75, luma));
    }

    void main() {
      if (uPixel > 0.5) {
        // tela de tubo: leve curvatura; fora dela fica o preto da moldura
        vec2 cc = vUv * 2.0 - 1.0;
        cc *= 1.0 + dot(cc, cc) * 0.028;
        vec2 uv = cc * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
        vec2 px = floor(uv * uRes);
        vec2 t = 1.0 / uRes;
        vec2 base = (px + 0.5) * t;
        vec3 c = texture2D(tDiffuse, base).rgb;
        // contorno: o pixel escuro ao lado de um bem mais claro ganha a borda
        float lc = lum(c);
        float edge = 0.0;
        edge = max(edge, lum(texture2D(tDiffuse, base + vec2(t.x, 0.0)).rgb) - lc);
        edge = max(edge, lum(texture2D(tDiffuse, base - vec2(t.x, 0.0)).rgb) - lc);
        edge = max(edge, lum(texture2D(tDiffuse, base + vec2(0.0, t.y)).rgb) - lc);
        edge = max(edge, lum(texture2D(tDiffuse, base - vec2(0.0, t.y)).rgb) - lc);
        c *= 1.0 - 0.5 * smoothstep(0.07, 0.2, edge);
        c = grade(c);
        // paleta reduzida com pontilhado
        float levels = 9.0;
        c = floor(c * (levels - 1.0) + bayer(px) * 0.55 + 0.2) / (levels - 1.0);
        // linhas de varredura e leve brilho de fósforo
        float row = fract(uv.y * uRes.y);
        c *= mix(0.78, 1.04, sin(row * 3.14159));
        float colMask = 0.96 + 0.04 * sin(vUv.x * uRes.x * 6.28318);
        c *= colMask;
        vec2 vc = vUv - 0.5;
        vc.x *= mix(1.0, uAspect, 0.5);
        c *= smoothstep(0.95, 0.25, length(vc) * uVignette);
        c += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * uGrain * 0.6;
        gl_FragColor = vec4(c, 1.0);
        return;
      }
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = grade(color.rgb);
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
  readonly godRays: GodRaysPass;
  private quality: QualitySettings;
  private bloomAllowed = true;
  /** Tamanho (em pixels do jogo) da imagem no estilo pixel. */
  private pixelSize = new THREE.Vector2(320, 180);
  private readonly sunColor = new THREE.Color();
  private readonly sunDir = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    quality: QualitySettings,
  ) {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    if (PIXEL_STYLE) quality = { ...quality, pixelRatio: 1, msaaSamples: 0, ambientOcclusion: false, bloom: false, godRaySamples: 0 };
    this.quality = quality;
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
    if (PIXEL_STYLE) {
      // pixels nítidos: sem suavização ao ampliar o quadro pequeno para a tela
      for (const rt of [composer.renderTarget1, composer.renderTarget2]) rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
    }

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

    this.godRays = new GodRaysPass(quality.godRaySamples);
    composer.addPass(this.godRays);

    composer.addPass(new OutputPass()); // tone mapping ACES + sRGB

    this.finalPass = new ShaderPass(VignetteGrainShader);
    composer.addPass(this.finalPass);
    this.finalPass.uniforms.uPixel.value = PIXEL_STYLE ? 1 : 0;

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

    const u = this.finalPass.uniforms;
    const g = env.grade;
    u.uShadow.value.setHex(g?.shadow ?? 0xffffff);
    u.uHighlight.value.setHex(g?.highlight ?? 0xffffff);
    u.uSaturation.value = g?.saturation ?? 1;
    u.uContrast.value = g?.contrast ?? 1;

    const o = env.outdoor;
    if (o && env.godRays) {
      this.sunDir.set(...o.sunDir).normalize();
      this.sunColor.setHex(o.sunColor);
      this.godRays.setSun(this.camera, this.sunDir, this.sunColor, env.godRays);
    } else {
      this.godRays.enabled = false;
    }
  }

  /** Troca a cena desenhada (troca de área). */
  setScene(scene: THREE.Scene) {
    this.renderPass.scene = scene;
    this.aoPass.scene = scene;
  }

  /** Degraus de redução de qualidade usados pelo AdaptiveQuality. */
  downgrade(step: number) {
    if (step === 1) {
      // grama mais curta e raios de sol mais baratos
      this.quality.grassRange *= 0.65;
      this.quality.godRaySamples = Math.min(this.quality.godRaySamples, 10);
      this.godRays.setSamples(this.quality.godRaySamples);
    } else if (step === 2) {
      this.godRays.setSamples(0);
      this.quality.godRaySamples = 0;
      this.aoPass.enabled = false;
    } else if (step === 3) {
      this.quality.pixelRatio = Math.max(1, this.quality.pixelRatio * 0.75);
      this.renderer.setPixelRatio(this.quality.pixelRatio);
      this.resize();
    } else if (step === 4) {
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
    this.finalPass.uniforms.uAspect.value = w / h;
    if (PIXEL_STYLE) {
      // quadro pequeno (pixels grandes): a tela amplia sem suavizar
      const scale = Math.max(2, Math.round(h / PIXEL_ROWS));
      this.pixelSize.set(Math.ceil(w / scale), Math.ceil(h / scale));
      this.composer.setPixelRatio(1);
      this.composer.setSize(this.pixelSize.x, this.pixelSize.y);
      this.finalPass.uniforms.uRes.value.copy(this.pixelSize);
      pointScale.value = this.pixelSize.y / 2;
      return;
    }
    this.composer.setPixelRatio(this.quality.pixelRatio);
    this.composer.setSize(w, h);
    pointScale.value = (h * this.quality.pixelRatio) / 2;
  }

  render(time: number) {
    this.finalPass.uniforms.uTime.value = time;
    this.composer.render();
  }
}
