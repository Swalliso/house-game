// House conditions (implementation-plan.md §5): client specs, the house rules every client's
// checklist starts with (house-systems-review.md §4), and (M4b) change-order requests. They're
// checked on the layout every week, so a demolition can lose one.
//
// Counting: a `count` whose selector names piece types directly (`{ piece: X }`, alone or in
// a top-level `all`) counts the pieces whose own card is that type, each weighted by its
// countsAs modifiers for that type: Bunk Beds make a Bedroom count twice. A countsAs modifier
// for another type doesn't add a room (a Kitchen with an Island is still one Kitchen, not a
// Dining Room). Any other selector counts each matching piece once. Lot features never count.
//
// Limits: a `count` with a `max` over piece types (reached through `and` and the current
// stage) is that type's limit. A card whose type is at its limit can renovate a room of that
// type instead (Renovate), and draws at reduced weight (D-043, amended by D-093).

import type {
  Content,
  HouseCondition,
  PieceId,
  ProgressPart,
  Selector,
  SpecDef,
  TypeLimit,
} from './index.ts';
import { cellIndex } from './grid.ts';
import { isRoom, largestFencedYard, pieceDef, type Layout } from './layout.ts';
import { isType, matchesPiece, rootType } from './selectors.ts';
import { matchSets } from './sets.ts';
import { article } from './text.ts';

/** What a condition needs beyond the house. */
export interface CondCtx {
  /** The current milestone (0-based), for conditions that change by stage. */
  phase: number;
  /** M4b: an accepted change order. Pieces with uid ≥ sinceUid are new; demolitions since. */
  order?: { sinceUid: number; demolished: number };
}

/** The piece types a selector names directly: `{ piece }`, alone or in a top-level `all`. */
function directTypes(sel: Selector): readonly PieceId[] | null {
  if (sel === 'all') return null;
  if ('piece' in sel) return typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
  if ('all' in sel) {
    for (const s of sel.all) {
      if (s !== 'all' && 'piece' in s) return typeof s.piece === 'string' ? [s.piece] : s.piece;
    }
  }
  return null;
}

/** What one piece adds to a count of `sel` (see the header). */
function weightOf(content: Content, layout: Layout, sel: Selector, uid: number): number {
  if (!matchesPiece(content, layout, sel, uid)) return 0;
  const types = directTypes(sel);
  if (!types) return 1;
  const def = pieceDef(content, layout.byUid.get(uid)!);
  let w = 0;
  for (const id of types) {
    if (!isType(def, id)) continue;
    w = Math.max(w, 1, layout.countsAs.get(uid)?.get(id) ?? 1);
  }
  return w;
}

/** Counts per layout and selector object (content's selectors keep their identity), for the tally's specs. */
const countCache = new WeakMap<Layout, Map<Selector, number>>();

/** The weighted count of pieces matching a selector. */
export function countMatching(
  content: Content,
  layout: Layout,
  sel: Selector,
  sinceUid = 0,
): number {
  let cache: Map<Selector, number> | undefined;
  if (sinceUid === 0 && typeof sel === 'object') {
    cache = countCache.get(layout);
    if (!cache) countCache.set(layout, (cache = new Map()));
    const hit = cache.get(sel);
    if (hit !== undefined) return hit;
  }
  let n = 0;
  for (const p of layout.house.pieces) {
    if (p.uid < sinceUid) continue;
    n += weightOf(content, layout, sel, p.uid);
  }
  cache?.set(sel, n);
  return n;
}

/** The current stage of a staged condition: the last one whose phase has begun. */
export function currentStage(
  cond: Extract<HouseCondition, { stages: unknown }>,
  phase: number,
): HouseCondition | null {
  let found: HouseCondition | null = null;
  for (const s of cond.stages) if (s.fromPhase <= phase) found = s.condition;
  return found;
}

/** The house's outline: its rooms, indoor tiles, and the box around the indoor tiles. */
export interface Outline {
  rooms: number;
  tiles: number;
  /** Box width and height (0 × 0 with no indoor tiles). */
  w: number;
  h: number;
}

const outlineCache = new WeakMap<Layout, Outline>();

export function outlineOf(content: Content, layout: Layout): Outline {
  let o = outlineCache.get(layout);
  if (o) return o;
  const { width, height } = layout.house.lot;
  let tiles = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!layout.indoorTile[cellIndex(width, x, y)]) continue;
      tiles++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  let rooms = 0;
  for (const p of layout.house.pieces) if (isRoom(pieceDef(content, p))) rooms++;
  o =
    tiles === 0
      ? { rooms, tiles, w: 0, h: 0 }
      : { rooms, tiles, w: maxX - minX + 1, h: maxY - minY + 1 };
  outlineCache.set(layout, o);
  return o;
}

/** Whole percent of the box the indoor tiles fill, rounded down (for display). */
export function fillPct(o: Outline): number {
  return o.w * o.h === 0 ? 0 : Math.floor((o.tiles * 100) / (o.w * o.h));
}

/** Whether a piece counts for a house condition's selector (by its own card; see the header). */
function counts(content: Content, layout: Layout, sel: Selector, uid: number): boolean {
  return weightOf(content, layout, sel, uid) > 0;
}

/** The largest connected group (touching physically) of matching pieces, in tiles. */
function largestGroup(content: Content, layout: Layout, sel: Selector): number {
  const members = layout.house.pieces
    .map((p) => p.uid)
    .filter((uid) => counts(content, layout, sel, uid));
  const inSet = new Set(members);
  const seen = new Set<number>();
  let best = 0;
  for (const start of members) {
    if (seen.has(start)) continue;
    seen.add(start);
    const stack = [start];
    let tiles = 0;
    while (stack.length > 0) {
      const u = stack.pop()!;
      tiles += layout.cells.get(u)!.length;
      for (const n of layout.touching.get(u)!) {
        if (n.kind === 'piece' && inSet.has(n.uid) && !seen.has(n.uid)) {
          seen.add(n.uid);
          stack.push(n.uid);
        }
      }
    }
    best = Math.max(best, tiles);
  }
  return best;
}

/** Whether two pieces touch for scoring, either way round (a connector keeps rooms as neighbors). */
function neighborsEither(layout: Layout, a: number, b: number): boolean {
  const has = (x: number, y: number) =>
    layout.neighbors.get(x)!.some((n) => n.kind === 'piece' && n.uid === y);
  return has(a, b) || has(b, a);
}

/** Some piece matching `a` touches a different one matching `b` (links count). */
function adjacentPair(content: Content, layout: Layout, a: Selector, b: Selector): boolean {
  const { pieces } = layout.house;
  for (const p of pieces) {
    if (!counts(content, layout, a, p.uid)) continue;
    for (const q of pieces) {
      if (q.uid === p.uid || !counts(content, layout, b, q.uid)) continue;
      if (neighborsEither(layout, p.uid, q.uid)) return true;
    }
  }
  return false;
}

/** The variety check's numbers: pieces counted, and the most of any one non-exempt type. */
function varietyOf(
  content: Content,
  layout: Layout,
  v: Extract<HouseCondition, { variety: unknown }>['variety'],
): { n: number; most: number; mostType: PieceId | null } {
  let n = 0;
  const byType = new Map<PieceId, number>();
  for (const p of layout.house.pieces) {
    if (!counts(content, layout, v.of, p.uid)) continue;
    n++;
    if (v.exempt && counts(content, layout, v.exempt, p.uid)) continue;
    const t = rootType(pieceDef(content, p));
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  let most = 0;
  let mostType: PieceId | null = null;
  for (const [t, k] of byType) {
    if (k > most) {
      most = k;
      mostType = t;
    }
  }
  return { n, most, mostType };
}

function ratioNeed(
  content: Content,
  layout: Layout,
  r: Extract<HouseCondition, { ratio: unknown }>['ratio'],
): { have: number; need: number } {
  const per = countMatching(content, layout, r.per);
  const have = countMatching(content, layout, r.count);
  return { have, need: Math.max(r.min ?? 0, Math.ceil(per / r.every)) };
}

function inRange(n: number, min?: number, max?: number): boolean {
  return (min === undefined || n >= min) && (max === undefined || n <= max);
}

/** Does the house meet the condition? */
export function meetsHouse(
  content: Content,
  layout: Layout,
  cond: HouseCondition,
  ctx: CondCtx,
): boolean {
  if ('and' in cond) return cond.and.every((c) => meetsHouse(content, layout, c, ctx));
  if ('or' in cond) return cond.or.some((c) => meetsHouse(content, layout, c, ctx));
  if ('not' in cond) return !meetsHouse(content, layout, cond.not, ctx);
  if ('stages' in cond) {
    const stage = currentStage(cond, ctx.phase);
    return stage !== null && meetsHouse(content, layout, stage, ctx);
  }
  if ('count' in cond) {
    return inRange(countMatching(content, layout, cond.count), cond.min, cond.max);
  }
  if ('countNew' in cond) {
    if (!ctx.order) return false;
    return countMatching(content, layout, cond.countNew, ctx.order.sinceUid) >= cond.min;
  }
  if ('none' in cond) return countMatching(content, layout, cond.none) === 0;
  if ('adjacentPair' in cond) {
    return adjacentPair(content, layout, cond.adjacentPair[0], cond.adjacentPair[1]);
  }
  if ('fencedYardTiles' in cond) return largestFencedYard(layout) >= cond.fencedYardTiles.min;
  if ('group' in cond) return largestGroup(content, layout, cond.group) >= cond.minTiles;
  if ('set' in cond) {
    const held = matchSets(content, layout).filter((s) => s.set === cond.set).length;
    return held >= (cond.min ?? 1);
  }
  if ('demolishedSinceAccepted' in cond) {
    return (ctx.order?.demolished ?? 0) >= cond.demolishedSinceAccepted.min;
  }
  if ('ratio' in cond) {
    const { have, need } = ratioNeed(content, layout, cond.ratio);
    return have >= need;
  }
  if ('outline' in cond) {
    const o = outlineOf(content, layout);
    const r = cond.outline;
    if (!inRange(o.rooms, r.minRooms, r.maxRooms) || o.tiles === 0) return false;
    const box = o.w * o.h;
    return (
      o.tiles * 100 >= r.minFillPct * box && Math.max(o.w, o.h) <= r.maxAspect * Math.min(o.w, o.h)
    );
  }
  // variety
  const v = varietyOf(content, layout, cond.variety);
  return v.n >= cond.variety.min && v.most <= cond.variety.maxEach;
}

// ---------------------------------------------------------------------------------------
// Progress, for the checklist (the UI renders these; it never counts anything itself).

/** What a selector's pieces are called, plural: "Bedrooms", "rooms". */
export type NounFn = (sel: Selector, n: number) => string;

function rangeText(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined)
    return min === max ? `exactly ${min}` : `${min}–${max}`;
  if (max !== undefined) return `≤ ${max}`;
  return `≥ ${min ?? 0}`;
}

/** The parts of a condition's progress: "3 Bedrooms (3–4)", "fill 61% (≥ 60%)". */
export function progressOf(
  content: Content,
  layout: Layout,
  cond: HouseCondition,
  ctx: CondCtx,
  noun: NounFn,
): ProgressPart[] {
  if ('and' in cond) return cond.and.flatMap((c) => progressOf(content, layout, c, ctx, noun));
  if ('or' in cond) {
    const met = cond.or.find((c) => meetsHouse(content, layout, c, ctx));
    return met ? progressOf(content, layout, met, ctx, noun) : [];
  }
  if ('not' in cond) return [];
  if ('stages' in cond) {
    const stage = currentStage(cond, ctx.phase);
    return stage ? progressOf(content, layout, stage, ctx, noun) : [];
  }
  const ok = meetsHouse(content, layout, cond, ctx);
  if ('count' in cond) {
    // Number first: "3 Bedrooms (3–4)", "1 Kitchen (exactly 1)", "4 Dark rooms (≥ 3)".
    const n = countMatching(content, layout, cond.count);
    return [{ text: `${n} ${noun(cond.count, n)} (${rangeText(cond.min, cond.max)})`, ok }];
  }
  if ('countNew' in cond) {
    const n = ctx.order ? countMatching(content, layout, cond.countNew, ctx.order.sinceUid) : 0;
    return [{ text: `${n} new of ${cond.min}`, ok }];
  }
  if ('none' in cond) {
    const sel = cond.none;
    // "7 of 8 rooms touch 2+ rooms": a `none` over A-but-not-B reads as A's that are B.
    if (sel !== 'all' && 'all' in sel && sel.all.length === 2) {
      const [a, notB] = sel.all as [Selector, Selector];
      if (notB !== 'all' && 'not' in notB) {
        const total = countMatching(content, layout, a);
        const bad = countMatching(content, layout, sel);
        return [
          {
            text: `${total - bad} of ${total} ${noun(a, total)} ${verbPhrase(notB.not, noun)}`,
            ok,
          },
        ];
      }
    }
    const bad = countMatching(content, layout, sel);
    return [{ text: `${bad} ${noun(sel, bad)} (none allowed)`, ok }];
  }
  if ('adjacentPair' in cond) return [];
  if ('fencedYardTiles' in cond) {
    return [{ text: `${largestFencedYard(layout)} of ${cond.fencedYardTiles.min} tiles`, ok }];
  }
  if ('group' in cond) {
    return [{ text: `${largestGroup(content, layout, cond.group)} of ${cond.minTiles} tiles`, ok }];
  }
  if ('set' in cond) {
    const held = matchSets(content, layout).filter((s) => s.set === cond.set).length;
    return [{ text: `${content.sets[cond.set].name} ${held} of ${cond.min ?? 1}`, ok }];
  }
  if ('demolishedSinceAccepted' in cond) {
    const n = ctx.order?.demolished ?? 0;
    return [{ text: `${n} of ${cond.demolishedSinceAccepted.min} demolished`, ok }];
  }
  if ('ratio' in cond) {
    const { have, need } = ratioNeed(content, layout, cond.ratio);
    return [{ text: `${noun(cond.ratio.count, 2)} ${have} of ${need}`, ok }];
  }
  if ('outline' in cond) {
    const o = outlineOf(content, layout);
    const r = cond.outline;
    const roomsOk = inRange(o.rooms, r.minRooms, r.maxRooms);
    const fillOk = o.tiles > 0 && o.tiles * 100 >= r.minFillPct * o.w * o.h;
    const boxOk = o.tiles > 0 && Math.max(o.w, o.h) <= r.maxAspect * Math.min(o.w, o.h);
    const rooms = r.maxRooms === undefined ? `≥ ${r.minRooms}` : rangeText(r.minRooms, r.maxRooms);
    return [
      { text: `${o.rooms} ${o.rooms === 1 ? 'room' : 'rooms'} (${rooms})`, ok: roomsOk },
      { text: `fill ${fillPct(o)}% (≥ ${r.minFillPct}%)`, ok: fillOk },
      { text: `box ${o.w} × ${o.h} (≤ ${r.maxAspect}:1)`, ok: boxOk },
    ];
  }
  const v = varietyOf(content, layout, cond.variety);
  return [
    {
      text: `${v.n} in the yard (≥ ${cond.variety.min})`,
      ok: v.n >= cond.variety.min,
    },
    { text: `${v.most} of a type (≤ ${cond.variety.maxEach})`, ok: v.most <= cond.variety.maxEach },
  ];
}

/** "touch 2+ rooms", for a `touching` selector; otherwise "are X". */
function verbPhrase(sel: Selector, noun: NounFn): string {
  if (sel !== 'all' && 'touching' in sel) {
    const min = sel.min ?? 1;
    return min === 1
      ? `touch ${article(noun(sel.touching, 1))}`
      : `touch ${min}+ ${noun(sel.touching, 2)}`;
  }
  return `are ${noun(sel, 2)}`;
}

// ---------------------------------------------------------------------------------------
// Limits (Renovate, and half-weight draws).

/** The count-with-a-max conditions over piece types, as they stand now. */
export function typeLimits(
  content: Content,
  layout: Layout,
  specs: readonly SpecDef[],
  ctx: CondCtx,
): TypeLimit[] {
  const out: TypeLimit[] = [];
  const walk = (cond: HouseCondition) => {
    if ('and' in cond) cond.and.forEach(walk);
    else if ('stages' in cond) {
      const stage = currentStage(cond, ctx.phase);
      if (stage) walk(stage);
    } else if ('count' in cond && cond.max !== undefined) {
      const sel = cond.count;
      if (sel === 'all' || !('piece' in sel)) return;
      const types = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
      out.push({ types, max: cond.max, count: countMatching(content, layout, sel) });
    }
  };
  for (const s of specs) walk(s.condition);
  return out;
}

/** The limit a card of this type is at, if any (the first that's reached). */
export function limitReached(limits: readonly TypeLimit[], type: PieceId): TypeLimit | null {
  return limits.find((l) => l.count >= l.max && l.types.includes(type)) ?? null;
}

/** The root types at their limit, for the draw. */
export function typesAtLimit(limits: readonly TypeLimit[]): Set<PieceId> {
  const out = new Set<PieceId>();
  for (const l of limits) if (l.count >= l.max) l.types.forEach((t) => out.add(t));
  return out;
}
