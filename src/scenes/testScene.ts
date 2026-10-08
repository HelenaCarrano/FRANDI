import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { Dust } from '../fx/particles';
import { createFlame } from '../entities/torch';
import { content } from '../content';
import type { Area, Interactable } from './types';

/**
 * Cena de teste: salão de pedra montado com o KayKit Dungeon Remastered (CC0),
 * quase totalmente escuro. Serve para calibrar luz, sombras, controles e câmera.
 */

export const TEST_SCENE_ASSETS = [
  'floor_tile_large',
  'floor_tile_large_rocks',
  'floor_tile_small',
  'floor_tile_small_broken_A',
  'floor_tile_small_broken_B',
  'floor_tile_small_decorated',
  'floor_tile_small_weeds_A',
  'wall',
  'wall_cracked',
  'wall_broken',
  'wall_arched',
  'wall_corner',
  'wall_doorway',
  'wall_pillar',
  'pillar',
  'pillar_decorated',
  'column',
  'rubble_large',
  'rubble_half',
  'torch',
  'torch_mounted',
  'banner_patternA_red',
  'banner_thin_red',
  'chest_gold',
  'candle_triple',
  'candle_lit',
  'candle_melted',
  'coin_stack_large',
  'coin_stack_small',
  'barrel_large',
  'barrel_small',
  'crates_stacked',
  'box_large',
].map(DUNGEON);

const CYAN = new THREE.Color(0x4fd8ff);
const FIRE = new THREE.Color(1.0, 0.55, 0.22);

// Salão: chão de x -12..12, z -16..16 (grade de 4 m do KayKit).
const ROOM = { minX: -12, maxX: 12, minZ: -16, maxZ: 16 };

interface Options {
  dustCount: number;
  say: (lines: readonly string[]) => void;
}

function rand(seed: number) {
  // pseudo-aleatório determinístico para o cenário ficar sempre igual
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function createTestScene(opts: Options): Area {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const world = new CollisionWorld();
  const occluders: THREE.Object3D[] = [];
  let seed = 3;

  const place = (name: string, x: number, z: number, rotY = 0, y = 0, scale = 1) => {
    const m = model(DUNGEON(name));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
  };

  // Luz ambiente muito baixa: só o suficiente para insinuar silhuetas.
  scene.add(new THREE.HemisphereLight(0x50607a, 0x140e0a, 0.14));

  // ---------- chão ----------
  for (let x = ROOM.minX + 2; x < ROOM.maxX; x += 4) {
    for (let z = ROOM.minZ + 2; z < ROOM.maxZ; z += 4) {
      const r = rand(seed++);
      const rot = Math.floor(rand(seed++) * 4) * (Math.PI / 2);
      if (r < 0.18) {
        // quatro lajes pequenas, algumas quebradas
        const smalls = ['floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A', 'floor_tile_small_decorated'];
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          place(smalls[Math.floor(rand(seed++) * smalls.length)], x + dx, z + dz, rot);
        }
      } else {
        place('floor_tile_large', x, z, rot);
      }
    }
  }
  scene.traverse((o) => {
    // o chão só recebe sombra (economiza o mapa de sombras da tocha)
    if ((o as THREE.Mesh).isMesh) o.castShadow = false;
  });

  // ---------- paredes (fundo e lado esquerdo; os lados perto da câmera ficam abertos) ----------
  const backWall = ['wall', 'wall_cracked', 'wall_arched', 'wall_doorway', 'wall_arched', 'wall_broken'];
  backWall.forEach((name, i) => {
    const w = place(name, ROOM.minX + 2 + i * 4, ROOM.minZ - 0.5);
    occluders.push(w);
  });
  const leftWall = ['wall', 'wall_pillar', 'wall_cracked', 'wall', 'wall_arched', 'wall_broken', 'wall_pillar', 'wall'];
  leftWall.forEach((name, i) => {
    const w = place(name, ROOM.minX - 0.5, ROOM.minZ + 2 + i * 4, Math.PI / 2);
    occluders.push(w);
  });
  place('wall_corner', ROOM.minX - 0.5, ROOM.minZ - 0.5, 0);

  world.addBox(-100, 100, -100, ROOM.minZ); // fundo
  world.addBox(-100, ROOM.minX, -100, 100); // esquerda
  world.addBox(ROOM.maxX + 0.3, 100, -100, 100); // direita (aberta, escuridão)
  world.addBox(-100, 100, ROOM.maxZ + 0.3, 100); // frente (aberta, escuridão)

  // estandartes vermelhos na parede do fundo
  for (const x of [ROOM.minX + 2, ROOM.minX + 18]) place('banner_patternA_red', x, ROOM.minZ - 0.5);
  place('banner_thin_red', ROOM.minX - 0.5, -2, Math.PI / 2);

  // ---------- pilares ----------
  const pillars: [string, number, number][] = [
    ['pillar', -5, -10],
    ['pillar_decorated', 5, -10],
    ['pillar', -5, -3],
    ['pillar', 5, -3],
    ['pillar_decorated', -5, 4],
    ['column', 5, 4], // quebrado
    ['pillar', -5, 11],
    ['pillar', 5, 11],
  ];
  for (const [name, x, z] of pillars) {
    const p = place(name, x, z);
    occluders.push(p);
    world.addCircle(x, z, name === 'column' ? 0.5 : 0.85);
  }
  // entulho do pilar quebrado e um desabamento no canto
  place('rubble_half', 5.6, 5.2, -0.6, 0, 0.55);
  world.addCircle(6.6, 5.6, 1.1);
  const bigRubble = place('rubble_large', ROOM.minX + 3.2, 13.5, Math.PI / 2 + 0.3, 0, 0.8);
  occluders.push(bigRubble);
  world.addBox(ROOM.minX, ROOM.minX + 4.8, 10.6, 16.5);

  // ---------- tochas de parede (luz de apoio laranja) ----------
  const wallFlames: { light: THREE.PointLight; flame: ReturnType<typeof createFlame>; base: number }[] = [];
  const mountTorch = (x: number, z: number, rotY: number) => {
    const t = place('torch_mounted', x, z, rotY, 2.1);
    const flame = createFlame(0.55, 4);
    const tip = new THREE.Vector3(0, 0.62, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    flame.mesh.position.set(x + tip.x, 2.1 + tip.y, z + tip.z);
    scene.add(flame.mesh);
    const light = new THREE.PointLight(FIRE, 7, 9, 2);
    const out = new THREE.Vector3(0, 0, 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    light.position.set(x + out.x, 3.0, z + out.z);
    scene.add(light);
    wallFlames.push({ light, flame, base: rand(seed++) * 10 });
    return t;
  };
  mountTorch(-2, ROOM.minZ, 0);
  mountTorch(6, ROOM.minZ, 0);

  // ---------- altar com cristal (luz de apoio ciano) ----------
  const altarPos = new THREE.Vector3(-9, 0, -3);
  place('column', altarPos.x, altarPos.z, 0.4);
  world.addCircle(altarPos.x, altarPos.z, 0.6);
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({
      color: 0x163a4a,
      emissive: CYAN,
      emissiveIntensity: 2.4,
      roughness: 0.25,
      flatShading: true,
    }),
  );
  crystal.scale.set(0.8, 1.5, 0.8);
  crystal.position.set(altarPos.x, 2.0, altarPos.z);
  scene.add(crystal);
  const crystalLight = new THREE.PointLight(CYAN, 7, 9, 2);
  crystalLight.position.set(altarPos.x, 2.1, altarPos.z);
  scene.add(crystalLight);

  // ---------- tesouro: baú dourado com velas e moedas (prévia do final) ----------
  const chestPos = new THREE.Vector3(0, 0, -11.5);
  const chest = place('chest_gold', chestPos.x, chestPos.z);
  world.addBox(chestPos.x - 0.95, chestPos.x + 0.95, chestPos.z - 0.8, chestPos.z + 0.8);
  place('candle_triple', -1.6, -12.4, 0.5);
  place('candle_lit', 1.5, -12.6);
  place('candle_melted', 1.9, -11.2, 1.2);
  place('coin_stack_large', -1.9, -10.8, 0.3, 0, 0.7);
  place('coin_stack_small', 1.3, -10.4, 1.1);
  const candleGlow = new THREE.PointLight(FIRE, 2.5, 5, 2);
  candleGlow.position.set(0, 1.2, -12);
  scene.add(candleGlow);
  void chest;

  // ---------- barris e caixas pelos cantos ----------
  place('barrel_large', 9.6, -13.6);
  place('barrel_small', 10.6, -11.8, 0.6);
  place('crates_stacked', -9.8, 6.2, 0.3);
  place('box_large', 9.8, 7.5, 0.2);
  world.addCircle(9.6, -13.6, 1.0);
  world.addCircle(10.6, -11.8, 0.6);
  world.addBox(-11.2, -8.4, 4.9, 7.5);
  world.addBox(8.9, 10.7, 6.6, 8.4);

  // ---------- poeira ----------
  const dust = new Dust(opts.dustCount, new THREE.Box3(new THREE.Vector3(-12, 0.2, -16), new THREE.Vector3(12, 3.5, 16)));
  scene.add(dust.points);
  const dustLight = new THREE.Vector3();

  // ---------- interações ----------
  const interactables: Interactable[] = [
    {
      position: altarPos,
      radius: 2.0,
      prompt: content.testScene.crystal.prompt,
      onInteract: () => opts.say(content.testScene.crystal.lines),
    },
    {
      position: chestPos,
      radius: 2.4,
      prompt: content.testScene.chest.prompt,
      onInteract: () => opts.say(content.testScene.chest.lines),
    },
  ];

  return {
    name: content.testScene.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(0, 0, 8),
    interactables,
    occluders,
    update(dt, time, playerPos) {
      crystal.rotation.y = time * 0.6;
      crystal.position.y = 2.0 + Math.sin(time * 1.5) * 0.08;
      const pulse = 0.85 + Math.sin(time * 2.0) * 0.15;
      crystalLight.intensity = 7 * pulse;
      (crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.4 * pulse;

      for (const w of wallFlames) {
        const n = Math.sin(time * 8.3 + w.base) * 0.5 + Math.sin(time * 13.1 + w.base * 2) * 0.5;
        w.light.intensity = 7 * (1 + n * 0.15);
        w.flame.update(dt);
      }
      candleGlow.intensity = 2.5 * (1 + Math.sin(time * 11 + 1.7) * 0.08);

      dustLight.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
      dust.update(time, dustLight);
    },
  };
}
