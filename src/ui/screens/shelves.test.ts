// The shop's shelves (M5a): a full inventory is said once per shelf it blocks, at the shelf's
// tag (in full the first time, by its first sentence after), and never on the cards; a card
// prints only a reason of its own, and a shortfall in budget is its Buy's "Need N".

import { describe, expect, it } from 'vitest';
import { SHOP_REASONS, type OfferView } from '../../rules/index.ts';
import { cardReason, fullReason, shelfReasons, shortBy } from './shelves.ts';

let next = 0;
function offer(
  kind: 'blueprint' | 'piece' | 'fixture' | 'tool' | 'crate',
  reason?: string,
  sold = false,
  price = 3,
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
    price,
    fullPrice: price,
    onSale: false,
    ok: reason === undefined,
    reason,
  };
}

describe("the shop's shelves", () => {
  it('say each full inventory once on every shelf it blocks', () => {
    const blueprints = [
      offer('blueprint', SHOP_REASONS.blueprintsFull),
      offer('blueprint', SHOP_REASONS.blueprintsFull),
    ];
    const cards = [
      offer('piece', SHOP_REASONS.reserveFull),
      offer('fixture', SHOP_REASONS.suppliesFull),
    ];
    const tools = [offer('tool', SHOP_REASONS.suppliesFull), offer('tool')];
    const crates = [offer('crate', SHOP_REASONS.suppliesFull)];
    const said = shelfReasons([blueprints, cards, tools, crates]);
    expect(said.map((notes) => notes.map((n) => n.reason))).toEqual([
      [SHOP_REASONS.blueprintsFull],
      [SHOP_REASONS.reserveFull, SHOP_REASONS.suppliesFull],
      [SHOP_REASONS.suppliesFull],
      [SHOP_REASONS.suppliesFull],
    ]);
    // In full the first time, then by its first sentence.
    expect(said[1]![1]!.text).toBe(SHOP_REASONS.suppliesFull);
    expect(said[2]![0]!.text).toBe('Your supplies are full.');
    expect(said[3]![0]!.text).toBe('Your supplies are full.');
    expect(said[0]![0]!.text).toBe(SHOP_REASONS.blueprintsFull);
  });

  it('leave out goods you can buy, and sold ones', () => {
    const sold = offer('blueprint', SHOP_REASONS.sold, true);
    expect(fullReason(sold)).toBeNull();
    expect(fullReason(offer('tool'))).toBeNull();
    expect(shelfReasons([[sold, offer('tool')]])).toEqual([[]]);
    expect(shelfReasons([[], [offer('tool')]])).toEqual([[], []]);
  });

  it('say how much more budget a good needs, only when the budget is what stops it', () => {
    expect(shortBy(offer('tool', SHOP_REASONS.budget, false, 7), 5)).toBe(2);
    expect(shortBy(offer('tool', undefined, false, 7), 9)).toBe(0);
    expect(shortBy(offer('tool', SHOP_REASONS.suppliesFull, false, 7), 5)).toBe(0);
    expect(shortBy(offer('blueprint', SHOP_REASONS.sold, true, 7), 5)).toBe(0);
  });

  it('print on a card only a reason of its own: not a full inventory, its price, or its stamp', () => {
    expect(cardReason(offer('blueprint', SHOP_REASONS.blueprintsFull))).toBeNull();
    expect(cardReason(offer('tool', SHOP_REASONS.budget))).toBeNull();
    expect(cardReason(offer('blueprint', SHOP_REASONS.sold, true))).toBeNull();
    expect(cardReason(offer('blueprint', SHOP_REASONS.owned))).toBe(SHOP_REASONS.owned);
    expect(cardReason(offer('tool'))).toBeNull();
  });
});
