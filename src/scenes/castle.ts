import * as THREE from 'three';
import { CollisionWorld, type BoxCollider } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { createFlame } from '../entities/torch';
import { Npc, NPC_ASSETS, disposeNpcMaterials } from '../entities/npc';
import { sparkleMarker, type Marker } from '../fx/markers';
import { rng } from '../world/noise';
import { playMemoryOrder } from '../ui/minigames';
import { content, fmt } from '../content';
import { doneFlag } from './registry';
import { ISOMETRIC, type Area, type AreaContext, type Interactable } from './types';

/**
 * Castelo: três zonas lado a lado (60 m entre os centros), só a atual fica visível; trocar de zona escurece a tela
 * e move o jogador (`ctx.teleport`), como nos andares da Torre.
 *  1. Pátio do Portão: três fechaduras (espiga, estrela, cobre). Cada chave é gasta ao girar.
 *  2. Labirinto Escuro: a tocha alcança pouco. O cristal (gasto num pedestal) acende setas nas bifurcações do caminho certo,
 *     a espada corta teias que fecham corredores e a Poção de Coragem (gasta) aumenta o alcance da tocha.
 *  3. Salão das Memórias: a Guardiã pede as lembranças em ordem (`playMemoryOrder`), o brinde gasta a garrafa
 *     e a porta do trono abre. Atravessá-la conclui o Castelo.
 */

const ASSET_NAMES = [
  'floor_tile_large', 'floor_tile_large_rocks', 'wall', 'wall_cracked', 'wall_broken', 'wall_doorway', 'wall_corner',
  'torch_mounted', 'candle_triple', 'candle_lit', 'banner_patternA_red', 'barrel_small', 'crates_stacked',
];
export const CASTLE_ASSETS = [...ASSET_NAMES.map(DUNGEON), ...NPC_ASSETS];

const T = content.castle;
const SPACING = 60;
/** Meia largura das salas quadradas (pátio e salão). */
const HALF = 8;
/** Labirinto: grade de N × N peças de TILE metros (as ímpares são corredor). */
const CELLS = 7;
const N = CELLS * 2 + 1;
const MID = (N - 1) / 2;
const TILE = 2.5;
const WALL_H = 2.6;
const START_TILE = { r: N - 2, c: 1 };
const EXIT_TILE = { r: 1, c: N - 2 };

const LOCKS = ['trigo', 'estrela', 'cobre'] as const;
type LockId = (typeof LOCKS)[number];
const LOCK_COLOR: Record<LockId, number> = { trigo: 0xe8c040, estrela: 0x9ad0ff, cobre: 0xe07a30 };
const lockFlag = (id: LockId) => `castle_lock_${id}`;
const webFlag = (n: number) => `castle_web_${n}`;
const FLAGS = { crystal: 'castle_crystal', potion: 'castle_potion', memories: 'castle_memories', toast: 'castle_toast' };
const memFlag = (id: string) => `mem_${id}`;

/** Labirinto perfeito (sempre existe um único caminho) por busca em profundidade com sorteio fixo. */
function makeMaze(rand: () => number): boolean[][] {
  const open = Array.from({ length: N }, () => new Array<boolean>(N).fill(false));
  const seen = Array.from({ length: CELLS }, () => new Array<boolean>(CELLS).fill(false));
  const stack: [number, number][] = [[CELLS - 1, 0]];
  seen[CELLS - 1][0] = true;
  open[CELLS * 2 - 1][1] = true;
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = dirs
      .map(([di, dj]) => [i + di, j + dj, di, dj] as const)
      .filter(([a, b]) => a >= 0 && b >= 0 && a < CELLS && b < CELLS && !seen[a][b])
      .sort(() => rand() - 0.5);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [a, b, di, dj] = next[0];
    seen[a][b] = true;
    open[2 * a + 1][2 * b + 1] = true;
    open[2 * i + 1 + di][2 * j + 1 + dj] = true;
    stack.push([a, b]);
  }
  return open;
}

/** Caminho do início até a saída (lista de [linha, coluna]). */
function solve(open: boolean[][]): [number, number][] {
  const key = (r: number, c: number) => r * N + c;
  const prev = new Map<number, number>();
  const queue = [key(START_TILE.r, START_TILE.c)];
  prev.set(queue[0], -1);
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const r = Math.floor(cur / N);
    const c = cur % N;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N || !open[nr][nc] || prev.has(key(nr, nc))) continue;
      prev.set(key(nr, nc), cur);
      queue.push(key(nr, nc));
    }
  }
  const path: [number, number][] = [];
  for (let k = key(EXIT_TILE.r, EXIT_TILE.c); k !== -1; k = prev.get(k)!) path.unshift([Math.floor(k / N), k % N]);
  return path;
}

/** Teia: raios e anéis num plano vertical, de uma parede à outra do corredor. */
function webGeometry(radius: number) {
  const pts: number[] = [];
  const spokes = 8;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    pts.push(0, 0, 0, Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  for (const k of [0.35, 0.65, 1]) {
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2;
      const a1 = ((i + 1) / spokes) * Math.PI * 2;
      const sag = k * radius * 0.92;
      pts.push(Math.cos(a0) * sag, Math.sin(a0) * sag, 0, Math.cos(a1) * sag, Math.sin(a1) * sag, 0);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

interface Zone {
  group: THREE.Group;
  flames: ReturnType<typeof createFlame>[];
  lights: { light: THREE.PointLight; base: number }[];
}

interface Web {
  r: number;
  c: number;
  x: number;
  z: number;
  group: THREE.Group;
  collider: BoxCollider;
  cut: boolean;
}

export function createCastle(ctx: AreaContext): Area {
  const { ui, game, player } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const world = new CollisionWorld();
  const rand = rng(31);
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];
  const disposables: { dispose(): void }[] = [];
  const v3 = (x: number, z: number) => new THREE.Vector3(x, 0, z);

  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = <G extends THREE.BufferGeometry>(g: G) => {
    disposables.push(g);
    return g;
  };

  const startZone = ctx.entry === 'maze' ? 1 : ctx.entry === 'hall' ? 2 : 0;
  let cur = startZone;
  let switching = false;

  // ---------- ajudantes de montagem (cada zona tem o seu centro em x) ----------
  const zones: Zone[] = [0, 1, 2].map(() => ({ group: new THREE.Group(), flames: [], lights: [] }));
  zones.forEach((z, i) => {
    z.group.visible = i === startZone;
    scene.add(z.group);
  });
  const centerX = (zone: number) => zone * SPACING;

  function kit(zone: number) {
    const z = zones[zone];
    const cx = centerX(zone);
    const put = (name: string, x: number, zz: number, rot = 0, scale = 1, y = 0) => {
      const m = model(DUNGEON(name));
      m.position.set(cx + x, y, zz);
      m.rotation.y = rot;
      m.scale.setScalar(scale);
      z.group.add(m);
      return m;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, zz: number, rot = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(cx + x, y, zz);
      o.rotation.y = rot;
      o.castShadow = true;
      o.receiveShadow = true;
      z.group.add(o);
      return o;
    };
    const solid = (x0: number, x1: number, z0: number, z1: number) => world.addBox(cx + x0, cx + x1, z0, z1);
    const light = (color: number, intensity: number, distance: number, x: number, y: number, zz: number) => {
      const l = new THREE.PointLight(color, intensity, distance, 2);
      l.position.set(cx + x, y, zz);
      z.group.add(l);
      z.lights.push({ light: l, base: intensity });
      return l;
    };
    const mountTorch = (x: number, zz: number, rot: number) => {
      put('torch_mounted', x, zz, rot, 1, 2.1);
      const flame = createFlame(0.55, 4);
      const tip = new THREE.Vector3(0, 0.62, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      flame.mesh.position.set(cx + x + tip.x, 2.1 + tip.y, zz + tip.z);
      z.group.add(flame.mesh);
      z.flames.push(flame);
    };
    return { cx, group: z.group, put, mesh, solid, light, mountTorch };
  }

  /** Sala quadrada (pátio e salão): chão, paredes, cantos e colisão. `skipNorth` deixa o vão do portão. */
  function buildRoom(zone: number, opts: { skipNorth?: number[]; northDoor?: boolean }) {
    const k = kit(zone);
    for (const gx of [-6, -2, 2, 6]) {
      for (const gz of [-6, -2, 2, 6]) {
        const t = k.put(rand() < 0.22 ? 'floor_tile_large_rocks' : 'floor_tile_large', gx, gz, Math.floor(rand() * 4) * (Math.PI / 2));
        t.traverse((o) => (o.castShadow = false));
      }
    }
    const plain = ['wall', 'wall_cracked', 'wall', 'wall_broken'];
    const wallName = () => plain[Math.floor(rand() * plain.length)];
    for (const s of [-6, -2, 2, 6]) {
      if (!opts.skipNorth?.includes(s)) occluders.push(k.put(opts.northDoor && s === 2 ? 'wall_doorway' : wallName(), s, -HALF - 0.5, 0));
      occluders.push(k.put(s === 2 ? 'wall_doorway' : wallName(), s, HALF + 0.5, Math.PI));
      occluders.push(k.put(wallName(), -HALF - 0.5, s, Math.PI / 2));
      occluders.push(k.put(wallName(), HALF + 0.5, s, -Math.PI / 2));
    }
    k.put('wall_corner', -HALF - 0.5, -HALF - 0.5, 0);
    k.put('wall_corner', HALF + 0.5, -HALF - 0.5, -Math.PI / 2);
    k.put('wall_corner', HALF + 0.5, HALF + 0.5, Math.PI);
    k.put('wall_corner', -HALF - 0.5, HALF + 0.5, Math.PI / 2);
    if (opts.skipNorth) {
      k.solid(-HALF - 2, -4, -HALF - 2, -HALF + 0.1);
      k.solid(4, HALF + 2, -HALF - 2, -HALF + 0.1);
      k.solid(-4, 4, -HALF - 4, -HALF - 2.5);
    } else {
      k.solid(-HALF - 2, HALF + 2, -HALF - 2, -HALF + 0.1);
    }
    k.solid(-HALF - 2, HALF + 2, HALF - 0.1, HALF + 2);
    k.solid(-HALF - 2, -HALF + 0.1, -HALF - 2, HALF + 2);
    k.solid(HALF - 0.1, HALF + 2, -HALF - 2, HALF + 2);
    return k;
  }

  const hemi = (zone: number, intensity: number) => {
    const h = new THREE.HemisphereLight(0x6a7a9a, 0x1a120c, intensity);
    zones[zone].group.add(h);
  };

  // ======================= ZONA 0 · PÁTIO DO PORTÃO =======================
  hemi(0, 0.3);
  const yard = buildRoom(0, { skipNorth: [-2, 2] });
  yard.mountTorch(-5.5, HALF, Math.PI);
  yard.mountTorch(5.5, HALF, Math.PI);
  yard.mountTorch(-HALF, 2, Math.PI / 2);
  yard.mountTorch(HALF, 2, -Math.PI / 2);
  yard.light(0xffb070, 11, 20, 0, 3.6, 0);
  yard.put('banner_patternA_red', -6, -HALF + 0.4, 0);
  yard.put('banner_patternA_red', 6, -HALF + 0.4, 0);
  yard.put('barrel_small', 6.4, 5.8);
  yard.solid(5.9, 6.9, 5.3, 6.3);
  yard.put('crates_stacked', -6, 6, 0.3);
  yard.solid(-7, -5, 5, 7);

  // portão: duas folhas que deslizam para os lados
  const woodDark = std(0x3a2616);
  const iron = std(0x2a2a30, { metalness: 0.4, roughness: 0.6 });
  const leafGeo = geo(new THREE.BoxGeometry(3.9, 3.6, 0.45));
  const bandGeo = geo(new THREE.BoxGeometry(3.9, 0.18, 0.5));
  const leaves = [-1, 1].map((side) => {
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(leafGeo, woodDark);
    leaf.position.y = 1.8;
    leaf.castShadow = leaf.receiveShadow = true;
    g.add(leaf);
    for (const y of [0.7, 1.8, 2.9]) {
      const band = new THREE.Mesh(bandGeo, iron);
      band.position.y = y;
      g.add(band);
    }
    g.position.set(yard.cx + side * 2, 0, -HALF - 0.35);
    yard.group.add(g);
    return { g, side };
  });
  const gateLight = yard.light(0xffcc88, 0, 14, 0, 2.6, -HALF - 2);
  const allLocks = () => LOCKS.every((id) => game.flag(lockFlag(id)));
  let gateOpen = allLocks() ? 1 : 0;
  let gateCollider: BoxCollider | null = allLocks() ? null : world.addBox(yard.cx - 4, yard.cx + 4, -HALF - 2.5, -HALF + 0.1);
  const openGateCollider = () => {
    if (gateCollider) world.remove(gateCollider);
    gateCollider = null;
  };

  // pedestais das fechaduras
  const pedGeo = geo(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 7));
  const orbGeo = geo(new THREE.SphereGeometry(0.28, 12, 10));
  const stone = std(0x6c6a84);
  const locks = LOCKS.map((id, i) => {
    const x = (i - 1) * 4.5;
    const zz = -HALF + 3.6;
    yard.mesh(pedGeo, stone, x, 0.55, zz);
    yard.solid(x - 0.7, x + 0.7, zz - 0.7, zz + 0.7);
    const orb = new THREE.Mesh(orbGeo, std(0x222222, { emissive: LOCK_COLOR[id], emissiveIntensity: 0.15, roughness: 0.3 }));
    orb.position.set(yard.cx + x, 1.5, zz);
    yard.group.add(orb);
    return { id, x, z: zz, orb, glow: game.flag(lockFlag(id)) ? 1 : 0 };
  });

  // ======================= ZONA 1 · LABIRINTO ESCURO =======================
  hemi(1, 0.16);
  const mz = kit(1);
  const mazeOpen = makeMaze(rand);
  const path = solve(mazeOpen);
  const tx = (c: number) => mz.cx + (c - MID) * TILE;
  const tz = (r: number) => (r - MID) * TILE;

  // chão
  const floor = new THREE.Mesh(geo(new THREE.PlaneGeometry(N * TILE + 4, N * TILE + 4).rotateX(-Math.PI / 2)), std(0x5a5a6a, { roughness: 1 }));
  floor.position.set(mz.cx, 0, 0);
  floor.receiveShadow = true;
  mz.group.add(floor);

  // paredes: sequências horizontais de peças viram uma caixa só
  const wallMat = std(0x7a7888);
  const runGeos = new Map<number, THREE.BoxGeometry>();
  for (let r = 0; r < N; r++) {
    let c = 0;
    while (c < N) {
      if (mazeOpen[r][c]) {
        c++;
        continue;
      }
      let e = c;
      while (e + 1 < N && !mazeOpen[r][e + 1]) e++;
      const len = e - c + 1;
      let g = runGeos.get(len);
      if (!g) {
        g = geo(new THREE.BoxGeometry(len * TILE, WALL_H, TILE));
        runGeos.set(len, g);
      }
      const wall = new THREE.Mesh(g, wallMat);
      wall.position.set(mz.cx + ((c + e) / 2 - MID) * TILE, WALL_H / 2, tz(r));
      wall.castShadow = wall.receiveShadow = true;
      mz.group.add(wall);
      occluders.push(wall);
      world.addBox(mz.cx + (c - MID) * TILE - TILE / 2, mz.cx + (e - MID) * TILE + TILE / 2, tz(r) - TILE / 2, tz(r) + TILE / 2);
      c = e + 1;
    }
  }

  // portas do labirinto: um painel luminoso na parede de cada ponta
  const doorGeo = geo(new THREE.PlaneGeometry(1.7, 2.1));
  const exitDoor = new THREE.Mesh(doorGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.5), toneMapped: false, fog: false }));
  exitDoor.position.set(tx(EXIT_TILE.c), 1.05, tz(0) + TILE / 2 + 0.02);
  const backDoor = new THREE.Mesh(doorGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.8, 1.8), toneMapped: false, fog: false }));
  backDoor.position.set(tx(START_TILE.c), 1.05, tz(N - 1) - TILE / 2 - 0.02);
  backDoor.rotation.y = Math.PI;
  disposables.push(exitDoor.material as THREE.Material, backDoor.material as THREE.Material);
  mz.group.add(exitDoor, backDoor);
  mz.light(0xffc060, 4, 9, tx(EXIT_TILE.c) - mz.cx, 1.8, tz(EXIT_TILE.r));
  mz.light(0x70b8ff, 2.5, 7, tx(START_TILE.c) - mz.cx, 1.8, tz(START_TILE.r));

  // pedestal do cristal, ao lado da porta de entrada
  const pedPos = v3(tx(START_TILE.c) - 0.85, tz(START_TILE.r) + 0.2);
  mz.mesh(geo(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 6)), stone, pedPos.x - mz.cx, 0.35, pedPos.z);
  const pedCrystal = new THREE.Mesh(
    geo(new THREE.OctahedronGeometry(0.2, 0)),
    std(0x163a4a, { emissive: new THREE.Color(0.35, 1.0, 1.8), emissiveIntensity: 0.1, roughness: 0.25 }),
  );
  pedCrystal.scale.set(0.85, 1.5, 0.85);
  pedCrystal.position.set(pedPos.x, 1.0, pedPos.z);
  mz.group.add(pedCrystal);

  // setas de luz nas bifurcações do caminho certo (aparecem depois do cristal)
  const arrowGeo = geo(
    new THREE.ShapeGeometry(
      new THREE.Shape([new THREE.Vector2(0, 0.7), new THREE.Vector2(0.42, -0.45), new THREE.Vector2(0, -0.12), new THREE.Vector2(-0.42, -0.45)]),
    ).rotateX(-Math.PI / 2),
  );
  const arrowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 1.8), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  disposables.push(arrowMat);
  const arrows = new THREE.Group();
  arrows.visible = game.flag(FLAGS.crystal);
  mz.group.add(arrows);
  const neighbors = (r: number, c: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => mazeOpen[r + dr]?.[c + dc]).length;
  for (let i = 0; i < path.length - 1; i++) {
    const [r, c] = path[i];
    if (neighbors(r, c) < 3) continue;
    const [nr, nc] = path[i + 1];
    const a = new THREE.Mesh(arrowGeo, arrowMat);
    a.position.set(tx(c), 0.03, tz(r));
    a.rotation.y = Math.atan2(-(nc - c), -(nr - r));
    arrows.add(a);
  }

  // teias fechando o corredor em dois pontos do caminho certo
  const webMat = new THREE.LineBasicMaterial({ color: 0xe8ecf0, transparent: true, opacity: 0.75 });
  const webGeo = webGeometry(TILE / 2 - 0.08);
  disposables.push(webMat, webGeo);
  const webs: Web[] = [];
  const straightAt = (from: number) => {
    for (let d = 0; d < path.length; d++) {
      for (const i of [from + d, from - d]) {
        if (i < 2 || i > path.length - 3) continue;
        const [pr, pc] = path[i - 1];
        const [nr, nc] = path[i + 1];
        if ((pr === nr || pc === nc) && neighbors(path[i][0], path[i][1]) === 2) return i;
      }
    }
    return -1;
  };
  for (const frac of [0.35, 0.7]) {
    const i = straightAt(Math.floor(path.length * frac));
    if (i < 0) continue;
    const [r, c] = path[i];
    const alongZ = path[i - 1][0] !== path[i + 1][0];
    const g = new THREE.Group();
    g.add(new THREE.LineSegments(webGeo, webMat));
    g.position.set(tx(c), 1.2, tz(r));
    g.rotation.y = alongZ ? 0 : Math.PI / 2;
    mz.group.add(g);
    const n = webs.length;
    const cut = game.flag(webFlag(n));
    const collider = world.addBox(tx(c) - TILE / 2, tx(c) + TILE / 2, tz(r) - TILE / 2, tz(r) + TILE / 2);
    if (cut) {
      g.visible = false;
      world.remove(collider);
    }
    webs.push({ r, c, x: tx(c), z: tz(r), group: g, collider, cut });
  }

  // ======================= ZONA 2 · SALÃO DAS MEMÓRIAS =======================
  hemi(2, 0.3);
  const hall = buildRoom(2, { northDoor: true });
  hall.mountTorch(-4, HALF, Math.PI);
  hall.mountTorch(4, HALF, Math.PI);
  hall.light(0xffb070, 10, 20, 0, 3.6, 0);
  hall.light(0xffd08a, 5, 10, 0, 2.4, 2);

  // molduras: uma por lembrança, na ordem certa (acendem sozinhas ao reunir a lembrança)
  const gold = std(0xb8963a, { metalness: 0.3, roughness: 0.5 });
  const frameGeo = geo(new THREE.BoxGeometry(0.18, 2.3, 1.7));
  const paneGeo = geo(new THREE.PlaneGeometry(1.35, 1.95));
  const PANE_COLORS = [0xff8a6a, 0xffd36a, 0x9aff8a, 0x6ad8ff, 0xb08aff, 0xff8ad0];
  const frames = T.hall.order.map((o, i) => {
    const west = i < 3;
    const zz = -4.6 + (i % 3) * 4.2;
    const x = west ? -HALF + 0.5 : HALF - 0.5;
    hall.mesh(frameGeo, gold, x, 1.9, zz);
    const pane = new THREE.Mesh(paneGeo, std(0x151515, { emissive: PANE_COLORS[i], emissiveIntensity: 0.05, roughness: 0.4 }));
    pane.position.set(hall.cx + x + (west ? 0.1 : -0.1), 1.9, zz);
    pane.rotation.y = west ? Math.PI / 2 : -Math.PI / 2;
    hall.group.add(pane);
    hall.solid(west ? -HALF : HALF - 0.9, west ? -HALF + 0.9 : HALF, zz - 0.9, zz + 0.9);
    return { id: o.id, pane, x, z: zz, glow: 0 };
  });

  // mesa do brinde
  const wood = std(0x5a3a22);
  hall.mesh(geo(new THREE.BoxGeometry(2.8, 0.9, 1.3)), wood, 0, 0.45, 2.6);
  hall.solid(-1.6, 1.6, 1.8, 3.4);
  const cupGeo = geo(new THREE.CylinderGeometry(0.1, 0.07, 0.24, 8));
  for (const dx of [-0.5, 0.5]) hall.mesh(cupGeo, gold, dx, 1.02, 2.6).castShadow = false;
  hall.put('candle_triple', 0, 2.6, 0.4, 1, 0.9);

  // selo da porta do trono
  const veil = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(3.2, 3.6)),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.35, 0.25), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  disposables.push(veil.material as THREE.Material);
  veil.position.set(hall.cx + 2, 1.9, -HALF - 0.1);
  hall.group.add(veil);
  let veilOpacity = game.flag(FLAGS.toast) ? 0 : 1;

  // guardiã
  const guardian = new Npc({
    character: 'Mage',
    position: new THREE.Vector3(hall.cx - 3, 0, -3),
    facing: 0.4,
    tint: 0xe8b8d8,
    accessories: [{ kind: 'scarf', color: 0x8a2a5a }],
    work: { clip: 'Interact', every: 9 },
  });
  guardian.position.y = 0;
  hall.group.add(guardian.object);
  world.addCircle(guardian.position.x, guardian.position.z, 0.6);

  // ======================= interações =======================
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });
  const inZone = (z: number) => () => cur === z && !switching;
  const and = (...fns: (() => boolean)[]) => () => fns.every((f) => f());

  async function changeZone(to: number, x: number, z: number, rot: number, entry: string) {
    if (switching) return;
    switching = true;
    try {
      await ui.fade(true, T.zoneNames[to]);
      cur = to;
      zones.forEach((zn, i) => (zn.group.visible = i === cur));
      ctx.teleport(x, z, rot);
      game.setArea('castle', entry);
      await ui.fade(false);
      if (to === 1 && !game.flag('castle_maze_seen')) {
        game.setFlag('castle_maze_seen');
        await ui.tell(T.maze.intro);
      } else if (to === 2 && !game.flag('castle_hall_seen')) {
        game.setFlag('castle_hall_seen');
        await ui.tell(T.hall.intro);
      }
    } finally {
      switching = false;
    }
  }
  const goYard = () => changeZone(0, 2, HALF - 3.2, Math.PI, 'start');
  const goMaze = () => changeZone(1, tx(START_TILE.c), tz(START_TILE.r), Math.PI, 'maze');
  const goMazeExit = () => changeZone(1, tx(EXIT_TILE.c), tz(EXIT_TILE.r), 0, 'maze');
  const goHall = () => changeZone(2, centerX(2) + 2, HALF - 3.2, Math.PI, 'hall');

  // ---- pátio ----
  add(v3(2, HALF - 1.6), 2.6, T.back.prompt, () => void ctx.openMap(), inZone(0));
  for (const lk of locks) {
    const L = T.locks[lk.id];
    add(
      v3(lk.x, lk.z),
      1.9,
      L.prompt,
      () => void useLock(lk.id),
      and(inZone(0), () => !game.flag(lockFlag(lk.id))),
    );
  }
  async function useLock(id: LockId) {
    const L = T.locks[id];
    if (!game.has(L.key)) return void (await ui.tell(L.missing));
    game.removeItem(L.key);
    game.setFlag(lockFlag(id));
    await ui.tell(L.turned);
    if (allLocks()) {
      openGateCollider();
      await ui.tell(T.gate.opened);
    }
  }
  add(v3(0, -HALF + 1.2), 2.4, T.gate.examinePrompt, () => void ui.tell(T.gate.sealed), and(inZone(0), () => !allLocks()));
  add(v3(0, -HALF + 1.2), 2.4, T.gate.enterPrompt, () => void goMaze(), and(inZone(0), allLocks));

  // ---- labirinto ----
  add(pedPos, 1.05, T.maze.pedestalPrompt, () => void useCrystal(), and(inZone(1), () => !game.flag(FLAGS.crystal)));
  async function useCrystal() {
    if (!game.has('cristal')) return void (await ui.tell(T.maze.pedestalNoCrystal));
    game.removeItem('cristal');
    game.setFlag(FLAGS.crystal);
    arrows.visible = true;
    await ui.tell(T.maze.pedestalLit);
  }
  add(
    pedPos,
    1.05,
    T.maze.potionPrompt,
    () => {
      game.removeItem('pocao');
      game.setFlag(FLAGS.potion);
      void ui.tell(T.maze.potionLines);
    },
    and(inZone(1), () => game.has('pocao') && !game.flag(FLAGS.potion) && (game.flag(FLAGS.crystal) || !game.has('cristal'))),
  );
  add(v3(tx(START_TILE.c), tz(START_TILE.r) + 1.2), 2.1, T.maze.backPrompt, () => void goYard(), inZone(1));
  add(v3(tx(EXIT_TILE.c), tz(EXIT_TILE.r) - 1.0), 2.1, T.maze.exitPrompt, () => void goHall(), inZone(1));
  webs.forEach((w, n) => {
    add(v3(w.x, w.z), 2.9, T.maze.webPrompt, () => void cutWeb(w, n), and(inZone(1), () => !w.cut));
  });
  async function cutWeb(w: Web, n: number) {
    if (!game.has('espada')) return void (await ui.tell(T.maze.webNoSword));
    w.cut = true;
    w.group.visible = false;
    world.remove(w.collider);
    game.setFlag(webFlag(n));
    ui.toast(T.maze.webCut[0]);
  }

  // ---- salão ----
  add(v3(centerX(2) + 2, HALF - 1.6), 2.6, T.hall.downPrompt, () => void goMazeExit(), inZone(2));
  add(guardian.position, 3.2, T.hall.guardian.prompt, () => void talkGuardian(), inZone(2));
  async function talkGuardian() {
    const G = T.hall.guardian;
    if (game.flag(FLAGS.memories)) return void (await ui.tell(G.after, G.name));
    const have = T.hall.order.filter((o) => game.flag(memFlag(o.id)));
    if (have.length < 2) return void (await ui.tell(G.noMemories, G.name));
    const clues = have.map((o, i) => fmt(G.clueLine, { n: i + 1, clue: o.clue }));
    await ui.tell([...G.greet, ...clues], G.name);
    const M = T.hall.memoryGame;
    const ids = have.map((o) => o.id);
    // as cartas começam fora de ordem (giradas em 2, ou em 1 quando são só duas)
    const shift = ids.length > 2 ? 2 : 1;
    const cards = ids.map((_, i) => ids[(i + shift) % ids.length]).map((id) => ({ id, icon: M.icon, name: content.memories[id as keyof typeof content.memories].title }));
    await playMemoryOrder(ui, M, cards, ids);
    game.setFlag(FLAGS.memories);
    await ui.tell(G.right, G.name);
  }
  frames.forEach((f) => {
    add(v3(centerX(2) + f.x, f.z), 2.4, T.hall.framePrompt, () => {
      if (!game.flag(memFlag(f.id))) return void ui.tell([T.hall.frameDark]);
      void ui.showMemory(content.memories[f.id as keyof typeof content.memories]);
    }, inZone(2));
  });
  add(v3(centerX(2), 4.3), 2.6, T.hall.table.prompt, () => void doToast(), and(inZone(2), () => !game.flag(FLAGS.toast)));
  add(v3(centerX(2), 4.3), 2.6, T.hall.table.prompt, () => void ui.tell(T.hall.table.done), and(inZone(2), () => game.flag(FLAGS.toast)));
  async function doToast() {
    const B = T.hall.table;
    if (!game.flag(FLAGS.memories)) return void (await ui.tell(B.locked));
    if (!game.has('garrafa')) return void (await ui.tell(B.noBottle));
    game.removeItem('garrafa');
    game.setFlag(FLAGS.toast);
    game.setFlag(memFlag('castelo_brinde'));
    await ui.tell(B.lines);
    await ui.showMemory(content.memories.castelo_brinde);
  }
  const doorPos = v3(centerX(2) + 2, -HALF + 1.6);
  add(doorPos, 2.6, T.hall.throne.sealedPrompt, () => void ui.tell(T.hall.throne.sealed), and(inZone(2), () => !game.flag(FLAGS.toast)));
  add(doorPos, 2.6, T.hall.throne.prompt, () => void openThrone(), and(inZone(2), () => game.flag(FLAGS.toast)));
  async function openThrone() {
    const H = T.hall.throne;
    if (game.flag(doneFlag('castle'))) {
      await ui.tell(H.done);
      await ctx.openMap();
      return;
    }
    await ui.tell(H.finale);
    game.setFlag(doneFlag('castle'));
    await ui.showEndCard(H.endTitle, H.endText, H.endButton);
    await ctx.openMap();
  }

  // ---------- marcadores de brilho ----------
  const sparkles: { sprite: Marker; show: () => boolean }[] = [];
  const sparkle = (x: number, y: number, z: number, show: () => boolean) => {
    const sprite = sparkleMarker();
    sprite.position.set(x, y, z);
    scene.add(sprite);
    sparkles.push({ sprite, show });
  };
  for (const lk of locks) sparkle(yard.cx + lk.x, 2.5, lk.z, () => cur === 0 && !game.flag(lockFlag(lk.id)) && game.has(T.locks[lk.id].key));
  sparkle(yard.cx, 4.2, -HALF + 1.2, () => cur === 0 && allLocks());
  sparkle(pedPos.x, 1.9, pedPos.z, () => cur === 1 && !game.flag(FLAGS.crystal) && game.has('cristal'));
  sparkle(centerX(2), 2.4, 2.6, () => cur === 2 && game.flag(FLAGS.memories) && !game.flag(FLAGS.toast) && game.has('garrafa'));
  sparkle(doorPos.x, 4.2, -HALF + 1, () => cur === 2 && game.flag(FLAGS.toast) && !game.flag(doneFlag('castle')));

  // ---------- objetivo ----------
  const objective = (p: THREE.Vector3) => {
    if (game.flag(doneFlag('castle'))) return T.objective.done;
    if (cur === 0) {
      const n = LOCKS.filter((id) => game.flag(lockFlag(id))).length;
      return allLocks() ? T.objective.enter : fmt(T.objective.gate, { n });
    }
    if (cur === 1) {
      const near = webs.find((w) => !w.cut && Math.hypot(w.x - p.x, w.z - p.z) < 7);
      if (near) return fmt(T.objective.webs, { n: webs.filter((w) => w.cut).length, total: webs.length });
      if (!game.flag(FLAGS.crystal) && game.has('cristal')) return T.objective.crystal;
      return T.objective.maze;
    }
    if (!game.flag(FLAGS.memories)) return T.objective.memories;
    if (!game.flag(FLAGS.toast)) return T.objective.toast;
    return T.objective.throne;
  };
  let lastObjective = '';
  let objTimer = 0;
  let reach = 1;

  const entries: NonNullable<Area['entries']> = {
    start: { x: 2, z: HALF - 3.2, rot: Math.PI },
    maze: { x: tx(START_TILE.c), z: tz(START_TILE.r), rot: Math.PI },
    hall: { x: centerX(2) + 2, z: HALF - 3.2, rot: Math.PI },
  };

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(2, 0, HALF - 3.2),
    spawnRot: Math.PI,
    entries,
    camera: ISOMETRIC,
    interactables,
    occluders,
    torchLit: true,
    debug: {
      zones,
      webs,
      path,
      goZone: (n: number) => (n === 0 ? void goYard() : n === 1 ? void goMaze() : void goHall()),
      giveAll: () => {
        for (const id of ['chave_trigo', 'chave_estrela', 'chave_cobre', 'cristal', 'garrafa', 'pocao', 'espada'] as const) if (!game.has(id)) game.addItem(id);
        T.hall.order.forEach((o) => game.setFlag(memFlag(o.id)));
      },
      solveAll: () => {
        LOCKS.forEach((id) => game.setFlag(lockFlag(id)));
        game.setFlag(FLAGS.crystal);
        arrows.visible = true;
        webs.forEach((w, n) => {
          w.cut = true;
          w.group.visible = false;
          world.remove(w.collider);
          game.setFlag(webFlag(n));
        });
        T.hall.order.forEach((o) => game.setFlag(memFlag(o.id)));
        game.setFlag(FLAGS.memories);
      },
    },
    onEnter() {
      if (startZone === 0 && !game.flag('castle_seen')) {
        game.setFlag('castle_seen');
        ui.say(T.intro);
      }
    },
    dispose() {
      guardian.dispose();
      disposeNpcMaterials();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      const zone = zones[cur];
      zone.flames.forEach((f) => f.update(dt));
      zone.lights.forEach((l, i) => (l.light.intensity = l.base * (1 + Math.sin(time * (7 + i * 2.3) + cur) * 0.06) * (l.light === gateLight ? gateOpen : 1)));

      // a tocha ilumina pouco no labirinto; a poção devolve quase todo o alcance
      const want = cur === 1 ? (game.flag(FLAGS.potion) ? 1 : 0.65) : 1;
      if (want !== reach) {
        reach = want;
        player.torch.setReach(want);
      }

      if (cur === 0) {
        if (allLocks()) openGateCollider();
        gateOpen += ((allLocks() ? 1 : 0) - gateOpen) * (1 - Math.exp(-1.6 * dt));
        for (const { g, side } of leaves) g.position.x = yard.cx + side * (2 + gateOpen * 4.2);
        gateLight.intensity = gateOpen * 9;
        for (const lk of locks) {
          lk.glow += ((game.flag(lockFlag(lk.id)) ? 1 : 0) - lk.glow) * (1 - Math.exp(-3 * dt));
          (lk.orb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + lk.glow * 2.4;
        }
      } else if (cur === 1) {
        const lit = game.flag(FLAGS.crystal);
        (pedCrystal.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 2.4 + Math.sin(time * 3) * 0.4 : 0.1;
        pedCrystal.rotation.y = time * 0.8;
        arrowMat.opacity = 0.65 + Math.sin(time * 3.2) * 0.25;
      } else {
        guardian.alert = !game.flag(FLAGS.memories);
        guardian.update(dt, playerPos);
        const ordered = game.flag(FLAGS.memories);
        for (const f of frames) {
          const goal = ordered ? 1 : game.flag(memFlag(f.id)) ? 0.4 : 0;
          f.glow += (goal - f.glow) * (1 - Math.exp(-3 * dt));
          (f.pane.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + f.glow * 1.6;
        }
        veilOpacity += ((game.flag(FLAGS.toast) ? 0 : 1) - veilOpacity) * (1 - Math.exp(-3 * dt));
        (veil.material as THREE.MeshBasicMaterial).opacity = veilOpacity * (0.32 + Math.sin(time * 2.6) * 0.07);
        veil.visible = veilOpacity > 0.01;
      }

      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.4;
        const o = objective(playerPos);
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
      for (const s of sparkles) {
        const on = s.show();
        s.sprite.visible = on;
        if (on) s.sprite.setSize(0.9 + Math.sin(time * 5) * 0.12);
      }
    },
  };
}
