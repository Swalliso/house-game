// What stands in each room (D-097): LimeZu furniture laid out by slot rules per room type, for
// any footprint and rotation, from the house model alone. Pure: no DOM. Sprites never turn
// (they're drawn in 3/4 view, facing south): a rotated piece only changes its cells, and its
// layout is worked out again. Upright halls and portrait rooms get their own runner and rug cuts.
//
// The slots, ported from the audit prototype (render.py's slot rules) and the interiors picks:
// - N: against a north wall run, the widest run first, centered, then sliding toward its ends.
//   An N piece and the NL/NR pieces listed after it are planned as one group (a bed between its
//   nightstands), and the group drops members until it fits.
// - NL/NR: beside what already stands on that run. NW/NE: at a run's west or east end.
// - C: the free floor below what stands on the north wall. CL/CR: beside the last C piece.
// - R: a rug or a hall's runner, centered on the floor, under everything else.
// - S, SW, SE: against the south wall, in the middle or a corner.
// - G: the Garage's car, nose-in through its garage door.
//
// A piece against a north wall stands with its back on the floor's top edge, under the wall's
// face (BACK says how many of its rows rise above that edge). A tall piece rises over the wall
// band, but never past the band's top edge, and its rows above the band go on the overhang layer
// (Item.over). Pieces keep out of doorways and the walkways in front of them, off each other,
// inside the walls (tucking a pixel under a side wall at most), and, where they can, off north
// windows. A one-cell room's only piece (the toilet, the rail) may stand in a walkway and rise 8 px
// further (the prototype's tight rule), and so may the Garage's car stand in one; never in an
// opening. Anything that doesn't fit is skipped, and a room's key piece falls back to the middle
// of the floor when its doors leave no wall free.
//
// Fixtures: the Fireplace, Bunk Beds and the Kitchen Island are furniture here. The Skylight,
// Soundproofing, Blackout Curtains, the Chandelier and the Bay Window are painted with the room
// (house-paint.ts, the model's bay). RoomLayout.fixtureShown is false when a room's fixture
// can't be drawn, so its badge shows instead and a purchase is always visible.
//
// Rooms of one type differ by their rank among the house's rooms of that type (by uid: the
// order they were placed) and by their uid's hash, never by chance, so a house always looks the
// same and three Bedrooms don't look copy-pasted.

import type { FixtureId, PieceId } from '../../rules/index.ts';
import {
  EDGE,
  WALL,
  edge,
  hasFace,
  inset,
  overlaps,
  uidHash,
  type HouseModel,
  type Rect,
  type Room,
  type Side,
} from '../board/house-model.ts';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';

/** One sprite in a room. */
export interface Item {
  sprite: SpriteId;
  /** Its top-left on the lot, in art px. */
  x: number;
  y: number;
  /**
   * The line (lot art px) its top rises above, over the room's north wall: the rows above it
   * are drawn on the overhang layer, over the walls. Without one, all of it stays under them.
   */
  over?: number;
}

/** A room's furniture, back to front, and whether its fixture shows as art. */
export interface RoomLayout {
  items: readonly Item[];
  /** False when the room's fixture couldn't be drawn: its badge shows instead. */
  fixtureShown: boolean;
}

/**
 * Which rows of an item's sprite (from its top, [from, to)) go under the walls (`bottom`) and
 * on the overhang above them (`top`): the rows above its `over` line rise over the north wall.
 */
export function itemRows(item: Item): {
  top: [number, number] | null;
  bottom: [number, number] | null;
} {
  const { h } = spritePos(item.sprite);
  const cut = item.over === undefined ? 0 : Math.min(Math.max(item.over - item.y, 0), h);
  return { top: cut > 0 ? [0, cut] : null, bottom: cut < h ? [cut, h] : null };
}

const cache = new WeakMap<HouseModel, Map<number, RoomLayout>>();

/** Room `uid`'s layout. Cached per model, so once per house. */
export function roomLayout(m: HouseModel, uid: number): RoomLayout {
  let byUid = cache.get(m);
  if (!byUid) cache.set(m, (byUid = new Map()));
  let layout = byUid.get(uid);
  if (!layout) {
    layout = layOut(m, uid);
    byUid.set(uid, layout);
  }
  return layout;
}

/** The items in room `uid`, back to front. */
export function roomItems(m: HouseModel, uid: number): readonly Item[] {
  return roomLayout(m, uid).items;
}

// ---------------------------------------------------------------------------------------
// The sprites' shapes.

/**
 * How many of a piece's rows rise above the floor line at its back. It stands with that line on
 * the floor's top edge, under a north wall's face: WALL.face (the default) puts its top level
 * with the band's bottom, like the prototype's. Taller ones rise over the band. Keyed by sprite
 * family (the id without its variant number).
 */
const BACK: Readonly<Record<string, number>> = {
  'bunk-bed': 12,
  toilet: 14,
  fridge: 20,
  range: 9,
  'plant-potted': 20,
  'plant-tall': 18,
  bookcase: 22,
  'desk-pc': 18,
  globe: 12,
  'clothes-rail': 16,
  'coat-rack': 24,
  washer: 15,
  fireplace: 26,
  boxes: 12,
  'toy-box': 6,
  teddy: 6,
  armchair: 10,
  bench: 13,
};

function family(sprite: SpriteId): string {
  return sprite.replace(/-\d+$/, '');
}

function backOf(sprite: SpriteId): number {
  return BACK[family(sprite)] ?? WALL.face;
}

// ---------------------------------------------------------------------------------------
// A room's shape, as its furniture sees it.

/** A straight run of north wall along one row: furniture stands against its face. */
interface Run {
  /** Its extent inside the side walls, in lot art px. */
  x0: number;
  x1: number;
  /** The wall band's bottom edge over it: its face starts here. */
  yb: number;
  /** How high a piece may rise: the band's top edge. */
  top: number;
  /** The floor's bottom edge below the whole run. */
  rb: number;
  row: number;
}

interface Geo {
  m: HouseModel;
  room: Room;
  /** The floor inside the walls, over the room's box. */
  ix0: number;
  iy0: number;
  ix1: number;
  iy1: number;
  /** Where the floor starts below the north faces at the box's top row. */
  floorTop: number;
  runs: readonly Run[];
  /** The clear zones of the room's doorways and outside doors: the walkways through them. */
  blocked: readonly Rect[];
  /** Just the openings, a little into the room: a one-cell room's key piece may stand in a walkway, never in the door. */
  gaps: readonly Rect[];
  /** The room's north windows: pieces that rise over the band keep off them if they can. */
  windows: readonly Rect[];
  garage: { side: Side; rail: Rect } | null;
}

function inRoom(g: Geo, cx: number, cy: number): boolean {
  const { m } = g;
  return (
    cx >= 0 && cy >= 0 && cx < m.width && cy < m.height && m.room[cy * m.width + cx] === g.room.uid
  );
}

/** How high a piece may rise over cell (x, y)'s north wall: an outside band is all the room's; a band between rooms is half the neighbor's. */
function bandTop(m: HouseModel, x: number, y: number): number {
  return y * CELL - (edge(m, x, y, 'N') === EDGE.inner ? WALL.in / 2 : 0);
}

function analyze(m: HouseModel, room: Room): Geo {
  const { cells, box } = room;
  const bx0 = box.x / CELL;
  const by0 = box.y / CELL;
  const bx1 = bx0 + box.w / CELL;
  const by1 = by0 + box.h / CELL;
  // Each side's wall, over the cells on that edge of the box (an L's notch doesn't count).
  const side = (s: Side) => {
    let t = 0;
    for (const c of cells) {
      const onEdge =
        s === 'N'
          ? c.y === by0
          : s === 'S'
            ? c.y + 1 === by1
            : s === 'W'
              ? c.x === bx0
              : c.x + 1 === bx1;
      if (onEdge) t = Math.max(t, inset(m, c.x, c.y, s));
    }
    return t;
  };
  const faced = cells.some((c) => c.y === by0 && hasFace(m, c.x, c.y));
  const g: Geo = {
    m,
    room,
    ix0: bx0 * CELL + side('W'),
    iy0: by0 * CELL + side('N'),
    ix1: bx1 * CELL - side('E'),
    iy1: by1 * CELL - side('S'),
    floorTop: by0 * CELL + side('N') + (faced ? WALL.face : 0),
    runs: [],
    blocked: [],
    gaps: [],
    windows: [],
    garage: null,
  };

  // North wall runs: each row's cells with a face, in straight stretches.
  const runs: Run[] = [];
  const rows = new Map<number, number[]>();
  for (const c of cells) {
    if (!hasFace(m, c.x, c.y)) continue;
    const list = rows.get(c.y);
    if (list) list.push(c.x);
    else rows.set(c.y, [c.x]);
  }
  for (const [y, xs] of rows) {
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j++;
      const cols = xs.slice(i, j + 1);
      const first = cols[0]!;
      const last = cols[cols.length - 1]!;
      let bottom = y;
      while (cols.every((x) => inRoom(g, x, bottom + 1))) bottom++;
      runs.push({
        x0: first * CELL + inset(m, first, y, 'W'),
        x1: (last + 1) * CELL - inset(m, last, y, 'E'),
        yb: Math.max(...cols.map((x) => y * CELL + inset(m, x, y, 'N'))),
        top: Math.max(...cols.map((x) => bandTop(m, x, y))),
        rb: (bottom + 1) * CELL - Math.max(...cols.map((x) => inset(m, x, bottom, 'S'))),
        row: y,
      });
      i = j + 1;
    }
  }
  // The widest first, then the northmost, then the westmost.
  runs.sort((p, q) => q.x1 - q.x0 - (p.x1 - p.x0) || p.row - q.row || p.x0 - q.x0);
  g.runs = runs;
  const doors = m.doors.filter((d) => d.a === room.uid || d.b === room.uid);
  const exits = m.exits.filter((e) => e.uid === room.uid);
  g.blocked = [...doors.map((d) => d.clear), ...exits.map((e) => e.clear)];
  // The openings, two px wider along their wall: furniture may come up to one, not into it.
  g.gaps = [...doors.map((d) => d.gap), ...exits.map((e) => e.gap)].map((r) =>
    r.w > r.h
      ? { x: r.x - 2, y: r.y, w: r.w + 4, h: r.h }
      : { x: r.x, y: r.y - 2, w: r.w, h: r.h + 4 },
  );
  g.windows = m.windows.filter((w) => w.uid === room.uid && w.side === 'N').map((w) => w.rect);
  const gd = m.garageDoors.find((d) => d.uid === room.uid);
  if (gd) g.garage = { side: gd.side, rail: gd.rail };
  return g;
}

/**
 * Whether a footprint lies on the room's floor: every cell under it is the room's, and it stays
 * inside the walls, tucking at most `tol` px under a side wall. With `face`, it may stand on a
 * north wall's face (furniture backed against it).
 */
function onFloor(g: Geo, r: Rect, face: boolean, tol = 1): boolean {
  if (r.w <= 0 || r.h <= 0) return true;
  const { m } = g;
  for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.h - 1) / CELL); cy++) {
    for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.w - 1) / CELL); cx++) {
      if (!inRoom(g, cx, cy)) return false;
      const X0 = cx * CELL;
      const Y0 = cy * CELL;
      const w = inset(m, cx, cy, 'W');
      const e = inset(m, cx, cy, 'E');
      const n = inset(m, cx, cy, 'N') + (!face && hasFace(m, cx, cy) ? WALL.face : 0);
      const s = inset(m, cx, cy, 'S');
      if (w && r.x < X0 + w - tol) return false;
      if (e && r.x + r.w > X0 + CELL - e + tol) return false;
      if (n && r.y < Y0 + n) return false;
      if (s && r.y + r.h > Y0 + CELL - s) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------------------
// What each room type wants.

type Slot = 'N' | 'NL' | 'NR' | 'NW' | 'NE' | 'C' | 'CL' | 'CR' | 'R' | 'S' | 'SW' | 'SE' | 'G';

interface Want {
  /** Sprite choices, the first preferred (variants are already picked by the room). */
  sprites: readonly SpriteId[];
  slots: readonly Slot[];
  /** It is the room's fixture: the fixture shows only if its first sprite is placed (the others are stand-ins). */
  fixture?: boolean;
  /** A hall's runner, built from its ends and repeated middles. */
  runner?: boolean;
  /** How far it may tuck under the C piece it stands beside (dining chairs under the table). */
  tuck?: number;
  /** How far past the band's top it may rise (the prototype's tight rule for one-cell rooms). */
  lift?: number;
}

interface Ctx {
  /** This room's place among the house's rooms of its type, by uid. */
  rank: number;
  /** A stable per-room number for small choices (which corner, which side). */
  hash: number;
  fixture: FixtureId | undefined;
}

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

const BEDS: readonly SpriteId[] = ['bed-double-0', 'bed-double-1', 'bed-double-2', 'bed-double-3'];
const BUNKS: readonly SpriteId[] = ['bunk-bed-0', 'bunk-bed-1', 'bunk-bed-2'];
const NIGHTSTANDS: readonly SpriteId[] = ['nightstand-0', 'nightstand-1', 'nightstand-2'];
const ROUND_RUGS: readonly SpriteId[] = ['rug-round-0', 'rug-round-1'];
const TOILETS: readonly SpriteId[] = ['toilet-0', 'toilet-1', 'toilet-2'];
const SOFAS: readonly SpriteId[] = ['sofa-0', 'sofa-2', 'sofa-1', 'sofa-3'];
const WIDE_RUGS: readonly SpriteId[] = ['rug-wide-0', 'rug-wide-1'];
const TALL_RUGS: readonly SpriteId[] = ['rug-tall-1', 'rug-tall-0'];
const TABLES: readonly SpriteId[] = ['dining-table-0', 'dining-table-1', 'dining-table-2'];
const BOOKCASES: readonly SpriteId[] = ['bookcase-0', 'bookcase-1', 'bookcase-2'];
const ARMCHAIRS: readonly SpriteId[] = ['armchair-0', 'armchair-2', 'armchair-1', 'armchair-3'];
const MATS: readonly SpriteId[] = ['mat-square-0', 'mat-square-1', 'mat-square-2'];
const SHOES: readonly SpriteId[] = ['shoes-0', 'shoes-1', 'shoes-2'];
const TEDDIES: readonly SpriteId[] = ['teddy-0', 'teddy-1'];
const POTS: readonly SpriteId[] = ['pot-flowers-0', 'pot-flowers-1', 'pot-flowers-2'];

const want = (sprite: SpriteId, ...slots: Slot[]): Want => ({ sprites: [sprite], slots });

/** The Fireplace, when the room has one, in these slots. */
function fireplace(c: Ctx, ...slots: Slot[]): Want[] {
  return c.fixture === 'fireplace' ? [{ sprites: ['fireplace'], slots, fixture: true }] : [];
}

/** Two corners in an order this room keeps. */
function corners(c: Ctx, a: Slot, b: Slot): Slot[] {
  return (c.hash >> 3) % 2 ? [a, b] : [b, a];
}

export type RoomType = Extract<
  PieceId,
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'lKitchen'
  | 'diningRoom'
  | 'livingRoom'
  | 'closet'
  | 'hallway'
  | 'longHallway'
  | 'garage'
  | 'homeOffice'
  | 'playroom'
  | 'library'
  | 'mudroom'
  | 'sunroom'
>;

/** Each room type's furniture, most important first. */
const SPECS: Readonly<Record<RoomType, (c: Ctx) => Want[]>> = {
  bedroom: (c) => {
    const ns = pick(NIGHTSTANDS, c.rank + 1);
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // Bunk Beds replace the bed; where they don't fit, the bed stays and the badge shows.
      c.fixture === 'bunkBeds'
        ? { sprites: [pick(BUNKS, c.rank), pick(BEDS, c.rank)], slots: ['N', 'C'], fixture: true }
        : want(pick(BEDS, c.rank), 'N', 'C'),
      ...fireplace(c, far!),
      want(ns, near!),
      want(ns, far!),
      want(pick(ROUND_RUGS, c.rank), 'R'),
      want('plant-potted', ...corners(c, 'SW', 'SE')),
    ];
  },
  bathroom: (c) => [
    { sprites: [pick(TOILETS, c.rank)], slots: ['N'], lift: 8 },
    ...fireplace(c, 'NR', 'NL'),
    want('bath-mat', 'R'),
  ],
  kitchen: (c) => kitchen(c),
  lKitchen: (c) => kitchen(c),
  diningRoom: (c) => {
    const t = c.rank % TABLES.length;
    const chair = (s: 'CL' | 'CR'): Want => ({
      sprites: [`chair-${s === 'CL' ? 'east' : 'west'}-${t}` as SpriteId],
      slots: [s],
      tuck: 3,
    });
    return [
      want(TABLES[t]!, 'C'),
      chair('CL'),
      chair('CR'),
      chair('CL'),
      chair('CR'),
      ...fireplace(c, 'N'),
      want(pick(MATS, c.rank + 1), 'R'),
    ];
  },
  livingRoom: (c) => {
    const sofa = pick(SOFAS, c.rank);
    const rug: Want = { sprites: [pick(WIDE_RUGS, c.rank), pick(TALL_RUGS, c.rank)], slots: ['R'] };
    if (c.fixture === 'fireplace') {
      // The fireplace takes the wall, and the sofa faces the room in front of it.
      return [
        { sprites: ['fireplace'], slots: ['N'], fixture: true },
        want('plant-potted', 'NL'),
        want('plant-potted', 'NR'),
        want(sofa, 'C'),
        rug,
        want('coffee-table', 'C'),
      ];
    }
    return [
      want(sofa, 'N', 'C'),
      want('plant-potted', 'NL'),
      want('plant-potted', 'NR'),
      want('coffee-table', 'C'),
      rug,
      want('plant-potted', ...corners(c, 'SW', 'SE')),
    ];
  },
  closet: (c) => [
    { sprites: ['clothes-rail'], slots: ['N'], lift: 8 },
    ...fireplace(c, 'NR', 'NL'),
    want(pick(SHOES, c.rank), 'S', 'C'),
  ],
  hallway: (c) => hall(c),
  longHallway: (c) => hall(c),
  garage: (c) => [{ sprites: [], slots: ['G'] }, ...fireplace(c, 'N'), want('boxes', 'N')],
  homeOffice: (c) => [
    // The computer desk, or a low desk where the room is too shallow for it; in the middle of
    // the floor when its doors leave no wall free.
    { sprites: ['desk-pc', 'desk-study', 'globe'], slots: ['N', 'C'] },
    ...fireplace(c, 'NR', 'NL'),
    want(pick(BOOKCASES, c.rank), 'NR', 'NL', 'N'),
    want('plant-potted', ...corners(c, 'SE', 'SW')),
  ],
  playroom: (c) => [
    want('toy-box', 'N', 'C'),
    ...fireplace(c, 'NR', 'NL'),
    want(pick(TEDDIES, c.rank), ...corners(c, 'NR', 'NL')),
    { sprites: ['toy-train', pick(TEDDIES, c.rank + 1)], slots: ['C'] },
    want('rug-check', 'R'),
  ],
  library: (c) => {
    const books = pick(BOOKCASES, c.rank);
    const [near, far] = corners(c, 'NL', 'NR');
    return c.fixture === 'fireplace'
      ? [
          { sprites: ['fireplace'], slots: ['N'], fixture: true },
          want('globe', near!),
          want(books, 'N'),
          want(pick(ARMCHAIRS, c.rank + 2), 'C'),
          want(pick(MATS, c.rank), 'R'),
        ]
      : [
          want(books, 'N', 'C'),
          want('globe', near!, far!),
          want(pick(ARMCHAIRS, c.rank + 2), 'C'),
          want(pick(MATS, c.rank), 'R'),
        ];
  },
  mudroom: (c) => [
    { sprites: ['washer', 'bench'], slots: ['N', 'S', 'C'] },
    ...fireplace(c, 'NR', 'NL'),
    want('coat-rack', 'NR', 'NL', 'N'),
    want(pick(SHOES, c.rank), 'C', 'S'),
    want('bath-mat', 'R'),
  ],
  sunroom: (c) => [
    want('plant-tall', 'N', 'C'),
    ...fireplace(c, 'NR', 'NL'),
    want(pick(POTS, c.rank), 'NL'),
    want(pick(POTS, c.rank + 1), 'NR'),
    want(pick(ARMCHAIRS, c.rank), 'C'),
    want(pick(POTS, c.rank + 2), ...corners(c, 'SW', 'SE')),
  ],
};

/** A kitchen: the range, a counter (with the sink if it fits) and the fridge, along the north wall. */
function kitchen(c: Ctx): Want[] {
  // With an island, the run keeps short: the island needs the floor the fridge would stand on.
  if (c.fixture === 'kitchenIsland') {
    return [
      want('range', 'N'),
      { sprites: ['counter-sink', 'counter'], slots: ['NL'] },
      { sprites: ['kitchen-island'], slots: ['C'], fixture: true },
      want('counter', 'N'),
    ];
  }
  return [
    want('range', 'N'),
    { sprites: ['counter-sink', 'counter'], slots: ['NL'] },
    want('fridge', 'NL'),
    ...fireplace(c, 'N'),
    want('fridge', 'N'),
    want('counter', 'N'),
    // A breakfast table, where the floor is free for it.
    want('breakfast-table', 'C'),
  ];
}

/** A hall: its runner, a plant at one end and a coat rack where they fit. */
function hall(c: Ctx): Want[] {
  return [
    { sprites: [], slots: ['R'], runner: true },
    { sprites: ['plant-potted', 'plant-small'], slots: corners(c, 'NW', 'NE') },
    ...fireplace(c, 'N'),
    want('coat-rack', 'N'),
    want('plant-potted', 'S'),
  ];
}

// ---------------------------------------------------------------------------------------
// Laying a room out.

/**
 * How hard a placement tries: first off the room's north windows and out of doorways' walkways;
 * then over a window if it must; and last, for a one-cell room's key piece only, in a walkway too
 * (never in the opening itself).
 */
interface Pass {
  windows: boolean;
  walkways: boolean;
}
const PASSES: readonly Pass[] = [
  { windows: true, walkways: true },
  { windows: false, walkways: true },
  { windows: false, walkways: false },
];
function passes(w: Want): readonly Pass[] {
  return w.lift ? PASSES : PASSES.slice(0, 2);
}

interface Placed {
  item: Item;
  want: Want;
  /** Its footprint for collisions: the sprite below the band. Flat pieces have none. */
  rect: Rect | null;
  run: Run | null;
}

class Layout {
  readonly g: Geo;
  readonly placed: Placed[] = [];
  /** What stands on each run so far: [x0, x1). */
  readonly taken = new Map<Run, [number, number]>();
  lastRun: Run | null = null;
  lastC: Placed | null = null;
  constructor(g: Geo) {
    this.g = g;
  }

  /** Whether a footprint is clear of doorways and of other pieces (tucking `tuck` px under the last C piece). */
  free(r: Rect, tuck = 0, walkways = true): boolean {
    if ((walkways ? this.g.blocked : this.g.gaps).some((b) => overlaps(r, b))) return false;
    return this.placed.every((p) => {
      if (!p.rect) return true;
      const q = tuck && p === this.lastC ? shrinkX(p.rect, tuck) : p.rect;
      return !overlaps(r, q);
    });
  }

  add(want: Want, sprite: SpriteId, x: number, y: number, run: Run | null, flat = false): Placed {
    const { w, h } = spritePos(sprite);
    const item: Item = { sprite, x, y };
    if (run && y < run.yb) item.over = run.yb;
    const top = run ? Math.max(y, run.yb) : y;
    const p: Placed = { item, want, rect: flat ? null : { x, y: top, w, h: y + h - top }, run };
    this.placed.push(p);
    if (run) {
      const t = this.taken.get(run);
      this.taken.set(run, t ? [Math.min(t[0], x), Math.max(t[1], x + w)] : [x, x + w]);
      this.lastRun = run;
    }
    return p;
  }

  /** The top of `sprite` standing against run `r`, or null if it can't stand there. */
  wallY(r: Run, sprite: SpriteId, lift = 0): number | null {
    const { h } = spritePos(sprite);
    let y = Math.max(r.yb + WALL.face - backOf(sprite), r.top);
    if (y + h > r.rb) y = r.rb - h;
    return y < r.top - lift ? null : y;
  }

  /** Whether `sprite` fits at (x, y) against run `r`: on the floor, clear, and off its windows if the pass says so. */
  fitsWall(
    r: Run,
    sprite: SpriteId,
    x: number,
    y: number,
    pass: Pass,
    also: readonly Rect[] = [],
  ): boolean {
    const { w, h } = spritePos(sprite);
    if (x < r.x0 - 1 || x + w > r.x1 + 1) return false;
    const top = Math.max(y, r.yb);
    const foot = { x, y: top, w, h: y + h - top };
    if (!onFloor(this.g, foot, true) || !this.free(foot, 0, pass.walkways)) return false;
    if (also.some((a) => overlaps(foot, a))) return false;
    return (
      !pass.windows ||
      y >= r.yb ||
      !this.g.windows.some((win) => overlaps({ x, y, w, h: r.yb - y }, win))
    );
  }
}

function shrinkX(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y, w: Math.max(0, r.w - 2 * by), h: r.h };
}

/** Starts for a span `w` wide on [x0, x1] (a pixel's tuck either side), the middle first, then outward. */
function spots(x0: number, x1: number, w: number): number[] {
  const lo = x0 - 1;
  const hi = x1 + 1 - w;
  if (lo > hi) return [];
  const mid = Math.min(Math.max(Math.floor((x0 + x1 - w) / 2), lo), hi);
  const out = [mid];
  for (let d = 1; mid - d >= lo || mid + d <= hi; d++) {
    if (mid - d >= lo) out.push(mid - d);
    if (mid + d <= hi) out.push(mid + d);
  }
  return out;
}

/**
 * The ways to take some of the members (each absent, or one of its sprites): the room's fixture
 * first, then the most members, then preferred sprites, then list order.
 */
function choices(members: readonly Want[]): (SpriteId | null)[][] {
  let out: (SpriteId | null)[][] = [[]];
  for (const m of members) {
    out = out.flatMap((pre) => [...m.sprites.map((s) => [...pre, s]), [...pre, null]]);
  }
  const fixture = (c: (SpriteId | null)[]) => c.some((sp, i) => sp !== null && members[i]!.fixture);
  const score = (c: (SpriteId | null)[]) =>
    c.reduce((s, sp, i) => s + (sp === null ? 0 : members[i]!.sprites.indexOf(sp)), 0);
  const count = (c: (SpriteId | null)[]) => c.filter((s) => s !== null).length;
  return out
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        Number(fixture(b.c)) - Number(fixture(a.c)) ||
        count(b.c) - count(a.c) ||
        score(a.c) - score(b.c) ||
        a.i - b.i,
    )
    .map(({ c }) => c);
}

/** Plans an N piece with its NL/NR members on a run, dropping members until it fits. What it placed. */
function placeGroup(L: Layout, key: Want, members: readonly Want[]): Set<Want> {
  const done = new Set<Want>();
  const options = choices(members);
  // The key's own sprite first, then the most members, and only then the windows and walkways.
  for (const sprite of key.sprites) {
    for (const option of options) {
      for (const pass of passes(key)) {
        const chosen = members.map((m, i) => [m, option[i]] as const).filter(([, s]) => s !== null);
        const order = [
          ...chosen.filter(([m]) => m.slots[0] === 'NL').reverse(),
          [key, sprite] as const,
          ...chosen.filter(([m]) => m.slots[0] === 'NR'),
        ] as (readonly [Want, SpriteId])[];
        const total = order.reduce((s, [, sp]) => s + spritePos(sp).w, 0);
        for (const r of L.g.runs) {
          if (L.taken.has(r)) continue;
          for (const start of spots(r.x0, r.x1, total)) {
            let x = start;
            const trial: { want: Want; sprite: SpriteId; x: number; y: number }[] = [];
            const feet: Rect[] = [];
            for (const [w, sp] of order) {
              const y = L.wallY(r, sp, w.lift);
              if (y === null || !L.fitsWall(r, sp, x, y, pass, feet)) break;
              const { w: sw, h } = spritePos(sp);
              trial.push({ want: w, sprite: sp, x, y });
              feet.push({ x, y: Math.max(y, r.yb), w: sw, h: y + h - Math.max(y, r.yb) });
              x += sw;
            }
            if (trial.length < order.length) continue;
            for (const t of trial) {
              L.add(t.want, t.sprite, t.x, t.y, r);
              done.add(t.want);
            }
            return done;
          }
        }
      }
    }
  }
  return done;
}

/** Tries one slot for a want: true if it placed something. */
function placeSlot(L: Layout, w: Want, slot: Slot, c: Ctx): boolean {
  if (slot === 'G') return car(L, w, c);
  if (slot === 'R' && w.runner) return runner(L, w);
  const g = L.g;
  for (const pass of passes(w)) {
    for (const sprite of w.sprites) {
      const { w: sw, h } = spritePos(sprite);
      if (slot === 'N' || slot === 'NW' || slot === 'NE') {
        for (const r of g.runs) {
          const y = L.wallY(r, sprite, w.lift);
          if (y === null) continue;
          const t = L.taken.get(r);
          const xs =
            slot === 'NW'
              ? [r.x0, r.x0 - 1]
              : slot === 'NE'
                ? [r.x1 - sw, r.x1 - sw + 1]
                : t
                  ? [t[1], t[0] - sw, ...spots(r.x0, r.x1, sw)]
                  : spots(r.x0, r.x1, sw);
          for (const x of xs) {
            if (L.fitsWall(r, sprite, x, y, pass)) {
              L.add(w, sprite, x, y, r);
              return true;
            }
          }
        }
      } else if (slot === 'NL' || slot === 'NR') {
        const r = L.lastRun;
        const t = r && L.taken.get(r);
        if (!r || !t) continue;
        const y = L.wallY(r, sprite, w.lift);
        const x = slot === 'NL' ? t[0] - sw : t[1];
        if (y !== null && L.fitsWall(r, sprite, x, y, pass)) {
          L.add(w, sprite, x, y, r);
          return true;
        }
      } else if (slot === 'C') {
        if (placeC(L, w, sprite)) return true;
      } else if (slot === 'CL' || slot === 'CR') {
        const a = L.lastC;
        if (!a?.rect) continue;
        const tuck = w.tuck ?? 0;
        const x = slot === 'CL' ? a.rect.x - sw + tuck : a.rect.x + a.rect.w - tuck;
        // Down the side of a long table, two to a side: the upper seat, then the lower.
        const ys =
          a.rect.h >= 2 * h
            ? [a.rect.y, a.rect.y + a.rect.h - h]
            : [a.rect.y + Math.floor((a.rect.h - h) / 2)];
        for (const y of ys) {
          const r = { x, y, w: sw, h };
          if (onFloor(g, r, false) && L.free(r, tuck)) {
            L.add(w, sprite, x, y, null);
            return true;
          }
        }
      } else if (slot === 'S' || slot === 'SW' || slot === 'SE') {
        const y = g.iy1 - h;
        const xs =
          slot === 'S'
            ? spots(g.ix0, g.ix1, sw)
            : slot === 'SW'
              ? [g.ix0 + 1, g.ix0]
              : [g.ix1 - sw - 1, g.ix1 - sw];
        for (const x of xs) {
          const r = { x, y, w: sw, h };
          if (onFloor(g, r, false) && L.free(r)) {
            L.add(w, sprite, x, y, null);
            return true;
          }
        }
      } else if (slot === 'R') {
        const x = Math.floor((g.ix0 + g.ix1 - sw) / 2);
        const y = Math.floor((g.floorTop + g.iy1 - h) / 2);
        const r = { x, y, w: sw, h };
        // A rug may lie in a doorway's walkway, not in the opening.
        if (
          x > g.ix0 &&
          x + sw < g.ix1 &&
          y > g.floorTop &&
          y + h < g.iy1 &&
          onFloor(g, r, false, 0) &&
          !g.gaps.some((b) => overlaps(r, b))
        ) {
          L.add(w, sprite, x, y, null, true);
          return true;
        }
      }
    }
  }
  return false;
}

/** A C piece: just below what stands on the north wall over it, or in the middle of an empty floor. */
function placeC(L: Layout, w: Want, sprite: SpriteId): boolean {
  const g = L.g;
  const { w: sw, h } = spritePos(sprite);
  for (const x of spots(g.ix0, g.ix1, sw)) {
    const over = (p: Placed) => p.rect && p.item.x < x + sw + 2 && p.item.x + p.rect.w > x - 2;
    const above = L.placed.filter((p) => over(p) && (p.run || p === L.lastC));
    const below = Math.max(g.floorTop, ...above.map((p) => p.rect!.y + p.rect!.h));
    const want = above.length > 0 ? below + 3 : Math.floor((below + g.iy1 - h) / 2);
    // A few px up or down before sliding sideways: a table keeps its chairs.
    for (const d of [0, -1, 1, -2, 2, 3, -3, 4, 5, 6, 8]) {
      const y = want + d;
      const r = { x, y, w: sw, h };
      if (y > below && y + h <= g.iy1 && onFloor(g, r, false) && L.free(r)) {
        L.lastC = L.add(w, sprite, x, y, null);
        return true;
      }
    }
  }
  return false;
}

/** A hall's runner: its two ends and as many middles as it takes, along the room's long side. */
function runner(L: Layout, w: Want): boolean {
  const g = L.g;
  const across = g.ix1 - g.ix0 >= g.iy1 - g.floorTop;
  const [head, mid, tail]: SpriteId[] = across
    ? ['runner-h-0', 'runner-h-1', 'runner-h-2']
    : ['runner-v-0', 'runner-v-1', 'runner-v-2'];
  const len = (s: SpriteId) => (across ? spritePos(s).w : spritePos(s).h);
  const thick = across ? spritePos(head!).h : spritePos(head!).w;
  const a0 = (across ? g.ix0 : g.floorTop) + 3;
  const a1 = (across ? g.ix1 : g.iy1) - 3;
  // Across the hall it keeps a pixel off the walls, unless the hall is exactly as deep as it.
  const b0 = across ? g.floorTop : g.ix0;
  const b1 = across ? g.iy1 : g.ix1;
  if (a1 - a0 < len(head!) + len(tail!) || b1 - b0 < thick) return false;
  const b = Math.floor((b0 + b1 - thick) / 2);
  const box = across
    ? { x: a0, y: b, w: a1 - a0, h: thick }
    : { x: b, y: a0, w: thick, h: a1 - a0 };
  if (!onFloor(g, box, false, 0) || g.gaps.some((r) => overlaps(box, r))) return false;
  const at = (s: SpriteId, a: number) => L.add(w, s, across ? a : b, across ? b : a, null, true);
  at(head!, a0);
  for (let a = a0 + len(head!); a < a1 - len(tail!); a += len(mid!)) {
    at(mid!, Math.min(a, a1 - len(tail!) - len(mid!)));
  }
  at(tail!, a1 - len(tail!));
  return true;
}

/** The Garage's car, parked nose-in through its garage door. */
function car(L: Layout, w: Want, c: Ctx): boolean {
  const gd = L.g.garage;
  if (!gd) return false;
  const color = c.rank % 2;
  const sprite = (
    {
      S: `car-rear-${color}`,
      N: `car-front-${color}`,
      E: `car-left-${color}`,
      W: `car-right-${color}`,
    } as const
  )[gd.side] as SpriteId;
  const { w: sw, h } = spritePos(sprite);
  const { rail } = gd;
  const g = L.g;
  // Square to its door, kept inside the side walls (a one-cell door may sit against one).
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const x =
    gd.side === 'E'
      ? rail.x + rail.w - sw
      : gd.side === 'W'
        ? rail.x
        : clamp(Math.floor(rail.x + (rail.w - sw) / 2), g.ix0, g.ix1 - sw);
  // Through a one-cell door, the cell beside it has its wall: the car stops short of that too.
  const cols = [Math.floor(x / CELL), Math.floor((x + sw - 1) / CELL)];
  const wallOn = (side: 'N' | 'S', row: number) =>
    Math.max(
      ...cols.map((cx) =>
        edge(g.m, cx, row, side) === EDGE.garage ? 0 : inset(g.m, cx, row, side),
      ),
    );
  const y =
    gd.side === 'S'
      ? rail.y + rail.h - h - wallOn('S', Math.floor(rail.y / CELL))
      : gd.side === 'N'
        ? rail.y + wallOn('N', Math.floor(rail.y / CELL))
        : clamp(Math.floor(rail.y + (rail.h - h) / 2), g.floorTop, g.iy1 - h);
  const top = Math.max(y, g.iy0);
  // Inside the walls, but for its garage door's rail (a side view, 61 px, tucks 3 px under the
  // far wall). Like a one-cell room's key piece, it may stand in a doorway's walkway, never in
  // its opening.
  const tol = gd.side === 'E' || gd.side === 'W' ? 3 : 1;
  for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + h - 1) / CELL); cy++) {
    for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + sw - 1) / CELL); cx++) {
      if (!inRoom(g, cx, cy)) return false;
      const wall = (s: Side) => (edge(g.m, cx, cy, s) === EDGE.garage ? 0 : inset(g.m, cx, cy, s));
      const X0 = cx * CELL;
      const Y0 = cy * CELL;
      if (wall('W') && Math.max(x, X0) < X0 + wall('W') - tol) return false;
      if (wall('E') && Math.min(x + sw, X0 + CELL) > X0 + CELL - wall('E') + tol) return false;
      if (wall('N') && Math.max(y, Y0) < Y0 + wall('N')) return false;
      if (wall('S') && Math.min(y + h, Y0 + CELL) > Y0 + CELL - wall('S')) return false;
    }
  }
  if (!L.free({ x, y: top, w: sw, h: y + h - top }, 0, false)) return false;
  L.add(w, sprite, x, y, null).rect = { x, y: top, w: sw, h: y + h - top };
  return true;
}

function layOut(m: HouseModel, uid: number): RoomLayout {
  const room = m.rooms.get(uid);
  const spec = room && (SPECS as Partial<Record<PieceId, (c: Ctx) => Want[]>>)[room.defId];
  if (!room || !spec) return { items: [], fixtureShown: !room?.fixture };
  const same = [...m.rooms.values()]
    .filter((r) => r.defId === room.defId)
    .map((r) => r.uid)
    .sort((a, b) => a - b);
  const c: Ctx = { rank: same.indexOf(uid), hash: uidHash(uid, 7), fixture: room.fixture };
  const wants = spec(c);
  const L = new Layout(analyze(m, room));
  const done = new Set<Want>();
  for (let i = 0; i < wants.length; i++) {
    const w = wants[i]!;
    if (done.has(w)) continue;
    if (w.slots[0] === 'N' && w.sprites.length > 0) {
      const members: Want[] = [];
      for (let j = i + 1; j < wants.length; j++) {
        const s = wants[j]!.slots[0];
        if (s !== 'NL' && s !== 'NR') break;
        members.push(wants[j]!);
      }
      for (const got of placeGroup(L, w, members)) done.add(got);
      if (done.has(w)) continue;
    }
    for (const slot of w.slots[0] === 'N' && w.sprites.length > 0 ? w.slots.slice(1) : w.slots) {
      if (placeSlot(L, w, slot, c)) {
        done.add(w);
        break;
      }
    }
  }
  // Back to front: rugs and runners first, then by bottom edge, west to east.
  const items = L.placed
    .map((p) => ({ p, flat: !p.rect, bottom: p.item.y + spritePos(p.item.sprite).h }))
    .sort(
      (a, b) => Number(b.flat) - Number(a.flat) || a.bottom - b.bottom || a.p.item.x - b.p.item.x,
    )
    .map(({ p }) => p.item);
  const f = room.fixture;
  let fixtureShown = true;
  if (f) {
    const drawn = wants.filter((w) => w.fixture);
    fixtureShown =
      drawn.length > 0
        ? L.placed.some((p) => p.want.fixture && p.item.sprite === p.want.sprites[0])
        : paintedShown(m, room, f);
  }
  return { items, fixtureShown };
}

/** Whether the painters can draw a room's fixture: the Skylight and Chandelier always, the others where they have a wall. */
function paintedShown(m: HouseModel, room: Room, f: FixtureId): boolean {
  switch (f) {
    case 'skylight':
    case 'chandelier':
      return true;
    case 'soundproofing':
      return room.cells.some((c) => hasFace(m, c.x, c.y));
    case 'blackoutCurtains':
      return (
        room.cells.some((c) => hasFace(m, c.x, c.y)) || m.windows.some((w) => w.uid === room.uid)
      );
    case 'bayWindow':
      return m.windows.some((w) => w.uid === room.uid && w.bay);
    default:
      return false;
  }
}
