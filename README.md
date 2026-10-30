# A Aventura do Matheus

Jogo de aventura 2D em pixel art para navegador (Vite + TypeScript + Canvas).

```bash
npm install
npm run dev      # abre em http://localhost:5173 e também na rede local (para testar no celular)
npm run build    # gera dist/ para hospedagem estática
```

Parâmetros de URL úteis: `?debug` (expõe o jogo em `window.__dev`), `?q=low` / `?q=high` (força qualidade), `?area=forest` ou `?area=village` (abre direto numa área; `&entry=...` escolhe o ponto de chegada), `?libera=tudo` (mapa com tudo aberto).
O progresso é salvo no navegador; a tela inicial oferece Continuar ou Recomeçar.

`forest2d.html` é um teste de estilo da floresta (só no `npm run dev`).

Textos do jogo: [src/content.ts](src/content.ts). A versão 3D (Three.js) foi removida; continua no histórico do git.
