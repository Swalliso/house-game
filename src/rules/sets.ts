// Set matching (implementation-plan.md §5; Appendix A · M4a, which M1 brings forward for
// Jack-and-Jill and Entertainer). Instances are matched greedily in placement order, and a
// piece joins at most one instance per set type. A set pays its Points and +Mult every week
// it holds, like a poker hand.
//
// - A set with a hub (Jack-and-Jill's Bathroom) needs the hub to touch every other member.
// - A connected set (Entertainer) needs its members to form one connected group.
// For each unused piece in placement order, the earliest-placed completion is taken: a small
// depth-first search, so an early wrong pick can't hide a valid instance.

import type { Content, PieceDef, PieceId, SetDef, SetScore } from './index.ts';
import { pieceDef, type Layout } from './layout.ts';

/** Which of the set's member types this piece fills, if any (its own id first, then countsAs). */
function memberType(set: SetDef, def: PieceDef): PieceId | null {
  if (set.members[def.id] !== undefined) return def.id;
  if (def.countsAs && set.members[def.countsAs] !== undefined) return def.countsAs;
  return null;
}

function touches(layout: Layout, a: number, b: number): boolean {
  return layout.neighbors.get(a)!.some((n) => n.kind === 'piece' && n.uid === b);
}

export function instanceKey(set: SetDef, members: readonly number[]): string {
  return `${set.id}:${[...members].sort((a, b) => a - b).join(',')}`;
}

export function matchSets(content: Content, layout: Layout, level = 1): SetScore[] {
  const out: SetScore[] = [];
  for (const set of Object.values(content.sets)) {
    for (const members of matchSet(content, layout, set)) {
      out.push({
        set: set.id,
        key: instanceKey(set, members),
        members: [...members].sort((a, b) => a - b),
        points: set.points + (level - 1) * set.level.points,
        mult: set.mult + (level - 1) * set.level.mult,
      });
    }
  }
  return out;
}

function matchSet(content: Content, layout: Layout, set: SetDef): number[][] {
  const candidates: { uid: number; type: PieceId }[] = [];
  for (const piece of layout.house.pieces) {
    const type = memberType(set, pieceDef(content, piece));
    if (type) candidates.push({ uid: piece.uid, type });
  }
  const used = new Set<number>();
  const instances: number[][] = [];

  if (set.hub) {
    for (const hub of candidates) {
      if (hub.type !== set.hub || used.has(hub.uid)) continue;
      const need = new Map(Object.entries(set.members) as [PieceId, number][]);
      need.set(set.hub, (need.get(set.hub) ?? 1) - 1);
      const chosen = [hub.uid];
      for (const other of candidates) {
        if (other.uid === hub.uid || used.has(other.uid)) continue;
        const left = need.get(other.type) ?? 0;
        if (left > 0 && touches(layout, hub.uid, other.uid)) {
          chosen.push(other.uid);
          need.set(other.type, left - 1);
        }
      }
      if ([...need.values()].every((n) => n === 0)) {
        chosen.forEach((u) => used.add(u));
        instances.push(chosen);
      }
    }
    return instances;
  }

  const total = Object.values(set.members).reduce((a, b) => a + (b ?? 0), 0);
  for (const seed of candidates) {
    if (used.has(seed.uid)) continue;
    const need = new Map(Object.entries(set.members) as [PieceId, number][]);
    need.set(seed.type, need.get(seed.type)! - 1);
    const found = set.connected
      ? searchConnected(layout, candidates, used, [seed.uid], need, total)
      : searchAny(candidates, used, [seed.uid], need, total);
    if (found) {
      found.forEach((u) => used.add(u));
      instances.push(found);
    }
  }
  return instances;
}

/** Depth-first: grow a connected group in placement order until every need is met. */
function searchConnected(
  layout: Layout,
  candidates: readonly { uid: number; type: PieceId }[],
  used: ReadonlySet<number>,
  chosen: number[],
  need: Map<PieceId, number>,
  total: number,
): number[] | null {
  if (chosen.length === total) return chosen;
  for (const c of candidates) {
    if (used.has(c.uid) || chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    if (!chosen.some((u) => touches(layout, u, c.uid))) continue;
    need.set(c.type, need.get(c.type)! - 1);
    chosen.push(c.uid);
    const found = searchConnected(layout, candidates, used, chosen, need, total);
    if (found) return found;
    chosen.pop();
    need.set(c.type, need.get(c.type)! + 1);
  }
  return null;
}

/** For sets that needn't connect (Full House, from M4a): the earliest unused piece of each type. */
function searchAny(
  candidates: readonly { uid: number; type: PieceId }[],
  used: ReadonlySet<number>,
  chosen: number[],
  need: Map<PieceId, number>,
  total: number,
): number[] | null {
  for (const c of candidates) {
    if (chosen.length === total) break;
    if (used.has(c.uid) || chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    need.set(c.type, need.get(c.type)! - 1);
    chosen.push(c.uid);
  }
  return chosen.length === total ? chosen : null;
}
