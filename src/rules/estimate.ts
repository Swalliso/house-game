// A cheap local estimate of a placement's change to the week's total (implementation-plan.md
// §4, Performance): the new piece's own earnings plus its neighbors' changes, from the house's
// layout as it stands, with no new layout built, and the checklist lines the piece would turn
// on or off. The greedy bot ranks every candidate by it and runs the exact scoreOnly() on the
// top few only. It's a ranking, not a score: it ignores sets, links, views, Dark, and fenced
// yards the piece would create, and the checklist lines that look at them. Four hints flag the
// plays whose payoff it can't see, so the bot always scores those exactly too:
// - setHint: a set member type touching another member of that set (it might complete one);
// - yardHint: a wall piece (a Fence) that would close a fenced yard that isn't one now, by the
//   layout's rule (a flood fill over non-wall tiles, off the street row, bordering a Fence and
//   the house, with fencedYardMin tiles);
// - linkHint: a linking connector (a Hallway) that would link two rooms not linked now;
// - specHint: a piece that would join an unmet adjacentPair line's two types (Kitchen beside
//   the Dining Room), touching one of the other type.
// Only wall pieces pay for the yard check and only connectors for the link check.
//
// The checklist (M4a): each line that holds adds specBonus to the week's Mult, so a play that
// turns one on or off moves the week by about specBonus × its Points. The estimate follows the
// lines a card's definition decides, from per-layout caches, so each play costs O(lines):
// - count and none over static selectors (piece types, room, indoor, yard, outbuilding,
//   viewSource, and any/all/not of them), weighted as conditions.ts counts (countsAs
//   modifiers, the piece's own card);
// - ratio (a Bathroom for every two Bedrooms), outline (Under one roof: its rooms, the fill of
//   their box, the box's aspect), and variety (a tidy yard, exempt types included);
// - the current phase's stage of a staged line, and and/or/not of any of these.
// Lines about tags (Dark), views, touching, adjacency, groups, sets, and fenced yards stay out,
// since placing a piece can change them in ways only a new layout shows, and so do change
// orders' counts of new pieces and demolitions.

import type {
  Cell,
  Content,
  HouseCondition,
  PieceDef,
  PieceId,
  Selector,
  SpecDef,
  Tally,
} from './index.ts';
import { countMatching, currentStage, outlineOf, type Outline } from './conditions.ts';
import { cellIndex, inBounds, ORTHOGONAL } from './grid.ts';
import { terrainAt } from './lot.ts';
import { isRoom, pieceDef, REGION_BIT, type Layout, type Neighbor } from './layout.ts';
import type { ActiveMod } from './modifiers.ts';
import { isType, matchesDef, matchesNeighbor, matchesPiece, rootType } from './selectors.ts';
import { earnedFor, specsMet } from './scoring.ts';

export interface Estimate {
  /** The week's total's estimated change, checklist lines it would turn on or off included. */
  delta: number;
  /** Checklist lines the estimate sees it turning on, less those it turns off. */
  specFlips: number;
  /** It might complete a set: a member type touching another member of that set. */
  setHint: boolean;
  /** A wall piece that would close a new fenced yard. */
  yardHint: boolean;
  /** A linking connector that would link two rooms that aren't linked now. */
  linkHint: boolean;
  /** It would join an unmet adjacentPair line's two types (Kitchen beside the Dining Room). */
  specHint: boolean;
}

/** The client's checklist and the current milestone, as the week's tally reads them. */
export interface ChecklistCtx {
  specs: readonly SpecDef[];
  phase: number;
}

/** The new piece's distinct physical neighbors, from the current layout (Trees under it are gone). */
function neighborsOf(
  content: Content,
  layout: Layout,
  def: PieceDef,
  cells: readonly Cell[],
): Neighbor[] {
  const { lot } = layout.house;
  const { width: w, height: h } = lot;
  const own = new Set(cells.map((c) => cellIndex(w, c.x, c.y)));
  const uids = new Set<number>();
  const tiles = new Map<string, Neighbor>();
  let street: Neighbor | null = null;
  for (const c of cells) {
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inBounds(w, h, nx, ny)) {
        if (ny === h && !street) street = { kind: 'street', x: c.x };
        continue;
      }
      const i = cellIndex(w, nx, ny);
      if (own.has(i)) continue;
      const uid = layout.occupant[i]!;
      if (uid >= 0) {
        uids.add(uid);
        continue;
      }
      const t = terrainAt(lot, nx, ny);
      if (t === null || content.features[t].inert) continue;
      // Bodies (the pond, the creek) count once; near enough to key them by feature here.
      const key = content.features[t].body ? t : `${i}`;
      if (!tiles.has(key)) tiles.set(key, { kind: 'terrain', feature: t, x: nx, y: ny });
    }
  }
  // As in the layout: connectors aren't neighbors, and a room touching a Hallway group is
  // linked to every room touching that group.
  const linked = new Set<number>();
  const seen = new Set<number>();
  const stack: number[] = [];
  for (const uid of uids) {
    const d = pieceDef(content, layout.byUid.get(uid)!);
    if (!d.connector) continue;
    uids.delete(uid);
    if (isRoom(def) && d.effects.some((e) => e.kind === 'link') && !seen.has(uid)) {
      seen.add(uid);
      stack.push(uid);
    }
  }
  while (stack.length > 0) {
    const u = stack.pop()!;
    for (const n of layout.touching.get(u) ?? []) {
      if (n.kind !== 'piece') continue;
      const d = pieceDef(content, layout.byUid.get(n.uid)!);
      if (d.connector && d.effects.some((e) => e.kind === 'link')) {
        if (!seen.has(n.uid)) {
          seen.add(n.uid);
          stack.push(n.uid);
        }
      } else if (isRoom(d)) linked.add(n.uid);
    }
  }
  for (const u of linked) uids.add(u);
  const out: Neighbor[] = [...uids]
    .sort((a, b) => a - b)
    .map((uid): Neighbor => ({ kind: 'piece', uid }));
  if (street) out.push(street);
  out.push(...tiles.values());
  return out;
}

/** Does a selector match the piece being placed? Layout-dependent terms are approximated. */
function matchesNew(
  content: Content,
  layout: Layout,
  sel: Selector,
  def: PieceDef,
  cells: readonly Cell[],
  sunny: boolean,
): boolean {
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.some((s) => matchesNew(content, layout, s, def, cells, sunny));
  if ('all' in sel) return sel.all.every((s) => matchesNew(content, layout, s, def, cells, sunny));
  if ('not' in sel) return !matchesNew(content, layout, sel.not, def, cells, sunny);
  if ('piece' in sel) {
    return typeof sel.piece === 'string'
      ? isType(def, sel.piece)
      : sel.piece.some((id) => isType(def, id));
  }
  if ('feature' in sel || 'host' in sel || 'hasFixture' in sel) return false;
  if ('tag' in sel) return def.tags.includes(sel.tag) || (sel.tag === 'Sunny' && sunny);
  if ('in' in sel) return allIn(layout, cells, REGION_BIT[sel.in]);
  if ('touching' in sel) return false;
  switch (sel.property) {
    case 'indoor':
    case 'yard':
    case 'outbuilding':
      return def.category === sel.property;
    case 'room':
    case 'exterior':
      return isRoom(def);
    case 'interior':
      return false;
    case 'view':
      return false;
    case 'viewSource':
      return !!def.givesView;
  }
}

function allIn(layout: Layout, cells: readonly Cell[], bit: number): boolean {
  const w = layout.house.lot.width;
  return cells.every((c) => (layout.regionBits[cellIndex(w, c.x, c.y)]! & bit) !== 0);
}

function countIn(layout: Layout, cells: readonly Cell[], bit: number): number {
  const w = layout.house.lot.width;
  let n = 0;
  for (const c of cells) if (layout.regionBits[cellIndex(w, c.x, c.y)]! & bit) n++;
  return n;
}

/**
 * The estimate for building `def` on `cells`, against the week's tally if nothing is built
 * (`tally`, on `layout`). With the client's checklist (`checklist`), lines the play would turn
 * on or off count too.
 */
export function estimatePlay(
  content: Content,
  layout: Layout,
  tally: Tally,
  def: PieceDef,
  cells: readonly Cell[],
  mods: readonly ActiveMod[] = [],
  checklist?: ChecklistCtx,
): Estimate {
  const neighbors = neighborsOf(content, layout, def, cells);
  const sunny = countIn(layout, cells, REGION_BIT.sunny) > 0;
  const scoreOf = new Map(tally.pieces.map((p) => [p.uid, p]));
  const matchN = (sel: Selector) =>
    neighbors.filter((n) => matchesNeighbor(content, layout, sel, n)).length;

  // The new piece's own points.
  let points = 0;
  let pct = 0;
  const addOwn = (e: PieceDef['effects'][number]): void => {
    switch (e.kind) {
      case 'steady':
        points += e.amount;
        break;
      case 'neighbor': {
        const n = matchN(e.match);
        points += e.amount * (e.max === undefined ? n : Math.min(e.max, n));
        break;
      }
      case 'perTile':
        points += e.amount * countIn(layout, cells, REGION_BIT[e.region]);
        break;
      case 'rhythm':
        if (e.every <= 1) points += e.amount;
        break;
      case 'growth':
        points += e.max === undefined ? e.perWeek : Math.min(e.max, e.perWeek);
        break;
      case 'conditional': {
        const w = e.when;
        const holds =
          'in' in w
            ? allIn(layout, cells, REGION_BIT[w.in])
            : 'touching' in w
              ? matchN(w.touching) >= (w.min ?? 1)
              : true;
        if (holds) addOwn(e.effect);
        break;
      }
      default:
        break;
    }
  };
  let blocked = false;
  for (const e of def.effects) {
    if (e.kind === 'requires') {
      const c = e.condition;
      if ('in' in c && !allIn(layout, cells, REGION_BIT[c.in])) blocked = true;
      if ('touching' in c && matchN(c.touching) < (c.min ?? 1)) blocked = true;
    } else addOwn(e);
  }

  // The run's percentage modifiers that would match the new piece (blueprints, the crew).
  for (const { mod } of mods) {
    if (
      mod.kind === 'earn' &&
      !mod.when &&
      matchesNew(content, layout, mod.target, def, cells, sunny)
    ) {
      pct += mod.pct;
    }
  }

  // Neighbors' auras on the new piece, and the new piece's effect on each neighbor.
  let delta = 0;
  for (const n of neighbors) {
    if (n.kind !== 'piece') continue;
    const other = layout.byUid.get(n.uid)!;
    const odef = pieceDef(content, other);
    if (odef.connector) continue;
    const score = scoreOf.get(n.uid);
    if (!score || score.unmet) continue;
    let dPoints = 0;
    let dPct = 0;
    for (const e of odef.effects) {
      if (
        e.kind === 'aura' &&
        e.scope === 'adjacent' &&
        matchesNew(content, layout, e.match, def, cells, sunny)
      ) {
        pct += e.pct ?? 0;
        points += e.amount ?? 0;
      } else if (e.kind === 'neighbor' && matchesNew(content, layout, e.match, def, cells, sunny)) {
        const already = (layout.neighbors.get(n.uid) ?? []).filter((m) =>
          matchesNeighbor(content, layout, e.match, m),
        ).length;
        if (e.max === undefined || already < e.max) dPoints += e.amount;
      }
    }
    if (!blocked) {
      for (const e of def.effects) {
        if (
          e.kind === 'aura' &&
          e.scope === 'adjacent' &&
          matchesPiece(content, layout, e.match, n.uid)
        ) {
          dPct += e.pct ?? 0;
          dPoints += e.amount ?? 0;
        }
      }
    }
    if (dPoints !== 0 || dPct !== 0) {
      delta += earnedFor(score.points + dPoints, score.pct + dPct) - score.earned;
    }
  }
  if (!blocked) delta += earnedFor(points, pct);

  // Might it complete a set? A member type touching another member of the same set. Only sets
  // whose members must touch (a hub or one connected group): where an unconnected set's member
  // goes can't decide whether it completes (Full House), and each card's best spots are scored
  // exactly anyway.
  let setHint = false;
  for (const set of Object.values(content.sets)) {
    if (!set.connected && !set.hub) continue;
    const member = (d: PieceDef) =>
      set.members[d.id] !== undefined || (d.countsAs && set.members[d.countsAs] !== undefined);
    if (!member(def)) continue;
    if (
      neighbors.some(
        (n) => n.kind === 'piece' && member(pieceDef(content, layout.byUid.get(n.uid)!)),
      )
    ) {
      setHint = true;
      break;
    }
  }

  // Checklist lines it would turn on or off: each moves the week's Mult by specBonus, which
  // lands after sets and before the ×Mult sources, so it's scaled by them as tally.mult is.
  // It pays on the week's Points with this play's included.
  let total = delta * tally.mult;
  let specFlips = 0;
  let specHint = false;
  if (checklist && checklist.specs.length > 0) {
    const plan = planFor(content, layout, checklist);
    const flips = flipsOf(plan, def, cells);
    specFlips = flips.net;
    specHint = flips.pair && joinsPair(content, layout, plan, def, neighbors);
    if (specFlips !== 0 && tally.specBonus !== 0) {
      const first = tally.xMults[0];
      const scale = first && first.before > 0 ? tally.mult / first.before : 1;
      total += specFlips * tally.specBonus * scale * Math.max(0, tally.points + delta);
    }
  }

  return {
    delta: Math.round(total / 100),
    specFlips,
    setHint,
    yardHint: !!def.wall && closesYard(content, layout, cells),
    linkHint: !!def.connector && linksRooms(content, layout, def, cells),
    specHint,
  };
}

// ---------------------------------------------------------------------------------------
// Fenced yards and links the play would make.

/** Up, left, right, down: the fill pops the last one first, so it heads for the street row. */
const STREETWARD: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

/** 1 on tiles covered by a wall piece (a Fence), per layout; indoor tiles are layout.indoorTile. */
const fenceCache = new WeakMap<Layout, Uint8Array>();

function fenceTiles(content: Content, layout: Layout): Uint8Array {
  let fence = fenceCache.get(layout);
  if (fence) return fence;
  fence = new Uint8Array(layout.occupant.length);
  for (let i = 0; i < fence.length; i++) {
    const uid = layout.occupant[i]!;
    if (uid >= 0 && pieceDef(content, layout.byUid.get(uid)!).wall) fence[i] = 1;
  }
  fenceCache.set(layout, fence);
  return fence;
}

/**
 * Would wall cells here close a fenced yard that isn't one now? Each region of non-wall tiles
 * next to the new cells is flood-filled as layout.ts does it, stopping early at the street row.
 * Walls only split regions, so a region that qualifies is new unless its tiles were already
 * in a fenced yard (a Fence inside one only shrinks it).
 */
function closesYard(content: Content, layout: Layout, cells: readonly Cell[]): boolean {
  if (!layout.hasIndoor) return false;
  const { width: w, height: h } = layout.house.lot;
  const indoor = layout.indoorTile;
  const fence = fenceTiles(content, layout);
  // 0 unseen, 1 the new cells, 2 + n flooded from the n-th start.
  const mark = new Uint8Array(w * h);
  for (const c of cells) mark[cellIndex(w, c.x, c.y)] = 1;
  const wallAt = (i: number) => indoor[i] === 1 || fence[i] === 1 || mark[i] === 1;
  const min = content.balance.fencedYardMin;
  let starts = 0;
  const stack: number[] = [];
  for (const c of cells) {
    for (const [dx, dy] of ORTHOGONAL) {
      const sx = c.x + dx;
      const sy = c.y + dy;
      if (!inBounds(w, h, sx, sy)) continue;
      const start = cellIndex(w, sx, sy);
      if (mark[start] !== 0 || wallAt(start)) continue;
      // Regions left unfinished (they reached the street) keep their mark, so a later start
      // that runs into one is in that region too.
      const id = 2 + (starts++ % 254);
      mark[start] = id;
      stack.length = 0;
      stack.push(start);
      let size = 0;
      let open = false;
      let houseSide = false;
      while (stack.length > 0 && !open) {
        const i = stack.pop()!;
        size++;
        const x = i % w;
        const y = (i - x) / w;
        if (y === h - 1) open = true;
        for (const [ex, ey] of STREETWARD) {
          const nx = x + ex;
          const ny = y + ey;
          if (!inBounds(w, h, nx, ny)) continue;
          const j = cellIndex(w, nx, ny);
          if (indoor[j] === 1) houseSide = true;
          if (wallAt(j)) continue;
          if (mark[j] === 0) {
            mark[j] = id;
            stack.push(j);
          } else if (mark[j] !== id) open = true; // an unfinished region: it reached the street
        }
      }
      // It borders a Fence: the new cells.
      if (!open && houseSide && size >= min && layout.fencedId[start]! < 0) return true;
    }
  }
  return false;
}

/** Would a linking connector here link two rooms that aren't linked now? */
function linksRooms(
  content: Content,
  layout: Layout,
  def: PieceDef,
  cells: readonly Cell[],
): boolean {
  if (!def.effects.some((e) => e.kind === 'link')) return false;
  const { width: w, height: h } = layout.house.lot;
  const linker = (d: PieceDef) => !!d.connector && d.effects.some((e) => e.kind === 'link');
  // The rooms it touches, and the rooms touching any linking group it joins.
  const rooms = new Set<number>();
  const seen = new Set<number>();
  const stack: number[] = [];
  for (const c of cells) {
    for (const [dx, dy] of ORTHOGONAL) {
      if (!inBounds(w, h, c.x + dx, c.y + dy)) continue;
      const uid = layout.occupant[cellIndex(w, c.x + dx, c.y + dy)]!;
      if (uid < 0 || seen.has(uid)) continue;
      seen.add(uid);
      const d = pieceDef(content, layout.byUid.get(uid)!);
      if (isRoom(d)) rooms.add(uid);
      else if (linker(d)) stack.push(uid);
    }
  }
  while (stack.length > 0) {
    const u = stack.pop()!;
    for (const n of layout.touching.get(u) ?? []) {
      if (n.kind !== 'piece' || seen.has(n.uid)) continue;
      seen.add(n.uid);
      const d = pieceDef(content, layout.byUid.get(n.uid)!);
      if (isRoom(d)) rooms.add(n.uid);
      else if (linker(d)) stack.push(n.uid);
    }
  }
  if (rooms.size < 2) return false;
  for (const r of rooms) {
    const linked = layout.links.get(r);
    for (const o of rooms) if (o !== r && !linked?.has(o)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------
// Checklist lines the play would turn on or off.

type OutlineRule = Extract<HouseCondition, { outline: unknown }>['outline'];
type VarietyRule = Extract<HouseCondition, { variety: unknown }>['variety'];

/**
 * A line the estimate follows, with the house's numbers as they stand: a count's weighted
 * count, a ratio's two counts, a variety's counts by type. An outline reads the plan's
 * outline, the one part a placement's cells (not just its card) can change.
 */
type Line =
  | { k: 'const'; v: boolean }
  | { k: 'count'; sel: Selector; n: number; min?: number; max?: number }
  | {
      k: 'ratio';
      count: Selector;
      per: Selector;
      have: number;
      perN: number;
      every: number;
      min?: number;
    }
  | { k: 'outline'; r: OutlineRule }
  | {
      k: 'variety';
      v: VarietyRule;
      n: number;
      byType: ReadonlyMap<PieceId, number>;
      most: number;
    }
  | { k: 'and'; parts: readonly Line[] }
  | { k: 'or'; parts: readonly Line[] }
  | { k: 'not'; part: Line };

/** What a card does to the plan's lines wherever it goes, and which lines its cells decide. */
interface DefPlan {
  /** Lines turned on less those turned off, of the lines its cells can't change. */
  net: number;
  /** Lines that read the outline, for an indoor card: checked play by play. */
  perPlay: readonly number[];
  /** Whether it's either type of an unmet adjacentPair line. */
  pair: boolean;
}

/** The checklist as one layout stands, for one client's lines and phase. */
interface Plan {
  content: Content;
  specs: readonly SpecDef[];
  phase: number;
  /** The lines the estimate follows, and their spec ids. */
  lines: readonly Line[];
  ids: readonly string[];
  /** Each line's verdict on the house as it stands. */
  before: readonly boolean[];
  /** Which lines read the outline. */
  outlined: readonly boolean[];
  /** The outline and its box's top-left corner, when a line reads it. */
  outline: Outline | null;
  minX: number;
  minY: number;
  /** adjacentPair lines over static selectors that don't hold, for specHint. */
  pairs: readonly (readonly [Selector, Selector])[];
  byDef: Map<PieceDef, DefPlan>;
}

const plans = new WeakMap<Layout, Plan[]>();

function planFor(content: Content, layout: Layout, ctx: ChecklistCtx): Plan {
  let list = plans.get(layout);
  if (!list) plans.set(layout, (list = []));
  const hit = list.find(
    (p) => p.content === content && p.specs === ctx.specs && p.phase === ctx.phase,
  );
  if (hit) return hit;
  // A run modifier that changes types (none yet) could change what a new card counts as.
  const typesFixed = !layout.mods.some((m) => m.kind === 'countsAs');
  const lines: Line[] = [];
  const ids: string[] = [];
  const pairs: (readonly [Selector, Selector])[] = [];
  let met: readonly boolean[] | null = null;
  for (let k = 0; k < ctx.specs.length; k++) {
    const spec = ctx.specs[k]!;
    const c = spec.condition;
    const line = compile(content, layout, c, ctx.phase, typesFixed);
    if (line) {
      lines.push(line);
      ids.push(spec.id);
    } else if ('adjacentPair' in c && c.adjacentPair.every((s) => staticSel(s, typesFixed))) {
      met ??= specsMet(content, layout, ctx.specs, ctx.phase);
      if (!met[k]) pairs.push(c.adjacentPair);
    }
  }
  const outlined = lines.map(readsOutline);
  let outline: Outline | null = null;
  let corner: readonly [number, number] = [0, 0];
  if (outlined.includes(true)) {
    outline = outlineOf(content, layout);
    corner = boxCorner(layout);
  }
  const plan: Plan = {
    content,
    specs: ctx.specs,
    phase: ctx.phase,
    lines,
    ids,
    before: lines.map((line) => holds(line, null, outline)),
    outlined,
    outline,
    minX: corner[0],
    minY: corner[1],
    pairs,
    byDef: new Map(),
  };
  list.push(plan);
  return plan;
}

/** The ids of the checklist lines the estimate follows on this layout (for tests and the sim). */
export function followedLines(content: Content, layout: Layout, ctx: ChecklistCtx): string[] {
  return [...planFor(content, layout, ctx).ids];
}

/**
 * Selectors a card's definition decides, so placing a piece never changes whether another
 * piece matches: piece types (while no run modifier changes types), room, indoor, yard,
 * outbuilding, viewSource, and any/all/not of them. A new piece is never a lot feature, a
 * host, or holding a fixture. Tags (Dark, Sunny), regions, touching, views, and
 * exterior/interior depend on the layout.
 */
function staticSel(sel: Selector, typesFixed: boolean): boolean {
  if (sel === 'all') return true;
  if ('any' in sel) return sel.any.every((s) => staticSel(s, typesFixed));
  if ('all' in sel) return sel.all.every((s) => staticSel(s, typesFixed));
  if ('not' in sel) return staticSel(sel.not, typesFixed);
  if ('piece' in sel) return typesFixed;
  if ('property' in sel) {
    return sel.property !== 'exterior' && sel.property !== 'interior' && sel.property !== 'view';
  }
  return 'feature' in sel || 'host' in sel || 'hasFixture' in sel;
}

/** A spec's condition as a line the estimate follows, or null if it can't follow it. */
function compile(
  content: Content,
  layout: Layout,
  cond: HouseCondition,
  phase: number,
  typesFixed: boolean,
): Line | null {
  const fixed = (s: Selector) => staticSel(s, typesFixed);
  const all = (list: readonly HouseCondition[]): Line[] | null => {
    const parts: Line[] = [];
    for (const c of list) {
      const part = compile(content, layout, c, phase, typesFixed);
      if (!part) return null;
      parts.push(part);
    }
    return parts;
  };
  if ('and' in cond) {
    const parts = all(cond.and);
    return parts && { k: 'and', parts };
  }
  if ('or' in cond) {
    const parts = all(cond.or);
    return parts && { k: 'or', parts };
  }
  if ('not' in cond) {
    const part = compile(content, layout, cond.not, phase, typesFixed);
    return part && { k: 'not', part };
  }
  if ('stages' in cond) {
    const stage = currentStage(cond, phase);
    return stage ? compile(content, layout, stage, phase, typesFixed) : { k: 'const', v: false };
  }
  if ('count' in cond) {
    if (!fixed(cond.count)) return null;
    const n = countMatching(content, layout, cond.count);
    return { k: 'count', sel: cond.count, n, min: cond.min, max: cond.max };
  }
  if ('none' in cond) {
    if (!fixed(cond.none)) return null;
    return { k: 'count', sel: cond.none, n: countMatching(content, layout, cond.none), max: 0 };
  }
  if ('ratio' in cond) {
    const r = cond.ratio;
    if (!fixed(r.count) || !fixed(r.per)) return null;
    return {
      k: 'ratio',
      count: r.count,
      per: r.per,
      have: countMatching(content, layout, r.count),
      perN: countMatching(content, layout, r.per),
      every: r.every,
      min: r.min,
    };
  }
  if ('outline' in cond) return { k: 'outline', r: cond.outline };
  if ('variety' in cond) {
    const v = cond.variety;
    if (!fixed(v.of) || (v.exempt !== undefined && !fixed(v.exempt))) return null;
    return { k: 'variety', v, ...varietyNow(content, layout, v) };
  }
  // countNew, adjacentPair, fencedYardTiles, group, set, demolishedSinceAccepted.
  return null;
}

function readsOutline(line: Line): boolean {
  if (line.k === 'outline') return true;
  if (line.k === 'and' || line.k === 'or') return line.parts.some(readsOutline);
  return line.k === 'not' && readsOutline(line.part);
}

function inRange(n: number, min?: number, max?: number): boolean {
  return (min === undefined || n >= min) && (max === undefined || n <= max);
}

/** conditions.ts's outline test. */
function outlineHolds(o: Outline, r: OutlineRule): boolean {
  if (!inRange(o.rooms, r.minRooms, r.maxRooms) || o.tiles === 0) return false;
  return (
    o.tiles * 100 >= r.minFillPct * o.w * o.h &&
    Math.max(o.w, o.h) <= r.maxAspect * Math.min(o.w, o.h)
  );
}

/**
 * Does the line hold with this card built (`def`; null for the house as it stands)? A new
 * piece has no fixture, so it counts once for a selector it matches. `outline` is the house's
 * outline with the piece in it.
 */
function holds(line: Line, def: PieceDef | null, outline: Outline | null): boolean {
  const w = (sel: Selector) => (def && matchesDef(sel, def) ? 1 : 0);
  switch (line.k) {
    case 'const':
      return line.v;
    case 'and':
      return line.parts.every((p) => holds(p, def, outline));
    case 'or':
      return line.parts.some((p) => holds(p, def, outline));
    case 'not':
      return !holds(line.part, def, outline);
    case 'count':
      return inRange(line.n + w(line.sel), line.min, line.max);
    case 'ratio': {
      const per = line.perN + w(line.per);
      return line.have + w(line.count) >= Math.max(line.min ?? 0, Math.ceil(per / line.every));
    }
    case 'outline':
      return outlineHolds(outline!, line.r);
    case 'variety': {
      const { v } = line;
      let { n, most } = line;
      if (def && matchesDef(v.of, def)) {
        n++;
        if (!(v.exempt && matchesDef(v.exempt, def))) {
          most = Math.max(most, (line.byType.get(rootType(def)) ?? 0) + 1);
        }
      }
      return n >= v.min && most <= v.maxEach;
    }
  }
}

function defPlan(plan: Plan, def: PieceDef): DefPlan {
  let d = plan.byDef.get(def);
  if (d) return d;
  // Only an indoor piece changes the outline: its tiles, and one more room if it's a room.
  const indoor = def.category === 'indoor';
  let net = 0;
  const perPlay: number[] = [];
  plan.lines.forEach((line, k) => {
    if (indoor && plan.outlined[k]) perPlay.push(k);
    else net += Number(holds(line, def, plan.outline)) - Number(plan.before[k]);
  });
  const pair = plan.pairs.some(([a, b]) => matchesDef(a, def) || matchesDef(b, def));
  d = { net, perPlay, pair };
  plan.byDef.set(def, d);
  return d;
}

/** Lines the play turns on less those it turns off, and whether it might join a pair. */
function flipsOf(
  plan: Plan,
  def: PieceDef,
  cells: readonly Cell[],
): { net: number; pair: boolean } {
  const d = defPlan(plan, def);
  let net = d.net;
  if (d.perPlay.length > 0) {
    const o = outlineWith(plan, def, cells);
    for (const k of d.perPlay) {
      net += Number(holds(plan.lines[k]!, def, o)) - Number(plan.before[k]);
    }
  }
  return { net, pair: d.pair };
}

/** The outline with an indoor piece built on these (free) cells. */
function outlineWith(plan: Plan, def: PieceDef, cells: readonly Cell[]): Outline {
  const o = plan.outline!;
  const any = o.tiles > 0;
  let minX = any ? plan.minX : Infinity;
  let minY = any ? plan.minY : Infinity;
  let maxX = any ? plan.minX + o.w - 1 : -Infinity;
  let maxY = any ? plan.minY + o.h - 1 : -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return {
    rooms: o.rooms + (isRoom(def) ? 1 : 0),
    tiles: o.tiles + cells.length,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/** The top-left corner of the box around the indoor tiles ([0, 0] with none). */
function boxCorner(layout: Layout): readonly [number, number] {
  const { width, height } = layout.house.lot;
  let minX = width;
  let minY = height;
  const tiles = layout.indoorTile;
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i]) continue;
    const x = i % width;
    if (x < minX) minX = x;
    if (minY === height) minY = (i - x) / width;
  }
  return minY === height ? [0, 0] : [minX, minY];
}

/** The piece types a selector names directly, as conditions.ts reads them for weights. */
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

/**
 * Whether a placed piece counts for a house condition's selector, as conditions.ts weighs it
 * (a weight above 0): a selector naming types counts a piece by its own card, so a Kitchen
 * with an Island isn't a Dining Room.
 */
function countsFor(content: Content, layout: Layout, sel: Selector, uid: number): boolean {
  if (!matchesPiece(content, layout, sel, uid)) return false;
  const types = directTypes(sel);
  if (!types) return true;
  const def = pieceDef(content, layout.byUid.get(uid)!);
  return types.some((id) => isType(def, id));
}

/** A variety line's numbers as the house stands: conditions.ts's varietyOf, every type's count. */
function varietyNow(
  content: Content,
  layout: Layout,
  v: VarietyRule,
): { n: number; byType: Map<PieceId, number>; most: number } {
  let n = 0;
  let most = 0;
  const byType = new Map<PieceId, number>();
  for (const p of layout.house.pieces) {
    if (!countsFor(content, layout, v.of, p.uid)) continue;
    n++;
    if (v.exempt && countsFor(content, layout, v.exempt, p.uid)) continue;
    const t = rootType(pieceDef(content, p));
    const k = (byType.get(t) ?? 0) + 1;
    byType.set(t, k);
    if (k > most) most = k;
  }
  return { n, byType, most };
}

/** Would the new piece join an unmet adjacentPair line's two types, touching the other one? */
function joinsPair(
  content: Content,
  layout: Layout,
  plan: Plan,
  def: PieceDef,
  neighbors: readonly Neighbor[],
): boolean {
  for (const [a, b] of plan.pairs) {
    const isA = matchesDef(a, def);
    const isB = matchesDef(b, def);
    if (!isA && !isB) continue;
    for (const n of neighbors) {
      if (n.kind !== 'piece') continue;
      if (isA && countsFor(content, layout, b, n.uid)) return true;
      if (isB && countsFor(content, layout, a, n.uid)) return true;
    }
  }
  return false;
}
