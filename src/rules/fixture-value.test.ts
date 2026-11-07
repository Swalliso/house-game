// What a fixture is worth (D-103, resolving D-092): the rules' numbers behind the shop's line
// under each fixture and the board's gain badge on every legal host while installing.
//
// - installGains: every legal host of a hand or supplies fixture, in placement order, with its
//   install preview's delta, net of the fixture it would replace (which it names).
// - fixtureValue: a fixture not yet owned (a shop offer): its best host as the house stands, the
//   gain there (what the real install's preview says once it's bought), the run's weeks still
//   to play, and gain × those weeks. In the shop it scores the next week, after the transforms
//   that start it, and names the host's piece as it is then. Null if no piece can take it.
// - Neither changes the state.
//
// Rules tests use TEST_CONTENT (testing.ts), whose fixtures are Appendix B's encodings (without
// D-082's +25%). Houses are built on a 12×12 lot with houseFrom, so uids follow the placement
// order and every piece has placedWeek 1; the street runs along the bottom edge (y = 11), so
// pieces near the top never touch it. Here 4 phases of 3 weeks, with targets out of reach.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Card,
  Content,
  FixtureId,
  GameEvent,
  InstallAction,
  RunState,
  ShopOffer,
} from './index.ts';
import { withFixture } from './fixtures.ts';
import { createRules, type Rules } from './run.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';

const W = 3;
const CONTENT_4x3: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: W,
    phases: [1, 2, 3, 4].map((k) => ({ name: `Phase ${k}`, target: 100_000 * k })),
  },
};
const R = createRules(CONTENT_4x3);

const fx = (id: FixtureId): Card => ({ kind: 'fixture', id });
const fromHand = (i: number, uid: number): InstallAction => ({
  t: 'install',
  from: 'hand',
  i,
  uid,
});
const fromSupplies = (i: number, uid: number): InstallAction => ({
  t: 'install',
  from: 'supplies',
  i,
  uid,
});
const PASS: Action = { t: 'pass' };

/** Week 1 of a run with these pieces, this hand, and these supplies, on these rows. */
function build(
  placements: readonly Placement[],
  opts: { hand?: readonly Card[]; supplies?: readonly FixtureId[]; rows?: readonly string[] } = {},
): RunState {
  const s = R.newRun(setup('fixture-value'));
  return {
    ...s,
    house: houseFrom(R.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: opts.hand ?? [],
    supplies: (opts.supplies ?? []).map((id) => ({ kind: 'fixture' as const, id })),
  };
}

/** The state with a fixture already in a piece. */
const withFx = (s: RunState, uid: number, id: FixtureId): RunState => ({
  ...s,
  house: withFixture(s.house, uid, id, 1),
});

/** The rows with Trees at these cells. */
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

// Two Bedrooms side by side (uids 1, 2: steady 3 + 1 for the Quiet neighbor = 4 each), and a
// Living Room (uid 3, 2×3) with two Trees beside it (+2 per view source = 4).
const HOUSE: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
  ['livingRoom', 6, 0],
];
const HOUSE_ROWS = treesAt([8, 0], [8, 1]);

// ---------------------------------------------------------------------------------------

describe('installGains: every legal host’s gain while installing (D-103)', () => {
  it('lists each legal host in placement order with its install preview’s delta', () => {
    // A Fireplace: +50%, and +50% more in a Living Room. Bedrooms 4 → 6; the Living Room 4 → 8.
    const s = build(HOUSE, { supplies: ['fireplace'], rows: HOUSE_ROWS });
    const gains = R.installGains(s, 'supplies', 0);
    expect(gains).toEqual([
      { uid: 1, gain: 2 },
      { uid: 2, gain: 2 },
      { uid: 3, gain: 4 },
    ]);
    expect(gains.map((g) => g.uid)).toEqual(R.installHosts(s, 'supplies', 0));
    for (const g of gains) expect(g.gain).toBe(R.preview(s, fromSupplies(0, g.uid)).delta);
  });

  it('works the same for a hand fixture, and matches what apply() then tallies', () => {
    const s = build(HOUSE, { hand: [fx('fireplace')], rows: HOUSE_ROWS });
    const gains = R.installGains(s, 'hand', 0);
    expect(gains.map((g) => [g.uid, g.gain])).toEqual([
      [1, 2],
      [2, 2],
      [3, 4],
    ]);
    const before = R.currentTally(s).total;
    for (const g of gains) {
      expect(g.gain).toBe(R.preview(s, fromHand(0, g.uid)).delta);
      const tally = eventsOf(R.apply(s, fromHand(0, g.uid)).events, 'tally')[0]!.tally;
      expect(tally.total - before).toBe(g.gain);
    }
  });

  it('names the fixture a host would replace, and its gain is net of losing it', () => {
    // The Living Room already has a Fireplace (8). A Skylight there loses it: 8 → 4.
    const s = withFx(build(HOUSE, { supplies: ['skylight'], rows: HOUSE_ROWS }), 3, 'fireplace');
    const gains = R.installGains(s, 'supplies', 0);
    expect(gains).toEqual([
      { uid: 1, gain: 0 },
      { uid: 2, gain: 0 },
      { uid: 3, gain: -4, replaces: 'fireplace' },
    ]);
    const p = R.preview(s, fromSupplies(0, 3));
    expect(p.replaces).toBe('fireplace');
    expect(p.delta).toBe(-4);
    // A second Fireplace can't go where one already is.
    const again = { ...s, supplies: [{ kind: 'fixture' as const, id: 'fireplace' as const }] };
    expect(R.installGains(again, 'supplies', 0).map((g) => g.uid)).toEqual([1, 2]);
  });

  it('is empty with no host, with no fixture there, and off the build screen', () => {
    const s = build(HOUSE, {
      hand: [{ kind: 'piece', id: 'closet' }],
      supplies: ['sprinkler'],
      rows: HOUSE_ROWS,
    });
    // No Lawn for the Sprinkler; a piece card; nothing at index 5.
    expect(R.installGains(s, 'supplies', 0)).toEqual([]);
    expect(R.installGains(s, 'hand', 0)).toEqual([]);
    expect(R.installGains(s, 'supplies', 5)).toEqual([]);
    const fire = build(HOUSE, { supplies: ['fireplace'], rows: HOUSE_ROWS });
    expect(R.installGains({ ...fire, screen: 'won' }, 'supplies', 0)).toEqual([]);
  });

  it('changes nothing', () => {
    const s = deepFreeze(
      withFx(build(HOUSE, { supplies: ['skylight'], rows: HOUSE_ROWS }), 3, 'fireplace'),
    );
    const before = structuredClone(s);
    R.installGains(s, 'supplies', 0);
    expect(s).toEqual(before);
  });
});

describe('fixtureValue: a fixture’s best host, for the shop’s line (D-103)', () => {
  it('on the build screen: the best host and its gain, as installing it once bought previews', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const v = R.fixtureValue(s, 'fireplace');
    // Week 1 of 4 phases of 3 weeks: 12 weeks to play.
    expect(v).toEqual({ host: 3, hostDefId: 'livingRoom', gain: 4, weeksLeft: 12, overRun: 48 });
    const owned: RunState = { ...s, supplies: [{ kind: 'fixture', id: 'fireplace' }] };
    expect(R.preview(owned, fromSupplies(0, v!.host)).delta).toBe(v!.gain);
  });

  it('the best host is the most any legal host gains; a tie goes to the first placed', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    for (const id of ['fireplace', 'skylight', 'bayWindow', 'soundproofing'] as const) {
      const owned: RunState = { ...s, supplies: [{ kind: 'fixture', id }] };
      const gains = R.installGains(owned, 'supplies', 0);
      const max = Math.max(...gains.map((g) => g.gain));
      const v = R.fixtureValue(s, id)!;
      expect(v.gain, id).toBe(max);
      expect(v.host, id).toBe(gains.find((g) => g.gain === max)!.uid);
    }
    // Two Bedrooms alone: each gains 2 with a Fireplace, so the first one is named.
    expect(R.fixtureValue(build(HOUSE.slice(0, 2)), 'fireplace')).toMatchObject({
      host: 1,
      gain: 2,
    });
  });

  it('reports the fixture the best host would replace, its loss counted', () => {
    // The Living Room is the only room, and it has a Fireplace: a Skylight there loses it.
    const s = withFx(build([['livingRoom', 6, 0]], { rows: HOUSE_ROWS }), 1, 'fireplace');
    expect(R.fixtureValue(s, 'skylight')).toEqual({
      host: 1,
      hostDefId: 'livingRoom',
      gain: -4,
      replaces: 'fireplace',
      weeksLeft: 12,
      overRun: -48,
    });
    // An empty host beats a replacement that loses Wow.
    const two = withFx(build(HOUSE, { rows: HOUSE_ROWS }), 3, 'fireplace');
    expect(R.fixtureValue(two, 'skylight')).toEqual({
      host: 1,
      hostDefId: 'bedroom',
      gain: 0,
      weeksLeft: 12,
      overRun: 0,
    });
  });

  it('is null when no piece can take it, for an unknown fixture, and off the build and shop screens', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.fixtureValue(s, 'sprinkler')).toBeNull();
    expect(R.fixtureValue(build([]), 'fireplace')).toBeNull();
    // The only room already has one, so a second can't go in.
    expect(R.fixtureValue(withFx(build([['bedroom', 0, 0]]), 1, 'fireplace'), 'fireplace')).toBe(
      null,
    );
    expect(R.fixtureValue(s, 'nope' as FixtureId)).toBeNull();
    for (const screen of ['won', 'lost', 'changeOrder'] as const) {
      expect(R.fixtureValue({ ...s, screen }, 'fireplace'), screen).toBeNull();
    }
  });

  it('counts the run’s weeks still to play, this one included; overRun is gain × weeks', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const weeks = (st: RunState) => R.fixtureValue(st, 'fireplace')!.weeksLeft;
    expect(weeks(s)).toBe(12);
    const next = R.apply(s, PASS).state;
    expect(next.slot).toBe(2);
    expect(weeks(next)).toBe(11);
    // Phase 2's last week; an overtime week of phase 2 (later overtime can't be foreseen).
    expect(weeks({ ...s, phase: 1, slot: 3 })).toBe(1 + 2 * W);
    expect(weeks({ ...s, phase: 1, slot: 4, overtimeWeek: 1 })).toBe(1 + 2 * W);
    // The last phase's last week: just this one.
    expect(weeks({ ...s, phase: 3, slot: 3 })).toBe(1);
    const v = R.fixtureValue(next, 'fireplace')!;
    expect(v.overRun).toBe(v.gain * v.weeksLeft);
  });

  it('changes nothing, on the build screen or in the shop', () => {
    const s = deepFreeze(build(HOUSE, { rows: HOUSE_ROWS, supplies: ['skylight'] }));
    const before = structuredClone(s);
    R.fixtureValue(s, 'fireplace');
    expect(s).toEqual(before);
    const shop = deepFreeze(
      withGoods(toShop(R, build(HOUSE, { rows: HOUSE_ROWS })), [
        { kind: 'fixture', id: 'fireplace' },
      ]),
    );
    const shopBefore = structuredClone(shop);
    expect(R.fixtureValue(shop, 'fireplace')).not.toBeNull();
    expect(shop).toEqual(shopBefore);
  });
});

describe('fixtureValue in the shop: the next week, as the real install will preview', () => {
  it('matches the preview of the real install after buying it and starting the next phase', () => {
    const shop = withGoods(toShop(R, build(HOUSE, { rows: HOUSE_ROWS })), [
      { kind: 'fixture', id: 'skylight' },
      { kind: 'fixture', id: 'fireplace' },
    ]);
    expect(shop.phase).toBe(1);
    const v = R.fixtureValue(shop, 'fireplace');
    // The next phase's 3 weeks and the two after it.
    expect(v).toEqual({
      host: 3,
      hostDefId: 'livingRoom',
      gain: 4,
      weeksLeft: 3 * W,
      overRun: 4 * 3 * W,
    });
    const bought = R.apply(shop, { t: 'buy', i: 1 }).state;
    expect(R.fixtureValue(bought, 'fireplace')).toEqual(v);
    const next = R.apply(bought, { t: 'leaveShop' }).state;
    expect(next.screen).toBe('build');
    const i = next.supplies.findIndex((sup) => sup.kind === 'fixture' && sup.id === 'fireplace');
    expect(R.preview(next, fromSupplies(i, v!.host)).delta).toBe(v!.gain);
    const gains = R.installGains(next, 'supplies', i);
    expect(Math.max(...gains.map((g) => g.gain))).toBe(v!.gain);
    // And on the build screen it says the same as it did in the shop.
    expect(R.fixtureValue(next, 'fireplace')).toEqual(v);
  });

  it('scores the house after the transforms that start the next week (a Sapling becomes a Tree)', () => {
    // A Living Room with a Tree beside it (+2) and a Sapling that becomes a Tree as the next
    // phase starts: placed in week 1, a week older than that, so 4 weeks old in week 4.
    const s0 = build(
      [
        ['livingRoom', 6, 0],
        ['sapling', 8, 1],
      ],
      { rows: treesAt([8, 0]) },
    );
    const s = {
      ...s0,
      house: {
        ...s0.house,
        pieces: s0.house.pieces.map((p) => (p.defId === 'sapling' ? { ...p, ageBonus: 1 } : p)),
      },
    };
    const shop = withGoods(toShop(R, s), [{ kind: 'fixture', id: 'fireplace' }]);
    expect(shop.house.pieces.map((p) => p.defId)).toEqual(['livingRoom', 'sapling']);
    // As the house stands in the shop, the Fireplace would double 2; next week it doubles 4.
    const v = R.fixtureValue(shop, 'fireplace');
    expect(v).toMatchObject({ host: 1, gain: 4 });
    const next = R.apply(R.apply(shop, { t: 'buy', i: 0 }).state, { t: 'leaveShop' }).state;
    expect(next.house.pieces.map((p) => p.defId)).toEqual(['livingRoom']);
    expect(R.preview(next, fromSupplies(0, 1)).delta).toBe(v!.gain);
  });

  it('names the host as it’s valued: a Nursery that grows into a Kids’ Room as the phase starts', () => {
    // A Nursery (a Kids' Room after 8 weeks) placed in week 1, 5 weeks older than that: 8 weeks
    // old in week 4, the next phase's first. It keeps its uid as it grows.
    const s0 = build([['nursery', 0, 0]]);
    const s: RunState = {
      ...s0,
      house: { ...s0.house, pieces: s0.house.pieces.map((p) => ({ ...p, ageBonus: 5 })) },
    };
    const shop = withGoods(toShop(R, s), [{ kind: 'fixture', id: 'fireplace' }]);
    expect(shop.house.pieces.map((p) => p.defId)).toEqual(['nursery']);
    // The Fireplace's +50% on the Kids' Room's 4, not the Nursery's 2.
    const v = R.fixtureValue(shop, 'fireplace');
    expect(v).toMatchObject({ host: 1, hostDefId: 'kidsRoom', gain: 2 });
    const next = R.apply(R.apply(shop, { t: 'buy', i: 0 }).state, { t: 'leaveShop' }).state;
    expect(next.house.pieces.map((p) => [p.uid, p.defId])).toEqual([[1, 'kidsRoom']]);
    expect(R.preview(next, fromSupplies(0, 1)).delta).toBe(v!.gain);
    expect(R.fixtureValue(next, 'fireplace')).toEqual(v);
  });

  it('a shop the debug panel opened mid-week values this week, the way back to it previews', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const forced = R.apply(R.apply(s, PASS).state, { t: 'debug', op: 'forceShop' }).state;
    expect(forced.screen).toBe('shop');
    expect(forced.offers?.shop?.forced).toBe(true);
    const shop = withGoods(forced, [{ kind: 'fixture', id: 'fireplace' }]);
    // Week 2 of phase 1: 2 weeks of it left, and the three phases after it.
    const v = R.fixtureValue(shop, 'fireplace');
    expect(v).toEqual({
      host: 3,
      hostDefId: 'livingRoom',
      gain: 4,
      weeksLeft: 2 + 3 * W,
      overRun: 4 * (2 + 3 * W),
    });
    const back = R.apply(R.apply(shop, { t: 'buy', i: 0 }).state, { t: 'leaveShop' }).state;
    expect(back.screen).toBe('build');
    expect(back.slot).toBe(2);
    expect(R.preview(back, fromSupplies(0, v!.host)).delta).toBe(v!.gain);
  });

  it('…and starts no week: a Sapling Fertilizer made old enough today is still a Sapling', () => {
    // A Living Room with a Tree beside it (+2), and a Sapling Fertilizer takes to 4 weeks old
    // this week: it becomes a Tree at the start of next week, not on the way back to this one.
    const s0 = build(
      [
        ['livingRoom', 6, 0],
        ['sapling', 8, 1],
      ],
      { rows: treesAt([8, 0]) },
    );
    const s: RunState = {
      ...s0,
      house: {
        ...s0.house,
        pieces: s0.house.pieces.map((p) => (p.defId === 'sapling' ? { ...p, ageBonus: 2 } : p)),
      },
      supplies: [{ kind: 'tool', id: 'fertilizer' }],
    };
    const fertilized = R.apply(s, { t: 'useTool', i: 0 }).state;
    // Passing shows it: the Sapling is a Tree once next week starts.
    const nextWeek = R.apply(fertilized, PASS).state;
    expect(nextWeek.house.pieces.map((p) => p.defId)).toEqual(['livingRoom']);
    const shop = withGoods(R.apply(fertilized, { t: 'debug', op: 'forceShop' }).state, [
      { kind: 'fixture', id: 'fireplace' },
    ]);
    const v = R.fixtureValue(shop, 'fireplace');
    expect(v).toMatchObject({ host: 1, gain: 2 });
    const back = R.apply(R.apply(shop, { t: 'buy', i: 0 }).state, { t: 'leaveShop' }).state;
    expect(back.house.pieces.map((p) => p.defId)).toEqual(['livingRoom', 'sapling']);
    expect(R.preview(back, fromSupplies(0, 1)).delta).toBe(v!.gain);
  });
});
