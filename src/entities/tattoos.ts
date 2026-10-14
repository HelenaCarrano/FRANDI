import * as THREE from 'three';

/**
 * Tatuagens e pintura do Matheus (inspiradas na foto): dorso da mão direita fechado com desenhos
 * escuros (rosa, folhas, pontilhado nos dedos), pescoço fechado de tatuagens (textura que dá a
 * volta no cilindro do pescoço) e a "pintura" do rosto (sobrancelhas, brilho dos olhos, rosado e
 * dois traços ao lado do olho direito). Mão e rosto são projetados sobre a pele com `projectPrint`.
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

export interface NeckBandSpec {
  /** Circunferência ÷ altura do cilindro: o canvas segue essa proporção para o desenho não esticar. */
  aspect: number;
  /** Trecho do cilindro que fica à vista, entre o moletom e a cabeça (0 = base, 1 = topo). */
  visibleFrom: number;
  visibleTo: number;
}

/** Símbolos riscados à mão (sem fonte: letras rúnicas viram quadradinhos em muitos aparelhos). */
function glyph(g: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number) {
  g.beginPath();
  switch (kind % 4) {
    case 0: // M
      g.moveTo(x - s * 0.5, y + s * 0.5);
      g.lineTo(x - s * 0.5, y - s * 0.5);
      g.lineTo(x, y);
      g.lineTo(x + s * 0.5, y - s * 0.5);
      g.lineTo(x + s * 0.5, y + s * 0.5);
      break;
    case 1: // A
      g.moveTo(x - s * 0.5, y + s * 0.5);
      g.lineTo(x, y - s * 0.5);
      g.lineTo(x + s * 0.5, y + s * 0.5);
      g.moveTo(x - s * 0.25, y + s * 0.12);
      g.lineTo(x + s * 0.25, y + s * 0.12);
      break;
    case 2: // cruz
      g.moveTo(x, y - s * 0.55);
      g.lineTo(x, y + s * 0.55);
      g.moveTo(x - s * 0.32, y - s * 0.2);
      g.lineTo(x + s * 0.32, y - s * 0.2);
      break;
    default: // H
      g.moveTo(x - s * 0.4, y - s * 0.5);
      g.lineTo(x - s * 0.4, y + s * 0.5);
      g.moveTo(x + s * 0.4, y - s * 0.5);
      g.lineTo(x + s * 0.4, y + s * 0.5);
      g.moveTo(x - s * 0.4, y);
      g.lineTo(x + s * 0.4, y);
  }
  g.stroke();
}

/**
 * Pescoço fechado de tatuagens (textura que dá a volta no cilindro do pescoço):
 * u = 0 frente (garganta), 0.25 lado esquerdo dele (+X), 0.5 nuca, 0.75 lado direito (−X).
 * Fundo com a cor da pele. Todo o desenho fica na faixa que aparece (entre moletom e cabeça).
 */
export function neckBandTexture(skin: THREE.Color, spec: NeckBandSpec) {
  const w = 1024;
  const h = Math.max(64, Math.round(w / spec.aspect));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const skinCss = '#' + skin.getHexString(THREE.SRGBColorSpace);
  g.fillStyle = skinCss;
  g.fillRect(0, 0, w, h);

  // v = 1 é o topo do cilindro e o topo do canvas
  const top = (1 - spec.visibleTo) * h;
  const bottom = (1 - spec.visibleFrom) * h;
  const bh = bottom - top;
  const cy = (top + bottom) / 2;
  const lw = Math.max(4, bh * 0.15);
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // fio ondulado dando a volta (os símbolos ficam por cima)
  g.lineWidth = lw * 0.7;
  g.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const y = cy + Math.sin((x / w) * Math.PI * 2 * 12) * bh * 0.2;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // bolinhas entre as ondas
  for (let i = 0; i < 24; i++) {
    g.beginPath();
    g.arc(((i + 0.5) / 24) * w, cy + (i % 2 ? -1 : 1) * bh * 0.36, lw * 0.4, 0, Math.PI * 2);
    g.fill();
  }

  /** Limpa uma faixa em volta de um grupo de símbolos para ele não se misturar com o fio. */
  const clearBox = (x: number, ww: number) => {
    g.fillStyle = skinCss;
    g.fillRect(x - ww / 2, top, ww, bh);
    g.fillStyle = INK;
  };

  // garganta: quatro símbolos grossos (a costura da textura está na frente: repete dos dois lados)
  g.lineWidth = lw;
  const sym = bh * 0.62;
  const gap = sym * 1.35;
  for (const x0 of [0, w]) {
    clearBox(x0, gap * 4.2);
    for (let k = 0; k < 4; k++) glyph(g, k, x0 + (k - 1.5) * gap, cy, sym);
  }

  // lado direito dele (−X, u = 0.75): coluna de traços de escrita vertical
  {
    const x = w * 0.75;
    clearBox(x, sym * 1.6);
    g.lineWidth = lw * 0.9;
    for (let k = 0; k < 3; k++) {
      const gx = x + (k - 1) * sym * 0.6;
      g.beginPath();
      g.moveTo(gx, top + bh * 0.12);
      g.bezierCurveTo(gx + sym * 0.25, cy - bh * 0.15, gx - sym * 0.25, cy + bh * 0.15, gx, bottom - bh * 0.12);
      g.stroke();
    }
  }

  // nuca: duas cruzes
  for (const dx of [-0.04, 0.04]) {
    const x = w * (0.5 + dx);
    clearBox(x, sym * 1.2);
    g.lineWidth = lw * 1.1;
    g.beginPath();
    g.moveTo(x, top + bh * 0.06);
    g.lineTo(x, bottom - bh * 0.06);
    g.moveTo(x - sym * 0.4, top + bh * 0.34);
    g.lineTo(x + sym * 0.4, top + bh * 0.34);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export interface FaceDecalSpec {
  /** Retângulo projetado sobre o rosto, no espaço da cabeça (x e y). */
  rect: { minX: number; maxX: number; minY: number; maxY: number };
  /** Olhos: centro e raios (+x = lado esquerdo dele, −x = lado direito). */
  eyes: { x: number; y: number; rx: number; ry: number }[];
  /** Sobrancelha: comprimento, espessura e distância do centro do olho ao centro do traço. */
  brow: { len: number; thick: number; y: number; color: string };
  /** Rosado das bochechas: queda abaixo do olho, raios e deslocamento para fora. */
  blush: { drop: number; rx: number; ry: number; out: number };
  /** Dois traços verticais ao lado do olho direito. */
  tattoo: { x: number; y: number; h: number; gap: number };
  /** Sorrisinho na boca (centro, largura e espessura); ausente se a boca não foi encontrada. */
  smile?: { x: number; y: number; w: number; thick: number };
}

/**
 * Pintura do rosto, projetada sobre a pele (`projectPrint` com `soft`): sobrancelhas, brilho dos
 * olhos, bochechas rosadas e os dois traços da tatuagem. Por ser feita na própria malha, nada
 * flutua nem afunda na pele.
 */
export function faceDecalTexture(spec: FaceDecalSpec) {
  const { rect, eyes, brow, blush, tattoo, smile } = spec;
  const w = 768;
  const k = w / (rect.maxX - rect.minX); // pixels por unidade
  const h = Math.round((rect.maxY - rect.minY) * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const px = (x: number) => (x - rect.minX) * k;
  const py = (y: number) => (rect.maxY - y) * k; // topo do canvas = y máximo
  const midX = eyes.reduce((a, e) => a + e.x, 0) / eyes.length;

  // rosado nas bochechas
  for (const e of eyes) {
    const side = e.x > midX ? 1 : -1;
    g.save();
    g.translate(px(e.x + side * blush.out), py(e.y - blush.drop));
    g.scale(blush.rx * k, blush.ry * k);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(236, 104, 104, 0.55)');
    grad.addColorStop(0.55, 'rgba(236, 104, 104, 0.3)');
    grad.addColorStop(1, 'rgba(236, 104, 104, 0)');
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  }

  // sobrancelhas: traço grosso, de ponta redonda e levemente arqueado
  g.strokeStyle = brow.color;
  g.lineWidth = brow.thick * k;
  for (const e of eyes) {
    const y = e.y + brow.y;
    g.beginPath();
    g.moveTo(px(e.x - brow.len / 2), py(y));
    g.quadraticCurveTo(px(e.x), py(y + brow.thick * 0.35), px(e.x + brow.len / 2), py(y));
    g.stroke();
  }

  // brilho dos olhos: um ponto grande em cima e um pequeno embaixo, do mesmo lado nos dois
  g.fillStyle = '#ffffff';
  for (const e of eyes) {
    g.beginPath();
    g.arc(px(e.x + e.rx * 0.3), py(e.y + e.ry * 0.32), e.rx * 0.3 * k, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(px(e.x - e.rx * 0.3), py(e.y - e.ry * 0.38), e.rx * 0.13 * k, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  // tatuagem do rosto: dois traços verticais
  g.strokeStyle = INK;
  g.lineWidth = tattoo.h * 0.2 * k;
  for (const dx of [-0.5, 0.5]) {
    g.beginPath();
    g.moveTo(px(tattoo.x + dx * tattoo.gap), py(tattoo.y + tattoo.h / 2));
    g.lineTo(px(tattoo.x + dx * tattoo.gap), py(tattoo.y - tattoo.h / 2));
    g.stroke();
  }

  // sorrisinho: curva suave com os cantos para cima
  if (smile) {
    g.strokeStyle = '#7a3b30';
    g.lineWidth = smile.thick * k;
    g.beginPath();
    g.moveTo(px(smile.x - smile.w / 2), py(smile.y));
    g.quadraticCurveTo(px(smile.x), py(smile.y - smile.w * 0.4), px(smile.x + smile.w / 2), py(smile.y));
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
