import * as THREE from 'three';

/** Colisão simples no plano XZ: círculos (pilares, objetos) e caixas (paredes). */

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export interface BoxCollider {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Collider = CircleCollider | BoxCollider;

export class CollisionWorld {
  readonly colliders: Collider[] = [];

  addCircle(x: number, z: number, r: number) {
    this.colliders.push({ kind: 'circle', x, z, r });
  }

  addBox(minX: number, maxX: number, minZ: number, maxZ: number) {
    this.colliders.push({ kind: 'box', minX, maxX, minZ, maxZ });
  }

  /** Empurra a posição para fora de qualquer colisor (corpo do jogador = círculo de raio r). */
  resolve(pos: THREE.Vector3, r: number) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (c.kind === 'circle') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const min = c.r + r;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x = c.x + (dx / d) * min;
            pos.z = c.z + (dz / d) * min;
          }
        } else {
          const cx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
          const cz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
          const dx = pos.x - cx;
          const dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              pos.x = cx + (dx / d) * r;
              pos.z = cz + (dz / d) * r;
            } else {
              // centro dentro da caixa: sai pelo lado mais próximo
              const left = pos.x - c.minX;
              const right = c.maxX - pos.x;
              const top = pos.z - c.minZ;
              const bottom = c.maxZ - pos.z;
              const m = Math.min(left, right, top, bottom);
              if (m === left) pos.x = c.minX - r;
              else if (m === right) pos.x = c.maxX + r;
              else if (m === top) pos.z = c.minZ - r;
              else pos.z = c.maxZ + r;
            }
          }
        }
      }
    }
  }
}
