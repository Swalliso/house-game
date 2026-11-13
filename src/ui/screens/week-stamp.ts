// The week's stamp (D-154): "Week 2 of 5" at the board's top center as each week of a
// milestone comes up, so the weeks don't slip by. A milestone's first week names it and what
// its target needs; its middle weeks get a smaller, quieter stamp; its last is orange, says what
// the target still needs, and ticks like a clock. An overtime week has its Overtime! banner
// instead, and the first job's first week (D-149) has the opening's hint.
//
// Each week is stamped once, when the board is quiet: the tally and the milestone's beats
// played, no banner up, and no sheet over the board. A tally starting takes it down at once; an
// action with nothing to play (a reroll, a purchase) leaves it up. It never takes the pointer.
// Overlays.tsx draws it. No DOM here, so it tests in Node.

import { effect, signal } from '@preact/signals';
import { CONTENT, rules, SCORE_LABELS, type RunState } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { banner, busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { appScreen, firstJob, onRunReset, run } from '../store.ts';

/**
 * The week whose tally checks the milestone's target: its last, or an overtime week. End week
 * and the top bar's plaque say so (D-154).
 */
export function decidingWeek(s: RunState): boolean {
  return s.screen === 'build' && rules.weeksLeft(s) === 1;
}

/** What a deciding week stakes, for End week's title: "The last week of Roofing: 471 Wow to go…". */
export function stakesOf(s: RunState): string | null {
  if (!decidingWeek(s)) return null;
  const which =
    s.overtimeWeek > 0
      ? `Overtime week ${s.overtimeWeek}`
      : `The last week of ${rules.phaseName(s.phase)}`;
  const toGo = rules.toGo(s);
  const need = toGo > 0 ? `${formatNumber(toGo)} ${SCORE_LABELS.total} to go` : 'its target is met';
  return `${which}: ${need}. The target is checked as this week is tallied.`;
}

/** A milestone's first week, one of its middle weeks, or its last. */
export type StampKind = 'first' | 'mid' | 'last';

export interface WeekStampView {
  id: number;
  kind: StampKind;
  /** The milestone's name. */
  phase: string;
  slot: number;
  weeks: number;
  /** What the target still needs (rules.toGo), as the week comes up: 0 once it's met. */
  toGo: number;
  /** How long it's up, in real time: in, hold, out. */
  ms: number;
}

/** The stamp for the week `s` is on, or null: none in an overtime week or on another screen. */
export function stampFor(s: RunState, guided: boolean): Omit<WeekStampView, 'id'> | null {
  if (s.screen !== 'build' || s.overtimeWeek > 0) return null;
  // The first job's first week has the opening's hint to read (D-149): its weeks start at 2.
  if (guided && s.week === 1) return null;
  const kind: StampKind = rules.weeksLeft(s) === 1 ? 'last' : s.slot === 1 ? 'first' : 'mid';
  const f = FEEL.weekStamp;
  return {
    kind,
    phase: rules.phaseName(s.phase),
    slot: s.slot,
    weeks: CONTENT.balance.weeksPerPhase,
    toGo: rules.toGo(s),
    ms: f.inMs + f.holdMs[kind] + f.outMs,
  };
}

export const weekStamp = signal<WeekStampView | null>(null);

let nextId = 1;
/** The week last stamped (its run's seed and week), so each week is stamped once. */
let stampedAt = '';
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function hide(): void {
  clearTimeout(hideTimer);
  if (weekStamp.value) weekStamp.value = null;
}

function check(): void {
  const s = run.value;
  // A tally playing takes it down at once, and the next week's waits until it's done.
  if (busy.value || appScreen.value !== 'game' || s.screen !== 'build') {
    hide();
    return;
  }
  // A banner (overtime, a milestone) has the spot: the week waits until it goes.
  if (banner.value) return;
  const at = `${s.setup.seed}/${s.week}`;
  if (at === stampedAt) return;
  stampedAt = at;
  const view = stampFor(s, firstJob.value);
  if (!view) {
    hide();
    return;
  }
  const shown: WeekStampView = { id: nextId++, ...view };
  weekStamp.value = shown;
  if (view.kind === 'last') audio.play('last-week');
  else audio.play('week-start', view.kind === 'mid' ? { gain: FEEL.weekStamp.midGain } : {});
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (weekStamp.value?.id === shown.id) weekStamp.value = null;
  }, view.ms);
}

// Checked a microtask after what it reads changes. An action's new state is in place before the
// tally director hears of it and marks itself busy (store.ts dispatch), so checking at once would
// stamp the next week as its tally starts, and take it down again.
let queued = false;
effect(() => {
  void [run.value, appScreen.value, busy.value, banner.value];
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    check();
  });
});

// A run replaced (a new run, a lot played again, a load) is stamped afresh, even on the seed
// and week the last one was stamped at.
onRunReset(() => {
  stampedAt = '';
  hide();
});
