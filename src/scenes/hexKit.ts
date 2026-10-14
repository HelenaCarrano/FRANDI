import * as THREE from 'three';
import type { AreaEnv } from './types';

/** O que a Vila e o Mapa do Reino dividem: escala dos hexágonos KayKit, céu e clima de manhã dourada. */

/** Escala do cenário: um hexágono tem 2 m na peça original e 6 m no jogo. */
export const S = 3;
export const H = Math.sqrt(3);

/** Centro do hexágono (q, r) no chão. */
export const hexPos = (q: number, r: number) => new THREE.Vector3(S * (2 * q + r), 0, S * H * r);

/** Clima gráfico diurno: claro, pouca vinheta, bloom discreto. */
export const DAY_ENV: AreaEnv = {
  exposure: 1.05,
  vignette: 0.8,
  grain: 0.03,
  bloom: { strength: 0.22, radius: 0.5, threshold: 1.1 },
};

/** Degradê de céu: azul no alto, bege e dourado perto do horizonte. */
export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7fa6da');
  grad.addColorStop(0.55, '#d9d3c4');
  grad.addColorStop(1, '#f6dca6');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
