// The novice bot (§8): a uniformly chosen card that fits (hand or reserve), at that card's best
// spot. It's the floor for "milestone 1 teaches": a new player picks a card they like, not the
// best card, but puts it somewhere sensible. Random play is a worse floor for that, since it
// picks among every card × spot, which favours yard cards (more legal spots) and scores 0 in
// most first weeks.
//
// The spot: the card's plays ranked by rankPlays (the greedy bot's estimate and tie-break),
// with the top NOVICE_EXACT scored exactly; a fixture card goes in its best host. A room card
// at its limit can renovate (M4a) too, so its Renovations join its options, and a card that
// can only renovate is a card with a play. It never rerolls, strikes (D-157), passes while a
// card has a play, uses tools, demolishes, or completes early, and shops like the random bot.

import type {
  Action,
  InstallAction,
  PlaceAction,
  RenovateAction,
  Rng,
  Rules,
  RunState,
} from '../../src/rules/index.ts';
import { rankPlays } from './greedy.ts';
import type { Policy } from './index.ts';
import { pickChangeOrderNovice } from './orders.ts';
import { random } from './random.ts';

/** Plays of the chosen card scored exactly, best estimate first. */
const NOVICE_EXACT = 6;

export const novice: Policy = {
  name: 'novice',
  act(rules: Rules, state: RunState, rng: Rng): Action {
    // M4b, D-144: one of the two change orders: the budget on offer first (orders.ts).
    if (state.screen === 'changeOrder') return pickChangeOrderNovice(rules, state);
    if (state.screen === 'shop') return random.act(rules, state, rng);
    const cards: { from: 'hand' | 'reserve'; i: number }[] = [];
    const renovates = (from: 'hand' | 'reserve', i: number) =>
      rules.renovateTargets(state, from, i).length > 0;
    state.hand.forEach(
      (_, i) =>
        (rules.cardFits(state, i) || renovates('hand', i)) && cards.push({ from: 'hand', i }),
    );
    state.reserve.forEach(
      (_, i) =>
        (rules.reserveFits(state, i) || renovates('reserve', i)) &&
        cards.push({ from: 'reserve', i }),
    );
    if (cards.length === 0) return { t: 'pass' };
    const { from, i } = rng.pick(cards);
    const salt = rng.u32();
    let options: (PlaceAction | InstallAction | RenovateAction)[];
    if (from === 'hand' && state.hand[i]!.kind === 'fixture') {
      options = rules
        .installHosts(state, 'hand', i)
        .map((uid): InstallAction => ({ t: 'install', from: 'hand', i, uid }));
    } else {
      const plays = rules.legalPlacements(state).filter((p) => p.from === from && p.i === i);
      options = [
        ...rankPlays(rules, state, plays, salt)
          .slice(0, NOVICE_EXACT)
          .map((r) => r.play),
        ...rules
          .renovateTargets(state, from, i)
          .map((uid): RenovateAction => ({ t: 'renovate', from, i, uid })),
      ];
    }
    let best = options[0]!;
    let bestTotal = -Infinity;
    for (const play of options) {
      const total = rules.scoreOnly(state, play);
      if (total > bestTotal) [best, bestTotal] = [play, total];
    }
    return best;
  },
};
