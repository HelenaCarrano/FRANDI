/**
 * Entrada unificada: teclado (WASD/setas + E) e toque (joystick virtual + botão de ação).
 * `move` é um vetor de tela: x = direita, y = para cima (frente), comprimento 0..1.
 */

const KEY_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const ACTION_KEYS = new Set(['KeyE', 'Space', 'Enter']);
const ATTACK_KEYS = new Set(['KeyJ', 'KeyF']);
const DODGE_KEYS = new Set(['KeyK']);
const RUN_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
const JOYSTICK_RADIUS = 55;
/** Intensidade do teclado sem Shift: o jogador interpreta como andar (0.75 = limite entre andar e correr). */
const KEY_WALK_MAG = 0.75;

export class Input {
  readonly move = { x: 0, y: 0 };
  private keys = { up: false, down: false, left: false, right: false };
  private runHeld = false;
  private actionQueued = false;
  private attackQueued = false;
  private dodgeQueued = false;
  private anyKeyListeners: (() => void)[] = [];
  private zoomListeners: ((factor: number) => void)[] = [];
  private pinchDist = 0;

  // giro da câmera (arrastar)
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private lookAcc = { x: 0, y: 0 };

  // joystick
  private joyPointer: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private readonly joyBase: HTMLDivElement;
  private readonly joyKnob: HTMLDivElement;

  constructor(surface: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) {
        this.keys[dir] = true;
        e.preventDefault();
      }
      if (ACTION_KEYS.has(e.code) && !e.repeat) {
        this.actionQueued = true;
        e.preventDefault();
      }
      if (ATTACK_KEYS.has(e.code) && !e.repeat) this.attackQueued = true;
      if (DODGE_KEYS.has(e.code) && !e.repeat) this.dodgeQueued = true;
      if (RUN_KEYS.has(e.code)) this.runHeld = true;
      this.anyKeyListeners.forEach((fn) => fn());
    });
    window.addEventListener('keyup', (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) this.keys[dir] = false;
      if (RUN_KEYS.has(e.code)) this.runHeld = false;
    });
    window.addEventListener('blur', () => {
      this.keys = { up: false, down: false, left: false, right: false };
      this.runHeld = false;
      this.releaseJoystick();
    });

    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joystick';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'joystick-knob';
    this.joyBase.appendChild(this.joyKnob);
    document.body.appendChild(this.joyBase);

    // zoom: rodinha do mouse (computador) e pinça com dois dedos (celular)
    surface.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.emitZoom(Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
    // dois dedos juntos = pinça (zoom); um em cada lado da tela = andar com um e girar com o outro
    const isPinch = (t: TouchList) => t.length === 2 && Math.abs(t[0].clientX - t[1].clientX) < window.innerWidth * 0.4;
    surface.addEventListener('touchstart', (e) => {
      if (isPinch(e.touches)) {
        this.pinchDist = touchDistance(e.touches);
        this.releaseJoystick();
        this.releaseLook();
      }
    });
    surface.addEventListener('touchmove', (e) => {
      if (!isPinch(e.touches) || this.pinchDist === 0) return;
      const d = touchDistance(e.touches);
      if (d > 0) this.emitZoom(this.pinchDist / d);
      this.pinchDist = d;
    });
    surface.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) this.pinchDist = 0;
    });

    surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Chamado pelo botão de ação da interface. */
  pressAction() {
    this.actionQueued = true;
  }

  /** Botão de combate da interface. */
  pressCombat(kind: 'attack' | 'dodge') {
    if (kind === 'attack') this.attackQueued = true;
    else this.dodgeQueued = true;
  }

  consumeAttack(): boolean {
    const a = this.attackQueued;
    this.attackQueued = false;
    return a;
  }

  consumeDodge(): boolean {
    const a = this.dodgeQueued;
    this.dodgeQueued = false;
    return a;
  }

  /** Quanto o jogador arrastou para girar a câmera desde a última chamada (pixels). */
  consumeLook() {
    const l = { x: this.lookAcc.x, y: this.lookAcc.y };
    this.lookAcc.x = this.lookAcc.y = 0;
    return l;
  }

  /** Retorna true uma única vez por toque/tecla de ação. */
  consumeAction(): boolean {
    const a = this.actionQueued;
    this.actionQueued = false;
    return a;
  }

  onAnyKey(fn: () => void) {
    this.anyKeyListeners.push(fn);
  }

  /** `factor` < 1 aproxima, > 1 afasta. */
  onZoom(fn: (factor: number) => void) {
    this.zoomListeners.push(fn);
  }

  private emitZoom(factor: number) {
    this.zoomListeners.forEach((fn) => fn(factor));
  }

  update() {
    let x = 0;
    let y = 0;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    if (this.keys.up) y += 1;
    if (this.keys.down) y -= 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      const mag = this.runHeld ? 1 : KEY_WALK_MAG;
      x = (x / len) * mag;
      y = (y / len) * mag;
    } else if (this.joyPointer !== null) {
      x = this.joyVec.x;
      y = this.joyVec.y;
    }
    this.move.x = x;
    this.move.y = y;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.pinchDist > 0) return;
    // mouse: arrastar gira a câmera (andar é pelo teclado). Toque: lado esquerdo anda, lado direito gira.
    const look = e.pointerType === 'mouse' ? true : e.clientX > window.innerWidth * 0.5;
    if (look) {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (this.joyPointer !== null) return;
    this.joyPointer = e.pointerId;
    this.joyOrigin = { x: e.clientX, y: e.clientY };
    this.joyVec = { x: 0, y: 0 };
    this.joyBase.style.left = `${e.clientX}px`;
    this.joyBase.style.top = `${e.clientY}px`;
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.joyBase.classList.add('active');
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId === this.lookPointer) {
      this.lookAcc.x += e.clientX - this.lookLast.x;
      this.lookAcc.y += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.pointerId !== this.joyPointer) return;
    let dx = e.clientX - this.joyOrigin.x;
    let dy = e.clientY - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOYSTICK_RADIUS) {
      dx = (dx / len) * JOYSTICK_RADIUS;
      dy = (dy / len) * JOYSTICK_RADIUS;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // zona morta pequena para não andar sem querer
    const mag = Math.min(len, JOYSTICK_RADIUS) / JOYSTICK_RADIUS;
    if (mag < 0.15) {
      this.joyVec = { x: 0, y: 0 };
    } else {
      this.joyVec = { x: dx / JOYSTICK_RADIUS, y: -dy / JOYSTICK_RADIUS };
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.lookPointer) this.releaseLook();
    if (e.pointerId === this.joyPointer) this.releaseJoystick();
  };

  private releaseLook() {
    this.lookPointer = null;
  }

  private releaseJoystick() {
    this.joyPointer = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyBase.classList.remove('active');
  }
}

function touchDistance(t: TouchList) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}
