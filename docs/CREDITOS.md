# Créditos e licenças dos modelos

| Pacote | Autor | Licença | Onde está |
|--------|-------|---------|-----------|
| KayKit Adventurers Character Pack 1.0 | Kay Lousberg (kaylousberg.com) | CC0 1.0 | `public/models/characters/` |
| KayKit Dungeon Remastered 1.0 | Kay Lousberg (kaylousberg.com) | CC0 1.0 | `public/models/dungeon/` |
| KayKit Medieval Hexagon Pack 1.0 | Kay Lousberg (kaylousberg.com) | CC0 1.0 | `public/models/village/` |

CC0: uso livre, inclusive comercial, sem obrigação de crédito. Vamos creditar mesmo assim
na tela final do jogo.

## Arquivos derivados

- `characters/Mage.glb`: original com só as animações usadas pelo jogo.
- `characters/knight_head.glb`: só a malha da cabeça (com esqueleto) extraída de
  `Knight.glb`, sem animações.

O Matheus é montado em tempo real em `src/entities/matheusModel.ts`
(corpo do Mage + cabeça do Knight recoloridos; cabelo cacheado, barba curta e nariz
menor gerados em `src/entities/matheusHead.ts`).

- `characters/Barbarian.glb`, `Rogue_Hooded.glb`, `Rogue.glb`: NPCs da vila, do pacote Adventurers, só
  com as animações usadas (Idle, Interact, Cheer, Walking_A, PickUp, Use_Item).
- `characters/sword_1handed.glb`, `axe_1handed.glb`, `mug_full.glb`, `dagger.glb`,
  `shield_round_barbarian.glb`: armas e objetos do pacote Adventurers.
- `village/*.glb`: peças escolhidas do Medieval Hexagon Pack, convertidas de glTF para GLB (textura embutida). O Mapa do Reino
  acrescentou castelo, torres, construção destruída, montanhas e colinas.
- O gatinho e a mochila do Matheus são gerados em código (`src/entities/cat.ts`, `backpack.ts`).
