import type * as THREE from 'three';
import type { CollisionWorld } from '../core/collision';

/** Algo com que o jogador pode interagir ao chegar perto (botão de ação / tecla E). */
export interface Interactable {
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  onInteract: () => void;
  /** Quando devolve false, a interação some (ex.: material antes da missão começar). */
  enabled?: () => boolean;
}

/** Clima gráfico de uma área: exposição, vinheta, granulado e bloom. */
export interface AreaEnv {
  exposure: number;
  vignette: number;
  grain: number;
  bloom: { strength: number; radius: number; threshold: number } | null;
}

/** Visual escuro e dramático (salão de testes, ruínas, castelo). */
export const DARK_ENV: AreaEnv = {
  exposure: 1.0,
  vignette: 1.15,
  grain: 0.045,
  bloom: { strength: 0.55, radius: 0.45, threshold: 1.0 },
};

/** Contrato de uma área do jogo. Cada área é uma cena 3D pequena. */
export interface Area {
  name: string;
  scene: THREE.Scene;
  world: CollisionWorld;
  spawn: THREE.Vector3;
  interactables: Interactable[];
  /** Objetos altos que devem ficar transparentes quando taparem o jogador. */
  occluders: THREE.Object3D[];
  /** Padrão: DARK_ENV. */
  env?: AreaEnv;
  /** A tocha do jogador começa acesa? Padrão: sim. */
  torchLit?: boolean;
  update(dt: number, time: number, playerPos: THREE.Vector3): void;
}
