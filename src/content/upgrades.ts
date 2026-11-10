// Company upgrades (Appendix B of implementation-plan.md; M3b): Balatro's vouchers. One is
// offered per visit from the second shop, pricier than other goods and permanent for the run.
// Each is a `rule` modifier. Prices are Appendix A's 6–8 placeholders.

import type { UpgradeDef, UpgradeId } from '../rules/index.ts';

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  storageUnit: {
    id: 'storageUnit',
    name: 'Storage Unit',
    tier: 'core',
    price: 6,
    modifiers: [{ kind: 'rule', key: 'reserveSlots', add: 1 }],
  },
  toolBelt: {
    id: 'toolBelt',
    name: 'Tool Belt',
    tier: 'core',
    price: 6,
    modifiers: [{ kind: 'rule', key: 'supplySlots', add: 1 }],
  },
  draftingTable: {
    id: 'draftingTable',
    name: 'Drafting Table',
    tier: 'core',
    price: 7,
    modifiers: [{ kind: 'rule', key: 'blueprintSlots', add: 1 }],
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
