// The greedy bot (§8): the placement with the best exact scoreOnly() total this week.
//
// It ranks every legal placement by the rules' cheap local estimate (which sees the checklist
// lines a play turns on or off that counts can decide) and scores only the best few exactly
// (§4, Performance): the top TOP_K overall, the top PER_CARD of each card, and up to HINT_CAP
// of the plays the estimate flags as blind spots (one that might complete a set, a Fence that
// would close a fenced yard, a Hallway that would link rooms, a piece that would join an unmet
// pair line's types), since those move the week in ways the estimate can't see. Two planners
// add pack placements the rules' suggested shapes don't list: Fences that close a yard
// (enclosure.ts) and Driveways that run to an unreached Garage (drive.ts, D-140). Estimate ties
// break by a seeded key per play (rankPlays), never by list position: legalPlacements runs
// from the back row, so ranking by position built every house against the back of the lot.
// A Fence card's plays out in the open all estimate alike, so only the few that key first are
// ranked (withoutLookalikes, D-161): the shortlist is the same, for a fraction of the estimates.
// Exact ties go to a random one of the best, from the same stream, so houses vary between runs.
//
// When even the best placement wouldn't raise this week's total, it rerolls if it can, and
// passes rather than lose score. A reroll redraws both rows (D-132). It never demolishes. Its
// options (makeGreedy) set when it completes a milestone early ('never' by default; 'always'
// as soon as it can; 'last' only in the phase's last week) and whether it strikes (D-157:
// 'none' by default; 'fixed' strikes hand cards by STRIKE_ORDER before anything else in the
// week, and buys +1 strike). It shops with the shop bot, uses tools and supplies first
// (shop.ts), places reserve pieces, and scores hand fixtures' installs exactly (there are few).

import type {
  Action,
  Estimate,
  PlaceAction,
  Play,
  Rng,
  Rules,
  RunState,
} from '../../src/rules/index.ts';
import type { Policy } from './index.ts';
import { drivePlans } from '../drive.ts';
import { fencePlans, openGround } from '../enclosure.ts';
import { pickChangeOrder } from './orders.ts';
import { shopAct, strikeAct, useTools, type StrikeMode } from './shop.ts';

export const TOP_K = 12;
const PER_CARD = 2;
/** At most this many hinted plays (set, yard, link, pair) are scored exactly, best first. */
export const HINT_CAP = 24;
/**
 * And this many plays that change another piece's sun under a Sunny reader (D-120), on their
 * own count: one Sunny wall can be shaded from dozens of spots, and they'd crowd out the rest.
 */
export const SUN_HINT_CAP = 8;

/** When greedy completes a milestone early: 'last' only when it saves exactly one week. */
export type EarlyMode = 'never' | 'always' | 'last';

export interface GreedyOptions {
  /** Default 'never'. */
  early?: EarlyMode;
  /** Default 'none': it never strikes. 'fixed' strikes hand cards by STRIKE_ORDER (D-157). */
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

/**
 * The plays without each card's open-ground Fence plays (enclosure.ts) but the `keep` that
 * rankPlays would put first, in their order (D-161). The estimate values a card's open-ground
 * plays alike, with no hint, so they rank by tie key alone: a ranking that takes at most `keep`
 * plays of a card, or `keep` in all, never reaches the others, and leaving them out moves no
 * other play into or out of its first `keep`. That's most of a Fence card's plays, and the
 * standing stock (D-160) keeps one in the reserve nearly every week.
 */
export function withoutLookalikes(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
  salt: number,
  keep: number,
): readonly PlaceAction[] {
  const ground = openGround(rules, state, plays);
  const byCard = new Map<number, number[]>();
  ground.forEach((g, n) => {
    if (!g) return;
    const card = plays[n]!.i * 2 + (plays[n]!.from === 'reserve' ? 1 : 0);
    const list = byCard.get(card);
    if (list) list.push(n);
    else byCard.set(card, [n]);
  });
  const drop = new Uint8Array(plays.length);
  let dropped = false;
  for (const list of byCard.values()) {
    if (list.length <= keep) continue;
    // rankPlays' order among equal estimates: the key, then the list's (its sort is stable).
    const order = list.map((n) => ({ n, key: tieKey(salt, plays[n]!) }));
    order.sort((a, b) => a.key - b.key || a.n - b.n);
    for (let k = keep; k < order.length; k++) drop[order[k]!.n] = 1;
    dropped = true;
  }
  return dropped ? plays.filter((_, n) => drop[n] === 0) : plays;
}

const hinted = (est: Estimate) => est.setHint || est.yardHint || est.linkHint || est.specHint;

/** The plays worth scoring exactly, by the cheap estimate, in rank order. */
export function shortlist(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
  salt: number,
): PlaceAction[] {
  const few = withoutLookalikes(rules, state, plays, salt, Math.max(TOP_K, PER_CARD));
  return shortlistOf(rankPlays(rules, state, few, salt));
}

/** The shortlist from a ranking of every play (shortlist's last step). */
export function shortlistOf(ranked: readonly RankedPlay[]): PlaceAction[] {
  const chosen = new Uint8Array(ranked.length);
  const perCard = new Map<number, number>();
  let hints = 0;
  let sunHints = 0;
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
    } else if (sunHints < SUN_HINT_CAP && r.est.sunHint) {
      sunHints++;
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
      // M4b, D-144: one of the two change orders, by what its card says (orders.ts).
      if (state.screen === 'changeOrder') return pickChangeOrder(rules, state);
      const salt = rng.u32();
      if (state.screen === 'shop') return shopAct(rules, state, rng, { salt, strikes, early });
      if (completesEarly(rules, state, early)) return { t: 'completeEarly' };
      // D-157: a strike first, so the card that takes the struck one's slot is in the week.
      const strike = strikes === 'fixed' ? strikeAct(rules, state) : null;
      if (strike) return strike;
      const free = useTools(rules, state, salt);
      if (free) return free;
      const plays: PlaceAction[] = [];
      // Installs, Renovations and extensions (D-168) are few, so each is scored exactly. So are
      // Fence packs that close a yard (D-106): the rules list only a pack's suggested shapes,
      // and the first Fence earns nothing until its yard closes.
      const exact: NonNullable<Play>[] = [];
      for (const p of rules.legalPlays(state)) {
        // A single tile of a pack isn't worth ranking: the planner below finds the ones that
        // close a yard, and a lone Fence or Driveway tile earns next to nothing.
        if (p.t === 'place') {
          if (!(p.shape && p.shape.length === 1 && p.shape[0] === '#')) plays.push(p);
        } else exact.push(p);
      }
      state.hand.forEach((_, i) => exact.push(...fencePlans(rules, state, 'hand', i)));
      state.reserve.forEach((_, i) => exact.push(...fencePlans(rules, state, 'reserve', i)));
      // And Driveway packs that run to an unreached Garage (D-140): its pay is the Garage's.
      for (const from of ['hand', 'reserve'] as const) {
        state[from].forEach((_, i) =>
          exact.push(...drivePlans(rules, state, from, i).map((plan) => plan.play)),
        );
      }
      const passTotal = rules.scoreOnly(state, null);
      let best: NonNullable<Play>[] = [];
      let bestTotal = -Infinity;
      for (const play of [...shortlist(rules, state, plays, salt), ...exact]) {
        const total = rules.scoreOnly(state, play);
        if (total > bestTotal) {
          bestTotal = total;
          best = [play];
        } else if (total === bestTotal) best.push(play);
      }
      if (best.length === 0 || bestTotal <= passTotal) {
        if (rules.canReroll(state).ok) return { t: 'reroll' };
        if (best.length === 0 || bestTotal < passTotal) return { t: 'pass' };
      }
      return rng.pick(best);
    },
  };
}

/** The default greedy bot: never early, no strikes. */
export const greedy: Policy = makeGreedy();
