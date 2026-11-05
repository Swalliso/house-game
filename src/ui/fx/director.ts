// The tally director (implementation-plan.md §12, The weekly tally; D-059). The rules have
// already moved on when an action returns, so this only plays the events back: the placed
// piece settles, pieces pop one at a time in placement order with a rising pitch ladder,
// sets add their Comfort and then their Charm, Comfort × Charm collapse into the week's Wow,
// and the week drains into the run total. Animation speed never affects the game.
//
// Speed: the chosen tally speed, plus Balatro-style auto-acceleration, plus fast-forward
// while Space or the right mouse button is held. A click skips to the result.

import { batch, signal } from '@preact/signals';
import { CONTENT, type GameEvent, type RunState } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { settings } from '../settings.ts';
import { onEvents, onRunReset } from '../store.ts';
import { FEEL } from './feel.ts';

export type PopupKind = 'points' | 'mult' | 'set' | 'total' | 'note';

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
  stage: 'pieces' | 'sets' | 'multiply' | 'total';
  points: number;
  mult: number;
  total: number | null;
  activeUid: number | null;
  pace: number;
  big: boolean;
}

export interface Banner {
  id: number;
  title: string;
  detail: string;
  tone: 'good' | 'bad';
}

export const busy = signal(false);
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
function pieceCenter(state: RunState, uid: number): { x: number; y: number } {
  const piece = state.house.pieces.find((p) => p.uid === uid);
  if (!piece) return { x: 0, y: 2 };
  const def = CONTENT.pieces[piece.defId];
  const rows = piece.rot % 2 === 0 ? def.shape.length : def.shape[0]!.length;
  const cols = piece.rot % 2 === 0 ? def.shape[0]!.length : def.shape.length;
  return { x: piece.x + cols / 2, y: Math.max(2, piece.y + rows / 2) };
}

function centroid(state: RunState, uids: readonly number[]): { x: number; y: number } {
  const cs = uids.map((u) => pieceCenter(state, u));
  return {
    x: cs.reduce((a, c) => a + c.x, 0) / Math.max(1, cs.length),
    y: cs.reduce((a, c) => a + c.y, 0) / Math.max(1, cs.length),
  };
}

const formatCharm = (hundredths: number) => (hundredths / 100).toFixed(2).replace(/\.?0+$/, '');

async function play(events: GameEvent[], before: RunState, after: RunState): Promise<void> {
  const gen = generation;
  skipping = false;
  accelerator = 0;
  busy.value = true;
  try {
    const placed = events.find((e) => e.t === 'placed');
    const tally = events.find((e) => e.t === 'tally');
    const newSets = new Set(events.flatMap((e) => (e.t === 'setCompleted' ? [e.key] : [])));
    shownScore.value = before.score;
    shownRun.value = before;

    if (placed && placed.t === 'placed') {
      justPlaced.value = { uid: placed.uid, id: nextId++ };
      const yard = CONTENT.pieces[placed.defId].category !== 'indoor';
      audio.play(yard ? 'place-yard' : 'place-room');
      await wait(FEEL.placeMs);
    }

    if (tally && tally.t === 'tally') {
      const t = tally.tally;
      const view: TallyView = {
        stage: 'pieces',
        points: 0,
        mult: 100,
        total: null,
        activeUid: null,
        pace: tally.pace,
        big: false,
      };
      tallyView.value = { ...view };
      let step = 0;
      for (const piece of t.pieces) {
        if (piece.earned <= 0) continue;
        view.points += piece.earned;
        view.activeUid = piece.uid;
        tallyView.value = { ...view };
        if (!skipping) {
          const c = pieceCenter(after, piece.uid);
          popup(c.x, c.y, `+${piece.earned}`, 'points', FEEL.tally.stepMs);
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
        const c = centroid(after, set.members);
        view.points += set.points;
        tallyView.value = { ...view };
        if (!skipping) {
          popup(
            c.x,
            c.y - 0.6,
            newSets.has(set.key) ? `${name}!` : name,
            'set',
            FEEL.tally.setStepMs,
          );
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
            `+${formatCharm(set.mult)} Charm`,
            'mult',
            FEEL.tally.setStepMs / 2,
          );
          audio.play('chime');
        }
        await wait(FEEL.tally.setStepMs / 2);
      }
      highlighted.value = [];

      // The multiply moment.
      view.stage = 'multiply';
      tallyView.value = { ...view };
      await wait(FEEL.tally.multiplyPauseMs);
      view.stage = 'total';
      view.total = t.total;
      view.big = t.total > 0 && t.total >= FEEL.bigWeekPace * tally.pace;
      tallyView.value = { ...view };
      if (!skipping) {
        audio.play('total');
        if (view.big) {
          celebration.value = { id: nextId++, total: t.total, pace: tally.pace };
          audio.play('big-week', { delay: 0.12 });
          shake(FEEL.shake.bigWeekPx);
        }
      }
      await wait(view.big ? FEEL.tally.totalHoldMs * 1.6 : FEEL.tally.totalHoldMs);

      // Drain into the run total, coin by coin.
      const from = tally.scoreBefore;
      const to = tally.score;
      let coins = 0;
      await wait(FEEL.tally.drainMs, (f) => {
        shownScore.value = Math.round(from + (to - from) * f);
        const due = Math.min(6, Math.ceil(f * Math.min(6, to - from)));
        while (!skipping && coins < due) audio.play('coin', { rate: 1 + coins++ * 0.06 });
      });
      shownScore.value = to;
      const reached = events.find((e) => e.t === 'targetReached');
      if (reached && !skipping && gen === generation) {
        flash.value = { id: nextId++, text: 'Target reached!' };
        audio.play('target');
      }
    }

    tallyView.value = null;
    shownScore.value = null;
    shownRun.value = null;

    const milestone = events.find((e) => e.t === 'milestone');
    if (milestone && milestone.t === 'milestone' && gen === generation) {
      const ended = events.find((e) => e.t === 'runEnded');
      const good = milestone.result === 'onTime';
      banner.value = {
        id: nextId++,
        title: good ? `${milestone.name} complete!` : `${milestone.name} missed`,
        detail: good
          ? ended
            ? 'The house is framed. That’s the slice!'
            : `On to ${after.phase < CONTENT.balance.phases.length ? CONTENT.balance.phases[after.phase]!.name : 'the next phase'}.`
          : `${milestone.score.toLocaleString('en-US')} of ${milestone.target.toLocaleString('en-US')} Wow. The client walks the site…`,
        tone: good ? 'good' : 'bad',
      };
      audio.play(good ? 'milestone' : 'fail');
      shake(FEEL.shake.milestonePx);
      const id = banner.value.id;
      setTimeout(() => {
        if (banner.value?.id === id) banner.value = null;
      }, FEEL.bannerMs);
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
  });
});
