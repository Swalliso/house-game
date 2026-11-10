// One test per blueprint (Appendix B · Blueprints; D-051, D-056), against the real content:
// what each one does to a small hand-built house through runModifiers, computeLayout, and
// tallyHouse, and, for the ones that read the run (Last-Minute Push, Ahead of Schedule), in a
// real run. Also their rarity, price, text, and whether the shop offers them. Numbers here
// follow blueprints.ts and pieces.ts; when tuning changes a number, change the test with it.

import { describe, expect, it } from 'vitest';
import type {
  BlueprintId,
  FixtureId,
  GameEvent,
  HouseState,
  Rarity,
  RunState,
  Tally,
} from '../rules/index.ts';
import { withFixture } from '../rules/fixtures.ts';
import { computeLayout, isLayoutModifier, type Layout } from '../rules/layout.ts';
import { ruleValue, runModifiers } from '../rules/modifiers.ts';
import { createRules, type Rules } from '../rules/run.ts';
import { NO_CONTEXT, tallyHouse, type TallyContext } from '../rules/scoring.ts';
import { stockGoods } from '../rules/shop.ts';
import { blueprintText } from '../rules/text.ts';
import { emptyRows, houseFrom, setup, type Placement } from '../rules/testing.ts';
import { PRICES } from './balance.ts';
import { CONTENT } from './index.ts';

/** A blueprint, bought in week 1 unless a week is given. */
type Owned = BlueprintId | [BlueprintId, number];

function owned(blueprints: readonly Owned[]) {
  return blueprints.map((b) =>
    typeof b === 'string' ? { id: b, boughtWeek: 1 } : { id: b[0], boughtWeek: b[1] },
  );
}

/** The run's modifiers for these blueprints (and the General Contractor), without a client's tastes. */
function modsFor(blueprints: readonly Owned[]) {
  return runModifiers(CONTENT, {
    setup: setup('blueprints'),
    blueprints: owned(blueprints),
  }).filter((m) => m.source.kind !== 'client');
}

function layoutWith(house: HouseState, blueprints: readonly Owned[]): Layout {
  const mods = modsFor(blueprints)
    .map((m) => m.mod)
    .filter(isLayoutModifier);
  return computeLayout(CONTENT, house, mods);
}

/** The house's tally in `week` with these blueprints, and anything else the run knows. */
function tallyOf(
  house: HouseState,
  blueprints: readonly Owned[],
  week = 1,
  extra: Partial<TallyContext> = {},
): Tally {
  const mods = modsFor(blueprints);
  return tallyHouse(CONTENT, layoutWith(house, blueprints), week, true, {
    ...NO_CONTEXT,
    ...extra,
    mods,
  });
}

/**
 * A house on an ASCII lot. Every piece is placed in week 1 unless `weeks` says otherwise (by
 * placement order); `installs` puts fixtures (by uid) in, in week 1.
 */
function build(
  rows: readonly string[],
  placements: readonly Placement[],
  opts: {
    weeks?: readonly number[];
    installs?: readonly [uid: number, fixture: FixtureId][];
  } = {},
): HouseState {
  let house = houseFrom(CONTENT, rows, placements);
  if (opts.weeks) {
    const weeks = opts.weeks;
    house = { ...house, pieces: house.pieces.map((p, i) => ({ ...p, placedWeek: weeks[i] ?? 1 })) };
  }
  for (const [uid, id] of opts.installs ?? []) house = withFixture(house, uid, id, 1);
  return house;
}

/** What each piece earns in week 1, without the blueprint and with it. */
function withAndWithout(
  id: BlueprintId,
  rows: readonly string[],
  placements: readonly Placement[],
): [number[], number[]] {
  const house = build(rows, placements);
  const of = (bps: readonly Owned[]) => tallyOf(house, bps).pieces.map((p) => p.earned);
  return [of([]), of([id])];
}

/** Appendix B's rarities. */
const RARITY: Record<BlueprintId, Rarity> = {
  fengShui: 'common',
  curbAppeal: 'common',
  quietHours: 'common',
  greenThumb: 'common',
  partyHouse: 'common',
  waterfront: 'common',
  openConcept: 'uncommon',
  goodBones: 'uncommon',
  itsAHouse: 'uncommon',
  countryLiving: 'uncommon',
  moodLighting: 'uncommon',
  showHome: 'uncommon',
  solarPanels: 'uncommon',
  crownJewel: 'rare',
  dreamHome: 'rare',
  lastMinutePush: 'rare',
  modelHome: 'rare',
  aheadOfSchedule: 'rare',
};

/** Its text: one line per modifier, reading cleanly. */
function expectText(id: BlueprintId, lines: readonly string[]): void {
  const def = CONTENT.blueprints[id];
  const text = blueprintText(CONTENT, def);
  expect(text).toHaveLength(def.modifiers.length);
  for (const line of text) {
    expect(line.trim()).not.toBe('');
    expect(line).not.toMatch(/undefined|NaN|null|\[object|  /);
  }
  expect(text).toEqual(lines);
}

const open = emptyRows(10, 10);

/** An interior Bedroom (uid 1), so Dark: Hallways on all four sides, off the sunny side. */
const INTERIOR: Placement[] = [
  ['bedroom', 1, 6],
  ['longHallway', 0, 5],
  ['hallway', 0, 6, 1],
  ['hallway', 3, 6, 1],
  ['longHallway', 0, 8],
];

/** The real content, with the first target `first` and each later one `first` more. */
function rulesWith(first: number): Rules {
  const phases = CONTENT.balance.phases.map((p, i) => ({ ...p, target: first * (i + 1) }));
  return createRules({ ...CONTENT, balance: { ...CONTENT.balance, phases } });
}

/** A new run on an empty 12×12 lot with these pieces and blueprints (bought in week 1). */
function runWith(
  r: Rules,
  placements: readonly Placement[],
  blueprints: readonly BlueprintId[],
): RunState {
  const s = r.newRun(setup('blueprint-run'));
  return {
    ...s,
    house: houseFrom(CONTENT, emptyRows(12, 12), placements),
    blueprints: owned(blueprints),
  };
}

type TallyEvent = Extract<GameEvent, { t: 'tally' }>;
const talliesIn = (events: readonly GameEvent[]) =>
  events.filter((e): e is TallyEvent => e.t === 'tally');

describe('blueprints', () => {
  it('are the 18 of Appendix B, priced by rarity from balance.ts, all offered; ×Mult only on Rare', () => {
    expect(Object.keys(CONTENT.blueprints).sort()).toEqual(Object.keys(RARITY).sort());
    expect(PRICES.blueprint).toEqual({ common: 4, uncommon: 6, rare: 8 });
    for (const def of Object.values(CONTENT.blueprints)) {
      expect(def.rarity).toBe(RARITY[def.id]);
      expect(def.price).toBe(PRICES.blueprint[def.rarity]);
      expect(def.offered, def.id).toBe(true);
      if (def.modifiers.some((m) => m.kind === 'xMult')) expect(def.rarity).toBe('rare');
    }
    const xMult = Object.values(CONTENT.blueprints).filter((d) =>
      d.modifiers.some((m) => m.kind === 'xMult'),
    );
    expect(xMult.map((d) => d.id).sort()).toEqual([
      'aheadOfSchedule',
      'lastMinutePush',
      'modelHome',
    ]);
  });
});

describe('Feng Shui', () => {
  it('pieces with a view earn +50%, a Bay Window’s included', () => {
    expectText('fengShui', ['Pieces with a view earn +50%']);
    // A Bedroom by a Tree (3 + 1, at +50%: 6) and one with no view (3).
    const rows = ['T.........', ...emptyRows(10, 9)];
    const placements: Placement[] = [
      ['bedroom', 1, 0],
      ['bedroom', 5, 0],
    ];
    expect(withAndWithout('fengShui', rows, placements)).toEqual([
      [4, 3],
      [6, 3],
    ]);
    // A Bay Window gives the second one a view: 3 at +50% is 4.5 → 5.
    const house = build(rows, placements, { installs: [[2, 'bayWindow']] });
    expect(tallyOf(house, ['fengShui']).pieces.map((p) => p.earned)).toEqual([6, 5]);
  });
});

describe('Curb Appeal', () => {
  it('pieces in the front yard earn +100%; a piece only partly in it doesn’t', () => {
    expectText('curbAppeal', ['Pieces in the front yard earn +100%']);
    // The Bedroom's front row is row 1. A front-yard Flower Bed (1 + 2) doubles; a back-yard one
    // (1) doesn't, nor a Lawn across rows 1 and 2. The Bedroom is indoor, so in no yard.
    expect(
      withAndWithout('curbAppeal', open, [
        ['bedroom', 0, 0],
        ['flowerBed', 5, 5],
        ['flowerBed', 5, 0],
        ['lawn', 8, 1],
      ]),
    ).toEqual([
      [3, 3, 1, 1],
      [3, 6, 1, 1],
    ]);
  });
});

describe('Quiet Hours', () => {
  it('Quiet pieces earn +50%', () => {
    expectText('quietHours', ['Quiet pieces earn +50%']);
    // Bedroom 3 + 1 for the Library: 6. Library 2: 3. A Kitchen (Social; +2 in the sun, D-120)
    // and a Closet (no tags) aren't boosted.
    expect(
      withAndWithout('quietHours', open, [
        ['bedroom', 0, 0],
        ['library', 2, 0],
        ['kitchen', 6, 0],
        ['closet', 9, 0],
      ]),
    ).toEqual([
      [4, 2, 2, 1],
      [6, 3, 2, 1],
    ]);
  });
});

describe('Green Thumb', () => {
  it('Green pieces earn +50%', () => {
    expectText('greenThumb', ['Green pieces earn +50%']);
    // The house is a Closet at the top right, so its front row is row 1 and the Flower Bed is in
    // the front yard. Lawn 1 → 1.5 → 2; Flower Bed 3 → 4.5 → 5; Herb Garden in the sun 2 → 3. The
    // Patio (1 for the Herb Garden's view), the Hot Tub by it (3), and the Closet (1) aren't
    // Green. The Patio and the Hot Tub touch the Closet, a room, so they earn at all.
    expect(
      withAndWithout('greenThumb', open, [
        ['lawn', 0, 0],
        ['flowerBed', 5, 5],
        ['herbGarden', 5, 0],
        ['patio', 7, 0],
        ['hotTub', 9, 0],
        ['closet', 9, 1],
      ]),
    ).toEqual([
      [1, 3, 2, 1, 3, 1],
      [2, 5, 3, 1, 3, 1],
    ]);
  });
});

describe('Party House', () => {
  it('Social pieces earn +50%', () => {
    expectText('partyHouse', ['Social pieces earn +50%']);
    // The Kitchen and the Dining Room face the sun, +2 each (D-120). Kitchen: +4 at the Dining
    // Room's +50% (6), and the blueprint's: 8. Dining Room: 2 → 3. The Patio below the Kitchen:
    // +2 for it, 2 → 3. The Hot Tub beside the Patio and below the Dining Room: 3 → 4.5 → 5.
    // The Bedroom isn't Social.
    expect(
      withAndWithout('partyHouse', open, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
        ['patio', 0, 2],
        ['hotTub', 2, 2],
        ['bedroom', 6, 0],
      ]),
    ).toEqual([
      [6, 2, 2, 3, 3],
      [8, 3, 3, 5, 3],
    ]);
  });
});

describe('Waterfront', () => {
  it('pieces touching the pond or the creek earn +50%', () => {
    expectText('waterfront', ['Pieces touching the Pond or the Creek earn +50%']);
    // Bedrooms by the pond and by the creek: 3 → 4.5 → 5. One between them touches neither.
    const rows = ['PP........', ...emptyRows(10, 6), 'CCCCCCCCCC', ...emptyRows(10, 2)];
    expect(
      withAndWithout('waterfront', rows, [
        ['bedroom', 0, 1],
        ['bedroom', 5, 1],
        ['bedroom', 0, 5],
      ]),
    ).toEqual([
      [3, 3, 3],
      [5, 3, 5],
    ]);
  });
});

describe('Open Concept', () => {
  it('links each touching group of Kitchens, Dining Rooms, and Living Rooms', () => {
    expectText('openConcept', [
      'Touching Kitchens, Dining Rooms, and Living Rooms are linked: each counts as touching the whole group',
    ]);
    // Kitchen | Living Room | Dining Room, each +2 in the sun (D-120). Linked, the Kitchen gets
    // its +2 for the Dining Room across the Living Room, at the Dining Room's +50%: 6. A Kitchen
    // off on its own isn't.
    const placements: Placement[] = [
      ['kitchen', 0, 0],
      ['livingRoom', 2, 0],
      ['diningRoom', 4, 0],
      ['kitchen', 0, 6],
    ];
    expect(withAndWithout('openConcept', open, placements)).toEqual([
      [2, 3, 2, 2],
      [6, 3, 2, 2],
    ]);
    const layout = layoutWith(build(open, placements), ['openConcept']);
    expect([...layout.links.get(1)!].sort()).toEqual([2, 3]);
    expect(layout.links.get(4)).toBeUndefined();
    // A Bedroom in the middle breaks the group.
    const broken: Placement[] = [
      ['kitchen', 0, 0],
      ['bedroom', 2, 0],
      ['diningRoom', 4, 0],
    ];
    expect(withAndWithout('openConcept', open, broken)).toEqual([
      [2, 3, 2],
      [2, 3, 2],
    ]);
    expect(layoutWith(build(open, broken), ['openConcept']).links.get(1)).toBeUndefined();
  });
});

describe('Good Bones', () => {
  const bedroomIn = (week: number) => build(open, [['bedroom', 0, 0]], { weeks: [week] });
  const over = (house: HouseState, bought: number, weeks: readonly number[]) =>
    weeks.map((w) => tallyOf(house, [['goodBones', bought]], w).pieces[0]!.earned);

  it('rooms grow +1 a week, up to +10', () => {
    expectText('goodBones', ['Rooms: +1 more each week it stands (up to +10)']);
    // Built and bought in week 1: +1 in week 1, +5 in week 5, +10 from week 10.
    expect(over(bedroomIn(1), 1, [1, 5, 10, 12])).toEqual([4, 8, 13, 13]);
    const t = tallyOf(bedroomIn(1), ['goodBones'], 5);
    expect(t.pieces[0]!.lines).toContainEqual({
      label: 'Grown for 5 weeks (Good Bones)',
      op: 'add',
      value: 5,
      from: [],
    });
  });

  it('counts from the later of placement and purchase', () => {
    // Bought in week 5 for a Bedroom from week 1: +1 in week 5, +3 in week 7.
    expect(over(bedroomIn(1), 5, [5, 7])).toEqual([4, 6]);
    // Built in week 6 after buying it in week 2: +1 in week 6, +3 in week 8.
    expect(over(bedroomIn(6), 2, [6, 8])).toEqual([4, 6]);
  });

  it('rooms only: not a Lawn or a Hallway', () => {
    const house = build(open, [
      ['bedroom', 0, 0],
      ['lawn', 0, 4],
      ['hallway', 5, 0],
    ]);
    expect(tallyOf(house, ['goodBones'], 5).pieces.map((p) => p.earned)).toEqual([8, 1, 0]);
  });
});

describe('It’s a House', () => {
  it('+0.15 Mult per House-tagged piece, one that earns nothing included', () => {
    expectText('itsAHouse', ['+0.15 Charm per House piece']);
    // A Greenhouse, a Henhouse, a Birdhouse, and a Doghouse outside any fenced yard (it earns
    // nothing, but still counts), with two Bedrooms (4 each). Points 8, Mult 1 + 4 × 0.15:
    // 8 × 1.6 = 12.8 → 13.
    const house = build(open, [
      ['greenhouse', 0, 0],
      ['henhouse', 4, 0],
      ['birdhouse', 8, 0],
      ['doghouse', 8, 8],
      ['bedroom', 0, 4],
      ['bedroom', 2, 4],
    ]);
    expect(tallyOf(house, [])).toMatchObject({ points: 8, mult: 100, total: 8 });
    const t = tallyOf(house, ['itsAHouse']);
    expect(t.pieces[3]).toMatchObject({ earned: 0, unmet: 'in a fenced yard' });
    expect(t).toMatchObject({ points: 8, mult: 160, total: 13 });
    expect(t.multTerms).toEqual([
      { source: { kind: 'blueprint', id: 'itsAHouse' }, label: 'It’s a House (4)', add: 60 },
    ]);
    // With no House piece it adds nothing.
    expect(tallyOf(build(open, [['bedroom', 0, 0]]), ['itsAHouse'])).toMatchObject({
      mult: 100,
      multTerms: [],
    });
  });
});

describe('Country Living', () => {
  it('every piece gets +1 per touching Tree (up to 3)', () => {
    expectText('countryLiving', ['Every piece: +1 per touching Tree (up to 3)']);
    // A Bedroom by a Tree: 3 + 1 (its own) + 1. A Closet with no Tree: 1.
    expect(
      withAndWithout(
        'countryLiving',
        ['T.........', ...emptyRows(10, 9)],
        [
          ['bedroom', 1, 0],
          ['closet', 5, 0],
        ],
      ),
    ).toEqual([
      [4, 1],
      [5, 1],
    ]);
    // A Lawn ringed by eight Trees: three count, 1 + 3.
    expect(
      withAndWithout('countryLiving', ['.TT.', 'T..T', 'T..T', '.TT.'], [['lawn', 1, 1]]),
    ).toEqual([[1], [4]]);
  });
});

describe('Mood Lighting', () => {
  it('Dark rooms earn +100%: interior ones, or any with Blackout Curtains', () => {
    expectText('moodLighting', ['Dark rooms earn +100%']);
    // The interior Bedroom doubles; an exterior one at the top doesn't. Hallways aren't rooms,
    // so their own +2 for the Bedroom (D-114) doesn't double.
    const placements: Placement[] = [...INTERIOR, ['bedroom', 6, 0]];
    expect(withAndWithout('moodLighting', open, placements)).toEqual([
      [3, 2, 2, 2, 2, 3],
      [6, 2, 2, 2, 2, 3],
    ]);
    // Blackout Curtains make the exterior one Dark: 3 at +125% is 6.75 → 7.
    const curtains = build(open, placements, { installs: [[6, 'blackoutCurtains']] });
    expect(tallyOf(curtains, ['moodLighting']).pieces[5]!.earned).toBe(7);
  });
});

describe('Show Home', () => {
  it('pieces with a fixture earn +50%', () => {
    expectText('showHome', ['Pieces with a fixture earn +50%']);
    // A Bedroom with a Fireplace: 3 at +100%. A Lawn with a Sprinkler: 1 at +150% → 2.5 → 3.
    const house = build(
      open,
      [
        ['bedroom', 0, 0],
        ['bedroom', 4, 0],
        ['lawn', 8, 0],
      ],
      {
        installs: [
          [1, 'fireplace'],
          [3, 'sprinkler'],
        ],
      },
    );
    expect(tallyOf(house, []).pieces.map((p) => p.earned)).toEqual([5, 3, 2]);
    expect(tallyOf(house, ['showHome']).pieces.map((p) => p.earned)).toEqual([6, 3, 3]);
  });
});

describe('Solar Panels', () => {
  // Two Trees at (4..5, 5) shade the second Bedroom (D-120).
  const shaded = emptyRows(10, 10).map((row, y) => (y === 5 ? '....TT....' : row));
  const house = build(shaded, [
    ['bedroom', 0, 0], // a wall to the sun, so Sunny
    ['sunroom', 0, 6], // a wall to the sun too
    ['bedroom', 4, 6], // in the Trees' shade: not Sunny
  ]);
  const sunroomBudget = (bought: number, weeks: readonly number[]) =>
    weeks.map((w) => tallyOf(house, [['solarPanels', bought]], w).pieces[1]!.budget);

  it('Sunny pieces pay +1 budget every 4th week', () => {
    expectText('solarPanels', ['Sunny pieces: +1 budget every 4th week']);
    const t = tallyOf(house, ['solarPanels'], 4);
    expect(t.pieces.map((p) => p.budget)).toEqual([1, 1, 0]);
    expect(t.budget).toBe(2);
    expect(t.pieces[1]!.lines).toContainEqual({
      label: 'Every 4th week (Solar Panels)',
      op: 'budget',
      value: 1,
      from: [],
    });
    expect(sunroomBudget(1, [1, 2, 3, 4, 5, 6, 7, 8])).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
    expect(tallyOf(house, [], 4).budget).toBe(0);
  });

  it('counts from its purchase', () => {
    // Bought in week 3: pays in weeks 6 and 10.
    expect(sunroomBudget(3, [3, 4, 5, 6, 7, 8, 9, 10])).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

describe('Crown Jewel', () => {
  it('the week’s single top earner earns +100%; ties go to the earliest placed', () => {
    expectText('crownJewel', ['Each week, your top earner earns +100%']);
    // Two Bedrooms tie at 4; the first doubles. The Kitchen (3) and the Closet (1) don't. The
    // Kitchen and the Dining Room are in the Bedrooms' shade, so neither earns the sun's +2.
    const house = build(open, [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
      ['closet', 6, 0],
      ['kitchen', 0, 2],
      ['diningRoom', 2, 2],
    ]);
    expect(tallyOf(house, []).pieces.map((p) => p.earned)).toEqual([4, 4, 1, 3, 0]);
    const t = tallyOf(house, ['crownJewel']);
    expect(t.pieces.map((p) => p.earned)).toEqual([8, 4, 1, 3, 0]);
    expect(t.best).toEqual({ uid: 1, pct: 100, before: 4, after: 8 });
    expect(t.pieces[0]!.lines).toContainEqual({
      label: 'Crown Jewel: top earner',
      op: 'pct',
      value: 100,
      from: [],
    });
    expect(t.total).toBe(16);
    // A later piece that earns more takes it.
    const later = build(open, [
      ['closet', 0, 0],
      ['bedroom', 4, 0],
    ]);
    expect(tallyOf(later, ['crownJewel']).pieces.map((p) => p.earned)).toEqual([1, 6]);
    // Nobody earning anything: no top earner.
    expect(tallyOf(build(open, [['hallway', 0, 0]]), ['crownJewel']).best).toBeNull();
  });
});

describe('Dream Home', () => {
  it('raises specBonus by 10 (+0.35 Mult per spec instead of +0.25)', () => {
    expectText('dreamHome', ['Each spec met adds +0.1 more Charm']);
    const state = (blueprints: readonly Owned[]) => ({
      setup: setup('dream'),
      blueprints: owned(blueprints),
    });
    expect(ruleValue(CONTENT, state([]), 'specBonus')).toBe(25);
    expect(ruleValue(CONTENT, state(['dreamHome']), 'specBonus')).toBe(35);
  });

  it('is offered, now that M4a’s clients bring specs', () => {
    expect(CONTENT.blueprints.dreamHome.offered).toBe(true);
    const s = createRules(CONTENT).newRun(setup('dream-shop'));
    const seen = new Set<BlueprintId>();
    for (let shop = 1; shop <= 6; shop++) {
      for (let refresh = 0; refresh < 30; refresh++) {
        for (const o of stockGoods(CONTENT, s, shop, refresh))
          if (o.kind === 'blueprint') seen.add(o.id);
      }
    }
    expect(seen.has('dreamHome')).toBe(true);
    // So does every other blueprint.
    expect([...seen].sort()).toEqual((Object.keys(RARITY) as BlueprintId[]).sort());
  });
});

describe('Last-Minute Push', () => {
  it('×2 Mult only in a phase’s last week', () => {
    expectText('lastMinutePush', [
      '×2 Charm in each phase’s last week (played, not completed early)',
    ]);
    const house = build(open, [['bedroom', 0, 0]]);
    expect(tallyOf(house, ['lastMinutePush'])).toMatchObject({ mult: 100, total: 3, xMults: [] });
    const t = tallyOf(house, ['lastMinutePush'], 1, { lastWeek: true });
    expect(t).toMatchObject({ mult: 200, total: 6 });
    expect(t.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'lastMinutePush' },
        label: 'Last-Minute Push',
        times: 200,
        before: 100,
        after: 200,
      },
    ]);
  });

  it('in a real run: week 4 and each overtime week, when they’re played', () => {
    // A Bedroom (3 a week) can't reach a target of 1000: weeks 1–3 pay 3, week 4 and both
    // overtime weeks pay 6.
    const r = rulesWith(1000);
    let s = runWith(r, [['bedroom', 0, 0]], ['lastMinutePush']);
    const tallies: TallyEvent[] = [];
    while (s.screen === 'build') {
      const { state, events } = r.apply(s, { t: 'pass' });
      tallies.push(...talliesIn(events));
      s = state;
    }
    expect(tallies.map((t) => [t.slot, t.overtimeWeek, t.tally.total])).toEqual([
      [1, 0, 3],
      [2, 0, 3],
      [3, 0, 3],
      [4, 0, 6],
      [5, 1, 6],
      [6, 2, 6],
    ]);
  });

  it('a fast-forwarded last week doesn’t count', () => {
    // Target 5: met after week 2. Completing early in week 3 fast-forwards weeks 3 and 4 at 3
    // each; played, week 4 would have paid 6.
    const r = rulesWith(5);
    let s = runWith(r, [['bedroom', 0, 0]], ['lastMinutePush']);
    s = r.apply(s, { t: 'pass' }).state;
    s = r.apply(s, { t: 'pass' }).state;
    expect(s).toMatchObject({ slot: 3, score: 6 });
    const { state, events } = r.apply(s, { t: 'completeEarly' });
    const ff = talliesIn(events);
    expect(ff.map((t) => [t.slot, t.fastForward, t.tally.total])).toEqual([
      [3, true, 3],
      [4, true, 3],
    ]);
    expect(ff[1]!.tally.xMults).toEqual([]);
    expect(state.milestones[0]!.result).toBe('early');
    // The same week 4, played.
    const played = r.apply(s, { t: 'pass' }).state;
    expect(played.slot).toBe(4);
    expect(r.currentTally(played)).toMatchObject({ mult: 200, total: 6 });
  });
});

describe('Model Home', () => {
  it('×(1 + 0.1 per piece with a fixture)', () => {
    expectText('modelHome', ['×1 Charm, plus 0.1 per piece with a fixture']);
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['lawn', 4, 0],
      ['closet', 8, 0],
    ];
    // No fixtures: ×1, so no ×Mult at all.
    expect(tallyOf(build(open, placements), ['modelHome'])).toMatchObject({
      points: 5,
      mult: 100,
      total: 5,
      xMults: [],
    });
    // A Fireplace (Bedroom 5): ×1.1, so 7 × 1.1 = 7.7 → 8.
    const one = build(open, placements, { installs: [[1, 'fireplace']] });
    expect(tallyOf(one, ['modelHome'])).toMatchObject({ points: 7, mult: 110, total: 8 });
    // And a Sprinkler (Lawn 2): ×1.2, so 8 × 1.2 = 9.6 → 10.
    const two = build(open, placements, {
      installs: [
        [1, 'fireplace'],
        [2, 'sprinkler'],
      ],
    });
    const t = tallyOf(two, ['modelHome']);
    expect(t).toMatchObject({ points: 8, mult: 120, total: 10 });
    expect(t.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'modelHome' },
        label: 'Model Home',
        times: 120,
        before: 100,
        after: 120,
      },
    ]);
  });
});

describe('Ahead of Schedule', () => {
  it('×(1 + 0.2 per milestone completed early)', () => {
    expectText('aheadOfSchedule', ['×1 Charm, plus 0.2 per milestone completed early']);
    // Two Bedrooms, 4 each.
    const house = build(open, [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
    ]);
    expect(tallyOf(house, ['aheadOfSchedule'])).toMatchObject({ total: 8, xMults: [] });
    // Two early: 8 × 1.4 = 11.2 → 11.
    const t = tallyOf(house, ['aheadOfSchedule'], 1, { stats: { milestonesEarly: 2 } });
    expect(t).toMatchObject({ mult: 140, total: 11 });
    expect(t.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'aheadOfSchedule' },
        label: 'Ahead of Schedule',
        times: 140,
        before: 100,
        after: 140,
      },
    ]);
  });

  it('in a real run, a milestone completed early counts from the next phase', () => {
    // Target 5, met after week 2; complete early in week 3, leave the shop, and phase 2's
    // Bedroom pays 3 × 1.2 = 3.6 → 4.
    const r = rulesWith(5);
    let s = runWith(r, [['bedroom', 0, 0]], ['aheadOfSchedule']);
    s = r.apply(s, { t: 'pass' }).state;
    s = r.apply(s, { t: 'pass' }).state;
    expect(r.currentTally(s)).toMatchObject({ total: 3, xMults: [] });
    s = r.apply(s, { t: 'completeEarly' }).state;
    expect(s).toMatchObject({ screen: 'shop', milestonesEarly: 1 });
    // Shop 1 opens with the free Housewarming crate: set it aside, then leave.
    s = r.apply(s, { t: 'pick', i: -1 }).state;
    s = r.apply(s, { t: 'leaveShop' }).state;
    expect(s).toMatchObject({ screen: 'build', phase: 1 });
    expect(r.currentTally(s)).toMatchObject({ mult: 120, total: 4 });
  });
});
