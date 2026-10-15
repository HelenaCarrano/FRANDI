import * as THREE from 'three';

/**
 * Vento compartilhado: pinheiros, grama e flores balançam com a mesma "hora" global.
 * `applyWind` injeta o balanço no shader de um material padrão; quanto mais alto o vértice
 * (altura local), mais ele balança. Instâncias (InstancedMesh) ganham fase própria pela posição.
 */

const wind = { value: 0 };

/** Chame uma vez por quadro com o tempo do jogo. */
export function updateWind(time: number) {
  wind.value = time;
}

export interface WindOptions {
  /** Balanço em metros por metro de altura local. */
  sway: number;
  /** Faixa (perto, longe) em que a peça encolhe até sumir; usada pela grama. */
  fade?: THREE.Vector2;
}

export function applyWind(material: THREE.Material, opts: WindOptions) {
  const fade = opts.fade ?? new THREE.Vector2(1e6, 1e6 + 1);
  material.userData.windFade = fade;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.uniforms.uSway = { value: opts.sway };
    shader.uniforms.uFade = { value: fade };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uWind;
        uniform float uSway;
        uniform vec2 uFade;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
          float fadeK = 1.0 - smoothstep(uFade.x, uFade.y, distance(instanceMatrix[3].xyz, cameraPosition));
          transformed *= fadeK;
        #else
          float windPhase = 0.0;
        #endif
        float bend = max(position.y, 0.0) * uSway;
        transformed.x += (sin(uWind * 1.4 + windPhase) + 0.3 * sin(uWind * 2.9 + windPhase * 1.7)) * bend;
        transformed.z += cos(uWind * 1.1 + windPhase * 1.3) * bend * 0.6;`,
      );
  };
  material.customProgramCacheKey = () => `wind-${opts.sway}-${opts.fade ? 'fade' : 'nofade'}`;
}
