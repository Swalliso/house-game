// The random bot (§8): a random legal placement each week, or a pass when nothing fits. It
// never rerolls, demolishes, or completes early. It sets the floor the targets must beat:
// random play should fail by milestone 2 or 3. From M3 it also shops at random (a pick from
// an open crate, now and then a random buy, then leaving), and now and then uses a random
// tool, so the smoke sim covers the economy.

import type { Action, Rng, Rules, RunState } from '../../src/rules/index.ts';

export const random = {
  name: 'random',
  act(rules: Rules, state: RunState, rng: Rng): Action {
    if (state.screen === 'shop') {
      const legal = rules.legalActions(state);
      const picks = legal.filter((a) => a.t === 'pick');
      if (picks.length > 0) return rng.pick(picks);
      const buys = legal.filter((a) => a.t === 'buy');
      return buys.length > 0 && rng.chance(40) ? rng.pick(buys) : { t: 'leaveShop' };
    }
    // Now and then a free action: a tool (not the Moving Truck) or a supply install.
    const free = rules
      .legalActions(state)
      .filter((a) => a.t === 'useTool' || (a.t === 'install' && a.from === 'supplies'));
    if (free.length > 0 && rng.chance(15)) return rng.pick(free);
    const plays = rules.legalPlays(state);
    return plays.length > 0 ? rng.pick(plays) : { t: 'pass' };
  },
};
