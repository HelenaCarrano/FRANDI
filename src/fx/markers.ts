import * as THREE from 'three';
import { pointScale } from './particles';

/**
 * Marcadores pequenos sobre o mundo: "!" sobre quem tem algo a dizer e brilho dos achados.
 * São `Points` (e não Sprites) porque o passe de oclusão ambiente ignora Points; um Sprite
 * viraria um quadrado opaco na profundidade e escureceria a cena.
 */

let exclamation: THREE.CanvasTexture | null = null;
let star: THREE.CanvasTexture | null = null;

function canvasTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type Marker = THREE.Points & { setSize(meters: number): void };

function marker(map: THREE.Texture, size: number, additive: boolean): Marker {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uSize: { value: size }, uScale: pointScale },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uScale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * projectionMatrix[1][1] * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      void main() {
        vec4 c = texture2D(uMap, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        if (c.a < 0.01) discard;
        gl_FragColor = vec4(c.rgb * c.a, c.a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(geo, mat) as unknown as Marker;
  points.frustumCulled = false;
  points.renderOrder = 20;
  points.setSize = (m) => (mat.uniforms.uSize.value = m);
  return points;
}

/** Bolinha dourada com "!" — marca quem tem uma conversa nova. */
export function exclamationMarker(): Marker {
  exclamation ??= canvasTexture((g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.46);
    grad.addColorStop(0, '#ffe9a8');
    grad.addColorStop(1, '#e8a93c');
    g.fillStyle = grad;
    g.strokeStyle = '#6a4210';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#5a3508';
    g.font = `700 ${s * 0.62}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', s / 2, s * 0.54);
  });
  return marker(exclamation, 0.55, false);
}

/** Estrelinha dourada brilhante — denuncia um achado escondido. */
export function sparkleMarker(): Marker {
  star ??= canvasTexture((g, s) => {
    const c = s / 2;
    const glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,240,180,0.95)');
    glow.addColorStop(0.35, 'rgba(255,200,90,0.35)');
    glow.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#fffbe8';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? s * 0.4 : s * 0.07;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
  return marker(star, 0.8, true);
}
