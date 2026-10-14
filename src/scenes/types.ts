import type * as THREE from 'three';
import type { CollisionWorld } from '../core/collision';
import type { UI } from '../ui/ui';
import type { GameState } from '../core/gameState';
import type { Player } from '../entities/player';
import type { QualitySettings } from '../core/quality';

/** Algo com que o jogador pode interagir ao chegar perto (botão de ação / tecla E). */
export interface Interactable {
  position: THREE.Vector3;
  radius: number;
  /** Texto do botão; pode mudar com o progresso (ex.: "Examinar o portão" -> "Seguir para o mapa"). */
  prompt: string | (() => string);
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

/** Ponto de chegada do jogador numa área, com a direção para onde ele olha. */
export interface SpawnPoint {
  x: number;
  z: number;
  /** Rotação em Y (mesma convenção de `Object3D.rotation.y`). */
  rot: number;
}

/** Identificadores das áreas (também gravados no save). */
export type AreaId = 'village' | 'map' | 'forest' | 'ruins' | 'tower' | 'tavern' | 'vineyard' | 'castle' | 'ending';

/** O que cada área recebe ao ser criada. `goTo` troca de área com fade. */
export interface AreaContext {
  ui: UI;
  game: GameState;
  player: Player;
  quality: QualitySettings;
  goTo: (id: AreaId, entry?: string) => Promise<void>;
}

/** Contrato de uma área do jogo. Cada área é uma cena 3D pequena. */
export interface Area {
  id?: AreaId;
  name: string;
  scene: THREE.Scene;
  world: CollisionWorld;
  /** Ponto de chegada padrão (começo da área). */
  spawn: THREE.Vector3;
  /** Outros pontos de chegada, por nome (ex.: `portao` na vila, um por marco no mapa). */
  entries?: Record<string, SpawnPoint>;
  /** Distância da câmera (padrão: a do jogo). O mapa usa uma câmera mais afastada. */
  cameraDistance?: number;
  /** Chamado quando o jogador já pode agir (depois da abertura ou do fade). */
  onEnter?: () => void;
  /** Libera o que a área criou por conta própria (assinaturas, texturas geradas). */
  dispose?: () => void;
  interactables: Interactable[];
  /** Objetos altos que devem ficar transparentes quando taparem o jogador. */
  occluders: THREE.Object3D[];
  /** Padrão: DARK_ENV. */
  env?: AreaEnv;
  /** A tocha do jogador começa acesa? Padrão: sim. */
  torchLit?: boolean;
  update(dt: number, time: number, playerPos: THREE.Vector3): void;
}
