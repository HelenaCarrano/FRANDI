# Créditos e licenças dos modelos

| Pacote | Autor | Licença | Onde está |
|--------|-------|---------|-----------|
| KayKit Adventurers Character Pack 1.0 | Kay Lousberg (kaylousberg.com) | CC0 1.0 | `public/models/characters/` |
| KayKit Dungeon Remastered 1.0 | Kay Lousberg (kaylousberg.com) | CC0 1.0 | `public/models/dungeon/` |

CC0: uso livre, inclusive comercial, sem obrigação de crédito. Vamos creditar mesmo assim
na tela final do jogo.

## Arquivos derivados

- `characters/Mage.glb`: original com só as animações usadas pelo jogo.
- `characters/knight_head.glb`: só a malha da cabeça (com esqueleto) extraída de
  `Knight.glb`, sem animações.

O Matheus é montado em tempo real em `src/entities/matheusModel.ts`
(corpo do Mage + cabeça do Knight recoloridos; cabelo cacheado, barba curta e nariz
menor gerados em `src/entities/matheusHead.ts`).
