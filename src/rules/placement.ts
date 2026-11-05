// Placement legality, with a reason the player can read (implementation-plan.md §4, D-035):
// inside the lot; not on another piece, water, or a boulder; and one connected house, so a
// new indoor piece must touch an indoor piece once any exists. Building over Trees is allowed
// and free, and removes them.

import type {
  Cell,
  Content,
  HouseState,
  Legality,
  PieceDef,
  PieceId,
  PlacedPiece,
  Rot,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';
import { terrainAt } from './lot.ts';
import { pieceDef, type Layout } from './layout.ts';

export const REASONS = {
  offLot: "That's off the lot.",
  occupied: "Something's already built there.",
  pond: "You can't build on the pond.",
  creek: "You can't build on the creek.",
  boulder: "A boulder's in the way.",
  disconnected: 'Rooms must connect to the house.',
} as const;

export function checkPlacement(
  content: Content,
  layout: Layout,
  def: PieceDef,
  x: number,
  y: number,
  rot: Rot,
): Legality {
  const { lot } = layout.house;
  const cells = placedCells(def.shape, x, y, rot);
  const fail = (reason: string): Legality => ({ legal: false, reason, cells, clearedTrees: [] });
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
    else if (feature.blocks)
      return fail(t === 'pond' || t === 'creek' ? REASONS[t] : REASONS.boulder);
  }
  if (def.category === 'indoor' && layout.hasIndoor && !touchesIndoor(content, layout, cells)) {
    return fail(REASONS.disconnected);
  }
  return { legal: true, cells, clearedTrees };
}

function touchesIndoor(content: Content, layout: Layout, cells: readonly Cell[]): boolean {
  const { width: w, height: h } = layout.house.lot;
  return cells.some((c) =>
    ORTHOGONAL.some(([dx, dy]) => {
      if (!inBounds(w, h, c.x + dx, c.y + dy)) return false;
      const uid = layout.occupant[cellIndex(w, c.x + dx, c.y + dy)]!;
      return uid >= 0 && pieceDef(content, layout.byUid.get(uid)!).category === 'indoor';
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
