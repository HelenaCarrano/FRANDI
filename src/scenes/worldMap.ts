import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { gltf, model } from '../core/assets';
import { Smoke } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { content, fmt } from '../content';
import { DAY_ENV, S, hexPos, skyTexture } from './hexKit';
import { doneFlag, isBuilt, isUnlocked, MIDDLE_AREAS, unlockAll } from './registry';
import { ISOMETRIC, type Area, type AreaContext, type AreaId, type Interactable, type SpawnPoint } from './types';

/**
 * Mapa do Reino: o hub entre as áreas. Uma maquete em hexágonos do KayKit Medieval Hexagon Pack
 * (CC0) onde o Matheus anda de marco em marco. Áreas ainda fechadas ficam sob nuvens; quando
 * abrem, a névoa se dissolve. Cada marco tem uma placa e um ponto de interação.
 */

const V = (n: string) => `village/${n}`;
const NAMES = [
  'hex_grass',
  'building_castle_red', 'building_tower_A_red', 'building_tower_B_red', 'building_destroyed',
  'building_tavern_red', 'building_home_A_red', 'building_home_B_red', 'building_windmill_red', 'building_well_red',
  'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees', 'hills_B_trees', 'hills_C_trees',
  'trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium', 'trees_A_small', 'trees_B_small',
  'tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D',
  'resource_stone', 'barrel', 'crate_A_small', 'crate_B_big', 'bucket_water', 'flag_red', 'fence_wood_straight',
  'cloud_big', 'cloud_small',
];
export const MAP_ASSETS = NAMES.map(V);

/** Escala dos adereços (barris, caixas), igual à da vila. */
const PROP = 4.2;
const A = Math.SQRT1_2;

/** Ponto do chão a partir de coordenadas de tela: u para a direita, v para cima (a câmera olha de +x,+z). */
const world = (u: number, v: number) => new THREE.Vector3(A * (u - v), 0, A * (-u - v));
/** Direção do chão para a câmera. */
const TO_CAMERA = new THREE.Vector3(A, 0, A);

type PlaceId = Exclude<AreaId, 'map' | 'ending' | 'visual'>;

interface Place {
  u: number;
  v: number;
  /** Ponto (u, v) de onde o jogador chega: a placa fica desse lado. */
  toward: [number, number];
  /** Distância do centro até o ponto de interação. */
  reach: number;
  /** Raio da névoa que cobre o lugar enquanto fechado. */
  mist: number;
  /** Camadas de nuvens empilhadas (marcos altos, como a torre e o castelo, precisam de mais). */
  layers?: number;
}

const PLACES: Record<PlaceId, Place> = {
  village: { u: 0, v: -24, toward: [0, -4], reach: 6.2, mist: 0 },
  forest: { u: 0, v: -4, toward: [0, -24], reach: 6.2, mist: 4.4 },
  ruins: { u: -15, v: 6, toward: [0, 5], reach: 6.2, mist: 4.4 },
  tower: { u: 15, v: 6, toward: [0, 5], reach: 6.2, mist: 4.4, layers: 3 },
  tavern: { u: -10, v: 17, toward: [-4, 11], reach: 6.2, mist: 4.4 },
  vineyard: { u: 10, v: 17, toward: [4, 11], reach: 6.2, mist: 4.4 },
  castle: { u: 0, v: 30, toward: [0, 16], reach: 8.4, mist: 6.6, layers: 3 },
};
const PLACE_IDS = Object.keys(PLACES) as PlaceId[];

/** Estradas de terra, em coordenadas (u, v). */
const ROADS: [number, number][][] = [
  [[0, -24], [0, -4], [0, 5]],
  [[0, 5], [-15, 6]],
  [[0, 5], [15, 6]],
  [[0, 5], [-4, 11], [-10, 17]],
  [[0, 5], [4, 11], [10, 17]],
  [[0, 5], [0, 16], [0, 30]],
];

const TILE_REACH_ROAD = 9;
const TILE_REACH_PLACE = 9.5;

const HEX_NEIGHBORS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function distToSegment(px: number, pz: number, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : THREE.MathUtils.clamp(((px - a.x) * dx + (pz - a.z) * dz) / len2, 0, 1);
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

interface MistCloud {
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  scale: number;
  out: THREE.Vector2;
  phase: number;
}
interface Mist {
  clouds: MistCloud[];
  blocker: ReturnType<CollisionWorld['addCircle']> | null;
}

export function createWorldMap(ctx: AreaContext): Area {
  const { ui, game, goTo } = ctx;
  const T = content.worldMap;
  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  const collision = new CollisionWorld();
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];
  const disposables: { dispose(): void }[] = [sky];

  // ---------- luz: sol dourado baixo + céu (a câmera é mais aberta, então a sombra também) ----------
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xd9b98a, 1.25));
  const sun = new THREE.DirectionalLight(0xffd9a0, 3.1);
  const SUN_OFFSET = new THREE.Vector3(-11, 13, -5);
  const SHADOW_SPAN = 22;
  sun.castShadow = true;
  sun.shadow.mapSize.set(ctx.quality.shadowMapSize, ctx.quality.shadowMapSize);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = shadowCam.bottom = -SHADOW_SPAN;
  shadowCam.right = shadowCam.top = SHADOW_SPAN;
  shadowCam.near = 1;
  shadowCam.far = 70;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const texel = (SHADOW_SPAN * 2) / ctx.quality.shadowMapSize;

  // ---------- ajudantes ----------
  const place = (name: string, x: number, z: number, rotY = 0, scale = S, y = 0, cast = true) => {
    const m = model(V(name));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
    if (!cast) m.traverse((o) => (o.castShadow = false));
    scene.add(m);
    return m;
  };

  const boxCache = new Map<string, THREE.Box3>();
  /** Colisão de uma peça: círculos enfileirados ao longo do lado maior da pegada dela. */
  const block = (name: string, x: number, z: number, rotY: number, scale: number, shrink = 0.85) => {
    let b = boxCache.get(name);
    if (!b) {
      b = new THREE.Box3().setFromObject(gltf(V(name)).scene);
      boxCache.set(name, b);
    }
    const w = (b.max.x - b.min.x) * scale;
    const d = (b.max.z - b.min.z) * scale;
    const cx = ((b.max.x + b.min.x) / 2) * scale;
    const cz = ((b.max.z + b.min.z) / 2) * scale;
    const along = w >= d;
    const r = (Math.min(w, d) / 2) * shrink;
    const len = Math.max(w, d);
    const n = Math.max(1, Math.ceil((len - 2 * r) / (r * 1.4)) + 1);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : -(len / 2 - r) + (i * (len - 2 * r)) / (n - 1);
      const lx = cx + (along ? t : 0);
      const lz = cz + (along ? 0 : t);
      collision.addCircle(x + lx * cos + lz * sin, z - lx * sin + lz * cos, r);
    }
  };

  /** Peça com colisão; `tall` esmaece quando tapa o Matheus. */
  const solid = (name: string, x: number, z: number, rotY: number, scale: number, tall = true) => {
    const m = place(name, x, z, rotY, scale);
    block(name, x, z, rotY, scale);
    if (tall) occluders.push(m);
    return m;
  };

  // ---------- posições dos marcos ----------
  interface Spot {
    id: PlaceId;
    centre: THREE.Vector3;
    /** Direção (unitária, no chão) do centro para o lado de onde se chega. */
    dir: THREE.Vector3;
    rotY: number;
    /** Ponto de interação, na beira da névoa. */
    reach: THREE.Vector3;
  }
  const spots = {} as Record<PlaceId, Spot>;
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    const centre = world(p.u, p.v);
    const dir = world(p.toward[0], p.toward[1]).sub(centre).setY(0).normalize();
    spots[id] = { id, centre, dir, rotY: Math.atan2(dir.x, dir.z), reach: centre.clone().addScaledVector(dir, p.reach) };
  }
  /** Ponto ao lado e à frente de um marco (lado em metros para a direita de quem olha a porta). */
  const at = (s: Spot, side: number, fwd: number) =>
    new THREE.Vector3(s.centre.x + s.dir.z * side + s.dir.x * fwd, 0, s.centre.z - s.dir.x * side + s.dir.z * fwd);

  // ---------- estradas (em coordenadas de mundo) ----------
  const roadsWorld = ROADS.map((line) => line.map(([u, v]) => world(u, v)));

  // ---------- chão: hexágonos perto das estradas e dos marcos ----------
  const roadDist = (x: number, z: number) => {
    let best = Infinity;
    for (const line of roadsWorld) for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distToSegment(x, z, line[i], line[i + 1]));
    return best;
  };
  const placeDist = (x: number, z: number) => {
    let best = Infinity;
    for (const id of PLACE_IDS) best = Math.min(best, Math.hypot(x - spots[id].centre.x, z - spots[id].centre.z));
    return best;
  };

  const key = (q: number, r: number) => `${q},${r}`;
  const tiles = new Map<string, THREE.Vector3>();
  for (let q = -14; q <= 14; q++) {
    for (let r = -14; r <= 14; r++) {
      const p = hexPos(q, r);
      if (roadDist(p.x, p.z) < TILE_REACH_ROAD || placeDist(p.x, p.z) < TILE_REACH_PLACE) tiles.set(key(q, r), p);
    }
  }
  for (const p of tiles.values()) place('hex_grass', p.x, p.z, 0, S, 0, false);

  // ---------- borda da ilha: montanhas, colinas e bosques + parede invisível ----------
  const rimDecor = ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees', 'hills_B_trees', 'hills_C_trees', 'trees_A_large', 'trees_B_large'];
  const inner: THREE.Vector3[] = [];
  let seed = 11;
  for (const [k, p] of tiles) {
    const [q, r] = k.split(',').map(Number);
    let onRim = false;
    for (const [dq, dr] of HEX_NEIGHBORS) {
      if (tiles.has(key(q + dq, r + dr))) continue;
      onRim = true;
      // três círculos ao longo da aresta que dá para o vazio
      const n = hexPos(q + dq, r + dr).sub(p);
      const mid = p.clone().addScaledVector(n, 0.5);
      const side = new THREE.Vector3(-n.z, 0, n.x).normalize();
      for (const t of [-1.4, 0, 1.4]) collision.addCircle(mid.x + side.x * t, mid.z + side.z * t, 1.0);
    }
    if (onRim) {
      const v = -A * (p.x + p.z);
      const far = v > 22;
      const pool = far ? rimDecor.slice(0, 5) : rimDecor.slice(3);
      const name = pool[Math.floor(rand(seed++) * pool.length)];
      const m = place(name, p.x, p.z, rand(seed++) * Math.PI * 2, S * (0.95 + rand(seed++) * 0.25));
      collision.addCircle(p.x, p.z, 2.3);
      occluders.push(m);
    } else {
      inner.push(p);
    }
  }

  // bosquezinhos e pedras nos hexágonos de dentro, longe das estradas e dos marcos
  for (const p of inner) {
    if (roadDist(p.x, p.z) < 5.2 || placeDist(p.x, p.z) < 9.5) continue;
    const roll = rand(seed++);
    if (roll < 0.5) {
      const name = ['trees_A_medium', 'trees_B_medium', 'trees_A_small', 'trees_B_small'][Math.floor(rand(seed++) * 4)];
      const big = name.includes('medium');
      const ox = (rand(seed++) - 0.5) * 2;
      const oz = (rand(seed++) - 0.5) * 2;
      place(name, p.x + ox, p.z + oz, rand(seed++) * 6, S);
      collision.addCircle(p.x + ox, p.z + oz, big ? 2.0 : 1.4);
    } else if (roll < 0.62) {
      const name = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D'][Math.floor(rand(seed++) * 4)];
      const ox = (rand(seed++) - 0.5) * 2.4;
      const oz = (rand(seed++) - 0.5) * 2.4;
      place(name, p.x + ox, p.z + oz, rand(seed++) * 6, S * 1.2);
      collision.addCircle(p.x + ox, p.z + oz, 0.8);
    }
  }

  // ---------- estradas de terra: discos achatados, um InstancedMesh só ----------
  const discs: { x: number; z: number; r: number; shade: number }[] = [];
  for (const line of roadsWorld) {
    let s = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = a.distanceTo(b);
      const dir = b.clone().sub(a).setY(0).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      for (let d = 0; d < len; d += 0.8, s += 0.8) {
        const x = a.x + dir.x * d + perp.x * Math.sin(s * 0.33) * 0.55;
        const z = a.z + dir.z * d + perp.z * Math.sin(s * 0.33) * 0.55;
        if (placeDist(x, z) < 3.8) continue; // a estrada para antes do marco
        discs.push({ x, z, r: 1.05 + rand(seed++) * 0.35, shade: rand(seed++) });
      }
    }
  }
  const grassTop = new THREE.Box3().setFromObject(gltf(V('hex_grass')).scene).max.y * S;
  const roadGeo = new THREE.CylinderGeometry(1, 1, 0.06, 10);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const road = new THREE.InstancedMesh(roadGeo, roadMat, discs.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  discs.forEach((d, i) => {
    dummy.position.set(d.x, grassTop + 0.03, d.z);
    dummy.scale.set(d.r, 1, d.r * 0.9);
    dummy.updateMatrix();
    road.setMatrixAt(i, dummy.matrix);
    road.setColorAt(i, tint.setHex(0xcfae78).offsetHSL(0, 0, (d.shade - 0.5) * 0.08));
  });
  road.castShadow = false;
  road.receiveShadow = true;
  scene.add(road);
  disposables.push(roadGeo, roadMat);

  // ---------- marcos ----------
  const smokeSpots: THREE.Vector3[] = [];
  let fan: THREE.Object3D | null = null;

  // Vila: casinhas e o moinho girando
  {
    const s = spots.village;
    const mill = solid('building_windmill_red', ...xz(at(s, 0, -1.2)), s.rotY, S * 1.6);
    fan = mill.getObjectByName('building_windmill_top_fan_red') ?? null;
    solid('building_home_A_red', ...xz(at(s, -4.4, 1.6)), s.rotY + 0.25, S * 1.5);
    solid('building_home_B_red', ...xz(at(s, 4.4, 0.8)), s.rotY - 0.25, S * 1.5);
    solid('building_well_red', ...xz(at(s, 2.4, 3.6)), 0, S * 1.2, false);
  }

  // Floresta: bosque fechado nos dois lados da estrada e atrás
  {
    const s = spots.forest;
    const trees: [string, number, number][] = [
      ['trees_A_large', -4.6, 0.6], ['trees_B_large', 4.8, 0.2], ['trees_B_large', -5.4, -4.2],
      ['trees_A_large', 5.2, -4.4], ['trees_A_large', -1.8, -6.6], ['trees_B_large', 2.2, -6.4],
      ['trees_A_medium', -3.4, 4.4], ['trees_B_medium', 3.6, 4.6],
    ];
    trees.forEach(([name, side, fwd], i) => {
      const p = at(s, side, fwd);
      const m = place(name, p.x, p.z, i * 1.7, S * 1.1);
      collision.addCircle(p.x, p.z, name.includes('large') ? 2.6 : 1.9);
      occluders.push(m);
    });
    for (const [name, side, fwd] of [['tree_single_A', 0.8, -1.2], ['tree_single_B', -1.2, 0.8], ['rock_single_B', 1.4, 1.6]] as const) {
      const p = at(s, side, fwd);
      place(name, p.x, p.z, side, S * 1.1);
    }
  }

  // Ruínas: construção destruída, pedras e cercas quebradas
  {
    const s = spots.ruins;
    solid('building_destroyed', ...xz(s.centre), s.rotY, S * 1.7);
    for (const [name, side, fwd, rot] of [
      ['resource_stone', -3.6, 3.2, 0.4], ['resource_stone', 3.8, 2.4, 1.9], ['rock_single_C', -4.2, -2.6, 0.7],
      ['rock_single_A', 4.4, -3.2, 2.2], ['rock_single_D', 0.6, -5.2, 1.3],
    ] as const) {
      const p = at(s, side, fwd);
      place(name, p.x, p.z, rot, name.startsWith('resource') ? PROP : S * 1.3);
      collision.addCircle(p.x, p.z, 0.8);
    }
    for (const [side, fwd, rot] of [[-3.2, 4.8, 0.3], [2.6, 5.0, -0.5]] as const) {
      const p = at(s, side, fwd);
      place('fence_wood_straight', p.x, p.z, s.rotY + rot, S * 1.1);
    }
  }

  // Torre: duas torres altas
  {
    const s = spots.tower;
    solid('building_tower_A_red', ...xz(s.centre), s.rotY, S * 1.9);
    const b = at(s, -5.2, -2.4);
    solid('building_tower_B_red', b.x, b.z, s.rotY + 0.4, S * 1.4);
    for (const [name, side, fwd] of [['trees_A_small', 4.2, 1.8], ['trees_B_small', 3.6, -3.6]] as const) {
      const p = at(s, side, fwd);
      place(name, p.x, p.z, side, S);
      collision.addCircle(p.x, p.z, 1.2);
    }
  }

  // Taverna: a casa, barris e fumaça na chaminé
  {
    const s = spots.tavern;
    const house = solid('building_tavern_red', ...xz(s.centre), s.rotY, S * 1.7);
    house.updateMatrixWorld(true);
    smokeSpots.push(house.localToWorld(new THREE.Vector3(-0.3, 1.45, -0.3)));
    for (const [name, side, fwd, rot] of [
      ['barrel', 4.4, 2.6, 0], ['barrel', 5.2, 3.4, 0.7], ['crate_A_small', 4.0, 4.0, 0.5],
      ['bucket_water', -4.2, 3.4, 0.3], ['crate_B_big', -4.8, 2.2, 0.2],
    ] as const) {
      const p = at(s, side, fwd);
      place(name, p.x, p.z, rot, PROP);
      collision.addCircle(p.x, p.z, 0.55);
    }
    const f = at(s, 3.2, 5.0);
    place('flag_red', f.x, f.z, 0.6, S);
  }

  // Vinhedo: fileiras de parreiras feitas em código
  {
    const s = spots.vineyard;
    buildVineyard(s);
    const home = at(s, 0, -4.6);
    solid('building_home_B_red', home.x, home.z, s.rotY, S * 1.5);
  }

  // Castelo: no alto, entre montanhas
  {
    const s = spots.castle;
    solid('building_castle_red', ...xz(s.centre), s.rotY, S * 1.7);
    for (const [name, side, fwd, scale] of [
      ['mountain_B_grass_trees', -9.2, -1.5, 1.35], ['mountain_A_grass_trees', 9.0, -1.8, 1.3],
      ['mountain_C_grass_trees', 0, -9.5, 1.6], ['hills_C_trees', -6.4, 5.8, 1.1], ['hills_B_trees', 6.6, 5.4, 1.1],
      ['mountain_A_grass_trees', -9.6, -8.4, 1.4], ['mountain_B_grass_trees', 9.8, -8.0, 1.4],
    ] as const) {
      const p = at(s, side, fwd);
      const m = place(name, p.x, p.z, side * 0.4, S * scale);
      collision.addCircle(p.x, p.z, 2.4 * scale);
      occluders.push(m);
    }
  }

  // Encruzilhada: bandeiras e uns barris
  {
    for (const [u, v] of [[-3, 3.4], [3, 3.4]] as const) {
      const p = world(u, v);
      place('flag_red', p.x, p.z, u * 0.2, S);
      collision.addCircle(p.x, p.z, 0.3);
    }
    const b = world(4.2, 8.6);
    place('barrel', b.x, b.z, 0.2, PROP);
    collision.addCircle(b.x, b.z, 0.55);
  }

  /** As parreiras do vinhedo: fileiras de postes, folhagem e cachos, com colisão leve. */
  function buildVineyard(s: Spot) {
    const ROWS = 5;
    const VINES = 8;
    const rowGap = 1.7;
    const vineGap = 1.15;
    const total = ROWS * VINES;
    const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.3, 5);
    const leafGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const grapeGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const soilGeo = new THREE.BoxGeometry(VINES * vineGap + 0.8, 0.05, 1.0);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f9440, roughness: 0.85, flatShading: true });
    const grapeMat = new THREE.MeshStandardMaterial({ color: 0x6d2f8a, roughness: 0.5, flatShading: true });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    disposables.push(postGeo, leafGeo, grapeGeo, soilGeo, postMat, leafMat, grapeMat, soilMat);

    const posts = new THREE.InstancedMesh(postGeo, postMat, ROWS * 3);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, total);
    const grapes = new THREE.InstancedMesh(grapeGeo, grapeMat, total * 3);
    const soils: THREE.Mesh[] = [];
    const o = new THREE.Object3D();
    let pi = 0;
    let li = 0;
    let gi = 0;
    // o vinhedo fica um pouco atrás do centro, para a névoa e a placa não o esconderem à toa
    const origin = at(s, 0, 0.6);
    const cos = Math.cos(s.rotY);
    const sin = Math.sin(s.rotY);
    const toWorld = (lx: number, lz: number) => new THREE.Vector3(origin.x + lx * cos + lz * sin, 0, origin.z - lx * sin + lz * cos);
    for (let row = 0; row < ROWS; row++) {
      const lz = (row - (ROWS - 1) / 2) * rowGap;
      const soil = new THREE.Mesh(soilGeo, soilMat);
      const sp = toWorld(0, lz);
      soil.position.set(sp.x, grassTop + 0.03, sp.z);
      soil.rotation.y = s.rotY;
      soil.receiveShadow = true;
      scene.add(soil);
      soils.push(soil);
      for (const t of [-1, 0, 1]) {
        const p = toWorld(t * (VINES * vineGap) * 0.5, lz);
        o.position.set(p.x, grassTop + 0.65, p.z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        posts.setMatrixAt(pi++, o.matrix);
      }
      for (let k = 0; k < VINES; k++) {
        const lx = (k - (VINES - 1) / 2) * vineGap;
        const p = toWorld(lx, lz);
        const sz = 0.85 + rand(seed++) * 0.3;
        o.position.set(p.x, grassTop + 0.62, p.z);
        o.rotation.set(0, rand(seed++) * 6, 0);
        o.scale.set(sz, 0.8 * sz, 0.8 * sz);
        o.updateMatrix();
        leaves.setMatrixAt(li++, o.matrix);
        for (let g = 0; g < 3; g++) {
          o.position.set(p.x + (g - 1) * 0.2, grassTop + 0.26 + (g % 2) * 0.08, p.z + (rand(seed++) - 0.5) * 0.3);
          o.rotation.set(0, 0, 0);
          o.scale.setScalar(0.9 + rand(seed++) * 0.4);
          o.updateMatrix();
          grapes.setMatrixAt(gi++, o.matrix);
        }
        collision.addCircle(p.x, p.z, 0.4);
      }
    }
    for (const m of [posts, leaves, grapes]) {
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ---------- névoa sobre as áreas fechadas (ou recém-abertas, para dissolver na chegada) ----------
  const mistFor = (id: PlaceId) => PLACES[id].mist > 0 && (!isUnlocked(id, game) || (!unlockAll && !game.flag('seen_' + id)));
  const mists: Partial<Record<PlaceId, Mist>> = {};
  for (const id of PLACE_IDS) {
    if (!mistFor(id)) continue;
    const s = spots[id];
    const radius = PLACES[id].mist;
    const dark = id === 'castle';
    const clouds: MistCloud[] = [];
    const layers = PLACES[id].layers ?? 1;
    const perLayer = dark ? 10 : 8;
    const count = perLayer * layers;
    for (let i = 0; i < count; i++) {
      const layer = Math.floor(i / perLayer);
      const k = i % perLayer;
      const ring = k < 2 ? 0 : 1;
      const ang = (k / perLayer) * Math.PI * 2 + rand(seed++) * 0.6;
      const rr = (ring === 0 ? radius * 0.15 : radius * (0.62 + rand(seed++) * 0.3)) * (1 - layer * 0.12);
      const y = 1.8 + layer * 3.6 + rand(seed++) * 1.6 + (ring === 0 ? 1.2 : 0);
      const pos = new THREE.Vector3(s.centre.x + Math.cos(ang) * rr, y, s.centre.z + Math.sin(ang) * rr);
      const obj = model(V(k % 3 === 0 ? 'cloud_small' : 'cloud_big'));
      const scale = S * (dark ? 0.95 : 0.8) * (0.85 + rand(seed++) * 0.4);
      obj.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (dark) mat.color.setHex(0x7d7490);
        disposables.push(mat);
        mesh.material = mat;
      });
      obj.position.copy(pos);
      obj.rotation.y = rand(seed++) * 6;
      obj.scale.setScalar(scale);
      scene.add(obj);
      clouds.push({ obj, pos, scale, out: new THREE.Vector2(Math.cos(ang), Math.sin(ang)), phase: rand(seed++) * 6 });
    }
    // enquanto fechada, a névoa também barra a passagem
    const blocker = isUnlocked(id, game) ? null : collision.addCircle(s.centre.x, s.centre.z, radius + 0.3);
    mists[id] = { clouds, blocker };
  }

  // ---------- placas e pontos de interação ----------
  const names = content.areas;
  const signTexture = (id: PlaceId) => {
    const open = isUnlocked(id, game);
    const done = id !== 'village' && game.flag(doneFlag(id));
    const label = id === 'village' ? names.village : open ? names[id] : '???';
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 150;
    const g = c.getContext('2d')!;
    g.fillStyle = open ? '#9a6a35' : '#6d6a66';
    g.fillRect(0, 0, 512, 150);
    g.strokeStyle = open ? '#5c3a18' : '#3f3d3a';
    g.lineWidth = 10;
    g.strokeRect(5, 5, 502, 140);
    g.fillStyle = open ? '#fff0c8' : '#c9c4bc';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 56;
    const text = (done ? '✓ ' : '') + label;
    g.font = `700 ${size}px Georgia, serif`;
    while (g.measureText(text).width > 450 && size > 22) g.font = `700 ${--size}px Georgia, serif`;
    g.fillText(text, 256, 78);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    disposables.push(tex);
    return tex;
  };

  const plankGeo = new THREE.BoxGeometry(3.6, 1.06, 0.16);
  const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 2.4, 6);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, flatShading: true });
  disposables.push(plankGeo, postGeo, woodMat);

  const sparkles: { marker: Marker; base: number; show: () => boolean }[] = [];
  const entries: Record<string, SpawnPoint> = {};

  const isOpen = (id: PlaceId) => id === 'village' || (isUnlocked(id, game) && isBuilt(id));
  async function useSpot(id: PlaceId) {
    if (id === 'village') return goTo('village', 'gate');
    if (!isUnlocked(id, game)) {
      const lines = id === 'castle' ? T.locked.castle : id === 'forest' ? T.locked.forest : T.locked.middle;
      return ui.tell(lines);
    }
    if (!isBuilt(id)) return ui.tell(T.preparing);
    return goTo(id);
  }

  for (const id of PLACE_IDS) {
    const s = spots[id];
    // a placa fica ao lado do ponto de interação, do lado mais perto da câmera
    const perp = new THREE.Vector3(s.dir.z, 0, -s.dir.x);
    if (perp.dot(TO_CAMERA) < 0) perp.negate();
    const signPos = s.reach.clone().addScaledVector(perp, 2.3);

    const sign = new THREE.Group();
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 1.2;
    const faceMat = new THREE.MeshStandardMaterial({ map: signTexture(id), roughness: 0.8 });
    disposables.push(faceMat);
    const plank = new THREE.Mesh(plankGeo, [woodMat, woodMat, woodMat, woodMat, faceMat, woodMat]);
    plank.position.y = 2.2;
    const face = s.dir.clone().multiplyScalar(0.5).add(TO_CAMERA).normalize();
    sign.add(post, plank);
    sign.position.copy(signPos);
    sign.rotation.y = Math.atan2(face.x, face.z);
    sign.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    scene.add(sign);
    collision.addCircle(signPos.x, signPos.z, 0.35);

    // ponto de chegada: logo além do alcance da interação, olhando para o lado de onde se vem
    const spawnPos = s.reach.clone().addScaledVector(s.dir, 3.4);
    entries[id] = { x: spawnPos.x, z: spawnPos.z, rot: s.rotY };

    interactables.push({
      position: s.reach,
      radius: 2.5,
      prompt: () => (id === 'village' ? T.toVillage : isOpen(id) ? fmt(T.enter, { name: names[id] }) : T.examine),
      onInteract: () => void useSpot(id),
    });

    if (id !== 'village') {
      const marker = sparkleMarker();
      marker.position.set(signPos.x, 3.7, signPos.z);
      scene.add(marker);
      sparkles.push({ marker, base: 3.7, show: () => isOpen(id) && !game.flag(doneFlag(id)) });
    }
  }

  // ---------- nuvens embaixo da ilha ----------
  const clouds: THREE.Object3D[] = [];
  {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of tiles.values()) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    for (let i = 0; i < 16; i++) {
      const x = minX - 8 + rand(seed++) * (maxX - minX + 16);
      const z = minZ - 8 + rand(seed++) * (maxZ - minZ + 16);
      clouds.push(place(i % 3 === 0 ? 'cloud_small' : 'cloud_big', x, z, rand(seed++) * 6, S * (1.2 + rand(seed++) * 0.7), -5 - rand(seed++) * 2.5, false));
    }
  }

  // ---------- fumaça das chaminés ----------
  const smoke = new Smoke(smokeSpots);
  scene.add(smoke.points);

  // ---------- objetivo ----------
  function objective(): string | null {
    const o = T.objective;
    if (!game.flag(doneFlag('forest'))) return o.forest;
    const n = MIDDLE_AREAS.filter((a) => game.flag(doneFlag(a))).length;
    if (n < MIDDLE_AREAS.length) return fmt(o.explore, { n });
    if (!game.flag(doneFlag('castle'))) return o.castle;
    return o.ending;
  }
  const refresh = () => ui.setObjective(objective());
  const stopRefresh = game.onChange(refresh);

  // ---------- dissolver a névoa das áreas recém-abertas ----------
  let reveal: { ids: PlaceId[]; t: number } | null = null;
  const REVEAL_SECONDS = 2.4;
  function startReveal() {
    const ids = PLACE_IDS.filter((id) => mists[id] && isUnlocked(id, game));
    if (ids.length === 0) return;
    reveal = { ids, t: 0 };
    ids.forEach((id, i) => {
      game.setFlag('seen_' + id);
      setTimeout(() => ui.toast(fmt(T.newPath, { name: names[id] })), 500 + i * 700);
    });
  }

  const sunTarget = new THREE.Vector3();
  const entry = entries.village;

  return {
    name: T.areaName,
    scene,
    world: collision,
    spawn: new THREE.Vector3(entry.x, 0, entry.z),
    entries,
    camera: { ...ISOMETRIC, distance: 25 },
    interactables,
    occluders,
    env: DAY_ENV,
    torchLit: false,
    onEnter() {
      refresh();
      if (!game.flag('mapSeen')) {
        game.setFlag('mapSeen');
        void ui.tell(T.intro).then(startReveal);
      } else startReveal();
    },
    dispose() {
      stopRefresh();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      sunTarget.set(Math.round(playerPos.x / texel) * texel, 0, Math.round(playerPos.z / texel) * texel);
      sun.target.position.copy(sunTarget);
      sun.position.copy(sunTarget).add(SUN_OFFSET);

      smoke.update(dt);
      if (fan) fan.rotation.z += dt * 0.7;
      clouds.forEach((c, i) => (c.position.x += Math.sin(time * 0.1 + i) * dt * 0.15));

      if (reveal) {
        reveal.t += dt;
        const p = Math.min(1, reveal.t / REVEAL_SECONDS);
        const ease = p * p * (3 - 2 * p);
        for (const id of reveal.ids) {
          for (const c of mists[id]!.clouds) {
            c.obj.scale.setScalar(Math.max(0.001, c.scale * (1 - ease)));
            c.obj.position.set(c.pos.x + c.out.x * ease * 5, c.pos.y + ease * 4, c.pos.z + c.out.y * ease * 5);
          }
        }
        if (p >= 1) {
          for (const id of reveal.ids) {
            mists[id]!.clouds.forEach((c) => scene.remove(c.obj));
            delete mists[id];
          }
          reveal = null;
        }
      }
      // a névoa que ficou respira de leve
      for (const id of PLACE_IDS) {
        if (reveal?.ids.includes(id)) continue;
        for (const c of mists[id]?.clouds ?? []) {
          c.obj.position.y = c.pos.y + Math.sin(time * 0.6 + c.phase) * 0.18;
          c.obj.position.x = c.pos.x + Math.sin(time * 0.25 + c.phase) * 0.25;
        }
      }

      for (const s of sparkles) {
        const on = s.show();
        s.marker.visible = on;
        if (on) {
          s.marker.position.y = s.base + Math.sin(time * 2.4 + s.marker.position.x) * 0.15;
          s.marker.setSize(0.9 + Math.sin(time * 5 + s.marker.position.z) * 0.14);
        }
      }
    },
  };
}

/** Atalho para espalhar x e z de um ponto em argumentos: `solid(nome, ...xz(p), ...)`. */
function xz(p: THREE.Vector3): [number, number] {
  return [p.x, p.z];
}
