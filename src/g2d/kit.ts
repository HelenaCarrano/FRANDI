import {
  AUTUMN,
  PAL,
  buildBoulder,
  buildBush,
  buildFern,
  buildMushroom,
  buildOverhang,
  buildRock,
  buildStone,
  buildStump,
  buildTree,
  drawChicken,
  drawMatheus,
  makeCanvas,
  mulberry32,
  type Dir,
  type TreeSprite,
} from './art';

/** Todos os desenhos prontos que as áreas reaproveitam (feitos uma vez, no começo do jogo). */
export interface Kit {
  trees: TreeSprite[];
  rocks: HTMLCanvasElement[];
  bushes: HTMLCanvasElement[];
  mushRed: HTMLCanvasElement;
  mushGlow: HTMLCanvasElement;
  stump: HTMLCanvasElement;
  ferns: HTMLCanvasElement[];
  boulders: HTMLCanvasElement[];
  stones: HTMLCanvasElement[];
  /** Matheus: chave `${dir}${frame}${b}` com dir = down | up | side | left. */
  matheus: Record<string, HTMLCanvasElement>;
  chicken: HTMLCanvasElement[];
  overL: HTMLCanvasElement;
  overR: HTMLCanvasElement;
  leafCols: string[];
}

export function buildKit(): Kit {
  const rng = mulberry32(31415);
  const pineSchemes = AUTUMN
    ? [
        { ramp: ['#102818', '#1a4024', '#2e5e32', '#6a9040'], outline: '#0a1a10' },
        { ramp: ['#1a301a', '#2a4a24', '#46682c', '#98a840'], outline: '#102010' },
      ]
    : [
        { ramp: ['#14402e', '#1e5c3c', '#2e7e4c', '#58a868'], outline: '#0e2e20' },
        { ramp: ['#1c4a3a', '#2a6a50', '#3c8a66', '#68b488'], outline: '#12362a' },
        { ramp: ['#1f5a52', '#2f7a6a', '#4aa088', '#7cc8aa'], outline: '#123a36' },
        { ramp: ['#4a2418', '#7a3c20', '#a8602c', '#d89a50'], outline: '#2e1610' },
      ];
  const trees: TreeSprite[] = [
    ...PAL.trees.flatMap((s) => [buildTree(rng, s, true), buildTree(rng, s, false), buildTree(rng, s, true)]),
    ...pineSchemes.flatMap((s) => [buildTree(rng, s, true, 'pine'), buildTree(rng, s, false, 'pine'), buildTree(rng, s, true, 'pine'), buildTree(rng, s, true, 'pine'), buildTree(rng, s, false, 'pine'), buildTree(rng, s, true, 'pine')]),
  ];
  const rocks = [8, 12, 18, 26].map((w) => buildRock(rng, w));
  const bushes = [buildBush(rng, 22, null), buildBush(rng, 30, '#e0405a'), buildBush(rng, 18, null), buildBush(rng, 26, '#f0d850')];
  const boulders = [buildBoulder(rng, 64), buildBoulder(rng, 84), buildBoulder(rng, 52), buildBoulder(rng, 72)];
  const stones = [buildStone(rng, 28), buildStone(rng, 22)];
  const ferns = [buildFern(rng), buildFern(rng), buildFern(rng)];

  const matheus: Record<string, HTMLCanvasElement> = {};
  for (const d of ['down', 'up', 'side'] as Dir[]) for (const f of [0, 1, 2, 3, 4]) for (const b of [false, true]) matheus[`${d}${f}${b ? 'b' : ''}`] = drawMatheus(d, f, b);
  for (const f of [0, 1, 2, 3, 4]) {
    for (const b of ['', 'b']) {
      const src = matheus[`side${f}${b}`];
      const { c, ctx } = makeCanvas(src.width, src.height);
      ctx.translate(src.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0);
      matheus[`left${f}${b}`] = c;
    }
  }
  const leafCols = PAL.trees.flatMap((t) => [t.ramp[2], t.ramp[3], t.ramp[1]]);
  return {
    trees,
    rocks,
    bushes,
    mushRed: buildMushroom(false),
    mushGlow: buildMushroom(true),
    stump: buildStump(rng),
    ferns,
    boulders,
    stones,
    matheus,
    chicken: [drawChicken(0), drawChicken(1)],
    overL: buildOverhang(rng, 104, 56, leafCols),
    overR: buildOverhang(rng, 84, 50, leafCols),
    leafCols,
  };
}
