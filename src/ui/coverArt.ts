/**
 * Arte animada da capa, em pixel art (320 x 180 ampliados): céu do fim de tarde com estrelas e lua, montanhas, colinas
 * com fileiras de vinhedo, um caminho até a casinha de janelas acesas e fumaça na chaminé, o Matheus montado no Armin,
 * pinheiros emoldurando a cena, vagalumes e folhas caindo. Tudo desenhado em código, sem arquivos de imagem.
 */

const VW = 320;
const VH = 180;

const rand = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Coloca a arte dentro de `parent` e devolve uma função que a para e remove. */
export function startCover(parent: HTMLElement): () => void {
  const cv = document.createElement('canvas');
  cv.className = 'start-art';
  cv.width = VW;
  cv.height = VH;
  parent.prepend(cv);
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  const fit = () => {
    const s = Math.max(innerWidth / VW, innerHeight / VH);
    cv.style.width = `${VW * s}px`;
    cv.style.height = `${VH * s}px`;
  };
  fit();
  addEventListener('resize', fit);

  const r = rand(77);
  const stars = Array.from({ length: 70 }, () => ({ x: r() * VW, y: r() * 82, p: r() * 6, s: r() < 0.15 ? 2 : 1 }));
  const flies = Array.from({ length: 26 }, () => ({ x: r() * VW, y: 110 + r() * 66, p: r() * 6, v: 4 + r() * 8 }));
  const leaves = Array.from({ length: 14 }, () => ({ x: r() * VW, y: r() * VH, p: r() * 6, v: 6 + r() * 8 }));
  const clouds = [
    { x: 30, y: 26, w: 46, v: 1.6 },
    { x: 150, y: 44, w: 62, v: 1.1 },
    { x: 250, y: 20, w: 40, v: 1.9 },
    { x: 90, y: 62, w: 34, v: 0.8 },
  ];

  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  /** Contorno de colinas/montanhas: preenche de uma linha de topo até o chão. */
  const ridge = (c: string, base: number, amp: number, freq: number, phase: number, bottom = VH) => {
    g.fillStyle = c;
    for (let x = 0; x < VW; x++) {
      const y = base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.45;
      g.fillRect(x, Math.round(y), 1, bottom - Math.round(y));
    }
  };

  const pine = (x: number, y: number, h: number, sway: number, c1: string, c2: string) => {
    for (let i = 0; i < 5; i++) {
      const w = Math.round((h * (0.18 + i * 0.1)) | 0);
      const yy = y - h + i * (h / 6);
      const sx = Math.round(sway * (1 - i / 6));
      px(c1, x - w + sx, yy, w * 2, Math.round(h / 5));
      px(c2, x - w + sx, yy, w, Math.round(h / 5));
    }
    px('#1a0e10', x - 1, y - 4, 3, 6);
  };

  const frame = (now: number) => {
    const t = now / 1000;
    // céu em faixas: do roxo noturno ao dourado do horizonte
    const bands = ['#160f33', '#1e1442', '#2a1a54', '#3e2266', '#5c2a72', '#85367a', '#b0467a', '#d8607a', '#f08a68', '#ffb070', '#ffd890'];
    const bandH = 10.6;
    bands.forEach((c, i) => px(c, 0, i * bandH, VW, bandH + 1));
    // estrelas que cintilam
    for (const s of stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + s.p));
      g.globalAlpha = a * (s.y > 55 ? 0.4 : 1);
      px('#fff6d8', s.x, s.y, s.s, s.s);
    }
    g.globalAlpha = 1;
    // lua com brilho
    for (let i = 14; i > 0; i -= 2) {
      g.globalAlpha = 0.05;
      px('#ffe8b0', 246 - i, 30 - i, i * 2, i * 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff4d0';
    for (let dy = -8; dy <= 8; dy++) g.fillRect(246 - Math.round(Math.sqrt(64 - dy * dy)), 30 + dy, Math.round(Math.sqrt(64 - dy * dy) * 2), 1);
    px('#e8d8a8', 243, 27, 3, 3);
    px('#e8d8a8', 249, 32, 2, 2);
    // nuvens rosadas que passam devagar
    for (const c of clouds) {
      const x = ((c.x + t * c.v) % (VW + 80)) - 40;
      g.globalAlpha = 0.85;
      px('#ff9a8a', x, c.y, c.w, 5);
      px('#ffc8a0', x + 4, c.y - 3, c.w - 12, 4);
      px('#d8688a', x + 2, c.y + 5, c.w - 6, 2);
      g.globalAlpha = 1;
    }
    // montanhas ao longe
    ridge('#5a3a78', 92, 12, 0.035, 1.2);
    ridge('#46306a', 104, 9, 0.05, 3.4);
    // colinas com fileiras de vinhedo
    ridge('#3a3a5a', 116, 6, 0.04, 0.4);
    for (let row = 0; row < 7; row++) {
      for (let x = 20 + row * 3; x < VW; x += 5) {
        const y = 118 + row * 3 + Math.sin(x * 0.04 + 0.4) * 5;
        px(row % 2 ? '#6a3a8a' : '#4a2a6a', x, y, 2, 2);
      }
    }
    // campo à frente, em tons de azul-esverdeado e dourado
    ridge('#2e4a48', 134, 5, 0.03, 2.2);
    ridge('#264038', 150, 4, 0.045, 4.1);
    for (let i = 0; i < 90; i++) {
      const x = (i * 37) % VW;
      const y = 140 + ((i * 53) % 38);
      px(i % 3 ? '#4a7a5a' : '#c8a850', x, y, 1, 1 + (i % 2));
    }
    // o caminho: sai de baixo e serpenteia até a casa
    for (let y = VH; y > 112; y--) {
      const k = (y - 112) / (VH - 112);
      const cx = 205 + Math.sin(y * 0.055 + 0.8) * 28 * k - (1 - k) * 8 + (1 - k) * 0;
      const w = 4 + k * 26;
      px('#c89a60', cx - w / 2, y, w, 1);
      px('#e8c088', cx - w / 2, y, Math.max(1, w * 0.15), 1);
      px('#8a6a40', cx + w / 2 - 1, y, 1, 1);
    }
    // a casinha, de janelas acesas, e a fumaça
    const hx = 205;
    const hy = 112;
    px('#2a1a24', hx - 17, hy - 4, 34, 3);
    px('#e8cfa0', hx - 15, hy - 18, 30, 15);
    px('#c8a878', hx + 9, hy - 18, 6, 15);
    px('#7a3036', hx - 19, hy - 28, 38, 11);
    px('#a8403e', hx - 17, hy - 31, 34, 5);
    px('#c85a4a', hx - 17, hy - 31, 34, 1);
    px('#5a3a28', hx + 7, hy - 40, 6, 12);
    const glow = 0.75 + Math.sin(t * 3) * 0.12;
    g.globalAlpha = glow;
    px('#ffd070', hx - 12, hy - 15, 6, 6);
    px('#ffd070', hx + 4, hy - 15, 6, 6);
    g.globalAlpha = 1;
    px('#5a3a28', hx - 3, hy - 12, 6, 9);
    px('#fff0a0', hx - 11, hy - 14, 2, 2);
    // brilho quente em volta da casa
    for (let i = 5; i > 0; i--) {
      g.globalAlpha = 0.045;
      px('#ffc070', hx - 14 - i * 6, hy - 22 - i * 3, 28 + i * 12, 24 + i * 6);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.28 + i / 6) % 1;
      g.globalAlpha = 0.55 * (1 - k);
      px('#e8e0f0', hx + 9 + Math.sin(t + i * 2) * 3 + k * 8, hy - 42 - k * 34, 3 + k * 4, 3 + k * 4);
    }
    g.globalAlpha = 1;
    // cerquinha ao lado
    for (let i = 0; i < 6; i++) px('#6a4a38', hx + 22 + i * 4, hy - 5 - (i % 2), 1, 5);
    px('#6a4a38', hx + 22, hy - 4, 24, 1);
    // Matheus montado no Armin, subindo o caminho
    const bob = Math.round(Math.sin(t * 5) * 0.8);
    const mx = 176;
    const my = 146 + bob;
    px('#1a0e10', mx - 11, my - 7, 21, 11);
    px('#7a4a2a', mx - 10, my - 6, 19, 9);
    px('#a8683a', mx - 10, my - 6, 19, 2);
    px('#7a4a2a', mx + 6, my - 12, 6, 8);
    px('#1a0e10', mx + 9, my - 12, 5, 6);
    px('#7a4a2a', mx + 10, my - 11, 3, 4);
    px('#1c1008', mx - 12, my - 5, 2, 9);
    const step = Math.floor(t * 5) % 2;
    for (const [lx, d] of [[-8, 0], [-4, 1], [3, 1], [7, 0]] as const) px('#4a2a18', mx + lx, my + 2, 2, 6 - (step === d ? 2 : 0));
    // o cavaleiro: moletom preto, cabelo escuro, a tocha acesa
    px('#1a1a22', mx - 3, my - 17, 7, 10);
    px('#2a2a34', mx - 3, my - 17, 2, 10);
    px('#f0bc92', mx - 2, my - 22, 5, 5);
    px('#3a2316', mx - 3, my - 24, 7, 3);
    px('#6a4428', mx + 5, my - 21, 1, 9);
    g.globalAlpha = 0.8 + Math.sin(t * 14) * 0.2;
    px('#ffb040', mx + 4, my - 25, 3, 4);
    px('#ffe070', mx + 5, my - 24, 1, 2);
    g.globalAlpha = 1;
    // pinheiros que emolduram a cena
    const sway = Math.sin(t * 0.8) * 1.2;
    pine(22, 182, 118, sway, '#10201c', '#1a3228');
    pine(62, 186, 84, sway * 0.8, '#0e1c18', '#183024');
    pine(-4, 190, 138, sway * 1.2, '#0a1612', '#12281e');
    pine(298, 184, 124, -sway, '#10201c', '#1a3228');
    pine(268, 188, 86, -sway * 0.8, '#0e1c18', '#183024');
    pine(326, 190, 134, -sway * 1.2, '#0a1612', '#12281e');
    // vagalumes
    for (const f of flies) {
      const x = f.x + Math.sin(t * 0.7 + f.p) * 10;
      const y = f.y + Math.cos(t * 0.9 + f.p) * 6 - ((t * f.v * 0.1) % 8);
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + f.p));
      g.globalAlpha = a * 0.28;
      px('#ffe070', x - 1, y - 1, 3, 3);
      g.globalAlpha = a;
      px('#fff4a0', x, y, 1, 1);
    }
    g.globalAlpha = 1;
    // folhas de outono caindo
    for (const l of leaves) {
      const x = (l.x + Math.sin(t + l.p) * 8 + t * 4) % (VW + 10);
      const y = (l.y + t * l.v) % (VH + 10);
      px(l.p > 3 ? '#e8802a' : '#c8503a', x, y, 2, 1);
    }
    raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', fit);
    cv.remove();
  };
}
