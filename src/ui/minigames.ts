import type { UI } from './ui';
import { audio } from '../core/audio';
import { itemArt } from './itemArt';

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
  /** Falas ao acertar, na ordem das marteladas (a última se repete se faltar). */
  hits: readonly string[];
  /** Quando o ferro esfria por erros demais. */
  cold?: string;
}

const FORGE_HITS = 5;
const FORGE_LIVES = 3;
/** Como o brilho se move em cada martelada: constante, ondulando, aos pulos, com a faixa andando, e rápido. */
const FORGE_PATTERNS = ['steady', 'wave', 'steady', 'drift', 'jump'] as const;

/** Cor do ferro conforme o calor (0 = frio, 1 = branco de quente). */
function ironColor(heat: number) {
  const k = Math.max(0, Math.min(1, heat));
  const stops: [number, number, number][] = [[86, 92, 108], [150, 70, 50], [220, 70, 30], [255, 150, 40], [255, 236, 170]];
  const f = k * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const t = f - i;
  const a = stops[i];
  const b = stops[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

/**
 * Forja: cinco marteladas. Um brilho vai e volta na barra de calor e é preciso bater quando ele passa pela faixa dourada.
 * A faixa encolhe e o brilho acelera a cada acerto, com um jeito diferente de se mover em cada martelada.
 * Errar esfria o ferro (perde uma martelada); com três erros o ferro esfria de vez e recomeça.
 */
export function playForge(ui: UI, text: ForgeText): Promise<void> {
  return ui.modal<void>('forge', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const scene = h('canvas', 'forge-canvas', box);
    scene.width = 220;
    scene.height = 112;
    const g = scene.getContext('2d')!;
    const bar = h('div', 'forge-bar', box);
    const zone = h('div', 'forge-zone', bar);
    const spark = h('div', 'forge-spark', bar);
    const hitsEl = h('div', 'forge-hits', box);
    const status = h('p', 'mg-status', box);
    const btn = h('button', 'btn primary forge-btn', box, text.button);

    let hits = 0;
    let lives = FORGE_LIVES;
    let pos = 0;
    let dir = 1;
    let zoneAt = 0.5;
    let zoneVel = 0;
    let width = 0.16;
    let alive = true;
    let last = performance.now();
    let lock = 0;
    let swing = -1; // 0..1: o martelo descendo
    let shake = 0;
    let heat = 0;
    let t = 0;
    const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    const speedNow = () => 0.9 + hits * 0.32;
    const newZone = () => {
      width = Math.max(0.07, 0.16 - hits * 0.022);
      zoneAt = 0.2 + Math.random() * 0.6;
      zoneVel = FORGE_PATTERNS[Math.min(hits, FORGE_HITS - 1)] === 'drift' ? (Math.random() < 0.5 ? -1 : 1) * 0.12 : 0;
      placeZone();
    };
    const placeZone = () => {
      zone.style.left = `${(zoneAt - width / 2) * 100}%`;
      zone.style.width = `${width * 100}%`;
    };
    const shoeArt = itemArt('ferradura');
    const drawHits = () => {
      hitsEl.replaceChildren();
      for (let i = 0; i < FORGE_HITS; i++) {
        const el = h('img', i < hits ? 'forge-shoe on' : 'forge-shoe', hitsEl);
        if (shoeArt) el.src = shoeArt;
        el.alt = '';
      }
      const lv = h('span', 'forge-lives', hitsEl, '🔥'.repeat(lives) + '▫️'.repeat(FORGE_LIVES - lives));
      lv.title = 'Chances antes do ferro esfriar';
    };
    newZone();
    drawHits();

    const burstSparks = (n: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.15 + Math.random() * 0.7);
        const s = 40 + Math.random() * 90;
        sparks.push({ x: 110, y: 66, vx: Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5 });
      }
    };

    const drawScene = (dt: number) => {
      t += dt;
      g.clearRect(0, 0, 220, 112);
      const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 4 * shake) : 0;
      g.save();
      g.translate(sx, 0);
      // fundo: parede de pedra e o brilho do fogo
      g.fillStyle = '#1c120e';
      g.fillRect(0, 0, 220, 112);
      const glow = g.createRadialGradient(110, 74, 6, 110, 74, 90);
      glow.addColorStop(0, `rgba(255,130,40,${0.25 + heat * 0.35})`);
      glow.addColorStop(1, 'rgba(255,130,40,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 220, 112);
      g.fillStyle = '#2a1c16';
      for (let y = 0; y < 112; y += 14) for (let x = (y / 14) % 2 ? 0 : 11; x < 220; x += 22) g.fillRect(x, y, 20, 12);
      // bigorna
      g.fillStyle = '#10101a';
      g.fillRect(70, 80, 80, 8);
      g.fillRect(86, 88, 48, 16);
      g.fillRect(78, 104, 64, 6);
      g.fillStyle = '#5a6478';
      g.fillRect(72, 78, 76, 6);
      g.fillRect(62, 74, 22, 5);
      g.fillStyle = '#8a94a8';
      g.fillRect(72, 78, 76, 2);
      g.fillRect(62, 74, 22, 2);
      // ferradura em cima da bigorna (cor pelo calor)
      g.fillStyle = ironColor(heat);
      g.fillRect(94, 70, 32, 6);
      g.fillRect(94, 64, 7, 8);
      g.fillRect(119, 64, 7, 8);
      g.fillRect(98, 58, 6, 8);
      g.fillRect(116, 58, 6, 8);
      g.fillStyle = '#10101a';
      g.fillRect(100, 66, 2, 2);
      g.fillRect(118, 66, 2, 2);
      g.fillRect(104, 71, 12, 3);
      // martelo: sobe parado, desce no golpe
      const k = swing >= 0 ? swing : 0;
      const ang = -1.1 + (swing >= 0 ? Math.sin(Math.min(1, k) * Math.PI * 0.5) * 1.1 : 0) + Math.sin(t * 2) * 0.03;
      g.save();
      g.translate(150, 54);
      g.rotate(ang);
      g.fillStyle = '#6a4424';
      g.fillRect(-2, -4, 4, 34);
      g.fillStyle = '#9a6a3c';
      g.fillRect(-2, -4, 1, 34);
      g.fillStyle = '#3a4254';
      g.fillRect(-12, -10, 24, 10);
      g.fillStyle = '#8a94a8';
      g.fillRect(-12, -10, 24, 3);
      g.restore();
      // faíscas
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 220 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        g.fillStyle = s.life > 0.3 ? '#ffe070' : '#ff7a2a';
        g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }
      g.restore();
    };

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pattern = FORGE_PATTERNS[Math.min(hits, FORGE_HITS - 1)];
      let sp = speedNow();
      if (pattern === 'wave') sp *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(t * 3.2));
      if (pattern === 'jump' && Math.random() < dt * 1.4) dir = -dir;
      pos += dir * sp * dt;
      if (pos > 1) {
        pos = 1;
        dir = -1;
      } else if (pos < 0) {
        pos = 0;
        dir = 1;
      }
      if (zoneVel !== 0) {
        zoneAt += zoneVel * dt;
        if (zoneAt < 0.2 || zoneAt > 0.8) zoneVel = -zoneVel;
        placeZone();
      }
      spark.style.left = `${pos * 100}%`;
      heat += ((hits / FORGE_HITS) * 0.7 + 0.25 - heat) * Math.min(1, dt * 3);
      if (swing >= 0) swing += dt * 5;
      if (swing > 1.4) swing = -1;
      if (shake > 0) shake = Math.max(0, shake - dt * 4);
      drawScene(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    const finish = () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
    };
    const strike = () => {
      if (!alive || performance.now() < lock) return;
      lock = performance.now() + 340;
      swing = 0;
      if (Math.abs(pos - zoneAt) <= width / 2) {
        status.textContent = text.hits[Math.min(hits, text.hits.length - 1)];
        audio.play('hammer');
        audio.play('clang');
        burstSparks(14);
        shake = 1;
        hits++;
        heat = Math.min(1, heat + 0.2);
        drawHits();
        if (hits >= FORGE_HITS) {
          finish();
          audio.play('sizzle');
          setTimeout(() => close(), 1200);
          return;
        }
        newZone();
      } else {
        audio.play('whoosh', 0.5);
        burstSparks(4);
        lives--;
        if (lives <= 0) {
          // o ferro esfriou de vez: recomeça do zero
          status.textContent = text.cold ?? 'O ferro esfriou! Vamos reaquecer e recomeçar.';
          audio.play('sizzle');
          hits = 0;
          lives = FORGE_LIVES;
          heat = 0;
        } else {
          status.textContent = text.misses[Math.floor(Math.random() * text.misses.length)];
          hits = Math.max(0, hits - 1);
        }
        drawHits();
        newZone();
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

/** Roda dentada em SVG: dentes trapezoidais, aro, raios vazados, cubo e uma marca amarela no alto. */
function gearSvg(teeth: number, tone: [string, string, string]) {
  const ro = 46;
  const ri = 38;
  const pitch = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch - Math.PI / 2;
    for (const [da, r] of [[-0.34, ri], [-0.2, ro], [0.2, ro], [0.34, ri]] as const) {
      pts.push(`${(Math.cos(a + da * pitch * 1.4) * r).toFixed(1)},${(Math.sin(a + da * pitch * 1.4) * r).toFixed(1)}`);
    }
  }
  let holes = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    holes += `<circle cx="${(Math.cos(a) * 22).toFixed(1)}" cy="${(Math.sin(a) * 22).toFixed(1)}" r="6.5" fill="#1c1208" stroke="${tone[2]}" stroke-width="1.5"/>`;
  }
  return `<svg viewBox="-50 -50 100 100"><g class="rot">
  <polygon class="body" points="${pts.join(' ')}" fill="${tone[0]}" stroke="#2a1a0a" stroke-width="2.5" stroke-linejoin="round"/>
  <circle r="31" fill="none" stroke="${tone[1]}" stroke-width="3" opacity="0.8"/>
  ${holes}
  <circle r="11" fill="${tone[1]}" stroke="#2a1a0a" stroke-width="2.5"/>
  <circle r="4.5" fill="#2a1c0e"/>
  <path d="M0 -44 l6 12 h-12z" fill="#ffe08a" stroke="#3a2610" stroke-width="1.5"/>
</g></svg>`;
}

const GEAR_TONES: [string, string, string][] = [
  ['#9a7230', '#c8a050', '#5a3e14'],
  ['#8a6a3c', '#b89060', '#4a3418'],
  ['#a47a34', '#d4aa5c', '#5e4216'],
];

/** Engrenagens do moinho: resolve quando as três marcas apontam para cima. Cada toque estala e arrasta a vizinha. */
export function playGears(ui: UI, text: GearsText): Promise<void> {
  return ui.modal<void>('gears-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const row = h('div', 'gears', box);
    h('p', 'gears-goal', box, text.goal);
    const status = h('p', 'mg-status', box);
    const foot = h('div', 'gears-foot', box);
    const counter = h('span', 'gears-count', foot, 'Giros: 0');
    const reset = h('button', 'btn gears-reset', foot, 'Embaralhar de novo');

    const N = 3;
    const state = [0, 0, 0];
    const tap = (k: number, s = state) => {
      s[k] = (s[k] + 1) % 4;
      const n = (k + 1) % N;
      s[n] = (s[n] + 3) % 4;
    };
    const turns = [0, 0, 0]; // giros acumulados (para a animação nunca voltar para trás)
    let moves = 0;
    const gears = [0, 1, 2].map((i) => {
      const b = h('button', 'gear', row);
      b.innerHTML = gearSvg([14, 12, 14][i], GEAR_TONES[i]);
      b.style.setProperty('--sz', ['6.4rem', '5.6rem', '6.4rem'][i]);
      return b;
    });
    const draw = () => gears.forEach((g, i) => (g.style.transform = `rotate(${turns[i] * 90}deg)`));
    const shuffle = () => {
      state.fill(0);
      do {
        for (let i = 0; i < 7 + Math.floor(Math.random() * 5); i++) tap(Math.floor(Math.random() * N));
      } while (state.every((v) => v === 0));
      state.forEach((v, i) => (turns[i] = v));
      moves = 0;
      counter.textContent = 'Giros: 0';
      draw();
    };
    shuffle();

    let done = false;
    gears.forEach((g, i) => {
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (done) return;
        tap(i);
        turns[i] += 1;
        turns[(i + 1) % N] -= 1;
        moves++;
        counter.textContent = `Giros: ${moves}`;
        audio.play('gear');
        setTimeout(() => audio.play('gear'), 90);
        g.classList.remove('kick');
        void g.offsetWidth;
        g.classList.add('kick');
        draw();
        const ok = state.every((v) => v === 0);
        gears.forEach((el) => el.classList.toggle('ok', ok));
        if (ok) {
          done = true;
          status.textContent = text.solved;
          setTimeout(() => {
            audio.play('gearLock');
            gears.forEach((el) => el.classList.add('spin'));
          }, 350);
          setTimeout(() => close(), 2000);
        }
      });
    });
    reset.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!done) {
        audio.play('gear');
        shuffle();
      }
    });
  });
}

export interface MillText {
  title: string;
  hint: string;
  done: string;
}

const MILL_TURNS = 8;

/**
 * Moer a farinha: gire a manivela da mó arrastando em círculo (ou aperte E/Espaço várias vezes).
 * `onSpeed` recebe 0..1 conforme a rapidez do giro, para o moinho lá fora acompanhar.
 */
export function playMilling(ui: UI, text: MillText, onSpeed: (v: number) => void): Promise<void> {
  return ui.modal<void>('mill-box', (box, close) => {
    h('h3', 'mg-title', box, text.title);
    h('p', 'mg-hint', box, text.hint);
    const cv = h('canvas', 'mill-canvas', box);
    cv.width = 220;
    cv.height = 150;
    const g = cv.getContext('2d')!;
    const meter = h('div', 'mill-meter', box);
    const fill = h('div', 'mill-fill', meter);
    const status = h('p', 'mg-status', box);

    const CX = 110;
    const CY = 92;
    const RX = 62;
    const RY = 26;
    let ang = 0; // ângulo da manivela
    let total = 0; // giros acumulados (em voltas)
    let speed = 0; // voltas por segundo, suavizado
    let alive = true;
    let last = performance.now();
    let grabbing: number | null = null;
    let lastA = 0;
    let lastBeat = 0;
    const grains: { x: number; y: number; v: number }[] = [];
    const dust: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    const addTurn = (da: number) => {
      const turn = Math.abs(da) / (Math.PI * 2);
      total += turn;
      ang += da;
      speed = speed * 0.8 + (turn / 0.016) * 0.2;
      while (Math.floor(total * 2) > lastBeat) {
        lastBeat++;
        audio.play('crank');
        audio.play('grind', 0.8);
        for (let i = 0; i < 3; i++) dust.push({ x: CX + (Math.random() - 0.5) * 80, y: CY + 8, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, life: 0.8 });
      }
    };
    const pointerAngle = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 220 - CX;
      const y = ((e.clientY - r.top) / r.height) * 150 - CY;
      return Math.atan2(y / (RY / RX), x);
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grabbing = e.pointerId;
      lastA = pointerAngle(e);
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (grabbing !== e.pointerId || !alive) return;
      const a = pointerAngle(e);
      let d = a - lastA;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      lastA = a;
      if (Math.abs(d) > 0.01 && Math.abs(d) < 1.2) addTurn(d);
    });
    const release = (e: PointerEvent) => {
      if (grabbing === e.pointerId) grabbing = null;
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    const onKey = (e: KeyboardEvent) => {
      if (ACTION_KEYS.has(e.code) && !e.repeat && alive) addTurn(Math.PI / 2);
    };
    window.addEventListener('keydown', onKey);

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speed *= Math.exp(-2.2 * dt);
      onSpeed(Math.min(1, speed / 1.6));
      if (speed > 0.15 && Math.random() < dt * 20) grains.push({ x: CX + (Math.random() - 0.5) * 16, y: 18, v: 0 });
      g.clearRect(0, 0, 220, 150);
      // fundo: tábuas do moinho
      g.fillStyle = '#2a1c12';
      g.fillRect(0, 0, 220, 150);
      g.fillStyle = '#34241a';
      for (let x = 0; x < 220; x += 22) g.fillRect(x, 0, 20, 150);
      // funil de trigo
      g.fillStyle = '#6a4424';
      g.beginPath();
      g.moveTo(CX - 26, 4);
      g.lineTo(CX + 26, 4);
      g.lineTo(CX + 6, 30);
      g.lineTo(CX - 6, 30);
      g.fill();
      g.fillStyle = '#e2c25a';
      g.fillRect(CX - 20, 6, 40, 6);
      // mó de baixo (sombra) e mó de cima girando
      g.fillStyle = '#4a4650';
      g.beginPath();
      g.ellipse(CX, CY + 8, RX + 4, RY + 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9a96a4';
      g.beginPath();
      g.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#6a6674';
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = ang * 0.9 + (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(CX + Math.cos(a) * 12, CY + Math.sin(a) * 12 * (RY / RX));
        g.lineTo(CX + Math.cos(a) * (RX - 4), CY + Math.sin(a) * (RX - 4) * (RY / RX));
        g.stroke();
      }
      g.fillStyle = '#6a6674';
      g.beginPath();
      g.ellipse(CX, CY, 10, 5, 0, 0, Math.PI * 2);
      g.fill();
      // farinha caindo pelas bordas e se acumulando
      g.fillStyle = '#f4eedc';
      g.beginPath();
      g.ellipse(CX, CY + 12, RX * (0.5 + 0.5 * Math.min(1, total / MILL_TURNS)), 6 + 4 * Math.min(1, total / MILL_TURNS), 0, 0, Math.PI);
      g.fill();
      // manivela
      const hx = CX + Math.cos(ang) * (RX - 6);
      const hy = CY + Math.sin(ang) * (RY - 2);
      g.strokeStyle = '#3a2410';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(CX, CY);
      g.lineTo(hx, hy);
      g.stroke();
      g.fillStyle = '#c8903c';
      g.beginPath();
      g.arc(hx, hy, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3a2410';
      g.lineWidth = 2;
      g.stroke();
      // grãos caindo e poeira branca
      for (let i = grains.length - 1; i >= 0; i--) {
        const gr = grains[i];
        gr.v += 220 * dt;
        gr.y += gr.v * dt;
        if (gr.y > CY - 4) {
          grains.splice(i, 1);
          continue;
        }
        g.fillStyle = '#e2c25a';
        g.fillRect(Math.round(gr.x), Math.round(gr.y), 2, 3);
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.life -= dt;
        if (d.life <= 0) {
          dust.splice(i, 1);
          continue;
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        g.fillStyle = `rgba(250,246,232,${d.life})`;
        g.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
      }
      fill.style.width = `${Math.min(100, (total / MILL_TURNS) * 100)}%`;
      if (total >= MILL_TURNS) {
        alive = false;
        window.removeEventListener('keydown', onKey);
        status.textContent = text.done;
        audio.play('pickup');
        onSpeed(0);
        setTimeout(() => close(), 1500);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
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
    const pool = h('div', 'plate-shelf sort-counter', box);
    const binsEl = h('div', 'sort-bins', box);
    const status = h('p', 'mg-status', box);
    const actions = h('div', 'plate-actions', box);
    const confirmBtn = h('button', 'btn primary', actions, text.confirm);

    const placed = new Map<string, string>();
    let done = false;
    const binEls = new Map<string, HTMLElement>();
    const byId = new Map(items.map((i) => [i.id, i]));

    // desenho em pixel art quando existe; senão cai no emoji
    const chipHtml = (i: SortItem) => {
      const art = itemArt(i.id);
      const pic = art ? `<img class="ing-art" src="${art}" alt="">` : `<span class="ing-icon">${i.icon}</span>`;
      return `${pic}<span class="ing-name">${i.name}</span>`;
    };

    const draw = () => {
      pool.replaceChildren();
      for (const b of bins) binEls.get(b.id)!.querySelector('.sort-items')!.replaceChildren();
      for (const it of items) {
        const bin = placed.get(it.id);
        const parent = bin ? binEls.get(bin)!.querySelector<HTMLElement>('.sort-items')! : pool;
        const chip = h('button', bin ? 'ingredient on-plate' : 'ingredient', parent);
        chip.classList.add('art');
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
          const ghost = h('div', 'ingredient art dragging', document.body);
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
      const el = h('div', `plate sort-bin bin-${b.id}`, binsEl);
      const title = h('div', 'sort-bin-title', el);
      const binArt = itemArt(b.id);
      if (binArt) {
        const img = h('img', 'bin-art', title);
        img.src = binArt;
        img.alt = '';
        h('span', '', title, b.name);
      } else title.textContent = `${b.icon} ${b.name}`;
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
