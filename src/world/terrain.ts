import * as THREE from 'three';
import { fbm, hash2, smoothstep } from './noise';
import { nearestPath, type Path } from './paths';

/**
 * Terreno low poly feito em código: uma malha de triângulos de face reta com relevo suave, zonas
 * achatadas (praças, terrenos de casas), trilhas de terra pintadas pela distância à curva e cor
 * por face (grama clara e escura, terra, pedra). `heightAt` responde a altura em qualquer ponto.
 */

export interface Flat {
  x: number;
  z: number;
  /** Raio totalmente achatado. */
  r: number;
  /** Faixa em que o relevo volta aos poucos. */
  blend: number;
  /** Altura em que achata (padrão 0). */
  y?: number;
}

export interface TerrainPalette {
  grassLight: number;
  grassDark: number;
  dirt: number;
  dirtDark: number;
  rock: number;
  /** Chão sob as árvores (mais escuro). */
  forest: number;
}

export const GOLDEN_PALETTE: TerrainPalette = {
  grassLight: 0xa6c64a,
  grassDark: 0x5f9a3a,
  dirt: 0xc9762f,
  dirtDark: 0x9a5524,
  rock: 0x8c8b84,
  forest: 0x3f6b30,
};

export interface TerrainOptions {
  /** Retângulo coberto (centro em x0, z0). */
  width: number;
  depth: number;
  centerX?: number;
  centerZ?: number;
  /** Lado de cada quadrado da malha, em metros. */
  cell?: number;
  seed?: number;
  /** Altura dos morros e o comprimento de onda deles. */
  hills?: number;
  hillScale?: number;
  flats?: Flat[];
  paths?: Path[];
  /** Soma extra de altura (ex.: serra subindo nas bordas). */
  extra?: (x: number, z: number) => number;
  /** 0..1: quanto o chão é "de mata" (cor mais escura) em (x, z). */
  forest?: (x: number, z: number) => number;
  palette?: TerrainPalette;
}

export class Terrain {
  readonly mesh: THREE.Mesh;
  private readonly o: Required<Omit<TerrainOptions, 'extra' | 'forest'>> & Pick<TerrainOptions, 'extra' | 'forest'>;

  constructor(opts: TerrainOptions) {
    this.o = {
      centerX: 0,
      centerZ: 0,
      cell: 1.8,
      seed: 5,
      hills: 3,
      hillScale: 40,
      flats: [],
      paths: [],
      palette: GOLDEN_PALETTE,
      ...opts,
    };
    this.mesh = this.build();
    this.mesh.name = 'terrain';
  }

  /** Altura do terreno em (x, z). */
  heightAt = (x: number, z: number): number => {
    const { hills, hillScale, seed, flats, paths, extra } = this.o;
    let h = (fbm(x / hillScale + 11.3, z / hillScale - 4.7, 3, seed) - 0.5) * 2 * hills;
    if (paths.length) {
      // perto da trilha o relevo é mais manso (a estrada não despenca)
      h *= 0.35 + 0.65 * smoothstep(1, 9, Math.max(0, nearestPath(paths, x, z)));
    }
    for (const f of flats) {
      const w = smoothstep(f.r, f.r + f.blend, Math.hypot(x - f.x, z - f.z));
      h = (f.y ?? 0) * (1 - w) + h * w;
    }
    return h + (extra ? extra(x, z) : 0);
  };

  /** Inclinação (0 plano, 1 = 45°) perto de (x, z). */
  slopeAt(x: number, z: number) {
    const e = 0.8;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  private build() {
    const { width, depth, centerX, centerZ, cell, seed, paths, palette } = this.o;
    const nx = Math.ceil(width / cell);
    const nz = Math.ceil(depth / cell);
    const x0 = centerX - width / 2;
    const z0 = centerZ - depth / 2;

    // vértices da grade, com um leve tremor para a malha parecer talhada à mão
    const vx = new Float32Array((nx + 1) * (nz + 1));
    const vz = new Float32Array((nx + 1) * (nz + 1));
    const vy = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        const edge = i === 0 || j === 0 || i === nx || j === nz;
        const jx = edge ? 0 : (hash2(i, j, seed) - 0.5) * cell * 0.5;
        const jz = edge ? 0 : (hash2(i, j, seed + 99) - 0.5) * cell * 0.5;
        vx[k] = x0 + i * cell + jx;
        vz[k] = z0 + j * cell + jz;
        vy[k] = this.heightAt(vx[k], vz[k]);
      }
    }

    const positions = new Float32Array(nx * nz * 6 * 3);
    const colors = new Float32Array(nx * nz * 6 * 3);
    const c = new THREE.Color();
    const grassLight = new THREE.Color(palette.grassLight);
    const grassDark = new THREE.Color(palette.grassDark);
    const dirt = new THREE.Color(palette.dirt);
    const dirtDark = new THREE.Color(palette.dirtDark);
    const rock = new THREE.Color(palette.rock);
    const forest = new THREE.Color(palette.forest);
    const dirtColor = new THREE.Color();

    let p = 0;
    const tri = (a: number, b: number, d: number, face: number) => {
      const cx = (vx[a] + vx[b] + vx[d]) / 3;
      const cz = (vz[a] + vz[b] + vz[d]) / 3;
      const ux = vx[b] - vx[a];
      const uy = vy[b] - vy[a];
      const uz = vz[b] - vz[a];
      const wx = vx[d] - vx[a];
      const wy = vy[d] - vy[a];
      const wz = vz[d] - vz[a];
      // normal da face: a razão horizontal/vertical é a inclinação (1 = 45°)
      const steep = Math.hypot(uy * wz - uz * wy, ux * wy - uy * wx) / Math.max(1e-6, Math.abs(uz * wx - ux * wz));

      // grama: mistura clara/escura por ruído de manchas + variação por face
      const patch = fbm(cx / 9, cz / 9, 2, seed + 3);
      c.copy(grassDark).lerp(grassLight, THREE.MathUtils.clamp(patch * 1.5 - 0.1 + (face - 0.5) * 0.28, 0, 1));
      if (this.o.forest) c.lerp(forest, this.o.forest(cx, cz) * 0.8);
      // encostas ficam de pedra
      c.lerp(rock, smoothstep(0.55, 1.1, steep) * 0.85);
      // trilha: terra batida, com borda desbotada
      if (paths.length) {
        const d = nearestPath(paths, cx, cz);
        const m = 1 - smoothstep(-0.2, 1.1, d);
        if (m > 0) {
          dirtColor.copy(dirt).lerp(dirtDark, THREE.MathUtils.clamp((face - 0.35) * 1.6, 0, 1) * 0.7);
          c.lerp(dirtColor, m);
        }
      }
      for (const k of [a, b, d]) {
        positions[p * 3] = vx[k];
        positions[p * 3 + 1] = vy[k];
        positions[p * 3 + 2] = vz[k];
        colors[p * 3] = c.r;
        colors[p * 3 + 1] = c.g;
        colors[p * 3 + 2] = c.b;
        p++;
      }
    };

    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const d = a + (nx + 1);
        const e = d + 1;
        const f1 = hash2(i, j, seed + 1);
        const f2 = hash2(i, j, seed + 2);
        // diagonal alternada: a malha não mostra uma direção só
        if ((i + j) % 2 === 0) {
          tri(a, d, b, f1);
          tri(b, d, e, f2);
        } else {
          tri(a, d, e, f1);
          tri(a, e, b, f2);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
