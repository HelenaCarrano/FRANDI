import { audio } from '../../core/audio';
import { content, fmt } from '../../content';
import { doneFlag } from '../../scenes/registry';
import { OUTLINE, mulberry32 } from '../art';
import { Collision } from '../collision';
import { CombatSystem } from '../combat';
import { GOLDEN_MORNING, NIGHT, SUNSET, cloneEnv, lerpEnv, smoothstep } from '../env';
import { paintGround } from '../ground';
import type { AreaContext } from '../manager';
import { DistanceGrid, Route, type Pt } from '../route';
import type { Area2D, Interactable, Light, Prop } from '../types';

/**
 * Floresta dos Sussurros: onde a história começa. O Matheus acorda sozinho numa trilha de ~340 m, no escuro e na névoa,
 * sem lembrar de nada. A fita da Helena traz a primeira lembrança, as pegadas mostram que o cavalo sumiu, um galho vira
 * a primeira arma e três muralhas de névoa guardam espíritos que ele precisa vencer. Duas bifurcações (os vagalumes
 * mostram o lado certo; o errado acaba numa clareira) levam ao portal de pedra, onde o dia amanhece e vem a segunda lembrança.
 */

const T = content.forest;
const W = 1200;
const H = 3780;
/** Pixels por metro desta área (a trilha tem ~340 m). */
const S = 10;
/** Metros do plano original (x, z; norte = -z) para pixels (x para a direita, y para baixo). */
const P = (x: number, z: number): Pt => [Math.round(600 + x * S), Math.round((z + 338) * S)];

const MAIN1: Pt[] = [[0, 24], [1, -8], [-4, -40], [3, -74], [4, -96]].map(([x, z]) => P(x, z));
const RIGHT: Pt[] = [[4, -96], [16, -116], [15, -146], [3, -172], [-4, -196]].map(([x, z]) => P(x, z));
const LEFT: Pt[] = [[4, -96], [-10, -112], [-24, -130], [-31, -150]].map(([x, z]) => P(x, z));
const MAIN2: Pt[] = [[-4, -196], [-8, -214], [-6, -234]].map(([x, z]) => P(x, z));
const LEFT2: Pt[] = [[-6, -234], [-22, -250], [-31, -272], [-22, -294], [-8, -312]].map(([x, z]) => P(x, z));
const RIGHT2: Pt[] = [[-6, -234], [10, -252], [23, -270]].map(([x, z]) => P(x, z));
const ARCH = { x: P(-8, -318)[0], y: P(-8, -318)[1] };

/** Onde o dia já amanheceu (fração do caminho certo). */
const HORSE_WAKES_AT = 0.55;

export function create(ctx: AreaContext): Area2D {
  const { ui, game, player, kit, fx, goTo, openMap, teleport, entry } = ctx;
  const rng = mulberry32(88);

  // ---------- trilhas ----------
  const main1 = new Route(MAIN1);
  const right = new Route(RIGHT);
  const left = new Route(LEFT);
  const main2 = new Route(MAIN2);
  const left2 = new Route(LEFT2);
  const right2 = new Route(RIGHT2);
  const trails = [main1, right, left, main2, left2, right2];
  const route = new Route([...MAIN1, ...RIGHT.slice(1), ...MAIN2.slice(1), ...LEFT2.slice(1)]);
  const grid = new DistanceGrid(W, H, trails, 130);
  const deadEnds = [LEFT[LEFT.length - 1], RIGHT2[RIGHT2.length - 1]].map(([x, y]) => ({ x, y }));
  const fm = (m: number) => (m * S) / route.length;

  const ribbonSpot = route.spot(0.055, 26);
  const TRACKS_AT = 0.17;
  const tracksSpot = route.spot(TRACKS_AT + fm(6));
  const stickSpot = route.spot(0.215, -30);

  // ---------- chão ----------
  const glow: { x: number; y: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const r = trails[Math.floor(rng() * trails.length)];
    const s = r.spot(rng(), (rng() < 0.5 ? -1 : 1) * (28 + rng() * 14));
    const n = 3 + Math.floor(rng() * 5);
    for (let j = 0; j < n; j++) glow.push({ x: Math.round(s.x + (rng() - 0.5) * 24), y: Math.round(s.y + (rng() - 0.5) * 12) });
  }
  const startPos = P(0, 16);
  const ground = paintGround({
    w: W,
    h: H,
    seed: 9,
    paths: [
      { pts: main1.pts, width: 48 },
      { pts: right.pts, width: 44 },
      { pts: left.pts, width: 40 },
      { pts: main2.pts, width: 46 },
      { pts: left2.pts, width: 44 },
      { pts: right2.pts, width: 40 },
    ],
    clearings: [
      { x: startPos[0], y: startPos[1], rx: 70, ry: 40 },
      { x: ARCH.x, y: ARCH.y + 50, rx: 150, ry: 62 },
      ...deadEnds.map((d) => ({ x: d.x, y: d.y, rx: 55, ry: 34 })),
    ],
    glow,
    cobble: false,
    tufts: Math.round((W * H) / 900),
    flowers: 150,
    leaves: 700,
    decor: (g) => {
      // marcas de ferradura que somem na mata
      g.fillStyle = '#3a2418';
      for (let i = 0; i < 16; i++) {
        const f = TRACKS_AT - fm(78) + fm(i * 5.5);
        const s = route.spot(f, i % 2 ? 6 : -6);
        g.fillRect(Math.round(s.x) - 2, Math.round(s.y), 1, 3);
        g.fillRect(Math.round(s.x) + 1, Math.round(s.y), 1, 3);
        g.fillRect(Math.round(s.x) - 1, Math.round(s.y) + 2, 2, 1);
      }
      for (let i = 0; i < 7; i++) {
        const dir = i % 2 ? 1 : -1;
        const s = route.spot(TRACKS_AT + fm(i * 6), dir * (4 + i * 5));
        g.fillRect(Math.round(s.x) - 2, Math.round(s.y), 1, 3);
        g.fillRect(Math.round(s.x) + 1, Math.round(s.y), 1, 3);
        g.fillRect(Math.round(s.x) - 1, Math.round(s.y) + 2, 2, 1);
      }
    },
  });

  // ---------- colisão: a mata é fechada fora da trilha ----------
  const col = new Collision(W, H);
  col.extra = (x, y) => grid.distance(x, y) > 62;

  const props: Prop[] = [];
  const cell = new Map<string, boolean>();
  const taken = (x: number, y: number, size: number) => {
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cell.get(`${size}:${cx + a}:${cy + b}`)) return true;
    return false;
  };
  const mark = (x: number, y: number, size: number) => cell.set(`${size}:${Math.floor(x / size)}:${Math.floor(y / size)}`, true);
  const nearArch = (x: number, y: number, m = 0) => Math.abs(x - ARCH.x) < 220 + m && y < ARCH.y + 110 + m;

  // árvores: bem de perto da trilha (a borda da mata) e mais longe, onde ninguém anda mas se vê
  let tries = 0;
  while (props.filter((p) => p.kind === 'tree').length < 1300 && tries++ < 60000) {
    const x = 16 + rng() * (W - 32);
    const y = 16 + rng() * (H - 32);
    const d = grid.distance(x, y);
    if (d < 56 || nearArch(x, y) || taken(x, y, 50)) continue;
    props.push({ kind: 'tree', x, y, tree: kit.trees[Math.floor(rng() * kit.trees.length)] });
    mark(x, y, 50);
    if (d < 130) col.addCircle(x, y, 7);
  }
  const scatter = (kind: Prop['kind'], n: number, make: () => Partial<Prop>, minD: number, maxD: number, spacing: number) => {
    let t = 0;
    let c = 0;
    while (c < n && t++ < 20000) {
      const x = 16 + rng() * (W - 32);
      const y = 16 + rng() * (H - 32);
      const d = grid.distance(x, y);
      if (d < minD || d > maxD || nearArch(x, y, -40) || ground.isPath(x, y) || taken(x, y, spacing)) continue;
      props.push({ kind, x, y, ...make() });
      mark(x, y, spacing);
      c++;
    }
  };
  scatter('bush', 160, () => ({ img: kit.bushes[Math.floor(rng() * kit.bushes.length)] }), 30, 90, 36);
  scatter('rock', 110, () => ({ img: kit.rocks[Math.floor(rng() * kit.rocks.length)] }), 26, 90, 30);
  scatter('stump', 18, () => ({ img: kit.stump }), 34, 70, 60);
  scatter('fern', 260, () => ({ img: kit.ferns[Math.floor(rng() * kit.ferns.length)] }), 26, 80, 20);
  scatter('mushroom', 120, () => {
    const g = rng() < 0.55;
    return { img: g ? kit.mushGlow : kit.mushRed, glow: g };
  }, 28, 80, 28);
  for (let i = 0; i < 900; i++) {
    const s = trails[Math.floor(rng() * trails.length)].spot(rng(), (rng() - 0.5) * 100);
    if (ground.isPath(s.x, s.y)) continue;
    props.push({ kind: 'grass', x: s.x, y: s.y, phase: rng() * 6.28 });
  }

  // ---------- fita, galho e as ruínas ----------
  props.push({
    kind: 'custom',
    x: ribbonSpot.x,
    y: ribbonSpot.y,
    draw: (v, sx, sy, t) => {
      // arbustinho com a fita presa
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 1, sy - 16, 3, 17);
      v.fillStyle = '#6a3e26';
      v.fillRect(sx, sy - 15, 1, 15);
      if (game.flag('forest_ribbon')) return;
      const sw = Math.round(Math.sin(t * 1.8) * 2);
      for (let i = 0; i < 9; i++) {
        const w = Math.round(Math.sin(t * 2.3 + i * 0.5) * (i * 0.25));
        v.fillStyle = i % 4 === 0 ? '#ff8a96' : '#d83a50';
        v.fillRect(sx + 1 + sw + w, sy - 15 + i, 2, 1);
      }
    },
  });
  props.push({
    kind: 'custom',
    x: stickSpot.x,
    y: stickSpot.y,
    draw: (v, sx, sy) => {
      if (game.has('galho') || game.has('espada')) return;
      v.fillStyle = OUTLINE;
      v.fillRect(sx - 8, sy - 3, 16, 5);
      v.fillStyle = '#8c5a38';
      v.fillRect(sx - 7, sy - 2, 14, 3);
      v.fillStyle = '#b88050';
      v.fillRect(sx - 7, sy - 2, 14, 1);
      v.fillStyle = '#6a3e26';
      v.fillRect(sx + 2, sy - 5, 2, 3);
    },
  });

  const archY = ARCH.y;
  const drawStone = (v: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => {
    v.fillStyle = '#1e1a30';
    v.fillRect(x - 1, y - 1, w + 2, h + 2);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j += 1) {
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
  };
  props.push({
    kind: 'custom',
    x: ARCH.x,
    y: archY,
    draw: (v, sx, sy, t) => {
      const night = 1;
      void night;
      // paredes baixas dos lados, com topo quebrado
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const wx = sx + side * (98 + k * 28) - 13;
          const h2 = 22 + ((k * 7) % 3) * 7;
          drawStone(v, wx, sy - h2, 26, h2, k + side);
        }
      }
      // pilares e arco
      for (const side of [-1, 1]) drawStone(v, sx + side * 74 - 9, sy - 78, 18, 78, side * 3);
      for (let i = -84; i <= 84; i += 14) drawStone(v, sx + i - 7, sy - 94 + Math.abs(i) * 0.08, 14, 16, i);
      // véu de luz azul dentro do arco
      const a = 0.28 + Math.sin(t * 1.7) * 0.08 + (game.flag(doneFlag('forest')) ? 0.12 : 0);
      for (let y = sy - 78; y < sy - 2; y += 2) {
        const k = (y - (sy - 78)) / 76;
        v.fillStyle = `rgba(110,225,255,${a * (0.5 + 0.5 * k) + Math.sin(t * 3 + y * 0.3) * 0.04})`;
        v.fillRect(sx - 64, y, 128, 2);
      }
    },
    light: (t) => ({ x: ARCH.x, y: ARCH.y - 36, r: 150, col: [85, 214, 255], a: 0.35 + Math.sin(t * 2.1) * 0.08, night: true }),
  });
  col.addRect(ARCH.x - 84, ARCH.y - 6, ARCH.x - 64, ARCH.y + 4);
  col.addRect(ARCH.x + 64, ARCH.y - 6, ARCH.x + 84, ARCH.y + 4);
  col.addRect(ARCH.x - 220, ARCH.y - 6, ARCH.x - 86, ARCH.y + 4);
  col.addRect(ARCH.x + 86, ARCH.y - 6, ARCH.x + 220, ARCH.y + 4);
  col.addRect(ARCH.x - 64, ARCH.y - 14, ARCH.x + 64, ARCH.y - 2);
  for (const [dx, dy, i] of [[-90, 60, 0], [100, 64, 1], [-60, 90, 2], [70, 96, 3]] as const) props.push({ kind: 'rock', x: ARCH.x + dx, y: ARCH.y + dy, img: kit.boulders[i] });

  // ---------- luz e clima: começa a noite fria e amanhece perto do portal ----------
  const env = cloneEnv(NIGHT);
  const tmpEnv = cloneEnv(SUNSET);
  let progress = entry === 'portal' ? 0.97 : 0;
  const progressNow = () => route.progress(player.x, player.y);
  let dark = entry === 'portal' ? 0 : 1;
  let px = 0;
  let py = 0;

  // ---------- combate: três encontros com espíritos da névoa ----------
  const combat = new CombatSystem({
    col,
    player,
    ui,
    game,
    fx,
    teleport,
    start: { x: stickSpot.x, y: stickSpot.y, dir: 'up' },
    torchLit: () => dark > 0.12,
  });
  const armed = () => game.has('galho') || game.has('espada');
  const mistWall = (f: number, span = 44) => {
    const pts: { x: number; y: number }[] = [];
    for (let o = -span; o <= span + 0.01; o += 14) {
      const s = route.spot(f, o);
      pts.push({ x: s.x, y: s.y });
    }
    return pts;
  };
  const isTouchLike = window.matchMedia('(pointer: coarse)').matches;
  const encounter = (id: string, f: number, aheadM: number, enemies: { kind: 'fiapo' | 'sombra' | 'corvo'; distM: number; side: number; hp?: number }[], onStart?: () => void) => {
    const trig = route.spot(f);
    const wallF = f + fm(aheadM);
    const w = route.spot(wallF);
    combat.add({
      id,
      x: trig.x,
      y: trig.y,
      radius: 90,
      enemies: enemies.map((e) => {
        const p = route.spot(f + fm(e.distM), e.side);
        return { kind: e.kind, x: p.x, y: p.y, hp: e.hp };
      }),
      barrier: mistWall(wallF),
      checkpoint: { x: w.x - w.tx * 30, y: w.y - w.ty * 30, dir: 'up' },
      enabled: armed,
      onStart,
    });
  };
  encounter('forest_1', 0.255, 18, [{ kind: 'fiapo', distM: 11, side: 0 }], () => {
    ui.toast(T.mist.wall);
    ui.toast(isTouchLike ? content.combat.tutorialTouch : content.combat.tutorialDesktop);
  });
  encounter('forest_2', 0.5, 20, [{ kind: 'fiapo', distM: 11, side: -15 }, { kind: 'fiapo', distM: 13, side: 15 }]);
  encounter('forest_3', 0.86, 22, [{ kind: 'sombra', distM: 13, side: 0, hp: 5 }, { kind: 'fiapo', distM: 10, side: 20 }]);

  // ---------- interações ----------
  const interactables: Interactable[] = [];
  const add = (x: number, y: number, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean, markFn?: () => boolean) =>
    interactables.push({ x, y, radius, prompt, onInteract, enabled, mark: markFn });

  add(startPos[0], startPos[1], 45, T.back.prompt, () => void openMap(), () => game.has('mapa'));
  add(ribbonSpot.x, ribbonSpot.y, 38, T.ribbon.prompt, () => void useRibbon(), () => !game.flag('forest_ribbon'), () => !game.flag('forest_ribbon'));
  async function useRibbon() {
    await ui.tell(T.ribbon.lines);
    game.setFlag('forest_ribbon');
    game.addItem('fita');
    ui.toast(fmt(content.ui.gotItem, { name: content.items.fita.name }));
    await ui.narrate(T.ribbon.fragment.title, T.ribbon.fragment.lines, 'fragment');
  }
  add(tracksSpot.x, tracksSpot.y, 55, T.tracks.prompt, () => void useTracks(), () => !game.flag('forest_tracks'), () => !game.flag('forest_tracks') && game.flag('forest_ribbon'));
  async function useTracks() {
    await ui.tell(T.tracks.lines);
    game.setFlag('forest_tracks');
  }
  const stickAvail = () => game.flag('forest_tracks') && !game.has('galho') && !game.has('espada');
  add(stickSpot.x, stickSpot.y, 36, T.stick.prompt, () => void useStick(), stickAvail, stickAvail);
  async function useStick() {
    await ui.tell(T.stick.lines);
    game.addItem('galho');
    ui.toast(fmt(content.ui.gotItem, { name: content.items.galho.name }));
  }
  add(ARCH.x, ARCH.y + 70, 70, T.portal.prompt, () => void usePortal(), undefined, () => !game.flag(doneFlag('forest')));
  async function usePortal() {
    if (!game.flag(doneFlag('forest'))) {
      await ui.tell(T.portal.lines);
      await ui.narrate(T.portal.fragment.title, T.portal.fragment.lines, 'fragment');
      game.setFlag(doneFlag('forest'));
      await ui.tell(T.portal.after);
    } else await ui.tell([T.portal.done]);
    await goTo('village');
  }

  // ---------- objetivo ----------
  const objective = () => {
    if (game.flag(doneFlag('forest'))) return T.objective.done;
    const f = progressNow();
    if (!game.flag('forest_ribbon') && f < 0.2) return f > 0.03 ? T.objective.ribbon : T.objective.follow;
    if (!game.flag('forest_tracks')) return T.objective.horse;
    if (!armed()) return T.objective.stick;
    if (combat.fighting) return T.objective.fight;
    if (f > HORSE_WAKES_AT) return T.objective.portal;
    if ((f > 0.18 && f < 0.34) || (f > 0.5 && f < 0.7)) return T.objective.fireflies;
    return T.objective.follow;
  };

  // ---------- vagalumes: os do ambiente e os que guiam pelo caminho certo ----------
  const flies = Array.from({ length: 220 }, () => {
    const r = trails[Math.floor(rng() * trails.length)];
    const s = r.spot(rng(), (rng() - 0.5) * 110);
    return { x: s.x, y: s.y, p: rng() * 6.28, s: 0.35 + rng() * 0.7 };
  });
  const flyPos = (f: { x: number; y: number; p: number; s: number }, t: number) => ({ x: f.x + Math.sin(t * f.s + f.p) * 22, y: f.y + Math.cos(t * f.s * 0.8 + f.p) * 14 });
  const guideF = () => Math.min(0.995, progressNow() + 0.004);
  const guide = (t: number) => {
    const out: { x: number; y: number; a: number }[] = [];
    const f0 = guideF();
    for (let i = 0; i < 14; i++) {
      const g = Math.min(1, f0 + (i / 14) * 0.09);
      const s = route.spot(g, Math.sin(t * 0.9 + i * 1.7) * 14);
      out.push({ x: s.x, y: s.y - 10 - Math.abs(Math.sin(t * 1.3 + i)) * 6, a: 0.45 + 0.55 * Math.sin(t * 3 + i * 1.3) ** 2 });
    }
    return out;
  };

  let lastObjective = '';
  let objTimer = 0;
  const deadFired = [false, false];

  const area: Area2D = {
    id: 'forest',
    name: T.areaName,
    w: W,
    h: H,
    ground: ground.canvas,
    props,
    collision: col,
    entries: {
      start: { x: startPos[0], y: startPos[1] - 8, dir: 'up' },
      /** Quem volta pelo mapa depois de sair da floresta chega do lado do portal, já de dia. */
      portal: { x: ARCH.x, y: ARCH.y + 110, dir: 'up' },
    },
    interactables,
    env,
    combat,
    torchLit: () => dark > 0.12,
    isPath: (x, y) => ground.isPath(x, y),
    drawables: () => {},
    lights(out, t) {
      // vagalumes do ambiente, só perto do jogador
      const night = Math.max(0, Math.min(1, dark + (1 - smoothstep(0.6, 0.93, progress)) * 0.15));
      if (night < 0.05) return;
      for (const f of flies) {
        if (Math.abs(f.x - px) > 260 || Math.abs(f.y - py) > 160) continue;
        const q = flyPos(f, t);
        const blink = 0.5 + 0.5 * Math.sin(t * 2.2 * f.s + f.p * 3);
        out.push({ x: q.x, y: q.y, r: 15, col: [210, 255, 120], a: 0.55 * night * blink, night: true } as Light);
      }
      if (night > 0.1) for (const g of guide(t)) out.push({ x: g.x, y: g.y, r: 20, col: [255, 226, 130], a: 0.5 * night * g.a, night: true });
    },
    drawAdditive(g, cx, cy, s, t) {
      const night = Math.max(0, Math.min(1, dark + (1 - smoothstep(0.6, 0.93, progress)) * 0.15));
      if (night < 0.05) return;
      g.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        if (Math.abs(f.x - px) > 260 || Math.abs(f.y - py) > 160) continue;
        const q = flyPos(f, t);
        const blink = 0.5 + 0.5 * Math.sin(t * 2.2 * f.s + f.p * 3);
        const a = (0.12 + 0.88 * night) * blink;
        if (a < 0.05) continue;
        g.fillStyle = `rgba(240,255,160,${a})`;
        g.fillRect(Math.round((q.x - cx) * s), Math.round((q.y - cy) * s), s, s);
      }
      if (night > 0.1) {
        for (const q of guide(t)) {
          g.fillStyle = `rgba(255,228,120,${0.15 * night * q.a})`;
          g.fillRect(Math.round((q.x - cx - 3) * s), Math.round((q.y - cy - 3) * s), 7 * s, 7 * s);
          g.fillStyle = `rgba(255,244,170,${Math.min(1, 0.9 * night * q.a)})`;
          g.fillRect(Math.round((q.x - cx) * s), Math.round((q.y - cy) * s), s * 2, s * 2);
        }
      }
    },
    update(dt, t, pl) {
      px = pl.x;
      py = pl.y;
      // quanto da trilha já foi: a floresta começa na noite fria e amanhece perto do portal
      progress += (progressNow() - progress) * (1 - Math.exp(-3 * dt));
      lerpEnv(NIGHT, SUNSET, smoothstep(0.3, 0.64, progress), tmpEnv);
      lerpEnv(tmpEnv, GOLDEN_MORNING, smoothstep(0.6, 0.93, progress), env);
      dark = 1 - smoothstep(0.3, 0.9, progress);
      env.dark = dark;
      audio.mood = dark;

      // clareiras sem saída: uma frase gentil, uma vez por visita
      deadEnds.forEach((d, i) => {
        const dist = Math.hypot(pl.x - d.x, pl.y - d.y);
        if (dist < 75 && !deadFired[i] && !ui.inDialog) {
          deadFired[i] = true;
          void ui.tell(T.deadEnd[i]);
        } else if (dist > 180) deadFired[i] = false;
      });

      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.5;
        const o = objective();
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
      void t;
    },
    onEnter() {
      if (!game.flag('forest_woke')) {
        game.setFlag('forest_woke');
        void ui.narrate(T.wake.header, T.wake.lines);
      }
    },
    debug: { route, trails, combat, setProgress: (f: number) => { const p = route.at(f); player.place(p.x, p.y); } },
  };
  return area;
}
