import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { createFlame } from '../entities/torch';
import { Npc, NPC_ASSETS, disposeNpcMaterials, type NpcAccessory, type NpcCharacter } from '../entities/npc';
import { Sparks } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { rng } from '../world/noise';
import { playPlating, type PlatingIngredient } from '../ui/minigames';
import { content, fmt, type ItemId } from '../content';
import { doneFlag } from './registry';
import { DARK_ENV, ISOMETRIC, type Area, type AreaContext, type AreaEnv, type Interactable } from './types';

/**
 * Taverna do Zé: um salão aquecido por lareira com três clientes famintos. Cada cliente faz um pedido;
 * o jogador monta o prato no balcão arrastando ingredientes (`playPlating`). Servidos os três, o Zé entrega
 * a terceira chave do Castelo. Ovos, pão e farinha da Vila são bônus opcionais: gastá-los rende moedas extras.
 */

const FLOOR_ASSETS = [
  'floor_tile_large', 'floor_tile_large_rocks', 'wall', 'wall_cracked', 'wall_broken', 'wall_arched', 'wall_doorway', 'wall_corner',
  'torch_mounted', 'candle_triple', 'candle_lit', 'barrel_small', 'barrel_large', 'crates_stacked', 'box_large',
];
export const TAVERN_ASSETS = [...FLOOR_ASSETS.map(DUNGEON), ...NPC_ASSETS];

const T = content.tavern;
/** Meia largura (x) e meia profundidade (z) do piso. */
const HX = 10;
const HZ = 8;
const ORDERS = T.orders.length;

const orderFlag = (n: number) => `tavern_order_${n}`;
const STARTED = 'tavern_started';

/** Ingrediente-bônus -> item da Vila que ele gasta. */
const BONUS_ITEM: Record<string, ItemId> = { ovo: 'ovos', pao_quente: 'pao', farinha: 'farinha' };
type IngredientId = keyof typeof T.ingredients;

interface Look {
  character: NpcCharacter;
  tint: number;
  accessories: NpcAccessory[];
}
const COOK: Look = { character: 'Barbarian', tint: 0xe8d4b8, accessories: [{ kind: 'apron', color: 0xe8e0d0 }, { kind: 'cap', color: 0xf2ece0 }] };
const CLIENTS: (Look & { x: number; z: number; facing: number })[] = [
  { character: 'Rogue_Hooded', tint: 0xd8b8a0, accessories: [{ kind: 'scarf', color: 0x9a3a4a }], x: -6, z: 2.4, facing: Math.PI },
  { character: 'Rogue', tint: 0xa8c8d8, accessories: [{ kind: 'cap', color: 0x3a5a7a }], x: 6, z: 2.4, facing: Math.PI },
  { character: 'Mage', tint: 0xc8d8a0, accessories: [{ kind: 'scarf', color: 0x5a7a3a }], x: 3.2, z: -1.2, facing: 0 },
];
const TABLES = [
  { x: -6, z: 0.9 },
  { x: 6, z: 0.9 },
  { x: 3.2, z: 1.2 },
];

export function createTavern(ctx: AreaContext): Area {
  const { ui, game, openMap } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(new THREE.HemisphereLight(0x9a8a7a, 0x2a1a10, 0.55));
  const world = new CollisionWorld();
  const rand = rng(31);
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];
  const disposables: { dispose(): void }[] = [];
  const flames: ReturnType<typeof createFlame>[] = [];
  const lights: { light: THREE.PointLight; base: number }[] = [];
  const anims: ((dt: number, time: number) => void)[] = [];
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
  const put = (name: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
    const m = model(DUNGEON(name));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.scale.setScalar(scale);
    scene.add(m);
    return m;
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
  const light = (color: number, intensity: number, distance: number, x: number, y: number, z: number) => {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    scene.add(l);
    lights.push({ light: l, base: intensity });
    return l;
  };

  // ---------- estado ----------
  const served = (n: number) => game.flag(orderFlag(n));
  const servedCount = () => T.orders.filter((_, n) => served(n)).length;
  const allServed = () => servedCount() === ORDERS;
  const isDone = () => game.flag(doneFlag('tavern'));
  /** Pedido em andamento (só vive na cena: ao voltar, o jogador conversa de novo com o cliente). */
  let active: number | null = null;

  // ---------- salão ----------
  for (let gx = -HX + 2; gx < HX; gx += 4) {
    for (let gz = -HZ + 2; gz < HZ; gz += 4) {
      const t = put(rand() < 0.2 ? 'floor_tile_large_rocks' : 'floor_tile_large', gx, gz, Math.floor(rand() * 4) * (Math.PI / 2));
      t.traverse((o) => (o.castShadow = false));
    }
  }

  const plain = ['wall', 'wall_cracked', 'wall', 'wall_arched', 'wall_broken'];
  const wallName = () => plain[Math.floor(rand() * plain.length)];
  for (let x = -HX + 2; x < HX; x += 4) {
    occluders.push(put(wallName(), x, -HZ - 0.5, 0));
    occluders.push(put(x === 0 ? 'wall_doorway' : wallName(), x, HZ + 0.5, Math.PI));
  }
  for (let z = -HZ + 2; z < HZ; z += 4) {
    occluders.push(put(wallName(), -HX - 0.5, z, Math.PI / 2));
    occluders.push(put(wallName(), HX + 0.5, z, -Math.PI / 2));
  }
  put('wall_corner', -HX - 0.5, -HZ - 0.5, 0);
  put('wall_corner', HX + 0.5, -HZ - 0.5, -Math.PI / 2);
  put('wall_corner', HX + 0.5, HZ + 0.5, Math.PI);
  put('wall_corner', -HX - 0.5, HZ + 0.5, Math.PI / 2);
  world.addBox(-HX - 2, HX + 2, -HZ - 2, -HZ + 0.1);
  world.addBox(-HX - 2, HX + 2, HZ - 0.1, HZ + 2);
  world.addBox(-HX - 2, -HX + 0.1, -HZ - 2, HZ + 2);
  world.addBox(HX - 0.1, HX + 2, -HZ - 2, HZ + 2);

  const mountTorch = (x: number, z: number, rot: number) => {
    put('torch_mounted', x, z, rot, 1, 2.1);
    const flame = createFlame(0.55, 4);
    const tip = new THREE.Vector3(0, 0.62, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    flame.mesh.position.set(x + tip.x, 2.1 + tip.y, z + tip.z);
    scene.add(flame.mesh);
    flames.push(flame);
  };
  mountTorch(-4, -HZ, 0);
  mountTorch(8, -HZ, 0);
  mountTorch(-4, HZ, Math.PI);
  mountTorch(6, HZ, Math.PI);
  mountTorch(HX, -1, -Math.PI / 2);
  light(0xffb070, 12, 24, 0, 3.8, 0);

  // lareira no canto do fundo, à esquerda
  const stone = std(0x6a625a);
  mesh(geo(new THREE.BoxGeometry(3.4, 2.4, 1.2)), stone, -7.4, 1.2, -HZ + 0.7);
  mesh(geo(new THREE.BoxGeometry(2, 1.3, 0.3)), std(0x120a06), -7.4, 0.75, -HZ + 1.3).castShadow = false;
  world.addBox(-9.2, -5.6, -HZ, -HZ + 1.5);
  const fire = createFlame(1.3, 5);
  fire.mesh.position.set(-7.4, 0.9, -HZ + 1.25);
  scene.add(fire.mesh);
  flames.push(fire);
  const fireLight = light(0xff8a40, 10, 14, -7.4, 1.6, -HZ + 2.2);
  const embers = new Sparks(24, new THREE.Color(1.0, 0.55, 0.2));
  scene.add(embers.points);
  disposables.push(embers.points.geometry, embers.points.material as THREE.Material);
  const emberAt = new THREE.Vector3(-7.4, 1.2, -HZ + 1.3);
  anims.push((dt) => embers.update(dt, emberAt, 10));
  void fireLight;

  // balcão (x de -5 a 5, ao norte) e o fogão do Zé
  const wood = std(0x5a3a22);
  const woodTop = std(0x7a5232);
  mesh(geo(new THREE.BoxGeometry(10, 1.05, 1.4)), wood, 0, 0.52, -5.6);
  mesh(geo(new THREE.BoxGeometry(10.4, 0.1, 1.7)), woodTop, 0, 1.08, -5.6);
  world.addBox(-5.2, 5.2, -6.4, -4.8);
  mesh(geo(new THREE.BoxGeometry(2, 1.2, 1.1)), std(0x2a2a30), 3.6, 0.6, -7.2);
  world.addBox(2.5, 4.7, -8, -6.6);
  put('candle_triple', -3.6, -5.6, 0.3, 1, 1.12);
  put('candle_lit', 4.2, -5.6, 0.1, 1, 1.12);

  // prateleira de ingredientes na parede do fundo
  const plankGeo = geo(new THREE.BoxGeometry(5.4, 0.1, 0.6));
  const jarGeo = geo(new THREE.CylinderGeometry(0.17, 0.2, 0.42, 8));
  const jarColors = [0xc84a3a, 0xe0b84a, 0x6a9a4a, 0xd8d0b0, 0x8a5a3a, 0xd87a2a].map((c) => new THREE.Color(c));
  const jars = new THREE.InstancedMesh(jarGeo, std(0xffffff), 2 * 9);
  const jm = new THREE.Matrix4();
  let ji = 0;
  for (const y of [1.6, 2.5]) {
    mesh(plankGeo, wood, -0.5, y - 0.2, -HZ + 0.4);
    for (let b = 0; b < 9; b++) {
      jm.makeTranslation(-0.5 - 2.4 + b * 0.6, y, -HZ + 0.4);
      jars.setMatrixAt(ji, jm);
      jars.setColorAt(ji, jarColors[Math.floor(rand() * jarColors.length)]);
      ji++;
    }
  }
  jars.castShadow = true;
  scene.add(jars);
  disposables.push(jars);

  // mesas, bancos e velas
  const tableGeo = geo(new THREE.BoxGeometry(2.4, 0.12, 1.3));
  const legGeo = geo(new THREE.BoxGeometry(0.14, 0.85, 0.14));
  const stoolGeo = geo(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 8));
  for (const t of TABLES) {
    mesh(tableGeo, woodTop, t.x, 0.9, t.z);
    for (const [dx, dz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) mesh(legGeo, wood, t.x + dx, 0.43, t.z + dz);
    put('candle_lit', t.x, t.z, rand() * 3, 1, 0.96);
    for (const dx of [-0.7, 0.7]) mesh(stoolGeo, wood, t.x + dx, 0.25, t.z - 1.3);
    world.addBox(t.x - 1.3, t.x + 1.3, t.z - 0.7, t.z + 0.7);
  }

  // barris e caixas
  put('barrel_large', 8.4, -6.2);
  put('barrel_small', 8.8, -4.6, 0.6);
  world.addBox(7.6, 9.4, -7.2, -3.8);
  put('crates_stacked', -8.4, 5.4, 0.3);
  world.addBox(-9.4, -7.4, 4.4, 6.4);
  put('box_large', 8.4, 5.8, 0.2);
  world.addBox(7.4, 9.4, 4.8, 6.8);

  // ---------- personagens ----------
  const makeNpc = (look: Look, x: number, z: number, facing: number, work = true) => {
    const npc = new Npc({
      character: look.character,
      position: new THREE.Vector3(x, 0, z),
      facing,
      tint: look.tint,
      accessories: look.accessories,
      work: work ? { clip: 'Interact', every: 9 } : undefined,
    });
    npc.position.y = 0;
    scene.add(npc.object);
    world.addCircle(x, z, 0.6);
    return npc;
  };
  const cook = makeNpc(COOK, 1.4, -7.1, 0);
  const clients = CLIENTS.map((c) => makeNpc(c, c.x, c.z, c.facing, false));

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });
  const started = () => game.flag(STARTED);

  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  add(v3(0, HZ - 1.6), 2.8, T.back.prompt, () => void openMap());

  async function talkCook() {
    if (isDone()) return void (await ui.tell(T.cook.done, T.cook.name));
    if (!started()) {
      await ui.tell(T.cook.greet, T.cook.name);
      game.setFlag(STARTED);
      return;
    }
    if (!allServed()) return void (await ui.tell(T.cook.waiting, T.cook.name));
    await ui.tell(T.cook.reward, T.cook.name);
    giveItem('chave_cobre');
    game.setFlag('mem_taverna_jantar');
    game.setFlag(doneFlag('tavern'));
    await ui.showMemory(content.memories.taverna_jantar);
    await openMap();
  }
  add(cook.position, 3.4, T.cook.prompt, () => void talkCook());

  async function talkClient(n: number) {
    const o = T.orders[n];
    if (served(n)) return void (await ui.tell(o.done, o.name));
    if (active === n) return void (await ui.tell(o.waiting, o.name));
    await ui.tell(o.request, o.name);
    active = n;
  }
  clients.forEach((c, n) => add(c.position, 2.6, T.orders[n].prompt, () => void talkClient(n), started));

  /** Ingredientes na prateleira: os de sempre, mais os bônus que o jogador trouxe da Vila. */
  function shelfIngredients(): PlatingIngredient[] {
    return (Object.keys(T.ingredients) as IngredientId[])
      .filter((id) => !(id in BONUS_ITEM) || game.has(BONUS_ITEM[id]))
      .map((id) => ({ id, icon: T.ingredients[id].icon, name: T.ingredients[id].name }));
  }

  async function plate() {
    if (active === null) {
      await ui.tell(allServed() ? T.counter.allServed : T.counter.noOrder);
      return;
    }
    const n = active;
    const o = T.orders[n];
    const recipe: readonly string[] = o.recipe;
    const P = T.plating;
    const result = await playPlating(
      ui,
      { title: P.title, hint: P.hint, empty: P.empty, serve: P.serve, clear: P.clear, missing: P.missing, extra: P.extra, emptyPlate: P.empty_plate },
      shelfIngredients(),
      (ids) => {
        if (ids.some((id) => !recipe.includes(id) && id !== o.loves)) return 'extra';
        return recipe.every((id) => ids.includes(id)) ? 'ok' : 'missing';
      },
    );
    const bonus = result.includes(o.loves);
    if (bonus) game.removeItem(BONUS_ITEM[o.loves]);
    game.setFlag(orderFlag(n));
    active = null;
    await ui.tell(bonus ? [...o.thanks, ...o.bonusThanks] : o.thanks, o.name);
    const coins = o.coins + (bonus ? o.bonusCoins : 0);
    game.addCoins(coins);
    ui.toast(fmt(content.ui.gotCoins, { n: coins }));
    if (allServed()) ui.toast(T.objective.reward);
  }
  add(v3(-2.5, -4.1), 2.4, T.counter.prompt, () => void plate(), started);

  const sparkles: { sprite: Marker; show: () => boolean }[] = [];
  const sparkle = (x: number, y: number, z: number, show: () => boolean) => {
    const sprite = sparkleMarker();
    sprite.position.set(x, y, z);
    scene.add(sprite);
    sparkles.push({ sprite, show });
  };
  sparkle(-2.5, 2.2, -5.6, () => started() && active !== null);
  sparkle(cook.position.x, 3.4, cook.position.z, () => started() && allServed() && !isDone());

  // ---------- objetivo ----------
  const objective = () => {
    if (isDone()) return T.objective.done;
    if (!started()) return T.objective.talkCook;
    if (allServed()) return T.objective.reward;
    if (active !== null) return fmt(T.objective.plate, { name: T.orders[active].name });
    return fmt(T.objective.takeOrder, { n: servedCount() });
  };
  let lastObjective = '';
  let objTimer = 0;

  const env: AreaEnv = { ...DARK_ENV, exposure: 1.1, vignette: 1.0, bloom: { strength: 0.6, radius: 0.5, threshold: 1.0 } };

  return {
    name: T.areaName,
    scene,
    world,
    spawn: v3(0, HZ - 3),
    spawnRot: Math.PI,
    entries: { start: { x: 0, z: HZ - 3, rot: Math.PI } },
    camera: ISOMETRIC,
    interactables,
    occluders,
    env,
    torchLit: false,
    debug: {
      solveAll: () => {
        game.setFlag(STARTED);
        for (let n = 0; n < ORDERS; n++) game.setFlag(orderFlag(n));
      },
      orders: T.orders,
    },
    onEnter() {
      if (!game.flag('tavern_seen')) {
        game.setFlag('tavern_seen');
        ui.say(T.intro);
      }
    },
    dispose() {
      cook.dispose();
      clients.forEach((c) => c.dispose());
      disposeNpcMaterials();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      cook.alert = !started() || (allServed() && !isDone());
      cook.update(dt, playerPos);
      clients.forEach((c, n) => {
        c.alert = started() && !served(n) && active !== n;
        c.update(dt, playerPos);
      });
      anims.forEach((a) => a(dt, time));
      flames.forEach((f) => f.update(dt));
      lights.forEach((l, i) => (l.light.intensity = l.base * (1 + Math.sin(time * (7 + i * 2.3)) * 0.06)));

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
        if (on) s.sprite.setSize(0.9 + Math.sin(time * 5) * 0.12);
      }
    },
  };
}
