import './style.css';
import './hud.css';
import * as THREE from 'three';
import { detectQuality, AdaptiveQuality, characterViewer, urlParams, debug } from './core/quality';
import { GameRenderer } from './core/renderer';
import { FollowCamera } from './core/followCamera';
import { Input } from './core/input';
import { SceneManager } from './core/sceneManager';
import { GameState } from './core/gameState';
import { preload } from './core/assets';
import { Player } from './entities/player';
import { MATHEUS_ASSETS } from './entities/matheusModel';
import { TORCH_MODEL } from './entities/torch';
import { CHICKEN_MODEL } from './entities/chicken';
import { createTestScene, TEST_SCENE_ASSETS } from './scenes/testScene';
import { isBuilt, loadArea } from './scenes/registry';
import { DARK_ENV, type Area, type AreaId, type Interactable } from './scenes/types';
import { UI } from './ui/ui';
import { content, type ItemId } from './content';

const quality = detectQuality();
const container = document.getElementById('app')!;

// ?area=teste abre o salão de testes (o visualizador ?personagem também usa o salão)
const useTestScene = characterViewer || urlParams.get('area') === 'teste';

// ?cam=distancia,elevacao  (depuração: ex. ?cam=40,75 para ver a vila de cima)
const camParams = urlParams.get('cam')?.split(',').map(Number);
const follow = new FollowCamera();
const input = new Input(container);
input.onZoom((f) => follow.zoomBy(f));
// visualizador: começa aproximado (?perto = rosto)
if (characterViewer) follow.zoomBy(urlParams.has('perto') ? 0.01 : 0.45);
// &alvo=1.0 → o zoom mira essa altura (ex.: a mão) em vez do rosto
if (urlParams.has('alvo')) follow.setFocusHeight(Number(urlParams.get('alvo')));
const ui = new UI(quality.isTouch, () => input.pressAction(), (kind) => input.pressCombat(kind));

const game = new GameState();
const hasSave = !useTestScene && GameState.hasSave();

/** ?area=vila (ou floresta...) abre direto numa área; sem isso vale a do save, e sem save a vila. */
const AREA_ALIASES: Record<string, AreaId> = { vila: 'village', floresta: 'forest', ruinas: 'ruins', taverna: 'tavern', vinhedo: 'vineyard', castelo: 'castle', visual: 'visual' };
function startTarget(): { id: AreaId; entry?: string } {
  const asked = urlParams.get('area');
  const wanted = asked && (AREA_ALIASES[asked] ?? asked);
  if (wanted && isBuilt(wanted)) return { id: wanted, entry: urlParams.get('entry') ?? undefined };
  if (isBuilt(game.area)) return { id: game.area, entry: game.entry };
  // save da época do mapa-maquete: volta para o portão norte da vila
  if (game.area === 'map') return { id: 'village', entry: 'gate' };
  return { id: 'forest', entry: 'start' };
}
/** ?mapa abre o pergaminho logo no começo (depuração). */
const openMapAtStart = urlParams.has('mapa');

const loading = (async () => {
  const assets = new Set<string>([...MATHEUS_ASSETS, TORCH_MODEL, CHICKEN_MODEL]);
  if (useTestScene) TEST_SCENE_ASSETS.forEach((a) => assets.add(a));
  else {
    const target = startTarget();
    (await loadArea(target.id)).assets.forEach((a) => assets.add(a));
    // com save, "Recomeçar" volta para a floresta: já deixa os modelos dela prontos
    if (hasSave && target.id !== 'forest') (await loadArea('forest')).assets.forEach((a) => assets.add(a));
  }
  const list = [...assets];
  await preload(list, (done, total) => ui.setLoadingProgress(done / total));
})();
const startChoice = ui.showStartScreen(loading, hasSave);

loading
  .then(async () => {
    // com progresso salvo, a escolha (continuar/recomeçar) vem antes de montar a área
    if (hasSave && (await startChoice) === 'new') game.reset();
    await run(hasSave ? Promise.resolve() : startChoice.then(() => undefined));
  })
  .catch((err) => {
    console.error(err);
    ui.setLoadingError(content.game.loadError);
  });

/** Mantém a barra de inventário e as moedas iguais ao estado salvo. */
function syncInventory() {
  // itens de versões antigas do jogo (que não existem mais) ficam de fora
  const entries = Object.entries(game.data.items)
    .filter(([id]) => id in content.items)
    .map(([id, count]) => {
      const it = content.items[id as ItemId];
      return { id, icon: it.icon, name: it.name, desc: it.desc, usedIn: it.usedIn, count };
    });
  ui.setInventory(entries, game.coins);
}

async function run(startClicked: Promise<void>) {
  const player = new Player(quality.shadowMapSize);
  const manager = new SceneManager({
    ui,
    game,
    player,
    follow,
    quality,
    cameraOverride: camParams?.[0] !== undefined ? { distance: camParams[0], pitch: camParams[1] } : undefined,
    areaLabel: (id) => content.areas[id],
  });

  let area: Area;
  if (useTestScene) {
    area = manager.startCustom(createTestScene({ dustCount: quality.dustCount, say: (lines) => ui.say(lines) }));
  } else {
    syncInventory();
    game.onChange(syncInventory);
    const target = startTarget();
    area = await manager.start(target.id, target.entry);
  }

  // ?tp=x,z (depuração): começa em outro ponto do mapa
  const tp = urlParams.get('tp')?.split(',').map(Number);
  if (tp && tp.length === 2) player.position.set(tp[0], 0, tp[1]);
  follow.snapTo(player.position, player.facing);
  // ?debug expõe o jogo no console (window.__dev) para testes e capturas automáticas
  if (debug) {
    const dev = { player, game, ui, manager, follow, goTo: (id: AreaId, entry?: string) => manager.goTo(id, entry) };
    Object.defineProperty(dev, 'area', { get: () => manager.area });
    Object.assign(window, { __dev: dev });
  }

  if (characterViewer) {
    // ?personagem&anim=Walking_A  ou  ?personagem&arm=1H_Ranged_Aiming&armt=0.3
    const anim = urlParams.get('anim');
    const arm = urlParams.get('arm');
    if (anim) player.playFullBody(anim);
    else if (arm) player.setArmPose(arm, Number(urlParams.get('armt') ?? 0.3));
    // &inspecionar: luz neutra forte, sem tocha, para conferir cores e detalhes
    if (urlParams.has('inspecionar')) {
      player.torch.light.castShadow = false;
      player.torch.baseIntensity = 0;
      area.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(3, 5, 6);
      area.scene.add(sun);
    }
    // &equipado: mostra espada e mochila (para conferir o encaixe nas costas)
    if (urlParams.has('equipado')) player.setEquipment({ sword: true, backpack: true });
  }
  const fixedRot = urlParams.get('rot');

  const gfx = new GameRenderer(container, area.scene, follow.camera, quality);
  gfx.applyEnv(area.env ?? DARK_ENV);
  manager.attach(gfx);
  if (debug) Object.assign((window as unknown as { __dev: object }).__dev, { gfx });
  const adaptive = new AdaptiveQuality(4, (step) => gfx.downgrade(step));

  let started = false;
  startClicked.then(() => {
    started = true;
    ui.showAreaTitle(area.name);
    if (characterViewer) return;
    setTimeout(() => {
      area.onEnter?.();
      if (openMapAtStart) void manager.openMap();
    }, 1800);
  });

  // botão e tecla do mapa: aparecem depois que o Matheus compra o mapa
  const syncMapButton = () => ui.setMapButton(!useTestScene && game.has('mapa') && !manager.busy);
  ui.setMapButton(false, () => void manager.openMap());
  syncMapButton();
  game.onChange(syncMapButton);

  const timer = new THREE.Timer();
  const moveDir = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  function nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of manager.area.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.position.x - player.position.x, it.position.z - player.position.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  function frame(timestamp: number) {
    timer.update(timestamp);
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 20)); // evita saltos ao trocar de aba
    const time = timer.getElapsed();
    const current = manager.area;

    input.update();
    const canMove = started && !ui.inDialog && !characterViewer && !manager.busy;
    if (canMove) follow.screenToWorld(input.move.x, input.move.y, moveDir);
    else moveDir.set(0, 0, 0);

    player.update(dt, moveDir, current.world);
    if (characterViewer) player.object.rotation.y = fixedRot !== null ? Number(fixedRot) : time * 0.6;
    current.update(dt, time, player.position);
    manager.hen.update(dt, time);
    if (current.combat) {
      if (canMove && input.consumeAttack()) current.combat.attack();
      if (canMove && input.consumeDodge()) current.combat.dodge(moveDir);
      current.combat.update(dt, time);
    } else {
      input.consumeAttack();
      input.consumeDodge();
    }

    const near = canMove ? nearestInteractable() : null;
    ui.setInteractPrompt(near ? (typeof near.prompt === 'function' ? near.prompt() : near.prompt) : null);

    if (input.consumeAction() && started && !manager.busy) {
      if (ui.inDialog) ui.advance();
      else if (near) near.onInteract();
    }

    if (started && !ui.inDialog && !manager.busy) {
      const look = input.consumeLook();
      if (look.x || look.y) follow.lookBy(look.x, look.y);
    } else input.consumeLook();
    camTarget.set(player.position.x, player.position.y + 1.0, player.position.z);
    follow.update(camTarget, dt, { heading: player.facing, speed: player.speed });
    gfx.applyEnv(current.env ?? DARK_ENV);
    manager.fillLight.position.copy(player.position).addScaledVector(follow.offsetDir, 1.8);
    manager.fillLight.position.y += 1.8;
    manager.occlusion.update(dt, follow.camera, player.position);

    ui.update(dt, adaptive.fps);
    adaptive.update(dt);
    gfx.render(time);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
