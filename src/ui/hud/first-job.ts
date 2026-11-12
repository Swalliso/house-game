// The first job (D-149): the first run a browser starts is an ordinary run whose screen starts
// calm and fills in as each part first matters, and whose first three weeks the hints walk
// through by name. Friends who saw the game for the first time said it looked fun and confusing:
// week 1 put 245 words and 40 controls on screen, 108 of the words in the checklist.
//
// What shows is read from the run alone, so a reload or Continue shows the same screen, and no
// part needs a "seen" flag of its own. Nothing here changes a rule: the run plays, saves and
// replays as any other, and every later run shows everything from week 1.
//
// - Week 1: the lot, the hand and the milestone's target.
// - Week 2, as the first tally starts: the score panel it counts into, Inspect, and the forecast.
// - Week 4, once the opening's three weeks are played: the client's checklist, and Reroll.
// - Foundation: budget, overtime, Demolish, and Complete early with its Auto switch. Budget shows
//   sooner if a find pays some, and overtime if Groundbreaking needs a week of it.
// - Foundation's second week: Strike (D-157). If Foundation is completed in its first week,
//   Strike shows from the next milestone without its entrance.
//
// No DOM, so it tests in Node. FirstHints.tsx words the opening's hints.

import { computed } from '@preact/signals';
import type { PieceId, RunState } from '../../rules/index.ts';
import { busy } from '../fx/director.ts';
import { appScreen, firstJob, run, selected, tentative, tool } from '../store.ts';
import { seenHints } from './seen-hints.ts';

/** The parts of the build screen the first job brings in. */
export interface Shown {
  /** The score panel: Comfort × Charm = Wow. */
  score: boolean;
  inspect: boolean;
  /** The top bar's forecast, beside the target. */
  forecast: boolean;
  /** The client's panel: tastes, house rules, and wishes. */
  checklist: boolean;
  reroll: boolean;
  demolish: boolean;
  budget: boolean;
  overtime: boolean;
  /** Complete early, its Auto switch, and its hint. */
  early: boolean;
  /** D-157: Strike on the plank, and its S key. */
  strike: boolean;
}

const EVERYTHING: Shown = {
  score: true,
  inspect: true,
  forecast: true,
  checklist: true,
  reroll: true,
  demolish: true,
  budget: true,
  overtime: true,
  early: true,
  strike: true,
};

/** The weeks the opening walks through: the checklist and Reroll come in after them. */
export const OPENING_WEEKS = 3;

/** Strike arrives in Foundation's second week (D-157): a week after Demolish. */
export const STRIKE_SLOT = 2;

/** What the build screen shows for run `s`: everything, unless it's the first job. */
export function shownIn(s: RunState, first: boolean): Shown {
  if (!first) return EVERYTHING;
  const founded = s.phase >= 1;
  return {
    score: s.week >= 2,
    inspect: s.week >= 2,
    forecast: s.week >= 2,
    checklist: s.week > OPENING_WEEKS,
    reroll: s.week > OPENING_WEEKS,
    demolish: founded,
    budget: founded || s.budget > 0 || s.screen === 'shop',
    overtime: founded || s.overtimeWeek > 0,
    early: founded,
    strike: s.phase > 1 || (s.phase === 1 && s.slot >= STRIKE_SLOT),
  };
}

/** What the build screen shows now. */
export const shown = computed(() => shownIn(run.value, firstJob.value));

/**
 * The part of the screen that arrives this week, for its entrance (first-job.css): a part comes
 * in once, in the week the first job first shows it, and a reload in that week plays it again.
 */
export function arrivingIn(s: RunState, first: boolean): ReadonlySet<keyof Shown> {
  const out = new Set<keyof Shown>();
  if (!first || s.screen !== 'build') return out;
  if (s.week === 2) for (const k of ['score', 'inspect', 'forecast'] as const) out.add(k);
  if (s.week === OPENING_WEEKS + 1) for (const k of ['checklist', 'reroll'] as const) out.add(k);
  if (s.phase === 1 && s.slot === 1 && s.overtimeWeek === 0) {
    for (const k of ['demolish', 'budget', 'overtime', 'early'] as const) out.add(k);
  }
  // A Foundation completed in its first week never gets here: Strike then shows from the next
  // milestone without its entrance (D-157's known gap).
  if (s.phase === 1 && s.slot === STRIKE_SLOT && s.overtimeWeek === 0) out.add('strike');
  return out;
}

export const arriving = computed(() => arrivingIn(run.value, firstJob.value));

/**
 * The opening (D-149): the card each of the first three weeks is best spent on, and what it
 * builds on. A Bedroom earns alone; a Bathroom earns touching one; a Closet beside the two makes
 * the three a Suite, the first set. The first job's lot deals them in this order (balance.ts's
 * `firstSeed`; first-job.test.ts holds it to that). On any other lot the hints name a card only
 * when the hand holds it and the house has what it builds on. `only`: the house is those pieces
 * and nothing else, so they touch each other and the card completes the set wherever it's built.
 */
export const OPENING: readonly { card: PieceId; needs: readonly PieceId[]; only?: true }[] = [
  { card: 'bedroom', needs: [] },
  { card: 'bathroom', needs: ['bedroom'] },
  { card: 'closet', needs: ['bedroom', 'bathroom'], only: true },
];

/** The opening's card for this week, and where it is in the hand; null when it doesn't apply. */
export function openingCard(s: RunState): { id: PieceId; i: number } | null {
  if (s.screen !== 'build' || s.overtimeWeek > 0) return null;
  const step = OPENING[s.week - 1];
  if (!step) return null;
  const i = s.hand.findIndex((c) => c.kind === 'piece' && c.id === step.card);
  if (i < 0) return null;
  const built = s.house.pieces.map((p) => p.defId);
  if (!step.needs.every((id) => built.includes(id))) return null;
  if (step.only && built.length !== step.needs.length) return null;
  return { id: step.card, i };
}

/** Week 1's three plays, in order: the one the player is on. */
export type GuideStep = 'pick' | 'place' | 'end';

/** Which of week 1's plays comes next, from what's picked and what's waiting for End week. */
export function guideStepOf(picked: boolean, placed: boolean): GuideStep {
  return placed ? 'end' : picked ? 'place' : 'pick';
}

/**
 * Whether week 1's guide is up: the first week's hint, until it's dismissed. While it is, the
 * card to pick and then End week pulse (first-job.css).
 */
export const guideOn = computed(
  () =>
    appScreen.value === 'game' &&
    run.value.screen === 'build' &&
    run.value.week === 1 &&
    !seenHints.value.has('firstWeek'),
);

/** The play week 1's guide is waiting for, or null when the guide isn't up. */
export const guideStep = computed<GuideStep | null>(() => {
  if (!guideOn.value || tool.value !== 'build') return null;
  return guideStepOf(selected.value !== null, tentative.value !== null);
});

/** The opening's hints by week (FirstHints.tsx's ids): each names its week's card. */
const OPENING_HINTS = ['firstWeek', 'score', 'sets'] as const;

/**
 * The hand card the opening's hint points at: the one it names, in a gold ring until it's
 * picked. Only while that week's hint is still to be read, and never while a tally plays.
 */
export const guideCard = computed<number | null>(() => {
  const s = run.value;
  if (appScreen.value !== 'game' || busy.value || tool.value !== 'build') return null;
  if (selected.value !== null) return null;
  const hint = OPENING_HINTS[s.week - 1];
  if (!hint || seenHints.value.has(hint)) return null;
  return openingCard(s)?.i ?? null;
});
