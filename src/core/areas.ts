import { urlParams } from './quality';
import type { GameState } from './gameState';

/** Identificadores das áreas (também gravados no save). */
export type AreaId = 'village' | 'map' | 'forest' | 'ruins' | 'tavern' | 'vineyard' | 'castle' | 'ending' | 'visual';

/** As três áreas do meio, que abrem juntas depois que o Matheus sai da Vila. */
export const MIDDLE_AREAS = ['ruins', 'tavern', 'vineyard'] as const;

/** ?libera=tudo: mostra tudo destravado (só para conferir o visual; não grava nada). */
export const unlockAll = urlParams.get('libera') === 'tudo';

/** Marca gravada quando o jogador conclui uma área. */
export const doneFlag = (id: AreaId) => `done_${id}`;

/** A área já está aberta para o jogador? Floresta (começo) → Vila → (3 do meio) → Castelo. */
export function isUnlocked(id: AreaId, game: GameState): boolean {
  if (unlockAll) return true;
  switch (id) {
    case 'forest':
    case 'map':
    case 'visual':
      return true;
    case 'village':
      return game.flag(doneFlag('forest')) || game.flag('villageDone');
    case 'ruins':
    case 'tavern':
    case 'vineyard':
      return game.flag('villageDone');
    case 'castle':
      return MIDDLE_AREAS.every((a) => game.flag(doneFlag(a)));
    case 'ending':
      return game.flag(doneFlag('castle'));
  }
}
