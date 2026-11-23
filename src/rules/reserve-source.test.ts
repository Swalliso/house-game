// Where a reserve card came from (shop.ts' reserveSource): each extra slot's mark names its
// source, and only a card with none sits in the reserve's own slots. The marks are one list
// (shop.ts' EXTRA_MARKS, typed by ReservePiece), which inExtraSlot, the sim's counts, and Your
// goods' tags (household.ts) all read.

import { describe, expect, it } from 'vitest';
import type { ReservePiece, ReserveSource } from './index.ts';
import { inExtraSlot, reserveSource, reserveUsed } from './shop.ts';

/** One card for each mark a reserve card can carry, by the source it names. */
const MARKED: Record<Exclude<ReserveSource, 'own'>, ReservePiece> = {
  crew: { id: 'fence', crew: true },
  arrival: { id: 'nursery', arrival: 'twins' },
  client: { id: 'homeOffice', client: true },
  stock: { id: 'hallway', stock: true },
  surprise: { id: 'pool', surprise: true },
  upgrade: { id: 'library', upgrade: 'storageUnit' },
  wish: { id: 'hotTub', wish: true },
};

describe('reserveSource', () => {
  it.each(Object.entries(MARKED))(
    'a card marked %s comes from there, in an extra slot',
    (source, card) => {
      expect(reserveSource(card)).toBe(source);
      expect(inExtraSlot(card)).toBe(true);
    },
  );

  it('a bought, picked or copied card is its own, in the reserve’s own slots', () => {
    const card: ReservePiece = { id: 'library' };
    expect(reserveSource(card)).toBe('own');
    expect(inExtraSlot(card)).toBe(false);
  });

  it('only the cards in the reserve’s own slots count against them', () => {
    const own: ReservePiece[] = [{ id: 'library' }, { id: 'pool' }];
    expect(reserveUsed({ reserve: [...Object.values(MARKED), ...own] })).toBe(2);
    expect(reserveUsed({ reserve: Object.values(MARKED) })).toBe(0);
  });
});
