import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Carregamento e cache de modelos .glb (pacotes KayKit, CC0 — ver public/models/*\/LICENSE.txt).
 * Pré-carregue com `preload` e depois pegue cópias com `model()` de forma síncrona.
 */

const BASE = `${import.meta.env.BASE_URL}models/`;
const loader = new GLTFLoader();
const cache = new Map<string, GLTF>();
/** Geometrias e materiais dos modelos em cache: as cópias de `model()` os dividem, então nunca se descartam. */
const shared = new WeakSet<object>();

export function isSharedResource(resource: object) {
  return shared.has(resource);
}

export async function preload(paths: readonly string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  await Promise.all(
    paths.map(async (p) => {
      if (!cache.has(p)) {
        const gltf = await loader.loadAsync(BASE + p + '.glb');
        prepare(gltf.scene);
        cache.set(p, gltf);
      }
      onProgress?.(++done, paths.length);
    }),
  );
}

export function gltf(path: string): GLTF {
  const g = cache.get(path);
  if (!g) throw new Error(`Modelo não pré-carregado: ${path}`);
  return g;
}

/** Cópia independente do modelo (suporta personagens com esqueleto). */
export function model(path: string): THREE.Object3D {
  return cloneSkinned(gltf(path).scene);
}

/** Ajustes aplicados uma vez a cada modelo carregado. */
function prepare(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shared.add(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      shared.add(m);
      const std = m as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial) continue;
      // Sem mapa de ambiente, metal puro fica preto no escuro; limitamos para ele ainda refletir a tocha.
      std.metalness = Math.min(std.metalness, 0.35);
      std.roughness = Math.max(std.roughness, 0.55);
      if (std.map) std.map.anisotropy = 4;
    }
  });
}

export const DUNGEON = (name: string) => `dungeon/${name}`;
export const CHARACTER = (name: string) => `characters/${name}`;
