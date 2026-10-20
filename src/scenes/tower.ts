import * as THREE from 'three';
import { CollisionWorld } from '../core/collision';
import { DUNGEON, model } from '../core/assets';
import { createFlame } from '../entities/torch';
import { Npc, NPC_ASSETS, disposeNpcMaterials, type NpcAccessory, type NpcCharacter } from '../entities/npc';
import { Sparks } from '../fx/particles';
import { sparkleMarker, type Marker } from '../fx/markers';
import { rng } from '../world/noise';
import { askQuiz } from '../ui/quiz';
import { content, fmt, type ItemId } from '../content';
import { doneFlag } from './registry';
import { ISOMETRIC, type Area, type AreaContext, type Interactable } from './types';

/**
 * Torre do Saber: cinco salas quadradas, uma por andar. Cada sala tem um guardião que faz uma pergunta; quem
 * acerta desfaz o selo da porta e pode subir. No topo, um baú guarda a segunda chave do Castelo.
 *
 * As salas ficam lado a lado (50 m entre os centros), todas com o chão em y = 0. Só a do andar atual fica visível;
 * subir ou descer escurece a tela, troca a sala visível e move o jogador (`ctx.teleport`).
 */

const FLOOR_ASSETS = [
  'floor_tile_large', 'floor_tile_large_rocks', 'wall', 'wall_cracked', 'wall_broken', 'wall_arched', 'wall_doorway', 'wall_corner',
  'torch_mounted', 'candle_triple', 'candle_lit', 'candle_melted', 'barrel_small', 'barrel_large', 'crates_stacked', 'box_large', 'chest_gold',
];
export const TOWER_ASSETS = [...FLOOR_ASSETS.map(DUNGEON), ...NPC_ASSETS];

const T = content.tower;
const FLOORS = 5;
const SPACING = 50;
/** Meia largura do piso de cada sala (4 × 4 lajotas de 4 m). */
const HALF = 8;

const floorFlag = (n: number) => `tower_floor_${n}`;

interface GuardianLook {
  character: NpcCharacter;
  tint: number;
  accessories: NpcAccessory[];
}
const LOOKS: GuardianLook[] = [
  { character: 'Rogue_Hooded', tint: 0xb8a8d8, accessories: [{ kind: 'scarf', color: 0x7a3a8a }] },
  { character: 'Barbarian', tint: 0xd8c090, accessories: [{ kind: 'cap', color: 0x3a4a6a }] },
  { character: 'Mage', tint: 0x9fd8b0, accessories: [{ kind: 'apron', color: 0x4a7a4a }] },
  { character: 'Rogue', tint: 0xa8d8ff, accessories: [{ kind: 'scarf', color: 0x3a8ac0 }] },
  { character: 'Mage', tint: 0x9ab0ff, accessories: [{ kind: 'cap', color: 0x2a2a7a }] },
];

interface Floor {
  n: number;
  cx: number;
  group: THREE.Group;
  guardian: Npc;
  veil: THREE.Mesh | null;
  veilOpacity: number;
  anims: ((dt: number, time: number) => void)[];
  flames: ReturnType<typeof createFlame>[];
  lights: { light: THREE.PointLight; base: number }[];
}

/** Engrenagem de dentes triangulares, com furo no meio. Gira em torno do eixo z. */
function gearGeometry(radius: number, teeth: number, depth: number) {
  const s = new THREE.Shape();
  const steps = teeth * 4;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 4 < 2 ? radius : radius * 0.8;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.28, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

export function createTower(ctx: AreaContext): Area {
  const { ui, game, quality } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(new THREE.HemisphereLight(0x6a7a9a, 0x1a120c, 0.32));
  const world = new CollisionWorld();
  const rand = rng(77);
  const occluders: THREE.Object3D[] = [];
  const interactables: Interactable[] = [];
  const disposables: { dispose(): void }[] = [];
  const high = quality.level === 'high';
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

  const solved = (n: number) => game.flag(floorFlag(n));
  const startFloor = (() => {
    const m = /^f([1-5])$/.exec(ctx.entry ?? '');
    return m ? Number(m[1]) - 1 : 0;
  })();
  let cur = startFloor;
  let switching = false;

  const floors: Floor[] = [];

  // ---------- uma sala ----------
  function buildFloor(n: number): Floor {
    const cx = n * SPACING;
    const group = new THREE.Group();
    scene.add(group);
    const f: Floor = {
      n,
      cx,
      group,
      guardian: null as unknown as Npc,
      veil: null,
      veilOpacity: solved(n) ? 0 : 1,
      anims: [],
      flames: [],
      lights: [],
    };

    const put = (name: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
      const m = model(DUNGEON(name));
      m.position.set(cx + x, y, z);
      m.rotation.y = rot;
      m.scale.setScalar(scale);
      group.add(m);
      return m;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rot = 0) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(cx + x, y, z);
      o.rotation.y = rot;
      o.castShadow = true;
      o.receiveShadow = true;
      group.add(o);
      return o;
    };
    const solid = (x0: number, x1: number, z0: number, z1: number) => world.addBox(cx + x0, cx + x1, z0, z1);
    const light = (color: number, intensity: number, distance: number, x: number, y: number, z: number) => {
      const l = new THREE.PointLight(color, intensity, distance, 2);
      l.position.set(cx + x, y, z);
      group.add(l);
      f.lights.push({ light: l, base: intensity });
      return l;
    };

    // chão
    for (const gx of [-6, -2, 2, 6]) {
      for (const gz of [-6, -2, 2, 6]) {
        const t = put(rand() < 0.22 ? 'floor_tile_large_rocks' : 'floor_tile_large', gx, gz, Math.floor(rand() * 4) * (Math.PI / 2));
        t.traverse((o) => (o.castShadow = false));
      }
    }

    // paredes: o selo da porta norte fica no segmento x = 2 (nos andares 1 a 4); a porta sul leva ao andar de baixo
    const plain = ['wall', 'wall_cracked', 'wall', 'wall_arched', 'wall_broken'];
    const wallName = () => plain[Math.floor(rand() * plain.length)];
    const segs = [-6, -2, 2, 6];
    const lastFloor = n === FLOORS - 1;
    for (const s of segs) {
      const northDoor = s === 2 && !lastFloor;
      occluders.push(put(northDoor ? 'wall_doorway' : wallName(), s, -HALF - 0.5, 0));
      occluders.push(put(s === 2 ? 'wall_doorway' : wallName(), s, HALF + 0.5, Math.PI));
      occluders.push(put(wallName(), -HALF - 0.5, s, Math.PI / 2));
      occluders.push(put(wallName(), HALF + 0.5, s, -Math.PI / 2));
    }
    put('wall_corner', -HALF - 0.5, -HALF - 0.5, 0);
    put('wall_corner', HALF + 0.5, -HALF - 0.5, -Math.PI / 2);
    put('wall_corner', HALF + 0.5, HALF + 0.5, Math.PI);
    put('wall_corner', -HALF - 0.5, HALF + 0.5, Math.PI / 2);
    solid(-HALF - 2, HALF + 2, -HALF - 2, -HALF + 0.1);
    solid(-HALF - 2, HALF + 2, HALF - 0.1, HALF + 2);
    solid(-HALF - 2, -HALF + 0.1, -HALF - 2, HALF + 2);
    solid(HALF - 0.1, HALF + 2, -HALF - 2, HALF + 2);

    // tochas de parede
    const mountTorch = (x: number, z: number, rot: number) => {
      put('torch_mounted', x, z, rot, 1, 2.1);
      const flame = createFlame(0.55, 4);
      const tip = new THREE.Vector3(0, 0.62, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      flame.mesh.position.set(cx + x + tip.x, 2.1 + tip.y, z + tip.z);
      group.add(flame.mesh);
      f.flames.push(flame);
    };
    mountTorch(-4, -HALF, 0);
    mountTorch(-4, HALF, Math.PI);
    mountTorch(-HALF, 2, Math.PI / 2);
    mountTorch(HALF, -2, -Math.PI / 2);
    light(0xffb070, 11, 20, 0, 3.6, 0);

    // selo vermelho da porta norte
    if (!lastFloor) {
      const veil = new THREE.Mesh(
        geo(new THREE.PlaneGeometry(3.2, 3.6)),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.35, 0.25), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      );
      disposables.push(veil.material as THREE.Material);
      veil.position.set(cx + 2, 1.9, -HALF - 0.1);
      group.add(veil);
      f.veil = veil;
    }

    // guardião
    const look = LOOKS[n];
    const g = new Npc({
      character: look.character,
      position: new THREE.Vector3(cx - 2.5, 0, -3.2),
      facing: 0,
      tint: look.tint,
      accessories: look.accessories,
      work: { clip: 'Interact', every: 9 },
    });
    g.position.y = 0;
    group.add(g.object);
    world.addCircle(g.position.x, g.position.z, 0.6);
    f.guardian = g;

    THEMES[n](f, { put, mesh, solid, light, cx, group });
    group.visible = n === startFloor;
    return f;
  }

  interface Kit {
    put: (name: string, x: number, z: number, rot?: number, scale?: number, y?: number) => THREE.Object3D;
    mesh: (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rot?: number) => THREE.Mesh;
    solid: (x0: number, x1: number, z0: number, z1: number) => unknown;
    light: (color: number, intensity: number, distance: number, x: number, y: number, z: number) => THREE.PointLight;
    cx: number;
    group: THREE.Group;
  }

  // ---------- os cinco temas ----------
  const wood = () => std(0x5a3a22);
  const THEMES: ((f: Floor, k: Kit) => void)[] = [
    // 1. Biblioteca
    (_f, k) => {
      const frame = wood();
      const back = geo(new THREE.BoxGeometry(0.14, 3.4, 5));
      const plank = geo(new THREE.BoxGeometry(0.9, 0.09, 5));
      const side = geo(new THREE.BoxGeometry(0.9, 3.4, 0.12));
      const bookGeo = geo(new THREE.BoxGeometry(0.5, 0.6, 0.16));
      const bookMat = std(0xffffff, { roughness: 0.9 });
      const palette = [0x8a2a2a, 0x2a4a8a, 0x2f6a3a, 0xb08a2a, 0x5a2a6a, 0x7a4a2a].map((c) => new THREE.Color(c));
      for (const z of [-3.6, 2.6]) {
        k.mesh(back, frame, -HALF + 0.55, 1.7, z);
        for (const dz of [-2.44, 2.44]) k.mesh(side, frame, -HALF + 0.95, 1.7, z + dz);
        const books = new THREE.InstancedMesh(bookGeo, bookMat, 4 * 22);
        const m = new THREE.Matrix4();
        let i = 0;
        for (let level = 0; level < 4; level++) {
          const y = 0.55 + level * 0.8;
          k.mesh(plank, frame, -HALF + 0.95, y - 0.35, z);
          for (let b = 0; b < 22; b++) {
            const h = 0.75 + rand() * 0.35;
            m.compose(new THREE.Vector3(k.cx - HALF + 0.9, y - 0.35 + 0.3 * h, z - 2.3 + b * 0.21), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
            books.setMatrixAt(i, m);
            books.setColorAt(i, palette[Math.floor(rand() * palette.length)]);
            i++;
          }
        }
        books.castShadow = true;
        k.group.add(books);
        k.solid(-HALF - 0.2, -HALF + 1.4, z - 2.6, z + 2.6);
      }
      const desk = geo(new THREE.BoxGeometry(2.4, 1, 1.1));
      k.mesh(desk, frame, 4.5, 0.5, -0.5);
      k.put('candle_triple', 4.5, -0.5, 0.4, 1, 1);
      k.solid(3.2, 5.8, -1.2, 0.2);
      k.put('barrel_small', 6.4, 5.8);
      k.solid(5.9, 6.9, 5.3, 6.3);
      k.put('crates_stacked', -6, 6, 0.3);
      k.solid(-7, -5, 5, 7);
      k.light(0xffd08a, 6, 9, 4.5, 2.2, -0.5);
    },
    // 2. Sala dos Relógios
    (f, k) => {
      const bronze = std(0xb08040, { metalness: 0.35, roughness: 0.5 });
      const gears: [number, number, number, number][] = [
        [-5.5, 3, 1.7, 1],
        [-2.3, 3.5, 1.1, -1],
        [5.9, 2.8, 1.4, 1],
      ];
      for (const [x, y, r, dir] of gears) {
        const gm = k.mesh(geo(gearGeometry(r, Math.round(r * 7), 0.3)), bronze, x, y, -HALF + 0.5);
        f.anims.push((dt) => (gm.rotation.z += dir * dt * (0.55 / r)));
      }
      const body = geo(new THREE.BoxGeometry(0.9, 3.8, 1.2));
      k.mesh(body, wood(), HALF - 0.8, 1.9, -1);
      const face = new THREE.Mesh(geo(new THREE.CircleGeometry(0.34, 20)), new THREE.MeshBasicMaterial({ color: 0xf1e4bd }));
      disposables.push(face.material as THREE.Material);
      face.position.set(k.cx + HALF - 1.27, 3.0, -1);
      face.rotation.y = -Math.PI / 2;
      k.group.add(face);
      const pivot = new THREE.Group();
      pivot.position.set(k.cx + HALF - 1.3, 2.4, -1);
      const rod = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, 1.2, 0.05)), bronze);
      rod.position.y = -0.6;
      const bob = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 10, 8)), std(0xe0b84a, { metalness: 0.4, roughness: 0.4 }));
      bob.position.y = -1.25;
      pivot.add(rod, bob);
      k.group.add(pivot);
      f.anims.push((_dt, t) => (pivot.rotation.z = Math.sin(t * 2.2) * 0.45));
      k.solid(HALF - 1.5, HALF, -1.7, -0.3);
      k.put('barrel_large', -6, 5.5);
      k.solid(-7, -5, 4.5, 6.5);
      k.put('box_large', 6, 5.6, 0.2);
      k.solid(5, 7, 4.6, 6.6);
      k.light(0xffc860, 5, 10, -3, 3, -5);
    },
    // 3. Laboratório
    (f, k) => {
      const iron = std(0x2a2a30, { side: THREE.DoubleSide });
      const bowl = geo(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
      k.mesh(bowl, iron, -4.5, 1.2, 3);
      const rim = geo(new THREE.TorusGeometry(0.95, 0.08, 6, 14).rotateX(Math.PI / 2));
      k.mesh(rim, iron, -4.5, 1.2, 3);
      const leg = geo(new THREE.BoxGeometry(0.14, 0.5, 0.14));
      for (const a of [0, 2.1, 4.2]) k.mesh(leg, iron, -4.5 + Math.cos(a) * 0.6, 0.25, 3 + Math.sin(a) * 0.6);
      const liquid = new THREE.Mesh(geo(new THREE.CircleGeometry(0.88, 14).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.9, 0.7), toneMapped: false }));
      disposables.push(liquid.material as THREE.Material);
      liquid.position.set(k.cx - 4.5, 1.12, 3);
      k.group.add(liquid);
      k.solid(-5.7, -3.3, 1.8, 4.2);
      const bubbles = new Sparks(24, new THREE.Color(0.3, 1.0, 0.45));
      k.group.add(bubbles.points);
      disposables.push(bubbles.points.geometry, bubbles.points.material as THREE.Material);
      const at = new THREE.Vector3(k.cx - 4.5, 1.15, 3);
      f.anims.push((dt) => bubbles.update(dt, at, 9));
      k.put('barrel_small', -6.4, -5.6);
      k.put('barrel_large', -5.2, -6.5, 0.7);
      k.solid(-7.2, -4.4, -7.4, -4.8);
      k.mesh(geo(new THREE.BoxGeometry(1, 1, 3.2)), wood(), HALF - 0.8, 0.5, 1);
      k.put('candle_melted', HALF - 0.8, 2.2, 0.5, 1, 1);
      const bottleGeo = geo(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 8));
      [0xff5577, 0x55ddff, 0xffe055, 0x77ff88].forEach((c, i) => {
        const b = k.mesh(bottleGeo, std(0x222222, { emissive: c, emissiveIntensity: 0.9 }), HALF - 0.8, 1.2, -0.2 + i * 0.5);
        b.castShadow = false;
      });
      k.solid(HALF - 1.5, HALF, -0.8, 2.8);
      k.light(0x60ff90, 7, 10, -4.5, 1.9, 3);
    },
    // 4. Salão dos Espelhos
    (_f, k) => {
      const gold = std(0xb8963a, { metalness: 0.3, roughness: 0.5 });
      const glass = std(0xb8d8f0, { metalness: 0.9, roughness: 0.08, emissive: 0x1a4a6a, emissiveIntensity: 0.6 });
      const frame = geo(new THREE.BoxGeometry(1.9, 3.3, 0.18));
      const pane = geo(new THREE.PlaneGeometry(1.55, 2.95));
      const mirror = (x: number, z: number, rot: number) => {
        k.mesh(frame, gold, x, 1.65, z, rot);
        const p = k.mesh(pane, glass, x, 1.65, z, rot);
        p.translateZ(0.1);
        p.castShadow = false;
      };
      mirror(-HALF + 0.5, -3.5, Math.PI / 2);
      mirror(-HALF + 0.5, 1.5, Math.PI / 2);
      mirror(HALF - 0.5, -4.5, -Math.PI / 2);
      mirror(-2, -HALF + 0.5, 0);
      k.solid(-HALF, -HALF + 0.9, -4.6, -2.4);
      k.solid(-HALF, -HALF + 0.9, 0.4, 2.6);
      k.solid(HALF - 0.9, HALF, -5.6, -3.4);
      k.solid(-3.1, -0.9, -HALF, -HALF + 0.9);
      k.put('candle_lit', 5.5, 5.5, 0.2);
      k.put('candle_triple', -5.5, 5.8, 0.9);
      k.light(0x6fd8ff, 7, 12, 0, 3, 0);
    },
    // 5. Observatório
    (f, k) => {
      const count = high ? 140 : 80;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = k.cx + (rand() - 0.5) * 15;
        pos[i * 3 + 1] = 0.8 + rand() * 6;
        pos[i * 3 + 2] = (rand() - 0.5) * 15;
      }
      const stars = new THREE.Points(
        geo(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3))),
        new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      );
      disposables.push(stars.material as THREE.Material);
      stars.frustumCulled = false;
      k.group.add(stars);
      f.anims.push((_dt, t) => ((stars.material as THREE.PointsMaterial).opacity = 0.65 + Math.sin(t * 1.8) * 0.25));
      const ring = std(0x000000, { emissive: 0x4fd8ff, emissiveIntensity: 1.8 });
      for (const [r0, r1] of [[3.4, 3.55], [1.9, 2.0]]) {
        const m = k.mesh(geo(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2)), ring, 0, 0.03, 0);
        m.castShadow = false;
      }
      const metal = std(0x555a6a, { metalness: 0.3 });
      const tube = k.mesh(geo(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 10)), metal, -4.5, 1.9, -1);
      tube.rotation.x = 0.8;
      for (const a of [0, 2.1, 4.2]) {
        const lg = k.mesh(geo(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 6)), metal, -4.5 + Math.cos(a) * 0.45, 0.85, -1 + Math.sin(a) * 0.45);
        lg.rotation.z = Math.cos(a) * 0.12;
        lg.rotation.x = -Math.sin(a) * 0.12;
      }
      k.solid(-5.4, -3.6, -1.9, -0.1);
      k.put('chest_gold', 2, -HALF + 1.4, 0, 1.1);
      k.solid(0.9, 3.1, -HALF, -HALF + 2.2);
      k.put('candle_triple', 0.1, -HALF + 1, 0.4);
      k.put('candle_lit', 3.9, -HALF + 1, 0.2);
      k.light(0x9ab8ff, 8, 12, 0, 3.4, 0);
    },
  ];

  for (let n = 0; n < FLOORS; n++) floors.push(buildFloor(n));

  // ---------- interações ----------
  const add = (position: THREE.Vector3, radius: number, prompt: Interactable['prompt'], onInteract: () => void, enabled?: () => boolean) =>
    interactables.push({ position, radius, prompt, onInteract, enabled });
  const here = (n: number) => () => cur === n && !switching;

  const giveItem = (id: ItemId) => {
    game.addItem(id);
    ui.toast(fmt(content.ui.gotItem, { name: content.items[id].name }));
  };

  async function changeFloor(to: number, how: 'up' | 'down') {
    if (switching) return;
    switching = true;
    try {
      await ui.fade(true, fmt(T.floorLabel, { n: to + 1, name: T.floorNames[to] }));
      cur = to;
      floors.forEach((f) => (f.group.visible = f.n === cur));
      const f = floors[to];
      if (how === 'up') ctx.teleport(f.cx + 2, HALF - 3.2, Math.PI);
      else ctx.teleport(f.cx + 2, -HALF + 3.2, 0);
      game.setArea('tower', `f${to + 1}`);
      await ui.fade(false);
    } finally {
      switching = false;
    }
  }

  async function talk(n: number) {
    const g = T.guardians[n];
    if (solved(n)) {
      await ui.tell(g.after, g.name);
      return;
    }
    await ui.tell(g.greet, g.name);
    await askQuiz(ui, game, g.quiz, g.name);
    game.setFlag(floorFlag(n));
    if (n < FLOORS - 1) ui.toast(T.door.opened);
  }

  async function openChest() {
    if (game.flag(doneFlag('tower'))) {
      await ui.tell([T.done]);
      return;
    }
    if (!solved(FLOORS - 1)) {
      await ui.tell(T.chest.locked);
      return;
    }
    await ui.tell(T.chest.lines);
    giveItem('chave_estrela');
    game.setFlag('mem_torre_topo');
    game.setFlag(doneFlag('tower'));
    await ui.showMemory(content.memories.torre_topo);
    await ctx.openMap();
  }

  floors.forEach((f) => {
    const n = f.n;
    add(f.guardian.position, 3.2, T.guardians[n].prompt, () => void talk(n), here(n));
    // porta sul: sai da torre no 1º andar, desce nos outros
    add(v3(f.cx + 2, HALF - 1.6), 2.6, () => (n === 0 ? T.door.exit : fmt(T.door.down, { n })), () => (n === 0 ? void ctx.openMap() : void changeFloor(n - 1, 'down')), here(n));
    if (n < FLOORS - 1) {
      add(v3(f.cx + 2, -HALF + 1.6), 2.6, () => fmt(T.door.up, { n: n + 2 }), () => void changeFloor(n + 1, 'up'), () => here(n)() && solved(n));
      add(
        v3(f.cx + 2, -HALF + 1.6),
        2.6,
        T.door.sealedPrompt,
        () => void ui.tell(T.door.sealed),
        () => here(n)() && !solved(n),
      );
    } else {
      add(v3(f.cx + 2, -HALF + 1.8), 2.8, T.chest.prompt, () => void openChest(), here(n));
    }
  });

  const sparkles: { sprite: Marker; show: () => boolean }[] = [];
  const chestFloor = floors[FLOORS - 1];
  const chestSparkle = sparkleMarker();
  chestSparkle.position.set(chestFloor.cx + 2, 2.6, -HALF + 1.4);
  scene.add(chestSparkle);
  sparkles.push({ sprite: chestSparkle, show: () => cur === FLOORS - 1 && solved(FLOORS - 1) && !game.flag(doneFlag('tower')) });

  // ---------- objetivo ----------
  const objective = () => {
    if (game.flag(doneFlag('tower'))) return T.objective.done;
    if (!solved(cur)) return fmt(T.objective.talk, { n: cur + 1 });
    if (cur === FLOORS - 1) return T.objective.chest;
    return fmt(T.objective.climb, { n: cur + 2 });
  };
  let lastObjective = '';
  let objTimer = 0;

  const entries: NonNullable<Area['entries']> = { start: { x: 2, z: HALF - 3.2, rot: Math.PI } };
  floors.forEach((f) => (entries[`f${f.n + 1}`] = { x: f.cx + 2, z: HALF - 3.2, rot: Math.PI }));

  return {
    name: T.areaName,
    scene,
    world,
    spawn: new THREE.Vector3(2, 0, HALF - 3.2),
    spawnRot: Math.PI,
    entries,
    camera: ISOMETRIC,
    interactables,
    occluders,
    torchLit: true,
    debug: {
      floors,
      goFloor: (n: number) => void changeFloor(n, 'up'),
      solveAll: () => {
        for (let n = 0; n < FLOORS; n++) game.setFlag(floorFlag(n));
      },
    },
    onEnter() {
      if (!game.flag('tower_seen')) {
        game.setFlag('tower_seen');
        ui.say(T.intro);
      }
    },
    dispose() {
      floors.forEach((f) => f.guardian.dispose());
      disposeNpcMaterials();
      disposables.forEach((d) => d.dispose());
    },
    update(dt, time, playerPos) {
      const f = floors[cur];
      f.guardian.alert = !solved(cur);
      f.guardian.update(dt, playerPos);
      f.anims.forEach((a) => a(dt, time));
      f.flames.forEach((fl) => fl.update(dt));
      f.lights.forEach((l, i) => (l.light.intensity = l.base * (1 + Math.sin(time * (7 + i * 2.3) + f.cx) * 0.06)));
      if (f.veil) {
        f.veilOpacity += ((solved(cur) ? 0 : 1) - f.veilOpacity) * (1 - Math.exp(-3 * dt));
        (f.veil.material as THREE.MeshBasicMaterial).opacity = f.veilOpacity * (0.32 + Math.sin(time * 2.6) * 0.07);
        f.veil.visible = f.veilOpacity > 0.01;
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
        if (on) s.sprite.setSize(0.9 + Math.sin(time * 5) * 0.12);
      }
    },
  };
}
