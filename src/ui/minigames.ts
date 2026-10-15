import type { UI } from './ui';

/**
 * Minijogos em janelas HTML sobre o jogo. Nenhum trava o progresso: errar só gera uma fala e outra tentativa.
 *  - Forja: um brilho vai e volta numa barra; toque no momento em que ele passa pela faixa verde (3 acertos).
 *  - Engrenagens: três rodas; tocar numa gira ela e a vizinha ao contrário, até todas as marcas apontarem para cima.
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
