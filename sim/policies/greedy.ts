// The greedy bot (§8): the placement with the best exact scoreOnly() total this week.
//
// It ranks every legal placement by the rules' cheap local estimate (which sees the checklist
// lines a play turns on or off that counts can decide) and scores only the best few exactly
// (§4, Performance): the top TOP_K overall, the top PER_CARD of each card, and up to HINT_CAP
// of the plays the estimate flags as blind spots (one that might complete a set, a Fence that
// would close a fenced yard, a Hallway that would link rooms, a piece that would join an unmet
// pair line's types), since those move the week in ways the estimate can't see. Estimate ties
// break by a seeded key per play (rankPlays), never by list position: legalPlacements runs
// from the back row, so ranking by position built every house against the back of the lot.
// Exact ties go to a random one of the best, from the same stream, so houses vary between runs.
//
// When even the best placement wouldn't raise this week's total, it rerolls if it can, and
// passes rather than lose score. A reroll redraws one row (D-121): the one whose cards did
// worse this week, the Rooms row on a tie. It never demolishes. Its options (makeGreedy) set when it
// completes a milestone early ('never' by default; 'always' as soon as it can; 'last' only in
// the phase's last week) and whether it buys the strike service. It shops with the shop bot,
// uses tools and supplies first (shop.ts), places reserve pieces, and scores hand fixtures'
// installs exactly (there are few).

import type {
  Action,
  Estimate,
  InstallAction,
  PlaceAction,
  RenovateAction,
  Rng,
  Rules,
  RunState,
} from '../../src/rules/index.ts';
import type { Policy } from './index.ts';
import { DRAW_ROWS, rowOf } from '../../src/rules/draw.ts';
import { fencePlans } from '../enclosure.ts';
import { answerChangeOrder } from './orders.ts';
import { shopAct, useTools, type StrikeMode } from './shop.ts';

export const TOP_K = 12;
const PER_CARD = 2;
/** At most this many hinted plays (set, yard, link, pair) are scored exactly, best first. */
export const HINT_CAP = 24;

/** When greedy completes a milestone early: 'last' only when it saves exactly one week. */
export type EarlyMode = 'never' | 'always' | 'last';

export interface GreedyOptions {
  /** Default 'never'. */
  early?: EarlyMode;
  /** Default 'none': it never buys the strike service. 'fixed' strikes by STRIKE_ORDER. */
  strikes?: StrikeMode;
}

export interface RankedPlay {
  play: PlaceAction;
  est: Estimate;
  /** The seeded tie-break key. */
  key: number;
}

/**
 * A play's tie-break key: a hash of the salt and the play itself, so the order of the plays
 * list never matters and the same salt always ranks the same plays alike.
 */
export function tieKey(salt: number, p: PlaceAction): number {
  let h = salt ^ Math.imul(p.x + 1, 0x9e3779b1);
  // A pack's tiles (D-106) tell apart plays at the same spot.
  if (p.shape) {
    for (const row of p.shape) {
      for (let k = 0; k < row.length; k++) h = Math.imul(h ^ row.charCodeAt(k), 0x01000193);
      h = Math.imul(h ^ 0x2f, 0x01000193);
    }
  }
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77) ^ Math.imul(p.y + 1, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) ^ (p.rot + 4 * p.i + (p.from === 'reserve' ? 64 : 0));
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * The plays ranked by the rules' estimate, best first; estimate ties by the seeded key. The
 * one ranking every bot uses (the greedy shortlist, the shop bot's placements, the novice).
 * Draw the salt once per decision (rng.u32()), so the rest of the bot's stream doesn't shift
 * with the number of plays.
 */
export function rankPlays(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
  salt: number,
): RankedPlay[] {
  return plays
    .map((play) => ({ play, est: rules.estimatePlay(state, play), key: tieKey(salt, play) }))
    .sort((a, b) => b.est.delta - a.est.delta || a.key - b.key);
}

const hinted = (est: Estimate) => est.setHint || est.yardHint || est.linkHint || est.specHint;

/** The plays worth scoring exactly, by the cheap estimate, in rank order. */
export function shortlist(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
  salt: number,
): PlaceAction[] {
  const ranked = rankPlays(rules, state, plays, salt);
  const chosen = new Uint8Array(ranked.length);
  const perCard = new Map<number, number>();
  let hints = 0;
  ranked.forEach((r, n) => {
    if (n < TOP_K) chosen[n] = 1;
    const card = r.play.i * 2 + (r.play.from === 'reserve' ? 1 : 0);
    const k = perCard.get(card) ?? 0;
    if (k < PER_CARD) {
      perCard.set(card, k + 1);
      chosen[n] = 1;
    }
    if (hints < HINT_CAP && hinted(r.est)) {
      hints++;
      chosen[n] = 1;
    }
  });
  return ranked.filter((_, n) => chosen[n] === 1).map((r) => r.play);
}

/** Should the bot complete the milestone early now? */
function completesEarly(rules: Rules, state: RunState, mode: EarlyMode): boolean {
  if (mode === 'never') return false;
  const offer = rules.canCompleteEarly(state);
  return offer.ok && (mode === 'always' || offer.weeksSaved === 1);
}

/** The policy's label for reports: 'greedy', or 'greedy · early always · strikes fixed'. */
function labelOf(early: EarlyMode, strikes: StrikeMode): string {
  const parts = ['greedy'];
  if (early !== 'never') parts.push(`early ${early}`);
  if (strikes !== 'none') parts.push(`strikes ${strikes}`);
  return parts.join(' · ');
}

/**
 * A greedy bot with these options. Every variant is named 'greedy', so the same seed keys
 * the same streams and variants play alike until their choices differ; `label` tells them apart.
 */
export function makeGreedy(opts: GreedyOptions = {}): Policy {
  const early = opts.early ?? 'never';
  const strikes = opts.strikes ?? 'none';
  return {
    name: 'greedy',
    label: labelOf(early, strikes),
    act(rules: Rules, state: RunState, rng: Rng): Action {
      // M4b: accept requests, decline restrictions, acknowledge phase effects.
      if (state.screen === 'changeOrder') return answerChangeOrder(rules, state);
      const salt = rng.u32();
      if (state.screen === 'shop') return shopAct(rules, state, rng, { salt, strikes, early });
      if (completesEarly(rules, state, early)) return { t: 'completeEarly' };
      const free = useTools(rules, state, salt);
      if (free) return free;
      const plays: PlaceAction[] = [];
      // Installs and Renovations are few, so each is scored exactly. So are Fence packs that
      // close a yard (D-106): the rules list only a pack's suggested shapes, and the first
      // Fence earns nothing until its yard closes.
      const exact: (PlaceAction | InstallAction | RenovateAction)[] = [];
      for (const p of rules.legalPlays(state)) {
        // A single tile of a pack isn't worth ranking: the planner below finds the ones that
        // close a yard, and a lone Fence or Driveway tile earns next to nothing.
        if (p.t === 'place') {
          if (!(p.shape && p.shape.length === 1 && p.shape[0] === '#')) plays.push(p);
        } else exact.push(p);
      }
      state.hand.forEach((_, i) => exact.push(...fencePlans(rules, state, 'hand', i)));
      state.reserve.forEach((_, i) => exact.push(...fencePlans(rules, state, 'reserve', i)));
      const passTotal = rules.scoreOnly(state, null);
      let best: (PlaceAction | InstallAction | RenovateAction)[] = [];
      let bestTotal = -Infinity;
      // Each row's best total this week (D-121), for which row to reroll.
      const rowBest = { rooms: -Infinity, layout: -Infinity };
      for (const play of [...shortlist(rules, state, plays, salt), ...exact]) {
        const total = rules.scoreOnly(state, play);
        if (total > bestTotal) {
          bestTotal = total;
          best = [play];
        } else if (total === bestTotal) best.push(play);
        const card = play.from === 'hand' ? state.hand[play.i] : undefined;
        if (card) {
          const row = rowOf(rules.content, card);
          rowBest[row] = Math.max(rowBest[row], total);
        }
      }
      if (best.length === 0 || bestTotal <= passTotal) {
        if (rules.canReroll(state).ok) {
          const row = DRAW_ROWS.reduce((a, b) => (rowBest[b] < rowBest[a] ? b : a));
          return { t: 'reroll', row };
        }
        if (best.length === 0 || bestTotal < passTotal) return { t: 'pass' };
      }
      return rng.pick(best);
    },
  };
}

/** The default greedy bot: never early, no strikes. */
export const greedy: Policy = makeGreedy();
