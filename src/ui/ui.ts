import { content } from '../content';
import { debug } from '../core/quality';

/**
 * Interface HTML sobre o canvas: tela inicial, nome da área, dica de controles,
 * aviso de interação, botão de ação (toque) e caixa de diálogo com texto digitado.
 */
export class UI {
  private readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly actionBtn: HTMLButtonElement;
  private readonly dialog: HTMLDivElement;
  private readonly dialogText: HTMLParagraphElement;
  private readonly dialogHint: HTMLDivElement;
  private readonly areaTitle: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly fps: HTMLDivElement | null = null;

  private lines: readonly string[] = [];
  private lineIndex = 0;
  private typed = 0;
  private typing = false;
  private onDialogEnd: (() => void) | null = null;

  constructor(
    private readonly isTouch: boolean,
    onAction: () => void,
  ) {
    const root = document.createElement('div');
    root.className = 'ui';
    document.body.appendChild(root);
    this.root = root;

    this.areaTitle = el('div', 'area-title', root);
    this.hint = el('div', 'controls-hint', root);
    this.hint.textContent = isTouch ? content.controls.mobile : content.controls.desktop;

    this.prompt = el('div', 'interact-prompt', root);
    this.prompt.hidden = true;

    this.actionBtn = el('button', 'action-btn', root);
    this.actionBtn.textContent = content.controls.actionButton;
    this.actionBtn.hidden = true;
    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction();
    });

    this.dialog = el('div', 'dialog', root);
    this.dialog.hidden = true;
    const box = el('div', 'dialog-box', this.dialog);
    this.dialogText = el('p', 'dialog-text', box);
    this.dialogHint = el('div', 'dialog-hint', box);
    this.dialogHint.textContent = isTouch ? content.controls.dialogContinue : 'E / Espaço ▸';
    this.dialog.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction();
    });

    if (debug) this.fps = el('div', 'fps', root);
  }

  private loadingBar: HTMLDivElement | null = null;
  private startCta: HTMLParagraphElement | null = null;

  setLoadingProgress(p: number) {
    if (this.loadingBar) this.loadingBar.style.transform = `scaleX(${p})`;
  }

  setLoadingError(msg: string) {
    if (this.startCta) {
      this.startCta.textContent = msg;
      this.startCta.classList.add('error');
    }
  }

  /**
   * Tela de abertura. Mostra o carregamento e resolve no primeiro toque/tecla depois que
   * `ready` terminar (o toque também libera o áudio, por regra dos navegadores).
   */
  showStartScreen(ready: Promise<unknown>): Promise<void> {
    return new Promise((resolve) => {
      const screen = el('div', 'start-screen', document.body);
      const title = el('h1', 'start-title', screen);
      title.textContent = content.game.title;
      const sub = el('p', 'start-sub', screen);
      sub.textContent = content.game.subtitle;
      const cta = el('p', 'start-cta', screen);
      cta.textContent = content.game.loading;
      cta.classList.add('loading');
      this.startCta = cta;
      const track = el('div', 'loading-track', screen);
      this.loadingBar = el('div', 'loading-bar', track);

      const go = () => {
        window.removeEventListener('keydown', go);
        screen.removeEventListener('pointerdown', go);
        screen.classList.add('fade-out');
        setTimeout(() => screen.remove(), 900);
        resolve();
      };
      ready.then(() => {
        cta.textContent = this.isTouch ? content.game.start : content.game.startDesktop;
        cta.classList.remove('loading');
        track.classList.add('done');
        window.addEventListener('keydown', go);
        screen.addEventListener('pointerdown', go);
      }, () => {});
    });
  }

  showAreaTitle(name: string) {
    this.areaTitle.textContent = name;
    this.areaTitle.classList.remove('show');
    void this.areaTitle.offsetWidth; // reinicia a animação
    this.areaTitle.classList.add('show');
    this.hint.classList.add('show');
    setTimeout(() => this.hint.classList.remove('show'), 7000);
  }

  setInteractPrompt(text: string | null) {
    const visible = text !== null && !this.inDialog;
    if (this.isTouch) {
      this.actionBtn.hidden = !visible;
      if (visible) this.actionBtn.textContent = text;
    } else {
      this.prompt.hidden = !visible;
      if (visible) this.prompt.innerHTML = `<kbd>E</kbd> ${escapeHtml(text)}`;
    }
  }

  get inDialog() {
    return !this.dialog.hidden;
  }

  say(lines: readonly string[], onEnd?: () => void) {
    if (lines.length === 0) return;
    this.lines = lines;
    this.lineIndex = 0;
    this.onDialogEnd = onEnd ?? null;
    this.dialog.hidden = false;
    this.hint.classList.remove('show');
    this.prompt.hidden = true;
    this.actionBtn.hidden = true;
    this.startLine();
  }

  /** Avança o diálogo: completa a linha atual ou passa para a próxima. */
  advance() {
    if (!this.inDialog) return;
    const line = this.lines[this.lineIndex];
    if (this.typing) {
      this.typed = line.length;
      this.dialogText.textContent = line;
      this.typing = false;
      this.dialogHint.classList.add('show');
      return;
    }
    this.lineIndex++;
    if (this.lineIndex >= this.lines.length) {
      this.dialog.hidden = true;
      const cb = this.onDialogEnd;
      this.onDialogEnd = null;
      cb?.();
      return;
    }
    this.startLine();
  }

  private startLine() {
    this.typed = 0;
    this.typing = true;
    this.dialogText.textContent = '';
    this.dialogHint.classList.remove('show');
  }

  update(dt: number, fps?: number) {
    if (this.typing) {
      const line = this.lines[this.lineIndex];
      this.typed = Math.min(line.length, this.typed + dt * 38);
      this.dialogText.textContent = line.slice(0, Math.floor(this.typed));
      if (this.typed >= line.length) {
        this.typing = false;
        this.dialogHint.classList.add('show');
      }
    }
    if (this.fps && fps !== undefined) this.fps.textContent = `${fps.toFixed(0)} fps`;
  }

  get element() {
    return this.root;
  }
}

function el<K extends keyof HTMLElementTagNameMap = 'div'>(tag: K, className: string, parent: HTMLElement) {
  const e = document.createElement(tag);
  e.className = className;
  parent.appendChild(e);
  return e;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
