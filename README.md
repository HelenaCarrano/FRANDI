# A Aventura do Matheus

Jogo de aventura 3D para navegador (Vite + TypeScript + Three.js).

```bash
npm install
npm run dev      # abre em http://localhost:5173 e também na rede local (para testar no celular)
npm run build    # gera dist/ para hospedagem estática
```

Parâmetros de URL úteis: `?debug` (mostra FPS), `?q=low` / `?q=high` (força qualidade), `?area=teste` (salão de testes), `?area=mapa` (abre direto no Mapa do Reino), `?area=ruinas` (Ruínas Esquecidas), `?area=torre` (Torre do Saber), `?area=taverna` (Taverna do Zé), `?area=vinhedo` (Vinhedo Dourado), `?libera=tudo` (mapa com tudo aberto), `?personagem` (visualizador do Matheus).
O progresso é salvo no navegador; a tela inicial oferece Continuar ou Recomeçar.

Textos do jogo: [src/content.ts](src/content.ts). Plano de construção: [docs/PLANO.md](docs/PLANO.md).
