// The default change-order policies (§8, M4b; D-144): on the 'changeOrder' screen two orders
// are on offer and one must be picked. Both bots read the cards as a player would: what each
// pays, and for a phase effect the rules' houseGain, its weekly Wow on the house as it stands.
// Neither plans for the order it picks.
// - greedy takes a phase effect that gains Wow on its house today (the better of two); else a
//   request or a restriction (the bigger reward; missing one costs nothing, and it keeps a
//   phase effect that would cost it out of the phase); else the phase effect that costs least.
// - novice takes the budget on offer: a request or a restriction when there is one (the
//   bigger reward), else the phase effect with the better number.
// random and chaos pick at random.

import type { Action, ChangeOrderView, Rules, RunState } from '../../src/rules/index.ts';

/** The index of the option that scores highest; the first, on a tie. */
function best(options: readonly ChangeOrderView[], score: (o: ChangeOrderView) => number): number {
  let at = 0;
  options.forEach((o, i) => {
    if (score(o) > score(options[at]!)) at = i;
  });
  return at;
}

const pays = (o: ChangeOrderView) => o.reward?.budget ?? 0;
const gain = (o: ChangeOrderView) => o.houseGain ?? 0;
/** Above any reward or weekly gain, so a class of order always beats the one under it. */
const CLASS = 1e9;

function pick(rules: Rules, state: RunState, score: (o: ChangeOrderView) => number): Action {
  const options = rules.changeOrderOffer(state)?.options ?? [];
  return { t: 'answerChangeOrder', i: best(options, score) };
}

/** greedy's pick: a gaining phase effect, then a paying order, then the least costly effect. */
export function pickChangeOrder(rules: Rules, state: RunState): Action {
  return pick(rules, state, (o) => {
    if (o.kind !== 'phase') return CLASS + pays(o);
    return gain(o) > 0 ? 2 * CLASS + gain(o) : gain(o);
  });
}

/** novice's pick: a paying order when there is one, else the phase effect with the better number. */
export function pickChangeOrderNovice(rules: Rules, state: RunState): Action {
  return pick(rules, state, (o) => (o.kind !== 'phase' ? CLASS + pays(o) : gain(o)));
}
