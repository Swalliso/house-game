// Fixtures (D-050; implementation-plan.md §4 "Actions, events, and the API" and the Fixtures
// bullet of "Layout rules"; Appendix A · M3a "Fixtures"; Appendix B "Fixtures"; §9 "fixtures:
// install from the hand and from supplies, replacement, removal with the host").
//
// - Installing from the hand is the week's turn: 'installed', then 'tally', and the week ends.
// - Installing from the supplies is a free action: no tally, and the week goes on.
// - A piece holds one fixture; a new one replaces the old (the preview shows what's lost).
// - `fits` is checked at install time; demolishing the host takes the fixture, with no refund.
// - Fixtures join the weekly draw from their fromPhase (1) at drawWeight × 100; the Chandelier
//   (weight 0) never comes up.
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts), whose fixtures are Appendix B's
// encodings exactly. Houses are built on an empty 12×12 lot with houseFrom, so uids follow the
// placement order (1, 2, …) and every piece has placedWeek 1. The street runs along the bottom
// edge (y = 11), so pieces near the top never touch it.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Card,
  Content,
  FixtureDef,
  FixtureId,
  GameEvent,
  InstallAction,
  PieceDef,
  PieceId,
  RunState,
} from './index.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { drawHand, drawWeights } from './draw.ts';
import { fitsText, installHosts, withFixture } from './fixtures.ts';
import { computeLayout } from './layout.ts';
import { earnedFor } from './scoring.ts';
import { fixtureText } from './text.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';
import { CONTENT } from '../content/index.ts';

/** TEST_CONTENT with these phase targets and phase length (as runloop.test.ts builds it). */
function content(targets: number[], weeksPerPhase = 2, extra: Partial<Balance> = {}): Content {
  return {
    ...C,
    balance: {
      ...C.balance,
      ...extra,
      weeksPerPhase,
      phases: targets.map((target, i) => ({ name: `Phase ${i + 1}`, target })),
    },
  };
}

// Targets far out of reach, so no tally here ends the phase early or opens the shop.
const BIG = content([100_000, 200_000], 4);
const R = createRules(BIG);

const fx = (id: FixtureId): Card => ({ kind: 'fixture', id });
const pc = (id: PieceId): Card => ({ kind: 'piece', id });
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

/** A run in week 1 on an empty 12×12 lot with these pieces, this hand, and these supplies. */
function build(
  placements: readonly Placement[],
  opts: {
    hand?: readonly Card[];
    supplies?: readonly FixtureId[];
    rules?: Rules;
    seed?: string;
    rows?: readonly string[];
  } = {},
): RunState {
  const r = opts.rules ?? R;
  const s = r.newRun(setup(opts.seed ?? 'fixtures'));
  return {
    ...s,
    house: houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: opts.hand ?? [],
    supplies: (opts.supplies ?? []).map((id) => ({ kind: 'fixture' as const, id })),
  };
}

/** The state with a fixture already in a piece (installed in `week`). */
function withFx(s: RunState, uid: number, id: FixtureId, week = 1): RunState {
  return { ...s, house: withFixture(s.house, uid, id, week) };
}

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

const earnedOf = (r: Rules, s: RunState, uid: number) =>
  r.currentTally(s).pieces.find((p) => p.uid === uid)!.earned;

const fixtureOf = (s: RunState, uid: number) => s.house.pieces.find((p) => p.uid === uid)?.fixture;

/** One Bedroom in the top-left corner: steady 3, no neighbors, so it earns 3. */
const ONE_BEDROOM: Placement[] = [['bedroom', 0, 0]];
/** Two Bedrooms side by side: each is steady 3 + 1 for its Quiet neighbor = 4. */
const TWO_BEDROOMS: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
];
/** A Bedroom (uid 1) and, apart from it, a Lawn (uid 2) that earns its steady 1. */
const BEDROOM_AND_LAWN: Placement[] = [
  ['bedroom', 0, 0],
  ['lawn', 0, 5],
];

// ---------------------------------------------------------------------------------------

describe('installing from the hand is the week’s turn (§4)', () => {
  const s = build(ONE_BEDROOM, { hand: [fx('fireplace'), pc('closet'), pc('lawn')] });

  it('emits installed, then the tally, then the next week’s hand; nothing is placed', () => {
    const { events } = R.apply(s, fromHand(0, 1));
    expect(types(events).slice(0, 3)).toEqual(['installed', 'tally', 'handDrawn']);
    expect(types(events)).not.toContain('placed');
    expect(events[0]).toEqual({ t: 'installed', uid: 1, fixture: 'fireplace', from: 'hand' });
    // Nothing was replaced, so the event carries no `replaced` key at all.
    expect(events[0]).not.toHaveProperty('replaced');
    const tally = eventsOf(events, 'tally')[0]!;
    expect(tally.passed).toBe(false);
    expect(tally.fastForward).toBe(false);
    expect(tally.week).toBe(1);
  });

  it('ends the week: the old hand is gone, the week and slot advance, the next hand is drawn', () => {
    const { state, events } = R.apply(s, fromHand(0, 1));
    expect(state.week).toBe(2);
    expect(state.slot).toBe(2);
    const drawn = eventsOf(events, 'handDrawn');
    expect(drawn[0]!.slot).toBe(2);
    expect(state.hand).toEqual(drawn[drawn.length - 1]!.hand);
    expect(state.draws).toBe(drawn.length);
    // The house keeps the fixture, stamped with the week it went in.
    expect(fixtureOf(state, 1)).toEqual({ id: 'fireplace', week: 1 });
    expect(state.house.pieces).toHaveLength(1);
  });

  it('applies the fixture’s modifiers from the tally of the week it’s installed', () => {
    // Without it the Bedroom earns 3 (what a pass scores now).
    expect(R.currentTally(s).total).toBe(3);
    const { state, events } = R.apply(s, fromHand(0, 1));
    // Fireplace: +50% on its host → floor((3 × 150 + 50) / 100) = 5, this very week.
    expect(earnedFor(3, 50)).toBe(5);
    const tally = eventsOf(events, 'tally')[0]!;
    expect(tally.tally.total).toBe(5);
    expect(state.score).toBe(5);
    // …and every week after.
    const next = R.apply(state, PASS);
    expect(eventsOf(next.events, 'tally')[0]!.tally.total).toBe(5);
    expect(next.state.score).toBe(10);
  });

  it('applies to its host only', () => {
    // Two Bedrooms earn 4 each; the Fireplace in uid 1 makes it floor((4 × 150 + 50) / 100) = 6.
    const two = build(TWO_BEDROOMS, { hand: [fx('fireplace')] });
    const { events } = R.apply(two, fromHand(0, 1));
    const pieces = eventsOf(events, 'tally')[0]!.tally.pieces;
    expect(pieces.map((p) => [p.uid, p.earned])).toEqual([
      [1, 6],
      [2, 4],
    ]);
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(10);
  });

  it('a Fireplace earns +100% in a Living Room (Appendix B: +50%, and +50% more there)', () => {
    // Living Room (2×3) beside a Flower Bed, a view source: +2. Fireplace: +100% → 4.
    // The Flower Bed sits behind the house's front row, so it earns its steady 1 only.
    const s2 = build(
      [
        ['livingRoom', 0, 0],
        ['flowerBed', 2, 0],
      ],
      { hand: [fx('fireplace')] },
    );
    expect(earnedOf(R, s2, 1)).toBe(2);
    const { state } = R.apply(s2, fromHand(0, 1));
    expect(earnedFor(2, 100)).toBe(4);
    expect(earnedOf(R, state, 1)).toBe(4);
    expect(earnedOf(R, state, 2)).toBe(1);
  });
});

describe('installing from the supplies is a free action (§4)', () => {
  const s = build(ONE_BEDROOM, {
    hand: [pc('closet'), pc('lawn'), pc('kitchen')],
    supplies: ['sprinkler', 'fireplace', 'skylight'],
  });

  it('emits only installed: no tally, and the week goes on', () => {
    const { events } = R.apply(s, fromSupplies(1, 1));
    expect(events).toEqual([{ t: 'installed', uid: 1, fixture: 'fireplace', from: 'supplies' }]);
  });

  it('changes only the house and the supplies: week, slot, draws, hand, and score stay', () => {
    const { state } = R.apply(s, fromSupplies(1, 1));
    expect(state.week).toBe(s.week);
    expect(state.slot).toBe(s.slot);
    expect(state.draws).toBe(s.draws);
    expect(state.hand).toEqual(s.hand);
    expect(state.score).toBe(0);
    // Everything else is untouched: the same state but for the house and the supplies.
    expect({ ...state, house: s.house, supplies: s.supplies }).toEqual(s);
    // The supply at index 1 is used up; the others keep their order.
    expect(state.supplies).toEqual([
      { kind: 'fixture', id: 'sprinkler' },
      { kind: 'fixture', id: 'skylight' },
    ]);
    expect(fixtureOf(state, 1)).toEqual({ id: 'fireplace', week: 1 });
  });

  it('shows in currentTally at once, and in the next tally', () => {
    const { state } = R.apply(s, fromSupplies(1, 1));
    // The Bedroom: 3 → floor((3 × 150 + 50) / 100) = 5.
    expect(R.currentTally(s).total).toBe(3);
    expect(R.currentTally(state).total).toBe(5);
    const { events } = R.apply(state, PASS);
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(5);
  });

  it('can be followed by the week’s own play, so two fixtures go in in one week', () => {
    // Lawn (uid 2) gets the Sprinkler from the supplies; then the Bedroom gets a Fireplace
    // from the hand as the week's turn. Lawn 1 → floor((1 × 200 + 50) / 100) = 2; Bedroom 5.
    const s2 = build(BEDROOM_AND_LAWN, { hand: [fx('fireplace')], supplies: ['sprinkler'] });
    const free = R.apply(s2, fromSupplies(0, 2)).state;
    const { state, events } = R.apply(free, fromHand(0, 1));
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(5 + 2);
    expect(fixtureOf(state, 1)?.id).toBe('fireplace');
    expect(fixtureOf(state, 2)?.id).toBe('sprinkler');
    expect(state.supplies).toEqual([]);
  });
});

describe('a piece holds one fixture: a new one replaces the old', () => {
  // The Bedroom already has a Fireplace (earning 5); Blackout Curtains only make it Dark.
  const s = withFx(
    build(ONE_BEDROOM, { hand: [fx('skylight')], supplies: ['blackoutCurtains'] }),
    1,
    'fireplace',
  );

  it('the preview names the host and the fixture it would replace', () => {
    const p = R.preview(s, fromSupplies(0, 1));
    expect(p.legal).toBe(true);
    expect(p.host).toBe(1);
    expect(p.replaces).toBe('fireplace');
    // The Fireplace's +50% goes: 5 → 3.
    expect(p.before.total).toBe(5);
    expect(p.after.total).toBe(3);
    expect(p.delta).toBe(-2);
  });

  it('the preview of an install into an empty piece has a host and no replaces', () => {
    const empty = build(ONE_BEDROOM, { supplies: ['blackoutCurtains'] });
    const p = R.preview(empty, fromSupplies(0, 1));
    expect(p.host).toBe(1);
    expect(p).not.toHaveProperty('replaces');
  });

  it('the installed event says what was replaced, and only the new fixture’s effect remains', () => {
    const { state, events } = R.apply(s, fromSupplies(0, 1));
    expect(events).toEqual([
      {
        t: 'installed',
        uid: 1,
        fixture: 'blackoutCurtains',
        from: 'supplies',
        replaced: 'fireplace',
      },
    ]);
    expect(fixtureOf(state, 1)).toEqual({ id: 'blackoutCurtains', week: 1 });
    // No Fireplace bonus any more (3, not 5); the Curtains make the corner Bedroom Dark.
    expect(R.currentTally(state).total).toBe(3);
    expect(R.describePiece(state, 1)!.tags).toContain('Dark');
    expect(R.describePiece(s, 1)!.tags).not.toContain('Dark');
  });

  it('replacing from the hand is the week’s turn, and its tally has only the new fixture', () => {
    const { state, events } = R.apply(s, fromHand(0, 1));
    expect(events[0]).toEqual({
      t: 'installed',
      uid: 1,
      fixture: 'skylight',
      from: 'hand',
      replaced: 'fireplace',
    });
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(3);
    expect(fixtureOf(state, 1)).toEqual({ id: 'skylight', week: 1 });
    // The Skylight makes it Sunny.
    expect(R.describePiece(state, 1)!.tags).toContain('Sunny');
  });

  it('installing the fixture a piece already has is illegal', () => {
    const same = withFx(
      build(TWO_BEDROOMS, { hand: [fx('fireplace')], supplies: ['fireplace'] }),
      1,
      'fireplace',
    );
    const reason = 'It already has a Fireplace.';
    expect(() => R.apply(same, fromSupplies(0, 1))).toThrow(IllegalAction);
    expect(() => R.apply(same, fromSupplies(0, 1))).toThrow(reason);
    expect(() => R.apply(same, fromHand(0, 1))).toThrow(reason);
    expect(R.checkPlay(same, fromHand(0, 1))).toMatchObject({ legal: false, reason });
    const p = R.preview(same, fromSupplies(0, 1));
    expect(p).toMatchObject({ legal: false, reason, delta: 0 });
    expect(p.after).toEqual(p.before);
    // The other Bedroom is still a host.
    expect(R.installHosts(same, 'supplies', 0)).toEqual([2]);
    expect(R.installHosts(same, 'hand', 0)).toEqual([2]);
  });
});

describe('the fixture goes with its host (§4)', () => {
  it('demolishing the host removes the fixture, with no refund', () => {
    const s = build(ONE_BEDROOM, { supplies: ['fireplace'], hand: [pc('bedroom')] });
    const installed = R.apply(s, fromSupplies(0, 1)).state;
    expect(installed.supplies).toEqual([]);
    const { state, events } = R.apply(installed, { t: 'demolish', x: 0, y: 0 });
    expect(types(events)).toEqual(['demolished']);
    expect(eventsOf(events, 'demolished')[0]).toMatchObject({ uid: 1, defId: 'bedroom' });
    expect(state.house.pieces).toEqual([]);
    // Nothing back: no budget, no supply.
    expect(state.budget).toBe(installed.budget);
    expect(state.supplies).toEqual([]);
    expect(R.currentTally(state).total).toBe(0);
    // A new Bedroom on the same spot is a new piece, without the old fixture: it earns 3.
    const rebuilt = R.apply(state, { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 });
    const placed = eventsOf(rebuilt.events, 'placed')[0]!;
    expect(placed.uid).toBe(2);
    expect(fixtureOf(rebuilt.state, 2)).toBeUndefined();
    expect(eventsOf(rebuilt.events, 'tally')[0]!.tally.total).toBe(3);
  });

  it('demolishing another piece leaves the fixture in place', () => {
    const s = withFx(build(TWO_BEDROOMS), 1, 'fireplace');
    const { state } = R.apply(s, { t: 'demolish', x: 2, y: 0 });
    expect(state.house.pieces.map((p) => p.uid)).toEqual([1]);
    expect(fixtureOf(state, 1)).toEqual({ id: 'fireplace', week: 1 });
    // Alone, the Bedroom earns 3 → 5 with its Fireplace.
    expect(R.currentTally(state).total).toBe(5);
  });
});

describe('a piece that becomes a lot feature can’t hold a fixture (D-095)', () => {
  // A Lawn (uid 1) and a Sapling (uid 2). The Sapling becomes a Tree after 4 weeks, and the Tree
  // is a lot feature, not a piece, so a fixture in the Sapling would go with it.
  const LAWN_AND_SAPLING: Placement[] = [
    ['lawn', 0, 0],
    ['sapling', 5, 0],
  ];
  const reason = 'A Sapling becomes a Tree, so it can’t hold a fixture.';

  it('Garden Lights fit any yard piece, but not a Sapling', () => {
    const s = build(LAWN_AND_SAPLING, { hand: [fx('gardenLights')], supplies: ['gardenLights'] });
    expect(R.checkPlay(s, fromHand(0, 2))).toMatchObject({ legal: false, reason });
    expect(() => R.apply(s, fromHand(0, 2))).toThrow(reason);
    expect(() => R.apply(s, fromSupplies(0, 2))).toThrow(reason);
    // The reason the board and the inspect panel show when pointing the lights at the Sapling.
    expect(R.preview(s, fromSupplies(0, 2))).toMatchObject({ legal: false, reason, delta: 0 });
    // Only the Lawn is a host.
    expect(R.installHosts(s, 'hand', 0)).toEqual([1]);
    expect(R.installHosts(s, 'supplies', 0)).toEqual([1]);
    expect(R.legalActions(s).filter((a) => a.t === 'install')).toEqual([
      fromHand(0, 1),
      fromSupplies(0, 1),
    ]);
  });

  it('with only a Sapling on the lot, Garden Lights have no host, so the card doesn’t fit', () => {
    const s = build([['sapling', 5, 0]], { hand: [fx('gardenLights')] });
    expect(R.installHosts(s, 'hand', 0)).toEqual([]);
    expect(R.cardFits(s, 0)).toBe(false);
  });

  it('a fixture that doesn’t fit a Sapling anyway still says where it goes', () => {
    const s = build(LAWN_AND_SAPLING, { hand: [fx('sprinkler')] });
    expect(R.checkPlay(s, fromHand(0, 2))).toMatchObject({
      legal: false,
      reason: 'A Sprinkler goes in a Lawn, not a Sapling.',
    });
  });
});

describe('fits, checked at install time (Appendix B)', () => {
  it('a Sprinkler can’t go in a Bedroom', () => {
    const s = build(ONE_BEDROOM, { hand: [fx('sprinkler')], supplies: ['sprinkler'] });
    const reason = 'A Sprinkler goes in a Lawn, not a Bedroom.';
    expect(R.checkPlay(s, fromHand(0, 1))).toMatchObject({ legal: false, reason });
    expect(() => R.apply(s, fromHand(0, 1))).toThrow(reason);
    expect(() => R.apply(s, fromSupplies(0, 1))).toThrow(reason);
    expect(R.preview(s, fromSupplies(0, 1))).toMatchObject({ legal: false, reason });
    expect(R.installHosts(s, 'hand', 0)).toEqual([]);
  });

  it('each fixture’s hosts on a house with one of everything', () => {
    // Scattered on a 20×12 lot, so every room touches the yard (exterior).
    const house = houseFrom(C, emptyRows(20, 12), [
      ['bedroom', 0, 0], // 1
      ['kitchen', 3, 0], // 2
      ['lKitchen', 6, 0], // 3 (countsAs kitchen)
      ['diningRoom', 9, 0], // 4
      ['livingRoom', 12, 0], // 5
      ['closet', 15, 0], // 6
      ['hallway', 17, 0], // 7 (a connector, not a room)
      ['lawn', 0, 5], // 8
      ['patio', 3, 5], // 9
      ['fence', 6, 5], // 10 (a yard piece)
      ['doghouse', 11, 5], // 11 (an outbuilding)
      ['greenhouse', 13, 5], // 12 (an outbuilding)
    ]);
    const layout = computeLayout(C, house);
    const rooms = [1, 2, 3, 4, 5, 6];
    const hosts = (id: FixtureId) => installHosts(C, layout, id);
    expect(hosts('fireplace')).toEqual(rooms);
    expect(hosts('skylight')).toEqual(rooms);
    expect(hosts('blackoutCurtains')).toEqual(rooms);
    expect(hosts('soundproofing')).toEqual(rooms);
    expect(hosts('bayWindow')).toEqual(rooms);
    expect(hosts('kitchenIsland')).toEqual([2, 3]);
    expect(hosts('bunkBeds')).toEqual([1]);
    expect(hosts('sprinkler')).toEqual([8]);
    expect(hosts('pergola')).toEqual([9]);
    expect(hosts('gardenLights')).toEqual([8, 9, 10]);
    expect(hosts('chandelier')).toEqual([4, 5]);
  });

  /** A Bedroom (uid 1) at (2,2) walled in by Hallways on three sides, open at the bottom. */
  const THREE_SIDES: Placement[] = [
    ['bedroom', 2, 2],
    ['hallway', 2, 1, 0], // above
    ['hallway', 1, 2, 1], // left
    ['hallway', 4, 2, 1], // right
  ];
  const ENCLOSED: Placement[] = [...THREE_SIDES, ['hallway', 2, 4, 0]]; // and below

  it('a Bay Window needs an exterior room', () => {
    const s = build(ENCLOSED, { supplies: ['bayWindow', 'fireplace'] });
    expect(R.describePiece(s, 1)!.side).toBe('interior');
    const check = R.checkPlay(s, fromSupplies(0, 1));
    expect(check.legal).toBe(false);
    expect(check.reason).toMatch(/^A Bay Window goes in .*exterior room, not a Bedroom\.$/);
    expect(() => R.apply(s, fromSupplies(0, 1))).toThrow(IllegalAction);
    expect(R.installHosts(s, 'supplies', 0)).toEqual([]);
    // A Fireplace fits any room, interior or not.
    expect(R.installHosts(s, 'supplies', 1)).toEqual([1]);
    // Open on one side, the Bedroom is exterior, and the Bay Window fits.
    const open = build(THREE_SIDES, { supplies: ['bayWindow'] });
    expect(R.describePiece(open, 1)!.side).toBe('exterior');
    expect(R.installHosts(open, 'supplies', 0)).toEqual([1]);
  });

  it('a Bay Window stays when its room later becomes interior, and still gives a view', () => {
    const s = build(THREE_SIDES, { supplies: ['bayWindow'], hand: [pc('hallway')] });
    expect(R.describePiece(s, 1)!.view).toBe(false);
    const installed = R.apply(s, fromSupplies(0, 1)).state;
    expect(R.describePiece(installed, 1)!.view).toBe(true);
    // The fourth Hallway, below, closes it in.
    const { state } = R.apply(installed, { t: 'place', from: 'hand', i: 0, x: 2, y: 4, rot: 0 });
    const info = R.describePiece(state, 1)!;
    expect(info.side).toBe('interior');
    expect(info.tags).toContain('Dark');
    expect(fixtureOf(state, 1)).toEqual({ id: 'bayWindow', week: 1 });
    expect(info.view).toBe(true);
  });

  it('a Kitchen Island fits a Kitchen and an L-Kitchen (countsAs kitchen), not a Dining Room', () => {
    const s = build(
      [
        ['kitchen', 0, 0],
        ['lKitchen', 2, 0],
        ['diningRoom', 4, 0],
      ],
      { supplies: ['kitchenIsland'] },
    );
    expect(R.installHosts(s, 'supplies', 0)).toEqual([1, 2]);
    expect(R.checkPlay(s, fromSupplies(0, 3))).toMatchObject({
      legal: false,
      reason: 'A Kitchen Island goes in a Kitchen, not a Dining Room.',
    });
  });

  it('rejects a missing fixture, a piece card, and a uid that isn’t on the lot', () => {
    const s = build(ONE_BEDROOM, {
      hand: [pc('closet'), fx('fireplace')],
      supplies: ['fireplace'],
    });
    const noFixture = 'There is no fixture there.';
    expect(R.checkPlay(s, fromHand(0, 1))).toMatchObject({ legal: false, reason: noFixture });
    expect(R.checkPlay(s, fromHand(5, 1))).toMatchObject({ legal: false, reason: noFixture });
    expect(R.checkPlay(s, fromSupplies(1, 1))).toMatchObject({ legal: false, reason: noFixture });
    expect(R.checkPlay(s, fromHand(1, 99))).toMatchObject({
      legal: false,
      reason: 'Pick a piece on the lot to put it in.',
    });
    expect(R.checkPlay(s, fromHand(1, 1)).legal).toBe(true);
    expect(R.installHosts(s, 'hand', 0)).toEqual([]);
  });

  it('nothing installs while the shop is open', () => {
    const s = build(ONE_BEDROOM, { hand: [fx('fireplace')], supplies: ['fireplace'] });
    const shop = R.apply(s, { t: 'debug', op: 'forceShop' }).state;
    expect(shop.screen).toBe('shop');
    expect(() => R.apply(shop, fromSupplies(0, 1))).toThrow(IllegalAction);
    expect(R.installHosts(shop, 'supplies', 0)).toEqual([]);
    expect(R.legalActions(shop).some((a) => a.t === 'install')).toBe(false);
    expect(R.preview(shop, fromSupplies(0, 1)).legal).toBe(false);
  });
});

describe('fitsText and fixtureText', () => {
  it('reads the TEST_CONTENT fits selectors as short phrases', () => {
    expect(fitsText(C, 'fireplace')).toBe('any room');
    expect(fitsText(C, 'gardenLights')).toBe('any yard piece');
    expect(fitsText(C, 'sprinkler')).toBe('a Lawn');
    expect(fitsText(C, 'kitchenIsland')).toBe('a Kitchen');
    expect(fitsText(C, 'chandelier')).toBe('a Dining Room or Living Room');
    expect(fixtureText(C, C.fixtures.sprinkler)).toEqual({
      fits: 'Fits a Lawn',
      effects: ['Earns +100%'],
    });
  });

  it('every real fixture has a fits line and one non-empty effect line per modifier', () => {
    for (const def of Object.values(CONTENT.fixtures)) {
      const text = fixtureText(CONTENT, def);
      expect(text.fits, def.id).toMatch(/^Fits (any |an? )\S/);
      expect(text.effects.length, def.id).toBe(def.modifiers.length);
      expect(text.effects.length, def.id).toBeGreaterThan(0);
      for (const line of [text.fits, ...text.effects]) {
        expect(line.trim().length, def.id).toBeGreaterThan(0);
        expect(line, def.id).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  // Appendix B's Fits column says "an exterior room": { all: [room, exterior] } reads so.
  it('a Bay Window fits "an exterior room"', () => {
    expect(fitsText(C, 'bayWindow')).toBe('an exterior room');
    expect(fixtureText(CONTENT, CONTENT.fixtures.bayWindow).fits).toBe('Fits an exterior room');
  });

  // "part of an Entertainer", not "a Entertainer".
  it('real fixture texts never put "a" before a vowel', () => {
    for (const def of Object.values(CONTENT.fixtures)) {
      const text = fixtureText(CONTENT, def);
      for (const line of [text.fits, ...text.effects]) {
        expect(line, def.id).not.toMatch(/\ba [AEIOU]/);
      }
    }
  });
});

describe('preview(state, install) (§4: a fixture preview goes through the same path)', () => {
  it('a hand install: preview.after is the tally apply gives, and lines show the host', () => {
    // Two Bedrooms (4 each). Fireplace in uid 1: 4 → 6, so the week goes 8 → 10.
    const s = build(TWO_BEDROOMS, { hand: [fx('fireplace')] });
    const p = R.preview(s, fromHand(0, 1));
    expect(p.legal).toBe(true);
    expect(p.before).toEqual({ points: 8, mult: 100, total: 8 });
    expect(p.after).toEqual({ points: 10, mult: 100, total: 10 });
    expect(p.delta).toBe(2);
    expect(p.host).toBe(1);
    expect(p.lines.map((l) => [l.uid, l.isNew, l.before, l.after])).toEqual([[1, true, 4, 6]]);
    expect(p.newPiece).toMatchObject({ uid: 1, earned: 6 });
    // The host's cells, for highlighting.
    expect([...p.cells].sort((a, b) => a.y - b.y || a.x - b.x)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(p.upcoming).toEqual([]);
    const tally = eventsOf(R.apply(s, fromHand(0, 1)).events, 'tally')[0]!.tally;
    expect({ points: tally.points, mult: tally.mult, total: tally.total }).toEqual(p.after);
    expect(R.scoreOnly(s, fromHand(0, 1))).toBe(p.after.total);
  });

  it('a supplies install: preview.after equals the projected week after the free install', () => {
    const s = build(BEDROOM_AND_LAWN, { supplies: ['sprinkler'] });
    const p = R.preview(s, fromSupplies(0, 2));
    // Bedroom 3 + Lawn 1 = 4; with the Sprinkler the Lawn earns 2, so 5.
    expect(p.before.total).toBe(4);
    expect(p.after.total).toBe(5);
    expect(p.delta).toBe(1);
    expect(p.host).toBe(2);
    const after = R.apply(s, fromSupplies(0, 2)).state;
    expect(R.scoreOnly(after, null)).toBe(p.after.total);
    expect(R.currentTally(after).total).toBe(p.after.total);
    expect(R.scoreOnly(s, fromSupplies(0, 2))).toBe(p.after.total);
  });

  it('matches apply for every legal hand install on a mixed house', () => {
    const s = build(
      [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0],
        ['lawn', 0, 4],
        ['livingRoom', 6, 0],
        ['patio', 8, 0],
      ],
      { hand: [fx('fireplace'), fx('pergola'), fx('bayWindow')] },
    );
    const installs = R.legalPlays(s).filter((p): p is InstallAction => p.t === 'install');
    expect(installs.length).toBeGreaterThan(0);
    for (const play of installs) {
      const p = R.preview(s, play);
      const tally = eventsOf(R.apply(s, play).events, 'tally')[0]!.tally;
      expect(p.after.total, JSON.stringify(play)).toBe(tally.total);
      expect(p.after.points, JSON.stringify(play)).toBe(tally.points);
      expect(p.after.mult, JSON.stringify(play)).toBe(tally.mult);
      expect(R.scoreOnly(s, play)).toBe(tally.total);
    }
  });
});

describe('legalPlays, legalActions, and installHosts list installs', () => {
  // Bedroom (uid 1) and Lawn (uid 2). Hand: Fireplace, Sprinkler, Closet. Supplies: Skylight.
  const s = build(BEDROOM_AND_LAWN, {
    hand: [fx('fireplace'), fx('sprinkler'), pc('closet')],
    supplies: ['skylight'],
  });

  it('installHosts lists each fixture’s hosts in placement order', () => {
    expect(R.installHosts(s, 'hand', 0)).toEqual([1]);
    expect(R.installHosts(s, 'hand', 1)).toEqual([2]);
    expect(R.installHosts(s, 'hand', 2)).toEqual([]); // a piece card
    expect(R.installHosts(s, 'supplies', 0)).toEqual([1]);
    expect(R.installHosts(s, 'supplies', 3)).toEqual([]);
  });

  it('legalPlays has the hand installs (the week’s turn) but not the supply installs', () => {
    const installs = R.legalPlays(s).filter((a) => a.t === 'install');
    expect(installs).toEqual([fromHand(0, 1), fromHand(1, 2)]);
    // The Closet's placements are there too.
    expect(R.legalPlays(s).some((a) => a.t === 'place' && a.i === 2)).toBe(true);
  });

  it('legalActions has hand installs before the pass and supply installs after it', () => {
    const actions = R.legalActions(s);
    const at = (a: Action) => actions.findIndex((b) => JSON.stringify(b) === JSON.stringify(a));
    const pass = at(PASS);
    expect(pass).toBeGreaterThan(0);
    expect(at(fromHand(0, 1))).toBeGreaterThanOrEqual(0);
    expect(at(fromHand(0, 1))).toBeLessThan(pass);
    expect(at(fromHand(1, 2))).toBeLessThan(pass);
    expect(at(fromSupplies(0, 1))).toBeGreaterThan(pass);
    expect(actions.filter((a) => a.t === 'install')).toEqual([
      fromHand(0, 1),
      fromHand(1, 2),
      fromSupplies(0, 1),
    ]);
    // Every listed install is legal.
    for (const a of actions) {
      if (a.t === 'install') expect(R.checkPlay(s, a).legal).toBe(true);
    }
  });
});

describe('cardFits and the free redraw for fixture cards (Appendix A · M3a)', () => {
  it('a fixture card fits only if some placed piece can host it', () => {
    const noLawn = build(ONE_BEDROOM, { hand: [fx('sprinkler'), fx('fireplace')] });
    expect(R.cardFits(noLawn, 0)).toBe(false);
    expect(R.cardFits(noLawn, 1)).toBe(true);
    const lawn = build(BEDROOM_AND_LAWN, { hand: [fx('sprinkler')] });
    expect(R.cardFits(lawn, 0)).toBe(true);
    // A Fireplace whose only room already has one has no host.
    const full = withFx(build(ONE_BEDROOM, { hand: [fx('fireplace')] }), 1, 'fireplace');
    expect(R.cardFits(full, 0)).toBe(false);
  });

  it('giveGood fixtureCard appends a fixture card to the hand (a debug run)', () => {
    const s = build(ONE_BEDROOM, { hand: [pc('closet')] });
    const { state } = R.apply(s, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'fixtureCard', id: 'sprinkler' },
    });
    expect(state.hand).toEqual([pc('closet'), fx('sprinkler')]);
    expect(state.debug).toBe(true);
    expect(R.cardFits(state, 1)).toBe(false);
    expect(R.cardFits(state, 0)).toBe(true);
  });

  /** BIG, but the Sprinkler (from phase 0) is the only card that's ever drawn. */
  function onlySprinkler(): Content {
    const pieces = Object.fromEntries(
      Object.entries(BIG.pieces).map(([id, d]) => [id, { ...d, drawWeight: 0 }]),
    ) as Record<PieceId, PieceDef>;
    const fixtures = Object.fromEntries(
      Object.entries(BIG.fixtures).map(([id, d]) => [
        id,
        id === 'sprinkler' ? { ...d, fromPhase: 0 } : { ...d, drawWeight: 0 },
      ]),
    ) as Record<FixtureId, FixtureDef>;
    return { ...BIG, pieces, fixtures };
  }
  const RS = createRules(onlySprinkler());

  it('a hand of hostless fixtures gets the free redraw', () => {
    // The new run's lot is empty, so the Sprinkler has no Lawn: draw 0, then the free redraw.
    const fresh = RS.newRun(setup('sprinkler'));
    expect(fresh.hand).toEqual([fx('sprinkler')]);
    expect(fresh.draws).toBe(2);
    expect(fresh.freeRedrawUsed).toBe(true);
    // A week starting with only a Bedroom on the lot: the same.
    const s = build(ONE_BEDROOM, { rules: RS, seed: 'sprinkler' });
    const { state, events } = RS.apply(s, PASS);
    expect(eventsOf(events, 'handDrawn').map((e) => e.free)).toEqual([false, true]);
    expect(state.draws).toBe(2);
    expect(state.freeRedrawUsed).toBe(true);
  });

  it('a fixture with a host counts as fitting, so there’s no free redraw', () => {
    const s = build(BEDROOM_AND_LAWN, { rules: RS, seed: 'sprinkler' });
    const { state, events } = RS.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'handDrawn']);
    expect(eventsOf(events, 'handDrawn')[0]!.free).toBe(false);
    expect(state.hand).toEqual([fx('sprinkler')]);
    expect(state.draws).toBe(1);
    expect(state.freeRedrawUsed).toBe(false);
  });
});

describe('fixtures in the weekly draw (Appendix A · M3a: from phase 2, weight 5)', () => {
  const DRAWN: FixtureId[] = [
    'fireplace',
    'skylight',
    'blackoutCurtains',
    'soundproofing',
    'kitchenIsland',
    'bunkBeds',
    'bayWindow',
    'sprinkler',
    'pergola',
    'gardenLights',
  ];
  const fixtureWeights = (c: Content, phase: number) =>
    drawWeights(c, phase).filter((w) => w.card.kind === 'fixture');

  it('phase 0 draws no fixtures', () => {
    expect(fixtureWeights(C, 0)).toEqual([]);
  });

  it('from phase 1, every fixture with a draw weight joins at drawWeight × 100 = 500', () => {
    expect(fixtureWeights(C, 1)).toEqual(DRAWN.map((id) => ({ card: fx(id), weight: 500 })));
    // Pieces use drawWeight × complexityPct on the same scale: a Bedroom (complexity 1) is
    // 10 × 100 = 1000 and a Hallway (complexity 3) 10 × 25 = 250 in phase 1.
    const w = drawWeights(C, 1);
    expect(w.find((x) => x.card.kind === 'piece' && x.card.id === 'bedroom')!.weight).toBe(1000);
    expect(w.find((x) => x.card.kind === 'piece' && x.card.id === 'hallway')!.weight).toBe(250);
  });

  it('the Chandelier (draw weight 0) is never drawn', () => {
    for (const phase of [0, 1, 5]) {
      expect(
        drawWeights(C, phase).some((w) => w.card.kind === 'fixture' && w.card.id === 'chandelier'),
      ).toBe(false);
    }
  });

  it('a fixture’s fromPhase holds it back', () => {
    const late: Content = {
      ...C,
      fixtures: { ...C.fixtures, fireplace: { ...C.fixtures.fireplace, fromPhase: 2 } },
    };
    expect(fixtureWeights(late, 1).map((w) => w.card.id)).not.toContain('fireplace');
    expect(fixtureWeights(late, 2).map((w) => w.card.id)).toContain('fireplace');
  });

  it('phase-1 hands have fixtures now and then, phase-0 hands never, the Chandelier never', () => {
    let withFixture = 0;
    for (let k = 0; k < 200; k++) {
      const seed = `draw-${k}`;
      const early = drawHand(C, seed, 0, '1', 0, 3);
      expect(early.some((c) => c.kind === 'fixture')).toBe(false);
      const hand = drawHand(C, seed, 1, '1', 0, 3);
      expect(hand.some((c) => c.kind === 'fixture' && c.id === 'chandelier')).toBe(false);
      if (hand.some((c) => c.kind === 'fixture')) withFixture++;
      // Distinct cards, as always.
      expect(new Set(hand.map((c) => `${c.kind}:${c.id}`)).size).toBe(hand.length);
    }
    expect(withFixture).toBeGreaterThan(0);
    expect(withFixture).toBeLessThan(200);
  });
});

describe('a free install never moves the draws (property, D-039 keyed streams)', () => {
  const SEEDS = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6'];

  /** Passes `weeks` times, recording each new week's hand, week, and draws. */
  function passes(s: RunState, weeks: number) {
    const out: { hand: readonly Card[]; week: number; draws: number }[] = [];
    for (let k = 0; k < weeks; k++) {
      s = R.apply(s, PASS).state;
      out.push({ hand: s.hand, week: s.week, draws: s.draws });
    }
    return { state: s, out };
  }

  it('week, draws, the hand, a reroll, and every later hand are the same with or without it', () => {
    for (const seed of SEEDS) {
      const base = R.newRun(setup(seed));
      const s: RunState = {
        ...base,
        house: houseFrom(BIG, emptyRows(12, 12), BEDROOM_AND_LAWN),
        supplies: [
          { kind: 'fixture', id: 'fireplace' },
          { kind: 'fixture', id: 'sprinkler' },
        ],
      };
      // Two free installs this week.
      const once = R.apply(s, fromSupplies(0, 1)).state;
      const twice = R.apply(once, fromSupplies(0, 2)).state;
      for (const x of [once, twice]) {
        expect(x.week, seed).toBe(s.week);
        expect(x.slot, seed).toBe(s.slot);
        expect(x.draws, seed).toBe(s.draws);
        expect(x.hand, seed).toEqual(s.hand);
        expect(x.rerollsLeft, seed).toBe(s.rerollsLeft);
      }
      // A reroll after them draws the same hand as one without them.
      const rerollA = R.apply(s, { t: 'reroll' }).state;
      const rerollB = R.apply(twice, { t: 'reroll' }).state;
      expect(rerollB.hand, seed).toEqual(rerollA.hand);
      expect(rerollB.draws, seed).toBe(rerollA.draws);
      // The next three weeks' hands match, though the scores differ.
      const a = passes(s, 3);
      const b = passes(twice, 3);
      expect(b.out, seed).toEqual(a.out);
      expect(b.state.score, seed).toBeGreaterThan(a.state.score);
    }
  });
});
