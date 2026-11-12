// Which rows the goods panel shows (M5a). Until the supply yard first opens there's nothing to
// keep, so an empty row stays out of the way; once it has opened (or in the shop itself) every
// row shows, empty slots included, so the player sees the room they have.
//
// D-157: the types struck this run show too, once there are some: a Struck row, and folded, a
// count on the plank. While building they bring the panel in only with the hand dealt after the
// strike (store.ts struckAtDeal), so a strike never pushes the hand down under its stamp.

import { CONTENT, struckText, type RunState } from '../../rules/index.ts';
import type { IconName } from '../theme/art.ts';

export interface InventoryRows {
  reserve: boolean;
  supplies: boolean;
  blueprints: boolean;
  /** The company's upgrades: only once there are some. */
  upgrades: boolean;
  /** Weekend Crew's free play, waiting to be used. */
  freePlay: boolean;
  /** D-157: the types struck this run, once there are some. */
  struck: boolean;
}

/**
 * `struckAtDeal` is how many types were struck when this week's hand was dealt (store.ts): while
 * building, a type struck since shows from the next week's hand. The shop shows them as they are.
 */
export function inventoryRows(
  s: RunState,
  shop: boolean,
  struckAtDeal: number = s.struck.length,
): InventoryRows {
  const opened = shop || s.milestones.length > 0;
  return {
    reserve: opened || s.reserve.length > 0,
    supplies: opened || s.supplies.length > 0,
    blueprints: opened || s.blueprints.length > 0,
    upgrades: s.upgrades.length > 0,
    freePlay: s.freePlay === 'ready',
    struck: s.struck.length > 0 && (shop || struckAtDeal > 0),
  };
}

/** Whether the panel has anything to show at all. */
export function showsInventory(rows: InventoryRows): boolean {
  return Object.values(rows).some(Boolean);
}

/**
 * Whether the folded panel has nothing on its plank to use or read: on a short window it then
 * goes, as the empty rows do (inventory.css). Never with something struck (D-157): the count on
 * its plank is where the struck types are seen while building.
 */
export function foldedEmpty(s: RunState, rows: InventoryRows): boolean {
  return s.reserve.length === 0 && s.supplies.length === 0 && !rows.freePlay && !rows.struck;
}

/**
 * The folded plank's counts, each with its icon and its tip, and only when above 0: what's
 * waiting to be used in the reserve and the supplies, and how many types are struck this run
 * (D-157). Once the plank shows, the struck count is the run's as it stands.
 */
export function foldCounts(s: RunState): readonly [IconName, number, string][] {
  const counts: readonly [IconName, number, string][] = [
    ['House', s.reserve.length, `${s.reserve.length} in the reserve`],
    ['tool', s.supplies.length, `${s.supplies.length} in the supplies`],
    ['strike', s.struck.length, struckText(CONTENT, s.struck) ?? ''],
  ];
  return counts.filter(([, n]) => n > 0);
}
