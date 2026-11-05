// The weekly tally (implementation-plan.md §4, Scoring pipeline; D-037, D-056).
//
// Per piece, in placement order:
//   points = the sum of flat terms (steady, neighbor bonuses and penalties, flat auras)
//   pct    = the sum of percentage terms (auras). Percentages add: two +100% make ×3.
//   earned = floor((max(0, points) × max(0, 100 + pct) + 50) / 100)
// For the week (Mult in hundredths, starting at 100):
//   Points = Σ earned + Σ set Points
//   Mult   = 100 + Σ set Mult          (specs from M4a; ×Mult sources from M3a)
//   Total  = floor((Points × Mult + 50) / 100)
// Integer math throughout, rounding half up, so every browser and Node agree.

import type { BreakdownLine, Content, PieceScore, Tally } from './index.ts';
import { neighborRef, pieceDef, type Layout, type Neighbor } from './layout.ts';
import { matchesNeighbor, matchesPiece } from './selectors.ts';
import { matchSets } from './sets.ts';
import { countedNames, neighborName } from './text.ts';

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

/** Tallies the house as it stands. Without lines it's the cheap path for scoreOnly() and bots. */
export function tallyHouse(content: Content, layout: Layout, withLines: boolean): Tally {
  const { pieces } = layout.house;
  const acc = new Map<
    number,
    { points: number; pct: number; own: BreakdownLine[]; auras: BreakdownLine[] }
  >();
  for (const piece of pieces) acc.set(piece.uid, { points: 0, pct: 0, own: [], auras: [] });

  for (const piece of pieces) {
    const def = pieceDef(content, piece);
    const mine = acc.get(piece.uid)!;
    const neighbors = layout.neighbors.get(piece.uid)!;
    for (const effect of def.effects) {
      switch (effect.kind) {
        case 'steady':
          mine.points += effect.amount;
          if (withLines)
            mine.own.push({ label: 'Every week', op: 'add', value: effect.amount, from: [] });
          break;
        case 'neighbor': {
          const matched = neighbors.filter((n) =>
            matchesNeighbor(content, layout, effect.match, n),
          );
          const counted = effect.max === undefined ? matched : matched.slice(0, effect.max);
          if (counted.length === 0) break;
          const value = effect.amount * counted.length;
          mine.points += value;
          if (withLines) {
            const capped = counted.length < matched.length ? ` (${effect.max} count)` : '';
            mine.own.push({
              label: neighborLabel(content, layout, matched) + capped,
              op: 'add',
              value,
              from: counted.map(neighborRef),
            });
          }
          break;
        }
        case 'aura': {
          for (const n of neighbors) {
            if (n.kind !== 'piece' || !matchesPiece(content, layout, effect.match, n.uid)) continue;
            const target = acc.get(n.uid)!;
            const from = [{ kind: 'piece', uid: piece.uid } as const];
            const label = `${def.name} next door`;
            if (effect.pct) {
              target.pct += effect.pct;
              if (withLines) target.auras.push({ label, op: 'pct', value: effect.pct, from });
            }
            if (effect.amount) {
              target.points += effect.amount;
              if (withLines) target.auras.push({ label, op: 'add', value: effect.amount, from });
            }
          }
          break;
        }
      }
    }
  }

  const scores: PieceScore[] = pieces.map((piece) => {
    const a = acc.get(piece.uid)!;
    return {
      uid: piece.uid,
      defId: piece.defId,
      points: a.points,
      pct: a.pct,
      earned: earnedFor(a.points, a.pct),
      lines: withLines ? [...a.own, ...a.auras] : [],
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
  return { pieces: scores, sets, points, mult, total: weekTotal(points, mult) };
}
