import { describe, expect, it } from 'vitest';
import {
  article,
  cardText,
  countedNames,
  definite,
  earnTargetText,
  effectText,
  glossary,
  handCardLines,
  modifierText,
  selectorText,
  setsOfPiece,
  setText,
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

describe('a compact hand card (D-121)', () => {
  // Every card the hand can hold, the Catalog's special pieces too, and each drawable fixture:
  // what its compact card shows. A new card shows up here as a line to check.
  const pieces = Object.values(CONTENT.pieces).filter((p) => !p.member);
  const fixtures = Object.values(CONTENT.fixtures).filter((f) => f.drawWeight > 0);

  it('shows what a piece pays, not its link or where it must go', () => {
    const shown = Object.fromEntries(
      pieces.map((p) => [p.id, handCardLines(CONTENT, { kind: 'piece', id: p.id })]),
    );
    expect(shown).toEqual({
      bedroom: ['+3 every week'],
      bathroom: ['+3 if touching a Bedroom'],
      kitchen: ['+2 per touching Dining Room or Herb Garden'],
      lKitchen: ['+2 per touching Dining Room or Herb Garden'],
      diningRoom: ['Touching Kitchens and Living Rooms earn +50%'],
      livingRoom: ['+2 per touching view (up to 3)'],
      closet: ['+1 every week'],
      // Playtest 4's fix (D-114), behind "Links the rooms it touches…" before this.
      hallway: ['+2 per touching room (up to 4)'],
      longHallway: ['+2 per touching room (up to 4)'],
      // Built like any room (D-140), so its requirement is about pay: both in one short line,
      // which fits the card's two lines ("…if touching the street or a Driveway" didn't).
      garage: ['+5 by the street or a Driveway'],
      homeOffice: ['+2 every week'],
      lawn: ['+1 every week'],
      sapling: ['+1 every week'],
      flowerBed: ['+1 every week'],
      herbGarden: ['+1 per tile in the sun'],
      // A requirement that isn't about placement follows the pay: without it, nothing.
      patio: ['+2 per touching Living Room or Kitchen if touching a room'],
      fence: ['+1 per tile of the fenced yards it borders (up to +6)'],
      // Its job (D-140), not "Must be built touching the street or a Driveway" or its +1.
      driveway: ['+3 if touching a Garage'],
      doghouse: ['+1 every week in a fenced yard'],
      treehouse: ['+2 every week'],
      greenhouse: ['Touching yard pieces that give a view earn +50%'],
      playroom: ['+2 per touching Bedroom'],
      library: ['+2 per touching Quiet neighbor (up to 3)'],
      mudroom: ['Pet pieces in the fenced yard it borders earn +50%'],
      pool: ['+12 every 3rd week'],
      sunroom: ['+6 every week while Sunny'],
      hotTub: ['+3 per touching Patio if touching a room'],
      firePit: ['Touching Patios earn +50% if touching a room'],
      henhouse: ['+1 budget every 2nd week'],
      birdhouse: ['+1 per touching Tree (up to 3)'],
      porch: ['Touching rooms earn +25%'],
    });
    // Each is one of the card's own lines (or one with its requirement after it), with a number.
    for (const p of pieces) {
      const [line] = handCardLines(CONTENT, { kind: 'piece', id: p.id });
      const own = cardText(CONTENT, p).effects;
      // The Garage's is its "+5 every week" and its requirement, said shorter (D-140).
      expect(p.id === 'garage' || own.some((l) => line!.startsWith(l)), p.id).toBe(true);
      expect(line, p.id).toMatch(/[+−]\d/);
      expect(line, p.id).not.toMatch(/^(Links|Must|Earns nothing|Becomes)/);
    }
  });

  it('shows where a fixture goes and what it does to its room', () => {
    const shown = Object.fromEntries(
      fixtures.map((f) => [f.id, handCardLines(CONTENT, { kind: 'fixture', id: f.id })]),
    );
    expect(shown).toEqual({
      fireplace: ['Fits any room', 'Earns +50%'],
      skylight: ['Fits any room', 'Makes it Sunny'],
      blackoutCurtains: ['Fits any room', 'Makes it Dark'],
      soundproofing: [
        'Fits any room',
        'Loud neighbors (the street, Garages, Playrooms, and Pools) can’t take points off it',
      ],
      kitchenIsland: ['Fits a Kitchen', 'Counts as a Dining Room too'],
      bunkBeds: ['Fits a Bedroom', 'Counts as 2 Bedrooms for the client'],
      bayWindow: ['Fits an exterior room', 'Gives it a view, which counts as one more view'],
      sprinkler: ['Fits a Lawn', 'Earns +100%'],
      pergola: ['Fits a Patio', 'Gives it a view, which counts as one more view'],
      gardenLights: ['Fits any yard piece', 'Makes it Pretty'],
    });
  });

  it('falls back to the first line when nothing pays', () => {
    const linkOnly = { ...CONTENT.pieces.hallway, effects: [{ kind: 'link' as const }] };
    const content = { ...CONTENT, pieces: { ...CONTENT.pieces, hallway: linkOnly } };
    expect(handCardLines(content, { kind: 'piece', id: 'hallway' })).toEqual([
      'Links the rooms it touches: they count as touching each other',
    ]);
    // A penalty isn't pay: a Bedroom with only its Loud penalty shows that.
    const grumpy = {
      ...CONTENT.pieces.bedroom,
      effects: CONTENT.pieces.bedroom.effects.filter((e) => e.kind === 'neighbor' && e.amount < 0),
    };
    const content2 = { ...CONTENT, pieces: { ...CONTENT.pieces, bedroom: grumpy } };
    expect(handCardLines(content2, { kind: 'piece', id: 'bedroom' })).toEqual([
      '−2 per touching Loud neighbor',
    ]);
  });
});

describe('set chips (D-122)', () => {
  it("names a piece's sets, touching ones first, an L-Kitchen's as a Kitchen's", () => {
    expect(setsOfPiece(CONTENT, 'closet')).toEqual(['suite', 'fullHouse']);
    expect(setsOfPiece(CONTENT, 'bedroom')).toEqual(['jackAndJill', 'suite', 'fullHouse']);
    expect(setsOfPiece(CONTENT, 'lKitchen')).toEqual(setsOfPiece(CONTENT, 'kitchen'));
    expect(setsOfPiece(CONTENT, 'patio')).toEqual([]);
  });

  it('says what a set needs and pays', () => {
    expect(setText(CONTENT, 'suite')).toBe(
      'Suite: a Bedroom, a Bathroom, and a Closet, touching. +15 Comfort and +0.5 Charm every week. A house can have more than one.',
    );
    expect(setText(CONTENT, 'jackAndJill')).toContain(
      '2 Bedrooms and a Bathroom, each touching the Bathroom',
    );
    expect(setText(CONTENT, 'fullHouse')).toContain(
      'anywhere in the house. +40 Comfort, +1 Charm, and ×1.5 Sparkle every week. One per house.',
    );
  });

  it('the glossary names the Sparkle set at the content’s number, and the Garage’s requirement (D-140)', () => {
    const g = glossary(CONTENT);
    // Generated from the set, so a tuned number can't leave "×2" behind.
    expect(g.sparkle.text).toBe(
      'Multiplies Charm itself. Rare: the Full House set (×1.5) and a few Rare goods have it, and each needs a setup. Each source counts once a week.',
    );
    expect(g.requirement.text).toContain('a Garage touching the street or a Driveway');
    // The Garage's card says it plainly: built like any room, paid once it's reached.
    expect(cardText(CONTENT, CONTENT.pieces.garage).effects).toEqual([
      'Earns nothing unless touching the street or a Driveway',
      '+5 every week',
      '+1 budget every 2nd week',
      '+3 if touching the Old Shed', // D-145
    ]);
    expect(cardText(CONTENT, CONTENT.pieces.driveway).effects).toEqual([
      'Must be built touching the street or a Driveway',
      '+3 if touching a Garage',
      '+1 every week',
    ]);
  });
});
