import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { GOLDEN_MORNING, Outdoor } from '../fx/atmosphere';
import { Terrain } from '../world/terrain';
import { Path } from '../world/paths';
import { Grass } from '../world/grass';
import { updateWind } from '../world/wind';
import { rng, smoothstep } from '../world/noise';
import { scatter } from '../world/scatter';
import {
  PINE_STYLES, bushGeometry, daisyGeometry, fenceLine, instancedChunked as instanced, logGeometry, lupineGeometry, natureMaterial,
  pebbleGeometry, pineGeometry, rockGeometry, roundTreeGeometry, tint, type Inst,
} from '../world/nature';
import type { Area, AreaContext } from './types';

/**
 * Cena de teste visual (?area=visual): uma trilha de terra com cerca entrando num pinheiral, em hora
 * dourada, como nos prints de referência. Serve para calibrar luz, névoa, cores e câmera sem depender da Vila.
 */

export const LOOK_TEST_ASSETS: string[] = [];

export function createLookTest(ctx: AreaContext): Area {
  const { quality, camera } = ctx;
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const disposables: { dispose(): void }[] = [];
  const rand = rng(2026);

  const WIDTH = 200;
  const DEPTH = 260;
  const WALK = 58;

  const trail = new Path([[5, 52], [0, 30], [-4, 10], [1, -12], [9, -34], [5, -58], [-6, -90], [-8, -130]], 3.4, 1.2, 3);
  const edge = (x: number, z: number) => smoothstep(WALK + 4, WALK + 40, Math.hypot(x * 0.8, z * 0.8 - 10)) * 26;
  const terrain = new Terrain({
    width: WIDTH,
    depth: DEPTH,
    centerZ: -20,
    hills: 2.4,
    hillScale: 34,
    paths: [trail],
    extra: edge,
    forest: (x, z) => smoothstep(7, 22, trail.distance(x, z)),
  });
  scene.add(terrain.mesh);
  disposables.push(terrain);
  const ground = terrain.heightAt;

  const outdoor = new Outdoor(scene, quality, GOLDEN_MORNING.outdoor!);
  disposables.push(outdoor);

  // ---------- árvores ----------
  const pineGeos = (['sunny', 'green', 'deep'] as const).flatMap((s, i) => [pineGeometry(10 + i * 3, PINE_STYLES[s], 5), pineGeometry(11 + i * 3, PINE_STYLES[s], 4)]);
  const roundGeo = roundTreeGeometry(5);
  const bushGeo = bushGeometry(6);
  const rockGeo = rockGeometry(7);
  const pineMat = natureMaterial(0.012);
  const roundMat = natureMaterial(0.01);
  const bushMat = natureMaterial(0.03);
  const rockMat = natureMaterial(0);
  disposables.push(...pineGeos, roundGeo, bushGeo, rockGeo, pineMat, roundMat, bushMat, rockMat);

  const offTrail = (x: number, z: number) => trail.distance(x, z);
  const inside = (x: number, z: number) => Math.hypot(x * 0.8, z * 0.8 - 10) < WALK + 45;

  const treePts = scatter(rand, {
    minX: -WIDTH / 2,
    maxX: WIDTH / 2,
    minZ: -DEPTH / 2 - 20,
    maxZ: DEPTH / 2 - 20,
    spacing: (x, z) => (offTrail(x, z) > 18 ? 3.4 : 5.5),
    accept: (x, z) => offTrail(x, z) > 5.2 && inside(x, z),
    tries: 9000,
    max: 1100,
  });
  const byGeo: Inst[][] = pineGeos.map(() => []);
  const rounds: Inst[] = [];
  for (const [x, z] of treePts) {
    const y = ground(x, z);
    const far = smoothstep(10, 60, offTrail(x, z));
    if (rand() < 0.07 && offTrail(x, z) < 30) {
      rounds.push({ x, y, z, rotY: rand() * 6.28, scale: 0.9 + rand() * 0.6, color: tint(rand) });
      world.addCircle(x, z, 0.55);
      continue;
    }
    const s = 0.8 + rand() * 0.5 + far * 0.5;
    byGeo[Math.floor(rand() * pineGeos.length)].push({ x, y: y - 0.2, z, rotY: rand() * 6.28, scale: s, tall: 0.9 + rand() * 0.3, tilt: (rand() - 0.5) * 0.05, color: tint(rand, 0.12) });
    if (Math.hypot(x, z - 10) < WALK + 8) world.addCircle(x, z, 0.5 * s);
  }
  byGeo.forEach((list, i) => list.length && scene.add(instanced(pineGeos[i], pineMat, list)));
  if (rounds.length) scene.add(instanced(roundGeo, roundMat, rounds));

  // arbustos, pedras, tronco
  const bushPts = scatter(rand, { minX: -WIDTH / 2, maxX: WIDTH / 2, minZ: -DEPTH / 2, maxZ: DEPTH / 2 - 20, spacing: () => 2.2, accept: (x, z) => offTrail(x, z) > 2.6 && inside(x, z), tries: 1600, max: 260 });
  scene.add(instanced(bushGeo, bushMat, bushPts.map(([x, z]) => ({ x, y: ground(x, z) - 0.05, z, rotY: rand() * 6.28, scale: 0.8 + rand() * 1.1, color: tint(rand, 0.12) })), { cast: true }));
  const rockPts = scatter(rand, { minX: -WALK, maxX: WALK, minZ: -DEPTH / 2, maxZ: 50, spacing: () => 6, accept: (x, z) => offTrail(x, z) > 2.0 && inside(x, z), tries: 900, max: 70 });
  const rocks: Inst[] = rockPts.map(([x, z]) => {
    const s = 0.7 + rand() * rand() * 2.8;
    if (Math.hypot(x, z - 10) < WALK) world.addCircle(x, z, 0.6 * s);
    return { x, y: ground(x, z) - 0.08 * s, z, rotY: rand() * 6.28, scale: s, tall: 0.8 + rand() * 0.5, color: tint(rand, 0.1, 0.02) };
  });
  scene.add(instanced(rockGeo, rockMat, rocks));

  const logGeo = logGeometry(4);
  disposables.push(logGeo);
  const logMat = natureMaterial(0);
  disposables.push(logMat);
  scene.add(instanced(logGeo, logMat, [{ x: -9, y: ground(-9, -4), z: -4, rotY: 0.5, color: tint(rand) }, { x: 13, y: ground(13, -30), z: -30, rotY: 2.2, color: tint(rand) }]));
  world.addCircle(-9, -4, 1.2);

  // ---------- trilha: pedrinhas, cerca, flores ----------
  const pebbleGeo = pebbleGeometry(2);
  const pebbleMat = natureMaterial(0);
  disposables.push(pebbleGeo, pebbleMat);
  const pebbles: Inst[] = [];
  for (let i = 0; i < 900; i++) {
    const f = rand();
    const p = trail.at(f);
    const t = trail.tangent(f);
    const off = (rand() - 0.5) * 2 * (trail.width * 0.62);
    const x = p.x - t.y * off;
    const z = p.y + t.x * off;
    pebbles.push({ x, y: ground(x, z) - 0.02, z, rotY: rand() * 6.28, scale: 0.4 + rand() * rand() * 1.8, color: tint(rand, 0.2, 0) });
  }
  scene.add(instanced(pebbleGeo, pebbleMat, pebbles, { cast: false }));

  const fencePts = (side: number, f0: number, f1: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let f = f0; f <= f1; f += 0.028) {
      const p = trail.at(f);
      const t = trail.tangent(f);
      pts.push([p.x - t.y * side, p.y + t.x * side]);
    }
    return pts;
  };
  const fenceMats: { dispose(): void }[] = [];
  for (const [side, f0, f1] of [[3.9, 0.12, 0.45], [-3.9, 0.12, 0.5]] as const) {
    const fence = fenceLine(fencePts(side, f0, f1), ground, side > 0 ? 21 : 22);
    scene.add(fence.mesh);
    fence.blockers.forEach(([x, z]) => world.addCircle(x, z, 0.3));
    fenceMats.push(fence.mesh.material as THREE.Material, fence.mesh.geometry);
  }
  disposables.push(...fenceMats);

  const lupineGeo = lupineGeometry();
  const daisyGeo = daisyGeometry();
  const flowerMat = natureMaterial(0.25);
  disposables.push(lupineGeo, daisyGeo, flowerMat);
  const blue = [0x3f55e0, 0x5a43c9, 0x7a5be0, 0x3a78e6].map((h) => new THREE.Color(h));
  const lupines: Inst[] = [];
  const daisies: Inst[] = [];
  const colors = [0xffffff, 0xffffff, 0xffe38a, 0xffb7d0].map((h) => new THREE.Color(h));
  for (let i = 0; i < 70; i++) {
    const f = 0.08 + rand() * 0.5;
    const p = trail.at(f);
    const t = trail.tangent(f);
    const side = rand() < 0.5 ? -1 : 1;
    const base = side * (5 + rand() * 7);
    const cx = p.x - t.y * base;
    const cz = p.y + t.x * base;
    const n = 4 + Math.floor(rand() * 8);
    for (let k = 0; k < n; k++) {
      const x = cx + (rand() - 0.5) * 2.4;
      const z = cz + (rand() - 0.5) * 2.4;
      if (rand() < 0.65) lupines.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.5 + rand() * 0.45, tall: 0.8 + rand() * 0.6, color: blue[Math.floor(rand() * blue.length)] });
      else daisies.push({ x, y: ground(x, z), z, rotY: rand() * 6.28, scale: 0.9 + rand() * 0.5, color: colors[Math.floor(rand() * colors.length)] });
    }
  }
  scene.add(instanced(lupineGeo, flowerMat, lupines, { cast: false }), instanced(daisyGeo, flowerMat, daisies, { cast: false }));

  // ---------- grama ----------
  const grass = new Grass({
    minX: -70,
    maxX: 70,
    minZ: -120,
    maxZ: 70,
    density: quality.grassDensity,
    range: quality.grassRange,
    height: ground,
    exclude: (x, z) => offTrail(x, z) < 0.5,
  });
  scene.add(grass.group);
  disposables.push(grass);

  // ---------- serra ao fundo (some na névoa) ----------
  const ridgeGeo = new THREE.ConeGeometry(38, 70, 6, 1);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x6f8f93, flatShading: true, roughness: 1 });
  disposables.push(ridgeGeo, ridgeMat);
  const ridge = new THREE.InstancedMesh(ridgeGeo, ridgeMat, 14);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) {
    const a = -0.9 + (i / 13) * 1.8; // leque na direção da trilha (-z)
    const r = 230 + rand() * 40;
    const s = 1 + rand() * 1.1;
    mtx.compose(new THREE.Vector3(Math.sin(a) * r + 0, 10 + s * 5 - 10, -Math.cos(a) * r - 20), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * 3), new THREE.Vector3(s, s * (0.9 + rand() * 0.5), s));
    ridge.setMatrixAt(i, mtx);
  }
  ridge.castShadow = false;
  ridge.receiveShadow = false;
  scene.add(ridge);

  world.addBounds(0, 10, WALK);
  const start = trail.at(0.07);
  const startDir = trail.tangent(0.07);

  const env = GOLDEN_MORNING;
  return {
    name: 'Teste visual',
    scene,
    world,
    spawn: new THREE.Vector3(start.x, 0, start.y),
    spawnRot: Math.atan2(startDir.x, startDir.y),
    ground,
    interactables: [],
    occluders: [],
    env,
    torchLit: false,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
    update(_dt, time, playerPos) {
      updateWind(time);
      outdoor.update(playerPos, camera);
      grass.update(camera.position);
    },
  };
}
