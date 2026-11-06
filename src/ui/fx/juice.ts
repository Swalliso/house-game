// The juice's small sums (implementation-plan.md §12): the tally's speed, the screen shake's
// offsets, and the budget count's pace. They take plain numbers and touch no DOM or settings,
// so Node tests can check them; the director, the board, and BudgetCount call them.

import { FEEL } from './feel.ts';

/**
 * The tally's speed: the chosen speed plus auto-acceleration (capped), or the hold-to-speed-up
 * speed while Space or the right button is held. The closing beats (the multiply moment, the
 * total, the count-up, the milestone) leave auto-acceleration out, so the longest, biggest
 * weeks keep their payoff (D-059).
 */
export function tallySpeed(t: {
  chosen: number;
  accelerator: number;
  holding: boolean;
  closing: boolean;
}): number {
  const auto = t.closing
    ? t.chosen
    : t.chosen + Math.min(FEEL.tally.accelCap, Math.max(0, t.accelerator - 1));
  return t.holding ? Math.max(auto, FEEL.tally.holdSpeed) : auto;
}

/**
 * A shake's offsets in whole CSS px, since half-pixel moves blur pixel art in Safari: `full`
 * on its main axis and `half` on the other. `amount` is the shake in px after the Screen
 * shake setting, so it scales with the setting, and one that rounds to 0 is no shake (null).
 */
export function shakeOffsets(amount: number): { full: number; half: number } | null {
  const full = Math.round(amount);
  if (!(full > 0)) return null;
  return { full, half: Math.round(amount / 2) };
}

/**
 * How the budget shows a change of `diff` (§12, Shop and crates): the ms between coins as it
 * counts one at a time (faster above 9 and above 20; spending counts down at the fastest
 * rate), or null for one jump: above FEEL.budget.jumpAbove, or `instant` (Reduce motion, the
 * ?debug instant tally). A gain that jumps shows as "+N".
 */
export function budgetStepMs(diff: number, instant: boolean): number | null {
  const f = FEEL.budget;
  const n = Math.abs(diff);
  if (instant || n > f.jumpAbove) return null;
  if (diff < 0 || n > f.fasterAbove) return f.fasterMs;
  return n > f.fastAbove ? f.fastMs : f.coinMs;
}
