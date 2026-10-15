import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { TORCH } from '../entities/torch';
import { GOLDEN_MORNING, NIGHT_FOREST, SUNSET, Outdoor, cloneEnv, lerpEnv } from '../fx/atmosphere';
import { Fireflies, GuideFireflies } from '../fx/fireflies';
import { MoonBeams } from '../fx/moonBeams';
import { LeafBurst } from '../fx/leafBurst';
import { HORSE_MODEL } from '../entities/horse';
import { HorseCompanion } from '../entities/horseCompanion';
import { Terrain, GOLDEN_PALETTE } from '../world/terrain';
import { Path } from '../world/paths';
import { Grass } from '../world/grass';
import { rng, smoothstep } from '../world/noise';
import { scatter } from '../world/scatter';
import { updateWind } from '../world/wind';
import {
  PINE_STYLES, bushGeometry, fenceLine, instancedChunked as instanced, logGeometry, lupineGeometry, daisyGeometry, mushroomCapGeometry,
  mushroomStemGeometry, natureMaterial, pebbleGeometry, pineGeometry, rockGeometry, roundTreeGeometry, stumpGeometry, thornGeometry, tint, type Inst,
} from '../world/nature';
import { sparkleMarker, type Marker } from '../fx/markers';
import { content } from '../content';
import { doneFlag } from './registry';
import type { Area, AreaContext, AreaEnv, Interactable } from './types';

/**
 * Floresta dos Sussurros: uma trilha de terra de ~330 m que começa num fim de tarde dourado e entra na noite
 * verde-azulada. Duas bifurcações (os vagalumes mostram o lado certo; o errado acaba numa clareira), duas
 * moitas de espinhos que a espada corta e, no fim, o portal de pedra das Ruínas. O cavalo vai até o escuro e espera.
 */

const DUNGEON_NAMES = ['wall_arched', 'pillar_decorated', 'column', 'rubble_large', 'rubble_half', 'torch_lit'];
export const FOREST_ASSETS = [...DUNGEON_NAMES.map(DUNGEON), HORSE_MODEL];

const T = content.forest;

// ---------- trilhas (x, z; o norte é -z) ----------
const MAIN1: [number, number][] = [[0, 24], [1, -8], [-4, -40], [3, -74], [4, -96]];
const RIGHT: [number, number][] = [[4, -96], [16, -116], [15, -146], [3, -172], [-4, -196]];
const LEFT: [number, number][] = [[4, -96], [-10, -112], [-24, -130], [-31, -150]];
const MAIN2: [number, number][] = [[-4, -196], [-8, -214], [-6, -234]];
const LEFT2: [number, number][] = [[-6, -234], [-22, -250], [-31, -272], [-22, -294], [-8, -312]];
const RIGHT2: [number, number][] = [[-6, -234], [10, -252], [23, -270]];

/** Onde a noite começa a cair e onde o cavalo para (fração do caminho certo). */
const HORSE_STOPS_AT = 0.3;

interface Thorn {
  group: THREE.Group;
  colliders: ReturnType<CollisionWorld['addCircle']>[];
  x: number;
  z: number;
  cut: boolean;
  shrink: number;
}

export function createForest(ctx: AreaContext): Area {
  const { ui, game, player, quality, camera, fillLight, openMap } = ctx;
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const rand = rng(88);
  const disposables: { dispose(): void }[] = [];
  const interactables: Interactable[] = [];

  const main1 = new Path(MAIN1, 4.8, 1.2, 11);
  const right = new Path(RIGHT, 4.4, 1.2, 12);
  const left = new Path(LEFT, 4.0, 1.2, 13);
  const main2 = new Path(MAIN2, 4.6, 1.2, 14);
  const left2 = new Path(LEFT2, 4.4, 1.2, 15);
  const right2 = new Path(RIGHT2, 4.0, 1.2, 16);
  const trails = [main1, right, left, main2, left2, right2];
  const route = new Path([...MAIN1, ...RIGHT.slice(1), ...MAIN2.slice(1), ...LEFT2.slice(1)], 4.4, 1.2, 17);
  const offTrail = (x: number, z: number) => Math.min(...trails.map((t) => t.distance(x, z)));

  const ARCH = { x: -8, z: -318 };
  const deadEnds = [
    { x: LEFT[LEFT.length - 1][0], z: LEFT[LEFT.length - 1][1] },
    { x: RIGHT2[RIGHT2.length - 1][0], z: RIGHT2[RIGHT2.length - 1][1] },
  ];

  // ---------- terreno ----------
  const flat = (x: number, z: number, r: number, blend = 7) => ({ x, z, r, blend, y: 0 });
  const terrain = new Terrain({
    width: 230,
    depth: 430,
    centerX: 0,
    centerZ: -150,
    cell: quality.level === 'high' ? 2.4 : 3.0,
    hills: 3.2,
    hillScale: 34,
    seed: 9,
    paths: trails,
    flats: [flat(0, 14, 10), flat(ARCH.x, ARCH.z + 6, 11), ...deadEnds.map((d) => flat(d.x, d.z, 6))],
    forest: (x, z) => smoothstep(3, 14, offTrail(x, z)) * 0.85,
    palette: GOLDEN_PALETTE,
  });
  scene.add(terrain.mesh);
  disposables.push(terrain);
  const ground = terrain.heightAt;

  // ---------- luz e clima (muda com o avanço pela trilha) ----------
  const env: AreaEnv = cloneEnv(GOLDEN_MORNING);
  const tmpEnv: AreaEnv = cloneEnv(SUNSET);
  const outdoor = new Outdoor(scene, quality, GOLDEN_MORNING.outdoor!);
  disposables.push(outdoor);

  // ---------- paredes invisíveis ao longo da trilha (a mata é fechada) ----------
  const onOtherTrail = (x: number, z: number, self: Path) => trails.some((t) => t !== self && t.distance(x, z) < 2.4);
  for (const t of trails) {
    for (let i = 2; i < t.pts.length - 2; i += 2) {
      const a = t.pts[i - 1];
      const b = t.pts[i + 1];
      const tx = b.x - a.x;
      const tz = b.y - a.y;
      const l = Math.hypot(tx, tz) || 1;
      for (const side of [-1, 1]) {
        const x = t.pts[i].x + (-tz / l) * side * (t.width / 2 + 3.2);
        const z = t.pts[i].y + (tx / l) * side * (t.width / 2 + 3.2);
        if (!onOtherTrail(x, z, t)) world.addCircle(x, z, 1.2);
      }
    }
  }
  // fundos de saco: o começo da trilha, as clareiras sem saída e o portal
  const cap = (cx: number, cz: number, facing: number, r = 5) => {
    for (let k = -4; k <= 4; k++) {
      const a = facing + (k / 4) * 1.5;
      world.addCircle(cx + Math.sin(a) * r, cz + Math.cos(a) * r, 1.3);
    }
  };
  cap(0, 24, 0, 6); // atrás do começo (sul)
  for (const t of [left, right2]) {
    const end = t.pts[t.pts.length - 1];
    const prev = t.pts[t.pts.length - 6];
    cap(end.x, end.y, Math.atan2(end.x - prev.x, end.y - prev.y), 6);
  }
  cap(ARCH.x, ARCH.z + 12, Math.PI, 6);
  world.addBounds(0, -150, 200);

  // ---------- árvores, arbustos, pedras ----------
  const high = quality.level === 'high';
  const pineGeos = (['green', 'deep', 'sunny', 'deep'] as const).flatMap((s, i) => [pineGeometry(20 + i * 3, PINE_STYLES[s], 5), pineGeometry(21 + i * 3, PINE_STYLES[s], 4)]);
  const roundGeo = roundTreeGeometry(25, 0x2f6a35, 0x6fa047);
  const bushGeo = bushGeometry(26, 0x2f6e30, 0x6aa63e);
  const rockGeo = rockGeometry(27, 0x6f7a78);
  const pineMat = natureMaterial(0.012);
  const roundMat = natureMaterial(0.01);
  const bushMat = natureMaterial(0.03);
  const rockMat = natureMaterial(0);
  disposables.push(...pineGeos, roundGeo, bushGeo, rockGeo, pineMat, roundMat, bushMat, rockMat);

  const treePts = scatter(rand, {
    minX: -112,
    maxX: 112,
    minZ: -362,
    maxZ: 62,
    spacing: (x, z) => (offTrail(x, z) > 14 ? 3.3 : 4.2),
    accept: (x, z) => offTrail(x, z) > 5.6 && Math.hypot(x - ARCH.x, z - ARCH.z) > 9,
    tries: high ? 36000 : 20000,
    max: high ? 2300 : 1250,
  });
  const byGeo: Inst[][] = pineGeos.map(() => []);
  const rounds: Inst[] = [];
  for (const [x, z] of treePts) {
    const y = ground(x, z);
    const far = smoothstep(8, 40, offTrail(x, z));
    if (rand() < 0.08 && offTrail(x, z) < 26) {
      rounds.push({ x, y, z, rotY: rand() * 6.28, scale: 0.9 + rand() * 0.6, color: tint(rand) });
      continue;
    }
    const s = 0.9 + rand() * 0.55 + far * 0.55;
    byGeo[Math.floor(rand() * pineGeos.length)].push({ x, y: y - 0.2, z, rotY: rand() * 6.28, scale: s, tall: 0.9 + rand() * 0.35, tilt: (rand() - 0.5) * 0.06, color: tint(rand, 0.14) });
  }
  byGeo.forEach((list, i) => list.length && scene.add(instanced(pineGeos[i], pineMat, list)));
  if (rounds.length) scene.add(instanced(roundGeo, roundMat, rounds));

  // moitas e samambaias junto da trilha (a "parede" que se vê) e no meio da mata
  const bushPts = scatter(rand, {
    minX: -100,
    maxX: 100,
    minZ: -350,
    maxZ: 50,
    spacing: () => 2.0,
    accept: (x, z) => {
      const d = offTrail(x, z);
      return d > 3.2 && d < 26 && Math.hypot(x - ARCH.x, z - ARCH.z) > 7;
    },
    tries: high ? 16000 : 9000,
    max: high ? 1300 : 700,
  });
  scene.add(instanced(bushGeo, bushMat, bushPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.05, z, rotY: rand() * 6.28, scale: 0.9 + rand() * 1.5, color: tint(rand, 0.14) }))));
  const rockPts = scatter(rand, { minX: -100, maxX: 100, minZ: -350, maxZ: 40, spacing: () => 7, accept: (x, z) => offTrail(x, z) > 3.4, tries: 3000, max: 130 });
  scene.add(instanced(rockGeo, rockMat, rockPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.08, z, rotY: rand() * 6.28, scale: 0.8 + rand() * rand() * 3, tall: 0.8 + rand() * 0.5, color: tint(rand, 0.1, 0.02) }))));

  // troncos, tocos, pedrinhas e flores
  const logGeo = logGeometry(4);
  const stumpGeo = stumpGeometry();
  const logMat = natureMaterial(0);
  disposables.push(logGeo, stumpGeo, logMat);
  const logs: Inst[] = [];
  const stumps: Inst[] = [];
  for (const d of deadEnds) {
    logs.push({ x: d.x + 2, y: ground(d.x + 2, d.z + 1) , z: d.z + 1, rotY: 0.7, color: tint(rand) });
    stumps.push({ x: d.x - 2.5, y: ground(d.x - 2.5, d.z - 1), z: d.z - 1, color: tint(rand) });
    world.addCircle(d.x + 2, d.z + 1, 1.2);
  }
  for (let i = 0; i < 10; i++) {
    const f = 0.1 + rand() * 0.8;
    const p = route.at(f);
    const off = (rand() < 0.5 ? -1 : 1) * (8 + rand() * 8);
    logs.push({ x: p.x + off, y: ground(p.x + off, p.y), z: p.y, rotY: rand() * 6.28, color: tint(rand) });
  }
  scene.add(instanced(logGeo, logMat, logs), instanced(stumpGeo, logMat, stumps));

  const pebbleGeo = pebbleGeometry(2);
  const pebbleMat = natureMaterial(0);
  const lupineGeo = lupineGeometry();
  const daisyGeo = daisyGeometry();
  const flowerMat = natureMaterial(0.25);
  disposables.push(pebbleGeo, pebbleMat, lupineGeo, daisyGeo, flowerMat);
  const pebbles: Inst[] = [];
  const lupines: Inst[] = [];
  const daisies: Inst[] = [];
  const blue = [0x3f55e0, 0x5a43c9, 0x7a5be0, 0x3a78e6].map((h) => new THREE.Color(h));
  const petals = [0xffffff, 0xffe38a, 0xffb7d0].map((h) => new THREE.Color(h));
  for (const t of trails) {
    for (let i = 0; i < Math.round(t.length * 3.4); i++) {
      const f = rand();
      const p = t.at(f);
      const tg = t.tangent(f);
      const off = (rand() - 0.5) * 2 * (t.width * 0.62);
      const x = p.x - tg.y * off;
      const z = p.y + tg.x * off;
      pebbles.push({ x, y: ground(x, z) - 0.02, z, rotY: rand() * 6.28, scale: 0.4 + rand() * rand() * 1.8, color: tint(rand, 0.2, 0) });
    }
  }
  for (let i = 0; i < 46; i++) {
    const f = rand() * 0.45;
    const p = route.at(f);
    const side = rand() < 0.5 ? -1 : 1;
    const base = side * (4 + rand() * 6);
    const cx = p.x + base;
    const cz = p.y;
    const n = 4 + Math.floor(rand() * 7);
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 2.4;
      const z = cz + (rand() - 0.5) * 2.4;
      if (offTrail(x, z) < 3) continue;
      if (rand() < 0.6) lupines.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.5 + rand() * 0.45, tall: 0.8 + rand() * 0.6, color: blue[Math.floor(rand() * blue.length)] });
      else daisies.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.9 + rand() * 0.5, color: petals[Math.floor(rand() * petals.length)] });
    }
  }
  scene.add(instanced(pebbleGeo, pebbleMat, pebbles, { cast: false }), instanced(lupineGeo, flowerMat, lupines, { cast: false }), instanced(daisyGeo, flowerMat, daisies, { cast: false }));

  // cerca rústica no começo da trilha (os dois lados), como nas imagens de referência
  const sideFence = (side: number, f0: number, f1: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let f = f0; f <= f1; f += 0.04) {
      const p = main1.at(f);
      const tg = main1.tangent(f);
      pts.push([p.x - tg.y * side, p.y + tg.x * side]);
    }
    return pts;
  };
  for (const [side, seed] of [[4.9, 41], [-4.9, 42]] as const) {
    const fence = fenceLine(sideFence(side, 0.04, 0.5), ground, seed);
    scene.add(fence.mesh);
    disposables.push(fence.mesh.geometry, fence.mesh.material as THREE.Material);
  }

  // ---------- grama (some no escuro, mas a base fica) ----------
  const grass = new Grass({
    minX: -60,
    maxX: 60,
    minZ: -345,
    maxZ: 40,
    density: quality.grassDensity * 0.8,
    range: quality.grassRange,
    height: ground,
    exclude: (x, z) => offTrail(x, z) < 0.4,
    tints: [0xdfe9c0, 0xc4d9a0, 0xa8c88a, 0xb8cf94],
  });
  scene.add(grass.group);
  disposables.push(grass);

  // ---------- cogumelos brilhantes ----------
  const capGeo = mushroomCapGeometry();
  const stemGeo = mushroomStemGeometry();
  const capMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), vertexColors: true, toneMapped: false });
  const stemMat = natureMaterial(0);
  disposables.push(capGeo, stemGeo, capMat, stemMat);
  const glowColors = [new THREE.Color(1.9, 0.5, 2.4), new THREE.Color(0.5, 1.7, 2.3), new THREE.Color(2.3, 1.2, 0.45)];
  const stems: Inst[] = [];
  const caps: Inst[] = [];
  const clusters: { x: number; z: number; color: THREE.Color }[] = [];
  const mushroomAt = (cx: number, cz: number, color: THREE.Color, n: number) => {
    clusters.push({ x: cx, z: cz, color });
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 2.2;
      const z = cz + (rand() - 0.5) * 2.2;
      const s = 0.8 + rand() * 1.6;
      stems.push({ x, y: ground(x, z), z, scale: s, rotY: rand() * 6.28, color: tint(rand, 0.1) });
      caps.push({ x, y: ground(x, z), z, scale: s, rotY: rand() * 6.28, color: color.clone().multiplyScalar(0.8 + rand() * 0.5) });
    }
  };
  for (let i = 0; i < 44; i++) {
    const f = 0.12 + rand() * 0.88;
    const p = route.at(f);
    const side = rand() < 0.5 ? -1 : 1;
    const off = side * (3.8 + rand() * 4.5);
    const x = p.x + off;
    const z = p.y + (rand() - 0.5) * 6;
    if (offTrail(x, z) < 3) continue;
    mushroomAt(x, z, glowColors[Math.floor(rand() * glowColors.length)], 4 + Math.floor(rand() * 6));
  }
  for (const d of deadEnds) mushroomAt(d.x, d.z - 3, glowColors[1], 8);
  const capMesh = instanced(capGeo, capMat, caps, { cast: false });
  scene.add(capMesh, instanced(stemGeo, stemMat, stems, { cast: false }));
  // três luzes que "pulam" para os cogumelos mais perto do jogador
  const glowLights = glowColors.map((c) => {
    const l = new THREE.PointLight(c, 0, 9, 2);
    l.position.set(0, -50, 0);
    scene.add(l);
    return l;
  });

  // ---------- espinhos ----------
  const thornGeos = [thornGeometry(61), thornGeometry(62)];
  const thornMat = natureMaterial(0);
  disposables.push(...thornGeos, thornMat);
  const makeThorn = (path: Path, f: number): Thorn => {
    const p = path.at(f);
    const tg = path.tangent(f);
    const nx = -tg.y;
    const nz = tg.x;
    const group = new THREE.Group();
    const colliders: Thorn['colliders'] = [];
    const span = path.width / 2 + 3.2;
    for (let k = -3; k <= 3; k++) {
      const off = (k / 3) * span;
      const x = p.x + nx * off;
      const z = p.y + nz * off;
      const m = new THREE.Mesh(thornGeos[Math.abs(k) % 2], thornMat);
      m.position.set(x, ground(x, z) - 0.1, z);
      m.rotation.y = rand() * 6.28;
      m.scale.setScalar(1.5 + rand() * 0.5);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      colliders.push(world.addCircle(x, z, 1.5));
    }
    scene.add(group);
    return { group, colliders, x: p.x, z: p.y, cut: false, shrink: 0 };
  };
  const thorns = [makeThorn(main2, 0.5), makeThorn(left2, 0.34)];
  const leaf = new LeafBurst(quality.level === 'high' ? 160 : 100);
  scene.add(leaf.points, leaf.slash);
  disposables.push(leaf);

  // ---------- portal de pedra das Ruínas ----------
  const place = (name: string, x: number, z: number, rot: number, scale: number) => {
    const m = model(DUNGEON(name));
    m.position.set(x, ground(x, z), z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
  };
  place('wall_arched', ARCH.x, ARCH.z, 0, 3.4);
  place('pillar_decorated', ARCH.x - 7.4, ARCH.z + 0.5, 0.1, 3.2);
  place('pillar_decorated', ARCH.x + 7.4, ARCH.z + 0.5, -0.1, 3.2);
  place('wall_arched', ARCH.x - 13.5, ARCH.z - 0.5, 0.15, 3.2);
  place('wall_arched', ARCH.x + 13.5, ARCH.z - 0.5, -0.15, 3.2);
  place('rubble_large', ARCH.x - 5, ARCH.z + 7, 0.6, 2.6);
  place('rubble_half', ARCH.x + 6, ARCH.z + 8, 2.1, 2.6);
  place('column', ARCH.x - 9, ARCH.z + 11, 0, 3);
  for (const k of [-1, 1]) world.addCircle(ARCH.x + k * 7.4, ARCH.z + 0.5, 2.0);
  for (const k of [-1, 1]) for (const i of [1, 2, 3]) world.addCircle(ARCH.x + k * (2.6 + i * 3.2), ARCH.z - 0.5, 2.2);
  // véu de luz azul dentro do arco
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 1.8), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  veil.position.set(ARCH.x, ground(ARCH.x, ARCH.z) + 4.4, ARCH.z - 0.3);
  scene.add(veil);
  disposables.push(veil.geometry, veil.material as THREE.Material);
  const archLight = new THREE.PointLight(0x55d6ff, 18, 26, 2);
  archLight.position.set(ARCH.x, ground(ARCH.x, ARCH.z) + 4, ARCH.z + 4);
  scene.add(archLight);

  // ---------- vagalumes, luar ----------
  const flies = new Fireflies(quality.level === 'high' ? 260 : 140);
  const guide = new GuideFireflies(36);
  scene.add(flies.points, guide.points);
  disposables.push(flies, guide);
  const moonDir = new THREE.Vector3(...NIGHT_FOREST.outdoor!.sunDir).normalize();
  const beamSpots: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const f = 0.35 + rand() * 0.65;
    const p = route.at(f);
    const side = rand() < 0.5 ? -1 : 1;
    const x = p.x + side * (6 + rand() * 7);
    beamSpots.push([x, ground(x, p.y), p.y + (rand() - 0.5) * 8]);
  }
  const beams = new MoonBeams(beamSpots, moonDir);
  scene.add(beams.group);
  disposables.push(beams);

  // ---------- cavalo ----------
  const hasHorse = game.flag('horseShod');
  const progressNow = () => route.progress(player.position.x, player.position.z);
  const companion = hasHorse ? new HorseCompanion(scene, ui, game, player, world, ground, () => progressNow() < HORSE_STOPS_AT) : null;

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });
  const sparkles: { sprite: Marker; base: number; show: () => boolean }[] = [];
  const sparkle = (x: number, z: number, show: () => boolean, height = 1.6) => {
    const sprite = sparkleMarker();
    sprite.position.set(x, ground(x, z) + height, z);
    scene.add(sprite);
    sparkles.push({ sprite, base: height, show });
  };

  const backPos = new THREE.Vector3(0, ground(0, 18), 18);
  add(backPos, 4.5, T.back.prompt, () => void openMap(), () => !companion?.riding);

  thorns.forEach((th) => {
    add(new THREE.Vector3(th.x, ground(th.x, th.z), th.z), 6.2, T.thorns.prompt, () => void cutThorns(th), () => !th.cut);
    sparkle(th.x, th.z, () => !th.cut && game.has('espada'), 2.6);
  });
  async function cutThorns(th: Thorn) {
    if (!game.has('espada')) {
      await ui.tell(T.thorns.noSword);
      return;
    }
    if (companion?.riding) companion.dismount();
    th.cut = true;
    leaf.burst(new THREE.Vector3(th.x, ground(th.x, th.z), th.z), player.facing);
    th.colliders.forEach((c) => world.remove(c));
    ui.toast(T.thorns.cut[0]);
  }

  const archPos = new THREE.Vector3(ARCH.x, ground(ARCH.x, ARCH.z + 8), ARCH.z + 8);
  add(archPos, 6.5, T.portal.prompt, () => void usePortal());
  sparkle(ARCH.x, ARCH.z + 5, () => !game.flag(doneFlag('forest')), 1.6);
  async function usePortal() {
    if (companion?.riding) companion.dismount();
    if (!game.flag(doneFlag('forest'))) {
      await ui.tell(T.portal.lines);
      game.setFlag(doneFlag('forest'));
    } else await ui.tell([T.portal.done]);
    await openMap();
  }

  // ---------- objetivo ----------
  const objective = () => {
    const done = game.flag(doneFlag('forest'));
    if (done) return T.objective.done;
    const f = progressNow();
    const t1 = thorns[0];
    const t2 = thorns[1];
    const near = (th: Thorn) => !th.cut && Math.hypot(player.position.x - th.x, player.position.z - th.z) < 40;
    if (near(t1) || near(t2)) return T.objective.thorns;
    if (f > 0.55) return T.objective.portal;
    if ((f > 0.18 && f < 0.34) || (f > 0.5 && f < 0.7)) return T.objective.fireflies;
    return T.objective.follow;
  };

  // ---------- estado ----------
  let progress = 0;
  let torchLit = false;
  let lastObjective = '';
  let objTimer = 0;
  const deadFired = [false, false];
  const nearest: { d: number; i: number }[] = [];
  let glowTimer = 0;

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(0, 0, 16),
    spawnRot: Math.PI,
    entries: { start: { x: 0, z: 16, rot: Math.PI } },
    ground,
    interactables,
    occluders: [],
    env,
    torchLit: false,
    debug: { route, trails, thorns, companion, setProgress: (f: number) => { const p = route.at(f); player.position.set(p.x, ground(p.x, p.y), p.y); } },
    onEnter() {
      ui.say(T.intro);
      if (companion && game.flag('riding')) companion.mount();
    },
    dispose() {
      player.torch.baseIntensity = TORCH.intensity;
      companion?.dispose();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      updateWind(time);

      // quanto da trilha já foi: define a hora do dia
      progress += (progressNow() - progress) * (1 - Math.exp(-3 * dt));
      const t1 = smoothstep(0.02, 0.27, progress);
      const t2 = smoothstep(0.24, 0.46, progress);
      lerpEnv(GOLDEN_MORNING, SUNSET, t1, tmpEnv);
      lerpEnv(tmpEnv, NIGHT_FOREST, t2, env);
      outdoor.apply(env.outdoor!);
      outdoor.update(playerPos, camera);

      // tocha: acende ao escurecer
      const lit = t2 > 0.08;
      if (lit !== torchLit) {
        torchLit = lit;
        player.torch.setLit(lit);
        fillLight.visible = lit;
      }
      player.torch.baseIntensity = TORCH.intensity * smoothstep(0.05, 0.85, t2);

      // vagalumes (ambientes e guia), luar, cogumelos
      const night = THREE.MathUtils.clamp(t1 * 0.3 + t2, 0, 1);
      flies.update(time, playerPos, night);
      const f = route.progress(playerPos.x, playerPos.z);
      guide.update(time, smoothstep(0.1, 0.6, night), Math.min(0.995, f + 0.004), Math.min(1, f + 0.085), (g) => route.at(g), ground);
      beams.setAmount(smoothstep(0.35, 0.9, t2));
      capMat.color.setScalar(0.45 + 1.1 * t2);
      glowTimer -= dt;
      if (glowTimer <= 0) {
        glowTimer = 0.3;
        nearest.length = 0;
        clusters.forEach((c, i) => nearest.push({ d: Math.hypot(c.x - playerPos.x, c.z - playerPos.z), i }));
        nearest.sort((a, b) => a.d - b.d);
        glowLights.forEach((l, k) => {
          const c = clusters[nearest[k]?.i ?? 0];
          if (!c) return;
          l.color.copy(c.color).multiplyScalar(0.55);
          l.position.set(c.x, ground(c.x, c.z) + 0.8, c.z);
        });
      }
      glowLights.forEach((l) => (l.intensity = 9 * t2));
      veil.material.opacity = 0.28 + Math.sin(time * 1.7) * 0.08 + 0.1 * smoothstep(0.4, 1, t2);
      archLight.intensity = 14 + Math.sin(time * 2.1) * 3;

      grass.update(camera.position);
      leaf.update(dt);

      // espinhos cortados encolhem e somem
      for (const th of thorns) {
        if (th.cut && th.shrink < 1) {
          th.shrink = Math.min(1, th.shrink + dt * 2.2);
          th.group.scale.setScalar(1 - th.shrink);
          th.group.position.y = -th.shrink * 0.4;
          if (th.shrink >= 1) th.group.visible = false;
        }
      }

      // clareiras sem saída: uma frase gentil, uma vez por visita
      deadEnds.forEach((d, i) => {
        const dist = Math.hypot(playerPos.x - d.x, playerPos.z - d.z);
        if (dist < 7.5 && !deadFired[i] && !ui.inDialog) {
          deadFired[i] = true;
          void ui.tell(T.deadEnd[i]);
        } else if (dist > 18) deadFired[i] = false;
      });

      companion?.update(dt, playerPos);

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
