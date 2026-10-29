import '../style.css';
import '../hud.css';
import { audio } from '../core/audio';
import { GameState } from '../core/gameState';
import { Input } from '../core/input';
import { debug, detectQuality, urlParams } from '../core/quality';
import { content, type ItemId } from '../content';
import { UI } from '../ui/ui';
import { Fx } from './fx';
import { Hen } from './hen';
import { buildKit, type Kit } from './kit';
import { SceneManager, isBuilt } from './manager';
import { Player } from './player';
import { Renderer } from './renderer';
import type { AreaId, Drawable, Interactable, Light } from './types';

/**
 * Jogo em 2D: monta a interface (que é a mesma de antes), o save e o áudio, e roda o laço principal.
 * ?area=floresta&entry=portal abre direto numa área; ?debug expõe o jogo em window.__dev.
 */

const AREA_ALIASES: Record<string, AreaId> = { vila: 'village', floresta: 'forest', ruinas: 'ruins', taverna: 'tavern', vinhedo: 'vineyard', castelo: 'castle', final: 'ending' };

export async function boot() {
  const screen = document.getElementById('screen') as HTMLCanvasElement;
  const quality = detectQuality();
  const input = new Input(screen);
  const ui = new UI(quality.isTouch, () => input.pressAction(), (kind) => input.pressCombat(kind));
  const game = new GameState();
  const hasSave = GameState.hasSave();

  let kit!: Kit;
  const loading = (async () => {
    ui.setLoadingProgress(0.1);
    await new Promise((r) => setTimeout(r, 60));
    kit = buildKit();
    ui.setLoadingProgress(1);
  })();
  const startChoice = ui.showStartScreen(loading, hasSave);

  try {
    await loading;
    if (hasSave && (await startChoice) === 'new') game.reset();
    await run(hasSave ? Promise.resolve() : startChoice.then(() => undefined));
  } catch (err) {
    console.error(err);
    ui.setLoadingError(content.game.loadError);
  }

  async function run(startClicked: Promise<void>) {
    const fx = new Fx();
    const player = new Player(kit, fx);
    const hen = new Hen(kit, ui, game, player);
    const renderer = new Renderer(screen, kit);
    addEventListener('resize', () => renderer.resize());

    const cam = { x: 0, y: 0 };
    const follow = (area: { w: number; h: number }, snap: boolean, dt: number) => {
      const tx = Math.min(Math.max(player.x + player.vx * 0.3 - renderer.viewW / 2, 0), Math.max(0, area.w - renderer.viewW));
      const ty = Math.min(Math.max(player.y + player.vy * 0.22 - 10 - renderer.viewH / 2, 0), Math.max(0, area.h - renderer.viewH));
      const cx = area.w < renderer.viewW ? (area.w - renderer.viewW) / 2 : tx;
      const cy = area.h < renderer.viewH ? (area.h - renderer.viewH) / 2 : ty;
      if (snap) {
        cam.x = cx;
        cam.y = cy;
      } else {
        const k = 1 - Math.exp(-6 * dt);
        cam.x += (cx - cam.x) * k;
        cam.y += (cy - cam.y) * k;
      }
    };
    let snapNext = true;

    const toScreen = (x: number, y: number) => {
      const r = screen.getBoundingClientRect();
      return { x: r.left + (x - Math.round(cam.x)) * renderer.scale, y: r.top + (y - Math.round(cam.y)) * renderer.scale };
    };
    const manager = new SceneManager({ ui, game, player, kit, fx, hen, snapCamera: () => (snapNext = true), toScreen });

    const asked = urlParams.get('area');
    const wanted = asked && (AREA_ALIASES[asked] ?? asked);
    const startId: AreaId = wanted && isBuilt(wanted) ? wanted : isBuilt(game.area) ? game.area : 'forest';
    const startEntry = wanted && isBuilt(wanted) ? urlParams.get('entry') ?? undefined : isBuilt(game.area) ? game.entry : 'start';

    const syncInventory = () => {
      const entries = Object.entries(game.data.items)
        .filter(([id]) => id in content.items)
        .map(([id, count]) => {
          const it = content.items[id as ItemId];
          return { id, icon: it.icon, name: it.name, desc: it.desc, usedIn: it.usedIn, count };
        });
      ui.setInventory(entries, game.coins);
    };
    syncInventory();
    game.onChange(() => {
      syncInventory();
      syncMapButton();
      player.backpack = game.has('mochila');
      player.sword = game.has('espada');
    });
    const syncMapButton = () => ui.setMapButton(game.has('mapa') && !manager.busy);
    ui.setMapButton(false, () => void manager.openMap());
    syncMapButton();
    player.backpack = game.has('mochila');
    player.sword = game.has('espada');

    await manager.start(startId, startEntry);
    if (debug) {
      const dev = { game, ui, manager, player, hen, fx, audio, goTo: (id: AreaId, entry?: string) => manager.goTo(id, entry) };
      Object.defineProperty(dev, 'area', { get: () => manager.area });
      Object.assign(window, { __dev: dev });
    }
    const tp = urlParams.get('tp')?.split(',').map(Number);
    if (tp && tp.length === 2) player.place(tp[0], tp[1]);

    let started = false;
    startClicked.then(() => {
      started = true;
      ui.showAreaTitle(manager.area.name);
      setTimeout(() => manager.area.onEnter?.(), 1800);
    });

    const nearestInteractable = (): Interactable | null => {
      let best: Interactable | null = null;
      let bestD = Infinity;
      for (const it of manager.area.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const d = Math.hypot(it.x - player.x, it.y - player.y);
        if (d < it.radius && d < bestD) {
          best = it;
          bestD = d;
        }
      }
      return best;
    };

    let last = performance.now();
    let time = 0;
    const frame = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      time += dt;
      const area = manager.area;

      input.update();
      const canMove = started && !ui.inDialog && !manager.busy;
      const move = canMove ? input.move : { x: 0, y: 0 };
      player.onPath = area.isPath?.(player.x, player.y) ?? false;
      player.update(dt, move, area.collision, time);
      area.update(dt, time, player);
      hen.update(dt, time);
      fx.update(dt);
      audio.update(dt);
      audio.footsteps(dt, started && !manager.busy && !ui.inDialog ? player.speed / 18 : 0, false);

      if (area.combat) {
        if (canMove && input.consumeAttack()) area.combat.attack();
        if (canMove && input.consumeDodge()) area.combat.dodge(move.x, -move.y);
        area.combat.update(dt, time);
      } else {
        input.consumeAttack();
        input.consumeDodge();
      }
      player.torchOn = area.torchLit?.() ?? false;

      const near = canMove ? nearestInteractable() : null;
      ui.setInteractPrompt(near ? (typeof near.prompt === 'function' ? near.prompt() : near.prompt) : null);
      if (input.consumeAction() && started && !manager.busy) {
        if (ui.inDialog) ui.advance();
        else if (near) near.onInteract();
      }
      input.consumeLook();

      follow(area, snapNext, dt);
      snapNext = false;

      // ---- desenho
      const entities: Drawable[] = [];
      entities.push(player.drawable(() => area.env.dark));
      const hd = hen.drawable();
      if (hd) entities.push(hd);
      area.combat?.drawables(entities, time);
      for (const it of area.interactables) {
        if (!it.mark || !it.mark() || (it.enabled && !it.enabled())) continue;
        entities.push({
          y: it.y + 40,
          draw: (v, cx, cy, t) => {
            const sx = Math.round(it.x - cx);
            const sy = Math.round(it.y - cy - 18 + Math.sin(t * 2.4 + it.x) * 2);
            const s = 2 + Math.round(Math.sin(t * 5 + it.y) * 0.6);
            v.fillStyle = '#fff2b0';
            v.fillRect(sx - 1, sy - s, 2, s * 2 + 1);
            v.fillRect(sx - s, sy - 1, s * 2 + 1, 2);
            v.fillStyle = '#ffffff';
            v.fillRect(sx - 1, sy - 1, 2, 2);
          },
        });
      }
      const lights: Light[] = [];
      player.lights(lights, time, area.env.dark);
      renderer.draw({
        area,
        camX: Math.round(cam.x),
        camY: Math.round(cam.y),
        time,
        dt,
        focus: { x: player.x, y: player.y, moving: player.moving },
        entities,
        lights,
        fx,
      });
      ui.update(dt, 60);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
