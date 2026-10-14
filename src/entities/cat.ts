import * as THREE from 'three';

/**
 * Fubá, o gatinho fugitivo: um gato laranja dormindo enroladinho, montado com formas simples
 * no estilo low-poly (não existe gato nos pacotes KayKit). Fica deitado olhando para +X.
 */
export function makeCat(): THREE.Group {
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const orange = mat(0xe8923a);
  const cream = mat(0xf6dcae);
  const dark = mat(0x3a2418);
  const pink = mat(0xf0a0a8);

  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  add(new THREE.SphereGeometry(0.34, 10, 8), orange, 0, 0.25, 0, 1.3, 0.85, 1); // corpo
  add(new THREE.SphereGeometry(0.2, 8, 6), cream, 0.1, 0.17, 0.2, 1.1, 0.7, 0.8); // barriga
  add(new THREE.SphereGeometry(0.22, 10, 8), orange, 0.42, 0.28, 0.08); // cabeça
  add(new THREE.ConeGeometry(0.07, 0.15, 4), orange, 0.4, 0.5, 0.2); // orelhas
  add(new THREE.ConeGeometry(0.07, 0.15, 4), orange, 0.4, 0.5, -0.04);
  add(new THREE.BoxGeometry(0.02, 0.02, 0.06), dark, 0.61, 0.31, 0.15); // olhinhos fechados
  add(new THREE.BoxGeometry(0.02, 0.02, 0.06), dark, 0.61, 0.31, 0.01);
  add(new THREE.SphereGeometry(0.03, 6, 5), pink, 0.64, 0.25, 0.08); // focinho
  // rabo enrolado em volta do corpo
  const tail = add(new THREE.TorusGeometry(0.3, 0.06, 6, 14, Math.PI * 1.1), orange, -0.02, 0.1, 0);
  tail.rotation.set(Math.PI / 2, 0, Math.PI * 0.55);
  return g;
}
