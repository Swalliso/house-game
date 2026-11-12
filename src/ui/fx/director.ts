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
// A transform in a phase's first week comes with leaving the shop, not a tally, and gets its beat
// there too. Animation speed never affects the game.
//
// Speed: the chosen tally speed, plus Balatro-style auto-acceleration during the steps, plus
// fast-forward while Space or the right mouse button is held. A click skips to the result.

import { batch, signal } from '@preact/signals';
import {
  article,
  CONTENT,
  definite,
  rewardText,
  rules,
  SCORE_LABELS,
  type ArrivalId,
  type ChangeOrderId,
  type ChangeOrderOfferView,
  type ChangeOrderResult,
  type ClientId,
  type GameEvent,
  type PieceId,
  type PieceScore,
  type RunState,
  type SetScore,
  type SpecScore,
  type Tally,
  type XMultTerm,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { arrivalOf, cardsPhrase, isPlural } from '../hud/household.ts';
import { settings } from '../settings.ts';
import { onEvents, onRunReset } from '../store.ts';
import { formatNumber } from '../format.ts';
import { chainOrder } from './chain.ts';
import { FEEL } from './feel.ts';
import { tallySpeed } from './juice.ts';
import {
  bestWeek,
  markTierSeen,
  pileCount,
  pilePieces,
  recordWeek,
  tierOf,
  tierSeen,
  type Tier,
} from './ladder.ts';
import {
  frontDoor,
  isHouseRule,
  markToppedOut,
  rhythmPaid,
  targetCrossed,
  TOPPED_OUT_RULE,
  toppedOutBefore,
} from './moments.ts';
import { burst, burstAt, clearParticles, type BurstName, type BurstOptions } from './particles.ts';

/**
 * `spec` names a client's wish the week turned on, in Charm's color, and `rule` a house rule
 * (blue, ✓, D-125); `lost` one it turned off, orange with a ✕ (all in checklist.css). `order` is
 * a change order paying (blue, ✓), and `quiet` one that didn't, or a phase effect ending
 * (change-order.css). `door` is the doorbell at the front door (fx.css, D-126).
 */
export type PopupKind =
  | 'points'
  | 'mult'
  | 'set'
  | 'spec'
  | 'rule'
  | 'lost'
  | 'total'
  | 'note'
  | 'sparkle'
  | 'order'
  | 'quiet'
  | 'door';

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
  /** The week's tier on the celebration ladder (D-124), once its total lands; null before. */
  tier: Tier | null;
  /** A week skipped by early completion. */
  fastForward: boolean;
  /** The week's total from the event, so the glow stays lit through the count before `total`. */
  weekTotal: number;
  /** What each piece earned in the week being tallied, for the board's digits. */
  pieces: readonly PieceScore[];
  /** The week's sets, in the tally's order (the score panel's folded row counts them). */
  sets: readonly SetScore[];
  /** How many of `sets` the tally has counted: 0 before its first set's beat. */
  setAt: number;
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
  /**
   * A milestone met (gold), or one missed or in overtime (orange). A household member's arrival
   * has its own card (ArrivalCard.tsx, D-126), so it never reads as a milestone.
   */
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
/** A piece flying to the pile: where it starts, in viewport px (null when it's off the board). */
export interface PileBlock {
  uid: number;
  defId: PieceId;
  at: { x: number; y: number } | null;
}

/**
 * Bumped for each week from Good up (D-124), so the celebration can restart: the score panel's
 * pile reads it, and M5b's music swell and ducking can follow its tier.
 */
export const celebration = signal<{
  id: number;
  tier: Tier;
  total: number;
  pace: number;
  pile: readonly PileBlock[];
} | null>(null);
/** A Great or Huge week's wash over the screen (a warm tint; Huge adds a white flash). */
export const wash = signal<{ id: number; tier: Tier } | null>(null);
/** The milestone moment's crossing: the top bar's flag pops (D-124). */
export const targetHit = signal<{ id: number } | null>(null);
/** "Topped out!" over the house, the first week Under one roof holds (D-127). */
export const toppedOut = signal<{ id: number } | null>(null);
/**
 * D-094's option 1: while the tally plays a chain, the arc from the piece that boosts to the one
 * it sets going, in lot cells, for that piece's step. The board's chain layer draws it.
 */
export const chainArc = signal<{
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  ms: number;
} | null>(null);
/**
 * A household member's arrival (D-126): their card slides in over the board, in place of a
 * banner, so it never reads as a milestone.
 */
export interface ArrivalCard {
  id: number;
  arrival: ArrivalId;
  clientId: ClientId;
  title: string;
  detail: string;
  cards: readonly PieceId[];
}
export const arrivalCard = signal<ArrivalCard | null>(null);
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
export const played = {
  celebration: 0,
  flash: 0,
  settle: 0,
  levelPop: 0,
  wash: 0,
  arrival: 0,
};
/** The piece that was just placed, for its settle animation. */
export const justPlaced = signal<{ uid: number; id: number } | null>(null);
/** The room that was just renovated, for its level badge's pop. */
export const justRenovated = signal<{ uid: number; id: number } | null>(null);

/**
 * The change order picked, stamped on its card as the sheet goes (M4b, D-144): the sheet as it
 * was answered, since the rules have already moved on to the shop (or back to the week).
 */
export interface OrderStamp {
  id: number;
  /** The offer as it was, its ?debug flag included. */
  offer: ChangeOrderOfferView;
  clientId: ClientId;
  /** Which of the offer's orders was picked. */
  picked: number;
}
export const orderStamp = signal<OrderStamp | null>(null);
/** A household member's cards, just in the reserve (M4b): the reserve pops them in. */
export const justArrived = signal<{ arrival: ArrivalId; id: number } | null>(null);

/**
 * The board registers these, so the director can wobble pieces, shake the screen, lean the
 * board in for a Huge week, and place bursts at lot cells (in viewport px; null off the board).
 */
export const fxHooks: {
  wobble: (uid: number) => void;
  shake: (px: number) => void;
  zoom: () => void;
  toScreen: (x: number, y: number) => { x: number; y: number } | null;
} = { wobble: () => {}, shake: () => {}, zoom: () => {}, toScreen: () => null };

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

/** Until when a skip leaves the milestone's banner up (FEEL.milestoneBannerMinMs). */
let bannerKeptUntil = -Infinity;

export function skip(): void {
  if (busy.value) skipping = true;
  dismissBanner();
}

/** A click on the banner, or a skip: it goes, unless a hurried milestone's is still new. */
export function dismissBanner(): void {
  if (performance.now() >= bannerKeptUntil) banner.value = null;
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

/** A burst at a spot on the lot (cells), where the board shows it. */
function boardBurst(name: BurstName, at: { x: number; y: number }, opts?: BurstOptions): void {
  if (skipping) return;
  const p = fxHooks.toScreen(at.x, at.y);
  if (p) burst(name, p, opts);
}

/** Runs `fn` once the next frame has painted (a banner, a stamp, a row just rendered). */
function afterPaint(fn: () => void, delayMs = 0): void {
  const gen = generation;
  setTimeout(
    () =>
      requestAnimationFrame(() => {
        if (gen === generation) fn();
      }),
    delayMs,
  );
}

/**
 * Waits `ms` of real time whatever the speed, and a click doesn't cut it short: a tier's first
 * appearance (§12). A new run, or the ?debug panel's instant tally, still ends it.
 */
function waitFirst(ms: number): Promise<void> {
  const gen = generation;
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      if (now - start >= ms || gen !== generation || instantTally.value) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Waits out a banner in real time (holding hurries it) until it goes, even while the tally is
 * being skipped: the milestone's banner after a hurried week. A new run, or the ?debug panel's
 * instant tally, still ends it.
 */
function waitBanner(ms: number, gone: () => boolean): Promise<void> {
  const gen = generation;
  return new Promise((resolve) => {
    let remaining = ms;
    let last = performance.now();
    const tick = (now: number) => {
      remaining -= Math.min(1000, now - last) * realSpeed();
      last = now;
      if (remaining <= 0 || gone() || gen !== generation || instantTally.value) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * The middle of a piece in lot coordinates, for popups. Kept at least 2 rows down, so popups
 * near the top edge rise into view, and stacked popups keep their spacing.
 */
function pieceCenter(states: readonly RunState[], uid: number): { x: number; y: number } {
  const m = pieceMiddle(states, uid);
  return m ? { x: m.x, y: Math.max(2, m.y) } : { x: 0, y: 2 };
}

/** The middle of a piece's footprint in lot coordinates, or null if it's in neither state. */
function pieceMiddle(states: readonly RunState[], uid: number): { x: number; y: number } | null {
  // A Sapling that matured at the start of the next week is gone from the state after the
  // action, but its last tally still scores it: find it in the state before.
  let piece: RunState['house']['pieces'][number] | undefined;
  for (const state of states) {
    piece = state.house.pieces.find((p) => p.uid === uid);
    if (piece) break;
  }
  if (!piece) return null;
  const shape = piece.shape ?? CONTENT.pieces[piece.defId].shape;
  const rows = piece.rot % 2 === 0 ? shape.length : shape[0]!.length;
  const cols = piece.rot % 2 === 0 ? shape[0]!.length : shape.length;
  return { x: piece.x + cols / 2, y: piece.y + rows / 2 };
}

/** The arc into a boosted piece's step from the piece that set it going (D-094), or none. */
function chainArcTo(
  by: number | null,
  uid: number,
  states: readonly RunState[],
  ms: number,
): (typeof chainArc)['value'] {
  if (by === null) return null;
  const from = pieceMiddle(states, by);
  const to = pieceMiddle(states, uid);
  return from && to ? { id: nextId++, from, to, ms } : null;
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
 * change order's pick does (M4b): its stamp holds the shop back until it lands.
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
      r.id === id && r.result === undefined && r.brokenBy === undefined
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
    tier: null,
    fastForward: false,
    weekTotal: e.tally.total,
    pieces: e.tally.pieces,
    sets: e.tally.sets,
    setAt: 0,
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

/** The sheet as it was answered, and the order picked, for its stamp (M4b, D-144). */
function stampOf(
  e: Extract<GameEvent, { t: 'changeOrderAnswered' }>,
  before: RunState,
): OrderStamp | null {
  const offer = rules.changeOrderOffer(before);
  if (!offer) return null;
  return { id: nextId++, offer, clientId: before.setup.clientId, picked: e.i };
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
    tier: null,
    fastForward: true,
    weekTotal: t.total,
    pieces: t.pieces,
    sets: t.sets,
    setAt: t.sets.length,
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
      // A house rule (D-101) and a client's wish read differently (D-125): a rule met is a
      // check and a crisp two notes, a wish met a ★, Charm's hearts and a warm chime.
      const rule = isHouseRule(clientId, k);
      if (kind === 'met') {
        popup(home.x, y - 0.6, rule ? `✓ ${name}` : `★ ${name}!`, rule ? 'rule' : 'spec', stepMs);
        popup(
          home.x,
          y + 0.2,
          `+${formatCharm(t.specBonus)} ${SCORE_LABELS.mult}`,
          'mult',
          stepMs / 2,
        );
        audio.play(rule ? 'rule-met' : 'wish-met', { delay: 0.06 });
        checkBurst(sp.id, rule ? 'sparkles' : 'hearts');
        shake(FEEL.shake.triggerPx);
        if (sp.id === TOPPED_OUT_RULE && !toppedOutBefore(after.setup)) {
          markToppedOut(after.setup);
          topOut();
        }
      } else if (kind === 'lost') {
        // Its row shakes in the checklist; the board stays still. A house rule lost knocks
        // some dust off its row.
        popup(home.x, y, `✕ ${name}`, 'lost', stepMs);
        if (rule) {
          audio.play('rule-lost', { gain: 0.8 });
          checkBurst(sp.id, 'dust');
        } else audio.play('fail', { rate: 1.45, gain: 0.5 });
      }
    }
    await wait(stepMs);
  }
  view.specAt = t.specs.length;
}

/**
 * A burst from a checklist line's row once the checklist has scrolled to it (or from the
 * folded row that holds it): the row a line lights is where the eye goes.
 */
function checkBurst(id: string, name: BurstName): void {
  afterPaint(() => {
    const list = document.querySelector('.checklist');
    const row =
      list?.querySelector(`[data-row="${id}"]`) ??
      list?.querySelector('[data-fold="rules"]') ??
      null;
    const r = row?.getBoundingClientRect();
    const box = list?.getBoundingClientRect();
    // Not while the row is scrolled out of the checklist's view.
    if (!r || !box || r.bottom < box.top || r.top > box.bottom) return;
    burstAt(name, row, { fx: 0.15, area: { w: 30, h: 6 } });
  }, 60);
}

/**
 * "Topped out!" (D-127): the first week Under one roof holds, the house is topped out as a
 * builder's would be. A plaque over the house with a sprig on top, stars, and a cheer, in real
 * time; the tally goes on under it.
 */
function topOut(): void {
  toppedOut.value = { id: nextId++ };
  const id = toppedOut.value.id;
  setTimeout(() => {
    if (toppedOut.value?.id === id) toppedOut.value = null;
  }, FEEL.moments.toppedOutMs);
  audio.play('topped-out', { delay: 0.15 });
  // Up from the plaque over the top of the house, clear of the line's own popup over it.
  afterPaint(() => burstAt('stars', document.querySelector('.topped-out'), { fy: 0, scale: 1.4 }));
}

/** A played week's tally: pieces, sets, the checklist, the multiply moment, and the drain. */
async function playTally(
  e: Extract<GameEvent, { t: 'tally' }>,
  base: RunState,
  after: RunState,
  newSets: ReadonlySet<string>,
  flips: SpecFlips,
  crossing: number | null,
): Promise<void> {
  setShownRun(weekShown(base, e));
  closing = false;
  const t = e.tally;
  // The week's tier (§12, D-124), against the best week before this one; then the week joins
  // the browser's record.
  const tier = tierOf(t.total, e.pace, bestWeek());
  recordWeek(t.total);
  const view = tallyStart(e, flips);
  tallyView.value = { ...view };
  // D-094's option 1: the pieces play depth first along what boosts what (fx/chain.ts), each
  // boosted piece right after the piece that sets it going, with an arc between them.
  const order = chainOrder(t.pieces);
  const last = order.reduce((k, s, i) => (s.piece.earned > 0 ? i : k), -1);
  let step = 0;
  for (const [i, { piece, by }] of order.entries()) {
    if (piece.earned <= 0) continue;
    view.points += piece.earned;
    view.activeUid = piece.uid;
    tallyView.value = { ...view };
    // A Huge week's last trigger plays in slow motion; a Rhythm payout gets a longer beat.
    const rhythm = rhythmPaid(piece);
    const slow = tier === 'huge' && i === last;
    const stepMs =
      FEEL.tally.stepMs * (slow ? FEEL.ladder.slowMo : rhythm > 0 ? FEEL.moments.rhythm : 1);
    if (!skipping) {
      const c = pieceCenter([after, base], piece.uid);
      chainArc.value = chainArcTo(by, piece.uid, [after, base], stepMs);
      popup(c.x, c.y, `+${num(piece.earned)}`, 'points', stepMs);
      // Crown Jewel's top earner: a Comfort bonus, so it reads in Comfort's color (D-019).
      const top = t.best?.uid === piece.uid;
      if (top) popup(c.x, c.y - 0.7, '★ Top earner', 'points', stepMs);
      if (rhythm > 0) rhythmBeat(piece, c, stepMs, top ? 1.4 : 0.7);
      audio.ladder(step);
      if (motion()) fxHooks.wobble(piece.uid);
      shake(slow ? FEEL.shake.setPx : FEEL.shake.triggerPx);
    }
    step++;
    await wait(stepMs);
  }
  view.activeUid = null;
  chainArc.value = null;

  for (const set of t.sets) {
    view.stage = 'sets';
    const name = CONTENT.sets[set.set].name;
    // A set completing for the first time is its own moment (D-125): a longer beat, its chord,
    // and a ring of Charm-colored bits.
    const fresh = newSets.has(set.key);
    const setMs = FEEL.tally.setStepMs * (fresh ? FEEL.moments.setComplete : 1);
    highlighted.value = set.members;
    const c = centroid([after, base], set.members);
    view.points += set.points;
    view.setAt++;
    tallyView.value = { ...view };
    if (!skipping) {
      popup(c.x, c.y - 0.6, fresh ? `${name} complete!` : name, 'set', setMs);
      popup(c.x, c.y + 0.2, `+${num(set.points)}`, 'points', setMs / 2);
      audio.ladder(step);
      if (fresh) {
        audio.play('set-complete', { delay: 0.05 });
        boardBurst('set', c);
      }
      set.members.forEach((u) => motion() && fxHooks.wobble(u));
      shake(fresh ? FEEL.shake.milestonePx : FEEL.shake.setPx);
    }
    step++;
    await wait(setMs / 2);
    view.mult += set.mult;
    tallyView.value = { ...view };
    if (!skipping) {
      popup(c.x, c.y + 0.6, `+${formatCharm(set.mult)} ${SCORE_LABELS.mult}`, 'mult', setMs / 2);
      audio.play('chime');
    }
    await wait(setMs / 2);
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
  view.tier = tier;
  tallyView.value = { ...view };
  // A tier's first appearance in this browser plays in full, skipped or not (§12); after that a
  // click skips it like any beat.
  const first = tier !== 'normal' && !tierSeen(tier) && !instantTally.value;
  if (first) markTierSeen(tier);
  if (!skipping || first) {
    audio.play('total');
    celebrate(tier, t, e.pace, [after, base]);
    if (t.budget > 0 && !skipping) {
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
  if (first) await waitFirst(FEEL.ladder.firstMs[tier]);
  else await wait(FEEL.tally.totalHoldMs + FEEL.ladder.holdMs[tier]);

  await drain(e.scoreBefore, e.score, crossing);
}

/**
 * The count-up into the run total, coin by coin. When it crosses the phase's target, it's the
 * milestone moment (§12, from Peggle): the count slows for the last stretch before the target
 * with a drumroll, and the target's sting and flash land as it crosses, not after.
 */
async function drain(from: number, to: number, crossing: number | null): Promise<void> {
  const most = FEEL.tally.drainCoins;
  let coins = 0;
  const count = (a: number, b: number, ms: number, ticks: boolean) =>
    wait(ms, (f) => {
      setShownScore(Math.round(a + (b - a) * f));
      if (!ticks) return;
      const due = Math.min(most, Math.ceil(f * Math.min(most, b - a)));
      while (!skipping && coins < due) audio.play('coin', { rate: 1 + coins++ * 0.06 });
    });
  const m = FEEL.milestoneMoment;
  if (crossing === null || crossing <= from || crossing > to || skipping) {
    await count(from, to, FEEL.tally.drainMs, true);
    setShownScore(to);
    return;
  }
  // The share of the count before the target, then its last stretch, slowed.
  const span = Math.max(1, to - from);
  const lead = crossing - (crossing - from) * m.leadShare;
  const plain = FEEL.tally.drainMs * ((lead - from) / span);
  const slowed = Math.min(
    m.maxMs - FEEL.tally.drainMs,
    (FEEL.tally.drainMs * ((crossing - lead) / span)) / m.slow + 600,
  );
  await count(from, lead, plain, true);
  if (!skipping) audio.play('drumroll');
  await count(lead, crossing, slowed, false);
  targetMoment();
  await count(crossing, to, FEEL.tally.drainMs * ((to - crossing) / span), false);
  setShownScore(to);
}

/** The target's sting as the count crosses it: the flash, a burst from the meter's flag. */
let targetPlayed = false;
function targetMoment(): void {
  if (skipping) return;
  targetPlayed = true;
  flash.value = { id: nextId++, text: 'Target reached!', tone: 'good' };
  audio.play('target');
  shake(FEEL.shake.milestonePx);
  const hit = { id: nextId++ };
  targetHit.value = hit;
  setTimeout(() => {
    if (targetHit.value === hit) targetHit.value = null;
  }, 600);
  burstAt('stars', document.querySelector('.tb-flag'), { angle: 90, spread: 70 });
}

/**
 * A Rhythm payout (D-125): the line's own words over the piece ("Every 3rd week!"), a ring
 * spreading from it, and a knock of its own under the ladder's note.
 */
function rhythmBeat(
  piece: PieceScore,
  c: { x: number; y: number },
  stepMs: number,
  above: number,
): void {
  const line = piece.lines.find((l) => l.op === 'add' && /^Every \d/.test(l.label));
  popup(c.x, c.y - above, `${line?.label.replace(/ \(.*$/, '') ?? 'Payday'}!`, 'set', stepMs);
  audio.play('rhythm');
  boardBurst('ring', c);
  boardBurst('ring', c, { delayMs: 140 });
}

/**
 * A week's tier (§12, The celebration ladder; D-124), as its total lands:
 * - Good: sparkles round the score panel and a short chime.
 * - Great: its own sting, a fountain of confetti and coins, and a warm wash over the screen.
 * - Huge: the full fanfare, the fountain, the board leaning in, a soft white flash (with
 *   Flashing on), and the pile built into a tower.
 * From Good up, the week's best pieces fly into the pile by the score panel. M5b's music swell
 * and ducking can follow the `celebration` signal's tier.
 */
function celebrate(tier: Tier, t: Tally, pace: number, states: readonly RunState[]): void {
  if (tier === 'normal') return;
  const pile = pilePieces(t.pieces, pileCount(tier)).map((p) => {
    const c = pieceCenter(states, p.uid);
    return { uid: p.uid, defId: p.defId, at: fxHooks.toScreen(c.x, c.y) };
  });
  celebration.value = { id: nextId++, tier, total: t.total, pace, pile };
  const panel = document.querySelector('.score-panel .plaque-wow');
  if (tier === 'good') {
    audio.play('tier-good', { delay: 0.1 });
    burstAt('sparkles', panel, { area: { w: 120, h: 30 } });
    shake(FEEL.shake.setPx);
    return;
  }
  wash.value = { id: nextId++, tier };
  burstAt('confetti', panel, { scale: tier === 'huge' ? 1.6 : 1 });
  burstAt('coins', panel, { scale: tier === 'huge' ? 1.8 : 1 });
  if (tier === 'great') {
    audio.play('big-week', { delay: 0.12 });
    shake(FEEL.shake.bigWeekPx);
    return;
  }
  audio.play('tier-huge', { delay: 0.12 });
  shake(FEEL.shake.bigWeekPx * 1.5);
  if (motion()) fxHooks.zoom();
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
  // The last milestone's budget has no shop to go to: what's held pays Wow instead (D-145).
  const left = e.reward.leftover;
  const leftover = left
    ? `${left.budget} budget left: +${formatNumber(left.score)} ${SCORE_LABELS.total}.`
    : '';
  const reward = left ? ` ${leftover}` : e.reward.budget > 0 ? ` +${e.reward.budget} budget.` : '';
  let ms: number;
  switch (e.result) {
    case 'onTime':
      ms = showBanner(`${e.name} complete!`, `${onTo}${reward}`, 'good');
      break;
    case 'early': {
      const weeks = `${e.weeksSaved} ${e.weeksSaved === 1 ? 'week' : 'weeks'}`;
      ms = showBanner(
        `${e.name} complete, ${weeks} early!`,
        left
          ? `+${formatNumber(e.reward.score)} ${SCORE_LABELS.total} early bonus. ${leftover} ${onTo}`
          : `+${formatNumber(e.reward.score)} ${SCORE_LABELS.total} early bonus, and +${e.reward.budget} budget. ${onTo}`,
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
  if (e.result !== 'failed') {
    afterPaint(() => burstAt('sparkles', document.querySelector('.banner .banner-ribbon')));
  }
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
  targetPlayed = false;
  // Busy only while something plays (D-154). An action with nothing to animate (leaving the
  // shop, a reroll, a purchase) finishes in this one call, and setting busy for it flicked every
  // reader of busy on and off: the music's scene, and the week's stamp, which a tally takes down.
  if (animated) busy.value = true;
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
        swapBeat(e);
      }
      growBeats(events, after, gen);
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
            // Dug up (D-125): the dirt flies, then what it held pops out, coins or a tool's glint.
            const at = { x: e.x + 0.5, y: e.y + 0.5 };
            audio.play('find');
            boardBurst('dust', at);
            boardBurst(e.reward.tool ? 'glints' : 'coins', at, {
              delayMs: FEEL.moments.findRewardMs,
              scale: e.reward.tool ? 0.8 : 0.6,
            });
            if (e.reward.budget || e.soldTool !== undefined)
              audio.play('coin', { delay: FEEL.moments.findRewardMs / 1000 + 0.1 });
            shake(FEEL.shake.triggerPx);
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
          // The room's level badge pops in on its own (HouseLayers.tsx LevelStars); this is the
          // room's beat.
          if (!skipping) {
            const c = pieceCenter([after, base], e.uid);
            if (e.free) popup(c.x, c.y - 0.7, 'Weekend Crew!', 'note', FEEL.renovateMs);
            popup(c.x, c.y, `Renovated · level ${e.level}`, 'points', FEEL.renovateMs);
            // A knock-knock of building work, then the level-up's three notes (D-125), and
            // stars from the room as its level badge pops.
            audio.play('place-room', { rate: 1.1 });
            audio.play('place-room', { rate: 1.3, delay: 0.1 });
            audio.play('level-up', { delay: 0.2 });
            // Out to the sides and down from under the popup, so they don't cover its words.
            boardBurst(
              'stars',
              { x: c.x, y: c.y + 0.45 },
              { delayMs: 180, count: 5 + e.level * 2, angle: 90, spread: 100 },
            );
            if (motion()) fxHooks.wobble(e.uid);
            shake(FEEL.shake.setPx);
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
        case 'transformed':
          // After the tally, as the next week starts.
          transformBeat(e, after);
          break;
        case 'tally':
          if (e.fastForward) await playFastForward(e, base);
          else
            await playTally(
              e,
              base,
              after,
              newSets,
              specFlips(events, i),
              targetCrossed(events, i),
            );
          base = { ...base, score: e.score, budget: e.budget };
          tallyView.value = null;
          break;
        case 'targetReached':
          if (!skipping && gen === generation) {
            // The count-up's milestone moment has played it already, as it crossed (D-124).
            if (!targetPlayed) {
              flash.value = { id: nextId++, text: 'Target reached!', tone: 'good' };
              audio.play('target');
            }
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
          // A click that hurried this week's tally hurried the tally, not the milestone: its
          // banner still holds, and a click once it has been up a moment takes it down. (A
          // newer action waiting, or the ?debug instant tally, still skips it.)
          const hurried = skipping && waiting === 0 && !instantTally.value;
          if (hurried) bannerKeptUntil = performance.now() + FEEL.milestoneBannerMinMs;
          // The shop (or a change order) opens over the board, banner and all, so it waits the
          // banner out in real time, as the banner stays up, at any tally speed: holding hurries
          // it, a click skips.
          if (hurried) await waitBanner(toSheet ? shown : FEEL.milestoneHoldMs, gone);
          else if (toSheet) await wait(shown, undefined, gone, realSpeed);
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
          // M4b: the pick is stamped on its card as the sheet goes (ChangeOrderScreen.tsx; the
          // stamp went on show with the action, in showStart), in real time: holding hurries it,
          // a click skips it. The shop waits for it.
          const stamp = orderStamp.value;
          if (stamp && !skipping) {
            // The stamp's thunk (D-125), ink spattering where it lands, then a bright plink,
            // and the order passed over swished aside (D-144).
            audio.play('order-stamp');
            afterPaint(
              () => burstAt('ink', document.querySelector('.co-stamp')),
              FEEL.changeOrder.stampInMs,
            );
            audio.play('plink', { rate: 1.5, delay: 0.07 });
            if (stamp.offer.options.length > 1) audio.play('rotate', { rate: 0.7, delay: 0.12 });
            await wait(FEEL.changeOrder.stampMs, undefined, undefined, realSpeed);
          }
          orderStamp.value = null;
          break;
        }
        case 'handDrawn':
          swapBeat(e);
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
 * A draw's swaps (D-121): the cards with no play it swapped out, named in a note over the
 * board. The cards swapped in say so on their chips.
 */
function swapBeat(e: GameEvent): void {
  if (e.t !== 'handDrawn' || !e.swapped?.length || skipping) return;
  const names = e.swapped.map(({ was }) =>
    definite(was.kind === 'fixture' ? CONTENT.fixtures[was.id].name : CONTENT.pieces[was.id].name),
  );
  const list =
    names.length <= 2
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  flash.value = { id: nextId++, text: `Swapped out ${list}: nowhere to go`, tone: 'note' };
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
      // A Rare's own bell (D-125); its card bursts with glints as the sheet lands.
      if (rare) audio.play('rare', { delay: 0.25 });
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
 * A household member arrives (D-103, D-126): the doorbell rings at the front door ("Ding-dong!"
 * and a ring spreading from the doormat), their card slides in over the board with their room's
 * picture (ArrivalCard.tsx), and their cards pop into the reserve's extra slots (Inventory.tsx).
 * It doesn't hold the week up: the card goes on its own (or with a click on it), and the
 * first-time hints wait for it.
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
  const card: ArrivalCard = {
    id: nextId++,
    arrival: e.arrival,
    clientId: after.setup.clientId,
    title: `${a.name} ${have} arrived!`,
    detail: `${cardsPhrase(e.cards)} ${are} waiting in your reserve.`,
    cards: e.cards,
  };
  arrivalCard.value = card;
  setTimeout(() => {
    if (arrivalCard.value?.id === card.id) arrivalCard.value = null;
  }, FEEL.arrival.cardMs);
  // The doorbell's ding-dong, at the front door, then the cards land with a shimmer.
  const f = FEEL.arrival;
  audio.play('doorbell');
  audio.play('sparkle', { delay: f.landDelayMs / 1000, gain: 0.6 });
  const door = frontDoor(after);
  if (door && !skipping) {
    popup(door.x, Math.max(1.5, door.y - 0.6), 'Ding-dong!', 'door', f.cardInMs + f.dongMs * 3);
    afterPaint(() => {
      boardBurst('ring', door);
      boardBurst('ring', door, { delayMs: f.dongMs });
    });
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A piece grows into another at a week's start (the Nursery into a Kids' Room, a Sapling into a
 * Tree): it wobbles, says so on the board, and chimes. The score it changes has no other beat.
 */
function transformBeat(e: Extract<GameEvent, { t: 'transformed' }>, after: RunState): void {
  const cells = e.cells;
  if (skipping || cells.length === 0) return;
  // Over the piece, but kept off the lot's side edges, as the checklist's popups are: the
  // sentence is wide.
  const w = after.house.lot.width;
  const x = cells.reduce((a, c) => a + c.x + 0.5, 0) / cells.length;
  const y = cells.reduce((a, c) => a + c.y + 0.5, 0) / cells.length;
  const from = capitalize(definite(CONTENT.pieces[e.defId].name));
  const into =
    'feature' in e.into ? CONTENT.features[e.into.feature].name : CONTENT.pieces[e.into.piece].name;
  popup(
    Math.min(w * 0.75, Math.max(w * 0.25, x)),
    Math.max(1.5, y),
    `${from} grew into ${article(into)}!`,
    'note',
    FEEL.transform.stepMs,
  );
  audio.play('chime', { rate: 1.2 });
  // A piece that grows into another keeps its place on the board (and its uid); a Sapling's
  // Tree is the lot's.
  if ('piece' in e.into && motion()) fxHooks.wobble(e.uid);
}

/**
 * The transforms an action with no tally brings: leaving the shop starts a phase's first week,
 * and a piece old enough grows then (the Nursery placed the week the twins arrive grows into a
 * Kids' Room as Drywall starts). They play as the board appears, or, when a household member
 * arrives that week too, once their banner's doorbell has rung and their cards have landed, so
 * the two beats don't ring at once.
 */
function growBeats(events: readonly GameEvent[], after: RunState, gen: number): void {
  const grown = events.filter(
    (e): e is Extract<GameEvent, { t: 'transformed' }> => e.t === 'transformed',
  );
  if (grown.length === 0) return;
  if (!events.some((e) => e.t === 'arrived')) {
    for (const e of grown) transformBeat(e, after);
    return;
  }
  setTimeout(() => {
    // Not for a run that's gone, or over a tally that has started since.
    if (gen !== generation || busy.value) return;
    for (const e of grown) transformBeat(e, after);
  }, FEEL.transform.afterArrivalMs);
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
    wash.value = null;
    targetHit.value = null;
    toppedOut.value = null;
    arrivalCard.value = null;
    chainArc.value = null;
  });
  clearParticles();
});
