import * as THREE from 'three';
import { isSharedResource, preload } from './assets';
import { OcclusionFader } from './occlusion';
import { DARK_ENV, THIRD_PERSON, type Area, type AreaContext, type AreaId, type CameraStyle } from '../scenes/types';
import { isBuilt, isUnlocked, loadArea } from '../scenes/registry';
import { openKingdomMap } from '../ui/kingdomMap';
import { content } from '../content';
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
  /** Depuração (`?cam=distância,elevação`): mantém esses valores em vez dos que a área prefere. */
  cameraOverride?: { distance: number; pitch?: number };
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
    return { ui, game, player, quality, camera: this.deps.follow.camera, goTo: (id, entry) => this.goTo(id, entry), openMap: () => this.openMap() };
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

  /** Abre o pergaminho; se o jogador escolher outro lugar, viaja para lá. */
  async openMap() {
    const { ui, game } = this.deps;
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
      if (dest && dest !== this.id) await this.goTo(dest, dest === 'village' ? 'gate' : 'start');
    } finally {
      this.mapOpen = false;
    }
  }
  private mapOpen = false;

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

    const spawn = (entry && area.entries?.[entry]) || { x: area.spawn.x, z: area.spawn.z, rot: area.spawnRot ?? 0 };
    player.position.set(spawn.x, 0, spawn.z);
    player.face(spawn.rot);
    player.torch.setLit(area.torchLit ?? true);
    area.scene.add(player.object);
    area.scene.add(player.torch.sparks.points);

    this.fillLight.visible = area.torchLit ?? true;
    area.scene.add(this.fillLight);

    this.occlusion = new OcclusionFader();
    area.occluders.forEach((o) => this.occlusion.add(o));

    const style: CameraStyle = { ...(area.camera ?? THIRD_PERSON) };
    const o = this.deps.cameraOverride;
    if (o) {
      style.distance = o.distance;
      if (o.pitch !== undefined) style.pitch = o.pitch;
    }
    follow.setStyle(style);
    follow.world = area.world;
    follow.ground = area.ground ?? (() => 0);
    player.ground = follow.ground;
    player.position.y = follow.ground(player.position.x, player.position.z);
    follow.snapTo(player.position, player.facing);

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
