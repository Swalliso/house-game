// The house builds itself (S10, D-187): at the end of a run that ends in this browser, once the
// look down the street (D-156) has come back, the lot is cleared to how the run began and the
// house goes up again on the board, build by build, each with its place sound a little higher.
// Then the end screen's photos deal in (D-136). TimelapseLayer.tsx plays it; this is when it's
// due and the numbers it plays by (FEEL.timelapse), pure but for the signal and its listeners.
//
// Only a run that ends here gets one, by the look's own guards: a run that was in progress and
// isn't now, not a debug run, with Reduce motion off. So a run loaded already over gets none. It's
// due from the action that ended the run until it has played or been skipped, and the photos wait
// for it (EndPhotos.tsx). A new run or a load drops it.

import { signal } from '@preact/signals';
import { ladderSemitones } from '../audio/kit.ts';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { inProgress, onEvents, onRunReset } from '../store.ts';

/**
 * `due` from the moment the run ends until it starts, `on` while it plays: each for the run it's
 * for (its setup, as the look down the street names it, camera.ts).
 */
export type Timelapse = { readonly phase: 'due' | 'on'; readonly run: object };

export const timelapse = signal<Timelapse | null>(null);

onEvents((_events, before, after) => {
  if (inProgress(before) && !inProgress(after) && !after.debug && !settings.value.reduceMotion) {
    timelapse.value = { phase: 'due', run: after.setup };
  }
});
onRunReset(() => (timelapse.value = null));

type Feel = typeof FEEL.timelapse;

/**
 * The schedule for `builds` builds: each build's share (FEEL's stepMs, or less, so the whole fits
 * in maxMs) and the whole, from the cleared lot to the end of the finished house's hold.
 */
export function timelapsePlan(
  builds: number,
  f: Feel = FEEL.timelapse,
): { stepMs: number; totalMs: number } {
  const room = f.maxMs - f.startMs - f.holdMs;
  const stepMs = builds > 0 ? Math.min(f.stepMs, room / builds) : 0;
  return { stepMs, totalMs: f.startMs + builds * stepMs + f.holdMs };
}

/**
 * The frame due `ms` after the cleared lot came up: 0 for the lot as the run began, then i + 1
 * for the i-th build (0-based), and the last build for the rest.
 */
export function frameAt(ms: number, builds: number, stepMs: number, f: Feel = FEEL.timelapse) {
  if (builds <= 0 || ms < f.startMs) return 0;
  return Math.min(builds, 1 + Math.floor((ms - f.startMs) / stepMs));
}

/**
 * The i-th of `builds` builds' place sound (0-based): from FEEL's rate up the tally's ladder,
 * `ladderSteps` of its steps from the first build to the last.
 */
export function buildRate(i: number, builds: number, f: Feel = FEEL.timelapse): number {
  const step =
    builds > 1 ? Math.round((Math.min(i, builds - 1) / (builds - 1)) * f.ladderSteps) : 0;
  return f.rate * 2 ** (ladderSemitones(Math.max(0, step)) / 12);
}
