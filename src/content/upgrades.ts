// Company upgrades (Appendix B of implementation-plan.md; M3b): Balatro's vouchers. One is
// offered per visit from the second shop, pricier than other goods and permanent for the run.
// Each is a `rule` modifier. Prices are Appendix A's 6–8 placeholders.
//
// D-209 (S26): the three slot upgrades also bring something to fill their slot, so buying one
// shows at once or at the next milestone: the Storage Unit a special piece the house doesn't
// have yet at each milestone's start, the Tool Belt a Common tool, and the Drafting Table a pick
// of three Common blueprints as it's bought (run.ts `upgradeDeliveries`, `buy`).

import type { UpgradeDef, UpgradeId } from '../rules/index.ts';

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  storageUnit: {
    id: 'storageUnit',
    name: 'Storage Unit',
    tier: 'core',
    price: 6,
    modifiers: [{ kind: 'rule', key: 'reserveSlots', add: 1 }],
    delivers: { kind: 'specialPiece' },
  },
  toolBelt: {
    id: 'toolBelt',
    name: 'Tool Belt',
    tier: 'core',
    price: 6,
    modifiers: [{ kind: 'rule', key: 'supplySlots', add: 1 }],
    delivers: { kind: 'tool', rarity: 'common' },
  },
  draftingTable: {
    id: 'draftingTable',
    name: 'Drafting Table',
    tier: 'core',
    price: 7,
    modifiers: [{ kind: 'rule', key: 'blueprintSlots', add: 1 }],
    delivers: { kind: 'blueprintPick', rarity: 'common', options: 3 },
  },
  biggerTruck: {
    id: 'biggerTruck',
    name: 'Bigger Truck',
    tier: 'core',
    price: 8,
    modifiers: [{ kind: 'rule', key: 'roomsRow', add: 1 }], // a third Rooms card a week (D-121)
  },
  foreman: {
    id: 'foreman',
    name: 'Foreman',
    tier: 'core',
    price: 7,
    modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
  },
  // Not services or the refresh.
  supplierDiscount: {
    id: 'supplierDiscount',
    name: 'Supplier Discount',
    tier: 'core',
    price: 7,
    modifiers: [{ kind: 'rule', key: 'shopPricePct', pct: -25 }],
  },
  // +1 budget per 5 held at each milestone, up to 3.
  savingsAccount: {
    id: 'savingsAccount',
    name: 'Savings Account',
    tier: 'core',
    price: 6,
    modifiers: [{ kind: 'rule', key: 'interestMax', add: 3 }],
  },
};
