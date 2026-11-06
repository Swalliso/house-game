// Tools (Appendix B of implementation-plan.md; M3b): one-shot free actions that share the
// supply slots with fixtures. Combolands' potions and Islanders' boons are the models: cheap,
// and they bend the board. The Remodel Plans for Suite and Full House join with those sets in
// M4a, and Inspector's Visit acts only on specs, so the shop holds it back until M4a's
// clients. Weekend Crew is D-075's banked building (D-083): this week's next play doesn't end
// the week. Prices come from balance.ts by rarity.

import type { Rarity, ToolDef, ToolId, ToolUse } from '../rules/index.ts';
import { PRICES } from './balance.ts';

const tool = (
  id: ToolId,
  name: string,
  rarity: Rarity,
  use: ToolUse,
  opts: { price?: number; offered?: boolean } = {},
): ToolDef => ({
  id,
  name,
  tier: 'core',
  rarity,
  price: opts.price ?? PRICES.tool[rarity],
  use,
  offered: opts.offered ?? true,
});

export const TOOLS: Readonly<Record<ToolId, ToolDef>> = {
  movingTruck: tool('movingTruck', 'Moving Truck', 'uncommon', { kind: 'move' }),
  copyMachine: tool('copyMachine', 'Copy Machine', 'rare', { kind: 'copy' }),
  rushOrder: tool('rushOrder', 'Rush Order', 'common', {
    kind: 'weekModifiers',
    modifiers: [{ kind: 'mult', add: 50 }],
  }),
  openHouseParty: tool('openHouseParty', 'Open House Party', 'common', {
    kind: 'weekModifiers',
    modifiers: [
      { kind: 'earn', target: { tag: 'Social' }, pct: 100 },
      { kind: 'earn', target: { tag: 'Pretty' }, pct: 100 },
    ],
  }),
  catalog: tool('catalog', 'Catalog', 'common', { kind: 'specialHand' }),
  fertilizer: tool('fertilizer', 'Fertilizer', 'uncommon', { kind: 'advanceTimers', weeks: 2 }),
  inspectorsVisit: tool(
    'inspectorsVisit',
    'Inspector’s Visit',
    'uncommon',
    { kind: 'weekModifiers', modifiers: [{ kind: 'rule', key: 'specBonus', add: 25 }] },
    { offered: false }, // Offered once M4a's clients bring specs.
  ),
  dumpster: tool('dumpster', 'Dumpster', 'common', { kind: 'reward', reward: { demolitions: 2 } }),
  remodelJackAndJill: tool('remodelJackAndJill', 'Remodel Plans: Jack-and-Jill', 'common', {
    kind: 'levelSet',
    set: 'jackAndJill',
  }),
  remodelEntertainer: tool('remodelEntertainer', 'Remodel Plans: Entertainer', 'common', {
    kind: 'levelSet',
    set: 'entertainer',
  }),
  // D-075, D-083: Rare and dearer, since a piece placed early earns for the rest of the run.
  weekendCrew: tool('weekendCrew', 'Weekend Crew', 'rare', { kind: 'extraPlay' }, { price: 5 }),
};
