// Selectors and piece conditions: which pieces or lot features an effect looks at
// (implementation-plan.md §5), and the tag-resolution order (§4):
//   1. layout facts
//   2. own tags, plus Dark if interior and Sunny if a building in the sun (layout.tags)
//   3. grantTag and removeTag modifiers (layout.ts)
//   4. type identity: `{ piece: X }` matches id X, `countsAs: X`, or a countsAs modifier
//   5. conditions, specs, and sets
//   6. per-piece effects
// A feature's tags come from its FeatureDef. Inside a fixture's modifiers, `{ host: true }`
// is the piece it's installed in, so matchers take the host's uid when there is one.

import type {
  Card,
  Content,
  Effect,
  PieceCondition,
  PieceDef,
  PieceId,
  Region,
  Selector,
  Tag,
} from './index.ts';
import {
  fencedYardsBordered,
  isRoom,
  neighborFeature,
  pieceDef,
  pieceIn,
  type Layout,
  type Neighbor,
} from './layout.ts';
import { matchSets } from './sets.ts';

export function isType(def: PieceDef, id: PieceId): boolean {
  return def.id === id || def.countsAs === id;
}

/** A placed piece's type identity, with countsAs modifiers (Kitchen Island). */
export function isPieceType(layout: Layout, def: PieceDef, uid: number, id: PieceId): boolean {
  return isType(def, id) || !!layout.countsAs.get(uid)?.has(id);
}

/** The root type of a card's piece: its countsAs, or its own id (for D-076's strikes). */
export function rootType(def: PieceDef): PieceId {
  return def.countsAs ?? def.id;
}

/** A piece's effective tags (§4 steps 1–2). */
export function pieceTags(layout: Layout, uid: number): ReadonlySet<Tag> {
  return layout.tags.get(uid) ?? new Set();
}

/** Does this neighbor (a piece, a tile feature, the street, or a granted view) match the selector? */
export function matchesNeighbor(
  content: Content,
  layout: Layout,
  sel: Selector,
  n: Neighbor,
  host?: number,
): boolean {
  if (n.kind === 'piece') return matchesPiece(content, layout, sel, n.uid, host);
  // A window's view (a Bay Window) counts only where a view is asked for by name.
  if (n.kind === 'view') return matchesView(sel);
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesNeighbor(content, layout, s, n, host));
  if ('all' in sel) return sel.all.every((s) => matchesNeighbor(content, layout, s, n, host));
  if ('not' in sel) return !matchesNeighbor(content, layout, sel.not, n, host);
  const feature = neighborFeature(n)!;
  const def = content.features[feature];
  if ('piece' in sel || 'host' in sel || 'hasFixture' in sel) return false;
  if ('feature' in sel) {
    return typeof sel.feature === 'string'
      ? sel.feature === feature
      : sel.feature.includes(feature);
  }
  if ('tag' in sel) return def.tags.includes(sel.tag);
  // A feature is never in a region or touching anything, for selectors' purposes.
  if ('in' in sel || 'touching' in sel) return false;
  // A feature is never indoor, a yard piece, a room, or a piece with a view.
  return sel.property === 'viewSource' && !!def.viewSource;
}

/**
 * A granted view: no tags, not a piece or a feature, and not "any neighbor". It matches only
 * a `viewSource` term, alone or inside `any` and `all`.
 */
function matchesView(sel: Selector): boolean {
  if (sel === 'all' || 'not' in sel) return false;
  if ('any' in sel) return sel.any.some(matchesView);
  if ('all' in sel) return sel.all.every(matchesView);
  return 'property' in sel && sel.property === 'viewSource';
}

export function matchesPiece(
  content: Content,
  layout: Layout,
  sel: Selector,
  uid: number,
  host?: number,
): boolean {
  const piece = layout.byUid.get(uid);
  if (!piece) return false;
  const def = pieceDef(content, piece);
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesPiece(content, layout, s, uid, host));
  if ('all' in sel) return sel.all.every((s) => matchesPiece(content, layout, s, uid, host));
  if ('not' in sel) return !matchesPiece(content, layout, sel.not, uid, host);
  if ('host' in sel) return host === uid;
  if ('hasFixture' in sel) {
    return sel.hasFixture === 'any' ? !!piece.fixture : piece.fixture?.id === sel.hasFixture;
  }
  if ('piece' in sel) {
    return typeof sel.piece === 'string'
      ? isPieceType(layout, def, uid, sel.piece)
      : sel.piece.some((id) => isPieceType(layout, def, uid, id));
  }
  if ('feature' in sel) return false;
  if ('tag' in sel) return pieceTags(layout, uid).has(sel.tag);
  if ('in' in sel) return pieceIn(layout, uid, sel.in);
  if ('touching' in sel) {
    return countTouching(content, layout, uid, sel.touching, host) >= (sel.min ?? 1);
  }
  switch (sel.property) {
    case 'indoor':
    case 'yard':
    case 'outbuilding':
      return def.category === sel.property;
    case 'room':
      return isRoom(def);
    case 'exterior':
      return layout.exterior.has(uid);
    case 'interior':
      return layout.interior.has(uid);
    case 'view':
      return layout.hasView.has(uid);
    case 'viewSource':
      return !!def.givesView;
  }
}

/**
 * Does a card's definition match, before it's placed? For draw weights, crate filters, and
 * strikes: ids, own tags, categories, and `room`; anything about the layout doesn't match.
 */
export function matchesDef(sel: Selector, def: PieceDef): boolean {
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesDef(s, def));
  if ('all' in sel) return sel.all.every((s) => matchesDef(s, def));
  if ('not' in sel) return !matchesDef(sel.not, def);
  if ('piece' in sel) {
    return typeof sel.piece === 'string'
      ? isType(def, sel.piece)
      : sel.piece.some((id) => isType(def, id));
  }
  if ('tag' in sel) return def.tags.includes(sel.tag);
  if ('property' in sel) {
    switch (sel.property) {
      case 'indoor':
      case 'yard':
      case 'outbuilding':
        return def.category === sel.property;
      case 'room':
        return isRoom(def);
      case 'viewSource':
        return !!def.givesView;
      default:
        return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------
// D-166: the yards a card reads, for the board's shading while it's picked.

/** The two yards, split at the house's front row (layout.ts). */
export type Yard = Extract<Region, 'frontYard' | 'backYard'>;
const YARDS: readonly Yard[] = ['frontYard', 'backYard'];

function selectorRegions(sel: Selector, out: Set<Region>): void {
  if (sel === 'all') return;
  if ('in' in sel) out.add(sel.in);
  else if ('touching' in sel) selectorRegions(sel.touching, out);
  else if ('any' in sel) sel.any.forEach((s) => selectorRegions(s, out));
  else if ('all' in sel) sel.all.forEach((s) => selectorRegions(s, out));
  else if ('not' in sel) selectorRegions(sel.not, out);
}

function conditionRegions(c: PieceCondition, out: Set<Region>): void {
  if ('in' in c) out.add(c.in);
  else if ('touching' in c) selectorRegions(c.touching, out);
  else if ('is' in c) selectorRegions(c.is, out);
  else if ('and' in c) c.and.forEach((x) => conditionRegions(x, out));
  else if ('or' in c) c.or.forEach((x) => conditionRegions(x, out));
  else if ('not' in c) conditionRegions(c.not, out);
}

function effectRegions(e: Effect, out: Set<Region>): void {
  switch (e.kind) {
    case 'perTile':
      out.add(e.region);
      break;
    case 'conditional':
      conditionRegions(e.when, out);
      effectRegions(e.effect, out);
      break;
    case 'requires':
      conditionRegions(e.condition, out);
      break;
    case 'neighbor':
    case 'aura':
      selectorRegions(e.match, out);
      break;
    default:
      break;
  }
}

/**
 * The yards a card's lines name (D-166): a piece's effects ("+1 every week in the back yard"),
 * or a fixture's modifiers (Garden Lights' front yard). The board shades them while it's picked.
 */
export function yardsRead(content: Content, card: Card): Yard[] {
  const out = new Set<Region>();
  if (card.kind === 'piece') {
    for (const e of content.pieces[card.id]?.effects ?? []) effectRegions(e, out);
  } else {
    for (const m of content.fixtures[card.id]?.modifiers ?? []) {
      if ('target' in m && m.target !== 'all') selectorRegions(m.target, out);
    }
  }
  return YARDS.filter((y) => out.has(y));
}

/** Distinct neighbors (for scoring: links count, connectors don't) matching the selector. */
export function countTouching(
  content: Content,
  layout: Layout,
  uid: number,
  sel: Selector,
  host?: number,
): number {
  let n = 0;
  for (const nb of layout.neighbors.get(uid) ?? []) {
    if (matchesNeighbor(content, layout, sel, nb, host)) n++;
  }
  return n;
}

const setMembersCache = new WeakMap<Layout, Map<string, Set<number>>>();

/** The uids in held instances of each set, computed once per layout. */
function setMembers(content: Content, layout: Layout): Map<string, Set<number>> {
  let m = setMembersCache.get(layout);
  if (!m) {
    m = new Map();
    for (const s of matchSets(content, layout)) {
      let set = m.get(s.set);
      if (!set) m.set(s.set, (set = new Set()));
      for (const u of s.members) set.add(u);
    }
    setMembersCache.set(layout, m);
  }
  return m;
}

/** Does a piece meet a condition (for `requires` and `conditional`)? */
export function meetsCondition(
  content: Content,
  layout: Layout,
  cond: PieceCondition,
  uid: number,
  host?: number,
): boolean {
  if ('and' in cond) return cond.and.every((c) => meetsCondition(content, layout, c, uid, host));
  if ('or' in cond) return cond.or.some((c) => meetsCondition(content, layout, c, uid, host));
  if ('not' in cond) return !meetsCondition(content, layout, cond.not, uid, host);
  if ('touching' in cond) {
    return countTouching(content, layout, uid, cond.touching, host) >= (cond.min ?? 1);
  }
  if ('in' in cond) return pieceIn(layout, uid, cond.in);
  if ('borders' in cond) return fencedYardsBordered(layout, uid).length > 0;
  if ('is' in cond) return matchesPiece(content, layout, cond.is, uid, host);
  return setMembers(content, layout).get(cond.inSet)?.has(uid) ?? false;
}
