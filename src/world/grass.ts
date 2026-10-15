import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, rng } from './noise';
import { applyWind } from './wind';

/**
 * Grama em tufos: cada tufo são cinco lâminas cruzadas, da raiz escura à ponta clara. Os tufos ficam em
 * blocos de 22 m (um InstancedMesh cada), então a câmera só desenha os blocos que vê e só os que estão
 * dentro do alcance; os tufos distantes encolhem até sumir, sem "aparecer de repente". Balançam com o vento.
 */

const CHUNK = 22;

function tuftGeometry() {
  const rand = rng(77);
  const root = new THREE.Color(0x4a7f2c);
  const tip = new THREE.Color(0xdcf27e);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.5;
    const h = 0.55 + rand() * 0.45;
    const w = 0.07 + rand() * 0.04;
    const lean = 0.12 + rand() * 0.22;
    // lâmina: triângulo largo na base, curvando na ponta
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([-w, 0, 0, w, 0, 0, lean, h, 0]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b]), 3));
    // normais para cima: a lâmina recebe a luz do céu e do sol como o chão, sem ficar preta de costas
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.rotateY(a);
    g.translate((rand() - 0.5) * 0.18, 0, (rand() - 0.5) * 0.18);
    blades.push(g);
  }
  const g = mergeGeometries(blades, false)!;
  g.computeBoundingSphere();
  blades.forEach((b) => b.dispose());
  return g;
}

export interface GrassOptions {
  /** Retângulo coberto. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Tufos por m² (vem da qualidade). */
  density: number;
  /** Alcance em metros; pode ser mudado depois com `setRange`. */
  range: number;
  height: (x: number, z: number) => number;
  /** Devolve true onde NÃO deve ter grama (trilha, casas, água). */
  exclude?: (x: number, z: number) => boolean;
  seed?: number;
  /** Cores das pontas, sorteadas por tufo. */
  tints?: number[];
}

interface Chunk {
  mesh: THREE.InstancedMesh;
  cx: number;
  cz: number;
}

export class Grass {
  readonly group = new THREE.Group();
  private readonly chunks: Chunk[] = [];
  private readonly geo = tuftGeometry();
  private readonly material: THREE.MeshStandardMaterial;
  private readonly fade = new THREE.Vector2();
  private range: number;

  constructor(private readonly o: GrassOptions) {
    this.range = o.range;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    applyWind(this.material, { sway: 0.2, fade: this.fade });
    this.setRange(o.range);
    this.group.name = 'grass';
    this.build();
  }

  /** Muda o alcance (a redução automática de qualidade encurta). */
  setRange(range: number) {
    this.range = range;
    this.fade.set(range - 9, range);
  }

  private build() {
    const { minX, maxX, minZ, maxZ, density, height, exclude, seed = 12, tints } = this.o;
    const rand = rng(seed);
    const step = 0.55;
    const palette = (tints ?? [0xffffff, 0xf2ffd0, 0xd9e8a0, 0xcfe6a8]).map((h) => new THREE.Color(h));
    const keep = density / (1 / (step * step));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    for (let cz = minZ; cz < maxZ; cz += CHUNK) {
      for (let cx = minX; cx < maxX; cx += CHUNK) {
        const items: { x: number; y: number; z: number; ry: number; s: number; c: THREE.Color }[] = [];
        for (let z = cz; z < Math.min(cz + CHUNK, maxZ); z += step) {
          for (let x = cx; x < Math.min(cx + CHUNK, maxX); x += step) {
            const px = x + rand() * step;
            const pz = z + rand() * step;
            // manchas: onde o ruído é alto a grama é farta, onde é baixo quase não tem
            const clump = fbm(px / 7, pz / 7, 2, 5);
            if (rand() > keep * (0.15 + 2.2 * clump * clump * 1.6)) continue;
            if (exclude?.(px, pz)) continue;
            const c = palette[Math.floor(rand() * palette.length)].clone().multiplyScalar(0.85 + rand() * 0.3);
            items.push({ x: px, y: height(px, pz) - 0.02, z: pz, ry: rand() * Math.PI * 2, s: 0.4 + rand() * 0.4 + clump * 0.25, c });
          }
        }
        if (!items.length) continue;
        const mesh = new THREE.InstancedMesh(this.geo, this.material, items.length);
        items.forEach((it, i) => {
          e.set(0, it.ry, 0);
          q.setFromEuler(e);
          p.set(it.x, it.y, it.z);
          s.set(it.s, it.s * (0.8 + 0.5 * rand()), it.s);
          mesh.setMatrixAt(i, m.compose(p, q, s));
          mesh.setColorAt(i, it.c);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        this.chunks.push({ mesh, cx: cx + CHUNK / 2, cz: cz + CHUNK / 2 });
      }
    }
  }

  /** Esconde os blocos fora do alcance (antes de a câmera desenhar). */
  update(camera: THREE.Vector3) {
    const reach = this.range + CHUNK * 0.75;
    for (const c of this.chunks) c.mesh.visible = Math.hypot(c.cx - camera.x, c.cz - camera.z) < reach;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.chunks.forEach((c) => c.mesh.dispose());
  }
}
