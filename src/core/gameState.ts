/**
 * Estado do jogo + salvamento automático em localStorage.
 * Tudo que muda o progresso passa por aqui, e cada mudança é salva na hora.
 * A chave é versionada: se o formato mudar, aumente `v` e o save antigo é ignorado.
 */

export type QuestStatus = 'new' | 'active' | 'done';

export interface SaveData {
  v: 1;
  area: string;
  /** Ponto de chegada na área (ex.: `portao`); vazio = começo da área. */
  entry?: string;
  coins: number;
  /** id do item -> quantidade */
  items: Record<string, number>;
  quests: Record<string, QuestStatus>;
  /** Marcas de diálogo/progresso (ex.: carta lida, material já encontrado). */
  flags: Record<string, boolean>;
  /** Equipamentos visíveis no Matheus. */
  equipped: { sword: boolean; backpack: boolean };
}

import { audio } from './audio';

const KEY = 'aventura-matheus:v1';

function fresh(): SaveData {
  return { v: 1, area: 'forest', coins: 0, items: {}, quests: {}, flags: {}, equipped: { sword: false, backpack: false } };
}

function readStorage(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d?.v !== 1 || typeof d.coins !== 'number') return null;
    return { ...fresh(), ...d, equipped: { ...fresh().equipped, ...d.equipped } };
  } catch {
    return null;
  }
}

export class GameState {
  data: SaveData;
  private readonly listeners = new Set<() => void>();

  /** Existe progresso salvo para continuar? */
  static hasSave(): boolean {
    const d = readStorage();
    if (!d) return false;
    return d.coins > 0 || Object.keys(d.items).length > 0 || Object.keys(d.quests).length > 0 || Object.keys(d.flags).length > 0;
  }

  constructor(startFresh = false) {
    this.data = (!startFresh && readStorage()) || fresh();
    if (startFresh) this.commit();
  }

  /** Apaga o progresso e começa de novo. */
  reset() {
    this.data = fresh();
    this.commit();
  }

  /** Chamado a cada mudança (a interface se atualiza por aqui). Devolve a função que cancela a assinatura. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private commit() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* navegação privada ou sem espaço: o jogo segue sem salvar */
    }
    this.listeners.forEach((fn) => fn());
  }

  // ---------- moedas ----------
  get coins() {
    return this.data.coins;
  }
  addCoins(n: number) {
    this.data.coins += n;
    if (n > 0) audio.play('coin');
    this.commit();
  }
  /** Gasta moedas; devolve false (sem gastar) se não houver o bastante. */
  spend(n: number): boolean {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.commit();
    return true;
  }

  // ---------- itens ----------
  count(id: string) {
    return this.data.items[id] ?? 0;
  }
  has(id: string) {
    return this.count(id) > 0;
  }
  addItem(id: string, n = 1) {
    this.data.items[id] = this.count(id) + n;
    audio.play('pickup');
    this.commit();
  }
  removeItem(id: string, n = 1) {
    const left = this.count(id) - n;
    if (left > 0) this.data.items[id] = left;
    else delete this.data.items[id];
    this.commit();
  }

  // ---------- missões e marcas ----------
  quest(id: string): QuestStatus {
    return this.data.quests[id] ?? 'new';
  }
  setQuest(id: string, status: QuestStatus) {
    this.data.quests[id] = status;
    this.commit();
  }
  flag(name: string) {
    return !!this.data.flags[name];
  }
  setFlag(name: string, value = true) {
    this.data.flags[name] = value;
    this.commit();
  }

  setEquipped(part: Partial<SaveData['equipped']>) {
    Object.assign(this.data.equipped, part);
    this.commit();
  }
  setArea(id: string, entry?: string) {
    this.data.area = id;
    this.data.entry = entry;
    this.commit();
  }
  get area() {
    return this.data.area;
  }
  get entry() {
    return this.data.entry;
  }
}
