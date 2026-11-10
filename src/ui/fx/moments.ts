// What the reward moments read from the rules' events and state (D-125, D-126, D-127): which
// line of a piece's breakdown is a Rhythm payout, whether a checklist line is a house rule,
// which milestone puts the roof on, where the front door is, and whether this run has topped
// out before. They sort what the rules already worked out; none of them scores anything.

import {
  CONTENT,
  type ClientId,
  type GameEvent,
  type PieceScore,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { hallLinks, houseModel, sunLight } from '../board/house-model.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { CELL } from '../sprites.ts';

/**
 * What a piece's Rhythm paid this week (the Pool's every third week): its breakdown's "Every
 * 3rd week" lines (rules/scoring.ts names them so; "Every week" is a steady earner's, and an
 * economy cadence pays budget, not Comfort). 0 in an off week. The lines decide, not the card,
 * so a Rhythm a fixture grants counts too.
 */
export function rhythmPaid(piece: PieceScore): number {
  return piece.lines.reduce(
    (n, l) => (l.op === 'add' && l.value > 0 && RHYTHM_LINE.test(l.label) ? n + l.value : n),
    0,
  );
}

const RHYTHM_LINE = /^Every \d+(?:st|nd|rd|th) week\b/;

/** Whether a client's checklist line is one of the house rules (D-101), not a wish of theirs. */
export function isHouseRule(clientId: ClientId, index: number): boolean {
  const spec = CONTENT.clients[clientId].specs[index];
  return !!spec && spec.group !== 'wishes';
}

/** The house rule whose first hold tops the house out (D-127). */
export const TOPPED_OUT_RULE = 'underOneRoof';

/** The milestone that puts the roof on (D-018): the roof reveal plays as it's met (D-127). */
export const ROOFING_PHASE = CONTENT.balance.phases.findIndex((p) => p.name === 'Roofing');

/**
 * Whether the house has its roof: the Roofing milestone has been met (a missed one ends the run
 * without it). From then on the camera's Roof button can put it on (D-133).
 */
export function roofed(s: Pick<RunState, 'milestones'>): boolean {
  return s.milestones.some((m) => m.phase === ROOFING_PHASE && m.result !== 'failed');
}

/**
 * The target a tally crosses, if it does: a targetReached right after it, before the next
 * tally (the rules send it once the run total passes the phase's target).
 */
export function targetCrossed(events: readonly GameEvent[], at: number): number | null {
  for (let k = at + 1; k < events.length; k++) {
    const e = events[k]!;
    if (e.t === 'tally') break;
    if (e.t === 'targetReached') return e.target;
  }
  return null;
}

/**
 * The front door's doormat, in lot cells (its middle), or the middle of the house's south edge
 * when there's no front door yet, or null before the first room.
 */
export function frontDoor(state: RunState): { x: number; y: number } | null {
  const model = houseModel(state.house, hallLinks(state), sunLight(state));
  const front = model.exits.find((e) => e.kind === 'front');
  if (front) {
    return { x: (front.mat.x + front.mat.w / 2) / CELL, y: (front.mat.y + front.mat.h / 2) / CELL };
  }
  const b = model.bounds;
  return b ? { x: b.x + b.w / 2, y: b.y + b.h } : null;
}

// ---- Topped out, once a run (UI only) ----

const TOPPED_KEY = `openhouse:${BUILD_CHANNEL}:topped-out`;
/** Runs remembered, newest last: enough for a week of play. */
const TOPPED_KEEP = 30;
const toppedThisVisit = new Set<string>();

function runKey(s: RunSetup): string {
  return `${s.seed}:${s.clientId}:${s.crewId}`;
}

function toppedList(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const v: unknown = JSON.parse(localStorage.getItem(TOPPED_KEY) ?? 'null');
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Whether this run has topped out before: "Topped out!" is for the first week Under one roof
 * holds, and the rules keep no history of the checklist, so the browser remembers the run (by
 * its seed, client and crew; a replay of the same run counts as the same run).
 */
export function toppedOutBefore(s: RunSetup): boolean {
  const key = runKey(s);
  return toppedThisVisit.has(key) || toppedList().includes(key);
}

export function markToppedOut(s: RunSetup): void {
  const key = runKey(s);
  toppedThisVisit.add(key);
  const list = toppedList().filter((k) => k !== key);
  try {
    localStorage.setItem(TOPPED_KEY, JSON.stringify([...list, key].slice(-TOPPED_KEEP)));
  } catch {
    // Blocked storage: remembered for this visit only.
  }
}
