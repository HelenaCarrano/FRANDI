import { content, fmt } from '../content';
import type { GameState } from '../core/gameState';
import type { AreaId } from '../core/areas';
import type { UI } from './ui';

/**
 * O Mapa do Reino: um pergaminho desenhado a tinta (SVG). As áreas fechadas ficam sob nuvens pintadas;
 * quando uma abre, a nuvem some e o caminho "aparece a tinta". Tocar num lugar mostra um cartão com o botão
 * de viajar; ao viajar, um cavalinho percorre a estrada desenhada e a tela escurece (quem chama faz a troca).
 */

type PlaceId = Exclude<AreaId, 'map' | 'home' | 'visual'>;
const PLACES: PlaceId[] = ['village', 'forest', 'ruins', 'tavern', 'vineyard', 'farm'];

const POS: Record<PlaceId, [number, number]> = {
  forest: [430, 592],
  village: [500, 478],
  ruins: [185, 345],
  tavern: [300, 192],
  vineyard: [700, 192],
  farm: [500, 122],
};
const HUB: [number, number] = [500, 372];
/** Etapa da jornada mostrada em cada lugar: 1 começo, 2 vila, 3 os lugares do meio (em qualquer ordem), 4 a fazenda (voltar para casa). */
const STEP: Record<PlaceId, number> = { forest: 1, village: 2, ruins: 3, tavern: 3, vineyard: 3, farm: 4 };

/** Pontos de cada estrada, saindo do cruzamento (e, para a floresta, saindo da vila: a jornada começa lá embaixo). */
const ROAD: Record<PlaceId, [number, number][]> = {
  village: [HUB, [497, 425], POS.village],
  forest: [POS.village, [492, 530], [462, 566], POS.forest],
  ruins: [HUB, [402, 376], [300, 330], POS.ruins],
  tavern: [HUB, [440, 305], [362, 240], POS.tavern],
  vineyard: [HUB, [560, 305], [638, 240], POS.vineyard],
  farm: [HUB, [506, 296], [494, 210], POS.farm],
};

/** Do cruzamento até o lugar (a floresta, lá no começo da jornada, passa pela vila). */
function chain(id: PlaceId): [number, number][] {
  if (id === 'forest') return [...ROAD.village, ...ROAD.forest.slice(1)];
  return ROAD[id];
}
/** Caminho entre dois lugares sem voltar pelo que as duas estradas têm em comum. */
function route(from: PlaceId, to: PlaceId): [number, number][] {
  const a = chain(from);
  const b = chain(to);
  let k = 0;
  while (k < a.length && k < b.length && a[k][0] === b[k][0] && a[k][1] === b[k][1]) k++;
  return [...a.slice(k - 1).reverse(), ...b.slice(k)];
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
  tavern: `<path d="M-52 26 v-40 l52 -28 l52 28 v40z"/><path d="M-12 26 v-24 h24 v24" class="door"/><path d="M-40 -2 h16 v14 h-16z" class="door"/><path d="M26 -2 h16 v14 h-16z" class="door"/><path d="M34 -52 v-16 h12 v22" class="trunk"/>`,
  vineyard: `<path d="M-56 24 h112 M-56 4 h112 M-56 -16 h112" class="ground"/><circle cx="-40" cy="14" r="6"/><circle cx="-18" cy="14" r="6"/><circle cx="6" cy="14" r="6"/><circle cx="30" cy="14" r="6"/><circle cx="-30" cy="-6" r="6"/><circle cx="-6" cy="-6" r="6"/><circle cx="18" cy="-6" r="6"/><circle cx="42" cy="-6" r="6"/><path d="M-56 -30 v54 M56 -30 v54" class="trunk"/>`,
  farm: `<path d="M-58 24 v-34 l30 -26 l30 26 v34z"/><path d="M-14 24 v-16 h14 v16" class="door"/><path d="M-46 -2 h12 v12 h-12z" class="door"/><path d="M-4 -2 h0" class="door"/><path d="M12 24 v-46 l26 -22 l26 22 v46z"/><path d="M28 24 v-18 h20 v18" class="door"/><path d="M24 -28 h28" class="ground"/><path d="M-62 30 h128" class="ground"/><path d="M-58 -36 v-18 h10 v22" class="trunk"/>`,
};

// ---------- terreno: ilha com costa, rios, lagos, montanhas, bosques e colinas ----------
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COAST_C: [number, number] = [500, 372];
/** Raio da costa na direção `a`: uma elipse com baías e pontas. */
function coastR(a: number): [number, number] {
  const k = 1 + 0.07 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2) + 0.03 * Math.sin(9 * a);
  return [440 * k, 318 * k];
}
const inLand = (x: number, y: number, margin = 1) => {
  const dx = x - COAST_C[0];
  const dy = y - COAST_C[1];
  const [rx, ry] = coastR(Math.atan2(dy, dx));
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < margin * margin;
};

function smoothClosed(pts: readonly [number, number][]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'z';
}

function coastPath(): string {
  const rnd = mulberry(5);
  const pts: [number, number][] = [];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const [rx, ry] = coastR(a);
    const j = 1 + (rnd() - 0.5) * 0.07;
    pts.push([Math.max(52, Math.min(948, COAST_C[0] + Math.cos(a) * rx * j)), Math.max(52, Math.min(668, COAST_C[1] + Math.sin(a) * ry * j))]);
  }
  return smoothClosed(pts);
}

/** Pontos ao longo de todas as estradas, para os enfeites não cobrirem o caminho. */
function roadSamples(): [number, number][] {
  const out: [number, number][] = [];
  for (const id of PLACES) {
    const pts = ROAD[id];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.1) out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]);
    }
  }
  return out;
}

const RIVER_A: [number, number][] = [[862, 175], [842, 240], [804, 300], [832, 380], [786, 450], [804, 540], [762, 620], [792, 690]];
const RIVER_B: [number, number][] = [[88, 440], [170, 502], [262, 540], [302, 602], [292, 692]];
const LAKES: [number, number, number, number][] = [[690, 505, 46, 24], [112, 596, 40, 22]];

function terrainSvg(): string {
  const rnd = mulberry(11);
  const roads = roadSamples();
  const free = (x: number, y: number, r = 26) => {
    for (const id of PLACES) if (Math.hypot(x - POS[id][0], y - POS[id][1]) < 92) return false;
    if (Math.hypot(x - HUB[0], y - HUB[1]) < 40) return false;
    for (const [rx, ry] of roads) if (Math.hypot(x - rx, y - ry) < r) return false;
    for (const [lx, ly, rx, ry] of LAKES) if (((x - lx) / (rx + 18)) ** 2 + ((y - ly) / (ry + 18)) ** 2 < 1) return false;
    for (const rv of [RIVER_A, RIVER_B]) for (const [qx, qy] of rv) if (Math.hypot(x - qx, y - qy) < 22) return false;
    return true;
  };
  const coast = coastPath();
  let out = '';
  // mar: ondinhas na água em volta da ilha e um barquinho
  let waves = '';
  for (let i = 0; i < 46; i++) {
    const x = 50 + rnd() * 900;
    const y = 50 + rnd() * 620;
    if (inLand(x, y, 1.06)) continue;
    waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q6 -6 12 0 t12 0"/>`;
  }
  out += `<g class="sea-waves">${waves}</g>`;
  out += `<g class="ship" transform="translate(84 650)"><path d="M-16 0 h32 l-8 10 h-16z"/><path d="M0 0 v-30 M0 -28 l16 22 h-16 M-2 -22 l-12 16 h12"/></g>`;
  // terra com contorno duplo (como costa desenhada)
  out += `<path class="shore" d="${coast}"/><path class="land" d="${coast}"/>`;
  // lagos e rios
  for (const [x, y, rx, ry] of LAKES) out += `<ellipse class="lake" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><path class="water-line" d="M${x - rx * 0.5} ${y} q6 -4 12 0 t12 0"/>`;
  out += `<path class="river-edge" d="${smooth(RIVER_A)}"/><path class="river" d="${smooth(RIVER_A)}"/>`;
  out += `<path class="river-edge" d="${smooth(RIVER_B)}"/><path class="river" d="${smooth(RIVER_B)}"/>`;
  // colinas
  let hills = '';
  for (let i = 0; i < 34; i++) {
    const x = 70 + rnd() * 860;
    const y = 70 + rnd() * 590;
    if (!inLand(x, y, 0.93) || !free(x, y, 32)) continue;
    hills += `<path d="M${(x - 13).toFixed(0)} ${y.toFixed(0)} q13 -15 26 0"/>`;
  }
  out += `<g class="hills">${hills}</g>`;
  // plantações perto do vinhedo
  const fields = [[790, 275], [832, 258], [826, 305], [770, 318]];
  out += `<g class="fields">${fields.map(([x, y], i) => `<path d="M${x} ${y} l34 -${6 + i} l8 24 l-34 ${6 + i}z"/><path d="M${x + 6} ${y + 2} l30 -${5 + i} M${x + 9} ${y + 10} l30 -${5 + i} M${x + 12} ${y + 18} l30 -${5 + i}" class="furrow"/>`).join('')}</g>`;
  // bosques de pinheirinhos
  const tree = (x: number, y: number, h: number) =>
    `<path d="M${x.toFixed(0)} ${(y - h).toFixed(0)} l${(h * 0.42).toFixed(1)} ${(h * 0.8).toFixed(1)} h${(-h * 0.84).toFixed(1)}z"/><path d="M${x.toFixed(0)} ${(y - h * 0.5).toFixed(0)} l${(h * 0.5).toFixed(1)} ${(h * 0.7).toFixed(1)} h${(-h).toFixed(1)}z" class="tree2"/><path d="M${x.toFixed(0)} ${(y + h * 0.2).toFixed(0)} v${(h * 0.28).toFixed(1)}" class="trunk"/>`;
  let trees = '';
  const groves: [number, number, number, number][] = [[388, 500, 52, 15], [612, 516, 52, 15], [376, 420, 44, 11], [630, 420, 44, 11], [236, 610, 56, 14], [772, 622, 50, 12], [388, 70, 40, 9], [640, 62, 40, 9], [92, 380, 30, 8]];
  for (const [gx, gy, gr, n] of groves) {
    let placed = 0;
    for (let i = 0; i < n * 4 && placed < n; i++) {
      const x = gx + (rnd() - 0.5) * gr * 2;
      const y = gy + (rnd() - 0.5) * gr * 1.4;
      if (!inLand(x, y, 0.95) || !free(x, y, 24)) continue;
      trees += tree(x, y, 11 + rnd() * 6);
      placed++;
    }
  }
  out += `<g class="trees">${trees}</g>`;
  // montanhas com face clara e face escura
  const peak = (x: number, y: number, w: number, h: number) =>
    `<path class="m-l" d="M${x.toFixed(0)} ${y.toFixed(0)} L${(x - w / 2).toFixed(0)} ${(y + h).toFixed(0)} L${(x + w * 0.05).toFixed(0)} ${(y + h).toFixed(0)}z"/><path class="m-d" d="M${x.toFixed(0)} ${y.toFixed(0)} L${(x + w * 0.05).toFixed(0)} ${(y + h).toFixed(0)} L${(x + w / 2).toFixed(0)} ${(y + h).toFixed(0)}z"/><path class="m-s" d="M${x.toFixed(0)} ${y.toFixed(0)} l${(-w * 0.12).toFixed(1)} ${(h * 0.26).toFixed(1)} l${(w * 0.1).toFixed(1)} ${(-h * 0.06).toFixed(1)} l${(w * 0.07).toFixed(1)} ${(h * 0.12).toFixed(1)}"/>`;
  let mts = '';
  const ranges: [number, number, number][] = [[138, 142, 6], [862, 136, 6], [120, 262, 3], [884, 440, 5], [346, 84, 4], [654, 80, 4]];
  for (const [mx, my, n] of ranges) {
    for (let i = 0; i < n; i++) {
      const x = mx + (rnd() - 0.5) * 100;
      const y = my + (rnd() - 0.5) * 50;
      if (!inLand(x, y, 0.95) || !free(x, y, 22)) continue;
      mts += peak(x, y, 40 + rnd() * 22, 34 + rnd() * 22);
    }
  }
  out += `<g class="mountains">${mts}</g>`;
  out += `<text class="region" x="138" y="226" text-anchor="middle">Montes Cinzentos</text>`;
  out += `<text class="region" x="690" y="548" text-anchor="middle">Lago Espelho</text>`;
  out += `<text class="region" x="410" y="560" text-anchor="middle" transform="rotate(-4 410 560)">Bosque Antigo</text>`;
  return out;
}

function scaleBar(x: number, y: number) {
  return `<g class="doodle" transform="translate(${x} ${y})"><path d="M0 0 h120 M0 -6 v12 M60 -4 v8 M120 -6 v12"/><text class="compass-n" x="60" y="26" text-anchor="middle" style="font-size:16px">1 légua</text></g>`;
}

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
    let stopZoom = () => {};
    const finish = (v: AreaId | null) => {
      stopZoom();
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
    const roads = PLACES.map((id) => `<g id="road-${id}" class="road" data-for="${id}"><path class="bed" d="${smooth(ROAD[id])}"/><path class="dots" d="${smooth(ROAD[id])}"/></g>`).join('');
    const places = PLACES.map((id) => {
      const [x, y] = POS[id];
      const big = 1;
      const name = o.names[id];
      const bw = Math.max(76, name.length * 12.4 + 28);
      return `<g class="place" data-id="${id}" transform="translate(${x} ${y}) scale(${big})">
        <ellipse class="base" cx="0" cy="26" rx="70" ry="17"/>
        <g class="icon">${ICON[id]}</g>
        <g class="banner"><rect x="${-bw / 2}" y="40" width="${bw}" height="31" rx="9"/><text class="place-name" y="62" text-anchor="middle">${name}</text></g>
        <g class="step"><circle cx="-56" cy="-44" r="13"/><text x="-56" y="-38" text-anchor="middle">${STEP[id]}</text></g>
        <g class="cloud" transform="translate(0 -6) scale(1.25)">${CLOUD}</g>
        <g class="done-mark"><circle r="15" cx="52" cy="-42"/><path d="M45 -42 l5 6 l10 -12"/></g>
      </g>`;
    }).join('');
    svg.innerHTML = `
      <defs>
        <radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#bcd2c4"/><stop offset="1" stop-color="#8fb0a8"/></radialGradient>
        <radialGradient id="parch" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f1e1b4"/><stop offset="0.7" stop-color="#dcc088"/><stop offset="1" stop-color="#b38b4f"/></radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.05  0 0 0 0.35 0"/></filter>
        <filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="3"/></filter>
      </defs>
      <rect width="1000" height="720" rx="26" fill="url(#sea)"/>
      <g filter="url(#wobble)">${terrainSvg()}</g>
      <rect width="1000" height="720" rx="26" filter="url(#grain)" style="pointer-events:none"/>
      <rect x="18" y="18" width="964" height="684" rx="18" fill="none" class="frame"/>
      <rect x="30" y="30" width="940" height="660" rx="12" fill="none" class="frame thin"/>
      <g filter="url(#wobble)">${compass(900, 620)}${scaleBar(70, 660)}</g>
      <g class="roads" filter="url(#wobble)">${roads}</g>
      <circle class="hub" cx="${HUB[0]}" cy="${HUB[1]}" r="9"/>
      <g class="places" filter="url(#wobble)">${places}</g>
      <g class="pin" style="display:none"><circle r="19"/><text y="8" text-anchor="middle">🐴</text></g>`;
    box.appendChild(svg);

    const card = document.createElement('div');
    card.className = 'map-card';
    box.appendChild(card);

    const place = (id: PlaceId) => svg.querySelector<SVGGElement>(`.place[data-id="${id}"]`)!;
    const roadEl = (id: PlaceId) => svg.querySelector<SVGElement>(`#road-${id}`)!;
    const pin = svg.querySelector<SVGGElement>('.pin')!;
    const status = (id: PlaceId) => ({ open: o.isUnlocked(id), done: doneOf(id, game), built: o.isBuilt(id), here: id === cur });

    // estado inicial: o que já foi visto aparece aberto; o que acabou de abrir começa sob nuvem e se revela logo depois
    const toReveal: PlaceId[] = [];
    for (const id of PLACES) {
      const s = status(id);
      const seen = id === 'village' || id === 'forest' || game.flag(`seen_${id}`);
      if (s.open && !seen) toReveal.push(id);
      const open = s.open && seen;
      place(id).classList.toggle('open', open);
      roadEl(id).classList.toggle('open', open);
      place(id).classList.toggle('done', s.done);
      place(id).classList.toggle('here', s.here);
    }
    const [px, py] = POS[cur];
    pin.setAttribute('transform', `translate(${px + 40} ${py - 58})`);
    pin.style.display = '';

    let traveling = false;

    const lockedText = (id: PlaceId) => (id === 'village' ? T.locked.forest : id === 'farm' ? T.locked.farm : T.locked.middle);

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
        btn.innerHTML = `<span class="go-horse">🐴</span><span class="go-text"></span><span class="go-arrow">➜</span>`;
        btn.querySelector('.go-text')!.textContent = fmt(T.travel, { name: o.names[id] });
        btn.addEventListener('click', () => travel(id));
      }
      card.appendChild(text);
      if (btn.childElementCount) card.appendChild(btn);
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

    // ---------- zoom e arrastar (roda do mouse, pinça, arrastar, botões + e −) ----------
    const FULL_W = 1000;
    const FULL_H = 720;
    const view = { x: 0, y: 0, z: 1 };
    const applyView = () => {
      view.z = Math.max(1, Math.min(4.5, view.z));
      const w = FULL_W / view.z;
      const h = FULL_H / view.z;
      view.x = Math.max(0, Math.min(FULL_W - w, view.x));
      view.y = Math.max(0, Math.min(FULL_H - h, view.y));
      svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
      svg.classList.toggle('zoomed', view.z > 1.05);
    };
    const toSvg = (cx: number, cy: number) => {
      const r = svg.getBoundingClientRect();
      return { x: view.x + ((cx - r.left) / r.width) * (FULL_W / view.z), y: view.y + ((cy - r.top) / r.height) * (FULL_H / view.z) };
    };
    /** Troca o zoom mantendo o ponto (cx, cy) da tela parado. */
    const zoomAt = (cx: number, cy: number, factor: number) => {
      const before = toSvg(cx, cy);
      view.z = Math.max(1, Math.min(4.5, view.z * factor));
      const r = svg.getBoundingClientRect();
      view.x = before.x - ((cx - r.left) / r.width) * (FULL_W / view.z);
      view.y = before.y - ((cy - r.top) / r.height) * (FULL_H / view.z);
      applyView();
    };
    const zoomCenter = (factor: number) => {
      const r = svg.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    };
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
      },
      { passive: false },
    );
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let moved = false;
    svg.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    const onPtrMove = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev || traveling) return;
      if (ptrs.size === 2) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
        pinchDist = d;
        moved = true;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      const r = svg.getBoundingClientRect();
      view.x -= (dx / r.width) * (FULL_W / view.z);
      view.y -= (dy / r.height) * (FULL_H / view.z);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      applyView();
    };
    const onPtrEnd = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      pinchDist = 0;
    };
    window.addEventListener('pointermove', onPtrMove);
    window.addEventListener('pointerup', onPtrEnd);
    window.addEventListener('pointercancel', onPtrEnd);
    stopZoom = () => {
      window.removeEventListener('pointermove', onPtrMove);
      window.removeEventListener('pointerup', onPtrEnd);
      window.removeEventListener('pointercancel', onPtrEnd);
    };
    // depois de arrastar, o clique não escolhe um lugar sem querer
    svg.addEventListener(
      'click',
      (e) => {
        if (moved) {
          e.stopPropagation();
          moved = false;
        }
      },
      true,
    );
    svg.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.8));
    const zoomBox = document.createElement('div');
    zoomBox.className = 'map-zoom';
    const mkZ = (label: string, title: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'btn map-zbtn';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', fn);
      zoomBox.appendChild(b);
    };
    mkZ('+', 'Aproximar', () => zoomCenter(1.4));
    mkZ('−', 'Afastar', () => zoomCenter(1 / 1.4));
    mkZ('⟲', 'Ver tudo', () => {
      view.z = 1;
      view.x = 0;
      view.y = 0;
      applyView();
    });
    head.insertBefore(zoomBox, closeBtn);
    applyView();

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
