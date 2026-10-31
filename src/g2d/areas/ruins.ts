import { content, fmt, type ItemId } from '../../content';
import { doneFlag } from '../../core/areas';
import { playRunes } from '../../ui/minigames';
import { OUTLINE, mulberry32 } from '../art';
import { Collision } from '../collision';
import { CombatSystem } from '../combat';
import { NIGHT, cloneEnv } from '../env';
import { paintGround } from '../ground';
import type { AreaContext } from '../manager';
import type { Area2D, Interactable, Prop } from '../types';

/**
 * Ruínas Esquecidas: um pátio de pedra à noite, cercado de colunas quebradas. Três altares guardam três lembranças:
 * o das chamas (acender quatro braseiros na ordem dos símbolos da parede), o dos símbolos (três anéis de pedra) e o do eco
 * (uma pergunta). Com os três acesos, a névoa acorda em volta do cristal central; vencidos os espíritos, o cristal é seu.
 */

const T = content.ruins;
const W = 1000;
const H = 900;
const START = { x: 500, y: 790 };
const C = { x: 500, y: 330 };
const CENTER = { x: 500, y: 470 };
const RX = 470;
const RY = 430;

type AltarId = 'flames' | 'runes' | 'echo';
const ALTARS: Record<AltarId, { x: number; y: number }> = {
  flames: { x: 290, y: 218 },
  runes: { x: 500, y: 150 },
  echo: { x: 710, y: 218 },
};
const MEMORY_OF: Record<AltarId, 'ruinas_chamas' | 'ruinas_simbolos' | 'ruinas_eco'> = { flames: 'ruinas_chamas', runes: 'ruinas_simbolos', echo: 'ruinas_eco' };
const altarFlag = (id: AltarId) => `ruins_altar_${id}`;

/** Braseiros do altar das chamas (cada um com o símbolo de mesmo número) e a ordem certa, como está pintada na parede. */
const BRAZIERS = [
  { x: 240, y: 270 },
  { x: 272, y: 286 },
  { x: 308, y: 286 },
  { x: 340, y: 270 },
];
const SEQUENCE = [2, 0, 3, 1];
const GLYPH_COL = '#7ae8ff';

/** Quatro símbolos geométricos desenhados em código: círculo com ponto, triângulo, losango e estrela. */
function drawGlyph(v: CanvasRenderingContext2D, kind: number, cx: number, cy: number, r: number, color: string) {
  v.strokeStyle = color;
  v.lineWidth = 1.5;
  v.beginPath();
  if (kind === 0) {
    v.arc(cx, cy, r, 0, Math.PI * 2);
    v.moveTo(cx + r * 0.25, cy);
    v.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
  } else if (kind === 1) {
    v.moveTo(cx, cy - r);
    v.lineTo(cx + r * 0.95, cy + r * 0.8);
    v.lineTo(cx - r * 0.95, cy + r * 0.8);
    v.closePath();
  } else if (kind === 2) {
    v.moveTo(cx, cy - r);
    v.lineTo(cx + r * 0.75, cy);
    v.lineTo(cx, cy + r);
    v.lineTo(cx - r * 0.75, cy);
    v.closePath();
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.4;
      v.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    v.closePath();
  }
  v.stroke();
}

/** Bloco de pedra antiga com musgo (mesmo estilo do arco da floresta). */
function stoneBlock(v: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  v.fillStyle = '#1e1a30';
  v.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      const rel = i / w;
      const n = Math.sin(i * 12.9 + j * 4.1 + seed) * 43758.5453;
      const f = n - Math.floor(n);
      let c = rel < 0.25 ? '#7c7894' : rel < 0.65 ? '#5a5676' : '#3c385a';
      if ((j + Math.floor(seed)) % 12 === 0) c = '#34304c';
      if (f > 0.93) c = '#4e7a3a';
      v.fillStyle = c;
      v.fillRect(x + i, y + j, 1, 1);
    }
  }
}

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, kit, fx, openMap, teleport } = ctx;
  const rng = mulberry32(2024);

  // ---------- estado ----------
  const isLit = (id: AltarId) => game.flag(altarFlag(id));
  const litCount = () => (['flames', 'runes', 'echo'] as const).filter(isLit).length;
  const allLit = () => litCount() === 3;
  const ambushDone = () => game.flag('foe_ruins_ambush');
  const isDone = () => game.flag(doneFlag('ruins'));
  const crystalAvailable = () => allLit() && ambushDone() && !isDone();
  const braziersLit = [false, false, false, false];
  if (isLit('flames')) braziersLit.fill(true);
  let sequence: number[] = [];

  // ---------- chão: trilha de pedras, pátio e flores azuis que brilham ----------
  const glow: { x: number; y: number }[] = [];
  for (let i = 0; i < 90; i++) glow.push({ x: Math.round(60 + rng() * 880), y: Math.round(70 + rng() * 760) });
  const ground = paintGround({
    w: W,
    h: H,
    seed: 17,
    paths: [{ pts: [[500, 900], [500, 700], [502, 520], [500, 420]], width: 54 }],
    clearings: [
      { x: C.x, y: C.y, rx: 350, ry: 225 },
      { x: START.x, y: 820, rx: 90, ry: 40 },
    ],
    glow,
    tufts: Math.round((W * H) / 1100),
    flowers: 40,
    leaves: 160,
    cobble: true,
  });

  // ---------- colisão: o pátio é uma elipse; fora dela só mata ----------
  const col = new Collision(W, H);
  col.extra = (x, y) => ((x - CENTER.x) / RX) ** 2 + ((y - CENTER.y) / RY) ** 2 > 1;
  const props: Prop[] = [];
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, mark?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled, mark });

  const inside = (x: number, y: number, k: number) => ((x - CENTER.x) / (RX * k)) ** 2 + ((y - CENTER.y) / (RY * k)) ** 2 < 1;
  const inCourt = (x: number, y: number, k = 1) => ((x - C.x) / (350 * k)) ** 2 + ((y - C.y) / (225 * k)) ** 2 < 1;
  const cell = new Set<string>();
  const taken = (x: number, y: number, s: number) => {
    const k = `${Math.floor(x / s)}:${Math.floor(y / s)}`;
    if (cell.has(k)) return true;
    cell.add(k);
    return false;
  };
  // pinheiros escuros fora do pátio
  for (let i = 0, n = 0; n < 300 && i < 12000; i++) {
    const x = 12 + rng() * (W - 24);
    const y = 12 + rng() * (H - 24);
    if (inside(x, y, 0.98) || taken(x, y, 36)) continue;
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    if (inside(x, y, 1.12)) col.addCircle(x, y, 4);
    n++;
  }
  for (let i = 0, n = 0; n < 40 && i < 5000; i++) {
    const x = 30 + rng() * (W - 60);
    const y = 30 + rng() * (H - 60);
    if (!inside(x, y, 0.96) || inCourt(x, y, 0.85) || ground.isPath(x, y) || taken(x, y, 34)) continue;
    props.push({ kind: 'bush', x, y, img: kit.bushes[Math.floor(rng() * kit.bushes.length)] });
    n++;
  }
  for (let i = 0, n = 0; n < 36 && i < 5000; i++) {
    const x = 30 + rng() * (W - 60);
    const y = 30 + rng() * (H - 60);
    if (!inside(x, y, 0.96) || inCourt(x, y, 0.8) || ground.isPath(x, y) || taken(x, y, 38)) continue;
    props.push({ kind: 'rock', x, y, img: kit.rocks[Math.floor(rng() * kit.rocks.length)] });
    n++;
  }
  for (let i = 0, n = 0; n < 50 && i < 5000; i++) {
    const x = 30 + rng() * (W - 60);
    const y = 30 + rng() * (H - 60);
    if (!inside(x, y, 0.95) || ground.isPath(x, y) || taken(x, y, 36)) continue;
    const g2 = rng() < 0.6;
    props.push({ kind: 'mushroom', x, y, img: g2 ? kit.mushGlow : kit.mushRed, glow: g2 });
    n++;
  }
  for (let i = 0; i < 360; i++) {
    const x = 24 + rng() * (W - 48);
    const y = 24 + rng() * (H - 48);
    if (!inside(x, y, 0.95) || ground.isPath(x, y)) continue;
    props.push({ kind: 'grass', x, y, phase: rng() * 6.28 });
  }

  // ---------- muralha de colunas quebradas em volta do pátio (com uma abertura ao sul) ----------
  const COLUMNS = 24;
  for (let i = 0; i < COLUMNS; i++) {
    const a = (i / COLUMNS) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
    const x = C.x + Math.cos(a) * 345;
    const y = C.y + Math.sin(a) * 222;
    const h = i % 3 === 0 ? 74 : i % 3 === 1 ? 46 : 28;
    props.push({
      kind: 'custom',
      x,
      y,
      shadowRx: 9,
      shadowRy: 3,
      draw: (v, sx, sy) => {
        stoneBlock(v, sx - 7, sy - h, 14, h, i * 3.1);
        // topo quebrado e entulho aos pés
        if (h < 60) {
          v.fillStyle = '#1e1a30';
          v.fillRect(sx - 7, sy - h - 2, 4, 2);
          v.fillRect(sx + 1, sy - h - 3, 5, 3);
        } else {
          stoneBlock(v, sx - 9, sy - h - 4, 18, 5, i);
        }
        stoneBlock(v, sx + 7, sy - 4, 7, 4, i + 5);
      },
    });
    col.addCircle(x, y, 6);
  }

  // ---------- o arco de entrada ----------
  const archY = 868;
  props.push({
    kind: 'custom',
    x: 500,
    y: archY,
    draw: (v, sx, sy, t) => {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const h2 = 22 + ((k * 7) % 3) * 7;
          stoneBlock(v, sx + side * (92 + k * 28) - 13, sy - h2, 26, h2, k + side);
        }
        stoneBlock(v, sx + side * 66 - 9, sy - 76, 18, 76, side * 3);
      }
      for (let i = -76; i <= 76; i += 14) stoneBlock(v, sx + i - 7, sy - 92 + Math.abs(i) * 0.08, 14, 16, i);
      const a = 0.22 + Math.sin(t * 1.7) * 0.06;
      for (let y = sy - 76; y < sy - 2; y += 2) {
        const k = (y - (sy - 76)) / 74;
        v.fillStyle = `rgba(110,225,255,${a * (0.5 + 0.5 * k)})`;
        v.fillRect(sx - 56, y, 112, 2);
      }
    },
    light: (t) => ({ x: 500, y: archY - 34, r: 120, col: [85, 214, 255], a: 0.3 + Math.sin(t * 2.1) * 0.06, night: true }),
  });
  col.addRect(500 - 84, archY - 6, 500 - 64, archY + 4);
  col.addRect(500 + 64, archY - 6, 500 + 84, archY + 4);
  col.addRect(500 - 230, archY - 6, 500 - 86, archY + 4);
  col.addRect(500 + 86, archY - 6, 500 + 230, archY + 4);
  add(500, archY - 22, 46, T.back.prompt, () => void openMap());

  // ---------- altares ----------
  const lightAltar = async (id: AltarId) => {
    game.setFlag(altarFlag(id));
    fx.burst(ALTARS[id].x, ALTARS[id].y - 20, 24, 1.6, '#7ae8ff');
    await ui.tell([T.altarLit]);
    const key = MEMORY_OF[id];
    game.setFlag(`mem_${key}`);
    await ui.showMemory(content.memories[key]);
    if (allLit()) ui.toast(T.ambush);
  };
  for (const id of ['flames', 'runes', 'echo'] as const) {
    const { x, y } = ALTARS[id];
    props.push({
      kind: 'custom',
      x,
      y,
      shadowRx: 24,
      shadowRy: 5,
      draw: (v, sx, sy, t) => {
        // pedestal de pedra com degraus e o cristal em cima
        stoneBlock(v, sx - 24, sy - 8, 48, 8, 3 + x);
        stoneBlock(v, sx - 16, sy - 20, 32, 12, 7 + x);
        stoneBlock(v, sx - 10, sy - 28, 20, 8, 9 + x);
        const lit = isLit(id);
        const bob = Math.round(Math.sin(t * 2 + x) * 1.5);
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 6, sy - 48 + bob, 12, 20);
        v.fillStyle = lit ? '#7af0ff' : '#34446a';
        v.fillRect(sx - 5, sy - 47 + bob, 10, 18);
        v.fillStyle = lit ? '#d0ffff' : '#52648e';
        v.fillRect(sx - 4, sy - 45 + bob, 3, 12);
        if (lit) {
          v.fillStyle = 'rgba(122,240,255,0.25)';
          v.fillRect(sx - 12, sy - 54 + bob, 24, 32);
        }
      },
      light: (t) => (isLit(id) ? { x, y: y - 34, r: 90, col: [90, 220, 255], a: 0.55 + Math.sin(t * 2.4 + x) * 0.08, night: true } : { x, y: y - 34, r: 36, col: [90, 130, 255], a: 0.18, night: true }),
    });
    col.addRect(x - 22, y - 8, x + 22, y);
  }
  const doneToast = () => ui.toast(T.altarDone);

  // altar das chamas: a parede com os símbolos na ordem e os quatro braseiros
  props.push({
    kind: 'custom',
    x: ALTARS.flames.x,
    y: ALTARS.flames.y - 40,
    draw: (v, sx, sy) => {
      stoneBlock(v, sx - 62, sy - 40, 124, 40, 21);
      v.fillStyle = 'rgba(8,10,30,0.55)';
      v.fillRect(sx - 56, sy - 34, 112, 28);
      SEQUENCE.forEach((glyph, i) => drawGlyph(v, glyph, sx - 42 + i * 28, sy - 20, 8, GLYPH_COL));
    },
    light: () => ({ x: ALTARS.flames.x, y: ALTARS.flames.y - 66, r: 54, col: [90, 200, 255], a: 0.22, night: true }),
  });
  col.addRect(ALTARS.flames.x - 62, ALTARS.flames.y - 52, ALTARS.flames.x + 62, ALTARS.flames.y - 44);
  BRAZIERS.forEach((b, i) => {
    props.push({
      kind: 'custom',
      x: b.x,
      y: b.y,
      shadowRx: 9,
      shadowRy: 3,
      draw: (v, sx, sy, t) => {
        v.fillStyle = OUTLINE;
        v.fillRect(sx - 3, sy - 22, 6, 23);
        v.fillRect(sx - 8, sy - 30, 16, 9);
        v.fillStyle = '#3a3a48';
        v.fillRect(sx - 2, sy - 21, 4, 21);
        v.fillStyle = '#5a5a6a';
        v.fillRect(sx - 7, sy - 29, 14, 7);
        v.fillStyle = '#14141a';
        v.fillRect(sx - 6, sy - 29, 12, 3);
        drawGlyph(v, i, sx, sy - 11, 4, GLYPH_COL);
        if (braziersLit[i]) {
          const fl = Math.sin(t * 13 + i) + Math.sin(t * 21 + i * 2);
          v.fillStyle = '#d83a20';
          v.fillRect(sx - 4, sy - 35, 8, 7);
          v.fillRect(sx - 2, sy - 40 + Math.round(fl * 0.5), 5, 6);
          v.fillStyle = '#ff9a2a';
          v.fillRect(sx - 3, sy - 34, 6, 5);
          v.fillRect(sx - 1, sy - 38 + Math.round(fl * 0.5), 3, 4);
          v.fillStyle = '#ffe070';
          v.fillRect(sx - 1, sy - 33, 2, 3);
        }
      },
      light: (t) => (braziersLit[i] ? { x: b.x, y: b.y - 30, r: 64, col: [255, 150, 70], a: 0.6 + Math.sin(t * 11 + i) * 0.1, night: true } : null),
    });
    col.addCircle(b.x, b.y - 2, 5);
    const open = () => !isLit('flames') && !braziersLit[i];
    add(b.x, b.y + 4, 30, T.flames.brazier, () => void useBrazier(i), open, open);
  });
  add(ALTARS.flames.x, ALTARS.flames.y + 6, 40, T.flames.prompt, () => (isLit('flames') ? doneToast() : void ui.tell(T.flames.intro)));
  async function useBrazier(i: number) {
    if (i === SEQUENCE[sequence.length]) {
      sequence.push(i);
      braziersLit[i] = true;
      if (sequence.length === SEQUENCE.length) await lightAltar('flames');
      else ui.toast(fmt(T.flames.step, { n: SEQUENCE.length - sequence.length }));
    } else {
      sequence = [];
      braziersLit.fill(false);
      await ui.tell(T.flames.wrong);
    }
  }

  // altar dos símbolos: os três anéis
  add(ALTARS.runes.x, ALTARS.runes.y + 8, 42, T.runes.prompt, () => void useRunes());
  async function useRunes() {
    if (isLit('runes')) return doneToast();
    await ui.tell(T.runes.intro);
    await playRunes(ui, { title: T.runes.title, hint: T.runes.hint, goal: T.runes.goal, solved: T.runes.solved });
    await lightAltar('runes');
  }

  // altar do eco: uma pergunta
  add(ALTARS.echo.x, ALTARS.echo.y + 8, 42, T.echo.prompt, () => void useEcho());
  async function useEcho() {
    if (isLit('echo')) return doneToast();
    await ui.tell(T.echo.intro);
    for (;;) {
      const pick = await ui.ask(T.echo.question, T.echo.options);
      if (pick === T.echo.answer) break;
      await ui.tell(T.echo.wrong);
    }
    await lightAltar('echo');
  }

  // ---------- o cristal no centro do pátio e a emboscada ----------
  let crystalShow = isDone() ? 0 : allLit() && ambushDone() ? 1 : 0;
  props.push({
    kind: 'custom',
    x: C.x,
    y: C.y,
    shadowRx: 26,
    shadowRy: 6,
    draw: (v, sx, sy, t) => {
      stoneBlock(v, sx - 26, sy - 8, 52, 8, 31);
      stoneBlock(v, sx - 18, sy - 18, 36, 10, 33);
      if (crystalShow < 0.02) return;
      const bob = Math.round(Math.sin(t * 2) * 3);
      const k = crystalShow;
      v.fillStyle = `rgba(110,225,255,${0.14 * k})`;
      v.fillRect(sx - 14, sy - 130, 28, 112);
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 8, sy - 54 + bob, 16, 26);
      v.fillStyle = '#7af0ff';
      v.fillRect(sx - 7, sy - 53 + bob, 14, 24);
      v.fillStyle = '#d0ffff';
      v.fillRect(sx - 5, sy - 51 + bob, 4, 14);
    },
    light: (t) => (crystalShow > 0.02 ? { x: C.x, y: C.y - 44, r: 150, col: [90, 220, 255], a: 0.6 * crystalShow + Math.sin(t * 2) * 0.05, night: true } : null),
  });
  col.addCircle(C.x, C.y - 4, 16);

  const combat = new CombatSystem({ col, player, ui, game, fx, teleport, start: { x: START.x, y: START.y - 10, dir: 'up' }, torchLit: () => true });
  const ring = (a: number, r: number) => ({ x: C.x + Math.cos(a) * r * 1.25, y: C.y + Math.sin(a) * r * 0.8 });
  combat.add({
    id: 'ruins_ambush',
    x: C.x,
    y: C.y,
    radius: 270,
    enabled: allLit,
    enemies: [
      { kind: 'fiapo', ...ring(0.4, 120) },
      { kind: 'fiapo', ...ring(2.5, 120) },
      { kind: 'fiapo', ...ring(4.4, 130) },
      { kind: 'sombra', ...ring(5.6, 150), hp: 6 },
    ],
    checkpoint: { x: START.x, y: START.y - 10, dir: 'up' },
    onStart: () => ui.toast(T.ambush),
  });

  async function takeCrystal() {
    await ui.tell(T.crystal.lines);
    const give = (id: ItemId) => {
      game.addItem(id);
      ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
    };
    give('cristal');
    give('chave_estrela');
    game.setFlag(doneFlag('ruins'));
    ui.toast(T.objective.done);
  }
  add(C.x, C.y + 6, 50, T.crystal.prompt, () => void takeCrystal(), crystalAvailable, crystalAvailable);

  // ---------- objetivo ----------
  const objective = () => {
    if (isDone()) return T.objective.done;
    if (combat.fighting) return T.objective.fight;
    if (allLit()) return ambushDone() ? T.objective.crystal : T.objective.fight;
    if (litCount() > 0 || inCourt(player.x, player.y, 0.9)) return fmt(T.objective.altars, { n: litCount() });
    return T.objective.explore;
  };
  let lastObjective = '';
  let objTimer = 0;

  const env = cloneEnv(NIGHT);

  return {
    id: 'ruins',
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
    torchLit: () => true,
    isPath: (x, y) => ground.isPath(x, y),
    update(dt) {
      const want = crystalAvailable() ? 1 : 0;
      crystalShow += (want - crystalShow) * (1 - Math.exp(-2 * dt));
      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.5;
        const o = objective();
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
    },
    onEnter() {
      if (!game.flag('ruins_seen')) {
        game.setFlag('ruins_seen');
        void ui.say(T.intro);
      }
    },
    dispose() {
      ui.setObjective(null);
    },
    debug: {
      combat,
      solveAll: () => {
        for (const id of ['flames', 'runes', 'echo'] as const) game.setFlag(altarFlag(id));
        braziersLit.fill(true);
      },
      reset: () => {
        for (const id of ['flames', 'runes', 'echo'] as const) {
          game.setFlag(altarFlag(id), false);
          game.setFlag(`mem_${MEMORY_OF[id]}`, false);
        }
        for (const f of ['foe_ruins_ambush', doneFlag('ruins'), 'ruins_seen']) game.setFlag(f, false);
        for (const id of ['cristal', 'chave_estrela'] as const) if (game.has(id)) game.removeItem(id, 99);
        location.reload();
      },
    },
  };
}
