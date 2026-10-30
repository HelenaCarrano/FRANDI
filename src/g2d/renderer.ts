import { OUTLINE, PAL, ROCK, lerpRGB, makeCanvas, mulberry32, rgba } from './art';
import type { Fx } from './fx';
import type { Kit } from './kit';
import type { Area2D, Drawable, Light, Prop } from './types';

/**
 * Desenha a cena em pixels grandes (cerca de 200 linhas de altura) e depois acende as luzes por cima na resolução da tela:
 * mapa de luz multiplicado, brilhos somados, raios de sol, névoa, brilho (bloom), gradação de cor e vinheta.
 */

export interface FrameInput {
  area: Area2D;
  camX: number;
  camY: number;
  time: number;
  dt: number;
  /** Jogador (ou câmera): para o mato se afastar, copas ficarem transparentes etc. */
  focus: { x: number; y: number; moving: boolean };
  entities: Drawable[];
  lights: Light[];
  fx: Fx;
}

export class Renderer {
  readonly view = makeCanvas(360, 202);
  private readonly light = makeCanvas(10, 10);
  private readonly bloom = makeCanvas(10, 10);
  private readonly fgTmp = makeCanvas(10, 10);
  private readonly dapplePattern: CanvasPattern;
  private readonly sunPattern: CanvasPattern;
  private readonly fgPattern: CanvasPattern;
  private readonly sctx: CanvasRenderingContext2D;
  private readonly falling: { x: number; y: number; p: number; c: string }[];
  private readonly dust: { x: number; y: number; p: number }[];
  viewW = 360;
  viewH = 202;
  scale = 4;

  constructor(private readonly screen: HTMLCanvasElement, private readonly kit: Kit) {
    this.sctx = screen.getContext('2d')!;
    const rng = mulberry32(777);
    const tau = (Math.PI * 2) / 192;
    const dapple = makeCanvas(192, 192);
    const sun = makeCanvas(192, 192);
    for (let y = 0; y < 192; y++) {
      for (let x = 0; x < 192; x++) {
        const n = Math.sin(x * tau * 5 + Math.sin(y * tau * 4) * 2) * Math.sin(y * tau * 6 + Math.cos(x * tau * 3) * 2) + (rng() - 0.5) * 0.5;
        if (n > 0.38) {
          dapple.ctx.fillStyle = 'rgb(150,170,140)';
          dapple.ctx.fillRect(x, y, 1, 1);
        }
        const m = Math.sin(x * tau * 4 + Math.sin(y * tau * 5) * 2 + 1) * Math.sin(y * tau * 5 + Math.cos(x * tau * 3) * 2 + 2);
        if (m < -0.52) {
          sun.ctx.fillStyle = 'rgb(255,236,170)';
          sun.ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    this.dapplePattern = this.view.ctx.createPattern(dapple.c, 'repeat')!;
    this.sunPattern = this.view.ctx.createPattern(sun.c, 'repeat')!;
    // silhuetas escuras de folhagem perto da câmera, só nas bordas da tela
    const fg = makeCanvas(512, 320);
    fg.ctx.filter = 'blur(9px)';
    fg.ctx.fillStyle = '#0a1810';
    for (let i = 0; i < 24; i++) {
      const bx = rng() * 512;
      const by = rng() * 320;
      const br = 22 + rng() * 38;
      for (const ox of [-512, 0, 512]) {
        for (const oy of [-320, 0, 320]) {
          fg.ctx.beginPath();
          fg.ctx.ellipse(bx + ox, by + oy, br * 1.3, br, 0, 0, Math.PI * 2);
          fg.ctx.fill();
        }
      }
    }
    fg.ctx.filter = 'none';
    this.fgPattern = this.fgTmp.ctx.createPattern(fg.c, 'repeat')!;
    this.falling = Array.from({ length: 22 }, () => ({ x: rng() * 360, y: rng() * 202, p: rng() * 6.28, c: PAL.leaves[Math.floor(rng() * PAL.leaves.length)] }));
    this.dust = Array.from({ length: 40 }, () => ({ x: rng() * 360, y: rng() * 202, p: rng() * 6.28 }));
    this.resize();
  }

  /** Quantas linhas de pixel do jogo cabem na altura da janela (?linhas=N muda). */
  private static readonly ROWS = Number(new URLSearchParams(location.search).get('linhas') ?? 200);

  resize() {
    const s = Math.max(2, Math.round(innerHeight / Renderer.ROWS));
    this.scale = s;
    this.viewW = Math.ceil(innerWidth / s);
    this.viewH = Math.ceil(innerHeight / s);
    this.view.c.width = this.viewW;
    this.view.c.height = this.viewH;
    this.view.ctx.imageSmoothingEnabled = false;
    const sc = this.screen;
    sc.width = this.viewW * s;
    sc.height = this.viewH * s;
    sc.style.width = `${this.viewW * s}px`;
    sc.style.height = `${this.viewH * s}px`;
    sc.style.left = `${(innerWidth - this.viewW * s) / 2}px`;
    sc.style.top = `${(innerHeight - this.viewH * s) / 2}px`;
    this.fgTmp.c.width = this.viewW * s;
    this.fgTmp.c.height = this.viewH * s;
    this.light.c.width = this.viewW * 2;
    this.light.c.height = this.viewH * 2;
    this.bloom.c.width = Math.round(this.viewW / 2);
    this.bloom.c.height = Math.round(this.viewH / 2);
  }

  private shadowOn(v: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cx: number, cy: number) {
    v.beginPath();
    v.ellipse(Math.round(x - cx), Math.round(y - cy), rx, ry, 0, 0, Math.PI * 2);
    v.fill();
  }

  /** Desenhos dos props animados/especiais; devolve null se for um sprite simples. */
  private propDrawable(p: Prop, f: FrameInput): Drawable | null {
    const v = this.view.ctx;
    const sx = Math.round(p.x - f.camX);
    const sy = Math.round(p.y - f.camY);
    const t = f.time;
    switch (p.kind) {
      case 'tree': {
        const tr = p.tree!;
        return { y: p.y, draw: () => v.drawImage(tr.trunk, sx - tr.footX, sy - tr.footY) };
      }
      case 'grass': {
        const pd = Math.hypot(p.x - f.focus.x, p.y - f.focus.y);
        const push = pd < 16 ? Math.sign(p.x - f.focus.x || 1) * Math.round((16 - pd) / 6) : 0;
        const sway = Math.round(Math.sin(t * 1.8 + p.phase! + p.x / 40) * 1.2) + push;
        return {
          y: p.y,
          draw: () => {
            v.fillStyle = PAL.bladeDark;
            v.fillRect(sx - 1 + sway, sy - 5, 1, 5);
            v.fillRect(sx + 1 + sway, sy - 4, 1, 4);
            v.fillStyle = PAL.bladeLight;
            v.fillRect(sx + sway, sy - 7, 1, 7);
            v.fillRect(sx - 2, sy - 3, 1, 3);
            v.fillRect(sx + 2 + sway, sy - 5, 1, 2);
          },
        };
      }
      case 'reed': {
        const sway = Math.round(Math.sin(t * 1.4 + p.phase!));
        return {
          y: p.y,
          draw: () => {
            v.fillStyle = '#4a7a38';
            v.fillRect(sx, sy - 9, 1, 9);
            v.fillRect(sx + 2, sy - 6, 1, 6);
            v.fillStyle = '#7ab050';
            v.fillRect(sx + sway, sy - 12, 1, 4);
            v.fillStyle = '#6a3a20';
            v.fillRect(sx - 1 + sway, sy - 12, 3, 4);
          },
        };
      }
      case 'lantern':
        return {
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 22, 5, 1);
            v.fillRect(sx - 1, sy - 21, 3, 17);
            v.fillStyle = '#7a4a2a';
            v.fillRect(sx - 1, sy - 12, 2, 12);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 12, 1, 12);
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 4, sy - 22, 9, 9);
            v.fillStyle = '#ffd77a';
            v.fillRect(sx - 3, sy - 21, 7, 7);
            v.fillStyle = '#fff2c0';
            v.fillRect(sx - 1, sy - 20, 3, 4);
          },
        };
      case 'sign':
        return {
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 2, sy - 15, 5, 16);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 1, sy - 14, 3, 14);
            v.fillStyle = '#a87348';
            v.fillRect(sx - 1, sy - 14, 1, 14);
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 13, sy - 29, 26, 15);
            v.fillStyle = '#b8743c';
            v.fillRect(sx - 12, sy - 28, 24, 13);
            v.fillStyle = '#d4904e';
            v.fillRect(sx - 12, sy - 28, 24, 2);
            v.fillStyle = '#8a5028';
            v.fillRect(sx - 12, sy - 17, 24, 2);
            v.fillStyle = '#2e1812';
            v.fillRect(sx - 8, sy - 22, 14, 2);
            v.fillRect(sx + 3, sy - 25, 2, 8);
            v.fillRect(sx + 5, sy - 24, 2, 6);
            v.fillRect(sx + 7, sy - 23, 2, 4);
          },
        };
      case 'camp':
        return {
          y: p.y,
          draw: () => {
            v.fillStyle = OUTLINE;
            v.fillRect(sx - 8, sy - 3, 16, 5);
            v.fillStyle = '#6a3e26';
            v.fillRect(sx - 7, sy - 2, 14, 3);
            v.fillStyle = '#8c5a38';
            v.fillRect(sx - 6, sy - 2, 5, 1);
            v.fillStyle = ROCK[1];
            for (let a = 0; a < 8; a++) v.fillRect(Math.round(sx + Math.cos(a * 0.785) * 10) - 1, Math.round(sy - 1 + Math.sin(a * 0.785) * 4), 3, 2);
            const fl = Math.sin(t * 14) + Math.sin(t * 23);
            v.fillStyle = '#d83a20';
            v.fillRect(sx - 4, sy - 8, 8, 6);
            v.fillRect(sx - 2, sy - 12 + Math.round(fl * 0.5), 5, 5);
            v.fillStyle = '#ff9a2a';
            v.fillRect(sx - 3, sy - 7, 6, 5);
            v.fillRect(sx - 1, sy - 11 + Math.round(fl * 0.5), 3, 5);
            v.fillStyle = '#ffe070';
            v.fillRect(sx - 2, sy - 6, 4, 4);
            v.fillRect(sx, sy - 9 + Math.round(fl * 0.5), 1, 3);
          },
        };
      case 'custom':
        return { y: p.y, draw: () => p.draw?.(v, sx, sy, t) };
      default: {
        const img = p.img;
        if (!img) return null;
        const pd = Math.hypot(p.x - f.focus.x, p.y - f.focus.y);
        const wob = p.kind === 'bush' && pd < 24 && f.focus.moving ? Math.round(Math.sin(t * 24 + p.x) * ((24 - pd) / 14)) : 0;
        return { y: p.y, draw: () => v.drawImage(img, sx - Math.round(img.width / 2) + wob, sy - img.height + 2) };
      }
    }
  }

  draw(f: FrameInput) {
    const { area, camX, camY, time, dt, focus } = f;
    const env = area.env;
    const v = this.view.ctx;
    const { viewW, viewH, scale } = this;
    const dark = env.dark;
    v.globalCompositeOperation = 'source-over';
    v.globalAlpha = 1;
    v.fillStyle = '#05030a';
    v.fillRect(0, 0, viewW, viewH);
    v.drawImage(area.ground, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
    area.drawGround?.(v, camX, camY, time);

    // ---- sombras no chão
    v.fillStyle = 'rgba(52,34,96,0.30)';
    const inView = (p: { x: number; y: number }, m = 100) => p.x > camX - m && p.x < camX + viewW + m && p.y > camY - 60 && p.y < camY + viewH + m;
    for (const p of area.props) {
      if (!inView(p)) continue;
      if (p.kind === 'tree' && p.tree) {
        this.shadowOn(v, p.x + 4, p.y + 2, p.tree.big ? 16 : 12, 5, camX, camY);
        v.fillStyle = 'rgba(52,34,96,0.2)';
        v.beginPath();
        v.ellipse(Math.round(p.x - camX + (p.tree.pine ? 34 : 28)), Math.round(p.y - camY + (p.tree.pine ? 12 : 10)), p.tree.pine ? 38 : p.tree.big ? 40 : 30, p.tree.pine ? 6 : p.tree.big ? 15 : 12, 0.3, 0, Math.PI * 2);
        v.fill();
        v.fillStyle = 'rgba(52,34,96,0.30)';
      } else if (p.kind === 'bush' && p.img) this.shadowOn(v, p.x + 3, p.y + 1, p.img.width * 0.5, 4, camX, camY);
      else if (p.kind === 'rock' && p.img) this.shadowOn(v, p.x + 2, p.y + 1, p.img.width * 0.55, Math.max(3, p.img.width * 0.1), camX, camY);
      else if (p.kind === 'stump') this.shadowOn(v, p.x + 2, p.y, 11, 4, camX, camY);
      else if (p.kind === 'stone') this.shadowOn(v, p.x + 3, p.y + 1, 8, 3, camX, camY);
      else if (p.kind === 'sign') this.shadowOn(v, p.x + 4, p.y + 1, 10, 3, camX, camY);
      else if (p.shadowRx) this.shadowOn(v, p.x + (p.shadowDx ?? 0), p.y, p.shadowRx, p.shadowRy ?? 4, camX, camY);
    }
    v.fillStyle = 'rgba(52,34,96,0.34)';
    for (const e of f.entities) e.shadow?.(v, camX, camY);

    // ---- objetos em ordem de profundidade
    const list: Drawable[] = [];
    for (const p of area.props) {
      if (p.x < camX - 100 || p.x > camX + viewW + 100 || p.y < camY - 20 || p.y > camY + viewH + 100) continue;
      const d = this.propDrawable(p, f);
      if (d) list.push(d);
    }
    area.drawables?.(list, camX, camY, time);
    list.push(...f.entities);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(v, camX, camY, time);
    f.fx.drawView(v, camX, camY);

    // ---- manchas de sombra e de sol passando pelo chão
    const dap = env.dapple * (1 - dark * 0.85);
    if (dap > 0.02) {
      v.save();
      v.globalCompositeOperation = 'multiply';
      v.globalAlpha = dap;
      v.translate(-camX + Math.sin(time * 0.3) * 6 + time * 2.2, -camY + Math.cos(time * 0.27) * 4);
      v.fillStyle = this.dapplePattern;
      v.fillRect(camX - 300, camY - 300, viewW + 600, viewH + 600);
      v.restore();
      const sunA = 0.085 * (1 - dark) * (0.4 + 0.6 * env.shaft) * env.dapple;
      if (sunA > 0.01) {
        v.save();
        v.globalCompositeOperation = 'lighter';
        v.globalAlpha = sunA;
        v.translate(-camX - Math.sin(time * 0.22) * 8 - time * 1.6, -camY + Math.cos(time * 0.2) * 5);
        v.fillStyle = this.sunPattern;
        v.fillRect(camX - 300, camY - 300, viewW + 600, viewH + 600);
        v.restore();
      }
    }

    // ---- copas por cima, balançando; transparentes quando o jogador passa por baixo
    for (const p of area.props) {
      if (p.kind !== 'tree' || !p.tree) continue;
      const tr = p.tree;
      const sway = Math.round(Math.sin(time * 0.9 + p.x * 0.05));
      const x = Math.round(p.x - camX - tr.canopyX) + sway;
      const y = Math.round(p.y - camY - tr.footY - tr.canopyY + 22);
      if (x > viewW || x + tr.canopy.width < 0 || y > viewH || y + tr.canopy.height < 0) continue;
      const under = Math.abs(focus.x - p.x) < tr.canopy.width * 0.42 && focus.y < p.y + 4 && focus.y > p.y - tr.canopy.height * 0.85;
      v.globalAlpha = under ? 0.45 : 1;
      v.drawImage(tr.canopy, x, y);
    }
    v.globalAlpha = 1;
    area.drawTop?.(v, camX, camY, time);

    // ---- galhos retorcidos nos cantos
    if (env.overhang) {
      const sway = Math.round(Math.sin(time * 0.7));
      v.drawImage(this.kit.overL, 0, -2 + sway);
      v.save();
      v.translate(viewW, 0);
      v.scale(-1, 1);
      v.drawImage(this.kit.overR, 0, -2 - sway);
      v.restore();
    }
    // folhas caindo e poeirinha no ar
    if (env.dapple > 0) {
      for (const l of this.falling) {
        l.y += dt * 12;
        l.x += Math.sin(time * 1.3 + l.p) * dt * 12 + dt * 6;
        if (l.y > viewH + 2) {
          l.y = -3;
          l.x = Math.random() * viewW;
        }
        v.fillStyle = l.c;
        v.fillRect(Math.round(l.x), Math.round(l.y), 2, 1);
      }
      for (const d of this.dust) {
        d.x += Math.sin(time * 0.5 + d.p) * dt * 4 + dt * 3;
        d.y += Math.cos(time * 0.4 + d.p) * dt * 3;
        if (d.x > viewW) d.x = 0;
        if (d.y > viewH || d.y < 0) d.y = Math.random() * viewH;
        v.fillStyle = `rgba(255,250,220,${0.25 + 0.2 * Math.sin(time + d.p)})`;
        v.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
      }
    }

    // ---- passa a cena para a tela com pixels nítidos
    const g = this.sctx;
    const W = this.screen.width;
    const H = this.screen.height;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.view.c, 0, 0, W, H);

    // ---- luzes
    const lights: Light[] = [...f.lights];
    for (const p of area.props) {
      if (p.x < camX - 140 || p.x > camX + viewW + 140 || p.y < camY - 140 || p.y > camY + viewH + 140) continue;
      if (p.kind === 'lantern') lights.push({ x: p.x, y: p.y - 18, r: 90, col: [255, 214, 120], a: 0.05 + 0.6 * dark });
      else if (p.kind === 'camp') {
        const fl = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
        lights.push({ x: p.x, y: p.y - 6, r: 130 * fl, col: [255, 150, 60], a: (0.1 + 0.46 * dark) * fl });
      } else if (p.kind === 'mushroom' && p.glow) lights.push({ x: p.x, y: p.y - 4, r: 40, col: [90, 170, 255], a: 0.7 * dark, night: true });
      else if (p.kind === 'custom' && p.light) {
        const l = p.light(time, dark);
        if (l) lights.push(l);
      }
    }
    area.lights?.(lights, time);

    const lm = this.light.ctx;
    const lw = this.light.c.width;
    const lh = this.light.c.height;
    const ls = lw / viewW;
    lm.globalCompositeOperation = 'source-over';
    lm.fillStyle = `rgb(${Math.round(env.amb[0])},${Math.round(env.amb[1])},${Math.round(env.amb[2])})`;
    lm.fillRect(0, 0, lw, lh);
    lm.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const lx = (L.x - camX) * ls;
      const ly = (L.y - camY) * ls;
      const r = L.r * ls;
      if (lx + r < 0 || ly + r < 0 || lx - r > lw || ly - r > lh) continue;
      const la = Math.min(1, L.a);
      const gr = lm.createRadialGradient(lx, ly, 0, lx, ly, r);
      gr.addColorStop(0, rgba(L.col, la));
      gr.addColorStop(0.2, rgba(L.col, la * 0.7));
      gr.addColorStop(0.4, rgba(L.col, la * 0.42));
      gr.addColorStop(0.6, rgba(L.col, la * 0.2));
      gr.addColorStop(0.8, rgba(L.col, la * 0.07));
      gr.addColorStop(1, rgba(L.col, 0));
      lm.fillStyle = gr;
      lm.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'multiply';
    g.drawImage(this.light.c, 0, 0, W, H);

    // brilho colorido das luzes por cima
    g.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const sx = (L.x - camX) * scale;
      const sy = (L.y - camY) * scale;
      const r = L.r * scale * (L.night ? 0.55 : 0.7);
      const a = Math.min(1, L.a) * (L.night ? 0.3 : 0.1) * (0.2 + 0.8 * dark);
      if (a < 0.01) continue;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, rgba(L.col, a));
      gr.addColorStop(1, rgba(L.col, 0));
      g.fillStyle = gr;
      g.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    area.drawAdditive?.(g, camX, camY, scale, time);
    f.fx.drawScreen(g, camX, camY, scale);
    g.globalCompositeOperation = 'lighter';

    // brilho quente do sol vindo do canto de cima à esquerda e raios entre as copas
    if (env.shaft > 0.03) {
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.85);
      sg.addColorStop(0, rgba(env.shaftCol, 0.16 * env.shaft * (1 - dark * 0.5)));
      sg.addColorStop(0.5, rgba(env.shaftCol, 0.04 * env.shaft * (1 - dark * 0.5)));
      sg.addColorStop(1, rgba(env.shaftCol, 0));
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const baseX = (((i * 0.23 + 0.05 + Math.sin(time * 0.15 + i) * 0.03) % 1.2) + 0.1) * W;
        const wid = W * (0.05 + 0.03 * ((i * 7) % 3));
        const pulse = 0.55 + 0.45 * Math.sin(time * 0.5 + i * 1.7);
        const gr = g.createLinearGradient(baseX, 0, baseX - H * 0.5, H);
        gr.addColorStop(0, rgba(env.shaftCol, 0.24 * env.shaft * pulse));
        gr.addColorStop(0.7, rgba(env.shaftCol, 0.07 * env.shaft * pulse));
        gr.addColorStop(1, rgba(env.shaftCol, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(baseX, 0);
        g.lineTo(baseX + wid, 0);
        g.lineTo(baseX + wid - H * 0.5, H);
        g.lineTo(baseX - H * 0.5 - wid * 0.4, H);
        g.closePath();
        g.fill();
      }
    }

    // névoa baixa passando devagar
    g.globalCompositeOperation = 'source-over';
    if (env.mist > 0.02) {
      const mc = lerpRGB(env.amb, [255, 255, 255], 0.5);
      for (let i = 0; i < 6; i++) {
        const cx = (((i * 0.23 + time * (0.006 + i * 0.002)) % 1.4) - 0.2) * W;
        const cy = H * (0.28 + 0.13 * i) + Math.sin(time * 0.25 + i) * H * 0.03;
        g.save();
        g.translate(cx, cy);
        g.scale(2.4, 0.7);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, H * 0.5);
        gr.addColorStop(0, rgba(mc, 0.2 * env.mist));
        gr.addColorStop(1, rgba(mc, 0));
        g.fillStyle = gr;
        g.fillRect(-H, -H, H * 2, H * 2);
        g.restore();
      }
    }

    // folhagem escura perto da câmera, só nas bordas
    if (env.overhang) {
      const t = this.fgTmp.ctx;
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, W, H);
      t.save();
      t.imageSmoothingEnabled = true;
      t.translate(-camX * 1.45 * scale, -camY * 1.45 * scale);
      t.scale(scale, scale);
      t.fillStyle = this.fgPattern;
      t.fillRect(camX * 1.45, camY * 1.45, viewW, viewH);
      t.restore();
      t.globalCompositeOperation = 'destination-out';
      const R = Math.hypot(W, H) * 0.5;
      const eg = t.createRadialGradient(W / 2, H / 2, R * 0.4, W / 2, H / 2, R);
      eg.addColorStop(0, 'rgba(0,0,0,1)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = eg;
      t.fillRect(0, 0, W, H);
      g.globalAlpha = 0.5 + 0.2 * dark;
      g.drawImage(this.fgTmp.c, 0, 0);
      g.globalAlpha = 1;
    }

    // brilho (bloom)
    try {
      const b = this.bloom.ctx;
      b.imageSmoothingEnabled = true;
      b.filter = 'none';
      b.clearRect(0, 0, this.bloom.c.width, this.bloom.c.height);
      b.filter = 'brightness(1.05) contrast(1.9) blur(1.5px)';
      b.drawImage(this.screen, 0, 0, this.bloom.c.width, this.bloom.c.height);
      b.filter = 'none';
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 + 0.18 * dark;
      g.drawImage(this.bloom.c, 0, 0, W, H);
      g.globalAlpha = 1;
    } catch {
      /* sem filtros no canvas: fica sem o brilho extra */
    }

    // cor final e cantos mais escuros
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = rgba(env.grade, env.gradeA * 3);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(4,2,6,${(0.3 + 0.22 * dark) * env.vignette})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    if (env.blackout) {
      g.fillStyle = `rgba(0,0,0,${env.blackout})`;
      g.fillRect(0, 0, W, H);
    }
  }
}
