// The stepping stones from the front door's mat to the kerb (D-217): ground no one piece owns,
// painted on the floor canvas with the yard's (yard.ts YardModel.path, house-paint.ts), under
// everything that stands. Built from the house by fixed rules and hashes, never by chance, so the
// same house always lays the same stones. Pure: no DOM.
//
// - The walk leaves the door's mat and runs straight toward the street as the household walks in
//   (D-177, board/people.ts walkStart: straight up from the street to the mat), for as long as
//   that's no further from the street, so whoever walks up walks on it. Then it goes round what
//   stands in its way, cell by cell, the shortest way to the kerb.
// - It crosses open ground and Lawns on stones, and a Patio, a Driveway or a Porch on their own
//   paving, with no stones there. It never crosses a room, a Tree, a Boulder, the water, the Old
//   Shed, a Time Capsule, a Fence or any other yard piece, or a cell with something standing in
//   its middle (a parked car, a Sprinkler, a bollard, a parasol). Where nothing reaches the
//   street (a fenced front yard, a creek across the lot), it goes as near the street as it can:
//   to the fence, as if to its gate, or down to the water.
// - Each stone keeps its whole box on open ground or a Lawn, and off every item, every outside
//   door's mat and opening, and a Bay Window's bay, so all of it shows; where it can't, there's
//   none. No front door, or one onto the sidewalk, lays none.

import { CONTENT, terrainAt, type HouseState, type PieceId } from '../../rules/index.ts';
import { occupancy } from '../board/geometry.ts';
import { grow, overlaps, uidHash, type HouseModel, type Rect } from '../board/house-model.ts';
import { CELL } from '../sprites.ts';
import { artSize, type DrawingId } from './drawings.ts';
import type { Ground, YardLayout } from './yard.ts';

/** The stones' four shapes (drawings.ts). */
export const STONES: readonly DrawingId[] = [
  'own-stone-0',
  'own-stone-1',
  'own-stone-2',
  'own-stone-3',
];

/**
 * How the stones are laid, in art px: `pitch` from one to the next where the walk runs toward the
 * street, `across` more where it runs along it (a stone is wider than it is deep); each a little
 * to one side of the walk's line and then the other (`stagger`), and up to `jitter` along it; the
 * first `gap` from the mat.
 */
export const STEPPING = { pitch: 12, across: 4, stagger: 3, jitter: 1, gap: 2 } as const;

/**
 * How the walk finds its way, in cells: a step back away from the street costs `north` steps, so
 * it turns back only round what it must; a way to the street more than `detour` steps longer than
 * straight down isn't taken (it would lead off round the house or the yard, away from the street),
 * and the walk goes as near the street as it can instead. There, it's laid only with `fewest`
 * stones or more, so a door boxed in by trees or a fence a step away gets none.
 */
export const WAYFINDING = { north: 3, detour: 10, fewest: 3 } as const;

/** What a step costs (WAYFINDING): √2 on the diagonal, and more back away from the street. */
const cost = (dx: number, dy: number) =>
  (dx && dy ? Math.SQRT2 : 1) * (dy < 0 ? WAYFINDING.north : 1);

/** Yard pieces the walk crosses on their own paving: no stones on them. */
const PAVED: ReadonlySet<PieceId> = new Set(['patio', 'driveway', 'porch']);
/** Yard pieces whose grass takes stones, as open ground does. */
const GRASS: ReadonlySet<PieceId> = new Set(['lawn']);

/** A cell the walk may cross: on stones, or on a piece's own paving. */
type Way = 'stones' | 'paved';

interface Point {
  x: number;
  y: number;
}

const DIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
];

/** One step toward each side of the house. */
const OUT: Readonly<Record<'N' | 'E' | 'S' | 'W', readonly [number, number]>> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

/**
 * The stepping stones for the house `m` was built from, as ground ops in lot art px: the stones
 * from its front door's mat to the kerb, or as near it as they go. `pieces` are its yard pieces'
 * layouts (yard.ts), whose items the walk goes round. Empty with no front door, or one whose mat
 * is on the sidewalk.
 */
export function walkway(
  house: HouseState,
  m: HouseModel,
  pieces: ReadonlyMap<number, YardLayout>,
): Ground[] {
  const front = m.exits.find((e) => e.kind === 'front');
  if (!front) return [];
  const { width: W, height: H } = house.lot;
  const occ = occupancy(house);
  // What a stone keeps off: every item's box, every outside door's mat and opening, a bay.
  const items: Rect[] = [];
  for (const l of pieces.values()) {
    for (const it of l.items) items.push({ x: it.x, y: it.y, ...artSize(it.sprite) });
  }
  const keepOff: Rect[] = [
    ...items,
    ...m.exits.flatMap((e) => [grow(e.mat, 1), grow(e.gap, 1)]),
    ...m.windows.flatMap((w) => (w.bay ? [w.bay] : [])),
  ];

  // Each cell's way across, or null where the walk can't go.
  const ways: (Way | null)[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const uid = occ.uids[y * W + x]!;
      const p = uid ? occ.byUid.get(uid) : undefined;
      let way: Way | null;
      if (p) {
        const kind = CONTENT.pieces[p.defId].countsAs ?? p.defId;
        way = GRASS.has(kind) ? 'stones' : PAVED.has(kind) ? 'paved' : null;
      } else {
        way = terrainAt(house.lot, x, y) ? null : 'stones';
      }
      // Something standing in the cell's middle is in the way.
      const mid = { x: x * CELL + 6, y: y * CELL + 6, w: CELL - 12, h: CELL - 12 };
      if (way && items.some((r) => overlaps(r, mid))) way = null;
      ways.push(way);
    }
  }
  const wayAt = (x: number, y: number): Way | null =>
    x < 0 || y < 0 || x >= W || y >= H ? null : ways[y * W + x]!;

  // The cell outside the front door, where its mat lies. Off the lot (a mat on the sidewalk) or
  // where the walk can't go, there are no stones.
  const [ox, oy] = OUT[front.side];
  const start = { x: front.cell.x + ox, y: front.cell.y + oy };
  if (!wayAt(start.x, start.y)) return [];

  // The way to the kerb: each cell's distance from the street, and where none reaches it, from
  // the cell nearest the street the walk can reach from the door.
  let dist = distances(W, H, wayAt, (x, y) => y === H - 1);
  const toStreet = dist[start.y * W + start.x]! <= H - 1 - start.y + WAYFINDING.detour;
  if (!toStreet) {
    const goal = nearestTheStreet(W, H, wayAt, start);
    dist = distances(W, H, wayAt, (x, y) => x === goal.x && y === goal.y);
  }
  const route = path(W, wayAt, dist, start);

  // The walk's line, in lot art px: from the mat's outer edge, through the cells' middles (the
  // door's middle while it runs straight on below a door in a north or south wall), to the kerb.
  const mat = front.mat;
  const flat = front.side === 'N' || front.side === 'S';
  const from: Point =
    front.side === 'S'
      ? { x: mat.x + mat.w / 2, y: mat.y + mat.h }
      : front.side === 'N'
        ? { x: mat.x + mat.w / 2, y: mat.y }
        : front.side === 'W'
          ? { x: mat.x, y: mat.y + mat.h / 2 }
          : { x: mat.x + mat.w, y: mat.y + mat.h / 2 };
  const mid = (c: Point): Point => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 });
  const line: Point[] = [from];
  // Out from a side door to the middle of the cell beside it, before it turns.
  if (!flat) line.push({ x: mid(start).x, y: from.y });
  let straight = true;
  for (const c of route) {
    straight &&= c.x === start.x;
    const p = mid(c);
    line.push(straight && flat ? { x: from.x, y: p.y } : p);
  }
  const last = line[line.length - 1]!;
  if (toStreet) line.push({ x: last.x, y: H * CELL });
  const smooth = chaikin(chaikin(dedupe(line)));

  // The stones along it, each wholly on stone ground and clear of everything that stands.
  const stoneGround = (r: Rect) => {
    if (r.x < 0 || r.y < 0 || r.x + r.w > W * CELL || r.y + r.h > H * CELL) return false;
    for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.h - 1) / CELL); cy++) {
      for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.w - 1) / CELL); cx++) {
        if (wayAt(cx, cy) !== 'stones') return false;
      }
    }
    return !keepOff.some((k) => overlaps(k, r));
  };
  const seed = (front.cell.y * W + front.cell.x) * 4 + 'NESW'.indexOf(front.side);
  const out: Ground[] = [];
  // `s` is how far along the line each stone starts.
  let s = STEPPING.gap;
  for (let k = 0; ; k++) {
    const hash = uidHash(seed * 256 + k, 31);
    const sprite = STONES[hash % STONES.length]!;
    const { w, h } = artSize(sprite);
    const here = pointAt(smooth, s);
    if (!here) break;
    // How much of the line the stone's face (all but its shadow's row) takes, and its middle.
    const reach = Math.abs(here.dir.x) * w + Math.abs(here.dir.y) * (h - 1);
    const at = pointAt(smooth, s + reach / 2);
    if (!at) break;
    const { p, dir } = at;
    // To one side of the line and then the other, and a pixel or so along it.
    const side = (k % 2 === 0 ? -1 : 1) * STEPPING.stagger;
    const along = ((hash >>> 8) % (2 * STEPPING.jitter + 1)) - STEPPING.jitter;
    const cx = p.x - dir.y * side + dir.x * along;
    const cy = p.y + dir.x * side + dir.y * along;
    const box = { x: Math.round(cx - w / 2), y: Math.round(cy - (h - 1) / 2), w, h };
    if (stoneGround(box)) out.push({ op: 'sprite', sprite, x: box.x, y: box.y });
    s += STEPPING.pitch + STEPPING.across * Math.abs(here.dir.x);
  }
  return toStreet || out.length >= WAYFINDING.fewest ? out : [];
}

/**
 * Each cell's distance to the nearest goal cell, over the cells the walk may cross: a step to a
 * side 1, a step on the diagonal √2 where both cells beside it may be crossed too (it never cuts
 * a corner), and a step back away from the street more (cost). Infinity where no goal is reached.
 */
function distances(
  W: number,
  H: number,
  wayAt: (x: number, y: number) => Way | null,
  goal: (x: number, y: number) => boolean,
  way: 1 | -1 = 1,
): Float64Array {
  const dist = new Float64Array(W * H).fill(Infinity);
  const done = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (wayAt(x, y) && goal(x, y)) dist[y * W + x] = 0;
  }
  for (;;) {
    let i = -1;
    for (let j = 0; j < W * H; j++) {
      if (!done[j] && dist[j]! < Infinity && (i < 0 || dist[j]! < dist[i]!)) i = j;
    }
    if (i < 0) break;
    done[i] = 1;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of DIRS) {
      if (!step(wayAt, x, y, dx, dy)) continue;
      // Toward the goals the walk steps from there to here, the other way; from them, this way.
      const j = (y + dy) * W + x + dx;
      const d = dist[i]! + cost(-dx * way, -dy * way);
      if (d < dist[j]!) dist[j] = d;
    }
  }
  return dist;
}

/** Whether the walk may step from (x, y) by (dx, dy): onto a cell it crosses, never cutting a corner. */
function step(
  wayAt: (x: number, y: number) => Way | null,
  x: number,
  y: number,
  dx: number,
  dy: number,
): boolean {
  if (!wayAt(x + dx, y + dy)) return false;
  return !(dx && dy) || (!!wayAt(x + dx, y) && !!wayAt(x, y + dy));
}

/**
 * Where no way reaches the street near enough: the cell nearest the street that the walk reaches
 * from `start` within WAYFINDING.detour steps more than straight on toward it; of those the one
 * the walk reaches soonest, then the nearest the door's column, then the westmost.
 */
function nearestTheStreet(
  W: number,
  H: number,
  wayAt: (x: number, y: number) => Way | null,
  start: Point,
): Point {
  // Each cell's distance from the door: the walk's steps from there, so the other way round.
  const from = distances(W, H, wayAt, (x, y) => x === start.x && y === start.y, -1);
  let best = start;
  let bestD = 0;
  for (let y = start.y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = from[y * W + x]!;
      if (d > y - start.y + WAYFINDING.detour) continue;
      const better =
        y > best.y ||
        (y === best.y &&
          (d < bestD - 1e-9 ||
            (Math.abs(d - bestD) <= 1e-9 &&
              (Math.abs(x - start.x) < Math.abs(best.x - start.x) ||
                (Math.abs(x - start.x) === Math.abs(best.x - start.x) && x < best.x)))));
      if (better) {
        best = { x, y };
        bestD = d;
      }
    }
  }
  return best;
}

/**
 * The cells from `start` to the goal, down the distances: straight toward the street first (as
 * the household walks in) while that's no further from it, then each step one on a shortest way,
 * keeping on as it was going where it can, else toward the street, else toward the door's column.
 */
function path(
  W: number,
  wayAt: (x: number, y: number) => Way | null,
  dist: Float64Array,
  start: Point,
): Point[] {
  const d = (x: number, y: number) => dist[y * W + x]!;
  const out: Point[] = [start];
  let cur = start;
  let dir: readonly [number, number] = [0, 1];
  // Straight on toward the street.
  while (d(cur.x, cur.y) > 0 && step(wayAt, cur.x, cur.y, 0, 1)) {
    if (d(cur.x, cur.y + 1) > d(cur.x, cur.y) + 1e-9) break;
    cur = { x: cur.x, y: cur.y + 1 };
    out.push(cur);
  }
  // Then down the distances, a step at a time.
  while (d(cur.x, cur.y) > 0) {
    let best: { c: Point; dir: readonly [number, number]; rank: number } | null = null;
    for (const s of DIRS) {
      const [dx, dy] = s;
      if (!step(wayAt, cur.x, cur.y, dx, dy)) continue;
      if (cost(dx, dy) + d(cur.x + dx, cur.y + dy) > d(cur.x, cur.y) + 1e-9) continue;
      const c = { x: cur.x + dx, y: cur.y + dy };
      const rank =
        (dx === dir[0] && dy === dir[1] ? 0 : 4) +
        (dy > 0 ? 0 : 2) +
        (Math.abs(c.x - start.x) < Math.abs(cur.x - start.x) ? 0 : 1);
      if (!best || rank < best.rank) best = { c, dir: s, rank };
    }
    if (!best) break;
    cur = best.c;
    dir = best.dir;
    out.push(cur);
  }
  return out;
}

/** The line without a point repeated. */
function dedupe(line: readonly Point[]): Point[] {
  return line.filter((p, i) => i === 0 || p.x !== line[i - 1]!.x || p.y !== line[i - 1]!.y);
}

/** The line with its corners cut (Chaikin's): each bend eased, its ends kept. */
function chaikin(line: readonly Point[]): Point[] {
  if (line.length < 3) return [...line];
  const out: Point[] = [line[0]!];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    if (i > 0) out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    if (i < line.length - 2) out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  out.push(line[line.length - 1]!);
  return dedupe(out);
}

/** The point `s` art px along the line, and the way it runs there; null past its end. */
function pointAt(line: readonly Point[], s: number): { p: Point; dir: Point } | null {
  let left = s;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    if (left <= len) {
      const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      return { p: { x: a.x + dir.x * left, y: a.y + dir.y * left }, dir };
    }
    left -= len;
  }
  return null;
}
