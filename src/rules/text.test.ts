import { describe, expect, it } from 'vitest';
import {
  article,
  cardText,
  countedNames,
  definite,
  earnTargetText,
  effectText,
  glossary,
  modifierText,
  selectorText,
  sunSideText,
} from './text.ts';
import { TEST_CONTENT as C } from './testing.ts';
import { CONTENT } from '../content/index.ts';

describe('articles', () => {
  it('a possessive name takes none: "Grandma’s Room", but "a Kids’ Room"', () => {
    expect(article('Kitchen')).toBe('a Kitchen');
    expect(article('Office')).toBe('an Office');
    expect(article('Grandma’s Room')).toBe('Grandma’s Room');
    expect(article('Kids’ Room')).toBe('a Kids’ Room');
    // In a list, only the first name decides.
    expect(article('Bedroom, Nursery, or Grandma’s Room')).toBe(
      'a Bedroom, Nursery, or Grandma’s Room',
    );
    expect(definite('Kitchen')).toBe('the Kitchen');
    expect(definite('Bedroom', 'this')).toBe('this Bedroom');
    expect(definite('Grandma’s Room')).toBe('Grandma’s Room');
    expect(definite('Renfield’s Room', 'that')).toBe('Renfield’s Room');
    expect(definite('Kids’ Room')).toBe('the Kids’ Room');
  });
});

describe('modifier text', () => {
  it('says weight added to pieces the draw leaves out shows them at all: the Architect', () => {
    const [specials] = CONTENT.crews.architect.modifiers;
    expect(modifierText(CONTENT, specials!)).toBe(
      'Playrooms, Libraries, Mudrooms, and Pools show up in the weekly draw',
    );
    expect(
      modifierText(CONTENT, { kind: 'drawWeight', target: { piece: 'library' }, add: 20 }),
    ).toBe('Libraries show up in the weekly draw');
    // Pieces already in the draw come up more often.
    expect(
      modifierText(CONTENT, { kind: 'drawWeight', target: { piece: 'homeOffice' }, pct: 100 }),
    ).toBe('Home Offices come up more often (+100%)');
    expect(
      modifierText(CONTENT, { kind: 'drawWeight', target: { piece: 'bedroom' }, add: 5 }),
    ).toBe('Bedrooms come up more often (+5)');
  });

  it('names what an earn modifier is for, for telling breakdown lines apart', () => {
    expect(earnTargetText(C, { piece: 'pool' })).toBe('Pools');
    expect(earnTargetText(C, { tag: 'Dark' })).toBe('Dark pieces');
    expect(earnTargetText(C, { touching: { feature: 'tree' } })).toBe('touching a Tree');
    expect(earnTargetText(C, { all: [{ property: 'room' }, { tag: 'Sunny' }] })).toBe(
      'Sunny rooms',
    );
    expect(earnTargetText(C, { all: [{ host: true }, { piece: ['livingRoom', 'library'] }] })).toBe(
      'in a Living Room or Library',
    );
    // A fixture's own piece: its name says it all.
    expect(earnTargetText(C, { host: true })).toBeNull();
  });
});

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
      notes: ['Views: Trees, the Pond, the Creek, Flower Beds, Herb Gardens, and Greenhouses.'],
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

  it('says “while Sunny” for pay that needs the sun, and “in the sun” for its tiles (D-120)', () => {
    for (const id of ['kitchen', 'lKitchen', 'diningRoom', 'livingRoom'] as const) {
      expect(cardText(CONTENT, CONTENT.pieces[id]).effects, id).toContain(
        '+2 every week while Sunny',
      );
    }
    expect(cardText(CONTENT, CONTENT.pieces.sunroom).effects).toEqual([
      '+6 every week while Sunny',
    ]);
    expect(effectText(C, { kind: 'perTile', region: 'sunny', amount: 1 })).toBe(
      '+1 per tile in the sun',
    );
    // The sides as the job board and the checklist name them: the street is the front.
    expect((['top', 'left', 'right', 'bottom'] as const).map(sunSideText)).toEqual([
      'back',
      'left',
      'right',
      'front',
    ]);
    expect(glossary(CONTENT).sunny.title).toBe('Sunny');
  });

  it('counts names for breakdown labels', () => {
    expect(countedNames(['Tree', 'Tree', 'Bedroom', 'the Creek'])).toBe(
      '2 Trees, a Bedroom, and the Creek',
    );
    expect(countedNames(['Living Room'])).toBe('a Living Room');
    expect(countedNames(['Old Shed'])).toBe('an Old Shed');
  });
});
