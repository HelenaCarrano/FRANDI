import * as THREE from 'three';

/**
 * Feixes de luar entre as copas: cones altos e finos, em mistura aditiva, que clareiam no alto e somem no chão.
 * Ficam inclinados na direção da luz da lua e só aparecem à noite (`setAmount`). Somem com a distância da câmera.
 */
export class MoonBeams {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.CylinderGeometry;

  constructor(
    spots: readonly [number, number, number][],
    /** Direção PARA a lua (unitária): o feixe cai no sentido contrário. */
    toMoon: THREE.Vector3,
    height = 26,
  ) {
    // cone aberto: estreito no alto, largo no chão
    this.geometry = new THREE.CylinderGeometry(0.4, 2.6, height, 14, 1, true).translate(0, height / 2, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uAmount: { value: 0 },
        uColor: { value: new THREE.Color(0.55, 0.78, 1.0) },
        uHeight: { value: height },
      },
      vertexShader: /* glsl */ `
        varying float vY;
        varying float vDist;
        uniform float uHeight;
        void main() {
          vY = position.y / uHeight;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDist = distance(wp.xyz, cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        uniform vec3 uColor;
        varying float vY;
        varying float vDist;
        void main() {
          // mais forte no alto e no meio; esmaece nas bordas (visto de lado) e longe
          float a = smoothstep(0.0, 0.25, vY) * smoothstep(1.0, 0.55, vY) * 0.2 * uAmount;
          a *= smoothstep(70.0, 22.0, vDist) * smoothstep(1.5, 6.0, vDist);
          if (a < 0.003) discard;
          gl_FragColor = vec4(uColor * a * 2.6, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    // inclina o cone ao longo do raio da lua (do chão para a lua)
    const axis = new THREE.Vector3(0, 1, 0).cross(toMoon).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(toMoon.y, -1, 1));
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    for (const [x, y, z] of spots) {
      const m = new THREE.Mesh(this.geometry, this.material);
      m.position.set(x, y, z);
      m.quaternion.copy(q);
      m.renderOrder = 6;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.group.visible = false;
  }

  setAmount(a: number) {
    this.material.uniforms.uAmount.value = a;
    this.group.visible = a > 0.01;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
