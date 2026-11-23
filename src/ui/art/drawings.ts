// Our own pixel drawings, for what LimeZu doesn't draw (D-097): the Doghouse, the Henhouse's hens,
// the Sprinkler, the dogs' bed in Nana's Room (D-111), the Doghouse's dog, on its lead and loose
// (D-179), rain and its puddles (D-180, drawn by board/WeatherLayer.tsx rather than as items), the
// Fountain (D-199), a pantry's shelf and sack of flour (D-216), and the stepping stones up to the
// front door (D-217, painted on the floor canvas as ground). The hens peck, the dog in the bed
// breathes (D-185) and the Fountain's water falls, each from its first frame, at rest.
// They're in LimeZu's style: its palette, its ink (#3a3a50) for outlines, light from the top
// left, and its shadow (the ink at 100/255) under things that stand on the ground.
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
  // The Fountain (D-199): pale stone, lit to shaded, its basin's water ('c' under the bowl's
  // rim), and the water falling, brightest where it catches the light.
  A: [0xeb, 0xe4, 0xf2, 255], // stone, lit
  a: [0xd8, 0xd0, 0xe0, 255],
  E: [0xc6, 0xbd, 0xd5, 255],
  K: [0x98, 0x9e, 0xbe, 255],
  M: [0x7d, 0x7f, 0x99, 255], // stone, shaded
  T: [0x73, 0xb8, 0xc6, 255], // the basin's water
  V: [0x95, 0xe3, 0xe3, 255], // falling water
  z: [0xde, 0xff, 0xf7, 255], // its glints
  // D-216: a pantry's shelf and its sack of flour. The back of the shelf is 'O'.
  q: [0x63, 0xa6, 0x50, 255], // a green lid, tin and bottle
  Q: [0x56, 0x8d, 0x61, 255], // the bottle, shaded
  t: [0xed, 0x93, 0x1e, 255], // marmalade
  X: [0xe0, 0xd0, 0xb2, 255], // sacking, lit
  Y: [0xc3, 0xac, 0x90, 255],
  Z: [0xb2, 0x97, 0x7e, 255], // sacking, shaded
  // The stepping stones (D-217): warm grey flagstones, the pebbles' stone (LimeZu's) a step lighter,
  // lit from the top left, a darker rim along their front, and a darker outline.
  S: [0xd6, 0xca, 0xb3, 255], // stone, its lit edge
  L: [0xc2, 0xb3, 0xa6, 255], // stone, lit
  P: [0xab, 0x9a, 0x8f, 255], // stone, shaded
  '+': [0x8a, 0x7a, 0x77, 255], // its rim
  '#': [0x71, 0x64, 0x67, 255], // its outline
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

/** The hen pecking (D-185): its head down in front of its feet, its beak at the ground. */
const HEN_PECK = [
  '.........',
  '.........',
  '....kkk..',
  '..ddkhhk.',
  '.khhkhhhk',
  'khohhHHhk',
  'yykhhhHHk',
  '...kyyk..',
  '...sssss.',
] as const;

/** A drawing in brown: the hen's white feathers and their shade. */
const brown = (rows: readonly string[]) =>
  rows.map((row) => row.replace(/h/g, 'U').replace(/H/g, 'u'));

/** The same hen in brown. */
const BROWN_HEN = brown(HEN);
const BROWN_HEN_PECK = brown(HEN_PECK);

/**
 * The beats the hens peck on (D-185): each hen's drawing comes in one phase of its peck cycle per
 * beat, and yard.ts picks one by its piece's hash, so the two hens in a run never peck together.
 */
const PHASES = [0, 1, 2, 3] as const;
type HenPhase = (typeof PHASES)[number];
export const HEN_PHASES = PHASES.length;

/** A hen's look (yard.ts): white or brown, facing west or east. */
export type HenLook = 'w' | 'e' | 'brown-w' | 'brown-e';

/**
 * A hen's peck cycle (D-185): its head up for FEEL.hen.restMs, then down, up and down again,
 * every frame FEEL.hen.peckMs. Phase p starts p quarters of the way through its rest, so each
 * phase's first frame is still the hen at rest, head up: what Reduce motion, the cards and the
 * photos show.
 */
function pecking(
  up: readonly string[],
  down: readonly string[],
  phase: number,
): (readonly string[])[] {
  const rest = Math.max(1, Math.round(FEEL.hen.restMs / FEEL.hen.peckMs));
  const cycle = [...Array.from({ length: rest }, () => up), down, up, down];
  const turn = Math.floor((phase * rest) / HEN_PHASES);
  return [...cycle.slice(turn), ...cycle.slice(0, turn)];
}

/** A hen's drawings, one per phase: `${id}-0` to `${id}-3`. */
function hens<const Id extends string>(
  id: Id,
  up: readonly string[],
  down: readonly string[],
): Record<`${Id}-${HenPhase}`, Drawing> {
  const phases = PHASES.map((p) => [
    `${id}-${p}`,
    { frames: pecking(up, down, p), ms: FEEL.hen.peckMs },
  ]);
  return Object.fromEntries(phases) as Record<`${Id}-${HenPhase}`, Drawing>;
}

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
 * The Fountain (D-199): a round stone basin of water with a column up the middle to a bowl, its
 * jet rising from the bowl and two streams falling off its rim into the basin. Drawn for one
 * 32 px cell. Its frames are the water falling a pixel at a time (FEEL.fountain); the first is
 * the Fountain at rest, as Reduce motion shows it.
 */
const FOUNTAIN = [
  [
    '............VzzV............',
    '...........V.zz.V...........',
    '.............zV.............',
    '.............Vz.............',
    '..........kkkkkkkk..........',
    '........kkAAAaaaaakk........',
    '.......zkAATTTTTTaakz.......',
    '.......VkEaaTTTTaaMkV.......',
    '.......V.kEEKKKKMMk.V.......',
    '.......z..kkkKKkkk..z.......',
    '.......V...kAaaEk...V.......',
    '.......VkkkkAaaEkkkkV.......',
    '....kkkzAAAkAaaEkaaazkkk....',
    '..kkAAAVAAAkAaaEkaaaVaaakk..',
    '.kAAAAAVEEEkAaaEkEEEVaaaaak.',
    'kAAAAEEzccckAaaEkccczEaaaaak',
    'kAAAEczTzTTkAaaEkTTzTzcEaaak',
    'kAaETTTTTTTkAaaEkTTTTTTTEaak',
    'kaaKTTTTTVzTTTTTTzVTTTTTKaak',
    'kaaaKTTTTTTTTTTTTTTTTTTKaaak',
    'kEaaaKKTTTTTTTTTTTTTTKKaaaMk',
    'kEEEaaaKKKKKKKKKKKKKKaaaMMMk',
    'kEEEEEEEaaaaaaaaaaaaMMMMMMMk',
    '.kEEEEEEKKKKKKKKKKKKMMMMMMk.',
    '.skkEEEEKKKKKKKKKKKKMMMMkks.',
    '..sskkkkKKKKKKKKKKKKkkkkss..',
    '....sssskkkkkkkkkkkkssss....',
    '........ssssssssssss........',
  ],
  [
    '...........V.zz.V...........',
    '............zVVz............',
    '.............Vz.............',
    '.............zV.............',
    '..........kkkkkkkk..........',
    '........kkAAAaaaaakk........',
    '.......VkAATTTTTTaakV.......',
    '.......zkEaaTTTTaaMkz.......',
    '.......V.kEEKKKKMMk.V.......',
    '.......V..kkkKKkkk..V.......',
    '.......z...kAaaEk...z.......',
    '.......VkkkkAaaEkkkkV.......',
    '....kkkVAAAkAaaEkaaaVkkk....',
    '..kkAAAzAAAkAaaEkaaazaaakk..',
    '.kAAAAAVEEEkAaaEkEEEVaaaaak.',
    'kAAAAEEVccckAaaEkcccVEaaaaak',
    'kAAAEcVTVTTkAaaEkTTVTVcEaaak',
    'kAaETTTTTTTkAaaEkTTTTTTTEaak',
    'kaaKTTTTTVzTTTTTTzVTTTTTKaak',
    'kaaaKTTTTTTTTTTTTTTTTTTKaaak',
    'kEaaaKKTTTTTTTTTTTTTTKKaaaMk',
    'kEEEaaaKKKKKKKKKKKKKKaaaMMMk',
    'kEEEEEEEaaaaaaaaaaaaMMMMMMMk',
    '.kEEEEEEKKKKKKKKKKKKMMMMMMk.',
    '.skkEEEEKKKKKKKKKKKKMMMMkks.',
    '..sskkkkKKKKKKKKKKKKkkkkss..',
    '....sssskkkkkkkkkkkkssss....',
    '........ssssssssssss........',
  ],
  [
    '............VzzV............',
    '............V.zV............',
    '.............zz.............',
    '.............Vz.............',
    '..........kkkkkkkk..........',
    '........kkAAAaaaaakk........',
    '.......VkAATTTTTTaakV.......',
    '.......VkEaaTTTTaaMkV.......',
    '.......z.kEEKKKKMMk.z.......',
    '.......V..kkkKKkkk..V.......',
    '.......V...kAaaEk...V.......',
    '.......zkkkkAaaEkkkkz.......',
    '....kkkVAAAkAaaEkaaaVkkk....',
    '..kkAAAVAAAkAaaEkaaaVaaakk..',
    '.kAAAAAzEEEkAaaEkEEEzaaaaak.',
    'kAAAAEEVccckAaaEkcccVEaaaaak',
    'kAAAEczTzTTkAaaEkTTzTzcEaaak',
    'kAaETTTTTTTkAaaEkTTTTTTTEaak',
    'kaaKTTTTTVzTTTTTTzVTTTTTKaak',
    'kaaaKTTTTTTTTTTTTTTTTTTKaaak',
    'kEaaaKKTTTTTTTTTTTTTTKKaaaMk',
    'kEEEaaaKKKKKKKKKKKKKKaaaMMMk',
    'kEEEEEEEaaaaaaaaaaaaMMMMMMMk',
    '.kEEEEEEKKKKKKKKKKKKMMMMMMk.',
    '.skkEEEEKKKKKKKKKKKKMMMMkks.',
    '..sskkkkKKKKKKKKKKKKkkkkss..',
    '....sssskkkkkkkkkkkkssss....',
    '........ssssssssssss........',
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

/** The sleeping dog breathing in (D-185): its flank, behind its neck, 1 px higher. */
const DOG_BED_IN = [
  '......kkkkkkkkkk......',
  '....kkkkRRRRRRRRkk....',
  '..kkvvUUkkkkkkkkkrkk..',
  '.kkvUkUUBkWWvvvvUkrdk.',
  '.kkUUUUUBBkkUUUUUkkddk',
  'kRkkhUUUBBvUUUUUuukkdk',
  'kRkhhhkkBBUUUUuuuukkdk',
  'krrkkkwkkUUUUUuuukkkdk',
  'krrrrkkkkkkkkkkkkkdddk',
  'kdrrrrrrrrrrrrrrrrdddk',
  '.kddddddddddddddddDDk.',
  '..kkDDDDDDDDDDDDDDkk..',
  '....kkkkkkkkkkkkkk....',
  '......ssssssssssss....',
] as const;

/**
 * The dogs' bed asleep (D-185): one breath every FEEL.dogBed.breathMs, its flank up for `inMs` of
 * it, in frames of `stepMs`. Its first frame is the dog breathed out: the bed as it always was.
 */
const DOG_BED_BREATHING = (() => {
  const { breathMs, inMs, stepMs } = FEEL.dogBed;
  const on = (ms: number) => Math.max(1, Math.round(ms / stepMs));
  return [
    ...Array.from({ length: on(breathMs - inMs) }, () => DOG_BED),
    ...Array.from({ length: on(inMs) }, () => DOG_BED_IN),
  ];
})();

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

/**
 * The stepping stones from the front door's mat to the kerb (D-217, walkway.ts): four
 * flagstones, each a little wider than deep (a stride apart, a figure's feet fit on one), with
 * the shadow along their front edge that everything on the ground has. Painted on the floor
 * canvas, under everything that stands.
 */
const STONES = [
  [
    '...#######....',
    '.##SSSLLLL##..',
    '#SSLLLLLLLLP#.',
    '#SLLLLLLLLLPP#',
    '#LLLLLLLLLPPP#',
    '#+PPPPPPPPPP+#',
    '.#++++++++++#.',
    '..##########..',
    '...ssssssss...',
  ],
  [
    '..######.....',
    '.#SSSLLL###..',
    '#SLLLLLLLLP#.',
    '#SLLLLLLLLPP#',
    '#LLLLLLLPPPP#',
    '#+PPPPPPPPP+#',
    '.##++++++++#.',
    '...#########.',
    '....ssssssss.',
  ],
  [
    '....######..',
    '..##SSSLLL#.',
    '.#SSLLLLLLP#',
    '#SLLLLLLLLP#',
    '#LLLLLLLPPP#',
    '#+PPPPPPPP+#',
    '#++++++++++#',
    '.##########.',
    '..ssssssss..',
  ],
  [
    '.########....',
    '#SSSLLLLL##..',
    '#SLLLLLLLLP##',
    '#LLLLLLLLPPP#',
    '#+LLLLLLPPPP#',
    '.#+PPPPPPPP+#',
    '..#++++++++#.',
    '...########..',
    '....ssssss...',
  ],
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

/**
 * D-216: a pantry's shelf, for a Closet beside a Kitchen: jars of marmalade, jam and honey on top,
 * and a bottle of oil, a tin and a box of cereal below, in the bookcases' woods. As tall as a
 * Closet's rail, so it stands wherever the rail does.
 */
const PANTRY = [
  '.kkkkkkkkkkkkkkkkkk.',
  'kWWWWWWWWWWWWWWWWWWk',
  'kwwwwwwwwwwwwwwwwwwk',
  'kbbbbbbbbbbbbbbbbbbk',
  'kWbOrrOOOyyOOOqqObwk',
  'kWbkrrkOkyykOkqqkbwk',
  'kWbkCCkOkCCkOkCCkbwk',
  'kWbktCkOkdCkOkyCkbwk',
  'kWbkttkOkddkOkyykbwk',
  'kWbkkkkOkkkkOkkkkbwk',
  'kWbwwwwwwwwwwwwwwbwk',
  'kWbbbbbbbbbbbbbbbbwk',
  'kWbOkkOOOOOOkkkkkbwk',
  'kWbOqkOkggkOkRRRkbwk',
  'kWbkqqkkHHkOkhhRkbwk',
  'kWbkQqkkrrkOkRhRkbwk',
  'kWbkqqkkrrkOkRRRkbwk',
  'kWbkQqkkHgkOkdRdkbwk',
  'kWbkkkkkkkkkkkkkkbwk',
  'kbbbbbbbbbbbbbbbbbbk',
  '.kkkkkkkkkkkkkkkkkk.',
  '.ssssssssssssssssss.',
] as const;

/** D-216: a sack of flour, tied at the neck, on a pantry's floor. */
const SACK = [
  '...kkk...',
  '..kXYXk..',
  '...kYk...',
  '..kXXXk..',
  '.kXXXXYk.',
  'kXXXXXXYk',
  'kXXXXXXYk',
  'kXXXXXYZk',
  '.kYYYYZk.',
  '..kkkkk..',
  '..sssss..',
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
  // The hens peck (D-185), each phase a drawing of its own: yard.ts picks one per hen.
  ...hens('own-hen-w', HEN, HEN_PECK),
  ...hens('own-hen-e', mirror(HEN), mirror(HEN_PECK)),
  ...hens('own-hen-brown-w', BROWN_HEN, BROWN_HEN_PECK),
  ...hens('own-hen-brown-e', mirror(BROWN_HEN), mirror(BROWN_HEN_PECK)),
  'own-sprinkler': { frames: SPRINKLER, ms: 180 },
  'own-fountain': { frames: FOUNTAIN, ms: FEEL.fountain.flowMs },
  'own-dog-bed': { frames: DOG_BED_BREATHING, ms: FEEL.dogBed.stepMs },
  'own-dog-on-lead': { frames: [DOG_ON_LEAD] },
  'own-dog-loose': { frames: DOG_LOOSE, ms: FEEL.dog.hopMs },
  'own-pantry': { frames: [PANTRY] },
  'own-sack': { frames: [SACK] },
  'own-rain-near': { frames: [RAIN_NEAR] },
  'own-rain-far': { frames: [RAIN_FAR] },
  'own-stone-0': { frames: [STONES[0]] },
  'own-stone-1': { frames: [STONES[1]] },
  'own-stone-2': { frames: [STONES[2]] },
  'own-stone-3': { frames: [STONES[3]] },
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

/** A hen's drawing (D-185): its look, pecking on beat `beat` (any whole number, by HEN_PHASES). */
export function henDrawing(look: HenLook, beat: number): DrawingId {
  return `own-hen-${look}-${PHASES[beat % HEN_PHASES]!}`;
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
