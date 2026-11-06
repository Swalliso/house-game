// The random bot (§8): a random legal placement each week, or a pass when nothing fits. It
// never rerolls, demolishes, or completes early. It sets the floor the targets must beat:
// random play should fail by milestone 2 or 3.

import type { Action, Rng, Rules, RunState } from '../../src/rules/index.ts';

export const random = {
  name: 'random',
  act(rules: Rules, state: RunState, rng: Rng): Action {
    if (state.screen === 'shop') return { t: 'leaveShop' };
    const plays = rules.legalPlays(state);
    return plays.length > 0 ? rng.pick(plays) : { t: 'pass' };
  },
};
