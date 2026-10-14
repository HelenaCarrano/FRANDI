import * as THREE from 'three';
import { clampCloseLights } from './matheusModel';

/**
 * Mochila de couro com saco de dormir em cima, feita de formas simples. O eixo +Z aponta para
 * longe do corpo (para trás do Matheus) e o ponto (0,0,0) fica encostado nas costas.
 */
export function buildBackpack(): THREE.Group {
  const mat = (color: number) => clampCloseLights(new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
  const leather = mat(0x8a5a2b);
  const flapMat = mat(0x6f4520);
  const roll = mat(0xb9915a);
  const strap = mat(0x3b2614);
  const metal = mat(0xc9a24a);

  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  box(0.36, 0.42, 0.18, leather, 0, 0, 0.1); // corpo
  box(0.38, 0.17, 0.2, flapMat, 0, 0.17, 0.11); // aba
  box(0.26, 0.15, 0.06, flapMat, 0, -0.1, 0.22); // bolso da frente
  box(0.05, 0.05, 0.02, metal, 0, 0.09, 0.22); // fivela
  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10), roll);
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.34, 0.1);
  bedroll.castShadow = true;
  g.add(bedroll);
  box(0.05, 0.5, 0.02, strap, -0.11, 0.0, 0.0); // alças
  box(0.05, 0.5, 0.02, strap, 0.11, 0.0, 0.0);
  return g;
}
