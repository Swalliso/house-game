// The enclosure probe (§8, "Fences pay their way") and the fence planner for packs (D-106).
//
// A fenced yard is an area that borders the house and a Fence, doesn't touch the street edge,
// and has at least `fencedYardMin` tiles (§4). Both tools try every small rectangle (up to
// 6×6) next to the house: its free tiles are the yard R, and every non-wall tile touching R
// from outside must become Fence. Since D-106 one Fence card places up to `maxTiles` connected
// tiles as one piece, so that boundary is joined into one run (adding a corner tile where two
// sides meet only diagonally) and, if it fits one pack, becomes one placement.
//
// - enclosureCost(): the fewest Fence cards that would close a yard by this house, confirmed
//   with the rules' own fenced-yard check. It measures the cost greedy can't plan for.
// - fencePlans(): legal pack placements that each close a yard by themselves, for the greedy
//   bot to score exactly (the first Fence earns nothing until its yard closes).
// - openGround(): the Fence plays out in the open, which the rules' estimate can't tell apart
//   (D-161), so the bots rank only a few of them.

import type {
  HouseState,
  PieceDef,
  PieceId,
  PlaceAction,
  Rules,
  RunState,
} from '../src/rules/index.ts';
import { cellsToShape, placedCells, terrainAt } from '../src/rules/index.ts';

export interface EnclosureCost {
  /** Fence cards (packs) needed. */
  placements: number;
  /** Fence tiles on the yard's boundary, with the corners that join it into one run. */
  boundary: number;
  /** Tiles in the yard it would make. */
  yard: number;
}

const MAX_SIDE = 6;
const MAX_PLACEMENTS = 6;
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

interface Grid {
  W: number;
  H: number;
  indoor: Uint8Array;
  wall: Uint8Array;
  /** Tiles a Fence can't go on: pieces, water, boulders. */
  noFence: Uint8Array;
}

function gridOf(rules: Rules, house: HouseState): Grid {
  const content = rules.content;
  const { lot } = house;
  const W = lot.width;
  const H = lot.height;
  const N = W * H;
  const indoor = new Uint8Array(N);
  const wall = new Uint8Array(N);
  const noFence = new Uint8Array(N);
  for (const p of house.pieces) {
    const def = content.pieces[p.defId];
    for (const c of placedCells(p.shape ?? def.shape, p.x, p.y, p.rot)) {
      const i = c.y * W + c.x;
      noFence[i] = 1;
      if (def.category === 'indoor') indoor[i] = 1;
      if (def.category === 'indoor' || def.wall) wall[i] = 1;
    }
  }
  for (let i = 0; i < N; i++) {
    const t = terrainAt(lot, i % W, Math.floor(i / W));
    if (t && content.features[t].blocks && content.features[t].clear !== 'buildOver')
      noFence[i] = 1;
  }
  return { W, H, indoor, wall, noFence };
}

/**
 * Candidate yards: rectangles next to the house, with the boundary they'd need fenced, the
 * shortest boundaries first. With `maxBoundary`, only those whose boundary is no longer: the
 * planner's one-pack runs (D-161). Each rectangle's free tiles and tiles beside the house are
 * counted from prefix sums, and its boundary is walked along its edge, stopping at the first
 * tile too many or that can't take a Fence, so the many rectangles that can't qualify cost
 * little. The yards, boundaries, and their order are as tile-by-tile sets would give them.
 */
function candidateYards(
  rules: Rules,
  g: Grid,
  maxBoundary = Infinity,
): { yard: number[]; boundary: number[] }[] {
  const { W, H, indoor, wall, noFence } = g;
  const minYard = rules.content.balance.fencedYardMin;
  const candidates: { yard: number[]; boundary: number[] }[] = [];
  // A yard must touch the house, so its rectangle starts within MAX_SIDE of the house's box.
  let hx0 = W;
  let hy0 = H;
  let hx1 = -1;
  let hy1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (!indoor[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    hx0 = Math.min(hx0, x);
    hy0 = Math.min(hy0, y);
    hx1 = Math.max(hx1, x);
    hy1 = Math.max(hy1, y);
  }
  if (hx1 < 0) return candidates;
  // Prefix sums of the free (non-wall) tiles, and of the free tiles beside an indoor one.
  const P = W + 1;
  const free = new Int32Array(P * (H + 1));
  const byHouse = new Int32Array(P * (H + 1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const f = wall[i] ? 0 : 1;
      let b = 0;
      if (f) {
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && indoor[ny * W + nx]) b = 1;
        }
      }
      const k = (y + 1) * P + x + 1;
      free[k] = f + free[k - P]! + free[k - 1]! - free[k - P - 1]!;
      byHouse[k] = b + byHouse[k - P]! + byHouse[k - 1]! - byHouse[k - P - 1]!;
    }
  }
  const inRect = (s: Int32Array, x0: number, y0: number, w: number, h: number) =>
    s[(y0 + h) * P + x0 + w]! - s[y0 * P + x0 + w]! - s[(y0 + h) * P + x0]! + s[y0 * P + x0]!;
  for (let y0 = Math.max(0, hy0 - MAX_SIDE); y0 <= Math.min(H - 1, hy1 + 1); y0++) {
    for (let x0 = Math.max(0, hx0 - MAX_SIDE); x0 <= Math.min(W - 1, hx1 + 1); x0++) {
      for (let h = 1; h <= MAX_SIDE && y0 + h <= H - 1; h++) {
        for (let w = 1; w <= MAX_SIDE && x0 + w <= W; w++) {
          if (w * h < minYard) continue;
          if (inRect(free, x0, y0, w, h) < minYard) continue;
          // It touches the house: one of its free tiles is beside an indoor tile.
          if (inRect(byHouse, x0, y0, w, h) === 0) continue;
          const x1 = x0 + w - 1;
          const y1 = y0 + h - 1;
          // Only edge tiles have neighbors outside the rectangle, and each tile outside it
          // borders at most one tile in it, so the boundary has no repeats. Row by row, as
          // the yard's tiles run.
          const boundary: number[] = [];
          let ok = true;
          edge: for (let y = y0; y <= y1; y++) {
            const step = y === y0 || y === y1 || w === 1 ? 1 : w - 1;
            for (let x = x0; x <= x1; x += step) {
              if (wall[y * W + x]) continue;
              for (const [dx, dy] of DIRS) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) continue;
                const j = ny * W + nx;
                if (wall[j]) continue;
                if (noFence[j] || boundary.length >= maxBoundary) {
                  ok = false;
                  break edge;
                }
                boundary.push(j);
              }
            }
          }
          if (!ok) continue;
          const yard: number[] = [];
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) if (!wall[y * W + x]) yard.push(y * W + x);
          if (!connected(yard, new Set(yard), W)) continue;
          candidates.push({ yard, boundary });
        }
      }
    }
  }
  return candidates.sort((a, b) => a.boundary.length - b.boundary.length);
}

/**
 * Joins a yard's boundary tiles into one orthogonally connected run by adding corner tiles
 * (free, not in the yard) that touch two of its pieces. Null if it can't be joined.
 */
function joinRun(g: Grid, boundary: readonly number[], yard: ReadonlySet<number>): number[] | null {
  const { W, H, wall, noFence } = g;
  const tiles = new Set(boundary);
  for (let guard = 0; guard < 16; guard++) {
    const comp = components(tiles, W);
    if (comp.count <= 1) return [...tiles];
    let added = false;
    for (const t of [...tiles]) {
      const x = t % W;
      const y = Math.floor(t / W);
      // The two orthogonal tiles beside a diagonal neighbor of t.
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const d = (y + dy) * W + (x + dx);
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
        if (!tiles.has(d) || comp.of.get(d) === comp.of.get(t)) continue;
        for (const c of [y * W + (x + dx), (y + dy) * W + x]) {
          if (tiles.has(c) || yard.has(c) || wall[c] || noFence[c]) continue;
          tiles.add(c);
          added = true;
          break;
        }
        if (added) break;
      }
      if (added) break;
    }
    if (!added) return null;
  }
  return null;
}

function components(
  tiles: ReadonlySet<number>,
  W: number,
): { count: number; of: Map<number, number> } {
  const of = new Map<number, number>();
  let count = 0;
  for (const start of tiles) {
    if (of.has(start)) continue;
    const id = count++;
    of.set(start, id);
    const stack = [start];
    while (stack.length > 0) {
      const i = stack.pop()!;
      for (const j of [i + 1, i - 1, i + W, i - W]) {
        if (Math.abs((j % W) - (i % W)) > 1) continue;
        if (tiles.has(j) && !of.has(j)) {
          of.set(j, id);
          stack.push(j);
        }
      }
    }
  }
  return { count, of };
}

function connected(yard: readonly number[], inYard: ReadonlySet<number>, W: number): boolean {
  const seen = new Set<number>([yard[0]!]);
  const stack = [yard[0]!];
  while (stack.length > 0) {
    const i = stack.pop()!;
    for (const j of [i + 1, i - 1, i + W, i - W]) {
      if (Math.abs((j % W) - (i % W)) > 1) continue;
      if (inYard.has(j) && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === yard.length;
}

/** The Fence pack card's definition. */
function fenceDef(rules: Rules): PieceDef | null {
  return (
    Object.values(rules.content.pieces).find((d) => d.wall && d.pack && d.drawWeight > 0) ?? null
  );
}

/** A Fence run as one pack placement. */
function asPlay(
  from: 'hand' | 'reserve',
  i: number,
  tiles: readonly number[],
  W: number,
): PlaceAction {
  const { x, y, shape } = cellsToShape(tiles.map((t) => ({ x: t % W, y: Math.floor(t / W) })));
  return { t: 'place', from, i, x, y, rot: 0, shape };
}

export function enclosureCost(rules: Rules, state: RunState): EnclosureCost | null {
  const def = fenceDef(rules);
  if (!def?.pack) return null;
  const g = gridOf(rules, state.house);
  const before = rules.fencedYards(state).length;
  let best: EnclosureCost | null = null;
  for (const cand of candidateYards(rules, g)) {
    const run = joinRun(g, cand.boundary, new Set(cand.yard));
    // A run that won't join takes a pack per piece of it; one that joins, a pack per maxTiles.
    const tiles = run ?? cand.boundary;
    const packs = run
      ? Math.ceil(run.length / def.pack.maxTiles)
      : components(new Set(cand.boundary), g.W).count +
        Math.floor(cand.boundary.length / (def.pack.maxTiles + 1));
    if (packs > MAX_PLACEMENTS) continue;
    if (
      best &&
      (packs > best.placements || (packs === best.placements && tiles.length >= best.boundary))
    ) {
      continue;
    }
    // Confirm with the rules: the house plus these Fence tiles (as packs) has a new fenced yard.
    const pieces = [...state.house.pieces];
    let nextUid = state.house.nextUid;
    for (const t of tiles) {
      pieces.push({
        uid: nextUid++,
        defId: def.id,
        x: t % g.W,
        y: Math.floor(t / g.W),
        rot: 0,
        placedWeek: state.week,
        shape: ['#'],
      });
    }
    const house: HouseState = { ...state.house, pieces, nextUid };
    if (rules.fencedYards({ ...state, house }).length <= before) continue;
    best = { placements: packs, boundary: tiles.length, yard: cand.yard.length };
  }
  return best;
}

/**
 * Legal Fence pack placements, from the hand or the reserve card at `i`, that each close a
 * new yard by themselves: the shortest runs first, at most `limit`.
 */
export function fencePlans(
  rules: Rules,
  state: RunState,
  from: 'hand' | 'reserve',
  i: number,
  limit = 8,
): PlaceAction[] {
  const card = from === 'hand' ? state.hand[i] : state.reserve[i];
  const id = card && ('kind' in card ? (card.kind === 'piece' ? card.id : null) : card.id);
  const def = id ? rules.content.pieces[id] : null;
  if (!def?.wall || !def.pack) return [];
  const runs = closingRuns(rules, state.house, def.pack.maxTiles);
  const out: PlaceAction[] = [];
  for (const run of runs) {
    if (out.length >= limit) break;
    const play = asPlay(from, i, run.tiles, run.W);
    if (rules.checkPlay(state, play).legal) out.push(play);
  }
  return out;
}

/** The Fence runs (one pack each) that would close a yard by this house, cached per house. */
const runsCache = new WeakMap<HouseState, Map<number, { tiles: number[]; W: number }[]>>();

function closingRuns(rules: Rules, house: HouseState, maxTiles: number) {
  let perHouse = runsCache.get(house);
  if (!perHouse) runsCache.set(house, (perHouse = new Map()));
  let runs = perHouse.get(maxTiles);
  if (runs) return runs;
  const g = gridOf(rules, house);
  runs = [];
  const seen = new Set<string>();
  for (const cand of candidateYards(rules, g, maxTiles)) {
    const run = joinRun(g, cand.boundary, new Set(cand.yard));
    if (!run || run.length > maxTiles) continue;
    const key = [...run].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    runs.push({ tiles: run, W: g.W });
  }
  perHouse.set(maxTiles, runs);
  return runs;
}

// ---------------------------------------------------------------------------------------
// Open ground (D-161): Fence plays the rules' estimate values alike.

/**
 * The tiles around a shape, diagonals too, as offsets from its corner: each marked 1 if it's
 * beside one of the shape's tiles, with the indices of its orthogonal neighbors among them.
 */
interface Ring {
  tiles: readonly (readonly [dx: number, dy: number, beside: number])[];
  next: readonly (readonly number[])[];
  /** The shape's height: a play whose last row is the lot's has a tile on the street row. */
  h: number;
  /** Every tile's bit, and whether the whole ring is connected (it is round a polyomino). */
  all: number;
  joined: boolean;
}

const rings = new Map<string, Ring>();

function ringOf(shape: readonly string[]): Ring {
  const key = shape.join('/');
  let ring = rings.get(key);
  if (ring) return ring;
  const cells = placedCells(shape, 0, 0, 0);
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  const around = new Map<string, [number, number, number]>();
  for (const c of cells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${c.x + dx},${c.y + dy}`;
        if (own.has(k)) continue;
        const beside = dx === 0 || dy === 0 ? 1 : 0;
        const t = around.get(k);
        if (t) t[2] ||= beside;
        else around.set(k, [c.x + dx, c.y + dy, beside]);
      }
    }
  }
  const tiles = [...around.values()];
  const index = new Map(tiles.map(([x, y], k) => [`${x},${y}`, k]));
  const next = tiles.map(([x, y]) =>
    DIRS.map(([dx, dy]) => index.get(`${x + dx},${y + dy}`)).filter((k) => k !== undefined),
  );
  const all = tiles.length > 30 ? 0 : (1 << tiles.length) - 1;
  ring = { tiles, next, h: shape.length, all, joined: all !== 0 && reached(next, all, 0) === all };
  rings.set(key, ring);
  return ring;
}

/** The ring's tiles in `kept` (bits) that `from` reaches through tiles in `kept`. */
function reached(next: Ring['next'], kept: number, from: number): number {
  let seen = 1 << from;
  const stack = [from];
  while (stack.length > 0) {
    for (const k of next[stack.pop()!]!) {
      if (kept & (1 << k) && !(seen & (1 << k))) {
        seen |= 1 << k;
        stack.push(k);
      }
    }
  }
  return seen;
}

/**
 * A house's tiles for openGround: 1 in `piece` under any piece, in `wall` under an indoor
 * piece or a Fence (what bounds a fenced yard), and in `open` on the tiles that reach the
 * street row without crossing a wall.
 */
interface Ground {
  W: number;
  H: number;
  piece: Uint8Array;
  wall: Uint8Array;
  open: Uint8Array;
}

const grounds = new WeakMap<HouseState, Ground>();

function groundOf(rules: Rules, house: HouseState): Ground {
  let g = grounds.get(house);
  if (g) return g;
  const W = house.lot.width;
  const H = house.lot.height;
  const piece = new Uint8Array(W * H);
  const wall = new Uint8Array(W * H);
  for (const p of house.pieces) {
    const def = rules.content.pieces[p.defId];
    for (const c of placedCells(p.shape ?? def.shape, p.x, p.y, p.rot)) {
      piece[c.y * W + c.x] = 1;
      if (def.category === 'indoor' || def.wall) wall[c.y * W + c.x] = 1;
    }
  }
  const open = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let i = (H - 1) * W; i < W * H; i++) {
    if (wall[i]) continue;
    open[i] = 1;
    stack.push(i);
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (wall[j] || open[j]) continue;
      open[j] = 1;
      stack.push(j);
    }
  }
  g = { W, H, piece, wall, open };
  grounds.set(house, g);
  return g;
}

/** A yard wall pack that earns only through its yard: the Fence. */
const yardOnlyWall = (def: PieceDef): boolean =>
  !!def.wall &&
  !!def.pack &&
  def.category === 'yard' &&
  def.effects.every((e) => e.kind === 'enclosure');

/**
 * Which of these plays are a Fence pack's on open ground (D-161), as a mask: none of its tiles
 * touches a piece, and the tiles around them (diagonals too) that are on the lot and aren't
 * walls make one connected ring that reaches the street, through a tile on the street row if
 * the play has one there. The rules' estimate values all of a card's such plays alike, with no
 * hint: the Fence earns only through its yard (D-106), its checklist lines don't depend on
 * where it stands, and no neighbor gains or loses by it. It can't close a yard either: every
 * region beside its tiles holds a tile of the ring, so they're one region, and that region
 * still reaches the street, since a way there through the new tiles leaves them by the ring.
 * (greedy.test.ts holds the estimate to all this.)
 */
export function openGround(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
): Uint8Array {
  const out = new Uint8Array(plays.length);
  const yardOnly = (id: PieceId | null) => !!id && yardOnlyWall(rules.content.pieces[id]);
  const hand = state.hand.map((c) => yardOnly(c.kind === 'piece' ? c.id : null));
  const reserve = state.reserve.map((r) => yardOnly(r.id));
  if (!hand.includes(true) && !reserve.includes(true)) return out;
  const g = groundOf(rules, state.house);
  for (let n = 0; n < plays.length; n++) {
    const p = plays[n]!;
    if (!p.shape || !(p.from === 'hand' ? hand : reserve)[p.i]) continue;
    const ring = ringOf(p.shape);
    if (ring.all === 0) continue;
    // The ring's tiles left on the lot that aren't walls, as bits; a wall beside it is a piece.
    let kept = 0;
    let first = -1;
    let tile = -1;
    let street = p.y + ring.h < g.H;
    let near = false;
    for (let k = 0; k < ring.tiles.length; k++) {
      const [dx, dy, beside] = ring.tiles[k]!;
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
      const i = y * g.W + x;
      if (beside && g.piece[i]) {
        near = true;
        break;
      }
      if (g.wall[i]) continue;
      kept |= 1 << k;
      if (first < 0) [first, tile] = [k, i];
      if (y === g.H - 1) street = true;
    }
    if (near || first < 0 || !street || !g.open[tile]) continue;
    const joined = kept === ring.all ? ring.joined : reached(ring.next, kept, first) === kept;
    if (joined) out[n] = 1;
  }
  return out;
}
