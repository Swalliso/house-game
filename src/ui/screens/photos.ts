// The end screen's photos (M6, D-136): the house as it stood at each milestone. Pure: it replays
// the run's setup and actions through the rules and keeps the state each time a milestone
// resolves, and frames every photo the same way, so the strip reads as a time-lapse of one
// spot. photo-paint.ts paints them in the browser; EndPhotos.tsx deals them in.
//
// The same replay gives the house's time-lapse (S10, D-187): the state after every action that
// changed the house, which board/TimelapseLayer.tsx plays on the board at the end of a run.

import {
  rules,
  type Action,
  type GameEvent,
  type HouseState,
  type MilestoneRecord,
  type PieceId,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { boardRows, isIndoor, occupancy } from '../board/geometry.ts';
import { CELL } from '../sprites.ts';

/** A milestone's photo: how it resolved, and the run's state just after (the house as it stood). */
export interface MilestoneShot {
  record: MilestoneRecord;
  state: RunState;
}

let memo: { setup: RunSetup; actions: readonly Action[]; shots: MilestoneShot[] } | null = null;

/**
 * The run's state each time a milestone resolved, in order: on time, early, in overtime, or
 * missed (the last one of a lost run). Replays the actions from the setup with `apply`, as a run
 * code does, and stops quietly at an action that no longer applies. The last answer is kept, so
 * the end screen replays the run once, not on every render.
 */
export function milestoneShots(setup: RunSetup, actions: readonly Action[]): MilestoneShot[] {
  if (memo && memo.actions === actions && memo.setup === setup) return memo.shots;
  const shots: MilestoneShot[] = [];
  let s = rules.newRun(setup);
  for (const action of actions) {
    try {
      s = rules.apply(s, action).state;
    } catch {
      break;
    }
    // One action can resolve more than one (a milestone completed early plays the weeks left).
    while (shots.length < s.milestones.length) {
      shots.push({ record: s.milestones[shots.length]!, state: s });
    }
  }
  memo = { setup, actions, shots };
  return shots;
}

/** One build of the time-lapse (D-187): the house just after an action that changed it. */
export interface BuildStep {
  /** The run's state just after the action. */
  state: RunState;
  /** What changed, for its place sound: a room (or a fixture in one), or the yard. */
  kind: 'room' | 'yard';
}

/** The house as it went up: the lot as the run began, then each build in order. */
export interface Timelapse {
  start: RunState;
  steps: BuildStep[];
}

/**
 * The events that change how the house looks: a piece placed, moved, torn down (or a feature
 * cleared), turned into another, grown, renovated (a finished room lights its lamp, D-181), or
 * given a fixture.
 */
const BUILDS: ReadonlySet<GameEvent['t']> = new Set([
  'placed',
  'moved',
  'demolished',
  'transformed',
  'extended',
  'renovated',
  'installed',
]);

/** The piece a build event is about, if it names one (a fixture's, its host). */
function builtPiece(e: GameEvent, house: HouseState): PieceId | undefined {
  switch (e.t) {
    case 'placed':
    case 'moved':
    case 'transformed':
    case 'extended':
    case 'renovated':
    case 'demolished':
      return e.defId;
    case 'installed':
      return house.pieces.find((p) => p.uid === e.uid)?.defId;
    default:
      return undefined;
  }
}

let stepsMemo: { setup: RunSetup; actions: readonly Action[]; lapse: Timelapse } | null = null;

/**
 * The run's builds, in order (D-187): the state after every action whose events change how the
 * house looks (BUILDS), each with the kind of its first build for its sound. Replays the actions
 * from the setup with `apply`, as milestoneShots does, and stops quietly at an action that no
 * longer applies. The last answer is kept, so a run is replayed once.
 */
export function buildSteps(setup: RunSetup, actions: readonly Action[]): Timelapse {
  if (stepsMemo && stepsMemo.actions === actions && stepsMemo.setup === setup) {
    return stepsMemo.lapse;
  }
  const start = rules.newRun(setup);
  const steps: BuildStep[] = [];
  let s = start;
  for (const action of actions) {
    let events: readonly GameEvent[];
    try {
      ({ state: s, events } = rules.apply(s, action));
    } catch {
      break;
    }
    const build = events.find((e) => BUILDS.has(e.t));
    if (!build) continue;
    const id = builtPiece(build, s.house);
    steps.push({ state: s, kind: id !== undefined && isIndoor(id) ? 'room' : 'yard' });
  }
  const lapse = { start, steps };
  stepsMemo = { setup, actions, lapse };
  return lapse;
}

/** A box on the board's canvas, in art px: the lot, its street row and the road below. */
export interface PhotoFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The frame's shape, wide to tall: a photo is 4:3. */
export const PHOTO_ASPECT = { w: 4, h: 3 } as const;

/** The frame around an empty lot: twelve cells by nine in its middle. */
const EMPTY = { w: 12, h: 9 };

/**
 * Where every photo of a run is taken: the finished house's bounding box (its rooms; a house of
 * yard pieces alone, all of them) with a cell around it, grown to 4:3 about its middle, and kept
 * on the board. Taking each milestone's photo through the same frame, the house grows in place.
 * A house too tall for a 4:3 frame as wide as the board (rooms down 18 rows or more) loses its
 * top and bottom edges.
 */
export function photoFrame(house: HouseState): PhotoFrame {
  const { width, height } = house.lot;
  const boardW = width * CELL;
  const boardH = boardRows(height) * CELL;
  const occ = occupancy(house);
  const rooms = house.pieces.filter((p) => isIndoor(p.defId)).map((p) => p.uid);
  const framed = rooms.length > 0 ? rooms : house.pieces.map((p) => p.uid);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const uid of framed) {
    for (const c of occ.cells.get(uid) ?? []) {
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + 1);
      y1 = Math.max(y1, c.y + 1);
    }
  }
  if (x0 === Infinity) {
    // Nothing built: the middle of the lot.
    x0 = (width - EMPTY.w) / 2;
    x1 = x0 + EMPTY.w;
    y0 = (height - EMPTY.h) / 2;
    y1 = y0 + EMPTY.h;
  } else {
    x0 -= 1;
    y0 -= 1;
    x1 += 1;
    y1 += 1;
  }
  // Grow the short side to 4:3, in whole steps of 4 × 3 art px, no bigger than the board.
  const { w: aw, h: ah } = PHOTO_ASPECT;
  const want = Math.max(((x1 - x0) * CELL) / aw, ((y1 - y0) * CELL) / ah);
  const k = Math.min(Math.ceil(want), Math.floor(boardW / aw), Math.floor(boardH / ah));
  const w = aw * k;
  const h = ah * k;
  const cx = ((x0 + x1) / 2) * CELL;
  const cy = ((y0 + y1) / 2) * CELL;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, Math.round(v)));
  return { x: clamp(cx - w / 2, boardW - w), y: clamp(cy - h / 2, boardH - h), w, h };
}
