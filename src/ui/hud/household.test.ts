// Where a card in the reserve's extra slots came from (M4b, D-160), as Your goods tags it and
// Inspect says it: the crew, a household member, the client, or the standing stock. A card in
// the reserve's own slots (bought, picked or copied) says nothing.

import { describe, expect, it } from 'vitest';
import { extraSlotWords } from './household.ts';

describe('an extra slot’s words', () => {
  it('tag each card by where it came from', () => {
    expect(extraSlotWords('hendersons', { id: 'fence', crew: true })).toMatchObject({
      tag: 'Crew',
      whose: ' (your crew’s)',
    });
    // D-171: a card from the crew's own stock says another comes, in the stock note's 16 words.
    const lawn = extraSlotWords('hendersons', { id: 'lawn', crew: true }, 'landscaper')!;
    expect(lawn).toEqual({
      tag: 'Crew',
      whose: ' (your crew’s)',
      from: 'From your crew',
      note: 'From your crew, in an extra slot, not one of your reserve’s. Another comes each milestone.',
    });
    expect(lawn.note!.split(/\s+/)).toHaveLength(16);
    expect(extraSlotWords('hendersons', { id: 'addition', crew: true }, 'architect')!.note).toBe(
      lawn.note,
    );
    expect(extraSlotWords('hendersons', { id: 'nursery', arrival: 'twins' })).toEqual({
      tag: 'Twins',
      whose: ' (with the twins)',
      from: 'Came with the twins',
    });
    expect(extraSlotWords('dale', { id: 'homeOffice', client: true })).toEqual({
      tag: 'Dale',
      whose: ' (Dale’s)',
      from: 'Dale brought it',
    });
    expect(extraSlotWords('barkers', { id: 'doghouse', client: true })).toEqual({
      tag: 'Barkers',
      whose: ' (the Barkers’)',
      from: 'The Barkers brought it',
    });
    expect(extraSlotWords('dale', { id: 'hallway', stock: true })).toMatchObject({
      tag: 'Stock',
      whose: ' (from your stock)',
      // D-169: refilled at each milestone, in as many words as the others' notes (16).
      note: 'From your stock, in an extra slot, not one of your reserve’s. Another comes each milestone.',
    });
  });

  it('say nothing for a bought card', () => {
    expect(extraSlotWords('dale', { id: 'library' })).toBeNull();
  });
});
