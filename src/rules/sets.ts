// Set matching (implementation-plan.md §5; Appendix A · M4a, which M1 brings forward for
// Jack-and-Jill and Entertainer). A piece joins at most one instance per set type. A set pays
// its Points and +Mult every week it holds, like a poker hand.
//
// - A set with a hub (Jack-and-Jill's Bathroom) needs the hub to touch every other member.
// - A connected set (Entertainer, the Suite) needs its members to form one connected group.
// - A set with `maxInstances` (the Entertainer and Full House: 1) holds at most that many.
//
// "Greedily in placement order" is read as completion order: walking the pieces in placement
// order, each one forms an instance with earlier, still-unused pieces if it can. An instance
// then depends only on pieces placed before the one that completed it, so placing a new piece
// can add a set but never reshuffle or break one the house already holds (D-065).
//
// Hallway links are timed the same way: at each step only the links made by connectors placed
// by then count, so a Hallway placed later can complete a new instance (on its own step) but
// never re-date one the house already holds, or swap which capped instance holds.

import type { Content, PieceDef, PieceId, SetDef, SetId, SetScore } from './index.ts';
import { isRoom, pieceDef, type Layout } from './layout.ts';

/** Which of the set's member types this piece fills, if any (its own id first, then countsAs). */
function memberType(set: SetDef, def: PieceDef): PieceId | null {
  if (set.members[def.id] !== undefined) return def.id;
  if (def.countsAs && set.members[def.countsAs] !== undefined) return def.countsAs;
  return null;
}

/** Whether two pieces count as touching for sets, as of a step in the placement order. */
type Touches = (a: number, b: number) => boolean;

/**
 * When each pair of rooms became linked through Hallways: the step (index in placement order)
 * at which both stood and a group of connectors placed by then touched both. Cached per layout.
 */
const linkTimes = new WeakMap<Layout, Map<string, number>>();

function hallwayLinkTimes(content: Content, layout: Layout): Map<string, number> {
  let times = linkTimes.get(layout);
  if (times) return times;
  times = new Map();
  const pieces = layout.house.pieces;
  const at = new Map(pieces.map((p, i) => [p.uid, i]));
  const defs = new Map(pieces.map((p) => [p.uid, pieceDef(content, p)]));
  const links = (uid: number) => defs.get(uid)!.effects.some((e) => e.kind === 'link');
  if (pieces.some((p) => links(p.uid))) {
    for (let t = 0; t < pieces.length; t++) {
      const newest = pieces[t]!.uid;
      if (!links(newest) && !isRoom(defs.get(newest)!)) continue;
      // The connector groups as of step t, and the rooms (placed by then) each touches.
      const seen = new Set<number>();
      for (let c = 0; c <= t; c++) {
        const start = pieces[c]!.uid;
        if (!links(start) || seen.has(start)) continue;
        const rooms: number[] = [];
        const stack = [start];
        seen.add(start);
        while (stack.length > 0) {
          const u = stack.pop()!;
          for (const n of layout.touching.get(u)!) {
            if (n.kind !== 'piece' || at.get(n.uid)! > t) continue;
            if (links(n.uid) && !seen.has(n.uid)) {
              seen.add(n.uid);
              stack.push(n.uid);
            } else if (isRoom(defs.get(n.uid)!) && !rooms.includes(n.uid)) rooms.push(n.uid);
          }
        }
        for (const a of rooms) {
          for (const b of rooms) {
            const key = `${a},${b}`;
            if (a !== b && !times.has(key)) times.set(key, t);
          }
        }
      }
    }
  }
  linkTimes.set(layout, times);
  return times;
}

/** Touching for sets as of step t: physically, through Open Concept, or a Hallway linked by then. */
function touchesAt(content: Content, layout: Layout, t: number): Touches {
  const times = hallwayLinkTimes(content, layout);
  // Open Concept's links come from the pieces themselves, not a later connector, so they stand.
  const openConcept = layout.mods.some((m) => m.kind === 'link');
  return (a, b) => {
    if (!layout.neighbors.get(a)!.some((n) => n.kind === 'piece' && n.uid === b)) return false;
    const linked = times.get(`${a},${b}`);
    if (linked === undefined || linked <= t) return true;
    // Linked only later through a Hallway: they count as touching only if they also touch.
    return openConcept || layout.touching.get(a)!.some((n) => n.kind === 'piece' && n.uid === b);
  };
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
  const pieces = layout.house.pieces;
  const isLink = (i: number) =>
    pieceDef(content, pieces[i]!).effects.some((e) => e.kind === 'link');
  const steps: { candidate: Candidate | null; index: number }[] = [];
  pieces.forEach((piece, index) => {
    const type = memberType(set, pieceDef(content, piece));
    if (type) {
      const c = { uid: piece.uid, type };
      candidates.push(c);
      steps.push({ candidate: c, index });
    } else if (isLink(index)) steps.push({ candidate: null, index });
  });
  const total = Object.values(set.members).reduce((a, b) => a + (b ?? 0), 0);
  const used = new Set<number>();
  const instances: number[][] = [];
  // One Entertainer per house (D-093), one Full House: the first instance completed holds.
  const cap = set.maxInstances ?? Infinity;
  const tryForm = (newest: Candidate, pool: readonly Candidate[], touches: Touches): boolean => {
    const need = new Map(Object.entries(set.members) as [PieceId, number][]);
    need.set(newest.type, need.get(newest.type)! - 1);
    const found = set.hub
      ? withHub(touches, set.hub, newest, pool, need)
      : set.connected
        ? searchConnected(touches, pool, [newest.uid], need, total)
        : searchAny(pool, [newest.uid], need, total);
    if (!found) return false;
    found.forEach((u) => used.add(u));
    instances.push(found);
    return true;
  };
  let seenCandidates = 0;
  for (const step of steps) {
    if (instances.length >= cap) break;
    const touches = touchesAt(content, layout, step.index);
    if (step.candidate) {
      // A member's step: an instance it completes with earlier, unused members.
      const pool = candidates.slice(0, seenCandidates).filter((c) => !used.has(c.uid));
      seenCandidates++;
      tryForm(step.candidate, pool, touches);
      continue;
    }
    // A Hallway's step: instances its links complete among the members placed so far.
    let formed = true;
    while (formed && instances.length < cap) {
      formed = false;
      const placed = candidates.slice(0, seenCandidates).filter((c) => !used.has(c.uid));
      for (const c of placed) {
        if (
          tryForm(
            c,
            placed.filter((o) => o !== c),
            touches,
          )
        ) {
          formed = true;
          break;
        }
      }
    }
  }
  return instances;
}

interface Candidate {
  uid: number;
  type: PieceId;
}

const satisfied = (need: ReadonlyMap<PieceId, number>) => [...need.values()].every((n) => n === 0);

/** Takes the earliest pool pieces touching the hub until every need is met. */
function fillAroundHub(
  touches: Touches,
  hub: number,
  pool: readonly Candidate[],
  chosen: number[],
  need: Map<PieceId, number>,
): number[] | null {
  for (const c of pool) {
    if (satisfied(need)) break;
    if (chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    if (!touches(hub, c.uid)) continue;
    chosen.push(c.uid);
    need.set(c.type, need.get(c.type)! - 1);
  }
  return satisfied(need) ? chosen : null;
}

/** An instance around a hub that includes the newest piece: as the hub, or touching one. */
function withHub(
  touches: Touches,
  hubType: PieceId,
  newest: Candidate,
  pool: readonly Candidate[],
  need: Map<PieceId, number>,
): number[] | null {
  if (newest.type === hubType) return fillAroundHub(touches, newest.uid, pool, [newest.uid], need);
  for (const hub of pool) {
    if (hub.type !== hubType || !touches(hub.uid, newest.uid)) continue;
    const n = new Map(need);
    n.set(hubType, n.get(hubType)! - 1);
    const found = fillAroundHub(touches, hub.uid, pool, [hub.uid, newest.uid], n);
    if (found) return found;
  }
  return null;
}

/** Depth-first: grow a connected group from the newest piece, in placement order. */
function searchConnected(
  touches: Touches,
  pool: readonly Candidate[],
  chosen: number[],
  need: Map<PieceId, number>,
  total: number,
): number[] | null {
  if (chosen.length === total) return [...chosen];
  for (const c of pool) {
    if (chosen.includes(c.uid) || (need.get(c.type) ?? 0) <= 0) continue;
    if (!chosen.some((u) => touches(u, c.uid))) continue;
    need.set(c.type, need.get(c.type)! - 1);
    chosen.push(c.uid);
    const found = searchConnected(touches, pool, chosen, need, total);
    chosen.pop();
    need.set(c.type, need.get(c.type)! + 1);
    if (found) return found;
  }
  return null;
}

/** For sets that needn't connect (Full House): the earliest pool piece of each type. */
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
