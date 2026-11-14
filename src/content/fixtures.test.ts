// One test per fixture (Appendix B · Fixtures; D-050, D-056, D-082), against the real content:
// what each one does to its host on a small hand-built lot, where it fits (checkInstall), its
// generated text, and its rarity, price, and draw weight. Numbers here follow fixtures.ts and
// pieces.ts; when tuning changes a number, change the test with it.

import { describe, expect, it } from 'vitest';
import type { BlueprintId, FixtureId, HouseState, PieceId, Rarity, Tally } from '../rules/index.ts';
import { drawWeights } from '../rules/draw.ts';
import { checkInstall, withFixture } from '../rules/fixtures.ts';
import { computeLayout, isLayoutModifier, isRoom, type Layout } from '../rules/layout.ts';
import { runModifiers } from '../rules/modifiers.ts';
import { NO_CONTEXT, tallyHouse } from '../rules/scoring.ts';
import { matchesDef, rootType } from '../rules/selectors.ts';
import { fixtureText } from '../rules/text.ts';
import { emptyRows, houseFrom, setup, type Placement } from '../rules/testing.ts';
import { PRICES } from './balance.ts';
import { CONTENT } from './index.ts';

/** A fixture in the piece with this uid (uids follow placement order, from 1). */
type Install = [uid: number, fixture: FixtureId];

/** A house on an ASCII lot, every piece placed in week 1, with fixtures installed in week 1. */
function build(
  rows: readonly string[],
  placements: readonly Placement[],
  installs: readonly Install[] = [],
): HouseState {
  let house = houseFrom(CONTENT, rows, placements);
  for (const [uid, id] of installs) house = withFixture(house, uid, id, 1);
  return house;
}

/** The house's tally in `week`, with these blueprints (bought in week 1) if any. */
function tallyOf(house: HouseState, week = 1, blueprints: readonly BlueprintId[] = []): Tally {
  // The fixtures alone: no client's tastes (the Hendersons like Lawns), and none of the house
  // rules that pay on the rooms (D-165; room-rules.test.ts has those).
  const mods = runModifiers(CONTENT, {
    setup: setup('fixtures'),
    blueprints: blueprints.map((id) => ({ id, boughtWeek: 1 })),
  }).filter((m) => m.source.kind !== 'client' && m.source.kind !== 'house');
  const layout = computeLayout(CONTENT, house, mods.map((m) => m.mod).filter(isLayoutModifier));
  return tallyHouse(CONTENT, layout, week, true, { ...NO_CONTEXT, mods });
}

/** What each piece earns, in placement order. */
function earned(
  rows: readonly string[],
  placements: readonly Placement[],
  installs: readonly Install[] = [],
  blueprints: readonly BlueprintId[] = [],
): number[] {
  return tallyOf(build(rows, placements, installs), 1, blueprints).pieces.map((p) => p.earned);
}

function layoutOf(
  rows: readonly string[],
  placements: readonly Placement[],
  installs: readonly Install[] = [],
): Layout {
  return computeLayout(CONTENT, build(rows, placements, installs));
}

/** Can the fixture go in the piece with this uid? */
function fits(
  rows: readonly string[],
  placements: readonly Placement[],
  id: FixtureId,
  uid: number,
) {
  return checkInstall(CONTENT, layoutOf(rows, placements), id, uid);
}

/** Appendix B's rarities. */
const RARITY: Record<FixtureId, Rarity> = {
  fireplace: 'common',
  skylight: 'common',
  blackoutCurtains: 'common',
  soundproofing: 'common',
  kitchenIsland: 'uncommon',
  bunkBeds: 'uncommon',
  bayWindow: 'common',
  sprinkler: 'common',
  pergola: 'uncommon',
  gardenLights: 'common',
  chandelier: 'rare',
};

/** Its text is a fits line plus one line per modifier, all reading cleanly. */
function expectText(id: FixtureId, fitsLine?: string, effects?: readonly string[]): void {
  const def = CONTENT.fixtures[id];
  const text = fixtureText(CONTENT, def);
  expect(text.effects).toHaveLength(def.modifiers.length);
  for (const line of [text.fits, ...text.effects]) {
    expect(line.trim()).not.toBe('');
    expect(line).not.toMatch(/undefined|NaN|null|\[object|  /);
  }
  expect(text.fits).toMatch(/^Fits /);
  if (fitsLine) expect(text.fits).toBe(fitsLine);
  if (effects) expect(text.effects).toEqual(effects);
}

const open = emptyRows(10, 10);

/**
 * An interior Bedroom (uid 1), so Dark and out of the sun: Hallways on all four sides, on a
 * 10×10 lot. The Hallways link nothing, since the Bedroom is the only room touching them.
 */
const INTERIOR: Placement[] = [
  ['bedroom', 1, 6],
  ['longHallway', 0, 5],
  ['hallway', 0, 6, 1],
  ['hallway', 3, 6, 1],
  ['longHallway', 0, 8],
];

describe('fixtures', () => {
  it('are the 11 of Appendix B, priced by rarity from balance.ts', () => {
    expect(Object.keys(CONTENT.fixtures).sort()).toEqual(Object.keys(RARITY).sort());
    for (const def of Object.values(CONTENT.fixtures)) {
      expect(def.rarity).toBe(RARITY[def.id]);
      expect(def.price).toBe(PRICES.fixture[def.rarity]);
    }
    expect(PRICES.fixture).toEqual({ common: 2, uncommon: 3, rare: 4 });
  });

  it('join the draw from phase 2 at weight 5; the Chandelier is shop only', () => {
    const fixturesIn = (phase: number) =>
      drawWeights(CONTENT, phase).filter((w) => w.card.kind === 'fixture');
    expect(fixturesIn(0)).toEqual([]);
    const drawn = fixturesIn(1);
    expect(drawn.map((w) => w.card.id).sort()).toEqual(
      Object.keys(RARITY)
        .filter((id) => id !== 'chandelier')
        .sort(),
    );
    for (const w of drawn) expect(w.weight).toBe(5 * 100);
    expect(CONTENT.fixtures.chandelier.drawWeight).toBe(0);
  });
});

describe('Fireplace', () => {
  it('+50% in its room; +100% in a Living Room or a Library', () => {
    expectText('fireplace', 'Fits most rooms', [
      'Earns +50%',
      '+50% more in a Living Room or Library',
    ]);
    // A Bedroom: 3 at +50% is 4.5, which rounds up to 5.
    const t = tallyOf(build(open, [['bedroom', 0, 0]], [[1, 'fireplace']]));
    expect(t.pieces[0]!.earned).toBe(5);
    expect(t.pieces[0]!.lines).toContainEqual({
      label: 'Fireplace',
      op: 'pct',
      value: 50,
      from: [],
    });
    // A Living Room with a Tree view, in the sun (D-120): 2 + 2 at +100%.
    expect(
      earned(['T.........', ...emptyRows(10, 9)], [['livingRoom', 1, 0]], [[1, 'fireplace']]),
    ).toEqual([8]);
    // A Library beside a Bedroom: 2 at +100%. Only its host: the Bedroom keeps its 3 + 1.
    expect(
      earned(
        open,
        [
          ['library', 0, 0],
          ['bedroom', 2, 0],
        ],
        [[1, 'fireplace']],
      ),
    ).toEqual([4, 4]);
  });

  it('fits rooms only: not a Hallway or a Lawn', () => {
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['lawn', 0, 4],
    ];
    expect(fits(open, placements, 'fireplace', 1)).toEqual({ legal: true });
    expect(fits(open, placements, 'fireplace', 2)).toEqual({
      legal: false,
      reason: 'A Fireplace goes in most rooms, not a Hallway.',
    });
    expect(fits(open, placements, 'fireplace', 3)).toMatchObject({ legal: false });
  });
});

// D-172: the room fixtures leave out the rooms they'd look wrong in. A variant and a member's
// room go by their type (an L-Kitchen is a Kitchen, Grandma's Room a Bedroom).
describe('where the room fixtures go (D-172)', () => {
  const OUT: Partial<Record<FixtureId, readonly PieceId[]>> = {
    fireplace: ['bathroom', 'closet', 'garage', 'mudroom'],
    blackoutCurtains: ['bathroom', 'closet', 'garage'],
    // A skylit Bathroom and a soundproofed Garage are real things.
    skylight: [],
    soundproofing: [],
  };

  // The Bay Window leaves out a Bathroom, Closet and Garage too; it needs an outside wall, which
  // only a house has, so the next test asks checkInstall.
  it('each takes every room type but the ones it leaves out', () => {
    const rooms = Object.values(CONTENT.pieces).filter(isRoom);
    expect(rooms.length).toBeGreaterThan(15);
    for (const [id, out] of Object.entries(OUT) as [FixtureId, readonly PieceId[]][]) {
      for (const room of rooms) {
        expect(matchesDef(CONTENT.fixtures[id].fits, room), `${id} in ${room.id}`).toBe(
          !out.includes(rootType(room)),
        );
      }
    }
    expect(matchesDef(CONTENT.fixtures.fireplace.fits, CONTENT.pieces.lKitchen)).toBe(true);
    expect(matchesDef(CONTENT.fixtures.fireplace.fits, CONTENT.pieces.grandmasRoom)).toBe(true);
  });

  it('a refused install names the room', () => {
    const placements: Placement[] = [
      ['bathroom', 0, 0],
      ['closet', 2, 0],
      ['garage', 4, 0],
      ['mudroom', 0, 3],
      ['bedroom', 4, 3],
    ];
    const no = (reason: string) => ({ legal: false, reason });
    expect(fits(open, placements, 'fireplace', 1)).toEqual(
      no('A Fireplace goes in most rooms, not a Bathroom.'),
    );
    expect(fits(open, placements, 'fireplace', 2)).toEqual(
      no('A Fireplace goes in most rooms, not a Closet.'),
    );
    expect(fits(open, placements, 'fireplace', 3)).toEqual(
      no('A Fireplace goes in most rooms, not a Garage.'),
    );
    expect(fits(open, placements, 'fireplace', 4)).toEqual(
      no('A Fireplace goes in most rooms, not a Mudroom.'),
    );
    expect(fits(open, placements, 'fireplace', 5)).toEqual({ legal: true });
    expect(fits(open, placements, 'blackoutCurtains', 1)).toEqual(
      no('Blackout Curtains go in most rooms, not a Bathroom.'),
    );
    // Curtains in a Mudroom are fine: it has a window by the door.
    expect(fits(open, placements, 'blackoutCurtains', 4)).toEqual({ legal: true });
    expect(fits(open, placements, 'bayWindow', 1)).toEqual(
      no('A Bay Window goes in most exterior rooms, not a Bathroom.'),
    );
    expect(fits(open, placements, 'bayWindow', 2)).toEqual(
      no('A Bay Window goes in most exterior rooms, not a Closet.'),
    );
    expect(fits(open, placements, 'bayWindow', 3)).toEqual(
      no('A Bay Window goes in most exterior rooms, not a Garage.'),
    );
    expect(fits(open, placements, 'bayWindow', 4)).toEqual({ legal: true });
    expect(fits(open, placements, 'bayWindow', 5)).toEqual({ legal: true });
    for (const uid of [1, 2, 3, 4, 5]) {
      expect(fits(open, placements, 'skylight', uid), `skylight in ${uid}`).toEqual({
        legal: true,
      });
      expect(fits(open, placements, 'soundproofing', uid)).toEqual({ legal: true });
    }
  });
});

describe('Skylight', () => {
  it('makes its room Sunny and never Dark, and +25%', () => {
    expectText('skylight', 'Fits any room', ['Makes it Sunny', 'It’s never Dark', 'Earns +25%']);
    expect(fits(open, INTERIOR, 'skylight', 1)).toEqual({ legal: true });
    const before = layoutOf(open, INTERIOR);
    expect(before.interior.has(1)).toBe(true);
    expect(before.tags.get(1)!.has('Dark')).toBe(true);
    expect(before.tags.get(1)!.has('Sunny')).toBe(false);
    const after = layoutOf(open, INTERIOR, [[1, 'skylight']]);
    expect(after.tags.get(1)!.has('Dark')).toBe(false);
    expect(after.tags.get(1)!.has('Sunny')).toBe(true);
    // 3 at +25% is 3.75: 4.
    expect(earned(open, INTERIOR, [[1, 'skylight']])[0]).toBe(4);
  });

  it('Sunny and not Dark is what blueprints see: Solar Panels pay, Mood Lighting doesn’t', () => {
    // Solar Panels: +1 budget in the 4th week for a Sunny piece. Some of the Hallways around
    // the Bedroom are in the sun and pay too (D-120), so it's the Bedroom's own budget.
    const house = build(open, INTERIOR, [[1, 'skylight']]);
    const bedroom = (h: HouseState) => tallyOf(h, 4, ['solarPanels']).pieces[0]!.budget;
    expect(bedroom(build(open, INTERIOR))).toBe(0);
    expect(bedroom(house)).toBe(1);
    // Mood Lighting's +0.4 Charm for a Dark room (D-143): there without the Skylight, gone
    // with it.
    const charm = (h: HouseState) => tallyOf(h, 1, ['moodLighting']).mult;
    expect(charm(build(open, INTERIOR))).toBe(140);
    expect(charm(house)).toBe(100);
  });
});

describe('Blackout Curtains', () => {
  it('makes its room Dark, and +25%', () => {
    expectText('blackoutCurtains', 'Fits most rooms', [
      'Makes it Dark',
      'It’s never Sunny',
      'Earns +25%',
    ]);
    // An exterior Bedroom with a wall to the sun: Dark, and with the curtains drawn, not Sunny
    // (D-120).
    expect(
      layoutOf(open, [['bedroom', 0, 0]])
        .tags.get(1)!
        .has('Sunny'),
    ).toBe(true);
    const layout = layoutOf(open, [['bedroom', 0, 0]], [[1, 'blackoutCurtains']]);
    expect(layout.exterior.has(1)).toBe(true);
    expect(layout.tags.get(1)!.has('Dark')).toBe(true);
    expect(layout.tags.get(1)!.has('Sunny')).toBe(false);
    expect(earned(open, [['bedroom', 0, 0]], [[1, 'blackoutCurtains']])).toEqual([4]);
    // With Mood Lighting it's a Dark room: +0.4 Charm (D-143).
    const charm = (installs: readonly Install[]) =>
      tallyOf(build(open, [['bedroom', 0, 0]], installs), 1, ['moodLighting']).mult;
    expect(charm([[1, 'blackoutCurtains']])).toBe(140);
    expect(charm([])).toBe(100);
  });
});

describe('Soundproofing', () => {
  it('Loud neighbors, named (the street included), can’t take points off its room', () => {
    expectText('soundproofing', 'Fits any room', [
      'Loud neighbors (the street, Garages, Playrooms, and Pools) can’t take points off it',
    ]);
    // On the street beside a Garage: 3 − 2 − 2 is −1 without it, a clean 3 with it.
    const rows = emptyRows(6, 6);
    const street: Placement[] = [
      ['bedroom', 0, 4],
      ['garage', 2, 4],
    ];
    expect(tallyOf(build(rows, street)).pieces[0]).toMatchObject({ points: -1, earned: 0 });
    const t = tallyOf(build(rows, street, [[1, 'soundproofing']]));
    expect(t.pieces[0]).toMatchObject({ points: 3, earned: 3 });
    expect(t.pieces[0]!.lines.every((l) => l.value >= 0)).toBe(true);
    expect(t.pieces[1]!.earned).toBe(5);
    // A Home Office on the street: 2 − 2 without it, 2 with it.
    expect(earned(rows, [['homeOffice', 0, 5]], [[1, 'soundproofing']])).toEqual([2]);
  });

  it('blocks a Loud piece’s negative aura (the Playroom), but not other penalties', () => {
    // A Bedroom by a Playroom: 3 − 2 (Loud) − 2 (aura) without it; 3 with it.
    const playroom: Placement[] = [
      ['bedroom', 0, 0],
      ['playroom', 2, 0],
    ];
    expect(earned(open, playroom)).toEqual([0, 2]);
    expect(earned(open, playroom, [[1, 'soundproofing']])).toEqual([3, 2]);
    // A Kitchen isn't Loud: the Bathroom still loses 2 for it (3 − 2).
    expect(
      earned(
        open,
        [
          ['bedroom', 0, 0],
          ['bathroom', 2, 0],
          ['lKitchen', 3, 0],
        ],
        [[2, 'soundproofing']],
      ),
    ).toEqual([3, 1, 5]); // the L-Kitchen in the sun: +2 (D-120), and +3 of its own (D-165)
  });
});

describe('Kitchen Island', () => {
  // A Dining Room, then a Kitchen (uid 2) beside it, then another Kitchen beyond that.
  const row: Placement[] = [
    ['diningRoom', 0, 0],
    ['kitchen', 2, 0],
    ['kitchen', 4, 0],
  ];

  it('its Kitchen earns +25%, and its neighbors count it as a Dining Room', () => {
    // The text says its limit (D-148): it fills no set and no checklist line.
    expectText('kitchenIsland', 'Fits a Kitchen', [
      'Earns +25%',
      'Neighbors count it as a Dining Room (sets and the checklist don’t)',
    ]);
    // All three face the sun, +2 each (D-120), and each Kitchen earns +3 of its own (D-165).
    // Without it: the middle Kitchen is +7 at the Dining Room's +50% (10.5 → 11); the far one
    // has no Dining Room (5).
    expect(earned(open, row)).toEqual([2, 11, 5]);
    // With it: the middle Kitchen is +7 at +75% (12.25 → 12), and the far Kitchen gets its +2
    // per Dining Room for the middle one (7). The Island adds no aura: it isn't a Dining Room's
    // effects.
    expect(earned(open, row, [[2, 'kitchenIsland']])).toEqual([2, 12, 7]);
    const layout = layoutOf(open, row, [[2, 'kitchenIsland']]);
    expect(layout.countsAs.get(2)).toEqual(new Map([['diningRoom', 1]]));
  });

  it('fits a Kitchen or an L-Kitchen, not a Dining Room', () => {
    const placements: Placement[] = [...row, ['lKitchen', 0, 4]];
    expect(fits(open, placements, 'kitchenIsland', 2)).toEqual({ legal: true });
    expect(fits(open, placements, 'kitchenIsland', 4)).toEqual({ legal: true });
    expect(fits(open, placements, 'kitchenIsland', 1)).toEqual({
      legal: false,
      reason: 'A Kitchen Island goes in a Kitchen, not a Dining Room.',
    });
  });
});

describe('Bunk Beds', () => {
  it('+25%, and its Bedroom counts as 2 for count conditions but once in sets', () => {
    expectText('bunkBeds', 'Fits a Bedroom', ['Counts as 2 Bedrooms for the client', 'Earns +25%']);
    // 3 at +25% is 3.75: 4.
    expect(earned(open, [['bedroom', 0, 0]], [[1, 'bunkBeds']])).toEqual([4]);
    expect(layoutOf(open, [['bedroom', 0, 0]], [[1, 'bunkBeds']]).countsAs.get(1)).toEqual(
      new Map([['bedroom', 2]]),
    );
    // A Jack-and-Jill with Bunk Beds in one Bedroom is still one instance: (4 + 3 + 3 + 10) ×
    // 1.5 = 30.
    const jj: Placement[] = [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ];
    const t = tallyOf(build(open, jj, [[1, 'bunkBeds']]));
    expect(t.pieces.map((p) => p.earned)).toEqual([4, 3, 3]);
    expect(t.sets.map((s) => [s.set, s.members])).toEqual([['jackAndJill', [1, 2, 3]]]);
    expect(t.total).toBe(30);
    // One Bedroom with Bunk Beds and a Bathroom isn't a Jack-and-Jill.
    const half = tallyOf(build(open, jj.slice(0, 2), [[1, 'bunkBeds']]));
    expect(half.sets).toEqual([]);
    expect(half.pieces.map((p) => p.earned)).toEqual([4, 3]);
  });

  it('fits a Bedroom only', () => {
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['library', 2, 0],
    ];
    expect(fits(open, placements, 'bunkBeds', 1)).toEqual({ legal: true });
    expect(fits(open, placements, 'bunkBeds', 2)).toMatchObject({
      legal: false,
      reason: 'Bunk Beds go in a Bedroom, not a Library.',
    });
  });
});

describe('Bay Window', () => {
  it('gives its room a view, which is one more view for its own per-view bonus', () => {
    expectText('bayWindow', 'Fits most exterior rooms', [
      'Gives it a view, which counts as one more view',
    ]);
    // A Living Room with no view, in the sun (D-120): 2, then 4 with the window.
    expect(earned(open, [['livingRoom', 0, 0]])).toEqual([2]);
    expect(earned(open, [['livingRoom', 0, 0]], [[1, 'bayWindow']])).toEqual([4]);
    const layout = layoutOf(open, [['livingRoom', 0, 0]], [[1, 'bayWindow']]);
    expect(layout.hasView.has(1)).toBe(true);
    expect(layout.neighbors.get(1)).toContainEqual({ kind: 'view', uid: 1 });
    // A Tree and a Flower Bed (1: it's in the back yard) plus the window: three views, 6, and
    // the sun's 2. An Herb Garden (2 tiles in the sun) adds a fourth, which the cap leaves out.
    const rows = ['T.........', ...emptyRows(10, 9)];
    const views: Placement[] = [
      ['livingRoom', 1, 0],
      ['flowerBed', 3, 0],
    ];
    expect(earned(rows, views)).toEqual([6, 1]);
    expect(earned(rows, views, [[1, 'bayWindow']])).toEqual([8, 1]);
    expect(earned(rows, [...views, ['herbGarden', 3, 1]], [[1, 'bayWindow']])).toEqual([8, 1, 2]);
  });

  it('the view is its room’s own: a Patio next door sees only a Living Room', () => {
    expect(
      earned(
        open,
        [
          ['livingRoom', 0, 0],
          ['patio', 2, 0],
        ],
        [[1, 'bayWindow']],
      ),
      // The window's view and the sun; the Patio's +2 for the Living Room and +1 out back (D-166).
    ).toEqual([4, 3]);
  });

  it('fits an exterior room, checked when it’s installed; it stays if the room becomes interior', () => {
    const lone: Placement[] = [['bedroom', 1, 6]];
    expect(fits(open, lone, 'bayWindow', 1)).toEqual({ legal: true });
    expect(fits(open, INTERIOR, 'bayWindow', 1)).toMatchObject({ legal: false });
    expect(fits(open, [['lawn', 0, 0]], 'bayWindow', 1)).toMatchObject({ legal: false });
    // Installed while exterior, then walled in by Hallways: still a view.
    const layout = layoutOf(open, INTERIOR, [[1, 'bayWindow']]);
    expect(layout.interior.has(1)).toBe(true);
    expect(layout.hasView.has(1)).toBe(true);
  });
});

describe('Sprinkler', () => {
  it('its Lawn earns +100%', () => {
    expectText('sprinkler', 'Fits a Lawn', ['Earns +100%']);
    expect(earned(open, [['lawn', 0, 0]], [[1, 'sprinkler']])).toEqual([2]);
    // Two Lawns, 2 each; only the one with the Sprinkler doubles.
    expect(
      earned(
        open,
        [
          ['lawn', 0, 0],
          ['lawn', 2, 0],
        ],
        [[1, 'sprinkler']],
      ),
    ).toEqual([4, 2]);
    const placements: Placement[] = [
      ['lawn', 0, 0],
      ['patio', 2, 0],
    ];
    expect(fits(open, placements, 'sprinkler', 1)).toEqual({ legal: true });
    expect(fits(open, placements, 'sprinkler', 2)).toEqual({
      legal: false,
      reason: 'A Sprinkler goes in a Lawn, not a Patio.',
    });
  });
});

describe('Pergola', () => {
  it('its Patio gets a view (one more for its +1 per view) and +50%', () => {
    expectText('pergola', 'Fits a Patio', [
      'Gives it a view, which counts as one more view',
      'Earns +50%',
    ]);
    // Beside a Closet, a room with no view: 1 for its own view, at +50%: 1.5 → 2.
    const closet: Placement[] = [
      ['patio', 0, 0],
      ['closet', 2, 0],
    ];
    expect(earned(open, closet)).toEqual([0, 1]);
    expect(earned(open, closet, [[1, 'pergola']])).toEqual([2, 1]);
    // Alone it touches no room, so it earns nothing, Pergola or not (the Patio rule, D-105).
    expect(earned(open, [['patio', 0, 0]], [[1, 'pergola']])).toEqual([0]);
    // Beside a Kitchen (in the sun, +2, and +3 of its own, D-165), out back (+1, D-166): the
    // Patio's (2 + 1 + 1) at +50% is 6.
    const kitchen: Placement[] = [
      ['patio', 2, 0],
      ['kitchen', 0, 0],
    ];
    expect(earned(open, kitchen)).toEqual([3, 5]);
    expect(earned(open, kitchen, [[1, 'pergola']])).toEqual([6, 5]);
    // Three Trees and the Pergola's view, beside a Closet: four views, three count: 3 at +50%.
    const trees = ['.TT.', 'T...', ...emptyRows(4, 2)];
    const wooded: Placement[] = [
      ['patio', 1, 1],
      ['closet', 3, 1],
    ];
    expect(earned(trees, wooded)).toEqual([3, 1]);
    expect(earned(trees, wooded, [[1, 'pergola']])).toEqual([5, 1]);
    expect(fits(open, [['lawn', 0, 0]], 'pergola', 1)).toMatchObject({ legal: false });
  });
});

describe('Garden Lights', () => {
  it('its yard piece is Pretty, and earns +50% in the front yard', () => {
    expectText('gardenLights', 'Fits any yard piece', [
      'Makes it Pretty',
      '+50% more in the front yard',
    ]);
    // The Bedroom's front row is row 1: a Lawn in rows 4–5 is front yard (1 at +50%: 2); one
    // in rows 0–1 is back yard (1, and +1 out back, D-166).
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['lawn', 4, 4],
      ['lawn', 4, 0],
    ];
    const installs: Install[] = [
      [2, 'gardenLights'],
      [3, 'gardenLights'],
    ];
    expect(earned(open, placements, installs)).toEqual([3, 2, 2]);
    const layout = layoutOf(open, placements, installs);
    expect(layout.tags.get(2)!.has('Pretty')).toBe(true);
    expect(layout.tags.get(3)!.has('Pretty')).toBe(true);
    // A yard piece only: not a room or an outbuilding.
    const more: Placement[] = [...placements, ['doghouse', 8, 8]];
    expect(fits(open, more, 'gardenLights', 2)).toEqual({ legal: true });
    expect(fits(open, more, 'gardenLights', 1)).toMatchObject({ legal: false });
    expect(fits(open, more, 'gardenLights', 4)).toMatchObject({ legal: false });
    // Nor a Sapling (uid 5): it becomes a Tree, a lot feature, and the lights would go with it
    // (D-095).
    expect(fits(open, [...more, ['sapling', 8, 0]], 'gardenLights', 5)).toEqual({
      legal: false,
      reason: 'A Sapling becomes a Tree, so it can’t hold a fixture.',
    });
  });
});

describe('Chandelier', () => {
  // An Entertainer, all three in the sun (+2 each, D-120): the Kitchen (7 with its own +3, D-165,
  // at the Dining Room's +50%: 10.5 → 11), the Dining Room (uid 2: 2), and the Living Room (uid
  // 3: 2 at +50%, 3). The set adds 25 Points and +1 Mult: 41 × 2 = 82.
  const entertainer: Placement[] = [
    ['kitchen', 0, 0],
    ['diningRoom', 2, 0],
    ['livingRoom', 4, 0],
  ];

  it('×1.25 Mult while its room is part of an Entertainer', () => {
    expectText('chandelier', 'Fits a Dining Room or Living Room', [
      '×1.25 Charm while it’s part of an Entertainer',
    ]);
    const plain = tallyOf(build(open, entertainer));
    expect(plain).toMatchObject({ points: 41, mult: 200, total: 82, xMults: [] });
    // 200 × 1.25 = 250; 41 × 2.5 = 102.5 → 103.
    const t = tallyOf(build(open, entertainer, [[2, 'chandelier']]));
    expect(t).toMatchObject({ points: 41, mult: 250, total: 103 });
    expect(t.xMults).toEqual([
      {
        source: { kind: 'fixture', id: 'chandelier', uid: 2 },
        label: 'Chandelier',
        times: 125,
        before: 200,
        after: 250,
      },
    ]);
  });

  it('two Chandeliers count once; one outside the set does nothing', () => {
    const both = tallyOf(
      build(open, entertainer, [
        [2, 'chandelier'],
        [3, 'chandelier'],
      ]),
    );
    expect(both.xMults).toHaveLength(1);
    expect(both).toMatchObject({ mult: 250, total: 103 });
    // A second Dining Room (uid 4) by the Kitchen isn't in the set (it has no Kitchen left), and
    // it's in the Kitchen's shade. The Kitchen is now 9 at +100%: 18, and (23 + 25) × 2 = 96.
    const extra: Placement[] = [...entertainer, ['diningRoom', 0, 2]];
    expect(tallyOf(build(open, extra))).toMatchObject({ points: 48, total: 96 });
    expect(tallyOf(build(open, extra, [[4, 'chandelier']]))).toMatchObject({
      mult: 200,
      total: 96,
      xMults: [],
    });
    // In the set's Dining Room: 48 × 2.5 = 120.
    expect(tallyOf(build(open, extra, [[2, 'chandelier']]))).toMatchObject({
      mult: 250,
      total: 120,
    });
    // A lone Living Room: no set, no ×Mult.
    expect(tallyOf(build(open, [['livingRoom', 0, 0]], [[1, 'chandelier']]))).toMatchObject({
      mult: 100,
      xMults: [],
    });
  });

  it('fits a Dining Room or a Living Room, not a Kitchen', () => {
    expect(fits(open, entertainer, 'chandelier', 2)).toEqual({ legal: true });
    expect(fits(open, entertainer, 'chandelier', 3)).toEqual({ legal: true });
    expect(fits(open, entertainer, 'chandelier', 1)).toEqual({
      legal: false,
      reason: 'A Chandelier goes in a Dining Room or Living Room, not a Kitchen.',
    });
  });
});
