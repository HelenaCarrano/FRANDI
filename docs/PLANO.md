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
  scenes/
    types.ts            contrato Area (cena, colisões, spawn, interações, update)
    testScene.ts        salão de testes da etapa 1
  ui/ui.ts              HTML sobre o canvas: abertura, diálogo, prompt de ação, FPS
```

Cada área do jogo implementa `Area` (scenes/types.ts). Na etapa 5 entra um `SceneManager`
que carrega a área sob demanda (`import()` dinâmico) a partir do mapa central.

## Etapas

| # | Etapa | Entregas principais | Status |
|---|-------|---------------------|--------|
| 1 | Base técnica | Vite+TS+Three, tocha com sombra, pós-processamento, controles teclado/toque, câmera isométrica, content.ts | **feito** |
| 2 | Personagem | Matheus montado com KayKit (corpo Mage + cabeça Knight + barba Barbarian, recoloridos), animações parado/andar/correr, pose da tocha, cruz e tatuagens | **feito** (falta: slots de equipamento) |
| 3 | Vila | Abertura com mensagem misteriosa, 3 NPCs, sistema de diálogos, miniquest do Ferreiro (3 materiais), inventário (barra), lojinha do Comerciante, `SaveSystem` em localStorage + "recomeçar" | |
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
