import type { RGB, TreeSprite } from './art';
import type { Collision } from './collision';
import type { CombatSystem } from './combat';

export type { AreaId } from '../scenes/types';
import type { AreaId } from '../scenes/types';

/** Algo desenhado em ordem de profundidade (quanto maior `y`, mais à frente). */
export interface Drawable {
  y: number;
  /** Desenha em pixels do jogo; (cx, cy) é o canto de cima à esquerda da câmera. */
  draw(v: CanvasRenderingContext2D, cx: number, cy: number, t: number): void;
  /** Sombra no chão (opcional), desenhada antes de todos os objetos. */
  shadow?(v: CanvasRenderingContext2D, cx: number, cy: number): void;
}

export interface Light {
  x: number;
  y: number;
  r: number;
  col: RGB;
  a: number;
  /** Luz mágica/fria: o brilho somado por cima é mais forte. */
  night?: boolean;
}

export type Dir4 = 'up' | 'down' | 'left' | 'right';

export type PropKind = 'tree' | 'rock' | 'bush' | 'mushroom' | 'stump' | 'grass' | 'lantern' | 'camp' | 'reed' | 'stone' | 'sign' | 'fern' | 'custom';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  tree?: TreeSprite;
  img?: HTMLCanvasElement;
  phase?: number;
  glow?: boolean;
  /** Para `custom`: desenha a si mesmo (sx, sy já na tela). */
  draw?: (v: CanvasRenderingContext2D, sx: number, sy: number, t: number) => void;
  /** Para `custom`: luz que ele emite. */
  light?: (t: number, dark: number) => Light | null;
}

/** Algo com que o jogador pode interagir ao chegar perto (botão de ação / tecla E). */
export interface Interactable {
  x: number;
  y: number;
  radius: number;
  prompt: string | (() => string);
  onInteract: () => void;
  enabled?: () => boolean;
  /** Mostra uma estrelinha brilhante em cima dele enquanto isto devolver true. */
  mark?: () => boolean;
}

/** Luz e clima de uma área (a área pode mudar isso a cada quadro). */
export interface Env {
  amb: RGB;
  /** 0 = dia claro, 1 = noite: controla tocha, brilhos e vagalumes. */
  dark: number;
  shaft: number;
  shaftCol: RGB;
  grade: RGB;
  gradeA: number;
  mist: number;
  /** Manchas de folhas passando no chão (0 em ambientes fechados). */
  dapple: number;
  /** Galhos retorcidos nos cantos de cima da tela. */
  overhang: boolean;
  /** Vinheta mais forte em lugares fechados. */
  vignette: number;
}

export interface Entry {
  x: number;
  y: number;
  dir?: Dir4;
}

export interface Area2D {
  id: AreaId;
  name: string;
  w: number;
  h: number;
  ground: HTMLCanvasElement;
  props: Prop[];
  collision: Collision;
  entries: Record<string, Entry>;
  interactables: Interactable[];
  env: Env;
  combat?: CombatSystem;
  /** A tocha do jogador está acesa nesta área agora? */
  torchLit?: () => boolean;
  /** O ponto (x, y) é trilha? (poeira clara dos passos) */
  isPath?: (x: number, y: number) => boolean;
  /** Coisas que mudam a cada quadro (NPCs, brilhos, espíritos...). */
  drawables?: (out: Drawable[], cx: number, cy: number, t: number) => void;
  /** Por cima do chão, antes das sombras (anéis mágicos, ondas na água). */
  drawGround?: (v: CanvasRenderingContext2D, cx: number, cy: number, t: number) => void;
  /** Por cima de tudo na cena (partículas de portal, névoa de combate). */
  drawTop?: (v: CanvasRenderingContext2D, cx: number, cy: number, t: number) => void;
  /** Brilhos somados na tela depois da iluminação; `s` é o tamanho de cada pixel do jogo. */
  drawAdditive?: (g: CanvasRenderingContext2D, cx: number, cy: number, s: number, t: number) => void;
  /** Luzes extras a cada quadro (além das dos props). */
  lights?: (out: Light[], t: number) => void;
  update(dt: number, t: number, player: { x: number; y: number }): void;
  onEnter?: () => void;
  dispose?: () => void;
  /** Só para depuração. */
  debug?: Record<string, unknown>;
}
