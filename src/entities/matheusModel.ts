import * as THREE from 'three';
import { CHARACTER, gltf, model } from '../core/assets';
import { customizeHead, HEAD_STYLE } from './matheusHead';
import { backPrintTexture, frontPrintTexture, projectPrint, sleevePrintTexture } from './hoodiePrint';
import { buildHoodieMesh } from './hoodieMesh';
import { handTattooTexture, neckBandTexture } from './tattoos';

/**
 * Matheus, montado com peças do KayKit Adventurers (CC0) que compartilham o mesmo esqueleto:
 *  - corpo, braços e pernas do Mage (o capuz caído atrás do pescoço vira o moletom com capuz)
 *  - cabeça do Knight (cabelo curto), recolorida para castanho escuro
 *  - cabelo ondulado, barba curta, nariz menor, olhos grandes e rosto pintado (sobrancelhas,
 *    brilho, rosado) feitos sobre essa cabeça (matheusHead.ts)
 * O corpo do moletom é gerado sob medida (hoodieMesh.ts); por cima vão as estampas
 * (hoodiePrint.ts) e as tatuagens (tattoos.ts).
 */

export const MATHEUS_LOOK = {
  hair: HEAD_STYLE.hairBase, // castanho escuro (mechas e barba ficam em matheusHead.ts)
  hoodie: 0x26262b, // preto (levemente acinzentado para a tocha revelar o volume)
  hoodieTrim: 0x3a3a41, // barra, punhos e borda do capuz
  pants: 0x1f1f23,
  shoes: 0xe9e5dc,
};

/** Fração de baixo das botas que vira tênis; o resto vira calça. */
const SHOE_HEIGHT = 0.42;
/** Calça cargo larga e tênis robusto (multiplicadores de largura). */
const PANTS_WIDTH = 1.22;
const SHOE_WIDTH = 1.12;

export const MATHEUS_BASE = CHARACTER('Mage');
export const MATHEUS_ASSETS = [MATHEUS_BASE, CHARACTER('knight_head'), CHARACTER('sword_1handed')];

type Recolor = Record<string, number>;
const L = MATHEUS_LOOK;

/**
 * Cores por peça. A textura do KayKit é uma paleta 8×4: cada chave "rLcC" é uma célula
 * (linha de cima para baixo, coluna). Mapeamento descoberto lendo as UVs de cada malha.
 */
const PART_COLORS: Record<string, Recolor> = {
  Mage_ArmLeft: { r1c0: L.hoodie, r0c4: L.hoodieTrim },
  Mage_ArmRight: { r1c0: L.hoodie, r0c4: L.hoodieTrim },
  Mage_LegLeft: { r1c7: L.pants, r2c3: L.shoes },
  Mage_LegRight: { r1c7: L.pants, r2c3: L.shoes },
  Knight_Head: { r0c1: 0xffffff }, // a cor do cabelo vem por vértice (degradê) em matheusHead.ts
};

const HIDDEN_PARTS = ['Mage_Head', 'Mage_Hat', 'Mage_Cape', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'];

/**
 * A tocha fica a poucos centímetros do corpo e a luz cai com o quadrado da distância,
 * o que estoura o personagem. Nos materiais dele, as luzes pontuais são tratadas como
 * se estivessem a pelo menos MIN_LIGHT_DIST metros.
 */
const MIN_LIGHT_DIST = 1.3;
const PATCHED_LIGHTS = THREE.ShaderChunk.lights_pars_begin.replace(
  'pow( lightDistance, decayExponent )',
  `pow( max( lightDistance, ${MIN_LIGHT_DIST.toFixed(2)} ), decayExponent )`,
);

export function clampCloseLights<T extends THREE.Material>(m: T): T {
  // encadeia com um onBeforeCompile que o material já tenha (ex.: recorte da barba)
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_pars_begin>', PATCHED_LIGHTS);
  };
  m.customProgramCacheKey = () => prevKey() + '|character-light-clamp';
  return m;
}

/** Recolore células da paleta preservando o degradê original de cada uma. */
export function recolorPalette(src: THREE.Texture, cells: Recolor): THREE.CanvasTexture {
  const img = src.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const cw = canvas.width / 8;
  const ch = canvas.height / 4;
  const target = new THREE.Color();

  for (const [key, hex] of Object.entries(cells)) {
    const [, r, c] = key.match(/r(\d)c(\d)/)!.map(Number);
    const data = g.getImageData(c * cw, r * ch, cw, ch);
    const px = data.data;
    let avg = 0;
    for (let i = 0; i < px.length; i += 4) avg += lum(px[i], px[i + 1], px[i + 2]);
    avg = Math.max(1, avg / (px.length / 4));
    target.setHex(hex, THREE.SRGBColorSpace).convertLinearToSRGB();
    for (let i = 0; i < px.length; i += 4) {
      const f = THREE.MathUtils.clamp(lum(px[i], px[i + 1], px[i + 2]) / avg, 0.6, 1.45);
      px[i] = Math.min(255, target.r * 255 * f);
      px[i + 1] = Math.min(255, target.g * 255 * f);
      px[i + 2] = Math.min(255, target.b * 255 * f);
    }
    g.putImageData(data, c * cw, r * ch);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // mesma convenção das texturas glTF
  return tex;
}

/** Cor média de uma célula da paleta do material (ex.: pele = 'r0c0'). */
function paletteColor(mat: THREE.MeshStandardMaterial, key: string) {
  const img = mat.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img) return new THREE.Color(0xf1c09a);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const [, r, col] = key.match(/r(\d)c(\d)/)!.map(Number);
  const cw = c.width / 8;
  const ch = c.height / 4;
  const d = g.getImageData(col * cw + cw * 0.2, r * ch + ch * 0.3, cw * 0.5, ch * 0.4).data;
  let R = 0, G = 0, B = 0;
  for (let i = 0; i < d.length; i += 4) {
    R += d[i];
    G += d[i + 1];
    B += d[i + 2];
  }
  const n = d.length / 4;
  return new THREE.Color().setRGB(R / n / 255, G / n / 255, B / n / 255, THREE.SRGBColorSpace);
}

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function characterMaterial(orig: THREE.Material, colors: Recolor | undefined) {
  const std = (orig as THREE.MeshStandardMaterial).clone();
  if (colors && std.map) std.map = recolorPalette(std.map, colors);
  std.roughness = 0.85;
  std.metalness = 0;
  return clampCloseLights(std);
}

const cellOfUV = (u: number, v: number) => `r${Math.min(3, Math.floor(v * 4))}c${Math.min(7, Math.floor(u * 8))}`;

/** Clona a geometria (ela é compartilhada entre cópias do modelo) antes de editar. */
function ownGeometry(mesh: THREE.Mesh) {
  mesh.geometry = mesh.geometry.clone();
  return mesh.geometry;
}

/** Divide as botas: a parte de baixo continua na célula do calçado, a de cima passa para a célula da calça. */
function splitBoots(leg: THREE.Mesh, bootCell: string, pantsCell: string) {
  const geo = ownGeometry(leg);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (cellOfUV(uv.getX(i), uv.getY(i)) !== bootCell) continue;
    min = Math.min(min, pos.getY(i));
    max = Math.max(max, pos.getY(i));
  }
  const cut = min + (max - min) * SHOE_HEIGHT;
  const [, pr, pc] = pantsCell.match(/r(\d)c(\d)/)!.map(Number);
  const [, br, bc] = bootCell.match(/r(\d)c(\d)/)!.map(Number);
  for (let i = 0; i < pos.count; i++) {
    if (cellOfUV(uv.getX(i), uv.getY(i)) !== bootCell || pos.getY(i) <= cut) continue;
    // mesma posição relativa dentro da célula da calça
    uv.setXY(i, uv.getX(i) + (pc - bc) / 8, uv.getY(i) + (pr - br) / 4);
  }
  uv.needsUpdate = true;

  // calça cargo larga e tênis mais robusto: alarga em volta do eixo da perna
  const box = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > cut) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
  const ax = (box.min.x + box.max.x) / 2;
  const az = (box.min.z + box.max.z) / 2;
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) > cut ? PANTS_WIDTH : SHOE_WIDTH;
    pos.setX(i, ax + (pos.getX(i) - ax) * k);
    pos.setZ(i, az + (pos.getZ(i) - az) * k);
  }
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { cut, box };
}

/** Bolsos laterais da calça cargo, presos ao osso da coxa. */
function addCargoPockets(leg: THREE.Mesh, thigh: THREE.Bone, material: THREE.Material, cut: number) {
  const bb = leg.geometry.boundingBox!;
  const outer = bb.min.x + bb.max.x > 0 ? 1 : -1; // perna esquerda em +X
  const x = outer > 0 ? bb.max.x : bb.min.x;
  const y = cut + (bb.max.y - cut) * 0.5;
  const cz = (bb.min.z + bb.max.z) / 2;
  const pocket = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.16), material);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.175), material);
  flap.position.y = 0.075;
  pocket.add(bag, flap);
  pocket.position.set(x + outer * 0.015, y, cz);
  pocket.traverse((o) => (o.castShadow = true));
  pocket.updateMatrixWorld(true);
  thigh.attach(pocket);
}

/** Liga uma malha com esqueleto vinda de outro arquivo ao esqueleto do personagem (pelos nomes dos ossos). */
function adoptSkinnedMesh(mesh: THREE.SkinnedMesh, root: THREE.Object3D, parent: THREE.Object3D) {
  const bones = mesh.skeleton.bones.map((b) => {
    const target = root.getObjectByName(b.name) as THREE.Bone | undefined;
    if (!target) throw new Error(`Osso ausente no personagem: ${b.name}`);
    return target;
  });
  const skeleton = new THREE.Skeleton(bones, mesh.skeleton.boneInverses);
  parent.add(mesh);
  mesh.bind(skeleton, mesh.bindMatrix);
}

export interface MatheusRig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  bones: Record<'head' | 'chest' | 'handR' | 'handL', THREE.Bone>;
  materials: THREE.Material[];
}

export function buildMatheus(): MatheusRig {
  const root = model(MATHEUS_BASE);
  const rigNode = root.getObjectByName('Rig') ?? root;

  for (const name of HIDDEN_PARTS) root.getObjectByName(name)?.removeFromParent();

  const legCuts = ['Mage_LegLeft', 'Mage_LegRight'].map((leg) => ({
    leg: root.getObjectByName(leg) as THREE.Mesh,
    ...splitBoots(root.getObjectByName(leg) as THREE.Mesh, 'r2c3', 'r1c7'),
  }));

  // cabeça do Knight, ligada ao mesmo esqueleto
  const head = (model(CHARACTER('knight_head')).getObjectByName('Knight_Head') as THREE.SkinnedMesh)!;
  adoptSkinnedMesh(head, root, rigNode);

  // materiais recoloridos por peça
  const materials: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false; // sem auto-sombra: a tocha está colada no corpo
    mesh.frustumCulled = false; // o bounding box de malha com esqueleto não acompanha a animação
    mesh.material = characterMaterial(mesh.material as THREE.Material, PART_COLORS[mesh.name]);
    materials.push(mesh.material);
  });
  // A cabeça grande fica colada na chama e tamparia metade da luz da tocha:
  // só o corpo projeta sombra.
  head.castShadow = false;

  const bone = (n: string) => {
    const b = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) as THREE.Bone | undefined;
    if (!b) throw new Error(`Osso não encontrado: ${n}`);
    return b;
  };
  const bones = {
    head: bone('head'),
    chest: bone('chest'),
    handR: bone('handslot.r'),
    handL: bone('handslot.l'),
  };

  // Daqui em diante tudo é medido na pose de repouso, na superfície do modelo.
  root.updateMatrixWorld(true);

  // cabelo ondulado, barba curta, nariz menor, olhos grandes e rosto pintado
  const headParts = customizeHead(head, bones.head, paletteColor(head.material as THREE.MeshStandardMaterial, 'r0c0'));
  materials.push(clampCloseLights(headParts.hairMaterial), clampCloseLights(headParts.beardMaterial));
  headParts.extraMaterials.forEach((mm) => materials.push(clampCloseLights(mm)));

  // ---------- bolsos da calça cargo ----------
  const pocketMat = clampCloseLights(new THREE.MeshStandardMaterial({ color: 0x2a2a2f, roughness: 0.9 }));
  materials.push(pocketMat);
  for (const { leg, cut } of legCuts) {
    const left = leg.name.endsWith('Left');
    addCargoPockets(leg, bone(left ? 'upperleg.l' : 'upperleg.r'), pocketMat, cut);
  }

  // ---------- moletom sob medida no lugar da túnica do Mage ----------
  const tunic = root.getObjectByName('Mage_Body') as THREE.SkinnedMesh;
  const hoodieMat = clampCloseLights(new THREE.MeshStandardMaterial({ color: L.hoodie, roughness: 0.92 }));
  materials.push(hoodieMat);
  const body = buildHoodieMesh(tunic, hoodieMat);
  tunic.removeFromParent();

  // ---------- pescoço de pele entre o moletom (sem gola) e a cabeça ----------
  {
    body.geometry.computeBoundingBox();
    head.geometry.computeBoundingBox();
    const bodyTop = body.geometry.boundingBox!.max.y;
    const headBottom = head.geometry.boundingBox!.min.y;
    const hbb = head.geometry.boundingBox!;
    const neckH = headBottom - bodyTop + 0.12;
    // pescoço fechado de tatuagens (escrita na frente, escrita vertical no lado direito, cruzes
    // na nuca). Só o trecho entre o capuz e a cabeça aparece: a base fica sob o moletom e a borda
    // do capuz (0.06 + 0.03) e o topo dentro da cabeça (0.06).
    const NECK_TOP_R = 0.13;
    const NECK_BOTTOM_R = 0.15;
    const hiddenBottom = 0.09;
    const hiddenTop = 0.06;
    const neckMat = clampCloseLights(
      new THREE.MeshStandardMaterial({
        map: neckBandTexture(paletteColor(head.material as THREE.MeshStandardMaterial, 'r0c0'), {
          aspect: (Math.PI * (NECK_TOP_R + NECK_BOTTOM_R)) / neckH,
          visibleFrom: hiddenBottom / neckH,
          visibleTo: 1 - hiddenTop / neckH,
        }),
        roughness: 0.85,
      }),
    );
    materials.push(neckMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK_TOP_R, NECK_BOTTOM_R, neckH, 24, 1, true), neckMat);
    neck.position.set(0, bodyTop - 0.06 + neckH / 2, (hbb.min.z + hbb.max.z) / 2 - 0.04);
    neck.castShadow = false;
    neck.updateMatrixWorld();
    bones.chest.attach(neck);

    // capuz caído nas costas: volume arredondado logo abaixo da nuca + borda em volta do pescoço
    const bb2 = body.geometry.boundingBox!;
    const hood = new THREE.Group();
    const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), hoodieMat);
    hoodBack.scale.set(0.25, 0.11, 0.085);
    hoodBack.position.set(0, bodyTop - 0.09, bb2.min.z + 0.12);
    const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20, Math.PI * 1.3), hoodieMat);
    // arco atrás e dos lados do pescoço (o vão fica na frente)
    hoodRim.rotation.set(Math.PI / 2, 0, Math.PI / 2 - Math.PI * 0.65);
    hoodRim.position.set(0, bodyTop - 0.02, neck.position.z);
    hood.add(hoodBack, hoodRim);
    hood.traverse((o) => (o.castShadow = true));
    hood.updateMatrixWorld(true);
    bones.chest.attach(hood);
  }

  // ---------- estampas: costas, frente e mangas ----------
  body.geometry.computeBoundingBox();
  const gb = body.geometry.boundingBox!;
  const gs = gb.getSize(new THREE.Vector3());
  const printW = gs.x * 0.74;
  const printH = Math.min(printW * 1.25, gs.y * 0.68);
  const printY = gb.min.y + gs.y * 0.4; // logo abaixo do capuz
  projectPrint(
    body,
    {
      minX: -printW / 2,
      maxX: printW / 2,
      minY: printY - printH / 2,
      maxY: printY + printH / 2,
      facing: new THREE.Vector3(0, 0, -1),
      mirrorX: true,
    },
    backPrintTexture(),
    clampCloseLights,
  );
  const frontW = gs.x * 0.8;
  const frontTop = gb.min.y + gs.y * 0.95;
  projectPrint(
    body,
    {
      minX: -frontW / 2,
      maxX: frontW / 2,
      minY: frontTop - frontW,
      maxY: frontTop,
      facing: new THREE.Vector3(0, 0, 1),
    },
    frontPrintTexture(),
    clampCloseLights,
  );
  const sleeveTex = sleevePrintTexture();
  for (const name of ['Mage_ArmLeft', 'Mage_ArmRight']) {
    const arm = root.getObjectByName(name) as THREE.SkinnedMesh;
    arm.geometry.computeBoundingBox();
    const ab = arm.geometry.boundingBox!;
    const left = ab.min.x > 0; // em T-pose o braço esquerdo fica em +X
    const inner = left ? ab.min.x : ab.max.x; // ombro
    const outer = left ? ab.max.x : ab.min.x; // mão
    const elbow = inner + (outer - inner) * 0.62;
    // estrelas no lado de fora (+Y em T-pose) e atrás (-Z) da parte de cima do braço
    projectPrint(
      arm,
      { minX: Math.min(inner, elbow), maxX: Math.max(inner, elbow), minY: ab.min.z, maxY: ab.max.z, facing: new THREE.Vector3(0, 1, 0), plane: 'xz', mirrorX: !left },
      sleeveTex,
      clampCloseLights,
    );
    projectPrint(
      arm,
      { minX: Math.min(inner, elbow), maxX: Math.max(inner, elbow), minY: ab.min.y, maxY: ab.max.y, facing: new THREE.Vector3(0, 0, -1), mirrorX: !left },
      sleeveTex,
      clampCloseLights,
    );

    // ---------- tatuagem no dorso da mão direita ----------
    // Em T-pose o braço direito fica em -X e o dorso da mão aponta para +Y;
    // segurando a tocha, esse lado fica virado para fora (para o lado).
    if (!left) {
      projectPrint(
        arm,
        {
          minX: outer,
          maxX: outer + (inner - outer) * 0.24,
          minY: ab.min.z,
          maxY: ab.max.z,
          facing: new THREE.Vector3(0, 1, 0),
          plane: 'xz',
          mirrorX: true, // u cresce do punho para os dedos
        },
        handTattooTexture(),
        clampCloseLights,
      );
    }
  }

  const mixer = new THREE.AnimationMixer(root);
  const clips = new Map(gltf(MATHEUS_BASE).animations.map((c) => [c.name, c]));
  return { root, mixer, clips, bones, materials };
}
