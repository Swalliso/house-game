// The random bot (§8): a random legal placement each week, or a pass when nothing fits. It
// never rerolls, demolishes, strikes (D-157), or completes early. It sets the floor the
// targets must beat: random play should fail by milestone 2 or 3. From M3 it also shops at
// random (a pick from an open crate, now and then a random buy, then leaving), and now and
// then uses a random tool. Its runs rarely get past shop 1 or afford a tool, so the chaos test
// (chaos.test.ts), not this bot, covers the economy (D-089). It picks uniformly over every
// card × spot, so it favours yard cards, which fit in more places; novice.ts is the floor for
// milestone 1.

import type { Action, Rng, Rules, RunState } from '../../src/rules/index.ts';

export const random = {
  name: 'random',
  act(rules: Rules, state: RunState, rng: Rng): Action {
    // M4b, D-144: one of the change orders on offer, at random.
    if (state.screen === 'changeOrder') return rng.pick(rules.legalActions(state));
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
