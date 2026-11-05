// What the house looks like to the rules (implementation-plan.md §4, Layout rules; D-035):
// which cells each piece covers and who its neighbors are. Derived from HouseState and cached
// by the house object's identity, since a house never changes once made.
//
// Neighbors are orthogonal and each distinct neighbor counts once. Lot features as neighbors
// (D-049): every Tree tile is its own neighbor; the pond and the creek each count once
// however many tiles a piece touches; the street is one neighbor for any piece touching the
// bottom edge; boulders give nothing.

import type {
  Cell,
  Content,
  FeatureId,
  HouseState,
  PieceDef,
  PlacedPiece,
  SourceRef,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';

export type Neighbor =
  | { kind: 'piece'; uid: number }
  /** A tile feature. For a body (pond, creek), (x, y) is the first tile touched. */
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

export interface Layout {
  house: HouseState;
  /** The uid on each cell, or -1. */
  occupant: Int32Array;
  byUid: ReadonlyMap<number, PlacedPiece>;
  cells: ReadonlyMap<number, readonly Cell[]>;
  /** Distinct neighbors per piece: pieces by uid, then the street, then tiles in reading order. */
  neighbors: ReadonlyMap<number, readonly Neighbor[]>;
  /** Pieces touching a view source (a Tree, the pond, the creek, or a `givesView` piece). */
  hasView: ReadonlySet<number>;
  hasIndoor: boolean;
}

export function neighborRef(n: Neighbor): SourceRef {
  return n.kind === 'piece'
    ? { kind: 'piece', uid: n.uid }
    : n.kind === 'street'
      ? { kind: 'street', x: n.x }
      : { kind: 'terrain', feature: n.feature, x: n.x, y: n.y };
}

export function neighborFeature(n: Neighbor): FeatureId | null {
  return n.kind === 'piece' ? null : n.kind === 'street' ? 'street' : n.feature;
}

/** Body ids per tile for features that count once (the pond, the creek); -1 elsewhere. */
function bodyIds(content: Content, house: HouseState): Int32Array {
  const { width: w, height: h, terrain } = house.lot;
  const ids = new Int32Array(w * h).fill(-1);
  let next = 0;
  for (let i = 0; i < terrain.length; i++) {
    const t = terrain[i] ?? null;
    if (t === null || !content.features[t].body || ids[i] !== -1) continue;
    const id = next++;
    ids[i] = id;
    const stack = [i];
    while (stack.length > 0) {
      const j = stack.pop()!;
      const x = j % w;
      const y = (j - x) / w;
      for (const [dx, dy] of ORTHOGONAL) {
        if (!inBounds(w, h, x + dx, y + dy)) continue;
        const k = cellIndex(w, x + dx, y + dy);
        if (ids[k] === -1 && terrain[k] === t) {
          ids[k] = id;
          stack.push(k);
        }
      }
    }
  }
  return ids;
}

export function pieceDef(content: Content, piece: PlacedPiece): PieceDef {
  const def = content.pieces[piece.defId];
  if (!def) throw new Error(`Unknown piece "${piece.defId}"`);
  return def;
}

export function computeLayout(content: Content, house: HouseState): Layout {
  const { width: w, height: h, terrain } = house.lot;
  const occupant = new Int32Array(w * h).fill(-1);
  const byUid = new Map<number, PlacedPiece>();
  const cells = new Map<number, readonly Cell[]>();
  let hasIndoor = false;
  for (const piece of house.pieces) {
    const def = pieceDef(content, piece);
    const pc = placedCells(def.shape, piece.x, piece.y, piece.rot);
    for (const c of pc) occupant[cellIndex(w, c.x, c.y)] = piece.uid;
    byUid.set(piece.uid, piece);
    cells.set(piece.uid, pc);
    if (def.category === 'indoor') hasIndoor = true;
  }

  const bodies = bodyIds(content, house);
  const neighbors = new Map<number, readonly Neighbor[]>();
  const hasView = new Set<number>();
  for (const piece of house.pieces) {
    const pieceUids = new Set<number>();
    const tiles = new Map<number, Neighbor>(); // keyed by tile index, or -(body id) - 1
    let street: Neighbor | null = null;
    for (const c of cells.get(piece.uid)!) {
      for (const [dx, dy] of ORTHOGONAL) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (!inBounds(w, h, nx, ny)) {
          if (ny === h && (street === null || c.x < street.x)) street = { kind: 'street', x: c.x };
          continue;
        }
        const i = cellIndex(w, nx, ny);
        const other = occupant[i]!;
        if (other >= 0) {
          if (other !== piece.uid) pieceUids.add(other);
          continue;
        }
        const t = terrain[i] ?? null;
        if (t === null || content.features[t].inert) continue;
        const key = bodies[i]! >= 0 ? -bodies[i]! - 1 : i;
        const seen = tiles.get(key);
        // Bodies keep the first tile in reading order, so badges land in a stable spot.
        if (!seen || (seen.kind === 'terrain' && (ny < seen.y || (ny === seen.y && nx < seen.x)))) {
          tiles.set(key, { kind: 'terrain', feature: t, x: nx, y: ny });
        }
      }
    }
    const list: Neighbor[] = [...pieceUids]
      .sort((a, b) => a - b)
      .map((uid): Neighbor => ({ kind: 'piece', uid }));
    if (street) list.push(street);
    const tileList = [...tiles.values()].sort((a, b) =>
      a.kind === 'terrain' && b.kind === 'terrain' ? a.y - b.y || a.x - b.x : 0,
    );
    list.push(...tileList);
    neighbors.set(piece.uid, list);
  }

  for (const piece of house.pieces) {
    const touchesView = neighbors.get(piece.uid)!.some((n) => {
      if (n.kind === 'piece') return !!pieceDef(content, byUid.get(n.uid)!).givesView;
      const f = neighborFeature(n);
      return f !== null && !!content.features[f].viewSource;
    });
    if (touchesView) hasView.add(piece.uid);
  }

  return { house, occupant, byUid, cells, neighbors, hasView, hasIndoor };
}

/** Layouts cached per house object, per content (a WeakMap each, so nothing leaks). */
export function layoutCache(content: Content): (house: HouseState) => Layout {
  const cache = new WeakMap<HouseState, Layout>();
  return (house) => {
    let layout = cache.get(house);
    if (!layout) {
      layout = computeLayout(content, house);
      cache.set(house, layout);
    }
    return layout;
  };
}
