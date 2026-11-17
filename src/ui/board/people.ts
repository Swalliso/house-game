// The household on the board (D-177), the part that decides, kept pure so tests can check it (as
// life.ts is): who of the household is drawn, and where each one stands. Read only: it reads the
// run and the house model and changes nothing, and none of it is the rules.
//
// - A member who has arrived and has one of their rooms built (a placed piece of a type in their
//   ArrivalDef.room) stands in one of its doorways, on the floor the door keeps clear of
//   furniture in every arrangement (Doorway.clear, D-173), facing south. The rooms' items
//   (HouseLayers.tsx) draw them, sorted with the furniture by bottom row, the rows that rise over
//   a wall band behind them on the overhang, as tall furniture's do.
// - One still waiting for a room stands at the front door's doormat with a suitcase, side by side
//   with anyone else waiting, or at the kerb when the house has no front door. PeopleLayer.tsx
//   draws them, and the walk up from the street when the doorbell rings for them.
// - Nobody in the guided first job, and only the members with a cast: the twins wait for one.
//
// Spots are in lot art px (CELL per cell): `x` the figure's middle, `y` the line its feet stand on
// (the sprite's bottom edge), so a figure FIGURE.w wide and FIGURE.h tall covers
// [x − w/2, x + w/2) × [y − h, y).

import { CONTENT, type ArrivalDef, type ArrivalId, type RunState } from '../../rules/index.ts';
import { artSize } from '../art/drawings.ts';
import { wallMask } from '../art/house-paint.ts';
import type { Item } from '../art/rooms.ts';
import { CELL, type SpriteId } from '../sprites.ts';
import { inset, roomAt, type HouseModel, type Rect, type Room, type Side } from './house-model.ts';

/**
 * Who plays each member (art/limezu/people.json): standing (facing south), walking north, and
 * their suitcase.
 */
export interface Cast {
  readonly stand: SpriteId;
  readonly walk: SpriteId;
  readonly suitcase: SpriteId;
}

/**
 * The cast, by arrival (src/content/households.ts). Premade characters the street's walkers don't
 * use: Grandma and Nana grayed, Renfield in his monocle, Rowan in a painter's beanie, and Ivy
 * composed from the character generator's kids' parts. The twins have none yet: they're left out.
 */
export const CAST: Readonly<Partial<Record<ArrivalId, Cast>>> = {
  grandma: {
    stand: 'people-grandma',
    walk: 'people-grandma-walk',
    suitcase: 'people-suitcase-green',
  },
  renfield: {
    stand: 'people-renfield',
    walk: 'people-renfield-walk',
    suitcase: 'people-suitcase-tan',
  },
  nana: { stand: 'people-nana', walk: 'people-nana-walk', suitcase: 'people-suitcase-blue' },
  rowan: { stand: 'people-rowan', walk: 'people-rowan-walk', suitcase: 'people-suitcase-green' },
  ivy: { stand: 'people-ivy', walk: 'people-ivy-walk', suitcase: 'people-suitcase-blue' },
};

/** Every cast figure's size, standing or walking: 16 × 26 art px, its feet on its bottom row. */
export const FIGURE = { w: 16, h: 26 } as const;

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
}

/** The rules' data on a member of this client's household. */
function arrivalDef(state: Pick<RunState, 'setup'>, id: ArrivalId): ArrivalDef | undefined {
  return CONTENT.clients[state.setup.clientId].household.arrivals.find((a) => a.id === id);
}

/**
 * Who of the household is on the board, and where: each member who has arrived and has a cast,
 * in the order they arrived. Nobody in the guided first job (D-149).
 */
export function people(
  state: Pick<RunState, 'setup' | 'arrived'>,
  model: HouseModel,
): readonly Person[] {
  if (state.setup.mode === 'firstJob') return [];
  const out: Person[] = [];
  const waiting: { arrival: ArrivalId; cast: Cast }[] = [];
  for (const id of state.arrived) {
    const cast = CAST[id];
    const def = arrivalDef(state, id);
    if (!cast || !def) continue;
    // Their oldest room, if one is built.
    const room = [...model.rooms.values()].find((r) => def.room.includes(r.defId));
    if (room) {
      const at = doorwaySpot(model, room);
      out.push({ arrival: id, cast, place: 'room', uid: room.uid, ...at });
    } else {
      waiting.push({ arrival: id, cast });
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
 * Where a member stands in their room: in one of its doorways, on the part of the door's clear
 * floor inside the room, facing south. Best first: a door in the room's south wall (they stand at
 * the front of the room), an outside door in it, a door in its north wall (at the back, under the
 * wall's face), an outside door there, and then the side walls, where they stand clear of the
 * wall's band. Ties go to the model's order. A room with no door at all (none could fit) has them
 * at the middle of its floor's south edge.
 */
export function doorwaySpot(m: HouseModel, room: Room): { x: number; y: number } {
  const uid = room.uid;
  const half = FIGURE.w / 2;
  const spots: { x: number; y: number; rank: number }[] = [];
  for (const d of m.doors) {
    if (d.a !== uid && d.b !== uid) continue;
    const { gap, clear } = d;
    if (d.dir === 'h') {
      const mid = gap.x + gap.w / 2;
      // North of the wall: their feet just above its band; south of it, below its face.
      if (d.a === uid) spots.push({ x: mid, y: gap.y, rank: 0 });
      else spots.push({ x: mid, y: clear.y + clear.h, rank: 2 });
    } else {
      // Beside a side wall's door: clear of the band, their feet at the walkway's foot.
      const x = d.a === uid ? gap.x - half : gap.x + gap.w + half;
      spots.push({ x, y: clear.y + clear.h, rank: 4 });
    }
  }
  for (const e of m.exits) {
    if (e.uid !== uid) continue;
    const { gap, clear } = e;
    const mid = gap.x + gap.w / 2;
    if (e.side === 'S') spots.push({ x: mid, y: gap.y, rank: 1 });
    else if (e.side === 'N') spots.push({ x: mid, y: clear.y + clear.h, rank: 3 });
    else if (e.side === 'W') spots.push({ x: gap.x + gap.w + half, y: gap.y + gap.h, rank: 4 });
    else spots.push({ x: gap.x - half, y: gap.y + gap.h, rank: 4 });
  }
  // The first of the best rank (sort is stable).
  const best = spots.sort((p, q) => p.rank - q.rank)[0];
  const spot = best ?? floorFoot(m, room);
  return { x: Math.round(keepOffSideWalls(m, spot.x, spot.y)), y: Math.round(spot.y) };
}

/** The middle of a room's floor's south edge: where a member stands in a room with no door. */
function floorFoot(m: HouseModel, room: Room): { x: number; y: number } {
  const x = room.box.x + room.box.w / 2;
  const cx = Math.floor(x / CELL);
  const cy = (room.box.y + room.box.h) / CELL - 1;
  return { x, y: (cy + 1) * CELL - inset(m, cx, cy, 'S') };
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
 * The line a figure standing at (x, y) rises over: just below the lowest row of wall band under
 * it (house-paint.ts wallMask, the walls canvas's bands): a north wall's, a side wall's that ends
 * above their feet, or the corner where an outside wall turns. Every band under the figure is
 * behind it, north of its feet, so the rows above the line go on the overhang, over the walls, as
 * a tall piece of furniture's do (Item.over). Undefined when no band is under the figure.
 */
export function overLine(m: HouseModel, x: number, y: number): number | undefined {
  const box = { x: x - FIGURE.w / 2, y: y - FIGURE.h, w: FIGURE.w, h: FIGURE.h };
  const mask = wallMask(m, box);
  for (let row = y - 1; row >= box.y; row--) {
    for (let col = box.x; col < box.x + box.w; col++) if (mask.has(col, row)) return row + 1;
  }
  return undefined;
}

/** A member in their room as one of its items: their standing sprite, at their spot. */
export function personItem(m: HouseModel, p: Person): Item {
  const item: Item = { sprite: p.cast.stand, x: p.x - FIGURE.w / 2, y: p.y - FIGURE.h };
  const over = overLine(m, p.x, p.y);
  if (over !== undefined) item.over = over;
  return item;
}

/** The members in rooms, as items by room uid. */
export function roomPeople(m: HouseModel, all: readonly Person[]): ReadonlyMap<number, Item[]> {
  const out = new Map<number, Item[]>();
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
// The walk in.

/**
 * Where a member walking in sets off: straight south of their spot, on the road `WALK_FROM_PX`
 * down the street row, so they cross the kerb and the front yard to the door in a straight line.
 * In a front yard deeper than `reach` art px they set off `reach` below their spot, on the way up,
 * so the walk keeps to its longest (FEEL.arrival.walk's `maxMs`). No path is found (D-177): where
 * the house stands in that line, under the figure or the suitcase it pulls (a front door that
 * isn't on the street's side), there's no walk, and null.
 */
export function walkStart(
  m: HouseModel,
  p: { x: number; y: number },
  reach = Infinity,
): { x: number; y: number } | null {
  const y = Math.min(Math.max(m.height * CELL + WALK_FROM_PX, p.y), p.y + Math.floor(reach));
  const x0 = Math.floor((p.x - FIGURE.w / 2) / CELL);
  const x1 = Math.floor((p.x + PULLED.dx + SUITCASE_W - 1) / CELL);
  for (let cy = Math.max(0, Math.floor((p.y - 1) / CELL)); cy < m.height && cy * CELL < y; cy++) {
    for (let cx = x0; cx <= x1; cx++) if (roomAt(m, cx, cy)) return null;
  }
  return { x: p.x, y };
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
