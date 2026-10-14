import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { CHARACTER, gltf, model } from '../core/assets';
import { Smoke } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { createFlame } from '../entities/torch';
import { Npc, NPC_ASSETS } from '../entities/npc';
import { makeCat } from '../entities/cat';
import { content, fmt, type ItemId } from '../content';
import type { Area, AreaContext, Interactable } from './types';
import { DAY_ENV, skyTexture } from './hexKit';

/**
 * Vila do Amanhecer: diorama de peças hexagonais do KayKit Medieval Hexagon Pack (CC0),
 * em manhã dourada, com praça central, três NPCs, três missões, loja e o portão de saída.
 */

const NAMES = [
  'hex_grass', 'hex_road_L', 'hex_road_M',
  'building_blacksmith_red', 'building_home_A_red', 'building_home_B_red', 'building_market_red',
  'building_tavern_red', 'building_well_red', 'building_windmill_red', 'building_grain',
  'wall_straight_gate', 'wall_straight', 'fence_wood_straight',
  'tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium',
  'trees_A_small', 'trees_B_small', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D',
  'cloud_big', 'cloud_small',
  'barrel', 'bucket_water', 'bucket_empty', 'crate_A_big', 'crate_A_small', 'crate_B_big', 'crate_open',
  'flag_red', 'sack', 'wheelbarrow', 'resource_lumber', 'resource_stone', 'weaponrack', 'pallet', 'ladder',
];
export const VILLAGE_ASSETS = [...NAMES.map((n) => `village/${n}`), ...NPC_ASSETS];

const V = (n: string) => `village/${n}`;

/** Escala do cenário: um hexágono tem 2 m na peça original e 6 m no jogo. */
const S = 3;
/** Escala dos adereços (barris, caixas): maiores que o cenário para dar para ver no celular. */
const PROP = 4.2;
const H = Math.sqrt(3);
const BOUNDS_R = 14;

const MATERIALS: ItemId[] = ['ferro', 'carvao', 'couro'];
const MAIL_HOUSES = ['rosa', 'antonio', 'ze'] as const;
const MAP_PRICE = content.village.shop.find((s) => s.id === 'mapa')!.price;

export function createVillage(ctx: AreaContext): Area {
  const { ui, game, player, quality, goTo } = ctx;
  const T = content.village;
  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  const world = new CollisionWorld();
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];

  // ---------- luz: sol dourado baixo + céu ----------
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xd9b98a, 1.25));
  const sun = new THREE.DirectionalLight(0xffd9a0, 3.1);
  const SUN_OFFSET = new THREE.Vector3(-9, 10, -4);
  const SHADOW_SPAN = 13;
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -SHADOW_SPAN;
  cam.right = cam.top = SHADOW_SPAN;
  cam.near = 1;
  cam.far = 45;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const texel = (SHADOW_SPAN * 2) / quality.shadowMapSize;

  // ---------- ajudantes ----------
  const hex = (q: number, r: number) => new THREE.Vector3(S * (2 * q + r), 0, S * H * r);
  const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);

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
  const footprint = (name: string, x: number, z: number, rotY: number, scale: number, shrink = 0.9) => {
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
      world.addCircle(x + lx * cos + lz * sin, z - lx * sin + lz * cos, r);
    }
  };

  /** Constrói um prédio já com colisão; `occlude` esmaece quando tapa o Matheus. */
  const building = (name: string, x: number, z: number, rotY: number, occlude = true) => {
    const m = place(name, x, z, rotY);
    footprint(name, x, z, rotY, S);
    if (occlude) occluders.push(m);
    return m;
  };

  /** Ponto na frente de uma peça (a porta olha para +Z local). */
  const front = (x: number, z: number, rotY: number, dist: number, side = 0) =>
    new THREE.Vector3(x + Math.sin(rotY) * dist + Math.cos(rotY) * side, 0, z + Math.cos(rotY) * dist - Math.sin(rotY) * side);

  // ---------- chão: praça de estrada no centro, grama no resto ----------
  const ring = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      const d = ring(q, r);
      if (d > 3) continue;
      const p = hex(q, r);
      if (q === 2 && r === -1) continue; // vira plantação de trigo
      if (d === 0) place('hex_road_L', p.x, p.z, 0, S, 0, false);
      else if (d === 1) place('hex_road_M', p.x, p.z, Math.atan2(-p.z, p.x), S, 0, false);
      else place('hex_grass', p.x, p.z, 0, S, 0, false);
    }
  }
  const wheat = hex(2, -1);
  place('building_grain', wheat.x, wheat.z, 0, S, 0, false);

  // ---------- poço no centro ----------
  const well = place('building_well_red', 0, 0, 0);
  world.addCircle(0, 0, 1.15);
  occluders.push(well);

  // ---------- prédios ao redor da praça (porta virada para o centro) ----------
  const smithPos = hex(0, -1).multiplyScalar(1.13);
  const smithRot = faceCenter(smithPos.x, smithPos.z);
  const smithHouse = building('building_blacksmith_red', smithPos.x, smithPos.z, smithRot);

  const rosaPos = hex(-1, 0).multiplyScalar(1.13);
  const rosaRot = faceCenter(rosaPos.x, rosaPos.z);
  const rosaHouse = building('building_home_A_red', rosaPos.x, rosaPos.z, rosaRot);

  const antPos = hex(-1, 1).multiplyScalar(1.13);
  const antRot = faceCenter(antPos.x, antPos.z);
  const antHouse = building('building_home_B_red', antPos.x, antPos.z, antRot);

  const zePos = hex(1, -1).multiplyScalar(1.13);
  const zeRot = faceCenter(zePos.x, zePos.z);
  const zeHouse = building('building_tavern_red', zePos.x, zePos.z, zeRot);

  const marketPos = hex(1, 0).multiplyScalar(1.13);
  const marketRot = faceCenter(marketPos.x, marketPos.z);
  building('building_market_red', marketPos.x, marketPos.z, marketRot);

  const mill = hex(1, -2);
  const windmill = building('building_windmill_red', mill.x, mill.z, 0);
  const fan = windmill.getObjectByName('building_windmill_top_fan_red');

  // ---------- adereços da praça ----------
  const prop = (name: string, x: number, z: number, rot = 0, scale = PROP, blocks = 0) => {
    const m = place(name, x, z, rot, scale);
    if (blocks > 0) world.addCircle(x, z, blocks);
    return m;
  };
  // perto da ferraria: tralhas (aqui fica o ferro)
  const ferroPos = front(smithPos.x, smithPos.z, smithRot, 0.5, -3.6);
  prop('crate_open', ferroPos.x, ferroPos.z, 0.4, PROP, 0.6);
  prop('crate_A_big', ferroPos.x - 1.0, ferroPos.z - 0.6, 1.1, PROP, 0.55);
  prop('pallet', ferroPos.x + 0.9, ferroPos.z - 1.2, 0.2, PROP);
  prop('resource_stone', ferroPos.x - 0.4, ferroPos.z - 2.0, 0.5, PROP, 0.6);
  prop('weaponrack', smithPos.x + 2.8, smithPos.z - 1.6, smithRot, PROP, 0.6);
  // perto do poço: barris (aqui fica o carvão)
  const carvaoPos = new THREE.Vector3(-2.4, 0, 2.2);
  prop('barrel', carvaoPos.x, carvaoPos.z, 0, PROP, 0.5);
  prop('barrel', carvaoPos.x - 0.9, carvaoPos.z + 0.6, 0.7, PROP, 0.5);
  prop('bucket_water', carvaoPos.x + 0.6, carvaoPos.z + 1.1, 0.3, PROP);
  // perto da barraca da comerciante: sacos e carrinho (aqui fica o couro)
  const couroPos = front(marketPos.x, marketPos.z, marketRot, -0.2, 3.9);
  prop('sack', couroPos.x, couroPos.z, 0.3, PROP, 0.5);
  prop('sack', couroPos.x + 0.8, couroPos.z + 0.4, 1.0, PROP, 0.5);
  prop('wheelbarrow', couroPos.x - 0.7, couroPos.z + 1.4, 1.9, PROP, 0.7);
  prop('crate_B_big', couroPos.x + 1.4, couroPos.z - 0.6, 0.2, PROP, 0.55);
  // lenha e escada pela vila
  prop('resource_lumber', rosaPos.x - 2.2, rosaPos.z + 3.4, 0.4, PROP, 0.8);
  prop('crate_A_small', antPos.x + 2.4, antPos.z - 1.4, 0.8, PROP, 0.45);
  prop('bucket_empty', zePos.x - 1.8, zePos.z + 2.2, 0.0, PROP);
  prop('flag_red', 3.4, 3.6, 0.5, S, 0.3);
  prop('flag_red', -3.6, -3.4, 2.2, S, 0.3);

  // ---------- portão de saída (com muro dos dois lados) ----------
  const GATE_DIST = 12.4;
  const gatePos = new THREE.Vector3(-GATE_DIST * Math.SQRT1_2, 0, -GATE_DIST * Math.SQRT1_2);
  const gateRot = Math.PI / 4;
  const gate = place('wall_straight_gate', gatePos.x, gatePos.z, gateRot);
  occluders.push(gate);
  const axis = new THREE.Vector2(Math.cos(gateRot), -Math.sin(gateRot)); // direção do muro no chão
  for (const k of [-1, 1]) {
    const wx = gatePos.x + axis.x * 6 * k;
    const wz = gatePos.z + axis.y * 6 * k;
    const wall = place('wall_straight', wx, wz, gateRot);
    occluders.push(wall);
    for (const t of [-1.8, 0, 1.8]) world.addCircle(wx + axis.x * t, wz + axis.y * t, 1.0);
    // pilares do portão
    world.addCircle(gatePos.x + axis.x * 2.5 * k, gatePos.z + axis.y * 2.5 * k, 1.0);
  }
  // barreira na abertura, removida quando o portão abre
  let gateBarrier: ReturnType<CollisionWorld['addCircle']>[] | null = [-1.2, 0, 1.2].map((t) =>
    world.addCircle(gatePos.x + axis.x * t, gatePos.z + axis.y * t, 0.9),
  );
  const doorL = gate.getObjectByName('wall_straight_gate_door_left');
  const doorR = gate.getObjectByName('wall_straight_gate_door_right');
  let gateOpen = 0;

  // ---------- floresta e pedras em volta (esconde o limite do mapa) ----------
  const treeNames = ['trees_A_large', 'trees_B_large'];
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (ring(q, r) !== 3) continue;
      const p = hex(q, r);
      const t = place(treeNames[(q * 3 + r * 5 + 20) % 2], p.x, p.z, ((q + r) * 1.3) % 6, S);
      if (p.x + p.z > 4) occluders.push(t);
    }
  }
  const clumps: [string, number, number, number][] = [
    ['trees_A_medium', 12, 0, 2.3],
    ['trees_B_medium', -12.2, 1.2, 2.3],
    ['trees_A_medium', 6, 10.4, 2.3],
    ['trees_B_medium', -6, 10.4, 2.3],
    ['trees_B_small', 9.2, 6.2, 1.5],
    ['trees_A_small', 2.5, 11.8, 1.5],
    ['trees_B_small', -11.6, 8.2, 1.5],
    ['trees_A_small', 11.6, -5.4, 1.5],
    ['trees_B_medium', 5.2, -12.6, 2.0],
    ['trees_A_medium', -2.8, -13.6, 2.0],
    ['trees_A_small', -13.4, -3.6, 1.5],
  ];
  for (const [n, x, z, r] of clumps) {
    const t = place(n, x, z, x * 0.7, S);
    world.addCircle(x, z, r);
    if (x + z > 4) occluders.push(t);
  }
  const rocks: [string, number, number, number][] = [
    ['rock_single_A', -10.4, 6.4, 0.5],
    ['rock_single_C', -11.4, 5.0, 1.0],
    ['rock_single_B', 10.6, 8.2, 2.0],
    ['rock_single_D', -7.4, -10.2, 0.2],
    ['rock_single_A', 13, 3.4, 1.3],
    ['rock_single_C', 8.4, -10.8, 2.7],
  ];
  for (const [n, x, z, rot] of rocks) {
    place(n, x, z, rot, S * 1.2);
    world.addCircle(x, z, 0.8);
  }
  world.addBounds(0, 0, BOUNDS_R);

  // ---------- nuvens abaixo da ilha ----------
  const clouds: THREE.Object3D[] = [];
  [
    ['cloud_big', 17, -4.5, 8],
    ['cloud_small', -16, -5.5, 14],
    ['cloud_big', -5, -6, 24],
    ['cloud_small', 20, -6.5, -12],
    ['cloud_big', 6, -5, -22],
  ].forEach(([n, x, y, z]) => {
    const c = place(n as string, x as number, z as number, (x as number) * 0.1, S * 1.4, y as number, false);
    clouds.push(c);
  });

  // ---------- fumaça das chaminés e brilho da forja ----------
  const chimney = (obj: THREE.Object3D, lx: number, ly: number, lz: number) => {
    obj.updateMatrixWorld(true);
    return obj.localToWorld(new THREE.Vector3(lx, ly, lz)); // medidas locais do modelo (a escala já está no objeto)
  };
  const smoke = new Smoke([
    chimney(smithHouse, 0.2, 0.98, -0.02),
    chimney(rosaHouse, 0.0, 0.97, -0.2),
    chimney(antHouse, 0.1, 1.3, -0.26),
    chimney(zeHouse, -0.3, 1.45, -0.3),
  ]);
  scene.add(smoke.points);

  // boca da forja: na cúpula de pedra, à direita da porta (medidas do modelo, antes da escala)
  const forgePos = smithHouse.localToWorld(new THREE.Vector3(0.34, 0.2, 0.5));
  const forgeFlame = createFlame(0.8, 3);
  forgeFlame.mesh.position.copy(forgePos);
  scene.add(forgeFlame.mesh);
  const forgeLight = new THREE.PointLight(0xff8a3a, 9, 7, 2);
  forgeLight.position.set(forgePos.x, 1.4, forgePos.z);
  scene.add(forgeLight);

  // ---------- NPCs ----------
  const messenger = new Npc({
    character: 'Rogue_Hooded',
    position: new THREE.Vector3(2.4, 0, -2.4),
    facing: 0.25,
  });
  const smith = new Npc({
    character: 'Barbarian',
    position: front(smithPos.x, smithPos.z, smithRot, 3.2, 1.2),
    facing: smithRot,
    props: [{ asset: CHARACTER('axe_1handed'), hand: 'r' }],
  });
  const merchant = new Npc({
    character: 'Rogue',
    position: front(marketPos.x, marketPos.z, marketRot, 3.2, -0.6),
    facing: marketRot,
    props: [{ asset: CHARACTER('mug_full'), hand: 'l' }],
  });
  const npcs = [messenger, smith, merchant];
  for (const n of npcs) {
    scene.add(n.object);
    world.addCircle(n.position.x, n.position.z, 0.5);
  }

  // ---------- gatinho Fubá ----------
  const catHide = new THREE.Vector3(-10.4, 0, 5.6);
  const catHome = front(marketPos.x, marketPos.z, marketRot, 2.4, 2.6);
  const cat = makeCat();
  cat.scale.setScalar(1.5);
  scene.add(cat);

  // ---------- brilhos nos achados ----------
  const sparkles: { sprite: Marker; base: number; show: () => boolean }[] = [];
  const sparkle = (pos: THREE.Vector3, show: () => boolean, height = 1.5) => {
    const sprite = sparkleMarker();
    sprite.position.set(pos.x, height, pos.z);
    scene.add(sprite);
    sparkles.push({ sprite, base: height, show });
  };

  // ---------- estado e objetivo ----------
  const materialCount = () => MATERIALS.filter((m) => game.has(m)).length;
  const smithActive = () => game.quest('smith') === 'active';

  function objective(): string | null {
    const o = T.objective;
    if (!game.flag('letterRead')) return o.talkMessenger;
    if (game.flag('villageDone')) return o.done;
    const sq = game.quest('smith');
    if (sq === 'new') return o.talkSmith;
    if (sq === 'active') return materialCount() >= 3 ? o.bringMaterials : fmt(o.findMaterials, { n: materialCount() });
    if (!game.has('mapa')) return game.coins >= MAP_PRICE ? o.needMap : o.needCoins;
    return o.gate;
  }

  const delivered = () => MAIL_HOUSES.filter((h) => game.flag('delivered_' + h)).length;

  function refresh() {
    ui.setObjective(objective());
    const letter = game.flag('letterRead');
    messenger.alert = !letter || (game.quest('mail') === 'new') || (game.quest('mail') === 'active' && delivered() === 3);
    smith.alert = letter && (game.quest('smith') === 'new' || (smithActive() && materialCount() >= 3));
    merchant.alert = game.quest('pet') === 'active' && game.flag('petFound');
    if (game.quest('pet') === 'done') {
      cat.position.copy(catHome);
      cat.rotation.y = marketRot + Math.PI / 2;
      cat.visible = true;
    } else {
      cat.position.copy(catHide);
      cat.rotation.y = 0.6;
      cat.visible = !game.flag('petFound');
    }
    const open = game.flag('villageDone');
    if (open && gateBarrier) {
      gateBarrier.forEach((c) => world.remove(c));
      gateBarrier = null;
    }
  }
  const stopRefresh = game.onChange(refresh);

  // ---------- diálogos ----------
  const toastItem = (id: ItemId) => ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  const giveItem = (id: ItemId, n = 1) => {
    game.addItem(id, n);
    toastItem(id);
  };
  const giveCoins = (n: number) => {
    game.addCoins(n);
    ui.toast(fmt(content.ui.gotCoins, { n }));
  };
  const startQuest = (id: 'smith' | 'mail' | 'pet') => {
    game.setQuest(id, 'active');
    ui.toast(fmt(content.ui.newQuest, { title: T.quests[id].title }));
  };
  const finishQuest = (id: 'smith' | 'mail' | 'pet') => {
    game.setQuest(id, 'done');
    ui.toast(fmt(content.ui.questDone, { title: T.quests[id].title }));
    giveCoins(T.quests[id].coins);
  };
  /** Mostra as falas e termina com uma pergunta de escolhas (a última fala vira a pergunta). */
  async function converse(lines: readonly string[], options: readonly string[], who: string) {
    if (lines.length > 1) await ui.tell(lines.slice(0, -1), who);
    return ui.ask(lines[lines.length - 1], options, who);
  }

  async function talkMessenger() {
    const m = T.messenger;
    const who = T.npcs.messenger.name;
    messenger.play('Interact');
    if (!game.flag('letterRead')) {
      await ui.tell(m.first, who);
      await ui.letter(T.letter.title, T.letter.paragraphs, T.letter.close);
      game.setFlag('letterRead');
      await ui.tell(m.afterLetter, who);
      return;
    }
    const mail = game.quest('mail');
    if (mail === 'new') {
      const pick = await converse(m.mailOffer, [m.mailYes, m.mailNo], who);
      if (pick === 0) {
        startQuest('mail');
        giveItem('carta', 3);
        await ui.tell(m.mailAccepted, who);
      } else {
        await ui.tell(m.mailDecline, who);
      }
    } else if (mail === 'active') {
      if (delivered() === 3) {
        await ui.tell(m.mailDone, who);
        finishQuest('mail');
      } else {
        await ui.tell([fmt(m.mailProgress, { n: 3 - delivered() })], who);
      }
    } else {
      await ui.tell(m.idle, who);
    }
  }

  async function talkSmith() {
    const s = T.smith;
    const who = T.npcs.smith.name;
    smith.play('Interact');
    if (!game.flag('letterRead')) {
      await ui.tell(s.noLetter, who);
      return;
    }
    const q = game.quest('smith');
    if (q === 'new') {
      const pick = await converse(s.offer, [s.yes, s.no], who);
      if (pick === 0) {
        startQuest('smith');
        await ui.tell(s.accepted, who);
      } else {
        await ui.tell(s.decline, who);
      }
    } else if (q === 'active') {
      if (materialCount() >= 3) {
        await ui.tell(s.ready.slice(0, 2), who);
        MATERIALS.forEach((m) => game.removeItem(m));
        giveItem('espada');
        giveItem('mochila');
        giveItem('chave_trigo');
        game.setEquipped({ sword: true, backpack: true });
        player.setEquipment(game.data.equipped);
        smith.play('Cheer');
        finishQuest('smith');
        await ui.tell(s.ready.slice(2), who);
      } else {
        const missing = MATERIALS.filter((m) => !game.has(m));
        const hints = missing.map((m) => T.finds[m as 'ferro' | 'carvao' | 'couro'].hint);
        await ui.tell([fmt(s.progress, { n: materialCount() }), ...hints], who);
      }
    } else {
      await ui.tell(s.done, who);
    }
  }

  async function openShop() {
    const m = T.merchant;
    await ui.openShop({
      title: m.shopTitle,
      hint: m.shopHint,
      coins: () => game.coins,
      entries: () =>
        T.shop.map((e) => {
          const it = content.items[e.id as ItemId];
          return { id: e.id, icon: it.icon, name: it.name, desc: it.desc, price: e.price, owned: game.has(e.id) };
        }),
      onBuy: (id) => {
        const price = T.shop.find((e) => e.id === id)!.price;
        if (game.has(id)) return false;
        if (!game.spend(price)) {
          ui.toast(content.ui.notEnoughToast);
          return false;
        }
        game.addItem(id);
        toastItem(id as ItemId);
        ui.toast(fmt(content.ui.spentCoins, { n: price }));
        return true;
      },
    });
  }

  async function talkMerchant() {
    const m = T.merchant;
    const who = T.npcs.merchant.name;
    merchant.play('Interact');
    const pick = await ui.ask(m.greet[0], [m.menuShop, m.menuChat, m.menuBye], who);
    if (pick === 0) {
      await openShop();
    } else if (pick === 1) {
      const pet = game.quest('pet');
      if (pet === 'new') {
        const choice = await converse(m.petOffer, [m.petYes, m.petNo], who);
        if (choice === 0) {
          startQuest('pet');
          await ui.tell(m.petAccepted, who);
        } else {
          await ui.tell(m.petDecline, who);
        }
      } else if (pet === 'active') {
        if (game.flag('petFound')) {
          await ui.tell(m.petReturned, who);
          merchant.play('Cheer');
          finishQuest('pet');
        } else {
          await ui.tell(m.petWaiting, who);
        }
      } else {
        await ui.tell(m.chatIdle, who);
      }
    } else {
      await ui.tell(m.bye, who);
    }
  }

  async function useGate() {
    const g = T.gate;
    if (game.flag('villageDone')) {
      await goTo('map', 'village'); // entrada do mapa: o marco da vila
      return;
    }
    if (!game.has('chave_trigo')) await ui.tell(g.noKey);
    else if (!game.has('mapa')) await ui.tell(g.noMap);
    else {
      await ui.tell(g.open);
      game.setFlag('villageDone');
      await goTo('map', 'village');
    }
  }

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });

  add(messenger.position, 2.6, T.npcs.messenger.prompt, () => void talkMessenger());
  add(smith.position, 2.6, T.npcs.smith.prompt, () => void talkSmith());
  add(merchant.position, 2.6, T.npcs.merchant.prompt, () => void talkMerchant());

  const finds: ['ferro' | 'carvao' | 'couro', THREE.Vector3][] = [
    ['ferro', ferroPos],
    ['carvao', carvaoPos],
    ['couro', couroPos],
  ];
  for (const [id, pos] of finds) {
    const f = T.finds[id];
    const available = () => smithActive() && !game.flag('found_' + id);
    add(pos, 2.1, f.prompt, () => {
      game.setFlag('found_' + id);
      game.addItem(id);
      toastItem(id);
      void ui.tell(f.lines);
    }, available);
    sparkle(pos, available);
  }

  const catAvailable = () => game.quest('pet') === 'active' && !game.flag('petFound');
  add(catHide, 2.1, T.finds.gato.prompt, () => {
    game.setFlag('petFound');
    void ui.tell(T.finds.gato.lines);
  }, catAvailable);
  sparkle(catHide, catAvailable, 1.4);

  const houses: [(typeof MAIL_HOUSES)[number], THREE.Object3D, number, number, number][] = [
    ['rosa', rosaHouse, rosaPos.x, rosaPos.z, rosaRot],
    ['antonio', antHouse, antPos.x, antPos.z, antRot],
    ['ze', zeHouse, zePos.x, zePos.z, zeRot],
  ];
  for (const [id, , x, z, rot] of houses) {
    const spot = front(x, z, rot, 2.6);
    const h = T.houses[id];
    add(spot, 2.0, h.prompt, () => {
      game.removeItem('carta');
      game.setFlag('delivered_' + id);
      void ui.tell(h.lines).then(() => {
        if (delivered() === 3) ui.toast(T.houses.allDelivered);
      });
    }, () => game.quest('mail') === 'active' && game.has('carta') && !game.flag('delivered_' + id));
  }

  const gateFront = new THREE.Vector3(gatePos.x + Math.sin(gateRot) * 2.2, 0, gatePos.z + Math.cos(gateRot) * 2.2);
  add(gateFront, 3.2, () => (game.flag('villageDone') ? T.gate.promptOpen : T.gate.prompt), () => void useGate());

  // ---------- estado inicial ----------
  player.setEquipment(game.data.equipped);
  if (game.flag('villageDone')) gateOpen = 1;
  refresh();
  const sunTarget = new THREE.Vector3();

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(4, 0, 4),
    entries: {
      // volta do mapa: logo dentro do portão, olhando para a praça
      gate: { x: gatePos.x + Math.sin(gateRot) * 3.6, z: gatePos.z + Math.cos(gateRot) * 3.6, rot: gateRot },
    },
    interactables,
    occluders,
    env: DAY_ENV,
    torchLit: false,
    onEnter() {
      if (!game.flag('letterRead')) ui.say(T.intro);
    },
    dispose() {
      stopRefresh();
      sky.dispose();
    },
    update(dt, time, playerPos) {
      // sol acompanha o jogador (arredondado ao texel para a sombra não tremer)
      sunTarget.set(Math.round(playerPos.x / texel) * texel, 0, Math.round(playerPos.z / texel) * texel);
      sun.target.position.copy(sunTarget);
      sun.position.copy(sunTarget).add(SUN_OFFSET);

      smoke.update(dt);
      forgeFlame.update(dt);
      forgeLight.intensity = 9 * (1 + Math.sin(time * 9) * 0.1 + Math.sin(time * 14.3) * 0.06);
      if (fan) fan.rotation.z += dt * 0.7;
      clouds.forEach((c, i) => (c.position.x += Math.sin(time * 0.1 + i) * dt * 0.15));
      for (const n of npcs) n.update(dt, playerPos);

      const target = game.flag('villageDone') ? 1 : 0;
      gateOpen += (target - gateOpen) * (1 - Math.exp(-3 * dt));
      if (doorL) doorL.rotation.y = -gateOpen * 1.5;
      if (doorR) doorR.rotation.y = gateOpen * 1.5;

      for (const s of sparkles) {
        const on = s.show();
        s.sprite.visible = on;
        if (on) {
          s.sprite.position.y = s.base + Math.sin(time * 2.4 + s.sprite.position.x) * 0.12;
          s.sprite.setSize(0.7 + Math.sin(time * 5 + s.sprite.position.z) * 0.12);
        }
      }
    },
  };
}
