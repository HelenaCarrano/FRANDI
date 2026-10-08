import type * as THREE from 'three';
import type { CollisionWorld } from '../core/collision';

/** Algo com que o jogador pode interagir ao chegar perto (botão de ação / tecla E). */
export interface Interactable {
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  onInteract: () => void;
}

/** Contrato de uma área do jogo. Cada área é uma cena 3D pequena. */
export interface Area {
  name: string;
  scene: THREE.Scene;
  world: CollisionWorld;
  spawn: THREE.Vector3;
  interactables: Interactable[];
  /** Objetos altos que devem ficar transparentes quando taparem o jogador. */
  occluders: THREE.Object3D[];
  update(dt: number, time: number, playerPos: THREE.Vector3): void;
}
