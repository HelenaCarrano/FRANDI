import * as THREE from 'three';
import { MistSpirit, type SpiritContext, type SpiritOptions } from '../entities/mistSpirit';
import { MistPuff } from '../fx/mistPuff';
import { audio } from './audio';
import { content } from '../content';
import type { CollisionWorld } from './collision';
import type { GameState } from './gameState';
import type { Player } from '../entities/player';
import type { UI } from '../ui/ui';
import type { SpawnPoint } from '../scenes/types';

/**
 * Combate de uma área: encontros com espíritos da névoa, corações do Matheus, golpe em cone, esquiva e derrota gentil
 * (a tela escurece, ele "acorda" no último ponto seguro com a vida cheia, sem perder nada).
 * Cada encontro vencido grava `foe_<id>` e não volta. Uma muralha de névoa pode fechar o caminho até o fim da luta.
 */

export const MAX_HEARTS = 3;

/** Textura de névoa: manchas macias que somem em cima e embaixo; é arrastada devagar para parecer que a névoa corre. */
function mistTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 128;
    const y = 30 + Math.random() * 196;
    const r = 18 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r - 128, y - r, r * 2 + 256, r * 2);
  }
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.3, 'rgba(0,0,0,1)');
  fade.addColorStop(0.75, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface EncounterDef {
  id: string;
  /** Centro e raio do gatilho: a luta começa quando o Matheus chega perto. */
  x: number;
  z: number;
  radius: number;
  enemies: SpiritOptions[];
  /** Pilares de névoa que fecham o caminho até o encontro acabar. */
  barrier?: { x: number; z: number }[];
  /** Para onde ele volta se perder / onde passa a "acordar" depois de vencer. Padrão: o ponto anterior. */
  checkpoint?: SpawnPoint;
  /** O encontro só vale quando isto devolve true (ex.: depois de pegar o galho). */
  enabled?: () => boolean;
  onStart?: () => void | Promise<void>;
  onClear?: () => void | Promise<void>;
}

interface Runtime {
  def: EncounterDef;
  state: 'idle' | 'active' | 'cleared';
  spirits: MistSpirit[];
  pillars: THREE.Mesh[];
  colliders: ReturnType<CollisionWorld['addCircle']>[];
  fade: number;
  defeats: number;
}

export interface CombatOptions {
  scene: THREE.Scene;
  world: CollisionWorld;
  ground: (x: number, z: number) => number;
  player: Player;
  ui: UI;
  game: GameState;
  teleport: (x: number, z: number, rot?: number) => void;
  /** Ponto seguro inicial (a chegada na área). */
  start: SpawnPoint;
  /** A tocha acesa deixa os espíritos mais lentos. */
  torchLit?: () => boolean;
}

export class CombatSystem {
  hearts = MAX_HEARTS;
  /** Depuração: não leva dano. */
  god = false;
  private readonly runs: Runtime[] = [];
  private readonly puff = new MistPuff(110);
  private readonly pillarGeo = new THREE.CylinderGeometry(0.95, 1.15, 3.8, 10, 1, true);
  private readonly mistTex = mistTexture();
  private readonly pillarMat = new THREE.MeshBasicMaterial({
    map: this.mistTex,
    color: new THREE.Color(0.7, 0.9, 1.5),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  private checkpoint: SpawnPoint;
  private paused = false;
  private shown = false;
  private readonly ctx: SpiritContext;

  constructor(private readonly o: CombatOptions) {
    this.checkpoint = o.start;
    o.scene.add(this.puff.points);
    this.ctx = {
      player: o.player.position,
      playerRadius: o.player.radius,
      world: o.world,
      ground: o.ground,
      torchLit: false,
      hitPlayer: (d, x, z) => this.hitPlayer(d, x, z),
      puff: (x, y, z, n, p) => this.puff.burst(x, y, z, n, p),
    };
  }

  add(def: EncounterDef) {
    const done = this.o.game.flag(`foe_${def.id}`);
    const run: Runtime = { def, state: done ? 'cleared' : 'idle', spirits: [], pillars: [], colliders: [], fade: 1, defeats: 0 };
    if (!done && def.barrier) {
      for (const b of def.barrier) {
        const m = new THREE.Mesh(this.pillarGeo, this.pillarMat);
        m.position.set(b.x, this.o.ground(b.x, b.z) + 1.9, b.z);
        m.scale.setScalar(0.9 + Math.random() * 0.4);
        m.userData.phase = Math.random() * 6;
        this.o.scene.add(m);
        run.pillars.push(m);
        run.colliders.push(this.o.world.addCircle(b.x, b.z, 1.1));
      }
    }
    this.runs.push(run);
    return run;
  }

  /** Algum encontro em andamento? */
  get fighting() {
    return this.runs.some((r) => r.state === 'active');
  }

  get enemies(): MistSpirit[] {
    return this.runs.flatMap((r) => r.spirits);
  }

  // ---------- ações do jogador ----------

  private weaponNow(): 'sword' | 'stick' | null {
    const g = this.o.game;
    return g.has('espada') ? 'sword' : g.has('galho') ? 'stick' : null;
  }

  attack() {
    const { player } = this.o;
    if (this.paused || this.o.ui.inDialog) return;
    player.setWeapon(this.weaponNow());
    // mira assistida: vira para o espírito mais perto, se houver um por perto
    let best: MistSpirit | null = null;
    let bestD = 3.4;
    for (const s of this.enemies) {
      if (s.dead) continue;
      const d = Math.hypot(s.position.x - player.position.x, s.position.z - player.position.z);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (best && !player.dodging) player.face(Math.atan2(best.position.x - player.position.x, best.position.z - player.position.z));
    if (player.attack()) audio.play('swing');
  }

  dodge(moveDir: THREE.Vector3) {
    const { player } = this.o;
    if (this.paused || this.o.ui.inDialog) return;
    if (player.dodge(moveDir)) {
      audio.play('dodge');
      this.puff.burst(player.position.x, player.position.y + 0.2, player.position.z, 10, 0.6);
    }
  }

  // ---------- dano ao jogador ----------

  private hitPlayer(damage: number, fromX: number, fromZ: number) {
    const { player, ui, world } = this.o;
    if (this.paused || player.invulnerable || this.god) return;
    this.hearts = Math.max(0, this.hearts - damage);
    audio.play('hurt');
    player.hurt();
    ui.hurtFlash();
    ui.setHearts(this.hearts, MAX_HEARTS);
    const dx = player.position.x - fromX;
    const dz = player.position.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    player.position.x += (dx / l) * 1.0;
    player.position.z += (dz / l) * 1.0;
    world.resolve(player.position, player.radius);
    if (this.hearts <= 0) void this.defeat();
  }

  private async defeat() {
    const { player, ui } = this.o;
    this.paused = true;
    player.frozen = true;
    audio.play('defeat');
    await ui.fade(true, content.combat.defeat);
    for (const r of this.runs) {
      if (r.state !== 'active') continue;
      this.clearSpirits(r);
      r.state = 'idle';
      r.defeats++;
    }
    player.resetCombat();
    this.o.teleport(this.checkpoint.x, this.checkpoint.z, this.checkpoint.rot);
    this.hearts = MAX_HEARTS;
    ui.setHearts(this.hearts, MAX_HEARTS);
    await ui.fade(false);
    player.frozen = false;
    this.paused = false;
    ui.toast(content.combat.wake);
  }

  // ---------- encontros ----------

  private clearSpirits(r: Runtime) {
    for (const s of r.spirits) {
      this.o.scene.remove(s.object);
      s.dispose();
    }
    r.spirits.length = 0;
  }

  private start(r: Runtime) {
    r.state = 'active';
    audio.play('rise');
    // depois de muitas derrotas seguidas a luta fica um pouco mais branda
    const soften = r.defeats >= 3 ? 1 : 0;
    for (const e of r.def.enemies) {
      const s = new MistSpirit({ ...e, hp: e.hp !== undefined ? Math.max(1, e.hp - soften) : undefined });
      if (soften && e.hp === undefined) s.hp = Math.max(1, s.hp - soften);
      s.position.y = this.o.ground(e.x, e.z);
      this.o.scene.add(s.object);
      r.spirits.push(s);
    }
    void r.def.onStart?.();
  }

  private finish(r: Runtime) {
    r.state = 'cleared';
    r.defeats = 0;
    this.o.game.setFlag(`foe_${r.def.id}`);
    for (const c of r.colliders) this.o.world.remove(c);
    r.colliders.length = 0;
    this.checkpoint = r.def.checkpoint ?? { x: this.o.player.position.x, z: this.o.player.position.z, rot: this.o.player.facing };
    if (this.hearts < MAX_HEARTS) {
      this.hearts = MAX_HEARTS;
      this.o.ui.setHearts(this.hearts, MAX_HEARTS);
      this.o.ui.toast(content.combat.rest);
      audio.play('rest');
    }
    void r.def.onClear?.();
  }

  /** Larga a luta em andamento (o jogador saiu da zona): os espíritos somem e o encontro recomeça quando ele voltar. */
  abort() {
    for (const r of this.runs) {
      if (r.state !== 'active') continue;
      this.clearSpirits(r);
      r.state = 'idle';
    }
  }

  /** Enche os corações (poção, descanso). */
  heal() {
    this.hearts = MAX_HEARTS;
    this.o.ui.setHearts(this.shown ? this.hearts : null, MAX_HEARTS);
  }

  /** Depuração: derrota tudo que está vivo. */
  killAll() {
    for (const s of this.enemies) {
      s.hp = 0;
      s.dead = true;
      s.gone = true;
    }
  }

  update(dt: number, time: number) {
    const { player, ui } = this.o;
    player.setWeapon(this.weaponNow());

    const show = player.armed;
    if (show !== this.shown) {
      this.shown = show;
      ui.setHearts(show ? this.hearts : null, MAX_HEARTS);
    }

    this.ctx.torchLit = this.o.torchLit?.() ?? false;
    this.ctx.playerRadius = player.radius;
    this.puff.update(dt);

    for (const r of this.runs) {
      // muralhas de névoa balançam; ao acabar a luta, somem
      if (r.pillars.length) {
        if (r.state === 'cleared') r.fade = Math.max(0, r.fade - dt * 1.4);
        for (const m of r.pillars) {
          m.visible = r.fade > 0;
          m.scale.y = 0.9 + 0.12 * Math.sin(time * 2 + (m.userData.phase as number));
          m.position.y += (this.o.ground(m.position.x, m.position.z) + 1.9 * r.fade - m.position.y) * Math.min(1, dt * 5);
        }
        this.mistTex.offset.x = (time * 0.05) % 1;
        if (r.state === 'cleared' && r.fade <= 0) {
          r.pillars.forEach((m) => this.o.scene.remove(m));
          r.pillars.length = 0;
        }
      }

      if (r.state === 'idle' && !this.paused && (!r.def.enabled || r.def.enabled())) {
        const d = Math.hypot(player.position.x - r.def.x, player.position.z - r.def.z);
        if (d < r.def.radius && !this.fighting) this.start(r);
      }
      if (r.state !== 'active') continue;

      if (!this.paused) {
        for (const s of r.spirits) s.update(dt, time, this.ctx);
      }

      // golpe do Matheus: cone à frente
      if (player.swinging && !this.paused) {
        const sword = this.weaponNow() === 'sword';
        const reach = sword ? 2.7 : 2.3;
        const fx = Math.sin(player.facing);
        const fz = Math.cos(player.facing);
        for (const s of r.spirits) {
          if (s.dead || s.lastSwing === player.swingId) continue;
          const dx = s.position.x - player.position.x;
          const dz = s.position.z - player.position.z;
          const d = Math.hypot(dx, dz);
          if (d > reach + s.radius) continue;
          const cos = (dx * fx + dz * fz) / (d || 1);
          if (cos < Math.cos(1.0) && d > s.radius + 0.6) continue;
          if (!s.vulnerable) continue;
          s.lastSwing = player.swingId;
          audio.play(s.hit(sword ? 2 : 1, player.position.x, player.position.z, this.ctx) ? 'kill' : 'hit');
        }
      }

      // tira os que já se desfizeram
      for (let i = r.spirits.length - 1; i >= 0; i--) {
        if (r.spirits[i].gone) {
          this.o.scene.remove(r.spirits[i].object);
          r.spirits[i].dispose();
          r.spirits.splice(i, 1);
        }
      }
      if (r.spirits.length === 0 && !this.paused) this.finish(r);
    }
  }

  dispose() {
    for (const r of this.runs) this.clearSpirits(r);
    this.puff.dispose();
    this.pillarGeo.dispose();
    this.pillarMat.dispose();
    this.mistTex.dispose();
  }
}
