/**
 * Detecta o tipo de aparelho e define a qualidade gráfica.
 * Forçar pela URL: ?q=low | ?q=high   ·   mostrar FPS: ?debug
 */

export type QualityLevel = 'low' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  isTouch: boolean;
  pixelRatio: number;
  shadowMapSize: number;
  msaaSamples: number;
  ambientOcclusion: boolean;
  bloom: boolean;
  dustCount: number;
}

const params = new URLSearchParams(location.search);
export const urlParams = params;

export const debug = params.has('debug');
/** ?personagem: câmera de perto com o personagem girando, para conferir o visual. */
export const characterViewer = params.has('personagem');

export function detectQuality(): QualitySettings {
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const forced = params.get('q');
  const level: QualityLevel = forced === 'low' || forced === 'high' ? forced : isTouch ? 'low' : 'high';
  const dpr = window.devicePixelRatio || 1;

  if (level === 'high') {
    return {
      level,
      isTouch,
      pixelRatio: Math.min(dpr, 2),
      shadowMapSize: 2048,
      msaaSamples: 4,
      ambientOcclusion: true,
      bloom: true,
      dustCount: 260,
    };
  }
  return {
    level,
    isTouch,
    pixelRatio: Math.min(dpr, 1.5),
    shadowMapSize: 1024,
    msaaSamples: 0,
    ambientOcclusion: true, // pode ser desligado pelo ajuste automático de FPS
    bloom: true,
    dustCount: 120,
  };
}

/**
 * Mede o FPS e, se ficar baixo por alguns segundos, reduz a qualidade em degraus.
 * Cada degrau chama `onDowngrade(step)`; quem chama decide o que desligar.
 */
export class AdaptiveQuality {
  private frames = 0;
  private elapsed = 0;
  private step = 0;
  private lowSeconds = 0;
  fps = 60;

  constructor(
    private readonly maxSteps: number,
    private readonly onDowngrade: (step: number) => void,
    private readonly minFps = 28,
  ) {}

  update(dt: number) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 1) return;
    this.fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    if (this.fps < this.minFps) this.lowSeconds++;
    else this.lowSeconds = 0;

    if (this.lowSeconds >= 3 && this.step < this.maxSteps) {
      this.step++;
      this.lowSeconds = 0;
      this.onDowngrade(this.step);
    }
  }
}
