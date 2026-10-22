/**
 * Áudio do jogo, todo gerado em código (WebAudio): nada para baixar e nenhuma licença para cuidar.
 *  - Música: um "pad" que troca de acorde devagar, mais notinhas soltas, com tom e acordes próprios de cada área.
 *  - Ambiente: vento, pássaros, grilos, coruja, burburinho, fogueira, conforme a área.
 *  - Efeitos: passos, golpes, dano, esquiva, item, moeda, galinha, baú, lembrança, forja...
 * O navegador só libera o som depois do primeiro toque/tecla; até lá tudo fica na fila e começa sozinho.
 * Silenciar: botão 🔊 no canto (a escolha fica salva).
 */

export type Sfx =
  | 'step' | 'stepStone' | 'hoof' | 'swing' | 'hit' | 'kill' | 'hurt' | 'dodge' | 'pickup' | 'coin' | 'cluck' | 'egg'
  | 'chest' | 'tick' | 'select' | 'memory' | 'whoosh' | 'clang' | 'defeat' | 'mount' | 'rise' | 'rest';

type Surface = 'grass' | 'stone';
type Ambience = 'wind' | 'birds' | 'crickets' | 'owl' | 'murmur' | 'fire';

interface SceneAudio {
  root: number;
  chords: number[][];
  bar: number;
  wave: OscillatorType;
  cutoff: number;
  pad: number;
  pluck?: { scale: number[]; every: [number, number]; gain: number; wave: OscillatorType };
  ambience: Ambience[];
  wind: number;
  surface: Surface;
}

const SCENES: Record<string, SceneAudio> = {
  forest: { root: 57, chords: [[0, 7, 12, 15], [-4, 3, 8, 12], [-2, 5, 10, 14], [-5, 2, 7, 10]], bar: 8, wave: 'sine', cutoff: 900, pad: 0.1, ambience: ['wind', 'crickets', 'owl', 'birds'], wind: 0.05, surface: 'grass' },
  village: { root: 60, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], bar: 7, wave: 'triangle', cutoff: 1600, pad: 0.07, pluck: { scale: [0, 2, 4, 7, 9, 12, 14, 16], every: [1.2, 3.2], gain: 0.05, wave: 'triangle' }, ambience: ['wind', 'birds'], wind: 0.025, surface: 'grass' },
  ruins: { root: 50, chords: [[0, 7, 12, 15], [-2, 5, 10, 14], [-4, 3, 8, 12], [-7, 0, 5, 8]], bar: 9, wave: 'sine', cutoff: 700, pad: 0.1, pluck: { scale: [0, 3, 7, 10, 12, 15], every: [4, 8], gain: 0.04, wave: 'sine' }, ambience: ['wind', 'crickets', 'owl'], wind: 0.05, surface: 'stone' },
  tavern: { root: 62, chords: [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [0, 4, 7, 12]], bar: 5, wave: 'triangle', cutoff: 1400, pad: 0.05, pluck: { scale: [0, 2, 4, 7, 9, 12], every: [0.5, 1.4], gain: 0.06, wave: 'triangle' }, ambience: ['murmur', 'fire'], wind: 0, surface: 'stone' },
  vineyard: { root: 57, chords: [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [-3, 0, 4, 9]], bar: 8, wave: 'triangle', cutoff: 1500, pad: 0.07, pluck: { scale: [0, 2, 4, 7, 9, 12], every: [1.5, 3.5], gain: 0.045, wave: 'sine' }, ambience: ['wind', 'birds'], wind: 0.02, surface: 'grass' },
  castle: { root: 45, chords: [[0, 7, 12, 15], [1, 8, 13, 16], [-2, 5, 10, 13], [0, 7, 12, 15]], bar: 10, wave: 'sawtooth', cutoff: 380, pad: 0.05, ambience: ['wind', 'fire'], wind: 0.035, surface: 'stone' },
  ending: { root: 60, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], bar: 6, wave: 'triangle', cutoff: 2200, pad: 0.08, pluck: { scale: [0, 4, 7, 12, 16, 19, 24], every: [0.35, 0.9], gain: 0.055, wave: 'sine' }, ambience: ['fire'], wind: 0, surface: 'stone' },
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Group {
  gain: GainNode;
  nodes: AudioNode[];
  cfg: SceneAudio;
  chord: number;
  nextChord: number;
  nextPluck: number;
  nextBird: number;
  nextCricket: number;
  nextOwl: number;
  nextMurmur: number;
  nextCrackle: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private group: Group | null = null;
  private pending: string | null = null;
  private clock = 0;
  surface: Surface = 'grass';
  /** 0 = dia claro, 1 = noite fechada (a Floresta atualiza): decide entre pássaros e grilos. */
  mood = 1;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('aventura-matheus:mudo') === '1';
    } catch {
      /* sem armazenamento */
    }
    const unlock = () => {
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, { passive: true });
  }

  private ensure() {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.7;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1.5;
    this.sfx.connect(this.master);

    // reverberação: ruído que decai (2,4 s)
    const len = Math.floor(ctx.sampleRate * 2.4);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = imp;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    // 2 s de ruído branco reaproveitado por vento, passos, golpes...
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.setScene(p);
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem('aventura-matheus:mudo', m ? '1' : '0');
    } catch {
      /* sem armazenamento */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // ---------- cena: música + ambiente ----------

  /** Troca a música e o ambiente (com cruzamento suave). `id` é o id da área. */
  setScene(id: string) {
    const cfg = SCENES[id];
    if (cfg) this.surface = cfg.surface;
    // noite (grilos, coruja) nas áreas escuras; a Floresta atualiza `mood` a cada quadro
    this.mood = ['forest', 'ruins', 'castle', 'ending'].includes(id) ? 1 : 0;
    if (!this.ctx) {
      this.pending = id;
      return;
    }
    if (!cfg) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const old = this.group;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + 2);
      setTimeout(() => old.nodes.forEach((n) => this.safeStop(n)), 2400);
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, t + 2.5);
    gain.connect(this.music);
    const nodes: AudioNode[] = [gain];

    // vento: ruído filtrado com volume que sobe e desce devagar
    if (cfg.wind > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.6;
      const wg = ctx.createGain();
      wg.gain.value = cfg.wind;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.06;
      const lg = ctx.createGain();
      lg.gain.value = cfg.wind * 0.7;
      lfo.connect(lg).connect(wg.gain);
      src.connect(bp).connect(wg).connect(gain);
      src.start();
      lfo.start();
      nodes.push(src, lfo);
    }
    this.group = { gain, nodes, cfg, chord: 0, nextChord: this.clock, nextPluck: this.clock + 3, nextBird: this.clock + 2, nextCricket: this.clock + 1, nextOwl: this.clock + rnd(8, 20), nextMurmur: this.clock + 1, nextCrackle: this.clock + 1 };
  }

  private safeStop(n: AudioNode) {
    try {
      (n as OscillatorNode).stop?.();
    } catch {
      /* já parou */
    }
    try {
      n.disconnect();
    } catch {
      /* já solto */
    }
  }

  /** Agenda os acordes e os sons de ambiente; chamar a cada quadro. */
  update(dt: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.clock += Math.min(dt, 0.1);
    const g = this.group;
    if (!g || this.muted) return;
    const c = g.cfg;
    if (this.clock >= g.nextChord) {
      this.playChord(g, c.chords[g.chord % c.chords.length]);
      g.chord++;
      g.nextChord = this.clock + c.bar;
    }
    if (c.pluck && this.clock >= g.nextPluck) {
      const n = c.pluck.scale[Math.floor(Math.random() * c.pluck.scale.length)];
      const chord = c.chords[(g.chord - 1 + c.chords.length) % c.chords.length];
      this.pluck(g, midi(c.root + chord[0] + n + 12), c.pluck.gain, c.pluck.wave);
      g.nextPluck = this.clock + rnd(c.pluck.every[0], c.pluck.every[1]);
    }
    const day = this.mood < 0.5;
    if (c.ambience.includes('birds') && day && this.clock >= g.nextBird) {
      this.bird(g);
      g.nextBird = this.clock + rnd(1.2, 4.5);
    }
    if (c.ambience.includes('crickets') && !day && this.clock >= g.nextCricket) {
      this.cricket(g);
      g.nextCricket = this.clock + rnd(0.5, 1.6);
    }
    if (c.ambience.includes('owl') && !day && this.clock >= g.nextOwl) {
      this.owl(g);
      g.nextOwl = this.clock + rnd(14, 30);
    }
    if (c.ambience.includes('murmur') && this.clock >= g.nextMurmur) {
      this.murmur(g);
      g.nextMurmur = this.clock + rnd(0.7, 2);
    }
    if (c.ambience.includes('fire') && this.clock >= g.nextCrackle) {
      this.crackle(g);
      g.nextCrackle = this.clock + rnd(0.15, 0.9);
    }
  }

  // ---------- peças da música e do ambiente ----------

  private playChord(g: Group, chord: number[]) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const c = g.cfg;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = c.cutoff;
    lp.Q.value = 0.4;
    const out = ctx.createGain();
    out.gain.value = 1;
    lp.connect(out);
    out.connect(g.gain);
    out.connect(this.reverbSend);
    const dur = c.bar + 3;
    for (const n of chord) {
      const o = ctx.createOscillator();
      o.type = c.wave;
      o.frequency.value = midi(c.root + n);
      o.detune.value = rnd(-7, 7);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(c.pad / Math.sqrt(chord.length), t + c.bar * 0.3);
      e.gain.linearRampToValueAtTime(c.pad * 0.7 / Math.sqrt(chord.length), t + c.bar);
      e.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(e).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    setTimeout(() => {
      try {
        lp.disconnect();
        out.disconnect();
      } catch {
        /* já solto */
      }
    }, (dur + 0.5) * 1000);
  }

  private pluck(g: Group, freq: number, gain: number, wave: OscillatorType) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.012);
    e.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
    o.connect(e);
    e.connect(g.gain);
    e.connect(this.reverbSend);
    o.start(t);
    o.stop(t + 1.7);
  }

  private bird(g: Group) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = rnd(2200, 4200);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const s = t + i * 0.13;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.7), s + 0.07);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.11);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, s);
      e.gain.linearRampToValueAtTime(0.018, s + 0.015);
      e.gain.linearRampToValueAtTime(0, s + 0.12);
      o.connect(e).connect(g.gain);
      o.start(s);
      o.stop(s + 0.15);
    }
  }

  private cricket(g: Group) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = rnd(4300, 5100);
    const e = ctx.createGain();
    e.gain.value = 0;
    // pulsos rápidos
    for (let i = 0; i < 5; i++) {
      e.gain.setValueAtTime(0.012, t + i * 0.07);
      e.gain.setValueAtTime(0, t + i * 0.07 + 0.035);
    }
    o.connect(e).connect(g.gain);
    o.start(t);
    o.stop(t + 0.4);
  }

  private owl(g: Group) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [i, f] of [[0, 340], [0.55, 290]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t + i);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, t + i + 0.4);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t + i);
      e.gain.linearRampToValueAtTime(0.05, t + i + 0.08);
      e.gain.linearRampToValueAtTime(0, t + i + 0.45);
      o.connect(e);
      e.connect(g.gain);
      e.connect(this.reverbSend);
      o.start(t + i);
      o.stop(t + i + 0.5);
    }
  }

  private murmur(g: Group) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rnd(0.7, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = rnd(350, 900);
    f.Q.value = 3;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.03, t + 0.12);
    e.gain.linearRampToValueAtTime(0, t + rnd(0.3, 0.7));
    src.connect(f).connect(e).connect(g.gain);
    src.start(t, rnd(0, 1.5), 0.8);
  }

  private crackle(g: Group) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = rnd(2500, 5500);
    const e = ctx.createGain();
    e.gain.setValueAtTime(rnd(0.012, 0.035), t);
    e.gain.exponentialRampToValueAtTime(0.0005, t + rnd(0.02, 0.07));
    src.connect(f).connect(e).connect(g.gain);
    src.start(t, rnd(0, 1.5), 0.1);
  }

  // ---------- efeitos ----------

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, attack = 0.005, delay = 0, reverb = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(e).connect(this.sfx);
    if (reverb > 0) {
      const r = ctx.createGain();
      r.gain.value = reverb;
      e.connect(r).connect(this.reverbSend);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur / 3));
    e.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(e).connect(this.sfx);
    src.start(t, rnd(0, 1.5), dur + 0.05);
  }

  play(name: Sfx, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const v = vol;
    switch (name) {
      case 'step':
        this.burst(0.08, 'lowpass', rnd(500, 800), 250, 0.13 * v, 0.7);
        break;
      case 'stepStone':
        this.burst(0.05, 'bandpass', rnd(1100, 1700), 700, 0.1 * v, 2);
        this.tone('sine', rnd(150, 210), 90, 0.06, 0.05 * v);
        break;
      case 'hoof':
        this.tone('sine', rnd(160, 200), 80, 0.07, 0.12 * v);
        this.burst(0.04, 'bandpass', 1500, 900, 0.08 * v, 3);
        break;
      case 'swing':
        this.burst(0.2, 'bandpass', 500, 2200, 0.2 * v, 1.2);
        break;
      case 'hit':
        this.burst(0.1, 'lowpass', 1800, 300, 0.25 * v);
        this.tone('square', 190, 60, 0.13, 0.12 * v);
        break;
      case 'kill':
        this.tone('sawtooth', 420, 70, 0.38, 0.1 * v, 0.01, 0, 0.3);
        this.burst(0.5, 'lowpass', 2200, 200, 0.18 * v);
        break;
      case 'hurt':
        this.tone('sawtooth', 230, 100, 0.28, 0.2 * v);
        this.burst(0.12, 'lowpass', 900, 250, 0.2 * v);
        break;
      case 'dodge':
        this.burst(0.26, 'highpass', 1500, 5000, 0.1 * v, 0.5);
        break;
      case 'pickup':
        this.tone('sine', 660, 660, 0.12, 0.09 * v, 0.004, 0, 0.3);
        this.tone('sine', 990, 990, 0.2, 0.09 * v, 0.004, 0.08, 0.3);
        break;
      case 'coin':
        this.tone('triangle', 1320, 1320, 0.1, 0.07 * v);
        this.tone('triangle', 1760, 1760, 0.22, 0.07 * v, 0.004, 0.07);
        break;
      case 'cluck':
        for (let i = 0; i < 2; i++) {
          this.tone('square', rnd(520, 600), 300, 0.09, 0.05 * v, 0.006, i * 0.14);
          this.burst(0.08, 'bandpass', 900, 600, 0.05 * v, 4, i * 0.14);
        }
        break;
      case 'egg':
        this.tone('sine', 300, 760, 0.1, 0.12 * v);
        this.tone('sine', 880, 880, 0.2, 0.08 * v, 0.004, 0.12, 0.3);
        break;
      case 'chest':
        this.tone('sine', 90, 55, 0.5, 0.25 * v);
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 1.6, 0.07 * v, 0.01, 0.15 + i * 0.13, 0.6));
        this.burst(1.1, 'highpass', 5000, 9000, 0.05 * v, 0.5, 0.3);
        break;
      case 'tick':
        this.tone('triangle', 880, 760, 0.035, 0.035 * v);
        break;
      case 'select':
        this.tone('sine', 520, 700, 0.09, 0.07 * v);
        break;
      case 'memory':
        [523, 659, 784].forEach((f, i) => this.tone('sine', f, f, 2.2, 0.06 * v, 0.03, i * 0.09, 0.8));
        break;
      case 'whoosh':
        this.burst(0.55, 'bandpass', 200, 2000, 0.12 * v, 0.8);
        break;
      case 'clang':
        [520, 1310, 2140].forEach((f, i) => this.tone('sine', f, f, 0.55 - i * 0.12, 0.09 * v));
        this.burst(0.05, 'highpass', 3000, 3000, 0.15 * v);
        break;
      case 'defeat':
        this.tone('sine', 220, 50, 1.1, 0.2 * v, 0.02, 0, 0.5);
        break;
      case 'mount':
        this.tone('sawtooth', 700, 430, 0.32, 0.05 * v, 0.03);
        this.tone('sawtooth', 560, 380, 0.2, 0.04 * v, 0.02, 0.22);
        break;
      case 'rise':
        this.burst(0.7, 'lowpass', 300, 1200, 0.1 * v, 0.6);
        this.tone('sine', 110, 190, 0.7, 0.07 * v, 0.1, 0, 0.4);
        break;
      case 'rest':
        [392, 523, 659].forEach((f, i) => this.tone('sine', f, f, 1.4, 0.05 * v, 0.03, i * 0.1, 0.7));
        break;
    }
  }

  // ---------- passos ----------

  private stride = 0;

  /** Chamar a cada quadro com a velocidade do Matheus (m/s) e se ele está montado. */
  footsteps(dt: number, speed: number, riding: boolean) {
    if (speed < 0.35) {
      this.stride = 0.6;
      return;
    }
    this.stride += speed * dt;
    const len = riding ? 1.5 : speed > 3.2 ? 1.55 : 1.05;
    if (this.stride >= len) {
      this.stride = 0;
      this.play(riding ? 'hoof' : this.surface === 'stone' ? 'stepStone' : 'step', riding ? 1 : speed > 3.2 ? 1.1 : 0.9);
    }
  }
}

export const audio = new AudioEngine();
