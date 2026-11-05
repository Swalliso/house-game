import { describe, expect, it } from 'vitest';
import { cardText, countedNames, effectText, selectorText } from './text.ts';
import { TEST_CONTENT as C } from './testing.ts';

describe('card text', () => {
  it('reads like a sentence for each effect kind', () => {
    expect(cardText(C, C.pieces.bedroom)).toEqual({
      effects: [
        '+3 every week',
        '+1 per touching Tree or Quiet neighbor (up to 3)',
        '−2 per touching Loud neighbor',
      ],
      notes: ['Trees are Quiet.', 'The street is Loud.'],
    });
    expect(cardText(C, C.pieces.bathroom).effects).toEqual([
      '+3 if touching a Bedroom',
      '−2 per touching Kitchen',
    ]);
    expect(cardText(C, C.pieces.diningRoom).effects).toEqual([
      'Touching Kitchens and Living Rooms earn +50%',
    ]);
    expect(cardText(C, C.pieces.livingRoom)).toEqual({
      effects: ['+2 per touching view (up to 3)'],
      notes: ['Views: Trees, the Pond, and the Creek.'],
    });
    expect(cardText(C, C.pieces.lawn).effects).toEqual([
      '+1 every week',
      '+1 per touching Lawn (up to 4)',
    ]);
  });

  it('phrases selectors', () => {
    expect(selectorText(C, { piece: ['kitchen', 'livingRoom'] }, 'one')).toBe(
      'Kitchen or Living Room',
    );
    expect(selectorText(C, { feature: 'pond' }, 'some')).toBe('the Pond');
    expect(selectorText(C, { all: [{ tag: 'Sunny' }, { property: 'room' }] }, 'some')).toBe(
      'Sunny rooms',
    );
    expect(selectorText(C, { not: { tag: 'Quiet' } })).toBe('anything but Quiet neighbors');
    expect(
      effectText(C, { kind: 'aura', match: { tag: 'Quiet' }, scope: 'adjacent', amount: -2 }),
    ).toBe('Touching Quiet neighbors get −2');
  });

  it('counts names for breakdown labels', () => {
    expect(countedNames(['Tree', 'Tree', 'Bedroom', 'the Creek'])).toBe(
      '2 Trees, a Bedroom, and the Creek',
    );
    expect(countedNames(['Living Room'])).toBe('a Living Room');
    expect(countedNames(['Old Shed'])).toBe('an Old Shed');
  });
});
