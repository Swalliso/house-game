// The shop's shelves (M5a): a full inventory is said once in the shop, at the first shelf it
// blocks, and never on the cards; a card prints only a reason of its own.

import { describe, expect, it } from 'vitest';
import { SHOP_REASONS, type OfferView } from '../../rules/index.ts';
import { cardReason, fullReason, shelfReasons } from './shelves.ts';

let next = 0;
function offer(
  kind: 'blueprint' | 'piece' | 'fixture' | 'tool' | 'crate',
  reason?: string,
  sold = false,
): OfferView {
  const i = next++;
  const id = {
    blueprint: 'partyHouse',
    piece: 'henhouse',
    fixture: 'fireplace',
    tool: 'catalog',
    crate: 'fixtureCrate',
  }[kind];
  return {
    i,
    offer: { kind, id, sold } as OfferView['offer'],
    name: `${kind} ${i}`,
    price: 3,
    fullPrice: 3,
    onSale: false,
    ok: reason === undefined,
    reason,
  };
}

describe("the shop's shelves", () => {
  it('say each full inventory once, at the first shelf it blocks', () => {
    const blueprints = [
      offer('blueprint', SHOP_REASONS.blueprintsFull),
      offer('blueprint', SHOP_REASONS.blueprintsFull),
    ];
    const cards = [
      offer('piece', SHOP_REASONS.reserveFull),
      offer('fixture', SHOP_REASONS.suppliesFull),
    ];
    const tools = [offer('tool', SHOP_REASONS.suppliesFull)];
    const crates = [offer('crate', SHOP_REASONS.suppliesFull)];
    expect(shelfReasons([blueprints, cards, tools, crates])).toEqual([
      [SHOP_REASONS.blueprintsFull],
      [SHOP_REASONS.reserveFull, SHOP_REASONS.suppliesFull],
      [],
      [],
    ]);
  });

  it('leave out goods you can buy, and sold ones', () => {
    const sold = offer('blueprint', SHOP_REASONS.sold, true);
    expect(fullReason(sold)).toBeNull();
    expect(fullReason(offer('tool'))).toBeNull();
    expect(shelfReasons([[sold, offer('tool')]])).toEqual([[]]);
  });

  it('print on a card only a reason of its own: not a full inventory, its price, or its stamp', () => {
    expect(cardReason(offer('blueprint', SHOP_REASONS.blueprintsFull))).toBeNull();
    expect(cardReason(offer('tool', SHOP_REASONS.budget))).toBeNull();
    expect(cardReason(offer('blueprint', SHOP_REASONS.sold, true))).toBeNull();
    expect(cardReason(offer('blueprint', SHOP_REASONS.owned))).toBe(SHOP_REASONS.owned);
    expect(cardReason(offer('tool'))).toBeNull();
  });
});
