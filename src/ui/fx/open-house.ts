// A won run's open house (D-175): the street turns out. As the end of the run looks down the
// street (Board.tsx, D-156), the fanfare plays (`run-won`), a crowd sized by the verdict walks in
// along the sidewalk and stops in front of the house, and cars pull up at the kerb (board/crowd.ts
// plans them, board/Crowd.tsx draws them). Once the view has pulled back, confetti bursts at the
// front door and hearts rise over the last tally's best earners. A click, a key or the wheel
// hurries it, as it hurries the look; the bursts still to come are dropped then. The crowd and
// the cars stay where they stopped until the next run.
//
// Only a run won in this browser: the look's own guards (a run that was in progress and isn't
// now, and not a debug run, so a run loaded already over gets none), and the run won. A won run
// whose view shows the street already plays it in place, for as long (Board.tsx), and a win's
// look holds longer (FEEL.openHouse.holdMs). With Reduce motion on there's no look and nothing
// is drawn; the fanfare still plays, as the look would have started. So it does for any win
// whose look isn't coming: it never waits on a look that won't start.

import { effect, signal } from '@preact/signals';
import { CONTENT, placedCells, rules, type GameEvent, type RunState } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { cameraEls, lotSize, streetView } from '../board/camera.ts';
import { crowdPlan, heldSpans, type Crowd } from '../board/crowd.ts';
import { center, occupancy, uidAt } from '../board/geometry.ts';
import { hallLinks, heldSets, houseModel, sunLight } from '../board/house-model.ts';
import { people, waitingBoxes } from '../board/people.ts';
import { CELL } from '../sprites.ts';
import { inProgress, onEvents, onRunReset } from '../store.ts';
import { busy } from './director.ts';
import { FEEL } from './feel.ts';
import { pilePieces } from './ladder.ts';
import { frontDoor } from './moments.ts';
import { burst } from './particles.ts';

type Spot = { readonly x: number; readonly y: number };

export interface OpenHouse {
  /** The run it's for: its setup, as the look down the street names it (camera.ts). */
  readonly run: object;
  /** Due once the run is won; on from the moment the look starts (or the fanfare, without it). */
  readonly phase: 'due' | 'on';
  /** When it started (performance.now()); 0 while it's due. */
  readonly at: number;
  readonly crowd: Crowd;
  /** The front door's mat, where the confetti bursts, in lot cells. */
  readonly door: Spot | null;
  /** The last tally's best earners, where the hearts rise, in lot cells. */
  readonly hearts: readonly Spot[];
  /** A click, a key or the wheel hurried the look. */
  readonly hurried: boolean;
}

export const openHouse = signal<OpenHouse | null>(null);

/** Whether `run` (a run's setup) is having its open house: its look plays in place and holds. */
export function openHouseFor(run: object): boolean {
  return openHouse.peek()?.run === run;
}

/** The verdict's place in balance.verdicts: 0 (Fixer-Upper) up to the top. */
export function verdictBand(verdict: string): number {
  return Math.max(
    0,
    CONTENT.balance.verdicts.findIndex((v) => v.name === verdict),
  );
}

/** The lot's columns where a Driveway's concrete crosses the sidewalk: no car parks there. */
function kerbCuts(state: RunState): boolean[] {
  const { lot } = state.house;
  const occ = occupancy(state.house);
  return Array.from({ length: lot.width }, (_, x) => {
    const p = occ.byUid.get(uidAt(occ, x, lot.height - 1));
    return !!p && (CONTENT.pieces[p.defId].countsAs ?? p.defId) === 'driveway';
  });
}

/**
 * D-177: where the household still waiting for their rooms stands in the crowd's way, at the
 * kerb or at a door on the lot's bottom row, as the board draws them once the run is over (the
 * guided first job's end included: it's no longer guided).
 */
function waiting(state: RunState): [number, number][] {
  const model = houseModel(
    state.house,
    hallLinks(state),
    sunLight(state),
    state.setup.clientId,
    heldSets(state),
  );
  return heldSpans(waitingBoxes(people(state, model)), state.house.lot.height);
}

/**
 * The open house an action's events call for, or null: a run won by this action (it was in
 * progress before and isn't after, and it isn't a debug run). The crowd's plan, the front door
 * and the last tally's best earners, read now while the run is at hand.
 */
export function openHouseOf(
  events: readonly GameEvent[],
  before: RunState,
  after: RunState,
): Pick<OpenHouse, 'run' | 'crowd' | 'door' | 'hearts'> | null {
  if (!inProgress(before) || inProgress(after) || after.debug || after.screen !== 'won') {
    return null;
  }
  const door = frontDoor(after);
  const doorX = (door?.x ?? after.house.lot.width / 2) * CELL;
  const crowd = crowdPlan(
    after.setup.seed,
    verdictBand(rules.verdict(after)),
    doorX,
    after.house.lot.width,
    kerbCuts(after),
    waiting(after),
  );
  let last: Extract<GameEvent, { t: 'tally' }> | null = null;
  for (const e of events) if (e.t === 'tally') last = e;
  const best = last ? pilePieces(last.tally.pieces, FEEL.openHouse.hearts) : [];
  const hearts = best.flatMap((p) => {
    const piece = after.house.pieces.find((q) => q.uid === p.uid);
    if (!piece) return [];
    const shape = piece.shape ?? CONTENT.pieces[piece.defId].shape;
    return [center(placedCells(shape, piece.x, piece.y, piece.rot))];
  });
  return { run: after.setup, crowd, door, hearts };
}

const HURRY = ['pointerdown', 'keydown', 'wheel'] as const;
let burstTimer: ReturnType<typeof setTimeout> | undefined;
let fanfareTimer: ReturnType<typeof setTimeout> | undefined;

/** Listens for (or stops listening for) what hurries the look, as Board.tsx does. */
function listen(on: boolean): void {
  if (typeof window === 'undefined') return;
  for (const type of HURRY) {
    if (on) window.addEventListener(type, hurry, true);
    else window.removeEventListener(type, hurry, true);
  }
}

/** A click, a key or the wheel: the crowd hurries in, and the bursts still to come are dropped. */
function hurry(): void {
  listen(false);
  clearTimeout(burstTimer);
  const oh = openHouse.peek();
  if (oh?.phase === 'on' && !oh.hurried) openHouse.value = { ...oh, hurried: true };
}

function stop(): void {
  listen(false);
  clearTimeout(burstTimer);
  clearTimeout(fanfareTimer);
  fanfareTimer = undefined;
}

/**
 * A lot cell's place in the viewport as the board shows it, its pull-back counted (a cell is the
 * board's own width over the lot's), or null out of the board's view. The director's toScreen
 * counts the camera's scale alone.
 */
function onScreen(c: Spot): Spot | null {
  const { board, scroll } = cameraEls;
  if (!board || !scroll) return null;
  const b = board.getBoundingClientRect();
  const v = scroll.getBoundingClientRect();
  const cell = b.width / lotSize.peek().width;
  const at = { x: b.left + c.x * cell, y: b.top + c.y * cell };
  const inside = at.x >= v.left && at.x <= v.right && at.y >= v.top && at.y <= v.bottom;
  return inside ? at : null;
}

/** Once the view has pulled back: confetti at the front door, hearts over the best earners. */
function bursts(run: object): void {
  const oh = openHouse.peek();
  if (oh?.run !== run || oh.hurried) return;
  const door = oh.door && onScreen(oh.door);
  if (door) burst('confetti', door, { scale: FEEL.openHouse.confetti });
  for (const c of oh.hearts) {
    const at = onScreen(c);
    if (at) burst('hearts', at);
  }
}

/** The look down the street has started: the fanfare, the crowd, and the bursts to come. */
function begin(oh: OpenHouse): void {
  stop();
  openHouse.value = { ...oh, phase: 'on', at: performance.now() };
  audio.play('run-won');
  burstTimer = setTimeout(() => bursts(oh.run), FEEL.streetView.outMs);
  listen(true);
}

// A won run's last action: due a microtask later, after the other listeners, when the tally
// director has the last tally playing (store.ts dispatch), so nothing starts before it's over.
onEvents((events, before, after) => {
  const next = openHouseOf(events, before, after);
  if (!next) return;
  queueMicrotask(() => {
    stop();
    openHouse.value = { ...next, phase: 'due', at: 0, hurried: false };
  });
});

// A new run or a load: the street empties, and its regulars come back.
onRunReset(() => {
  stop();
  openHouse.value = null;
});

effect(() => {
  const oh = openHouse.value;
  const look = streetView.value;
  if (!oh) return;
  if (oh.phase === 'on') {
    // The view has come back: nothing more to hurry.
    if (look?.run !== oh.run) listen(false);
    return;
  }
  if (look?.phase === 'on' && look.run === oh.run) {
    begin(oh);
    return;
  }
  // No look down the street is coming: the fanfare alone, once the last tally is over, as the
  // look would have started. A look that's coming is due by now: the board makes it due in the
  // win's own dispatch, before this open house's microtask. None comes when Reduce motion was on
  // as the run was won (even if it's turned off while the last tally plays), or when the board
  // had nothing to look with (Board.tsx). Busy is read first, so this always wakes as the tally
  // ends.
  if (!busy.value && !look && fanfareTimer === undefined) {
    fanfareTimer = setTimeout(() => {
      fanfareTimer = undefined;
      if (openHouse.peek() !== oh) return;
      openHouse.value = { ...oh, phase: 'on', at: performance.now() };
      audio.play('run-won');
    }, FEEL.streetView.delayMs);
  }
});
