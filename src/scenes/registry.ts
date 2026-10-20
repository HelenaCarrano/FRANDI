import { urlParams } from '../core/quality';
import type { GameState } from '../core/gameState';
import type { Area, AreaContext, AreaId } from './types';

/**
 * Registro de áreas: o que cada uma precisa carregar, como criá-la e quando ela destrava.
 * O código de cada área só é baixado quando o jogador vai para ela (import dinâmico).
 * Uma área sem `load` ainda não foi construída: o mapa mostra "em preparação".
 */

export interface AreaModule {
  assets: readonly string[];
  create: (ctx: AreaContext) => Area;
}

interface AreaDef {
  load?: () => Promise<AreaModule>;
}

const DEFS: Record<AreaId, AreaDef> = {
  village: { load: async () => {
    const m = await import('./village');
    return { assets: m.VILLAGE_ASSETS, create: m.createVillage };
  } },
  map: {}, // o mapa é uma tela de pergaminho (ui/kingdomMap.ts), não uma área 3D
  forest: { load: async () => {
    const m = await import('./forest');
    return { assets: m.FOREST_ASSETS, create: m.createForest };
  } },
  visual: { load: async () => {
    const m = await import('./lookTest');
    return { assets: m.LOOK_TEST_ASSETS, create: m.createLookTest };
  } },
  ruins: { load: async () => {
    const m = await import('./ruins');
    return { assets: m.RUINS_ASSETS, create: m.createRuins };
  } },
  tower: {},
  tavern: {},
  vineyard: {},
  castle: {},
  ending: {},
};

const modules = new Map<AreaId, Promise<AreaModule>>();

/** Baixa (uma vez) o módulo da área. Falha se a área ainda não existe. */
export function loadArea(id: AreaId): Promise<AreaModule> {
  let p = modules.get(id);
  if (!p) {
    const def = DEFS[id];
    if (!def.load) return Promise.reject(new Error(`Área ainda não construída: ${id}`));
    p = def.load();
    modules.set(id, p);
  }
  return p;
}

/** Aceita qualquer texto (vem da URL e do save): id desconhecido simplesmente não está construído. */
export function isBuilt(id: string): id is AreaId {
  return !!(DEFS as Record<string, AreaDef | undefined>)[id]?.load;
}

/** As quatro áreas do meio, que abrem juntas depois da Floresta. */
export const MIDDLE_AREAS = ['ruins', 'tower', 'tavern', 'vineyard'] as const;

/** ?libera=tudo: mostra tudo destravado (só para conferir o visual; não grava nada). */
export const unlockAll = urlParams.get('libera') === 'tudo';

/** Marca gravada quando o jogador conclui uma área. */
export const doneFlag = (id: AreaId) => `done_${id}`;

/** A área já está aberta para o jogador? Semiaberto: Vila → Floresta → (4 do meio) → Castelo. */
export function isUnlocked(id: AreaId, game: GameState): boolean {
  if (unlockAll) return true;
  switch (id) {
    case 'village':
    case 'map':
    case 'visual':
      return true;
    case 'forest':
      return game.flag('villageDone');
    case 'ruins':
    case 'tower':
    case 'tavern':
    case 'vineyard':
      return game.flag(doneFlag('forest'));
    case 'castle':
      return MIDDLE_AREAS.every((a) => game.flag(doneFlag(a)));
    case 'ending':
      return game.flag(doneFlag('castle'));
  }
}
