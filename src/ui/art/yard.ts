// The yard pieces as the board draws them (D-097), built from the placed pieces by fixed rules and
// the pieces' uid hashes, never by chance, so the same yard always looks the same. Pure: no DOM.
// Cached per house model, like the rooms' layouts.
//
// - Ground, painted on the floor canvas under everything that stands (house-paint.ts): a Lawn's
//   mown stripes, a Patio's pavers, a Driveway's concrete and its curb cut through the sidewalk
//   where it meets the street, a Pool's and a Hot Tub's water inside their coping, and the soil,
//   straw or hearth under a Sapling, a Henhouse's run or a Fire Pit. A flat piece has a darker 1 px
//   edge, softer where it meets another piece of its kind (two Lawns, a Driveway and a Long
//   Driveway): touching pieces read as one patch, and each stays countable (D-093's note).
// - Items, the DOM sprites that wobble with their piece (like a room's furniture): a Patio's
//   parasol, chairs and table (under the Pergola when it has one), the house's one parked car on
//   its oldest Driveway, a Fence's pickets and posts, a Pool's ladder and float, the Hot Tub's
//   bubbles, the Fire Pit's fire and stumps, planters, the Sapling, the outbuildings, the hens.
//   Fixtures: the Sprinkler on its Lawn, the Pergola over its Patio, Garden Lights as two
//   bollards with their glow. All three always fit, so their badges never show.
// - Parts of items above their piece's own cells (the Greenhouse's roof, the Treehouse, a
//   Birdhouse's box, a car's roof) carry `over`, and go on the overhang layer above the walls.
//
// A Fence is drawn from its own cells only: a picket line through the middle of its cells, out to
// the edges at its ends, with a post at each end and turn. Two Fences that touch meet post to
// post, so each stays countable, and a Fence's ghost looks just like the Fence it places.

import {
  CONTENT,
  type Cell,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { isIndoor, occupancy } from '../board/geometry.ts';
import { overlaps, uidHash, type HouseModel, type Rect } from '../board/house-model.ts';
import { CELL, type SpriteId } from '../sprites.ts';
import { artSize } from './drawings.ts';
import type { Item } from './rooms.ts';

export type Rgb = readonly [number, number, number];

/** Something painted on the floor canvas, in lot art px. */
export type Ground =
  /** An atlas sprite, or the part of it in `src`. */
  | { op: 'sprite'; sprite: SpriteId; x: number; y: number; src?: Rect }
  /** A rectangle of color over what's there: edges, seams, soil. */
  | { op: 'rect'; rect: Rect; rgb: Rgb; alpha: number }
  /** An oval of color over what's there, in three steps of strength toward its middle (pixel light, not a ramp). */
  | { op: 'oval'; cx: number; cy: number; rx: number; ry: number; rgb: Rgb; alpha: number };

export interface YardLayout {
  uid: number;
  defId: PieceId;
  cells: readonly Cell[];
  /** Its cells' bounding box, in lot art px. */
  box: Rect;
  ground: readonly Ground[];
  /** Back to front. */
  items: readonly Item[];
  /** False when the piece's fixture couldn't be drawn (its badge shows instead). */
  fixtureShown: boolean;
}

export interface YardModel {
  /** The yard pieces (not indoor ones), by uid. */
  pieces: ReadonlyMap<number, YardLayout>;
  /** Ground no one piece owns: the curb cuts in the street row. */
  curbs: readonly Ground[];
  /** The cells the yard's ground covers (its pieces and curb cuts), or null. */
  bounds: Rect | null;
}

// ---------------------------------------------------------------------------------------
// The palette of the yard's own marks (edges, soil, glow), sampled from LimeZu's ground.

const EDGE = {
  lawn: { rgb: [0x24, 0x34, 0x24] as Rgb, alpha: 0.43, seam: 0.16 },
  pavers: { rgb: [0x28, 0x24, 0x28] as Rgb, alpha: 0.55, seam: 0.22 },
  concrete: { rgb: [0x28, 0x24, 0x28] as Rgb, alpha: 0.45, seam: 0.28 },
} as const;
/** Bare soil (a Sapling's ring, a Fire Pit's hearth), and the straw of a Henhouse's run. */
const SOIL: Rgb = [0x7b, 0x5b, 0x3a];
const HEARTH: Rgb = [0x4a, 0x3a, 0x36];
const STRAW: Rgb = [0xd8, 0xb8, 0x6a];
/** The wet patch around the Sprinkler. */
const WET: Rgb = [0x1e, 0x5a, 0x40];
/** Garden Lights' warm light on the ground. */
const LAMPLIGHT: Rgb = [0xff, 0xe2, 0x96];
/** A shadow on the ground (LimeZu's ink). */
const SHADE: Rgb = [0x3a, 0x3a, 0x50];

// ---------------------------------------------------------------------------------------
// The cache.

const cache = new WeakMap<HouseModel, YardModel>();

/**
 * The yard of the house `m` was built from (houseModel): every yard piece's ground and items, and
 * the curb cuts. Cached per model, so it's built once per placement, not per render.
 */
export function yardModel(house: HouseState, m: HouseModel): YardModel {
  let y = cache.get(m);
  if (!y) {
    y = build(house, m, { street: true, car: true });
    cache.set(m, y);
  }
  return y;
}

const solo = new Map<string, YardLayout>();

/** How a ghost should look: the color its piece has or will have, and the fixture it carries. */
export interface Look {
  color: number;
  fixture?: FixtureId;
}

/**
 * One yard piece alone, for the ghost: in its own frame (its bounding box's top-left cell is
 * (0, 0)), in the color and with the fixture `look` gives it (pieceLook, newPieceLook), with no
 * curb cut and no parked car (a car only parks on the house's oldest Driveway).
 */
export function yardPieceLayout(defId: PieceId, rot: Rot, look: Look = { color: 0 }): YardLayout {
  const key = `${defId}:${rot}:${look.color}:${look.fixture ?? ''}`;
  let l = solo.get(key);
  if (!l) {
    const shape = CONTENT.pieces[defId].shape;
    const w = rot % 2 === 0 ? shape[0]!.length : shape.length;
    const h = rot % 2 === 0 ? shape.length : shape[0]!.length;
    const house: HouseState = {
      lot: {
        width: w,
        height: h,
        terrain: new Array(w * h).fill(null),
        sunnySide: 'top',
        sunnyRows: 0,
        attempt: 0,
      },
      pieces: [
        {
          uid: 1,
          defId,
          x: 0,
          y: 0,
          rot,
          placedWeek: 0,
          ...(look.fixture ? { fixture: { id: look.fixture, week: 0 } } : {}),
        },
      ],
      nextUid: 2,
    };
    l = build(house, null, { street: false, car: false, color: look.color }).pieces.get(1)!;
    solo.set(key, l);
  }
  return l;
}

// ---------------------------------------------------------------------------------------
// Building.

/** A piece's family for seams: a Driveway and a Long Driveway are one kind, as are the Fences. */
function kind(id: PieceId): PieceId {
  return CONTENT.pieces[id].countsAs ?? id;
}

const isDriveway = (id: PieceId) => kind(id) === 'driveway';

function build(
  house: HouseState,
  m: HouseModel | null,
  opts: { street: boolean; car: boolean; color?: number },
): YardModel {
  const occ = occupancy(house);
  const { width: W, height: H } = house.lot;
  const pieceAt = (x: number, y: number): PlacedPiece | undefined => {
    if (x < 0 || y < 0 || x >= W || y >= H) return undefined;
    const uid = occ.uids[y * W + x]!;
    return uid ? occ.byUid.get(uid) : undefined;
  };
  // What yard items keep off: a Bay Window's bay, which juts out of the wall (the walls canvas).
  const keepOut = m ? m.windows.flatMap((w) => (w.bay ? [w.bay] : [])) : [];
  const car = opts.car ? parkedCar(house) : 0;
  const color = colors(house);

  const pieces = new Map<number, YardLayout>();
  const curbs: Ground[] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const extend = (c: Cell) => {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + 1);
    y1 = Math.max(y1, c.y + 1);
  };
  for (const p of house.pieces) {
    if (isIndoor(p.defId)) continue;
    const cells = occ.cells.get(p.uid)!;
    const own = new Set(cells.map((c) => `${c.x},${c.y}`));
    // Which end of a piece running across touches the house: east (true), west (false), or neither.
    const indoor = (x: number, yy: number) => {
      const q = pieceAt(x, yy);
      return !!q && isIndoor(q.defId);
    };
    const xs = cells.map((c) => c.x);
    const east = cells.some((c) => c.x === Math.max(...xs) && indoor(c.x + 1, c.y));
    const west = cells.some((c) => c.x === Math.min(...xs) && indoor(c.x - 1, c.y));
    const y = new Yard(p, cells, {
      own: (x, yy) => own.has(`${x},${yy}`),
      kin: (x, yy) => {
        const q = pieceAt(x, yy);
        return !!q && q.uid !== p.uid && kind(q.defId) === kind(p.defId);
      },
      keepOut,
      car: p.uid === car,
      color: opts.color ?? color.get(p.uid) ?? 0,
      ...(east !== west ? { toward: east } : {}),
    });
    LAYOUTS[p.defId]?.(y);
    if (p.fixture?.id === 'gardenLights') y.lights();
    pieces.set(p.uid, y.done());
    for (const c of cells) extend(c);
    // A curb cut: the Driveway's concrete through the sidewalk where it meets the street.
    if (opts.street && isDriveway(p.defId)) {
      for (const c of cells) {
        if (c.y !== H - 1) continue;
        const cut = { x: c.x, y: H };
        curbs.push({ op: 'sprite', sprite: 'yard-concrete', x: cut.x * CELL, y: cut.y * CELL });
        const edge = EDGE.concrete;
        for (const dx of [-1, 1] as const) {
          const q = pieceAt(c.x + dx, c.y);
          if (q && isDriveway(q.defId)) continue;
          curbs.push({
            op: 'rect',
            rect: {
              x: (cut.x + (dx > 0 ? 1 : 0)) * CELL - (dx > 0 ? 1 : 0),
              y: H * CELL,
              w: 1,
              h: CELL,
            },
            rgb: edge.rgb,
            alpha: edge.alpha,
          });
        }
        extend(cut);
      }
    }
  }
  return {
    pieces,
    curbs,
    bounds: x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
  };
}

/** How many colors a yard piece's main prop comes in (parasols, planters, coops, birdhouses). */
const COLORS: Readonly<Partial<Record<PieceId, number>>> = {
  patio: 3,
  flowerBed: 4,
  henhouse: 3,
  birdhouse: 4,
};

/**
 * Each yard piece's color: the one its uid's hash picks, or the next one free of the older pieces
 * of its type (in uid order), so neighbors of a type differ, up to the palette's size, and an older
 * piece's color never depends on a newer one (rooms.ts does the same for furniture).
 */
function colors(house: HouseState): Map<number, number> {
  const out = new Map<number, number>();
  const taken = new Map<PieceId, Set<number>>();
  for (const p of [...house.pieces].sort((a, b) => a.uid - b.uid)) {
    const n = COLORS[p.defId];
    if (!n) continue;
    let used = taken.get(p.defId);
    if (!used) taken.set(p.defId, (used = new Set()));
    const start = uidHash(p.uid, 29) % n;
    let c = start;
    for (let k = 0; k < n && used.has(c); k++) c = (start + k + 1) % n;
    if (used.size >= n) c = start;
    used.add(c);
    out.set(p.uid, c);
  }
  return out;
}

/** A placed yard piece's look, for its ghost while the Moving Truck carries it. */
export function pieceLook(house: HouseState, uid: number): Look {
  const p = house.pieces.find((q) => q.uid === uid);
  return {
    color: colors(house).get(uid) ?? 0,
    ...(p?.fixture ? { fixture: p.fixture.id } : {}),
  };
}

/** The look a new yard piece of type `defId` will have once it's placed (its uid is the house's next). */
export function newPieceLook(house: HouseState, defId: PieceId): Look {
  const uid = house.nextUid;
  const next: HouseState = {
    ...house,
    pieces: [...house.pieces, { uid, defId, x: 0, y: 0, rot: 0, placedWeek: 0 }],
  };
  return { color: colors(next).get(uid) ?? 0 };
}

/** The Driveway the house's one parked car stands on: the oldest (a car always fits one). */
function parkedCar(house: HouseState): number {
  const ways = house.pieces.filter((p) => isDriveway(p.defId)).sort((a, b) => a.uid - b.uid);
  return ways[0]?.uid ?? 0;
}

interface YardCtx {
  own: (x: number, y: number) => boolean;
  /** Another piece of the same kind on that cell. */
  kin: (x: number, y: number) => boolean;
  keepOut: readonly Rect[];
  /** This Driveway gets the house's parked car. */
  car: boolean;
  /** Its color, an index into its type's palette (colors()). */
  color: number;
  /** For a piece running across: the house is at its east end (true) or its west end (false). */
  toward?: boolean;
}

/** One yard piece being laid out. */
class Yard {
  readonly p: PlacedPiece;
  readonly cells: readonly Cell[];
  readonly box: Rect;
  readonly hash: number;
  readonly ctx: YardCtx;
  readonly ground: Ground[] = [];
  readonly items: Item[] = [];
  fixtureShown: boolean;

  constructor(p: PlacedPiece, cells: readonly Cell[], ctx: YardCtx) {
    this.p = p;
    this.cells = cells;
    this.ctx = ctx;
    this.hash = uidHash(p.uid, 23);
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const bx = Math.min(...xs);
    const by = Math.min(...ys);
    this.box = {
      x: bx * CELL,
      y: by * CELL,
      w: (Math.max(...xs) + 1 - bx) * CELL,
      h: (Math.max(...ys) + 1 - by) * CELL,
    };
    // Garden Lights fit any yard piece (lights()); the others are drawn by their piece's layout.
    this.fixtureShown = !p.fixture || p.fixture.id === 'gardenLights';
  }

  get fixture(): FixtureId | undefined {
    return this.p.fixture?.id;
  }

  /** Whether this piece runs across (wider than tall). */
  get across(): boolean {
    return this.box.w >= this.box.h;
  }

  /** Places a sprite with its top-left at (x, y), unless it would stand on a keep-out. */
  put(sprite: Item['sprite'], x: number, y: number): boolean {
    const { w, h } = artSize(sprite);
    const foot = { x, y: y + Math.max(0, h - 8), w, h: Math.min(h, 8) };
    if (this.ctx.keepOut.some((k) => overlaps(foot, k))) return false;
    this.items.push({ sprite, x, y });
    return true;
  }

  /** Each of its cells with a ground sprite. */
  tiles(sprite: SpriteId): void {
    for (const c of this.cells) {
      this.ground.push({ op: 'sprite', sprite, x: c.x * CELL, y: c.y * CELL });
    }
  }

  /**
   * A 1 px edge just inside its outline, softer (a seam) where another piece of its kind is on
   * the other side. The lines don't overlap at the corners, so no pixel darkens twice.
   */
  edge(e: { rgb: Rgb; alpha: number; seam: number }): void {
    const { own, kin } = this.ctx;
    for (const c of this.cells) {
      const X = c.x * CELL;
      const Y = c.y * CELL;
      const line = (rect: Rect, nx: number, ny: number) => {
        if (own(nx, ny)) return;
        this.ground.push({ op: 'rect', rect, rgb: e.rgb, alpha: kin(nx, ny) ? e.seam : e.alpha });
      };
      const n = !own(c.x, c.y - 1);
      const s = !own(c.x, c.y + 1);
      line({ x: X, y: Y, w: CELL, h: 1 }, c.x, c.y - 1);
      line({ x: X, y: Y + CELL - 1, w: CELL, h: 1 }, c.x, c.y + 1);
      const top = n ? 1 : 0;
      const len = CELL - top - (s ? 1 : 0);
      line({ x: X, y: Y + top, w: 1, h: len }, c.x - 1, c.y);
      line({ x: X + CELL - 1, y: Y + top, w: 1, h: len }, c.x + 1, c.y);
    }
  }

  oval(cx: number, cy: number, rx: number, ry: number, rgb: Rgb, alpha: number): void {
    this.ground.push({ op: 'oval', cx, cy, rx, ry, rgb, alpha });
  }

  /** Garden Lights: a bollard at each front corner (one on a one-cell piece), each in its own light. */
  lights(): void {
    const bottom = Math.max(...this.cells.map((c) => c.y));
    const row = this.cells.filter((c) => c.y === bottom).sort((a, b) => a.x - b.x);
    const spots =
      this.cells.length === 1
        ? [{ x: row[0]!.x * CELL + CELL - 10, y: bottom * CELL + CELL - 23 }]
        : [
            { x: row[0]!.x * CELL + 2, y: bottom * CELL + CELL - 23 },
            { x: row[row.length - 1]!.x * CELL + CELL - 10, y: bottom * CELL + CELL - 23 },
          ];
    let placed = 0;
    for (const s of spots) {
      if (!this.put('bollard', s.x, s.y)) continue;
      this.oval(s.x + 4, s.y + 20, 11, 6, LAMPLIGHT, 0.34);
      placed++;
    }
    this.fixtureShown = placed > 0;
  }

  done(): YardLayout {
    const top = new Map<number, number>();
    for (const c of this.cells) top.set(c.x, Math.min(top.get(c.x) ?? Infinity, c.y * CELL));
    const items = this.items.map((it) => {
      // The rows above its piece's own cells in its columns rise over them (the overhang layer).
      const { w } = artSize(it.sprite);
      let over = Infinity;
      for (let cx = Math.floor(it.x / CELL); cx <= Math.floor((it.x + w - 1) / CELL); cx++) {
        over = Math.min(over, top.get(cx) ?? Infinity);
      }
      if (over === Infinity) over = this.box.y;
      return it.y < over ? { ...it, over } : it;
    });
    // Back to front: by bottom edge, then west to east.
    items.sort((a, b) => a.y + artSize(a.sprite).h - (b.y + artSize(b.sprite).h) || a.x - b.x);
    return {
      uid: this.p.uid,
      defId: this.p.defId,
      cells: this.cells,
      box: this.box,
      ground: this.ground,
      items,
      fixtureShown: this.fixtureShown,
    };
  }
}

// ---------------------------------------------------------------------------------------
// Each yard piece.

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;

/** The pool set's tiles (yard-pool, a 3 × 3 sheet of 16 px tiles): corners, edges, the middle. */
function poolTiles(y: Yard): void {
  const { box } = y;
  const cols = box.w / 16;
  const rows = box.h / 16;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const tx = i === 0 ? 0 : i === cols - 1 ? 2 : 1;
      const ty = j === 0 ? 0 : j === rows - 1 ? 2 : 1;
      y.ground.push({
        op: 'sprite',
        sprite: 'yard-pool',
        x: box.x + i * 16,
        y: box.y + j * 16,
        src: { x: tx * 16, y: ty * 16, w: 16, h: 16 },
      });
    }
  }
}

const PARASOLS: readonly SpriteId[] = ['parasol-0', 'parasol-1', 'parasol-2'];
const PLANTERS: readonly SpriteId[] = ['planter-0', 'planter-1', 'planter-2', 'planter-3'];
const COOPS: readonly SpriteId[] = ['coop-0', 'coop-1', 'coop-2'];
const BIRDHOUSES: readonly SpriteId[] = [
  'birdhouse-0',
  'birdhouse-1',
  'birdhouse-2',
  'birdhouse-3',
];

/** A seat on each side of a little table, facing it. */
function seats(y: Yard, x: number, base: number): void {
  const color = (y.hash >>> 4) % 2;
  y.put(color ? 'patio-chair-e-1' : 'patio-chair-e-0', x - 15, base - 19);
  y.put(color ? 'patio-chair-w-1' : 'patio-chair-w-0', x + 14, base - 19);
  y.put('patio-table', x, base - 16);
}

const LAYOUTS: Partial<Record<PieceId, (y: Yard) => void>> = {
  lawn: (y) => {
    y.tiles('yard-lawn');
    y.edge(EDGE.lawn);
    if (y.fixture === 'sprinkler') {
      const cx = y.box.x + y.box.w / 2;
      const cy = y.box.y + y.box.h / 2;
      y.oval(cx, cy + 2, 22, 16, WET, 0.22);
      y.fixtureShown = y.put('own-sprinkler', cx - 13, cy - 8);
    }
  },

  patio: (y) => {
    y.tiles('yard-pavers');
    y.edge(EDGE.pavers);
    const { x, y: top, w, h } = y.box;
    // The table in the middle, near the front; its seats either side.
    const tx = x + w / 2 - 6;
    const base = top + h - 3;
    if (y.fixture === 'pergola') {
      seats(y, tx, base - 6);
      y.fixtureShown = y.put('pergola', x, top + h - 61);
    } else {
      // The parasol's stand behind the table, its canopy over the seats.
      y.put(pick(PARASOLS, y.ctx.color), x + Math.floor((w - 47) / 2), base - 61 - 4);
      seats(y, tx, base);
    }
  },

  driveway: (y) => driveway(y),
  longDriveway: (y) => driveway(y),

  fence: (y) => fence(y),
  lFence: (y) => fence(y),

  pool: (y) => {
    poolTiles(y);
    const { x, y: top, w, h } = y.box;
    // The ladder over the north coping, and a float on the water by the piece's hash.
    y.put('pool-ladder', y.hash % 2 ? x + w - 22 : x + 8, top + 1);
    const fx = x + 10 + ((y.hash >>> 3) % Math.max(1, w - 52));
    const fy = top + 22 + ((y.hash >>> 7) % Math.max(1, h - 50));
    y.put('pool-float-0', fx, fy);
  },

  hotTub: (y) => {
    poolTiles(y);
    y.put('hot-tub-bubbles', y.box.x + 8, y.box.y + 9);
  },

  firePit: (y) => {
    const { x, y: top } = y.box;
    y.oval(x + 16, top + 26, 13, 5, HEARTH, 0.45);
    y.put('stump-0', x + 1, top + 15);
    y.put('stump-0', x + 22, top + 15);
    y.put('fire-pit', x + 8, top - 2);
  },

  flowerBed: (y) => {
    y.put(pick(PLANTERS, y.ctx.color), y.box.x + 1, y.box.y + 11);
  },

  herbGarden: (y) => {
    for (const c of y.cells) y.put('herb-planter', c.x * CELL + 1, c.y * CELL + 9);
  },

  sapling: (y) => {
    const { x, y: top } = y.box;
    y.oval(x + 16, top + 27, 9, 3, SOIL, 0.55);
    const s: SpriteId = y.hash % 2 ? 'sapling-1' : 'sapling-0';
    const { w, h } = artSize(s);
    y.put(s, x + Math.floor((CELL - w) / 2), top + 28 - h);
  },

  doghouse: (y) => {
    y.put('own-doghouse', y.box.x + 1, y.box.y + 7);
  },

  treehouse: (y) => {
    const { x, y: top, h } = y.box;
    // The deck's shadow on the ground; the trunk stands at the front of the footprint.
    y.oval(x + 32, top + h - 10, 30, 9, SHADE, 0.22);
    y.put('treehouse', x, top + h - artSize('treehouse').h);
  },

  greenhouse: (y) => {
    const { x, y: top, h } = y.box;
    y.put('greenhouse', x + 4, top + h - artSize('greenhouse').h);
  },

  henhouse: (y) => {
    // The coop in one cell (the back one, or the west one by hash), and in the other its run: two
    // hens on straw behind a low picket front, so it reads as a henhouse, not a shed.
    const [a, b] = [...y.cells].sort((p, q) => p.y - q.y || p.x - q.x) as [Cell, Cell];
    const flip = y.across && y.hash % 2 === 1;
    const coop = flip ? b : a;
    const run = flip ? a : b;
    const rx = run.x * CELL;
    const ry = run.y * CELL;
    y.ground.push({
      op: 'rect',
      rect: { x: rx + 2, y: ry + 6, w: 28, h: 23 },
      rgb: STRAW,
      alpha: 0.5,
    });
    y.oval(rx + 16, ry + 17, 12, 9, STRAW, 0.35);
    y.put(pick(COOPS, y.ctx.color), coop.x * CELL, coop.y * CELL);
    const brown = (y.hash >>> 5) % 2 === 1;
    y.put(brown ? 'own-hen-brown-e' : 'own-hen-e', rx + 4, ry + 5);
    y.put(brown ? 'own-hen-w' : 'own-hen-brown-w', rx + 17, ry + 9);
    // The run's picket front, post to post.
    y.put('picket-run', rx, ry + 15);
    y.put('picket-run', rx + 16, ry + 15);
    y.put('picket-post', rx + 1, ry + 15);
    y.put('picket-post', rx + 26, ry + 15);
  },

  birdhouse: (y) => {
    y.put(pick(BIRDHOUSES, y.ctx.color), y.box.x + 10, y.box.y + 32 - 41);
  },
};

/** A Driveway: concrete, and the house's parked car if it's this one. */
function driveway(y: Yard): void {
  y.tiles('yard-concrete');
  y.edge(EDGE.concrete);
  if (!y.ctx.car) return;
  const { x, y: top, w, h } = y.box;
  // Orange or grey: never the Garage's blue or red (rooms.ts), so it reads as a second car.
  const color = 2 + (y.hash % 2);
  if (!y.across) {
    // Nose in, away from the street: its back to the viewer.
    y.put(`car-rear-${color}` as SpriteId, x, top + 5);
  } else {
    // Side on, facing the house if one end of it touches the house, or by its hash.
    const east = y.ctx.toward ?? (y.hash >>> 1) % 2 === 1;
    const sprite = `car-${east ? 'right' : 'left'}-${color}` as SpriteId;
    y.put(sprite, east ? x + w - 61 - 3 : x + 3, top + h - 37 - 1);
  }
}

/**
 * A Fence: pickets east and west of each cell's middle, the end-on strip north and south of it,
 * out to the cell's edge at the fence's ends, and a post at each end and turn.
 */
function fence(y: Yard): void {
  const { own } = y.ctx;
  for (const c of y.cells) {
    const X = c.x * CELL;
    const Y = c.y * CELL;
    const n = own(c.x, c.y - 1);
    const s = own(c.x, c.y + 1);
    const e = own(c.x + 1, c.y);
    const w = own(c.x - 1, c.y);
    const across = (e || w) && !n && !s;
    const upright = (n || s) && !e && !w;
    // Across: pickets the cell's width, ends out to its edge with a post.
    if (across || w) y.put('picket-run', X, Y + 8);
    if (across || e) y.put('picket-run', X + 16, Y + 8);
    if (across && !w) y.put('picket-post', X + 1, Y + 8);
    if (across && !e) y.put('picket-post', X + 26, Y + 8);
    // Upright: the strip the cell's height, ends out to its edge with a post.
    const strip = (from: number, to: number) => {
      for (let sy = from; sy < to; sy += 8) y.put('picket-strip', X + 14, Y + sy);
    };
    if (upright) {
      strip(n ? 0 : 16, s ? 32 : 16);
      if (!n) y.put('picket-post', X + 14, Y);
      if (!s) y.put('picket-post', X + 14, Y + 16);
    } else if (!across) {
      // A turn or a branch: its arms, and a post where they meet.
      if (n) strip(0, 8);
      if (s) strip(24, 32);
      y.put('picket-post', X + 14, Y + 8);
    }
  }
}
