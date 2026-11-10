// M4a's sets (implementation-plan.md §5 and Appendix A · M4a; Appendix B, Sets; D-056, D-065,
// D-070, D-081, D-093): the Suite, Full House, `maxInstances`, and Full House's ×2, through
// matchSets() and tallyHouse(); then the Remodel Plans for the two new sets in a real run.
//
// TEST_SETS (src/rules/testing.ts):
// - Suite: a Bedroom, a Bathroom, and a Closet, connected; 15 Points, +0.5; +10 / +0.25 a level
// - Full House: one each of the 9 Core indoor types, anywhere; at most 1; 40 Points, +1, ×2;
//   +20 / +0.5 a level
// - the Entertainer has no cap there (the real content's is 1), so cap tests override it
//
// Houses are built with houseFrom on an empty 12 × 12 lot, so uids follow the placement order
// (1, 2, …) and every piece has placedWeek 1. The street runs below row 11; rows 0–3 are the
// sunny side, which nothing here cares about. Mult is in hundredths: 250 is ×2.5.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Content,
  GameEvent,
  HouseCondition,
  HouseState,
  ModSource,
  Modifier,
  PlaceAction,
  RunState,
  SetDef,
  SetId,
  SpecDef,
  Tally,
  ToolId,
  UseToolAction,
} from './index.ts';
import { meetsHouse } from './conditions.ts';
import { withFixture } from './fixtures.ts';
import { computeLayout } from './layout.ts';
import type { ActiveMod } from './modifiers.ts';
import { createRules } from './run.ts';
import { NO_CONTEXT, tallyHouse, weekTotal, type TallyContext } from './scoring.ts';
import { meetsCondition } from './selectors.ts';
import { matchSets } from './sets.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withPieces,
  type Placement,
} from './testing.ts';

// ---------------------------------------------------------------------------------------
// Helpers.

/** A 12 × 12 empty lot. */
const L = emptyRows(12, 12);
/** A 24 × 12 one, for two of everything side by side. */
const WIDE = emptyRows(24, 12);

/** TEST_CONTENT with one set's definition changed. */
function withSet(id: SetId, o: Partial<SetDef>, base: Content = C): Content {
  return { ...base, sets: { ...base.sets, [id]: { ...base.sets[id], ...o } } };
}

/** One Entertainer per house, as the real content has it (D-093). */
const ONE_ENTERTAINER = withSet('entertainer', { maxInstances: 1 });

/** Placements moved by (dx, dy). */
const shifted = (ps: readonly Placement[], dx: number, dy = 0): Placement[] =>
  ps.map(([id, x, y, rot]): Placement => [id, x + dx, y + dy, rot]);

/** The house without one piece, as a demolition leaves it (the others keep their uids). */
const without = (house: HouseState, uid: number): HouseState => ({
  ...house,
  pieces: house.pieces.filter((p) => p.uid !== uid),
});

/** The keys of the house's held set instances, in content order, then completion order. */
const keysOf = (content: Content, house: HouseState): string[] =>
  matchSets(content, computeLayout(content, house)).map((s) => s.key);

const keys = (content: Content, placements: readonly Placement[], rows = L): string[] =>
  keysOf(content, houseFrom(content, rows, placements));

/** The week-1 tally, with NO_CONTEXT but for these overrides. */
function tally(content: Content, house: HouseState, tc: Partial<TallyContext> = {}): Tally {
  return tallyHouse(content, computeLayout(content, house), 1, true, { ...NO_CONTEXT, ...tc });
}

/** A modifier in play, from this source. */
const active = (source: ModSource, mod: Modifier): ActiveMod => ({ mod, source, since: 1 });

/** A modifier from a blueprint slot, for kinds no test blueprint has. */
const fromPlan = (mod: Modifier) => active({ kind: 'blueprint', id: 'fengShui' }, mod);

/** A tool's week modifiers, as using it puts them in this week's tally. */
function toolMods(id: ToolId): ActiveMod[] {
  const use = C.tools[id].use;
  if (use.kind !== 'weekModifiers') throw new Error(`${id} has no week modifiers`);
  return use.modifiers.map((mod) => active({ kind: 'tool', id }, mod));
}

/** A line of the client's checklist. */
const wish = (id: string, condition: HouseCondition): SpecDef => ({
  id,
  name: id,
  group: 'wishes',
  condition,
});

const setsOf = (t: Tally) => t.sets.map((s) => [s.set, s.points, s.mult]);
const xOf = (t: Tally) => t.xMults.map((x) => [x.label, x.times, x.before, x.after]);

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

// ---------------------------------------------------------------------------------------
// Houses.

/**
 * A Suite in the corner: a Bedroom (uid 1), the Bathroom beside it (uid 2), and the Closet
 * under the Bathroom (uid 3), which touches both. The Bedroom earns 3 (no Quiet neighbor),
 * the Bathroom 3 (its Bedroom), the Closet 1: 7 Points.
 */
const SUITE: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['closet', 2, 1],
];

/**
 * One of each of the 9 Core indoor types, none touching another (uids 1–9 in this order).
 * Bedroom 3, Bathroom 0, Kitchen 0, Dining Room 0, Living Room 0 (no view), Closet 1,
 * Hallway 0, Garage 1 (on the street, as it requires), Home Office 2: 7 Points.
 */
const FULL: Placement[] = [
  ['bedroom', 0, 0], // (0–1, 0–1)
  ['bathroom', 3, 0],
  ['kitchen', 5, 0], // (5–6, 0–1)
  ['diningRoom', 8, 0], // (8–9, 0–1)
  ['livingRoom', 0, 3], // (0–1, 3–5)
  ['closet', 3, 3],
  ['hallway', 5, 3], // (5–6, 3)
  ['garage', 8, 10], // (8–9, 10–11): touches the street
  ['homeOffice', 3, 6], // (3–4, 6)
];
const FULL_KEY = 'fullHouse:1,2,3,4,5,6,7,8,9';

/**
 * The Suite (uids 1–3) plus the other six types apart (uids 4–9): a Suite and a Full House,
 * sharing the Bedroom, Bathroom, and Closet. Points 7 + 1 (Garage) + 2 (Home Office) = 10.
 */
const SUITE_FULL: Placement[] = [
  ...SUITE,
  ['kitchen', 5, 0],
  ['diningRoom', 8, 0],
  ['livingRoom', 0, 3],
  ['hallway', 5, 3],
  ['garage', 8, 10],
  ['homeOffice', 3, 6],
];

/** An Entertainer in a row at the top: Kitchen, Dining Room, Living Room. */
const ENT_TOP: Placement[] = [
  ['kitchen', 0, 0],
  ['diningRoom', 2, 0],
  ['livingRoom', 4, 0], // (4–5, 0–2)
];
/** Another, four rows down: apart from the first. */
const ENT_LOW = shifted(ENT_TOP, 0, 4);

/**
 * A Full House whose Kitchen, Dining Room, and Living Room (uids 1–3) also make an
 * Entertainer, with the other six types apart (uids 4–9). The Kitchen earns 2 (its Dining
 * Room) × 1.5 (the Dining Room's aura) = 3; Bedroom 3, Closet 1, Garage 1, Home Office 2;
 * the rest 0: 10 Points.
 */
const FULL_ENT: Placement[] = [
  ...ENT_TOP,
  ['bedroom', 0, 4], // (0–1, 4–5)
  ['bathroom', 3, 4],
  ['closet', 5, 4],
  ['hallway', 7, 4],
  ['garage', 4, 10],
  ['homeOffice', 0, 7],
];

// ---------------------------------------------------------------------------------------
// The Suite.

describe('the Suite', () => {
  it('forms from a Bedroom, a Bathroom, and a Closet that are one connected group', () => {
    expect(keys(C, SUITE)).toEqual(['suite:1,2,3']);
    // A chain is connected too: the Closet touches only the Bathroom.
    expect(
      keys(C, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['closet', 3, 0],
      ]),
    ).toEqual(['suite:1,2,3']);
    // Any member apart breaks it: the Closet, then the Bathroom.
    expect(
      keys(C, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['closet', 5, 0],
      ]),
    ).toEqual([]);
    expect(
      keys(C, [
        ['bedroom', 0, 0],
        ['closet', 2, 0],
        ['bathroom', 5, 0],
      ]),
    ).toEqual([]);
    // And it needs all three types: two Bedrooms and a Bathroom are a Jack-and-Jill, not a Suite.
    expect(
      keys(C, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0],
      ]),
    ).toEqual(['jackAndJill:1,2,3']);
  });

  it('counts links through a Hallway (or a run of them), but the Hallway is no member', () => {
    // The Bedroom (uid 1) and the Bathroom (uid 3) don't touch; the Hallway between them
    // (uid 2) links them. The Closet (uid 4) touches the Bathroom only.
    const linked: Placement[] = [
      ['bedroom', 0, 0],
      ['hallway', 2, 0], // (2–3, 0)
      ['bathroom', 4, 0],
      ['closet', 4, 1],
    ];
    expect(keys(C, linked)).toEqual(['suite:1,3,4']);
    // Without the Hallway, no Suite.
    expect(
      keys(
        C,
        linked.filter(([id]) => id !== 'hallway'),
      ),
    ).toEqual([]);
    // A Hallway and a Long Hallway in a row are one group, linking every room along it.
    expect(
      keys(C, [
        ['bedroom', 0, 0],
        ['hallway', 2, 0], // (2–3, 0)
        ['longHallway', 4, 0], // (4–6, 0)
        ['bathroom', 7, 0],
        ['closet', 7, 1],
      ]),
    ).toEqual(['suite:1,4,5']);
  });

  it('searches past a dead end to find the connected group', () => {
    // The Closet (uid 4) sits between two Bathrooms; only the second (uid 2) touches the
    // Bedroom (uid 3). The search tries Bathroom 1 first, finds no Bedroom, and backs off.
    expect(
      keys(C, [
        ['bathroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0], // (3–4, 0–1)
        ['closet', 1, 0],
      ]),
    ).toEqual(['suite:2,3,4']);
  });

  it('a piece joins one Suite at most, but may be in a Suite and a Jack-and-Jill at once', () => {
    const shared: Placement[] = [
      ['bedroom', 0, 0], // 1: (0–1, 0–1)
      ['bathroom', 2, 0], // 2: between the Bedrooms
      ['bedroom', 3, 0], // 3: (3–4, 0–1)
      ['closet', 2, 1], // 4: under the Bathroom, touching all three
      ['closet', 5, 0], // 5: beside Bedroom 3
    ];
    // Bedroom 1 and the Bathroom are in both sets. Bedroom 3 and Closet 5 make no second
    // Suite: the only Bathroom is already in one.
    expect(keys(C, shared)).toEqual(['jackAndJill:1,2,3', 'suite:1,2,4']);
    // A second Bathroom touching Bedroom 3 and Closet 5 makes a second Suite (the Suite has no
    // cap), and Bedroom 3 is then in a Jack-and-Jill and a different Suite.
    expect(keys(C, [...shared, ['bathroom', 5, 1]])).toEqual([
      'jackAndJill:1,2,3',
      'suite:1,2,4',
      'suite:3,5,6',
    ]);
  });

  it('a Bedroom with Bunk Beds counts twice for counts, once for the Suite', () => {
    // The Bedroom (uid 1) between two Bathroom-and-Closet pairs, with Bunk Beds.
    const house = withFixture(
      houseFrom(C, L, [
        ['bedroom', 1, 0], // (1–2, 0–1)
        ['bathroom', 0, 0],
        ['closet', 0, 1],
        ['bathroom', 3, 0],
        ['closet', 3, 1],
      ]),
      1,
      'bunkBeds',
      1,
    );
    const layout = computeLayout(C, house);
    expect(meetsHouse(C, layout, { count: { piece: 'bedroom' }, min: 2 }, { phase: 0 })).toBe(true);
    expect(matchSets(C, layout).map((s) => s.key)).toEqual(['suite:1,2,3']);
  });

  it('pays 15 Points and +0.5 every week it holds, with no ×Mult', () => {
    const house = houseFrom(C, L, SUITE);
    const t = tally(C, house);
    expect(t.pieces.map((p) => p.earned)).toEqual([3, 3, 1]);
    expect(t.sets).toEqual([
      { set: 'suite', key: 'suite:1,2,3', members: [1, 2, 3], points: 15, mult: 50 },
    ]);
    expect(t.xMults).toEqual([]);
    // Points 7 + 15 = 22; Mult 150; 22 × 1.5 = 33.
    expect([t.points, t.mult, t.total]).toEqual([22, 150, 33]);
    // Week 5 (no timers here) pays the same.
    expect(tallyHouse(C, computeLayout(C, house), 5, false, NO_CONTEXT).total).toBe(33);
    // Two Suites pay twice: 14 + 30 = 44 Points, Mult 200; 88.
    const two = tally(C, houseFrom(C, L, [...SUITE, ...shifted(SUITE, 6)]));
    expect(setsOf(two)).toEqual([
      ['suite', 15, 50],
      ['suite', 15, 50],
    ]);
    expect(two.total).toBe(88);
  });

  it('counts a Closet with an unmet requirement, and a Bedroom that earns nothing (D-070)', () => {
    // A Closet that must touch a Tree (it doesn't), and a modifier zeroing Bedrooms.
    const c = withPieces({
      closet: {
        effects: [
          {
            kind: 'requires',
            condition: { touching: { feature: 'tree' } },
            blocksPlacement: false,
          },
          { kind: 'steady', amount: 1 },
        ],
      },
    });
    const t = tally(c, houseFrom(c, L, SUITE), {
      mods: [fromPlan({ kind: 'earnNothing', target: { piece: 'bedroom' } })],
    });
    expect(t.pieces.map((p) => p.earned)).toEqual([0, 3, 0]);
    expect(t.pieces[2]!.unmet).toBeDefined();
    expect(setsOf(t)).toEqual([['suite', 15, 50]]);
    // Points 3 + 15 = 18; Mult 150; 27.
    expect(t.total).toBe(27);
  });
});

// ---------------------------------------------------------------------------------------
// maxInstances.

describe('maxInstances', () => {
  const both = [...ENT_TOP, ...ENT_LOW];

  it('uncapped, a second instance forms; capped at 1, the first holds and a second never does', () => {
    expect(keys(C, both)).toEqual(['entertainer:1,2,3', 'entertainer:4,5,6']);
    expect(keys(ONE_ENTERTAINER, both)).toEqual(['entertainer:1,2,3']);
    // Each Kitchen earns 3. Uncapped: 6 + 50 = 56 Points, Mult 300; 168. Capped: 31 × 2 = 62.
    expect(tally(C, houseFrom(C, L, both)).total).toBe(168);
    const capped = tally(ONE_ENTERTAINER, houseFrom(ONE_ENTERTAINER, L, both));
    expect(setsOf(capped)).toEqual([['entertainer', 25, 100]]);
    expect(capped.total).toBe(62);
  });

  it('the first instance completed holds, not the one with the earliest pieces', () => {
    // The low group's Kitchen and Dining Room go down first (uids 1, 2), then the whole top
    // group (3–5), then the low group's Living Room (6). The top group completes first.
    const order: Placement[] = [ENT_LOW[0]!, ENT_LOW[1]!, ...ENT_TOP, ENT_LOW[2]!];
    expect(keys(C, order)).toEqual(['entertainer:3,4,5', 'entertainer:1,2,6']);
    expect(keys(ONE_ENTERTAINER, order)).toEqual(['entertainer:3,4,5']);
  });

  it("a later piece never reshuffles the cap, even toward a 'better' instance", () => {
    // A Chandelier in the low group's Dining Room (uid 5) is ×1.25 while its room is in an
    // Entertainer, so the low group would be the better one. The top one completed first.
    const partial = withFixture(
      houseFrom(C, L, [...ENT_TOP, ENT_LOW[0]!, ENT_LOW[1]!]),
      5,
      'chandelier',
      1,
    );
    const done = withFixture(houseFrom(C, L, both), 5, 'chandelier', 1);
    expect(keysOf(ONE_ENTERTAINER, partial)).toEqual(['entertainer:1,2,3']);
    expect(keysOf(ONE_ENTERTAINER, done)).toEqual(['entertainer:1,2,3']);
    const t = tally(ONE_ENTERTAINER, done);
    expect(t.xMults).toEqual([]);
    expect(t.total).toBe(62);
    // Uncapped, the low one forms too and the Chandelier lands: Mult 300 × 1.25 = 375;
    // 56 × 3.75 = 210.
    const free = tally(C, done);
    expect(xOf(free)).toEqual([['Chandelier', 125, 300, 375]]);
    expect(free.total).toBe(210);
  });

  it('a cap above 1 holds that many, in completion order', () => {
    const three = [...SUITE, ...shifted(SUITE, 4), ...shifted(SUITE, 8)];
    expect(keys(C, three)).toEqual(['suite:1,2,3', 'suite:4,5,6', 'suite:7,8,9']);
    expect(keys(withSet('suite', { maxInstances: 2 }), three)).toEqual([
      'suite:1,2,3',
      'suite:4,5,6',
    ]);
  });

  it('when the held instance loses a piece (a demolition), the next one completed holds', () => {
    const house = houseFrom(C, L, both);
    expect(keysOf(ONE_ENTERTAINER, without(house, 3))).toEqual(['entertainer:4,5,6']);
    // Losing a piece of the group that isn't held changes nothing.
    expect(keysOf(ONE_ENTERTAINER, without(house, 6))).toEqual(['entertainer:1,2,3']);
  });

  // Along the top: a Kitchen (uid 1), a Dining Room with a Chandelier (uid 2), and a Living
  // Room (uid 3) two tiles right of the Dining Room, so not connected. Then a whole
  // Entertainer further down (uids 4–6), which completes first and holds. A Hallway at (4, 0)
  // would touch the Dining Room and the Living Room, linking them.
  const UNLINKED: Placement[] = [
    ['kitchen', 0, 0],
    ['diningRoom', 2, 0], // (2–3, 0–1)
    ['livingRoom', 6, 0], // (6–7, 0–2)
    ...shifted(ENT_TOP, 0, 6),
  ];
  const HALL: Placement = ['hallway', 4, 0]; // uid 7: (4–5, 0)

  it('before any link, the complete group holds', () => {
    expect(keys(ONE_ENTERTAINER, UNLINKED)).toEqual(['entertainer:4,5,6']);
    // Uncapped, the Hallway adds the linked group: adding a set is fine.
    expect(keys(C, [...UNLINKED, HALL]).sort()).toEqual(['entertainer:1,2,3', 'entertainer:4,5,6']);
  });

  // Links are timed in placement order (sets.ts): a Hallway placed later links two earlier
  // rooms, but only from its own step, so the linked group can't "complete" at its Living
  // Room's turn (uid 3) ahead of the held group (uid 6). Placing a piece never swaps the held
  // Entertainer for another (here it would light the Chandelier), as D-065 and the cap say.
  it("a Hallway linking two earlier rooms doesn't swap the capped Entertainer", () => {
    const house = withFixture(houseFrom(C, L, [...UNLINKED, HALL]), 2, 'chandelier', 1);
    expect(keysOf(ONE_ENTERTAINER, house)).toEqual(['entertainer:4,5,6']);
    expect(tally(ONE_ENTERTAINER, house).xMults).toEqual([]);
  });
});

// The same on an uncapped set: the Suite, held at uids 3–5, stays when a Hallway links
// Bedroom 1 to the Bathroom; a different Suite (1–3) doesn't form in its place.
describe('the Suite and a later Hallway (D-065)', () => {
  const HELD: Placement[] = [
    ['bedroom', 0, 0], // 1: (0–1, 0–1)
    ['closet', 0, 2], // 2: under Bedroom 1
    ['bathroom', 4, 0], // 3: apart from Bedroom 1
    ['bedroom', 5, 0], // 4: beside the Bathroom
    ['closet', 4, 1], // 5: under the Bathroom, beside Bedroom 4
  ];
  const HALL: Placement = ['hallway', 2, 0]; // uid 6: (2–3, 0), touching Bedroom 1 and the Bathroom

  it('before the Hallway, the Suite at uids 3–5 holds', () => {
    expect(keys(C, HELD)).toEqual(['suite:3,4,5']);
  });

  // As above. The Jack-and-Jill is a fair addition (the Bathroom now touches both Bedrooms,
  // one through the Hallway), and the held Suite 3–5 stays: 1–2–3 doesn't replace it.
  it('a Hallway linking two earlier rooms never breaks the held Suite', () => {
    expect(keys(C, [...HELD, HALL])).toEqual(['jackAndJill:1,3,4', 'suite:3,4,5']);
  });
});

// ---------------------------------------------------------------------------------------
// Full House.

describe('Full House', () => {
  it('forms from one of each of the 9 Core indoor types, none of them touching', () => {
    expect(matchSets(C, computeLayout(C, houseFrom(C, L, FULL)))).toEqual([
      {
        set: 'fullHouse',
        key: FULL_KEY,
        members: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        points: 40,
        mult: 100,
      },
    ]);
  });

  it("needs every one of the 9 types, and special rooms don't stand in", () => {
    for (const [id] of FULL) {
      expect(
        keys(
          C,
          FULL.filter(([other]) => other !== id),
        ),
        `without the ${id}`,
      ).toEqual([]);
    }
    // A Library is a room, but not one of the 9.
    const library = FULL.map(([id, x, y]): Placement => [id === 'bedroom' ? 'library' : id, x, y]);
    expect(keys(C, library)).toEqual([]);
  });

  it('the L-Kitchen counts as the Kitchen, and the Long Hallway as the Hallway', () => {
    const variants = FULL.map(([id, x, y]): Placement => [
      id === 'kitchen' ? 'lKitchen' : id === 'hallway' ? 'longHallway' : id,
      x,
      y,
    ]);
    expect(keys(C, variants)).toEqual([FULL_KEY]);
  });

  it("a Kitchen with a Kitchen Island fills the Kitchen slot, never the Dining Room's (D-081)", () => {
    // The 9 types but the Dining Room (the Kitchen is uid 3), with an Island in the Kitchen.
    const noDining = withFixture(
      houseFrom(
        C,
        L,
        FULL.filter(([id]) => id !== 'diningRoom'),
      ),
      3,
      'kitchenIsland',
      1,
    );
    // The Island makes it a Dining Room for selectors, not for sets.
    expect(computeLayout(C, noDining).countsAs.get(3)?.get('diningRoom')).toBe(1);
    expect(keysOf(C, noDining)).toEqual([]);
    // With a real Dining Room too, the Island's Kitchen is the Kitchen.
    expect(keysOf(C, withFixture(houseFrom(C, L, FULL), 3, 'kitchenIsland', 1))).toEqual([
      FULL_KEY,
    ]);
    // Nor does it fill an Entertainer's Dining Room slot.
    const ent = withFixture(
      houseFrom(C, L, [
        ['kitchen', 0, 0],
        ['livingRoom', 2, 0],
      ]),
      1,
      'kitchenIsland',
      1,
    );
    expect(keysOf(C, ent)).toEqual([]);
  });

  it('takes the earliest piece of each type', () => {
    // A second Bedroom placed right after the first (uid 2): the first is the member.
    const early: Placement[] = [FULL[0]!, ['bedroom', 10, 6], ...FULL.slice(1)];
    expect(keys(C, early)).toEqual(['fullHouse:1,3,4,5,6,7,8,9,10']);
    // `inSet` (as the Chandelier uses for the Entertainer) sees the same members.
    const layout = computeLayout(C, houseFrom(C, L, early));
    expect(meetsCondition(C, layout, { inSet: 'fullHouse' }, 1)).toBe(true);
    expect(meetsCondition(C, layout, { inSet: 'fullHouse' }, 2)).toBe(false);
    // Placed after the set completes, it changes nothing.
    expect(keys(C, [...FULL, ['bedroom', 10, 6]])).toEqual([FULL_KEY]);
  });

  it('when a member is demolished, a spare of its type stands in, as a new instance', () => {
    // The spare Bedroom (uid 10) takes the first one's place: the key, which names the
    // members, changes, so the next tally plays setCompleted for it again.
    const house = houseFrom(C, L, [...FULL, ['bedroom', 10, 6]]);
    expect(keysOf(C, without(house, 1))).toEqual(['fullHouse:2,3,4,5,6,7,8,9,10']);
    // Without a spare, it's gone.
    expect(keysOf(C, without(house, 2))).toEqual([]);
  });

  it('holds one instance however many complete sets of 9 the house has', () => {
    const twice = [...FULL, ...shifted(FULL, 12)];
    expect(keys(C, twice, WIDE)).toEqual([FULL_KEY]);
    // Points 14 + 40 = 54; Mult 200, ×2 = 400; 54 × 4 = 216.
    expect(tally(C, houseFrom(C, WIDE, twice)).total).toBe(216);
    // The cap is what holds it: without one, the second 9 would make another.
    expect(keys(withSet('fullHouse', { maxInstances: undefined }), twice, WIDE)).toEqual([
      FULL_KEY,
      'fullHouse:10,11,12,13,14,15,16,17,18',
    ]);
  });

  it('still counts a piece that earns nothing: a Garage off the street (D-070)', () => {
    const offStreet = FULL.map(([id, x, y]): Placement =>
      id === 'garage' ? [id, 8, 6] : [id, x, y],
    );
    const t = tally(C, houseFrom(C, L, offStreet));
    const garage = t.pieces.find((p) => p.defId === 'garage')!;
    expect(garage).toMatchObject({ uid: 8, earned: 0 });
    expect(garage.unmet).toBeDefined();
    expect(t.sets.map((s) => s.key)).toEqual([FULL_KEY]);
    // Points 3 + 1 + 2 = 6, + 40 = 46; Mult 200, ×2 = 400; 46 × 4 = 184.
    expect([t.points, t.mult, t.total]).toEqual([46, 400, 184]);
  });
});

// ---------------------------------------------------------------------------------------
// Full House's ×2.

describe("Full House's ×2", () => {
  const plus25 = fromPlan({ kind: 'setBonus', set: 'fullHouse', pct: 25 });

  it('lands as a ×Mult from the set itself, named Full House', () => {
    const t = tally(C, houseFrom(C, L, FULL));
    expect(t.pieces.map((p) => p.earned)).toEqual([3, 0, 0, 0, 0, 1, 0, 1, 2]);
    expect(t.xMults).toEqual([
      {
        source: { kind: 'set', id: 'fullHouse' },
        label: 'Full House',
        times: 200,
        before: 200,
        after: 400,
      },
    ]);
    // Points 7 + 40 = 47; Mult 100 + 100 = 200, ×2 = 400; 47 × 4 = 188.
    expect([t.points, t.mult, t.total]).toEqual([47, 400, 188]);
    // One type short, no set and no ×2: 5 Points, Mult 100.
    const short = tally(C, houseFrom(C, L, FULL.slice(0, 8)));
    expect(short.xMults).toEqual([]);
    expect([short.points, short.mult, short.total]).toEqual([5, 100, 5]);
  });

  it("lands first, after sets, specs, and +Mult, then a fixture's, a blueprint's, and a tool's", () => {
    // No Core tool has a ×Mult; this test's Catalog does (×1.5), to fill the last place.
    const c: Content = {
      ...C,
      tools: { ...C.tools, catalog: { ...C.tools.catalog, name: 'Test Tool' } },
    };
    const house = withFixture(houseFrom(c, L, FULL_ENT), 2, 'chandelier', 1);
    // Listed back to front on purpose: the order is fixed, not the list's.
    const mods: ActiveMod[] = [
      active({ kind: 'tool', id: 'catalog' }, { kind: 'xMult', times: 150 }),
      active(
        { kind: 'blueprint', id: 'lastMinutePush' },
        C.blueprints.lastMinutePush.modifiers[0]!,
      ),
      ...toolMods('rushOrder'), // +0.5
    ];
    const specs = [
      wish('aKitchen', { count: { piece: 'kitchen' }, min: 1 }),
      wish('entertainer', { set: 'entertainer' }),
      wish('fullHouse', { set: 'fullHouse' }),
      wish('suite', { set: 'suite' }), // the Bedroom, Bathroom, and Closet are apart
    ];
    const t = tally(c, house, { mods, specs, lastWeek: true });
    expect(setsOf(t)).toEqual([
      ['entertainer', 25, 100],
      ['fullHouse', 40, 100],
    ]);
    expect(t.specs.map((s) => s.met)).toEqual([true, true, true, false]);
    expect(t.specBonus).toBe(25);
    expect(t.multTerms).toEqual([
      { source: { kind: 'tool', id: 'rushOrder' }, label: 'Rush Order', add: 50 },
    ]);
    // Mult before any ×Mult: 100 + 100 + 100 (the sets) + 3 × 25 (specs) + 50 (Rush Order) = 425.
    // Full House: 425 × 2 = 850. Chandelier: 850 × 1.25 = 1,062.5 → 1,063. Last-Minute Push:
    // × 2 = 2,126. The tool: × 1.5 = 3,189. (The Chandelier first would give 425 × 1.25 =
    // 531.25 → 531, then × 2 = 1,062.)
    expect(t.xMults).toEqual([
      {
        source: { kind: 'set', id: 'fullHouse' },
        label: 'Full House',
        times: 200,
        before: 425,
        after: 850,
      },
      {
        source: { kind: 'fixture', id: 'chandelier', uid: 2 },
        label: 'Chandelier',
        times: 125,
        before: 850,
        after: 1063,
      },
      {
        source: { kind: 'blueprint', id: 'lastMinutePush' },
        label: 'Last-Minute Push',
        times: 200,
        before: 1063,
        after: 2126,
      },
      {
        source: { kind: 'tool', id: 'catalog' },
        label: 'Test Tool',
        times: 150,
        before: 2126,
        after: 3189,
      },
    ]);
    // Points 10 + 25 + 40 = 75; 75 × 31.89 = 2,391.75 → 2,392.
    expect([t.points, t.mult, t.total]).toEqual([75, 3189, 2392]);
  });

  it('comes before Model Home too, which counts the fixture', () => {
    const house = withFixture(houseFrom(C, L, FULL_ENT), 2, 'chandelier', 1);
    const t = tally(C, house, {
      mods: [active({ kind: 'blueprint', id: 'modelHome' }, C.blueprints.modelHome.modifiers[0]!)],
    });
    // Mult 300, ×2 = 600, × 1.25 = 750, × 1.1 (one piece with a fixture) = 825.
    expect(xOf(t)).toEqual([
      ['Full House', 200, 300, 600],
      ['Chandelier', 125, 600, 750],
      ['Model Home', 110, 750, 825],
    ]);
  });

  it('multiplies once per set type, even with two instances (an uncapped Full House)', () => {
    const two = withSet('fullHouse', { maxInstances: undefined });
    const t = tally(two, houseFrom(two, WIDE, [...FULL, ...shifted(FULL, 12)]));
    expect(setsOf(t)).toEqual([
      ['fullHouse', 40, 100],
      ['fullHouse', 40, 100],
    ]);
    // Points 14 + 80 = 94; Mult 100 + 200 = 300, ×2 once = 600; 94 × 6 = 564.
    expect(xOf(t)).toEqual([['Full House', 200, 300, 600]]);
    expect(t.total).toBe(564);
  });

  it('a set without times lands no ×Mult, and neither does a ×1', () => {
    expect(tally(C, houseFrom(C, L, SUITE)).xMults).toEqual([]);
    const x1 = withSet('fullHouse', { times: 100 });
    const t = tally(x1, houseFrom(x1, L, FULL));
    expect(t.sets.map((s) => s.set)).toEqual(['fullHouse']);
    expect(t.xMults).toEqual([]);
    // 47 × 2 = 94.
    expect([t.mult, t.total]).toEqual([200, 94]);
  });

  it('setBonus scales its Points and +Mult, never its ×2', () => {
    const t = tally(C, houseFrom(C, L, FULL), { mods: [plus25] });
    // 40 × 1.25 = 50; 100 × 1.25 = 125. Points 57; Mult 225, ×2 = 450; 57 × 4.5 = 256.5 → 257.
    expect(setsOf(t)).toEqual([['fullHouse', 50, 125]]);
    expect(xOf(t)).toEqual([['Full House', 200, 225, 450]]);
    expect(t.total).toBe(257);
    // A bonus for every set scales the Suite too, half up: 15 × 1.5 = 22.5 → 23, 50 → 75; the
    // Full House 60 and 150.
    const t2 = tally(C, houseFrom(C, L, SUITE_FULL), {
      mods: [fromPlan({ kind: 'setBonus', pct: 50 })],
    });
    expect(setsOf(t2)).toEqual([
      ['suite', 23, 75],
      ['fullHouse', 60, 150],
    ]);
    // Points 10 + 23 + 60 = 93; Mult 100 + 75 + 150 = 325, ×2 = 650; 93 × 6.5 = 604.5 → 605.
    expect(xOf(t2)).toEqual([['Full House', 200, 325, 650]]);
    expect(t2.total).toBe(605);
  });

  it('levels add their Points and +Mult and leave the ×2, and wait for the set to form', () => {
    const t = tally(C, houseFrom(C, L, FULL), { setLevels: { fullHouse: 3 } });
    // Level 3: 40 + 2 × 20 = 80 Points, 100 + 2 × 50 = +2. Points 87; Mult 300, ×2 = 600; 522.
    expect(setsOf(t)).toEqual([['fullHouse', 80, 200]]);
    expect(xOf(t)).toEqual([['Full House', 200, 300, 600]]);
    expect(t.total).toBe(522);
    // The Suite: +10 and +0.25 a level.
    expect(setsOf(tally(C, houseFrom(C, L, SUITE), { setLevels: { suite: 2 } }))).toEqual([
      ['suite', 25, 75],
    ]);
    // A setBonus scales the leveled numbers: level 2 is 60 and 150; +25% is 75 and
    // 187.5 → 188. Points 82; Mult 288, ×2 = 576; 82 × 5.76 = 472.32 → 472.
    const both = tally(C, houseFrom(C, L, FULL), { setLevels: { fullHouse: 2 }, mods: [plus25] });
    expect(setsOf(both)).toEqual([['fullHouse', 75, 188]]);
    expect(xOf(both)).toEqual([['Full House', 200, 288, 576]]);
    expect(both.total).toBe(472);
    // A level for a set the house doesn't hold yet pays nothing until it forms.
    const short = tally(C, houseFrom(C, L, FULL.slice(0, 8)), { setLevels: { fullHouse: 2 } });
    expect(short.sets).toEqual([]);
    expect(short.total).toBe(5);
  });

  it('integer math: mult = floor((mult × times + 50) / 100), total = floor((points × mult + 50) / 100)', () => {
    const met = [wish('fullHouse', { set: 'fullHouse' })];
    const t = tally(C, houseFrom(C, L, FULL), { specs: met });
    // Mult 100 + 100 (the set) + 25 (one spec met) = 225. ×2: (225 × 200 + 50) / 100 = 450.5
    // → 450. Total: (47 × 450 + 50) / 100 = 212, which is 211.5 rounded half up.
    expect(xOf(t)).toEqual([['Full House', 200, 225, 450]]);
    expect(t.total).toBe(212);
    expect(weekTotal(47, 450)).toBe(212);
    // A ×1.5 Full House (not the real one) rounds the Mult: (225 × 150 + 50) / 100 = 338, from
    // 337.5. Total: (47 × 338 + 50) / 100 = 159.36 → 159, from 158.86.
    const x150 = withSet('fullHouse', { times: 150 });
    const t150 = tally(x150, houseFrom(x150, L, FULL), { specs: met });
    expect(xOf(t150)).toEqual([['Full House', 150, 225, 338]]);
    expect(t150.total).toBe(159);
    // Below the half it rounds down: ×1.33 is (225 × 133 + 50) / 100 = 299.75 → 299, from
    // 299.25. Total: (47 × 299 + 50) / 100 = 141.03 → 141, from 140.53.
    const x133 = withSet('fullHouse', { times: 133 });
    const t133 = tally(x133, houseFrom(x133, L, FULL), { specs: met });
    expect(xOf(t133)).toEqual([['Full House', 133, 225, 299]]);
    expect(t133.total).toBe(141);
  });
});

// ---------------------------------------------------------------------------------------
// Remodel Plans for the Suite and Full House, in a run.

describe('Remodel Plans: Suite and Full House (levelSet, in a run)', () => {
  const R = createRules(C);
  const give = (id: ToolId): Action => ({ t: 'debug', op: 'giveGood', good: { kind: 'tool', id } });
  const USE: UseToolAction = { t: 'useTool', i: 0 };
  const PASS: Action = { t: 'pass' };

  /** A run in week 1 with this house (placed unchecked). */
  function runOn(placements: readonly Placement[]): RunState {
    const s = R.newRun(setup('sets-m4a'));
    return { ...s, house: houseFrom(C, L, placements) };
  }

  function applyAll(s: RunState, actions: readonly Action[]) {
    const events: GameEvent[] = [];
    for (const a of actions) {
      const out = R.apply(s, a);
      s = out.state;
      events.push(...out.events);
    }
    return { state: s, events };
  }

  it('Remodel Plans: Suite takes the Suite to level 2 for the rest of the run', () => {
    const s = R.apply(runOn(SUITE_FULL), give('remodelSuite')).state;
    expect(s.supplies).toEqual([{ kind: 'tool', id: 'remodelSuite' }]);
    expect(s.setLevels).toEqual({});
    // Points 10 + 15 + 40 = 65; Mult 100 + 50 + 100 = 250, ×2 = 500; 65 × 5 = 325.
    expect(R.currentTally(s).total).toBe(325);

    const used = R.apply(s, USE);
    expect(used.events).toEqual([{ t: 'toolUsed', tool: 'remodelSuite' }]);
    expect(used.state.supplies).toEqual([]);
    expect(used.state.setLevels).toEqual({ suite: 2 });
    const t = R.currentTally(used.state);
    // The Suite at level 2: 25 Points, +0.75. The Full House is untouched.
    expect(setsOf(t)).toEqual([
      ['suite', 25, 75],
      ['fullHouse', 40, 100],
    ]);
    // Points 75; Mult 275, ×2 = 550; 75 × 5.5 = 412.5 → 413.
    expect(xOf(t)).toEqual([['Full House', 200, 275, 550]]);
    expect(t.total).toBe(413);

    // The level outlasts the week.
    const next = R.apply(used.state, PASS);
    expect(eventsOf(next.events, 'tally')[0]!.tally.total).toBe(413);
    expect(next.state.week).toBe(2);
    expect(next.state.setLevels).toEqual({ suite: 2 });
    expect(R.currentTally(next.state).total).toBe(413);
  });

  it('Remodel Plans: Full House adds +20 Points and +0.5 a level, and the ×2 stays ×2', () => {
    const s = applyAll(runOn(SUITE_FULL), [
      give('remodelFullHouse'),
      give('remodelFullHouse'),
    ]).state;
    // Level 2: 60 Points, +1.5. Points 10 + 15 + 60 = 85; Mult 100 + 50 + 150 = 300, ×2 = 600;
    // 85 × 6 = 510. These Hendersons have no checklist, so no line flips; a level isn't a new
    // set, so no set flips either.
    expect(R.previewTool(s, USE)).toEqual({
      ok: true,
      before: { points: 65, mult: 500, total: 325 },
      after: { points: 85, mult: 600, total: 510 },
      delta: 185,
      cells: [],
      specsGained: [],
      specsLost: [],
      setsGained: [],
      setsLost: [],
    });
    const l2 = R.apply(s, USE);
    expect(l2.events).toEqual([{ t: 'toolUsed', tool: 'remodelFullHouse' }]);
    expect(l2.state.setLevels).toEqual({ fullHouse: 2 });
    const t2 = R.currentTally(l2.state);
    expect(setsOf(t2)).toEqual([
      ['suite', 15, 50],
      ['fullHouse', 60, 150],
    ]);
    expect(xOf(t2)).toEqual([['Full House', 200, 300, 600]]);
    expect(t2.total).toBe(510);
    // Level 3: 80 Points, +2. Points 105; Mult 350, ×2 = 700; 105 × 7 = 735.
    const l3 = R.apply(l2.state, USE).state;
    expect(l3.setLevels).toEqual({ fullHouse: 3 });
    expect(xOf(R.currentTally(l3))).toEqual([['Full House', 200, 350, 700]]);
    expect(R.currentTally(l3).total).toBe(735);
  });

  it('both plans: each levels its own set', () => {
    const s = applyAll(runOn(SUITE_FULL), [
      give('remodelSuite'),
      give('remodelFullHouse'),
      USE,
      USE,
    ]).state;
    expect(s.setLevels).toEqual({ suite: 2, fullHouse: 2 });
    const t = R.currentTally(s);
    // Points 10 + 25 + 60 = 95; Mult 100 + 75 + 150 = 325, ×2 = 650; 95 × 6.5 = 617.5 → 618.
    expect(setsOf(t)).toEqual([
      ['suite', 25, 75],
      ['fullHouse', 60, 150],
    ]);
    expect(t.total).toBe(618);
  });

  it('a level bought before the Full House pays once it forms; completing it plays setCompleted once', () => {
    // The Full House but its Home Office (uids 1–8), at level 2 already.
    let s = applyAll(runOn(FULL.filter(([id]) => id !== 'homeOffice')), [
      give('remodelFullHouse'),
      USE,
      { t: 'debug', op: 'giveCard', id: 'homeOffice' },
    ]).state;
    expect(s.setLevels).toEqual({ fullHouse: 2 });
    expect(R.currentTally(s).sets).toEqual([]);
    // The Home Office under the Closet: it touches the house, so it's legal.
    const play: PlaceAction = {
      t: 'place',
      from: 'hand',
      i: s.hand.length - 1,
      x: 3,
      y: 4,
      rot: 0,
    };
    const p = R.preview(s, play);
    expect(p.legal).toBe(true);
    expect(p.setsGained).toEqual([
      {
        set: 'fullHouse',
        key: FULL_KEY,
        members: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        points: 60,
        mult: 150,
      },
    ]);
    expect(p.xMults).toEqual([
      {
        source: { kind: 'set', id: 'fullHouse' },
        label: 'Full House',
        times: 200,
        before: 250,
        after: 500,
      },
    ]);
    // Before: 3 + 1 + 1 = 5. After: 7 + 60 = 67; Mult 250, ×2 = 500; 67 × 5 = 335.
    expect(p.before).toEqual({ points: 5, mult: 100, total: 5 });
    expect(p.after).toEqual({ points: 67, mult: 500, total: 335 });
    // D-122: the parts. Full House's ×2 is Sparkle: 67 × (500 − 250) / 100 = 167.5. The set's
    // own Comfort and Charm: 60 × 1.0 + 150 × 0.67 = 160.5. The halves round to the earlier part.
    expect(p.parts.reduce((n, x) => n + x.wow, 0)).toBe(p.delta);
    expect(p.parts.slice(0, 2)).toEqual([
      { kind: 'sparkle', label: 'Full House', wow: 167 },
      { kind: 'set', label: 'Full House', wow: 161 },
    ]);

    const week1 = R.apply(s, play);
    expect(eventsOf(week1.events, 'setCompleted')).toEqual([
      { t: 'setCompleted', set: 'fullHouse', key: FULL_KEY, members: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ]);
    expect(week1.state.score).toBe(335);
    // The next week pays it again, without another celebration.
    s = week1.state;
    const week2 = R.apply(s, PASS);
    expect(eventsOf(week2.events, 'tally')[0]!.tally.total).toBe(335);
    expect(eventsOf(week2.events, 'setCompleted')).toEqual([]);
  });
});
