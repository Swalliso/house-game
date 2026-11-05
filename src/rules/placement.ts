// Placement and demolition legality, with a reason the player can read (implementation-plan.md
// §4, D-035):
// - inside the lot; not on another piece, water, or a boulder (a piece's `canCover` lets it
//   cross a blocking feature: the Driveway's culvert over the creek)
// - one connected house: a new indoor piece must touch an indoor piece once any exists
// - a `requires` effect with `blocksPlacement` must hold where it's built (Garage, Driveway,
//   Treehouse), checked on the house as it would be
// Building over Trees is allowed and free, and removes them.
//
// Demolition (Appendix A · M2) removes a whole piece, or a feature with `clear: 'demolish'`
// (a boulder), never water or Trees, and never splits the house.

import type {
  Cell,
  Content,
  HouseState,
  Legality,
  PieceDef,
  PieceId,
  PlacedPiece,
  Rot,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';
import { terrainAt } from './lot.ts';
import { pieceDef, type Layout } from './layout.ts';
import { meetsCondition } from './selectors.ts';
import { conditionText } from './text.ts';

export const REASONS = {
  offLot: "That's off the lot.",
  occupied: "Something's already built there.",
  pond: "You can't build on the pond.",
  creek: "You can't build on the creek.",
  boulder: "A boulder's in the way.",
  disconnected: 'Rooms must connect to the house.',
  nothingThere: "There's nothing there to demolish.",
  water: "Water can't be demolished.",
  tree: 'Trees can’t be demolished: build over them instead.',
  split: 'This would split the house.',
  noDemolitions: 'No demolitions left.',
} as const;

/** The house as it would be with the piece added (or null if it can't even be laid down). */
export interface PlacementCheck extends Legality {
  /** The house with the piece, when the placement is legal (reused by resolveWeek). */
  house?: HouseState;
  piece?: PlacedPiece;
}

export function checkPlacement(
  content: Content,
  layout: Layout,
  def: PieceDef,
  x: number,
  y: number,
  rot: Rot,
  week: number,
  layoutOf: (house: HouseState) => Layout,
): PlacementCheck {
  const { lot } = layout.house;
  const cells = placedCells(def.shape, x, y, rot);
  const fail = (reason: string): PlacementCheck => ({
    legal: false,
    reason,
    cells,
    clearedTrees: [],
  });
  if (cells.some((c) => !inBounds(lot.width, lot.height, c.x, c.y))) return fail(REASONS.offLot);
  if (cells.some((c) => layout.occupant[cellIndex(lot.width, c.x, c.y)]! >= 0)) {
    return fail(REASONS.occupied);
  }
  const clearedTrees: Cell[] = [];
  for (const c of cells) {
    const t = terrainAt(lot, c.x, c.y);
    if (t === null) continue;
    const feature = content.features[t];
    if (feature.clear === 'buildOver') clearedTrees.push(c);
    else if (feature.blocks && !def.canCover?.includes(t)) {
      return fail(t === 'pond' || t === 'creek' ? REASONS[t] : REASONS.boulder);
    }
  }
  if (def.category === 'indoor' && layout.hasIndoor && !touchesIndoor(content, layout, cells)) {
    return fail(REASONS.disconnected);
  }
  const blocking = def.effects.filter(
    (e): e is Extract<typeof e, { kind: 'requires' }> => e.kind === 'requires' && e.blocksPlacement,
  );
  if (blocking.length === 0) return { legal: true, cells, clearedTrees };
  // Requirements are checked on the house as it would be, with any Trees under it gone.
  const added = addPiece(layout.house, def.id, x, y, rot, week, clearedTrees);
  const after = layoutOf(added.house);
  for (const e of blocking) {
    if (!meetsCondition(content, after, e.condition, added.piece.uid)) {
      return fail(`${def.name} must be built ${conditionText(content, e.condition)}.`);
    }
  }
  return { legal: true, cells, clearedTrees, house: added.house, piece: added.piece };
}

function touchesIndoor(content: Content, layout: Layout, cells: readonly Cell[]): boolean {
  const { width: w, height: h } = layout.house.lot;
  return cells.some((c) =>
    ORTHOGONAL.some(([dx, dy]) => {
      if (!inBounds(w, h, c.x + dx, c.y + dy)) return false;
      return layout.indoorTile[cellIndex(w, c.x + dx, c.y + dy)] === 1;
    }),
  );
}

/** The house with a piece added (already checked legal): Trees under it are gone. */
export function addPiece(
  house: HouseState,
  defId: PieceId,
  x: number,
  y: number,
  rot: Rot,
  week: number,
  clearedTrees: readonly Cell[],
): { house: HouseState; piece: PlacedPiece } {
  const piece: PlacedPiece = { uid: house.nextUid, defId, x, y, rot, placedWeek: week };
  let lot = house.lot;
  if (clearedTrees.length > 0) {
    const terrain = lot.terrain.slice();
    for (const c of clearedTrees) terrain[cellIndex(lot.width, c.x, c.y)] = null;
    lot = { ...lot, terrain };
  }
  return {
    house: { lot, pieces: [...house.pieces, piece], nextUid: house.nextUid + 1 },
    piece,
  };
}

// ---------------------------------------------------------------------------------------
// Demolition.

export type DemolishTarget =
  | { kind: 'piece'; piece: PlacedPiece; cells: readonly Cell[] }
  | { kind: 'feature'; feature: TerrainId; cells: readonly Cell[] };

export type DemolishCheck =
  | { legal: true; target: DemolishTarget }
  | { legal: false; reason: string; target: DemolishTarget | null };

/** What demolishing the tile at (x, y) would remove, and whether it's allowed. */
export function checkDemolish(
  content: Content,
  layout: Layout,
  x: number,
  y: number,
): DemolishCheck {
  const { lot } = layout.house;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(lot.width, lot.height, x, y)) {
    return { legal: false, reason: REASONS.offLot, target: null };
  }
  const uid = layout.occupant[cellIndex(lot.width, x, y)]!;
  if (uid >= 0) {
    const piece = layout.byUid.get(uid)!;
    const target: DemolishTarget = { kind: 'piece', piece, cells: layout.cells.get(uid)! };
    if (pieceDef(content, piece).category === 'indoor' && wouldSplit(content, layout, uid)) {
      return { legal: false, reason: REASONS.split, target };
    }
    return { legal: true, target };
  }
  const t = terrainAt(lot, x, y);
  if (t === null) return { legal: false, reason: REASONS.nothingThere, target: null };
  const target: DemolishTarget = { kind: 'feature', feature: t, cells: [{ x, y }] };
  if (content.features[t].clear === 'demolish') return { legal: true, target };
  if (t === 'pond' || t === 'creek') return { legal: false, reason: REASONS.water, target };
  if (t === 'tree') return { legal: false, reason: REASONS.tree, target };
  return { legal: false, reason: REASONS.nothingThere, target };
}

/** Whether removing this indoor piece leaves the other indoor pieces in more than one group. */
function wouldSplit(content: Content, layout: Layout, removed: number): boolean {
  const indoor = layout.house.pieces
    .filter((p) => p.uid !== removed && pieceDef(content, p).category === 'indoor')
    .map((p) => p.uid);
  if (indoor.length <= 1) return false;
  const left = new Set(indoor);
  const seen = new Set<number>([indoor[0]!]);
  const stack = [indoor[0]!];
  while (stack.length > 0) {
    const u = stack.pop()!;
    for (const n of layout.touching.get(u)!) {
      if (n.kind === 'piece' && left.has(n.uid) && !seen.has(n.uid)) {
        seen.add(n.uid);
        stack.push(n.uid);
      }
    }
  }
  return seen.size !== left.size;
}

/** The house without the target. Points already earned are kept; there's no refund. */
export function removeTarget(house: HouseState, target: DemolishTarget): HouseState {
  if (target.kind === 'piece') {
    return { ...house, pieces: house.pieces.filter((p) => p.uid !== target.piece.uid) };
  }
  const terrain = house.lot.terrain.slice();
  for (const c of target.cells) terrain[cellIndex(house.lot.width, c.x, c.y)] = null;
  return { ...house, lot: { ...house.lot, terrain } };
}
