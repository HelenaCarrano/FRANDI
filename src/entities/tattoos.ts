import * as THREE from 'three';

/**
 * Tatuagens do Matheus (inspiradas na foto): dorso da mão direita fechado com desenhos
 * escuros (rosa, folhas, pontilhado nos dedos) e escrita vertical na lateral do pescoço.
 * Projetadas sobre a pele com `projectPrint`.
 */

const INK = '#1a1d22';
const INK_SOFT = 'rgba(26, 29, 34, 0.75)';

function texture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g, w, h);
  // borda transparente (fora da região nada aparece)
  g.clearRect(0, 0, w, 2);
  g.clearRect(0, h - 2, w, 2);
  g.clearRect(0, 0, 2, h);
  g.clearRect(w - 2, 0, 2, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mão fechada de tatuagem: desenho escuro e grosso que cobre quase toda a pele. */
export function handTattooTexture() {
  return texture(256, 256, (g, w, h) => {
    g.strokeStyle = INK;
    g.fillStyle = INK;
    // rosa grande, preenchida, com pétalas marcadas em pele
    const cx = w * 0.5;
    const cy = h * 0.5;
    g.beginPath();
    g.arc(cx, cy, w * 0.26, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = w * 0.025;
    g.strokeStyle = '#000';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(cx, cy, w * (0.07 + i * 0.065), i * 1.3, i * 1.3 + Math.PI * 1.4);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // folhas sólidas nos cantos
    for (const [dx, dy, rot] of [
      [-0.32, -0.3, -0.7],
      [0.32, -0.3, 0.7],
      [-0.32, 0.32, 0.7],
      [0.32, 0.32, -0.7],
    ] as const) {
      g.save();
      g.translate(cx + w * dx, cy + h * dy);
      g.rotate(rot);
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(0, 0, w * 0.14, w * 0.065, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // faixas grossas nas bordas (punho e dedos)
    g.fillStyle = INK_SOFT;
    g.fillRect(0, 0, w * 0.1, h);
    g.fillRect(w * 0.9, 0, w * 0.1, h);
  });
}

/** Lateral do pescoço: escrita vertical + ornamento. u = frente/trás, v = altura. */
export function neckTattooTexture() {
  return texture(128, 256, (g, w, h) => {
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.lineWidth = w * 0.05;
    // "letras" cursivas em coluna
    let y = h * 0.12;
    const x = w * 0.45;
    for (let i = 0; i < 7; i++) {
      const s = h * 0.06;
      g.beginPath();
      if (i % 3 === 0) {
        g.moveTo(x - s * 0.6, y);
        g.quadraticCurveTo(x, y - s, x + s * 0.6, y);
        g.quadraticCurveTo(x, y + s, x - s * 0.6, y + s * 0.4);
      } else if (i % 3 === 1) {
        g.moveTo(x - s * 0.7, y - s * 0.4);
        g.lineTo(x + s * 0.7, y - s * 0.4);
        g.moveTo(x, y - s * 0.6);
        g.lineTo(x, y + s * 0.6);
      } else {
        g.arc(x, y, s * 0.5, 0.3, Math.PI * 1.7);
      }
      g.stroke();
      y += h * 0.1;
    }
    // ornamento embaixo
    g.beginPath();
    g.moveTo(x, h * 0.84);
    g.lineTo(x - w * 0.22, h * 0.94);
    g.moveTo(x, h * 0.84);
    g.lineTo(x + w * 0.22, h * 0.94);
    g.stroke();
    g.beginPath();
    g.arc(x, h * 0.84, w * 0.07, 0, Math.PI * 2);
    g.fill();
  });
}

/**
 * Pescoço fechado de tatuagens (textura que dá a volta no cilindro do pescoço):
 * u = 0 frente, 0.5 nuca; v = altura. Fundo com a cor da pele.
 */
export function neckBandTexture(skin: THREE.Color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#' + skin.getHexString(THREE.SRGBColorSpace);
  g.fillRect(0, 0, c.width, c.height);
  const w = c.width;
  const h = c.height;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = 'round';
  // faixa de ornamentos (arabescos) dando a volta
  g.lineWidth = h * 0.06;
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * w;
    g.beginPath();
    g.moveTo(x, h * 0.75);
    g.bezierCurveTo(x + w * 0.02, h * 0.2, x + w * 0.05, h * 0.9, x + w * 0.06, h * 0.35);
    g.stroke();
  }
  // escrita grossa na frente (garganta)
  g.font = `bold ${h * 0.42}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('ᛗᚨ†ᚺ', w * 0.0, h * 0.5);
  g.fillText('ᛗᚨ†ᚺ', w * 1.0, h * 0.5);
  // duas cruzes na nuca
  for (const dx of [-0.05, 0.05]) {
    const x = w * (0.5 + dx);
    g.fillRect(x - w * 0.006, h * 0.15, w * 0.012, h * 0.7);
    g.fillRect(x - w * 0.02, h * 0.32, w * 0.04, h * 0.1);
  }
  // sombreado preenchido nas laterais
  g.fillStyle = INK_SOFT;
  for (const x of [w * 0.25, w * 0.75]) {
    g.beginPath();
    g.ellipse(x, h * 0.5, w * 0.07, h * 0.38, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Tatuagem pequena no rosto, ao lado do olho direito: dois traços. */
export function faceTattooTexture() {
  return texture(64, 64, (g, w, h) => {
    g.strokeStyle = INK;
    g.lineWidth = w * 0.1;
    g.beginPath();
    g.moveTo(w * 0.38, h * 0.25);
    g.lineTo(w * 0.38, h * 0.75);
    g.moveTo(w * 0.62, h * 0.25);
    g.lineTo(w * 0.62, h * 0.75);
    g.stroke();
  });
}
