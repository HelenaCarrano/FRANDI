import { audio } from '../core/audio';
import { content } from '../content';
import type { GameState } from '../core/gameState';
import { openKingdomMap } from '../ui/kingdomMap';
import type { UI } from '../ui/ui';
import { isUnlocked } from '../core/areas';
import type { Fx } from './fx';
import type { Hen } from './hen';
import type { Kit } from './kit';
import type { Player } from './player';
import type { Area2D, AreaId, Dir4 } from './types';

/**
 * Carrega, troca e descarta as áreas 2D. Mantém o que é do jogador (Matheus, galinha) e o move para a área nova.
 * Cada área é um módulo em ./areas/<id>.ts que exporta `create(ctx)`.
 */

export interface AreaContext {
  ui: UI;
  game: GameState;
  player: Player;
  kit: Kit;
  fx: Fx;
  hen: Hen;
  /** Ponto de chegada pedido a esta área (ex.: `portal`). */
  entry?: string;
  goTo: (id: AreaId, entry?: string) => Promise<void>;
  /** Abre o Mapa do Reino; se o jogador escolher outro lugar, viaja para lá. */
  openMap: () => Promise<void>;
  /** Move o jogador dentro da área e encaixa a câmera. A tela deve estar escura. */
  teleport: (x: number, y: number, dir?: Dir4) => void;
  /** A galinha companheira passa a seguir o Matheus a partir de (x, y). */
  summonHen: (x: number, y: number) => void;
  /** Ponto do mundo (px do jogo) -> pixels da janela, para balões de fala em HTML. */
  toScreen: (x: number, y: number) => { x: number; y: number };
}

type AreaModule = { create: (ctx: AreaContext) => Area2D };
const LOADERS: Partial<Record<AreaId, () => Promise<AreaModule>>> = {
  forest: () => import('./areas/forest'),
  village: () => import('./areas/village'),
  ruins: () => import('./areas/ruins'),
  tavern: () => import('./areas/tavern'),
  vineyard: () => import('./areas/vineyard'),
  farm: () => import('./areas/farm'),
  home: () => import('./areas/home'),
};

export const isBuilt = (id: string): id is AreaId => id in LOADERS;

export interface ManagerDeps {
  ui: UI;
  game: GameState;
  player: Player;
  kit: Kit;
  fx: Fx;
  hen: Hen;
  /** Câmera encaixa de uma vez (sem suavizar). */
  snapCamera: () => void;
  toScreen: (x: number, y: number) => { x: number; y: number };
}

export class SceneManager {
  area!: Area2D;
  id!: AreaId;
  /** Verdadeiro durante a troca: o jogador não anda nem interage. */
  busy = false;
  private mapOpen = false;

  constructor(private readonly d: ManagerDeps) {}

  private context(entry?: string): AreaContext {
    const { ui, game, player, kit, fx, hen } = this.d;
    return {
      ui,
      game,
      player,
      kit,
      fx,
      hen,
      entry,
      goTo: (id, to) => this.goTo(id, to),
      openMap: () => this.openMap(),
      teleport: (x, y, dir) => {
        player.place(x, y, dir ?? player.dir);
        this.d.snapCamera();
      },
      summonHen: (x, y) => {
        game.setFlag('henMet');
        hen.enter(this.area.collision, { x, y });
      },
      toScreen: this.d.toScreen,
    };
  }

  private async build(id: AreaId, entry?: string): Promise<Area2D> {
    const load = LOADERS[id];
    if (!load) throw new Error(`Área ainda não construída em 2D: ${id}`);
    const mod = await load();
    // deixa a tela de carregamento respirar antes do trabalho pesado de pintar o chão
    await new Promise((r) => setTimeout(r, 30));
    const area = mod.create(this.context(entry));
    return area;
  }

  async start(id: AreaId, entry?: string) {
    const area = await this.build(id, entry);
    this.activate(area, id, entry);
    return area;
  }

  async openMap() {
    const { ui, game } = this.d;
    if (this.busy || this.mapOpen || ui.inDialog) return;
    this.mapOpen = true;
    try {
      if (!game.flag('mapSeen')) {
        game.setFlag('mapSeen');
        await ui.tell(content.kingdomMap.firstOpen);
      }
      const dest = await openKingdomMap(ui, {
        game,
        current: this.id,
        isUnlocked: (id) => isUnlocked(id, game),
        isBuilt,
        names: content.areas,
      });
      if (dest && dest !== this.id) await this.goTo(dest, dest === 'village' ? 'gate' : dest === 'forest' && game.flag('done_forest') ? 'portal' : 'start');
    } finally {
      this.mapOpen = false;
    }
  }

  async goTo(id: AreaId, entry?: string) {
    if (this.busy) return;
    if (!isBuilt(id)) {
      this.d.ui.toast('Este lugar ainda está sendo redesenhado no novo estilo.');
      return;
    }
    this.busy = true;
    const { ui } = this.d;
    try {
      await ui.fade(true, content.areas[id]);
      const old = this.area;
      const next = await this.build(id, entry);
      this.activate(next, id, entry);
      old?.dispose?.();
      ui.showAreaTitle(next.name);
      await ui.fade(false);
      next.onEnter?.();
    } catch (err) {
      console.error(err);
      await ui.fade(false);
    } finally {
      this.busy = false;
    }
  }

  /** Coloca o jogador na área nova e liga luz, música e corações. */
  private activate(area: Area2D, id: AreaId, entry?: string) {
    const { player, game, ui, hen } = this.d;
    this.area = area;
    this.id = id;
    const spawn = (entry && area.entries[entry]) || area.entries.start;
    player.place(spawn.x, spawn.y, spawn.dir ?? 'down');
    player.torchOn = area.torchLit?.() ?? false;
    game.setArea(id, entry);
    audio.setScene(id);
    if (!area.combat) ui.setHearts(null);
    this.d.snapCamera();
    hen.enter(area.collision);
  }
}
