// The weekly tally (implementation-plan.md §4, Scoring pipeline; D-037, D-056).
//
// Per piece, in placement order:
//   points = the sum of flat terms (steady, neighbor, rhythm, growth, enclosure, perTile,
//            and flat auras; conditional effects while their condition holds)
//   pct    = the sum of percentage terms (auras). Percentages add: two +100% make ×3.
//   earned = floor((max(0, points) × max(0, 100 + pct) + 50) / 100)
// A piece whose `requires` condition fails earns nothing and pays no budget, and its own
// effects (auras included) don't apply; it still counts for sets.
// For the week (Mult in hundredths, starting at 100):
//   Points = Σ earned + Σ set Points
//   Mult   = 100 + Σ set Mult          (specs from M4a; ×Mult sources from M3a)
//   Total  = floor((Points × Mult + 50) / 100)
// Integer math throughout, rounding half up, so every browser and Node agree.

import type {
  BreakdownLine,
  Content,
  Effect,
  PieceDef,
  PieceScore,
  PlacedPiece,
  Tally,
} from './index.ts';
import {
  fencedYardsBordered,
  neighborRef,
  pieceDef,
  tilesIn,
  type Layout,
  type Neighbor,
} from './layout.ts';
import { matchesNeighbor, matchesPiece, meetsCondition } from './selectors.ts';
import { matchSets } from './sets.ts';
import { conditionText, countedNames, neighborName, ordinal, regionText } from './text.ts';

/** a / b rounded half up, for non-negative integers. */
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** What a piece earns from its flat points and its percentage terms. */
export function earnedFor(points: number, pct: number): number {
  return Math.floor((Math.max(0, points) * Math.max(0, 100 + pct) + 50) / 100);
}

/** The week's total from its Points and Mult (in hundredths). */
export function weekTotal(points: number, mult: number): number {
  return Math.floor((Math.max(0, points) * Math.max(0, mult) + 50) / 100);
}

interface Acc {
  points: number;
  pct: number;
  budget: number;
  own: BreakdownLine[];
  auras: BreakdownLine[];
  /** Where each source piece type's aura line sits in `auras`, keyed `<piece id>|<op>`. */
  auraAt: Map<string, number>;
}

/** Auras of one kind from several neighbors read as one line: "2 Dining Rooms next door +100%". */
function addAura(target: Acc, def: PieceDef, op: 'add' | 'pct', value: number, uid: number): void {
  const key = `${def.id}|${op}`;
  const from = { kind: 'piece', uid } as const;
  const i = target.auraAt.get(key);
  if (i === undefined) {
    target.auraAt.set(key, target.auras.length);
    target.auras.push({ label: `${def.name} next door`, op, value, from: [from] });
    return;
  }
  const old = target.auras[i]!;
  const n = old.from.length + 1;
  target.auras[i] = {
    label: `${n} ${def.name.endsWith('s') ? def.name : `${def.name}s`} next door`,
    op,
    value: old.value + value,
    from: [...old.from, from],
  };
}

/** Weeks a piece has stood before this one: 0 in the week it's built. */
export function ageOf(piece: PlacedPiece, week: number): number {
  return Math.max(0, week - piece.placedWeek);
}

/** "Every 3rd week": pays when (age + 1) is a multiple of `every`, so the build week counts as the first. */
export function onCadence(age: number, every: number): boolean {
  return every <= 1 || (age + 1) % every === 0;
}

/** The first `requires` condition the piece fails, or null if it meets them all. */
export function unmetRequirement(
  content: Content,
  layout: Layout,
  def: PieceDef,
  uid: number,
): Extract<Effect, { kind: 'requires' }> | null {
  for (const e of def.effects) {
    if (e.kind === 'requires' && !meetsCondition(content, layout, e.condition, uid)) return e;
  }
  return null;
}

interface Ctx {
  content: Content;
  layout: Layout;
  week: number;
  withLines: boolean;
  acc: Map<number, Acc>;
}

/** Applies one of a piece's effects: to its own Acc, or (auras) to its neighbors'. */
function applyEffect(
  ctx: Ctx,
  piece: PlacedPiece,
  def: PieceDef,
  effect: Effect,
  suffix: string,
): void {
  const { content, layout, withLines } = ctx;
  const mine = ctx.acc.get(piece.uid)!;
  const age = ageOf(piece, ctx.week);
  const add = (value: number, label: string, from: BreakdownLine['from'] = []) => {
    mine.points += value;
    if (withLines) mine.own.push({ label: label + suffix, op: 'add', value, from });
  };
  switch (effect.kind) {
    case 'steady':
      add(effect.amount, 'Every week');
      break;
    case 'neighbor': {
      const neighbors = layout.neighbors.get(piece.uid)!;
      const matched = neighbors.filter((n) => matchesNeighbor(content, layout, effect.match, n));
      const counted = effect.max === undefined ? matched : matched.slice(0, effect.max);
      if (counted.length === 0) break;
      const capped = counted.length < matched.length ? ` (${effect.max} count)` : '';
      add(
        effect.amount * counted.length,
        withLines ? neighborLabel(content, layout, matched) + capped : '',
        withLines ? counted.map(neighborRef) : [],
      );
      break;
    }
    case 'aura': {
      for (const n of layout.neighbors.get(piece.uid)!) {
        if (n.kind !== 'piece' || !matchesPiece(content, layout, effect.match, n.uid)) continue;
        const target = ctx.acc.get(n.uid)!;
        if (effect.pct) {
          target.pct += effect.pct;
          if (withLines) addAura(target, def, 'pct', effect.pct, piece.uid);
        }
        if (effect.amount) {
          target.points += effect.amount;
          if (withLines) addAura(target, def, 'add', effect.amount, piece.uid);
        }
      }
      break;
    }
    case 'rhythm':
      if (onCadence(age, effect.every)) add(effect.amount, `Every ${ordinal(effect.every)} week`);
      break;
    case 'growth': {
      const grown = effect.perWeek * (age + 1);
      const value = effect.max === undefined ? grown : Math.min(effect.max, grown);
      if (value !== 0) add(value, `Grown for ${age + 1} ${age === 0 ? 'week' : 'weeks'}`);
      break;
    }
    case 'enclosure': {
      const ids = fencedYardsBordered(layout, piece.uid);
      if (ids.length === 0) break;
      const tiles = ids.reduce((a, id) => a + layout.fencedSizes[id]!, 0);
      const raw = tiles * effect.perTile;
      const value = effect.cap === undefined ? raw : Math.min(effect.cap, raw);
      const capped = value < raw ? ` (up to ${effect.cap})` : '';
      add(value, `Fenced yard of ${tiles} ${tiles === 1 ? 'tile' : 'tiles'}${capped}`);
      break;
    }
    case 'perTile': {
      const n = tilesIn(layout, piece.uid, effect.region);
      if (n > 0)
        add(effect.amount * n, `${n} ${n === 1 ? 'tile' : 'tiles'} ${regionText(effect.region)}`);
      break;
    }
    case 'economy':
      if (onCadence(age, effect.every ?? 1)) {
        mine.budget += effect.budget;
        if (withLines) {
          const when =
            (effect.every ?? 1) > 1 ? `Every ${ordinal(effect.every!)} week` : 'Every week';
          mine.own.push({ label: when + suffix, op: 'budget', value: effect.budget, from: [] });
        }
      }
      break;
    case 'conditional':
      if (meetsCondition(content, layout, effect.when, piece.uid)) {
        applyEffect(
          ctx,
          piece,
          def,
          effect.effect,
          `${suffix} (${conditionText(content, effect.when)})`,
        );
      }
      break;
    case 'link':
    case 'transform':
    case 'requires':
      break;
  }
}

function neighborLabel(content: Content, layout: Layout, matched: readonly Neighbor[]): string {
  const names = matched.map((n) =>
    n.kind === 'piece'
      ? pieceDef(content, layout.byUid.get(n.uid)!).name
      : n.kind === 'street'
        ? neighborName(content, 'street')
        : neighborName(content, n.feature),
  );
  return `Touching ${countedNames(names)}`;
}

/**
 * Tallies the house as it stands in `week` (timers count from each piece's placement week).
 * Without lines it's the cheap path for scoreOnly() and bots.
 */
export function tallyHouse(
  content: Content,
  layout: Layout,
  week: number,
  withLines: boolean,
): Tally {
  const { pieces } = layout.house;
  const acc = new Map<number, Acc>();
  for (const piece of pieces) {
    acc.set(piece.uid, { points: 0, pct: 0, budget: 0, own: [], auras: [], auraAt: new Map() });
  }
  const ctx: Ctx = { content, layout, week, withLines, acc };
  const unmet = new Map<number, string>();

  for (const piece of pieces) {
    const def = pieceDef(content, piece);
    const failed = unmetRequirement(content, layout, def, piece.uid);
    if (failed) {
      unmet.set(piece.uid, conditionText(content, failed.condition));
      continue;
    }
    for (const effect of def.effects) applyEffect(ctx, piece, def, effect, '');
  }

  let budget = 0;
  const scores: PieceScore[] = pieces.map((piece) => {
    const a = acc.get(piece.uid)!;
    const why = unmet.get(piece.uid);
    const lines = withLines ? [...a.own, ...a.auras] : [];
    if (why !== undefined && withLines) {
      lines.unshift({ label: `Needs ${why}: earns nothing`, op: 'none', value: 0, from: [] });
    }
    budget += why === undefined ? a.budget : 0;
    return {
      uid: piece.uid,
      defId: piece.defId,
      points: a.points,
      pct: a.pct,
      earned: why === undefined ? earnedFor(a.points, a.pct) : 0,
      budget: why === undefined ? a.budget : 0,
      ...(why !== undefined ? { unmet: why } : {}),
      lines,
    };
  });

  const sets = matchSets(content, layout);
  let points = 0;
  for (const s of scores) points += s.earned;
  let mult = 100;
  for (const s of sets) {
    points += s.points;
    mult += s.mult;
  }
  return { pieces: scores, sets, points, mult, total: weekTotal(points, mult), budget };
}
