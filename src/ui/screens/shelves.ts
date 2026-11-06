// What the shop's shelves say about goods you can't buy (M5a). Full slots are about your goods,
// not a card, so each such reason is said once in the shop, at the first shelf it blocks, and
// the cards it blocks read Full. A shortfall in budget shows as the price's color, and a sold
// good as its stamp, so those aren't said on the card either. The reasons are the rules' own
// text (SHOP_REASONS); the UI only sorts them.

import { SHOP_REASONS, type OfferView } from '../../rules/index.ts';

/** The reasons that are about your goods, not the card. */
export const FULL_REASONS: ReadonlySet<string> = new Set([
  SHOP_REASONS.blueprintsFull,
  SHOP_REASONS.reserveFull,
  SHOP_REASONS.suppliesFull,
]);

/** The reasons a card's price, stamp, or the open crate already say. */
export const QUIET_REASONS: ReadonlySet<string> = new Set([
  SHOP_REASONS.budget,
  SHOP_REASONS.sold,
  SHOP_REASONS.picking,
]);

export function isSold(o: OfferView): boolean {
  return o.offer.kind !== 'service' && !!o.offer.sold;
}

/** Why full slots keep you from buying this good, if they do. */
export function fullReason(o: OfferView): string | null {
  return !o.ok && !isSold(o) && o.reason && FULL_REASONS.has(o.reason) ? o.reason : null;
}

/** The reason to print on the card itself, if any: one only it has. */
export function cardReason(o: OfferView): string | null {
  if (o.ok || isSold(o) || !o.reason) return null;
  return FULL_REASONS.has(o.reason) || QUIET_REASONS.has(o.reason) ? null : o.reason;
}

/**
 * For each shelf (in order), the full-slot reasons to say at its tag: each reason once in the
 * shop, at the first shelf it blocks. Pieces and fixtures share a shelf, so one can say two.
 */
export function shelfReasons(shelves: readonly (readonly OfferView[])[]): string[][] {
  const said = new Set<string>();
  return shelves.map((offers) => {
    const here = [...new Set(offers.flatMap((o) => fullReason(o) ?? []))];
    const fresh = here.filter((r) => !said.has(r));
    for (const r of fresh) said.add(r);
    return fresh;
  });
}
