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
  core/sceneManager.ts  troca de áreas: fade, pré-carga, move o jogador, libera a área antiga
  entities/
    npc.ts              NPCs do KayKit (parado, vira para o jogador, gestos, marcador "!")
    cat.ts / backpack.ts  gatinho Fubá e mochila, gerados em código
  fx/markers.ts         "!" e brilho dos achados (Points, para o AO ignorar)
  scenes/
    types.ts            contrato Area (cena, colisões, spawn/entries, interações, env, torchLit, onEnter, dispose)
    registry.ts         áreas existentes, import dinâmico de cada uma e regras de destrave
    hexKit.ts           escala dos hexágonos, céu e clima diurno (Vila e Mapa dividem)
    testScene.ts        salão de testes da etapa 1 (?area=teste)
    village.ts          Vila do Amanhecer (etapa 3): hexágonos KayKit, NPCs, missões, loja, portão
    worldMap.ts         Mapa do Reino (etapa 5): maquete andável, névoa, placas, estradas, vinhedo em código
  ui/ui.ts              HTML sobre o canvas: abertura (continuar/recomeçar), diálogos com nome e
                        escolhas, carta animada, loja, inventário, objetivo, avisos
  hud.css               estilos do HUD (objetivo, inventário, loja, carta)
```

Cada área do jogo implementa `Area` (scenes/types.ts) e é carregada sob demanda pelo
`SceneManager` (`import()` dinâmico via `scenes/registry.ts`).

## Etapas

| # | Etapa | Entregas principais | Status |
|---|-------|---------------------|--------|
| 1 | Base técnica | Vite+TS+Three, tocha com sombra, pós-processamento, controles teclado/toque, câmera isométrica, content.ts | **feito** |
| 2 | Personagem | Matheus montado com KayKit (corpo Mage + cabeça Knight + barba Barbarian, recoloridos), animações parado/andar/correr, pose da tocha, cruz e tatuagens | **feito** (espada e mochila nas costas via `Player.setEquipment`) |
| 3 | Vila | Abertura com mensagem misteriosa, 3 NPCs, sistema de diálogos, miniquest do Ferreiro (3 materiais), inventário (barra), lojinha do Comerciante, `SaveSystem` em localStorage + "recomeçar" | **feito** (textos `[EXEMPLO]`) |
| 4 | Final | Sala do Tesouro, sequência do baú (tentativa → "companhia" → entrada dela com tocha → abertura), carta animada, voucher salvável, encerramento lado a lado | |
| 5 | Mapa central | Hub com áreas bloqueadas/desbloqueadas, `SceneManager`, transições com fade | **feito** (as áreas do meio ainda dizem "em preparação") |
| 6 | Áreas do meio | Floresta → Ruínas (3 altares) → Torre (quiz 5 andares) → Taverna (montar prato por arrasto) → Vinhedo (combinar uvas) | Floresta e Ruínas **feitas**; faltam Torre, Taverna e Vinhedo |
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

## Etapa 5 — como o Mapa do Reino funciona

- **Troca de áreas:** `SceneManager.goTo(id, entrada)` escurece a tela (`ui.fade`, com o nome do destino),
  baixa e pré-carrega a área, move Matheus/tocha/luz de preenchimento para a cena nova, troca câmera e clima
  gráfico e só então clareia. O jogo salva `area` e `entry` a cada troca, então "Continuar" volta ao mesmo ponto.
- **Entradas (`Area.entries`):** pontos de chegada por nome. A vila tem `gate` (logo dentro do portão); o mapa tem um por
  marco (`village`, `forest`, `ruins`...). Quem sai de uma área chama `goTo('map', '<id da área>')`.
- **Ids das áreas:** `village`, `map`, `forest`, `ruins`, `tower`, `tavern`, `vineyard`, `castle`, `ending`.
  Para construir uma área nova, adicione `load` dela em `registry.ts` e crie o arquivo em `scenes/`.
- **Destrave (registry.ts, `isUnlocked`):** Floresta abre com `villageDone`; Ruínas, Torre, Taverna e Vinhedo abrem juntas
  com `done_forest`; o Castelo abre com `done_ruins`, `done_tower`, `done_tavern` e `done_vineyard`. Cada área nova deve
  chamar `game.setFlag(doneFlag('<id>'))` ao ser concluída. (`doneFlag` está em registry.ts.)
- **Névoa:** área fechada fica sob nuvens e com a passagem bloqueada. Ao abrir, a névoa se dissolve na próxima visita ao mapa
  (marca `seen_<id>`) e aparece o aviso "Novo caminho". A Torre e o Castelo usam 3 camadas de nuvens por serem altos.
- **Câmera mais aberta:** `Area.cameraDistance` (o mapa usa 25; as outras usam 17).
- **Layout:** `PLACES` e `ROADS` em worldMap.ts, em coordenadas de tela (u para a direita, v para cima). O chão são hexágonos
  perto das estradas e dos marcos; a borda da ilha ganha montanhas, colinas e bosques mais uma parede invisível.
- **Memória:** `SceneManager.discard` descarta geometrias, materiais e luzes que a área criou sozinha, mas nunca os do cache
  de modelos (`isSharedResource` em assets.ts). Texturas geradas em código devem ser liberadas no `dispose` da área.
- **Depuração:** `?area=mapa` (ou `?area=map`, `?area=vila`) abre direto numa área e `&entry=<ponto>` escolhe a chegada;
  `?libera=tudo` abre tudo no mapa sem gravar nada; com `?debug`, `__dev.goTo('map', 'village')`, `__dev.game`, `__dev.follow`.
  `?cam=72,72` fixa a câmera longe para ver o mapa inteiro de cima.
- **Peso:** o mapa tem cerca de 300 meshes (~145 mil triângulos), contra ~190 (~85 mil) da vila. Se o celular sofrer,
  reduza os bosques de dentro da ilha em worldMap.ts.

## Etapa 6 — Ruínas Esquecidas (`scenes/ruins.ts`)

- **Cenário:** pátio de templo ao ar livre, à noite (`NIGHT_RUINS` em fx/atmosphere.ts), cercado por uma muralha de peças KayKit
  quebradas, aberta ao sul. A chegada é um arco de pedra (`entry: start`) com "Voltar ao mapa".
- **Três altares**, cada um com um cristal que acende devagar e abre uma **memória** (`ui.showMemory`):
  - *Chamas:* quatro braseiros; a ordem certa está pintada em símbolos na parede (`SEQUENCE`). Errar apaga tudo e dá a dica.
  - *Símbolos:* minijogo `playRunes` (ui/minigames.ts), três discos que giram o vizinho ao contrário, sempre com solução.
  - *Eco:* pergunta com `ui.ask`; errar dá a dica e repete.
- **Conclusão:** com os três acesos, um cristal flutua no centro do pátio. Pegá-lo dá o item `cristal` e grava `done_ruins`.
- **Save:** só flags (`ruins_altar_flames|runes|echo`, `mem_<id>`, `ruins_seen`); o formato do save não mudou.
- **Memórias:** `content.memories` (textos `[EXEMPLO]`) e fotos em `public/photos/<arquivo>` (ver LEIA-ME.txt lá). Sem a foto aparece uma moldura vazia.
- **Depuração:** `?area=ruinas` (ou `?area=ruins`); com `?debug`, `__dev.area.debug.solveAll()` marca os três altares.
- **Atenção:** o mapa-maquete (`worldMap.ts`) citado na arquitetura acima foi substituído pelo pergaminho `ui/kingdomMap.ts`.
