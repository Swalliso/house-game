// The drive planner for the Driveway pack (D-140), as enclosure.ts plans Fences (D-106).
//
// A Garage is built like any room and earns only while the street or a Driveway touches it.
// The rules list only a pack's suggested shapes (a straight 3 and 5), and a Driveway's worth is
// in the Garage it reaches, so the greedy bot would never lay one on purpose. drivePlans()
// finds, for each piece that stands unreached, the cheapest run of free tiles from the street
// or a Driveway to a tile beside it:
// - a run one pack covers is one placement, for the bot to score exactly;
// - a longer one gives its first pack's worth, from the street end: a first leg. It earns
//   little by itself, so the bot lays it only in a week with nothing better.
// Trees cost more to cross than open ground, so a drive goes around the woods when it can.

import type {
  PieceDef,
  PlaceAction,
  PlacedPiece,
  Rules,
  RunState,
  Selector,
} from '../src/rules/index.ts';
import { cellsToShape, placedCells, protectedTerrain, terrainAt } from '../src/rules/index.ts';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/** What crossing a Tree costs, in tiles of open ground: it's built over and gone. */
const TREE_COST = 3;

/** Whether a selector names this piece type outright (the Garage's "a Driveway"). */
function names(sel: Selector, def: PieceDef): boolean {
  if (sel === 'all') return false;
  if ('piece' in sel) {
    const ids = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
    return ids.some((id) => id === def.id || id === def.countsAs);
  }
  if ('any' in sel) return sel.any.some((s) => names(s, def));
  return false;
}

/** The pieces that earn nothing until one of `pack` touches them (an unreached Garage). */
export function unreached(rules: Rules, state: RunState, pack: PieceDef): PlacedPiece[] {
  const waiting = (def: PieceDef) =>
    def.effects.some(
      (e) =>
        e.kind === 'requires' &&
        !e.blocksPlacement &&
        'touching' in e.condition &&
        names(e.condition.touching, pack),
    );
  if (!state.house.pieces.some((p) => waiting(rules.content.pieces[p.defId]))) return [];
  const unmet = new Set(
    rules
      .currentTally(state)
      .pieces.filter((p) => p.unmet !== undefined)
      .map((p) => p.uid),
  );
  return state.house.pieces.filter(
    (p) => unmet.has(p.uid) && waiting(rules.content.pieces[p.defId]),
  );
}

export interface DrivePlan {
  play: PlaceAction;
  /** The piece it runs toward, and whether this pack reaches it. */
  target: number;
  reaches: boolean;
  /** Tiles in the whole run, this pack's and any later one's. */
  run: number;
}

/**
 * Pack placements, from the hand or the reserve card at `i`, that run a Driveway toward each
 * unreached piece: the whole run if one pack covers it, else its first leg. Shortest runs first.
 */
export function drivePlans(
  rules: Rules,
  state: RunState,
  from: 'hand' | 'reserve',
  i: number,
): DrivePlan[] {
  const card = from === 'hand' ? state.hand[i] : state.reserve[i];
  const id = card && ('kind' in card ? (card.kind === 'piece' ? card.id : null) : card.id);
  const def = id ? rules.content.pieces[id] : null;
  if (!def?.pack || def.wall) return [];
  const targets = unreached(rules, state, def);
  if (targets.length === 0) return [];

  const { content } = rules;
  const { lot } = state.house;
  const W = lot.width;
  const H = lot.height;
  const N = W * H;
  const kept = protectedTerrain(content, lot);
  // What a tile costs to pave: Infinity where the pack can't go (D-174: nor over kept Trees).
  const cost = new Float64Array(N).fill(1);
  for (let k = 0; k < N; k++) {
    const t = terrainAt(lot, k % W, Math.floor(k / W));
    if (t === null) continue;
    const f = content.features[t];
    if (kept.has(t)) cost[k] = Infinity;
    else if (f.clear === 'buildOver') cost[k] = f.reward ? 1 : TREE_COST;
    else if (f.blocks && !def.canCover?.includes(t)) cost[k] = Infinity;
  }
  for (const p of state.house.pieces) {
    const d = content.pieces[p.defId];
    for (const c of placedCells(p.shape ?? d.shape, p.x, p.y, p.rot))
      cost[c.y * W + c.x] = Infinity;
  }
  // Where a run can start: any tile a single tile of the pack is legal on.
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const open: number[] = [];
  for (let k = 0; k < N; k++) {
    if (cost[k] === Infinity) continue;
    const one: PlaceAction = {
      t: 'place',
      from,
      i,
      x: k % W,
      y: Math.floor(k / W),
      rot: 0,
      shape: ['#'],
    };
    if (!rules.checkPlay(state, one).legal) continue;
    dist[k] = cost[k]!;
    open.push(k);
  }
  // Dijkstra on a small grid: the open list is scanned for its nearest tile.
  const done = new Uint8Array(N);
  while (open.length > 0) {
    let at = 0;
    for (let n = 1; n < open.length; n++) if (dist[open[n]!]! < dist[open[at]!]!) at = n;
    const k = open.splice(at, 1)[0]!;
    if (done[k]) continue;
    done[k] = 1;
    const x = k % W;
    const y = (k - x) / W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (done[j] || cost[j] === Infinity) continue;
      const d = dist[k]! + cost[j]!;
      if (d < dist[j]!) {
        dist[j] = d;
        prev[j] = k;
        open.push(j);
      }
    }
  }

  const plans: DrivePlan[] = [];
  for (const piece of targets) {
    const d = content.pieces[piece.defId];
    let end = -1;
    for (const c of placedCells(piece.shape ?? d.shape, piece.x, piece.y, piece.rot)) {
      for (const [dx, dy] of DIRS) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (dist[j]! < (end < 0 ? Infinity : dist[end]!)) end = j;
      }
    }
    if (end < 0) continue;
    const run: number[] = [];
    for (let k = end; k >= 0; k = prev[k]!) run.unshift(k);
    const tiles = run.slice(0, def.pack.maxTiles);
    const { x, y, shape } = cellsToShape(tiles.map((t) => ({ x: t % W, y: Math.floor(t / W) })));
    const play: PlaceAction = { t: 'place', from, i, x, y, rot: 0, shape };
    if (!rules.checkPlay(state, play).legal) continue;
    plans.push({ play, target: piece.uid, reaches: tiles.length === run.length, run: run.length });
  }
  return plans.sort((a, b) => a.run - b.run);
}
