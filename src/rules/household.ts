// The household's shape (D-219), for the words that describe it: the checklist's Room for
// everyone (house-rules.ts), the job card's household line, and the checklist's arrival lines.

import type { Household } from './index.ts';

/**
 * D-219: a household whose members bring no room of their own and ring the doorbell one at a
 * time, every milestone in a row (the Bigsbys, Foundation to Finishes). Its words say "one more
 * Bedroom each milestone" once, rather than a clause for each arrival.
 */
export function eachMilestone(h: Household): boolean {
  const phases = h.arrivals.map((a) => a.phase);
  return (
    h.arrivals.length >= 2 &&
    h.arrivals.every((a) => a.room === undefined) &&
    phases.every((p, k) => k === 0 || p === phases[k - 1]! + 1)
  );
}
