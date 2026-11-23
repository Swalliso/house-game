import { describe, expect, it } from 'vitest';
import {
  article,
  cardText,
  countedNames,
  definite,
  earnTargetText,
  effectText,
  fixtureText,
  glossary,
  HAND_LINE_CHARS,
  handCardLines,
  modifierText,
  selectorText,
  setProgressText,
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

  it('says a fixture’s grant to its own piece adds to what the piece earns (D-194)', () => {
    const grant = {
      kind: 'grantEffect',
      target: { host: true },
      effect: { kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 },
    } as const;
    expect(modifierText(CONTENT, grant)).toBe('+2 more per touching Dining Room or Herb Garden');
    // A grant to other pieces names them, as before (Good Bones).
    expect(modifierText(CONTENT, { ...grant, target: { property: 'room' } })).toBe(
      'Rooms: +2 per touching Dining Room or Herb Garden',
    );
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
      notes: [
        'Views: Trees, the Pond, the Creek, the Lake, Flower Beds, Herb Gardens, and Greenhouses.',
      ],
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
      // Two names say "touching" only within the budget (D-148, 2026-11-11): "+2 per touching
      // Dining Room or Herb Garden" runs 42 letters, five lines beside a 2× thumbnail. The
      // Patio's below too.
      kitchen: ['+2 per Dining Room or Herb Garden'],
      lKitchen: ['+2 per Dining Room or Herb Garden'],
      // An aura leads with what it gives (D-148): "Touching Kitchens and…" lost its +50%. Its
      // "touching" line for two names ran 39 letters, four lines at 1280×720. For a tag (D-201)
      // it says the tag, as the Library's does: "touching Social pieces" took a fourth row beside
      // a 2× thumbnail, and put a fourth card under the bar at 1440×900 and 1470×840 at 2×.
      diningRoom: ['+50% to touching Social'],
      livingRoom: ['+2 per touching view (up to 3)'],
      closet: ['+1 every week'],
      // Playtest 4's fix (D-114), behind "Links the rooms it touches…" before this.
      hallway: ['+2 per touching room (up to 4)'],
      longHallway: ['+2 per touching room (up to 4)'],
      // Built like any room (D-140), so its drive is about pay: what it earns there, in one
      // short line ("…if touching the street or a Driveway" lost its last words). D-195: +2 of
      // it comes anywhere, which Inspect says ("+2, +5 by…" runs a letter over the budget).
      garage: ['+5 by the street or a Driveway'],
      homeOffice: ['+2 every week'],
      lawn: ['+1 every week'],
      sapling: ['+1 every week'],
      flowerBed: ['+1 every week'],
      herbGarden: ['+1 per tile in the sun'],
      // Its "if touching a room" doesn't fit after the pay (D-148): Inspect and the lot's
      // warning say it. The Hot Tub's and the Fire Pit's too. "+2 per touching Living Room or
      // Kitchen" (38 letters) fit whole, but its extra row put fourth cards under the Pass bar;
      // the Social rooms' line (D-201) runs 27.
      patio: ['+2 per touching Social room'],
      fence: ['+1 per fenced tile (up to +6)'],
      // Its job (D-140), not "Must be built touching the street or a Driveway" or its +1.
      driveway: ['+3 if touching a Garage'],
      // A requirement that isn't about placement follows the pay where both fit: without it,
      // nothing.
      doghouse: ['+1 every week in a fenced yard'],
      treehouse: ['+2 every week'],
      greenhouse: ['+50% to touching yard views'],
      playroom: ['+2 per touching Bedroom'],
      library: ['+2 per touching Quiet (up to 3)'],
      mudroom: ['+50% to fenced Pet pieces'],
      pool: ['+12 every 3rd week'],
      sunroom: ['+6 every week while Sunny'],
      // D-195: "+3 per touching Patio, Pool, or Fire Pit" runs 41 letters.
      hotTub: ['+3 per Patio, Pool, or Fire Pit'],
      // The Dining Room's line (D-201), from D-195's "+50% to touching Social pieces".
      firePit: ['+50% to touching Social'],
      henhouse: ['+1 budget every 2nd week'],
      birdhouse: ['+1 per touching Tree (up to 3)'],
      porch: ['+25% to touching rooms'],
      // D-171: the Architect's card, which only ever waits in Your goods.
      addition: ['+8 to the room it grows'],
    });
    // Each leads with its number (D-148), so a line cut short still shows what the card pays.
    for (const p of pieces) {
      const [line] = handCardLines(CONTENT, { kind: 'piece', id: p.id });
      expect(line, p.id).toMatch(/^[+−]\d/);
    }
  });

  it('shows where a fixture goes and what it does to its room', () => {
    const shown = Object.fromEntries(
      fixtures.map((f) => [f.id, handCardLines(CONTENT, { kind: 'fixture', id: f.id })]),
    );
    expect(shown).toEqual({
      fireplace: ['Fits most rooms', 'Earns +50%'],
      skylight: ['Fits any room', 'Makes it Sunny'],
      blackoutCurtains: ['Fits most rooms', 'Makes it Dark'],
      // Who is Loud, and "can’t take points off it", are in Inspect (D-148).
      soundproofing: ['Fits any room', 'Loud neighbors can’t lower it'],
      // What it earns (D-148): "Counts as a Dining Room too" read as an Entertainer or the
      // Hendersons' wish, and it fills neither.
      kitchenIsland: ['Fits a Kitchen', 'Earns +25%'],
      bunkBeds: ['Fits a Bedroom', 'Counts as 2 Bedrooms'],
      bayWindow: ['Fits most exterior rooms', 'Gives it a view'],
      sprinkler: ['Fits a Lawn', 'Earns +100%'],
      pergola: ['Fits a Patio or Lawn', 'Gives it a view'],
      gardenLights: ['Fits any yard piece', 'Makes it Pretty'],
    });
    // One the draw never deals (the Catalog's hand can): its set, in a few words.
    expect(handCardLines(CONTENT, { kind: 'fixture', id: 'chandelier' })).toEqual([
      'Fits a Dining Room or Living Room',
      '×1.25 Charm in an Entertainer',
    ]);
  });

  // The hand's wording is its own (D-148). The budget is today's longest line (the Kitchen's,
  // which fits whole at every window size measured on 2026-11-11: three lines, four beside a 2×
  // thumbnail), so this keeps a new line from running longer; the maps above pin the wording.
  // Every card the game has, members' rooms and the fixtures the draw never deals too.
  it(`keeps every line to ${HAND_LINE_CHARS} characters`, () => {
    const cards = [
      ...Object.values(CONTENT.pieces).map((p) => ({ kind: 'piece' as const, id: p.id })),
      ...Object.values(CONTENT.fixtures).map((f) => ({ kind: 'fixture' as const, id: f.id })),
    ];
    for (const card of cards) {
      for (const line of handCardLines(CONTENT, card)) {
        expect(line.length, `${card.id}: “${line}”`).toBeLessThanOrEqual(HAND_LINE_CHARS);
      }
    }
  });

  it('keeps the full sentences for Inspect and the shop', () => {
    expect(cardText(CONTENT, CONTENT.pieces.diningRoom).effects[0]).toBe(
      'Touching Social neighbors earn +50%',
    );
    expect(cardText(CONTENT, CONTENT.pieces.patio).effects).toContain(
      'Earns nothing unless touching a room',
    );
    expect(fixtureText(CONTENT, CONTENT.fixtures.soundproofing).effects).toEqual([
      'Loud neighbors (the street, Garages, Playrooms, and Pools) can’t take points off it',
      'Earns +25%',
    ]);
  });

  // D-194: each of the five says what it pays in any room or yard piece it fits.
  it('says what the five fixtures of D-194 pay wherever they fit', () => {
    const effects = (id: keyof typeof CONTENT.fixtures) =>
      fixtureText(CONTENT, CONTENT.fixtures[id]).effects;
    expect(effects('soundproofing')).toContain('Earns +25%');
    expect(effects('bayWindow')).toEqual([
      'Gives it a view, which counts as one more view',
      'Earns +25%',
    ]);
    expect(effects('gardenLights')).toEqual([
      'Makes it Pretty',
      'Earns +25%',
      '+25% more in the front yard',
    ]);
    // The Island's grant is a line its Kitchen (and an L-Kitchen) already has: the card names it.
    expect(effects('kitchenIsland')).toEqual([
      'Earns +25%',
      'Doubles its +2 per touching Dining Room or Herb Garden',
    ]);
    expect(fixtureText(CONTENT, CONTENT.fixtures.pergola).fits).toBe('Fits a Patio or Lawn');
    // A grant its rooms don't have on their cards just adds: "+3 more per…".
    const island = CONTENT.fixtures.kitchenIsland;
    const other = {
      ...island,
      modifiers: [
        {
          kind: 'grantEffect' as const,
          target: { host: true as const },
          effect: { kind: 'neighbor' as const, match: { piece: 'livingRoom' as const }, amount: 3 },
        },
      ],
    };
    expect(fixtureText(CONTENT, other).effects).toEqual(['+3 more per touching Living Room']);
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
    // D-164: yard pieces and outbuildings name their yard sets; a Lawn is in three.
    expect(setsOfPiece(CONTENT, 'patio')).toEqual(['backyard']);
    expect(setsOfPiece(CONTENT, 'lawn')).toEqual(['backyard', 'dogRun', 'playYard']);
    expect(setsOfPiece(CONTENT, 'garage')).toEqual(['driveIn', 'fullHouse']);
    expect(setsOfPiece(CONTENT, 'sapling')).toEqual([]);
  });

  it('says what a set needs and pays', () => {
    expect(setText(CONTENT, 'suite')).toBe(
      'Suite: a Bedroom, a Bathroom, and a Closet, touching. +15 Comfort and +0.5 Charm every week. A house can have more than one, each with its own rooms.',
    );
    expect(setText(CONTENT, 'jackAndJill')).toContain(
      '2 Bedrooms and a Bathroom, each touching the Bathroom',
    );
    expect(setText(CONTENT, 'fullHouse')).toContain(
      'anywhere in the house. +40 Comfort, +1 Charm, and ×1.5 Sparkle every week. One per house.',
    );
  });

  it('says how far the house is toward Full House (D-153)', () => {
    const p = { set: 'fullHouse', have: 7, need: 9, held: false } as const;
    expect(setProgressText(CONTENT, { ...p, missing: ['garage', 'homeOffice'] })).toBe(
      'Your house has 7 of the 9. Still to build: a Garage and a Home Office.',
    );
    // One type short reads the same: no star, and no word of a card that would complete it.
    expect(setProgressText(CONTENT, { ...p, have: 8, missing: ['hallway'] })).toBe(
      'Your house has 8 of the 9. Still to build: a Hallway.',
    );
    expect(setProgressText(CONTENT, { ...p, have: 9, missing: [], held: true })).toBe(
      'Your house has it.',
    );
  });

  it('the glossary names the Sparkle set at the content’s number, and the Garage’s drive (D-140, D-195)', () => {
    const g = glossary(CONTENT);
    // Generated from the set, so a tuned number can't leave "×2" behind.
    expect(g.sparkle.text).toBe(
      'Multiplies Charm itself. Rare: the Full House set (×1.5) and a few Rare goods have it, and each needs a setup. Each source counts once a week.',
    );
    // D-195: the Garage earns +2 off its drive, so it isn't among the pieces that earn nothing
    // without something; its garage sales still count for the budget.
    expect(g.requirement.text).not.toContain('Garage');
    expect(g.budget.text).toContain('from Garage and Home Office');
    // The Garage's card says it plainly: built like any room, +2 anywhere, and the rest once
    // it's reached, each line with what it waits for.
    expect(cardText(CONTENT, CONTENT.pieces.garage).effects).toEqual([
      '+2 every week',
      '+3 every week if touching the street or a Driveway',
      '+1 budget every 2nd week if touching the street or a Driveway',
      '+3 if touching the Old Shed and the street or a Driveway', // D-145
    ]);
    expect(cardText(CONTENT, CONTENT.pieces.driveway).effects).toEqual([
      'Must be built touching the street or a Driveway',
      '+3 if touching a Garage',
      '+2 every week in the front yard', // D-166
    ]);
  });
});
