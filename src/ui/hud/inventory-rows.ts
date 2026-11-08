// Which rows the goods panel shows (M5a). Until the supply yard first opens there's nothing to
// keep, so an empty row stays out of the way; once it has opened (or in the shop itself) every
// row shows, empty slots included, so the player sees the room they have.

import type { RunState } from '../../rules/index.ts';

export interface InventoryRows {
  reserve: boolean;
  supplies: boolean;
  blueprints: boolean;
  /** The company's upgrades: only once there are some. */
  upgrades: boolean;
  /** Weekend Crew's free play, waiting to be used. */
  freePlay: boolean;
}

export function inventoryRows(s: RunState, shop: boolean): InventoryRows {
  const opened = shop || s.milestones.length > 0;
  return {
    reserve: opened || s.reserve.length > 0,
    supplies: opened || s.supplies.length > 0,
    blueprints: opened || s.blueprints.length > 0,
    upgrades: s.upgrades.length > 0,
    freePlay: s.freePlay === 'ready',
  };
}

/** Whether the panel has anything to show at all. */
export function showsInventory(rows: InventoryRows): boolean {
  return Object.values(rows).some(Boolean);
}
