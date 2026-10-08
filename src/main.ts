import './style.css';
import * as THREE from 'three';
import { detectQuality, AdaptiveQuality, characterViewer, urlParams } from './core/quality';
import { GameRenderer } from './core/renderer';
import { FollowCamera } from './core/followCamera';
import { Input } from './core/input';
import { OcclusionFader } from './core/occlusion';
import { preload } from './core/assets';
import { Player } from './entities/player';
import { MATHEUS_ASSETS } from './entities/matheusModel';
import { TORCH_MODEL } from './entities/torch';
import { createTestScene, TEST_SCENE_ASSETS } from './scenes/testScene';
import { UI } from './ui/ui';
import { content } from './content';
import type { Interactable } from './scenes/types';

const quality = detectQuality();
const container = document.getElementById('app')!;

const follow = new FollowCamera();
const input = new Input(container);
input.onZoom((f) => follow.zoomBy(f));
// visualizador: começa aproximado (?perto = rosto)
if (characterViewer) follow.zoomBy(urlParams.has('perto') ? 0.01 : 0.45);
// &alvo=1.0 → o zoom mira essa altura (ex.: a mão) em vez do rosto
if (urlParams.has('alvo')) follow.setFocusHeight(Number(urlParams.get('alvo')));
const ui = new UI(quality.isTouch, () => input.pressAction());

const loading = preload([...MATHEUS_ASSETS, TORCH_MODEL, ...TEST_SCENE_ASSETS], (done, total) =>
  ui.setLoadingProgress(done / total),
);
const startClicked = ui.showStartScreen(loading);

loading
  .then(() => run())
  .catch((err) => {
    console.error(err);
    ui.setLoadingError(content.game.loadError);
  });

function run() {
  const area = createTestScene({
    dustCount: quality.dustCount,
    say: (lines) => ui.say(lines),
  });

  const player = new Player(quality.shadowMapSize);
  player.position.copy(area.spawn);
  area.scene.add(player.object);
  area.scene.add(player.torch.sparks.points);
  follow.snapTo(player.position);

  // Luz de preenchimento fraca vinda do lado da câmera: evita que o moletom preto
  // vire só uma silhueta quando ele está de costas para a tocha.
  const fillLight = new THREE.PointLight(0xffd2a8, 1.6, 5, 2);
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
  }
  const fixedRot = urlParams.get('rot');

  const gfx = new GameRenderer(container, area.scene, follow.camera, quality);
  const adaptive = new AdaptiveQuality(3, (step) => gfx.downgrade(step));

  let started = false;
  startClicked.then(() => {
    started = true;
    ui.showAreaTitle(area.name);
    if (!characterViewer) setTimeout(() => ui.say(content.testScene.intro), 1800);
  });

  const timer = new THREE.Timer();
  const moveDir = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  function nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of area.interactables) {
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
