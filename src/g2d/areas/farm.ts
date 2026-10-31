import { content } from '../../content';
import { OUTLINE, mulberry32 } from '../art';
import { Animal, type AnimalKind, type Bounds } from '../animals';
import { PLASTER, ROOF_RED, buildBarn, buildBuilding, buildSmallProps, buildWell } from '../buildings';
import { Chick, henSprites } from '../chickens';
import { Collision } from '../collision';
import { NIGHT, SUNSET, cloneEnv, lerpEnv } from '../env';
import { paintGround } from '../ground';
import { Horse } from '../horse';
import type { AreaContext } from '../manager';
import type { Pt } from '../route';
import type { Area2D, Interactable, Light, Prop } from '../types';

/**
 * Nossa Fazenda: a volta para casa. Uma casinha de campo com horta, galinheiro, curral das vacas, chiqueiro e pasto das
 * ovelhas, ao pôr do sol, e o cheiro de comida saindo da chaminé. Entrar pela porta leva ao final, dentro de casa.
 */

const T = content.farm;
const W = 1300;
const H = 1000;
const START = { x: 650, y: 940 };
const HOUSE = { x: 650, y: 262 };
const BARN = { x: 1100, y: 300 };
const CENTER = { x: 650, y: 500 };
const RX = 625;
const RY = 480;

const CHICKEN_PEN: Bounds = { x0: 390, y0: 340, x1: 580, y1: 480 };
const COW_PEN: Bounds = { x0: 390, y0: 540, x1: 580, y1: 800 };
const PIG_PEN: Bounds = { x0: 720, y0: 340, x1: 910, y1: 480 };
const SHEEP_PEN: Bounds = { x0: 720, y0: 540, x1: 910, y1: 800 };
const HEN_COLORS = ['#f4efe6', '#9a5a2c', '#3a3430', '#e0c890', '#b4472a', '#f4efe6'];

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, kit, goTo, openMap } = ctx;
  const rng = mulberry32(1313);
  const sp = buildSmallProps();

  // ---------- chão: trilha até a porta, horta e a lama do chiqueiro ----------
  const ground = paintGround({
    w: W,
    h: H,
    seed: 41,
    paths: [
      { pts: [[650, 1000], [650, 860], [652, 600], [650, 330]], width: 56 },
      { pts: [[480, 300], [650, 300], [820, 300]], width: 36 },
    ],
    clearings: [
      { x: 650, y: 300, rx: 170, ry: 54 },
      { x: 650, y: 948, rx: 100, ry: 44 },
    ],
    tufts: Math.round((W * H) / 1300),
    flowers: 220,
    leaves: 60,
    cobble: false,
    decor: (g) => {
      // horta ao lado da casa: terra preparada em fileiras com repolhos, cenouras e alfaces
      g.fillStyle = '#2a1a10';
      g.fillRect(414, 166, 156, 100);
      g.fillStyle = '#5a3a22';
      g.fillRect(416, 168, 152, 96);
      for (let r = 0; r < 6; r++) {
        const y = 174 + r * 15;
        g.fillStyle = '#6e4a2c';
        g.fillRect(420, y + 6, 144, 3);
        for (let x = 424; x < 562; x += 14) {
          g.fillStyle = r % 3 === 0 ? '#9ad468' : r % 3 === 1 ? '#4a8a38' : '#e8802a';
          g.fillRect(x, y, 6, 6);
          g.fillStyle = r % 3 === 2 ? '#5aa23a' : '#d8f0a0';
          g.fillRect(x + 1, y - 1, 3, 2);
        }
      }
      // lama do chiqueiro
      for (const [x, y, rx, ry, c] of [[815, 420, 82, 50, '#3a2418'], [815, 420, 76, 44, '#5a3a24'], [795, 410, 26, 12, '#6e4a30'], [845, 436, 22, 10, '#6e4a30']] as const) {
        g.fillStyle = c;
        for (let dy = -ry; dy <= ry; dy++) {
          const half = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
          g.fillRect(x - half, y + dy, half * 2, 1);
        }
      }
      // feno espalhado no curral e no pasto
      g.fillStyle = '#d8b04a';
      for (let i = 0; i < 70; i++) g.fillRect(400 + Math.floor(rng() * 170), 550 + Math.floor(rng() * 240), 3, 1);
    },
  });

  // ---------- colisão: a fazenda é uma elipse; fora dela só mata ----------
  const col = new Collision(W, H);
  col.extra = (x, y) => ((x - CENTER.x) / RX) ** 2 + ((y - CENTER.y) / RY) ** 2 > 1;
  const props: Prop[] = [];
  const lights: ((t: number) => Light | null)[] = [];
  const inside = (x: number, y: number, k: number) => ((x - CENTER.x) / (RX * k)) ** 2 + ((y - CENTER.y) / (RY * k)) ** 2 < 1;
  const inRect = (x: number, y: number, b: Bounds, m = 24) => x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m;
  const pens = [CHICKEN_PEN, COW_PEN, PIG_PEN, SHEEP_PEN];
  const busy = (x: number, y: number) => pens.some((b) => inRect(x, y, b)) || (x > 400 && x < 600 && y > 150 && y < 290) || (Math.abs(x - 650) < 60 && y > 250) || inRect(x, y, { x0: BARN.x - 90, y0: BARN.y - 110, x1: BARN.x + 90, y1: BARN.y + 40 }, 10);

  // mata em volta, para emoldurar
  const cell = new Set<string>();
  const taken = (x: number, y: number, s: number) => {
    const k = `${Math.floor(x / s)}:${Math.floor(y / s)}`;
    if (cell.has(k)) return true;
    cell.add(k);
    return false;
  };
  for (let i = 0, n = 0; n < 340 && i < 12000; i++) {
    const x = 12 + rng() * (W - 24);
    const y = 12 + rng() * (H - 24);
    if (inside(x, y, 0.98) || taken(x, y, 38)) continue;
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    if (inside(x, y, 1.12)) col.addCircle(x, y, 4);
    n++;
  }
  // macieiras perto da casa e arbustos soltos
  for (const [x, y] of [[560, 200], [750, 214], [380, 250], [900, 250], [1000, 470]] as const) {
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    col.addCircle(x, y, 5);
  }
  for (let i = 0, n = 0; n < 60 && i < 6000; i++) {
    const x = 24 + rng() * (W - 48);
    const y = 24 + rng() * (H - 48);
    if (!inside(x, y, 0.95) || inside(x, y, 0.8) || ground.isPath(x, y) || busy(x, y) || taken(x, y, 32)) continue;
    props.push({ kind: 'bush', x, y, img: kit.bushes[Math.floor(rng() * kit.bushes.length)] });
    n++;
  }
  for (let i = 0; i < 500; i++) {
    const x = 20 + rng() * (W - 40);
    const y = 20 + rng() * (H - 40);
    if (!inside(x, y, 0.95) || ground.isPath(x, y) || busy(x, y)) continue;
    props.push({ kind: 'grass', x, y, phase: rng() * 6.28 });
  }

  // ---------- cercas ----------
  const fence = (pts: Pt[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(len / 12));
      const dx = (bx - ax) / n;
      const dy = (by - ay) / n;
      for (let k = 0; k <= n; k++) {
        const x = ax + dx * k;
        const y = ay + dy * k;
        props.push({
          kind: 'custom',
          x,
          y,
          shadowRx: 5,
          shadowRy: 2,
          draw: (v, sx, sy) => {
            if (k < n) {
              for (const hh of [10, 5]) {
                const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
                for (let s = 0; s <= steps; s++) {
                  const rx = Math.round(sx + (dx * s) / steps);
                  const ry = Math.round(sy - hh + (dy * s) / steps);
                  v.fillStyle = OUTLINE;
                  v.fillRect(rx, ry - 1, 1, 3);
                  v.fillStyle = hh === 10 ? '#b88050' : '#8c5a38';
                  v.fillRect(rx, ry, 1, 2);
                }
              }
            }
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 14, 4, 15);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 13, 2, 13);
            v.fillStyle = '#c08a54';
            v.fillRect(sx - 1, sy - 13, 1, 13);
          },
        });
        col.addCircle(x, y, 4.5);
      }
    }
  };
  /** Cercado retangular com um portão aberto (um vão) do lado `gate`, entre g0 e g1. */
  const fenceRect = (b: Bounds, gate: 'left' | 'right', g0: number, g1: number) => {
    fence([[b.x0, b.y0], [b.x1, b.y0]]);
    fence([[b.x0, b.y1], [b.x1, b.y1]]);
    const gx = gate === 'right' ? b.x1 : b.x0;
    const ox = gate === 'right' ? b.x0 : b.x1;
    fence([[ox, b.y0], [ox, b.y1]]);
    fence([[gx, b.y0], [gx, g0]]);
    fence([[gx, g1], [gx, b.y1]]);
  };
  fenceRect(CHICKEN_PEN, 'right', 395, 445);
  fenceRect(COW_PEN, 'right', 650, 720);
  fenceRect(PIG_PEN, 'left', 395, 445);
  fenceRect(SHEEP_PEN, 'left', 650, 720);

  // ---------- casa, celeiro, poço e coisas de fazenda ----------
  const house = buildBuilding({
    w: 124,
    wallH: 56,
    roofH: 44,
    over: 8,
    wall: PLASTER,
    timber: '#6a3e26',
    roof: ROOF_RED,
    door: { w: 20, h: 34 },
    windows: { n: 4, w: 12, h: 13, y: 12 },
    chimney: { x: 36, w: 13, h: 28 },
    seed: 808,
  });
  props.push({ kind: 'custom', x: HOUSE.x, y: HOUSE.y, shadowRx: house.wallW / 2 + 4, shadowRy: 6, draw: (v, sx, sy) => v.drawImage(house.img, Math.round(sx - house.w / 2), sy - house.h) });
  col.addRect(HOUSE.x - house.wallW / 2, HOUSE.y - 14, HOUSE.x + house.wallW / 2, HOUSE.y + 2);
  // fumaça saindo da chaminé e janelas acesas
  props.push({
    kind: 'custom',
    x: HOUSE.x + 36,
    y: HOUSE.y - house.h + 20,
    draw: (v, sx, sy, t) => {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.45 + i / 4) % 1;
        v.fillStyle = `rgba(232,228,222,${0.55 * (1 - k)})`;
        const s = 3 + Math.round(k * 4);
        v.fillRect(Math.round(sx + Math.sin(t + i * 2) * 3 + k * 6), Math.round(sy - 4 - k * 34), s, s);
      }
    },
  });
  for (const lx of [HOUSE.x - 40, HOUSE.x + 40]) lights.push((t) => ({ x: lx, y: HOUSE.y - 28, r: 56, col: [255, 196, 110], a: 0.8 + 0.06 * Math.sin(t * 3 + lx), night: true }));
  lights.push(() => ({ x: HOUSE.x, y: HOUSE.y - 6, r: 64, col: [255, 214, 150], a: 0.65, night: true }));
  for (const lx of [HOUSE.x - 70, HOUSE.x + 70, 650]) lights.push((t) => ({ x: lx, y: lx === 650 ? START.y - 20 : HOUSE.y + 6, r: 52, col: [255, 190, 110], a: 0.5 + 0.05 * Math.sin(t * 5 + lx), night: true }));

  const barn = buildBarn();
  props.push({ kind: 'custom', x: BARN.x, y: BARN.y, shadowRx: barn.wallW / 2 + 4, shadowRy: 6, draw: (v, sx, sy) => v.drawImage(barn.img, Math.round(sx - barn.w / 2), sy - barn.h) });
  col.addRect(BARN.x - barn.wallW / 2, BARN.y - 14, BARN.x + barn.wallW / 2, BARN.y + 2);

  const well = buildWell();
  props.push({ kind: 'custom', x: 800, y: 330, shadowRx: 18, shadowRy: 4, draw: (v, sx, sy) => v.drawImage(well.img, Math.round(sx - well.w / 2), sy - well.h) });
  col.addCircle(800, 326, 12);

  const small = (img: HTMLCanvasElement, x: number, y: number, blocks = 0) => {
    props.push({ kind: 'custom', x, y, shadowRx: img.width * 0.5, shadowRy: 3, draw: (v, sx, sy) => v.drawImage(img, Math.round(sx - img.width / 2), sy - img.height + 2) });
    if (blocks > 0) col.addCircle(x, y - 3, blocks);
  };
  small(sp.hay, 1020, 330, 10);
  small(sp.hay, 1180, 340, 10);
  small(sp.barrel, 1030, 345, 7);
  small(sp.crate, 1160, 360, 9);
  small(sp.barrow, 1130, 380, 8);
  small(sp.trough, 420, 580, 10);
  small(sp.trough, 540, 780, 10);
  small(sp.trough, 760, 580, 10);
  small(sp.trough, 880, 780, 10);
  small(sp.trough, 815, 380, 0);
  small(sp.bucket, 770, 340, 4);
  small(sp.sack, 1052, 350, 6);
  small(sp.crateSmall, 612, 300, 5);
  const coop = sp.coop;
  props.push({ kind: 'custom', x: 440, y: 396, shadowRx: coop.wallW / 2, shadowRy: 4, draw: (v, sx, sy) => v.drawImage(coop.img, Math.round(sx - coop.w / 2), sy - coop.h) });
  col.addRect(440 - coop.wallW / 2, 382, 440 + coop.wallW / 2, 398);
  // canteiros de flores na porta
  for (const fx of [-44, 44]) {
    props.push({
      kind: 'custom',
      x: HOUSE.x + fx,
      y: HOUSE.y + 18,
      draw: (v, sx, sy, t) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 12, sy - 6, 24, 8);
        v.fillStyle = '#5a3a22';
        v.fillRect(sx - 11, sy - 5, 22, 6);
        for (let i = 0; i < 5; i++) {
          const x = sx - 9 + i * 4;
          v.fillStyle = '#4a8a38';
          v.fillRect(x, sy - 9 + (Math.sin(t * 2 + i) > 0.8 ? 1 : 0), 1, 5);
          v.fillStyle = ['#f06a8a', '#ffd070', '#ffffff', '#c080e8', '#ff9a5a'][i];
          v.fillRect(x - 1, sy - 11, 3, 3);
        }
      },
    });
  }

  // ---------- bichos ----------
  const animals: Animal[] = [];
  const addAnimals = (kind: AnimalKind, b: Bounds, n: number) => {
    const inner: Bounds = { x0: b.x0 + 24, y0: b.y0 + 22, x1: b.x1 - 24, y1: b.y1 - 20 };
    for (let i = 0; i < n; i++) animals.push(new Animal(kind, inner.x0 + rng() * (inner.x1 - inner.x0), inner.y0 + rng() * (inner.y1 - inner.y0), inner));
  };
  addAnimals('cow', COW_PEN, 3);
  addAnimals('pig', PIG_PEN, 3);
  addAnimals('sheep', SHEEP_PEN, 4);
  // alguns bichos soltos perto da trilha, para ver logo na chegada
  const roam = (kind: AnimalKind, b: Bounds, n: number) => {
    for (let i = 0; i < n; i++) animals.push(new Animal(kind, b.x0 + rng() * (b.x1 - b.x0), b.y0 + rng() * (b.y1 - b.y0), b));
  };
  roam('sheep', { x0: 430, y0: 830, x1: 580, y1: 930 }, 2);
  roam('cow', { x0: 730, y0: 830, x1: 900, y1: 930 }, 1);
  roam('pig', { x0: 470, y0: 560 + 280, x1: 580, y1: 900 }, 1);
  const chicks: Chick[] = [];
  HEN_COLORS.forEach((c, i) => {
    const sprites = henSprites(kit, c);
    chicks.push(new Chick(450 + (i % 3) * 32, 420 + Math.floor(i / 3) * 24, sprites, { x: 485, y: 425, r: 50 }));
  });
  for (const [x, y] of [[560, 330], [720, 310]] as const) chicks.push(new Chick(x, y, henSprites(kit, '#f4efe6'), { x, y, r: 40 }));

  // o Armin também está em casa (ficou ferrado na vila)
  const horse = game.flag('horseShod') ? new Horse(600, 900) : null;
  if (horse) {
    horse.saddled = true;
    horse.behavior = { kind: 'wander', x: horse.x, y: horse.y, rx: 0, ry: 0, skittish: false };
    col.addCircle(horse.x, horse.y - 4, 12);
    game.setFlag('riding', false);
  }

  // ---------- interações ----------
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, mark?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled, mark });
  add(START.x, START.y + 28, 44, T.back.prompt, () => void openMap());
  add(HOUSE.x, HOUSE.y + 14, 50, T.door.prompt, () => void goTo('home'), undefined, () => true);
  add(580, 420, 46, T.animals.chickens.prompt, () => void ui.tell(T.animals.chickens.lines));
  add(600, 685, 50, T.animals.cows.prompt, () => void ui.tell(T.animals.cows.lines));
  add(700, 420, 46, T.animals.pigs.prompt, () => void ui.tell(T.animals.pigs.lines));
  add(700, 685, 50, T.animals.sheep.prompt, () => void ui.tell(T.animals.sheep.lines));
  if (horse) add(horse.x + 4, horse.y, 40, 'Fazer carinho no Armin', () => void ui.tell([T.horse]));

  // chega anoitecendo: o fim do pôr do sol já virando noite, com as janelas e os lampiões acesos
  const env = lerpEnv(SUNSET, NIGHT, 0.7, cloneEnv(SUNSET));
  env.overhang = false;
  env.mist = 0.2;
  ui.setObjective(T.objective);

  return {
    id: 'farm',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: { start: { x: START.x, y: START.y, dir: 'up' } },
    interactables,
    env,
    torchLit: () => false,
    isPath: (x, y) => ground.isPath(x, y),
    drawables(out) {
      for (const a of animals) out.push(a.drawable());
      for (const c of chicks) out.push(c.drawable());
      if (horse) out.push(horse.drawable());
    },
    lights(out, t) {
      for (const l of lights) {
        const r = l(t);
        if (r) out.push(r);
      }
    },
    update(dt, _t, _pl) {
      for (const a of animals) a.update(dt, col);
      const scare = 22 + Math.min(player.speed, 120) * 0.18;
      for (const c of chicks) c.update(dt, player, scare, col);
      horse?.update(dt, player, col);
    },
    onEnter() {
      ui.setObjective(T.objective);
      if (!game.flag('farm_seen')) {
        game.setFlag('farm_seen');
        void ui.say(T.intro);
      }
    },
    dispose() {
      ui.setObjective(null);
    },
  };
}
