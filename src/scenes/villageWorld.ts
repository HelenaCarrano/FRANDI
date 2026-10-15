import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import type { QualitySettings } from '../core/quality';
import { Smoke } from '../fx/particles';
import { GOLDEN_MORNING, Outdoor } from '../fx/atmosphere';
import { createFlame } from '../entities/torch';
import { NPC_ASSETS } from '../entities/npc';
import { HORSE_MODEL } from '../entities/horse';
import { CHICKEN_MODEL } from '../entities/chicken';
import { Terrain } from '../world/terrain';
import { Path } from '../world/paths';
import { Grass } from '../world/grass';
import { Placer } from '../world/placement';
import { rng, smoothstep } from '../world/noise';
import { scatter } from '../world/scatter';
import { updateWind } from '../world/wind';
import {
  PINE_STYLES, bushGeometry, daisyGeometry, fenceLine, instancedChunked as instanced, logGeometry, lupineGeometry, natureMaterial,
  pebbleGeometry, pineGeometry, rockGeometry, roundTreeGeometry, tint, type Inst,
} from '../world/nature';

/**
 * O cenário da Vila do Amanhecer: terreno com relevo e estradas de terra, casas em escala humana
 * (peças KayKit Medieval Hexagon aumentadas), praça, ferraria, moinho no morro, estábulo com cercado,
 * galinheiro, portão norte, mata fechada em volta. A lógica (NPCs, missões) fica em village.ts.
 */

const NAMES = [
  'building_blacksmith_red', 'building_home_A_red', 'building_home_B_red', 'building_market_red',
  'building_tavern_red', 'building_well_red', 'building_windmill_red', 'building_church_red', 'building_lumbermill_red',
  'wall_straight_gate', 'wall_straight', 'flag_red',
  'barrel', 'bucket_water', 'bucket_empty', 'crate_A_big', 'crate_A_small', 'crate_B_big', 'crate_open',
  'sack', 'wheelbarrow', 'resource_lumber', 'resource_stone', 'weaponrack', 'pallet', 'target', 'ladder',
];
export const VILLAGE_ASSETS = [...NAMES.map((n) => `village/${n}`), ...NPC_ASSETS, HORSE_MODEL, CHICKEN_MODEL];

/** Escala dos adereços (barris, caixas): tamanho de gente. */
const PROP = 4.2;
/** Escala das construções: a porta de uma casa fica com cerca de 3 m. */
const BS = 7.5;
/** O círculo andável da vila. */
export const VILLAGE_CENTER = { x: 0, z: 4 };
export const VILLAGE_RADIUS = 68;

const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);
const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

export interface VillageWorld {
  ground: (x: number, z: number) => number;
  outdoor: Outdoor;
  placer: Placer;
  /** Casas e prédios, para pegar posição e porta. */
  smith: { obj: THREE.Object3D; x: number; z: number; rot: number };
  market: { obj: THREE.Object3D; x: number; z: number; rot: number };
  mill: { obj: THREE.Object3D; x: number; z: number; rot: number; fan: THREE.Object3D | undefined };
  stable: { x: number; z: number; rot: number };
  tavern: { x: number; z: number; rot: number };
  paddock: { x: number; z: number; r: number };
  pen: { x: number; z: number; r: number };
  gate: { pos: THREE.Vector3; rot: number; doorL: THREE.Object3D | undefined; doorR: THREE.Object3D | undefined; barrier: ReturnType<CollisionWorld['addCircle']>[] };
  spawn: { x: number; z: number; rot: number };
  /** Entrada de quem volta do mapa: logo dentro do portão norte. */
  gateEntry: { x: number; z: number; rot: number };
  /** Posições soltas úteis. */
  spots: Record<'tito' | 'brutus' | 'pimenta' | 'alvim' | 'clotilde' | 'gears' | 'well', THREE.Vector3>;
  /** Onde as galinhas fugidas ficam no começo (fora do cercado). */
  wildHens: [number, number][];
  /** Passeios de moradores de fundo. */
  patrols: { a: [number, number][]; b: [number, number][]; kid: [number, number][] };
  smoke: Smoke;
  forgeFlame: ReturnType<typeof createFlame>;
  forgeLight: THREE.PointLight;
  update(dt: number, time: number, playerPos: THREE.Vector3, camera: THREE.Camera): void;
  dispose(): void;
}

export function buildVillageWorld(scene: THREE.Scene, world: CollisionWorld, quality: QualitySettings): VillageWorld {
  const rand = rng(1707);
  const disposables: { dispose(): void }[] = [];
  const C = VILLAGE_CENTER;

  // ---------- estradas ----------
  const mainRoad = new Path([[2, 76], [0, 52], [-3, 32], [0, 14], [0, 0], [0, -16], [2, -38], [0, -58]], 5.6, 1.2, 1);
  const eastRoad = new Path([[0, 2], [20, 5], [34, 16], [46, 33]], 3.8, 1.2, 2);
  const westRoad = new Path([[0, 0], [-22, 3], [-31, 12], [-42, 28], [-44, 38]], 3.6, 1.2, 3);
  const millRoad = new Path([[-15, -12], [-26, -24], [-34, -31]], 3.4, 1.2, 4);
  const paths = [mainRoad, eastRoad, westRoad, millRoad];
  const offRoad = (x: number, z: number) => Math.min(...paths.map((p) => p.distance(x, z)));

  // ---------- construções (lugar, escala, rotação) ----------
  const smithAt = { x: -22, z: -17 };
  const marketAt = { x: 23, z: -15 };
  const tavernAt = { x: -29, z: 7 };
  const churchAt = { x: 34, z: -6 };
  const stableAt = { x: 50, z: 22 };
  const millAt = { x: -40, z: -36 };
  const homes: [string, number, number, number][] = [
    ['building_home_A_red', -14, 31, BS],
    ['building_home_B_red', 17, 32, BS],
    ['building_home_A_red', -33, 43, BS],
    ['building_home_B_red', 33, 47, BS],
    ['building_home_A_red', -48, 12, BS],
    ['building_home_B_red', 41, -26, BS],
  ];
  const coopAt = { x: -55, z: 37 };
  const penAt = { x: -50, z: 38, r: 6.2 };
  const paddockAt = { x: 47, z: 47, r: 10 };

  // áreas onde não nasce árvore nem grama
  const lots = [smithAt, marketAt, tavernAt, churchAt, stableAt, millAt, coopAt, ...homes.map(([, x, z]) => ({ x, z }))];
  const zones: { x: number; z: number; r: number }[] = [{ x: 0, z: 0, r: 19 }, ...lots.map((l) => ({ x: l.x, z: l.z, r: 11 }))];
  zones.push({ x: paddockAt.x, z: paddockAt.z, r: 14 }, { x: penAt.x, z: penAt.z, r: 9 }, { x: -50, z: -21, r: 12 }, { x: millAt.x, z: millAt.z, r: 12 });
  const inZone = (x: number, z: number, extra = 0) => zones.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + extra);

  // ---------- terreno ----------
  const flat = (x: number, z: number, r: number, blend = 8, y = 0) => ({ x, z, r, blend, y });
  const wheatAt = { x: -50, z: -21, w: 15, d: 17 };
  const terrain = new Terrain({
    width: 300,
    depth: 300,
    centerX: 0,
    centerZ: 0,
    cell: quality.level === 'high' ? 2.4 : 3.0,
    hills: 2.6,
    hillScale: 38,
    paths,
    flats: [
      flat(0, 0, 15, 12),
      flat(smithAt.x, smithAt.z, 9),
      flat(marketAt.x, marketAt.z, 10),
      flat(tavernAt.x, tavernAt.z, 9),
      flat(churchAt.x, churchAt.z, 9),
      flat(stableAt.x, stableAt.z, 9),
      flat(paddockAt.x, paddockAt.z, 12, 8),
      flat(penAt.x, penAt.z, 8, 8),
      flat(wheatAt.x, wheatAt.z, 10, 8),
      flat(millAt.x, millAt.z, 7, 18, 3.4),
      ...homes.map(([, x, z]) => flat(x, z, 8)),
      flat(0, -56, 9, 6),
      flat(2, 60, 10, 10),
    ],
    extra: (x, z) => smoothstep(VILLAGE_RADIUS - 2, VILLAGE_RADIUS + 62, Math.hypot(x - C.x, z - C.z)) * 44,
    forest: (x, z) => smoothstep(48, 74, Math.hypot(x - C.x, z - C.z)) * 1.1,
  });
  scene.add(terrain.mesh);
  disposables.push(terrain);
  const ground = terrain.heightAt;

  const outdoor = new Outdoor(scene, quality, GOLDEN_MORNING.outdoor!);
  disposables.push(outdoor);
  const placer = new Placer(scene, world, 'village/', ground);

  // ---------- prédios ----------
  const building = (name: string, x: number, z: number, rot: number, scale = BS) => {
    const m = placer.place(name, x, z, rot, scale);
    placer.footprint(name, x, z, rot, scale);
    return m;
  };

  const smithRot = faceCenter(smithAt.x, smithAt.z);
  const smithObj = building('building_blacksmith_red', smithAt.x, smithAt.z, smithRot);
  const marketRot = faceCenter(marketAt.x, marketAt.z);
  const marketObj = building('building_market_red', marketAt.x, marketAt.z, marketRot, BS * 0.95);
  const tavernRot = faceCenter(tavernAt.x, tavernAt.z);
  const tavernObj = building('building_tavern_red', tavernAt.x, tavernAt.z, tavernRot);
  building('building_church_red', churchAt.x, churchAt.z, faceCenter(churchAt.x, churchAt.z), BS * 0.95);
  const stableRot = 0;
  building('building_lumbermill_red', stableAt.x, stableAt.z, stableRot, BS * 0.9);
  const millRot = faceCenter(millAt.x, millAt.z);
  const millObj = building('building_windmill_red', millAt.x, millAt.z, millRot, BS * 1.05);
  const fan = millObj.getObjectByName('building_windmill_top_fan_red');

  const homeObjs: THREE.Object3D[] = [];
  for (const [name, x, z, scale] of homes) {
    // a porta olha para a estrada mais próxima
    let best = mainRoad.pts[0];
    let bd = Infinity;
    for (const p of [...mainRoad.pts, ...eastRoad.pts, ...westRoad.pts]) {
      const d = Math.hypot(p.x - x, p.y - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    homeObjs.push(building(name, x, z, faceTo(x, z, best.x, best.y), scale));
  }
  // galinheiro: uma casinha de brinquedo
  building('building_home_A_red', coopAt.x, coopAt.z, faceTo(coopAt.x, coopAt.z, penAt.x + 20, penAt.z), 3.6);

  // poço no centro da praça
  placer.solid('building_well_red', 0, 0, 0, 4.6, 0.8);

  // ---------- adereços de tamanho de gente ----------
  const prop = (name: string, x: number, z: number, rot = 0, scale = PROP, blocks = 0) => {
    const m = placer.place(name, x, z, rot, scale);
    if (blocks > 0) world.addCircle(x, z, blocks);
    return m;
  };
  const at = Placer.front;
  // ferraria
  prop('weaponrack', ...flatXZ(at(smithAt.x, smithAt.z, smithRot, 5.2, 7.5)), smithRot, PROP, 0.7);
  prop('crate_open', ...flatXZ(at(smithAt.x, smithAt.z, smithRot, 4.5, -7.2)), 0.4, PROP, 0.7);
  prop('crate_A_big', ...flatXZ(at(smithAt.x, smithAt.z, smithRot, 3.4, -8.4)), 1.1, PROP, 0.6);
  prop('resource_stone', ...flatXZ(at(smithAt.x, smithAt.z, smithRot, 5.6, -9.5)), 0.5, PROP, 0.7);
  prop('barrel', ...flatXZ(at(smithAt.x, smithAt.z, smithRot, 2.4, 8.6)), 0, PROP, 0.5);
  // barraca da comerciante
  prop('sack', ...flatXZ(at(marketAt.x, marketAt.z, marketRot, 5.6, 6.3)), 0.3, PROP, 0.5);
  prop('sack', ...flatXZ(at(marketAt.x, marketAt.z, marketRot, 5.2, 7.3)), 1.0, PROP, 0.5);
  prop('wheelbarrow', ...flatXZ(at(marketAt.x, marketAt.z, marketRot, 4.5, -7.6)), 1.9, PROP, 0.8);
  prop('crate_B_big', ...flatXZ(at(marketAt.x, marketAt.z, marketRot, 3.4, -8.8)), 0.2, PROP, 0.6);
  prop('crate_A_small', ...flatXZ(at(marketAt.x, marketAt.z, marketRot, 3.0, 8.4)), 0.8, PROP, 0.5);
  // taverna
  prop('barrel', ...flatXZ(at(tavernAt.x, tavernAt.z, tavernRot, 5.2, -6.2)), 0, PROP, 0.5);
  prop('barrel', ...flatXZ(at(tavernAt.x, tavernAt.z, tavernRot, 5.6, -7.1)), 0.7, PROP, 0.5);
  prop('bucket_water', ...flatXZ(at(tavernAt.x, tavernAt.z, tavernRot, 4.4, 6.6)), 0.3, PROP);
  prop('crate_A_small', ...flatXZ(at(tavernAt.x, tavernAt.z, tavernRot, 4.6, 7.8)), 0.1, PROP, 0.45);
  // estábulo
  prop('sack', stableAt.x - 7, stableAt.z + 4, 0.6, PROP, 0.5);
  prop('pallet', stableAt.x - 8.4, stableAt.z + 5.8, 0.2, PROP);
  prop('bucket_water', stableAt.x + 7.4, stableAt.z + 6, 0, PROP);
  prop('resource_lumber', stableAt.x + 9.5, stableAt.z + 1, 1.1, PROP, 0.9);
  // moinho
  prop('sack', ...flatXZ(at(millAt.x, millAt.z, millRot, 5.6, 4.6)), 0.4, PROP, 0.5);
  prop('sack', ...flatXZ(at(millAt.x, millAt.z, millRot, 5.0, 5.6)), 1.4, PROP, 0.5);
  prop('wheelbarrow', ...flatXZ(at(millAt.x, millAt.z, millRot, 6.8, -5.2)), 0.9, PROP, 0.8);
  // casas: lenha, caixas e baldes
  homes.forEach(([, x, z], i) => {
    const rot = faceTo(x, z, 0, 8);
    const f = (d: number, s: number) => at(x, z, rot, d, s);
    prop(i % 2 ? 'resource_lumber' : 'barrel', ...flatXZ(f(5.4, i % 2 ? 6.4 : -5.8)), 0.4 + i, PROP, 0.7);
    prop(i % 2 ? 'bucket_empty' : 'crate_A_small', ...flatXZ(f(4.8, i % 2 ? -6 : 6.2)), 0.2 * i, PROP, i % 2 ? 0 : 0.45);
  });
  // bandeirolas na praça
  prop('flag_red', 11, 10, 0.5, BS * 0.7, 0.3);
  prop('flag_red', -11, -10, 2.2, BS * 0.7, 0.3);

  // ---------- portão norte ----------
  const GATE_Z = -56;
  const GS = 5.2;
  const gate = placer.place('wall_straight_gate', 0, GATE_Z, 0, GS);
  const doorL = gate.getObjectByName('wall_straight_gate_door_left');
  const doorR = gate.getObjectByName('wall_straight_gate_door_right');
  const GATE_HALF = 1.0 * GS; // meia largura da peça
  for (const k of [-1, 1]) {
    for (let i = 1; i <= 3; i++) {
      const wx = k * (GATE_HALF + (i - 0.5) * 2 * GS);
      placer.place('wall_straight', wx, GATE_Z, 0, GS);
      for (const t of [-GS * 0.8, 0, GS * 0.8]) world.addCircle(wx + t, GATE_Z, GS * 0.34);
    }
    // pilares ao lado da passagem
    world.addCircle(k * GATE_HALF * 0.82, GATE_Z, GS * 0.38);
  }
  const barrier = [-GS * 0.4, 0, GS * 0.4].map((t) => world.addCircle(t, GATE_Z, GS * 0.3));

  // ---------- cercas: estrada sul, cercado do cavalo, galinheiro ----------
  const fenceMats: { dispose(): void }[] = [];
  const addFence = (pts: [number, number][], seed: number, blockR = 0.3) => {
    const f = fenceLine(pts, ground, seed);
    scene.add(f.mesh);
    f.blockers.forEach(([x, z]) => world.addCircle(x, z, blockR));
    fenceMats.push(f.mesh.material as THREE.Material, f.mesh.geometry);
  };
  const roadSide = (side: number, f0: number, f1: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let f = f0; f <= f1; f += 0.03) {
      const p = mainRoad.at(f);
      const t = mainRoad.tangent(f);
      pts.push([p.x - t.y * side, p.y + t.x * side]);
    }
    return pts;
  };
  addFence(roadSide(4.5, 0.82, 0.99), 31);
  addFence(roadSide(-4.5, 0.82, 0.99), 32);
  // cercado do cavalo: retângulo com uma abertura na parede de cima (ao lado do estábulo)
  const pdx = 14;
  const pdz = 12;
  addFence([[paddockAt.x - 3, paddockAt.z - pdz], [paddockAt.x - pdx, paddockAt.z - pdz], [paddockAt.x - pdx, paddockAt.z + pdz], [paddockAt.x + pdx, paddockAt.z + pdz], [paddockAt.x + pdx, paddockAt.z - pdz], [paddockAt.x + 3, paddockAt.z - pdz]], 33, 0.35);
  // galinheiro: círculo com abertura voltada para a estrada (leste)
  const ring: [number, number][] = [];
  for (let i = 0; i <= 15; i++) {
    const a = 0.55 + (i / 15) * (Math.PI * 2 - 1.1);
    ring.push([penAt.x + Math.cos(a) * penAt.r, penAt.z + Math.sin(a) * penAt.r]);
  }
  addFence(ring, 34, 0.35);
  disposables.push(...fenceMats);

  // ---------- postes de lampião ao longo da estrada ----------
  const lampPole = new THREE.CylinderGeometry(0.08, 0.12, 3.6, 6).translate(0, 1.8, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f2a18, flatShading: true, roughness: 0.9 });
  const lampHead = new THREE.BoxGeometry(0.46, 0.55, 0.46).translate(0, 3.85, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.2, 0.5), toneMapped: false });
  const lampRoof = new THREE.ConeGeometry(0.42, 0.3, 4).translate(0, 4.3, 0).rotateY(Math.PI / 4);
  disposables.push(lampPole, poleMat, lampHead, lampMat, lampRoof);
  const lampPts: [number, number][] = [];
  for (let f = 0.1; f < 0.97; f += 0.07) {
    const p = mainRoad.at(f);
    const t = mainRoad.tangent(f);
    const side = lampPts.length % 2 ? 4.4 : -4.4;
    lampPts.push([p.x - t.y * side, p.y + t.x * side]);
  }
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.InstancedMesh(geo, mat, lampPts.length);
    lampPts.forEach(([x, z], i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, ground(x, z), z)));
    m.castShadow = mat !== lampMat;
    scene.add(m);
    return m;
  };
  mk(lampPole, poleMat);
  mk(lampHead, lampMat);
  mk(lampRoof, poleMat);
  lampPts.forEach(([x, z]) => world.addCircle(x, z, 0.25));

  // ---------- árvores, arbustos, pedras ----------
  const high = quality.level === 'high';
  const pineGeos = (['sunny', 'green', 'deep'] as const).flatMap((s, i) => [pineGeometry(10 + i * 3, PINE_STYLES[s], 5), pineGeometry(11 + i * 3, PINE_STYLES[s], 4)]);
  const roundGeo = roundTreeGeometry(5);
  const bushGeo = bushGeometry(6);
  const rockGeo = rockGeometry(7);
  const pineMat = natureMaterial(0.012);
  const roundMat = natureMaterial(0.01);
  const bushMat = natureMaterial(0.03);
  const rockMat = natureMaterial(0);
  disposables.push(...pineGeos, roundGeo, bushGeo, rockGeo, pineMat, roundMat, bushMat, rockMat);

  const distC = (x: number, z: number) => Math.hypot(x - C.x, z - C.z);
  const treePts = scatter(rand, {
    minX: -100,
    maxX: 100,
    minZ: -105,
    maxZ: 105,
    spacing: (x, z) => (distC(x, z) > VILLAGE_RADIUS - 6 ? 3.5 : 12),
    accept: (x, z) => {
      const d = distC(x, z);
      if (d > VILLAGE_RADIUS + 38) return false;
      if (offRoad(x, z) < 5.5) return false;
      if (inZone(x, z) && d < VILLAGE_RADIUS - 6) return false;
      if (d < VILLAGE_RADIUS - 6 && Math.abs(z) > 62 && Math.abs(x) < 9) return false;
      return true;
    },
    tries: high ? 16000 : 9000,
    max: high ? 1300 : 750,
  });
  const byGeo: Inst[][] = pineGeos.map(() => []);
  const rounds: Inst[] = [];
  for (const [x, z] of treePts) {
    const y = ground(x, z);
    const d = distC(x, z);
    const far = smoothstep(VILLAGE_RADIUS, VILLAGE_RADIUS + 34, d);
    if (d < VILLAGE_RADIUS - 6 && rand() < 0.5) {
      rounds.push({ x, y, z, rotY: rand() * 6.28, scale: 0.8 + rand() * 0.5, color: tint(rand) });
      world.addCircle(x, z, 0.6);
      continue;
    }
    const s = 0.85 + rand() * 0.55 + far * 0.45;
    byGeo[Math.floor(rand() * pineGeos.length)].push({ x, y: y - 0.2, z, rotY: rand() * 6.28, scale: s, tall: 0.9 + rand() * 0.3, tilt: (rand() - 0.5) * 0.05, color: tint(rand, 0.12) });
    if (d < VILLAGE_RADIUS + 6) world.addCircle(x, z, 0.5 * s);
  }
  byGeo.forEach((list, i) => list.length && scene.add(instanced(pineGeos[i], pineMat, list)));
  if (rounds.length) scene.add(instanced(roundGeo, roundMat, rounds));

  // pinheiros de longe (menos faces): cobrem as encostas que sobem atrás da vila
  const farGeos = (['sunny', 'green', 'deep'] as const).map((s, i) => pineGeometry(40 + i, PINE_STYLES[s], 3, 6));
  disposables.push(...farGeos);
  const farPts = scatter(rand, {
    minX: -148,
    maxX: 148,
    minZ: -148,
    maxZ: 148,
    spacing: () => 5,
    accept: (x, z) => {
      const d = distC(x, z);
      return d > VILLAGE_RADIUS + 28 && d < VILLAGE_RADIUS + 78;
    },
    tries: high ? 9000 : 5000,
    max: high ? 800 : 420,
  });
  const farBy: Inst[][] = farGeos.map(() => []);
  for (const [x, z] of farPts) farBy[Math.floor(rand() * farGeos.length)].push({ x, y: ground(x, z) - 0.3, z, rotY: rand() * 6.28, scale: 1.5 + rand() * 1.1, tall: 0.9 + rand() * 0.3, color: tint(rand, 0.12) });
  farBy.forEach((list, i) => list.length && scene.add(instanced(farGeos[i], pineMat, list, { cast: false })));

  const bushPts = scatter(rand, {
    minX: -85,
    maxX: 85,
    minZ: -85,
    maxZ: 90,
    spacing: () => 2.4,
    accept: (x, z) => offRoad(x, z) > 3.2 && distC(x, z) < VILLAGE_RADIUS + 8 && !inZone(x, z, -3),
    tries: 2500,
    max: high ? 300 : 170,
  });
  scene.add(instanced(bushGeo, bushMat, bushPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.05, z, rotY: rand() * 6.28, scale: 1 + rand() * 1.3, color: tint(rand, 0.12) }))));
  const rockPts = scatter(rand, { minX: -95, maxX: 95, minZ: -95, maxZ: 95, spacing: () => 7, accept: (x, z) => offRoad(x, z) > 3 && distC(x, z) < VILLAGE_RADIUS + 20 && !inZone(x, z, -2), tries: 1200, max: 80 });
  scene.add(instanced(rockGeo, rockMat, rockPts.map(([x, z]) => {
    const s = 0.8 + rand() * rand() * 3;
    if (distC(x, z) < VILLAGE_RADIUS + 4) world.addCircle(x, z, 0.65 * s);
    return { x, y: ground(x, z) - 0.08 * s, z, rotY: rand() * 6.28, scale: s, tall: 0.8 + rand() * 0.5, color: tint(rand, 0.1, 0.02) };
  })));
  const logGeo = logGeometry(4);
  const logMat = natureMaterial(0);
  disposables.push(logGeo, logMat);
  scene.add(instanced(logGeo, logMat, [{ x: 12, y: ground(12, 52), z: 52, rotY: 0.6, color: tint(rand) }]));
  world.addCircle(12, 52, 1.2);

  // ---------- pedrinhas nas estradas e flores nas margens ----------
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
  const petals = [0xffffff, 0xffffff, 0xffe38a, 0xffb7d0].map((h) => new THREE.Color(h));
  for (const road of paths) {
    const count = Math.round(road.length * 5);
    for (let i = 0; i < count; i++) {
      const f = rand();
      const p = road.at(f);
      const t = road.tangent(f);
      const off = (rand() - 0.5) * 2 * (road.width * 0.62);
      const x = p.x - t.y * off;
      const z = p.y + t.x * off;
      pebbles.push({ x, y: ground(x, z) - 0.02, z, rotY: rand() * 6.28, scale: 0.4 + rand() * rand() * 1.8, color: tint(rand, 0.2, 0) });
    }
    const clumps = Math.round(road.length / 4);
    for (let i = 0; i < clumps; i++) {
      const f = rand();
      const p = road.at(f);
      const t = road.tangent(f);
      const base = (rand() < 0.5 ? -1 : 1) * (road.width * 0.5 + 1.5 + rand() * 4);
      const cx = p.x - t.y * base;
      const cz = p.y + t.x * base;
      if (inZone(cx, cz, -4) && distC(cx, cz) < 22) continue;
      const n = 4 + Math.floor(rand() * 7);
      for (let k = 0; k < n; k++) {
        const x = cx + (rand() - 0.5) * 2.6;
        const z = cz + (rand() - 0.5) * 2.6;
        if (rand() < 0.5) lupines.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.5 + rand() * 0.45, tall: 0.8 + rand() * 0.6, color: blue[Math.floor(rand() * blue.length)] });
        else daisies.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.9 + rand() * 0.5, color: petals[Math.floor(rand() * petals.length)] });
      }
    }
  }
  scene.add(instanced(pebbleGeo, pebbleMat, pebbles, { cast: false }), instanced(lupineGeo, flowerMat, lupines, { cast: false }), instanced(daisyGeo, flowerMat, daisies, { cast: false }));

  // ---------- grama e trigal ----------
  const grass = new Grass({
    minX: -75,
    maxX: 75,
    minZ: -70,
    maxZ: 85,
    density: quality.grassDensity,
    range: quality.grassRange,
    height: ground,
    exclude: (x, z) => offRoad(x, z) < 0.4 || Math.hypot(x, z) < 15.5 || lots.some((l) => Math.hypot(x - l.x, z - l.z) < 8.5) || Math.abs(x - wheatAt.x) < wheatAt.w / 2 && Math.abs(z - wheatAt.z) < wheatAt.d / 2,
  });
  scene.add(grass.group);
  const wheat = new Grass({
    minX: wheatAt.x - wheatAt.w / 2,
    maxX: wheatAt.x + wheatAt.w / 2,
    minZ: wheatAt.z - wheatAt.d / 2,
    maxZ: wheatAt.z + wheatAt.d / 2,
    density: quality.grassDensity * 5,
    range: quality.grassRange + 14,
    height: ground,
    seed: 90,
    tints: [0xf7d868, 0xe9c050, 0xffe486, 0xdcb246],
  });
  scene.add(wheat.group);
  disposables.push(grass, wheat);

  // ---------- serra e mata ao fundo (somem na névoa) ----------
  const ridgeGeo = new THREE.ConeGeometry(40, 74, 6, 1);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x73908f, flatShading: true, roughness: 1 });
  disposables.push(ridgeGeo, ridgeMat);
  const ridge = new THREE.InstancedMesh(ridgeGeo, ridgeMat, 22);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 250 + rand() * 60;
    const s = 1 + rand() * 1.0;
    mtx.compose(
      new THREE.Vector3(C.x + Math.cos(a) * r, 12 + s * 8 - 12, C.z + Math.sin(a) * r),
      new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 3),
      new THREE.Vector3(s, s * (0.9 + rand() * 0.5), s),
    );
    ridge.setMatrixAt(i, mtx);
  }
  ridge.castShadow = false;
  ridge.receiveShadow = false;
  scene.add(ridge);

  world.addBounds(C.x, C.z, VILLAGE_RADIUS);

  // ---------- fumaça das chaminés e brilho da forja ----------
  const chimney = (obj: THREE.Object3D, lx: number, ly: number, lz: number) => {
    obj.updateMatrixWorld(true);
    return obj.localToWorld(new THREE.Vector3(lx, ly, lz)); // medidas locais do modelo (a escala já está no objeto)
  };
  const smoke = new Smoke(
    [
      chimney(smithObj, 0.2, 0.98, -0.02),
      chimney(homeObjs[0], 0.0, 0.97, -0.2),
      chimney(homeObjs[1], 0.1, 1.3, -0.26),
      chimney(tavernObj, -0.3, 1.45, -0.3),
    ],
    90,
    1.4,
    new THREE.Color(0xfbf6ee),
    2.4,
  );
  scene.add(smoke.points);
  const forgePos = smithObj.localToWorld(new THREE.Vector3(0.34, 0.2, 0.5));
  const forgeFlame = createFlame(1.9, 3);
  forgeFlame.mesh.position.copy(forgePos);
  scene.add(forgeFlame.mesh);
  const forgeLight = new THREE.PointLight(0xff8a3a, 26, 18, 2);
  forgeLight.position.set(forgePos.x, forgePos.y + 1.2, forgePos.z);
  scene.add(forgeLight);

  // ---------- pontos úteis ----------
  const spots = {
    tito: new THREE.Vector3(stableAt.x - 7, 0, stableAt.z + 12),
    brutus: at(smithAt.x, smithAt.z, smithRot, 6.6, 3.2),
    pimenta: at(marketAt.x, marketAt.z, marketRot, 6.6, -0.8),
    alvim: at(millAt.x, millAt.z, millRot, 7.4, 3.6),
    clotilde: new THREE.Vector3(penAt.x + 9, 0, penAt.z + 6),
    gears: at(millAt.x, millAt.z, millRot, 6.2, -1.5),
    well: new THREE.Vector3(0, 0, 0),
  };
  for (const k of Object.keys(spots) as (keyof typeof spots)[]) spots[k].y = ground(spots[k].x, spots[k].z);

  const wildHens: [number, number][] = [
    [-26, 40], [20, -34], [-58, -6], [38, 38], [8, -44], [-6, 62],
  ];

  return {
    ground,
    outdoor,
    placer,
    smith: { obj: smithObj, x: smithAt.x, z: smithAt.z, rot: smithRot },
    market: { obj: marketObj, x: marketAt.x, z: marketAt.z, rot: marketRot },
    mill: { obj: millObj, x: millAt.x, z: millAt.z, rot: millRot, fan },
    stable: { x: stableAt.x, z: stableAt.z, rot: stableRot },
    tavern: { x: tavernAt.x, z: tavernAt.z, rot: tavernRot },
    paddock: paddockAt,
    pen: penAt,
    gate: { pos: new THREE.Vector3(0, ground(0, GATE_Z), GATE_Z), rot: 0, doorL, doorR, barrier },
    spawn: { x: 2, z: 62, rot: Math.PI },
    gateEntry: { x: 0, z: GATE_Z + 9, rot: 0 },
    spots,
    wildHens,
    patrols: {
      a: [[9, 9], [-9, 11], [-12, -5], [8, -9]],
      b: [[4, 26], [-4, 44], [2, 54], [6, 38]],
      kid: [[-6, 6], [6, 4], [12, -2], [-4, -8]],
    },
    smoke,
    forgeFlame,
    forgeLight,
    update(dt, time, playerPos, camera) {
      updateWind(time);
      outdoor.update(playerPos, camera);
      grass.update(camera.position);
      wheat.update(camera.position);
      smoke.update(dt);
      forgeFlame.update(dt);
      forgeLight.intensity = 26 * (1 + Math.sin(time * 9) * 0.1 + Math.sin(time * 14.3) * 0.06);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** [x, z] de um vetor, para espalhar em chamadas `prop(name, ...flatXZ(v), ...)`. */
function flatXZ(v: THREE.Vector3): [number, number] {
  return [v.x, v.z];
}
