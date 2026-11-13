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
//   edge. Interior rooms are Dark.
// - The sun (D-120): a tile is in the sun unless it's a Tree, or a Tree, the Old Shed or a
//   building (an indoor piece or an outbuilding) stands on the next tile toward the lot's sun;
//   off the lot is open, the street included. A building with a tile in the sun is Sunny: in
//   practice, a wall that faces the sun with open ground or the yard in front of it. Yard
//   pieces aren't made Sunny (the Pool's card says it is).
// - Regions: in the sun; the front yard (non-indoor tiles in rows nearer the street than
//   the house's front row, or all yard before the first indoor piece); the back yard (the
//   rest); fenced yards (flood fill over non-wall tiles, bounded by indoor tiles, Fences, and
//   the lot edge; fenced if it doesn't touch the street edge, has `fencedYardMin` tiles, and
//   borders a Fence and the house).
// - Layout modifiers (M3), from fixtures (on their host) and the run (blueprints), resolved in
//   §4's order: own and layout tags first; then grantTag, then removeTag, with targets matched
//   against those tags only; then countsAs (type identity); then grantView, which gives the
//   view property and one more view for the piece's own "per view" bonuses; then link groups
//   (Open Concept). Their targets see the layout as it stood before any modifier, with
//   Hallway links only.

import type {
  Cell,
  Content,
  FeatureId,
  HouseState,
  Lot,
  Modifier,
  PieceDef,
  PieceId,
  PlacedPiece,
  Region,
  Selector,
  SourceRef,
  Tag,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL, placedCells } from './grid.ts';
import { SUN_STEP } from './lot.ts';
import { matchesPiece } from './selectors.ts';

export type Neighbor =
  | { kind: 'piece'; uid: number }
  /** A tile feature. For a body (pond, creek), (x, y) is the first tile touched. */
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number }
  /** A granted view (a Bay Window): one more view for the piece's own "per view" bonuses. */
  | { kind: 'view'; uid: number };

/** The modifier kinds that change the layout rather than the tally. */
export type LayoutModifier = Extract<
  Modifier,
  { kind: 'grantTag' | 'removeTag' | 'grantView' | 'countsAs' | 'link' }
>;

export const LAYOUT_KINDS: ReadonlySet<Modifier['kind']> = new Set([
  'grantTag',
  'removeTag',
  'grantView',
  'countsAs',
  'link',
]);

export function isLayoutModifier(m: Modifier): m is LayoutModifier {
  return LAYOUT_KINDS.has(m.kind);
}

/** No run-level layout modifiers (one shared array, so the layout cache keys on it). */
export const NO_LAYOUT_MODS: readonly LayoutModifier[] = Object.freeze([]);

/**
 * A tag a layout modifier granted a piece, and where it came from, for the inspect panel: a
 * run-level modifier (its index in the layout's `mods`), or the fixture installed in a piece (by
 * that piece's uid).
 */
export type TagGrant = { tag: Tag; mod: number } | { tag: Tag; host: number };

const NO_GRANTS: ReadonlyMap<number, readonly TagGrant[]> = new Map();

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
  /** 1 on tiles covered by a building (an indoor piece or an outbuilding): they cast shade. */
  buildingTile: Uint8Array;
  /** Rooms with a tile touching a non-indoor tile or the lot edge. */
  exterior: ReadonlySet<number>;
  /** Rooms that aren't exterior. */
  interior: ReadonlySet<number>;
  /**
   * Effective tags per piece: its own, plus Dark if interior and Sunny if a building in the sun, then
   * those layout modifiers grant, less those they remove.
   */
  tags: ReadonlyMap<number, ReadonlySet<Tag>>;
  /** The tags layout modifiers granted each piece, with where each came from (removed or not). */
  grants: ReadonlyMap<number, readonly TagGrant[]>;
  /** The house's front row: the row of its indoor tile nearest the street; null before the first. */
  frontRow: number | null;
  /** REGION_BIT flags per tile. */
  regionBits: Uint8Array;
  /** The fenced yard each tile is in, or -1. */
  fencedId: Int32Array;
  /** Tiles in each fenced yard, by id. */
  fencedSizes: readonly number[];
  /** The rooms each room is linked to through Hallways, and pieces linked by Open Concept. */
  links: ReadonlyMap<number, ReadonlySet<number>>;
  /** Types each piece also counts as from modifiers (Kitchen Island), with how many times. */
  countsAs: ReadonlyMap<number, ReadonlyMap<PieceId, number>>;
  /** Pieces with a granted view (a Bay Window). */
  grantedView: ReadonlySet<number>;
  /** The run-level layout modifiers this layout was built with. */
  mods: readonly LayoutModifier[];
}

export function neighborRef(n: Neighbor): SourceRef {
  return n.kind === 'piece' || n.kind === 'view'
    ? { kind: 'piece', uid: n.uid }
    : n.kind === 'street'
      ? { kind: 'street', x: n.x }
      : { kind: 'terrain', feature: n.feature, x: n.x, y: n.y };
}

export function neighborFeature(n: Neighbor): FeatureId | null {
  return n.kind === 'piece' || n.kind === 'view'
    ? null
    : n.kind === 'street'
      ? 'street'
      : n.feature;
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

/**
 * D-168: the tiles an extended room has beyond its own card's (0 for any other piece): what its
 * size pays for.
 */
export function grownTiles(content: Content, piece: PlacedPiece): number {
  if (!piece.extended || !piece.shape) return 0;
  const tiles = (rows: readonly string[]) =>
    rows.reduce((n, row) => n + row.split('#').length - 1, 0);
  return Math.max(0, tiles(piece.shape) - tiles(pieceDef(content, piece).shape));
}

/** A room is an indoor piece that isn't a connector. */
export function isRoom(def: PieceDef): boolean {
  return def.category === 'indoor' && !def.connector;
}

/**
 * A building (D-120): an indoor piece (a room or a Hallway) or an outbuilding. Buildings cast
 * shade on the tile behind them, away from the sun, and one in the sun is Sunny.
 */
export function isBuilding(def: PieceDef): boolean {
  return def.category !== 'yard';
}

export function computeLayout(
  content: Content,
  house: HouseState,
  mods: readonly LayoutModifier[] = NO_LAYOUT_MODS,
): Layout {
  const { lot } = house;
  const { width: w, height: h, terrain } = lot;
  const size = w * h;
  const occupant = new Int32Array(size).fill(-1);
  const indoorTile = new Uint8Array(size);
  const wallTile = new Uint8Array(size);
  const fenceTile = new Uint8Array(size);
  const buildingTile = new Uint8Array(size);
  const byUid = new Map<number, PlacedPiece>();
  const defs = new Map<number, PieceDef>();
  const cells = new Map<number, readonly Cell[]>();
  let hasIndoor = false;
  let frontRow: number | null = null;
  for (const piece of house.pieces) {
    const def = pieceDef(content, piece);
    // A pack (D-106) carries its own tiles.
    const pc = placedCells(piece.shape ?? def.shape, piece.x, piece.y, piece.rot);
    const indoor = def.category === 'indoor';
    const building = isBuilding(def);
    for (const c of pc) {
      const i = cellIndex(w, c.x, c.y);
      occupant[i] = piece.uid;
      if (building) buildingTile[i] = 1;
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
    const visit = (j: number) => {
      if (wallTile[j]) {
        if (fenceTile[j]) fence = true;
        if (indoorTile[j]) houseSide = true;
      } else if (component[j] === -1) {
        component[j] = compId;
        stack.push(j);
      }
    };
    // Every exact score fills the whole lot, so this loop is the layout's hottest (D-161): the
    // tiles beside each one by index, in ORTHOGONAL's order (right, below, left, above).
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      const x = i % w;
      if (i >= size - w) street = true;
      if (x < w - 1) visit(i + 1);
      if (i + w < size) visit(i + w);
      if (x > 0) visit(i - 1);
      if (i >= w) visit(i - w);
    }
    if (!street && fence && houseSide && members.length >= minTiles) {
      const id = fencedSizes.length;
      fencedSizes.push(members.length);
      for (const i of members) fencedId[i] = id;
    }
    compId++;
  }

  // Region bits. The sun: what stands one step toward it shades a tile.
  const [sx, sy] = SUN_STEP[lot.sun];
  const shades = (x: number, y: number): boolean => {
    if (!inBounds(w, h, x, y)) return false;
    const i = cellIndex(w, x, y);
    const t = terrain[i];
    return buildingTile[i] === 1 || t === 'tree' || t === 'oldShed';
  };
  const regionBits = new Uint8Array(size);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = cellIndex(w, x, y);
      let bits = 0;
      if (terrain[i] !== 'tree' && !shades(x + sx, y + sy)) bits |= REGION_BIT.sunny;
      if (!indoorTile[i]) {
        bits |= frontRow === null || y > frontRow ? REGION_BIT.frontYard : REGION_BIT.backYard;
      }
      if (fencedId[i]! >= 0) bits |= REGION_BIT.fencedYard;
      regionBits[i] = bits;
    }
  }

  // Effective tags (§4 steps 1–2): own tags, plus Dark if interior and Sunny if a building in
  // the sun.
  const tags = new Map<number, ReadonlySet<Tag>>();
  for (const piece of house.pieces) {
    const def = defs.get(piece.uid)!;
    const set = new Set<Tag>(def.tags);
    if (interior.has(piece.uid)) set.add('Dark');
    if (
      isBuilding(def) &&
      cells.get(piece.uid)!.some((c) => regionBits[cellIndex(w, c.x, c.y)]! & REGION_BIT.sunny)
    ) {
      set.add('Sunny');
    }
    tags.set(piece.uid, set);
  }

  const layout: Layout = {
    house,
    occupant,
    byUid,
    cells,
    touching,
    neighbors,
    hasView,
    hasIndoor,
    indoorTile,
    buildingTile,
    exterior,
    interior,
    tags,
    grants: NO_GRANTS,
    frontRow,
    regionBits,
    fencedId,
    fencedSizes,
    links,
    countsAs: new Map(),
    grantedView: new Set(),
    mods,
  };
  // With no fixtures and no run modifiers (every M2 house), that's the whole layout.
  const all = layoutModifiers(content, house, mods);
  return all.length === 0 ? layout : applyLayoutModifiers(content, layout, all);
}

/** A layout modifier with the piece its fixture is installed in, if it came from one. */
interface HostedMod {
  mod: LayoutModifier;
  host?: number;
}

/** The run's layout modifiers, then each installed fixture's, on its host. */
function layoutModifiers(
  content: Content,
  house: HouseState,
  mods: readonly LayoutModifier[],
): HostedMod[] {
  const out: HostedMod[] = mods.map((mod) => ({ mod }));
  for (const piece of house.pieces) {
    if (!piece.fixture) continue;
    const def = content.fixtures[piece.fixture.id];
    if (!def) throw new Error(`Unknown fixture "${piece.fixture.id}"`);
    for (const m of def.modifiers) if (isLayoutModifier(m)) out.push({ mod: m, host: piece.uid });
  }
  return out;
}

/**
 * §4's tag-resolution order, steps 3 and 4, plus granted views and Open Concept's links. The
 * targets are matched on `base`, the layout before any modifier.
 */
function applyLayoutModifiers(content: Content, base: Layout, all: readonly HostedMod[]): Layout {
  const { house } = base;
  // selectors.ts imports this module too; the cycle is fine, since both only call each other
  // at run time.
  const match = (sel: Selector, uid: number, host?: number) =>
    matchesPiece(content, base, sel, uid, host);

  // Step 3: grantTag, then removeTag. Each grant keeps where it came from, for the inspect
  // panel: the run's modifiers come first in `all`, so a run modifier's index there is its
  // index in `base.mods`.
  const grants = new Map<number, TagGrant[]>();
  const removes = new Map<number, Set<Tag>>();
  for (const [k, { mod, host }] of all.entries()) {
    if (mod.kind !== 'grantTag' && mod.kind !== 'removeTag') continue;
    for (const piece of house.pieces) {
      if (!match(mod.target, piece.uid, host)) continue;
      if (mod.kind === 'grantTag') {
        let list = grants.get(piece.uid);
        if (!list) grants.set(piece.uid, (list = []));
        list.push(host === undefined ? { tag: mod.tag, mod: k } : { tag: mod.tag, host });
      } else {
        let set = removes.get(piece.uid);
        if (!set) removes.set(piece.uid, (set = new Set()));
        set.add(mod.tag);
      }
    }
  }
  let tags = base.tags;
  if (grants.size > 0 || removes.size > 0) {
    const next = new Map(base.tags);
    for (const piece of house.pieces) {
      const g = grants.get(piece.uid);
      const r = removes.get(piece.uid);
      if (!g && !r) continue;
      const set = new Set(base.tags.get(piece.uid));
      g?.forEach((x) => set.add(x.tag));
      r?.forEach((t) => set.delete(t));
      next.set(piece.uid, set);
    }
    tags = next;
  }

  // Step 4: countsAs modifiers (Kitchen Island, Bunk Beds).
  const countsAs = new Map<number, Map<PieceId, number>>();
  for (const { mod, host } of all) {
    if (mod.kind !== 'countsAs') continue;
    for (const piece of house.pieces) {
      if (!match(mod.target, piece.uid, host)) continue;
      let m = countsAs.get(piece.uid);
      if (!m) countsAs.set(piece.uid, (m = new Map()));
      m.set(mod.as, Math.max(m.get(mod.as) ?? 0, mod.times ?? 1));
    }
  }

  // Granted views: the view property, and one more view for "per view" bonuses.
  const grantedView = new Set<number>();
  for (const { mod, host } of all) {
    if (mod.kind !== 'grantView') continue;
    for (const piece of house.pieces)
      if (match(mod.target, piece.uid, host)) grantedView.add(piece.uid);
  }
  let hasView = base.hasView;
  if (grantedView.size > 0) {
    const next = new Set(base.hasView);
    grantedView.forEach((u) => next.add(u));
    hasView = next;
  }

  // Open Concept: each connected group of pieces of these types is linked, like a Hallway's.
  const isOf = (uid: number, among: readonly PieceId[]) => {
    const def = pieceDef(content, base.byUid.get(uid)!);
    const extra = countsAs.get(uid);
    return among.some((id) => def.id === id || def.countsAs === id || !!extra?.has(id));
  };
  let links = base.links;
  const linkMods = all.filter((h) => h.mod.kind === 'link');
  if (linkMods.length > 0) {
    const next = new Map<number, Set<number>>();
    for (const [k, v] of base.links) next.set(k, new Set(v));
    for (const { mod } of linkMods) {
      if (mod.kind !== 'link') continue;
      const seen = new Set<number>();
      for (const piece of house.pieces) {
        if (seen.has(piece.uid) || !isOf(piece.uid, mod.among)) continue;
        const group: number[] = [];
        const stack = [piece.uid];
        seen.add(piece.uid);
        while (stack.length > 0) {
          const u = stack.pop()!;
          group.push(u);
          for (const n of base.touching.get(u)!) {
            if (n.kind === 'piece' && !seen.has(n.uid) && isOf(n.uid, mod.among)) {
              seen.add(n.uid);
              stack.push(n.uid);
            }
          }
        }
        if (group.length < 2) continue;
        for (const a of group) {
          let set = next.get(a);
          if (!set) next.set(a, (set = new Set()));
          for (const b of group) if (b !== a) set.add(b);
        }
      }
    }
    links = next;
  }

  // Scoring neighbors again, where links or granted views changed them.
  let neighbors = base.neighbors;
  if (links !== base.links || grantedView.size > 0) {
    const next = new Map<number, readonly Neighbor[]>();
    for (const piece of house.pieces) {
      const old = base.neighbors.get(piece.uid)!;
      const linked = links.get(piece.uid);
      const extra = linked
        ? [...linked].filter((u) => !old.some((n) => n.kind === 'piece' && n.uid === u))
        : [];
      if (extra.length === 0 && !grantedView.has(piece.uid)) {
        next.set(piece.uid, old);
        continue;
      }
      const uids = new Set<number>();
      for (const n of old) if (n.kind === 'piece') uids.add(n.uid);
      extra.forEach((u) => uids.add(u));
      const list: Neighbor[] = [...uids]
        .sort((a, b) => a - b)
        .map((uid): Neighbor => ({ kind: 'piece', uid }));
      for (const n of old) if (n.kind !== 'piece') list.push(n);
      if (grantedView.has(piece.uid)) list.push({ kind: 'view', uid: piece.uid });
      next.set(piece.uid, list);
    }
    neighbors = next;
  }

  return {
    ...base,
    tags,
    grants: grants.size > 0 ? grants : base.grants,
    countsAs,
    grantedView,
    hasView,
    links,
    neighbors,
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
      const id = layout.fencedId[cellIndex(w, nx, ny)]!;
      if (id >= 0) ids.add(id);
    }
    // A yard piece inside a fenced yard sits in it.
    const own = layout.fencedId[cellIndex(w, c.x, c.y)]!;
    if (own >= 0) ids.add(own);
  }
  return [...ids].sort((a, b) => a - b);
}

/** The largest single fenced yard's tiles (for "a fenced yard of 12 tiles"). */
export function largestFencedYard(layout: Layout): number {
  return layout.fencedSizes.reduce((a, b) => Math.max(a, b), 0);
}

export type LayoutOf = (house: HouseState, mods?: readonly LayoutModifier[]) => Layout;

/**
 * Layouts cached per house object and run-level modifier list, per content (WeakMaps, so
 * nothing leaks). The rules intern each run's modifier list, so equal lists share one array.
 */
export function layoutCache(content: Content): LayoutOf {
  const cache = new WeakMap<HouseState, WeakMap<readonly LayoutModifier[], Layout>>();
  return (house, mods = NO_LAYOUT_MODS) => {
    let perHouse = cache.get(house);
    if (!perHouse) cache.set(house, (perHouse = new WeakMap()));
    let layout = perHouse.get(mods);
    if (!layout) {
      layout = computeLayout(content, house, mods);
      perHouse.set(mods, layout);
    }
    return layout;
  };
}
