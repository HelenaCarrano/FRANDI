import { content } from '../content';
import { debug } from '../core/quality';
import { audio } from '../core/audio';
import { itemArt } from './itemArt';

/**
 * Interface HTML sobre o canvas: tela inicial (continuar/recomeçar), nome da área, dica de
 * controles, aviso de interação, botão de ação (toque), diálogos com nome e escolhas,
 * carta animada, loja, inventário, objetivo atual e avisos curtos.
 */

export interface InventoryEntry {
  id: string;
  icon: string;
  name: string;
  desc: string;
  usedIn: string;
  count: number;
  /** Tecla de atalho mostrada no cantinho do slot (ex.: o graveto na tecla 1). */
  hotkey?: string;
  /** Realçado quando está em uso (na mão). */
  active?: boolean;
  /** Se existir, clicar no slot executa isto em vez de abrir a descrição. */
  onUse?: () => void;
}

export interface ShopEntry {
  id: string;
  icon: string;
  name: string;
  desc: string;
  price: number;
  owned: boolean;
}

export interface VoucherData {
  place: string;
  title: string;
  lines: readonly string[];
  footer: string;
}

/** Desenha o voucher numa imagem 1200 × 720 (borda dourada, texto centralizado). */
function drawVoucher(v: VoucherData): HTMLCanvasElement {
  const W = 1200;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, '#fbefcf');
  bg.addColorStop(1, '#d8b77a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#8a5a1c';
  g.lineWidth = 10;
  g.strokeRect(28, 28, W - 56, H - 56);
  g.lineWidth = 2;
  g.strokeRect(46, 46, W - 92, H - 92);
  g.textAlign = 'center';
  g.fillStyle = '#7a4a14';
  g.font = '600 30px Georgia, serif';
  g.fillText(v.place.toUpperCase(), W / 2, 130);
  g.fillStyle = '#3a2208';
  g.font = 'bold 68px Georgia, serif';
  g.fillText(v.title, W / 2, 230);
  g.font = '34px Georgia, serif';
  g.fillStyle = '#4a2f10';
  let y = 330;
  for (const line of v.lines) {
    // quebra de linha simples
    const words = line.split(' ');
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (g.measureText(test).width > W - 200 && cur) {
        g.fillText(cur, W / 2, y);
        y += 46;
        cur = w;
      } else cur = test;
    }
    g.fillText(cur, W / 2, y);
    y += 62;
  }
  g.font = 'italic 36px Georgia, serif';
  g.fillStyle = '#7a4a14';
  g.fillText(v.footer, W / 2, H - 90);
  return c;
}

export interface ShopConfig {
  title: string;
  hint: string;
  entries: () => ShopEntry[];
  coins: () => number;
  /** Tenta comprar; devolve true se a compra foi feita. */
  onBuy: (id: string) => boolean;
}

const TYPE_SPEED = 38; // caracteres por segundo
const FADE_MS = 900; // mesma duração da transição de .fade-overlay em hud.css

export class UI {
  private readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly actionBtn: HTMLButtonElement;
  private readonly dialog: HTMLDivElement;
  private readonly dialogSpeaker: HTMLDivElement;
  private readonly dialogText: HTMLParagraphElement;
  private readonly dialogOptions: HTMLDivElement;
  private readonly dialogHint: HTMLDivElement;
  private readonly areaTitle: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly objectiveText: HTMLSpanElement;
  private readonly inventory: HTMLDivElement;
  private readonly coinsBadge: HTMLDivElement;
  private readonly popover: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly fps: HTMLDivElement | null = null;

  private lines: readonly string[] = [];
  private lineIndex = 0;
  private typed = 0;
  private typing = false;
  private onDialogEnd: (() => void) | null = null;
  private asking: ((i: number) => void) | null = null;
  private optionButtons: HTMLButtonElement[] = [];

  private letterEl: HTMLDivElement | null = null;
  private letterState: { paras: HTMLElement[]; texts: string[]; index: number; typed: number; done: boolean; close: () => void } | null = null;
  private shopEl: HTMLDivElement | null = null;
  private shopClose: (() => void) | null = null;
  private popoverTimer = 0;

  constructor(
    private readonly isTouch: boolean,
    onAction: () => void,
    private readonly onCombat: (kind: 'attack' | 'dodge') => void = () => {},
  ) {
    const root = document.createElement('div');
    root.className = 'ui';
    document.body.appendChild(root);
    this.root = root;

    this.areaTitle = el('div', 'area-title', root);
    this.hint = el('div', 'controls-hint', root);
    this.hint.textContent = isTouch ? content.controls.mobile : content.controls.desktop;

    this.objective = el('div', 'objective', root);
    this.objective.hidden = true;
    el('span', 'objective-label', this.objective).textContent = 'Objetivo';
    this.objectiveText = el('span', 'objective-text', this.objective);

    this.toasts = el('div', 'toasts', root);

    this.inventory = el('div', 'inventory', root);
    this.coinsBadge = el('div', 'coins', this.inventory);
    this.popover = el('div', 'item-popover', root);
    this.popover.hidden = true;
    this.popover.addEventListener('pointerdown', (e) => e.stopPropagation());

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
    this.dialogSpeaker = el('div', 'dialog-speaker', box);
    this.dialogText = el('p', 'dialog-text', box);
    this.dialogOptions = el('div', 'dialog-options', box);
    this.dialogHint = el('div', 'dialog-hint', box);
    this.dialogHint.textContent = isTouch ? content.controls.dialogContinue : 'E / Espaço ▸';
    this.dialog.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.asking) onAction();
    });

    const mute = el('button', 'mute-btn', root);
    const paint = () => {
      mute.textContent = audio.muted ? '🔇' : '🔊';
      mute.title = audio.muted ? 'Ligar o som' : 'Silenciar';
    };
    paint();
    mute.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.setMuted(!audio.muted);
      paint();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
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
   * Com progresso salvo, oferece "Continuar" e "Recomeçar" (com confirmação).
   */
  showStartScreen(ready: Promise<unknown>, hasSave = false): Promise<'continue' | 'new'> {
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
      const choices = el('div', 'start-choices', screen);
      choices.hidden = true;

      const go = (choice: 'continue' | 'new') => {
        window.removeEventListener('keydown', onKey);
        screen.removeEventListener('pointerdown', onTap);
        screen.classList.add('fade-out');
        setTimeout(() => screen.remove(), 900);
        resolve(choice);
      };
      const onKey = () => go('continue');
      const onTap = () => go('continue');

      const showMenu = () => {
        choices.replaceChildren();
        choices.hidden = false;
        const cont = el('button', 'btn primary', choices);
        cont.textContent = content.ui.continue;
        cont.addEventListener('click', () => go('continue'));
        const fresh = el('button', 'btn', choices);
        fresh.textContent = content.ui.newGame;
        fresh.addEventListener('click', () => {
          choices.replaceChildren();
          const msg = el('p', 'start-confirm', choices);
          msg.textContent = content.ui.confirmNew;
          const yes = el('button', 'btn danger', choices);
          yes.textContent = content.ui.yes;
          yes.addEventListener('click', () => go('new'));
          const back = el('button', 'btn primary', choices);
          back.textContent = content.ui.no;
          back.addEventListener('click', showMenu);
        });
      };

      ready.then(
        () => {
          track.classList.add('done');
          cta.classList.remove('loading');
          if (hasSave) {
            cta.textContent = '';
            showMenu();
          } else {
            cta.textContent = this.isTouch ? content.game.start : content.game.startDesktop;
            window.addEventListener('keydown', onKey);
            screen.addEventListener('pointerdown', onTap);
          }
        },
        () => {},
      );
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

  /** Verdadeiro enquanto qualquer janela (diálogo, escolha, carta, loja) estiver aberta. */
  get inDialog() {
    return !this.dialog.hidden || this.letterEl !== null || this.shopEl !== null || this.endEl !== null || this.modalEl !== null;
  }

  // ---------- diálogo ----------

  say(lines: readonly string[], onEnd?: () => void, speaker?: string) {
    if (lines.length === 0) {
      onEnd?.();
      return;
    }
    this.lines = lines;
    this.lineIndex = 0;
    this.onDialogEnd = onEnd ?? null;
    this.openDialog(speaker);
    this.dialogOptions.replaceChildren();
    this.startLine();
  }

  /** Versão com promessa: resolve quando o jogador termina de ler. */
  tell(lines: readonly string[], speaker?: string): Promise<void> {
    return new Promise((resolve) => this.say(lines, resolve, speaker));
  }

  /** Pergunta com botões. Resolve com o índice da opção escolhida (teclas 1-4 também valem). */
  ask(question: string, options: readonly string[], speaker?: string): Promise<number> {
    return new Promise((resolve) => {
      this.lines = [question];
      this.lineIndex = 0;
      this.onDialogEnd = null;
      this.openDialog(speaker);
      this.startLine();
      this.dialogOptions.replaceChildren();
      this.optionButtons = options.map((label, i) => {
        const b = el('button', 'btn option', this.dialogOptions);
        b.textContent = this.isTouch ? label : `${i + 1}. ${label}`;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', () => this.choose(i));
        return b;
      });
      this.asking = (i) => {
        this.dialog.hidden = true;
        this.dialogOptions.replaceChildren();
        this.optionButtons = [];
        resolve(i);
      };
      this.dialogHint.classList.remove('show');
    });
  }

  private choose(i: number) {
    audio.play('select');
    const fn = this.asking;
    this.asking = null;
    fn?.(i);
  }

  private openDialog(speaker?: string) {
    this.dialog.hidden = false;
    this.dialogSpeaker.textContent = speaker ?? '';
    this.dialogSpeaker.hidden = !speaker;
    this.hint.classList.remove('show');
    this.prompt.hidden = true;
    this.actionBtn.hidden = true;
    this.hidePopover();
  }

  /** Avança o que estiver aberto: diálogo (completa a linha ou passa) ou carta. */
  advance() {
    if (this.modalAdvance) {
      this.modalAdvance();
      return;
    }
    if (this.letterState) {
      this.advanceLetter();
      return;
    }
    if (!this.dialog.hidden && !this.asking) this.advanceDialog();
  }

  private advanceDialog() {
    const line = this.lines[this.lineIndex];
    if (this.typing) {
      this.typed = line.length;
      this.dialogText.textContent = line;
      this.typing = false;
      this.dialogHint.classList.add('show');
      return;
    }
    this.lineIndex++;
    if (this.lineIndex < this.lines.length) audio.play('tick');
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

  // ---------- carta animada ----------

  /** Mostra uma carta com o texto aparecendo aos poucos. Resolve quando ela é guardada. */
  letter(title: string, paragraphs: readonly string[], closeLabel: string): Promise<void> {
    return new Promise((resolve) => {
      this.hidePopover();
      const overlay = el('div', 'letter-overlay', this.root);
      const card = el('div', 'letter', overlay);
      el('h2', 'letter-title', card).textContent = title;
      const paras = paragraphs.map((_, i) => {
        const t = paragraphs[i];
        const p = el('p', 'letter-p' + (t.startsWith('• ') ? ' item' : i === paragraphs.length - 1 && t.startsWith('—') ? ' sign' : ''), card);
        p.textContent = '';
        return p;
      });
      const btn = el('button', 'btn primary letter-close', card);
      btn.textContent = closeLabel;
      btn.hidden = true;
      this.letterEl = overlay;
      const finish = () => {
        overlay.remove();
        this.letterEl = null;
        this.letterState = null;
        resolve();
      };
      btn.addEventListener('click', finish);
      this.letterState = { paras, texts: [...paragraphs], index: 0, typed: 0, done: false, close: finish };
      overlay.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('button')) return;
        this.advanceLetter();
      });
      this.letterBtn = btn;
    });
  }
  private letterBtn: HTMLButtonElement | null = null;

  private advanceLetter() {
    const st = this.letterState;
    if (!st) return;
    if (!st.done) {
      // primeiro toque completa o texto todo
      st.paras.forEach((p, i) => (p.textContent = st.texts[i]));
      st.done = true;
      if (this.letterBtn) this.letterBtn.hidden = false;
    } else {
      st.close();
    }
  }

  // ---------- loja ----------

  openShop(cfg: ShopConfig): Promise<void> {
    return new Promise((resolve) => {
      this.hidePopover();
      const overlay = el('div', 'shop-overlay', this.root);
      const panel = el('div', 'shop', overlay);
      const head = el('div', 'shop-head', panel);
      el('h2', 'shop-title', head).textContent = cfg.title;
      const coins = el('div', 'coins', head);
      const list = el('div', 'shop-list', panel);
      el('p', 'shop-hint', panel).textContent = cfg.hint;
      const close = el('button', 'btn primary shop-close', panel);
      close.textContent = content.ui.close;

      const render = () => {
        coins.textContent = `🪙 ${cfg.coins()}`;
        list.replaceChildren();
        for (const e of cfg.entries()) {
          const row = el('div', 'shop-row', list);
          el('div', 'shop-icon', row).textContent = e.icon;
          const info = el('div', 'shop-info', row);
          el('div', 'shop-name', info).textContent = e.name;
          el('div', 'shop-desc', info).textContent = e.desc;
          const buy = el('button', 'btn buy', row);
          if (e.owned) {
            buy.textContent = content.ui.owned;
            buy.disabled = true;
          } else {
            const can = cfg.coins() >= e.price;
            buy.textContent = `🪙 ${e.price}`;
            buy.classList.toggle('poor', !can);
            buy.title = can ? content.ui.buy : content.ui.notEnough;
            buy.addEventListener('click', () => {
              if (cfg.onBuy(e.id)) render();
            });
          }
        }
      };
      render();
      overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.shopEl = overlay;
      const done = () => {
        overlay.remove();
        this.shopEl = null;
        this.shopClose = null;
        resolve();
      };
      this.shopClose = done;
      close.addEventListener('click', done);
    });
  }

  // ---------- janelas de minijogo ----------

  private modalEl: HTMLDivElement | null = null;

  /**
   * Abre uma janela sobre o jogo (forja, engrenagens...). `build` monta o conteúdo e recebe `close`
   * para encerrar; a promessa resolve com o valor passado a `close`. Enquanto aberta, o jogo para.
   */
  modal<T = void>(className: string, build: (box: HTMLElement, close: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve) => {
      const overlay = el('div', 'modal-overlay', this.root);
      const box = el('div', `modal-box ${className}`, overlay);
      overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.modalEl = overlay;
      this.prompt.hidden = true;
      this.actionBtn.hidden = true;
      build(box, (value) => {
        overlay.remove();
        this.modalEl = null;
        resolve(value);
      });
    });
  }

  /** Janela de memória: foto (ou moldura vazia), título e texto. Resolve quando o jogador a guarda. */
  showMemory(mem: { title: string; text: readonly string[]; caption?: string; photo?: string }): Promise<void> {
    audio.play('memory');
    return this.modal<void>('memory-box', (box, close) => {
      const frame = el('div', 'memory-frame', box);
      const empty = el('div', 'memory-empty', frame);
      empty.textContent = content.ui.memoryNoPhoto;
      if (mem.photo) {
        const img = el('img', 'memory-photo', frame);
        img.alt = mem.caption ?? mem.title;
        img.hidden = true;
        img.addEventListener('load', () => {
          img.hidden = false;
          empty.hidden = true;
        });
        img.src = `${import.meta.env.BASE_URL}photos/${mem.photo}`;
      }
      if (mem.caption) el('div', 'memory-caption', box).textContent = mem.caption;
      el('h3', 'mg-title', box).textContent = mem.title;
      for (const line of mem.text) el('p', 'memory-text', box).textContent = line;
      const btn = el('button', 'btn primary', box);
      btn.textContent = content.ui.memoryKeep;
      btn.addEventListener('click', () => close());
    });
  }

  private modalAdvance: (() => void) | null = null;

  /**
   * Texto sobre fundo escuro, um parágrafo por toque (abertura da Floresta e fragmentos de memória).
   * `kind` 'fragment' ganha o visual embaçado de lembrança.
   */
  narrate(header: string, paragraphs: readonly string[], kind: 'narrate' | 'fragment' = 'narrate'): Promise<void> {
    return this.modal<void>(`narrate-box ${kind}`, (box, close) => {
      const overlay = box.parentElement!;
      overlay.classList.add('narrate-overlay', kind);
      if (kind === 'fragment') audio.play('memory');
      el('h2', 'narrate-header', box).textContent = header;
      // todas as falas ocupam o mesmo lugar: aparece uma de cada vez, a anterior some
      const stack = el('div', 'narrate-stack', box);
      const paras = paragraphs.map((t) => {
        const p = el('p', 'narrate-line', stack);
        p.textContent = t;
        return p;
      });
      // pontinhos de progresso (só quando há mais de uma fala)
      const dots = paras.length > 1 ? el('div', 'narrate-dots', box) : null;
      const dotEls = dots ? paras.map(() => el('i', '', dots)) : [];
      const more = el('div', 'narrate-more', box);
      more.textContent = this.isTouch ? content.controls.dialogContinue : 'E / Espaço ▸';
      let shown = 0;
      let leaving = false;
      const next = () => {
        if (leaving) return;
        if (shown < paras.length) {
          if (shown > 0) audio.play('tick');
          if (shown > 0) paras[shown - 1].classList.remove('show');
          paras[shown++].classList.add('show');
          dotEls.forEach((d, i) => d.classList.toggle('on', i === shown - 1));
          return;
        }
        leaving = true;
        this.modalAdvance = null;
        overlay.classList.add('leaving');
        setTimeout(() => close(), 450);
      };
      this.modalAdvance = next;
      overlay.addEventListener('pointerdown', next);
      // a primeira linha aparece sozinha, depois de um instante no escuro
      setTimeout(() => shown === 0 && next(), 900);
    });
  }

  /**
   * O voucher do presente: um cartão dourado na tela, com botão para salvar como imagem (PNG gerada na hora).
   * Resolve quando o jogador o guarda.
   */
  showVoucher(v: VoucherData, saveLabel: string, closeLabel: string, fileName: string): Promise<void> {
    return this.modal<void>('voucher-box', (box, close) => {
      const card = el('div', 'voucher-card', box);
      el('div', 'voucher-place', card).textContent = v.place;
      el('h3', 'voucher-title', card).textContent = v.title;
      for (const l of v.lines) el('p', 'voucher-line', card).textContent = l;
      el('div', 'voucher-footer', card).textContent = v.footer;
      const row = el('div', 'voucher-actions', box);
      const save = el('button', 'btn', row);
      save.textContent = saveLabel;
      save.addEventListener('click', () => {
        const canvas = drawVoucher(v);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, 'image/png');
      });
      const ok = el('button', 'btn primary', row);
      ok.textContent = closeLabel;
      ok.addEventListener('click', () => close());
    });
  }

  // ---------- corações e botões de combate ----------

  private heartsEl: HTMLDivElement | null = null;
  private combatEl: HTMLDivElement | null = null;

  /** Corações de vida (só em áreas com combate). `null` esconde. */
  setHearts(current: number | null, max = 3) {
    if (current === null) {
      if (this.heartsEl) this.heartsEl.hidden = true;
      if (this.combatEl) this.combatEl.hidden = true;
      return;
    }
    if (!this.heartsEl) {
      this.heartsEl = el('div', 'hearts', this.root);
      this.combatEl = el('div', 'combat-btns', this.root);
      const mk = (cls: string, label: string, kind: 'attack' | 'dodge') => {
        const b = el('button', `combat-btn ${cls}`, this.combatEl!);
        b.textContent = label;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!this.inDialog) this.onCombat(kind);
        });
      };
      mk('attack', this.isTouch ? '⚔️' : '⚔️ Clique', 'attack');
      mk('dodge', this.isTouch ? '💨' : '💨 Ctrl', 'dodge');
    }
    this.heartsEl.hidden = false;
    this.combatEl!.hidden = false;
    let html = '';
    for (let i = 0; i < max; i++) html += `<span class="heart${i < current ? '' : ' empty'}">${i < current ? '❤️' : '🖤'}</span>`;
    if (this.heartsEl.innerHTML !== html) this.heartsEl.innerHTML = html;
  }

  /** Pisca vermelho na tela quando o Matheus apanha. */
  hurtFlash() {
    const f = el('div', 'hurt-flash', this.root);
    setTimeout(() => f.remove(), 450);
  }

  // ---------- barra de progresso (ex.: confiança do cavalo) ----------

  private progressEl: HTMLDivElement | null = null;
  private progressFill: HTMLDivElement | null = null;
  private progressLabel: HTMLDivElement | null = null;

  /** Mostra uma barra com texto no meio da tela; `value` de 0 a 1, ou `null` para esconder. */
  setProgress(label: string | null, value = 0) {
    if (label === null) {
      if (this.progressEl) this.progressEl.hidden = true;
      return;
    }
    if (!this.progressEl) {
      this.progressEl = el('div', 'progress-card', this.root);
      this.progressLabel = el('div', 'progress-label', this.progressEl);
      const track = el('div', 'progress-track', this.progressEl);
      this.progressFill = el('div', 'progress-fill', track);
    }
    this.progressEl.hidden = false;
    if (this.progressLabel!.textContent !== label) this.progressLabel!.textContent = label;
    this.progressFill!.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`;
  }

  // ---------- balões de fala sobre as pessoas ----------

  private bubbleLayer: HTMLDivElement | null = null;
  private bubbles = new Map<string, HTMLDivElement>();

  /** Balão de fala preso a um ponto da tela (x, y em pixels); `text` null apaga. */
  bubble(key: string, text: string | null, x = 0, y = 0) {
    this.bubbleLayer ??= el('div', 'bubbles', this.root);
    let b = this.bubbles.get(key);
    if (text === null) {
      if (b) b.classList.remove('show');
      return;
    }
    if (!b) {
      b = el('div', 'bubble', this.bubbleLayer);
      this.bubbles.set(key, b);
    }
    if (b.textContent !== text) b.textContent = text;
    b.classList.add('show');
    b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  /** Apaga todos os balões (troca de área). */
  clearBubbles() {
    this.bubbles.forEach((b) => b.remove());
    this.bubbles.clear();
  }

  // ---------- botão do mapa ----------

  private mapBtn: HTMLButtonElement | null = null;
  private mapPress: (() => void) | null = null;

  /** Botão "Mapa" no canto da tela (depois que o Matheus compra o mapa). Tecla M também vale. */
  setMapButton(visible: boolean, onPress?: () => void) {
    if (!this.mapBtn) {
      this.mapBtn = el('button', 'map-btn', this.root);
      this.mapBtn.innerHTML = `<span>🗺️</span><span>${escapeHtml(content.kingdomMap.openButton)}${this.isTouch ? '' : ' (M)'}</span>`;
      this.mapBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.mapPress?.();
      });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM' && !e.repeat && !this.inDialog && !this.mapBtn!.hidden) this.mapPress?.();
      });
    }
    if (onPress) this.mapPress = onPress;
    this.mapBtn.hidden = !visible;
  }

  // ---------- botão do cavalo ----------

  private horseBtn: HTMLButtonElement | null = null;

  /** Botão redondo do cavalo (chamar / montar / desmontar). `null` esconde. Tecla H também vale. */
  setHorseButton(label: string | null, onPress?: () => void) {
    if (!this.horseBtn) {
      this.horseBtn = el('button', 'horse-btn', this.root);
      this.horseBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.inDialog) this.horsePress?.();
      });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyH' && !e.repeat && !this.inDialog && !this.horseBtn!.hidden) this.horsePress?.();
      });
    }
    this.horsePress = onPress ?? null;
    this.horseBtn.hidden = label === null || this.inDialog;
    if (label !== null) this.horseBtn.innerHTML = `<span class="horse-ico">🐴</span><span class="horse-txt">${escapeHtml(label)}${this.isTouch ? '' : ' (H)'}</span>`;
  }
  private horsePress: (() => void) | null = null;

  // ---------- cartão final de área ----------

  private endEl: HTMLDivElement | null = null;

  showEndCard(title: string, text: string, buttonLabel: string): Promise<void> {
    return new Promise((resolve) => {
      const overlay = el('div', 'end-overlay', this.root);
      const box = el('div', 'end-card', overlay);
      el('h2', 'end-title', box).textContent = title;
      el('p', 'end-text', box).textContent = text;
      const btn = el('button', 'btn primary', box);
      btn.textContent = buttonLabel;
      overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.endEl = overlay;
      btn.addEventListener('click', () => {
        overlay.remove();
        this.endEl = null;
        resolve();
      });
    });
  }

  // ---------- fade entre áreas ----------

  private fadeEl: HTMLDivElement | null = null;
  private fadeLabel: HTMLDivElement | null = null;

  /** Escurece (`on`) ou clareia a tela, com o nome do destino no escuro. Resolve ao terminar a transição. */
  fade(on: boolean, label = ''): Promise<void> {
    if (!this.fadeEl) {
      this.fadeEl = el('div', 'fade-overlay', this.root);
      this.fadeLabel = el('div', 'fade-label', this.fadeEl);
      this.fadeEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    const node = this.fadeEl;
    if (on) audio.play('whoosh');
    if (on && this.fadeLabel) this.fadeLabel.textContent = label;
    return new Promise((resolve) => {
      const done = () => {
        node.removeEventListener('transitionend', done);
        clearTimeout(timer);
        resolve();
      };
      // se o navegador não disparar transitionend (aba em segundo plano), segue mesmo assim
      const timer = window.setTimeout(done, FADE_MS + 150);
      node.addEventListener('transitionend', done);
      node.classList.toggle('on', on);
    });
  }

  // ---------- objetivo, avisos e inventário ----------

  setObjective(text: string | null) {
    this.objective.hidden = text === null;
    if (text !== null && this.objectiveText.textContent !== text) {
      this.objectiveText.textContent = text;
      this.objective.classList.remove('flash');
      void this.objective.offsetWidth;
      this.objective.classList.add('flash');
    }
  }

  /** Aviso curto no alto da tela ("+5 moedas", "Item recebido: ..."). */
  toast(text: string) {
    const t = el('div', 'toast', this.toasts);
    t.textContent = text;
    while (this.toasts.children.length > 2) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 1800);
    setTimeout(() => t.remove(), 2400);
  }

  setInventory(entries: readonly InventoryEntry[], coins: number) {
    this.coinsBadge.textContent = `🪙 ${coins}`;
    this.inventory.querySelectorAll('.slot').forEach((n) => n.remove());
    for (const e of entries) {
      const slot = el('button', 'slot', this.inventory);
      const art = itemArt(e.id);
      if (art) slot.innerHTML = `<img class="slot-art" src="${art}" alt="">`;
      else slot.textContent = e.icon;
      slot.setAttribute('aria-label', e.name);
      if (e.count > 1) el('span', 'slot-count', slot).textContent = String(e.count);
      if (e.hotkey) el('span', 'slot-key', slot).textContent = e.hotkey;
      if (e.hotkey) slot.classList.toggle('active', !!e.active);
      slot.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      slot.addEventListener('click', () => (e.onUse ? e.onUse() : this.showPopover(e)));
    }
  }

  private showPopover(e: InventoryEntry) {
    this.popover.replaceChildren();
    const popTitle = el('div', 'pop-title', this.popover);
    const popArt = itemArt(e.id);
    if (popArt) popTitle.innerHTML = `<img class="slot-art small" src="${popArt}" alt=""> ${e.name}`;
    else popTitle.textContent = `${e.icon} ${e.name}`;
    el('div', 'pop-desc', this.popover).textContent = e.desc;
    el('div', 'pop-used', this.popover).textContent = content.ui.usedIn.replace('{where}', e.usedIn);
    this.popover.hidden = false;
    clearTimeout(this.popoverTimer);
    this.popoverTimer = window.setTimeout(() => this.hidePopover(), 6000);
  }

  private hidePopover() {
    this.popover.hidden = true;
    clearTimeout(this.popoverTimer);
  }

  // ---------- teclado ----------

  private onKey(e: KeyboardEvent) {
    if (this.asking && /^Digit[1-4]$/.test(e.code)) {
      const i = Number(e.code.slice(5)) - 1;
      if (i < this.optionButtons.length) this.choose(i);
    } else if (e.code === 'Escape') {
      if (this.shopClose) this.shopClose();
      else this.hidePopover();
    }
  }

  update(dt: number, fps?: number) {
    if (this.typing) {
      const line = this.lines[this.lineIndex];
      this.typed = Math.min(line.length, this.typed + dt * TYPE_SPEED);
      this.dialogText.textContent = line.slice(0, Math.floor(this.typed));
      if (this.typed >= line.length) {
        this.typing = false;
        if (!this.asking) this.dialogHint.classList.add('show');
      }
    }
    const st = this.letterState;
    if (st && !st.done) {
      st.typed += dt * (TYPE_SPEED + 10);
      let left = Math.floor(st.typed);
      for (let i = 0; i < st.texts.length; i++) {
        const t = st.texts[i];
        st.paras[i].textContent = t.slice(0, Math.max(0, Math.min(t.length, left)));
        left -= t.length + 8; // pequena pausa entre parágrafos
      }
      if (left >= 0) {
        st.done = true;
        if (this.letterBtn) this.letterBtn.hidden = false;
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
