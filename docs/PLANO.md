# Plano de implementação — A Aventura do Matheus

## Arquitetura

```
src/
  content.ts            todos os textos (diálogos, perguntas, memórias, carta, voucher)
  main.ts               inicialização e loop do jogo
  core/
    quality.ts          detecção de aparelho + redução automática de qualidade por FPS
    renderer.ts         WebGLRenderer + EffectComposer (GTAO, bloom, ACES, vinheta, granulado)
    followCamera.ts     câmera isométrica (FOV 30°) que segue o jogador; afasta em retrato
    input.ts            teclado (WASD/setas/E) + joystick virtual + botão de ação
    collision.ts        colisão 2D simples (círculos e caixas no plano XZ)
  entities/
    player.ts           jogador: movimento, mistura de animações, pose do braço da tocha
    matheusModel.ts     montagem/recoloração do Matheus a partir das peças KayKit
    torch.ts            tocha: cabo KayKit, chama em shader, luz com sombra, faíscas
  core/assets.ts        pré-carregamento e cópia de modelos .glb
  core/occlusion.ts     esmaece pilares/paredes que tapam o jogador
  fx/particles.ts       faíscas e poeira que só brilha perto da tocha
  core/gameState.ts     GameState + salvamento automático em localStorage (aventura-matheus:v1)
  entities/
    npc.ts              NPCs do KayKit (parado, vira para o jogador, gestos, marcador "!")
    cat.ts / backpack.ts  gatinho Fubá e mochila, gerados em código
  fx/markers.ts         "!" e brilho dos achados (Points, para o AO ignorar)
  scenes/
    types.ts            contrato Area (cena, colisões, spawn, interações, env, torchLit, update)
    testScene.ts        salão de testes da etapa 1 (?area=teste)
    village.ts          Vila do Amanhecer (etapa 3): hexágonos KayKit, NPCs, missões, loja, portão
  ui/ui.ts              HTML sobre o canvas: abertura (continuar/recomeçar), diálogos com nome e
                        escolhas, carta animada, loja, inventário, objetivo, avisos
  hud.css               estilos do HUD (objetivo, inventário, loja, carta)
```

Cada área do jogo implementa `Area` (scenes/types.ts). Na etapa 5 entra um `SceneManager`
que carrega a área sob demanda (`import()` dinâmico) a partir do mapa central.

## Etapas

| # | Etapa | Entregas principais | Status |
|---|-------|---------------------|--------|
| 1 | Base técnica | Vite+TS+Three, tocha com sombra, pós-processamento, controles teclado/toque, câmera isométrica, content.ts | **feito** |
| 2 | Personagem | Matheus montado com KayKit (corpo Mage + cabeça Knight + barba Barbarian, recoloridos), animações parado/andar/correr, pose da tocha, cruz e tatuagens | **feito** (espada e mochila nas costas via `Player.setEquipment`) |
| 3 | Vila | Abertura com mensagem misteriosa, 3 NPCs, sistema de diálogos, miniquest do Ferreiro (3 materiais), inventário (barra), lojinha do Comerciante, `SaveSystem` em localStorage + "recomeçar" | **feito** (textos `[EXEMPLO]`) |
| 4 | Final | Sala do Tesouro, sequência do baú (tentativa → "companhia" → entrada dela com tocha → abertura), carta animada, voucher salvável, encerramento lado a lado | |
| 5 | Mapa central | Hub com áreas bloqueadas/desbloqueadas, `SceneManager`, transições com fade | |
| 6 | Áreas do meio | Floresta → Ruínas (3 altares) → Torre (quiz 5 andares) → Taverna (montar prato por arrasto) → Vinhedo (combinar uvas) | |
| 7 | Castelo | Portão com 3 chaves, labirinto escuro, usos de espada/cristal/garrafa/memórias | |
| 8 | Polimento | Áudio (desbloqueado no 1º toque), efeitos, desempenho, conteúdo real | |
| 9 | Teste completo | Jogar do início ao fim no celular | |

## Sistemas transversais (a criar quando a primeira área precisar)

- **GameState / SaveSystem**: áreas desbloqueadas, itens, memórias, flags de diálogo; salvo a cada mudança.
- **Inventário**: lista de itens definida em `content.ts` (nome, ícone, descrição, onde é usado).
- **Diálogos**: já existe `ui.say(lines)`; ganhará nome/retrato do NPC e escolhas.
- **Puzzles**: toda resposta errada dá dica e permite tentar de novo (regra do briefing).
- **Assets**: pacotes KayKit (CC0) em `public/models/<pacote>/` — ver `docs/CREDITOS.md`.
  Próximos pacotes do mesmo artista no GitHub (KayKit-Game-Assets): Restaurant Bits (taverna),
  Medieval Hexagon (vila/mapa), Furniture Bits, Halloween Bits (castelo).
  Fotos comprimidas em `public/photos/`.

## Pendências de conteúdo

Ver a seção "Conteúdo a preencher" do briefing. Enquanto não chegar, `content.ts` usa
textos de exemplo marcados com `[EXEMPLO]`.

## Etapa 3 — como a Vila funciona

- **Fluxo principal:** Mensageiro (carta animada) → Ferreiro (3 materiais escondidos: ferro, carvão,
  couro) → recebe espada, mochila, chave de trigo e 12 moedas → compra o mapa (10 moedas) com a
  Comerciante → portão da vila → cartão "a vila ficou para trás" (o mapa central é a etapa 5).
- **Missões opcionais que pagam moedas:** cartas da vila (15) e o gatinho Fubá (10). As missões
  pagam 37 moedas; o mapa custa 10 e os itens opcionais somam 25, então nada trava o progresso.
- **Tocha apagada de dia:** `Area.torchLit = false`; a tocha acende nas áreas escuras.
- **Clima por área:** `Area.env` (exposição, vinheta, granulado, bloom) aplicado por `GameRenderer.applyEnv`.
- **Save:** tudo passa por `GameState` (moedas, itens, missões, marcas, equipamentos). Com save,
  a tela inicial oferece Continuar/Recomeçar.
- **Depuração:** `?debug` (FPS + `window.__dev`), `?cam=distância,elevação`, `?tp=x,z`,
  `?area=teste`, `?personagem&equipado`.
- **Textos:** todos em `src/content.ts` (blocos `village`, `items`, `ui`). Nomes dos NPCs, o gatinho
  e as piadas são exemplos para trocar pelos reais.
