// Milestones (D-005, D-018, D-028, D-042): each phase has a target for the run's one running
// total of Wow, set by the sim (D-044). Overtime (D-041) and early completion (D-040) are in
// run.ts; this file holds the numbers.

import type { Balance } from './index.ts';
import { roundHalfUp } from './scoring.ts';

export function phaseCount(b: Balance): number {
  return b.phases.length;
}

/**
 * The cumulative Wow needed by the end of a phase: the curve's target times the client's
 * `targetPct` (M4a; 100 = the curve), rounded half up.
 */
export function phaseTarget(b: Balance, phase: number, targetPct = 100): number {
  const p = b.phases[phase];
  if (!p) throw new Error(`No phase ${phase}`);
  return targetPct === 100 ? p.target : roundHalfUp(p.target * targetPct, 100);
}

export function phaseName(b: Balance, phase: number): string {
  return b.phases[phase]?.name ?? `Phase ${phase + 1}`;
}

/**
 * The celebration ladder's yardstick (§12): what each week of the phase needs to earn, fixed
 * when the phase starts and never below 1, even once the target is met.
 */
export function paceFor(
  b: Balance,
  phase: number,
  phaseStartScore: number,
  targetPct = 100,
): number {
  const needed = phaseTarget(b, phase, targetPct) - phaseStartScore;
  // A UI yardstick, not a score, so it may be fractional (30 over 4 weeks is 7.5).
  return Math.max(1, needed / b.weeksPerPhase);
}

/** The run-end verdict by score band (§12). A lost run gets the lowest one. */
export function verdictFor(b: Balance, score: number, won: boolean, targetPct = 100): string {
  const lowest = b.verdicts[0]?.name ?? '';
  if (!won) return lowest;
  const last = phaseTarget(b, b.phases.length - 1, targetPct);
  let name = lowest;
  for (const v of b.verdicts) if (score * 100 >= last * v.minPctOfTarget) name = v.name;
  return name;
}

/**
 * The verdict above the one a won run's score has, and the score it starts at (D-139): the end
 * screen's "next" line. Null at the top verdict, and for a run that wasn't won (a lost run is
 * always the lowest).
 */
export function nextVerdictFor(
  b: Balance,
  score: number,
  won: boolean,
  targetPct = 100,
): { name: string; score: number } | null {
  if (!won) return null;
  const last = phaseTarget(b, b.phases.length - 1, targetPct);
  for (const v of b.verdicts) {
    if (score * 100 < last * v.minPctOfTarget) {
      return { name: v.name, score: Math.ceil((last * v.minPctOfTarget) / 100) };
    }
  }
  return null;
}

/** A per-phase number from a list whose last entry repeats. */
function perPhase(list: readonly number[], phase: number): number {
  return list[Math.min(phase, list.length - 1)] ?? 0;
}

/**
 * The early-completion bonus (D-040, §4 Fast-forward): computed when the milestone completes.
 * Score: (score − phase start) × scorePct × weeksSaved / 100; budget: budgetPerWeek × weeksSaved.
 * `earlyRewardPct` (100 = normal) scales both.
 */
export function earlyBonus(
  b: Balance,
  phase: number,
  phaseEarnings: number,
  weeksSaved: number,
  earlyRewardPct: number,
): { score: number; budget: number } {
  if (weeksSaved <= 0) return { score: 0, budget: 0 };
  const earned = Math.max(0, phaseEarnings);
  return {
    score: roundHalfUp(
      earned * perPhase(b.early.scorePct, phase) * weeksSaved * earlyRewardPct,
      10000,
    ),
    budget: roundHalfUp(perPhase(b.early.budgetPerWeek, phase) * weeksSaved * earlyRewardPct, 100),
  };
}
