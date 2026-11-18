// The household on the board (D-177), the part that decides, kept pure so tests can check it (as
// life.ts is): who of the household is drawn, and where each one stands. Read only: it reads the
// run and the house model and changes nothing, and none of it is the rules.
//
// - A member who has arrived and has one of their rooms built (a placed piece of a type in their
//   ArrivalDef.room) stands in one of its doorways, facing south: on the floor a door in the
//   room's north or south wall keeps clear of furniture in every arrangement (Doorway.clear,
//   D-173), or beside a side wall's door, where nothing of the room's own furniture stands in
//   front of them. The rooms' items (HouseLayers.tsx) draw them, sorted with the furniture by
//   bottom row, the rows that rise over a wall band behind them on the overhang, as tall
//   furniture's do.
// - One still waiting for a room stands at the front door's doormat with a suitcase, side by side
//   with anyone else waiting, or at the kerb when the house has no front door. PeopleLayer.tsx
//   draws them, and the walk up from the street when the doorbell rings for them.
// - Nobody in the guided first job, and only the members with a cast: the twins wait for one.
// - The client's visit at a milestone (D-182, fx/visit.ts) comes to the same doormat: with anyone
//   waiting there, or at the kerb where they'd stand, the client joins the end of their line
//   (besideWaiting), so nobody stands on anybody, and neither the client nor their bubble covers
//   anyone of the household (householdBoxes), a member in the front door's doorway included.
//
// Spots are in lot art px (CELL per cell): `x` the figure's middle, `y` the line its feet stand on
// (the sprite's bottom edge), so a figure FIGURE.w wide and FIGURE.h tall covers
// [x − w/2, x + w/2) × [y − h, y).

import {
  CONTENT,
  terrainAt,
  type ArrivalDef,
  type ArrivalId,
  type HouseState,
  type PieceId,
  type RunState,
} from '../../rules/index.ts';
import { artSize } from '../art/drawings.ts';
import { Mask, wallMask, type Figure } from '../art/house-paint.ts';
import { roomItems, type Item } from '../art/rooms.ts';
import type { YardModel } from '../art/yard.ts';
import { FEEL } from '../fx/feel.ts';
import { CELL, spriteFrames, type SpriteId } from '../sprites.ts';
import { occupancy } from './geometry.ts';
import {
  floorTop,
  grow,
  inset,
  overlaps,
  roomAt,
  type HouseModel,
  type Rect,
  type Room,
  type Side,
} from './house-model.ts';
import { seedSalt, tileHash } from './terrain/hash.ts';

/**
 * Who plays each member (art/limezu/people.json): standing (facing south), walking north, and
 * their suitcase. D-185: standing, they breathe: `stand`'s frames are the sheet's idle, its first
 * frame the figure standing still. An adult also reads (`read`) and takes a call (`phone`) now and
 * then, facing south; each of these strips is a loop.
 */
export interface Cast {
  readonly stand: SpriteId;
  readonly walk: SpriteId;
  readonly suitcase: SpriteId;
  readonly read?: SpriteId;
  readonly phone?: SpriteId;
}

/**
 * The cast, by arrival (src/content/households.ts). Premade characters the street's walkers don't
 * use: Grandma and Nana grayed, Renfield in his monocle, Rowan in a painter's beanie, and Ivy
 * composed from the character generator's kids' parts, which have no book or phone. The twins
 * have none yet: they're left out.
 */
export const CAST: Readonly<Partial<Record<ArrivalId, Cast>>> = {
  grandma: {
    stand: 'people-grandma',
    walk: 'people-grandma-walk',
    suitcase: 'people-suitcase-green',
    read: 'people-grandma-read',
    phone: 'people-grandma-phone',
  },
  renfield: {
    stand: 'people-renfield',
    walk: 'people-renfield-walk',
    suitcase: 'people-suitcase-tan',
    read: 'people-renfield-read',
    phone: 'people-renfield-phone',
  },
  nana: {
    stand: 'people-nana',
    walk: 'people-nana-walk',
    suitcase: 'people-suitcase-blue',
    read: 'people-nana-read',
    phone: 'people-nana-phone',
  },
  rowan: {
    stand: 'people-rowan',
    walk: 'people-rowan-walk',
    suitcase: 'people-suitcase-green',
    read: 'people-rowan-read',
    phone: 'people-rowan-phone',
  },
  ivy: { stand: 'people-ivy', walk: 'people-ivy-walk', suitcase: 'people-suitcase-blue' },
};

/**
 * Every strip a member shows standing (D-185): their idle, then an adult's book and phone, in the
 * order of their turns (Pace). Each is a figure's size, and they stand in the same box.
 */
export function looks(cast: Cast): SpriteId[] {
  return [cast.stand, ...(cast.read ? [cast.read] : []), ...(cast.phone ? [cast.phone] : [])];
}

/**
 * D-185: how a member moves as they stand, at the door or in their room (PeopleLayer.tsx Standing).
 * Each frame of their idle shows `idleMs`. An adult with a book and a phone reads in the first of
 * two turns and takes a call in the second, `turnsMs` the two (0: no turns), each frame of the
 * book or the phone shown `busyMs`. Every loop and every turn is `delayMs` in (≤ 0: as if begun
 * that long before it was drawn), so the turns and the strips step together.
 */
export interface Pace {
  readonly idleMs: number;
  readonly busyMs: number;
  readonly turnsMs: number;
  readonly delayMs: number;
}

/** FEEL.household's shape, for pace. */
export interface HouseholdFeel {
  readonly idleFrameMs: number;
  readonly busyFrameMs: number;
  readonly turnMs: readonly [number, number];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * A member's pace (Pace), by hash of the run's seed and who they are, never chance, so a run code
 * shows them the same. A turn is about `f.turnMs` long, between its two ends, and a whole number
 * of loops of the book's and the phone's strips, so each opens on its first frame. Where in the
 * two turns they start is by hash too: one may be reading as the board first shows them.
 */
export function pace(
  arrival: ArrivalId,
  cast: Cast,
  seed: string,
  f: HouseholdFeel = FEEL.household,
): Pace {
  const salt = seedSalt(`${seed}/${arrival}`);
  const idle = (spriteFrames(cast.stand)?.frames ?? 1) * f.idleFrameMs;
  const strips = cast.read && cast.phone ? [cast.read, cast.phone] : [];
  if (strips.length === 0) {
    const delayMs = 0 - (tileHash(0, 1, salt) % idle);
    return { idleMs: f.idleFrameMs, busyMs: f.busyFrameMs, turnsMs: 0, delayMs };
  }
  const loop = strips
    .map((s) => (spriteFrames(s)?.frames ?? 1) * f.busyFrameMs)
    .reduce((a, b) => (a / gcd(a, b)) * b);
  const lo = Math.max(1, Math.ceil(f.turnMs[0] / loop));
  const hi = Math.max(lo, Math.floor(f.turnMs[1] / loop));
  const turnsMs = 2 * loop * (lo + (tileHash(0, 2, salt) % (hi - lo + 1)));
  const delayMs = 0 - (tileHash(0, 3, salt) % turnsMs);
  return { idleMs: f.idleFrameMs, busyMs: f.busyFrameMs, turnsMs, delayMs };
}

/** Every cast figure's size, standing or walking: 16 × 26 art px, its feet on its bottom row. */
export const FIGURE = { w: 16, h: 26 } as const;

/**
 * A figure in a room stands on the floor: at least its lowest `LEGS` rows are under the walls with
 * no wall band under them (their over line, overLine, is at least this far above their feet).
 */
export const LEGS = 10;

/**
 * Waiting at the door: each one's suitcase stands `suitcaseDx` art px right of their middle (its
 * left edge), a pixel in front of them, and the next one waits `spacing` art px along.
 */
export const WAITING = { suitcaseDx: 2, suitcaseDy: 1, spacing: 26 } as const;

/**
 * Walking in: the suitcase rolls behind them, `dx` right of their middle and its foot `dy` below
 * theirs. The walk starts `fromPx` art px down the street row (on the road, past the kerb's lip
 * at about 28: terrain/street.ts).
 */
export const PULLED = { dx: -1, dy: 6 } as const;
export const WALK_FROM_PX = 52;

/** Every cast's suitcase is this wide, in art px (art/limezu/people.json). */
export const SUITCASE_W = 16;

/** At the kerb (no front door): the feet `kerbPx` art px down the street row, on the sidewalk. */
export const KERB_PX = 14;

export type Place = 'door' | 'kerb' | 'room';

/** A member on the board. */
export interface Person {
  readonly arrival: ArrivalId;
  readonly cast: Cast;
  readonly place: Place;
  /** Their room's uid when `place` is 'room'; 0 otherwise. */
  readonly uid: number;
  /** The figure's middle and the line its feet stand on, in lot art px. */
  readonly x: number;
  readonly y: number;
  /** D-185: how they move as they stand there. */
  readonly pace: Pace;
}

/** The rules' data on a member of this client's household. */
function arrivalDef(state: Pick<RunState, 'setup'>, id: ArrivalId): ArrivalDef | undefined {
  return CONTENT.clients[state.setup.clientId].household.arrivals.find((a) => a.id === id);
}

/**
 * Who of the household is on the board, and where: each member who has arrived and has a cast,
 * in the order they arrived. Nobody while `guided` (store.ts firstJob: the guided first job,
 * D-149); a first job's lot played again, or its run code opened later, isn't guided, and its
 * household is drawn.
 */
export function people(
  state: Pick<RunState, 'setup' | 'arrived'>,
  model: HouseModel,
  guided = false,
): readonly Person[] {
  if (guided) return [];
  const out: Person[] = [];
  const waiting: { arrival: ArrivalId; cast: Cast; pace: Pace }[] = [];
  for (const id of state.arrived) {
    const cast = CAST[id];
    const def = arrivalDef(state, id);
    if (!cast || !def) continue;
    const how = pace(id, cast, state.setup.seed);
    // Their oldest room, if one is built.
    const room = [...model.rooms.values()].find((r) => def.room.includes(r.defId));
    if (room) {
      const at = doorwaySpot(model, room);
      out.push({ arrival: id, cast, place: 'room', uid: room.uid, ...at, pace: how });
    } else {
      waiting.push({ arrival: id, cast, pace: how });
    }
  }
  if (waiting.length === 0) return out;
  const front = model.exits.find((e) => e.kind === 'front');
  const spots = front
    ? doorSpots(front.mat, front.side, waiting.length, model.width * CELL)
    : kerbSpots(model, waiting.length);
  waiting.forEach((w, i) => {
    out.push({ ...w, place: front ? 'door' : 'kerb', uid: 0, ...spots[i]! });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// In a room.

/**
 * A place a member may stand in their room: its spot, how good it is (doorwaySpot), and which way
 * it may move. On a north or south door's clear floor (`clear`), the feet slide along that line
 * and stay on it; beside a side wall's door they move down the wall and into the room, `away`
 * from the wall (−1 west, 1 east).
 */
interface Stand {
  x: number;
  y: number;
  rank: number;
  clear?: Rect;
  away?: -1 | 1;
}

/** Sliding along a line: the spot itself, then a px further each way, west first. */
const SLIDE: readonly (readonly [number, number])[] = Array.from(
  { length: 2 * CELL + 1 },
  (_, i) => [i % 2 === 1 ? -(i + 1) / 2 : i / 2, 0] as const,
);

/**
 * From beside a side wall's door: down the wall (what stands lower is in front of a figure, so
 * lower clears it), into the room up to a figure's width, and up a little; nearest first, and of
 * those as near, the lowest.
 */
const SIDE: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let dx = 0; dx <= FIGURE.w; dx++) for (let dy = -8; dy <= CELL; dy++) out.push([dx, dy]);
  return out.sort((a, b) => a[0] + Math.abs(a[1]) - (b[0] + Math.abs(b[1])) || b[1] - a[1]);
})();

/**
 * Where a member stands in their room: in one of its doorways, facing south. Best first: a door in
 * the room's south wall (they stand at the front of the room), an outside door in it, a door in its
 * north wall (at the back, under the wall's face), an outside door there, each on the part of the
 * door's clear floor inside the room; and then a side wall's door or outside door, beside the
 * opening and clear of the wall's band. Ties go to the model's order. Last, and for a room with no
 * door at all (none could fit), the middle of its floor's south edge.
 *
 * Nothing of the room's own furniture may stand in front of them (hiddenBy): at each of those, in
 * turn, they take the nearest spot where none would cover them, sliding along a north or south
 * door's clear floor, or from beside a side door down the wall and into the room. A figure is
 * wider than the floor a door keeps clear (16 px to its 14), so on that floor a piece standing
 * flush with it may be in front of their outermost column, an arm, where no spot along it is
 * clear of all of them. Their feet stay on the room's floor, below its north faces, with their
 * legs under the walls (standsAt). Where no spot is clear, the least covered.
 */
export function doorwaySpot(m: HouseModel, room: Room): { x: number; y: number } {
  const uid = room.uid;
  const half = FIGURE.w / 2;
  const stands: Stand[] = [];
  for (const d of m.doors) {
    if (d.a !== uid && d.b !== uid) continue;
    const { gap, clear } = d;
    if (d.dir === 'h') {
      const mid = gap.x + gap.w / 2;
      // North of the wall: their feet just above its band; south of it, below its face.
      if (d.a === uid) stands.push({ x: mid, y: gap.y, rank: 0, clear });
      else stands.push({ x: mid, y: clear.y + clear.h, rank: 2, clear });
    } else {
      // Beside a side wall's door: clear of the band, their feet at the walkway's foot.
      const west = d.a === uid;
      const x = west ? gap.x - half : gap.x + gap.w + half;
      stands.push({ x, y: clear.y + clear.h, rank: 4, away: west ? -1 : 1 });
    }
  }
  for (const e of m.exits) {
    if (e.uid !== uid) continue;
    const { gap, clear } = e;
    const mid = gap.x + gap.w / 2;
    const y = gap.y + gap.h;
    if (e.side === 'S') stands.push({ x: mid, y: gap.y, rank: 1, clear });
    else if (e.side === 'N') stands.push({ x: mid, y: clear.y + clear.h, rank: 3, clear });
    else if (e.side === 'W') stands.push({ x: gap.x + gap.w + half, y, rank: 4, away: 1 });
    else stands.push({ x: gap.x - half, y, rank: 4, away: -1 });
  }
  stands.sort((p, q) => p.rank - q.rank); // stable: ties keep the model's order
  const foot = floorFoot(m, room);
  stands.push({ ...foot, rank: 5, clear: { x: room.box.x, y: foot.y - 1, w: room.box.w, h: 1 } });

  const items = roomItems(m, uid);
  const walls = bandMask(m, grow(room.box, CELL));
  let best: { x: number; y: number; hidden: number } | null = null;
  for (const s of stands) {
    let armOnly: { x: number; y: number } | null = null;
    for (const [dx, dy] of s.clear ? SLIDE : SIDE) {
      const y = s.y + dy;
      const x = keepOffSideWalls(m, s.x + (s.away ?? 1) * dx, y);
      if (s.clear && !inRect(s.clear, x, y - 1)) continue;
      const over = standsAt(m, uid, walls, x, y);
      if (over === null) continue;
      const hidden = hiddenBy(items, x, y, over);
      if (hidden === 0) return { x, y };
      if (s.clear && !armOnly && hiddenBy(items, x, y, over, 1) === 0) armOnly = { x, y };
      if (!best || hidden < best.hidden) best = { x, y, hidden };
    }
    if (armOnly) return armOnly;
  }
  return best ? { x: best.x, y: best.y } : { x: keepOffSideWalls(m, foot.x, foot.y), y: foot.y };
}

const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** The middle of a room's floor's south edge: where a member stands in a room with no door. */
function floorFoot(m: HouseModel, room: Room): { x: number; y: number } {
  const x = room.box.x + room.box.w / 2;
  const cx = Math.floor(x / CELL);
  const cy = (room.box.y + room.box.h) / CELL - 1;
  return { x, y: (cy + 1) * CELL - inset(m, cx, cy, 'S') };
}

/**
 * Whether a figure can stand at (x, y) in room `uid`, and its over line if it can (undefined with
 * no wall band under it), or null: its feet on the room's floor, below the north face and above
 * the south wall's band, and its lowest LEGS rows under the walls with no band under them. (Its
 * middle is already clear of the side walls: keepOffSideWalls.)
 */
function standsAt(
  m: HouseModel,
  uid: number,
  walls: Mask,
  x: number,
  y: number,
): number | undefined | null {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor((y - 1) / CELL);
  if (roomAt(m, cx, cy) !== uid) return null;
  if (y - 1 < floorTop(m, cx, cy) || y > (cy + 1) * CELL - inset(m, cx, cy, 'S')) return null;
  const over = overIn(walls, x, y);
  return over !== undefined && y - over < LEGS ? null : over;
}

/**
 * How much of a figure standing at (x, y), its over line `over`, its room's furniture would hide,
 * in art px of overlap (by the pieces' boxes, so no less than the pixels): each piece sorted in
 * front of it (withPeople: its bottom edge below their feet) wherever it overlaps the figure, and
 * a piece behind it where the rows it raises on the overhang (Item.over) overlap the figure's rows
 * under the walls. The rugs lie under everyone. `edge` columns at each side of the figure don't
 * count.
 */
export function hiddenBy(
  items: readonly Item[],
  x: number,
  y: number,
  over: number | undefined,
  edge = 0,
): number {
  const x0 = x - FIGURE.w / 2 + edge;
  const x1 = x + FIGURE.w / 2 - edge;
  const top = y - FIGURE.h;
  const under = over ?? top;
  let n = 0;
  for (const it of items) {
    if (FLAT.test(it.sprite)) continue;
    const { w, h } = artSize(it.sprite);
    const cols = Math.min(x1, it.x + w) - Math.max(x0, it.x);
    if (cols <= 0) continue;
    const rows =
      it.y + h > y
        ? y - Math.max(top, it.y)
        : it.over === undefined
          ? 0
          : Math.min(y, it.over) - Math.max(under, it.y);
    if (rows > 0) n += cols * rows;
  }
  return n;
}

/**
 * The figure's middle moved, if it must, so the figure stands clear of the bands of the side walls
 * of the cell its feet are in: the walls' canvas is drawn over the rooms' items, so a band would
 * cut a figure that overlapped it.
 */
function keepOffSideWalls(m: HouseModel, x: number, y: number): number {
  const half = FIGURE.w / 2;
  const cx = Math.floor(x / CELL);
  const cy = Math.floor((y - 1) / CELL);
  const west = inset(m, cx, cy, 'W');
  const east = inset(m, cx, cy, 'E');
  let out = x;
  if (west > 0 && out - half < cx * CELL + west) out = cx * CELL + west + half;
  if (east > 0 && out + half > (cx + 1) * CELL - east) out = (cx + 1) * CELL - east - half;
  return out;
}

/**
 * The walls canvas's bands over `box` (house-paint.ts wallMask) with the doorways' and outside
 * doors' openings in them: what the canvas draws in an opening (its threshold line) is the wall's
 * too, so a figure's rows over an opening behind them go on the overhang with the band's.
 */
function bandMask(m: HouseModel, box: Rect): Mask {
  const mask = wallMask(m, box);
  for (const d of m.doors) mask.rect(d.gap, true);
  for (const e of m.exits) mask.rect(e.gap, true);
  return mask;
}

/** overLine's, in a band mask that covers the figure (bandMask). */
function overIn(walls: Mask, x: number, y: number): number | undefined {
  const x0 = x - FIGURE.w / 2;
  for (let row = y - 1; row >= y - FIGURE.h; row--) {
    for (let col = x0; col < x0 + FIGURE.w; col++) if (walls.has(col, row)) return row + 1;
  }
  return undefined;
}

/**
 * The line a figure standing at (x, y) rises over: just below the lowest row of wall band under
 * it, its openings counted in (bandMask: the walls canvas's bands, and a door's threshold line):
 * a north wall's, a north door's or outside door's, a side wall's that ends above their feet, or
 * the corner where an outside wall turns. Every band under the figure is behind it, north of its
 * feet, so the rows above the line go on the overhang, over the walls, as a tall piece of
 * furniture's do (Item.over). Undefined when no band is under the figure.
 */
export function overLine(m: HouseModel, x: number, y: number): number | undefined {
  const box = { x: x - FIGURE.w / 2, y: y - FIGURE.h, w: FIGURE.w, h: FIGURE.h };
  return overIn(bandMask(m, box), x, y);
}

/**
 * A member in their room as one of its items (D-177): their standing figure at their spot, its
 * first frame `sprite`'s. D-185: `looks` are every strip they show there (their `cast`'s), `pace`
 * how they step (HouseLayers.tsx draws them with PeopleLayer.tsx's Standing), and a lamp's light
 * keeps off what any frame of theirs draws (house-paint.ts Figure).
 */
export interface PersonItem extends Figure {
  readonly sprite: SpriteId;
  readonly looks: readonly SpriteId[];
  readonly cast: Cast;
  readonly pace: Pace;
}

/** Whether a room's item is a member of the household (personItem). */
export function isPerson(it: Item): it is PersonItem {
  return 'pace' in it;
}

/** A member in their room as one of its items: their standing figure, at their spot. */
export function personItem(m: HouseModel, p: Person): PersonItem {
  const over = overLine(m, p.x, p.y);
  return {
    sprite: p.cast.stand,
    x: p.x - FIGURE.w / 2,
    y: p.y - FIGURE.h,
    ...(over !== undefined ? { over } : {}),
    looks: looks(p.cast),
    cast: p.cast,
    pace: p.pace,
  };
}

/** The members in rooms, as items by room uid. */
export function roomPeople(
  m: HouseModel,
  all: readonly Person[],
): ReadonlyMap<number, PersonItem[]> {
  const out = new Map<number, PersonItem[]>();
  for (const p of all) {
    if (p.place !== 'room') continue;
    const list = out.get(p.uid);
    const item = personItem(m, p);
    if (list) list.push(item);
    else out.set(p.uid, [item]);
  }
  return out;
}

/**
 * The flat items a room lays first, under everything (rooms.ts: rugs, mats and a hall's runner):
 * a person stands on them, never under them.
 */
const FLAT = /^(rug|runner|mat|bath-mat)(-|$)/;

/**
 * A room's items with its people sorted in among them, back to front: after the rugs, and after
 * every piece whose bottom edge is no lower than their feet (rooms.ts sorts by bottom edge), so
 * what stands in front of them covers them and what stands behind doesn't.
 */
export function withPeople(
  items: readonly Item[],
  extra: readonly Item[] | undefined,
): readonly Item[] {
  if (!extra || extra.length === 0) return items;
  const out = [...items];
  for (const p of extra) {
    const bottom = p.y + artSize(p.sprite).h;
    let i = 0;
    while (i < out.length && FLAT.test(out[i]!.sprite)) i++;
    while (i < out.length && out[i]!.y + artSize(out[i]!.sprite).h <= bottom) i++;
    out.splice(i, 0, p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Waiting at the door, or at the kerb.

/**
 * The spots of `n` members waiting at a front door whose doormat is `mat`, on the house's `side`:
 * each with their suitcase to their right, side by side. Before a south (or north) door they line
 * up across its mat, centered, and kept on the lot; beside a west or east door they stand off the
 * mat's outer edge, clear of the wall, and line up away from the house.
 */
export function doorSpots(
  mat: Rect,
  side: Side,
  n: number,
  lotWidthPx: number,
): { x: number; y: number }[] {
  const half = FIGURE.w / 2;
  const { suitcaseDx, spacing } = WAITING;
  const y = mat.y + mat.h;
  if (side === 'W') {
    // The suitcase's right edge at the mat's: neither touches the wall.
    const x0 = mat.x + mat.w - suitcaseDx - FIGURE.w;
    return Array.from({ length: n }, (_, i) => ({ x: x0 - i * spacing, y }));
  }
  if (side === 'E') {
    return Array.from({ length: n }, (_, i) => ({ x: mat.x + half + i * spacing, y }));
  }
  return lineUp(mat.x + mat.w / 2, y, n, lotWidthPx);
}

/** At the kerb: on the sidewalk below the middle of the house (or of the lot, with no rooms). */
export function kerbSpots(m: HouseModel, n: number): { x: number; y: number }[] {
  const b = m.bounds;
  const mid = b ? (b.x + b.w / 2) * CELL : (m.width * CELL) / 2;
  return lineUp(mid, m.height * CELL + KERB_PX, n, m.width * CELL);
}

/**
 * `n` people with their suitcases side by side, the group centered on `mid` and kept within the
 * lot's width. Each one and their suitcase span [x − 8, x + 18): their pair's middle is x + 5.
 */
function lineUp(mid: number, y: number, n: number, widthPx: number): { x: number; y: number }[] {
  const { suitcaseDx, spacing } = WAITING;
  const half = FIGURE.w / 2;
  const pairW = half + suitcaseDx + FIGURE.w;
  const span = (n - 1) * spacing + pairW;
  // The group's left edge, centered and kept on the lot.
  let left = Math.round(mid - span / 2);
  left = Math.max(0, Math.min(left, widthPx - span));
  return Array.from({ length: n }, (_, i) => ({ x: left + half + i * spacing, y }));
}

/** Where a waiting member's suitcase stands: its top-left, in lot art px. */
export function suitcaseAt(
  p: { x: number; y: number },
  sprite: SpriteId,
): { x: number; y: number } {
  const { h } = artSize(sprite);
  return { x: p.x + WAITING.suitcaseDx, y: p.y + WAITING.suitcaseDy - h };
}

// ---------------------------------------------------------------------------------------------
// Someone else at the door: the client's visit (D-182).

/** A member's figure, in lot art px: [x − 8, x + 8) × [y − 26, y). */
function figureBox(p: { x: number; y: number }): Rect {
  return { x: p.x - FIGURE.w / 2, y: p.y - FIGURE.h, w: FIGURE.w, h: FIGURE.h };
}

/**
 * What the members waiting at the door or the kerb cover, in lot art px: each one's figure and
 * their suitcase. Members in their rooms cover nothing here.
 */
export function waitingBoxes(all: readonly Person[]): Rect[] {
  return all.flatMap((p) => {
    if (p.place === 'room') return [];
    const s = suitcaseAt(p, p.cast.suitcase);
    return [figureBox(p), { x: s.x, y: s.y, ...artSize(p.cast.suitcase) }];
  });
}

/**
 * What the whole household covers, in lot art px: those waiting and their suitcases
 * (waitingBoxes), and the figure of each member in their room, whose doorway can be the front
 * door's own.
 */
export function householdBoxes(all: readonly Person[]): Rect[] {
  return [...waitingBoxes(all), ...all.filter((p) => p.place === 'room').map(figureBox)];
}

/**
 * Whether a figure `size` wide and tall, its feet's middle at `at`, stands on the lot (across it:
 * the kerb's line is on the sidewalk, below it), with no room of the house under its feet, and
 * clear of each of `boxes`.
 */
export function standsClear(
  m: HouseModel,
  at: { x: number; y: number },
  size: { w: number; h: number },
  boxes: readonly Rect[],
): boolean {
  const box = { x: at.x - size.w / 2, y: at.y - size.h, w: size.w, h: size.h };
  if (box.x < 0 || box.x + box.w > m.width * CELL) return false;
  const cy = Math.floor((at.y - 1) / CELL);
  for (let cx = Math.floor(box.x / CELL); cx <= Math.floor((box.x + box.w - 1) / CELL); cx++) {
    if (roomAt(m, cx, cy)) return false;
  }
  return !boxes.some((b) => overlaps(box, b));
}

/**
 * D-182: where one more figure (the client at the door) stands with the members waiting at the
 * front door or the kerb, as people() places them: the next in their line, where a member
 * arriving now would stand, else the place before its first. A west door's line runs west, away
 * from the house, and every other east (doorSpots, lineUp). Each place is kept on the lot, off
 * the house and clear of everyone waiting and their suitcases (standsClear), and passes `also`
 * (the client's own check: their bubble, fx/visit.ts). Null with nobody waiting, or neither place
 * free (an entry set back between two rooms).
 */
export function besideWaiting(
  m: HouseModel,
  all: readonly Person[],
  size: { w: number; h: number },
  also: (at: { x: number; y: number }) => boolean = () => true,
): { x: number; y: number } | null {
  const line = all.filter((p) => p.place !== 'room');
  const first = line[0];
  if (!first) return null;
  const front = m.exits.find((e) => e.kind === 'front');
  const dir = first.place === 'door' && front?.side === 'W' ? -1 : 1;
  const boxes = waitingBoxes(line);
  for (const i of [line.length, -1]) {
    const at = { x: first.x + dir * i * WAITING.spacing, y: first.y };
    if (standsClear(m, at, size, boxes) && also(at)) return at;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The walk in.

/** Yard pieces whose ground is water: a walk never crosses it. */
const WET: ReadonlySet<PieceId> = new Set(['pool', 'hotTub']);

/**
 * What stands in the yard in a walk's way (D-177), as boxes in lot art px: each yard piece's props
 * (yard.ts's items: a parked car, a parasol and its seats, a Fence's pickets, an outbuilding, a
 * bollard), a Pool's or a Hot Tub's water, and each tile of the lot's own features that no piece
 * covers (its Trees, Boulders and water, the Old Shed, a Time Capsule). The house is walkStart's
 * own. The people layer is drawn over all of them, so a walker crossing one would be in front of
 * it, or on the water.
 */
export function walkObstacles(house: HouseState, yard: YardModel): Rect[] {
  const out: Rect[] = [];
  const tile = (x: number, y: number): Rect => ({ x: x * CELL, y: y * CELL, w: CELL, h: CELL });
  for (const l of yard.pieces.values()) {
    for (const it of l.items) out.push({ x: it.x, y: it.y, ...artSize(it.sprite) });
    if (WET.has(l.defId)) for (const c of l.cells) out.push(tile(c.x, c.y));
  }
  const { lot } = house;
  const occ = occupancy(house);
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      if (terrainAt(lot, x, y) && !occ.uids[y * lot.width + x]) out.push(tile(x, y));
    }
  }
  return out;
}

/**
 * Where a member walking in sets off: straight south of their spot, on the road `WALK_FROM_PX`
 * down the street row, so they cross the kerb and the front yard to the door in a straight line.
 * In a front yard deeper than `reach` art px they set off `reach` below their spot, on the way up,
 * so the walk keeps to its longest (FEEL.arrival.walk's `maxMs`). No path is found (D-177):
 * - Where the house stands in that line, under the figure or the suitcase it pulls (a front door
 *   that isn't on the street's side), there's no walk, and null.
 * - Where one of `obstacles` (walkObstacles) is in it, they'd cross it in front of it or on its
 *   water: they set off just north of the nearest, as if from behind it, or, with under `minPx`
 *   left to walk, there's no walk, and null. One wholly behind their spot they pass in front of.
 */
export function walkStart(
  m: HouseModel,
  p: { x: number; y: number },
  reach = Infinity,
  obstacles: readonly Rect[] = [],
  minPx = 0,
): { x: number; y: number } | null {
  const y = Math.min(Math.max(m.height * CELL + WALK_FROM_PX, p.y), p.y + Math.floor(reach));
  const left = p.x - FIGURE.w / 2;
  const right = Math.max(p.x + FIGURE.w / 2, p.x + PULLED.dx + SUITCASE_W);
  const x0 = Math.floor(left / CELL);
  const x1 = Math.floor((right - 1) / CELL);
  for (let cy = Math.max(0, Math.floor((p.y - 1) / CELL)); cy < m.height && cy * CELL < y; cy++) {
    for (let cx = x0; cx <= x1; cx++) if (roomAt(m, cx, cy)) return null;
  }
  // The suitcase's foot is the walk's lowest point: it stays north of what's in the way.
  let from = y;
  for (const o of obstacles) {
    if (o.x < right && o.x + o.w > left && o.y + o.h > p.y && o.y < y + PULLED.dy) {
      from = Math.min(from, o.y - PULLED.dy);
    }
  }
  if (from < y && from - p.y < Math.max(1, minPx)) return null;
  return { x: p.x, y: from };
}

/**
 * The walk's timing for `distance` art px (FEEL.arrival.walk): `ms` long, longer for a deep front
 * yard so it's never faster than `maxPxPerSecond`, and each of the walk cycle's `frames` shown
 * `frameMs`, so the steps keep pace with the ground (a cycle covers `cyclePx`), within
 * [frameMs[0], frameMs[1]].
 */
export function walkPlan(
  distance: number,
  frames: number,
  f: {
    readonly ms: number;
    readonly maxPxPerSecond: number;
    readonly cyclePx: number;
    readonly frameMs: readonly [number, number];
  },
): { ms: number; frameMs: number } {
  const ms = Math.max(f.ms, Math.round((distance / f.maxPxPerSecond) * 1000));
  const speed = distance / (ms / 1000);
  const ideal = speed > 0 ? (f.cyclePx / frames / speed) * 1000 : f.frameMs[1];
  const frameMs = Math.round(Math.min(f.frameMs[1], Math.max(f.frameMs[0], ideal)));
  return { ms, frameMs };
}
