// The end screen's "Next time" (D-150): after a lost run, one tip for the next one, read from the
// run's own state. Most first jobs are lost (in the 2026-11-11 survey a casual bot won 3% of them,
// and lost at a median week 22), so the screen after a loss is the one most new players reach.
//
// - The house held no set at the end: build one. It names the Suite, the set the first job's
//   opening builds, and says what a set does. Charm is about 69% of a typical run's Wow.
// - Otherwise, a reroll was left over at the end: Reroll is there for a hand that doesn't help.
// - Otherwise nothing.
//
// Never "complete early": the sim finds that completing every milestone early costs a run Wow.
// A win gets no tip: its screen already says the verdict above it (D-139).
//
// The rules say every fact here; this only words them, with the content's names and the score
// labels (D-019). No DOM, so it tests in Node.

import { CONTENT, SCORE_LABELS, type RunState } from '../../rules/index.ts';

export type NextTimeKind = 'set' | 'reroll';

export interface NextTime {
  kind: NextTimeKind;
  text: string;
}

const L = SCORE_LABELS;
/** The Suite and its pieces, by the content's names, as the opening's hints name them. */
const { bedroom, bathroom, closet } = CONTENT.pieces;
const suite = CONTENT.sets.suite;

/** Which tip a finished run gets: only a lost run gets one, and not always. */
export function nextTimeKind(s: RunState): NextTimeKind | null {
  if (s.screen !== 'lost') return null;
  // The sets the last week's tally held: a set made and later demolished doesn't count.
  if ((s.lastTally?.setInstances.length ?? 0) === 0) return 'set';
  if (s.rerollsLeft + s.bonusRerolls > 0) return 'reroll';
  return null;
}

/** Rerolls left over at the end: this milestone's unspent, and any bought ones kept. */
function spare(s: RunState): string {
  const n = s.rerollsLeft + s.bonusRerolls;
  return n === 1 ? 'a reroll' : `${n} rerolls`;
}

/** The tip for a finished run, or null. Each is within HINT_WORDS (next-time.test.ts). */
export function nextTime(s: RunState): NextTime | null {
  const kind = nextTimeKind(s);
  if (kind === 'set') {
    return {
      kind,
      text:
        `Build a ${suite.name}: a ${bedroom.name}, a ${bathroom.name}, and a ${closet.name}, ` +
        `touching. A set raises ${L.mult}, which multiplies ${L.points} into ${L.total}.`,
    };
  }
  if (kind === 'reroll') {
    return {
      kind,
      text:
        `You ended with ${spare(s)} to spare. When a hand has nothing your house needs, ` +
        `Reroll it: the week goes on.`,
    };
  }
  return null;
}
