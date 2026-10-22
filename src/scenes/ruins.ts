import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { NIGHT_RUINS, Outdoor, cloneEnv } from '../fx/atmosphere';
import { Fireflies } from '../fx/fireflies';
import { MoonBeams } from '../fx/moonBeams';
import { createFlame } from '../entities/torch';
import { Sparks } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { Terrain, type TerrainPalette } from '../world/terrain';
import { Path } from '../world/paths';
import { Grass } from '../world/grass';
import { rng, smoothstep } from '../world/noise';
import { scatter } from '../world/scatter';
import { updateWind } from '../world/wind';
import {
  PINE_STYLES, bushGeometry, instancedChunked as instanced, natureMaterial, pineGeometry, rockGeometry, tint, type Inst,
} from '../world/nature';
import { playRunes } from '../ui/minigames';
import { CombatSystem } from '../core/combat';
import { content, fmt, type ItemId } from '../content';
import { doneFlag } from './registry';
import type { Area, AreaContext, AreaEnv, Interactable } from './types';

/**
 * Ruínas Esquecidas: um pátio de templo ao ar livre, à noite, cercado por muralhas quebradas.
 * Três altares de cristal, cada um com um desafio: braseiros acesos na ordem dos símbolos da parede,
 * três anéis de pedra e uma pergunta. Cada altar aceso mostra uma memória. Com os três acesos, um cristal
 * aparece no centro do pátio: pegá-lo conclui a área.
 */

const DUNGEON_NAMES = ['wall', 'wall_broken', 'wall_cracked', 'wall_arched', 'pillar_decorated', 'column', 'rubble_large', 'rubble_half', 'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A'];
export const RUINS_ASSETS = DUNGEON_NAMES.map(DUNGEON);

const T = content.ruins;

const NIGHT_STONE: TerrainPalette = {
  grassLight: 0x5d7a63,
  grassDark: 0x35503f,
  dirt: 0x8a8478,
  dirtDark: 0x5f5a55,
  rock: 0x6b6f80,
  forest: 0x2a3d36,
};

const CYAN = new THREE.Color(0.35, 1.0, 1.8);
const START = { x: 0, z: 28 };
/** Centro do pátio e raio da muralha. */
const C = { x: 0, z: -42 };
const RING = 27;
/** Trilha que sai do arco de entrada e chega ao pátio. */
const TRAIL: [number, number][] = [[0, 32], [1.5, 12], [-1, -6], [0, -18]];

type AltarId = 'flames' | 'runes' | 'echo';
const ALTAR_POS: Record<AltarId, { x: number; z: number }> = {
  flames: { x: -16, z: -56 },
  runes: { x: 0, z: -64 },
  echo: { x: 16, z: -56 },
};
const MEMORY_OF: Record<AltarId, keyof typeof content.memories> = {
  flames: 'ruinas_chamas',
  runes: 'ruinas_simbolos',
  echo: 'ruinas_eco',
};
const altarFlag = (id: AltarId) => `ruins_altar_${id}`;
const memoryFlag = (id: keyof typeof content.memories) => `mem_${id}`;

/** Braseiros do altar das chamas: x em relação ao altar, z (para o sul) e símbolo. */
const BRAZIERS = [
  { dx: -6, dz: 5, glyph: 0 },
  { dx: -2, dz: 6.6, glyph: 1 },
  { dx: 2, dz: 6.6, glyph: 2 },
  { dx: 6, dz: 5, glyph: 3 },
];
/** Ordem certa (índices dos braseiros), como aparece pintada na parede. */
const SEQUENCE = [2, 0, 3, 1];

/** Quatro símbolos geométricos desenhados em código (não dependem de fonte do aparelho). */
function drawGlyph(g: CanvasRenderingContext2D, kind: number, cx: number, cy: number, r: number) {
  g.beginPath();
  if (kind === 0) {
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.moveTo(cx + r * 0.28, cy);
    g.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  } else if (kind === 1) {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.95, cy + r * 0.8);
    g.lineTo(cx - r * 0.95, cy + r * 0.8);
    g.closePath();
  } else if (kind === 2) {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.75, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r * 0.75, cy);
    g.closePath();
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.38;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }
  g.stroke();
}

function glyphTexture(kinds: readonly number[], cell: number) {
  const c = document.createElement('canvas');
  c.width = cell * kinds.length;
  c.height = cell;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#b6e8ff';
  g.lineWidth = cell * 0.07;
  g.lineJoin = 'round';
  g.shadowColor = '#4fc3ff';
  g.shadowBlur = cell * 0.12;
  kinds.forEach((k, i) => drawGlyph(g, k, cell * (i + 0.5), cell / 2, cell * 0.3));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Altar {
  id: AltarId;
  pos: THREE.Vector3;
  crystal: THREE.Mesh;
  light: THREE.PointLight;
  sparks: Sparks;
  /** 0 (apagado) a 1 (aceso), suavizado a cada quadro. */
  glow: number;
}

interface Brazier {
  group: THREE.Group;
  flame: ReturnType<typeof createFlame>;
  lit: boolean;
  pos: THREE.Vector3;
}

export function createRuins(ctx: AreaContext): Area {
  const { ui, game, player, quality, camera, openMap, teleport } = ctx;
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const rand = rng(404);
  const disposables: { dispose(): void }[] = [];
  const interactables: Interactable[] = [];
  const occluders: THREE.Object3D[] = [];
  const high = quality.level === 'high';

  // ---------- terreno ----------
  const trail = new Path(TRAIL, 5, 1.2, 21);
  const plaza = new Path([[C.x, C.z + 6], [C.x, C.z - 6]], 46, 2, 22);
  const distC = (x: number, z: number) => Math.hypot(x - C.x, z - C.z);
  const terrain = new Terrain({
    width: 170,
    depth: 160,
    centerX: 0,
    centerZ: -30,
    cell: high ? 2.4 : 3.0,
    hills: 2.4,
    hillScale: 30,
    seed: 17,
    paths: [trail, plaza],
    flats: [
      { x: C.x, z: C.z, r: RING + 1, blend: 10, y: 0 },
      { x: START.x, z: START.z + 4, r: 9, blend: 8, y: 0 },
    ],
    forest: (x, z) => smoothstep(RING, RING + 22, distC(x, z)) * 0.9,
    palette: NIGHT_STONE,
  });
  scene.add(terrain.mesh);
  disposables.push(terrain);
  const ground = terrain.heightAt;

  // ---------- clima ----------
  const env: AreaEnv = cloneEnv(NIGHT_RUINS);
  const outdoor = new Outdoor(scene, quality, NIGHT_RUINS.outdoor!);
  disposables.push(outdoor);

  const place = (name: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
    const m = model(DUNGEON(name));
    m.position.set(x, ground(x, z) + y, z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
  };

  // ---------- muralha em volta do pátio (aberta ao sul, onde chega a trilha) ----------
  const WALLS = ['wall', 'wall_broken', 'wall_cracked', 'wall_broken'];
  const STEP = (8 / RING);
  for (let a = -Math.PI; a < Math.PI; a += STEP) {
    if (Math.abs(a) < 0.62) continue; // abertura ao sul (a = 0 aponta para +z)
    const x = C.x + Math.sin(a) * RING;
    const z = C.z + Math.cos(a) * RING;
    world.addCircle(x, z, 4.3);
    if (rand() < 0.22) {
      place('rubble_large', x, z, rand() * 6.28, 2.4);
      continue;
    }
    const w = place(WALLS[Math.floor(rand() * WALLS.length)], x, z, a + Math.PI, 2);
    occluders.push(w);
  }
  // pilares decorados marcam a abertura sul
  for (const side of [-1, 1]) {
    const px = C.x + side * 11;
    const pz = C.z + RING - 1;
    place('pillar_decorated', px, pz, 0, 3);
    world.addCircle(px, pz, 2);
  }
  // colunas e escombros espalhados dentro do pátio
  const cols: [number, number, string][] = [
    [-9, -26, 'column'], [10, -28, 'column'], [-21, -40, 'rubble_half'], [22, -42, 'rubble_large'], [-5, -49, 'column'], [9, -46, 'rubble_half'],
  ];
  for (const [x, z, n] of cols) {
    const m = place(n, x, z, rand() * 6.28, n === 'column' ? 2.4 : 2.2);
    if (n === 'column') {
      world.addCircle(x, z, 1.2);
      occluders.push(m);
    }
  }

  // arco de entrada, atrás do ponto de partida
  place('wall_arched', 0, START.z + 7, Math.PI, 3.2);
  place('pillar_decorated', -7, START.z + 7, 0, 3);
  place('pillar_decorated', 7, START.z + 7, 0, 3);
  for (const k of [-1, 1]) world.addCircle(k * 7, START.z + 7, 2);
  for (const k of [-1, 1]) for (const i of [1, 2]) world.addCircle(k * (2.4 + i * 3.4), START.z + 7, 2.2);
  const archLight = new THREE.PointLight(0x55d6ff, 8, 18, 2);
  archLight.position.set(0, ground(0, START.z) + 4, START.z + 4);
  scene.add(archLight);

  // paredes invisíveis ao longo da trilha
  for (let i = 3; i < trail.pts.length - 3; i += 2) {
    const a = trail.pts[i - 1];
    const b = trail.pts[i + 1];
    const tx = b.x - a.x;
    const tz = b.y - a.y;
    const l = Math.hypot(tx, tz) || 1;
    for (const side of [-1, 1]) {
      world.addCircle(trail.pts[i].x + (-tz / l) * side * 5.2, trail.pts[i].y + (tx / l) * side * 5.2, 1.4);
    }
  }
  world.addBounds(0, -30, 72);

  // ---------- lajotas do pátio ----------
  const tiles = ['floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small_broken_A'];
  for (let gx = -20; gx <= 20; gx += 5) {
    for (let gz = -66; gz <= -20; gz += 5) {
      if (distC(gx, gz) > RING - 4 || rand() < 0.25) continue;
      place(tiles[Math.floor(rand() * tiles.length)], gx + (rand() - 0.5) * 0.6, gz + (rand() - 0.5) * 0.6, Math.floor(rand() * 4) * (Math.PI / 2), 1.25, -0.1).traverse((o) => {
        o.castShadow = false;
      });
    }
  }

  // ---------- árvores, pedras e arbustos fora da muralha ----------
  const pineGeos = (['deep', 'green', 'deep'] as const).flatMap((s, i) => [pineGeometry(70 + i * 3, PINE_STYLES[s], 5), pineGeometry(71 + i * 3, PINE_STYLES[s], 4)]);
  const bushGeo = bushGeometry(75, 0x26493a, 0x4c7a5e);
  const rockGeo = rockGeometry(76, 0x6a6e80);
  const treeMat = natureMaterial(0.012);
  const bushMat = natureMaterial(0.03);
  const rockMat = natureMaterial(0);
  disposables.push(...pineGeos, bushGeo, rockGeo, treeMat, bushMat, rockMat);
  const offTrail = (x: number, z: number) => trail.distance(x, z);
  const outside = (x: number, z: number) => distC(x, z) > RING + 4 && offTrail(x, z) > 6.5;

  const treePts = scatter(rand, { minX: -82, maxX: 82, minZ: -108, maxZ: 46, spacing: () => 4.4, accept: outside, tries: high ? 22000 : 12000, max: high ? 1100 : 600 });
  const byGeo: Inst[][] = pineGeos.map(() => []);
  for (const [x, z] of treePts) {
    const far = smoothstep(RING + 4, RING + 40, distC(x, z));
    byGeo[Math.floor(rand() * pineGeos.length)].push({ x, y: ground(x, z) - 0.2, z, rotY: rand() * 6.28, scale: 1 + rand() * 0.5 + far * 0.5, tall: 0.9 + rand() * 0.4, tilt: (rand() - 0.5) * 0.06, color: tint(rand, 0.12) });
  }
  byGeo.forEach((list, i) => list.length && scene.add(instanced(pineGeos[i], treeMat, list)));
  const bushPts = scatter(rand, { minX: -80, maxX: 80, minZ: -106, maxZ: 44, spacing: () => 2.6, accept: (x, z) => outside(x, z) || (offTrail(x, z) > 4.2 && offTrail(x, z) < 12 && distC(x, z) > RING + 1), tries: high ? 9000 : 5000, max: high ? 600 : 320 });
  scene.add(instanced(bushGeo, bushMat, bushPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.05, z, rotY: rand() * 6.28, scale: 0.9 + rand() * 1.3, color: tint(rand, 0.12) }))));
  const rockPts = scatter(rand, { minX: -80, maxX: 80, minZ: -106, maxZ: 44, spacing: () => 8, accept: outside, tries: 2000, max: 50 });
  scene.add(instanced(rockGeo, rockMat, rockPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.08, z, rotY: rand() * 6.28, scale: 0.9 + rand() * rand() * 3, tall: 0.8 + rand() * 0.5, color: tint(rand, 0.1, 0) }))));

  const grass = new Grass({
    minX: -50,
    maxX: 50,
    minZ: -100,
    maxZ: 40,
    density: quality.grassDensity * 0.6,
    range: quality.grassRange,
    height: ground,
    exclude: (x, z) => offTrail(x, z) < 0.8 || distC(x, z) < RING - 1,
    tints: [0x9fb8a0, 0x7f9f86, 0x6b8f7a],
  });
  scene.add(grass.group);
  disposables.push(grass);

  // ---------- luar, vagalumes ----------
  const flies = new Fireflies(high ? 110 : 60);
  scene.add(flies.points);
  disposables.push(flies);
  const moonDir = new THREE.Vector3(...NIGHT_RUINS.outdoor!.sunDir).normalize();
  const beamSpots: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * 6.28;
    const r = RING + 6 + rand() * 16;
    const x = C.x + Math.sin(a) * r;
    const z = C.z + Math.cos(a) * r * 0.9;
    beamSpots.push([x, ground(x, z), z]);
  }
  const beams = new MoonBeams(beamSpots, moonDir);
  beams.setAmount(0.8);
  scene.add(beams.group);
  disposables.push(beams);

  // ---------- altares ----------
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6c6a84, roughness: 0.9, flatShading: true });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x45435a, roughness: 0.95, flatShading: true });
  const pedestalGeo = new THREE.CylinderGeometry(0.85, 1.25, 1.3, 7);
  const slabGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.22, 7);
  const crystalGeo = new THREE.OctahedronGeometry(0.34, 0);
  disposables.push(stoneMat, stoneDark, pedestalGeo, slabGeo, crystalGeo);

  const crystalMesh = (emissive = 0.12) => {
    const m = new THREE.Mesh(
      crystalGeo,
      new THREE.MeshStandardMaterial({ color: 0x163a4a, emissive: CYAN, emissiveIntensity: emissive, roughness: 0.25, flatShading: true }),
    );
    m.scale.set(0.85, 1.6, 0.85);
    disposables.push(m.material as THREE.Material);
    return m;
  };
  const pedestal = (x: number, z: number) => {
    const y = ground(x, z);
    const base = new THREE.Mesh(pedestalGeo, stoneMat);
    base.position.set(x, y + 0.65, z);
    const slab = new THREE.Mesh(slabGeo, stoneDark);
    slab.position.set(x, y + 1.4, z);
    for (const m of [base, slab]) {
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    world.addCircle(x, z, 1.3);
  };

  const altars: Record<AltarId, Altar> = {} as Record<AltarId, Altar>;
  for (const id of ['flames', 'runes', 'echo'] as const) {
    const p = ALTAR_POS[id];
    pedestal(p.x, p.z);
    const crystal = crystalMesh();
    crystal.position.set(p.x, ground(p.x, p.z) + 2.4, p.z);
    scene.add(crystal);
    const light = new THREE.PointLight(0x55d6ff, 0, 14, 2);
    light.position.set(p.x, ground(p.x, p.z) + 2.5, p.z + 0.5);
    scene.add(light);
    const sparks = new Sparks(26, new THREE.Color(0.3, 0.8, 1.0));
    scene.add(sparks.points);
    disposables.push(sparks.points.geometry, sparks.points.material as THREE.Material);
    altars[id] = { id, pos: new THREE.Vector3(p.x, ground(p.x, p.z), p.z), crystal, light, sparks, glow: 0 };
  }
  const isLit = (id: AltarId) => game.flag(altarFlag(id));
  for (const id of Object.keys(altars) as AltarId[]) if (isLit(id)) altars[id].glow = 1;
  const litCount = () => (['flames', 'runes', 'echo'] as const).filter(isLit).length;
  const allLit = () => litCount() === 3;

  // ---------- altar das chamas: braseiros na ordem dos símbolos ----------
  const F = ALTAR_POS.flames;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(11, 5.2, 0.8), stoneMat);
  slab.position.set(F.x, ground(F.x, F.z - 6) + 2.6, F.z - 6);
  slab.castShadow = true;
  slab.receiveShadow = true;
  scene.add(slab);
  world.addBox(F.x - 5.6, F.x + 5.6, F.z - 6.6, F.z - 5.4);
  disposables.push(slab.geometry);
  const plaqueTex = glyphTexture(SEQUENCE.map((i) => BRAZIERS[i].glyph), 128);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.1),
    new THREE.MeshBasicMaterial({ map: plaqueTex, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, toneMapped: false, fog: false }),
  );
  plaque.position.set(F.x, slab.position.y + 0.3, F.z - 5.55);
  scene.add(plaque);
  disposables.push(plaqueTex, plaque.geometry, plaque.material as THREE.Material);

  const bowlGeo = new THREE.CylinderGeometry(0.75, 0.45, 0.55, 8);
  const postGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
  const labelGeo = new THREE.PlaneGeometry(0.9, 0.9);
  disposables.push(bowlGeo, postGeo, labelGeo);
  const braziers: Brazier[] = BRAZIERS.map((b) => {
    const x = F.x + b.dx;
    const z = F.z + b.dz;
    const y = ground(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const post = new THREE.Mesh(postGeo, stoneDark);
    post.position.y = 0.5;
    const bowl = new THREE.Mesh(bowlGeo, stoneMat);
    bowl.position.y = 1.2;
    post.castShadow = bowl.castShadow = true;
    const tex = glyphTexture([b.glyph], 96);
    const label = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, toneMapped: false, fog: false }));
    label.position.set(0, 0.55, 0.62);
    disposables.push(tex, label.material as THREE.Material);
    const flame = createFlame(1.3, 4);
    flame.mesh.position.set(0, 1.45, 0);
    flame.mesh.visible = false;
    group.add(post, bowl, label, flame.mesh);
    scene.add(group);
    world.addCircle(x, z, 0.8);
    return { group, flame, lit: false, pos: new THREE.Vector3(x, y, z) };
  });
  disposables.push(...braziers.map((b) => b.flame.mesh.material as THREE.Material));
  const braziersLight = new THREE.PointLight(0xff9a4a, 0, 20, 2);
  braziersLight.position.set(F.x, ground(F.x, F.z) + 2.4, F.z + 5);
  scene.add(braziersLight);

  const sequence: number[] = [];
  const setBrazier = (i: number, on: boolean) => {
    braziers[i].lit = on;
    braziers[i].flame.mesh.visible = on;
  };
  if (isLit('flames')) braziers.forEach((_, i) => setBrazier(i, true));

  // ---------- cristal central ----------
  pedestal(C.x, C.z);
  const centerCrystal = crystalMesh(2.8);
  centerCrystal.scale.set(1.3, 2.4, 1.3);
  scene.add(centerCrystal);
  const centerLight = new THREE.PointLight(0x55d6ff, 0, 22, 2);
  centerLight.position.set(C.x, ground(C.x, C.z) + 3, C.z);
  scene.add(centerLight);
  const centerSparks = new Sparks(40, new THREE.Color(0.3, 0.8, 1.0));
  scene.add(centerSparks.points);
  disposables.push(centerSparks.points.geometry, centerSparks.points.material as THREE.Material);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.4, 22, 14, 1, true).translate(0, 11, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 1.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  beam.position.set(C.x, ground(C.x, C.z) + 1.5, C.z);
  scene.add(beam);
  disposables.push(beam.geometry, beam.material as THREE.Material);
  let centerShow = 0;
  const ambushDone = () => game.flag('foe_ruins_ambush');
  const crystalAvailable = () => allLit() && ambushDone() && !game.flag(doneFlag('ruins'));

  // emboscada: quando os três altares acendem, a névoa acorda em volta do cristal
  const combat = new CombatSystem({ scene, world, ground, player, ui, game, teleport, start: { x: START.x, z: START.z, rot: Math.PI }, torchLit: () => player.torch.isLit });
  const ring = (a: number, r: number) => ({ x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r });
  combat.add({
    id: 'ruins_ambush',
    x: C.x,
    z: C.z,
    radius: 17,
    enabled: allLit,
    enemies: [
      { kind: 'fiapo', ...ring(0.4, 7) },
      { kind: 'fiapo', ...ring(2.5, 7) },
      { kind: 'fiapo', ...ring(4.4, 7.5) },
      { kind: 'sombra', ...ring(5.6, 9) },
    ],
    checkpoint: { x: START.x, z: START.z - 4, rot: Math.PI },
    onStart: () => ui.toast(T.ambush),
  });

  // ---------- marcadores de brilho ----------
  const sparkles: { sprite: Marker; base: number; show: () => boolean }[] = [];
  const sparkle = (x: number, z: number, show: () => boolean, height: number) => {
    const sprite = sparkleMarker();
    sprite.position.set(x, ground(x, z) + height, z);
    scene.add(sprite);
    sparkles.push({ sprite, base: height, show });
  };
  for (const id of ['flames', 'runes', 'echo'] as const) sparkle(ALTAR_POS[id].x, ALTAR_POS[id].z, () => !isLit(id), 3.4);
  sparkle(C.x, C.z, crystalAvailable, 4.2);

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });

  add(new THREE.Vector3(START.x, ground(START.x, START.z), START.z + 3), 4.5, T.back.prompt, () => void openMap());

  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  /** Acende o altar: salva, mostra a memória e, se foi o último, anuncia o cristal. */
  async function lightAltar(id: AltarId) {
    game.setFlag(altarFlag(id));
    game.setFlag(memoryFlag(MEMORY_OF[id]));
    await ui.tell([T.altarLit]);
    await ui.showMemory(content.memories[MEMORY_OF[id]]);
    if (allLit() && ambushDone()) ui.toast(T.objective.crystal);
  }

  const doneToast = () => ui.toast(T.altarDone);

  add(altars.flames.pos, 3.2, T.flames.prompt, () => {
    if (isLit('flames')) return doneToast();
    void ui.tell(T.flames.intro);
  });
  braziers.forEach((b, i) => {
    add(b.pos, 2.2, T.flames.brazier, () => void useBrazier(i), () => !isLit('flames') && !b.lit);
    sparkle(b.pos.x, b.pos.z, () => !isLit('flames') && !b.lit, 2.6);
  });
  async function useBrazier(i: number) {
    if (i === SEQUENCE[sequence.length]) {
      sequence.push(i);
      setBrazier(i, true);
      if (sequence.length === SEQUENCE.length) await lightAltar('flames');
      else ui.toast(fmt(T.flames.step, { n: SEQUENCE.length - sequence.length }));
    } else {
      sequence.length = 0;
      braziers.forEach((_, k) => setBrazier(k, false));
      await ui.tell(T.flames.wrong);
    }
  }

  add(altars.runes.pos, 3.2, T.runes.prompt, () => void useRunes());
  async function useRunes() {
    if (isLit('runes')) return doneToast();
    await ui.tell(T.runes.intro);
    await playRunes(ui, { title: T.runes.title, hint: T.runes.hint, goal: T.runes.goal, solved: T.runes.solved });
    await lightAltar('runes');
  }

  add(altars.echo.pos, 3.2, T.echo.prompt, () => void useEcho());
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

  add(new THREE.Vector3(C.x, ground(C.x, C.z), C.z), 3.2, T.crystal.prompt, () => void takeCrystal(), crystalAvailable);
  async function takeCrystal() {
    await ui.tell(T.crystal.lines);
    giveItem('cristal');
    giveItem('chave_estrela');
    game.setFlag(doneFlag('ruins'));
    await openMap();
  }
  add(new THREE.Vector3(C.x, ground(C.x, C.z), C.z), 3.2, T.crystal.prompt, () => void ui.tell([T.done]), () => game.flag(doneFlag('ruins')));

  // ---------- objetivo ----------
  const objective = () => {
    if (game.flag(doneFlag('ruins'))) return T.objective.done;
    if (allLit()) return ambushDone() ? T.objective.crystal : T.objective.fight;
    if (litCount() > 0 || distC(player.position.x, player.position.z) < RING - 4) return fmt(T.objective.altars, { n: litCount() });
    return T.objective.explore;
  };
  let lastObjective = '';
  let objTimer = 0;

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(START.x, 0, START.z),
    spawnRot: Math.PI,
    entries: { start: { x: START.x, z: START.z, rot: Math.PI } },
    ground,
    interactables,
    occluders,
    env,
    torchLit: true,
    combat,
    debug: {
      combat,
      altars,
      braziers,
      solveAll: () => {
        for (const id of ['flames', 'runes', 'echo'] as const) {
          game.setFlag(altarFlag(id));
          game.setFlag(memoryFlag(MEMORY_OF[id]));
        }
        braziers.forEach((_, i) => setBrazier(i, true));
      },
    },
    onEnter() {
      if (!game.flag('ruins_seen')) {
        game.setFlag('ruins_seen');
        ui.say(T.intro);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      updateWind(time);
      outdoor.update(playerPos, camera);
      grass.update(camera.position);
      flies.update(time, playerPos, 0.7);
      archLight.intensity = 7 + Math.sin(time * 2.1) * 1.5;

      // cristais dos altares: acendem devagar
      for (const a of Object.values(altars)) {
        const goal = isLit(a.id) ? 1 : 0;
        a.glow += (goal - a.glow) * (1 - Math.exp(-2.5 * dt));
        const pulse = 0.88 + Math.sin(time * 2 + a.pos.x) * 0.12;
        (a.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = (0.12 + a.glow * 2.6) * pulse;
        a.light.intensity = a.glow * 9 * pulse;
        a.crystal.rotation.y = time * 0.6;
        a.crystal.position.y = a.pos.y + 2.4 + Math.sin(time * 1.5 + a.pos.z) * 0.08;
        a.sparks.update(dt, a.crystal.position, a.glow > 0.5 ? 14 : 0);
      }

      // braseiros
      let flames = 0;
      for (const b of braziers) {
        if (b.lit) {
          flames++;
          b.flame.update(dt);
        }
      }
      braziersLight.intensity = flames * 3.2 * (1 + Math.sin(time * 9) * 0.08);

      // cristal central e coluna de luz
      centerShow += ((crystalAvailable() ? 1 : 0) - centerShow) * (1 - Math.exp(-2 * dt));
      centerCrystal.visible = centerShow > 0.02;
      centerCrystal.position.set(C.x, ground(C.x, C.z) + 3.1 + Math.sin(time * 1.4) * 0.15, C.z);
      centerCrystal.rotation.y = time * 0.8;
      centerLight.intensity = centerShow * 14;
      (beam.material as THREE.MeshBasicMaterial).opacity = centerShow * (0.16 + Math.sin(time * 2.2) * 0.04);
      centerSparks.update(dt, centerCrystal.position, centerShow > 0.5 ? 18 : 0);

      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.5;
        const o = objective();
        if (o !== lastObjective) {
          lastObjective = o;
          ui.setObjective(o);
        }
      }
      for (const s of sparkles) {
        const on = s.show();
        s.sprite.visible = on;
        if (on) {
          s.sprite.position.y = ground(s.sprite.position.x, s.sprite.position.z) + s.base + Math.sin(time * 2.4 + s.sprite.position.x) * 0.12;
          s.sprite.setSize(0.9 + Math.sin(time * 5 + s.sprite.position.z) * 0.12);
        }
      }
    },
  };
}
