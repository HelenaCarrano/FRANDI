import * as THREE from 'three';
import { gltf, model } from '../core/assets';
import type { CollisionWorld } from '../core/collision';

/**
 * Coloca modelos .glb do KayKit na cena apoiados no terreno, com colisão pela pegada da peça.
 * (A Vila e as demais áreas usavam cópias disso; agora é um lugar só.)
 */
export class Placer {
  private readonly boxes = new Map<string, THREE.Box3>();

  constructor(
    readonly scene: THREE.Scene,
    readonly world: CollisionWorld,
    /** Pasta dos modelos, ex.: `village/`. */
    private readonly folder: string,
    private readonly ground: (x: number, z: number) => number = () => 0,
  ) {}

  path(name: string) {
    return this.folder + name;
  }

  /** Cópia do modelo na posição, apoiada no terreno (a menos que `y` seja dado). */
  place(name: string, x: number, z: number, rotY = 0, scale = 1, opts: { y?: number; cast?: boolean; receive?: boolean } = {}) {
    const m = model(this.path(name));
    m.position.set(x, opts.y ?? this.ground(x, z), z);
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
    if (opts.cast === false || opts.receive === false) {
      m.traverse((o) => {
        if (opts.cast === false) o.castShadow = false;
        if (opts.receive === false) o.receiveShadow = false;
      });
    }
    this.scene.add(m);
    return m;
  }

  /** Caixa do modelo original (sem escala nem rotação). */
  box(name: string) {
    let b = this.boxes.get(name);
    if (!b) {
      b = new THREE.Box3().setFromObject(gltf(this.path(name)).scene);
      this.boxes.set(name, b);
    }
    return b;
  }

  /** Colisão de uma peça: círculos enfileirados ao longo do lado maior da pegada dela. */
  footprint(name: string, x: number, z: number, rotY: number, scale: number, shrink = 0.9) {
    const b = this.box(name);
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
    const circles: ReturnType<CollisionWorld['addCircle']>[] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : -(len / 2 - r) + (i * (len - 2 * r)) / (n - 1);
      const lx = cx + (along ? t : 0);
      const lz = cz + (along ? 0 : t);
      circles.push(this.world.addCircle(x + lx * cos + lz * sin, z - lx * sin + lz * cos, r));
    }
    return circles;
  }

  /** Peça com colisão. */
  solid(name: string, x: number, z: number, rotY: number, scale: number, shrink = 0.9) {
    const m = this.place(name, x, z, rotY, scale);
    this.footprint(name, x, z, rotY, scale, shrink);
    return m;
  }

  /** Ponto na frente de uma peça (a porta olha para +Z local), com `side` para a direita de quem olha a porta. */
  static front(x: number, z: number, rotY: number, dist: number, side = 0) {
    return new THREE.Vector3(x + Math.sin(rotY) * dist + Math.cos(rotY) * side, 0, z + Math.cos(rotY) * dist - Math.sin(rotY) * side);
  }
}
