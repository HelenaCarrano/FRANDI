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

/** Luz, céu e névoa de uma área ao ar livre. Cores em hexadecimal (0xRRGGBB). */
export interface OutdoorEnv {
  skyTop: number;
  skyHorizon: number;
  skyGround: number;
  /** Direção PARA o sol (não precisa ser unitária). */
  sunDir: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fogColor: number;
  /** Densidade da névoa exponencial (0,01 = leve, 0,04 = espessa). */
  fogDensity: number;
  /** 0..1: estrelas no céu. */
  stars: number;
}

/** Gradação de cor aplicada no fim: tons nas sombras e nas luzes, saturação e contraste. */
export interface Grade {
  shadow: number;
  highlight: number;
  saturation: number;
  contrast: number;
}

/** Clima gráfico de uma área: exposição, vinheta, granulado, bloom e (ao ar livre) céu e raios de sol. */
export interface AreaEnv {
  exposure: number;
  vignette: number;
  grain: number;
  bloom: { strength: number; radius: number; threshold: number } | null;
  /** Só áreas ao ar livre: quem tem isso usa o `Outdoor` (fx/atmosphere.ts) para criar sol, céu e névoa. */
  outdoor?: OutdoorEnv;
  grade?: Grade;
  /** 0..1: força dos raios de sol. */
  godRays?: number;
}

/** Visual escuro e dramático (salão de testes, ruínas, castelo). */
export const DARK_ENV: AreaEnv = {
  exposure: 1.0,
  vignette: 1.15,
  grain: 0.045,
  bloom: { strength: 0.55, radius: 0.45, threshold: 1.0 },
};

/** Como a câmera acompanha o jogador. `iso` é a diagonal fixa de cima; `third` é a de 3ª pessoa. */
export interface CameraStyle {
  mode: 'iso' | 'third';
  distance: number;
  /** Elevação em graus. */
  pitch: number;
  /** Campo de visão vertical em graus. */
  fov: number;
}

export const THIRD_PERSON: CameraStyle = { mode: 'third', distance: 7.5, pitch: 17, fov: 52 };
export const ISOMETRIC: CameraStyle = { mode: 'iso', distance: 17, pitch: 48, fov: 30 };

/** Ponto de chegada do jogador numa área, com a direção para onde ele olha. */
export interface SpawnPoint {
  x: number;
  z: number;
  /** Rotação em Y (mesma convenção de `Object3D.rotation.y`). */
  rot: number;
}

/** Identificadores das áreas (também gravados no save). */
export type AreaId = 'village' | 'map' | 'forest' | 'ruins' | 'tower' | 'tavern' | 'vineyard' | 'castle' | 'ending' | 'visual';

/** O que cada área recebe ao ser criada. `goTo` troca de área com fade. */
export interface AreaContext {
  ui: UI;
  game: GameState;
  player: Player;
  quality: QualitySettings;
  /** A câmera do jogo (o céu e a sombra do sol acompanham). */
  camera: THREE.PerspectiveCamera;
  /** Luz de preenchimento do Matheus (só vale quando a tocha está acesa). */
  fillLight: THREE.PointLight;
  goTo: (id: AreaId, entry?: string) => Promise<void>;
  /** Ponto de chegada pedido a esta área (ex.: `f3`), para quem precisa montar a cena já no lugar certo. */
  entry?: string;
  /** Move o jogador dentro da área (ex.: entre andares da Torre) e encaixa a câmera. A tela deve estar escura. */
  teleport: (x: number, z: number, rot?: number) => void;
  /** Abre o Mapa do Reino; se o jogador escolher outro lugar, viaja para lá. */
  openMap: () => Promise<void>;
}

/** Contrato de uma área do jogo. Cada área é uma cena 3D pequena. */
export interface Area {
  id?: AreaId;
  name: string;
  scene: THREE.Scene;
  world: CollisionWorld;
  /** Ponto de chegada padrão (começo da área). */
  spawn: THREE.Vector3;
  /** Para onde o jogador olha ao chegar no ponto padrão (rotação em Y). */
  spawnRot?: number;
  /** Outros pontos de chegada, por nome (ex.: `portao` na vila, um por marco no mapa). */
  entries?: Record<string, SpawnPoint>;
  /** Câmera da área (padrão: 3ª pessoa, THIRD_PERSON). */
  camera?: CameraStyle;
  /** Altura do terreno em (x, z); sem isso o chão é plano em y = 0. */
  ground?: (x: number, z: number) => number;
  /** Chamado quando o jogador já pode agir (depois da abertura ou do fade). */
  onEnter?: () => void;
  /** Libera o que a área criou por conta própria (assinaturas, texturas geradas). */
  dispose?: () => void;
  interactables: Interactable[];
  /** Objetos altos que devem ficar transparentes quando taparem o jogador. */
  occluders: THREE.Object3D[];
  /** Padrão: DARK_ENV. Pode ser alterado a cada quadro (a Floresta escurece com o avanço). */
  env?: AreaEnv;
  /** A tocha do jogador começa acesa? Padrão: sim. */
  torchLit?: boolean;
  /** Só para depuração (`?debug`): objetos da área expostos em `__dev.area.debug`. */
  debug?: Record<string, unknown>;
  update(dt: number, time: number, playerPos: THREE.Vector3): void;
}
