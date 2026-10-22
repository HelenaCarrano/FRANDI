import type { UI } from './ui';
import { audio } from '../core/audio';

/**
 * Minijogos em janelas HTML sobre o jogo. Nenhum trava o progresso: errar só gera uma fala e outra tentativa.
 *  - Forja: um brilho vai e volta numa barra; toque no momento em que ele passa pela faixa verde (3 acertos).
 *  - Engrenagens: três rodas; tocar numa gira ela e a vizinha ao contrário, até todas as marcas apontarem para cima.
 *  - Ordem das lembranças: toque nas cartas na ordem em que aconteceram (Castelo).
 *  - Anéis de símbolos: três discos de pedra com seis símbolos; tocar num gira ele e o vizinho ao contrário, até o ✦ ficar no alto de todos.
 */

const ACTION_KEYS = new Set(['KeyE', 'Space', 'Enter']);

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export interface ForgeText {
  title: string;
  hint: string;
  button: string;
  /** Falas ao errar (sorteadas). */
  misses: readonly string[];
  /** Falas ao acertar (1ª, 2ª e 3ª martelada). */
  hits: readonly [string, string, string];
}

/** Forja: resolve quando as 3 marteladas acertarem. */
export function playForge(ui: UI, text: ForgeText): Promise<void> {
  return ui.modal<void>('forge', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const bar = h('div', 'forge-bar', box);
    const zone = h('div', 'forge-zone', bar);
    const spark = h('div', 'forge-spark', bar);
    const hitsEl = h('div', 'forge-hits', box);
    const status = h('p', 'mg-status', box);
    const btn = h('button', 'btn primary forge-btn', box, text.button);

    let hits = 0;
    let pos = 0;
    let dir = 1;
    let speed = 0.85;
    let zoneAt = 0.5;
    const width = 0.2;
    let alive = true;
    let last = performance.now();
    let lock = 0;

    const newZone = () => {
      zoneAt = 0.2 + Math.random() * 0.6;
      zone.style.left = `${(zoneAt - width / 2) * 100}%`;
      zone.style.width = `${width * 100}%`;
    };
    const drawHits = () => (hitsEl.textContent = '🔨'.repeat(hits) + '▫️'.repeat(3 - hits));
    newZone();
    drawHits();

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos += dir * speed * dt;
      if (pos > 1) {
        pos = 1;
        dir = -1;
      } else if (pos < 0) {
        pos = 0;
        dir = 1;
      }
      spark.style.left = `${pos * 100}%`;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    const strike = () => {
      if (!alive || performance.now() < lock) return;
      lock = performance.now() + 380;
      if (Math.abs(pos - zoneAt) <= width / 2) {
        status.textContent = text.hits[Math.min(hits, 2)];
        audio.play('clang');
        hits++;
        speed += 0.18;
        drawHits();
        if (hits >= 3) {
          alive = false;
          window.removeEventListener('keydown', onKey);
          setTimeout(() => close(), 900);
          return;
        }
        newZone();
      } else {
        status.textContent = text.misses[Math.floor(Math.random() * text.misses.length)];
        audio.play('whoosh', 0.5);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (ACTION_KEYS.has(e.code) && !e.repeat) strike();
    };
    window.addEventListener('keydown', onKey);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      strike();
    });
  });
}

export interface GearsText {
  title: string;
  hint: string;
  goal: string;
  solved: string;
}

const GEAR_SVG = `<svg viewBox="-50 -50 100 100"><g class="rot">
  <path class="body" fill="#8d6a2e" stroke="#3a2610" stroke-width="2.5" d="M-8 -46 h16 l4 9 a38 38 0 0 1 10 4 l9 -4 l11 11 l-4 9 a38 38 0 0 1 4 10 l9 4 v16 l-9 4 a38 38 0 0 1 -4 10 l4 9 l-11 11 l-9 -4 a38 38 0 0 1 -10 4 l-4 9 h-16 l-4 -9 a38 38 0 0 1 -10 -4 l-9 4 l-11 -11 l4 -9 a38 38 0 0 1 -4 -10 l-9 -4 v-16 l9 -4 a38 38 0 0 1 4 -10 l-4 -9 l11 -11 l9 4 a38 38 0 0 1 10 -4z"/>
  <circle r="14" fill="#2a1c0e" stroke="#3a2610" stroke-width="2.5"/>
  <path d="M0 -36 l7 14 h-14z" fill="#ffe08a" stroke="#3a2610" stroke-width="1.5"/>
</g></svg>`;

/** Engrenagens do moinho: resolve quando as três marcas apontam para cima. */
export function playGears(ui: UI, text: GearsText): Promise<void> {
  return ui.modal<void>('gears-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const row = h('div', 'gears', box);
    h('p', 'gears-goal', box, text.goal);
    const status = h('p', 'mg-status', box);

    const N = 3;
    const state = [0, 0, 0];
    const tap = (k: number, s = state) => {
      s[k] = (s[k] + 1) % 4;
      const n = (k + 1) % N;
      s[n] = (s[n] + 3) % 4;
    };
    // embaralha a partir do estado resolvido: sempre tem solução
    do {
      for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) tap(Math.floor(Math.random() * N));
    } while (state.every((v) => v === 0));

    const turns = [0, 0, 0]; // giros acumulados (para a animação nunca voltar para trás)
    const gears = state.map((v, i) => {
      const b = h('button', 'gear', row);
      b.innerHTML = GEAR_SVG;
      turns[i] = v;
      return b;
    });
    const draw = () => gears.forEach((g, i) => (g.style.transform = `rotate(${turns[i] * 90}deg)`));
    draw();

    let done = false;
    gears.forEach((g, i) => {
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done) return;
        tap(i);
        turns[i] += 1;
        turns[(i + 1) % N] -= 1;
        draw();
        const ok = state.every((v) => v === 0);
        gears.forEach((el) => el.classList.toggle('ok', ok));
        if (ok) {
          done = true;
          status.textContent = text.solved;
          setTimeout(() => close(), 1400);
        }
      });
    });
  });
}

export interface PlatingIngredient {
  id: string;
  icon: string;
  name: string;
}

export interface PlatingText {
  title: string;
  hint: string;
  empty: string;
  serve: string;
  clear: string;
  missing: string;
  extra: string;
  emptyPlate: string;
}

/**
 * Montar o prato: arraste fichas da prateleira para o prato (mouse ou dedo); tocar numa ficha do prato a tira.
 * `check` diz se o prato servido está certo; errar só mostra a dica e deixa o jogador corrigir.
 * Resolve com os ids do prato certo.
 */
export function playPlating(
  ui: UI,
  text: PlatingText,
  shelf: readonly PlatingIngredient[],
  check: (plate: readonly string[]) => 'ok' | 'missing' | 'extra',
): Promise<string[]> {
  return ui.modal<string[]>('plating-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const shelfEl = h('div', 'plate-shelf', box);
    const plateEl = h('div', 'plate', box);
    const status = h('p', 'mg-status', box);
    const actions = h('div', 'plate-actions', box);
    const clearBtn = h('button', 'btn', actions, text.clear);
    const serveBtn = h('button', 'btn primary', actions, text.serve);

    const byId = new Map(shelf.map((s) => [s.id, s]));
    const plate: string[] = [];
    let done = false;

    const drawPlate = () => {
      plateEl.replaceChildren();
      if (!plate.length) {
        h('span', 'plate-empty', plateEl, text.empty);
        return;
      }
      plate.forEach((id, i) => {
        const chip = h('button', 'ingredient on-plate', plateEl);
        chip.innerHTML = `<span class="ing-icon">${byId.get(id)!.icon}</span><span class="ing-name">${byId.get(id)!.name}</span>`;
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          plate.splice(i, 1);
          status.textContent = '';
          drawPlate();
        });
      });
    };
    drawPlate();

    shelf.forEach((ing) => {
      const chip = h('button', 'ingredient', shelfEl);
      chip.innerHTML = `<span class="ing-icon">${ing.icon}</span><span class="ing-name">${ing.name}</span>`;
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done) return;
        const ghost = h('div', 'ingredient dragging', document.body);
        ghost.innerHTML = chip.innerHTML;
        const move = (x: number, y: number) => {
          ghost.style.left = `${x}px`;
          ghost.style.top = `${y}px`;
        };
        move(e.clientX, e.clientY);
        const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
        const end = (ev: PointerEvent) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
          ghost.remove();
          const r = plateEl.getBoundingClientRect();
          const over = ev.type === 'pointerup' && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
          if (over && !plate.includes(ing.id)) {
            plate.push(ing.id);
            status.textContent = '';
            drawPlate();
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
      });
    });

    clearBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      plate.length = 0;
      status.textContent = '';
      drawPlate();
    });
    serveBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      if (!plate.length) {
        status.textContent = text.emptyPlate;
        return;
      }
      const result = check(plate);
      if (result === 'ok') {
        done = true;
        plateEl.classList.add('ok');
        setTimeout(() => close([...plate]), 900);
      } else {
        status.textContent = result === 'missing' ? text.missing : text.extra;
      }
    });
  });
}

export interface SortingText {
  title: string;
  hint: string;
  confirm: string;
  incomplete: string;
  /** Texto com {n} = quantos itens estavam no cesto errado. */
  wrong: string;
}
export interface SortItem {
  id: string;
  icon: string;
  name: string;
  /** Cesto certo. */
  bin: string;
}
export interface SortBin {
  id: string;
  icon: string;
  name: string;
}

/**
 * Separar a encomenda: arraste cada item para o cesto certo; tocar num item já guardado o devolve à bancada.
 * Ao conferir, os que estão no cesto errado voltam para a bancada e a fala diz quantos eram.
 */
export function playSorting(ui: UI, text: SortingText, items: readonly SortItem[], bins: readonly SortBin[]): Promise<void> {
  return ui.modal<void>('plating-box sorting-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const pool = h('div', 'plate-shelf', box);
    const binsEl = h('div', 'sort-bins', box);
    const status = h('p', 'mg-status', box);
    const actions = h('div', 'plate-actions', box);
    const confirmBtn = h('button', 'btn primary', actions, text.confirm);

    const placed = new Map<string, string>();
    let done = false;
    const binEls = new Map<string, HTMLElement>();
    const byId = new Map(items.map((i) => [i.id, i]));

    const chipHtml = (i: SortItem) => `<span class="ing-icon">${i.icon}</span><span class="ing-name">${i.name}</span>`;

    const draw = () => {
      pool.replaceChildren();
      for (const b of bins) binEls.get(b.id)!.querySelector('.sort-items')!.replaceChildren();
      for (const it of items) {
        const bin = placed.get(it.id);
        const parent = bin ? binEls.get(bin)!.querySelector<HTMLElement>('.sort-items')! : pool;
        const chip = h('button', bin ? 'ingredient on-plate' : 'ingredient', parent);
        chip.innerHTML = chipHtml(it);
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          if (bin) {
            placed.delete(it.id);
            status.textContent = '';
            draw();
            return;
          }
          const ghost = h('div', 'ingredient dragging', document.body);
          ghost.innerHTML = chipHtml(byId.get(it.id)!);
          const move = (x: number, y: number) => {
            ghost.style.left = `${x}px`;
            ghost.style.top = `${y}px`;
          };
          move(e.clientX, e.clientY);
          const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
          const end = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            ghost.remove();
            if (ev.type !== 'pointerup') return;
            for (const [id, el] of binEls) {
              const r = el.getBoundingClientRect();
              if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
                placed.set(it.id, id);
                status.textContent = '';
                draw();
                return;
              }
            }
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', end);
          window.addEventListener('pointercancel', end);
        });
      }
    };

    for (const b of bins) {
      const el = h('div', 'plate sort-bin', binsEl);
      h('div', 'sort-bin-title', el, `${b.icon} ${b.name}`);
      h('div', 'sort-items', el);
      binEls.set(b.id, el);
    }
    draw();

    confirmBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      if (placed.size < items.length) {
        status.textContent = text.incomplete;
        return;
      }
      const wrong = items.filter((i) => placed.get(i.id) !== i.bin);
      if (!wrong.length) {
        done = true;
        binsEl.classList.add('ok');
        setTimeout(() => close(), 900);
        return;
      }
      for (const w of wrong) placed.delete(w.id);
      status.textContent = text.wrong.replace('{n}', String(wrong.length));
      draw();
    });
  });
}

export interface RunesText {
  title: string;
  hint: string;
  goal: string;
  solved: string;
}

const RUNE_GLYPHS = ['✦', '☾', '☀', '❖', '✿', '⚔'];

/** Anéis do altar: resolve quando o primeiro símbolo (✦) fica no alto dos três discos. */
export function playRunes(ui: UI, text: RunesText): Promise<void> {
  return ui.modal<void>('runes-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const row = h('div', 'runes', box);
    h('p', 'gears-goal', box, text.goal);
    const status = h('p', 'mg-status', box);

    const N = 3;
    const STEPS = RUNE_GLYPHS.length;
    const state = [0, 0, 0];
    const tap = (k: number) => {
      state[k] = (state[k] + 1) % STEPS;
      const n = (k + 1) % N;
      state[n] = (state[n] + STEPS - 1) % STEPS;
    };
    // embaralha a partir do estado resolvido: sempre tem solução
    do {
      for (let i = 0; i < 7 + Math.floor(Math.random() * 5); i++) tap(Math.floor(Math.random() * N));
    } while (state.every((v) => v === 0));

    const turns = [...state]; // giros acumulados (para a animação nunca voltar para trás)
    const dials = state.map(() => {
      const d = h('button', 'rune-dial', row);
      h('span', 'rune-notch', d, '▼');
      const disc = h('div', 'rune-disc', d);
      RUNE_GLYPHS.forEach((g, i) => {
        const s = h('span', 'rune-glyph', disc, g);
        s.style.transform = `rotate(${i * (360 / STEPS)}deg) translateY(-2.05rem)`;
      });
      return { d, disc };
    });
    const draw = () => dials.forEach(({ disc }, i) => (disc.style.transform = `rotate(${turns[i] * (360 / STEPS)}deg)`));
    draw();

    let done = false;
    dials.forEach(({ d }, i) => {
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done) return;
        tap(i);
        turns[i] += 1;
        turns[(i + 1) % N] -= 1;
        draw();
        const ok = state.every((v) => v === 0);
        dials.forEach(({ d: el }) => el.classList.toggle('ok', ok));
        if (ok) {
          done = true;
          status.textContent = text.solved;
          setTimeout(() => close(), 1400);
        }
      });
    });
  });
}

export type BlendAxis = 'doce' | 'acido' | 'corpo';
const BLEND_AXES: readonly BlendAxis[] = ['doce', 'acido', 'corpo'];
const BLEND_SCALE = 3;

export interface BlendGrape extends Record<BlendAxis, number> {
  id: string;
  icon: string;
  name: string;
}

export interface BlendText {
  title: string;
  hint: string;
  empty: string;
  taste: string;
  clear: string;
  emptyBarrel: string;
  labels: Record<BlendAxis, string>;
  high: Record<BlendAxis, string>;
  low: Record<BlendAxis, string>;
  ok: string;
}

/**
 * Lagar: toque nas uvas para pôr cachos no barril (até `max`). As três barras mostram a média de doçura, acidez e corpo;
 * "Provar" só aceita quando as três estão dentro da faixa de `targets`. Errar mostra qual barra passou ou faltou.
 */
export function playBlend(
  ui: UI,
  text: BlendText,
  grapes: readonly BlendGrape[],
  targets: Record<BlendAxis, readonly [number, number]>,
  max = 6,
): Promise<void> {
  return ui.modal<void>('blend-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const shelfEl = h('div', 'plate-shelf', box);
    const barrelEl = h('div', 'plate blend-barrel', box);
    const bars = h('div', 'blend-bars', box);
    const status = h('p', 'mg-status', box);
    const actions = h('div', 'plate-actions', box);
    const clearBtn = h('button', 'btn', actions, text.clear);
    const tasteBtn = h('button', 'btn primary', actions, text.taste);

    const byId = new Map(grapes.map((g) => [g.id, g]));
    const barrel: string[] = [];
    let done = false;

    const fills = {} as Record<BlendAxis, HTMLElement>;
    for (const axis of BLEND_AXES) {
      const row = h('div', 'blend-row', bars);
      h('span', 'blend-label', row, text.labels[axis]);
      const track = h('div', 'blend-track', row);
      const [lo, hi] = targets[axis];
      const zone = h('div', 'blend-target', track);
      zone.style.left = `${(lo / BLEND_SCALE) * 100}%`;
      zone.style.width = `${((hi - lo) / BLEND_SCALE) * 100}%`;
      fills[axis] = h('div', 'blend-fill', track);
    }

    const average = (axis: BlendAxis) => (barrel.length ? barrel.reduce((sum, id) => sum + byId.get(id)![axis], 0) / barrel.length : 0);
    const inRange = (axis: BlendAxis) => {
      const v = average(axis);
      return v >= targets[axis][0] && v <= targets[axis][1];
    };

    const draw = () => {
      barrelEl.replaceChildren();
      if (!barrel.length) h('span', 'plate-empty', barrelEl, text.empty);
      barrel.forEach((id, i) => {
        const g = byId.get(id)!;
        const chip = h('button', 'ingredient on-plate', barrelEl);
        chip.innerHTML = `<span class="ing-icon">${g.icon}</span><span class="ing-name">${g.name}</span>`;
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          barrel.splice(i, 1);
          status.textContent = '';
          draw();
        });
      });
      for (const axis of BLEND_AXES) {
        fills[axis].style.width = `${(average(axis) / BLEND_SCALE) * 100}%`;
        fills[axis].classList.toggle('good', barrel.length > 0 && inRange(axis));
      }
    };
    draw();

    grapes.forEach((g) => {
      const chip = h('button', 'ingredient', shelfEl);
      chip.innerHTML = `<span class="ing-icon">${g.icon}</span><span class="ing-name">${g.name}</span>`;
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done || barrel.length >= max) return;
        barrel.push(g.id);
        status.textContent = '';
        draw();
      });
    });

    clearBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      barrel.length = 0;
      status.textContent = '';
      draw();
    });
    tasteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      if (!barrel.length) {
        status.textContent = text.emptyBarrel;
        return;
      }
      const off = BLEND_AXES.find((axis) => !inRange(axis));
      if (off) {
        status.textContent = average(off) > targets[off][1] ? text.high[off] : text.low[off];
        return;
      }
      done = true;
      barrelEl.classList.add('ok');
      status.textContent = text.ok;
      setTimeout(() => close(), 1200);
    });
  });
}

export interface OrderCard {
  id: string;
  icon: string;
  name: string;
}

export interface OrderText {
  title: string;
  hint: string;
  empty: string;
  confirm: string;
  clear: string;
  incomplete: string;
  /** Usa {n} para quantas estão no lugar certo. */
  wrong: string;
}

/**
 * Ordenar lembranças (Castelo): toque nas cartas na ordem certa; tocar numa carta já escolhida a tira.
 * Errar só diz quantas estão no lugar certo e deixa tentar de novo. Resolve quando a ordem bate com `correct`.
 */
export function playMemoryOrder(ui: UI, text: OrderText, cards: readonly OrderCard[], correct: readonly string[]): Promise<void> {
  return ui.modal<void>('plating-box order-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const shelfEl = h('div', 'plate-shelf', box);
    const plateEl = h('div', 'plate', box);
    const status = h('p', 'mg-status', box);
    const actions = h('div', 'plate-actions', box);
    const clearBtn = h('button', 'btn', actions, text.clear);
    const confirmBtn = h('button', 'btn primary', actions, text.confirm);

    const byId = new Map(cards.map((c) => [c.id, c]));
    const picked: string[] = [];
    let done = false;

    const draw = () => {
      shelfEl.replaceChildren();
      for (const card of cards) {
        if (picked.includes(card.id)) continue;
        const chip = h('button', 'ingredient', shelfEl);
        chip.innerHTML = `<span class="ing-icon">${card.icon}</span><span class="ing-name">${card.name}</span>`;
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          picked.push(card.id);
          status.textContent = '';
          draw();
        });
      }
      plateEl.replaceChildren();
      if (!picked.length) h('span', 'plate-empty', plateEl, text.empty);
      picked.forEach((id, i) => {
        const card = byId.get(id)!;
        const chip = h('button', 'ingredient on-plate', plateEl);
        chip.innerHTML = `<span class="ing-icon">${card.icon}</span><span class="ing-name">${i + 1}. ${card.name}</span>`;
        chip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          picked.splice(i, 1);
          status.textContent = '';
          draw();
        });
      });
    };
    draw();

    clearBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      picked.length = 0;
      status.textContent = '';
      draw();
    });
    confirmBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      if (picked.length < correct.length) {
        status.textContent = text.incomplete;
        return;
      }
      const hits = correct.filter((id, i) => picked[i] === id).length;
      if (hits === correct.length) {
        done = true;
        plateEl.classList.add('ok');
        setTimeout(() => close(), 900);
      } else {
        status.textContent = text.wrong.replace('{n}', String(hits));
      }
    });
  });
}
