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

/** Mantém o jogador DENTRO de um círculo (limite do mapa). */
export interface BoundsCollider {
  kind: 'bounds';
  x: number;
  z: number;
  r: number;
}

export type Collider = CircleCollider | BoxCollider | BoundsCollider;

export class CollisionWorld {
  readonly colliders: Collider[] = [];

  addCircle(x: number, z: number, r: number) {
    const c: CircleCollider = { kind: 'circle', x, z, r };
    this.colliders.push(c);
    return c;
  }

  addBox(minX: number, maxX: number, minZ: number, maxZ: number) {
    const c: BoxCollider = { kind: 'box', minX, maxX, minZ, maxZ };
    this.colliders.push(c);
    return c;
  }

  addBounds(x: number, z: number, r: number) {
    const c: BoundsCollider = { kind: 'bounds', x, z, r };
    this.colliders.push(c);
    return c;
  }

  remove(c: Collider) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  /** Empurra a posição para fora de qualquer colisor (corpo do jogador = círculo de raio r). */
  resolve(pos: THREE.Vector3, r: number) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (c.kind === 'bounds') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const max = c.r - r;
          const d2 = dx * dx + dz * dz;
          if (d2 > max * max) {
            const d = Math.sqrt(d2);
            pos.x = c.x + (dx / d) * max;
            pos.z = c.z + (dz / d) * max;
          }
        } else if (c.kind === 'circle') {
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
