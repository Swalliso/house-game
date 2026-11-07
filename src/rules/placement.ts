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
  FeatureId,
  HouseState,
  Legality,
  PieceCondition,
  PieceDef,
  PieceId,
  PlacedPiece,
  Rot,
  Selector,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';
import { terrainAt } from './lot.ts';
import { isRoom, pieceDef, type Layout } from './layout.ts';
import { isType, meetsCondition } from './selectors.ts';
import { conditionText } from './text.ts';

export const REASONS = {
  offLot: "That's off the lot.",
  occupied: "Something's already built there.",
  pond: "You can't build on the pond.",
  creek: "You can't build on the creek.",
  boulder: "A boulder's in the way.",
  oldShed: 'The Old Shed’s in the way: demolish it first.',
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
  /** A pack's own tiles (D-102); otherwise the card's shape. */
  shape: readonly string[] = def.shape,
): PlacementCheck {
  const { lot } = layout.house;
  const own = shape === def.shape ? undefined : shape;
  const cells = placedCells(shape, x, y, rot);
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
  // Finds built over (a Time Capsule): they're cleared like Trees, and each pays once.
  const finds: Cell[] = [];
  for (const c of cells) {
    const t = terrainAt(lot, c.x, c.y);
    if (t === null) continue;
    const feature = content.features[t];
    if (feature.clear === 'buildOver') (feature.reward ? finds : clearedTrees).push(c);
    else if (feature.blocks && !def.canCover?.includes(t)) {
      return fail(t === 'pond' || t === 'creek' || t === 'oldShed' ? REASONS[t] : REASONS.boulder);
    }
  }
  const found = finds.length > 0 ? { finds } : {};
  if (def.category === 'indoor' && layout.hasIndoor && !touchesIndoor(content, layout, cells)) {
    return fail(REASONS.disconnected);
  }
  const blocking = def.effects.filter(
    (e): e is Extract<typeof e, { kind: 'requires' }> => e.kind === 'requires' && e.blocksPlacement,
  );
  if (blocking.length === 0) return { legal: true, cells, clearedTrees, ...found };
  // The common case (touching the street, a Driveway, a Tree) is exact from the tiles around
  // the piece, so the bots' scans don't build a layout per candidate.
  let quick = true;
  for (const e of blocking) {
    const met = quickTouching(content, layout, e.condition, cells);
    if (met === false) {
      return fail(`${def.name} must be built ${conditionText(content, e.condition)}.`);
    }
    if (met === null) quick = false;
  }
  if (quick) return { legal: true, cells, clearedTrees, ...found };
  // Otherwise requirements are checked on the house as it would be, with Trees under it gone.
  const added = addPiece(layout.house, def.id, x, y, rot, week, [...clearedTrees, ...finds], own);
  const after = layoutOf(added.house);
  for (const e of blocking) {
    if (!meetsCondition(content, after, e.condition, added.piece.uid)) {
      return fail(`${def.name} must be built ${conditionText(content, e.condition)}.`);
    }
  }
  return { legal: true, cells, clearedTrees, ...found, house: added.house, piece: added.piece };
}

/**
 * A `touching` condition whose selector names only lot features and pieces that can't be
 * linked or are connectors (so links and the Hallway rule can't change the answer), decided
 * from the tiles around the cells. Null when the condition isn't that simple.
 */
function quickTouching(
  content: Content,
  layout: Layout,
  cond: PieceCondition,
  cells: readonly Cell[],
): boolean | null {
  if (!('touching' in cond) || !simpleSelector(content, cond.touching)) return null;
  const { lot } = layout.house;
  const { width: w, height: h } = lot;
  const own = new Set(cells.map((c) => cellIndex(w, c.x, c.y)));
  const seen = new Set<string>();
  let n = 0;
  const count = (key: string, matched: boolean) => {
    if (!matched || seen.has(key)) return;
    seen.add(key);
    n++;
  };
  for (const c of cells) {
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inBounds(w, h, nx, ny)) {
        if (ny === h) count('street', simpleMatch(content, cond.touching, null, 'street'));
        continue;
      }
      const i = cellIndex(w, nx, ny);
      if (own.has(i)) continue;
      const uid = layout.occupant[i]!;
      if (uid >= 0) {
        const other = pieceDef(content, layout.byUid.get(uid)!);
        if (!other.connector) count(`p${uid}`, simpleMatch(content, cond.touching, other, null));
        continue;
      }
      const t = terrainAt(lot, nx, ny);
      if (t === null || content.features[t].inert) continue;
      // Bodies count once; any other feature tile counts on its own.
      count(content.features[t].body ? t : `t${i}`, simpleMatch(content, cond.touching, null, t));
    }
  }
  return n >= (cond.min ?? 1);
}

/** Feature and piece-id terms only, naming no room (rooms can be linked through Hallways). */
function simpleSelector(content: Content, sel: Selector): boolean {
  if (sel === 'all') return false;
  if ('feature' in sel) return true;
  if ('piece' in sel) {
    const ids = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
    return Object.values(content.pieces).every(
      (d) => !ids.some((id) => d.id === id || d.countsAs === id) || !isRoom(d),
    );
  }
  if ('any' in sel) return sel.any.every((s) => simpleSelector(content, s));
  return false;
}

function simpleMatch(
  content: Content,
  sel: Selector,
  piece: PieceDef | null,
  feature: FeatureId | null,
): boolean {
  if (sel === 'all') return false;
  if ('any' in sel) return sel.any.some((s) => simpleMatch(content, s, piece, feature));
  if ('feature' in sel) {
    if (!feature) return false;
    return typeof sel.feature === 'string'
      ? sel.feature === feature
      : sel.feature.includes(feature);
  }
  if ('piece' in sel) {
    if (!piece) return false;
    const ids = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
    return ids.some((id) => isType(piece, id));
  }
  return false;
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
  cleared: readonly Cell[],
  /** A pack's own tiles (D-102). */
  shape?: readonly string[],
): { house: HouseState; piece: PlacedPiece } {
  const piece: PlacedPiece = {
    uid: house.nextUid,
    defId,
    x,
    y,
    rot,
    placedWeek: week,
    // A copy, so the action's rows never change the state.
    ...(shape ? { shape: [...shape] } : {}),
  };
  return {
    house: {
      lot: clearTiles(house.lot, cleared),
      pieces: [...house.pieces, piece],
      nextUid: house.nextUid + 1,
    },
    piece,
  };
}

/** The lot with these tiles' features gone (Trees and finds built over). */
export function clearTiles(lot: HouseState['lot'], cells: readonly Cell[]): HouseState['lot'] {
  if (cells.length === 0) return lot;
  const terrain = lot.terrain.slice();
  for (const c of cells) terrain[cellIndex(lot.width, c.x, c.y)] = null;
  return { ...lot, terrain };
}

/**
 * Moving Truck (M3b): the piece, fixture and all, to (x, y, rot), keeping its uid, timers,
 * and place in the placement order. Checked as a new placement on the house without it, and
 * it can't split the house.
 */
export function checkMove(
  content: Content,
  layout: Layout,
  uid: number,
  x: number,
  y: number,
  rot: Rot,
  week: number,
  layoutOf: (house: HouseState) => Layout,
): PlacementCheck & { piece?: PlacedPiece } {
  const piece = layout.byUid.get(uid);
  const none = { legal: false, cells: [], clearedTrees: [] };
  if (!piece) return { ...none, reason: 'Pick a piece to move.' };
  if (piece.x === x && piece.y === y && piece.rot === rot) {
    return { ...none, reason: 'Pick a new spot for it.' };
  }
  const def = pieceDef(content, piece);
  if (def.category === 'indoor' && wouldSplit(content, layout, uid)) {
    return { ...none, reason: REASONS.split };
  }
  const without: HouseState = {
    ...layout.house,
    pieces: layout.house.pieces.filter((p) => p.uid !== uid),
  };
  const check = checkPlacement(
    content,
    layoutOf(without),
    def,
    x,
    y,
    rot,
    week,
    layoutOf,
    piece.shape ?? def.shape,
  );
  if (!check.legal) return check;
  const moved: PlacedPiece = { ...piece, x, y, rot };
  const house: HouseState = {
    ...layout.house,
    lot: clearTiles(layout.house.lot, [...check.clearedTrees, ...(check.finds ?? [])]),
    pieces: layout.house.pieces.map((p) => (p.uid === uid ? moved : p)),
  };
  return { ...check, house, piece: moved };
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
  // A multi-tile object (the Old Shed) goes all at once.
  const cells = content.features[t].size ? featureCells(lot, x, y) : [{ x, y }];
  const target: DemolishTarget = { kind: 'feature', feature: t, cells };
  if (content.features[t].clear === 'demolish') return { legal: true, target };
  if (t === 'pond' || t === 'creek') return { legal: false, reason: REASONS.water, target };
  if (t === 'tree') return { legal: false, reason: REASONS.tree, target };
  return { legal: false, reason: REASONS.nothingThere, target };
}

/** Every tile of the object at (x, y): orthogonally connected tiles of the same feature, top-left first. */
export function featureCells(lot: HouseState['lot'], x: number, y: number): Cell[] {
  const t = terrainAt(lot, x, y);
  if (t === null) return [];
  const seen = new Set<number>([cellIndex(lot.width, x, y)]);
  const out: Cell[] = [];
  const stack: Cell[] = [{ x, y }];
  while (stack.length > 0) {
    const c = stack.pop()!;
    out.push(c);
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inBounds(lot.width, lot.height, nx, ny) || terrainAt(lot, nx, ny) !== t) continue;
      const i = cellIndex(lot.width, nx, ny);
      if (seen.has(i)) continue;
      seen.add(i);
      stack.push({ x: nx, y: ny });
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
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
