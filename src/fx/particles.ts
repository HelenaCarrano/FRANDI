import * as THREE from 'three';

/**
 * Escala compartilhada para converter tamanho em metros -> pixels.
 * Atualizada no resize com (altura do buffer de desenho / 2).
 */
export const pointScale = { value: 400 };

/**
 * Faíscas da tocha: partículas em espaço de mundo que sobem, oscilam e somem.
 */
export class Sparks {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly life: Float32Array;
  private readonly velocity: Float32Array;
  private readonly alpha: Float32Array;
  private spawnCursor = 0;
  private spawnAcc = 0;

  constructor(private readonly count = 40, color = new THREE.Color(1.0, 0.6, 0.2)) {
    this.positions = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.alpha = new Float32Array(count);
    for (let i = 0; i < count; i++) this.positions[i * 3 + 1] = -999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color.multiplyScalar(4) }, uSize: { value: 0.07 }, uScale: pointScale },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        uniform float uSize;
        uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (0.4 + 0.6 * aAlpha) * projectionMatrix[1][1] * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, emitter: THREE.Vector3, rate = 14) {
    this.spawnAcc += dt * rate;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const i = this.spawnCursor;
      this.spawnCursor = (this.spawnCursor + 1) % this.count;
      this.positions[i * 3] = emitter.x + (Math.random() - 0.5) * 0.1;
      this.positions[i * 3 + 1] = emitter.y + 0.05;
      this.positions[i * 3 + 2] = emitter.z + (Math.random() - 0.5) * 0.1;
      this.velocity[i * 3] = (Math.random() - 0.5) * 0.35;
      this.velocity[i * 3 + 1] = 0.7 + Math.random() * 0.8;
      this.velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
      this.life[i] = 0.6 + Math.random() * 0.8;
    }

    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.velocity[i * 3] += (Math.random() - 0.5) * 2.5 * dt;
      this.velocity[i * 3 + 2] += (Math.random() - 0.5) * 2.5 * dt;
      this.positions[i * 3] += this.velocity[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocity[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocity[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, Math.min(1, this.life[i] * 1.5));
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }
}

/**
 * Poeira flutuante que só brilha dentro do raio de luz da tocha.
 */
export class Dust {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(count: number, area: THREE.Box3) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const size = area.getSize(new THREE.Vector3());
    for (let i = 0; i < count; i++) {
      positions[i * 3] = area.min.x + Math.random() * size.x;
      positions[i * 3 + 1] = area.min.y + Math.random() * size.y;
      positions[i * 3 + 2] = area.min.z + Math.random() * size.z;
      seeds[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightPos: { value: new THREE.Vector3() },
        uRadius: { value: 5.5 },
        uScale: pointScale,
        uColor: { value: new THREE.Color(1.0, 0.75, 0.45).multiplyScalar(1.6) },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uLightPos;
        uniform float uRadius;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.25 + aSeed) * 0.35;
          p.y += sin(uTime * 0.18 + aSeed * 1.7) * 0.25;
          p.z += cos(uTime * 0.22 + aSeed * 0.6) * 0.35;
          float d = distance(p, uLightPos);
          vAlpha = smoothstep(uRadius, uRadius * 0.25, d) * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 5.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 0.05 * projectionMatrix[1][1] * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vAlpha * 0.85;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(time: number, lightPos: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uLightPos.value.copy(lightPos);
  }
}

/**
 * Fumaça de chaminé: bolinhas macias que sobem, crescem e somem. Cada emissor é uma
 * posição de mundo (boca da chaminé). Fica em espaço de mundo; adicione `points` à cena.
 */
export class Smoke {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly velocity: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly alpha: Float32Array;
  private readonly size: Float32Array;
  private cursor = 0;
  private acc = 0;

  constructor(
    private readonly emitters: readonly THREE.Vector3[],
    private readonly count = 80,
    private readonly rate = 2.4,
    color = new THREE.Color(0xfbf6ee),
    /** Multiplica o tamanho das bolinhas e a subida (cenário em escala maior). */
    private readonly sizeScale = 1,
  ) {
    this.positions = new Float32Array(count * 3);
    this.velocity = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3 + 1] = -999;
      this.life[i] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uScale: pointScale },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * projectionMatrix[1][1] * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.12, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  update(dt: number) {
    this.acc += dt * this.rate * this.emitters.length;
    while (this.acc >= 1) {
      this.acc -= 1;
      const e = this.emitters[Math.floor(Math.random() * this.emitters.length)];
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.positions[i * 3] = e.x + (Math.random() - 0.5) * 0.15;
      this.positions[i * 3 + 1] = e.y;
      this.positions[i * 3 + 2] = e.z + (Math.random() - 0.5) * 0.15;
      this.velocity[i * 3] = (0.25 + Math.random() * 0.15) * this.sizeScale; // vento leve
      this.velocity[i * 3 + 1] = (0.55 + Math.random() * 0.25) * this.sizeScale;
      this.velocity[i * 3 + 2] = (-0.1 + Math.random() * 0.1) * this.sizeScale;
      this.age[i] = 0;
      this.life[i] = 3.2 + Math.random() * 1.4;
    }
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      this.positions[i * 3] += this.velocity[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocity[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocity[i * 3 + 2] * dt;
      this.alpha[i] = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.7;
      this.size[i] = (0.5 + t * 1.5) * this.sizeScale;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
}
