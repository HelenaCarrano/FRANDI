import { audio } from '../../core/audio';
import { content, fmt, type ItemId } from '../../content';
import { playForge, playGears, playMilling, playSorting } from '../../ui/minigames';
import { itemCanvas } from '../../ui/itemArt';
import { OUTLINE, mulberry32 } from '../art';
import {
  buildBarn, buildChurch, buildGatePillar, buildHouse, buildMarket, buildMill, buildSmallProps, buildSmith, buildTavern, buildWallPiece, buildWell,
  drawFan, type Sprite,
} from '../buildings';
import { Chick, henSprites, PEN_MOUTH, type PenSpec } from '../chickens';
import { Collision } from '../collision';
import { GOLDEN_MORNING, cloneEnv } from '../env';
import { paintGround } from '../ground';
import { Horse } from '../horse';
import type { AreaContext } from '../manager';
import { Person, type PersonSpec } from '../people';
import { DistanceGrid, Route, type Pt } from '../route';
import type { Area2D, Drawable, Interactable, Light, Prop } from '../types';

/**
 * Vila do Amanhecer em 2D. Aqui está a história: o cavalo desconfiado (Tito), as ferraduras (Brutus, com o minijogo da forja),
 * o moinho parado (Seu Alvim, com as engrenagens), as galinhas fugidas (Dona Clotilde) e a encomenda da Dona Pimenta.
 * As medidas vêm do plano em metros da versão 3D: 1 m = K pixels no mapa (os sprites têm a escala do Matheus, 18 px/m,
 * então a vila ficou mais compacta de andar).
 */

const T = content.village;
const HEN_NAMES = 6;
const K = 7;
const W = 1800;
const H = 1700;
const OX = 900;
const OZ = 820;
/** Metros do plano original (x, z) para pixels. */
const P = (x: number, z: number): Pt => [Math.round(OX + x * K), Math.round(OZ + z * K)];
/** O círculo andável da vila é uma elipse. */
const ELL = { x: 900, y: 860, rx: 580, ry: 520 };
const outside = (x: number, y: number) => ((x - ELL.x) / ELL.rx) ** 2 + ((y - ELL.y) / ELL.ry) ** 2 > 1;

type QuestId = keyof typeof T.quests;

const SPEC: Record<'tito' | 'brutus' | 'alvim' | 'clotilde' | 'pimenta' | 'villagerA' | 'villagerB' | 'kid', PersonSpec> = {
  tito: { skin: '#e8b890', hair: '#6a4a2a', hairStyle: 'short', top: ['#6f9a4c', '#92bc66', '#4c7036'], pants: '#6a5238', hat: { kind: 'straw', color: '#d9b45a' } },
  brutus: { skin: '#d89a72', hair: '#3a2316', hairStyle: 'short', beard: true, top: ['#8a3a2c', '#b05a44', '#62261c'], pants: '#3c3440', apron: '#4a3626', held: 'axe' },
  alvim: { skin: '#f0c8a0', hair: '#e8e4dc', hairStyle: 'short', beard: true, top: ['#7a94b4', '#9ab4d2', '#566e8c'], pants: '#6a6a7a', apron: '#f7f2e6' },
  clotilde: { skin: '#f0c8a8', hair: '#8a5a3a', hairStyle: 'bun', top: ['#e89ab0', '#f8b8c8', '#b86a84'], pants: '#8a5a6a', hat: { kind: 'straw', color: '#e9c87a' } },
  pimenta: { skin: '#f4cfa8', hair: '#7a2a1c', hairStyle: 'long', top: ['#4a8a6a', '#6aaa88', '#346a4e'], pants: '#4a3a30', scarf: '#c0392b', held: 'mug' },
  villagerA: { skin: '#c8a07a', hair: '#4a3020', hairStyle: 'short', beard: true, top: ['#b89a7a', '#d4b898', '#8c7254'], pants: '#4a4038' },
  villagerB: { skin: '#f0c8a0', hair: '#6a4a2a', hairStyle: 'short', top: ['#a6c9a0', '#c4e0be', '#7a9e74'], pants: '#5a5040', hat: { kind: 'cap', color: '#6a4a2a' } },
  kid: { skin: '#f8d8b0', hair: '#b8782a', hairStyle: 'short', top: ['#f0c868', '#ffe090', '#c89a40'], pants: '#4a6a9a', kid: true },
};

const HEN_COLORS = ['#f4efe6', '#9a5a2c', '#3a3430', '#e0c890', '#b4472a'];

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, kit, fx, openMap, summonHen } = ctx;
  const rng = mulberry32(1707);
  const sp = buildSmallProps();

  // ---------- progresso de saves antigos: a vila já concluída vale como tudo resolvido ----------
  if (game.flag('villageDone')) {
    for (const f of ['letterRead', 'horseShod', 'millFixed']) game.setFlag(f);
    for (const q of Object.keys(T.quests)) game.setQuest(q, 'done');
    for (const i of ['espada', 'mochila', 'chave_trigo', 'mapa'] as ItemId[]) if (!game.has(i)) game.addItem(i);
  }

  // ---------- pontos do mapa (px) ----------
  const SMITH = P(-20, -20);
  const MARKET = P(23, -17);
  const TAVERN: Pt = [640, 832];
  const CHURCH: Pt = [1190, 802];
  const BARN: Pt = [1250, 982];
  const MILL: Pt = [610, 566];
  const HOMES: [0 | 1, Pt][] = [
    [0, P(-14, 31)],
    [1, P(17, 32)],
    [0, [704, 1196]],
    [1, [1100, 1162]],
    [0, P(-48, 12)],
    [1, P(41, -26)],
  ];
  const COOP: Pt = [494, 1060];
  const PEN: PenSpec = { x: 564, y: 1088, r: 56, gate: { x: 614, y: 1088 } };
  const PADDOCK = { x: 1243, y: 1128, hx: 77, hy: 70 };
  const WHEAT = { x: 550, y: 673, w: 106, h: 118 };
  const GATE_Y = 428;
  const PLAZA = { x: 900, y: 826, rx: 104, ry: 64 };

  // ---------- estradas ----------
  const main = new Route([[2, 76], [0, 52], [-3, 32], [0, 14], [0, 0], [0, -16], [2, -38], [0, -58]].map(([x, z]) => P(x, z)));
  const east = new Route([[0, 2], [20, 5], [34, 16], [46, 33]].map(([x, z]) => P(x, z)));
  const west = new Route([[0, 0], [-22, 3], [-31, 12], [-42, 28], [-44, 38]].map(([x, z]) => P(x, z)));
  const millRoad = new Route([[795, 736], [718, 652], [662, 603], [636, 584]]);
  const roads = [main, east, west, millRoad];
  const nearestRoad = (x: number, y: number): Pt => {
    let best: Pt = main.pts[0];
    let bd = Infinity;
    for (const r of roads) {
      for (const p of r.pts) {
        const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    return best;
  };
  /** Trilhazinha da porta de uma construção até a estrada mais perto. */
  const spur = (x: number, y: number): Route => {
    const to = nearestRoad(x, y + 12);
    return new Route([[x, y + 8], [(x + to[0]) / 2 + 6, (y + 12 + to[1]) / 2], to]);
  };
  const doors: Pt[] = [
    [SMITH[0] - 14, SMITH[1]],
    MARKET,
    TAVERN,
    [CHURCH[0] + 6, CHURCH[1]],
    ...HOMES.map(([, p]) => p),
  ];
  const spurs = doors.map(([x, y]) => spur(x, y));
  const grid = new DistanceGrid(W, H, [...roads, ...spurs], 140);

  // ---------- chão ----------
  const ground = paintGround({
    w: W,
    h: H,
    seed: 17,
    paths: [
      { pts: main.pts, width: 40 },
      { pts: east.pts, width: 28 },
      { pts: west.pts, width: 28 },
      { pts: millRoad.pts, width: 24 },
      ...spurs.map((s) => ({ pts: s.pts, width: 20 })),
    ],
    tufts: Math.round((W * H) / 800),
    flowers: 260,
    leaves: 500,
    cobble: false,
    decor: (g, r) => {
      // canteiros de flores ao lado das portas e nos cantos da praça, e uma hortinha
      const petals = ['#ff8aa8', '#ffe36a', '#ffffff', '#b89aff', '#ff9a4a', '#8ac8ff'];
      const bed = (x: number, y: number, w: number, h: number) => {
        g.fillStyle = '#3a2418';
        g.fillRect(Math.round(x - w / 2) - 1, Math.round(y - h / 2) - 1, w + 2, h + 2);
        g.fillStyle = '#6a4a2c';
        g.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
        for (let i = 0; i < (w * h) / 5; i++) {
          const fx = Math.round(x - w / 2 + 1 + r() * (w - 3));
          const fy = Math.round(y - h / 2 + 2 + r() * (h - 4));
          g.fillStyle = '#3a7a30';
          g.fillRect(fx, fy + 1, 1, 1);
          g.fillStyle = petals[Math.floor(r() * petals.length)];
          g.fillRect(fx, fy, 1, 1);
          if (r() < 0.45) g.fillRect(fx + 1, fy, 1, 1);
        }
      };
      for (const [variant, [hx, hy]] of HOMES) {
        const half = (variant === 0 ? 70 : 62) / 2 + 16;
        bed(hx - half, hy + 3, 16, 9);
        bed(hx + half, hy + 3, 16, 9);
      }
      for (const [dx, dy] of [[-92, -50], [92, -50], [-92, 56], [92, 56]]) bed(PLAZA.x + dx, PLAZA.y + dy, 20, 10);
      bed(TAVERN[0] - 68, TAVERN[1] + 4, 18, 9);
      bed(CHURCH[0] + 50, CHURCH[1] + 4, 18, 9);
      // horta: três fileiras de repolhos e folhas ao lado da casa do oeste
      const gx = HOMES[4][1][0] + 12;
      const gy = HOMES[4][1][1] + 30;
      g.fillStyle = '#5a3c22';
      g.fillRect(gx - 26, gy - 2, 52, 26);
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 7; k++) {
          const cx = gx - 22 + k * 7;
          const cy = gy + 3 + row * 8;
          g.fillStyle = '#2e6a2a';
          g.fillRect(cx - 2, cy, 5, 3);
          g.fillStyle = row === 1 ? '#c8a8d8' : '#7ac04a';
          g.fillRect(cx - 1, cy - 1, 3, 3);
          g.fillStyle = '#d8f0a0';
          g.fillRect(cx, cy, 1, 1);
        }
      }
      // praça de pedra em volta do poço
      const stone = ['#8c7e6e', '#9c8e7c', '#7a6c5e', '#a89a88'];
      for (let row = 0, y = PLAZA.y - PLAZA.ry; y < PLAZA.y + PLAZA.ry; row++, y += 5) {
        for (let x = PLAZA.x - PLAZA.rx - 6; x < PLAZA.x + PLAZA.rx; x += 9) {
          const xx = x + (row % 2) * 4;
          const dx = (xx + 4 - PLAZA.x) / PLAZA.rx;
          const dy = (y + 2 - PLAZA.y) / PLAZA.ry;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const h = Math.sin(xx * 12.9 + y * 78.2) * 43758.5453;
          g.fillStyle = '#4e4036';
          g.fillRect(xx, y, 8, 5);
          g.fillStyle = d > 0.88 ? '#6a5c4e' : stone[Math.floor((h - Math.floor(h)) * stone.length)];
          g.fillRect(xx + 1, y, 7, 4);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(xx + 1, y, 7, 1);
        }
      }
      // terra batida do cercado do cavalo
      const px0 = PADDOCK.x - PADDOCK.hx + 3;
      const py0 = PADDOCK.y - PADDOCK.hy + 3;
      for (let y = py0; y < PADDOCK.y + PADDOCK.hy - 3; y++) {
        for (let x = px0; x < PADDOCK.x + PADDOCK.hx - 3; x++) {
          const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const f = h - Math.floor(h);
          g.fillStyle = f > 0.93 ? '#a07c54' : f < 0.07 ? '#5c4228' : (x + y) % 11 < 5 ? '#7c5e3c' : '#86683f';
          g.fillRect(x, y, 1, 1);
        }
      }
      // chão do galinheiro
      for (let y = PEN.y - PEN.r; y < PEN.y + PEN.r; y++) {
        for (let x = PEN.x - PEN.r; x < PEN.x + PEN.r; x++) {
          if ((x - PEN.x) ** 2 + (y - PEN.y) ** 2 > (PEN.r - 4) ** 2) continue;
          const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const f = h - Math.floor(h);
          g.fillStyle = f > 0.96 ? '#c4aa72' : f < 0.1 ? '#745636' : (x + y) % 9 < 4 ? '#8a6c46' : '#94744c';
          g.fillRect(x, y, 1, 1);
        }
      }
      // trigal
      const x0 = WHEAT.x - WHEAT.w / 2;
      const y0 = WHEAT.y - WHEAT.h / 2;
      g.fillStyle = '#9c7a2c';
      g.fillRect(x0, y0, WHEAT.w, WHEAT.h);
      for (let y = y0 + 3; y < y0 + WHEAT.h - 2; y += 4) {
        for (let x = x0 + 1; x < x0 + WHEAT.w - 1; x += 3) {
          const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const f = h - Math.floor(h);
          g.fillStyle = f > 0.66 ? '#f4d868' : f > 0.3 ? '#e0b83c' : '#c89a2c';
          g.fillRect(x, y - 2, 1, 4);
          g.fillStyle = f > 0.5 ? '#fff0a0' : '#f4d868';
          g.fillRect(x, y - 3, 1, 2);
        }
      }
      g.fillStyle = '#6a5a1c';
      g.fillRect(x0 - 1, y0 - 1, WHEAT.w + 2, 1);
      g.fillRect(x0 - 1, y0 + WHEAT.h, WHEAT.w + 2, 1);
    },
  });

  // ---------- colisão ----------
  const col = new Collision(W, H);
  col.extra = (x, y) => outside(x, y);
  const props: Prop[] = [];

  // ---------- construções ----------
  const lights: ((t: number, dark: number) => Light | null)[] = [];
  const smoke = (v: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number) => {
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.32 + i / 5 + seed) % 1;
      const s = 2 + Math.round(ph * 4);
      v.fillStyle = `rgba(250,244,236,${((1 - ph) * 0.55).toFixed(2)})`;
      v.fillRect(Math.round(x + Math.sin(ph * 6 + i + seed * 9) * 3 + ph * 5 - s / 2), Math.round(y - ph * 32), s, s);
    }
  };
  const building = (s: Sprite, x: number, y: number, extra?: (v: CanvasRenderingContext2D, sx: number, sy: number, t: number) => void, depth = 0.62) => {
    props.push({
      kind: 'custom',
      x,
      y,
      shadowRx: s.wallW / 2 + 8,
      shadowRy: 7,
      shadowDx: 10,
      draw: (v, sx, sy, t) => {
        v.drawImage(s.img, Math.round(sx - s.w / 2), sy - s.h);
        if (s.chimney) smoke(v, sx + s.chimney.x, sy + s.chimney.y, t, x * 0.013);
        extra?.(v, sx, sy, t);
      },
    });
    col.addRect(x - s.wallW / 2, y - s.wallH * depth, x + s.wallW / 2, y);
  };

  const smith = buildSmith();
  building(smith, SMITH[0], SMITH[1], (v, sx, sy, t) => {
    // brasas da forja piscando no nicho
    const f = smith.forge!;
    const fl = Math.sin(t * 14) + Math.sin(t * 23);
    const fx0 = sx + f.x;
    const fy0 = sy + f.y;
    v.fillStyle = '#d83a20';
    v.fillRect(fx0 - 6, fy0 + 2, 12, 5);
    v.fillStyle = '#ff9a2a';
    v.fillRect(fx0 - 4, fy0 - 1 + Math.round(fl * 0.4), 8, 6);
    v.fillStyle = '#ffe070';
    v.fillRect(fx0 - 2, fy0 - 3 + Math.round(fl * 0.5), 4, 5);
    if (Math.random() < 0.05) fx.spark(SMITH[0] + f.x + (Math.random() - 0.5) * 8, SMITH[1] + f.y - 4);
  });
  lights.push((t) => ({ x: SMITH[0] + smith.forge!.x, y: SMITH[1] + smith.forge!.y, r: 80, col: [255, 138, 58], a: 0.5 + Math.sin(t * 9) * 0.06 + Math.sin(t * 14.3) * 0.04, night: true }));
  building(buildMarket(), MARKET[0], MARKET[1], undefined, 0.38);
  building(buildTavern(), TAVERN[0], TAVERN[1]);
  building(buildChurch(), CHURCH[0], CHURCH[1]);
  const barn = buildBarn();
  building(barn, BARN[0], BARN[1]);
  HOMES.forEach(([variant, [hx, hy]], i) => building(buildHouse(variant, 60 + i), hx, hy));
  const coop = sp.coop;
  building(coop, COOP[0], COOP[1], undefined, 0.5);

  // moinho: o corpo e as pás
  const mill = buildMill();
  let fanAngle = 0;
  props.push({
    kind: 'custom',
    x: MILL[0],
    y: MILL[1],
    shadowRx: 38,
    shadowRy: 8,
    shadowDx: 14,
    draw: (v, sx, sy) => {
      v.drawImage(mill.img, Math.round(sx - mill.w / 2), sy - mill.h);
      drawFan(v, sx + mill.hub!.x, sy + mill.hub!.y, fanAngle, !millRunning());
    },
  });
  col.addRect(MILL[0] - mill.wallW / 2, MILL[1] - 20, MILL[0] + mill.wallW / 2, MILL[1]);

  // poço da praça
  const well = buildWell();
  props.push({ kind: 'custom', x: PLAZA.x, y: PLAZA.y + 8, shadowRx: 22, shadowRy: 5, shadowDx: 6, draw: (v, sx, sy) => v.drawImage(well.img, Math.round(sx - well.w / 2), sy - well.h) });
  col.addRect(PLAZA.x - 16, PLAZA.y - 6, PLAZA.x + 16, PLAZA.y + 8);

  // ---------- portão norte ----------
  const wallPiece = buildWallPiece();
  const pillar = buildGatePillar();
  const GATE_HALF = 48;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const wx = OX + side * (GATE_HALF + 16 + i * 28);
      props.push({ kind: 'custom', x: wx, y: GATE_Y, draw: (v, sx, sy) => v.drawImage(wallPiece, sx - 14, sy - 40) });
    }
    col.addRect(side > 0 ? OX + GATE_HALF + 10 : OX - GATE_HALF - 300, GATE_Y - 12, side > 0 ? OX + GATE_HALF + 300 : OX - GATE_HALF - 10, GATE_Y + 3);
    props.push({ kind: 'custom', x: OX + side * GATE_HALF, y: GATE_Y + 2, shadowRx: 12, shadowRy: 4, shadowDx: 5, draw: (v, sx, sy) => v.drawImage(pillar, sx - 11, sy - 74) });
    col.addCircle(OX + side * GATE_HALF, GATE_Y - 2, 10);
  }
  let gateOpen = game.flag('villageDone') ? 1 : 0;
  props.push({
    kind: 'custom',
    x: OX,
    y: GATE_Y + 1,
    draw: (v, sx, sy) => {
      // as duas folhas de madeira: fechadas cobrem a passagem; abertas, encostadas nos pilares
      const half = 36;
      const leaf = Math.round(half * (1 - gateOpen * 0.86));
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? sx - half - 1 : sx + half - leaf + 1;
        v.fillStyle = OUTLINE;
        v.fillRect(x0 - 1, sy - 49, leaf + 2, 49);
        v.fillStyle = '#7a4a2c';
        v.fillRect(x0, sy - 48, leaf, 48);
        v.fillStyle = '#9c6a3c';
        for (let xx = x0; xx < x0 + leaf; xx += 5) v.fillRect(xx, sy - 48, 1, 48);
        v.fillStyle = '#3a3a48';
        v.fillRect(x0, sy - 38, leaf, 3);
        v.fillRect(x0, sy - 14, leaf, 3);
        if (gateOpen < 0.5) {
          v.fillStyle = '#e0b84a';
          v.fillRect(side < 0 ? x0 + leaf - 5 : x0 + 3, sy - 26, 2, 5);
        }
      }
    },
  });
  const gateBarrier = col.addRect(OX - GATE_HALF + 10, GATE_Y - 10, OX + GATE_HALF - 10, GATE_Y + 3);

  // ---------- cercas ----------
  const fenceCircle = (x: number, y: number) => col.addCircle(x, y, 4.5);
  const fence = (pts: Pt[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(len / 12));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const y = ay + ((by - ay) * k) / n;
        const dx = (bx - ax) / n;
        const dy = (by - ay) / n;
        props.push({
          kind: 'custom',
          x,
          y,
          shadowRx: 5,
          shadowRy: 2,
          shadowDx: 3,
          draw: (v, sx, sy) => {
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
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 14, 4, 15);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 13, 2, 13);
            v.fillStyle = '#c08a54';
            v.fillRect(sx - 1, sy - 13, 1, 13);
          },
        });
        fenceCircle(x, y);
      }
    }
    const [lx, ly] = pts[pts.length - 1];
    fenceCircle(lx, ly);
  };
  const pdx = PADDOCK.hx;
  const pdy = PADDOCK.hy;
  fence([
    [PADDOCK.x + 22, PADDOCK.y - pdy],
    [PADDOCK.x + pdx, PADDOCK.y - pdy],
    [PADDOCK.x + pdx, PADDOCK.y + pdy],
    [PADDOCK.x - pdx, PADDOCK.y + pdy],
    [PADDOCK.x - pdx, PADDOCK.y - pdy],
    [PADDOCK.x - 22, PADDOCK.y - pdy],
  ]);
  const ring: Pt[] = [];
  for (let i = 0; i <= 15; i++) {
    const a = PEN_MOUTH + (i / 15) * (Math.PI * 2 - 2 * PEN_MOUTH);
    ring.push([PEN.x + Math.cos(a) * PEN.r, PEN.y + Math.sin(a) * PEN.r]);
  }
  fence(ring);

  // ---------- objetos de gente ----------
  const small = (img: HTMLCanvasElement, x: number, y: number, blocks = 0, rx = 0) => {
    props.push({ kind: 'custom', x, y, shadowRx: rx || img.width * 0.5, shadowRy: 3, shadowDx: 2, draw: (v, sx, sy) => v.drawImage(img, Math.round(sx - img.width / 2), sy - img.height + 2) });
    if (blocks > 0) col.addCircle(x, y - 3, blocks);
  };
  // ferraria
  small(sp.rack, SMITH[0] - 62, SMITH[1] + 8, 9);
  small(sp.crate, SMITH[0] + 66, SMITH[1] - 4, 8);
  small(sp.barrel, SMITH[0] - 60, SMITH[1] - 10, 6);
  small(sp.crateSmall, SMITH[0] - 46, SMITH[1] + 10, 6);
  // barraca
  small(sp.sack, MARKET[0] - 66, MARKET[1] - 2, 6);
  small(sp.sack, MARKET[0] - 76, MARKET[1] + 6, 6);
  small(sp.barrow, MARKET[0] + 70, MARKET[1] + 4, 9);
  small(sp.crate, MARKET[0] + 86, MARKET[1] - 6, 8);
  // taverna
  small(sp.barrel, TAVERN[0] - 70, TAVERN[1], 6);
  small(sp.barrel, TAVERN[0] - 58, TAVERN[1] + 8, 6);
  small(sp.bucket, TAVERN[0] + 70, TAVERN[1] + 2);
  small(sp.crateSmall, TAVERN[0] + 64, TAVERN[1] + 10, 6);
  // estábulo e cercado
  small(sp.hay, BARN[0] - 74, BARN[1] - 2, 11);
  small(sp.hay, BARN[0] + 76, BARN[1] + 2, 11);
  small(sp.lumber, BARN[0] + 96, BARN[1] - 14, 12);
  small(sp.trough, PADDOCK.x - 50, PADDOCK.y - pdy + 18, 0);
  small(sp.sack, BARN[0] - 54, BARN[1] + 6, 5);
  // moinho
  small(sp.sack, MILL[0] + 44, MILL[1] + 8, 6);
  small(sp.sack, MILL[0] + 52, MILL[1] + 14, 6);
  small(sp.barrow, MILL[0] + 70, MILL[1] + 26, 9);
  // espantalho: leva golpes (balança e solta palha); com a espada, uns 9 golpes derrubam o chapéu de palha
  const SC = { x: WHEAT.x, y: WHEAT.y + 8 };
  const scare = { hits: 0, sway: 0, swayV: 0, lastSwing: -1, stickMsg: false, hatFall: game.flag('scarecrowHat') ? 2 : -1 };
  const hatOnGround = () => scare.hatFall >= 1 && !game.has('chapeu_palha');
  props.push({
    kind: 'custom',
    x: SC.x,
    y: SC.y,
    shadowRx: 8,
    shadowRy: 3,
    draw: (v, sx, sy) => {
      v.save();
      v.translate(sx, sy);
      v.rotate(scare.sway * 0.18);
      v.drawImage(scare.hatFall < 0 ? sp.scarecrow : sp.scarecrowBare, -14, -38);
      v.restore();
    },
  });
  // o chapéu caindo e, depois, no chão
  props.push({
    kind: 'custom',
    x: SC.x + 14,
    y: SC.y + 12,
    draw: (v, sx, sy) => {
      const img = itemCanvas('chapeu_palha');
      if (!img || scare.hatFall < 0 || game.has('chapeu_palha')) return;
      const k = Math.min(1, scare.hatFall);
      const up = (1 - k * k) * 38;
      v.save();
      v.translate(sx, sy - 6 - up);
      v.rotate((1 - k) * 7);
      v.drawImage(img, -8, -8);
      v.restore();
    },
  });
  // casas
  HOMES.forEach(([, [hx, hy]], i) => {
    small(i % 2 ? sp.lumber : sp.barrel, hx + (i % 2 ? 54 : -50), hy + 2, i % 2 ? 11 : 6);
    small(i % 2 ? sp.bucket : sp.crateSmall, hx + (i % 2 ? -48 : 48), hy + 6, i % 2 ? 0 : 6);
  });
  small(sp.barrel, CHURCH[0] + 58, CHURCH[1] - 2, 6);
  // bandeirolas na praça
  small(sp.flag, P(11, 10)[0], P(11, 10)[1], 4);
  small(sp.flag, P(-11, -10)[0], P(-11, -10)[1], 4);
  // lampiões ao longo da estrada
  [1290, 1180, 1060, 950, 700, 590, 500].forEach((y, i) => {
    const x = 900 + (i % 2 ? 34 : -34) + (y > 1000 ? (y - 1000) * -0.05 : 0);
    props.push({ kind: 'lantern', x, y });
    col.addCircle(x, y, 3);
  });

  // ---------- natureza: mata em volta, árvores soltas, arbustos, flores ----------
  const exclusions: { x: number; y: number; r: number }[] = [
    { x: PLAZA.x, y: PLAZA.y, r: 150 },
    { x: SMITH[0], y: SMITH[1] - 20, r: 110 },
    { x: MARKET[0], y: MARKET[1] - 20, r: 110 },
    { x: TAVERN[0], y: TAVERN[1] - 20, r: 110 },
    { x: CHURCH[0], y: CHURCH[1] - 40, r: 110 },
    { x: BARN[0], y: BARN[1] - 20, r: 130 },
    { x: MILL[0], y: MILL[1] - 40, r: 110 },
    { x: COOP[0], y: COOP[1], r: 70 },
    { x: PEN.x, y: PEN.y, r: PEN.r + 70 },
    { x: PADDOCK.x, y: PADDOCK.y, r: 130 },
    { x: WHEAT.x, y: WHEAT.y, r: 100 },
    { x: OX, y: GATE_Y - 20, r: 90 },
    ...HOMES.map(([, p]) => ({ x: p[0], y: p[1] - 20, r: 90 })),
  ];
  const inZone = (x: number, y: number, extra = 0) => exclusions.some((e) => Math.hypot(x - e.x, y - e.y) < e.r + extra);
  const cell = new Map<string, boolean>();
  const taken = (x: number, y: number, size: number) => {
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cell.get(`${size}:${cx + a}:${cy + b}`)) return true;
    return false;
  };
  const mark = (x: number, y: number, size: number) => cell.set(`${size}:${Math.floor(x / size)}:${Math.floor(y / size)}`, true);
  let treeCount = 0;
  for (let tries = 0; treeCount < 1250 && tries < 70000; tries++) {
    const x = 16 + rng() * (W - 32);
    const y = 16 + rng() * (H - 32);
    const out = outside(x, y);
    const inside = !out;
    if (inside && (rng() > 0.18 || grid.distance(x, y) < 58 || inZone(x, y))) continue;
    if (!inside && (Math.hypot((x - ELL.x) / ELL.rx, (y - ELL.y) / ELL.ry) < 0.97)) continue;
    if (taken(x, y, inside ? 70 : 48)) continue;
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    mark(x, y, inside ? 70 : 48);
    treeCount++;
    if (inside) col.addCircle(x, y, 4);
  }
  const scatter = (kind: Prop['kind'], n: number, make: () => Partial<Prop>, spacing: number, blocks = 0) => {
    let c = 0;
    for (let t = 0; c < n && t < 20000; t++) {
      const x = 40 + rng() * (W - 80);
      const y = 40 + rng() * (H - 80);
      if (outside(x, y) || grid.distance(x, y) < 30 || inZone(x, y, -20) || ground.isPath(x, y) || taken(x, y, spacing)) continue;
      props.push({ kind, x, y, ...make() });
      mark(x, y, spacing);
      if (blocks) col.addCircle(x, y, blocks);
      c++;
    }
  };
  scatter('bush', 90, () => ({ img: kit.bushes[Math.floor(rng() * kit.bushes.length)] }), 34);
  scatter('rock', 40, () => ({ img: kit.rocks[Math.floor(rng() * kit.rocks.length)] }), 40);
  scatter('fern', 90, () => ({ img: kit.ferns[Math.floor(rng() * kit.ferns.length)] }), 22);
  for (let i = 0; i < 700; i++) {
    const x = 40 + rng() * (W - 80);
    const y = 40 + rng() * (H - 80);
    if (outside(x, y) || ground.isPath(x, y) || inZone(x, y, -30)) continue;
    props.push({ kind: 'grass', x, y, phase: rng() * 6.28 });
  }

  // ---------- pessoas ----------
  const lookP = (spec: PersonSpec, x: number, y: number, opts: ConstructorParameters<typeof Person>[3]) => new Person(spec, x, y, opts);
  const tito = lookP(SPEC.tito, 1172, 1006, { facing: 'right', watchPlayer: true, work: { every: 11 } });
  const brutus = lookP(SPEC.brutus, SMITH[0] + 46, SMITH[1] + 16, { facing: 'up', watchPlayer: true, work: { every: 9 } });
  const alvim = lookP(SPEC.alvim, MILL[0] + 40, MILL[1] + 28, { facing: 'left', watchPlayer: true, work: { every: 12 } });
  const clotilde = lookP(SPEC.clotilde, PEN.x + 96, PEN.y + 34, { facing: 'left', watchPlayer: true, work: { every: 14 } });
  const pimenta = lookP(SPEC.pimenta, MARKET[0] + 26, MARKET[1] + 18, { facing: 'down', watchPlayer: true });
  const route = (pts: [number, number][]) => pts.map(([x, z]) => P(x, z));
  const villagerA = lookP(SPEC.villagerA, ...route([[9, 9]])[0], { patrol: route([[9, 9], [-9, 11], [-12, -5], [8, -9]]), watchPlayer: true, mutters: T.mutters.villagerA });
  const kid = lookP(SPEC.kid, ...route([[-6, 6]])[0], { patrol: route([[-6, 6], [6, 4], [12, -2], [-4, -8]]), watchPlayer: true, mutters: T.mutters.kid });
  const talkers = [tito, brutus, alvim, clotilde, pimenta];
  const folks = [...talkers, villagerA, kid];
  for (const n of talkers) col.addCircle(n.x, n.y, 6);

  // ---------- o cavalo ----------
  const shod = () => game.flag('horseShod');
  const horseName = T.horseName;
  const wanderIn = (): Horse['behavior'] => ({ kind: 'wander', x: PADDOCK.x, y: PADDOCK.y + 10, rx: PADDOCK.hx - 26, ry: PADDOCK.hy - 30, skittish: false });
  const horse = new Horse(PADDOCK.x, PADDOCK.y + 10);
  horse.saddled = true;
  const horseTrusted = () => game.flag('letterRead');
  let horsePlaced = !shod();
  if (shod()) horse.behavior = { kind: 'follow' };
  else horse.behavior = wanderIn();
  let riding = false;

  function mount() {
    if (riding || !shod() || reuniting) return;
    riding = true;
    audio.play('mount');
    player.x = horse.x;
    player.y = horse.y;
    player.riding = true;
    horse.behavior = { kind: 'ridden' };
    game.setFlag('riding', true);
  }
  function dismount() {
    if (!riding) return;
    riding = false;
    player.riding = false;
    horse.behavior = { kind: 'follow' };
    for (const [dx, dy] of [[20, 0], [-20, 0], [0, 18], [0, -18], [20, 18], [-20, 18]]) {
      if (col.free(horse.x + dx, horse.y + dy, player.radius)) {
        player.x = horse.x + dx;
        player.y = horse.y + dy;
        break;
      }
    }
    game.setFlag('riding', false);
  }

  // ---------- galinhas ----------
  const hens: Chick[] = [];
  const wild: Chick[] = [];
  const spriteSets = HEN_COLORS.map((c) => henSprites(kit, c));
  const addHen = (x: number, y: number, r: number, isWild: boolean) => {
    const c = new Chick(x, y, spriteSets[hens.length % spriteSets.length], { x, y, r }, isWild ? PEN : undefined);
    hens.push(c);
    if (isWild) wild.push(c);
    return c;
  };
  // soltas pela vila, só para dar vida
  for (const [x, z, r] of [[-6, 8, 9], [6, -6, 9], [10, 14, 7], [-12, 24, 6], [44, 38, 5], [38, 30, 5], [-44, 30, 6]] as const) {
    const [hx, hy] = P(x, z);
    addHen(hx, hy, r * 5, false);
  }
  // as seis fugitivas
  const hensDone = () => game.quest('hens') === 'done';
  const WILD_AT: Pt[] = [[718, 1112], [1040, 584], [494, 776], [1150, 1056], [956, 512], [858, 1254]];
  WILD_AT.slice(0, HEN_NAMES).forEach(([x, y], i) => {
    if (hensDone()) {
      const a = (i / HEN_NAMES) * Math.PI * 2;
      const c = addHen(PEN.x + Math.cos(a) * 22, PEN.y + Math.sin(a) * 22, 30, true);
      c.enterPen();
    } else addHen(x, y, 36, true);
  });
  // a galinha que vai virar companheira: espera ao lado da barraca do mercado
  const demoHen = new Chick(MARKET[0] - 100, MARKET[1] - 36, spriteSets[0], { x: MARKET[0] - 100, y: MARKET[1] - 36, r: 14 });
  const pennedCount = () => wild.filter((c) => c.penned).length;
  let lastPenned = pennedCount();

  // ---------- estado ----------
  const millRunning = () => game.flag('millFixed');

  function objective(): string | null {
    const o = T.objective;
    if (!horseTrusted()) return game.quest('horse') === 'new' ? o.talkStable : o.approachHorse;
    if (game.flag('villageDone')) return o.done;
    if (!shod()) {
      if (game.has('ferradura')) return o.bringShoes;
      if (game.quest('shoes') === 'new') return o.talkSmith;
      return o.forgeShoes;
    }
    if (!game.has('chave_trigo')) {
      const mq = game.quest('mill');
      if (mq === 'new') return o.talkMiller;
      return millRunning() ? o.returnMiller : o.fixMill;
    }
    if (!game.has('mapa')) return o.order;
    return o.gate;
  }

  const alerts = {
    tito: () => (!horseTrusted() && game.quest('horse') === 'new') || (game.has('ferradura') && !shod()),
    brutus: () => horseTrusted() && game.quest('shoes') === 'new',
    alvim: () => horseTrusted() && (game.quest('mill') === 'new' || (game.quest('mill') === 'active' && millRunning())),
    clotilde: () => game.quest('hens') === 'new' || (game.quest('hens') === 'active' && pennedCount() >= HEN_NAMES),
    pimenta: () => horseTrusted() && game.quest('order') !== 'done',
  };

  let barrierOn = true;
  function refresh() {
    ui.setObjective(objective());
    if (game.flag('villageDone') && barrierOn) {
      col.remove(gateBarrier);
      barrierOn = false;
    }
    horse.saddled = true;
  }
  const stopRefresh = game.onChange(refresh);

  // ---------- diálogos ----------
  const toastItem = (id: ItemId) => ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  const giveItem = (id: ItemId, n = 1) => {
    game.addItem(id, n);
    toastItem(id);
  };
  const giveCoins = (n: number) => {
    game.addCoins(n);
    ui.toast(fmt(content.ui.gotCoins, { n }));
  };
  const startQuest = (id: QuestId) => {
    game.setQuest(id, 'active');
    ui.toast(fmt(content.ui.newQuest, { title: T.quests[id].title }));
  };
  const finishQuest = (id: QuestId) => {
    game.setQuest(id, 'done');
    ui.toast(fmt(content.ui.questDone, { title: T.quests[id].title }));
    giveCoins(T.quests[id].coins);
  };
  /** Mostra as falas e termina com uma pergunta de escolhas (a última fala vira a pergunta). */
  async function converse(lines: readonly string[], options: readonly string[], who: string) {
    if (lines.length > 1) await ui.tell(lines.slice(0, -1), who);
    return ui.ask(lines[lines.length - 1], options, who);
  }
  const named = (lines: readonly string[]) => lines.map((l) => fmt(l, { name: horseName }));

  async function talkStable() {
    const s = T.stable;
    const who = T.npcs.stable.name;
    tito.gesture();
    if (!horseTrusted()) {
      if (game.quest('horse') === 'new') {
        await ui.tell(s.first, who);
        startQuest('horse');
      } else await ui.tell(s.waiting, who);
      return;
    }
    if (game.has('ferradura') && !shod()) {
      await ui.tell(s.shoeFit.slice(0, 2), who);
      game.removeItem('ferradura');
      game.setFlag('horseShod');
      horse.behavior = { kind: 'follow' };
      finishQuest('shoes');
      await ui.tell(s.shoeFit.slice(2), who);
    } else if (shod()) await ui.tell(s.done, who);
    else await ui.tell(s.idleBeforeShoes, who);
  }

  /** O reencontro: o Armin reconhece o dono, vem trotando, e a bolsa da sela traz o bilhete da Helena. */
  let reuniting = false;
  async function reunite() {
    if (reuniting || horseTrusted()) return;
    reuniting = true;
    if (game.quest('horse') === 'new') game.setQuest('horse', 'active');
    player.frozen = true;
    horse.behavior = { kind: 'follow' };
    for (let i = 0; i < 40 && Math.hypot(player.x - horse.x, player.y - horse.y) > 52; i++) await new Promise((r) => setTimeout(r, 100));
    player.frozen = false;
    audio.play('cluck');
    // de frente para quem joga enquanto a bolsa se abre
    horse.behavior = { kind: 'wander', x: horse.x, y: horse.y, rx: 0, ry: 0, skittish: false };
    horse.front = true;
    await ui.tell(named(T.horse.reunion));
    await ui.letter(T.letter.title, T.letter.paragraphs, T.letter.close);
    game.setFlag('letterRead');
    giveItem('bilhete');
    finishQuest('horse');
    horse.front = false;
    horse.behavior = wanderIn();
    await ui.tell(T.stable.afterTrust, T.npcs.stable.name);
    reuniting = false;
  }

  async function talkSmith() {
    const s = T.smith;
    const who = T.npcs.smith.name;
    brutus.gesture();
    if (!horseTrusted()) {
      await ui.tell(s.noLetter, who);
      return;
    }
    const q = game.quest('shoes');
    const forge = async () => {
      await playForge(ui, { title: s.forgeTitle, hint: s.forgeHint, button: s.forgeButton, misses: s.forgeMiss, hits: s.forgeHit, cold: s.forgeCold });
      giveItem('ferradura');
      giveItem('espada');
      brutus.cheer();
      await ui.tell(s.forged, who);
    };
    if (q === 'new') {
      const pick = await converse(s.offer, [s.yes, s.no], who);
      if (pick === 0) {
        startQuest('shoes');
        await forge();
      } else await ui.tell(s.decline, who);
    } else if (q === 'active' && !game.has('ferradura') && !shod()) await forge();
    else if (q === 'active') await ui.tell(s.progress, who);
    else await ui.tell(s.done, who);
  }

  async function talkMiller() {
    const m = T.miller;
    const who = T.npcs.miller.name;
    alvim.gesture();
    if (!horseTrusted()) {
      await ui.tell(m.noLetter, who);
      return;
    }
    const q = game.quest('mill');
    if (q === 'new') {
      const pick = await converse(m.offer, [m.yes, m.no], who);
      if (pick === 0) {
        startQuest('mill');
        await ui.tell(m.accepted, who);
      } else await ui.tell(m.decline, who);
    } else if (q === 'active') {
      if (millRunning()) {
        await ui.tell(m.ready.slice(0, 2), who);
        if (!game.flag('flourMilled')) {
          await ui.tell(m.millIntro, who);
          await playMilling(ui, { title: m.millTitle, hint: m.millHint, done: m.millDone }, (v) => (fanBoost = v));
          fanBoost = 0;
          game.setFlag('flourMilled');
        }
        giveItem('chave_trigo');
        giveItem('farinha');
        alvim.cheer();
        await ui.tell(m.ready.slice(2), who);
        giveItem('mochila');
        finishQuest('mill');
        await ui.narrate(m.fragment.title, m.fragment.lines, 'fragment');
      } else await ui.tell(m.progress, who);
    } else await ui.tell(m.done, who);
  }

  async function talkHens() {
    const h = T.hens;
    const who = T.npcs.hens.name;
    clotilde.gesture();
    const q = game.quest('hens');
    if (q === 'new') {
      const pick = await converse([...h.first, h.offer], [h.yes, h.no], who);
      if (pick === 0) {
        startQuest('hens');
        await ui.tell(h.accepted, who);
      } else await ui.tell(h.decline, who);
    } else if (q === 'active') {
      if (pennedCount() >= HEN_NAMES) {
        await ui.tell(h.ready.slice(0, 2), who);
        clotilde.cheer();
        finishQuest('hens');
        await ui.tell(h.ready.slice(2), who);
      } else await ui.tell([fmt(h.progress, { n: HEN_NAMES - pennedCount() })], who);
    } else await ui.tell(h.done, who);
  }

  async function openShop() {
    const m = T.merchant;
    await ui.openShop({
      title: m.shopTitle,
      hint: m.shopHint,
      coins: () => game.coins,
      entries: () =>
        T.shop.map((e) => {
          const it = content.items[e.id as ItemId];
          return { id: e.id, icon: it.icon, name: it.name, desc: it.desc, price: e.price, owned: game.has(e.id) };
        }),
      onBuy: (id) => {
        const price = T.shop.find((e) => e.id === id)!.price;
        if (game.has(id)) return false;
        if (!game.spend(price)) {
          ui.toast(content.ui.notEnoughToast);
          return false;
        }
        game.addItem(id);
        toastItem(id as ItemId);
        ui.toast(fmt(content.ui.spentCoins, { n: price }));
        return true;
      },
    });
  }

  /** A encomenda esquecida: separar os itens nos cestos certos; recompensa o mapa e um pão. */
  async function orderQuest() {
    const o = T.order;
    const who = T.npcs.merchant.name;
    if (game.quest('order') === 'new') {
      const pick = await converse(o.intro, [o.yes, o.no], who);
      if (pick !== 0) {
        await ui.tell(o.decline, who);
        return;
      }
      startQuest('order');
      await ui.tell(o.accepted, who);
    } else await ui.tell(o.resume, who);
    await playSorting(ui, { title: o.title, hint: o.hint, confirm: o.confirm, incomplete: o.incomplete, wrong: o.wrong }, o.items, o.bins);
    await ui.tell(o.solved, who);
    pimenta.cheer();
    await ui.tell(o.reward.slice(0, 1), who);
    giveItem('mapa');
    giveItem('pao');
    finishQuest('order');
    await ui.tell(o.reward.slice(1), who);
  }

  async function talkMerchant() {
    const m = T.merchant;
    const who = T.npcs.merchant.name;
    pimenta.gesture();
    if (horseTrusted() && game.quest('order') !== 'done') {
      await orderQuest();
      return;
    }
    const pick = await ui.ask(m.greet[0], [m.menuShop, m.menuChat, m.menuBye], who);
    if (pick === 0) await openShop();
    else if (pick === 1) await ui.tell(game.has('ovos') ? m.chatEggs : shod() ? named(m.chatDone) : m.chat, who);
    else await ui.tell(m.bye, who);
  }

  let gateMapOpen = false;
  async function useGate() {
    const g = T.gate;
    if (game.flag('villageDone')) {
      await openMap();
      return;
    }
    if (!game.has('chave_trigo')) await ui.tell(g.noKey);
    else if (!game.has('mapa')) await ui.tell(g.noMap);
    else {
      await ui.tell(g.open);
      game.setFlag('villageDone');
      await openMap();
    }
  }

  async function fixGears() {
    const m = T.miller;
    await playGears(ui, { title: m.gearsTitle, hint: m.gearsHint, goal: m.gearsGoal, solved: m.gearsSolved });
    game.setFlag('millFixed');
    await ui.tell(T.gears.fixed);
  }

  async function meetHen() {
    audio.play('cluck');
    await ui.tell(T.hen.meet);
    henTaken = true;
    summonHen(demoHen.x, demoHen.y);
    ui.toast(fmt(T.hen.joined, { name: T.henName }));
  }
  let henTaken = game.flag('henMet');

  // ---------- interações ----------
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, markFn?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled, mark: markFn });

  add(tito.x, tito.y, 38, T.npcs.stable.prompt, () => void talkStable(), () => !riding, alerts.tito);
  add(brutus.x, brutus.y, 38, T.npcs.smith.prompt, () => void talkSmith(), () => !riding, alerts.brutus);
  add(alvim.x, alvim.y, 38, T.npcs.miller.prompt, () => void talkMiller(), () => !riding, alerts.alvim);
  add(clotilde.x, clotilde.y, 38, T.npcs.hens.prompt, () => void talkHens(), () => !riding, alerts.clotilde);
  add(pimenta.x, pimenta.y, 40, T.npcs.merchant.prompt, () => void talkMerchant(), () => !riding, alerts.pimenta);
  // moradores que passeiam: só falam quando o jogador interage (sem balões soltos)
  for (const [p, who] of [[villagerA, T.npcs.villagerA], [kid, T.npcs.kid]] as const) {
    let next = 0;
    interactables.push({
      get x() {
        return p.x;
      },
      get y() {
        return p.y;
      },
      radius: 36,
      prompt: who.prompt,
      enabled: () => !riding,
      onInteract: () => {
        p.faceToward(player.x, player.y);
        const line = p.mutters[next++ % p.mutters.length];
        if (line) void ui.tell([line], who.name);
      },
    });
  }
  interactables.push({
    get x() {
      return demoHen.x;
    },
    get y() {
      return demoHen.y;
    },
    radius: 34,
    prompt: T.hen.prompt,
    onInteract: () => void meetHen(),
    enabled: () => horseTrusted() && !henTaken && !game.flag('henMet'),
  });
  // testar a arma no espantalho e pegar o chapéu que cai
  const weaponNow = (): 'sword' | 'stick' | null => (player.stowed ? null : game.has('espada') ? 'sword' : game.has('galho') ? 'stick' : null);
  add(
    SC.x,
    SC.y,
    46,
    T.scarecrow.prompt,
    () => {
      player.face(Math.atan2(SC.y - player.y, SC.x - player.x));
      meleeAttack();
    },
    () => !riding && weaponNow() !== null && !hatOnGround(),
  );
  add(
    SC.x + 14,
    SC.y + 12,
    32,
    T.scarecrow.pick,
    () => {
      giveItem('chapeu_palha');
      game.setEquipped({ hat: true });
      ui.toast(T.scarecrow.got);
    },
    hatOnGround,
    hatOnGround,
  );
  const gearsAt: Pt = [MILL[0] - 52, MILL[1] + 22];
  const gearsOn = () => game.quest('mill') === 'active' && !millRunning();
  add(gearsAt[0], gearsAt[1], 40, T.gears.prompt, () => void fixGears(), gearsOn, gearsOn);
  interactables.push({
    get x() {
      return horse.x;
    },
    get y() {
      return horse.y;
    },
    radius: 44,
    prompt: () => fmt(horseTrusted() ? T.horse.mount : T.horse.greet, { name: horseName }),
    onInteract: () => (horseTrusted() ? mount() : void reunite()),
    enabled: () => !riding && !reuniting && (!horseTrusted() || shod()),
    mark: () => !horseTrusted(),
  });
  add(OX, GATE_Y + 44, 60, () => (game.flag('villageDone') ? T.gate.promptOpen : T.gate.prompt), () => void useGate(), () => !riding);

  // ---------- estado inicial ----------
  refresh();
  let fanSpeed = millRunning() ? 0.8 : 0;
  /** Velocidade extra do moinho enquanto o Matheus mói a farinha na manivela. */
  let fanBoost = 0;
  let horseBtn = '';
  let lastObjective = '';
  let objTimer = 0;

  // ---------- borboletas passeando sobre os canteiros ----------
  const butterflies: Drawable[] = [];
  const flowerSpots: Pt[] = [...HOMES.map(([, p]) => [p[0] + 40, p[1] + 3] as Pt), [PLAZA.x - 92, PLAZA.y - 50], [PLAZA.x + 92, PLAZA.y + 56], [TAVERN[0] - 68, TAVERN[1] + 4], [CHURCH[0] + 50, CHURCH[1] + 4]];
  const BUTTERFLY = ['#ffd24a', '#ff8aa8', '#8ac8ff', '#ffffff', '#c8a0ff'];
  flowerSpots.forEach(([bx, by], i) => {
    for (let k = 0; k < 2; k++) {
      const ph = rng() * 6.28;
      const sp = 0.5 + rng() * 0.5;
      const col = BUTTERFLY[(i + k) % BUTTERFLY.length];
      const pos = (t: number) => ({ x: bx + Math.sin(t * sp + ph) * 34 + Math.sin(t * 1.7 + ph) * 6, y: by + Math.cos(t * sp * 0.8 + ph) * 18 });
      butterflies.push({
        y: by + 100,
        draw: (v, cx, cy, t) => {
          const q = pos(t);
          const x = Math.round(q.x - cx);
          const y = Math.round(q.y - cy - 12 - Math.abs(Math.sin(t * 2.4 + ph)) * 5);
          const open = Math.sin(t * 16 + ph) > 0;
          v.fillStyle = col;
          v.fillRect(x - (open ? 2 : 1), y, open ? 2 : 1, 2);
          v.fillRect(x + 1, y, open ? 2 : 1, 2);
          v.fillStyle = '#3a2418';
          v.fillRect(x, y, 1, 2);
        },
      });
    }
  });

  const meleeAttack = () => {
    player.weapon = weaponNow();
    if (player.attack()) audio.play('swing');
  };
  const melee = {
    attack: meleeAttack,
    update(dt: number) {
      player.weapon = weaponNow();
      // balanço do espantalho (mola amortecida) e a queda do chapéu
      scare.swayV += -scare.sway * 60 * dt;
      scare.swayV *= Math.exp(-3.5 * dt);
      scare.sway += scare.swayV * dt;
      if (scare.hatFall >= 0 && scare.hatFall < 1) scare.hatFall = Math.min(1, scare.hatFall + dt * 1.6);
      if (!player.swinging || player.swingId === scare.lastSwing || !player.weapon) return;
      const sword = player.weapon === 'sword';
      const reach = sword ? 49 : 41;
      const dx = SC.x - player.x;
      const dy = SC.y - 18 - player.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + 12) return;
      const cos = (dx * Math.cos(player.facing) + dy * Math.sin(player.facing)) / (d || 1);
      if (cos < Math.cos(1.0) && d > 22) return;
      scare.lastSwing = player.swingId;
      audio.play('hit');
      scare.swayV += (dx >= 0 ? 1 : -1) * (sword ? 9 : 6);
      fx.burst(SC.x, SC.y - 22, sword ? 7 : 4, 0.45, '#e0b84a');
      if (scare.hatFall >= 0) return;
      if (!sword) {
        if (!scare.stickMsg) {
          scare.stickMsg = true;
          ui.toast(T.scarecrow.stick);
        }
        return;
      }
      scare.hits++;
      if (scare.hits === 5) ui.toast(T.scarecrow.loosen);
      if (scare.hits >= 9) {
        scare.hatFall = 0;
        game.setFlag('scarecrowHat');
        ui.toast(T.scarecrow.drop);
      }
    },
  };
  const area: Area2D = {
    id: 'village',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: {
      /** Quem chega da Floresta entra pela estrada do sul. */
      start: { x: P(2, 62)[0], y: P(2, 62)[1], dir: 'up' },
      /** Quem volta do mapa chega logo dentro do portão norte. */
      gate: { x: OX, y: GATE_Y + 64, dir: 'down' },
    },
    interactables,
    env: (() => {
      const e = cloneEnv(GOLDEN_MORNING);
      e.overhang = false;
      e.mist = 0.22;
      e.dapple = 0.85;
      return e;
    })(),
    torchLit: () => false,
    isPath: (x, y) => ground.isPath(x, y),
    melee,
    drawables(out) {
      for (const b of butterflies) out.push(b);
      for (const n of folks) out.push(n.drawable());
      out.push(horse.drawable());
      for (const c of hens) out.push(c.drawable());
      if (!henTaken && !game.flag('henMet') && horseTrusted()) out.push(demoHen.drawable());
    },
    lights(out, t) {
      for (const l of lights) {
        const r = l(t, 0);
        if (r) out.push(r);
      }
    },
    update(dt, t, pl) {
      const talking = ui.inDialog;
      for (const n of folks) n.update(dt, t, pl, col, talking);

      // o cavalo companheiro aparece ao lado do Matheus na primeira vez que a cena roda
      if (!horsePlaced) {
        horse.x = pl.x + 24;
        horse.y = pl.y + 14;
        horsePlaced = true;
      }
      horse.update(dt, player, col);

      // portão aberto: cruzar a soleira abre o Mapa do Reino (o que há além do portão está no mapa)
      if (game.flag('villageDone') && Math.abs(pl.x - OX) < GATE_HALF && pl.y < GATE_Y - 14 && !ui.inDialog && !gateMapOpen) {
        gateMapOpen = true;
        player.place(OX, GATE_Y + 22, 'down');
        void openMap().finally(() => (gateMapOpen = false));
      }

      // moinho
      fanSpeed += ((millRunning() ? 0.8 + fanBoost * 2.4 : 0) - fanSpeed) * (1 - Math.exp(-0.8 * dt));
      fanAngle += dt * fanSpeed;
      gateOpen += ((game.flag('villageDone') ? 1 : 0) - gateOpen) * (1 - Math.exp(-3 * dt));

      // galinhas: fogem do Matheus (e mais se ele vem a cavalo)
      const scare = 36 + Math.min(player.speed, 140) * 0.25 + (riding ? 10 : 0);
      for (const c of hens) c.update(dt, player, scare, col);
      if (!henTaken && !game.flag('henMet') && horseTrusted()) demoHen.update(dt, player, 0, col);
      const n = pennedCount();
      if (n !== lastPenned) {
        lastPenned = n;
        if (game.quest('hens') === 'active') ui.toast(fmt(T.hens.penToast, { n, total: HEN_NAMES }));
        refresh();
      }

      // botão do cavalo
      let want = '';
      if (shod() && !reuniting) {
        if (riding) want = T.horse.dismount;
        else if (Math.hypot(pl.x - horse.x, pl.y - horse.y) < 80) want = fmt(T.horse.mount, { name: horseName });
      }
      if (want !== horseBtn) {
        horseBtn = want;
        ui.setHorseButton(want || null, riding ? dismount : mount);
      }

      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.5;
        const o = objective() ?? '';
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o || null);
        }
      }
    },
    onEnter() {
      if (!horseTrusted() && !game.flag('village_arrived')) {
        game.setFlag('village_arrived');
        void ui.say(T.arrival);
      }
      if (game.flag('riding') && shod() && !riding) mount();
    },
    dispose() {
      stopRefresh();
      player.riding = false;
      ui.setProgress(null);
      ui.setHorseButton(null);
    },
    debug: { scare, horse, hens, wild, tito, brutus, alvim, clotilde, pimenta, mount, dismount },
  };
  return area;
}
