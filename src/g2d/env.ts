import { lerp, lerpRGB } from './art';
import type { Env } from './types';

/** Climas de luz prontos; as áreas misturam ou escolhem um. */

export const NIGHT: Env = { amb: [74, 90, 154], dark: 1, shaft: 0.35, shaftCol: [150, 176, 255], grade: [60, 70, 160], gradeA: 0.12, mist: 0.5, dapple: 0.5, overhang: true, vignette: 1 };
export const SUNSET: Env = { amb: [255, 208, 160], dark: 0.4, shaft: 0.9, shaftCol: [255, 184, 110], grade: [255, 150, 90], gradeA: 0.09, mist: 0.28, dapple: 1, overhang: true, vignette: 1 };
export const GOLDEN_MORNING: Env = { amb: [255, 236, 200], dark: 0, shaft: 1, shaftCol: [255, 230, 170], grade: [255, 200, 130], gradeA: 0.08, mist: 0.5, dapple: 1, overhang: true, vignette: 1 };
export const DAY: Env = { amb: [255, 246, 224], dark: 0, shaft: 0.95, shaftCol: [255, 238, 188], grade: [255, 214, 150], gradeA: 0.06, mist: 0.1, dapple: 1, overhang: false, vignette: 1 };
/** Lugares fechados e aconchegantes (taverna, casa): escuro quente, sem manchas de folhas. */
export const INDOOR_WARM: Env = { amb: [150, 118, 110], dark: 0.85, shaft: 0, shaftCol: [255, 200, 140], grade: [255, 140, 70], gradeA: 0.1, mist: 0, dapple: 0, overhang: false, vignette: 1.2 };

export const cloneEnv = (e: Env): Env => ({ ...e, amb: [...e.amb], shaftCol: [...e.shaftCol], grade: [...e.grade] });

export function lerpEnv(a: Env, b: Env, t: number, out: Env): Env {
  out.amb = lerpRGB(a.amb, b.amb, t);
  out.shaftCol = lerpRGB(a.shaftCol, b.shaftCol, t);
  out.grade = lerpRGB(a.grade, b.grade, t);
  out.dark = lerp(a.dark, b.dark, t);
  out.shaft = lerp(a.shaft, b.shaft, t);
  out.gradeA = lerp(a.gradeA, b.gradeA, t);
  out.mist = lerp(a.mist, b.mist, t);
  out.dapple = lerp(a.dapple, b.dapple, t);
  out.vignette = lerp(a.vignette, b.vignette, t);
  out.overhang = t < 0.5 ? a.overhang : b.overhang;
  return out;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
