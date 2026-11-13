// What stands in each room (D-097): LimeZu furniture laid out by slot rules per room type, for
// any footprint and rotation, from the house model alone. Pure: no DOM. Sprites never turn
// (they're drawn in 3/4 view, facing south): a rotated piece only changes its cells, and its
// layout is worked out again. Upright halls and portrait rooms get their own runner and rug cuts.
//
// The slots, ported from the audit prototype (render.py's slot rules) and the interiors picks:
// - N: against a north wall run, the widest run first, centered, then sliding toward its ends.
//   An N piece and the NL/NR pieces listed after it are planned as one group (a bed between its
//   nightstands), and the group drops members until it fits: the room's fixture is kept first,
//   then its members in the order they're listed (an earlier one over any number of later ones).
// - NL/NR: beside what already stands on that run. NW/NE: at a run's west or east end.
// - C: the free floor below what stands on the north wall. CL/CR: beside the last C piece.
// - R: a rug or a hall's runner, centered on the floor, under everything else.
// - S, SW, SE: against the south wall, in the middle or a corner.
// - G: the Garage's car, nose-in through its garage door.
//
// A piece against a north wall stands with its back on the floor's top edge, under the wall's
// face (BACK says how many of its rows rise above that edge). A tall piece rises over its north
// wall's band, its rows above the face on the overhang layer (Item.over), but never past its
// room's own cells: over all of an outside band (it's inside the room), and over only the room's
// half of a band between two rooms, so the other half (the band's far edge and a row of its
// fill) always shows and the wall between them reads, however much of it the furniture stands
// against (D-097: rooms never merge). Pieces keep out of doorways and the walkways in front of
// them, off each other, inside the walls (tucking a pixel under a side wall at most), and, where
// they can, off north windows. A one-cell room's only piece (the toilet, the rail) may stand in a
// walkway and rise 8 px further over an outside wall (the prototype's tight rule), and so may the
// Garage's car stand in one, and a dining table that would otherwise lose its chairs; never in an
// opening. Anything that doesn't fit is skipped, and a room's key piece falls back to the middle
// of the floor when its doors leave no wall free.
//
// Fixtures: the Fireplace, Bunk Beds and the Kitchen Island (in three sizes) are furniture here,
// tried through all their slots before a stand-in (the bed Bunk Beds replace). The Skylight,
// Soundproofing, Blackout Curtains, the Chandelier and the Bay Window are painted with the room
// (house-paint.ts, the model's bay); the layout says where Blackout Curtains hang (in view, in
// front of the furniture). RoomLayout.fixtureShown is false when a room's fixture can't be drawn
// or wouldn't be seen, so its badge shows instead and a purchase is always visible.
//
// Rooms of one type differ in color (duvets, sofas, woods, rugs): each takes the color its uid's
// hash picks, or the next one if an older room of its type has it, so up to the palette's size
// they never look copy-pasted, and demolishing a room leaves the others as they were (unless it
// had bumped one). Small choices (which corner, which side) go by the hash too. Never by chance:
// a house always looks the same. A ghost (pieceModel with a look) takes the colors and choices its
// room will have once placed (newRoomLook), or has while the Moving Truck carries it (roomLook).
//
// The members' rooms (D-103) are furnished as their own (D-111): the twins' crib, two children's
// beds, Grandma's vanity and curio cabinet, Renfield's cot and candles, Nana's dogs' bed (our own
// drawing), Rowan's easel and Ivy's homework desk. They count as Bedrooms, so Bunk Beds take a
// bed's place in them (bedOr). Renfield's Room and Rowan's Studio are one cell across: their
// pieces are at most 22 px wide, to stand in a one-cell-wide room, and at most 26 px tall, to
// stand under the north wall of a one-cell-deep one, or come in a second shape for it (an upright
// cot or a side-on one, an easel without its finial).

import { CONTENT, type FixtureId, type HouseState, type PieceId } from '../../rules/index.ts';
import {
  EDGE,
  WALL,
  edge,
  faceSpans,
  hasFace,
  inset,
  overlaps,
  uidHash,
  type HouseModel,
  type PieceLook,
  type Rect,
  type Room,
  type Side,
} from '../board/house-model.ts';
import { CELL, type SpriteId } from '../sprites.ts';
import { artSize, type ArtId } from './drawings.ts';

/** One sprite in a room or a yard: an atlas sprite, or one of our drawings (drawings.ts). */
export interface Item {
  sprite: ArtId;
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
  /** Where Blackout Curtains hang on a north face, in view in front of the furniture (house-paint.ts). */
  drape?: Rect;
}

/**
 * Which rows of an item's sprite (from its top, [from, to)) go under the walls (`bottom`) and
 * on the overhang above them (`top`): the rows above its `over` line rise over the north wall.
 */
export function itemRows(item: Item): {
  top: [number, number] | null;
  bottom: [number, number] | null;
} {
  const { h } = artSize(item.sprite);
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
  washer: 12,
  'bookcase-narrow': 28,
  'desk-small': 8,
  fireplace: 26,
  boxes: 12,
  'toy-box': 6,
  teddy: 6,
  armchair: 10,
  bench: 13,
  // The members' rooms (D-111).
  vanity: 12,
  curio: 24,
  'lamp-floor': 20,
  stool: 5,
  'paint-pot': 5,
  // Hung on the north wall: all but a row of it over the face and the band.
  painting: 15,
  candles: 6,
  // It hangs from the band's top: its thread over the band and the face.
  spider: 19,
  'own-dog-bed': 4,
};

function family(sprite: ArtId): string {
  return sprite.replace(/-\d+$/, '');
}

function backOf(sprite: ArtId): number {
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
  /**
   * How high a piece may rise: the row's top line, so all of an outside band (inside the room)
   * and the room's own half of a band between two rooms.
   */
  top: number;
  /** Some of its band is a wall between two rooms: nothing rises past `top`, not even a tight piece. */
  shared: boolean;
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

/** A room's floor inside its walls, over its box, and where it starts below the north faces (Geo's). */
function floorIn(m: HouseModel, room: Room): Pick<Geo, 'ix0' | 'iy0' | 'ix1' | 'iy1' | 'floorTop'> {
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
  return {
    ix0: bx0 * CELL + side('W'),
    iy0: by0 * CELL + side('N'),
    ix1: bx1 * CELL - side('E'),
    iy1: by1 * CELL - side('S'),
    floorTop: by0 * CELL + side('N') + (faced ? WALL.face : 0),
  };
}

function analyze(m: HouseModel, room: Room): Geo {
  const { cells } = room;
  const g: Geo = {
    m,
    room,
    ...floorIn(m, room),
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
        top: y * CELL,
        shared: cols.some((x) => edge(m, x, y, 'N') === EDGE.inner),
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
  /**
   * Sprite choices, the first preferred (variants are already picked by the room): atlas sprites,
   * or our own drawings (the dogs' bed).
   */
  sprites: readonly ArtId[];
  slots: readonly Slot[];
  /** It is the room's fixture: the fixture shows when one of its sprites is placed. */
  fixture?: boolean;
  /**
   * What stands in for the fixture where none of its sprites fits in any of its slots (the bed
   * Bunk Beds replace): tried through every slot only after the fixture's own sprites.
   */
  standIn?: readonly ArtId[];
  /** A hall's runner, built from its ends and repeated middles. */
  runner?: boolean;
  /** How far it may tuck under the C piece it stands beside (dining chairs under the table). */
  tuck?: number;
  /** How far past the band's top it may rise (the prototype's tight rule for one-cell rooms). */
  lift?: number;
  /**
   * Room to keep free on each side of a C piece, for what stands beside it (a dining table's
   * chairs): where the floor's middle can't keep it, it stands against the north wall's face.
   */
  aisle?: number;
}

interface Ctx {
  /** This room's color: an index into its type's palettes (variants), as `palette` picks it. */
  rank: number;
  /** Which way this room's small choices go (which corner, which side), from its uid's hash. */
  flip: boolean;
  fixture: FixtureId | undefined;
  /** D-168: an extended room, bigger than its card: it takes a second group of furniture. */
  big: boolean;
}

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

const BEDS: readonly SpriteId[] = ['bed-double-0', 'bed-double-1', 'bed-double-2', 'bed-double-3'];
const BUNKS: readonly SpriteId[] = ['bunk-bed-0', 'bunk-bed-1', 'bunk-bed-2'];
const NIGHTSTANDS: readonly SpriteId[] = ['nightstand-0', 'nightstand-1', 'nightstand-2'];
const ROUND_RUGS: readonly SpriteId[] = ['rug-round-0', 'rug-round-1'];
const TOILETS: readonly SpriteId[] = ['toilet-0', 'toilet-1', 'toilet-2'];
// Slate, tan, grey, lavender: two greys never share a rug (rugOf), so no two rooms look alike.
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
// The members' rooms (D-111).
/** The twins' crib in grey and in honey wood, each with its changing table's wood. */
const CRIBS: readonly SpriteId[] = ['crib-twin-0', 'crib-twin-1'];
const DRESSERS: readonly SpriteId[] = ['dresser-0', 'dresser-1'];
/** The twins' two beds: blue and red, the striped pair, the pale pair. */
const KIDS_BEDS: readonly (readonly [SpriteId, SpriteId])[] = [
  ['bed-single-0', 'bed-single-1'],
  ['bed-single-2', 'bed-single-3'],
  ['bed-single-4', 'bed-single-5'],
];
const IVYS_BEDS: readonly SpriteId[] = ['bed-single-4', 'bed-single-2', 'bed-single-5'];
const SCHOOL_DESKS: readonly SpriteId[] = ['desk-school-0', 'desk-school-1'];
const VANITIES: readonly SpriteId[] = ['vanity-0', 'vanity-1'];
const CURIOS: readonly SpriteId[] = ['curio-0', 'curio-1'];
const EASELS: readonly SpriteId[] = ['easel-0', 'easel-1', 'easel-2'];
/** The same easels without their finials, 26 px tall (a one-cell-deep studio's most). */
const LOW_EASELS: readonly SpriteId[] = ['easel-low-0', 'easel-low-1', 'easel-low-2'];
/** Rowan's finished paintings, each the one on the easel of the same number. */
const PAINTINGS: readonly SpriteId[] = ['painting-0', 'painting-1', 'painting-2'];
const STOOLS: readonly SpriteId[] = ['stool-0', 'stool-1', 'stool-2'];
const PAINT: readonly SpriteId[] = ['paint-pot-0', 'paint-pot-1', 'paint-pot-2'];

const want = (sprite: ArtId, ...slots: Slot[]): Want => ({ sprites: [sprite], slots });

/**
 * A two-color list's pick for a room of a four-color type: 0, 1, 1, 0 for ranks 0 to 3, so
 * rooms whose main pieces are close in color (ranks 0 and 2) still differ in this one.
 */
function rugOf<T>(list: readonly T[], rank: number): T {
  return pick(list, rank + (rank >> 1));
}

/** The Fireplace, when the room has one, in these slots. */
function fireplace(c: Ctx, ...slots: Slot[]): Want[] {
  return c.fixture === 'fireplace' ? [{ sprites: ['fireplace'], slots, fixture: true }] : [];
}

/** Two corners in an order this room keeps. */
function corners(c: Ctx, a: Slot, b: Slot): Slot[] {
  return c.flip ? [a, b] : [b, a];
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
  | 'nursery'
  | 'kidsRoom'
  | 'grandmasRoom'
  | 'renfieldsRoom'
  | 'nanasRoom'
  | 'rowansStudio'
  | 'ivysRoom'
>;

/**
 * Each room type's furniture, most important first: an N piece's group keeps its earlier members
 * before its later ones, and the room's fixture before them all.
 */
const SPECS: Readonly<Record<RoomType, (c: Ctx) => Want[]>> = {
  bedroom: (c) => {
    const ns = pick(NIGHTSTANDS, c.rank + 1);
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // Bunk Beds replace the bed, against the north wall or in the middle of the floor; only
      // where they fit nowhere does the bed stay (and the badge show).
      c.fixture === 'bunkBeds'
        ? {
            sprites: [pick(BUNKS, c.rank)],
            standIn: [pick(BEDS, c.rank)],
            slots: ['N', 'C'],
            fixture: true,
          }
        : want(pick(BEDS, c.rank), 'N', 'C'),
      ...fireplace(c, far!),
      want(ns, near!),
      want(ns, far!),
      // D-168: a big bedroom's sitting corner (an armchair and a floor lamp) and its dresser.
      ...(c.big ? bigBedroom(c) : []),
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
      // In the middle of the floor with room for a chair each side, or against the north wall
      // where a door's walkway takes the middle.
      { sprites: [TABLES[t]!], slots: ['C'], aisle: 13 - 3 },
      chair('CL'),
      chair('CR'),
      chair('CL'),
      chair('CR'),
      ...fireplace(c, 'N'),
      want(pick(MATS, c.rank + 1), 'R'),
      // D-168: a big dining room's sideboard (a dresser), a cabinet, a tall plant and a lamp.
      ...(c.big
        ? [
            want(pick(DRESSERS, c.rank), 'N', 'NW', 'NE'),
            want(pick(CURIOS, c.rank), 'N', 'NE', 'NW'),
            want('plant-tall', ...corners(c, 'SW', 'SE'), 'C'),
            want('lamp-floor', ...corners(c, 'SE', 'SW')),
          ]
        : []),
    ];
  },
  livingRoom: (c) => {
    const sofa = pick(SOFAS, c.rank);
    const rug: Want = {
      sprites: [rugOf(WIDE_RUGS, c.rank), rugOf(TALL_RUGS, c.rank)],
      slots: ['R'],
    };
    if (c.fixture === 'fireplace') {
      // The fireplace takes the wall, the sofa beside it where the wall is long enough (a
      // landscape room), or facing the room in front of it.
      const [near, far] = corners(c, 'NL', 'NR');
      return [
        { sprites: ['fireplace'], slots: ['N'], fixture: true },
        want(sofa, near!, 'C'),
        want('plant-potted', near!),
        want('plant-potted', far!),
        rug,
        want('coffee-table', 'C'),
        ...(c.big ? bigLiving(c) : []),
      ];
    }
    return [
      want(sofa, 'N', 'C'),
      want('plant-potted', 'NL'),
      want('plant-potted', 'NR'),
      want('coffee-table', 'C'),
      rug,
      // D-168: a big living room's second group: another sofa, a bookcase, armchairs, a lamp.
      ...(c.big ? bigLiving(c) : []),
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
    // The computer desk, or a lower or narrower desk where the room is too shallow or narrow
    // for it; in the middle of the floor or against the south wall when its doors leave no
    // north wall free.
    { sprites: ['desk-pc', 'desk-study', 'desk-small', 'globe'], slots: ['N', 'C', 'S'] },
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
          // A bookcase and the fireplace beside it (a narrow bookcase where a full one won't fit
          // with it), so the room still reads as a library; where no bookcase fits beside the
          // fireplace, the bookcase stays and the fireplace shows as its badge.
          { sprites: [books, 'bookcase-narrow'], slots: ['N', 'C'] },
          { sprites: ['fireplace'], slots: [near!], fixture: true },
          want('globe', far!),
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
  sunroom: (c) =>
    c.fixture === 'fireplace'
      ? [
          // The fireplace takes the north wall, pots of flowers beside it, the tall plant where
          // it still fits.
          { sprites: ['fireplace'], slots: ['N'], fixture: true },
          want(pick(POTS, c.rank), 'NL'),
          want(pick(POTS, c.rank + 1), 'NR'),
          want('plant-tall', 'NL', 'NR', 'C', ...corners(c, 'SW', 'SE')),
          want(pick(ARMCHAIRS, c.rank), 'C'),
          want(pick(POTS, c.rank + 2), ...corners(c, 'SW', 'SE')),
        ]
      : [
          want('plant-tall', 'N', 'C'),
          want(pick(POTS, c.rank), 'NL'),
          want(pick(POTS, c.rank + 1), 'NR'),
          want(pick(ARMCHAIRS, c.rank), 'C'),
          want(pick(POTS, c.rank + 2), ...corners(c, 'SW', 'SE')),
        ],
  // The members' rooms (D-103), each furnished as its own (D-111).
  nursery: (c) => [
    // The twins' crib against the north wall, the changing table in a south corner (the crib
    // takes too much of the wall to stand beside it) and a teddy in the other.
    bedOr(c, pick(CRIBS, c.rank)),
    ...fireplace(c, 'NR', 'NL'),
    want(pick(DRESSERS, c.rank), ...corners(c, 'SW', 'SE')),
    want(pick(ROUND_RUGS, 0), 'R'),
    want(pick(TEDDIES, c.rank), ...corners(c, 'SE', 'SW'), 'C'),
  ],
  kidsRoom: (c) => {
    const [first, second] = pick(KIDS_BEDS, c.rank);
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // The twins' two beds side by side, or Bunk Beds in their place.
      bedOr(c, first),
      ...fireplace(c, far!),
      ...(c.fixture === 'bunkBeds' ? [] : [want(second, near!, 'C')]),
      want('toy-box', ...corners(c, 'SW', 'SE'), 'C'),
      want('rug-check', 'R'),
      want('toy-train', 'C', 'S'),
    ];
  },
  grandmasRoom: (c) => {
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // Her bed with her vanity beside it, or her curio cabinet where the vanity won't fit.
      bedOr(c, pick(BEDS, c.rank)),
      ...fireplace(c, far!),
      want(pick(VANITIES, c.rank), near!, 'N'),
      want(pick(CURIOS, c.rank), far!, 'N'),
      want(pick(ARMCHAIRS, c.rank + 1), 'C', ...corners(c, 'SW', 'SE')),
      want(pick(MATS, c.rank), 'R'),
      want('lamp-floor', ...corners(c, 'SE', 'SW')),
    ];
  },
  renfieldsRoom: (c) => [
    // His cot: upright where the room is one cell wide, side on where it is one cell deep. In
    // the dark middle of the house, where he belongs, there's room for a spider in a corner too.
    bedOr(c, 'cot', 'cot-side'),
    ...fireplace(c, 'NR', 'NL'),
    want('candles', ...corners(c, 'NL', 'NR'), 'N', 'C', ...corners(c, 'SW', 'SE')),
    want('spider', ...corners(c, 'NE', 'NW'), 'C'),
  ],
  nanasRoom: (c) => {
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // Her bed with the dogs' bed beside it (she wants the dogs close), and a nightstand where
      // the dogs' bed stands elsewhere.
      bedOr(c, pick(BEDS, c.rank + 2)),
      ...fireplace(c, far!),
      want('own-dog-bed', near!, 'C', ...corners(c, 'SE', 'SW')),
      want(pick(NIGHTSTANDS, c.rank), far!),
      want(pick(ARMCHAIRS, c.rank + 2), ...corners(c, 'SW', 'SE'), 'C'),
      want(pick(ROUND_RUGS, 1), 'R'),
    ];
  },
  rowansStudio: (c) => [
    // The easel, or the lower one where the studio is one cell deep, with a stool and a pot of
    // paint beside it; where a door's walkway leaves the floor too short for an easel, its
    // painting hangs on the north wall instead. A finished one hangs there too where there's room.
    {
      sprites: [pick(EASELS, c.rank), pick(LOW_EASELS, c.rank), pick(PAINTINGS, c.rank)],
      slots: ['N', 'C', 'S'],
    },
    ...fireplace(c, 'NR', 'NL'),
    want(pick(STOOLS, c.rank), ...corners(c, 'NL', 'NR'), 'C', 'S'),
    want(pick(PAINT, c.rank), ...corners(c, 'NR', 'NL'), ...corners(c, 'SW', 'SE'), 'C'),
    want(pick(PAINTINGS, c.rank + 1), ...corners(c, 'NW', 'NE'), 'N'),
  ],
  ivysRoom: (c) => {
    const [near, far] = corners(c, 'NL', 'NR');
    return [
      // Her bed and her homework desk beside it, and her globe where it still fits.
      bedOr(c, pick(IVYS_BEDS, c.rank)),
      ...fireplace(c, far!),
      want(pick(SCHOOL_DESKS, c.rank), near!, 'C', ...corners(c, 'SW', 'SE')),
      want('globe', far!, ...corners(c, 'SE', 'SW'), 'C'),
      want(pick(MATS, c.rank + 1), 'R'),
    ];
  },
};

/**
 * A member's room's bed (the first of `beds` that fits), or Bunk Beds in its place, as in a
 * Bedroom: a member's room counts as a Bedroom, so Bunk Beds fit it.
 */
function bedOr(c: Ctx, ...beds: ArtId[]): Want {
  return c.fixture === 'bunkBeds'
    ? { sprites: [pick(BUNKS, c.rank)], standIn: beds, slots: ['N', 'C'], fixture: true }
    : { sprites: beds, slots: ['N', 'C'] };
}

/**
 * A kitchen: the range and a counter with the sink along the north wall (a plain counter where
 * the sink won't fit), then the fridge where it still fits. Where its doors leave no north wall,
 * the range and its counter stand in the middle of the floor. A Fireplace takes the counter's
 * place beside the range; a Kitchen Island stands in the middle (a smaller one in an L-Kitchen's
 * arm, or beside a door's walkway).
 */
function kitchen(c: Ctx): Want[] {
  const island = c.fixture === 'kitchenIsland';
  return [
    want('range', 'N', 'C'),
    ...fireplace(c, 'NL', 'NR'),
    { sprites: ['counter-sink', 'counter'], slots: ['NL', 'NR', 'CR', 'CL'] },
    ...(island
      ? [
          {
            sprites: ['kitchen-island', 'kitchen-island-24', 'kitchen-island-16'],
            slots: ['C'],
            fixture: true,
          } satisfies Want,
        ]
      : []),
    // Not one of the range's group (its counter with the sink comes first): on another north
    // wall, or beside the range's run where it still fits.
    want('fridge', 'N', 'NL', 'NR'),
    want('counter', 'N'),
    // A breakfast table, where the floor is free for it. D-168: a big kitchen seats a family at
    // a dining table with a chair each side, or keeps the breakfast table where that won't fit.
    ...(island ? [] : c.big ? familyTable(c) : [want('breakfast-table', 'C')]),
    // D-168: and its run of counters goes on.
    ...(c.big
      ? [
          want('counter', 'N', 'NW', 'NE'),
          want('counter', 'N', 'NW', 'NE'),
          want('plant-tall', ...corners(c, 'SW', 'SE')),
        ]
      : []),
  ];
}

/** D-168: a big kitchen's table: a dining table and two chairs, else the breakfast table. */
function familyTable(c: Ctx): Want[] {
  const t = c.rank % TABLES.length;
  return [
    { sprites: [TABLES[t]!, 'breakfast-table'], slots: ['C'], aisle: 13 - 3 },
    { sprites: [`chair-east-${t}` as SpriteId], slots: ['CL'], tuck: 3 },
    { sprites: [`chair-west-${t}` as SpriteId], slots: ['CR'], tuck: 3 },
  ];
}

/** D-168: a big bedroom's dresser and sitting corner. */
function bigBedroom(c: Ctx): Want[] {
  return [
    want(pick(DRESSERS, c.rank + 1), 'N', 'NE', 'NW'),
    want(pick(ARMCHAIRS, c.rank + 1), ...corners(c, 'SE', 'SW'), 'C'),
    want('lamp-floor', ...corners(c, 'SW', 'SE'), 'NE', 'NW'),
    want(pick(MATS, c.rank + 2), 'C'),
  ];
}

/** D-168: a big living room's second group. */
function bigLiving(c: Ctx): Want[] {
  return [
    want(pick(BOOKCASES, c.rank), 'N', 'NE', 'NW'),
    want(pick(SOFAS, c.rank + 1), 'C', 'S'),
    want(pick(ARMCHAIRS, c.rank + 2), ...corners(c, 'SW', 'SE'), 'C'),
    want('lamp-floor', ...corners(c, 'SE', 'SW'), 'NE', 'NW'),
    want('plant-tall', 'NW', 'NE'),
  ];
}

/** A hall: its runner, a plant at one end and a coat rack where they fit. */
function hall(c: Ctx): Want[] {
  return [
    { sprites: [], slots: ['R'], runner: true },
    // In a corner, or in the middle of the wall where doors take the corners.
    { sprites: ['plant-potted', 'plant-small'], slots: [...corners(c, 'NW', 'NE'), 'N'] },
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

  add(want: Want, sprite: ArtId, x: number, y: number, run: Run | null, flat = false): Placed {
    const { w, h } = artSize(sprite);
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

  /**
   * The top of `sprite` standing against run `r`, or null if it can't stand there. A tight
   * piece's `lift` lets it rise past the band over an outside wall, never into another room.
   */
  wallY(r: Run, sprite: ArtId, lift = 0): number | null {
    const { h } = artSize(sprite);
    let y = Math.max(r.yb + WALL.face - backOf(sprite), r.top);
    if (y + h > r.rb) y = r.rb - h;
    return y < r.top - (r.shared ? 0 : lift) ? null : y;
  }

  /** Whether `sprite` fits at (x, y) against run `r`: on the floor, clear, and off its windows if the pass says so. */
  fitsWall(
    r: Run,
    sprite: ArtId,
    x: number,
    y: number,
    pass: Pass,
    also: readonly Rect[] = [],
  ): boolean {
    const { w, h } = artSize(sprite);
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
 * first, then the members in the order the room lists them (an earlier one is worth more than
 * any later ones: a Living Room's sofa beside its fireplace before two plants), then preferred
 * sprites, then list order.
 */
function choices(members: readonly Want[]): (ArtId | null)[][] {
  let out: (ArtId | null)[][] = [[]];
  for (const m of members) {
    out = out.flatMap((pre) => [...m.sprites.map((s) => [...pre, s]), [...pre, null]]);
  }
  const fixture = (c: (ArtId | null)[]) => c.some((sp, i) => sp !== null && members[i]!.fixture);
  const score = (c: (ArtId | null)[]) =>
    c.reduce((s, sp, i) => s + (sp === null ? 0 : members[i]!.sprites.indexOf(sp)), 0);
  /** Which members it takes, the first member the most significant. */
  const taken = (c: (ArtId | null)[]) => c.reduce((s, sp) => s * 2 + (sp === null ? 0 : 1), 0);
  return out
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        Number(fixture(b.c)) - Number(fixture(a.c)) ||
        taken(b.c) - taken(a.c) ||
        score(a.c) - score(b.c) ||
        a.i - b.i,
    )
    .map(({ c }) => c);
}

/** Plans an N piece with its NL/NR members on a run, dropping members until it fits. What it placed. */
function placeGroup(L: Layout, key: Want, members: readonly Want[]): Set<Want> {
  const done = new Set<Want>();
  const options = choices(members);
  const fixture = (o: (ArtId | null)[]) => o.some((sp, i) => sp !== null && members[i]!.fixture);
  // The room's fixture first, whichever of the key's sprites it takes (a Library's narrow
  // bookcase beside its Fireplace before its full one without); then the key's own sprite first,
  // then the members in order, and only then the windows and walkways.
  const tries = [true, false].flatMap((withFixture) =>
    key.sprites.flatMap((sprite) =>
      options.filter((o) => fixture(o) === withFixture).map((option) => ({ sprite, option })),
    ),
  );
  for (const { sprite, option } of tries) {
    for (const pass of passes(key)) {
      const chosen = members.map((m, i) => [m, option[i]] as const).filter(([, s]) => s !== null);
      const order = [
        ...chosen.filter(([m]) => m.slots[0] === 'NL').reverse(),
        [key, sprite] as const,
        ...chosen.filter(([m]) => m.slots[0] === 'NR'),
      ] as (readonly [Want, ArtId])[];
      const total = order.reduce((s, [, sp]) => s + artSize(sp).w, 0);
      for (const r of L.g.runs) {
        if (L.taken.has(r)) continue;
        for (const start of spots(r.x0, r.x1, total)) {
          let x = start;
          const trial: { want: Want; sprite: ArtId; x: number; y: number }[] = [];
          const feet: Rect[] = [];
          for (const [w, sp] of order) {
            const y = L.wallY(r, sp, w.lift);
            if (y === null || !L.fitsWall(r, sp, x, y, pass, feet)) break;
            const { w: sw, h } = artSize(sp);
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
  return done;
}

/** Tries one slot for a want: true if it placed something. */
function placeSlot(L: Layout, w: Want, slot: Slot, c: Ctx): boolean {
  if (slot === 'G') return car(L, w, c);
  if (slot === 'R' && w.runner) return runner(L, w);
  const g = L.g;
  for (const pass of passes(w)) {
    for (const sprite of w.sprites) {
      const { w: sw, h } = artSize(sprite);
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
        // A chair (it tucks) sits only at a table: never beside a range in the middle (D-168).
        if (w.tuck && !a.item.sprite.startsWith('dining-table')) continue;
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
          // Against a wall: not where a hall opens into the next (D-159), the walkway on.
          const walled = [Math.floor(x / CELL), Math.floor((x + sw - 1) / CELL)].every(
            (cx) => edge(g.m, cx, Math.floor((y + h - 1) / CELL), 'S') !== EDGE.none,
          );
          if (walled && onFloor(g, r, false) && L.free(r)) {
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

/**
 * A C piece: just below what stands on the north wall over it, or in the middle of an empty floor.
 * One that keeps an aisle each side (a dining table, for its chairs) tries that first: in the
 * middle, then against the north wall's face, then in the middle over a door's walkway (never in
 * the opening: the walkway gives way to the table, and the chairs keep out of it); and only then
 * anywhere.
 */
function placeC(L: Layout, w: Want, sprite: ArtId): boolean {
  const g = L.g;
  const { w: sw, h } = artSize(sprite);
  const aisled = (x: number) =>
    !w.aisle || (x - w.aisle >= g.ix0 - 1 && x + sw + w.aisle <= g.ix1 + 1);
  const put = (x: number, y: number) => {
    L.lastC = L.add(w, sprite, x, y, null);
    return true;
  };
  const middle = (aisle: boolean, walkways: boolean) => {
    for (const x of spots(g.ix0, g.ix1, sw)) {
      if (aisle && !aisled(x)) continue;
      const over = (p: Placed) => p.rect && p.item.x < x + sw + 2 && p.item.x + p.rect.w > x - 2;
      const above = L.placed.filter((p) => over(p) && (p.run || p === L.lastC));
      const below = Math.max(g.floorTop, ...above.map((p) => p.rect!.y + p.rect!.h));
      const want = above.length > 0 ? below + 3 : Math.floor((below + g.iy1 - h) / 2);
      // Clear of the floor's top edge; a few px below what stands above it, or right up against
      // it where the floor is too short for a gap (a Library's armchair before its bookcase).
      const top = above.length > 0 ? below : below + 1;
      // A few px up or down before sliding sideways: a table keeps its chairs.
      for (const d of [0, -1, 1, -2, 2, 3, -3, 4, 5, 6, 8]) {
        const y = want + d;
        const r = { x, y, w: sw, h };
        if (y >= top && y + h <= g.iy1 && onFloor(g, r, false) && L.free(r, 0, walkways)) {
          return put(x, y);
        }
      }
    }
    return false;
  };
  if (w.aisle) {
    if (middle(true, true)) return true;
    // Against the north wall's face, its back on the face as a north wall piece stands.
    const y = g.floorTop - WALL.face;
    for (const x of spots(g.ix0, g.ix1, sw)) {
      const r = { x, y, w: sw, h };
      if (aisled(x) && y + h <= g.iy1 && onFloor(g, r, true) && L.free(r)) return put(x, y);
    }
    if (middle(true, false)) return true;
  }
  return middle(false, true);
}

/**
 * A hall's runner: its two ends and as many middles as it takes, along the room's long side.
 * Where the hall runs straight on into another (D-159), its runner runs on to the joint in
 * middles, in the band the whole straight run of halls shares, so their runners read as one;
 * where another hall meets it from the side or round a corner, each runner ends cleanly short of
 * the other. Middles always start on an even px and ends on an odd one, so the runner's checks
 * stay in step across a joint.
 */
function runner(L: Layout, w: Want): boolean {
  const g = L.g;
  const across = g.ix1 - g.ix0 >= g.iy1 - g.floorTop;
  const [head, mid, tail]: SpriteId[] = across
    ? ['runner-h-0', 'runner-h-1', 'runner-h-2']
    : ['runner-v-0', 'runner-v-1', 'runner-v-2'];
  const len = (s: SpriteId) => (across ? artSize(s).w : artSize(s).h);
  const thick = across ? artSize(head!).h : artSize(head!).w;
  const run = hallRun(g.m, g.room, across);
  // An end that runs on starts at the joint, in a middle; one that doesn't keeps off its wall.
  const first = run.lo ? mid! : head!;
  const last = run.hi ? mid! : tail!;
  const a0 = run.lo ? (across ? g.ix0 : g.floorTop) : (across ? g.ix0 : g.floorTop) + 3;
  const a1 = run.hi ? (across ? g.ix1 : g.iy1) : (across ? g.ix1 : g.iy1) - 3;
  // Across the hall it keeps a pixel off the walls, unless the hall is exactly as deep as it.
  const { b0, b1 } = run;
  if (a1 - a0 < len(first) + len(last) || b1 - b0 < thick) return false;
  const b = Math.floor((b0 + b1 - thick) / 2);
  const box = across
    ? { x: a0, y: b, w: a1 - a0, h: thick }
    : { x: b, y: a0, w: thick, h: a1 - a0 };
  if (!onFloor(g, box, false, 0) || g.gaps.some((r) => overlaps(box, r))) return false;
  const at = (s: SpriteId, a: number) => L.add(w, s, across ? a : b, across ? b : a, null, true);
  at(first, a0);
  for (let a = a0 + len(first); a < a1 - len(last); a += len(mid!)) {
    at(mid!, Math.min(a, a1 - len(last) - len(mid!)));
  }
  at(last, a1 - len(last));
  return true;
}

/**
 * Where a hall's runner goes (D-159): whether each end of it (`lo`, the west or north one; `hi`)
 * runs straight on into another hall, open to it with the runner the same way, and the band
 * across it (b0 to b1) that the whole straight run of halls shares: the floor inside all of
 * their walls, so their runners line up whatever walls each has.
 */
function hallRun(
  m: HouseModel,
  room: Room,
  across: boolean,
): { lo: boolean; hi: boolean; b0: number; b1: number } {
  /** The hall its `hi` (or lo) end runs on into, or null. */
  const next = (r: Room, hi: boolean): Room | null => {
    const { x, y, w, h } = r.box;
    // Its end cell, and the cell past it.
    const ex = across ? (hi ? (x + w) / CELL - 1 : x / CELL) : x / CELL;
    const ey = across ? y / CELL : hi ? (y + h) / CELL - 1 : y / CELL;
    const side: Side = across ? (hi ? 'E' : 'W') : hi ? 'S' : 'N';
    const cx = ex + (side === 'E' ? 1 : side === 'W' ? -1 : 0);
    const cy = ey + (side === 'S' ? 1 : side === 'N' ? -1 : 0);
    if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height) return null;
    const n = m.room[cy * m.width + cx]!;
    if (!n || n === r.uid || edge(m, ex, ey, side) !== EDGE.none) return null;
    const o = m.rooms.get(n)!;
    // A hall lying the same way, in the same row or column.
    const same = across ? o.box.w > o.box.h && o.box.y === y : o.box.h > o.box.w && o.box.x === x;
    return CONTENT.pieces[o.defId].connector && same ? o : null;
  };
  let b0 = -Infinity;
  let b1 = Infinity;
  const take = (r: Room) => {
    const f = floorIn(m, r);
    b0 = Math.max(b0, across ? f.floorTop : f.ix0);
    b1 = Math.min(b1, across ? f.iy1 : f.ix1);
  };
  take(room);
  for (const hi of [false, true]) {
    for (let r = next(room, hi); r && r.uid !== room.uid; r = next(r, hi)) take(r);
  }
  return { lo: next(room, false) !== null, hi: next(room, true) !== null, b0, b1 };
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
  const { w: sw, h } = artSize(sprite);
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

/**
 * Room type `id`'s entry in a table by room type, or else its countsAs root's: a type without one
 * of its own takes its root's layout, colors, floor or wallpaper (Grandma's and Nana's Rooms take
 * the Bedroom's four bed colors).
 */
export function byType<T>(
  table: Readonly<Partial<Record<PieceId, T>>>,
  id: PieceId,
): T | undefined {
  const root = CONTENT.pieces[id].countsAs;
  return table[id] ?? (root === undefined ? undefined : table[root]);
}

/**
 * How many colors each room type's main piece comes in (its beds, sofas, tables...). A type
 * without an entry takes its countsAs root's (byType), or else comes in one.
 */
const COLORS: Readonly<Partial<Record<PieceId, number>>> = {
  bedroom: BEDS.length,
  bathroom: TOILETS.length,
  diningRoom: TABLES.length,
  livingRoom: SOFAS.length,
  closet: SHOES.length,
  garage: 2,
  homeOffice: BOOKCASES.length,
  playroom: TEDDIES.length,
  library: BOOKCASES.length,
  mudroom: SHOES.length,
  sunroom: ARMCHAIRS.length,
  // The members' rooms (D-111). Grandma's and Nana's take the Bedroom's four beds (byType).
  nursery: CRIBS.length,
  kidsRoom: KIDS_BEDS.length,
  renfieldsRoom: 1,
  rowansStudio: EASELS.length,
  ivysRoom: IVYS_BEDS.length,
};

/**
 * A room's color: the one its uid's hash picks, or the next one free of the older rooms of its
 * type (in uid order, so in placement order). Distinct up to the palette's size, and stable: an
 * older room's color never depends on a newer one.
 */
function palette(m: HouseModel, room: Room): number {
  const same = [...m.rooms.values()].filter((r) => r.defId === room.defId).map((r) => r.uid);
  return paletteOf(room.defId, same, room.uid);
}

/** Room `uid`'s color among the rooms of its type, `uids` (its own included). */
function paletteOf(defId: PieceId, uids: readonly number[], uid: number): number {
  const n = byType(COLORS, defId) ?? 1;
  const taken = new Set<number>();
  for (const u of [...uids].sort((a, b) => a - b)) {
    const start = uidHash(u, 11) % n;
    let c = start;
    for (let k = 0; k < n; k++) {
      c = (start + k) % n;
      if (!taken.has(c)) break;
    }
    if (taken.size >= n) c = start;
    if (u === uid) return c;
    taken.add(c);
  }
  return 0;
}

/** Which way a room's small choices go: a bit of its uid's hash. */
const flipOf = (uid: number) => ((uidHash(uid, 7) >>> 3) & 1) === 1;

/** How placed room `uid` looks (its color, its choices, its fixture): its ghost's while the Moving Truck carries it. */
export function roomLook(house: HouseState, uid: number): PieceLook {
  const piece = house.pieces.find((p) => p.uid === uid);
  if (!piece) return { color: 0 };
  const same = house.pieces.filter((p) => p.defId === piece.defId).map((p) => p.uid);
  return {
    color: paletteOf(piece.defId, same, uid),
    flip: flipOf(uid),
    ...(piece.fixture ? { fixture: piece.fixture.id } : {}),
  };
}

/** How a new room of type `defId` will look once it's placed (its uid is the house's next): its ghost's. */
export function newRoomLook(house: HouseState, defId: PieceId): PieceLook {
  const uid = house.nextUid;
  const same = house.pieces.filter((p) => p.defId === defId).map((p) => p.uid);
  return { color: paletteOf(defId, [...same, uid], uid), flip: flipOf(uid) };
}

/** D-168: how many tiles a room's own card has; an extended room has more. */
function cardTiles(defId: PieceId): number {
  return CONTENT.pieces[defId].shape.reduce((n, row) => n + row.split('#').length - 1, 0);
}

function layOut(m: HouseModel, uid: number): RoomLayout {
  const room = m.rooms.get(uid);
  // A type without a layout of its own is furnished as its countsAs root (byType).
  const spec = room && byType(SPECS, room.defId);
  if (!room || !spec) return { items: [], fixtureShown: !room?.fixture };
  // A piece alone (a ghost) looks as it will once placed; a placed room by the house.
  const look = m.look;
  const c: Ctx = {
    rank: look ? look.color : palette(m, room),
    flip: look?.flip ?? flipOf(uid),
    fixture: room.fixture,
    big: room.cells.length > cardTiles(room.defId),
  };
  const wants = spec(c);
  const L = new Layout(analyze(m, room));
  const done = new Set<Want>();
  /** Places want `w` (the i-th) through its slots: an N piece with its group first. */
  const place = (w: Want, i: number): boolean => {
    if (w.slots[0] === 'N' && w.sprites.length > 0) {
      const members: Want[] = [];
      for (let j = i + 1; j < wants.length; j++) {
        const s = wants[j]!.slots[0];
        if (s !== 'NL' && s !== 'NR') break;
        members.push(wants[j]!);
      }
      for (const got of placeGroup(L, w, members)) done.add(got);
      if (done.has(w)) return true;
    }
    for (const slot of w.slots[0] === 'N' && w.sprites.length > 0 ? w.slots.slice(1) : w.slots) {
      if (placeSlot(L, w, slot, c)) {
        done.add(w);
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < wants.length; i++) {
    const w = wants[i]!;
    if (done.has(w)) continue;
    // A fixture's own sprites through all of its slots, and only then what stands in for it.
    if (!place(w, i) && w.standIn) {
      const { standIn, ...rest } = w;
      place({ ...rest, sprites: standIn, fixture: false }, i);
    }
  }
  // Back to front: rugs and runners first, then by bottom edge, west to east.
  const items = L.placed
    .map((p) => ({ p, flat: !p.rect, bottom: p.item.y + artSize(p.item.sprite).h }))
    .sort(
      (a, b) => Number(b.flat) - Number(a.flat) || a.bottom - b.bottom || a.p.item.x - b.p.item.x,
    )
    .map(({ p }) => p.item);
  const f = room.fixture;
  const drape = f === 'blackoutCurtains' ? drapeSpot(m, room, L.placed) : null;
  let fixtureShown = true;
  if (f) {
    const drawn = wants.filter((w) => w.fixture);
    fixtureShown =
      drawn.length > 0 ? L.placed.some((p) => p.want.fixture) : paintedShown(m, room, f, drape);
  }
  return { items, fixtureShown, ...(drape ? { drape } : {}) };
}

/**
 * Whether the painters' drawing of a room's fixture is in view: the Skylight, the Chandelier and
 * Soundproofing (its pads on the room's wall bands, over the furniture) always; Blackout Curtains
 * where they darken a window or hang in view on a north face; a Bay Window where it has a wall.
 */
function paintedShown(m: HouseModel, room: Room, f: FixtureId, drape: Rect | null): boolean {
  switch (f) {
    case 'skylight':
    case 'chandelier':
    case 'soundproofing':
      return true;
    case 'blackoutCurtains':
      return drape !== null || m.windows.some((w) => w.uid === room.uid);
    case 'bayWindow':
      return m.windows.some((w) => w.uid === room.uid && w.bay);
    default:
      return false;
  }
}

/**
 * Where Blackout Curtains hang: across the middle of the widest stretch of north face the
 * furniture leaves in view, or null when none is wide enough to read as drapes.
 */
function drapeSpot(m: HouseModel, room: Room, placed: readonly Placed[]): Rect | null {
  let best: { x0: number; x1: number; top: number } | null = null;
  for (const f of faceSpans(m, room)) {
    // The x ranges of the pieces standing in front of this face (rugs lie below it).
    const covers = placed
      .filter((p) => p.rect)
      .map((p) => ({ x: p.item.x, y: p.item.y, ...artSize(p.item.sprite) }))
      .filter((r) => r.y < f.top + WALL.face && r.y + r.h > f.top)
      .sort((p, q) => p.x - q.x);
    let at = f.x0;
    const free = (x0: number, x1: number) => {
      const better =
        !best ||
        x1 - x0 > best.x1 - best.x0 ||
        (x1 - x0 === best.x1 - best.x0 &&
          (f.top < best.top || (f.top === best.top && x0 < best.x0)));
      if (x1 > x0 && better) best = { x0, x1, top: f.top };
    };
    for (const r of covers) {
      if (r.x > at) free(at, Math.min(r.x, f.x1));
      at = Math.max(at, r.x + r.w);
    }
    if (at < f.x1) free(at, f.x1);
  }
  if (!best) return null;
  const { x0, x1, top } = best;
  const w = Math.min(x1 - x0 - 4, 30);
  if (w < DRAPE_MIN) return null;
  return { x: Math.floor((x0 + x1 - w) / 2), y: top, w, h: WALL.face };
}

/** The narrowest drapes that read as curtains, in px. */
const DRAPE_MIN = 10;
