import './style.css';
import './hud.css';
import * as THREE from 'three';
import { detectQuality, AdaptiveQuality, characterViewer, urlParams, debug } from './core/quality';
import { GameRenderer } from './core/renderer';
import { FollowCamera } from './core/followCamera';
import { Input } from './core/input';
import { OcclusionFader } from './core/occlusion';
import { GameState } from './core/gameState';
import { preload } from './core/assets';
import { Player } from './entities/player';
import { MATHEUS_ASSETS } from './entities/matheusModel';
import { TORCH_MODEL } from './entities/torch';
import { createTestScene, TEST_SCENE_ASSETS } from './scenes/testScene';
import { createVillage, VILLAGE_ASSETS } from './scenes/village';
import { DARK_ENV, type Area, type Interactable } from './scenes/types';
import { UI } from './ui/ui';
import { content, type ItemId } from './content';

const quality = detectQuality();
const container = document.getElementById('app')!;

// ?area=teste abre o salão de testes (o visualizador ?personagem também usa o salão)
const useTestScene = characterViewer || urlParams.get('area') === 'teste';

// ?cam=distancia,elevacao  (depuração: ex. ?cam=40,75 para ver a vila de cima)
const camParams = urlParams.get('cam')?.split(',').map(Number);
const follow = new FollowCamera(camParams?.[0] ?? 17, 45, camParams?.[1] ?? 48);
const input = new Input(container);
input.onZoom((f) => follow.zoomBy(f));
// visualizador: começa aproximado (?perto = rosto)
if (characterViewer) follow.zoomBy(urlParams.has('perto') ? 0.01 : 0.45);
// &alvo=1.0 → o zoom mira essa altura (ex.: a mão) em vez do rosto
if (urlParams.has('alvo')) follow.setFocusHeight(Number(urlParams.get('alvo')));
const ui = new UI(quality.isTouch, () => input.pressAction());

const game = new GameState();
const hasSave = !useTestScene && GameState.hasSave();

const loading = preload(
  [...MATHEUS_ASSETS, TORCH_MODEL, ...(useTestScene ? TEST_SCENE_ASSETS : VILLAGE_ASSETS)],
  (done, total) => ui.setLoadingProgress(done / total),
);
const startChoice = ui.showStartScreen(loading, hasSave);

loading
  .then(async () => {
    // com progresso salvo, a escolha (continuar/recomeçar) vem antes de montar a vila
    if (hasSave && (await startChoice) === 'new') game.reset();
    run(hasSave ? Promise.resolve() : startChoice.then(() => undefined));
  })
  .catch((err) => {
    console.error(err);
    ui.setLoadingError(content.game.loadError);
  });

/** Mantém a barra de inventário e as moedas iguais ao estado salvo. */
function syncInventory() {
  const entries = Object.entries(game.data.items).map(([id, count]) => {
    const it = content.items[id as ItemId];
    return { id, icon: it.icon, name: it.name, desc: it.desc, usedIn: it.usedIn, count };
  });
  ui.setInventory(entries, game.coins);
}

function run(startClicked: Promise<void>) {
  const player = new Player(quality.shadowMapSize);
  const area: Area = useTestScene
    ? createTestScene({ dustCount: quality.dustCount, say: (lines) => ui.say(lines) })
    : createVillage({ ui, game, player, quality });
  const isVillage = !useTestScene;
  if (isVillage) {
    syncInventory();
    game.onChange(syncInventory);
    game.setArea('village');
  }

  player.position.copy(area.spawn);
  player.torch.setLit(area.torchLit ?? true);
  // ?tp=x,z (depuração): começa em outro ponto do mapa
  const tp = urlParams.get('tp')?.split(',').map(Number);
  if (tp && tp.length === 2) player.position.set(tp[0], 0, tp[1]);
  area.scene.add(player.object);
  area.scene.add(player.torch.sparks.points);
  follow.snapTo(player.position);
  // ?debug expõe o jogo no console (window.__dev) para testes e capturas automáticas
  if (debug) Object.assign(window, { __dev: { player, game, area, ui } });

  // Luz de preenchimento fraca vinda do lado da câmera: evita que o moletom preto
  // vire só uma silhueta quando ele está de costas para a tocha. Só no escuro.
  const fillLight = new THREE.PointLight(0xffd2a8, 1.6, 5, 2);
  fillLight.visible = area.torchLit ?? true;
  area.scene.add(fillLight);

  const occlusion = new OcclusionFader();
  area.occluders.forEach((o) => occlusion.add(o));

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
  const adaptive = new AdaptiveQuality(3, (step) => gfx.downgrade(step));

  let started = false;
  startClicked.then(() => {
    started = true;
    ui.showAreaTitle(area.name);
    if (characterViewer) return;
    if (useTestScene) setTimeout(() => ui.say(content.testScene.intro), 1800);
    else if (!game.flag('letterRead')) setTimeout(() => ui.say(content.village.intro), 1800);
  });

  const timer = new THREE.Timer();
  const moveDir = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  function nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of area.interactables) {
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
    const dt = Math.min(timer.getDelta(), 1 / 20); // evita saltos ao trocar de aba
    const time = timer.getElapsed();

    input.update();
    const canMove = started && !ui.inDialog && !characterViewer;
    if (canMove) follow.screenToWorld(input.move.x, input.move.y, moveDir);
    else moveDir.set(0, 0, 0);

    player.update(dt, moveDir, area.world);
    if (characterViewer) player.object.rotation.y = fixedRot !== null ? Number(fixedRot) : time * 0.6;
    area.update(dt, time, player.position);

    const near = canMove ? nearestInteractable() : null;
    ui.setInteractPrompt(near ? near.prompt : null);

    if (input.consumeAction() && started) {
      if (ui.inDialog) ui.advance();
      else if (near) near.onInteract();
    }

    camTarget.set(player.position.x, 1.0, player.position.z);
    follow.update(camTarget, dt);
    fillLight.position.copy(player.position).addScaledVector(follow.offsetDir, 1.8);
    fillLight.position.y += 1.8;
    occlusion.update(dt, follow.camera, player.position);

    ui.update(dt, adaptive.fps);
    adaptive.update(dt);
    gfx.render(time);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
