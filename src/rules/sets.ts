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
// Links are timed the same way: at each step only the links made by then count (a Hallway's,
// from the connectors placed by then; Open Concept's, from the groups its types formed by
// then), so a Hallway or a bridging room placed later can complete a new instance (on its own
// step) but never re-date one the house already holds, or swap which capped instance holds.

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

/**
 * When each pair of pieces became linked through Open Concept (a `link` modifier): the step at
 * which both stood in one physically connected group of its types, built from pieces placed by
 * then. A later piece that bridges two groups links them from its own step, never earlier.
 * Cached per layout.
 */
const conceptTimes = new WeakMap<Layout, Map<string, number>>();

function openConceptLinkTimes(content: Content, layout: Layout): Map<string, number> {
  let times = conceptTimes.get(layout);
  if (times) return times;
  times = new Map();
  const pieces = layout.house.pieces;
  const at = new Map(pieces.map((p, i) => [p.uid, i]));
  for (const mod of layout.mods) {
    if (mod.kind !== 'link') continue;
    const among = mod.among;
    const isOf = (uid: number) => {
      const def = pieceDef(content, layout.byUid.get(uid)!);
      const extra = layout.countsAs.get(uid);
      return among.some((id) => def.id === id || def.countsAs === id || !!extra?.has(id));
    };
    for (let t = 0; t < pieces.length; t++) {
      // Only a piece of these types can join or bridge groups at its step.
      if (!isOf(pieces[t]!.uid)) continue;
      const seen = new Set<number>();
      for (let c = 0; c <= t; c++) {
        const start = pieces[c]!.uid;
        if (seen.has(start) || !isOf(start)) continue;
        const group: number[] = [];
        const stack = [start];
        seen.add(start);
        while (stack.length > 0) {
          const u = stack.pop()!;
          group.push(u);
          for (const n of layout.touching.get(u)!) {
            if (n.kind !== 'piece' || seen.has(n.uid) || at.get(n.uid)! > t || !isOf(n.uid)) {
              continue;
            }
            seen.add(n.uid);
            stack.push(n.uid);
          }
        }
        for (const a of group) {
          for (const b of group) {
            const key = `${a},${b}`;
            if (a !== b && !times.has(key)) times.set(key, t);
          }
        }
      }
    }
  }
  conceptTimes.set(layout, times);
  return times;
}

/**
 * Touching for sets as of step t: physically, or through a link (a Hallway's or Open
 * Concept's) made by then. A link made later never counts at an earlier step, so a new piece
 * can't re-date or swap an instance the house already holds (D-065).
 */
function touchesAt(content: Content, layout: Layout, t: number): Touches {
  const hallway = hallwayLinkTimes(content, layout);
  const concept = layout.mods.some((m) => m.kind === 'link')
    ? openConceptLinkTimes(content, layout)
    : null;
  return (a, b) => {
    if (!layout.neighbors.get(a)!.some((n) => n.kind === 'piece' && n.uid === b)) return false;
    if (layout.touching.get(a)!.some((n) => n.kind === 'piece' && n.uid === b)) return true;
    const key = `${a},${b}`;
    const h = hallway.get(key);
    const c = concept?.get(key);
    if (h === undefined && c === undefined) return true; // no other source of links
    return (h !== undefined && h <= t) || (c !== undefined && c <= t);
  };
}

export function instanceKey(set: SetDef, members: readonly number[]): string {
  return `${set.id}:${[...members].sort((a, b) => a - b).join(',')}`;
}

/** A held instance before levels: its set, its key, and its members in uid order. */
interface Instance {
  set: SetDef;
  key: string;
  members: readonly number[];
}

/**
 * Every set's instances, per layout: the tally, `inSet` conditions, and `set` specs all ask,
 * and levels only change what an instance pays, so one layout matches its sets once.
 */
const instanceCache = new WeakMap<Layout, { content: Content; instances: readonly Instance[] }>();

function instancesOf(content: Content, layout: Layout): readonly Instance[] {
  const hit = instanceCache.get(layout);
  if (hit && hit.content === content) return hit.instances;
  const instances: Instance[] = [];
  for (const set of Object.values(content.sets)) {
    for (const found of matchSet(content, layout, set)) {
      const members = [...found].sort((a, b) => a - b);
      instances.push({ set, key: instanceKey(set, members), members });
    }
  }
  instanceCache.set(layout, { content, instances });
  return instances;
}

/** Every held set instance, paying at its set type's level (Remodel Plans; 1 when absent). */
export function matchSets(
  content: Content,
  layout: Layout,
  levels: Partial<Record<SetId, number>> = {},
): SetScore[] {
  return instancesOf(content, layout).map(({ set, key, members }) => {
    const level = levels[set.id] ?? 1;
    return {
      set: set.id,
      key,
      members: [...members],
      points: set.points + (level - 1) * set.level.points,
      mult: set.mult + (level - 1) * set.level.mult,
    };
  });
}

function matchSet(content: Content, layout: Layout, set: SetDef): number[][] {
  const needs = Object.entries(set.members) as [PieceId, number][];
  const pieces = layout.house.pieces;
  const steps: { candidate: Candidate | null; index: number }[] = [];
  /** Unused candidates of each type, placed by now or later. */
  const left = new Map<PieceId, number>();
  pieces.forEach((piece, index) => {
    const def = pieceDef(content, piece);
    const type = memberType(set, def);
    if (type) {
      steps.push({ candidate: { uid: piece.uid, type }, index });
      left.set(type, (left.get(type) ?? 0) + 1);
    } else if (def.effects.some((e) => e.kind === 'link')) steps.push({ candidate: null, index });
  });
  // Too few of a type left for one more instance (Full House's nine types; a Suite with no
  // Closet): no step can form one.
  const short = (have: ReadonlyMap<PieceId, number>, plus: PieceId | null = null) =>
    needs.some(([t, n]) => (have.get(t) ?? 0) + (t === plus ? 1 : 0) < n);
  if (short(left)) return [];
  const total = needs.reduce((a, [, n]) => a + (n ?? 0), 0);
  const instances: number[][] = [];
  // One Entertainer per house (D-093), one Full House: the first instance completed holds.
  const cap = set.maxInstances ?? Infinity;
  /** The unused candidates placed so far, in placement order, and their counts by type. */
  let pool: Candidate[] = [];
  const pooled = new Map<PieceId, number>();
  const count = (m: Map<PieceId, number>, t: PieceId, by: number) => m.set(t, (m.get(t) ?? 0) + by);
  /**
   * The instance `newest` completes with pool members, if any. The pool may hold `newest`
   * itself (a Hallway's step): every search skips the members it has chosen, so that's the
   * same as leaving it out.
   */
  const search = (newest: Candidate, touches: Touches): number[] | null => {
    const need = new Map(needs);
    need.set(newest.type, need.get(newest.type)! - 1);
    return set.hub
      ? withHub(touches, set.hub, newest, pool, need)
      : set.connected
        ? searchConnected(touches, pool, [newest.uid], need, total)
        : searchAny(pool, [newest.uid], need, total);
  };
  const take = (found: readonly number[]) => {
    instances.push([...found]);
    const taken = new Set(found);
    for (const c of pool) {
      if (!taken.has(c.uid)) continue;
      count(pooled, c.type, -1);
      count(left, c.type, -1);
    }
    pool = pool.filter((c) => !taken.has(c.uid));
  };
  for (const step of steps) {
    if (instances.length >= cap || short(left)) break;
    const newest = step.candidate;
    if (newest) {
      // A member's step: an instance it completes with earlier, unused members.
      const found = short(pooled, newest.type)
        ? null
        : search(newest, touchesAt(content, layout, step.index));
      if (found) {
        count(left, newest.type, -1);
        take(found);
      } else {
        pool.push(newest);
        count(pooled, newest.type, 1);
      }
      continue;
    }
    // A Hallway's step: instances its links complete among the members placed so far.
    let touches: Touches | null = null;
    while (instances.length < cap && !short(pooled)) {
      touches ??= touchesAt(content, layout, step.index);
      let found: number[] | null = null;
      for (const c of pool) {
        found = search(c, touches);
        if (found) break;
      }
      if (!found) break;
      take(found);
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
