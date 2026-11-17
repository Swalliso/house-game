// Our own pixel drawings, for what LimeZu doesn't draw (D-097): the Doghouse, the Henhouse's hens,
// the Sprinkler, the dogs' bed in Nana's Room (D-111), and the Doghouse's dog, on its lead and
// loose (D-179). They're in LimeZu's style: its palette, its ink (#3a3a50) for outlines, light
// from the top left, and its shadow (the ink at 100/255) under things that stand on the ground.
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
  p: [0xee, 0xa5, 0xb8, 255], // a dog's tongue
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
 * The Doghouse's dog on its lead (D-179), while the Doghouse earns nothing outside a fenced yard:
 * the Barkers' brown dog with a white blaze, in the dogs' bed's colors, sitting in the kennel's
 * doorway, facing us, its red lead sagging from its collar to a ring on the kennel's corner post.
 * Drawn to stand at (3, 20) in the Doghouse's cell, over the kennel (yard.ts).
 */
const DOG_ON_LEAD = [
  '.......kkkkkkk...',
  '......kkvvUUUkk..',
  '.g...kBBvUUUUBBk.',
  '.kr..kBkUkUkUkBk.',
  '..r..kBBUhhhUBBk.',
  '...r..kkUhkhUkk..',
  '....rrrrkrrrkk...',
  '......kUUhhhUUk..',
  '.....kUUkhhhkUUk.',
  '.....kUUkhhhkUUk.',
  '......kkkhkhkkk..',
  '.......sssssss...',
] as const;

/** The dog let loose: sitting up, its tongue out and its tail up. */
const DOG_UP = [
  '..kkkkkkk...',
  '.kkvvUUUkk..',
  'kBBvUUUUBBk.',
  'kBkUkUkUkBk.',
  'kBBUhhhUBBk.',
  '.kkUhkhUkk..',
  '..kkhphkk.k.',
  '..krrprrkkUk',
  '.kUUhhhUUkk.',
  'kUUkhhhkUUk.',
  'kUUkhhhkUUk.',
  '.kkkhkhkkk..',
] as const;

/** The same dog in the air, mid-hop, its legs tucked under it. */
const DOG_HOP = [...DOG_UP.slice(0, 9), 'kUUhhhhhUUk.', '.kkkkkkkkk..'];

/** Rows laid into a clear frame `w` × `h`, each drawing at its spot (x, y), later ones on top. */
function laid(
  w: number,
  h: number,
  parts: readonly (readonly [readonly string[], number, number])[],
): string[] {
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (const [grid, x, y] of parts) {
    grid.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch !== '.') rows[y + j]![x + i] = ch;
      });
    });
  }
  return rows.map((r) => r.join(''));
}

/**
 * The loose dog (D-179) as one animation in a box 15 × 29 that stands at (0, 3) in the Doghouse's
 * cell (yard.ts): sitting up on the kennel's roof, hopping down to the grass by the kennel's
 * corner, sitting there, and hopping back up. Every frame lasts FEEL.dog.hopMs: a hop is one
 * frame in the air, a rest as many frames as its time takes. Its first frame, on the roof, is the
 * one that stands still under Reduce motion and that the cards, the ghost and the photos show.
 */
const DOG_LOOSE = (() => {
  const on = (ms: number) => Math.max(1, Math.round(ms / FEEL.dog.hopMs));
  const roof = laid(15, 29, [[DOG_UP, 3, 0]]);
  const air = laid(15, 29, [
    [DOG_HOP, 1, 8],
    [['...ssssss...'], 1, 27],
  ]);
  const grass = laid(15, 29, [
    [DOG_UP, 0, 16],
    [['..ssssssss..'], 0, 28],
  ]);
  return [
    ...Array.from({ length: on(FEEL.dog.roofMs) }, () => roof),
    air,
    ...Array.from({ length: on(FEEL.dog.grassMs) }, () => grass),
    air,
  ];
})();

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
  'own-dog-on-lead': { frames: [DOG_ON_LEAD] },
  'own-dog-loose': { frames: DOG_LOOSE, ms: FEEL.dog.hopMs },
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
