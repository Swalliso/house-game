// The default change-order policy (§8, M4b): on the 'changeOrder' screen, accept requests (a
// reward and no penalty), decline restrictions (they can only cost the bot a placement), and
// acknowledge phase effects (they can't be declined). greedy and novice answer this way;
// random and chaos answer at random.

import type { Action, Rules, RunState } from '../../src/rules/index.ts';

export function answerChangeOrder(rules: Rules, state: RunState): Action {
  const offer = state.offers?.changeOrder;
  const kind = offer ? rules.content.changeOrders[offer.id].kind : 'request';
  return { t: 'answerChangeOrder', accept: kind !== 'restriction' };
}
