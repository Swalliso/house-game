// The tally director (implementation-plan.md §12, The weekly tally; D-059). The rules have
// already moved on when an action returns, so this only plays the events back, in order: the
// placed piece settles (or the renovated room levels up), pieces pop one at a time in
// placement order with a rising pitch ladder, sets add their Comfort and then their Charm,
// each checklist line held adds its Charm (M4a), Comfort × Charm collapse into the week's Wow,
// and the week drains into the run total. Fast-forwarded weeks (early completion) count
// quickly; demolitions, transforms, overtime, and each milestone result get their own beat.
// M4b's change orders get theirs: a restriction broken (✕ on the piece), each order resolving
// at its milestone (its reward counting into the budget), the sheet's arrival, and the answer's
// stamp; and a household member's arrival (a banner, and their cards popping into the reserve).
// Animation speed never affects the game.
//
// Speed: the chosen tally speed, plus Balatro-style auto-acceleration during the steps, plus
// fast-forward while Space or the right mouse button is held. A click skips to the result.

import { batch, signal } from '@preact/signals';
import {
  CONTENT,
  rewardText,
  rules,
  SCORE_LABELS,
  type ArrivalId,
  type ChangeOrderId,
  type ChangeOrderResult,
  type ChangeOrderView,
  type ClientId,
  type GameEvent,
  type PieceScore,
  type RunState,
  type SpecScore,
  type Tally,
  type XMultTerm,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { arrivalOf, cardsPhrase, isPlural } from '../hud/household.ts';
import { settings } from '../settings.ts';
import { onEvents, onRunReset } from '../store.ts';
import { formatNumber } from '../format.ts';
import { FEEL } from './feel.ts';
import { tallySpeed } from './juice.ts';

/**
 * `spec` names a checklist line the week turned on, in Charm's color; `lost` one it turned off,
 * orange with a ✕ (both in checklist.css). `order` is a change order paying (blue, ✓), and
 * `quiet` one that didn't, or a phase effect ending (change-order.css).
 */
export type PopupKind =
  'points' | 'mult' | 'set' | 'spec' | 'lost' | 'total' | 'note' | 'sparkle' | 'order' | 'quiet';

export interface Popup {
  id: number;
  /** Lot coordinates (cells, may be fractional), so the board can place it at any scale. */
  x: number;
  y: number;
  text: string;
  kind: PopupKind;
  /** Real-time lifetime in ms. */
  ms: number;
}

export interface TallyView {
  stage: 'pieces' | 'sets' | 'specs' | 'sparkle' | 'multiply' | 'total';
  /** The ×Mult sources that have landed so far this tally (gold Sparkle stamps). */
  sparkles: readonly XMultTerm[];
  points: number;
  mult: number;
  total: number | null;
  activeUid: number | null;
  pace: number;
  big: boolean;
  /** A week skipped by early completion. */
  fastForward: boolean;
  /** The week's total from the event, so the glow stays lit through the count before `total`. */
  weekTotal: number;
  /** What each piece earned in the week being tallied, for the board's digits. */
  pieces: readonly PieceScore[];
  /**
   * The client's checklist as the tally shows it (M4a), in checklist order. It starts as last
   * week's: a line the week turned on or off flips when its beat lands.
   */
  specs: readonly SpecScore[];
  /** The checklist line the tally has reached: −1 before the checklist's turn, its length after. */
  specAt: number;
  /** What each line held adds to the Mult this week, in hundredths (the tally's `specBonus`). */
  specBonus: number;
}

/** A checklist line lighting up as the tally reaches it (M4a). */
export interface CheckFlash {
  id: number;
  /** The line's place in the checklist, as in its specMet or specLost event. */
  index: number;
  /** A line held, one the week turned on (★, a pop), or one it turned off (✕, a shake). */
  kind: 'held' | 'met' | 'lost';
  /** Real-time lifetime in ms, as long as a popup for its beat. */
  ms: number;
}

export interface Banner {
  id: number;
  title: string;
  detail: string;
  tone: 'good' | 'bad';
}

export const busy = signal(false);
/** The ?debug panel's instant tally: every animation is skipped. */
export const instantTally = signal(false);
export const tallyView = signal<TallyView | null>(null);
/** The run total as shown while it counts up; null when it should show the state's score. */
export const shownScore = signal<number | null>(null);
export const popups = signal<readonly Popup[]>([]);
export const highlighted = signal<readonly number[]>([]);
/**
 * Checklist rows flashing in the tally (M4a), each for its `ms`: the Checklist glows a line
 * held, pops a line turned on, and shakes a line turned off. They overlap at high speeds.
 */
export const checkFlashes = signal<readonly CheckFlash[]>([]);
export const banner = signal<Banner | null>(null);
/** Bumped for each big week, so the celebration can restart. */
export const celebration = signal<{ id: number; total: number; pace: number } | null>(null);
/** A flash over the board: 'good' is the green 'Target reached!', 'note' a neutral notice. */
export const flash = signal<{ id: number; text: string; tone: 'good' | 'note' } | null>(null);
/**
 * The run as the tally started, while it plays: the top bar keeps showing that phase and week
 * until the milestone lands, since the rules have already moved on.
 */
export const shownRun = signal<RunState | null>(null);
/**
 * One-shot effects (celebration, flash, justPlaced) carry an id: a consumer plays each id
 * once, so remounting the game screen (Menu, then Continue) doesn't replay them.
 */
export const played = { celebration: 0, flash: 0, settle: 0, levelPop: 0 };
/** The piece that was just placed, for its settle animation. */
export const justPlaced = signal<{ uid: number; id: number } | null>(null);
/** The room that was just renovated, for its level badge's pop. */
export const justRenovated = signal<{ uid: number; id: number } | null>(null);

/**
 * A change order's answer, stamped on its sheet as the sheet goes (M4b): the sheet as it was
 * answered, since the rules have already moved on to the shop (or back to the week).
 */
export interface OrderStamp {
  id: number;
  view: ChangeOrderView;
  clientId: ClientId;
  /** Offered by the ?debug panel mid-week: answering it goes back to that week. */
  forced: boolean;
  answer: 'accepted' | 'declined' | 'noted';
}
export const orderStamp = signal<OrderStamp | null>(null);
/** A household member's cards, just in the reserve (M4b): the reserve pops them in. */
export const justArrived = signal<{ arrival: ArrivalId; id: number } | null>(null);

/** The board registers these, so the director can wobble pieces and shake the screen. */
export const fxHooks: {
  wobble: (uid: number) => void;
  shake: (px: number) => void;
} = { wobble: () => {}, shake: () => {} };

let nextId = 1;
let skipping = false;
let holding = false;
let accelerator = 0;
/** The closing beats, from the multiply moment on: no auto-acceleration (FEEL.tally). */
let closing = false;
let chain: Promise<void> = Promise.resolve();
/** Bumped when the run is replaced, so a tally still playing for the old run goes quiet. */
let generation = 0;
/**
 * Animated actions sent but not yet playing. The newest one's starting state is on show from
 * the moment it's sent (onEvents), so a play with one waiting behind it hurries and leaves the
 * top bar alone.
 */
let waiting = 0;

export function skip(): void {
  if (busy.value) skipping = true;
  banner.value = null;
}

export function setHold(on: boolean): void {
  holding = on;
}

function motion(): boolean {
  return !settings.value.reduceMotion;
}

function effectiveSpeed(): number {
  return tallySpeed({ chosen: settings.value.tallySpeed, accelerator, holding, closing });
}

/** Real time, fast-forwarded by holding: for a banner, which stays up in real time. */
function realSpeed(): number {
  return holding ? FEEL.tally.holdSpeed : 1;
}

/**
 * Waits `ms` of tally time, sped up by the speed setting, the accelerator (except in the
 * closing beats), and holding. Time is real elapsed time, so a slow or throttled frame rate
 * doesn't slow the tally down. `onProgress` gets the fraction done on each frame, for tweens;
 * `until` ends the wait early once it's true; `speed` replaces the tally's speed.
 */
function wait(
  ms: number,
  onProgress?: (fraction: number) => void,
  until?: () => boolean,
  speed: () => number = effectiveSpeed,
): Promise<void> {
  if (instantTally.value) skipping = true;
  if (skipping || ms <= 0) {
    onProgress?.(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let remaining = ms;
    let last = performance.now();
    const tick = (now: number) => {
      // A hidden tab pauses frames; cap the catch-up so returning doesn't skip a whole tally.
      const dt = Math.min(1000, now - last);
      last = now;
      if (!closing) {
        accelerator += (FEEL.tally.accelPerSecond * settings.value.tallySpeed * dt) / 1000;
      }
      remaining -= dt * speed();
      const done = remaining <= 0 || skipping || !!until?.();
      onProgress?.(done ? 1 : 1 - remaining / ms);
      if (done) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** A popup's real-time lifetime for a beat of `stepMs` (a checklist row's flash's too). */
function popupMs(stepMs: number): number {
  const t = FEEL.tally;
  return Math.max(t.popupMinMs, (stepMs - t.popupShortenMs) / effectiveSpeed() + t.popupTailMs);
}

function popup(x: number, y: number, text: string, kind: PopupKind, stepMs: number): void {
  if (skipping) return;
  const ms = popupMs(stepMs);
  // Keep popups on the board: the top row's would rise off its edge.
  const p: Popup = { id: nextId++, x, y, text, kind, ms };
  popups.value = [...popups.value, p];
  setTimeout(() => {
    popups.value = popups.value.filter((q) => q.id !== p.id);
  }, ms);
}

/** Lights a checklist row as its beat lands (M4a). A newer flash on the row replaces its last. */
function flashLine(index: number, kind: CheckFlash['kind'], stepMs: number): void {
  if (skipping) return;
  const f: CheckFlash = { id: nextId++, index, kind, ms: popupMs(stepMs) };
  checkFlashes.value = [...checkFlashes.value.filter((q) => q.index !== index), f];
  setTimeout(() => {
    checkFlashes.value = checkFlashes.value.filter((q) => q.id !== f.id);
  }, f.ms);
}

function shake(px: number): void {
  if (skipping || !motion()) return;
  fxHooks.shake((px * settings.value.shake) / 50);
}

/**
 * The middle of a piece in lot coordinates, for popups. Kept at least 2 rows down, so popups
 * near the top edge rise into view, and stacked popups keep their spacing.
 */
function pieceCenter(states: readonly RunState[], uid: number): { x: number; y: number } {
  // A Sapling that matured at the start of the next week is gone from the state after the
  // action, but its last tally still scores it: find it in the state before.
  let piece: RunState['house']['pieces'][number] | undefined;
  for (const state of states) {
    piece = state.house.pieces.find((p) => p.uid === uid);
    if (piece) break;
  }
  if (!piece) return { x: 0, y: 2 };
  const shape = piece.shape ?? CONTENT.pieces[piece.defId].shape;
  const rows = piece.rot % 2 === 0 ? shape.length : shape[0]!.length;
  const cols = piece.rot % 2 === 0 ? shape[0]!.length : shape.length;
  return { x: piece.x + cols / 2, y: Math.max(2, piece.y + rows / 2) };
}

function centroid(states: readonly RunState[], uids: readonly number[]): { x: number; y: number } {
  const cs = uids.map((u) => pieceCenter(states, u));
  return {
    x: cs.reduce((a, c) => a + c.x, 0) / Math.max(1, cs.length),
    y: cs.reduce((a, c) => a + c.y, 0) / Math.max(1, cs.length),
  };
}

/**
 * The middle of the house (its indoor pieces) in lot coordinates, for the checklist's popups:
 * the checklist judges the house, and the camera is usually on it. It's kept off the lot's
 * side edges, since a line's name is wide; the lot's middle stands in until there's a room.
 */
function houseCenter(state: RunState): { x: number; y: number } {
  const lot = state.house.lot;
  const rooms = state.house.pieces.filter((p) => CONTENT.pieces[p.defId].category === 'indoor');
  if (rooms.length === 0) return { x: lot.width / 2, y: Math.max(2, lot.height / 3) };
  const c = centroid(
    [state],
    rooms.map((p) => p.uid),
  );
  return { x: Math.min(lot.width * 0.75, Math.max(lot.width * 0.25, c.x)), y: c.y };
}

/** A checklist line's name, by its id in the client's checklist. */
function specName(clientId: ClientId, id: string): string {
  return CONTENT.clients[clientId].specs.find((s) => s.id === id)?.name ?? id;
}

/** The checklist lines a tally turned on and off (M4a), by index. */
interface SpecFlips {
  met: ReadonlySet<number>;
  lost: ReadonlySet<number>;
}

/**
 * A tally's specMet and specLost events: the rules send them right after it (with its
 * setCompleted ones), before the next tally if the week was completed early.
 */
function specFlips(events: readonly GameEvent[], at: number): SpecFlips {
  const met = new Set<number>();
  const lost = new Set<number>();
  if (at < 0) return { met, lost };
  for (let k = at + 1; k < events.length; k++) {
    const e = events[k]!;
    if (e.t === 'tally') break;
    if (e.t === 'specMet') met.add(e.index);
    else if (e.t === 'specLost') lost.add(e.index);
  }
  return { met, lost };
}

/** The checklist as it stood before a tally: the lines it turned on or off, flipped back. */
function specsBefore(specs: readonly SpecScore[], flips: SpecFlips): readonly SpecScore[] {
  return specs.map((sp, k) =>
    flips.met.has(k) || flips.lost.has(k) ? { id: sp.id, met: !sp.met } : sp,
  );
}

const formatCharm = (hundredths: number) => (hundredths / 100).toFixed(2).replace(/\.?0+$/, '');
/** A number on a popup (§12, Numbers): commas, then a suffix above a million. */
const num = (n: number) => formatNumber(n, true);

/** A run state for the top bar while a tally plays: the week being tallied. */
function weekShown(base: RunState, e: Extract<GameEvent, { t: 'tally' }>): RunState {
  return {
    ...base,
    phase: e.phase,
    slot: e.slot,
    overtimeWeek: e.overtimeWeek,
    week: e.week,
    score: e.scoreBefore,
    budget: e.budgetBefore,
  };
}

/**
 * The top bar's run and score, as a play sets them: not while a newer action waits behind it,
 * since that one's starting state is on show already (onEvents).
 */
function setShownRun(state: RunState | null): void {
  if (waiting === 0) shownRun.value = state;
}
function setShownScore(score: number | null): void {
  if (waiting === 0) shownScore.value = score;
}

/**
 * Whether an action's events have beats to play. Free actions with little to animate don't. A
 * change order's answer does (M4b): its stamp holds the shop back until it lands.
 */
function animates(events: readonly GameEvent[]): boolean {
  return events.some(
    (e) =>
      e.t === 'tally' ||
      e.t === 'placed' ||
      e.t === 'demolished' ||
      e.t === 'installed' ||
      e.t === 'renovated' ||
      e.t === 'moved' ||
      e.t === 'findClaimed' ||
      e.t === 'toolUsed' ||
      e.t === 'changeOrderAnswered',
  );
}

/**
 * The run as the top bar and the checklist show it, with a restriction broken (M4b): the
 * checklist's row flips as the ✕ lands on the piece, not when the whole week has played.
 */
function withBroken(s: RunState, id: ChangeOrderId, uid: number): RunState {
  return {
    ...s,
    changeOrders: s.changeOrders.map((r) =>
      r.id === id && r.answer === 'accepted' && r.result === undefined && r.brokenBy === undefined
        ? { ...r, brokenBy: uid }
        : r,
    ),
  };
}

/** How a change order ended, after its name on the board: "Working from home: missed". */
const RESULT_WORD: Readonly<Record<ChangeOrderResult, string>> = {
  met: 'met',
  missed: 'missed',
  kept: 'kept',
  broken: 'broken',
  ended: 'over',
};

/** A played week's tally view before its first step: the checklist as it was last week. */
function tallyStart(e: Extract<GameEvent, { t: 'tally' }>, flips: SpecFlips): TallyView {
  return {
    stage: 'pieces',
    sparkles: [],
    points: 0,
    mult: 100,
    total: null,
    activeUid: null,
    pace: e.pace,
    big: false,
    fastForward: false,
    weekTotal: e.tally.total,
    pieces: e.tally.pieces,
    specs: specsBefore(e.tally.specs, flips),
    specAt: -1,
    specBonus: e.tally.specBonus,
  };
}

/**
 * What an animated action shows as it starts: the state before it in the top bar, and the week
 * it tallies for the glow and the corner digits, through the placement's beat too (the rules
 * have already moved on a week).
 */
function showStart(events: readonly GameEvent[], before: RunState): void {
  const at = events.findIndex((e) => e.t === 'tally');
  const week = events[at];
  const answered = events.find((e) => e.t === 'changeOrderAnswered');
  batch(() => {
    busy.value = true;
    shownScore.value = before.score;
    shownRun.value = before;
    if (week?.t === 'tally' && !week.fastForward) {
      tallyView.value = tallyStart(week, specFlips(events, at));
    }
    // M4b: a change order's sheet stays up, answered, for its stamp. Set at once, so the sheet
    // never unmounts between the answer and the stamp (and plays its arrival again).
    if (answered?.t === 'changeOrderAnswered' && !orderStamp.value) {
      orderStamp.value = stampOf(answered, before);
    }
  });
}

/** The sheet as it was answered, and the answer, for its stamp (M4b). */
function stampOf(
  e: Extract<GameEvent, { t: 'changeOrderAnswered' }>,
  before: RunState,
): OrderStamp | null {
  const view = rules.changeOrderOffer(before);
  if (!view) return null;
  return {
    id: nextId++,
    view,
    clientId: before.setup.clientId,
    forced: !!before.offers?.changeOrder?.forced,
    answer: e.kind === 'phase' ? 'noted' : e.accepted ? 'accepted' : 'declined',
  };
}

/** A fast-forwarded week (D-040): no placement, just a quick count and the drain. */
async function playFastForward(
  e: Extract<GameEvent, { t: 'tally' }>,
  base: RunState,
): Promise<void> {
  setShownRun(weekShown(base, e));
  closing = false;
  const t = e.tally;
  tallyView.value = {
    stage: 'total',
    sparkles: t.xMults,
    points: t.points,
    mult: t.mult,
    total: t.total,
    activeUid: null,
    pace: e.pace,
    big: false,
    fastForward: true,
    weekTotal: t.total,
    pieces: t.pieces,
    specs: t.specs,
    specAt: t.specs.length,
    specBonus: t.specBonus,
  };
  if (!skipping) {
    const lot = base.house.lot;
    popup(
      lot.width / 2,
      Math.max(2, lot.height / 3),
      `Week ${e.slot} · +${num(t.total)}`,
      'note',
      FEEL.fastForward.weekMs,
    );
    audio.play('coin', { rate: 1.2 });
  }
  await wait(FEEL.fastForward.weekMs * 0.5);
  const from = e.scoreBefore;
  const to = e.score;
  await wait(FEEL.fastForward.weekMs * 0.5, (f) => {
    setShownScore(Math.round(from + (to - from) * f));
  });
  setShownScore(to);
}

/**
 * The held lines' chimes, in semitones above the chime's G: C major pentatonic from G (G A C D
 * E G), to match the ladder (audio.ts). From the top step on, they hold.
 */
const CHIME_STEPS = [0, 2, 5, 7, 9, 12] as const;

/**
 * The checklist's beats in a played week (M4a), after the sets: each line held adds its Charm,
 * in checklist order, as its row lights up with a chime that climbs. A line the week turned on
 * pops with a ★ and its name on the board; one it turned off shakes with a ✕ and adds nothing.
 */
async function playChecklist(
  t: Tally,
  view: TallyView,
  flips: SpecFlips,
  after: RunState,
  clientId: ClientId,
): Promise<void> {
  const c = FEEL.checklist;
  const home = houseCenter(after);
  // Each line turned on or off gets its own row on the board, in the tally's order, so two in a
  // week don't print over each other: a later one lands below, as the earlier one rises. The
  // rows are centred on the house and kept on the board (the street row is its last).
  const span = Math.max(0, flips.met.size + flips.lost.size - 1) * c.flipRows;
  const firstRow = Math.max(2, Math.min(home.y - span / 2, after.house.lot.height - span));
  let flipped = 0;
  let chimes = 0;
  for (const [k, sp] of t.specs.entries()) {
    const kind: CheckFlash['kind'] | null = flips.met.has(k)
      ? 'met'
      : flips.lost.has(k)
        ? 'lost'
        : sp.met
          ? 'held'
          : null;
    view.specAt = k;
    if (!kind) continue;
    view.stage = 'specs';
    // A line turned on or off flips now; one held stays as it was.
    view.specs = view.specs.map((s, j) => (j === k ? sp : s));
    if (sp.met) view.mult += t.specBonus;
    tallyView.value = { ...view };
    const stepMs = kind === 'held' ? c.stepMs : c.flipMs;
    const y = kind === 'held' ? home.y : firstRow + flipped++ * c.flipRows;
    if (!skipping) {
      flashLine(k, kind, stepMs);
      if (sp.met) {
        const semitones = CHIME_STEPS[Math.min(chimes++, CHIME_STEPS.length - 1)]!;
        audio.play('chime', {
          rate: 2 ** (semitones / 12),
          gain: kind === 'met' ? 1 : c.chimeGain,
        });
      }
      const name = specName(clientId, sp.id);
      if (kind === 'met') {
        popup(home.x, y - 0.6, `★ ${name}!`, 'spec', stepMs);
        popup(
          home.x,
          y + 0.2,
          `+${formatCharm(t.specBonus)} ${SCORE_LABELS.mult}`,
          'mult',
          stepMs / 2,
        );
        audio.play('sparkle', { delay: 0.06, gain: 0.5 });
        shake(FEEL.shake.triggerPx);
      } else if (kind === 'lost') {
        // Its row shakes in the checklist; the board stays still.
        popup(home.x, y, `✕ ${name}`, 'lost', stepMs);
        audio.play('fail', { rate: 1.45, gain: 0.5 });
      }
    }
    await wait(stepMs);
  }
  view.specAt = t.specs.length;
}

/** A played week's tally: pieces, sets, the checklist, the multiply moment, and the drain. */
async function playTally(
  e: Extract<GameEvent, { t: 'tally' }>,
  base: RunState,
  after: RunState,
  newSets: ReadonlySet<string>,
  flips: SpecFlips,
): Promise<void> {
  setShownRun(weekShown(base, e));
  closing = false;
  const t = e.tally;
  const view = tallyStart(e, flips);
  tallyView.value = { ...view };
  let step = 0;
  for (const piece of t.pieces) {
    if (piece.earned <= 0) continue;
    view.points += piece.earned;
    view.activeUid = piece.uid;
    tallyView.value = { ...view };
    if (!skipping) {
      const c = pieceCenter([after, base], piece.uid);
      popup(c.x, c.y, `+${num(piece.earned)}`, 'points', FEEL.tally.stepMs);
      // Crown Jewel's top earner: a Comfort bonus, so it reads in Comfort's color (D-019).
      if (t.best?.uid === piece.uid)
        popup(c.x, c.y - 0.7, '★ Top earner', 'points', FEEL.tally.stepMs);
      audio.ladder(step);
      if (motion()) fxHooks.wobble(piece.uid);
      shake(FEEL.shake.triggerPx);
    }
    step++;
    await wait(FEEL.tally.stepMs);
  }
  view.activeUid = null;

  for (const set of t.sets) {
    view.stage = 'sets';
    const name = CONTENT.sets[set.set].name;
    highlighted.value = set.members;
    const c = centroid([after, base], set.members);
    view.points += set.points;
    tallyView.value = { ...view };
    if (!skipping) {
      popup(c.x, c.y - 0.6, newSets.has(set.key) ? `${name}!` : name, 'set', FEEL.tally.setStepMs);
      popup(c.x, c.y + 0.2, `+${num(set.points)}`, 'points', FEEL.tally.setStepMs / 2);
      audio.ladder(step);
      set.members.forEach((u) => motion() && fxHooks.wobble(u));
      shake(FEEL.shake.setPx);
    }
    step++;
    await wait(FEEL.tally.setStepMs / 2);
    view.mult += set.mult;
    tallyView.value = { ...view };
    if (!skipping) {
      popup(
        c.x,
        c.y + 0.6,
        `+${formatCharm(set.mult)} ${SCORE_LABELS.mult}`,
        'mult',
        FEEL.tally.setStepMs / 2,
      );
      audio.play('chime');
    }
    await wait(FEEL.tally.setStepMs / 2);
  }
  highlighted.value = [];

  await playChecklist(t, view, flips, after, base.setup.clientId);

  // +Mult from blueprints (It's a House) and this week's tools.
  const lot = after.house.lot;
  for (const m of t.multTerms) {
    view.stage = 'sets';
    view.mult += m.add;
    tallyView.value = { ...view };
    if (!skipping) {
      popup(
        lot.width / 2,
        Math.max(2, lot.height / 3),
        `${m.label}: +${formatCharm(m.add)} ${SCORE_LABELS.mult}`,
        'mult',
        FEEL.tally.setStepMs,
      );
      audio.play('chime', { rate: 1.1 });
    }
    await wait(FEEL.tally.setStepMs / 2);
  }

  // ×Mult (D-056): each source lands as its own gold Sparkle stamp, in the fixed order.
  for (const x of t.xMults) {
    view.stage = 'sparkle';
    view.mult = x.after;
    view.sparkles = [...view.sparkles, x];
    tallyView.value = { ...view };
    if (!skipping) {
      const where =
        x.source.kind === 'fixture'
          ? pieceCenter([after, base], x.source.uid)
          : { x: lot.width / 2, y: Math.max(2, lot.height / 3) };
      popup(where.x, where.y, `${x.label} ×${formatCharm(x.times)}`, 'sparkle', FEEL.sparkleStepMs);
      audio.play('stamp');
      audio.play('sparkle', { delay: 0.08 });
      if (x.source.kind === 'fixture' && motion()) fxHooks.wobble(x.source.uid);
      shake(FEEL.shake.setPx);
    }
    await wait(FEEL.sparkleStepMs);
  }
  view.mult = t.mult;

  // The multiply moment. From here on the beats play at the chosen speed, not accelerated.
  closing = true;
  view.stage = 'multiply';
  tallyView.value = { ...view };
  await wait(FEEL.tally.multiplyPauseMs);
  view.stage = 'total';
  view.total = t.total;
  view.big = t.total > 0 && t.total >= FEEL.bigWeekPace * e.pace;
  tallyView.value = { ...view };
  if (!skipping) {
    audio.play('total');
    if (view.big) {
      celebration.value = { id: nextId++, total: t.total, pace: e.pace };
      audio.play('big-week', { delay: 0.12 });
      shake(FEEL.shake.bigWeekPx);
    }
    if (t.budget > 0) {
      const lot = after.house.lot;
      popup(
        lot.width / 2,
        Math.max(2, lot.height / 3) + 1,
        `+${num(t.budget)} budget`,
        'note',
        FEEL.tally.totalHoldMs,
      );
    }
  }
  await wait(FEEL.tally.totalHoldMs * (view.big ? FEEL.tally.bigHoldScale : 1));

  // Drain into the run total, coin by coin.
  const from = e.scoreBefore;
  const to = e.score;
  const most = FEEL.tally.drainCoins;
  let coins = 0;
  await wait(FEEL.tally.drainMs, (f) => {
    setShownScore(Math.round(from + (to - from) * f));
    const due = Math.min(most, Math.ceil(f * Math.min(most, to - from)));
    while (!skipping && coins < due) audio.play('coin', { rate: 1 + coins++ * 0.06 });
  });
  setShownScore(to);
}

/** Shows a banner for `ms` of real time, and returns that time. */
function showBanner(
  title: string,
  detail: string,
  tone: Banner['tone'],
  ms: number = FEEL.bannerMs,
): number {
  banner.value = { id: nextId++, title, detail, tone };
  const id = banner.value.id;
  setTimeout(() => {
    if (banner.value?.id === id) banner.value = null;
  }, ms);
  return ms;
}

/** The milestone's banner and chord. Returns how long the banner stays up. */
function milestoneBanner(e: Extract<GameEvent, { t: 'milestone' }>, ended: boolean): number {
  const phases = CONTENT.balance.phases;
  const next = phases[e.phase + 1]?.name;
  const onTo = ended || !next ? 'It’s a house.' : `On to ${next}.`;
  const reward = e.reward.budget > 0 ? ` +${e.reward.budget} budget.` : '';
  let ms: number;
  switch (e.result) {
    case 'onTime':
      ms = showBanner(`${e.name} complete!`, `${onTo}${reward}`, 'good');
      break;
    case 'early': {
      const weeks = `${e.weeksSaved} ${e.weeksSaved === 1 ? 'week' : 'weeks'}`;
      ms = showBanner(
        `${e.name} complete, ${weeks} early!`,
        `+${formatNumber(e.reward.score)} ${SCORE_LABELS.total} early bonus, and +${e.reward.budget} budget. ${onTo}`,
        'good',
        FEEL.bannerMs * FEEL.longBannerScale,
      );
      break;
    }
    case 'overtime':
      ms = showBanner(`${e.name} complete, in overtime`, `${onTo}${reward}`, 'good');
      break;
    case 'failed':
      ms = showBanner(
        `${e.name} missed`,
        `${formatNumber(e.score)} of ${formatNumber(e.target)} ${SCORE_LABELS.total}. The client walks the site…`,
        'bad',
      );
      break;
  }
  audio.play(e.result === 'failed' ? 'fail' : 'milestone');
  shake(FEEL.shake.milestonePx);
  return ms;
}

async function play(events: GameEvent[], before: RunState, after: RunState): Promise<void> {
  const gen = generation;
  const animated = animates(events);
  if (animated) waiting--;
  // With a newer action already waiting, the player has moved on: this one hurries, as one
  // interrupted mid-tally does.
  skipping = animated && waiting > 0;
  closing = false;
  accelerator = 0;
  busy.value = true;
  try {
    const newSets = new Set(events.flatMap((e) => (e.t === 'setCompleted' ? [e.key] : [])));
    const ended = events.some((e) => e.t === 'runEnded');
    // The shop or a change order (M4b) opens a sheet over the board as this finishes.
    const toSheet = events.some((e) => e.t === 'shopOpened' || e.t === 'changeOrderOffered');
    // Free actions with little to animate (the shop's, the auto-complete toggle) finish at
    // once, with their shop beats: sounds and a note; the shop screen and the budget count do
    // the rest. So does a household member's arrival: its banner doesn't hold the week up.
    if (!animated) {
      for (const e of events) {
        shopBeat(e);
        sheetBeat(e, after);
      }
      for (const e of events) {
        if (e.t === 'handDrawn' && e.reroll && !skipping) audio.play('rotate', { rate: 0.7 });
      }
      return;
    }
    if (waiting === 0) showStart(events, before);
    let base = before;
    // M4b: the run as the milestone leaves it, before the change orders resolving after it
    // pay: each one's reward counts into the budget, and its checklist row turns to how it
    // went, on its own beat. `pending` holds their places in changeOrders, in their beats' order.
    let afterMilestone: RunState | null = null;
    let pending: number[] = [];
    let paid = 0;
    let resolved = 0;
    /** The milestone's banner, when a sheet opens after it: the sheet takes over from it. */
    let sheetBanner: number | undefined;
    for (const [i, e] of events.entries()) {
      if (gen !== generation) return;
      switch (e.t) {
        case 'placed': {
          justPlaced.value = { uid: e.uid, id: nextId++ };
          const yard = CONTENT.pieces[e.defId].category !== 'indoor';
          audio.play(yard ? 'place-yard' : 'place-room');
          if (e.free && !skipping) {
            const c = pieceCenter([after, base], e.uid);
            popup(c.x, c.y - 0.6, 'Weekend Crew!', 'note', FEEL.installMs);
          }
          await wait(FEEL.placeMs);
          break;
        }
        case 'moved': {
          justPlaced.value = { uid: e.uid, id: nextId++ };
          if (!skipping) {
            const c = pieceCenter([after, base], e.uid);
            popup(c.x, c.y, 'Moved!', 'note', FEEL.installMs);
            audio.play('place-room', { rate: 0.9 });
          }
          await wait(FEEL.placeMs);
          break;
        }
        case 'toolUsed': {
          if (!skipping) {
            const lot = after.house.lot;
            const def = CONTENT.tools[e.tool];
            if (def.use.kind !== 'move') {
              popup(
                lot.width / 2,
                Math.max(2, lot.height / 3),
                `${def.name}!`,
                'note',
                FEEL.installMs,
              );
            }
            audio.play('chime', { rate: 1.15 });
          }
          await wait(FEEL.installMs * 0.5);
          break;
        }
        case 'findClaimed': {
          if (!skipping) {
            const name = CONTENT.features[e.feature].name;
            const got = e.reward.tool
              ? e.soldTool !== undefined
                ? `${CONTENT.tools[e.reward.tool].name}, sold for ${num(e.soldTool)}`
                : CONTENT.tools[e.reward.tool].name
              : e.reward.budget
                ? `+${num(e.reward.budget)} budget`
                : '';
            // Not a score layer, so it reads neutral: Sparkle's gold is for ×Mult (D-019).
            popup(e.x + 0.5, Math.max(1.5, e.y), `${name}: ${got}!`, 'note', FEEL.sparkleStepMs);
            audio.play('sparkle');
            audio.play('coin', { delay: 0.1 });
          }
          await wait(FEEL.sparkleStepMs * 0.6);
          break;
        }
        case 'installed': {
          const c = pieceCenter([after, base], e.uid);
          if (!skipping) {
            const name = CONTENT.fixtures[e.fixture].name;
            const was = e.replaced ? ` (was ${CONTENT.fixtures[e.replaced].name})` : '';
            popup(c.x, c.y, `${name}!${was}`, 'note', FEEL.installMs);
            audio.play('place-room', { rate: 1.4 });
            audio.play('chime', { delay: 0.06, rate: 1.3 });
            if (motion()) fxHooks.wobble(e.uid);
          }
          await wait(FEEL.installMs * 0.6);
          break;
        }
        case 'renovated': {
          // The room's level badge pops in on its own (PieceView); this is the room's beat.
          if (!skipping) {
            const c = pieceCenter([after, base], e.uid);
            if (e.free) popup(c.x, c.y - 0.7, 'Weekend Crew!', 'note', FEEL.renovateMs);
            popup(c.x, c.y, `Renovated · level ${e.level}`, 'points', FEEL.renovateMs);
            // A knock-knock of building work, then Comfort's plink a fifth up.
            audio.play('place-room', { rate: 1.1 });
            audio.play('place-room', { rate: 1.3, delay: 0.1 });
            audio.play('plink', { rate: 1.5, delay: 0.2 });
            if (motion()) fxHooks.wobble(e.uid);
            shake(FEEL.shake.triggerPx);
            justRenovated.value = { uid: e.uid, id: nextId++ };
          }
          await wait(FEEL.renovateMs);
          break;
        }
        case 'demolished': {
          const c = e.cells;
          const x = c.reduce((a, q) => a + q.x + 0.5, 0) / Math.max(1, c.length);
          const y = c.reduce((a, q) => a + q.y + 0.5, 0) / Math.max(1, c.length);
          if (!skipping) {
            popup(x, Math.max(1.5, y), 'Demolished', 'note', FEEL.demolishMs);
            audio.play('place-room', { rate: 0.6 });
            shake(FEEL.shake.setPx);
          }
          await wait(FEEL.demolishMs * 0.5);
          break;
        }
        case 'transformed': {
          const c = e.cells[0];
          if (c && !skipping) {
            const into = 'feature' in e.into ? 'a Tree' : `a ${CONTENT.pieces[e.into.piece].name}`;
            popup(
              c.x + 0.5,
              Math.max(1.5, c.y),
              `Grew into ${into}!`,
              'note',
              FEEL.tally.setStepMs,
            );
            audio.play('chime', { rate: 1.2 });
          }
          break;
        }
        case 'tally':
          if (e.fastForward) await playFastForward(e, base);
          else await playTally(e, base, after, newSets, specFlips(events, i));
          base = { ...base, score: e.score, budget: e.budget };
          tallyView.value = null;
          break;
        case 'targetReached':
          if (!skipping && gen === generation) {
            flash.value = { id: nextId++, text: 'Target reached!', tone: 'good' };
            audio.play('target');
            // Crossed in the phase's last week: the ding lands before the milestone's chord.
            if (events[i + 1]?.t === 'milestone') {
              closing = true;
              await wait(FEEL.targetDingMs);
            }
          }
          break;
        case 'overtimeUsed':
          showBanner(
            'Overtime!',
            `${formatNumber(e.score)} of ${formatNumber(e.target)} ${SCORE_LABELS.total}. One more week to reach it` +
              ` (${e.overtimeLeft} overtime ${e.overtimeLeft === 1 ? 'week' : 'weeks'} left after this).`,
            'bad',
            FEEL.bannerMs * FEEL.longBannerScale,
          );
          audio.play('fail', { rate: 1.3 });
          break;
        case 'milestone': {
          tallyView.value = null;
          setShownScore(null);
          // The top bar moves on to the next phase. The change orders resolving next (M4b) pay
          // on beats of their own, so their budget isn't in it yet, and the checklist shows
          // them as they were until then.
          const owed = events
            .slice(i + 1)
            .reduce((n, x) => n + (x.t === 'changeOrderResolved' ? (x.reward?.budget ?? 0) : 0), 0);
          pending = after.changeOrders.flatMap((r, k) => {
            const was = base.changeOrders[k];
            return was && was.result === undefined && r.result !== undefined ? [k] : [];
          });
          afterMilestone =
            pending.length > 0
              ? {
                  ...after,
                  budget: after.budget - owed,
                  changeOrders: after.changeOrders.map((r, k) =>
                    pending.includes(k) ? base.changeOrders[k]! : r,
                  ),
                }
              : null;
          setShownRun(afterMilestone);
          const shown = milestoneBanner(e, ended);
          const id = banner.value?.id;
          if (toSheet) sheetBanner = id;
          const gone = () => banner.value?.id !== id;
          closing = true;
          // The shop (or a change order) opens over the board, banner and all, so it waits the
          // banner out in real time, as the banner stays up, at any tally speed: holding hurries
          // it, a click skips.
          if (toSheet) await wait(shown, undefined, gone, realSpeed);
          else await wait(FEEL.milestoneHoldMs, undefined, gone);
          break;
        }
        case 'changeOrderBroken': {
          // M4b: the restriction pays nothing now. A ✕ on the piece that broke it, and the
          // checklist's row flips with it.
          base = withBroken(base, e.id, e.uid);
          setShownRun(base);
          if (!skipping) {
            const c = pieceCenter([after, base], e.uid);
            const name = CONTENT.changeOrders[e.id].name;
            popup(c.x, c.y - 0.7, `✕ ${name}`, 'lost', FEEL.changeOrder.brokenMs);
            audio.play('fail', { rate: 1.45, gain: 0.5 });
            if (motion()) fxHooks.wobble(e.uid);
          }
          await wait(FEEL.changeOrder.brokenMs);
          break;
        }
        case 'changeOrderResolved': {
          // M4b, after the milestone: a request met or a restriction kept pays, and its reward
          // counts into the budget; one missed or broken, or a phase effect ending, is a quiet
          // line. Two at once stack, as the checklist's flips do. Its checklist row turns to
          // how it went with it, and stays so even when this beat is skipped (Checklist.tsx).
          const name = CONTENT.changeOrders[e.id].name;
          const good = e.result === 'met' || e.result === 'kept';
          if (afterMilestone) {
            paid += e.reward?.budget ?? 0;
            const k = pending.shift();
            const shown: RunState = afterMilestone;
            if (k !== undefined) {
              afterMilestone = {
                ...shown,
                changeOrders: shown.changeOrders.map((r, j) =>
                  j === k ? after.changeOrders[k]! : r,
                ),
              };
            }
            setShownRun({ ...afterMilestone, budget: afterMilestone.budget + paid });
          }
          if (!skipping) {
            const home = houseCenter(after);
            const y = home.y + resolved++ * FEEL.checklist.flipRows;
            const text = good
              ? `✓ ${name}: ${e.reward ? rewardText(CONTENT, e.reward) : RESULT_WORD[e.result]}`
              : e.result === 'ended'
                ? `${name} is ${RESULT_WORD.ended}`
                : `✕ ${name}: ${RESULT_WORD[e.result]}`;
            popup(home.x, y, text, good ? 'order' : 'quiet', FEEL.changeOrder.resolvedMs);
            if (good) audio.play('chime', { rate: 1.25 });
            else if (e.result !== 'ended') audio.play('rotate', { rate: 0.6, gain: 0.6 });
          }
          await wait(good ? FEEL.changeOrder.resolvedMs : FEEL.changeOrder.resolvedMs / 2);
          break;
        }
        case 'changeOrderAnswered': {
          // M4b: the answer is stamped on the sheet as it goes (ChangeOrderScreen.tsx; the stamp
          // went on show with the action, in showStart), in real time: holding hurries it, a
          // click skips it. The shop waits for it.
          const stamp = orderStamp.value;
          if (stamp && !skipping) {
            // The stamp's thump, then a bright plink for a yes, or the paper swished aside.
            audio.play('place-room', { rate: 1.35 });
            if (stamp.answer === 'declined') audio.play('rotate', { rate: 0.7, delay: 0.08 });
            else
              audio.play('plink', { rate: stamp.answer === 'accepted' ? 1.5 : 1.2, delay: 0.07 });
            await wait(FEEL.changeOrder.stampMs, undefined, undefined, realSpeed);
          }
          orderStamp.value = null;
          break;
        }
        case 'handDrawn':
          if (e.free && !skipping) {
            flash.value = { id: nextId++, text: 'Nothing fit: free redraw', tone: 'note' };
          }
          break;
        default:
          break;
      }
    }
    // The shop appears as this finishes, so its beats (its chime, a Rare's sparkle) play now,
    // not at the click, before the tally and the milestone could give a Rare away. So does a
    // change order's sheet, with its own.
    if (gen === generation) {
      // The sheet takes over from the milestone's banner. A hold or a skip cut its wait short,
      // so it goes now (if it's still that one) rather than show through a change order's
      // backdrop, and hold the first-time hints back, until its own time is up.
      if (sheetBanner !== undefined && banner.value?.id === sheetBanner) banner.value = null;
      for (const e of events) {
        shopBeat(e);
        sheetBeat(e, after);
      }
    }
  } finally {
    batch(() => {
      tallyView.value = null;
      highlighted.value = [];
      orderStamp.value = null;
      // A newer action waiting behind this one keeps its starting state on show.
      if (waiting === 0) {
        shownScore.value = null;
        shownRun.value = null;
        busy.value = false;
      }
    });
    skipping = false;
    closing = false;
    // A held Space or right button re-arms this on its next event; don't let a lost key-up
    // leave every later tally on fast-forward.
    holding = false;
  }
}

/**
 * The shop's beats (§12, Shop and crates): Rare goods arrive with a shimmer and a sound. They
 * play as the shop appears or acts, so a skipped tally still has them.
 */
function shopBeat(e: GameEvent): void {
  switch (e.t) {
    case 'shopOpened':
    case 'shopRefreshed': {
      const rare = e.offers.some(
        (o) =>
          (o.kind === 'blueprint' && CONTENT.blueprints[o.id].rarity === 'rare') ||
          (o.kind === 'fixture' && CONTENT.fixtures[o.id].rarity === 'rare'),
      );
      audio.play('chime', { rate: e.t === 'shopOpened' ? 0.9 : 1.1 });
      if (rare) audio.play('sparkle', { delay: 0.25 });
      break;
    }
    case 'bought':
      // Strikes too. The ×Mult bell ('stamp') is for ×Mult only (§12, Sound; D-058).
      audio.play('buy');
      break;
    case 'picked':
      if (e.option === null) audio.play('rotate', { rate: 0.8 });
      break;
    case 'sold':
      audio.play('rotate', { rate: 1.2 });
      break;
    case 'shopClosed':
      if (e.skipReward > 0) {
        flash.value = {
          id: nextId++,
          text: `+${e.skipReward} budget for saving up`,
          tone: 'note',
        };
      }
      break;
    default:
      break;
  }
}

/**
 * M4b's beats as a screen changes: a change order's sheet arriving (its paper flourish is the
 * sheet's own animation; this is its sound), and a household member moving in. They play as
 * the sheet or the week appears, like the shop's.
 */
function sheetBeat(e: GameEvent, after: RunState): void {
  switch (e.t) {
    case 'changeOrderOffered':
      // A swish as the paper slides in, and a tap as it lands.
      audio.play('rotate', { rate: 0.55 });
      audio.play('rotate', { rate: 0.8, delay: 0.09 });
      audio.play('select', { rate: 0.7, delay: (FEEL.changeOrder.inMs * 0.7) / 1000 });
      break;
    case 'arrived':
      arrivalBeat(e, after);
      break;
    default:
      break;
  }
}

/**
 * A household member arrives (D-099): a banner over the board, a doorbell, and their cards
 * popping into the reserve's extra slots (Inventory.tsx). It doesn't hold the week up: the
 * banner goes on its own (or with a click on it), and the first-time hints wait for it.
 */
function arrivalBeat(e: Extract<GameEvent, { t: 'arrived' }>, after: RunState): void {
  const a = arrivalOf(after.setup.clientId, e.arrival);
  if (!a) return;
  const pop = { arrival: e.arrival, id: nextId++ };
  justArrived.value = pop;
  setTimeout(() => {
    if (justArrived.value?.id === pop.id) justArrived.value = null;
  }, FEEL.arrival.landDelayMs + FEEL.arrival.popMs);
  const have = isPlural(a) ? 'have' : 'has';
  const are = e.cards.length === 1 ? 'is' : 'are';
  showBanner(
    `${a.name} ${have} arrived!`,
    `${cardsPhrase(e.cards)} ${are} waiting in your reserve.`,
    'good',
  );
  // A doorbell's ding-dong (a major third down), then the cards land with a shimmer.
  const f = FEEL.arrival;
  audio.play('chime', { rate: 1.12 });
  audio.play('chime', { rate: 0.89, delay: f.dongMs / 1000 });
  audio.play('sparkle', { delay: f.landDelayMs / 1000, gain: 0.6 });
}

onEvents((events, before, after) => {
  // A new action while a tally plays finishes that one at once, then plays its own.
  if (busy.value) skipping = true;
  chain = chain.then(() => play(events, before, after)).catch((e) => console.error(e));
  if (animates(events)) {
    // Its starting state goes on show now, not when play() starts a microtask later: the
    // render this action queued comes first, and would show the state after it (the budget
    // counting to its new value and back, the shop sheet mounting for a moment).
    waiting++;
    showStart(events, before);
  }
});

onRunReset(() => {
  generation++;
  skipping = true;
  batch(() => {
    popups.value = [];
    checkFlashes.value = [];
    banner.value = null;
    celebration.value = null;
    flash.value = null;
    justPlaced.value = null;
    justRenovated.value = null;
    orderStamp.value = null;
    justArrived.value = null;
  });
});
