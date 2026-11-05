// What the house looks like to the rules (implementation-plan.md §4, Layout rules; D-035):
// which cells each piece covers, who its neighbors are, and every layout property. Derived
// from HouseState and cached by the house object's identity, since a house never changes
// once made.
//
// - Neighbors are orthogonal and each distinct neighbor counts once. Lot features as
//   neighbors (D-049): every Tree tile is its own neighbor; the pond and the creek each count
//   once however many tiles a piece touches; the street is one neighbor for any piece touching
//   the bottom edge; boulders give nothing.
// - Links: a Hallway (or a connected group of them) links every room touching it. Links
//   count as adjacency for scoring, sets, and conditions, not for connectivity,
//   exterior/interior, views, or enclosure, and a Hallway isn't a neighbor for bonuses.
// - Exterior and interior: a room is exterior if any tile touches a non-indoor tile or the lot
//   edge. Interior rooms are Dark; a piece on a sunny tile is Sunny.
// - Regions: the sunny side; the front yard (non-indoor tiles in rows nearer the street than
//   the house's front row, or all yard before the first indoor piece); the back yard (the
//   rest); fenced yards (flood fill over non-wall tiles, bounded by indoor tiles, Fences, and
//   the lot edge; fenced if it doesn't touch the street edge, has `fencedYardMin` tiles, and
//   borders a Fence and the house).

import type {
  Cell,
  Content,
  FeatureId,
  HouseState,
  Lot,
  PieceDef,
  PlacedPiece,
  Region,
  SourceRef,
  Tag,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';
import { isSunny } from './lot.ts';

export type Neighbor =
  | { kind: 'piece'; uid: number }
  /** A tile feature. For a body (pond, creek), (x, y) is the first tile touched. */
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

/** Region bits per tile. */
export const REGION_BIT: Readonly<Record<Region, number>> = {
  sunny: 1,
  frontYard: 2,
  backYard: 4,
  fencedYard: 8,
};

export interface Layout {
  house: HouseState;
  /** The uid on each cell, or -1. */
  occupant: Int32Array;
  byUid: ReadonlyMap<number, PlacedPiece>;
  cells: ReadonlyMap<number, readonly Cell[]>;
  /** Physical distinct neighbors per piece: pieces by uid, then the street, then tiles in reading order. */
  touching: ReadonlyMap<number, readonly Neighbor[]>;
  /** For scoring, sets, and conditions: `touching` without connectors, plus linked rooms. */
  neighbors: ReadonlyMap<number, readonly Neighbor[]>;
  /** Pieces touching a view source (a Tree, the pond, the creek, or a `givesView` piece). */
  hasView: ReadonlySet<number>;
  hasIndoor: boolean;
  /** 1 on tiles covered by an indoor piece. */
  indoorTile: Uint8Array;
  /** Rooms with a tile touching a non-indoor tile or the lot edge. */
  exterior: ReadonlySet<number>;
  /** Rooms that aren't exterior. */
  interior: ReadonlySet<number>;
  /** Effective tags per piece: its own, plus Dark if interior and Sunny if on a sunny tile. */
  tags: ReadonlyMap<number, ReadonlySet<Tag>>;
  /** The house's front row: the row of its indoor tile nearest the street; null before the first. */
  frontRow: number | null;
  /** REGION_BIT flags per tile. */
  regionBits: Uint8Array;
  /** The fenced yard each tile is in, or -1. */
  fencedId: Int32Array;
  /** Tiles in each fenced yard, by id. */
  fencedSizes: readonly number[];
  /** The rooms each room is linked to through Hallways. */
  links: ReadonlyMap<number, ReadonlySet<number>>;
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

const bodyCache = new WeakMap<Content, WeakMap<Lot, Int32Array>>();

/** Body ids per tile for features that count once (the pond, the creek); -1 elsewhere. Cached per lot. */
function bodyIds(content: Content, lot: Lot): Int32Array {
  let perContent = bodyCache.get(content);
  if (!perContent) {
    perContent = new WeakMap();
    bodyCache.set(content, perContent);
  }
  const cached = perContent.get(lot);
  if (cached) return cached;
  const { width: w, height: h, terrain } = lot;
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
  perContent.set(lot, ids);
  return ids;
}

export function pieceDef(content: Content, piece: PlacedPiece): PieceDef {
  const def = content.pieces[piece.defId];
  if (!def) throw new Error(`Unknown piece "${piece.defId}"`);
  return def;
}

/** A room is an indoor piece that isn't a connector. */
export function isRoom(def: PieceDef): boolean {
  return def.category === 'indoor' && !def.connector;
}

export function computeLayout(content: Content, house: HouseState): Layout {
  const { lot } = house;
  const { width: w, height: h, terrain } = lot;
  const size = w * h;
  const occupant = new Int32Array(size).fill(-1);
  const indoorTile = new Uint8Array(size);
  const wallTile = new Uint8Array(size);
  const fenceTile = new Uint8Array(size);
  const byUid = new Map<number, PlacedPiece>();
  const defs = new Map<number, PieceDef>();
  const cells = new Map<number, readonly Cell[]>();
  let hasIndoor = false;
  let frontRow: number | null = null;
  for (const piece of house.pieces) {
    const def = pieceDef(content, piece);
    const pc = placedCells(def.shape, piece.x, piece.y, piece.rot);
    const indoor = def.category === 'indoor';
    for (const c of pc) {
      const i = cellIndex(w, c.x, c.y);
      occupant[i] = piece.uid;
      if (indoor) {
        indoorTile[i] = 1;
        wallTile[i] = 1;
        if (frontRow === null || c.y > frontRow) frontRow = c.y;
      }
      if (def.wall) {
        wallTile[i] = 1;
        fenceTile[i] = 1;
      }
    }
    byUid.set(piece.uid, piece);
    defs.set(piece.uid, def);
    cells.set(piece.uid, pc);
    if (indoor) hasIndoor = true;
  }

  // Physical neighbors.
  const bodies = bodyIds(content, lot);
  const touching = new Map<number, readonly Neighbor[]>();
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
    touching.set(piece.uid, list);
  }

  // Views come from what a piece physically touches.
  const hasView = new Set<number>();
  for (const piece of house.pieces) {
    const touchesView = touching.get(piece.uid)!.some((n) => {
      if (n.kind === 'piece') return !!defs.get(n.uid)!.givesView;
      const f = neighborFeature(n);
      return f !== null && !!content.features[f].viewSource;
    });
    if (touchesView) hasView.add(piece.uid);
  }

  // Links: each connected group of linking connectors links every room touching it.
  const links = new Map<number, Set<number>>();
  const linkers = (uid: number) => defs.get(uid)!.effects.some((e) => e.kind === 'link');
  const grouped = new Set<number>();
  for (const piece of house.pieces) {
    if (grouped.has(piece.uid) || !linkers(piece.uid)) continue;
    const group: number[] = [];
    const stack = [piece.uid];
    grouped.add(piece.uid);
    while (stack.length > 0) {
      const u = stack.pop()!;
      group.push(u);
      for (const n of touching.get(u)!) {
        if (n.kind === 'piece' && !grouped.has(n.uid) && linkers(n.uid)) {
          grouped.add(n.uid);
          stack.push(n.uid);
        }
      }
    }
    const rooms = new Set<number>();
    for (const u of group) {
      for (const n of touching.get(u)!) {
        if (n.kind === 'piece' && isRoom(defs.get(n.uid)!)) rooms.add(n.uid);
      }
    }
    for (const r of rooms) {
      let set = links.get(r);
      if (!set) links.set(r, (set = new Set()));
      for (const o of rooms) if (o !== r) set.add(o);
    }
  }

  // Scoring neighbors: connectors aren't neighbors for bonuses; linked rooms are.
  const neighbors = new Map<number, readonly Neighbor[]>();
  for (const piece of house.pieces) {
    const phys = touching.get(piece.uid)!;
    const linked = links.get(piece.uid);
    const hasConnector = phys.some((n) => n.kind === 'piece' && !!defs.get(n.uid)!.connector);
    if (!linked && !hasConnector) {
      neighbors.set(piece.uid, phys);
      continue;
    }
    const uids = new Set<number>();
    for (const n of phys) if (n.kind === 'piece' && !defs.get(n.uid)!.connector) uids.add(n.uid);
    if (linked) for (const u of linked) if (u !== piece.uid) uids.add(u);
    const list: Neighbor[] = [...uids]
      .sort((a, b) => a - b)
      .map((uid): Neighbor => ({ kind: 'piece', uid }));
    for (const n of phys) if (n.kind !== 'piece') list.push(n);
    neighbors.set(piece.uid, list);
  }

  // Exterior and interior rooms, physically (links don't count).
  const exterior = new Set<number>();
  const interior = new Set<number>();
  for (const piece of house.pieces) {
    if (!isRoom(defs.get(piece.uid)!)) continue;
    const out = cells.get(piece.uid)!.some((c) =>
      ORTHOGONAL.some(([dx, dy]) => {
        const nx = c.x + dx;
        const ny = c.y + dy;
        return !inBounds(w, h, nx, ny) || !indoorTile[cellIndex(w, nx, ny)];
      }),
    );
    (out ? exterior : interior).add(piece.uid);
  }

  // Fenced yards: flood fill over non-wall tiles.
  const fencedId = new Int32Array(size).fill(-1);
  const fencedSizes: number[] = [];
  const component = new Int32Array(size).fill(-1);
  const minTiles = content.balance.fencedYardMin;
  let compId = 0;
  for (let start = 0; start < size; start++) {
    if (wallTile[start] || component[start] !== -1) continue;
    const members: number[] = [];
    let street = false;
    let fence = false;
    let houseSide = false;
    component[start] = compId;
    const stack = [start];
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (y === h - 1) street = true;
      for (const [dx, dy] of ORTHOGONAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(w, h, nx, ny)) continue;
        const j = cellIndex(w, nx, ny);
        if (wallTile[j]) {
          if (fenceTile[j]) fence = true;
          if (indoorTile[j]) houseSide = true;
          continue;
        }
        if (component[j] === -1) {
          component[j] = compId;
          stack.push(j);
        }
      }
    }
    if (!street && fence && houseSide && members.length >= minTiles) {
      const id = fencedSizes.length;
      fencedSizes.push(members.length);
      for (const i of members) fencedId[i] = id;
    }
    compId++;
  }

  // Region bits.
  const regionBits = new Uint8Array(size);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = cellIndex(w, x, y);
      let bits = 0;
      if (isSunny(lot, x, y)) bits |= REGION_BIT.sunny;
      if (!indoorTile[i]) {
        bits |= frontRow === null || y > frontRow ? REGION_BIT.frontYard : REGION_BIT.backYard;
      }
      if (fencedId[i]! >= 0) bits |= REGION_BIT.fencedYard;
      regionBits[i] = bits;
    }
  }

  // Effective tags (§4 steps 1–2): own tags, plus Dark if interior and Sunny on a sunny tile.
  const tags = new Map<number, ReadonlySet<Tag>>();
  for (const piece of house.pieces) {
    const def = defs.get(piece.uid)!;
    const set = new Set<Tag>(def.tags);
    if (interior.has(piece.uid)) set.add('Dark');
    if (cells.get(piece.uid)!.some((c) => regionBits[cellIndex(w, c.x, c.y)]! & REGION_BIT.sunny)) {
      set.add('Sunny');
    }
    tags.set(piece.uid, set);
  }

  return {
    house,
    occupant,
    byUid,
    cells,
    touching,
    neighbors,
    hasView,
    hasIndoor,
    indoorTile,
    exterior,
    interior,
    tags,
    frontRow,
    regionBits,
    fencedId,
    fencedSizes,
    links,
  };
}

/** How many of a piece's tiles are in the region. */
export function tilesIn(layout: Layout, uid: number, region: Region): number {
  const w = layout.house.lot.width;
  let n = 0;
  for (const c of layout.cells.get(uid) ?? []) {
    if (layout.regionBits[cellIndex(w, c.x, c.y)]! & REGION_BIT[region]) n++;
  }
  return n;
}

/** Every tile of the piece is in the region. */
export function pieceIn(layout: Layout, uid: number, region: Region): boolean {
  const cells = layout.cells.get(uid) ?? [];
  return cells.length > 0 && tilesIn(layout, uid, region) === cells.length;
}

/** The fenced yards a piece's tiles touch from outside (or sit in), by id. */
export function fencedYardsBordered(layout: Layout, uid: number): number[] {
  const { width: w, height: h } = layout.house.lot;
  const ids = new Set<number>();
  for (const c of layout.cells.get(uid) ?? []) {
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inBounds(w, h, nx, ny)) continue;
      const i = cellIndex(w, nx, ny);
      if (layout.occupant[i] === uid) continue;
      const id = layout.fencedId[i]!;
      if (id >= 0) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** The largest single fenced yard's tiles (for "a fenced yard of 12 tiles"). */
export function largestFencedYard(layout: Layout): number {
  return layout.fencedSizes.reduce((a, b) => Math.max(a, b), 0);
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
