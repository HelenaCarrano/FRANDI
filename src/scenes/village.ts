import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { CHARACTER } from '../core/assets';
import { sparkleMarker, type Marker } from '../fx/markers';
import { Npc, disposeNpcMaterials } from '../entities/npc';
import { Horse, SADDLE_Y } from '../entities/horse';
import { Chicken, disposeChickenMaterials } from '../entities/chicken';
import { playForge, playGears } from '../ui/minigames';
import { content, fmt, type ItemId } from '../content';
import { GOLDEN_MORNING } from '../fx/atmosphere';
import type { Area, AreaContext, Interactable } from './types';
import { VILLAGE_ASSETS, buildVillageWorld } from './villageWorld';

export { VILLAGE_ASSETS };

/**
 * Vila do Amanhecer: terreno com morros e estradas de terra, casas em escala humana, mata em volta,
 * céu dourado e sombras longas. Aqui está a história: o cavalo desconfiado (Tito), as ferraduras
 * (Brutus, com o minijogo da forja), o moinho parado (Seu Alvim, com as engrenagens), as galinhas
 * fugidas (Dona Clotilde) e a loja da Dona Pimenta. O cenário em si fica em villageWorld.ts.
 */

const T = content.village;
const MAP_PRICE = content.village.shop.find((s) => s.id === 'mapa')!.price;
const HEN_NAMES = 6;
const HEN_COLORS = [0xf4efe6, 0x9a5a2c, 0x3a3430, 0xe0c890, 0xb4472a];

type QuestId = keyof typeof T.quests;

export function createVillage(ctx: AreaContext): Area {
  const { ui, game, player, quality, camera, openMap } = ctx;
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const interactables: Interactable[] = [];
  const vw = buildVillageWorld(scene, world, quality);
  const ground = vw.ground;

  // ---------- progresso de saves antigos: a vila já concluída vale como tudo resolvido ----------
  if (game.flag('villageDone')) {
    for (const f of ['letterRead', 'horseShod', 'millFixed']) game.setFlag(f);
    for (const q of Object.keys(T.quests)) game.setQuest(q, 'done');
    for (const i of ['espada', 'mochila', 'chave_trigo', 'mapa'] as ItemId[]) if (!game.has(i)) game.addItem(i);
    game.setEquipped({ sword: true, backpack: true });
  }

  // ---------- pessoas ----------
  const lookAt = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const S = vw.spots;
  const tito = new Npc({
    character: 'Rogue',
    position: S.tito.clone(),
    facing: lookAt(S.tito.x, S.tito.z, vw.paddock.x, vw.paddock.z),
    tint: 0xd8b98a,
    accessories: [{ kind: 'strawHat', color: 0xd9b45a }],
    work: { clip: 'Use_Item', every: 11 },
  });
  const brutus = new Npc({
    character: 'Barbarian',
    position: S.brutus.clone(),
    facing: vw.smith.rot,
    props: [{ asset: CHARACTER('axe_1handed'), hand: 'r' }],
    accessories: [{ kind: 'apron', color: 0x4a3626 }],
    work: { clip: 'Interact', every: 9 },
  });
  const alvim = new Npc({
    character: 'Mage',
    position: S.alvim.clone(),
    facing: vw.mill.rot,
    tint: 0xf2ece0,
    accessories: [{ kind: 'apron', color: 0xf7f2e6 }],
    work: { clip: 'PickUp', every: 12 },
  });
  const clotilde = new Npc({
    character: 'Rogue_Hooded',
    position: S.clotilde.clone(),
    facing: lookAt(S.clotilde.x, S.clotilde.z, vw.pen.x, vw.pen.z),
    tint: 0xf3b7c7,
    accessories: [{ kind: 'strawHat', color: 0xe9c87a }],
    work: { clip: 'Cheer', every: 14 },
  });
  const pimenta = new Npc({
    character: 'Rogue',
    position: S.pimenta.clone(),
    facing: vw.market.rot,
    props: [{ asset: CHARACTER('mug_full'), hand: 'l' }],
    tint: 0xffd9b0,
    accessories: [{ kind: 'scarf', color: 0xc0392b }],
  });
  const villagerA = new Npc({
    character: 'Barbarian',
    position: new THREE.Vector3(vw.patrols.a[0][0], 0, vw.patrols.a[0][1]),
    facing: 0,
    tint: 0xb89a7a,
    patrol: vw.patrols.a,
    mutters: T.mutters.villagerA,
  });
  const villagerB = new Npc({
    character: 'Rogue_Hooded',
    position: new THREE.Vector3(vw.patrols.b[0][0], 0, vw.patrols.b[0][1]),
    facing: 0,
    tint: 0xa6c9a0,
    patrol: vw.patrols.b,
    mutters: T.mutters.villagerB,
    accessories: [{ kind: 'cap', color: 0x6a4a2a }],
  });
  const kid = new Npc({
    character: 'Rogue',
    position: new THREE.Vector3(vw.patrols.kid[0][0], 0, vw.patrols.kid[0][1]),
    facing: 0,
    tint: 0xffe0a0,
    scale: 0.72,
    patrol: vw.patrols.kid,
    mutters: T.mutters.kid,
  });
  const talkers = [tito, brutus, alvim, clotilde, pimenta];
  const npcs = [...talkers, villagerA, villagerB, kid];
  for (const n of npcs) {
    n.ground = ground;
    n.position.y = ground(n.position.x, n.position.z);
    scene.add(n.object);
  }
  for (const n of talkers) world.addCircle(n.position.x, n.position.z, 0.55);

  // ---------- o cavalo ----------
  const horse = new Horse();
  scene.add(horse.object);
  const shod = () => game.flag('horseShod');
  const horseName = T.horseName;
  const wanderBehavior = (skittish: boolean) => ({ kind: 'wander' as const, x: vw.paddock.x, z: vw.paddock.z, r: 8.5, skittish });
  if (shod()) horse.behavior = { kind: 'follow' };
  else {
    horse.position.set(vw.paddock.x, 0, vw.paddock.z);
    horse.behavior = wanderBehavior(!game.flag('letterRead'));
  }
  horse.position.y = ground(horse.position.x, horse.position.z);
  let horsePlaced = !shod();
  let riding = false;

  function mount() {
    if (riding || !shod()) return;
    riding = true;
    player.position.set(horse.position.x, player.position.y, horse.position.z);
    player.face(horse.heading);
    player.setRiding(SADDLE_Y);
    horse.behavior = { kind: 'ridden' };
    game.setFlag('riding', true);
  }
  function dismount() {
    if (!riding) return;
    riding = false;
    player.setRiding(null);
    horse.behavior = { kind: 'follow' };
    // desce do lado esquerdo do cavalo
    player.position.x += Math.cos(horse.heading) * 2.0;
    player.position.z -= Math.sin(horse.heading) * 2.0;
    world.resolve(player.position, player.radius);
    game.setFlag('riding', false);
  }

  // ---------- galinhas ----------
  const chickens: Chicken[] = [];
  const wild: Chicken[] = [];
  const pen = vw.pen;
  const penHome = { x: pen.x, z: pen.z, pull: 1.1, near: 30, r: pen.r, gate: { x: pen.x + pen.r + 2.5, z: pen.z } };
  const addHen = (x: number, z: number, roam: { x: number; z: number; r: number }, isWild: boolean) => {
    const c = new Chicken({ x, z, tint: HEN_COLORS[chickens.length % HEN_COLORS.length], roam, home: isWild ? penHome : undefined });
    c.position.y = ground(x, z);
    scene.add(c.object);
    chickens.push(c);
    if (isWild) wild.push(c);
    return c;
  };
  // soltas pela vila, só para dar vida
  for (const [x, z, r] of [[-6, 8, 9], [6, -6, 9], [10, 14, 7], [-12, 24, 6], [44, 38, 5], [38, 30, 5], [-44, 30, 6]] as const) addHen(x, z, { x, z, r }, false);
  // as seis fugitivas
  const hensDone = () => game.quest('hens') === 'done';
  vw.wildHens.slice(0, HEN_NAMES).forEach(([x, z], i) => {
    if (hensDone()) {
      const a = (i / HEN_NAMES) * Math.PI * 2;
      const hx = pen.x + Math.cos(a) * 2.6;
      const hz = pen.z + Math.sin(a) * 2.6;
      addHen(hx, hz, { x: pen.x, z: pen.z, r: pen.r - 1.8 }, true).enterPen({ x: pen.x, z: pen.z, r: pen.r - 1.8 });
    } else addHen(x, z, { x, z, r: 6 }, true);
  });
  const pennedCount = () => wild.filter((c) => c.penned).length;
  let lastPenned = pennedCount();

  // ---------- brilhos e estado ----------
  const sparkles: { sprite: Marker; base: number; show: () => boolean }[] = [];
  const sparkle = (pos: THREE.Vector3, show: () => boolean, height = 1.5) => {
    const sprite = sparkleMarker();
    sprite.position.set(pos.x, height, pos.z);
    scene.add(sprite);
    sparkles.push({ sprite, base: height, show });
  };

  const millRunning = () => game.flag('millFixed');
  const horseTrusted = () => game.flag('letterRead');

  function objective(): string | null {
    const o = T.objective;
    if (!horseTrusted()) return game.quest('horse') === 'new' ? o.talkStable : o.approachHorse;
    if (game.flag('villageDone')) return o.done;
    if (!shod()) {
      if (game.has('ferradura')) return o.bringShoes;
      if (game.quest('shoes') === 'new') return o.talkSmith;
      return o.forgeShoes;
    }
    if (!game.has('chave_trigo')) {
      const mq = game.quest('mill');
      if (mq === 'new') return o.talkMiller;
      return millRunning() ? o.returnMiller : o.fixMill;
    }
    if (!game.has('mapa')) return game.coins >= MAP_PRICE ? o.needMap : o.needCoins;
    return o.gate;
  }

  function refresh() {
    ui.setObjective(objective());
    const letter = horseTrusted();
    tito.alert = (!letter && game.quest('horse') === 'new') || (game.has('ferradura') && !shod());
    brutus.alert = letter && game.quest('shoes') === 'new';
    alvim.alert = letter && (game.quest('mill') === 'new' || (game.quest('mill') === 'active' && millRunning()));
    clotilde.alert = game.quest('hens') === 'new' || (game.quest('hens') === 'active' && pennedCount() >= HEN_NAMES);
    pimenta.alert = false;
    if (game.flag('villageDone') && gateBarrier) {
      gateBarrier.forEach((c) => world.remove(c));
      gateBarrier = null;
    }
  }
  let gateBarrier: ReturnType<CollisionWorld['addCircle']>[] | null = vw.gate.barrier;
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
  const startQuest = (id: QuestId) => {
    game.setQuest(id, 'active');
    ui.toast(fmt(content.ui.newQuest, { title: T.quests[id].title }));
  };
  const finishQuest = (id: QuestId) => {
    game.setQuest(id, 'done');
    ui.toast(fmt(content.ui.questDone, { title: T.quests[id].title }));
    giveCoins(T.quests[id].coins);
  };
  /** Mostra as falas e termina com uma pergunta de escolhas (a última fala vira a pergunta). */
  async function converse(lines: readonly string[], options: readonly string[], who: string) {
    if (lines.length > 1) await ui.tell(lines.slice(0, -1), who);
    return ui.ask(lines[lines.length - 1], options, who);
  }
  const named = (lines: readonly string[]) => lines.map((l) => fmt(l, { name: horseName }));

  async function talkStable() {
    const s = T.stable;
    const who = T.npcs.stable.name;
    tito.play('Interact');
    if (!horseTrusted()) {
      if (game.quest('horse') === 'new') {
        const pick = await converse([...s.first, s.offer], [s.yes, s.no], who);
        if (pick === 0) {
          startQuest('horse');
          giveItem('maca');
          await ui.tell(s.accepted, who);
        } else await ui.tell(s.decline, who);
      } else await ui.tell(s.waiting, who);
      return;
    }
    if (game.has('ferradura') && !shod()) {
      await ui.tell(s.shoeFit.slice(0, 2), who);
      game.removeItem('ferradura');
      game.setFlag('horseShod');
      horse.behavior = { kind: 'follow' };
      finishQuest('shoes');
      await ui.tell(s.shoeFit.slice(2), who);
    } else if (shod()) await ui.tell(s.done, who);
    else await ui.tell(s.idleBeforeShoes, who);
  }

  /** O cavalo aceita a aproximação: lê a carta da bolsa e a vila toda vira o seu caminho. */
  let trusting = false;
  async function onTrusted() {
    if (trusting) return;
    trusting = true;
    ui.setProgress(null);
    horse.behavior = wanderBehavior(false);
    await ui.tell(named(T.horse.trusted));
    await ui.letter(T.letter.title, T.letter.paragraphs, T.letter.close);
    game.removeItem('maca');
    game.setFlag('letterRead');
    finishQuest('horse');
    await ui.tell(T.stable.afterTrust, T.npcs.stable.name);
    trusting = false;
  }

  async function talkSmith() {
    const s = T.smith;
    const who = T.npcs.smith.name;
    brutus.play('Interact');
    if (!horseTrusted()) {
      await ui.tell(s.noLetter, who);
      return;
    }
    const q = game.quest('shoes');
    const forge = async () => {
      await playForge(ui, { title: s.forgeTitle, hint: s.forgeHint, button: s.forgeButton, misses: s.forgeMiss, hits: s.forgeHit });
      giveItem('ferradura');
      giveItem('espada');
      game.setEquipped({ sword: true });
      player.setEquipment(game.data.equipped);
      brutus.play('Cheer');
      await ui.tell(s.forged, who);
    };
    if (q === 'new') {
      const pick = await converse(s.offer, [s.yes, s.no], who);
      if (pick === 0) {
        startQuest('shoes');
        await forge();
      } else await ui.tell(s.decline, who);
    } else if (q === 'active' && !game.has('ferradura') && !shod()) await forge();
    else if (q === 'active') await ui.tell(s.progress, who);
    else await ui.tell(s.done, who);
  }

  async function talkMiller() {
    const m = T.miller;
    const who = T.npcs.miller.name;
    alvim.play('Interact');
    if (!horseTrusted()) {
      await ui.tell(m.noLetter, who);
      return;
    }
    const q = game.quest('mill');
    if (q === 'new') {
      const pick = await converse(m.offer, [m.yes, m.no], who);
      if (pick === 0) {
        startQuest('mill');
        await ui.tell(m.accepted, who);
      } else await ui.tell(m.decline, who);
    } else if (q === 'active') {
      if (millRunning()) {
        await ui.tell(m.ready.slice(0, 2), who);
        giveItem('chave_trigo');
        alvim.play('Cheer');
        await ui.tell(m.ready.slice(2), who);
        giveItem('mochila');
        game.setEquipped({ backpack: true });
        player.setEquipment(game.data.equipped);
        finishQuest('mill');
      } else await ui.tell(m.progress, who);
    } else await ui.tell(m.done, who);
  }

  async function talkHens() {
    const h = T.hens;
    const who = T.npcs.hens.name;
    clotilde.play('Interact');
    const q = game.quest('hens');
    if (q === 'new') {
      const pick = await converse([...h.first, h.offer], [h.yes, h.no], who);
      if (pick === 0) {
        startQuest('hens');
        await ui.tell(h.accepted, who);
      } else await ui.tell(h.decline, who);
    } else if (q === 'active') {
      if (pennedCount() >= HEN_NAMES) {
        await ui.tell(h.ready.slice(0, 2), who);
        clotilde.play('Cheer');
        giveItem('ovos');
        finishQuest('hens');
        await ui.tell(h.ready.slice(2), who);
      } else await ui.tell([fmt(h.progress, { n: HEN_NAMES - pennedCount() })], who);
    } else await ui.tell(h.done, who);
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
    pimenta.play('Interact');
    const pick = await ui.ask(m.greet[0], [m.menuShop, m.menuChat, m.menuBye], who);
    if (pick === 0) await openShop();
    else if (pick === 1) await ui.tell(shod() ? named(m.chatDone) : m.chat, who);
    else await ui.tell(m.bye, who);
  }

  async function useGate() {
    const g = T.gate;
    if (game.flag('villageDone')) {
      await openMap();
      return;
    }
    if (!game.has('chave_trigo')) await ui.tell(g.noKey);
    else if (!game.has('mapa')) await ui.tell(g.noMap);
    else {
      await ui.tell(g.open);
      game.setFlag('villageDone');
      await openMap();
    }
  }

  async function fixGears() {
    const m = T.miller;
    await playGears(ui, { title: m.gearsTitle, hint: m.gearsHint, goal: m.gearsGoal, solved: m.gearsSolved });
    game.setFlag('millFixed');
    await ui.tell(T.gears.fixed);
  }

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });

  add(tito.position, 3.2, T.npcs.stable.prompt, () => void talkStable());
  add(brutus.position, 3.2, T.npcs.smith.prompt, () => void talkSmith());
  add(alvim.position, 3.2, T.npcs.miller.prompt, () => void talkMiller());
  add(clotilde.position, 3.2, T.npcs.hens.prompt, () => void talkHens());
  add(pimenta.position, 3.2, T.npcs.merchant.prompt, () => void talkMerchant());

  const gearsOn = () => game.quest('mill') === 'active' && !millRunning();
  add(S.gears, 3.4, T.gears.prompt, () => void fixGears(), gearsOn);
  sparkle(S.gears, gearsOn, 1.6);

  add(
    horse.position,
    4,
    () => fmt(T.horse.mount, { name: horseName }),
    () => mount(),
    () => shod() && !riding && !trusting,
  );

  const gateFront = new THREE.Vector3(0, 0, vw.gate.pos.z + 5.5);
  add(gateFront, 5, () => (game.flag('villageDone') ? T.gate.promptOpen : T.gate.prompt), () => void useGate(), () => !riding);

  // ---------- estado inicial ----------
  player.setEquipment(game.data.equipped);
  refresh();
  let gateOpen = game.flag('villageDone') ? 1 : 0;
  let fanSpeed = millRunning() ? 0.8 : 0;
  let horseBtn = '';
  const tmp = new THREE.Vector3();
  const scareList = [new THREE.Vector3()];
  const hctx = { player: new THREE.Vector3(), playerSpeed: 0, world, ground };
  const cctx = { scare: scareList, scareRadius: 3.4, world, ground };
  const shyHorse = () => !horseTrusted() && game.quest('horse') === 'active';

  const bubbleAt = (key: string, n: Npc, text: string | null) => {
    if (!text) return ui.bubble(key, null);
    tmp.set(n.position.x, n.position.y + 2.9, n.position.z).project(camera);
    if (tmp.z > 1) return ui.bubble(key, null);
    ui.bubble(key, text, (tmp.x * 0.5 + 0.5) * window.innerWidth, (-tmp.y * 0.5 + 0.5) * window.innerHeight);
  };

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(vw.spawn.x, 0, vw.spawn.z),
    spawnRot: vw.spawn.rot,
    entries: { gate: vw.gateEntry },
    debug: { horse, wild, chickens, tito, brutus, alvim, clotilde, pimenta, vw },
    ground,
    interactables,
    occluders: [],
    env: GOLDEN_MORNING,
    torchLit: false,
    onEnter() {
      if (!horseTrusted()) ui.say(T.intro);
      if (game.flag('riding') && shod() && !riding) mount();
    },
    dispose() {
      stopRefresh();
      ui.setProgress(null);
      ui.setHorseButton(null);
      ui.clearBubbles();
      npcs.forEach((n) => n.dispose());
      horse.dispose();
      disposeNpcMaterials();
      disposeChickenMaterials();
      vw.dispose();
    },
    update(dt, time, playerPos) {
      vw.update(dt, time, playerPos, camera);

      // o cavalo companheiro aparece ao lado do Matheus na primeira vez que a cena roda
      if (!horsePlaced) {
        horse.position.set(playerPos.x + 2.5, 0, playerPos.z + 2.5);
        horse.position.y = ground(horse.position.x, horse.position.z);
        horsePlaced = true;
      }

      for (const n of npcs) n.update(dt, playerPos);

      // moinho e portão
      fanSpeed += ((millRunning() ? 0.8 : 0) - fanSpeed) * (1 - Math.exp(-0.8 * dt));
      if (vw.mill.fan) vw.mill.fan.rotation.z += dt * fanSpeed;
      gateOpen += ((game.flag('villageDone') ? 1 : 0) - gateOpen) * (1 - Math.exp(-3 * dt));
      if (vw.gate.doorL) vw.gate.doorL.rotation.y = -gateOpen * 1.5;
      if (vw.gate.doorR) vw.gate.doorR.rotation.y = gateOpen * 1.5;

      // cavalo
      hctx.player.copy(playerPos);
      hctx.playerSpeed = player.speed;
      if (riding) horse.ride(playerPos, player.facing, player.speed, dt);
      else horse.update(dt, hctx);

      // confiança do cavalo: chegar perto, devagar, com a maçã na mão
      if (shyHorse() && !trusting && !ui.inDialog) {
        const d = Math.hypot(playerPos.x - horse.position.x, playerPos.z - horse.position.z);
        if (d < 9.5 && game.has('maca')) {
          const gentle = d < 4.6 && player.speed < 1.5;
          horse.trust = Math.min(1, Math.max(0, horse.trust + (gentle ? 0.3 : -0.12) * dt));
          const label = fmt(T.horse.trustLabel, { name: horseName });
          ui.setProgress(player.speed > 2.7 && d < 9 ? T.horse.tooFast : d < 4.6 ? label : T.horse.approachHint, horse.trust);
          if (horse.trust >= 1) void onTrusted();
        } else ui.setProgress(null);
      } else if (ui.inDialog && trusting) ui.setProgress(null);

      // galinhas: fogem do Matheus (e do cavalo, que assusta mais)
      scareList[0].copy(playerPos);
      cctx.scareRadius = 2.8 + Math.min(player.speed, 9) * 0.38 + (riding ? 1.2 : 0);
      for (const c of chickens) {
        c.update(dt, cctx);
        if (!c.penned && wild.includes(c) && Math.hypot(c.position.x - pen.x, c.position.z - pen.z) < pen.r - 1.0) {
          c.enterPen({ x: pen.x, z: pen.z, r: pen.r - 1.8 });
        }
      }
      const n = pennedCount();
      if (n !== lastPenned) {
        lastPenned = n;
        if (game.quest('hens') === 'active') ui.toast(fmt(T.hens.penToast, { n, total: HEN_NAMES }));
        refresh();
      }

      // balões de fala dos moradores de fundo
      for (const [i, v] of [villagerA, villagerB, kid].entries()) {
        const d = Math.hypot(v.position.x - playerPos.x, v.position.z - playerPos.z);
        const text = d < 8 && !ui.inDialog ? v.mutters[Math.floor(time / 6 + i * 3) % v.mutters.length] : null;
        bubbleAt('v' + i, v, text);
      }

      // botão do cavalo
      let want = '';
      if (shod() && !trusting) {
        if (riding) want = T.horse.dismount;
        else if (Math.hypot(playerPos.x - horse.position.x, playerPos.z - horse.position.z) < 9) want = fmt(T.horse.mount, { name: horseName });
      }
      if (want !== horseBtn) {
        horseBtn = want;
        ui.setHorseButton(want || null, riding ? dismount : mount);
      }

      for (const s of sparkles) {
        const on = s.show();
        s.sprite.visible = on;
        if (on) {
          s.sprite.position.y = s.base + Math.sin(time * 2.4 + s.sprite.position.x) * 0.12;
          s.sprite.setSize(0.9 + Math.sin(time * 5 + s.sprite.position.z) * 0.12);
        }
      }
    },
  };
}
