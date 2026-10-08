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
const JOYSTICK_RADIUS = 55;

export class Input {
  readonly move = { x: 0, y: 0 };
  private keys = { up: false, down: false, left: false, right: false };
  private actionQueued = false;
  private anyKeyListeners: (() => void)[] = [];
  private zoomListeners: ((factor: number) => void)[] = [];
  private pinchDist = 0;

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
      this.anyKeyListeners.forEach((fn) => fn());
    });
    window.addEventListener('keyup', (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) this.keys[dir] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = { up: false, down: false, left: false, right: false };
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
    surface.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.pinchDist = touchDistance(e.touches);
        this.releaseJoystick(); // dois dedos = zoom, não andar
      }
    });
    surface.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || this.pinchDist === 0) return;
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
      x /= len;
      y /= len;
    } else if (this.joyPointer !== null) {
      x = this.joyVec.x;
      y = this.joyVec.y;
    }
    this.move.x = x;
    this.move.y = y;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.joyPointer !== null || this.pinchDist > 0) return;
    this.joyPointer = e.pointerId;
    this.joyOrigin = { x: e.clientX, y: e.clientY };
    this.joyVec = { x: 0, y: 0 };
    this.joyBase.style.left = `${e.clientX}px`;
    this.joyBase.style.top = `${e.clientY}px`;
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.joyBase.classList.add('active');
  };

  private onPointerMove = (e: PointerEvent) => {
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
    if (e.pointerId !== this.joyPointer) return;
    this.releaseJoystick();
  };

  private releaseJoystick() {
    this.joyPointer = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyBase.classList.remove('active');
  }
}

function touchDistance(t: TouchList) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}
