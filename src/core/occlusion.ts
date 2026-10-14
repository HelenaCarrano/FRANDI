import * as THREE from 'three';

/**
 * Esmaece objetos (pilares, paredes) que ficam entre a câmera e o jogador,
 * para ele nunca sumir atrás de uma silhueta escura.
 */
interface Occluder {
  box: THREE.Box3;
  materials: THREE.Material[];
  opacity: number;
}

const FADED = 0.18;

export class OcclusionFader {
  private readonly occluders: Occluder[] = [];
  private readonly ray = new THREE.Ray();
  private readonly target = new THREE.Vector3();
  private readonly hitPoint = new THREE.Vector3();

  /** Registra um objeto estático. Os materiais dele são clonados para poderem esmaecer sozinhos. */
  add(obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    const materials: THREE.Material[] = [];
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const cloned = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.clone());
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      materials.push(...cloned);
    });
    this.occluders.push({ box: new THREE.Box3().setFromObject(obj), materials, opacity: 1 });
  }

  update(dt: number, camera: THREE.Camera, playerPos: THREE.Vector3) {
    this.target.set(playerPos.x, playerPos.y + 1.0, playerPos.z);
    this.ray.origin.copy(camera.position);
    this.ray.direction.copy(this.target).sub(camera.position);
    const dist = this.ray.direction.length();
    this.ray.direction.divideScalar(dist);

    const k = 1 - Math.exp(-10 * dt);
    for (const occ of this.occluders) {
      const hit = this.ray.intersectBox(occ.box, this.hitPoint);
      const blocking = hit !== null && hit.distanceTo(camera.position) < dist - 0.3;
      const goal = blocking ? FADED : 1;
      if (Math.abs(occ.opacity - goal) < 0.005) {
        if (occ.opacity !== goal) this.apply(occ, goal);
        continue;
      }
      this.apply(occ, occ.opacity + (goal - occ.opacity) * k);
    }
  }

  /** Libera os materiais clonados (ao sair da área). */
  dispose() {
    for (const occ of this.occluders) occ.materials.forEach((m) => m.dispose());
    this.occluders.length = 0;
  }

  private apply(occ: Occluder, opacity: number) {
    occ.opacity = opacity;
    const transparent = opacity < 0.999;
    for (const m of occ.materials) {
      m.opacity = opacity;
      m.transparent = transparent;
      m.depthWrite = !transparent;
    }
  }
}
