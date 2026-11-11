// What a blueprint is worth (D-141): the rules' numbers behind the shop's line under each
// blueprint, on a crate's blueprint options, and on the free Housewarming pick.
//
// - blueprintValue: the week's total with the blueprint in play, less without, for the first
//   week it would count in (in the shop, the next phase's first, after the transforms that
//   start it), and each week left in the run added up with nothing more built: the house's
//   timers run on, each phase's last week counts as one, and overtime is left out.
// - A blueprint that acts only in a phase's last week gives that week's gain; one that grows
//   says how far; budget is counted apart from Wow; a ×Mult that scales with early milestones
//   says what one more would add; and one that would add nothing says what it's waiting for.
// - It reads the blueprint's modifiers by kind, never its id, and never changes the state.
//
// Rules tests use TEST_CONTENT (testing.ts), whose blueprints are Appendix B's first encodings.
// Houses are built on a 12×12 lot with houseFrom, so uids follow the placement order and every
// piece has placedWeek 1; the street runs along the bottom edge (y = 11), so pieces near the
// top never touch it. Here 4 phases of 3 weeks, with targets out of reach.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/index.ts';
import type {
  Action,
  BlueprintDef,
  BlueprintId,
  Content,
  GameEvent,
  RunState,
  ShopOffer,
} from './index.ts';
import { withFixture } from './fixtures.ts';
import { createRules, type Rules } from './run.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

const W = 3;
const PHASES = 4;
const CONTENT_4x3: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: W,
    phases: [1, 2, 3, 4].map((k) => ({ name: `Phase ${k}`, target: 100_000 * k })),
  },
};
const R = createRules(CONTENT_4x3);
const PASS: Action = { t: 'pass' };

/** Week 1 of a run with these pieces on these rows, and these blueprints bought in week 1. */
function build(
  placements: readonly Placement[],
  opts: { rows?: readonly string[]; held?: readonly BlueprintId[]; r?: Rules } = {},
): RunState {
  const r = opts.r ?? R;
  const s = r.newRun(setup('blueprint-value'));
  return {
    ...s,
    house: houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: [],
    blueprints: (opts.held ?? []).map((id) => ({ id, boughtWeek: 1 })),
  };
}

/** The same run at another week of its phase, or of a later one. */
const at = (s: RunState, phase: number, slot: number): RunState => ({
  ...s,
  phase,
  slot,
  week: phase * W + slot,
});

function treesAt(...cells: readonly [number, number][]): string[] {
  const rows = emptyRows(12, 12).map((r) => r.split(''));
  for (const [x, y] of cells) rows[y]![x] = 'T';
  return rows.map((r) => r.join(''));
}

/** Meets the phase's target, then passes until the milestone resolves and the shop opens. */
function toShop(r: Rules, s: RunState): RunState {
  s = { ...s, score: Math.max(s.score, r.target(s)) };
  while (s.screen === 'build') s = r.apply(s, PASS).state;
  expect(s.screen).toBe('shop');
  return s;
}

/** The open shop with just these goods for sale, and budget enough for any of them. */
function withGoods(s: RunState, goods: readonly ShopOffer[]): RunState {
  const visit = s.offers!.shop!;
  return { ...s, budget: 50, offers: { shop: { ...visit, offers: goods, sale: null } } };
}

/** The total of the next week's tally, passing. */
function nextTotal(r: Rules, s: RunState): number {
  const events: GameEvent[] = r.apply(s, PASS).events;
  const tally = events.find((e) => e.t === 'tally');
  if (tally?.t !== 'tally') throw new Error('no tally');
  return tally.tally.total;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// Two Bedrooms side by side (uids 1, 2: steady 3 + 1 for the Quiet neighbor = 4 each), and a
// Living Room (uid 3, 2×3) with two Trees beside it (+2 per view source = 4): 12 Wow a week.
const HOUSE: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
  ['livingRoom', 6, 0],
];
const HOUSE_ROWS = treesAt([8, 0], [8, 1]);
const ALL_WEEKS = W * PHASES;

// ---------------------------------------------------------------------------------------

describe('blueprintValue: a blueprint’s worth in the house as it stands (D-141)', () => {
  it('is the week’s total with it less without, and each week left added up', () => {
    // Quiet Hours: Quiet pieces earn +50%. The Bedrooms go 4 → 6; the Living Room isn't Quiet.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.currentTally(s).total).toBe(12);
    const v = R.blueprintValue(s, 'quietHours');
    expect(v).toEqual({
      gain: 4,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 4 * ALL_WEEKS,
      budget: 0,
      held: false,
    });
    // The same as holding it: what the rules' own tally says with it in play.
    const held = build(HOUSE, { rows: HOUSE_ROWS, held: ['quietHours'] });
    expect(R.currentTally(held).total - R.currentTally(s).total).toBe(v!.gain);
    expect(R.preview(held, null).after.total - R.preview(s, null).after.total).toBe(v!.gain);
  });

  it('counts the weeks still to play: this phase’s, then the later phases’, never overtime', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.blueprintValue(at(s, 0, 3), 'quietHours')).toMatchObject({
      gain: 4,
      weeksLeft: 1 + 3 * W,
      overRun: 4 * (1 + 3 * W),
    });
    expect(R.blueprintValue(at(s, 3, 2), 'quietHours')).toMatchObject({
      weeksLeft: 2,
      overRun: 8,
    });
    // An overtime week is its phase's last.
    const overtime = { ...at(s, 1, 4), overtimeWeek: 1 };
    expect(R.blueprintValue(overtime, 'quietHours')).toMatchObject({
      weeksLeft: 1 + 2 * W,
      overRun: 4 * (1 + 2 * W),
    });
  });

  it('in the shop, values the next phase’s first week, and matches what buying it then tallies', () => {
    const shop = withGoods(toShop(R, build(HOUSE, { rows: HOUSE_ROWS })), [
      { kind: 'blueprint', id: 'quietHours' },
    ]);
    const v = R.blueprintValue(shop, 'quietHours');
    expect(v).toMatchObject({ gain: 4, weeksLeft: 3 * W, overRun: 4 * 3 * W, held: false });
    const plain = R.apply(shop, { t: 'leaveShop' }).state;
    const bought = R.apply(R.apply(shop, { t: 'buy', i: 0 }).state, { t: 'leaveShop' }).state;
    expect(bought.blueprints.map((o) => o.id)).toEqual(['quietHours']);
    expect(nextTotal(R, bought) - nextTotal(R, plain)).toBe(v!.gain);
  });

  it('scores the house after the transforms that start the next week, and lets its timers run on', () => {
    // Country Living: every piece earns +1 per touching Tree. A Bedroom beside a Sapling: no
    // Tree yet. Placed in week 1 and a week older than that, the Sapling is a Tree from week 4,
    // the next phase's first; from then the Bedroom earns +1 more with the blueprint.
    const s0 = build([
      ['bedroom', 0, 0],
      ['sapling', 2, 0],
    ]);
    const aged = (ageBonus: number): RunState => ({
      ...s0,
      house: {
        ...s0.house,
        pieces: s0.house.pieces.map((p) => (p.defId === 'sapling' ? { ...p, ageBonus } : p)),
      },
    });
    const shop = toShop(R, aged(1));
    expect(shop.house.pieces.map((p) => p.defId)).toEqual(['bedroom', 'sapling']);
    expect(R.blueprintValue(shop, 'countryLiving')).toMatchObject({
      gain: 1,
      weeksLeft: 3 * W,
      overRun: 3 * W,
    });
    // On the build screen in week 1, a Sapling of week 1 is a Tree from week 5: nothing for
    // four weeks, then +1 a week for the eight left.
    const v = R.blueprintValue(aged(0), 'countryLiving');
    expect(v).toMatchObject({ gain: 0, weeksLeft: ALL_WEEKS, overRun: ALL_WEEKS - 4 });
    expect(v!.needs).toBeUndefined();
  });

  it('values a blueprint already held against the run without it', () => {
    const held = build(HOUSE, { rows: HOUSE_ROWS, held: ['quietHours'] });
    expect(R.blueprintValue(held, 'quietHours')).toEqual({
      gain: 4,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 4 * ALL_WEEKS,
      budget: 0,
      held: true,
    });
    // Another one is valued on top of it: Party House adds half the Living Room's 4.
    expect(R.blueprintValue(held, 'partyHouse')).toMatchObject({ gain: 2, held: false });
    const both = build(HOUSE, { rows: HOUSE_ROWS, held: ['quietHours', 'partyHouse'] });
    expect(R.currentTally(both).total - R.currentTally(held).total).toBe(2);
  });

  it('doesn’t change the state, and says the same thing twice', () => {
    const s = deepFreeze(build(HOUSE, { rows: HOUSE_ROWS, held: ['quietHours'] }));
    const a = R.blueprintValue(s, 'goodBones');
    expect(R.blueprintValue(s, 'goodBones')).toBe(a);
    expect(R.blueprintValue(s, 'quietHours')).toMatchObject({ held: true });
  });

  it('is null where there’s no week to value, and for a blueprint that changes no tally', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.blueprintValue(s, 'noSuchThing' as BlueprintId)).toBeNull();
    expect(R.blueprintValue({ ...s, screen: 'won' }, 'quietHours')).toBeNull();
    expect(R.blueprintValue({ ...s, screen: 'lost' }, 'quietHours')).toBeNull();
    expect(R.blueprintValue({ ...s, screen: 'changeOrder' }, 'quietHours')).toBeNull();
    // A blueprint that only changes a run rule the tally doesn't read.
    const rerolls: BlueprintDef = {
      ...C.blueprints.quietHours,
      modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
    };
    const r = createRules({
      ...CONTENT_4x3,
      blueprints: { ...C.blueprints, quietHours: rerolls },
    });
    expect(r.blueprintValue(build(HOUSE, { rows: HOUSE_ROWS, r }), 'quietHours')).toBeNull();
  });
});

describe('blueprintValue: where one week’s snapshot would be wrong or empty', () => {
  it('growth (Good Bones): the first week’s gain, how far it grows, and every week added up', () => {
    // Every room grows +1 a week, up to +10, from the week it's bought: 3 rooms.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const perRoom = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10].reduce((a, n) => a + n, 0);
    expect(R.blueprintValue(s, 'goodBones')).toEqual({
      gain: 3,
      when: 'week',
      growsTo: 30,
      weeksLeft: ALL_WEEKS,
      overRun: 3 * perRoom,
      budget: 0,
      held: false,
    });
    // Late in the run it has less time to grow: 1 + 2 + 3 a room.
    expect(R.blueprintValue(at(s, 3, 1), 'goodBones')).toMatchObject({
      gain: 3,
      growsTo: 9,
      overRun: 3 * 6,
    });
    // Held since week 1, it has grown: in week 3 it adds 3 a room, and still counts up.
    const held = at(build(HOUSE, { rows: HOUSE_ROWS, held: ['goodBones'] }), 0, 3);
    expect(R.blueprintValue(held, 'goodBones')).toMatchObject({
      gain: 9,
      growsTo: 30,
      held: true,
    });
    // In its last week there's nothing left to grow to.
    expect(R.blueprintValue(at(s, 3, 3), 'goodBones')).toEqual({
      gain: 3,
      when: 'week',
      weeksLeft: 1,
      overRun: 3,
      budget: 0,
      held: false,
    });
  });

  it('budget, not Wow (Solar Panels): what it would pay over the weeks left', () => {
    // Every Sunny piece pays 1 budget every 4th week from the week it's bought. A Pool is
    // Sunny: weeks 4, 8 and 12 of the 12 left.
    const s = build([['pool', 0, 0]]);
    expect(R.blueprintValue(s, 'solarPanels')).toEqual({
      gain: 0,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 0,
      budget: 3,
      held: false,
    });
    // With three weeks left it would never pay: it says so plainly, since a Sunny piece is here.
    expect(R.blueprintValue(at(s, 3, 1), 'solarPanels')).toMatchObject({
      budget: 0,
      needs: 'Adds nothing to your house yet',
    });
  });

  it('a phase’s last week only (Last-Minute Push): that week’s gain, once a phase', () => {
    // ×2 Charm in each phase's last week: 12 → 24.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.blueprintValue(s, 'lastMinutePush')).toEqual({
      gain: 12,
      when: 'lastWeek',
      weeksLeft: ALL_WEEKS,
      overRun: 12 * PHASES,
      budget: 0,
      held: false,
    });
    // The same in the last week itself, and as the rules tally it there.
    const last = at(s, 0, 3);
    expect(R.blueprintValue(last, 'lastMinutePush')).toMatchObject({
      gain: 12,
      when: 'lastWeek',
      overRun: 12 * PHASES,
    });
    const held = at(build(HOUSE, { rows: HOUSE_ROWS, held: ['lastMinutePush'] }), 0, 3);
    expect(R.currentTally(held).total - R.currentTally(last).total).toBe(12);
    expect(R.currentTally(at(held, 0, 2)).total).toBe(12);
  });

  it('future choices (Ahead of Schedule): what it adds now, and what one more early milestone would', () => {
    // ×(1 + 0.2 per milestone completed early). With none: ×1, nothing; one would make 12 × 1.2.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.blueprintValue(s, 'aheadOfSchedule')).toEqual({
      gain: 0,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 0,
      budget: 0,
      perStat: { stat: 'milestonesEarly', gain: 2 },
      needs: 'No milestone completed early yet',
      held: false,
    });
    // With two: ×1.4 is 17 (16.8 rounded), +5; a third makes ×1.6, 19, +2 more.
    const two = { ...s, milestonesEarly: 2 };
    const v = R.blueprintValue(two, 'aheadOfSchedule');
    expect(v).toMatchObject({
      gain: 5,
      overRun: 5 * ALL_WEEKS,
      perStat: { stat: 'milestonesEarly', gain: 2 },
    });
    expect(v!.needs).toBeUndefined();
  });

  it('a Mult counted per piece (It’s a House, Model Home): what one more would add (D-143)', () => {
    // It's a House: +0.15 Charm per House piece. With none it adds nothing, and the first
    // would make 12 × 1.15 = 13.8 → 14.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.blueprintValue(s, 'itsAHouse')).toEqual({
      gain: 0,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 0,
      budget: 0,
      perPiece: { what: 'House piece', gain: 2 },
      needs: 'No House pieces yet',
      held: false,
    });
    // A Birdhouse away from any Tree earns nothing itself. One: +2; a second makes 12 × 1.3 =
    // 15.6 → 16, +2 more, which is what building it tallies.
    const one = build([...HOUSE, ['birdhouse', 0, 6]], { rows: HOUSE_ROWS });
    const v = R.blueprintValue(one, 'itsAHouse');
    expect(v).toMatchObject({ gain: 2, perPiece: { what: 'House piece', gain: 2 } });
    expect(v!.needs).toBeUndefined();
    const two = build([...HOUSE, ['birdhouse', 0, 6], ['birdhouse', 2, 6]], {
      rows: HOUSE_ROWS,
      held: ['itsAHouse'],
    });
    expect(R.currentTally(two).total).toBe(12 + v!.gain + v!.perPiece!.gain);

    // Model Home: ×(1 + 0.1 per piece with a fixture). No term yet, so the first starts one:
    // 12 × 1.1 = 13.2 → 13. With one installed (a Fireplace: its Living Room earns 8, so 16
    // Comfort × 1.1 = 17.6 → 18), a second makes ×1.2: 19.2 → 19.
    expect(R.blueprintValue(s, 'modelHome')).toMatchObject({
      gain: 0,
      perPiece: { what: 'piece with a fixture', gain: 1 },
      needs: 'No pieces with a fixture yet',
    });
    const lit = { ...s, house: withFixture(s.house, 3, 'fireplace', 1) };
    expect(R.currentTally(lit).total).toBe(16);
    expect(R.blueprintValue(lit, 'modelHome')).toMatchObject({
      gain: 2,
      perPiece: { what: 'piece with a fixture', gain: 1 },
    });
    // A blueprint that counts nothing has no such figure.
    expect(R.blueprintValue(s, 'quietHours')!.perPiece).toBeUndefined();
  });

  it('spec bonuses (Dream Home): each checklist line met adds more Charm', () => {
    // One line met (a Bedroom), one not (a Kitchen): Charm 1 + 0.25, and +0.1 more with it.
    const content = withClient(
      {
        specs: [
          {
            id: 'aBedroom',
            name: 'A Bedroom',
            group: 'wishes',
            condition: { count: { piece: 'bedroom' }, min: 1 },
          },
          {
            id: 'aKitchen',
            name: 'A Kitchen',
            group: 'wishes',
            condition: { count: { piece: 'kitchen' }, min: 1 },
          },
        ],
      },
      CONTENT_4x3,
    );
    const r = createRules(content);
    const s = build(HOUSE, { rows: HOUSE_ROWS, r });
    // 12 × 1.25 = 15; 12 × 1.35 = 16.2.
    expect(r.currentTally(s).total).toBe(15);
    expect(r.blueprintValue(s, 'dreamHome')).toMatchObject({
      gain: 1,
      when: 'week',
      overRun: ALL_WEEKS,
    });
    // With no line met, it says what it's waiting for.
    const none = build([['livingRoom', 6, 0]], { rows: HOUSE_ROWS, r });
    expect(r.blueprintValue(none, 'dreamHome')).toMatchObject({
      gain: 0,
      needs: 'No checklist line met yet',
    });
  });

  it('links (Open Concept): what the linked group would earn', () => {
    // Dining Room, Kitchen, Living Room in a row: the Dining Room's +50% reaches the Kitchen
    // beside it (2 → 3), and, once they're linked, the Living Room (4 → 6). The three are an
    // Entertainer (+25 Comfort, +1 Charm), so the week is (3 + 4 + 25) × 2, and (3 + 6 + 25) × 2.
    const row: Placement[] = [
      ['diningRoom', 0, 0],
      ['kitchen', 2, 0],
      ['livingRoom', 4, 0],
    ];
    const s = build(row, { rows: treesAt([6, 0], [6, 1]) });
    expect(R.currentTally(s).total).toBe(64);
    expect(R.blueprintValue(s, 'openConcept')).toEqual({
      gain: 4,
      when: 'week',
      weeksLeft: ALL_WEEKS,
      overRun: 4 * ALL_WEEKS,
      budget: 0,
      held: false,
    });
    // Two of them touching are a group already: linked, they gain nothing.
    const pair = build([
      ['diningRoom', 0, 0],
      ['kitchen', 2, 0],
    ]);
    expect(R.blueprintValue(pair, 'openConcept')).toMatchObject({
      gain: 0,
      needs: 'Adds nothing to your house yet',
    });
    // Apart, there's no group at all.
    const apart = build([
      ['diningRoom', 0, 0],
      ['kitchen', 4, 0],
    ]);
    expect(R.blueprintValue(apart, 'openConcept')).toMatchObject({
      gain: 0,
      needs: 'None of its pieces touch yet',
    });
  });
});

describe('blueprintValue: what a blueprint with nothing to add is waiting for', () => {
  // A Lawn alone: a Green yard piece that earns 1, and nothing else. With no house yet, the
  // whole lot is front yard.
  const lawn = build([['lawn', 0, 0]]);
  const empty = build([]);

  it.each<[BlueprintId, string]>([
    ['fengShui', 'No pieces with a view yet'],
    ['quietHours', 'No Quiet pieces yet'],
    ['partyHouse', 'No Social pieces yet'],
    ['waterfront', 'No pieces touching the Pond or the Creek yet'],
    ['openConcept', 'None of its pieces touch yet'],
    ['goodBones', 'No rooms yet'],
    ['itsAHouse', 'No House pieces yet'],
    ['countryLiving', 'No pieces touching a Tree yet'],
    ['moodLighting', 'No Dark rooms yet'],
    ['showHome', 'No pieces with a fixture yet'],
    ['solarPanels', 'No Sunny pieces yet'],
    ['dreamHome', 'No checklist line met yet'],
    ['modelHome', 'No pieces with a fixture yet'],
    ['aheadOfSchedule', 'No milestone completed early yet'],
  ])('%s: %s', (id, needs) => {
    expect(R.blueprintValue(lawn, id)).toMatchObject({ gain: 0, overRun: 0, budget: 0, needs });
  });

  it('says nothing is needed where the house already has what it acts on', () => {
    // Green Thumb: the Lawn's 1 earns +50%, 2 (1.5 rounded). Curb Appeal doubles it in the
    // front yard. Crown Jewel doubles the top earner. Last-Minute Push doubles the week's 1 in
    // a last week.
    for (const id of ['greenThumb', 'curbAppeal', 'crownJewel', 'lastMinutePush'] as const) {
      const v = R.blueprintValue(lawn, id);
      expect(v, id).toMatchObject({ gain: 1 });
      expect(v!.needs, id).toBeUndefined();
    }
  });

  it('a selector’s region reads as one: nothing in the front yard', () => {
    // A Bedroom toward the street puts the Lawn behind it in the back yard.
    const behind = build([
      ['lawn', 0, 0],
      ['bedroom', 0, 6],
    ]);
    expect(R.blueprintValue(behind, 'curbAppeal')).toMatchObject({
      gain: 0,
      needs: 'No pieces in the front yard yet',
    });
  });

  it('a percentage with pieces to act on, but too little to show, says so', () => {
    // Rounding: a Lawn's 1 is 2 at +50% (1.5 rounded) and still 2 at +100%. So a second +50%
    // for Green pieces adds nothing on top of Green Thumb: here Quiet Hours is given Green
    // Thumb's modifiers and valued in a run that holds Green Thumb.
    const twin: BlueprintDef = {
      ...C.blueprints.quietHours,
      modifiers: C.blueprints.greenThumb.modifiers,
    };
    const r = createRules({ ...CONTENT_4x3, blueprints: { ...C.blueprints, quietHours: twin } });
    const s = build([['lawn', 0, 0]], { held: ['greenThumb'], r });
    expect(r.currentTally(s).total).toBe(2);
    expect(r.blueprintValue(s, 'quietHours')).toMatchObject({
      gain: 0,
      overRun: 0,
      needs: 'Green pieces here earn too little yet',
    });
  });

  it('on an empty lot, the ones that multiply the week say nothing is earning', () => {
    expect(R.blueprintValue(empty, 'crownJewel')!.needs).toBe('Nothing is earning yet');
    expect(R.blueprintValue(empty, 'lastMinutePush')!.needs).toBe('Nothing is earning yet');
    expect(R.blueprintValue(empty, 'countryLiving')!.needs).toBe('No pieces yet');
    expect(R.blueprintValue(empty, 'greenThumb')!.needs).toBe('No Green pieces yet');
  });
});

describe('blueprintValue: the game’s own blueprints', () => {
  const rules = createRules(CONTENT);
  const ids = Object.keys(CONTENT.blueprints) as BlueprintId[];

  it('gives every blueprint a number or a short line about what it needs, from a run’s first week', () => {
    const s = rules.newRun({
      seed: 'blueprint-value',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    expect(s.screen).toBe('build');
    const weeks = CONTENT.balance.weeksPerPhase * CONTENT.balance.phases.length;
    for (const id of ids) {
      const v = rules.blueprintValue(s, id);
      expect(v, id).not.toBeNull();
      expect(v!.weeksLeft, id).toBe(weeks);
      const says = v!.gain !== 0 || v!.overRun !== 0 || v!.budget !== 0;
      if (!says) {
        expect(v!.needs, id).toBeTruthy();
        // A few words: it has to fit a shop card.
        expect(v!.needs!.length, id).toBeLessThanOrEqual(48);
      } else expect(v!.needs, id).toBeUndefined();
    }
  });
});
