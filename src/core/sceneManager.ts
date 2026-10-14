import * as THREE from 'three';
import { isSharedResource, preload } from './assets';
import { OcclusionFader } from './occlusion';
import { DARK_ENV, type Area, type AreaContext, type AreaId } from '../scenes/types';
import { loadArea } from '../scenes/registry';
import type { GameRenderer } from './renderer';
import type { FollowCamera } from './followCamera';
import type { GameState } from './gameState';
import type { Player } from '../entities/player';
import type { UI } from '../ui/ui';
import type { QualitySettings } from './quality';

/**
 * Carrega, troca e descarta as áreas do jogo.
 * Mantém o que é do jogador (Matheus, tocha, luz de preenchimento) e o move para a cena nova.
 */

export interface SceneManagerDeps {
  ui: UI;
  game: GameState;
  player: Player;
  follow: FollowCamera;
  quality: QualitySettings;
  /** Distância normal da câmera, restaurada nas áreas que não pedem outra. */
  cameraDistance: number;
  /** Depuração (`?cam=`): mantém a distância pedida em vez da que a área prefere. */
  lockCamera?: boolean;
  /** Nome mostrado no escuro durante a viagem. */
  areaLabel: (id: AreaId) => string;
}

export class SceneManager {
  area!: Area;
  id!: AreaId;
  occlusion = new OcclusionFader();
  /** Verdadeiro durante a troca: o jogador não anda nem interage. */
  busy = false;
  readonly fillLight = new THREE.PointLight(0xffd2a8, 1.6, 5, 2);
  private gfx: GameRenderer | null = null;

  constructor(private readonly deps: SceneManagerDeps) {}

  /** Liga o renderizador (criado depois da primeira área). */
  attach(gfx: GameRenderer) {
    this.gfx = gfx;
  }

  private context(): AreaContext {
    const { ui, game, player, quality } = this.deps;
    return { ui, game, player, quality, goTo: (id, entry) => this.goTo(id, entry) };
  }

  /** Carrega os modelos e cria a área, ainda sem mostrá-la. */
  private async build(id: AreaId, onProgress?: (done: number, total: number) => void): Promise<Area> {
    const mod = await loadArea(id);
    await preload(mod.assets, onProgress);
    const area = mod.create(this.context());
    area.id = id;
    return area;
  }

  /** Primeira área do jogo (a abertura já cobre a tela, então não há fade). */
  async start(id: AreaId, entry?: string, onProgress?: (done: number, total: number) => void) {
    const area = await this.build(id, onProgress);
    this.activate(area, id, entry);
    return area;
  }

  /** Área avulsa (salão de testes `?area=teste`): não entra no save. */
  startCustom(area: Area) {
    this.activate(area, 'village', undefined, false);
    return area;
  }

  /** Viaja para outra área: escurece, troca, clareia. */
  async goTo(id: AreaId, entry?: string) {
    if (this.busy) return;
    this.busy = true;
    const { ui } = this.deps;
    try {
      await ui.fade(true, this.deps.areaLabel(id));
      const old = this.area;
      const oldOcclusion = this.occlusion;
      const next = await this.build(id);
      this.activate(next, id, entry);
      this.discard(old, oldOcclusion);
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

  /** Coloca o jogador na área nova e ajusta câmera, luz e clima gráfico. */
  private activate(area: Area, id: AreaId, entry?: string, save = true) {
    const { player, follow, game } = this.deps;
    this.area = area;
    this.id = id;

    const spawn = (entry && area.entries?.[entry]) || { x: area.spawn.x, z: area.spawn.z, rot: 0 };
    player.position.set(spawn.x, 0, spawn.z);
    player.face(spawn.rot);
    player.torch.setLit(area.torchLit ?? true);
    area.scene.add(player.object);
    area.scene.add(player.torch.sparks.points);

    this.fillLight.visible = area.torchLit ?? true;
    area.scene.add(this.fillLight);

    this.occlusion = new OcclusionFader();
    area.occluders.forEach((o) => this.occlusion.add(o));

    follow.setBaseDistance(this.deps.lockCamera ? this.deps.cameraDistance : (area.cameraDistance ?? this.deps.cameraDistance));
    follow.snapTo(player.position);

    if (this.gfx) {
      this.gfx.setScene(area.scene);
      this.gfx.applyEnv(area.env ?? DARK_ENV);
    }
    if (save) game.setArea(id, entry);
  }

  /**
   * Libera a área antiga. Os modelos clonados dividem geometria e material com o cache
   * (assets.ts), então só se descarta o que a área criou sozinha (partículas, gatinho, placas,
   * parreiras, mapas de sombra das luzes). Texturas geradas ficam por conta de `area.dispose`.
   */
  private discard(area: Area, occlusion: OcclusionFader) {
    area.dispose?.();
    occlusion.dispose();
    area.scene.traverse((o) => {
      if ((o as THREE.Light).isLight) (o as THREE.Light).dispose();
      const mesh = o as THREE.Mesh;
      if (!mesh.geometry) return;
      if (!isSharedResource(mesh.geometry)) mesh.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if (m && !isSharedResource(m)) m.dispose();
    });
    area.scene.clear();
  }
}
