import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { createFlame } from '../entities/torch';
import { Npc, NPC_ASSETS, NPC_TORCH_ASSETS, disposeNpcMaterials } from '../entities/npc';
import { Sparks } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { rng } from '../world/noise';
import { content } from '../content';
import { doneFlag } from './registry';
import { DARK_ENV, ISOMETRIC, type Area, type AreaContext, type AreaEnv, type Interactable } from './types';

/**
 * Sala do Tesouro (o final): uma sala quente, cheia de ouro e de velas, com o baú dourado sobre um degrau.
 * Sequência: o Matheus tenta abrir o baú sozinho (duas fechaduras) → sente "companhia" → a Helena entra com uma tocha
 * → os dois abrem juntos → a carta aparece animada → o voucher do workshop (que dá para salvar como imagem) →
 * os dois ficam lado a lado e vem o cartão de encerramento. Todos os textos são `[EXEMPLO]` em content.ts (bloco `ending`).
 *
 * A aparência da Helena é provisória (uma aventureira do KayKit com lenço vermelho): trocar quando houver a descrição/fotos dela.
 */

const ASSET_NAMES = [
  'floor_tile_large', 'floor_tile_large_rocks', 'wall', 'wall_cracked', 'wall_broken', 'wall_doorway', 'wall_corner',
  'torch_mounted', 'candle_triple', 'candle_lit', 'banner_patternA_red', 'chest_gold', 'coin_stack_large', 'coin_stack_small',
  'barrel_small', 'crates_stacked',
];
export const ENDING_ASSETS = [...ASSET_NAMES.map(DUNGEON), ...NPC_ASSETS, ...NPC_TORCH_ASSETS];

const E = content.ending;
const HALF = 8;
const CHEST = { x: 0, z: -5.6 };
const DAIS_H = 0.35;
const START = { x: 2, z: HALF - 2.4 };
const DOOR = { x: 2, z: HALF + 0.9 };

const FLAGS = { tried: 'ending_tried', helena: 'ending_helena', open: 'ending_chest_open', done: 'ending_done' };

export function createEnding(ctx: AreaContext): Area {
  const { ui, game, player } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0604);
  const world = new CollisionWorld();
  const rand = rng(77);
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];
  const disposables: { dispose(): void }[] = [];
  const flames: ReturnType<typeof createFlame>[] = [];
  const v3 = (x: number, z: number) => new THREE.Vector3(x, 0, z);

  const put = (name: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
    const m = model(DUNGEON(name));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
  };

  // ---------- sala ----------
  for (const gx of [-6, -2, 2, 6]) {
    for (const gz of [-6, -2, 2, 6]) {
      const t = put(rand() < 0.2 ? 'floor_tile_large_rocks' : 'floor_tile_large', gx, gz, Math.floor(rand() * 4) * (Math.PI / 2));
      t.traverse((o) => (o.castShadow = false));
    }
  }
  const plain = ['wall', 'wall_cracked', 'wall', 'wall_broken'];
  const wallName = () => plain[Math.floor(rand() * plain.length)];
  for (const s of [-6, -2, 2, 6]) {
    occluders.push(put(wallName(), s, -HALF - 0.5, 0));
    occluders.push(put(s === 2 ? 'wall_doorway' : wallName(), s, HALF + 0.5, Math.PI));
    occluders.push(put(wallName(), -HALF - 0.5, s, Math.PI / 2));
    occluders.push(put(wallName(), HALF + 0.5, s, -Math.PI / 2));
  }
  put('wall_corner', -HALF - 0.5, -HALF - 0.5, 0);
  put('wall_corner', HALF + 0.5, -HALF - 0.5, -Math.PI / 2);
  put('wall_corner', HALF + 0.5, HALF + 0.5, Math.PI);
  put('wall_corner', -HALF - 0.5, HALF + 0.5, Math.PI / 2);
  world.addBox(-HALF - 2, HALF + 2, -HALF - 2, -HALF + 0.1);
  world.addBox(-HALF - 2, HALF + 2, HALF - 0.1, HALF + 2);
  world.addBox(-HALF - 2, -HALF + 0.1, -HALF - 2, HALF + 2);
  world.addBox(HALF - 0.1, HALF + 2, -HALF - 2, HALF + 2);

  // tochas nas paredes, faixas e velas
  const mountTorch = (x: number, z: number, rot: number) => {
    put('torch_mounted', x, z, rot, 1, 2.1);
    const flame = createFlame(0.55, 4);
    const tip = new THREE.Vector3(0, 0.62, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    flame.mesh.position.set(x + tip.x, 2.1 + tip.y, z + tip.z);
    scene.add(flame.mesh);
    flames.push(flame);
  };
  mountTorch(-5.5, -HALF, 0);
  mountTorch(5.5, -HALF, 0);
  mountTorch(-HALF, -2, Math.PI / 2);
  mountTorch(HALF, -2, -Math.PI / 2);
  mountTorch(-5.5, HALF, Math.PI);
  put('banner_patternA_red', -3.2, -HALF + 0.4, 0);
  put('banner_patternA_red', 3.2, -HALF + 0.4, 0);
  for (const [x, z] of [[-2.6, -4.2], [2.6, -4.2], [-6.4, -2.4], [6.4, -2.4]] as const) put('candle_triple', x, z, rand() * 6);

  // tesouro espalhado
  const piles: [string, number, number, number][] = [
    ['coin_stack_large', -6.4, -6.4, 0.4], ['coin_stack_large', 6.2, -6.6, 1.2], ['coin_stack_small', -4.6, -6.9, 2.1],
    ['coin_stack_small', 4.4, -6.8, 0.7], ['coin_stack_large', -6.6, 1.8, 2.6], ['coin_stack_small', 6.6, 2.4, 1.9],
    ['barrel_small', 6.5, 5.6, 0], ['crates_stacked', -6.2, 5.8, 0.3], ['coin_stack_small', -5.4, 4.2, 0.2],
  ];
  for (const [name, x, z, rot] of piles) {
    put(name, x, z, rot, name === 'coin_stack_large' ? 1.4 : 1.3);
    world.addCircle(x, z, 0.8);
  }

  // ---------- degrau e baú ----------
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9, flatShading: true });
  const daisGeo = new THREE.BoxGeometry(5.4, DAIS_H, 3.6);
  const dais = new THREE.Mesh(daisGeo, stoneMat);
  dais.position.set(CHEST.x, DAIS_H / 2, CHEST.z);
  dais.castShadow = dais.receiveShadow = true;
  scene.add(dais);
  disposables.push(stoneMat, daisGeo);
  world.addBox(CHEST.x - 2.7, CHEST.x + 2.7, CHEST.z - 1.8, CHEST.z + 1.0);

  const chest = put('chest_gold', CHEST.x, CHEST.z, 0, 1.9, DAIS_H);
  const lid = chest.getObjectByName('chest_gold_lid');
  const chestLight = new THREE.PointLight(0xffd070, 0, 12, 2);
  chestLight.position.set(CHEST.x, 2.0, CHEST.z + 0.4);
  scene.add(chestLight);
  const chestSparks = new Sparks(60, new THREE.Color(1.0, 0.8, 0.3));
  scene.add(chestSparks.points);
  disposables.push(chestSparks.points.geometry, chestSparks.points.material as THREE.Material);
  const beamGeo = new THREE.CylinderGeometry(0.7, 1.3, 9, 14, 1, true).translate(0, 4.5, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.4), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(CHEST.x, DAIS_H + 0.7, CHEST.z);
  scene.add(beam);
  disposables.push(beamGeo, beamMat);

  scene.add(new THREE.HemisphereLight(0x8a7a5a, 0x1a120c, 0.5));
  const centerLight = new THREE.PointLight(0xffb070, 11, 22, 2);
  centerLight.position.set(0, 3.6, 0);
  scene.add(centerLight);

  // ---------- Helena ----------
  const helena = new Npc({
    character: 'Rogue',
    position: new THREE.Vector3(DOOR.x, 0, DOOR.z + 2.5),
    facing: Math.PI,
    tint: 0xfff0f4,
    accessories: [{ kind: 'scarf', color: 0xd8334a }],
    walker: true,
    torch: true,
  });
  scene.add(helena.object);
  const HELENA_SPOT = { x: -2.4, z: -2.6 };
  const helenaHere = game.flag(FLAGS.helena);
  helena.object.visible = helenaHere;
  if (helenaHere) {
    helena.position.set(HELENA_SPOT.x, 0, HELENA_SPOT.z);
  }

  // ---------- baú: a sequência do final ----------
  let scripted = false;
  let opening = false;
  let lidT = game.flag(FLAGS.open) ? 1 : 0;
  let lidDone: (() => void) | null = null;
  const openChest = () =>
    new Promise<void>((resolve) => {
      opening = true;
      lidDone = resolve;
    });
  const finished = () => game.flag(FLAGS.done);

  const showVoucher = () => ui.showVoucher({ place: E.voucher.place, title: E.voucher.title, lines: E.voucher.lines, footer: E.voucher.footer }, E.voucher.save, E.voucher.close, E.voucher.fileName);

  const lookAt = (x: number, z: number) => player.face(Math.atan2(x - player.position.x, z - player.position.z));

  async function helenaEnters() {
    helena.object.visible = true;
    helena.lookAtPlayer = false;
    lookAt(DOOR.x, DOOR.z);
    await helena.walkTo(DOOR.x, START.z + 0.4);
    await helena.walkTo(HELENA_SPOT.x, HELENA_SPOT.z);
    helena.lookAtPlayer = true;
    game.setFlag(FLAGS.helena);
  }

  async function useChest() {
    if (finished()) {
      await showVoucher();
      return;
    }
    scripted = true;
    player.frozen = true;
    try {
      if (!game.flag(FLAGS.tried)) {
        await ui.tell(E.chest.try);
        game.setFlag(FLAGS.tried);
      }
      if (!game.flag(FLAGS.helena)) {
        await ui.tell(E.chest.company);
        await helenaEnters();
      }
      lookAt(helena.position.x, helena.position.z);
      await ui.tell(E.helena.greet, E.helena.name);
      await ui.tell(E.chest.open);
      if (!game.flag(FLAGS.open)) {
        lookAt(CHEST.x, CHEST.z);
        await openChest();
        game.setFlag(FLAGS.open);
      }
      await ui.tell(E.reveal);
      await ui.letter(E.letter.title, E.letter.paragraphs, E.letter.close);
      await showVoucher();
      game.setFlag(FLAGS.done);
      game.setFlag(doneFlag('ending'));

      // lado a lado, de frente para a câmera
      helena.lookAtPlayer = false;
      await helena.walkTo(player.position.x - 1.7, player.position.z);
      helena.face(0);
      player.face(0);
      await ui.tell(E.finale);
      await ui.showEndCard(E.endTitle, E.endText, E.endButton);
    } finally {
      helena.lookAtPlayer = true;
      player.frozen = false;
      scripted = false;
    }
  }

  const chestFront = v3(CHEST.x, CHEST.z + 2.6);
  interactables.push({
    position: chestFront,
    radius: 3.2,
    prompt: () => (finished() ? E.chest.promptDone : E.chest.prompt),
    onInteract: () => void useChest(),
    enabled: () => !scripted,
  });
  interactables.push({
    position: helena.position,
    radius: 3,
    prompt: E.helena.prompt,
    onInteract: () => void ui.tell(finished() ? E.done : E.helena.after, E.helena.name),
    enabled: () => !scripted && game.flag(FLAGS.helena),
  });

  // brilho no baú
  const sparkles: { sprite: Marker; show: () => boolean }[] = [];
  const star = sparkleMarker();
  star.position.set(CHEST.x, 2.9, CHEST.z + 0.2);
  scene.add(star);
  sparkles.push({ sprite: star, show: () => !scripted && !game.flag(FLAGS.open) });

  const objective = () => (finished() ? E.objective.done : game.flag(FLAGS.open) ? E.objective.voucher : E.objective.chest);
  let lastObjective = '';
  let objTimer = 0;
  const env: AreaEnv = { ...DARK_ENV, exposure: 1.1, bloom: { strength: 0.75, radius: 0.5, threshold: 0.85 } };

  return {
    name: E.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(START.x, 0, START.z),
    spawnRot: Math.PI,
    entries: { start: { x: START.x, z: START.z, rot: Math.PI } },
    camera: ISOMETRIC,
    interactables,
    occluders,
    env,
    torchLit: true,
    debug: { helena, openChest, setStage: (f: string) => game.setFlag(f) },
    onEnter() {
      if (!game.flag('ending_seen')) {
        game.setFlag('ending_seen');
        ui.say(E.intro);
      }
    },
    dispose() {
      helena.dispose();
      disposeNpcMaterials();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      flames.forEach((f) => f.update(dt));
      helena.update(dt, playerPos);

      // tampa do baú
      if (opening) {
        lidT = Math.min(1, lidT + dt / 1.8);
        if (lidT >= 1) {
          opening = false;
          lidDone?.();
          lidDone = null;
        }
      }
      if (lid) lid.rotation.x = -(1 - Math.pow(1 - lidT, 3)) * 1.9;
      chestLight.intensity = lidT * 14 * (1 + Math.sin(time * 4) * 0.05);
      beamMat.opacity = lidT * (0.2 + Math.sin(time * 2.2) * 0.04);
      chestSparks.update(dt, new THREE.Vector3(CHEST.x, DAIS_H + 1.0, CHEST.z), lidT > 0.5 ? 26 : 0);
      centerLight.intensity = 11 * (1 + Math.sin(time * 6.3) * 0.04);

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
          s.sprite.position.y = 2.9 + Math.sin(time * 2.4) * 0.12;
          s.sprite.setSize(0.9 + Math.sin(time * 5) * 0.12);
        }
      }
    },
  };
}
