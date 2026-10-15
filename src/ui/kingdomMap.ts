import { content, fmt } from '../content';
import type { GameState } from '../core/gameState';
import type { AreaId } from '../scenes/types';
import type { UI } from './ui';

/**
 * O Mapa do Reino: um pergaminho desenhado a tinta (SVG). As áreas fechadas ficam sob nuvens pintadas;
 * quando uma abre, a nuvem some e o caminho "aparece a tinta". Tocar num lugar mostra um cartão com o botão
 * de viajar; ao viajar, um cavalinho percorre a estrada desenhada e a tela escurece (quem chama faz a troca).
 */

type PlaceId = Exclude<AreaId, 'map' | 'ending' | 'visual'>;
const PLACES: PlaceId[] = ['village', 'forest', 'ruins', 'tower', 'tavern', 'vineyard', 'castle'];

const POS: Record<PlaceId, [number, number]> = {
  village: [500, 598],
  forest: [500, 452],
  ruins: [185, 345],
  tower: [815, 345],
  tavern: [300, 192],
  vineyard: [700, 192],
  castle: [500, 122],
};
const HUB: [number, number] = [500, 372];

/** Pontos de cada estrada, saindo do cruzamento (e, para a vila, saindo da floresta). */
const ROAD: Record<Exclude<PlaceId, 'village'> | 'village', [number, number][]> = {
  forest: [HUB, [491, 410], POS.forest],
  village: [POS.forest, [512, 520], POS.village],
  ruins: [HUB, [402, 376], [300, 330], POS.ruins],
  tower: [HUB, [598, 376], [700, 330], POS.tower],
  tavern: [HUB, [440, 305], [362, 240], POS.tavern],
  vineyard: [HUB, [560, 305], [638, 240], POS.vineyard],
  castle: [HUB, [506, 296], [494, 210], POS.castle],
};

/** Do cruzamento até o lugar (a vila passa pela floresta). */
function chain(id: PlaceId): [number, number][] {
  if (id === 'village') return [...ROAD.forest, ...ROAD.village.slice(1)];
  return ROAD[id];
}
function route(from: PlaceId, to: PlaceId): [number, number][] {
  const a = chain(from).slice().reverse();
  const b = chain(to);
  return [...a, ...b.slice(1)];
}

function smooth(pts: readonly [number, number][]): string {
  if (pts.length < 3) return 'M' + pts.map((p) => p.join(' ')).join(' L');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// ---------- desenhos dos lugares (cantos arredondados, traço de tinta) ----------
const ICON: Record<PlaceId, string> = {
  village: `<path d="M-54 22 v-30 l18 -16 l18 16 v30z"/><path d="M-12 22 v-40 l22 -20 l22 20 v40z"/><path d="M34 22 v-26 l15 -13 l15 13 v26z"/><path d="M-1 22 v-14 h10 v14" class="door"/><path d="M-30 22 v-9 h8 v9" class="door"/>`,
  forest: `<path d="M-52 24 l22 -50 l22 50z"/><path d="M-22 28 l24 -62 l24 62z"/><path d="M14 22 l20 -44 l20 44z"/><path d="M-4 28 v10 M-32 24 v8 M34 22 v8" class="trunk"/>`,
  ruins: `<path d="M-56 26 v-44 h14 v44z"/><path d="M-22 26 v-62 l7 -6 l7 8 v60z"/><path d="M14 26 v-30 l10 -7 v37z"/><path d="M40 26 v-20 h14 v20z"/><path d="M-62 26 h124" class="ground"/>`,
  tower: `<path d="M-22 30 v-88 h44 v88z"/><path d="M-30 -58 h60 l-30 -34z"/><path d="M-8 30 v-22 h16 v22" class="door"/><path d="M-6 -30 h12 v16 h-12z" class="door"/>`,
  tavern: `<path d="M-52 26 v-40 l52 -28 l52 28 v40z"/><path d="M-12 26 v-24 h24 v24" class="door"/><path d="M-40 -2 h16 v14 h-16z" class="door"/><path d="M26 -2 h16 v14 h-16z" class="door"/><path d="M34 -52 v-16 h12 v22" class="trunk"/>`,
  vineyard: `<path d="M-56 24 h112 M-56 4 h112 M-56 -16 h112" class="ground"/><circle cx="-40" cy="14" r="6"/><circle cx="-18" cy="14" r="6"/><circle cx="6" cy="14" r="6"/><circle cx="30" cy="14" r="6"/><circle cx="-30" cy="-6" r="6"/><circle cx="-6" cy="-6" r="6"/><circle cx="18" cy="-6" r="6"/><circle cx="42" cy="-6" r="6"/><path d="M-56 -30 v54 M56 -30 v54" class="trunk"/>`,
  castle: `<path d="M-60 30 v-60 h20 v-14 h12 v14 h16 v-30 l14 -14 l14 14 v30 h16 v-14 h12 v14 h20 v60z"/><path d="M-12 30 v-26 q12 -16 24 0 v26" class="door"/><path d="M0 -74 v-26 l22 8 l-22 8" class="flag"/>`,
};

/** Cantinhos rabiscados do pergaminho: montanhas, pinheiros, ondas, uma galinha e um cavalinho. */
const DOODLES = `
  <g class="doodle">
    <path d="M60 140 l40 -70 l30 44 l24 -30 l46 56z"/><path d="M130 114 l12 -16 l9 12" />
    <path d="M840 150 l42 -76 l32 48 l24 -32 l40 60z"/><path d="M886 76 l-10 18 l12 4"/>
    <path d="M70 470 l16 -34 l16 34z M96 480 l14 -30 l14 30z M52 496 l12 -26 l12 26z"/>
    <path d="M880 500 l16 -34 l16 34z M906 512 l14 -30 l14 30z M860 520 l12 -26 l12 26z"/>
    <path d="M40 660 q16 -14 32 0 t32 0 t32 0 M60 684 q16 -14 32 0 t32 0"/>
    <path d="M760 668 q14 -12 28 0 t28 0 t28 0"/>
    <path d="M590 620 q-4 -14 8 -16 q12 -2 14 8 q6 -4 12 2 l-4 8 q-6 12 -22 10 q-10 -2 -8 -12z M610 604 l4 -8 l4 6" />
    <path d="M388 636 q10 -14 26 -10 q10 -10 22 -4 q8 8 -2 14 l-4 14 m-14 -4 l-2 14 m-14 -8 l0 14 m-14 -10 l-4 12 m52 -34 l8 -4"/>
  </g>`;

function compass(x: number, y: number) {
  return `<g class="doodle" transform="translate(${x} ${y})"><circle r="40" fill="none"/><path d="M0 -52 l8 44 l44 8 l-44 8 l-8 44 l-8 -44 l-44 -8 l44 -8z" class="star"/><text y="-60" text-anchor="middle" class="compass-n">N</text></g>`;
}

const CLOUD = `<g class="cloud-shape"><ellipse cx="-34" cy="8" rx="46" ry="26"/><ellipse cx="6" cy="-8" rx="52" ry="34"/><ellipse cx="46" cy="10" rx="44" ry="24"/><ellipse cx="0" cy="22" rx="70" ry="20"/></g>`;

export interface MapOptions {
  game: GameState;
  /** A área em que o Matheus está agora. */
  current: AreaId;
  isUnlocked: (id: AreaId) => boolean;
  isBuilt: (id: AreaId) => boolean;
  /** Nome mostrado de cada área. */
  names: Record<AreaId, string>;
}

const T = content.kingdomMap;
const NS = 'http://www.w3.org/2000/svg';

const doneOf = (id: PlaceId, game: GameState) => (id === 'village' ? game.flag('villageDone') : game.flag(`done_${id}`));

/** Abre o mapa; resolve com a área escolhida para viajar (ou null se fechou). */
export function openKingdomMap(ui: UI, o: MapOptions): Promise<AreaId | null> {
  return ui.modal<AreaId | null>('kingdom', (box, close) => {
    const { game } = o;
    const finish = (v: AreaId | null) => {
      window.removeEventListener('keydown', onKey);
      close(v);
    };
    const cur: PlaceId = (PLACES as string[]).includes(o.current) ? (o.current as PlaceId) : 'village';

    const head = document.createElement('div');
    head.className = 'map-head';
    head.innerHTML = `<h3 class="map-title">${T.title}</h3>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn map-close';
    closeBtn.textContent = '✕';
    closeBtn.title = T.close;
    head.appendChild(closeBtn);
    box.appendChild(head);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 720');
    svg.setAttribute('class', 'map-svg');
    const roads = PLACES.map((id) => `<path id="road-${id}" class="road" data-for="${id}" d="${smooth(ROAD[id])}"/>`).join('');
    const places = PLACES.map((id) => {
      const [x, y] = POS[id];
      const big = id === 'castle' ? 1.25 : 1;
      return `<g class="place" data-id="${id}" transform="translate(${x} ${y}) scale(${big})">
        <g class="icon">${ICON[id]}</g>
        <text class="place-name" y="${id === 'tower' ? 56 : 62}" text-anchor="middle">${o.names[id]}</text>
        <g class="cloud ${id === 'castle' ? 'dark' : ''}" transform="translate(0 -6) scale(${id === 'castle' ? 1.35 : 1.25})">${CLOUD}</g>
        <g class="done-mark"><circle r="15" cx="52" cy="-42"/><path d="M45 -42 l5 6 l10 -12"/></g>
      </g>`;
    }).join('');
    svg.innerHTML = `
      <defs>
        <radialGradient id="parch" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f1e1b4"/><stop offset="0.7" stop-color="#dcc088"/><stop offset="1" stop-color="#b38b4f"/></radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.05  0 0 0 0.35 0"/></filter>
        <filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="3"/></filter>
      </defs>
      <rect width="1000" height="720" rx="26" fill="url(#parch)"/>
      <rect width="1000" height="720" rx="26" filter="url(#grain)"/>
      <rect x="18" y="18" width="964" height="684" rx="18" fill="none" class="frame"/>
      <rect x="30" y="30" width="940" height="660" rx="12" fill="none" class="frame thin"/>
      <g filter="url(#wobble)">${DOODLES}${compass(900, 610)}</g>
      <g class="roads" filter="url(#wobble)">${roads}</g>
      <circle class="hub" cx="${HUB[0]}" cy="${HUB[1]}" r="9"/>
      <g class="places" filter="url(#wobble)">${places}</g>
      <g class="pin" style="display:none"><circle r="19"/><text y="8" text-anchor="middle">🐴</text></g>`;
    box.appendChild(svg);

    const card = document.createElement('div');
    card.className = 'map-card';
    box.appendChild(card);

    const place = (id: PlaceId) => svg.querySelector<SVGGElement>(`.place[data-id="${id}"]`)!;
    const roadEl = (id: PlaceId) => svg.querySelector<SVGPathElement>(`#road-${id}`)!;
    const pin = svg.querySelector<SVGGElement>('.pin')!;
    const status = (id: PlaceId) => ({ open: o.isUnlocked(id), done: doneOf(id, game), built: o.isBuilt(id), here: id === cur });

    // estado inicial: o que já foi visto aparece aberto; o que acabou de abrir começa sob nuvem e se revela logo depois
    const toReveal: PlaceId[] = [];
    for (const id of PLACES) {
      const s = status(id);
      const seen = id === 'village' || game.flag(`seen_${id}`);
      if (s.open && !seen) toReveal.push(id);
      const open = s.open && seen;
      place(id).classList.toggle('open', open);
      roadEl(id).classList.toggle('open', open);
      place(id).classList.toggle('done', s.done);
      place(id).classList.toggle('here', s.here);
      if (id === 'village') roadEl(id).classList.toggle('open', s.open);
    }
    const [px, py] = POS[cur];
    pin.setAttribute('transform', `translate(${px + 40} ${py - 58})`);
    pin.style.display = '';

    let traveling = false;

    const lockedText = (id: PlaceId) => (id === 'forest' ? T.locked.forest : id === 'castle' ? T.locked.castle : T.locked.middle);

    const showCard = (id: PlaceId) => {
      svg.querySelectorAll('.place').forEach((p) => p.classList.toggle('selected', p === place(id)));
      const s = status(id);
      card.replaceChildren();
      const name = document.createElement('div');
      name.className = 'map-card-name';
      name.textContent = o.names[id];
      card.appendChild(name);
      const text = document.createElement('div');
      text.className = 'map-card-text';
      const btn = document.createElement('button');
      btn.className = 'btn primary map-go';
      if (!s.open) text.textContent = lockedText(id);
      else if (s.here) text.textContent = T.here;
      else if (!s.built) text.textContent = T.preparing;
      else {
        text.textContent = s.done ? T.done : '';
        btn.textContent = fmt(T.travel, { name: o.names[id] });
        btn.addEventListener('click', () => travel(id));
      }
      card.appendChild(text);
      if (btn.textContent) card.appendChild(btn);
      card.classList.add('show');
    };

    svg.querySelectorAll<SVGGElement>('.place').forEach((g) => {
      g.addEventListener('click', () => {
        if (!traveling) showCard(g.dataset.id as PlaceId);
      });
    });

    // viagem: o cavalinho percorre a estrada desenhada
    const travel = (dest: PlaceId) => {
      if (traveling) return;
      traveling = true;
      card.classList.remove('show');
      const pts = route(cur, dest);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', smooth(pts));
      path.setAttribute('class', 'trail');
      svg.querySelector('.roads')!.appendChild(path);
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      const dur = 1400 + len * 2.2;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = path.getPointAtLength(len * e);
        pin.setAttribute('transform', `translate(${p.x} ${p.y - 6})`);
        path.style.strokeDashoffset = `${len * (1 - e)}`;
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => finish(dest), 350);
      };
      requestAnimationFrame(step);
    };

    closeBtn.addEventListener('click', () => !traveling && finish(null));
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Escape' || e.code === 'KeyM') && !traveling) finish(null);
    };
    window.addEventListener('keydown', onKey);

    // revela o que acabou de abrir: a nuvem some e o caminho aparece a tinta
    if (toReveal.length) {
      setTimeout(() => {
        for (const id of toReveal) {
          place(id).classList.add('open', 'revealing');
          roadEl(id).classList.add('open', 'revealing');
          game.setFlag(`seen_${id}`);
          ui.toast(fmt(T.newPath, { name: o.names[id] }));
        }
      }, 900);
    }
    showCard(cur);
  });
}

/** Primeira vez que o mapa é aberto: algumas linhas para situar. */
export const mapIntroLines = T.firstOpen;
