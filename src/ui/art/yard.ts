// The yard pieces as the board draws them (D-097), built from the placed pieces by fixed rules and
// the pieces' uid hashes, never by chance, so the same yard always looks the same. Pure: no DOM.
// Cached per house model, like the rooms' layouts.
//
// - Ground, painted on the floor canvas under everything that stands (house-paint.ts): a Lawn's
//   mown stripes, a Patio's pavers, a Driveway's concrete and its curb cut through the sidewalk
//   where it meets the street, a Pool's and a Hot Tub's water inside their coping, and the soil,
//   straw or hearth under a Sapling, a Henhouse's run or a Fire Pit. A flat piece has a darker 1 px
//   edge, softer where it meets another piece of its kind (two Lawns, two Driveways): touching
//   pieces read as one patch, and each stays countable (D-093's note).
// - Items, the DOM sprites that wobble with their piece (like a room's furniture): a Patio's
//   parasol, chairs and table (under the Pergola when it has one), the house's one parked car on
//   its oldest Driveway with room for it, a Fence's pickets and posts, a Pool's ladder and float,
//   the Hot Tub's bubbles, the Fire Pit's fire and stumps, planters, the Sapling, the outbuildings,
//   the hens. Fixtures: the Sprinkler on its Lawn, the Pergola over its Patio, Garden Lights as
//   two bollards with their glow; a fixture's badge shows only where a door keeps it off.
// - Nothing stands on an outside door's mat or in front of its opening: a Patio's seats move
//   clear of the door that opens onto it (under a small parasol in place of the full one), the
//   car parks further along its Driveway, or on the next one, and a Pergola, which reaches every
//   edge of its Patio, gives way to a shallower or narrower cut of it on the Patio's far side
//   (its badge only where doors open onto two sides). Every prop keeps its whole box off them,
//   so no pixel of one can hide a mat. An outbuilding's own building always stands (no door
//   opens onto one): only its roof, rising over the row behind it, can hide part of a mat there.
// - Parts of items above their piece's own cells (the Greenhouse's roof, the Treehouse, a
//   Birdhouse's box, a car's roof) carry `over`, and go on the overhang layer above the walls.
//
// A Fence is a picket line through the middle of its cells, out to the edges at its ends, with a
// post at each end and turn. Where an end of one Fence meets another, their lines join (a corner,
// a T); end to end, each keeps its end post, so each stays countable; side by side along their
// lengths they stay two fences, not a grid. A Fence's ghost is the Fence alone.
//
// Fences and Driveways are packs (D-106): each is the tiles its player clicked out
// (PlacedPiece.shape), so they're laid out from their own cells, never the card's shape.

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
import {
  grow,
  overlaps,
  uidHash,
  type HouseModel,
  type PieceLook,
  type Rect,
} from '../board/house-model.ts';
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
// The yard's own marks. The materials laid over the ground (soil, hearth, straw, the wet patch)
// are LimeZu's palette (palette.ts); a flat piece's darker edge, the lamps' light and the shadows
// are light and shade blended over it.

const EDGE = {
  lawn: { rgb: [0x24, 0x34, 0x24] as Rgb, alpha: 0.43, seam: 0.16 },
  pavers: { rgb: [0x28, 0x24, 0x28] as Rgb, alpha: 0.55, seam: 0.22 },
  concrete: { rgb: [0x28, 0x24, 0x28] as Rgb, alpha: 0.45, seam: 0.28 },
} as const;
/** Bare soil (a Sapling's ring, a Fire Pit's hearth), and the straw of a Henhouse's run. */
const SOIL: Rgb = [0x7b, 0x5b, 0x3a];
const HEARTH: Rgb = [0x57, 0x3c, 0x2c];
const STRAW: Rgb = [0xe0, 0xb8, 0x70];
/** The wet patch around the Sprinkler. */
const WET: Rgb = [0x1a, 0x52, 0x49];
/** The materials' colors, for the palette's test. */
export const MATERIALS: readonly Rgb[] = [SOIL, HEARTH, STRAW, WET];
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
export type Look = PieceLook;

/**
 * One yard piece alone, for the ghost: in its own frame (its bounding box's top-left cell is
 * (0, 0)), in the color and with the fixture `look` gives it (pieceLook, newPieceLook), in a
 * pack's own tiles (D-106) when `own` gives them, with no curb cut and no parked car (the house
 * has one, on the oldest Driveway with room for it).
 */
export function yardPieceLayout(
  defId: PieceId,
  rot: Rot,
  look: Look = { color: 0 },
  /** A pack's own tiles (PlacedPiece.shape), when they aren't the card's shape. */
  own?: readonly string[],
): YardLayout {
  const key = `${defId}:${rot}:${own?.join('/') ?? ''}:${look.color}:${look.fixture ?? ''}`;
  let l = solo.get(key);
  if (!l) {
    const shape = own ?? CONTENT.pieces[defId].shape;
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
          ...(own ? { shape: own } : {}),
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

/**
 * A piece's family for seams and joins: the type it counts as. No yard piece counts as another
 * now (D-106's packs took the place of the Long Driveway and the L-Fence), so it's the piece's
 * own type: two Driveways' concrete meets in a seam, and two Fences join.
 */
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
  // What yard items keep off: a Bay Window's bay, which juts out of the wall (the walls canvas),
  // with their feet; and every outside door's opening and doormat, with all of them, so nothing
  // stands on a mat or in front of a door (or rises over one, on the overhang layer). An
  // outbuilding's own building is the exception: it always stands (Yard.stand).
  const keepOut = m ? m.windows.flatMap((w) => (w.bay ? [w.bay] : [])) : [];
  const doors = m ? m.exits.flatMap((e) => [grow(e.mat, 2), grow(e.gap, 2)]) : [];
  const color = colors(house);
  // The Fences' cells, so a Fence's arms can join another's.
  const fenceCells = new Map<string, { uid: number; own: number }>();
  for (const p of house.pieces) {
    if (kind(p.defId) !== 'fence') continue;
    const cells = occ.cells.get(p.uid)!;
    const mine = new Set(cells.map((c) => `${c.x},${c.y}`));
    for (const c of cells) {
      fenceCells.set(`${c.x},${c.y}`, {
        uid: p.uid,
        own: ownMask((x, yy) => mine.has(`${x},${yy}`), c.x, c.y),
      });
    }
  }
  const fence = { masks: fenceMasks(fenceCells) };

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
  /** One yard piece's layout, with the house's parked car on it or not. */
  const layOut = (p: PlacedPiece, car: boolean): YardLayout => {
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
      doors,
      car,
      color: opts.color ?? color.get(p.uid) ?? 0,
      ...(east !== west ? { toward: east } : {}),
      fence,
    });
    LAYOUTS[p.defId]?.(y);
    if (p.fixture?.id === 'gardenLights') y.lights();
    return y.done();
  };
  // The house's one parked car: on its oldest Driveway that has room for it off the doors.
  let parked = 0;
  if (opts.car) {
    const ways = house.pieces.filter((p) => isDriveway(p.defId)).sort((a, b) => a.uid - b.uid);
    parked = ways.find((p) => layOut(p, true).items.some((it) => isCar(it.sprite)))?.uid ?? 0;
  }
  for (const p of house.pieces) {
    if (isIndoor(p.defId)) continue;
    const cells = occ.cells.get(p.uid)!;
    pieces.set(p.uid, layOut(p, p.uid === parked));
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

/**
 * The parts of a yard piece's props that rise above its own cells, on the overhang layer (the
 * Greenhouse's roof, the Treehouse, a Birdhouse's box, a car's roof, a parasol's crown), as boxes
 * in lot art px: other pieces' labels keep off them (label-layout.ts), so a digit drawn over a
 * Greenhouse's roof never reads as the Greenhouse's.
 */
export function risingParts(l: YardLayout): Rect[] {
  return l.items.flatMap((it) => {
    if (it.over === undefined || it.over <= it.y) return [];
    const { w, h } = artSize(it.sprite);
    return [{ x: it.x, y: it.y, w, h: Math.min(h, it.over - it.y) }];
  });
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

const isCar = (sprite: Item['sprite']) => sprite.startsWith('car-');

interface YardCtx {
  own: (x: number, y: number) => boolean;
  /** Another piece of the same kind on that cell. */
  kin: (x: number, y: number) => boolean;
  /** What an item's feet keep off (a Bay Window's bay). */
  keepOut: readonly Rect[];
  /** What no part of an item covers: each outside door's opening and doormat. */
  doors: readonly Rect[];
  /** This Driveway gets the house's parked car. */
  car: boolean;
  /** Its color, an index into its type's palette (colors()). */
  color: number;
  /** For a piece running across: the house is at its east end (true) or its west end (false). */
  toward?: boolean;
  /** Every Fence cell's arms on the lot, joined across pieces (fenceMasks). */
  fence: { masks: ReadonlyMap<string, number> };
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

  /**
   * Whether a sprite with its top-left at (x, y) keeps its feet off the keep-outs, and all of it
   * off the doors: its whole box, which holds every pixel it draws (the Pergola's beams, rafters
   * and posts reach its edges, so no door's mat shows through it).
   */
  fits(sprite: Item['sprite'], x: number, y: number): boolean {
    const { w, h } = artSize(sprite);
    const foot = { x, y: y + Math.max(0, h - 8), w, h: Math.min(h, 8) };
    if (this.ctx.keepOut.some((k) => overlaps(foot, k))) return false;
    return !this.ctx.doors.some((d) => overlaps({ x, y, w, h }, d));
  }

  /**
   * Whether a sprite with its top-left at (x, y) stands on this piece's own cells: every cell
   * under its feet (its bottom 8 rows, as fits() takes them). A pack's free-form tiles (D-106)
   * can leave a spot that fits its box half on the grass beside it.
   */
  standsOnOwn(sprite: Item['sprite'], x: number, y: number): boolean {
    const { w, h } = artSize(sprite);
    const top = y + Math.max(0, h - 8);
    for (let cy = Math.floor(top / CELL); cy <= Math.floor((y + h - 1) / CELL); cy++) {
      for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + w - 1) / CELL); cx++) {
        if (!this.ctx.own(cx, cy)) return false;
      }
    }
    return true;
  }

  /** Places a sprite with its top-left at (x, y), unless it would stand on a keep-out or a door. */
  put(sprite: Item['sprite'], x: number, y: number): boolean {
    if (!this.fits(sprite, x, y)) return false;
    this.items.push({ sprite, x, y });
    return true;
  }

  /**
   * Stands an outbuilding's own building (the Treehouse, the Greenhouse, the coop, the Doghouse,
   * the Birdhouse) with its top-left at (x, y), always: it's the piece itself, and no door opens
   * onto an outbuilding, so only its roof rising over the row behind it can meet a door's mat,
   * which it hides as anything tall in front of it would.
   */
  stand(sprite: Item['sprite'], x: number, y: number): void {
    this.items.push({ sprite, x, y });
  }

  /** Places a group of sprites at the first offset where all of them fit, or none of them. */
  group(parts: readonly [Item['sprite'], number, number][], offsets: readonly [number, number][]) {
    for (const [dx, dy] of offsets) {
      if (parts.every(([sp, x, y]) => this.fits(sp, x + dx, y + dy))) {
        for (const [sp, x, y] of parts) this.put(sp, x + dx, y + dy);
        return true;
      }
    }
    return false;
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
const SMALL_PARASOLS: readonly SpriteId[] = ['parasol-small-0', 'parasol-small-1'];

/**
 * Where a Patio's Pergola may stand, best first: the whole one (64 × 61, its legs on the patio's
 * front edge); the shallower cut (64 × 51) at the front, clear of a north door's mat, or at the
 * back, clear of a south one's; the narrower cut (50 × 61) on the west side, clear of an east
 * door's mat, or on the east side, clear of a west one's.
 */
function pergolas(box: Rect): [SpriteId, number, number][] {
  const { x, y, w, h } = box;
  const full = artSize('pergola');
  const short = artSize('pergola-short');
  const narrow = artSize('pergola-narrow');
  const back = y + h - full.h;
  return [
    ['pergola', x, back],
    ['pergola-short', x, y + h - short.h],
    ['pergola-short', x, back],
    ['pergola-narrow', x, y + h - narrow.h],
    ['pergola-narrow', x + w - narrow.w, y + h - narrow.h],
  ];
}
const PLANTERS: readonly SpriteId[] = ['planter-0', 'planter-1', 'planter-2', 'planter-3'];
const COOPS: readonly SpriteId[] = ['coop-0', 'coop-1', 'coop-2'];
const BIRDHOUSES: readonly SpriteId[] = [
  'birdhouse-0',
  'birdhouse-1',
  'birdhouse-2',
  'birdhouse-3',
];

/** A seat on each side of a little table, facing it: where they keep off the doors, or none. */
function seats(
  y: Yard,
  x: number,
  base: number,
  offsets: readonly [number, number][],
  parasol?: SpriteId,
): boolean {
  const color = (y.hash >>> 4) % 2;
  return y.group(
    [
      // A small parasol's canopy just over the table's top, behind the seats.
      ...(parasol ? [[parasol, x - 5, base - 31] as [SpriteId, number, number]] : []),
      [color ? 'patio-chair-e-1' : 'patio-chair-e-0', x - 15, base - 19],
      [color ? 'patio-chair-w-1' : 'patio-chair-w-0', x + 14, base - 19],
      ['patio-table', x, base - 16],
    ],
    offsets,
  );
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
    // The table in the middle, near the front; its seats either side. Where a door opens onto
    // the patio, they move clear of its mat (to the back, or a side), and a small parasol over
    // the table stands in for the full one, whose canopy covers most of the patio.
    const tx = x + w / 2 - 6;
    const base = top + h - 3;
    const room = (dy: number): [number, number][] => [
      [0, dy],
      [-(w / 2 - 22), dy],
      [w / 2 - 22, dy],
    ];
    const moves = [...room(0), ...room(-(h - 26))];
    // The Pergola roofs the patio, in place of the parasol, with the seats and table under it.
    // Its beams, rafters and posts reach every edge of the patio, so where a door opens onto it
    // a cut of it stands clear of the door's mat instead: shallower for a door on its north or
    // south edge, narrower for one on its east or west edge, on the patio's far side. With doors
    // on two sides none fits, so its badge shows (HouseLayers.tsx) and the patio keeps its
    // parasol and seats.
    if (y.fixture === 'pergola') {
      for (const [sprite, px, py] of pergolas(y.box)) {
        if (!y.fits(sprite, px, py)) continue;
        const { w: pw, h: ph } = artSize(sprite);
        seats(y, px + pw / 2 - 6, py + ph - 9, moves);
        y.put(sprite, px, py);
        y.fixtureShown = true;
        return;
      }
    }
    // The parasol's stand behind the table, its canopy over the seats.
    const parasol = y.put(pick(PARASOLS, y.ctx.color), x + Math.floor((w - 47) / 2), base - 61 - 4);
    if (parasol) seats(y, tx, base, [[0, 0]]);
    else seats(y, tx, base, moves, pick(SMALL_PARASOLS, y.ctx.color)) || seats(y, tx, base, moves);
  },

  driveway: (y) => driveway(y),

  fence: (y) => fence(y),

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
    // A whole stump to sit on at each back corner (the second one mirrored), behind the fire.
    y.put('stump-0', x, top + 9);
    y.put('stump-1', x + CELL - artSize('stump-1').w, top + 9);
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
    y.stand('own-doghouse', y.box.x + 1, y.box.y + 7);
  },

  treehouse: (y) => {
    const { x, y: top, h } = y.box;
    // The deck's shadow on the ground; the trunk stands at the front of the footprint.
    y.oval(x + 32, top + h - 10, 30, 9, SHADE, 0.22);
    y.stand('treehouse', x, top + h - artSize('treehouse').h);
  },

  greenhouse: (y) => {
    const { x, y: top, h } = y.box;
    y.stand('greenhouse', x + 4, top + h - artSize('greenhouse').h);
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
    y.stand(pick(COOPS, y.ctx.color), coop.x * CELL, coop.y * CELL);
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
    y.stand(pick(BIRDHOUSES, y.ctx.color), y.box.x + 10, y.box.y + 32 - 41);
  },
};

/**
 * A Driveway: concrete, and the house's parked car if it's this one. The car parks only with
 * its wheels on the Driveway's own concrete: a pack too small or too ragged for it (one tile, a
 * T) parks none, and the house's car goes to its next Driveway with room (build()).
 */
function driveway(y: Yard): void {
  y.tiles('yard-concrete');
  y.edge(EDGE.concrete);
  if (!y.ctx.car) return;
  const { x, y: top, w, h } = y.box;
  // Orange or grey: never the Garage's blue or red (rooms.ts), so it reads as a second car.
  const color = 2 + (y.hash % 2);
  const park = (sprite: SpriteId, cx: number, cy: number) =>
    y.standsOnOwn(sprite, cx, cy) && y.put(sprite, cx, cy);
  if (!y.across) {
    // Nose in, away from the street: its back to the viewer; further down where its north end
    // holds a door's mat.
    const sprite = `car-rear-${color}` as SpriteId;
    for (let dy = 5; dy <= h - artSize(sprite).h; dy += CELL / 2) {
      if (park(sprite, x, top + dy)) return;
    }
  } else {
    // Side on, facing the house if one end of it touches the house, or by its hash; at its other
    // end, then along it, where a door opens onto the first.
    const east = y.ctx.toward ?? (y.hash >>> 1) % 2 === 1;
    const sprite = `car-${east ? 'right' : 'left'}-${color}` as SpriteId;
    const cy = top + h - 37 - 1;
    const near = east ? x + w - 61 - 3 : x + 3;
    const far = east ? x + 3 : x + w - 61 - 3;
    const along = Array.from({ length: Math.max(0, (w - 64) / (CELL / 2)) }, (_, i) =>
      east ? near - (i + 1) * (CELL / 2) : near + (i + 1) * (CELL / 2),
    );
    for (const cx of [near, ...along, far]) if (park(sprite, cx, cy)) return;
  }
}

/**
 * A Fence: pickets east and west of each cell's middle, the end-on strip north and south of it,
 * out to the cell's edge at the fence's ends, and a post at each end and turn. Its arms join
 * another Fence's where an end of one meets the other (a corner, a T, or end to end), so fences
 * that meet read as one line; side by side along their lengths they stay two. Where two meet
 * end to end, each keeps its end post, so each stays countable. A cell with no arms at all (a
 * one-tile pack, D-106) is a short run across, with a post at each end.
 */
function fence(y: Yard): void {
  const { masks } = y.ctx.fence;
  const mask = (x: number, yy: number) => masks.get(`${x},${yy}`) ?? 0;
  for (const c of y.cells) {
    const X = c.x * CELL;
    const Y = c.y * CELL;
    const m = mask(c.x, c.y);
    const n = (m & N) !== 0;
    const e = (m & E) !== 0;
    const s = (m & S) !== 0;
    const w = (m & W) !== 0;
    const own = ownMask(y.ctx.own, c.x, c.y);
    // A post at this piece's own end, unless the line runs on into a turn of another Fence
    // there (that turn's post marks the joint).
    const endPost = (bit: number, nx: number, ny: number, axis: number) =>
      !(own & bit) && (!(m & bit) || (mask(nx, ny) & ~axis) === 0);
    const across = ((e || w) && !n && !s) || m === 0;
    const upright = (n || s) && !e && !w;
    // Across: pickets the cell's width, ends out to its edge with a post.
    if (across || w) y.put('picket-run', X, Y + 8);
    if (across || e) y.put('picket-run', X + 16, Y + 8);
    if (across && endPost(W, c.x - 1, c.y, E | W)) y.put('picket-post', X + 1, Y + 8);
    if (across && endPost(E, c.x + 1, c.y, E | W)) y.put('picket-post', X + 26, Y + 8);
    // Upright: the strip the cell's height, ends out to its edge with a post.
    const strip = (from: number, to: number) => {
      for (let sy = from; sy < to; sy += 8) y.put('picket-strip', X + 14, Y + sy);
    };
    if (upright) {
      strip(n ? 0 : 16, s ? 32 : 16);
      if (endPost(N, c.x, c.y - 1, N | S)) y.put('picket-post', X + 14, Y);
      if (endPost(S, c.x, c.y + 1, N | S)) y.put('picket-post', X + 14, Y + 16);
    } else if (!across) {
      // A turn or a branch: its arms, and a post where they meet.
      if (n) strip(0, 8);
      if (s) strip(24, 32);
      y.put('picket-post', X + 14, Y + 8);
    }
  }
}

const N = 1;
const E = 2;
const S = 4;
const W = 8;

/** Which of a cell's neighbors are its own piece's. */
function ownMask(own: (x: number, y: number) => boolean, x: number, y: number): number {
  return (
    (own(x, y - 1) ? N : 0) |
    (own(x + 1, y) ? E : 0) |
    (own(x, y + 1) ? S : 0) |
    (own(x - 1, y) ? W : 0)
  );
}

/** The side opposite `bit`. */
const opposite = (bit: number) => (bit === N ? S : bit === S ? N : bit === E ? W : E);

/**
 * Every Fence cell's arms on a lot: toward its own piece's cells, and toward another Fence's cell
 * through an end of one of them: the side an end's line runs on into (opposite its own arm). So a
 * corner, a T or two Fences end to end join, and two side by side never close into a pen.
 */
function fenceMasks(cells: ReadonlyMap<string, { uid: number; own: number }>): Map<string, number> {
  const out = new Map<string, number>();
  const isEnd = (own: number) => own === N || own === E || own === S || own === W;
  for (const [k, f] of cells) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    let m = f.own;
    for (const [bit, dx, dy] of [
      [N, 0, -1],
      [E, 1, 0],
      [S, 0, 1],
      [W, -1, 0],
    ] as const) {
      const q = cells.get(`${x + dx},${y + dy}`);
      if (!q || q.uid === f.uid) continue;
      // This end runs on toward q, or q's end runs on toward this cell.
      if ((isEnd(f.own) && bit === opposite(f.own)) || (isEnd(q.own) && q.own === bit)) m |= bit;
    }
    out.set(k, m);
  }
  return out;
}
