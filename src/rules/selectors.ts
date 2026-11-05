// Selectors: which pieces or lot features an effect looks at (implementation-plan.md §5).
//
// M1's tag resolution is the first two steps of §4's order: layout facts, then a piece's own
// tags (a feature's tags come from its FeatureDef). Type identity matches the id or `countsAs`.
// M2 adds Dark and Sunny from the layout; later phases add tag modifiers.

import type { Content, PieceDef, PieceId, Selector, Tag } from './index.ts';
import { neighborFeature, pieceDef, type Layout, type Neighbor } from './layout.ts';

export function isType(def: PieceDef, id: PieceId): boolean {
  return def.id === id || def.countsAs === id;
}

export function pieceTags(def: PieceDef): readonly Tag[] {
  return def.tags;
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
  if ('tag' in sel) return pieceTags(def).includes(sel.tag);
  switch (sel.property) {
    case 'indoor':
    case 'yard':
    case 'outbuilding':
      return def.category === sel.property;
    case 'room':
      // Every M1 indoor piece is a room; the Hallway (M2) is the first connector.
      return def.category === 'indoor';
    case 'view':
      return layout.hasView.has(uid);
    case 'viewSource':
      return !!def.givesView;
  }
}
