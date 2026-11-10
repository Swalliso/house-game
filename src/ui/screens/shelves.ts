// What the shop's shelves say about goods you can't buy (M5a). Full slots are about your goods,
// not a card, so each shelf says such a reason once, at its plank tag, and the cards it blocks
// read Full. A shortfall in budget shows on the card as its price's color and a Buy that reads
// "Need 2" (never the color alone), and a sold good as its stamp, so those aren't printed as
// sentences on the card either. The reasons are the rules' own text (SHOP_REASONS); the UI only
// sorts them.

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

/** How much more budget a good needs, when the budget is all that keeps you from it (else 0). */
export function shortBy(o: OfferView, budget: number): number {
  return !o.ok && !isSold(o) && o.reason === SHOP_REASONS.budget
    ? Math.max(0, o.price - budget)
    : 0;
}

/** The reason to print on the card itself, if any: one only it has. */
export function cardReason(o: OfferView): string | null {
  if (o.ok || isSold(o) || !o.reason) return null;
  return FULL_REASONS.has(o.reason) || QUIET_REASONS.has(o.reason) ? null : o.reason;
}

/** A full-slots reason as a shelf says it. */
export interface ShelfNote {
  reason: string;
  /** The reason in full the first time the shop says it; on later shelves its first sentence. */
  text: string;
}

/** A reason's first sentence: "Your supplies are full." of "… full. Use or sell one first." */
function firstSentence(reason: string): string {
  return reason.split(/(?<=\.)\s/)[0] ?? reason;
}

/**
 * For each shelf (in order), the full-slot reasons to say at its tag: each reason that blocks any
 * of its goods, once per shelf, so a Full card always has its reason on its own shelf. Pieces
 * and fixtures share a shelf, so one can say two. A reason an earlier shelf already said in full
 * is said again by its first sentence, so a narrow shelf (a lone crate) isn't buried under the
 * advice.
 */
export function shelfReasons(shelves: readonly (readonly OfferView[])[]): ShelfNote[][] {
  const said = new Set<string>();
  return shelves.map((offers) =>
    [...new Set(offers.flatMap((o) => fullReason(o) ?? []))].map((reason) => {
      const text = said.has(reason) ? firstSentence(reason) : reason;
      said.add(reason);
      return { reason, text };
    }),
  );
}
