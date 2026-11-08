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

import type { HouseState, PieceDef, PlaceAction, Rules, RunState } from '../src/rules/index.ts';
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

/** Candidate yards: rectangles next to the house, with the boundary they'd need fenced. */
function candidateYards(rules: Rules, g: Grid): { yard: number[]; boundary: number[] }[] {
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
  for (let y0 = Math.max(0, hy0 - MAX_SIDE); y0 <= Math.min(H - 1, hy1 + 1); y0++) {
    for (let x0 = Math.max(0, hx0 - MAX_SIDE); x0 <= Math.min(W - 1, hx1 + 1); x0++) {
      for (let h = 1; h <= MAX_SIDE && y0 + h <= H - 1; h++) {
        for (let w = 1; w <= MAX_SIDE && x0 + w <= W; w++) {
          if (w * h < minYard) continue;
          const yard: number[] = [];
          for (let y = y0; y < y0 + h; y++)
            for (let x = x0; x < x0 + w; x++) if (!wall[y * W + x]) yard.push(y * W + x);
          if (yard.length < minYard) continue;
          const inYard = new Set(yard);
          let touchesHouse = false;
          const boundary = new Set<number>();
          let ok = true;
          for (const i of yard) {
            const x = i % W;
            const y = Math.floor(i / W);
            for (const [dx, dy] of DIRS) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const j = ny * W + nx;
              if (indoor[j]) touchesHouse = true;
              if (wall[j] || inYard.has(j)) continue;
              if (noFence[j]) ok = false;
              boundary.add(j);
            }
          }
          if (!ok || !touchesHouse || !connected(yard, inYard, W)) continue;
          candidates.push({ yard, boundary: [...boundary] });
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
  for (const cand of candidateYards(rules, g)) {
    if (cand.boundary.length > maxTiles) continue;
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
