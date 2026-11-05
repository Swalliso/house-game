// Milestones (D-005, D-018, D-028, D-042): each phase has a target for the run's one running
// total of Wow. M1 has hand-set rising targets from balance.ts and ends the run on a miss;
// overtime and early completion arrive in M2.

import type { Balance } from './index.ts';

export function phaseCount(b: Balance): number {
  return b.phases.length;
}

export function phaseTarget(b: Balance, phase: number): number {
  const p = b.phases[phase];
  if (!p) throw new Error(`No phase ${phase}`);
  return p.target;
}

export function phaseName(b: Balance, phase: number): string {
  return b.phases[phase]?.name ?? `Phase ${phase + 1}`;
}

/**
 * The celebration ladder's yardstick (§12): what each week of the phase needs to earn, fixed
 * when the phase starts and never below 1, even once the target is met.
 */
export function paceFor(b: Balance, phase: number, phaseStartScore: number): number {
  const needed = phaseTarget(b, phase) - phaseStartScore;
  return Math.max(1, Math.ceil(needed / b.weeksPerPhase));
}

/** The run-end verdict by score band (§12). A lost run gets the lowest one. */
export function verdictFor(b: Balance, score: number, won: boolean): string {
  const lowest = b.verdicts[0]?.name ?? '';
  if (!won) return lowest;
  const last = phaseTarget(b, b.phases.length - 1);
  let name = lowest;
  for (const v of b.verdicts) if (score * 100 >= last * v.minPctOfTarget) name = v.name;
  return name;
}
