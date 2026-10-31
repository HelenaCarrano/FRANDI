import { audio } from '../core/audio';
import { dishCanvas } from './dish';
import type { UI } from './ui';

/**
 * Cozinha da taverna, no estilo dos jogos de cozinhar (Papa's, Cooking Mama): o cliente espera com a comanda e a
 * paciência cai aos poucos; os ingredientes saem da despensa para a estação certa e só então vão ao prato.
 *  - Tábua: três cortes no ritmo (toque quando o marcador passa pela faixa).
 *  - Chapa: dois lados; vire e tire no ponto verde, antes de queimar.
 *  - Torradeira: tire no ponto verde.
 * Nada trava o progresso: errar só deixa o prato pior (menos gorjeta) ou joga o ingrediente fora.
 */

export interface KitchenIngredient {
  id: string;
  icon: string;
  name: string;
}

export interface KitchenText {
  title: string;
  hint: string;
  empty: string;
  serve: string;
  clear: string;
  missing: string;
  extra: string;
  emptyPlate: string;
  ticket: string;
  pantry: string;
  extras: string;
  patience: string;
  stations: { chop: string; grill: string; toast: string };
  cut: string;
  flip: string;
  take: string;
  raw: string;
  tooLate: string;
  burnt: string;
  busy: string;
  already: string;
  perfect: string;
  good: string;
  miss: string;
  done: string;
  tipLabel: string;
}

export interface KitchenTicket {
  who: string;
  /** Rostinho do cliente. */
  avatar: string;
  lines: readonly string[];
}

export interface KitchenResult {
  ids: string[];
  /** Qualidade do prato de 0 a 1 (precisão no preparo e paciência do cliente). */
  score: number;
  /** 1 a 3 estrelas. */
  stars: 1 | 2 | 3;
}

type Prep = 'chop' | 'grill' | 'toast' | 'raw';
type Station = 'chop' | 'grill' | 'toast';

/** Como cada ingrediente é preparado: cortado na tábua, grelhado na chapa, torrado, ou direto para o prato. */
const PREP: Record<string, Prep> = {
  alface: 'chop',
  tomate: 'chop',
  cebola: 'chop',
  cenoura: 'chop',
  batata: 'chop',
  cogumelo: 'chop',
  queijo: 'chop',
  carne: 'grill',
  peixe: 'grill',
  ovo: 'grill',
  pao: 'toast',
  pao_quente: 'toast',
};
const PREP_BADGE: Record<Prep, string> = { chop: '✂️', grill: '🔥', toast: '♨️', raw: '' };

const CUTS = 3;
const CUT_SPEED = 0.85;
const CUT_ZONE = 0.15;
const CUT_PERFECT = 0.05;
const HEAT_RATE = { grill: 0.3, toast: 0.5 } as const;
const HEAT_MAX = 1.4;
const HEAT_FROM = 0.75;
const HEAT_TO = 1.12;
const HEAT_MID = (HEAT_FROM + HEAT_TO) / 2;
/** Segundos até o cliente ficar sem paciência (só reduz a gorjeta). */
const PATIENCE_SECONDS = 100;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

interface Job {
  ing: KitchenIngredient;
  cuts: number;
  heat: number;
  side: 0 | 1;
  t: number;
  zone: number;
  marks: number[];
}

export function playKitchen(
  ui: UI,
  text: KitchenText,
  pantry: readonly KitchenIngredient[],
  extras: readonly KitchenIngredient[],
  check: (plate: readonly string[]) => 'ok' | 'missing' | 'extra',
  ticket?: KitchenTicket,
): Promise<KitchenResult> {
  return ui.modal<KitchenResult>('kitchen-box', (box, close) => {
    const byId = new Map([...pantry, ...extras].map((s) => [s.id, s]));

    // ---------- cena ----------
    const top = h('div', 'k-top', box);
    const cust = h('div', 'k-customer', top);
    const face = h('div', 'k-avatar', cust, ticket?.avatar ?? '🙂');
    const mood = h('div', 'k-mood', cust, '😀');
    h('div', 'k-who', cust, ticket?.who ?? '');
    const bubble = h('div', 'k-bubble', top);
    h('div', 'k-bubble-title', bubble, `📋 ${text.ticket}`);
    for (const line of ticket?.lines ?? []) h('p', 'k-bubble-line', bubble, line);
    const pat = h('div', 'k-patience', top);
    h('div', 'k-patience-label', pat, text.patience);
    const patBar = h('div', 'k-patience-bar', pat);
    const patFill = h('div', 'k-patience-fill', patBar);

    h('p', 'k-hint', box, text.hint);

    const stage = h('div', 'k-stage', box);
    const work: Record<Station, Job | null> = { chop: null, grill: null, toast: null };
    const ui_ = {} as Record<Station, { root: HTMLElement; item: HTMLElement; marks: HTMLElement; track: HTMLElement; zone: HTMLElement; needle: HTMLElement; btn: HTMLButtonElement; steam: HTMLElement }>;
    for (const key of ['chop', 'grill', 'toast'] as Station[]) {
      const root = h('div', `k-station k-${key}`, stage);
      h('div', 'k-station-name', root, text.stations[key]);
      const app = h('div', 'k-appliance', root);
      const steam = h('div', 'k-steam', app);
      const item = h('div', 'k-item', app);
      const marks = h('div', 'k-marks', root);
      const track = h('div', 'k-track', root);
      const zone = h('div', 'k-zone', track);
      const needle = h('div', 'k-needle', track);
      const btn = h('button', 'k-btn', root, key === 'chop' ? text.cut : text.take);
      ui_[key] = { root, item, marks, track, zone, needle, btn, steam };
    }

    const bottom = h('div', 'k-bottom', box);
    const shelves = h('div', 'k-shelves', bottom);
    const shelfA = h('div', 'k-shelf', shelves);
    h('div', 'k-shelf-name', shelfA, text.pantry);
    const rowA = h('div', 'k-shelf-row', shelfA);
    let rowB: HTMLElement | null = null;
    if (extras.length) {
      const shelfB = h('div', 'k-shelf k-extras', shelves);
      h('div', 'k-shelf-name', shelfB, text.extras);
      rowB = h('div', 'k-shelf-row', shelfB);
    }
    const plateZone = h('div', 'k-plate-zone', bottom);
    const plateEl = h('div', 'k-plate', plateZone);
    const dishWrap = h('div', 'k-dish', plateEl);
    const chips = h('div', 'k-chips', plateEl);
    const status = h('p', 'k-status', box);
    const actions = h('div', 'k-actions', box);
    const clearBtn = h('button', 'k-btn k-trash', actions, `🗑️ ${text.clear}`);
    const serveBtn = h('button', 'k-btn k-serve', actions, `🔔 ${text.serve}`);
    const tipEl = h('div', 'k-tip', actions);

    // ---------- estado ----------
    const plate: { id: string; q: number }[] = [];
    let done = false;
    let alive = true;
    let patience = 1;
    let last = performance.now();

    const say = (msg: string, kind: 'info' | 'good' | 'bad' = 'info') => {
      status.textContent = msg;
      status.className = `k-status ${kind}`;
    };
    const pop = (target: HTMLElement, msg: string, kind: 'good' | 'ok' | 'bad') => {
      const p = h('div', `k-pop ${kind}`, target, msg);
      setTimeout(() => p.remove(), 900);
    };
    const quality = (dist: number, half: number) => Math.max(0.25, 1 - dist / half);

    const drawPlate = () => {
      dishWrap.replaceChildren();
      const c = dishCanvas(plate.map((p) => p.id), 3);
      c.className = 'k-dish-img';
      dishWrap.appendChild(c);
      chips.replaceChildren();
      if (!plate.length) h('span', 'k-plate-empty', chips, text.empty);
      plate.forEach((p, i) => {
        const ing = byId.get(p.id)!;
        const chip = h('button', 'k-chip', chips);
        chip.textContent = ing.icon;
        chip.title = ing.name;
        const badge = PREP_BADGE[PREP[p.id] ?? 'raw'];
        if (badge) h('span', 'k-chip-badge', chip, badge);
        chip.classList.toggle('gold', p.q >= 0.8);
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          plate.splice(i, 1);
          say('');
          drawPlate();
        });
      });
    };
    const toPlate = (ing: KitchenIngredient, q: number) => {
      plate.push({ id: ing.id, q });
      say('');
      audio.play('pickup', 0.7);
      drawPlate();
      plateEl.classList.remove('bump');
      void plateEl.offsetWidth;
      plateEl.classList.add('bump');
    };
    const inWork = (id: string) => (Object.values(work) as (Job | null)[]).some((j) => j?.ing.id === id);

    // ---------- estações ----------
    const renderStation = (key: Station) => {
      const j = work[key];
      const s = ui_[key];
      s.root.classList.toggle('busy', !!j);
      s.root.classList.remove('ready');
      s.item.textContent = j ? j.ing.icon : '';
      s.item.classList.toggle('flipped', !!j && j.side === 1);
      s.item.classList.remove('burnt');
      s.btn.disabled = !j;
      s.btn.textContent = key === 'chop' ? text.cut : key === 'grill' && j && j.side === 0 ? text.flip : text.take;
      s.marks.replaceChildren();
      if (key === 'chop') for (let i = 0; i < CUTS; i++) h('span', i < (j?.marks.length ?? 0) ? `k-mark m${Math.round(j!.marks[i] * 2)}` : 'k-mark', s.marks);
      s.track.style.visibility = j ? 'visible' : 'hidden';
      if (j && key === 'chop') {
        s.zone.style.left = `${(j.zone - CUT_ZONE) * 100}%`;
        s.zone.style.width = `${CUT_ZONE * 200}%`;
      } else {
        s.zone.style.left = `${(HEAT_FROM / HEAT_MAX) * 100}%`;
        s.zone.style.width = `${((HEAT_TO - HEAT_FROM) / HEAT_MAX) * 100}%`;
      }
    };
    (['chop', 'grill', 'toast'] as Station[]).forEach(renderStation);

    const startJob = (key: Station, ing: KitchenIngredient) => {
      work[key] = { ing, cuts: 0, heat: 0, side: 0, t: 0, zone: 0.3 + Math.random() * 0.4, marks: [] };
      say('');
      audio.play('pickup', 0.5);
      renderStation(key);
    };

    const chop = () => {
      const j = work.chop;
      if (!j || done) return;
      const p = Math.abs(((j.t * CUT_SPEED) % 2) - 1);
      const d = Math.abs(p - j.zone);
      let q: number;
      if (d <= CUT_PERFECT) {
        q = 1;
        pop(ui_.chop.root, text.perfect, 'good');
      } else if (d <= CUT_ZONE) {
        q = 0.65;
        pop(ui_.chop.root, text.good, 'ok');
      } else {
        q = 0.25;
        pop(ui_.chop.root, text.miss, 'bad');
      }
      j.marks.push(q);
      j.zone = 0.2 + Math.random() * 0.6;
      audio.play('hit', 0.4);
      ui_.chop.item.classList.remove('whack');
      void ui_.chop.item.offsetWidth;
      ui_.chop.item.classList.add('whack');
      if (j.marks.length >= CUTS) {
        work.chop = null;
        toPlate(j.ing, j.marks.reduce((a, b) => a + b, 0) / CUTS);
      }
      renderStation('chop');
    };

    const tap = (key: 'grill' | 'toast') => {
      const j = work[key];
      if (!j || done) return;
      if (j.heat < HEAT_FROM) {
        say(text.raw, 'bad');
        return;
      }
      if (j.heat > HEAT_TO) {
        work[key] = null;
        renderStation(key);
        say(text.tooLate, 'bad');
        audio.play('hurt', 0.4);
        return;
      }
      const q = quality(Math.abs(j.heat - HEAT_MID), (HEAT_TO - HEAT_FROM) / 2);
      pop(ui_[key].root, q >= 0.8 ? text.perfect : text.good, q >= 0.8 ? 'good' : 'ok');
      j.marks.push(q);
      if (key === 'grill' && j.side === 0) {
        // vira o lado: já está quente, falta o outro lado
        j.side = 1;
        j.heat = 0.3;
        audio.play('pickup', 0.6);
        renderStation(key);
        return;
      }
      work[key] = null;
      renderStation(key);
      toPlate(j.ing, j.marks.reduce((a, b) => a + b, 0) / j.marks.length);
    };

    const press = (el: HTMLElement, fn: () => void) =>
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
    press(ui_.chop.btn, chop);
    press(ui_.chop.item, chop);
    for (const key of ['grill', 'toast'] as const) {
      press(ui_[key].btn, () => tap(key));
      press(ui_[key].item, () => tap(key));
    }

    // ---------- despensa ----------
    const addShelf = (row: HTMLElement, list: readonly KitchenIngredient[]) => {
      for (const ing of list) {
        const tile = h('button', 'k-tile', row);
        h('span', 'k-tile-icon', tile, ing.icon);
        h('span', 'k-tile-name', tile, ing.name);
        press(tile, () => {
          if (done) return;
          if (plate.some((p) => p.id === ing.id) || inWork(ing.id)) {
            say(text.already, 'bad');
            return;
          }
          const kind = PREP[ing.id] ?? 'raw';
          if (kind === 'raw') {
            toPlate(ing, 1);
            return;
          }
          if (work[kind]) {
            say(text.busy, 'bad');
            const r = ui_[kind].root;
            r.classList.remove('shake');
            void r.offsetWidth;
            r.classList.add('shake');
            return;
          }
          startJob(kind, ing);
        });
      }
    };
    addShelf(rowA, pantry);
    if (rowB) addShelf(rowB, extras);
    drawPlate();

    // ---------- relógio ----------
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!done) {
        patience = Math.max(0, patience - dt / PATIENCE_SECONDS);
        patFill.style.width = `${patience * 100}%`;
        patFill.className = `k-patience-fill ${patience > 0.6 ? 'hi' : patience > 0.3 ? 'mid' : 'lo'}`;
        mood.textContent = patience > 0.6 ? '😀' : patience > 0.3 ? '😐' : '😠';
      }
      const c = work.chop;
      if (c) {
        c.t += dt;
        ui_.chop.needle.style.left = `${Math.abs(((c.t * CUT_SPEED) % 2) - 1) * 100}%`;
      }
      for (const key of ['grill', 'toast'] as const) {
        const j = work[key];
        if (!j) continue;
        j.heat += HEAT_RATE[key] * dt;
        const s = ui_[key];
        s.needle.style.left = `${Math.min(1, j.heat / HEAT_MAX) * 100}%`;
        const ok = j.heat >= HEAT_FROM && j.heat <= HEAT_TO;
        s.root.classList.toggle('ready', ok);
        s.item.classList.toggle('burnt', j.heat > HEAT_TO);
        s.steam.classList.toggle('on', j.heat > 0.4);
        if (j.heat >= HEAT_MAX) {
          work[key] = null;
          renderStation(key);
          say(text.burnt, 'bad');
          audio.play('hurt', 0.4);
        }
      }
      for (const key of ['grill', 'toast'] as const) if (!work[key]) ui_[key].steam.classList.remove('on');
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    // ---------- servir ----------
    press(clearBtn, () => {
      if (done) return;
      plate.length = 0;
      say('');
      drawPlate();
    });
    press(serveBtn, () => {
      if (done) return;
      if (!plate.length) {
        say(text.emptyPlate, 'bad');
        return;
      }
      const ids = plate.map((p) => p.id);
      const result = check(ids);
      if (result !== 'ok') {
        say(result === 'missing' ? text.missing : text.extra, 'bad');
        return;
      }
      done = true;
      const prep = plate.reduce((a, p) => a + p.q, 0) / plate.length;
      const score = Math.max(0, Math.min(1, prep * (0.6 + 0.4 * patience)));
      const stars = score >= 0.8 ? 3 : score >= 0.55 ? 2 : 1;
      plateEl.classList.add('ok');
      face.classList.add('happy');
      mood.textContent = stars === 3 ? '😍' : '😋';
      say(text.done, 'good');
      tipEl.textContent = `${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
      tipEl.classList.add('show');
      audio.play('coin', 0.9);
      setTimeout(() => {
        alive = false;
        close({ ids, score, stars: stars as 1 | 2 | 3 });
      }, 1700);
    });
  });
}
