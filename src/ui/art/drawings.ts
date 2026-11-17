// Our own pixel drawings, for what LimeZu doesn't draw (D-097): the Doghouse, the Henhouse's hens,
// the Sprinkler, the dogs' bed in Nana's Room (D-111), and rain and its puddles (D-180, drawn by
// board/WeatherLayer.tsx rather than as items). They're in LimeZu's style: its palette,
// its ink (#3a3a50) for outlines, light from the top left, and its shadow (the ink at 100/255)
// under things that stand on the ground.
// Pure: each is rows of characters, one per art px, each a color from KEY ('.' is clear). The
// painters read their pixels; the board shows them as images (HouseLayers.tsx).
//
// Ids start with "own-", so they never collide with the atlas's sprites. ArtId is either kind:
// items in rooms and yards may be one or the other.

import { FEEL } from '../fx/feel.ts';
import { spriteFrames, spritePos, type SpriteId } from '../sprites.ts';

type Rgba = readonly [number, number, number, number];

/** The colors the drawings use: LimeZu's palette (palette.ts), and its ink at 100/255 for shadow. */
export const KEY: Readonly<Record<string, Rgba>> = {
  k: [0x3a, 0x3a, 0x50, 255], // ink
  s: [0x3a, 0x3a, 0x50, 100], // shadow
  R: [0xfc, 0x5c, 0x46, 255], // red roof, lit
  r: [0xe6, 0x3f, 0x38, 255],
  d: [0xcb, 0x2a, 0x2a, 255], // red roof, shaded
  D: [0x9e, 0x2b, 0x2d, 255],
  e: [0x6b, 0x38, 0x3b, 255],
  W: [0xf1, 0xce, 0x8e, 255], // wood, lit
  w: [0xe0, 0xb8, 0x70, 255],
  v: [0xda, 0xa4, 0x63, 255],
  b: [0xc7, 0x8c, 0x59, 255], // wood, a plank's seam
  B: [0xa8, 0x5f, 0x46, 255],
  o: [0x3a, 0x3a, 0x50, 255], // a doorway's dark
  O: [0x46, 0x46, 0x5e, 255],
  c: [0x50, 0xa7, 0xe8, 255], // water
  C: [0xcc, 0xe6, 0xec, 255],
  x: [0x41, 0x60, 0x95, 255], // a bowl
  g: [0x9d, 0xa3, 0xb7, 255], // metal
  G: [0xca, 0xc3, 0xd5, 255],
  m: [0x32, 0x67, 0x5a, 255], // a sprinkler's feet
  h: [0xf8, 0xf8, 0xf8, 255], // a white hen
  H: [0xca, 0xc3, 0xd5, 255],
  U: [0xc7, 0x8c, 0x59, 255], // a brown hen
  u: [0x91, 0x6e, 0x41, 255],
  y: [0xf2, 0xb2, 0x2b, 255], // beaks and feet
  // S06 (D-180): rain, see-through, its tail faintest and its head brightest.
  j: [0xc4, 0xd7, 0xe3, 90], // rain's tail
  J: [0xe2, 0xf2, 0xf3, 150],
  l: [0xf8, 0xf8, 0xf8, 205], // rain's head
  // A puddle: a wet rim, the water, the sky in it and a glint, and the rings a drop makes.
  f: [0x50, 0x85, 0xb4, 140], // a puddle's wet rim
  F: [0x74, 0xaa, 0xbf, 235], // its water
  i: [0xa4, 0xbb, 0xd5, 240], // the sky in it
  I: [0xe2, 0xf2, 0xf3, 255], // a glint
  n: [0xf8, 0xf8, 0xf8, 230], // a drop's ring
  N: [0xe2, 0xf2, 0xf3, 160], // the ring, spreading
};

/**
 * The Doghouse: a red gable roof over a plank front with an arched doorway, and a water bowl by
 * it. Drawn for one 32 px cell.
 */
const DOGHOUSE = [
  '.........kkkkkkkk............',
  '.....kkkkRRRWedddkkkk........',
  '.kkkkRRRRRRRWedddddddkkkk....',
  '.kRRRRRRRRRRWeddddddddddk....',
  '.kRRRRRRRRRRWeddddddddddk....',
  '.kRRRRRRRRRRWeddddddddddk....',
  '.kRRRRRRRrrrReDDDdddddddk....',
  '.kRRRrrrrrrrReDDDDDDDdddk....',
  '.krrrrrrrrrrreeeeDDDDDDDk....',
  '.krrrrrrrkkkkkkkkeeeeDDDk....',
  '.krrrkkkkwwwwwwwwkkkkeeek....',
  '.kkkkwwwwwwwwwwwwwwwvkkkk....',
  '...kbbbbbbbkkkkbbbbbBBk......',
  '...kwwwwwwkooookwwwwvvk......',
  '...kwwwwwkoooooOkwwwvvk......',
  '...kbbbbkoooooooOkbbBBk......',
  '...kwwwwkoooooooOkwwvvk......',
  '...kwwwwkoooooooOkwwvvk......',
  '...kbbbbkoooooooOkbbBBk.kkkk.',
  '...kwwwwkoooooooOkwwvvkkcCcck',
  '...kwwwwkoooooooOkwwvvkkxxxxk',
  '...kkkkkkkkkkkkkkkkkkkk.kkkk.',
  '....sssssssssssssssssssssss..',
  '......sssssssssssssssss......',
] as const;

/** A hen facing west: white, with a red comb and a yellow beak. */
const HEN = [
  '...dd....',
  '..kddk...',
  '.khhokk..',
  'yyhhhhhk.',
  '.khhhhhhk',
  '..khHHhhk',
  '..khhHHk.',
  '...kyyk..',
  '...sssss.',
] as const;

/** The same hen in brown. */
const BROWN_HEN = HEN.map((row) => row.replace(/h/g, 'U').replace(/H/g, 'u'));

/**
 * The Sprinkler: a little oscillating sprinkler on the lawn, its fan of droplets in three frames
 * (the drops move between them).
 */
const SPRINKLER = [
  [
    '..........C..C.C...........',
    '.......C..........C........',
    '.....C......c..c....C......',
    '...C....c.c......c....C....',
    '...................c.......',
    '..C...c....C.C.C.C...c..C..',
    '....c....C.................',
    '.C.....C....hh.h...C..c..C.',
    '...c..C...h.....h...C......',
    '.........hkkkkkkk..........',
    '.........kGGGGGGGk.........',
    '.........kgggggggk.........',
    '..........kmkkkmk..........',
    '...........sssss...........',
  ],
  [
    '...........C.C..C..........',
    '........C..........C.......',
    '......C....c.c.c.....C.....',
    '....C...c.........c....C...',
    '......c.............c......',
    '..C......C.C.C..C.......C..',
    '.....c..C........C...c.....',
    '.C..c.......h.h....C..c..C.',
    '.......C..h....h...........',
    '.........hkkkkkkkh.........',
    '.........kGGGGGGGk.........',
    '.........kgggggggk.........',
    '..........kmkkkmk..........',
    '...........sssss...........',
  ],
  [
    '.........C..C.C..C.........',
    '......C.............C......',
    '....C......c..c.......C....',
    '.........c......c.c........',
    '..C....c................C..',
    '.....c....C.C.C.C...c......',
    '.C......C.........C...c..C.',
    '....c..C...h.hh............',
    '..........h.....h..C.......',
    '..........kkkkkkkh.........',
    '.........kGGGGGGGk.........',
    '.........kgggggggk.........',
    '..........kmkkkmk..........',
    '...........sssss...........',
  ],
] as const;

/**
 * The dogs' bed in Nana's Room (the Barkers' Nana wants the dogs close; LimeZu's Interiors has a
 * cat but no dog): a round red cushion in the Doghouse's roof colors, its cream lining, and a brown
 * dog asleep on it, its white muzzle and floppy ear to the west.
 */
const DOG_BED = [
  '......kkkkkkkkkk......',
  '....kkkkRRRRRRRRkk....',
  '..kkvvUUkkkkkkkkrrkk..',
  '.kkvUkUUBkWWkkkkkkrdk.',
  '.kkUUUUUBBkkvvvvUkkddk',
  'kRkkhUUUBBvUUUUUUukkdk',
  'kRkhhhkkBBUUUUUUuukkdk',
  'krrkkkwkkUUUUUuuukkkdk',
  'krrrrkkkkkkkkkkkkkdddk',
  'kdrrrrrrrrrrrrrrrrdddk',
  '.kddddddddddddddddDDk.',
  '..kkDDDDDDDDDDDDDDkk..',
  '....kkkkkkkkkkkkkk....',
  '......ssssssssssss....',
] as const;

/**
 * Rain (S06, D-180): a streak falling down and to the left, 3 px down for each 1 across, as its
 * sheet steps (board/weather.ts). The near one is two steps of three; the far one is one, fainter.
 */
const RAIN_NEAR = ['.j', '.J', '.J', 'J.', 'l.', 'l.'] as const;
const RAIN_FAR = ['j', 'j', 'J'] as const;

/**
 * A puddle on the paving where it rains (S06): a wide one with a small one beside it, a wet rim,
 * the sky in the water and a glint from the top left. Its frames are drops landing in it, each
 * spreading in a flat ring, in one puddle and then the other.
 */
const PUDDLE = [
  '.....ffffff...........',
  '..fffFFFFFFfff........',
  '.ffFiIIiFFFFFff.......',
  'fFFiIiiFFFFFFFFf......',
  'fFFFiFFFFFFFFFFf..fff.',
  '.ffFFFFFFFFFFff..fFFFf',
  '..fffFFFFFFfff...fiFFf',
  '.....ffffff.......fff.',
] as const;

/** A drop's ring, as offsets from where it lands: the drop, then rings spreading flat. */
const RINGS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [
    [-2, 0],
    [2, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 1],
    [0, 1],
    [1, 1],
  ],
  [
    [-4, 0],
    [4, 0],
    [-3, -1],
    [3, -1],
    [-3, 1],
    [3, 1],
    [-2, -2],
    [-1, -2],
    [0, -2],
    [1, -2],
    [2, -2],
    [-2, 2],
    [-1, 2],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
];

/** `rows` with ring `r` of a drop landing at (cx, cy), on its water only (never its rim). */
function ripple(rows: readonly string[], cx: number, cy: number, r: number): string[] {
  const out = rows.map((row) => [...row]);
  for (const [dx, dy] of RINGS[r]!) {
    const row = out[cy + dy];
    if (row && 'FiI'.includes(row[cx + dx] ?? '.')) row[cx + dx] = r === 2 ? 'N' : 'n';
  }
  return out.map((row) => row.join(''));
}

/** Rows mirrored left to right. */
function mirror(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

interface Drawing {
  /** Each frame's rows; a still drawing has one frame. */
  readonly frames: readonly (readonly string[])[];
  /** Each frame's ms, for an animation. */
  readonly ms?: number;
}

export const DRAWINGS = {
  'own-doghouse': { frames: [DOGHOUSE] },
  'own-hen-w': { frames: [HEN] },
  'own-hen-e': { frames: [mirror(HEN)] },
  'own-hen-brown-w': { frames: [BROWN_HEN] },
  'own-hen-brown-e': { frames: [mirror(BROWN_HEN)] },
  'own-sprinkler': { frames: SPRINKLER, ms: 180 },
  'own-dog-bed': { frames: [DOG_BED] },
  'own-rain-near': { frames: [RAIN_NEAR] },
  'own-rain-far': { frames: [RAIN_FAR] },
  // Still in its first frame: the rest are drops landing, in the big puddle and then the small.
  'own-puddle': {
    frames: [
      PUDDLE,
      ripple(PUDDLE, 9, 4, 0),
      ripple(PUDDLE, 9, 4, 1),
      ripple(PUDDLE, 9, 4, 2),
      PUDDLE,
      ripple(PUDDLE, 19, 5, 0),
      ripple(PUDDLE, 19, 5, 1),
      PUDDLE,
    ],
    ms: FEEL.weather.puddle.frameMs,
  },
} as const satisfies Record<string, Drawing>;

export type DrawingId = keyof typeof DRAWINGS;

/** An atlas sprite or one of our drawings: what an item in a room or a yard shows. */
export type ArtId = SpriteId | DrawingId;

export function isDrawing(id: string): id is DrawingId {
  return id.startsWith('own-') && id in DRAWINGS;
}

/** A drawing's pixels: its frames side by side, RGBA (not premultiplied), w × frames by h. */
export interface DrawingPixels {
  /** One frame's size. */
  readonly w: number;
  readonly h: number;
  readonly frames: number;
  readonly ms?: number;
  readonly data: Uint8ClampedArray;
}

const pixelCache = new Map<DrawingId, DrawingPixels>();

export function drawingPixels(id: DrawingId): DrawingPixels {
  const hit = pixelCache.get(id);
  if (hit) return hit;
  const d: Drawing = DRAWINGS[id];
  const h = Math.max(...d.frames.map((f) => f.length));
  const w = Math.max(...d.frames.flatMap((f) => f.map((r) => r.length)));
  const n = d.frames.length;
  const data = new Uint8ClampedArray(w * n * h * 4);
  d.frames.forEach((rows, k) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = KEY[row[x]!];
        if (!c) continue;
        data.set(c, (y * w * n + k * w + x) * 4);
      }
    });
  });
  const out: DrawingPixels = { w, h, frames: n, ...(d.ms ? { ms: d.ms } : {}), data };
  pixelCache.set(id, out);
  return out;
}

/** An item's size in art px (an animation's one frame). */
export function artSize(id: ArtId): { w: number; h: number } {
  if (isDrawing(id)) {
    const d = drawingPixels(id);
    return { w: d.w, h: d.h };
  }
  const { w, h } = spritePos(id);
  return { w, h };
}

/** An animated item's frames (the strip's stride is one frame's width for a drawing), or null. */
export function artFrames(id: ArtId): { frames: number; stride: number; ms: number } | null {
  if (isDrawing(id)) {
    const d = drawingPixels(id);
    return d.frames > 1 && d.ms ? { frames: d.frames, stride: d.w, ms: d.ms } : null;
  }
  return spriteFrames(id);
}

/** Whether a drawing's character is a color in the key (for tests). */
export function inKey(ch: string): boolean {
  return ch === '.' || ch in KEY;
}
