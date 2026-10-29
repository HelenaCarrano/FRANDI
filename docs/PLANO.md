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
| 4 | Final | Sala do Tesouro, sequência do baú (tentativa → "companhia" → entrada dela com tocha → abertura), carta animada, voucher salvável, encerramento lado a lado | **feito** (textos `[EXEMPLO]`; Helena provisória) |
| 5 | Mapa central | Hub com áreas bloqueadas/desbloqueadas, `SceneManager`, transições com fade | **feito** (as áreas do meio ainda dizem "em preparação") |
| 6 | Áreas do meio | Ruínas (3 altares + emboscada) → Taverna (montar prato por arrasto) → Vinhedo (combinar uvas, cachos guardados por corvos). A Torre foi retirada | **feita** |
| 7 | Castelo | Portão com 3 chaves, labirinto escuro, usos de espada/cristal/garrafa/memórias | **feito** (a Sala do Tesouro, etapa 4, ainda não existe: o fim do Castelo mostra um cartão e volta ao mapa) |
| 8 | Polimento | Áudio (desbloqueado no 1º toque), efeitos, desempenho, conteúdo real | **áudio feito**; falta desempenho no celular e conteúdo real |
| 8b | Nova narrativa + combate | Começa acordando na Floresta, fragmentos de memória, cavalo sumido, Vila com contexto, galinha companheira, espíritos da névoa (ver seção abaixo) | **feito** |
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
- **Destrave (registry.ts, `isUnlocked`) — ordem atual:** Floresta (começo) → Vila (abre com `done_forest`) → Ruínas, Taverna e Vinhedo
  (abrem juntas com `villageDone`) → Castelo (`done_ruins`, `done_tavern`, `done_vineyard`). Cada área nova deve
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

## Etapa 6 — Taverna do Zé (`scenes/tavern.ts`)

- **Cenário:** salão fechado (20 × 16 m) com lareira, balcão, prateleira de ingredientes, três mesas e três clientes. Câmera isométrica,
  tocha apagada (a luz vem da lareira e das tochas de parede). Porta ao sul = "Voltar ao mapa".
- **Fluxo:** Zé (grava `tavern_started`) → conversar com um cliente (pedido ativo) → "Montar o prato" no balcão (`playPlating`, em
  ui/minigames.ts: arrastar fichas para o prato, tocar numa ficha do prato a tira) → servir. Prato errado só dá dica (faltou/sobrou) e
  deixa corrigir. Pedidos servidos gravam `tavern_order_<n>` e pagam moedas. Com os 3, o Zé dá a `chave_cobre` (3ª chave do Castelo),
  a memória `taverna_jantar` e grava `done_tavern`.
- **Bônus opcionais:** ovos, pão e farinha da Vila aparecem como fichas extras na prateleira (`BONUS_ITEM`). Cada cliente "adora" um
  deles: usá-lo no prato dele gasta o item e paga moedas extras; usar o de outro cliente conta como "sobrou algo". Nada exige os itens.
- **Save:** só flags (`tavern_seen`, `tavern_started`, `tavern_order_<n>`, `mem_taverna_jantar`, `done_tavern`) e o item. O pedido ativo
  não é salvo: ao voltar, o jogador conversa de novo com o cliente.
- **Textos:** `content.tavern` (pedidos, ingredientes, falas), todos `[EXEMPLO]`. Foto da memória: `public/photos/taverna_jantar.jpg`.
- **Depuração:** `?area=taverna`; com `?debug`, `__dev.area.debug.solveAll()` serve os três pedidos.

## Etapa 6 — Vinhedo Dourado (`scenes/vineyard.ts`)

- **Cenário:** vinhedo ao pôr do sol (`SUNSET`), 8 fileiras de videira (postes, arame, folhas e cachos instanciados, colisão por fileira) e um galpão de pedra
  com o lagar, barris e a vinicultora. Chegada por um portão de pedra com "Voltar ao mapa". Tocha apagada, câmera de 3ª pessoa.
- **Fluxo:** Dona Vitória (grava `vineyard_started`) → colher 4 cachos especiais em cestas nos corredores entre as fileiras (`vineyard_grape_<id>`, com brilho) →
  usar o lagar (`playBlend`, em ui/minigames.ts) → mistura certa grava `vineyard_blended`, ela entrega a `garrafa` (usada no Castelo), a memória
  `vinhedo_brinde` e grava `done_vineyard`. Com as quatro áreas do meio concluídas, o Castelo destrava.
- **Mistura:** cada uva tem doçura, acidez e corpo (0 a 3, em `content.vineyard.grapes`). O barril aceita até 6 cachos e as barras mostram a média; a faixa de
  cada barra é a média da receita de referência (`blend.solution`) ± `blend.tolerance`, então sempre há solução (e combinações parecidas também valem).
  Errar só mostra qual barra passou ou faltou.
- **Save:** só flags (`vineyard_seen|started|grape_<id>|blended`, `mem_vinhedo_brinde`, `done_vineyard`) e o item. Se o jogador sair depois de misturar, ao voltar basta falar com ela.
- **Textos:** `content.vineyard`, todos `[EXEMPLO]`. Foto da memória: `public/photos/vinhedo_brinde.jpg`.
- **Depuração:** `?area=vinhedo`; com `?debug`, `__dev.area.debug.harvestAll()` colhe os cachos e `solveAll()` também deixa a mistura feita.

## Etapa 7 — Castelo (`scenes/castle.ts`)

- **Zonas:** três áreas lado a lado (60 m entre os centros), só a atual fica visível. Trocar de zona escurece a tela (`ui.fade`) e move o jogador com
  `AreaContext.teleport`, como nos andares da Torre. Câmera isométrica nas três. Entradas: `start` (pátio), `maze`, `hall`; o save grava a zona
  com `game.setArea('castle', ...)`, então "Continuar" volta ao lugar certo.
- **1. Pátio do Portão:** três pedestais, um por chave. Usar a chave (trigo, estrela, cobre) **gasta** o item e grava `castle_lock_<id>`. Com as três,
  as folhas do portão deslizam, o colisor some e aparece "Entrar no castelo".
- **2. Labirinto Escuro:** grade 15 × 15 (peças de 2,5 m) gerada por busca em profundidade com semente fixa, então é sempre o mesmo e tem um único
  caminho (achado por BFS). A tocha alcança menos aqui (`Torch.setReach`, 0,65; a `sceneManager.activate` devolve 1 ao sair).
  - *Cristal:* no pedestal da entrada (gasto, grava `castle_crystal`) acende setas de luz nas bifurcações do caminho certo.
  - *Poção de Coragem:* opcional, gasta, grava `castle_potion` e leva o alcance a 1. Só aparece depois do cristal (ou sem cristal na mochila).
  - *Espada:* corta duas teias no caminho certo (`castle_web_<n>`); sem espada, só dica. A espada não é gasta.
- **3. Salão das Memórias:** a Guardiã dá uma pista por memória reunida e abre `playMemoryOrder` (ui/minigames.ts): tocar nas cartas na ordem em que
  aconteceram; errar diz quantas estão no lugar certo. Acertar grava `castle_memories` e acende as seis molduras (que passam a reabrir a memória).
  A mesa do brinde **gasta** a garrafa, mostra a memória `castelo_brinde` e grava `castle_toast`, o que dissolve o selo da porta do trono.
  Abrir a porta grava `done_castle`, mostra o cartão final e abre o mapa. A ordem certa está em `content.castle.hall.order`.
- **Sem travar:** só entram na ordenação as memórias que o jogador tem (mínimo 2); como as quatro áreas do meio precisam estar concluídas,
  na prática são as seis.
- **Save:** só flags (`castle_seen|maze_seen|hall_seen`, `castle_lock_*`, `castle_crystal`, `castle_potion`, `castle_web_*`, `castle_memories`,
  `castle_toast`, `mem_castelo_brinde`, `done_castle`) e os itens. O formato do save não mudou.
- **Textos:** `content.castle` (todos `[EXEMPLO]`). Foto da memória final: `public/photos/castelo_brinde.jpg`.
- **Depuração:** `?area=castelo` (`&entry=maze|hall`); com `?debug`, `__dev.area.debug.giveAll()` (itens e memórias), `goZone(n)` e `solveAll()`.

## Nova narrativa e combate (acordar na floresta)

**Ordem:** Floresta → Vila → Mapa → Ruínas / Taverna / Vinhedo → Castelo. A Torre do Saber foi removida (`tower.ts` e `quiz.ts` apagados;
o biscoito da sorte também). A chave de estrela agora vem das Ruínas, junto do cristal.

- **Abertura (`scenes/forest.ts`):** tela preta com `ui.narrate` (um parágrafo por toque). A Floresta começa na noite fria e amanhece perto do portal
  (`NIGHT_FOREST → SUNSET → GOLDEN_MORNING`). Marcas: `forest_woke`, `forest_ribbon`, `forest_tracks`, `foe_forest_1..3`, `done_forest`.
  - Fita da Helena (item `fita`) → Fragmento de Memória 01. Pegadas do cavalo (somem na mata). Galho firme (item `galho`) = 1ª arma.
  - Portal → Fragmento 02 (revela o objetivo) → `goTo('village')`. Quem volta pelo mapa chega pelo lado do portal (`entry: portal`, já de dia).
- **Vila:** chegada ("Finalmente… a vila!"), bilhete da Helena na sela do cavalo (item `bilhete`), Seu Alvim dá chave de trigo + **farinha** + mochila e
  dispara o Fragmento 03. Dona Pimenta: quest **A encomenda esquecida** (`playSorting`, em ui/minigames.ts: arrastar itens para 3 cestos) que entrega o mapa
  e um pão (o mapa não é mais comprado). Dona Clotilde só paga moedas.
- **Galinha companheira (`entities/henCompanion.ts`):** encontrada atrás do mercado (`henMet`), depois acompanha o Matheus em todas as áreas
  (`SceneManager.hen`). Os ovos são controlados: seis marcos (moinho, encomenda, Ruínas, Taverna, Vinhedo, Castelo), uma vez cada (`egg_*`), com o ovo
  voando até a mochila. Os ovos e a farinha preparam a revelação do workshop.
- **Combate (`core/combat.ts`, `entities/mistSpirit.ts`, `fx/mistPuff.ts`):** golpe com J/F (ou ⚔️) e esquiva com K (ou 💨); Shift segurado = correr (sem Shift o teclado anda); 3 corações; derrota gentil
  (a tela escurece e ele acorda no último ponto seguro com a vida cheia, sem perder nada; depois de 3 derrotas no mesmo encontro, os inimigos ficam
  um ponto mais fracos). Espíritos da névoa: **fiapo** (investida), **sombra** (pancada em área com aviso no chão) e **corvo** (mergulha; só leva golpe
  quando está baixo). Galho = 1 de dano, espada = 2. Cada encontro vencido grava `foe_<id>`; muralhas de névoa fecham o caminho até o fim da luta.
  - Encontros: Floresta (3), Ruínas (emboscada ao acender os 3 altares; o cristal só aparece depois), Vinhedo (corvos guardam cada cacho) e
    labirinto do Castelo (3 emboscadas; a Poção de Coragem também enche os corações).
- **Depuração:** `?debug` → `__dev.area.combat` (`killAll()`, `god = true`, `heal()`), `__dev.area.debug.setProgress(f)` na Floresta;
  `?area=floresta&entry=portal`.
- **Pendências:** áudio (ainda sem som de cacarejo/golpe) e textos `[EXEMPLO]` (nomes da galinha, Pimenta etc.).

## Etapa 4 — Sala do Tesouro (`scenes/ending.ts`)

- **Chegada:** a porta do trono do Castelo (`castle.ts`, `openThrone`) grava `done_castle` e leva para a Sala do Tesouro (`ctx.goTo('ending')`).
  Atalho de depuração: `?area=final`.
- **Cenário:** sala quente de 16 m com ouro, velas, tochas e o baú dourado (`chest_gold`) sobre um degrau; câmera isométrica.
- **Sequência (`useChest`):** tentativa sozinho (duas fechaduras) → "companhia" → a Helena entra pela porta com uma tocha (`Npc.walkTo`, `torch: true`) →
  fala dela → os dois viram as chaves e a tampa se abre (luz, faíscas, feixe dourado) → revelação dos ingredientes (farinha, ovos, vinho) →
  carta animada (`ui.letter`) → voucher (`ui.showVoucher`, com **Salvar o voucher** gerando um PNG na hora) → os dois lado a lado → cartão de encerramento.
- **Save:** marcas `ending_tried|helena|chest_open|done`, `done_ending`. Reabrir o baú depois mostra o voucher; a Helena fica na sala.
- **Textos:** `content.ending` (todos `[EXEMPLO]`: carta, dados do voucher, falas). **A aparência da Helena é provisória** (aventureira KayKit `Rogue`
  com lenço vermelho): trocar quando houver a descrição/fotos dela.
- **Depuração:** `?area=final` (com `?debug`, `__dev.area.debug.helena`).

## Áudio (`core/audio.ts`)

- **Tudo em código (WebAudio):** nenhum arquivo de som. O contexto só nasce no primeiro toque/tecla (regra dos navegadores); a música da área pedida antes disso fica na fila.
- **Música por área (`SCENES`):** um pad que troca de acorde devagar (tom, acordes, timbre e filtro próprios) mais notinhas soltas; cruzamento suave ao trocar de área
  (`SceneManager.activate` chama `audio.setScene`).
- **Ambiente:** vento, pássaros (dia), grilos e coruja (noite), burburinho (Taverna) e fogueira (Castelo, Taverna, Final). Na Floresta o dia/noite do som acompanha o amanhecer (`audio.mood`).
- **Efeitos (`audio.play`):** passos (grama/pedra/cavalo, por distância andada), golpe, acerto, espírito se desfazendo, dano, esquiva, derrota, item, moeda, galinha,
  ovo, baú, lembrança, whoosh de troca de área, forja, montar. Itens e moedas tocam direto do `GameState`.
- **Silenciar:** botão 🔊/🔇 no canto da tela; a escolha fica salva (`aventura-matheus:mudo`). Depuração: `__dev.audio.play('chest')`.

## Vila em 2D (`g2d/areas/village.ts`) — 28/out/2026

- **Escala:** o plano em metros da vila 3D virou pixels com `K = 7 px/m` (`P(x, z)`), porque os sprites têm a escala do Matheus (18 px/m) e uma vila a 18 px/m seria enorme para andar.
  Mundo 1800 × 1700; a área andável é uma elipse (`ELL`); a mata fechada em volta é só árvore (sem colisão fora da elipse).
- **Arte nova (tudo em código):** `people.ts` (moradores a partir de uma receita `PersonSpec`: cabelo, roupa, avental, chapéu, caneca/machado; patrulha, balões, gestos),
  `buildings.ts` (casas, ferraria com forja acesa, taverna, igreja, celeiro, barraca do mercado, moinho com pás giratórias, poço, muralha e pilares do portão, objetos pequenos),
  `horse.ts` (Trovão: vaga no cercado, foge de quem corre, segue, é montado), `chickens.ts` (galinhas com cores; fugitivas são tocadas até o galinheiro).
- **Cavalo montado:** `Player.riding` (1,7× mais rápido, só o tronco desenhado sobre a sela). Botão do cavalo / tecla H montam e desmontam; a marca `riding` reaparece montado ao voltar à Vila.
- **Missões iguais às da 3D** (mesmos textos, minijogos DOM e marcas de save): cavalo (confiança por aproximação calma com a maçã), ferraduras (forja), moinho (engrenagens + pás giram),
  galinhas (6 fugitivas), encomenda da Pimenta (mapa + pão), galinha companheira, portão (abre o mapa). A "!" virou a estrelinha `Interactable.mark`.
- **Novidades de motor:** `Prop.shadowRx/Ry/Dx` (sombra no chão de qualquer prop `custom`), `AreaContext.toScreen` (balões de fala em HTML presos a pontos do mundo).
- **Entradas:** `start` (estrada do sul, de quem vem da Floresta) e `gate` (logo dentro do portão norte, de quem volta do mapa). Depuração: `?area=vila`, `__dev.area.debug.{horse,wild,mount,dismount}`.
- **Testado no navegador (28/out):** Tito → maçã → confiança do cavalo → carta → bilhete (+6 moedas), montar, e uma galinha tocada até entrar no galinheiro.
  **Ainda não testado jogando:** forja, engrenagens, encomenda, loja, portão e o mapa (o código é o da 3D, mas vale um passe completo no celular).
- **Falta portar para 2D:** Ruínas, Taverna, Vinhedo, Castelo, Sala do Tesouro (e o mapa só abre áreas já construídas).
