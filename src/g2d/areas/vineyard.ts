import { content, fmt, type ItemId } from '../../content';
import { audio } from '../../core/audio';
import { doneFlag } from '../../core/areas';
import { playBlend, type BlendGrape } from '../../ui/minigames';
import { OUTLINE, discPx, makeCanvas, mulberry32, outlineSprite } from '../art';
import { ROOF_BROWN, STONE, buildBuilding, buildSmallProps } from '../buildings';
import { Collision } from '../collision';
import { CombatSystem } from '../combat';
import { SUNSET, cloneEnv } from '../env';
import { Horse } from '../horse';
import { paintGround } from '../ground';
import type { AreaContext } from '../manager';
import { Person, type PersonSpec } from '../people';
import type { Area2D, Interactable, Light, Prop } from '../types';

/**
 * Vinhedo Dourado: fileiras de videira ao pôr do sol (como uma plantação do Stardew) e um galpão de pedra com o lagar.
 * A vinicultora pede quatro cachos especiais, escondidos em cestas nos corredores entre as fileiras e guardados por corvos
 * mansos de névoa; com eles o jogador faz a mistura no lagar (`playBlend`) e ganha a garrafa para o jantar em casa.
 */

const T = content.vineyard;
const W = 1100;
const H = 900;
const GRAPE_IDS = ['roxa', 'verde', 'rosada', 'dourada'] as const;
type GrapeId = (typeof GRAPE_IDS)[number];
type Axis = 'doce' | 'acido' | 'corpo';

const STARTED = 'vineyard_started';
const BLENDED = 'vineyard_blended';
const grapeFlag = (id: GrapeId) => `vineyard_grape_${id}`;

const START = { x: 550, y: 836 };
const CENTER = { x: 550, y: 470 };
/** Fileiras de videira (colunas) e o trecho de cima a baixo que elas ocupam. */
const ROW_X = [220, 300, 380, 460, 640, 720, 800, 880];
const ROW_Y0 = 300;
const ROW_Y1 = 716;
const SHED = { x: 640, y: 186 };
const PRESS = { x: 452, y: 206 };
const KEEPER = { x: 526, y: 226 };
/** A tina onde o Matheus pisa as uvas (elipse vista de cima). */
const TUB = { x: 300, y: 214, rx: 66, ry: 40 };
const nearTub = (x: number, y: number, m = 30) => ((x - TUB.x) / (TUB.rx + m)) ** 2 + ((y - TUB.y) / (TUB.ry + m)) ** 2 < 1;

/**
 * O cacho especial fica pendurado na própria videira (um segmento da fileira), virado para o corredor.
 * `side`: de que lado da fileira fica o corredor (1 = leste, -1 = oeste). `y` acompanha os segmentos de 24 px.
 */
const SPOTS: Record<GrapeId, { row: number; y: number; side: 1 | -1 }> = {
  roxa: { row: 640, y: 548, side: 1 },
  verde: { row: 460, y: 620, side: -1 },
  rosada: { row: 380, y: 428, side: 1 },
  dourada: { row: 720, y: 380, side: 1 },
};
/** Onde o Matheus fica para colher: no corredor, ao lado do cacho. */
const spotPos = (id: GrapeId) => ({ x: SPOTS[id].row + SPOTS[id].side * 24, y: SPOTS[id].y });
const GRAPE_COLOR: Record<GrapeId, string> = { roxa: '#7a3aa8', verde: '#a0d048', rosada: '#f080a8', dourada: '#ffd040' };
const WAVES: Record<GrapeId, ('corvo' | 'fiapo')[]> = {
  roxa: ['corvo'],
  verde: ['corvo', 'corvo'],
  rosada: ['corvo', 'fiapo'],
  dourada: ['corvo', 'corvo', 'fiapo'],
};

const KEEPER_SPEC: PersonSpec = { skin: '#e8bc94', hair: '#7a3a1c', hairStyle: 'bun', top: ['#b0402a', '#d06a4a', '#7e2a18'], pants: '#4a3a30', apron: '#e8e0d0', scarf: '#b0402a' };

/** Um pedaço de fileira (24 px): poste, arame e folhas com cachos roxos pendurados. */
function buildVineSegment(seed: number) {
  const rng = mulberry32(seed);
  const { c, ctx } = makeCanvas(34, 38);
  const f = (col: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  // poste e arames
  f('#6a4428', 16, 6, 3, 32);
  f('#8c5a38', 16, 6, 1, 32);
  f('#3a2a1c', 0, 14, 34, 1);
  f('#3a2a1c', 0, 24, 34, 1);
  // folhagem em manchas arredondadas, com tons de verde e dourado de fim de tarde
  const leaves = ['#2e5a22', '#4a7a2a', '#6a9a34', '#98b83c', '#c8a830'];
  for (let i = 0; i < 9; i++) {
    const x = 2 + Math.floor(rng() * 24);
    const y = 4 + Math.floor(rng() * 22);
    const w = 6 + Math.floor(rng() * 5);
    const h = 5 + Math.floor(rng() * 4);
    f(leaves[0], x, y + 1, w, h);
    f(leaves[1 + Math.floor(rng() * 3)], x + 1, y, w - 1, h - 1);
    f(leaves[3 + (rng() < 0.4 ? 1 : 0)], x + 1, y, 2, 1);
  }
  // cachos de uva
  const grapes = ['#4a1e6a', '#6a2e8c', '#8a4aae'];
  for (let k = 0; k < 2; k++) {
    const gx = 4 + Math.floor(rng() * 22);
    const gy = 20 + Math.floor(rng() * 6);
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q <= (r < 3 ? 2 - Math.floor(r / 2) : 0); q++) {
        const px = gx + q * 2 - (r < 3 ? 2 - Math.floor(r / 2) : 0) + 2;
        f(grapes[(r + q) % 3], px, gy + r * 2, 2, 2);
      }
    }
    f('#c8b0e0', gx + 2, gy, 1, 1);
  }
  return outlineSprite(c);
}

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, kit, fx, openMap, teleport } = ctx;
  const rng = mulberry32(515);
  const sp = buildSmallProps();

  // ---------- chão: trilha, fileiras de terra e clareiras ----------
  const trail: [number, number][] = [[550, 900], [550, 780], [552, 600], [550, 400], [550, 240]];
  const ground = paintGround({
    w: W,
    h: H,
    seed: 77,
    paths: [{ pts: trail, width: 70 }, ...ROW_X.map((x) => ({ pts: [[x, ROW_Y0 - 8], [x, ROW_Y1 + 8]] as [number, number][], width: 30 }))],
    clearings: [
      { x: 550, y: 842, rx: 100, ry: 44 },
      { x: 540, y: 206, rx: 250, ry: 64 },
    ],
    tufts: Math.round((W * H) / 1300),
    flowers: 90,
    leaves: 120,
    cobble: false,
  });

  // ---------- colisão: o vinhedo é uma elipse; fora dela só mata ----------
  const col = new Collision(W, H);
  col.extra = (x, y) => ((x - CENTER.x) / 520) ** 2 + ((y - CENTER.y) / 425) ** 2 > 1;
  const props: Prop[] = [];
  const lights: ((t: number, dk: number) => Light | null)[] = [];

  // árvores e arbustos fora da área de andar, para emoldurar
  const inside = (x: number, y: number, k: number) => ((x - CENTER.x) / (520 * k)) ** 2 + ((y - CENTER.y) / (425 * k)) ** 2 < 1;
  const cell = new Set<string>();
  const taken = (x: number, y: number, s: number) => {
    const k = `${Math.floor(x / s)}:${Math.floor(y / s)}`;
    if (cell.has(k)) return true;
    cell.add(k);
    return false;
  };
  for (let i = 0, n = 0; n < 260 && i < 9000; i++) {
    const x = 12 + rng() * (W - 24);
    const y = 12 + rng() * (H - 24);
    if (inside(x, y, 0.98) || taken(x, y, 38)) continue;
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    if (inside(x, y, 1.12)) col.addCircle(x, y, 4);
    n++;
  }
  for (let i = 0, n = 0; n < 70 && i < 6000; i++) {
    const x = 20 + rng() * (W - 40);
    const y = 20 + rng() * (H - 40);
    if (!inside(x, y, 0.97) || inside(x, y, 0.86) || ground.isPath(x, y) || nearTub(x, y, 24) || taken(x, y, 30)) continue;
    props.push({ kind: 'bush', x, y, img: kit.bushes[Math.floor(rng() * kit.bushes.length)] });
    n++;
  }
  for (let i = 0, n = 0; n < 24 && i < 4000; i++) {
    const x = 30 + rng() * (W - 60);
    const y = 30 + rng() * (H - 60);
    if (!inside(x, y, 0.95) || ground.isPath(x, y) || (y > ROW_Y0 - 30 && y < ROW_Y1 + 30 && x > 190 && x < 910) || nearTub(x, y, 24) || taken(x, y, 40)) continue;
    props.push({ kind: 'rock', x, y, img: kit.rocks[Math.floor(rng() * kit.rocks.length)] });
    n++;
  }
  for (let i = 0; i < 400; i++) {
    const x = 24 + rng() * (W - 48);
    const y = 24 + rng() * (H - 48);
    if (!inside(x, y, 0.95) || ground.isPath(x, y) || nearTub(x, y, 14)) continue;
    props.push({ kind: 'grass', x, y, phase: rng() * 6.28 });
  }

  // ---------- fileiras de videira ----------
  const vines = [1, 2, 3].map((s) => buildVineSegment(s * 97));
  for (const rx of ROW_X) {
    for (let y = ROW_Y0 + 8; y <= ROW_Y1; y += 24) {
      const img = vines[Math.floor(rng() * vines.length)];
      const special = GRAPE_IDS.find((id) => SPOTS[id].row === rx && SPOTS[id].y === y);
      if (!special) {
        props.push({ kind: 'custom', x: rx, y, shadowRx: 9, shadowRy: 2, draw: (v, sx, sy) => v.drawImage(img, sx - 17, sy - 36) });
        continue;
      }
      // segmento com o cacho especial: igual aos outros, só que o cacho é maior, na cor da uva, e cintila de leve quando dá para colher
      const { side } = SPOTS[special];
      props.push({
        kind: 'custom',
        x: rx,
        y,
        shadowRx: 9,
        shadowRy: 2,
        draw: (v, sx, sy, t) => {
          v.drawImage(img, sx - 17, sy - 36);
          if (picked(special)) return;
          const cx = sx + side * 9;
          const cy = sy - 20;
          const base = GRAPE_COLOR[special];
          v.fillStyle = OUTLINE;
          v.fillRect(cx - 7, cy - 1, 14, 17);
          v.fillStyle = '#3a6a28';
          v.fillRect(cx - 3, cy - 4, 7, 4);
          v.fillStyle = base;
          for (const [gx, gy] of [[-6, 0], [-2, 0], [2, 0], [-5, 4], [-1, 4], [3, 4], [-3, 8], [1, 8], [-1, 12]]) v.fillRect(cx + gx, cy + gy, 4, 4);
          if (started()) {
            // cintilar sutil: um brilho que vai e volta e dois pontinhos de luz
            const k = 0.5 + 0.5 * Math.sin(t * 2.6 + rx);
            v.fillStyle = `rgba(255,255,255,${0.25 + 0.45 * k})`;
            v.fillRect(cx - 3, cy + 1, 2, 2);
            if (Math.floor(t * 2 + rx * 0.1) % 3 === 0) v.fillRect(cx + 3, cy + 5, 1, 1);
            if (Math.floor(t * 2 + rx * 0.1 + 1) % 3 === 0) v.fillRect(cx - 2, cy + 8, 1, 1);
          }
        },
      });
    }
    col.addRect(rx - 11, ROW_Y0 - 6, rx + 11, ROW_Y1 + 2);
  }
  // placa de madeira no começo da trilha
  props.push({
    kind: 'custom',
    x: 600,
    y: 790,
    shadowRx: 8,
    shadowRy: 2,
    draw: (v, sx, sy) => {
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 2, sy - 26, 4, 27);
      v.fillRect(sx - 14, sy - 34, 28, 14);
      v.fillStyle = '#6a4428';
      v.fillRect(sx - 1, sy - 25, 2, 25);
      v.fillStyle = '#b88050';
      v.fillRect(sx - 13, sy - 33, 26, 12);
      v.fillStyle = '#8c5a38';
      v.fillRect(sx - 13, sy - 24, 26, 3);
      v.fillStyle = '#7a3aa8';
      for (const [x, y] of [[-6, -30], [-3, -28], [0, -30], [-4, -26]]) v.fillRect(sx + x, sy + y, 3, 3);
      v.fillStyle = '#3a8a3a';
      v.fillRect(sx - 1, sy - 32, 4, 2);
    },
  });
  col.addCircle(600, 788, 3);

  // ---------- galpão de pedra, lagar e coisas de fazenda ----------
  const shed = buildBuilding({
    w: 156,
    wallH: 58,
    roofH: 42,
    over: 8,
    wall: STONE,
    wallKind: 'stone',
    roof: ROOF_BROWN,
    door: { w: 38, h: 40, dark: true },
    windows: { n: 2, y: 10, w: 13, h: 13 },
    chimney: { x: 44, w: 12, h: 22 },
    seed: 303,
  });
  props.push({
    kind: 'custom',
    x: SHED.x,
    y: SHED.y,
    shadowRx: shed.wallW / 2 + 4,
    shadowRy: 6,
    draw: (v, sx, sy) => v.drawImage(shed.img, Math.round(sx - shed.w / 2), sy - shed.h),
  });
  col.addRect(SHED.x - shed.wallW / 2, SHED.y - 14, SHED.x + shed.wallW / 2, SHED.y + 2);

  // o lagar: barril largo de madeira com o fuso da prensa e uvas amassadas
  props.push({
    kind: 'custom',
    x: PRESS.x,
    y: PRESS.y,
    shadowRx: 30,
    shadowRy: 6,
    draw: (v, sx, sy) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => {
        v.fillStyle = c;
        v.fillRect(sx + x, sy + y, w, h);
      };
      // cuba
      r(OUTLINE, -30, -30, 60, 32);
      r('#8c5a38', -29, -29, 58, 30);
      for (let x = -28; x < 28; x += 7) r('#6a3e26', x, -28, 1, 28);
      r('#a87348', -29, -29, 58, 3);
      r('#3a3a48', -29, -22, 58, 3);
      r('#3a3a48', -29, -8, 58, 3);
      // uvas amassadas na boca da cuba
      r('#4a1e6a', -26, -33, 52, 6);
      r('#7a3aa8', -22, -35, 44, 4);
      for (const [x, y] of [[-16, -37], [-6, -38], [4, -37], [14, -36], [-10, -34], [8, -34]]) r('#a060d0', x, y, 4, 3);
      // fuso da prensa
      r(OUTLINE, -3, -66, 7, 34);
      r('#a87348', -2, -65, 5, 32);
      r(OUTLINE, -22, -70, 44, 6);
      r('#8c5a38', -21, -69, 42, 4);
      r('#c08a54', -21, -69, 42, 1);
      // bica de onde sai o suco
      r('#3a3a48', 26, -14, 8, 4);
      r('#7a3aa8', 32, -10, 2, 6);
      r('#6a2e8c', 28, -2, 8, 3);
    },
  });
  col.addRect(PRESS.x - 30, PRESS.y - 28, PRESS.x + 32, PRESS.y);

  const small = (img: HTMLCanvasElement, x: number, y: number, blocks = 0) => {
    props.push({ kind: 'custom', x, y, shadowRx: img.width * 0.5, shadowRy: 3, draw: (v, sx, sy) => v.drawImage(img, Math.round(sx - img.width / 2), sy - img.height + 2) });
    if (blocks > 0) col.addCircle(x, y - 3, blocks);
  };
  small(sp.barrel, 560, 214, 7);
  small(sp.barrel, 574, 224, 7);
  small(sp.crate, 716, 214, 9);
  small(sp.crateSmall, 734, 220, 6);
  small(sp.sack, 704, 226, 7);
  small(sp.barrow, 390, 222, 8);
  small(sp.hay, 880, 230, 10);
  small(sp.barrel, 200, 760, 7);
  small(sp.crate, 940, 780, 9);
  small(sp.bucket, 590, 230, 4);

  // ---------- estado e brilho dos cachos ----------
  const picked = (id: GrapeId) => game.flag(grapeFlag(id));
  const pickedCount = () => GRAPE_IDS.filter(picked).length;
  const allPicked = () => pickedCount() === GRAPE_IDS.length;
  const started = () => game.flag(STARTED);
  const blended = () => game.flag(BLENDED);
  const isDone = () => game.flag(doneFlag('vineyard'));
  const guarded = (id: GrapeId) => game.flag(`foe_vineyard_${id}`);
  for (const id of GRAPE_IDS) {
    const { x, y } = spotPos(id);
    lights.push((t) => (started() && !picked(id) ? { x: x - SPOTS[id].side * 12, y: y - 18, r: 46, col: hexRgb(GRAPE_COLOR[id]), a: 0.4 + 0.12 * Math.sin(t * 2.6 + x), night: true } : null));
  }
  lights.push(() => ({ x: SHED.x, y: SHED.y - 16, r: 70, col: [255, 190, 110], a: 0.3 }));

  // ---------- combate: corvos guardam os cachos ----------
  const combat = new CombatSystem({ col, player, ui, game, fx, teleport, start: { x: START.x, y: START.y - 20, dir: 'up' }, torchLit: () => false });
  for (const id of GRAPE_IDS) {
    const { x, y } = spotPos(id);
    combat.add({
      id: `vineyard_${id}`,
      x,
      y,
      radius: 70,
      enabled: () => started() && !picked(id),
      enemies: WAVES[id].map((kind, k) => {
        const a = (k / WAVES[id].length) * Math.PI * 2 + 0.7;
        return { kind, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 30 };
      }),
      checkpoint: { x: START.x, y: START.y - 20, dir: 'up' },
      onStart: () => ui.toast(T.crows),
    });
  }

  // ---------- a tina: o Matheus pisa as uvas andando por cima delas ----------
  interface Berry {
    x: number;
    y: number;
    r: number;
    col: string;
    crushed: boolean;
  }
  let berries: Berry[] = [];
  let juiceHex = '#7a3aa8';
  let stomping = false;
  let stompDone: (() => void) | null = null;
  const prints: { x: number; y: number }[] = [];
  const makeBerries = (colors: readonly string[], allCrushed: boolean) => {
    const list: Berry[] = [];
    for (let tries = 0; list.length < 64 && tries < 3000; tries++) {
      const a = Math.random() * Math.PI * 2;
      const k = Math.sqrt(Math.random());
      const x = TUB.x + Math.cos(a) * (TUB.rx - 14) * k;
      const y = TUB.y + Math.sin(a) * (TUB.ry - 11) * k;
      if (list.some((b) => Math.hypot(b.x - x, b.y - y) < 10)) continue;
      list.push({ x, y, r: 3 + Math.random() * 1.6, col: colors[list.length % colors.length], crushed: allCrushed });
    }
    return list;
  };
  berries = makeBerries(Object.values(GRAPE_COLOR), blendedNow());
  function blendedNow() {
    return game.flag(BLENDED) || game.flag(doneFlag('vineyard'));
  }
  const crushedRatio = () => (berries.length ? berries.filter((b) => b.crushed).length / berries.length : 0);

  // paredes de aduelas: sólidas, para o Matheus ficar dentro da tina enquanto pisa
  const STAVES = 44;
  for (let i = 0; i < STAVES; i++) {
    const a = (i / STAVES) * Math.PI * 2;
    const x = TUB.x + Math.cos(a) * TUB.rx;
    const y = TUB.y + Math.sin(a) * TUB.ry;
    col.addCircle(x, y, 5);
    props.push({
      kind: 'custom',
      x,
      y,
      draw: (v, sx, sy) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 5, sy - 15, 10, 17);
        v.fillStyle = i % 2 ? '#a87348' : '#8c5a38';
        v.fillRect(sx - 4, sy - 14, 8, 15);
        v.fillStyle = '#c08a54';
        v.fillRect(sx - 4, sy - 14, 8, 1);
        v.fillStyle = '#5a3420';
        v.fillRect(sx + 2, sy - 13, 2, 14);
        v.fillStyle = '#3a3a48';
        v.fillRect(sx - 5, sy - 9, 10, 3);
        v.fillStyle = '#8a8a9a';
        v.fillRect(sx - 5, sy - 9, 10, 1);
      },
    });
  }
  const pressBerries = () => {
    for (const b of berries) {
      if (b.crushed) continue;
      if (Math.hypot(b.x - player.x, b.y - player.y) < 9) {
        b.crushed = true;
        fx.dust(b.x, b.y, 5, juiceHex, 0);
        audio.play('hit', 0.18);
      }
    }
  };
  /** Corta para dentro da tina: coloca o Matheus lá, com as uvas da mistura, e espera ele pisar todas. */
  function startStomp(colors: readonly string[]) {
    juiceHex = hexMix(colors);
    berries = makeBerries(colors, false);
    prints.length = 0;
    stomping = true;
    player.look = 'bare';
    player.place(TUB.x, TUB.y + 4, 'down');
    return new Promise<void>((res) => {
      stompDone = res;
    });
  }

  // ---------- Armin espera na entrada ----------
  const horseName = content.village.horseName;
  const horse = game.flag('horseShod') ? new Horse(START.x - 46, START.y - 8) : null;
  if (horse) {
    horse.saddled = true;
    horse.behavior = { kind: 'wander', x: horse.x, y: horse.y, rx: 0, ry: 0, skittish: false };
    col.addCircle(horse.x, horse.y - 4, 12);
    // chegou montado: desce aqui e deixa de estar montado ao voltar para a vila
    game.setFlag('riding', false);
  }

  // ---------- Dona Vitória ----------
  const keeper = new Person(KEEPER_SPEC, KEEPER.x, KEEPER.y, { facing: 'down', work: { every: 6 }, watchPlayer: true });

  // ---------- interações ----------
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, mark?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled, mark });
  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  add(START.x, START.y + 26, 44, T.back.prompt, () => void openMap());

  async function finish() {
    await ui.tell(T.keeper.reward, T.keeper.name);
    giveItem('garrafa');
    game.setFlag('mem_vinhedo_brinde');
    game.setFlag(doneFlag('vineyard'));
    await ui.showMemory(content.memories.vinhedo_brinde);
    await openMap();
  }
  async function talkKeeper() {
    keeper.faceToward(player.x, player.y);
    if (isDone()) return void (await ui.tell(T.keeper.done, T.keeper.name));
    if (!started()) {
      await ui.tell(T.keeper.greet, T.keeper.name);
      game.setFlag(STARTED);
      return;
    }
    if (blended()) return void (await finish());
    await ui.tell(allPicked() ? T.keeper.ready : T.keeper.waiting, T.keeper.name);
  }
  add(KEEPER.x, KEEPER.y, 46, T.keeper.prompt, () => void talkKeeper(), undefined, () => !started() || blended());

  const blendGrapes: BlendGrape[] = GRAPE_IDS.map((id) => ({ id, icon: T.grapes[id].icon, name: T.grapes[id].name, doce: T.grapes[id].doce, acido: T.grapes[id].acido, corpo: T.grapes[id].corpo }));
  /** Faixa de cada barra: a média da receita de referência ± tolerância. */
  const targets = (() => {
    const ref = T.blend.solution.map((id) => T.grapes[id]);
    const band = (axis: Axis): readonly [number, number] => {
      const avg = ref.reduce((sum, g) => sum + g[axis], 0) / ref.length;
      return [avg - T.blend.tolerance, avg + T.blend.tolerance];
    };
    return { doce: band('doce'), acido: band('acido'), corpo: band('corpo') };
  })();
  async function usePress() {
    if (isDone()) return void (await ui.tell(T.press.done));
    if (!started()) return void (await ui.tell(T.press.notStarted));
    if (!allPicked()) return void (await ui.tell(T.press.notReady));
    if (!blended()) {
      const mix = await playBlend(ui, T.blend, blendGrapes, targets, T.blend.max);
      await ui.tell(T.stomp.before, T.keeper.name);
      // corta para a tina: o Matheus descalço pisa as uvas, andando por cima delas
      await ui.fade(true, T.stomp.cut);
      const done = startStomp(mix.map((id) => GRAPE_COLOR[id as GrapeId]));
      await ui.fade(false);
      ui.toast(T.stomp.hint);
      await done;
      await ui.fade(true, T.stomp.later);
      player.place(PRESS.x, PRESS.y + 38, 'down');
      await ui.fade(false);
      await ui.tell(T.stomp.after);
      game.setFlag(BLENDED);
    }
    await finish();
  }
  add(PRESS.x, PRESS.y + 10, 46, T.press.prompt, () => void usePress(), undefined, () => started() && allPicked() && !blended());

  async function pick(id: GrapeId) {
    game.setFlag(grapeFlag(id));
    await ui.tell([T.grapes[id].picked]);
    if (allPicked()) ui.toast(T.objective.press);
  }
  for (const id of GRAPE_IDS) {
    const { x, y } = spotPos(id);
    // a estrelinha aparece desde que a colheita começa; a colheita só vale depois de afastar os corvos
    const here = () => started() && !picked(id);
    add(x, y, 44, T.grapes[id].prompt, () => (guarded(id) ? void pick(id) : ui.toast(T.crows)), here, here);
  }

  // ---------- objetivo ----------
  const objective = () => {
    if (isDone()) return T.objective.done;
    if (!started()) return T.objective.talk;
    if (blended()) return T.objective.reward;
    if (allPicked()) return T.objective.press;
    return fmt(T.objective.harvest, { n: pickedCount() });
  };
  let lastObjective = '';
  let objTimer = 0;

  const env = cloneEnv(SUNSET);
  env.overhang = false;
  env.mist = 0.12;

  return {
    id: 'vineyard',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: { start: { x: START.x, y: START.y, dir: 'up' } },
    interactables,
    env,
    combat,
    torchLit: () => false,
    isPath: (x, y) => ground.isPath(x, y),
    drawGround(v, cx, cy) {
      const tx = Math.round(TUB.x - cx);
      const ty = Math.round(TUB.y - cy);
      // fundo de tábuas, o suco que vai se formando e as uvas (inteiras ou já esmagadas)
      v.fillStyle = '#2a1a14';
      discPx(v, tx, ty, TUB.rx + 3, TUB.ry + 3);
      v.fillStyle = '#5a3a22';
      discPx(v, tx, ty, TUB.rx, TUB.ry);
      v.fillStyle = '#6e4a2c';
      for (let k = -3; k <= 3; k++) v.fillRect(tx - TUB.rx + 6, ty + k * 10, (TUB.rx - 6) * 2, 1);
      const ratio = crushedRatio();
      if (ratio > 0) {
        v.globalAlpha = 0.25 + 0.55 * ratio;
        v.fillStyle = juiceHex;
        discPx(v, tx, ty, TUB.rx - 4, TUB.ry - 3);
        v.globalAlpha = 1;
      }
      for (const b of berries) {
        const bx = Math.round(b.x - cx);
        const by = Math.round(b.y - cy);
        if (b.crushed) {
          v.globalAlpha = 0.85;
          v.fillStyle = juiceHex;
          discPx(v, bx, by, Math.round(b.r * 1.5), Math.round(b.r * 0.8));
          v.globalAlpha = 1;
        } else {
          v.fillStyle = '#1e0a2a';
          discPx(v, bx, by + 1, Math.round(b.r) + 1, Math.round(b.r) + 1);
          v.fillStyle = b.col;
          discPx(v, bx, by, Math.round(b.r), Math.round(b.r));
          v.fillStyle = 'rgba(255,255,255,0.55)';
          v.fillRect(bx - 1, by - 2, 1, 1);
        }
      }
      // pegadas roxas do Matheus
      v.fillStyle = juiceHex;
      for (const p of prints) v.fillRect(Math.round(p.x - cx) - 1, Math.round(p.y - cy) - 1, 3, 2);
    },
    drawables(out) {
      out.push(keeper.drawable());
      if (horse) out.push(horse.drawable());
    },
    lights(out, t) {
      for (const l of lights) {
        const r = l(t, 0);
        if (r) out.push(r);
      }
    },
    update(dt, t, pl) {
      keeper.update(dt, t, pl, col, ui.inDialog);
      if (stomping) {
        pressBerries();
        const last = prints[prints.length - 1];
        if (player.moving && (!last || Math.hypot(last.x - pl.x, last.y - pl.y) > 11)) {
          prints.push({ x: pl.x + (prints.length % 2 ? 3 : -3), y: pl.y });
          if (prints.length > 90) prints.shift();
        }
        const done = crushedRatio();
        ui.setProgress(T.stomp.progress, done);
        if (done >= 0.97) {
          stomping = false;
          // os sapatos voltam, mas a barra da calça fica roxa até o fim do jogo
          game.setFlag('pantsStained');
          player.look = 'stain';
          for (const b of berries) b.crushed = true;
          ui.setProgress(null);
          audio.play('coin', 0.9);
          stompDone?.();
          stompDone = null;
        }
      }
      horse?.update(dt, player, col);
      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.5;
        const o = combat.fighting ? T.crows : objective();
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
    },
    onEnter() {
      if (!game.flag('vineyard_seen')) {
        game.setFlag('vineyard_seen');
        void ui.say(horse ? [...T.intro, fmt(T.horseWait, { name: horseName })] : T.intro);
      }
    },
    dispose() {
      ui.setObjective(null);
      if (player.look === 'bare') player.look = game.flag('pantsStained') ? 'stain' : 'normal';
    },
    debug: {
      combat,
      /** Apaga o progresso do vinhedo (cachos, corvos, mistura, garrafa e lembrança) e recarrega a página. */
      reset: () => {
        for (const f of [STARTED, BLENDED, doneFlag('vineyard'), 'mem_vinhedo_brinde', 'vineyard_seen']) game.setFlag(f, false);
        for (const id of GRAPE_IDS) {
          game.setFlag(grapeFlag(id), false);
          game.setFlag(`foe_vineyard_${id}`, false);
        }
        game.setFlag('pantsStained', false);
        if (game.has('garrafa')) game.removeItem('garrafa');
        ui.setProgress(null);
        location.reload();
      },
      /** Só para teste: entra direto na tina com as cores da mistura certa. */
      stomp: () => void startStomp(['#7a3aa8', '#a0d048', '#ffd040']),
      /** Para testar sem jogar tudo antes: dá a espada, deixa o cavalo ferrado e recarrega. */
      kit: () => {
        if (!game.has('espada')) game.addItem('espada');
        game.setFlag('horseShod');
        location.reload();
      },
      harvestAll: () => {
        game.setFlag(STARTED);
        GRAPE_IDS.forEach((id) => game.setFlag(grapeFlag(id)));
      },
      solveAll: () => {
        game.setFlag(STARTED);
        GRAPE_IDS.forEach((id) => game.setFlag(grapeFlag(id)));
        game.setFlag(BLENDED);
      },
    },
  };
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cor do suco: a média das cores das uvas, mais escura. */
function hexMix(colors: readonly string[]): string {
  const rgb = (colors.length ? colors : ['#7a3aa8']).map(hexRgb);
  const n = rgb.length;
  const r = Math.round((rgb.reduce((a, c) => a + c[0], 0) / n) * 0.7);
  const g = Math.round((rgb.reduce((a, c) => a + c[1], 0) / n) * 0.45);
  const b = Math.round((rgb.reduce((a, c) => a + c[2], 0) / n) * 0.75);
  return `rgb(${r},${g},${b})`;
}
