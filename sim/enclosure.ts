// The enclosure probe (§8, "Fences pay their way"): how many Fence cards would it take to make
// a fenced yard around this house? The greedy bot can't plan a fence (the first Fence earns
// nothing until the yard closes), so the sim measures the cost directly instead.
//
// A fenced yard is an area that borders the house and a Fence, doesn't touch the street edge,
// and has at least `fencedYardMin` tiles (§4). The probe tries every small rectangle (up to
// 6×6) next to the house: its free tiles are the yard R, and every non-wall tile touching R
// from outside must become Fence. It covers that boundary with Fence cards (the 1×4 and the
// 5-tile L, any rotation, never on water, boulders, pieces, or R itself) greedily, keeps the
// cheapest, and confirms it with the rules' own fenced-yard check.

import type { HouseState, PlacedPiece, Rot, Rules, RunState } from '../src/rules/index.ts';
import { placedCells, terrainAt, uniqueRotations, shapeCells } from '../src/rules/index.ts';

export interface EnclosureCost {
  /** Fence cards needed. */
  placements: number;
  /** Fence tiles on the yard's boundary. */
  boundary: number;
  /** Tiles in the yard it would make. */
  yard: number;
}

const MAX_SIDE = 6;
const MAX_PLACEMENTS = 6;

export function enclosureCost(rules: Rules, state: RunState): EnclosureCost | null {
  const content = rules.content;
  const { lot } = state.house;
  const W = lot.width;
  const H = lot.height;
  const N = W * H;
  const indoor = new Uint8Array(N);
  const wall = new Uint8Array(N);
  /** Tiles a Fence can't go on: pieces, water, boulders. */
  const noFence = new Uint8Array(N);
  for (const p of state.house.pieces) {
    const def = content.pieces[p.defId];
    for (const c of placedCells(def.shape, p.x, p.y, p.rot)) {
      const i = c.y * W + c.x;
      noFence[i] = 1;
      if (def.category === 'indoor') indoor[i] = 1;
      if (def.category === 'indoor' || def.wall) wall[i] = 1;
    }
  }
  for (let i = 0; i < N; i++) {
    const t = terrainAt(lot, i % W, Math.floor(i / W));
    if (t && content.features[t].blocks && content.features[t].clear !== 'buildOver') noFence[i] = 1;
  }
  const minYard = content.balance.fencedYardMin;
  const fenceCards = Object.values(content.pieces).filter((d) => d.wall && d.drawWeight > 0);
  const shapes = fenceCards.flatMap((def) =>
    uniqueRotations(def.shape).map((rot) => ({ def, rot, cells: shapeCells(def.shape, rot) })),
  );
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  // Candidate yards: rectangles that touch the house.
  const seen = new Set<string>();
  const candidates: { yard: number[]; boundary: number[] }[] = [];
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      for (let h = 1; h <= MAX_SIDE && y0 + h <= H - 1; h++) {
        for (let w = 1; w <= MAX_SIDE && x0 + w <= W; w++) {
          if (w * h < minYard) continue;
          const key = `${x0},${y0},${w},${h}`;
          if (seen.has(key)) continue;
          seen.add(key);
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
  candidates.sort((a, b) => a.boundary.length - b.boundary.length);

  let best: EnclosureCost | null = null;
  for (const cand of candidates) {
    const lower = Math.ceil(cand.boundary.length / 5);
    if (best && lower >= best.placements) break;
    const fences = cover(cand, shapes, W, H, wall, noFence);
    if (!fences || fences.length > MAX_PLACEMENTS) continue;
    if (best && fences.length >= best.placements) continue;
    // Confirm with the rules: the house plus these Fences has a new fenced yard.
    const before = rules.fencedYards(state).length;
    let nextUid = state.house.nextUid;
    const pieces: PlacedPiece[] = [...state.house.pieces];
    for (const f of fences) {
      pieces.push({ uid: nextUid++, defId: f.def.id, x: f.x, y: f.y, rot: f.rot, placedWeek: state.week });
    }
    const house: HouseState = { ...state.house, pieces, nextUid };
    if (rules.fencedYards({ ...state, house }).length <= before) continue;
    best = { placements: fences.length, boundary: cand.boundary.length, yard: cand.yard.length };
  }
  return best;
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

interface FencePlacement {
  def: { id: PlacedPiece['defId'] };
  rot: Rot;
  x: number;
  y: number;
  tiles: number[];
}

/** Greedy set cover of the boundary with Fence cards that avoid the yard and blocked tiles. */
function cover(
  cand: { yard: number[]; boundary: number[] },
  shapes: { def: { id: PlacedPiece['defId'] }; rot: Rot; cells: readonly { x: number; y: number }[] }[],
  W: number,
  H: number,
  wall: Uint8Array,
  noFence: Uint8Array,
): FencePlacement[] | null {
  const inYard = new Set(cand.yard);
  const options: FencePlacement[] = [];
  const keys = new Set<string>();
  for (const b of cand.boundary) {
    const bx = b % W;
    const by = Math.floor(b / W);
    for (const s of shapes) {
      for (const anchor of s.cells) {
        const x = bx - anchor.x;
        const y = by - anchor.y;
        const key = `${s.def.id},${s.rot},${x},${y}`;
        if (keys.has(key)) continue;
        keys.add(key);
        const tiles: number[] = [];
        let ok = true;
        for (const c of s.cells) {
          const tx = x + c.x;
          const ty = y + c.y;
          const i = ty * W + tx;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H || wall[i] || noFence[i] || inYard.has(i)) {
            ok = false;
            break;
          }
          tiles.push(i);
        }
        if (ok) options.push({ def: s.def, rot: s.rot, x, y, tiles });
      }
    }
  }
  const left = new Set(cand.boundary);
  const used = new Set<number>();
  const chosen: FencePlacement[] = [];
  while (left.size > 0) {
    let best: FencePlacement | null = null;
    let gain = 0;
    for (const o of options) {
      if (o.tiles.some((t) => used.has(t))) continue;
      const g = o.tiles.filter((t) => left.has(t)).length;
      if (g > gain) [best, gain] = [o, g];
    }
    if (!best) return null;
    chosen.push(best);
    for (const t of best.tiles) {
      used.add(t);
      left.delete(t);
    }
    if (chosen.length > MAX_PLACEMENTS) return null;
  }
  return chosen;
}
