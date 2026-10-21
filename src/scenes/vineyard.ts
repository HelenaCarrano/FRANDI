import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { SUNSET, Outdoor, cloneEnv } from '../fx/atmosphere';
import { Npc, NPC_ASSETS, disposeNpcMaterials, type NpcAccessory } from '../entities/npc';
import { Terrain, GOLDEN_PALETTE } from '../world/terrain';
import { Path } from '../world/paths';
import { Grass } from '../world/grass';
import { rng, smoothstep } from '../world/noise';
import { scatter } from '../world/scatter';
import { updateWind } from '../world/wind';
import { PINE_STYLES, bushGeometry, instancedChunked as instanced, natureMaterial, pineGeometry, rockGeometry, tint, type Inst } from '../world/nature';
import { sparkleMarker, type Marker } from '../fx/markers';
import { playBlend, type BlendGrape } from '../ui/minigames';
import { content, fmt, type ItemId } from '../content';
import { doneFlag } from './registry';
import type { Area, AreaContext, AreaEnv, Interactable } from './types';

/**
 * Vinhedo Dourado: fileiras de videira ao pôr do sol e um galpão de pedra com o lagar. A vinicultora pede quatro cachos
 * especiais, escondidos nos corredores entre as fileiras; com eles o jogador faz a mistura no lagar (`playBlend`) e ganha
 * a garrafa do Castelo.
 */

const DUNGEON_NAMES = ['wall_arched', 'pillar_decorated', 'barrel_large', 'barrel_small', 'crates_stacked', 'candle_lit'];
export const VINEYARD_ASSETS = [...DUNGEON_NAMES.map(DUNGEON), ...NPC_ASSETS];

const T = content.vineyard;
const GRAPE_IDS = ['roxa', 'verde', 'rosada', 'dourada'] as const;
type GrapeId = (typeof GRAPE_IDS)[number];
type Axis = 'doce' | 'acido' | 'corpo';

const GRAPE_COLOR: Record<GrapeId, number> = { roxa: 0x5a2a7a, verde: 0x8ac04a, rosada: 0xe07aa0, dourada: 0xf2c640 };
/** Cesta com o cacho especial, no meio de um corredor entre duas fileiras. */
const SPOTS: Record<GrapeId, { x: number; z: number }> = {
  roxa: { x: -22, z: 6 },
  verde: { x: -14, z: -6 },
  rosada: { x: 14, z: -8 },
  dourada: { x: 22, z: 12 },
};

const START = { x: 0, z: 34 };
const HOUSE = { x: 0, z: -38 };
const PRESS = { x: -3.2, z: HOUSE.z + 0.5 };
const ROW_X = [-34, -26, -18, -10, 10, 18, 26, 34];
const ROW_Z0 = -16;
const ROW_Z1 = 22;
const CENTER = { x: 0, z: -3 };
const RADIUS = 50;

const STARTED = 'vineyard_started';
const BLENDED = 'vineyard_blended';
const grapeFlag = (id: GrapeId) => `vineyard_grape_${id}`;

const KEEPER_ACCESSORIES: NpcAccessory[] = [{ kind: 'apron', color: 0xe8e0d0 }, { kind: 'scarf', color: 0xb0402a }];

export function createVineyard(ctx: AreaContext): Area {
  const { ui, game, quality, camera, openMap } = ctx;
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const rand = rng(515);
  const high = quality.level === 'high';
  const disposables: { dispose(): void }[] = [];
  const interactables: Interactable[] = [];
  const occluders: THREE.Object3D[] = [];
  const lights: { light: THREE.PointLight; base: number }[] = [];
  const v3 = (x: number, z: number) => new THREE.Vector3(x, 0, z);

  // ---------- terreno ----------
  const trail = new Path([[0, 42], [0, 24], [0, 4], [0, -20], [0, -31]], 5, 1.2, 31);
  const distCenter = (x: number, z: number) => Math.hypot(x - CENTER.x, z - CENTER.z);
  const terrain = new Terrain({
    width: 140,
    depth: 130,
    centerX: 0,
    centerZ: -4,
    cell: high ? 2.4 : 3.0,
    hills: 1.8,
    hillScale: 36,
    seed: 23,
    paths: [trail],
    flats: [
      { x: 0, z: 2, r: 40, blend: 14, y: 0 },
      { x: HOUSE.x, z: HOUSE.z, r: 14, blend: 8, y: 0 },
      { x: START.x, z: START.z, r: 10, blend: 8, y: 0 },
    ],
    forest: (x, z) => smoothstep(RADIUS + 2, RADIUS + 14, distCenter(x, z)) * 0.85,
    palette: GOLDEN_PALETTE,
  });
  scene.add(terrain.mesh);
  disposables.push(terrain);
  const ground = terrain.heightAt;

  // ---------- clima ----------
  const env: AreaEnv = cloneEnv(SUNSET);
  const outdoor = new Outdoor(scene, quality, SUNSET.outdoor!);
  disposables.push(outdoor);
  world.addBounds(CENTER.x, CENTER.z, RADIUS);

  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = <G extends THREE.BufferGeometry>(g: G) => {
    disposables.push(g);
    return g;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rot = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.rotation.y = rot;
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  const place = (name: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
    const m = model(DUNGEON(name));
    m.position.set(x, ground(x, z) + y, z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
  };

  // ---------- fileiras de videira ----------
  const rowMidZ = (ROW_Z0 + ROW_Z1) / 2;
  const postGeo = geo(new THREE.BoxGeometry(0.14, 2, 0.14).translate(0, 1, 0));
  const wireGeo = geo(new THREE.BoxGeometry(0.04, 0.04, ROW_Z1 - ROW_Z0));
  const berryGeo = geo(new THREE.IcosahedronGeometry(0.13, 0));
  const leafGeo = geo(bushGeometry(81, 0x3f7a2a, 0xa8c84a));
  const woodMat = std(0x5a3a22);
  const wireMat = std(0x2a2a2a);
  const berryMat = std(0xffffff, { roughness: 0.5 });
  const leafMat = natureMaterial(0.03);
  disposables.push(leafMat);

  const berryColors = [0x5a2a7a, 0x7a3a8a, 0x5a2a7a, 0x8ac04a, 0xe07aa0, 0xf2c640].map((c) => new THREE.Color(c));
  const posts: Inst[] = [];
  const leaves: Inst[] = [];
  const berries: Inst[] = [];
  for (const rx of ROW_X) {
    for (let z = ROW_Z0; z <= ROW_Z1 + 0.01; z += 3) posts.push({ x: rx, y: ground(rx, z), z });
    for (const wy of [1, 1.7]) mesh(wireGeo, wireMat, rx, ground(rx, rowMidZ) + wy, rowMidZ).castShadow = false;
    for (let z = ROW_Z0; z <= ROW_Z1; z += 1.5) {
      leaves.push({ x: rx, y: ground(rx, z) - 0.05, z: z + (rand() - 0.5) * 0.4, rotY: rand() * 6.28, scale: 1.05, tall: 1.4, color: tint(rand, 0.1) });
      if (rand() < 0.7) {
        const side = rand() < 0.5 ? -1 : 1;
        berries.push({ x: rx + side * (0.45 + rand() * 0.15), y: ground(rx, z) + 0.75 + rand() * 0.4, z: z + rand() * 1.2, rotY: rand() * 6.28, scale: 0.8 + rand() * 0.6, color: berryColors[Math.floor(rand() * berryColors.length)] });
      }
    }
    world.addBox(rx - 0.75, rx + 0.75, ROW_Z0 - 0.5, ROW_Z1 + 0.5);
  }
  scene.add(instanced(postGeo, woodMat, posts));
  scene.add(instanced(leafGeo, leafMat, leaves));
  scene.add(instanced(berryGeo, berryMat, berries, { cast: false }));

  // ---------- galpão do lagar ----------
  const stone = std(0x8a7f70);
  const roofMat = std(0x7a3f2a);
  const hy = ground(HOUSE.x, HOUSE.z);
  mesh(geo(new THREE.BoxGeometry(14.4, 0.12, 8.4)), std(0x6a6258), HOUSE.x, hy + 0.06, HOUSE.z).castShadow = false;
  const wall = (w: number, d: number, x: number, z: number) => {
    const m = mesh(geo(new THREE.BoxGeometry(w, 4.2, d)), stone, x, hy + 2.1, z);
    occluders.push(m);
    world.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  };
  wall(15, 0.8, HOUSE.x, HOUSE.z - 4.2);
  wall(0.8, 8.4, HOUSE.x - 7.2, HOUSE.z);
  wall(0.8, 8.4, HOUSE.x + 7.2, HOUSE.z);
  const postBeam = geo(new THREE.BoxGeometry(0.5, 4.2, 0.5));
  const roofGeo = geo(new THREE.BoxGeometry(8.4, 0.3, 10.2));
  for (const side of [-1, 1]) {
    mesh(postBeam, woodMat, HOUSE.x + side * 7.2, hy + 2.1, HOUSE.z + 4.2);
    world.addCircle(HOUSE.x + side * 7.2, HOUSE.z + 4.2, 0.45);
    const slab = mesh(roofGeo, roofMat, HOUSE.x + side * 3.8, hy + 5.1, HOUSE.z);
    slab.rotation.z = -side * 0.42;
    occluders.push(slab);
  }

  // lagar: tina de madeira com mosto
  const tina = new THREE.Group();
  tina.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(1.3, 1.45, 1, 10, 1, true)), std(0x6a4426, { side: THREE.DoubleSide })));
  const must = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 10)), std(0x6a1f5a, { emissive: 0x2a0a24, roughness: 0.4 }));
  must.position.y = 0.32;
  tina.add(must);
  tina.position.set(PRESS.x, hy + 0.5, PRESS.z);
  tina.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  scene.add(tina);
  world.addCircle(PRESS.x, PRESS.z, 1.6);

  const props: [string, number, number, number][] = [
    ['barrel_large', HOUSE.x - 6, HOUSE.z - 2.6, 0],
    ['barrel_large', HOUSE.x + 5.6, HOUSE.z - 3, 0.5],
    ['barrel_small', HOUSE.x - 4.4, HOUSE.z - 3.2, 0.3],
    ['crates_stacked', HOUSE.x + 6, HOUSE.z + 1.6, 0.2],
  ];
  for (const [name, x, z, rot] of props) {
    place(name, x, z, rot);
    world.addCircle(x, z, 1);
  }
  place('candle_lit', PRESS.x + 1.5, PRESS.z - 1.2, 0.4);
  const houseLight = new THREE.PointLight(0xffb060, 14, 24, 2);
  houseLight.position.set(HOUSE.x, hy + 3.6, HOUSE.z + 1);
  scene.add(houseLight);
  lights.push({ light: houseLight, base: 14 });

  // portão de pedra na chegada
  place('wall_arched', START.x, START.z + 7, Math.PI, 3.2);
  for (const k of [-1, 1]) {
    place('pillar_decorated', k * 7, START.z + 7, 0, 3);
    world.addCircle(k * 7, START.z + 7, 2);
    for (const i of [1, 2]) world.addCircle(k * (2.4 + i * 3.4), START.z + 7, 2.2);
  }

  // ---------- árvores, pedras e capim fora do vinhedo ----------
  const pineGeos = (['sunny', 'green'] as const).flatMap((s, i) => [pineGeometry(90 + i * 3, PINE_STYLES[s], 5), pineGeometry(91 + i * 3, PINE_STYLES[s], 4)]);
  const rockGeo = rockGeometry(96, 0x9a948a);
  const treeMat = natureMaterial(0.012);
  const rockMat = natureMaterial(0);
  disposables.push(...pineGeos, rockGeo, treeMat, rockMat);
  const outside = (x: number, z: number) => distCenter(x, z) > RADIUS + 3 && trail.distance(x, z) > 6.5;
  const treePts = scatter(rand, { minX: -66, maxX: 66, minZ: -64, maxZ: 60, spacing: () => 4.6, accept: outside, tries: high ? 16000 : 9000, max: high ? 700 : 400 });
  const byGeo: Inst[][] = pineGeos.map(() => []);
  for (const [x, z] of treePts) {
    const far = smoothstep(RADIUS + 3, RADIUS + 18, distCenter(x, z));
    byGeo[Math.floor(rand() * pineGeos.length)].push({ x, y: ground(x, z) - 0.2, z, rotY: rand() * 6.28, scale: 1 + rand() * 0.5 + far * 0.4, tall: 0.9 + rand() * 0.4, tilt: (rand() - 0.5) * 0.06, color: tint(rand, 0.12) });
  }
  byGeo.forEach((list, i) => list.length && scene.add(instanced(pineGeos[i], treeMat, list)));
  const rockPts = scatter(rand, { minX: -66, maxX: 66, minZ: -64, maxZ: 60, spacing: () => 9, accept: outside, tries: 1500, max: 40 });
  scene.add(instanced(rockGeo, rockMat, rockPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.08, z, rotY: rand() * 6.28, scale: 0.9 + rand() * rand() * 3, tall: 0.8 + rand() * 0.5, color: tint(rand, 0.1, 0) }))));

  const grass = new Grass({
    minX: -50,
    maxX: 50,
    minZ: -50,
    maxZ: 42,
    density: quality.grassDensity * 0.6,
    range: quality.grassRange,
    height: ground,
    exclude: (x, z) => trail.distance(x, z) < 1.4 || (Math.abs(x - HOUSE.x) < 8 && Math.abs(z - HOUSE.z) < 5),
    tints: [0xc8c860, 0xa8b850, 0x8aa844],
  });
  scene.add(grass.group);
  disposables.push(grass);

  // ---------- Dona Vitória ----------
  const keeper = new Npc({
    character: 'Rogue_Hooded',
    position: v3(3.6, HOUSE.z + 0.8),
    facing: 0,
    tint: 0xd8b8a0,
    accessories: KEEPER_ACCESSORIES,
    work: { clip: 'Interact', every: 9 },
  });
  keeper.ground = ground;
  keeper.position.y = ground(keeper.position.x, keeper.position.z);
  scene.add(keeper.object);
  world.addCircle(keeper.position.x, keeper.position.z, 0.6);

  // ---------- cestas com os cachos especiais ----------
  const basketGeo = geo(new THREE.CylinderGeometry(0.5, 0.38, 0.5, 8));
  const basketMat = std(0x8a5a2e);
  const berryBig = geo(new THREE.IcosahedronGeometry(0.2, 0));
  const baskets = {} as Record<GrapeId, THREE.Group>;
  for (const id of GRAPE_IDS) {
    const { x, z } = SPOTS[id];
    const g = new THREE.Group();
    const b = new THREE.Mesh(basketGeo, basketMat);
    b.position.y = 0.25;
    b.castShadow = true;
    g.add(b);
    const mat = std(GRAPE_COLOR[id], { emissive: GRAPE_COLOR[id], emissiveIntensity: 0.35, roughness: 0.4 });
    const cluster: [number, number, number][] = [[0, 0.62, 0], [0.18, 0.55, 0.1], [-0.18, 0.55, -0.08], [0.06, 0.78, -0.12], [-0.1, 0.74, 0.14], [0.12, 0.42, -0.2]];
    for (const [dx, dy, dz] of cluster) {
      const berry = new THREE.Mesh(berryBig, mat);
      berry.position.set(dx, dy, dz);
      g.add(berry);
    }
    g.position.set(x, ground(x, z), z);
    scene.add(g);
    baskets[id] = g;
    world.addCircle(x, z, 0.55);
  }

  // ---------- marcadores de brilho ----------
  const sparkles: { sprite: Marker; base: number; show: () => boolean }[] = [];
  const sparkle = (x: number, z: number, height: number, show: () => boolean) => {
    const sprite = sparkleMarker();
    sprite.position.set(x, ground(x, z) + height, z);
    scene.add(sprite);
    sparkles.push({ sprite, base: height, show });
  };

  // ---------- estado ----------
  const started = () => game.flag(STARTED);
  const picked = (id: GrapeId) => game.flag(grapeFlag(id));
  const pickedCount = () => GRAPE_IDS.filter(picked).length;
  const allPicked = () => pickedCount() === GRAPE_IDS.length;
  const blended = () => game.flag(BLENDED);
  const isDone = () => game.flag(doneFlag('vineyard'));

  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });

  add(v3(START.x, START.z + 3.5), 4.5, T.back.prompt, () => void openMap());

  async function finish() {
    await ui.tell(T.keeper.reward, T.keeper.name);
    giveItem('garrafa');
    game.setFlag('mem_vinhedo_brinde');
    game.setFlag(doneFlag('vineyard'));
    await ui.showMemory(content.memories.vinhedo_brinde);
    await openMap();
  }

  async function talkKeeper() {
    if (isDone()) return void (await ui.tell(T.keeper.done, T.keeper.name));
    if (!started()) {
      await ui.tell(T.keeper.greet, T.keeper.name);
      game.setFlag(STARTED);
      return;
    }
    if (blended()) return void (await finish());
    await ui.tell(allPicked() ? T.keeper.ready : T.keeper.waiting, T.keeper.name);
  }
  add(keeper.position, 3.4, T.keeper.prompt, () => void talkKeeper());

  const blendGrapes: BlendGrape[] = GRAPE_IDS.map((id) => ({ id, icon: T.grapes[id].icon, name: T.grapes[id].name, doce: T.grapes[id].doce, acido: T.grapes[id].acido, corpo: T.grapes[id].corpo }));
  /** Faixa de cada barra: a média da receita de referência ± tolerância. */
  const targets = (() => {
    const ref = T.blend.solution.map((id) => T.grapes[id]);
    const band = (axis: Axis): readonly [number, number] => {
      const avg = ref.reduce((sum, g) => sum + g[axis], 0) / ref.length;
      return [avg - T.blend.tolerance, avg + T.blend.tolerance];
    };
    return { doce: band('doce'), acido: band('acido'), corpo: band('corpo') };
  })();

  async function usePress() {
    if (isDone()) return void (await ui.tell(T.press.done));
    if (!started()) return void (await ui.tell(T.press.notStarted));
    if (!allPicked()) return void (await ui.tell(T.press.notReady));
    await playBlend(ui, T.blend, blendGrapes, targets, T.blend.max);
    game.setFlag(BLENDED);
    await finish();
  }
  add(v3(PRESS.x, PRESS.z), 3.2, T.press.prompt, () => void usePress());

  async function pick(id: GrapeId) {
    game.setFlag(grapeFlag(id));
    await ui.tell([T.grapes[id].picked]);
    if (allPicked()) ui.toast(T.objective.press);
  }
  for (const id of GRAPE_IDS) {
    const { x, z } = SPOTS[id];
    add(v3(x, z), 2.6, T.grapes[id].prompt, () => void pick(id), () => started() && !picked(id));
    sparkle(x, z, 2, () => started() && !picked(id));
  }
  sparkle(PRESS.x, PRESS.z, 2.6, () => started() && allPicked() && !blended());
  sparkle(keeper.position.x, keeper.position.z, 3.4, () => !isDone() && (blended() || !started()));

  // ---------- objetivo ----------
  const objective = () => {
    if (isDone()) return T.objective.done;
    if (!started()) return T.objective.talk;
    if (blended()) return T.objective.reward;
    if (allPicked()) return T.objective.press;
    return fmt(T.objective.harvest, { n: pickedCount() });
  };
  let lastObjective = '';
  let objTimer = 0;

  return {
    name: T.areaName,
    scene,
    world,
    spawn: v3(START.x, START.z),
    spawnRot: Math.PI,
    entries: { start: { x: START.x, z: START.z, rot: Math.PI } },
    ground,
    interactables,
    occluders,
    env,
    torchLit: false,
    debug: {
      harvestAll: () => {
        game.setFlag(STARTED);
        GRAPE_IDS.forEach((id) => game.setFlag(grapeFlag(id)));
      },
      solveAll: () => {
        game.setFlag(STARTED);
        GRAPE_IDS.forEach((id) => game.setFlag(grapeFlag(id)));
        game.setFlag(BLENDED);
      },
      targets,
    },
    onEnter() {
      if (!game.flag('vineyard_seen')) {
        game.setFlag('vineyard_seen');
        ui.say(T.intro);
      }
    },
    dispose() {
      keeper.dispose();
      disposeNpcMaterials();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      updateWind(time);
      outdoor.update(playerPos, camera);
      grass.update(camera.position);
      keeper.alert = !isDone() && (!started() || blended());
      keeper.update(dt, playerPos);
      lights.forEach((l, i) => (l.light.intensity = l.base * (1 + Math.sin(time * (6 + i * 2.1)) * 0.06)));
      for (const id of GRAPE_IDS) {
        baskets[id].visible = !picked(id);
        baskets[id].rotation.y = time * 0.5;
      }

      objTimer -= dt;
      if (objTimer <= 0) {
        objTimer = 0.4;
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
