// The tally director (implementation-plan.md §12, The weekly tally; D-059). The rules have
// already moved on when an action returns, so this only plays the events back, in order: the
// placed piece settles, pieces pop one at a time in placement order with a rising pitch
// ladder, sets add their Comfort and then their Charm, Comfort × Charm collapse into the
// week's Wow, and the week drains into the run total. Fast-forwarded weeks (early completion)
// count quickly; demolitions, transforms, overtime, and each milestone result get their own
// beat. Animation speed never affects the game.
//
// Speed: the chosen tally speed, plus Balatro-style auto-acceleration, plus fast-forward
// while Space or the right mouse button is held. A click skips to the result.

import { batch, signal } from '@preact/signals';
import {
  CONTENT,
  SCORE_LABELS,
  type GameEvent,
  type RunState,
  type XMultTerm,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { settings } from '../settings.ts';
import { onEvents, onRunReset } from '../store.ts';
import { formatNumber } from '../format.ts';
import { FEEL } from './feel.ts';

export type PopupKind = 'points' | 'mult' | 'set' | 'total' | 'note' | 'sparkle';

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
  stage: 'pieces' | 'sets' | 'sparkle' | 'multiply' | 'total';
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
export const banner = signal<Banner | null>(null);
/** Bumped for each big week, so the celebration can restart. */
export const celebration = signal<{ id: number; total: number; pace: number } | null>(null);
export const flash = signal<{ id: number; text: string } | null>(null);
/**
 * The run as the tally started, while it plays: the top bar keeps showing that phase and week
 * until the milestone lands, since the rules have already moved on.
 */
export const shownRun = signal<RunState | null>(null);
/**
 * One-shot effects (celebration, flash, justPlaced) carry an id: a consumer plays each id
 * once, so remounting the game screen (Menu, then Continue) doesn't replay them.
 */
export const played = { celebration: 0, flash: 0, settle: 0 };
/** The piece that was just placed, for its settle animation. */
export const justPlaced = signal<{ uid: number; id: number } | null>(null);

/** The board registers these, so the director can wobble pieces and shake the screen. */
export const fxHooks: {
  wobble: (uid: number) => void;
  shake: (px: number) => void;
} = { wobble: () => {}, shake: () => {} };

let nextId = 1;
let skipping = false;
let holding = false;
let accelerator = 0;
let chain: Promise<void> = Promise.resolve();
/** Bumped when the run is replaced, so a tally still playing for the old run goes quiet. */
let generation = 0;

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
  const speed = settings.value.tallySpeed;
  const auto = speed + Math.min(FEEL.tally.accelCap, Math.max(0, accelerator - 1));
  return holding ? Math.max(auto, FEEL.tally.holdSpeed) : auto;
}

/**
 * Waits `ms` of tally time, sped up by the speed setting, the accelerator, and holding. Time is
 * real elapsed time, so a slow or throttled frame rate doesn't slow the tally down. `onProgress`
 * gets the fraction done on each frame, for tweens.
 */
function wait(ms: number, onProgress?: (fraction: number) => void): Promise<void> {
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
      accelerator += (FEEL.tally.accelPerSecond * settings.value.tallySpeed * dt) / 1000;
      remaining -= dt * effectiveSpeed();
      const done = remaining <= 0 || skipping;
      onProgress?.(done ? 1 : 1 - remaining / ms);
      if (done) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function popup(x: number, y: number, text: string, kind: PopupKind, stepMs: number): void {
  if (skipping) return;
  const ms = Math.max(350, (stepMs - FEEL.tally.popupShortenMs) / effectiveSpeed() + 450);
  // Keep popups on the board: the top row's would rise off its edge.
  const p: Popup = { id: nextId++, x, y, text, kind, ms };
  popups.value = [...popups.value, p];
  setTimeout(() => {
    popups.value = popups.value.filter((q) => q.id !== p.id);
  }, ms);
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
  const def = CONTENT.pieces[piece.defId];
  const rows = piece.rot % 2 === 0 ? def.shape.length : def.shape[0]!.length;
  const cols = piece.rot % 2 === 0 ? def.shape[0]!.length : def.shape.length;
  return { x: piece.x + cols / 2, y: Math.max(2, piece.y + rows / 2) };
}

function centroid(states: readonly RunState[], uids: readonly number[]): { x: number; y: number } {
  const cs = uids.map((u) => pieceCenter(states, u));
  return {
    x: cs.reduce((a, c) => a + c.x, 0) / Math.max(1, cs.length),
    y: cs.reduce((a, c) => a + c.y, 0) / Math.max(1, cs.length),
  };
}

const formatCharm = (hundredths: number) => (hundredths / 100).toFixed(2).replace(/\.?0+$/, '');

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

/** A fast-forwarded week (D-040): no placement, just a quick count and the drain. */
async function playFastForward(
  e: Extract<GameEvent, { t: 'tally' }>,
  base: RunState,
): Promise<void> {
  shownRun.value = weekShown(base, e);
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
  };
  if (!skipping) {
    const lot = base.house.lot;
    popup(
      lot.width / 2,
      Math.max(2, lot.height / 3),
      `Week ${e.slot} · +${formatNumber(t.total)}`,
      'note',
      FEEL.fastForward.weekMs,
    );
    audio.play('coin', { rate: 1.2 });
  }
  await wait(FEEL.fastForward.weekMs * 0.5);
  const from = e.scoreBefore;
  const to = e.score;
  await wait(FEEL.fastForward.weekMs * 0.5, (f) => {
    shownScore.value = Math.round(from + (to - from) * f);
  });
  shownScore.value = to;
}

/** A played week's tally: pieces, sets, the multiply moment, and the drain. */
async function playTally(
  e: Extract<GameEvent, { t: 'tally' }>,
  base: RunState,
  after: RunState,
  newSets: ReadonlySet<string>,
): Promise<void> {
  shownRun.value = weekShown(base, e);
  const t = e.tally;
  const view: TallyView = {
    stage: 'pieces',
    sparkles: [],
    points: 0,
    mult: 100,
    total: null,
    activeUid: null,
    pace: e.pace,
    big: false,
    fastForward: false,
  };
  tallyView.value = { ...view };
  let step = 0;
  for (const piece of t.pieces) {
    if (piece.earned <= 0) continue;
    view.points += piece.earned;
    view.activeUid = piece.uid;
    tallyView.value = { ...view };
    if (!skipping) {
      const c = pieceCenter([after, base], piece.uid);
      popup(c.x, c.y, `+${piece.earned}`, 'points', FEEL.tally.stepMs);
      // Crown Jewel's top earner.
      if (t.best?.uid === piece.uid)
        popup(c.x, c.y - 0.7, '★ Top earner', 'sparkle', FEEL.tally.stepMs);
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
      popup(c.x, c.y + 0.2, `+${set.points}`, 'points', FEEL.tally.setStepMs / 2);
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

  // The multiply moment.
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
        `+${t.budget} budget`,
        'note',
        FEEL.tally.totalHoldMs,
      );
    }
  }
  await wait(view.big ? FEEL.tally.totalHoldMs * 1.6 : FEEL.tally.totalHoldMs);

  // Drain into the run total, coin by coin.
  const from = e.scoreBefore;
  const to = e.score;
  let coins = 0;
  await wait(FEEL.tally.drainMs, (f) => {
    shownScore.value = Math.round(from + (to - from) * f);
    const due = Math.min(6, Math.ceil(f * Math.min(6, to - from)));
    while (!skipping && coins < due) audio.play('coin', { rate: 1 + coins++ * 0.06 });
  });
  shownScore.value = to;
}

function showBanner(
  title: string,
  detail: string,
  tone: Banner['tone'],
  ms: number = FEEL.bannerMs,
): void {
  banner.value = { id: nextId++, title, detail, tone };
  const id = banner.value.id;
  setTimeout(() => {
    if (banner.value?.id === id) banner.value = null;
  }, ms);
}

function milestoneBanner(e: Extract<GameEvent, { t: 'milestone' }>, ended: boolean): void {
  const phases = CONTENT.balance.phases;
  const next = phases[e.phase + 1]?.name;
  const onTo = ended || !next ? 'It’s a house.' : `On to ${next}.`;
  const reward = e.reward.budget > 0 ? ` +${e.reward.budget} budget.` : '';
  switch (e.result) {
    case 'onTime':
      showBanner(`${e.name} complete!`, `${onTo}${reward}`, 'good');
      break;
    case 'early': {
      const weeks = `${e.weeksSaved} ${e.weeksSaved === 1 ? 'week' : 'weeks'}`;
      showBanner(
        `${e.name} complete, ${weeks} early!`,
        `+${formatNumber(e.reward.score)} ${SCORE_LABELS.total} early bonus, and +${e.reward.budget} budget. ${onTo}`,
        'good',
        FEEL.bannerMs * 1.3,
      );
      break;
    }
    case 'overtime':
      showBanner(`${e.name} complete, in overtime`, `${onTo}${reward}`, 'good');
      break;
    case 'failed':
      showBanner(
        `${e.name} missed`,
        `${formatNumber(e.score)} of ${formatNumber(e.target)} ${SCORE_LABELS.total}. The client walks the site…`,
        'bad',
      );
      break;
  }
  audio.play(e.result === 'failed' ? 'fail' : 'milestone');
  shake(FEEL.shake.milestonePx);
}

async function play(events: GameEvent[], before: RunState, after: RunState): Promise<void> {
  const gen = generation;
  skipping = false;
  accelerator = 0;
  busy.value = true;
  try {
    const newSets = new Set(events.flatMap((e) => (e.t === 'setCompleted' ? [e.key] : [])));
    const ended = events.some((e) => e.t === 'runEnded');
    // Shop events: sounds and a note; the shop screen and the budget count do the rest.
    for (const e of events) shopBeat(e);
    // Free actions with little to animate (the auto-complete toggle, the shop, a free
    // install) finish at once.
    if (
      !events.some(
        (e) =>
          e.t === 'tally' ||
          e.t === 'placed' ||
          e.t === 'demolished' ||
          e.t === 'installed' ||
          e.t === 'moved' ||
          e.t === 'findClaimed' ||
          e.t === 'toolUsed',
      )
    ) {
      for (const e of events) {
        if (e.t === 'handDrawn' && e.reroll && !skipping) audio.play('rotate', { rate: 0.7 });
      }
      return;
    }
    shownScore.value = before.score;
    shownRun.value = before;
    let base = before;
    for (const e of events) {
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
                ? `${CONTENT.tools[e.reward.tool].name}, sold for ${e.soldTool}`
                : CONTENT.tools[e.reward.tool].name
              : e.reward.budget
                ? `+${e.reward.budget} budget`
                : '';
            popup(e.x + 0.5, Math.max(1.5, e.y), `${name}: ${got}!`, 'sparkle', FEEL.sparkleStepMs);
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
          else await playTally(e, base, after, newSets);
          base = { ...base, score: e.score, budget: e.budget };
          tallyView.value = null;
          break;
        case 'targetReached':
          if (!skipping && gen === generation) {
            flash.value = { id: nextId++, text: 'Target reached!' };
            audio.play('target');
          }
          break;
        case 'overtimeUsed':
          showBanner(
            'Overtime!',
            `${formatNumber(e.score)} of ${formatNumber(e.target)} ${SCORE_LABELS.total}. One more week to reach it` +
              ` (${e.overtimeLeft} overtime ${e.overtimeLeft === 1 ? 'week' : 'weeks'} left after this).`,
            'bad',
            FEEL.bannerMs * 1.3,
          );
          audio.play('fail', { rate: 1.3 });
          break;
        case 'milestone':
          tallyView.value = null;
          shownScore.value = null;
          shownRun.value = null;
          milestoneBanner(e, ended);
          await wait(FEEL.milestoneHoldMs);
          break;
        case 'handDrawn':
          if (e.free && !skipping) flash.value = { id: nextId++, text: 'Nothing fit: free redraw' };
          break;
        default:
          break;
      }
    }
  } finally {
    batch(() => {
      tallyView.value = null;
      shownScore.value = null;
      shownRun.value = null;
      highlighted.value = [];
      busy.value = false;
    });
    skipping = false;
    // A held Space or right button re-arms this on its next event; don't let a lost key-up
    // leave every later tally on fast-forward.
    holding = false;
  }
}

/** The shop's beats (§12, Shop and crates): Rare goods arrive with a shimmer and a sound. */
function shopBeat(e: GameEvent): void {
  if (skipping) return;
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
      audio.play('stamp', { rate: 1.2 });
      break;
    case 'picked':
      if (e.option === null) audio.play('rotate', { rate: 0.8 });
      break;
    case 'sold':
      audio.play('rotate', { rate: 1.2 });
      break;
    case 'shopClosed':
      if (e.skipReward > 0)
        flash.value = { id: nextId++, text: `+${e.skipReward} budget for saving up` };
      break;
    default:
      break;
  }
}

onEvents((events, before, after) => {
  // A new action while a tally plays finishes that one at once, then plays its own.
  if (busy.value) skipping = true;
  chain = chain.then(() => play(events, before, after)).catch((e) => console.error(e));
});

onRunReset(() => {
  generation++;
  skipping = true;
  batch(() => {
    popups.value = [];
    banner.value = null;
    celebration.value = null;
    flash.value = null;
    justPlaced.value = null;
  });
});
