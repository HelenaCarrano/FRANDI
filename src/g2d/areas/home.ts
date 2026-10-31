import { content } from '../../content';
import { audio } from '../../core/audio';
import { doneFlag } from '../../core/areas';
import { OUTLINE, mulberry32 } from '../art';
import { Collision } from '../collision';
import { INDOOR_WARM, cloneEnv } from '../env';
import { paintInterior } from '../ground';
import type { AreaContext } from '../manager';
import { Person, type PersonSpec } from '../people';
import type { Area2D, Drawable, Interactable, Light, Prop } from '../types';

/**
 * Casa: o final. O Matheus entra, a mesa está posta e a Helena, de avental, o espera. Ele pode olhar o espelho da parede
 * (um easter egg) antes de ir à mesa. Perto dela começa a cena: os dois correm um para o outro, o beijo, os ingredientes na
 * mesa, as taças e o rolo de massa, a conversa, o presente desbloqueado (workshop na La Mia Cuzina) e o "feliz aniversário".
 */

const T = content.home;
const W = 420;
const H = 300;
const WALL = 72;
const TABLE = { x: 210, y: 178 };
const MEET = { x: 210, y: 214 };
const NAME = T.helena.name;

const HELENA: PersonSpec = { skin: '#f4cfa8', hair: '#5a3220', hairStyle: 'bob', eyes: '#1f6a35', top: ['#d8788a', '#f09aa8', '#a8505e'], pants: '#4a3a5a', apron: '#f8f2e4', shoes: '#5a3a2a' };

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, goTo } = ctx;
  const rng = mulberry32(61);
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // ---------- chão e parede: tábuas, janelas com cortina, quadros e o espelho ----------
  const ground = paintInterior({
    w: W,
    h: H,
    seed: 61,
    floor: 'wood',
    wallH: WALL,
    rugs: [{ x: 210, y: 200, w: 156, h: 92, col: ['#a8503a', '#d4825a'] }],
    decor: (g) => {
      for (const x of [170, 250]) {
        g.fillStyle = '#2a1a14';
        g.fillRect(x - 15, 10, 30, 36);
        g.fillStyle = '#ffd890';
        g.fillRect(x - 13, 12, 26, 32);
        g.fillStyle = '#ffe8b8';
        g.fillRect(x - 13, 12, 26, 8);
        g.fillStyle = '#8a5a36';
        g.fillRect(x - 1, 12, 2, 32);
        g.fillRect(x - 13, 27, 26, 2);
        // cortinas
        g.fillStyle = '#c8503a';
        g.fillRect(x - 19, 8, 8, 42);
        g.fillRect(x + 11, 8, 8, 42);
        g.fillStyle = '#e07a5a';
        g.fillRect(x - 19, 8, 3, 42);
        g.fillRect(x + 11, 8, 3, 42);
      }
      // o espelho (de corpo inteiro) com moldura de madeira
      g.fillStyle = '#2a1a14';
      g.fillRect(62, 4, 36, 56);
      g.fillStyle = '#8a5a36';
      g.fillRect(64, 6, 32, 52);
      g.fillStyle = '#c08a54';
      g.fillRect(64, 6, 32, 2);
      for (let y = 0; y < 44; y++) {
        const k = y / 44;
        g.fillStyle = `rgb(${Math.round(196 - 46 * k)},${Math.round(226 - 38 * k)},${Math.round(240 - 30 * k)})`;
        g.fillRect(68, 10 + y, 24, 1);
      }
      g.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 4; i++) g.fillRect(72 + i * 5, 12 + i * 4, 3, 10 - i);
      // quadrinhos
      for (const [x, y, c] of [[300, 16, '#d8a050'], [326, 22, '#78a8c8'], [352, 14, '#a8c878']] as const) {
        g.fillStyle = '#2a1a14';
        g.fillRect(x - 1, y - 1, 20, 26);
        g.fillStyle = '#6a4428';
        g.fillRect(x, y, 18, 24);
        g.fillStyle = c;
        g.fillRect(x + 2, y + 2, 14, 20);
      }
    },
  });

  // ---------- colisão ----------
  const col = new Collision(W, H);
  col.bounds = { x0: 22, y0: WALL + 14, x1: W - 22, y1: H - 16 };
  col.addRect(TABLE.x - 50, TABLE.y - 10, TABLE.x + 50, TABLE.y + 6); // mesa
  col.addRect(300, 80, 392, 104); // bancada da cozinha
  col.addRect(30, 176, 78, 222); // sofá
  col.addCircle(398, 236, 8); // planta
  col.addCircle(36, 108, 8); // planta

  const props: Prop[] = [];
  const lights: ((t: number) => Light | null)[] = [];

  // ---------- estado da cena ----------
  let phase: 'idle' | 'running' | 'done' = game.flag('home_scene') ? 'done' : 'idle';
  /** Ingredientes já na mesa: farinha, ovos, queijo, vinho. */
  const placed = [phase === 'done', phase === 'done', phase === 'done', phase === 'done'];
  let glasses = phase === 'done';
  let heart: { x: number; y: number; t: number } | null = null;

  // ---------- peças da casa ----------
  const r4 = (v: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
    v.fillStyle = c;
    v.fillRect(x, y, w, h);
  };

  // mesa posta
  props.push({
    kind: 'custom',
    x: TABLE.x,
    y: TABLE.y,
    shadowRx: 52,
    shadowRy: 5,
    draw: (v, sx, sy, t) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => r4(v, c, sx + x, sy + y, w, h);
      r(OUTLINE, -52, -27, 104, 35);
      r('#f8f2e4', -51, -26, 102, 18);
      for (let x = -51; x < 51; x += 8) r('#c8503a', x, -26, 4, 2);
      for (let x = -51; x < 51; x += 8) r('#c8503a', x + 4, -9, 4, 1);
      r('#e8dcc4', -51, -26, 102, 1);
      r('#f8f2e4', -51, -8, 102, 14);
      for (let x = -51; x < 51; x += 6) r('#e0d4b8', x, 3, 3, 3);
      r('rgba(0,0,0,0.12)', -51, -8, 102, 2);
      // pratos e talheres
      for (const [px, py] of [[-30, -21], [30, -21], [-30, -13], [30, -13]]) {
        r('#d8d0b8', px - 8, py, 16, 5);
        r('#ffffff', px - 7, py, 14, 4);
        r('#e8e0c8', px - 4, py + 1, 8, 2);
      }
      // vaso de flores e velas
      r('#6a8a9a', -3, -23, 7, 7);
      for (const [fx, fy, c] of [[-4, -30, '#f06a8a'], [0, -33, '#ffd070'], [4, -29, '#ffffff']] as const) {
        r('#4a8a38', fx + 2, fy + 3, 1, 8);
        r(c, fx, fy, 4, 4);
      }
      for (const cx of [-14, 14]) {
        r('#f4ecd8', cx, -29, 3, 8);
        r('#ffd070', cx, -32 + (Math.floor(t * 8 + cx) % 2), 3, 3);
      }
      // o que o Matheus trouxe: farinha, ovos, queijo e a garrafa de vinho
      if (placed[0]) {
        r(OUTLINE, -46, -40, 14, 16);
        r('#e8dcc0', -45, -38, 12, 13);
        r('#c8b890', -45, -38, 12, 2);
        r('#8a6a3a', -41, -36, 4, 3);
      }
      if (placed[1]) {
        r(OUTLINE, -24, -30, 16, 9);
        r('#a8803c', -23, -26, 14, 5);
        for (const x of [-22, -17, -12]) r('#fffaf0', x, -29, 4, 5);
      }
      if (placed[2]) {
        r(OUTLINE, 6, -30, 15, 9);
        r('#f4cc48', 7, -29, 13, 7);
        r('#fce080', 7, -29, 13, 2);
        r('#c89a20', 11, -26, 2, 2);
        r('#c89a20', 16, -25, 2, 2);
      }
      if (placed[3]) {
        r(OUTLINE, 36, -43, 8, 22);
        r('#2a5a2e', 37, -41, 6, 19);
        r('#3a7a3e', 37, -41, 2, 19);
        r('#e8dcc0', 37, -30, 6, 6);
        r('#8a2a3a', 38, -29, 4, 4);
        r('#3a2a1c', 38, -45, 4, 4);
      }
      if (glasses) {
        for (const gx of [26, 34 + 12]) {
          r('#e8f4f8', gx, -30, 5, 7);
          r('#8a2a3a', gx + 1, -26, 3, 3);
          r('#c8dce8', gx + 2, -22, 1, 3);
        }
      }
    },
  });
  lights.push((t) => ({ x: TABLE.x, y: TABLE.y - 30, r: 70, col: [255, 196, 120], a: 0.5 + 0.06 * Math.sin(t * 8) }));

  // cadeiras: duas ao fundo (de costas para a parede) e duas laterais
  const chair = (x: number, y: number, back: boolean) =>
    props.push({
      kind: 'custom',
      x,
      y,
      shadowRx: 8,
      shadowRy: 2,
      draw: (v, sx, sy) => {
        r4(v, OUTLINE, sx - 8, sy - (back ? 22 : 10), 16, back ? 24 : 12);
        r4(v, '#8a5a36', sx - 7, sy - (back ? 21 : 9), 14, back ? 10 : 8);
        r4(v, '#c08a54', sx - 7, sy - (back ? 21 : 9), 14, 1);
        r4(v, '#a8503a', sx - 6, sy - 8, 12, 6);
        r4(v, '#6a4428', sx - 6, sy - 2, 2, 3);
        r4(v, '#6a4428', sx + 4, sy - 2, 2, 3);
      },
    });
  chair(176, 158, true);
  chair(244, 158, true);
  chair(152, 190, false);
  chair(268, 190, false);

  // bancada e fogão da cozinha, com panela no fogo
  props.push({
    kind: 'custom',
    x: 346,
    y: 104,
    shadowRx: 48,
    shadowRy: 4,
    draw: (v, sx, sy, t) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => r4(v, c, sx + x, sy + y, w, h);
      r(OUTLINE, -47, -28, 94, 29);
      r('#8a5e38', -46, -27, 92, 8);
      r('#b07c4c', -46, -27, 92, 2);
      r('#6a4428', -46, -19, 92, 19);
      for (let x = -46; x < 46; x += 23) r('#3a2416', x, -17, 1, 17);
      r('#3a3a44', -38, -33, 30, 8);
      r('#54545e', -38, -33, 30, 2);
      r(OUTLINE, -32, -42, 18, 11);
      r('#8a8a9a', -31, -41, 16, 9);
      r('#5a5a68', -31, -41, 16, 2);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.9 + i / 3) % 1;
        r(`rgba(240,240,240,${0.5 - k * 0.45})`, -25 + Math.round(Math.sin(t * 2 + i) * 2), -45 - Math.round(k * 16), 3, 3);
      }
      // prateleira com as taças
      r(OUTLINE, 12, -52, 32, 4);
      r('#8a5e38', 13, -52, 30, 2);
      for (const x of [16, 24, 32]) {
        r('#e8f4f8', x, -60, 5, 8);
        r('#c8dce8', x + 1, -60, 1, 6);
      }
    },
  });
  lights.push(() => ({ x: 322, y: 80, r: 48, col: [255, 150, 70], a: 0.35 }));

  // sofá, plantas e lamparina
  props.push({
    kind: 'custom',
    x: 54,
    y: 222,
    shadowRx: 26,
    shadowRy: 4,
    draw: (v, sx, sy) => {
      const r = (c: string, x: number, y: number, w: number, h: number) => r4(v, c, sx + x, sy + y, w, h);
      r(OUTLINE, -24, -46, 50, 48);
      r('#7a4a8a', -22, -44, 12, 44);
      r('#a070b0', -22, -44, 4, 44);
      r('#8a5a9a', -12, -38, 36, 34);
      r('#a878b8', -12, -38, 36, 4);
      r('#5a3a68', -22, -4, 46, 4);
      r('#d8a050', -8, -32, 12, 10);
    },
  });
  for (const [px, py] of [[398, 240], [36, 112]] as const) {
    props.push({
      kind: 'custom',
      x: px,
      y: py,
      shadowRx: 8,
      shadowRy: 2,
      draw: (v, sx, sy, t) => {
        r4(v, OUTLINE, sx - 7, sy - 10, 14, 12);
        r4(v, '#b8603a', sx - 6, sy - 9, 12, 10);
        for (let i = 0; i < 5; i++) {
          const w = Math.round(Math.sin(t * 1.4 + i) * 1);
          r4(v, i % 2 ? '#4a8a38' : '#6aaa48', sx - 7 + i * 3 + w, sy - 24 + (i % 3) * 3, 3, 14);
        }
      },
    });
  }

  // a porta, no meio da parede de baixo
  props.push({
    kind: 'custom',
    x: W / 2,
    y: H - 1,
    draw: (v, sx, sy) => {
      r4(v, OUTLINE, sx - 15, sy - 30, 30, 30);
      r4(v, '#5a3a22', sx - 13, sy - 28, 26, 28);
      r4(v, '#7a5232', sx - 13, sy - 28, 26, 3);
      for (const x of [-4, 4]) r4(v, '#3a2416', sx + x, sy - 25, 1, 25);
      r4(v, '#e0b84a', sx + 7, sy - 14, 3, 3);
    },
  });
  lights.push(() => ({ x: W / 2, y: H - 18, r: 46, col: [150, 190, 255], a: 0.14 }));
  for (const x of [170, 250]) lights.push((t) => ({ x, y: 40, r: 62, col: [255, 190, 110], a: 0.4 + 0.04 * Math.sin(t * 2 + x) }));

  // ---------- a Helena ----------
  const helena = new Person(HELENA, TABLE.x, TABLE.y - 40, { facing: 'down', watchPlayer: true });
  let hRoute: [number, number][] = [];
  let hDone: (() => void) | null = null;
  const hwalk = (pts: [number, number][]) =>
    new Promise<void>((res) => {
      hRoute = pts.slice();
      hDone = res;
    });
  const pwalk = (x: number, y: number, run = false) =>
    new Promise<void>((res) => {
      player.auto = { x, y, run, done: res };
    });
  if (phase === 'done') helena.x = 250;

  // ---------- interações ----------
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, mark?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled: () => phase !== 'running' && (enabled?.() ?? true), mark });

  add(W / 2, H - 30, 34, T.back.prompt, () => void goTo('farm'));

  // o espelho: um easter egg (cada vez uma frase)
  let mirrorN = 0;
  add(80, 84, 36, T.mirror.prompt, () => void ui.tell(T.mirror.lines[mirrorN++ % T.mirror.lines.length]));

  async function scene() {
    phase = 'running';
    player.frozen = true;
    ui.setObjective(null);
    const S = T.scene;
    helena.faceToward(player.x, player.y);
    await ui.tell(S.hello, NAME);
    // os dois correm um para o outro
    await Promise.all([pwalk(MEET.x - 12, MEET.y, true), hwalk([[262, 168], [262, 206], [MEET.x + 12, MEET.y]])]);
    player.place(MEET.x - 12, MEET.y, 'right');
    helena.stand('left');
    // o beijo e um coração enorme sobre os dois
    heart = { x: MEET.x, y: MEET.y - 46, t: 0 };
    audio.play('egg', 1);
    await sleep(1800);
    await ui.tell(S.kiss);
    await ui.tell(S.welcome, NAME);
    heart = null;
    // os ingredientes na mesa
    await Promise.all([pwalk(TABLE.x, TABLE.y + 16, false), hwalk([[240, 206], [262, 200]])]);
    player.place(TABLE.x, TABLE.y + 16, 'up');
    helena.stand('left');
    await ui.tell(S.table);
    for (let i = 0; i < placed.length; i++) {
      placed[i] = true;
      audio.play('pickup', 0.9);
      await sleep(550);
    }
    for (const id of ['farinha', 'ovos', 'queijo', 'garrafa'] as const) if (game.has(id)) game.removeItem(id, 99);
    // ela vai buscar as taças e o rolo
    await hwalk([[290, 196], [296, 130], [346, 114]]);
    await sleep(500);
    await hwalk([[300, 126], [290, 196], [262, 200]]);
    glasses = true;
    audio.play('pickup', 0.8);
    helena.stand('left');
    await ui.tell(S.takes);
    ui.toast(S.rolling);
    audio.play('coin', 0.8);
    await ui.tell(S.ask, NAME);
    await ui.tell(S.matheus, 'Matheus');
    await ui.tell(S.answer, NAME);
    // presente desbloqueado
    audio.play('memory');
    ui.toast(S.unlocked);
    await sleep(900);
    await ui.showVoucher(T.voucher, T.voucher.save, T.voucher.close, T.voucher.fileName);
    heart = { x: MEET.x + 20, y: TABLE.y - 56, t: 0 };
    audio.play('egg', 1);
    await ui.tell(S.love, NAME);
    heart = null;
    await ui.showEndCard(T.endTitle, T.endText, T.endButton);
    game.setFlag('home_scene');
    game.setFlag(doneFlag('home'));
    player.frozen = false;
    phase = 'done';
    ui.setObjective(T.objective.done);
  }

  add(TABLE.x, TABLE.y - 40, 46, T.helena.prompt, () => void (phase === 'idle' ? scene() : ui.tell(T.helena.done, NAME)), undefined, () => phase === 'idle');

  // ---------- desenho do coração e dos personagens ----------
  const heartDrawable = (): Drawable => ({
    y: 9999,
    draw: (v, cx, cy, t) => {
      if (!heart) return;
      const k = Math.min(1, heart.t / 0.5);
      const s = 5 * (0.4 + 0.6 * k) * (1 + Math.sin(t * 8) * 0.06);
      const x = Math.round(heart.x - cx);
      const y = Math.round(heart.y - cy - Math.sin(heart.t * 2) * 3);
      const px = (c: string, dx: number, dy: number, w: number, h: number) => {
        v.fillStyle = c;
        v.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.round(w * s), Math.round(h * s));
      };
      // coração em pixels: contorno escuro, miolo vermelho e brilho
      const shape = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      shape.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch !== 'X') return;
          px('#7a1020', rx - 3.5 - 0.15, ry - 3 - 0.15, 1.3, 1.3);
        }),
      );
      shape.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch !== 'X') return;
          px(ry < 2 ? '#ff6a8a' : '#e83a5a', rx - 3.5, ry - 3, 1.02, 1.02);
        }),
      );
      px('#ffd0dc', -2.5, -2.5, 1, 1);
      // coraçõezinhos subindo
      for (let i = 0; i < 4; i++) {
        const q = (heart.t * 0.7 + i / 4) % 1;
        v.fillStyle = `rgba(255,120,150,${1 - q})`;
        v.fillRect(Math.round(x + Math.sin(i * 2.4 + heart.t * 2) * 18), Math.round(y - 10 - q * 30), 3, 3);
      }
    },
  });

  const env = cloneEnv(INDOOR_WARM);
  env.dark = 0.5;
  void rng;

  return {
    id: 'home',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: { start: { x: W / 2, y: H - 40, dir: 'up' } },
    interactables,
    env,
    torchLit: () => false,
    drawables(out) {
      out.push(helena.drawable());
      out.push(heartDrawable());
    },
    lights(out, t) {
      for (const l of lights) {
        const r = l(t);
        if (r) out.push(r);
      }
    },
    update(dt, t, pl) {
      if (heart) heart.t += dt;
      if (hRoute.length) {
        if (helena.walkToward(hRoute[0][0], hRoute[0][1], dt, 52)) hRoute.shift();
        if (!hRoute.length) {
          const d = hDone;
          hDone = null;
          d?.();
        }
      } else if (phase !== 'running') helena.update(dt, t, pl, col, ui.inDialog);
      // perto da mesa começa a cena
      if (phase === 'idle' && !ui.inDialog && Math.hypot(pl.x - TABLE.x, pl.y - (TABLE.y + 28)) < 44) void scene();
    },
    onEnter() {
      game.setFlag('home_seen');
      if (phase === 'idle') {
        ui.setObjective(T.objective.go);
        void ui.say(T.intro);
      } else ui.setObjective(T.objective.done);
    },
    dispose() {
      ui.setObjective(null);
    },
    debug: {
      scene: () => void scene(),
    },
  };
}
