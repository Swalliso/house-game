// A cheap local estimate of a placement's change to the week's total (implementation-plan.md
// §4, Performance): the new piece's own earnings plus its neighbors' changes, from the house's
// layout as it stands, with no new layout built. The greedy bot ranks every candidate by it
// and runs the exact scoreOnly() on the top few only. It's a ranking, not a score: it ignores
// sets, links, views, Dark, and fenced yards the piece would create. Three hints flag the
// plays whose payoff it can't see, so the bot always scores those exactly too:
// - setHint: a set member type touching another member of that set (it might complete one);
// - yardHint: a wall piece (a Fence) that would close a fenced yard that isn't one now, by the
//   layout's rule (a flood fill over non-wall tiles, off the street row, bordering a Fence and
//   the house, with fencedYardMin tiles);
// - linkHint: a linking connector (a Hallway) that would link two rooms not linked now.
// Only wall pieces pay for the yard check and only connectors for the link check.

import type { Cell, Content, PieceDef, Selector, Tally } from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL } from './grid.ts';
import { terrainAt } from './lot.ts';
import { isRoom, pieceDef, REGION_BIT, type Layout, type Neighbor } from './layout.ts';
import type { ActiveMod } from './modifiers.ts';
import { isType, matchesNeighbor, matchesPiece } from './selectors.ts';
import { earnedFor } from './scoring.ts';

export interface Estimate {
  delta: number;
  /** It might complete a set: a member type touching another member of that set. */
  setHint: boolean;
  /** A wall piece that would close a new fenced yard. */
  yardHint: boolean;
  /** A linking connector that would link two rooms that aren't linked now. */
  linkHint: boolean;
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

export function estimatePlay(
  content: Content,
  layout: Layout,
  tally: Tally,
  def: PieceDef,
  cells: readonly Cell[],
  mods: readonly ActiveMod[] = [],
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

  // Might it complete a set? A member type touching another member of the same set.
  let setHint = false;
  for (const set of Object.values(content.sets)) {
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

  return {
    delta: Math.round((delta * tally.mult) / 100),
    setHint,
    yardHint: !!def.wall && closesYard(content, layout, cells),
    linkHint: !!def.connector && linksRooms(content, layout, def, cells),
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
