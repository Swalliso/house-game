// Where a card in the reserve's extra slots came from (M4b, D-160), as Your goods tags it and
// Inspect says it: the crew, a household member, the client, the standing stock, (D-188) the
// wrong delivery, (D-209) a company upgrade, or (D-205) the lot's wish. A card in the reserve's
// own slots (bought, picked or copied) says nothing. And the overtime weeks of a run lost in them.

import { describe, expect, it } from 'vitest';
import { rules, type Action, type RunState } from '../../rules/index.ts';
import { extraSlotWords, overtimeUsed } from './household.ts';

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
    // D-188: the wrong delivery, once a run; its note is as long as the stock's and the crew's.
    const pool = extraSlotWords('juniper', { id: 'pool', surprise: true })!;
    expect(pool).toEqual({
      tag: 'Mix-up',
      whose: ' (delivered by mistake)',
      from: 'Delivered by mistake',
      note: 'Delivered here by mistake: yours to keep, in an extra slot, not one of your reserve’s.',
    });
    expect(pool.note!.split(/\s+/)).toHaveLength(16);
    // D-205: the lot's wish's prize, named for the feature that paid it.
    expect(extraSlotWords('dale', { id: 'hotTub', wish: true }, undefined, 'pond')).toEqual({
      tag: 'Pond',
      whose: ' (from the Pond)',
      from: 'For keeping the Pond company',
    });
    expect(
      extraSlotWords('dale', { id: 'henhouse', wish: true }, 'architect', 'oldShed')!.tag,
    ).toBe('Old Shed');
  });

  it('say nothing for a bought card', () => {
    expect(extraSlotWords('dale', { id: 'library' })).toBeNull();
  });

  it('tag a company upgrade’s card by the upgrade (D-209), in the stock note’s 16 words', () => {
    const storage = extraSlotWords('dale', { id: 'library', upgrade: 'storageUnit' })!;
    expect(storage).toEqual({
      tag: 'Storage',
      whose: ' (from your Storage Unit)',
      from: 'From your Storage Unit',
      note: 'From your Storage Unit: an extra slot, not one of your reserve’s. Another comes each milestone.',
    });
    expect(storage.note!.split(/\s+/)).toHaveLength(16);
  });

  it('say only what they know of where a card came from', () => {
    // A card the crew started with (M4b), not one from its stock: it came once, so no note.
    for (const crew of [undefined, 'landscaper'] as const) {
      expect(extraSlotWords('hendersons', { id: 'fence', crew: true }, crew)).toEqual({
        tag: 'Crew',
        whose: ' (your crew’s)',
        from: 'Your crew’s, from the start',
      });
    }
    // Another client's member, and (D-205) a wish's prize before the run names the feature
    // that paid it: nothing, as for a bought card.
    expect(extraSlotWords('dale', { id: 'nursery', arrival: 'twins' })).toBeNull();
    expect(extraSlotWords('dale', { id: 'hotTub', wish: true })).toBeNull();
    // A feature's name of two words, whole in each.
    expect(extraSlotWords('dale', { id: 'henhouse', wish: true }, undefined, 'oldShed')).toEqual({
      tag: 'Old Shed',
      whose: ' (from the Old Shed)',
      from: 'For keeping the Old Shed company',
    });
  });
});

// Overtime weeks used (D-041, D-206), played to a run's end in them: overtime-clocks.test.ts sets
// the same end up by hand, and neighbor-ask.test.ts counts a run won in its last overtime week.
describe('overtime weeks used', () => {
  it('counts the overtime weeks of a run lost in them once', () => {
    // Nothing built, so the first milestone is missed after both overtime weeks.
    let s: RunState = rules.newRun({
      seed: 'overtime',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    for (let k = 0; k < 100 && s.screen !== 'lost'; k++) {
      const a: Action =
        s.screen === 'changeOrder' ? { t: 'answerChangeOrder', i: 0 } : { t: 'pass' };
      s = rules.apply(s, a).state;
    }
    expect(s).toMatchObject({ screen: 'lost', overtimeLeft: 0, overtimeWeek: 2 });
    expect(s.milestones).toMatchObject([{ phase: 0, result: 'failed', overtimeUsed: 2 }]);
    expect(overtimeUsed(s)).toBe(2);
  });
});
