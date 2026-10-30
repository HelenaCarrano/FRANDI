/**
 * Pixel art dos itens da encomenda da Dona Pimenta (e dos três cestos). Cada desenho é uma grade de
 * até 16x16 caracteres: '.' é transparente e as outras letras vêm da paleta. Devolve uma imagem (data URL)
 * que o CSS amplia sem suavizar, para parecer item de verdade e não um emoji em uma caixa.
 */

const O = '#2a1a14';

interface Art {
  rows: string[];
  pal: Record<string, string>;
}

const ART: Record<string, Art> = {
  pao: {
    pal: { o: O, b: '#d89a4a', h: '#f0c878', d: '#a8682a', w: '#f6e0a8' },
    rows: [
      '',
      '',
      '',
      '.....oooooo.....',
      '...ooobbbbooo...',
      '..obbhhbbbbbbo..',
      '.obbhbbwbbwbbbo.',
      '.obbbbwwbbwwbbo.',
      '.obbbbbbbbbbbbo.',
      '.obdbbbbbbbbbdo.',
      '..oddbbbbbbddo..',
      '...ooddddddoo...',
      '.....oooooo.....',
    ],
  },
  queijo: {
    pal: { o: O, y: '#f2c640', h: '#ffe488', d: '#c8902a', k: '#a8701c' },
    rows: [
      '',
      '',
      '',
      '.........ooo....',
      '......oooyhyoo..',
      '....ooyyyyhyyyo.',
      '..ooyyhyyyyyyyyo',
      '.oyyyyyyyyyyyyyo',
      '.ooooooooooooooo',
      '.oyyyyyyydyyydyo',
      '.oyykkyyyddyyddo',
      '.oyykkyyyyyyyddo',
      '..ooooooooooooo.',
    ],
  },
  maca: {
    pal: { o: O, r: '#d83a3a', h: '#ff8a7a', d: '#98222c', g: '#4a9a3a', t: '#6a3e26' },
    rows: [
      '',
      '.......tt.......',
      '......ot..og....',
      '.....o.otoggo...',
      '...ooo.oggoooo..',
      '..orrrorrrrrrro.',
      '.orrhhrrrrrrrrro',
      '.orhhrrrrrrrrrro',
      '.orrrrrrrrrrrdro',
      '.orrrrrrrrrrrddo',
      '..orrrrrrrrrddo.',
      '..oordrrrrrddoo.',
      '...ooodddddooo..',
      '.....oooooo.....',
    ],
  },
  corda: {
    pal: { o: O, r: '#c8a060', h: '#e8cc90', d: '#8c6a38' },
    rows: [
      '',
      '',
      '....oooooooo....',
      '..ooohhrrhhrooo.',
      '.ohhrrdddddrrhho',
      '.ohrdooooooodrho',
      'ohrdoo......oodr',
      'ohrdo........odr',
      'ohrdo........odr',
      'ohrdoo......oodd',
      '.odrdooooooodrdo',
      '.odrrdddddddrrdo',
      '..oodrrrrrrrdoo.',
      '....oooooooooo..',
    ],
  },
  martelo: {
    pal: { o: O, g: '#8a94a6', h: '#c4ccd8', d: '#5a6478', w: '#a8744a', k: '#7a4e2c' },
    rows: [
      '',
      '..oooooooooo....',
      '.ohhhhggggggo...',
      '.ohhgggggdddo...',
      '.oggggggdddddo..',
      '.oooooooooowoo..',
      '........owwko...',
      '........owwko...',
      '........owwko...',
      '........owwko...',
      '........owwko...',
      '........owwko...',
      '........owwko...',
      '.........ooo....',
    ],
  },
  lanterna: {
    pal: { o: O, m: '#6a7288', l: '#98a2b8', y: '#ffe070', f: '#ff9a2a', w: '#fff6c0', g: '#d8f0ff' },
    rows: [
      '.....oooo.......',
      '....ollllo......',
      '...ooooooooo....',
      '..ommmmmmmmmo...',
      '..omggwwwwgmo...',
      '..omgywwwwymo...',
      '..omgyfwwfymo...',
      '..omgyffffymo...',
      '..omgyyffyymo...',
      '..omgggyygggmo..',
      '..ommmmmmmmmo...',
      '..ooooooooooo...',
    ],
  },
  vaso: {
    pal: { o: O, b: '#4a7ac8', h: '#8ab4f0', d: '#2a4a8c', w: '#f4f0e8', p: '#e8708a', g: '#4a9a3a' },
    rows: [
      '.....g..p.g.....',
      '....gg.ppp.g....',
      '.....g..p..g....',
      '....oooooooo....',
      '....ohwwwwbo....',
      '.....obbbbo.....',
      '....obhbbbdo....',
      '...obhhbbbbdo...',
      '..obhwbwbwbbdo..',
      '..obhbbbbbbbdo..',
      '..obbwbwbwbbdo..',
      '..oobbbbbbbddo..',
      '...obbbbbbbdo...',
      '....oddddddo....',
      '.....oooooo.....',
    ],
  },
  vela: {
    pal: { o: O, w: '#f6ecd0', s: '#d8c89c', y: '#ffe070', f: '#ff9a2a', k: '#8a6a3c', t: '#d83a3a' },
    rows: [
      '......f.........',
      '.....fyf........',
      '.....fyf........',
      '......ok........',
      '.....owwo.......',
      '.....owsso......',
      '....ottttto.....',
      '.....owwso......',
      '.....owwso......',
      '.....owwso......',
      '...oooooooooo...',
      '..okkkkkkkkkko..',
      '...oooooooooo...',
    ],
  },
  boneca: {
    pal: { o: O, s: '#f4cfa0', h: '#6a3e26', r: '#d8506a', b: '#4a7ac8', w: '#f4f0e8', k: '#1c1210' },
    rows: [
      '......hhhh......',
      '....ohhhhhho....',
      '...ohhssssshoo..',
      '...ohsksskshho..',
      '...ohsssssshho..',
      '....hssrrsshh...',
      '.....oossoo.....',
      '....orrrrrro....',
      '..osorrwwrroso..',
      '..osorrrrrroso..',
      '...ooorrrrooo...',
      '....obbbbbbo....',
      '....obbbbbbo....',
      '....obbooobbo...',
      '....okko.okko...',
    ],
  },

  ferradura: {
    pal: { o: O, m: '#aab2c0', h: '#e4e9f2', d: '#6a7488', k: '#3a4254' },
    rows: [
      '',
      '',
      '...oooooooooo...',
      '..ohhhhhhhhhho..',
      '.ohmmmmmmmmmmmo.',
      '.ohmmmmmmmmmmdo.',
      'ohmmmoooooommmdo',
      'ohmmoo....oommdo',
      'ohmmo......ommdo',
      'ohokmo....ommkdo',
      'ohmmmo....ommmdo',
      'ohmmmo....ommmdo',
      'ohmmko....okmmdo',
      '.oddo......oddo.',
      '..oo........oo..',
    ],
  },

  chapeu_palha: {
    pal: { o: O, s: '#e0b84a', h: '#f6dc84', d: '#a8802a', b: '#b8442c', k: '#7a5a1c' },
    rows: [
      '',
      '',
      '.....oooooo.....',
      '....ohhssssoo...',
      '...ohhsssssddo..',
      '...osssssssddo..',
      '...obbbbbbbbbo..',
      '..oohsssssssdoo.',
      '.ohhsssskssssddo',
      'ohsshsssssssksdo',
      'oddddddddddddddo',
      '.oooooooooooooo.',
    ],
  },

  // ----- cestos -----
  provisoes: {
    pal: { o: O, b: '#b8763a', h: '#e0a05c', d: '#80501f', s: '#d8b070', k: '#4a3018' },
    rows: [
      '',
      '.....oooooo.....',
      '....obbbbbbo....',
      '...obbhhhhbbo...',
      '..obbhbbbbhbbo..',
      '..obbbbbbbbbbo..',
      '..obbbssssbbbo..',
      '..obbsoooosbbo..',
      '..obbsobbosbbo..',
      '..obbbssssbbbo..',
      '..odbbbbbbbbdo..',
      '..oddbbbbbbddo..',
      '...oooooooooo...',
    ],
  },
  ferramentas: {
    pal: { o: O, r: '#c8503a', h: '#ee8068', d: '#8c2e22', m: '#c8d0dc', k: '#5a6478' },
    rows: [
      '',
      '',
      '......oooooo....',
      '.....omkkkkmo...',
      '.....ok....ko...',
      '..oooooooooooo..',
      '..orhhhhhhhhro..',
      '..orrrrrrrrrdo..',
      '..oooooommooo...',
      '..orrrrrmmrrro..',
      '..orrrrrrrrrdo..',
      '..oddddddddddo..',
      '..oooooooooooo..',
    ],
  },
  prateleira: {
    pal: { o: O, w: '#a8744a', h: '#d09a64', d: '#6a4424', g: '#6aa8d8', y: '#f2c640', r: '#d8506a' },
    rows: [
      '',
      '..oooooooooooo..',
      '..odggo.oyyyo...',
      '..odggo.oyyyo.o.',
      '..oooooooooooor.',
      '.owhhhhhhhhhhwo.',
      '.odddddddddddddo',
      '..od........do..',
      '..od...rr...do..',
      '..oooooooooooo..',
      '.owhhhhhhhhhhwo.',
      '.odddddddddddddo',
    ],
  },
};

const cache = new Map<string, string>();
const canvases = new Map<string, HTMLCanvasElement>();

/** Canvas 16x16 do item (para desenhar no mundo), ou `null` se não houver desenho. */
export function itemCanvas(id: string): HTMLCanvasElement | null {
  itemArt(id);
  return canvases.get(id) ?? null;
}

/** Imagem (data URL) do item ou cesto com esse id, ou `null` se não houver desenho. */
export function itemArt(id: string): string | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const art = ART[id];
  if (!art) return null;
  const SIZE = 16;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const yOff = Math.max(0, Math.floor((SIZE - art.rows.length) / 2));
  art.rows.forEach((row, y) => {
    const r = row.padEnd(SIZE, '.');
    for (let x = 0; x < SIZE; x++) {
      const ch = r[x];
      if (ch === '.' || !art.pal[ch]) continue;
      ctx.fillStyle = art.pal[ch];
      ctx.fillRect(x, y + yOff, 1, 1);
    }
  });
  canvases.set(id, c);
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
