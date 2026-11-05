// Selectors and piece conditions: which pieces or lot features an effect looks at
// (implementation-plan.md §5), and the tag-resolution order (§4):
//   1. layout facts
//   2. own tags, plus Dark if interior and Sunny if on a sunny tile (layout.tags)
//   3. grantTag and removeTag modifiers (from M3)
//   4. type identity: `{ piece: X }` matches id X or `countsAs: X`
//   5. conditions, specs, and sets
//   6. per-piece effects
// A feature's tags come from its FeatureDef.

import type { Content, PieceCondition, PieceDef, PieceId, Selector, Tag } from './index.ts';
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

/** A piece's effective tags (§4 steps 1–2). */
export function pieceTags(layout: Layout, uid: number): ReadonlySet<Tag> {
  return layout.tags.get(uid) ?? new Set();
}

/** Does this neighbor (a piece, a tile feature, or the street) match the selector? */
export function matchesNeighbor(
  content: Content,
  layout: Layout,
  sel: Selector,
  n: Neighbor,
): boolean {
  if (n.kind === 'piece') return matchesPiece(content, layout, sel, n.uid);
  const feature = neighborFeature(n)!;
  const def = content.features[feature];
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesNeighbor(content, layout, s, n));
  if ('all' in sel) return sel.all.every((s) => matchesNeighbor(content, layout, s, n));
  if ('not' in sel) return !matchesNeighbor(content, layout, sel.not, n);
  if ('piece' in sel) return false;
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

export function matchesPiece(
  content: Content,
  layout: Layout,
  sel: Selector,
  uid: number,
): boolean {
  const piece = layout.byUid.get(uid);
  if (!piece) return false;
  const def = pieceDef(content, piece);
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesPiece(content, layout, s, uid));
  if ('all' in sel) return sel.all.every((s) => matchesPiece(content, layout, s, uid));
  if ('not' in sel) return !matchesPiece(content, layout, sel.not, uid);
  if ('piece' in sel) {
    return typeof sel.piece === 'string'
      ? isType(def, sel.piece)
      : sel.piece.some((id) => isType(def, id));
  }
  if ('feature' in sel) return false;
  if ('tag' in sel) return pieceTags(layout, uid).has(sel.tag);
  if ('in' in sel) return pieceIn(layout, uid, sel.in);
  if ('touching' in sel) return countTouching(content, layout, uid, sel.touching) >= (sel.min ?? 1);
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

/** Distinct neighbors (for scoring: links count, connectors don't) matching the selector. */
export function countTouching(
  content: Content,
  layout: Layout,
  uid: number,
  sel: Selector,
): number {
  let n = 0;
  for (const nb of layout.neighbors.get(uid) ?? []) {
    if (matchesNeighbor(content, layout, sel, nb)) n++;
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
): boolean {
  if ('and' in cond) return cond.and.every((c) => meetsCondition(content, layout, c, uid));
  if ('or' in cond) return cond.or.some((c) => meetsCondition(content, layout, c, uid));
  if ('not' in cond) return !meetsCondition(content, layout, cond.not, uid);
  if ('touching' in cond) {
    return countTouching(content, layout, uid, cond.touching) >= (cond.min ?? 1);
  }
  if ('in' in cond) return pieceIn(layout, uid, cond.in);
  if ('borders' in cond) return fencedYardsBordered(layout, uid).length > 0;
  if ('is' in cond) return matchesPiece(content, layout, cond.is, uid);
  return setMembers(content, layout).get(cond.inSet)?.has(uid) ?? false;
}
