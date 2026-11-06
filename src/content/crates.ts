// Crates (Appendix B of implementation-plan.md; M3b): packs, as in Combolands and Balatro.
// Open one and keep 1 of 3. The Blueprint Folio and the Fixture Crate roll rarity with the
// shop's weights. The first shop's free Housewarming crate (3 Common blueprints) isn't sold,
// so it has no entry here: balance.ts sets its size.

import type { CrateDef, CrateId } from '../rules/index.ts';
import { PRICES } from './balance.ts';

export const CRATES: Readonly<Record<CrateId, CrateDef>> = {
  blueprintFolio: {
    id: 'blueprintFolio',
    name: 'Blueprint Folio',
    tier: 'core',
    price: PRICES.crate,
    contents: 'blueprint',
  },
  fixtureCrate: {
    id: 'fixtureCrate',
    name: 'Fixture Crate',
    tier: 'core',
    price: PRICES.crate,
    contents: 'fixture',
  },
  gardenCenter: {
    id: 'gardenCenter',
    name: 'Garden Center',
    tier: 'core',
    price: PRICES.crate,
    contents: 'piece',
    pool: 'all',
    filter: { any: [{ property: 'yard' }, { property: 'outbuilding' }] },
  },
  showroom: {
    id: 'showroom',
    name: 'Showroom',
    tier: 'core',
    price: PRICES.crate,
    contents: 'piece',
    pool: 'special',
  },
};
