// A cheap local estimate of a placement's change to the week's total (implementation-plan.md
// §4, Performance): the new piece's own earnings plus its neighbors' changes, from the house's
// layout as it stands, with no new layout built. The greedy bot ranks every candidate by it
// and runs the exact scoreOnly() on the top few only. It's a ranking, not a score: it ignores
// sets, links, views, Dark, and fenced yards the piece would create. `setHint` flags
// candidates that might complete a set (a member type touching another member of that set),
// so the bot always scores those exactly too.

import type { Cell, Content, PieceDef, Selector, Tally } from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL } from './grid.ts';
import { terrainAt } from './lot.ts';
import { isRoom, pieceDef, REGION_BIT, type Layout, type Neighbor } from './layout.ts';
import { isType, matchesNeighbor, matchesPiece } from './selectors.ts';
import { earnedFor } from './scoring.ts';

export interface Estimate {
  delta: number;
  setHint: boolean;
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
  if ('feature' in sel) return false;
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
      if (e.kind === 'aura' && matchesNew(content, layout, e.match, def, cells, sunny)) {
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
        if (e.kind === 'aura' && matchesPiece(content, layout, e.match, n.uid)) {
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

  return { delta: Math.round((delta * tally.mult) / 100), setHint };
}
