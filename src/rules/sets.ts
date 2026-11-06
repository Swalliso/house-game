// Set matching (implementation-plan.md §5; Appendix A · M4a, which M1 brings forward for
// Jack-and-Jill and Entertainer). A piece joins at most one instance per set type. A set pays
// its Points and +Mult every week it holds, like a poker hand.
//
// - A set with a hub (Jack-and-Jill's Bathroom) needs the hub to touch every other member.
// - A connected set (Entertainer) needs its members to form one connected group.
//
// "Greedily in placement order" is read as completion order: walking the pieces in placement
// order, each one forms an instance with earlier, still-unused pieces if it can. An instance
// then depends only on pieces placed before the one that completed it, so placing a new piece
// can add a set but never reshuffle or break one the house already holds (D-065).

import type { Content, PieceDef, PieceId, SetDef, SetId, SetScore } from './index.ts';
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

/** Every held set instance, paying at its set type's level (Remodel Plans; 1 when absent). */
export function matchSets(
  content: Content,
  layout: Layout,
  levels: Partial<Record<SetId, number>> = {},
): SetScore[] {
  const out: SetScore[] = [];
  for (const set of Object.values(content.sets)) {
    const level = levels[set.id] ?? 1;
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
  const candidates: Candidate[] = [];
  for (const piece of layout.house.pieces) {
    const type = memberType(set, pieceDef(content, piece));
    if (type) candidates.push({ uid: piece.uid, type });
  }
  const total = Object.values(set.members).reduce((a, b) => a + (b ?? 0), 0);
  const used = new Set<number>();
  const instances: number[][] = [];
  candidates.forEach((newest, k) => {
    const pool = candidates.slice(0, k).filter((c) => !used.has(c.uid));
    const need = new Map(Object.entries(set.members) as [PieceId, number][]);
    need.set(newest.type, need.get(newest.type)! - 1);
    const found = set.hub
      ? withHub(layout, set.hub, newest, pool, need)
      : set.connected
        ? searchConnected(layout, pool, [newest.uid], need, total)
        : searchAny(pool, [newest.uid], need, total);
    if (found) {
      found.forEach((u) => used.add(u));
      instances.push(found);
    }
  });
  return instances;
}

interface Candidate {
  uid: number;
  type: PieceId;
}

const satisfied = (need: ReadonlyMap<PieceId, number>) => [...need.values()].every((n) => n === 0);

/** Takes the earliest pool pieces touching the hub until every need is met. */
function fillAroundHub(
  layout: Layout,
  hub: number,
  pool: readonly Candidate[],
  chosen: number[],
  need: Map<PieceId, number>,
): number[] | null {
  for (const c of pool) {
    if (satisfied(need)) break;
    if (chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    if (!touches(layout, hub, c.uid)) continue;
    chosen.push(c.uid);
    need.set(c.type, need.get(c.type)! - 1);
  }
  return satisfied(need) ? chosen : null;
}

/** An instance around a hub that includes the newest piece: as the hub, or touching one. */
function withHub(
  layout: Layout,
  hubType: PieceId,
  newest: Candidate,
  pool: readonly Candidate[],
  need: Map<PieceId, number>,
): number[] | null {
  if (newest.type === hubType) return fillAroundHub(layout, newest.uid, pool, [newest.uid], need);
  for (const hub of pool) {
    if (hub.type !== hubType || !touches(layout, hub.uid, newest.uid)) continue;
    const n = new Map(need);
    n.set(hubType, n.get(hubType)! - 1);
    const found = fillAroundHub(layout, hub.uid, pool, [hub.uid, newest.uid], n);
    if (found) return found;
  }
  return null;
}

/** Depth-first: grow a connected group from the newest piece, in placement order. */
function searchConnected(
  layout: Layout,
  pool: readonly Candidate[],
  chosen: number[],
  need: Map<PieceId, number>,
  total: number,
): number[] | null {
  if (chosen.length === total) return [...chosen];
  for (const c of pool) {
    if (chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    if (!chosen.some((u) => touches(layout, u, c.uid))) continue;
    need.set(c.type, need.get(c.type)! - 1);
    chosen.push(c.uid);
    const found = searchConnected(layout, pool, chosen, need, total);
    chosen.pop();
    need.set(c.type, need.get(c.type)! + 1);
    if (found) return found;
  }
  return null;
}

/** For sets that needn't connect (Full House, from M4a): the earliest pool piece of each type. */
function searchAny(
  pool: readonly Candidate[],
  chosen: number[],
  need: Map<PieceId, number>,
  total: number,
): number[] | null {
  for (const c of pool) {
    if (chosen.length === total) break;
    if (chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    need.set(c.type, need.get(c.type)! - 1);
    chosen.push(c.uid);
  }
  return chosen.length === total ? chosen : null;
}
