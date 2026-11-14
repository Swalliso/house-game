// D-171 on the real content: each crew's own free build, on top of the stock every crew gets.
// The Landscaper's yard piece and the Architect's Addition come from the crew's `stock` (one at
// a time, when the standing stock comes), the General Contractor's Weekend Crew comes at the
// milestones that follow a change order, and the Handyman's fixtures go in from the hand without
// ending the week. The numbers follow crews.ts, pieces.ts and balance.ts.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  CrewId,
  GameEvent,
  PieceId,
  PlaceAction,
  RunMode,
  RunState,
} from '../rules/index.ts';
import { cardText, modifierText, rules } from '../rules/index.ts';
import { drawWeights } from '../rules/draw.ts';
import { CONTENT } from './index.ts';

const start = (crewId: CrewId, seed = 'crews-free', mode: RunMode = 'standard'): RunState =>
  rules.newRun({ seed, clientId: 'hendersons', crewId, mode });

/** The next step of a run that only passes: shops left, change orders answered, targets met by a cheat. */
function passOn(s: RunState): Action {
  if (s.screen === 'shop') return s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
  if (s.screen === 'changeOrder') return { t: 'answerChangeOrder', i: 0 };
  if (s.score < rules.target(s)) return { t: 'debug', op: 'addScore', amount: rules.target(s) };
  return { t: 'pass' };
}

/**
 * Plays a run on with passes until `stop`, calling `build` on each build screen first (it may
 * return a state with a free play made), and `seen` with every step's events.
 */
function play(
  from: RunState,
  stop: (s: RunState) => boolean,
  seen: (events: readonly GameEvent[], after: RunState) => void = () => {},
  build: (s: RunState) => RunState = (s) => s,
): RunState {
  let s = from;
  for (let k = 0; k < 2000 && !stop(s) && s.screen !== 'won' && s.screen !== 'lost'; k++) {
    if (s.screen === 'build') s = build(s);
    const out = rules.apply(s, passOn(s));
    seen(out.events, out.state);
    s = out.state;
  }
  return s;
}

/** A card of this type into the hand (a cheat), and its first legal spot: the week's play. */
function placeFromHand(s: RunState, id: PieceId): RunState {
  const given = rules.apply(s, { t: 'debug', op: 'giveCard', id }).state;
  const i = given.hand.findIndex((c) => c.kind === 'piece' && c.id === id);
  const spot = rules.legalPlacements(given).find((p) => p.from === 'hand' && p.i === i);
  expect(spot, `a spot for ${id}`).toBeDefined();
  return rules.apply(given, spot!).state;
}

const crewCards = (s: RunState) => s.reserve.filter((r) => r.crew);

describe('the crews’ own cards (D-171)', () => {
  it('each crew says what it brings', () => {
    const c = CONTENT.crews;
    expect(Object.keys(c)).toEqual(['generalContractor', 'landscaper', 'architect', 'handyman']);
    expect(c.generalContractor.orderTool).toBe('weekendCrew');
    expect(c.generalContractor.stock).toBeUndefined();
    // The Landscaper's yard piece took the place of its starting Sapling and Fence.
    expect(c.landscaper.startReserve).toBeUndefined();
    expect(c.landscaper.stock).toEqual([
      'lawn',
      'flowerBed',
      'patio',
      'herbGarden',
      'treehouse',
      'greenhouse',
      'doghouse',
      'sapling',
    ]);
    expect(c.architect.stock).toEqual(['addition']);
    expect(c.handyman.modifiers).toEqual([{ kind: 'rule', key: 'freeInstalls', add: 1 }]);
    expect(c.handyman.modifiers.map((m) => modifierText(CONTENT, m))).toEqual([
      'Fixtures from your hand don’t use your week',
    ]);
    // Every blurb is a sentence or two. The Landscaper's and the Architect's are no longer than
    // they were (22 and 14 words); the General Contractor's names its second perk in 13.
    const words = (id: CrewId) => c[id].blurb.split(/\s+/).length;
    for (const crew of Object.values(c)) expect(crew.blurb, crew.id).toMatch(/^[A-Z].*\.$/);
    expect(words('landscaper')).toBeLessThanOrEqual(22);
    expect(words('architect')).toBeLessThanOrEqual(14);
    expect(words('generalContractor')).toBeLessThanOrEqual(13);
    expect(words('handyman')).toBeLessThanOrEqual(12);
  });

  it('the Landscaper’s yard piece waits from week 1, after the stock', () => {
    const s = start('landscaper');
    expect(s.reserve.slice(0, 2)).toEqual([
      { id: 'hallway', stock: true },
      { id: 'fence', stock: true },
    ]);
    expect(s.reserve).toHaveLength(3);
    expect(crewCards(s)).toHaveLength(1);
    expect(CONTENT.crews.landscaper.stock).toContain(crewCards(s)[0]!.id);
    // The other crews' week 1: the stock alone, or the stock and the Architect's Addition.
    expect(start('generalContractor').reserve.map((r) => r.id)).toEqual(['hallway', 'fence']);
    expect(start('handyman').reserve.map((r) => r.id)).toEqual(['hallway', 'fence']);
    expect(start('architect').reserve.map((r) => r.id)).toEqual(['hallway', 'fence', 'addition']);
  });

  it('another comes each milestone once the last is built, a different one each time', () => {
    const got: { phase: number; id: PieceId }[] = [];
    const first = start('landscaper');
    const ids: PieceId[] = [crewCards(first)[0]!.id];
    // Each build screen: the crew's card goes down where it first fits (it's free, D-163).
    const build = (s: RunState): RunState => {
      const i = s.reserve.findIndex((r) => r.crew);
      if (i < 0) return s;
      const spot = rules.legalPlacements(s).find((p) => p.from === 'reserve' && p.i === i);
      if (!spot) return s;
      const out = rules.apply(s, spot);
      expect(out.state.week, 'a card from Your goods never ends the week').toBe(s.week);
      return out.state;
    };
    play(
      first,
      () => false,
      (events) => {
        for (const e of events) {
          if (e.t === 'delivered' && e.from === 'crew') {
            expect(e.cards).toHaveLength(1);
            got.push({ phase: e.phase, id: e.cards[0]! });
            ids.push(e.cards[0]!);
          }
        }
      },
      build,
    );
    // Week 1's comes with the run; then one at each later milestone's first week.
    expect(got.map((g) => g.phase)).toEqual([1, 2, 3, 4, 5, 6]);
    // Seven milestones, eight yard pieces: none comes twice.
    expect(new Set(ids).size).toBe(7);
    for (const id of ids) expect(CONTENT.crews.landscaper.stock).toContain(id);
  });

  it('none comes while one still waits', () => {
    const first = start('landscaper');
    const waiting = crewCards(first)[0]!.id;
    let crewEvents = 0;
    const later = play(
      first,
      (s) => s.phase === 3 && s.screen === 'build',
      (events) => {
        crewEvents += events.filter((e) => e.t === 'delivered' && e.from === 'crew').length;
      },
    );
    expect(later.phase).toBe(3);
    expect(crewEvents).toBe(0);
    expect(crewCards(later).map((r) => r.id)).toEqual([waiting]);
  });

  it('the order is the run’s own', () => {
    const firstOf = (seed: string) => crewCards(start('landscaper', seed))[0]!.id;
    expect(firstOf('crews-free')).toBe(firstOf('crews-free'));
    const firsts = new Set(Array.from({ length: 24 }, (_, k) => firstOf(`order-${k}`)));
    expect(firsts.size).toBeGreaterThan(3);
  });

  it('in a first job it comes with the stock, in Foundation’s third week', () => {
    // The rules take any crew in a first job; the job board gives it the General Contractor.
    const first = start('landscaper', 'crews-free', 'firstJob');
    expect(first.reserve).toEqual([]);
    const stock = CONTENT.balance.standingStock;
    const at = play(
      first,
      (s) =>
        s.screen === 'build' && s.phase === stock.firstJobPhase && s.slot === stock.firstJobSlot,
    );
    expect(at.reserve.map((r) => [r.id, !!r.stock, !!r.crew]).slice(0, 2)).toEqual([
      ['hallway', true, false],
      ['fence', true, false],
    ]);
    expect(crewCards(at)).toHaveLength(1);
    const before = play(
      first,
      (s) => s.screen === 'build' && s.phase === stock.firstJobPhase && s.slot === 2,
    );
    expect(before.reserve).toEqual([]);
  });
});

describe('the Architect’s Addition (D-171)', () => {
  const addition = CONTENT.pieces.addition;

  it('is a card that only grows a room', () => {
    expect(addition.addition).toBe(true);
    expect(addition.shape).toEqual(['##', '##']);
    expect(addition.effects).toEqual([]);
    expect(cardText(CONTENT, addition)).toEqual({
      effects: ['+8 to the room it grows'],
      notes: [
        'A Bedroom, Kitchen, Living Room, or Dining Room, once a room. It becomes part of the room.',
      ],
    });
    // Never drawn, by the weekly draw or the Catalog, at any milestone.
    for (let phase = 0; phase < CONTENT.balance.phases.length; phase++) {
      for (const special of [false, true]) {
        const ids = drawWeights(CONTENT, phase, { special }).map((w) => w.card.id);
        expect(ids, `phase ${phase}`).not.toContain('addition');
      }
    }
  });

  it('has no spot of its own, and waits for a room it can grow', () => {
    const s = start('architect');
    const i = s.reserve.findIndex((r) => r.id === 'addition');
    expect(rules.legalPlacements(s).filter((p) => p.from === 'reserve' && p.i === i)).toEqual([]);
    const place: PlaceAction = { t: 'place', from: 'reserve', i, x: 3, y: 3, rot: 0 };
    expect(rules.checkPlay(s, place)).toMatchObject({
      legal: false,
      reason:
        'An Addition grows a room: lay it beside a Bedroom, Kitchen, Living Room, or Dining Room.',
    });
    expect(rules.extendTargets(s, 'reserve', i)).toEqual([]);
  });

  it('grows a Bedroom by its four tiles for +8, free, and not a Bathroom', () => {
    let s = placeFromHand(start('architect'), 'bedroom');
    s = placeFromHand(s, 'bathroom');
    const i = s.reserve.findIndex((r) => r.id === 'addition');
    const bedroom = s.house.pieces.find((p) => p.defId === 'bedroom')!;
    const bathroom = s.house.pieces.find((p) => p.defId === 'bathroom')!;
    expect(rules.extendTargets(s, 'reserve', i)).toEqual([bedroom.uid]);
    expect(rules.extendSpots(s, 'reserve', i, bathroom.uid)).toEqual([]);
    expect(
      rules.checkPlay(s, {
        t: 'extend',
        from: 'reserve',
        i,
        uid: bathroom.uid,
        x: 0,
        y: 0,
        rot: 0,
      }),
    ).toMatchObject({
      legal: false,
      reason: 'An Addition extends a Bedroom, Kitchen, Living Room, or Dining Room.',
    });
    const spot = rules.extendSpots(s, 'reserve', i, bedroom.uid)[0]!;
    expect(rules.endsWeek(s, spot)).toBe(false);
    const earnedBefore = rules.currentTally(s).pieces.find((p) => p.uid === bedroom.uid)!.points;
    const out = rules.apply(s, spot);
    const grown = out.state.house.pieces.find((p) => p.uid === bedroom.uid)!;
    expect(out.state.week).toBe(s.week);
    expect(out.state.house.pieces).toHaveLength(s.house.pieces.length);
    expect(grown.extended).toBe(1);
    expect(grown.shape!.join('').split('#').length - 1).toBe(8);
    expect(out.state.reserve.some((r) => r.id === 'addition')).toBe(false);
    expect(out.events.map((e) => e.t)).toContain('extended');
    const earnedAfter = rules
      .currentTally(out.state)
      .pieces.find((p) => p.uid === bedroom.uid)!.points;
    expect(earnedAfter - earnedBefore).toBeGreaterThanOrEqual(8);
  });

  it('a room grows once: the next Addition waits for another room', () => {
    let s = placeFromHand(start('architect'), 'bedroom');
    const i = s.reserve.findIndex((r) => r.id === 'addition');
    const bedroom = s.house.pieces.find((p) => p.defId === 'bedroom')!;
    s = rules.apply(s, rules.extendSpots(s, 'reserve', i, bedroom.uid)[0]!).state;
    // The next milestone's Addition arrives, and has nothing to grow.
    const next = play(s, (q) => q.phase === 1 && q.screen === 'build');
    const j = next.reserve.findIndex((r) => r.id === 'addition');
    expect(j).toBeGreaterThanOrEqual(0);
    expect(rules.extendTargets(next, 'reserve', j)).toEqual([]);
    expect(
      rules.checkPlay(next, {
        t: 'extend',
        from: 'reserve',
        i: j,
        uid: bedroom.uid,
        x: 0,
        y: 0,
        rot: 0,
      }),
    ).toMatchObject({ legal: false, reason: 'That Bedroom is as big as it gets.' });
  });
});

describe('the General Contractor’s Weekend Crew (D-171)', () => {
  const tools = (s: RunState) => s.supplies.filter((x) => x.kind === 'tool').map((x) => x.id);

  it('comes at the start of each milestone that follows a change order', () => {
    expect(CONTENT.balance.changeOrderAfter).toEqual([2, 4, 6]);
    const came: { phase: number; slot: number; sold?: number }[] = [];
    let after: RunState | null = null;
    play(
      start('generalContractor'),
      () => false,
      (events, state) => {
        for (const e of events) {
          if (e.t !== 'crewTool') continue;
          expect(e.tool).toBe('weekendCrew');
          came.push({ phase: e.phase, slot: state.slot, ...(e.sold ? { sold: e.sold } : {}) });
          after ??= state;
        }
      },
    );
    // No one used the first two, so the third found the supplies' three slots one short of full.
    expect(came).toEqual([
      { phase: 2, slot: 1 },
      { phase: 4, slot: 1 },
      { phase: 6, slot: 1 },
    ]);
    expect(tools(after!)).toEqual(['weekendCrew']);
    expect(after!.screen).toBe('build');
    // The other crews get none.
    let others = 0;
    for (const crewId of ['landscaper', 'architect', 'handyman'] as const) {
      play(
        start(crewId),
        (s) => s.phase === 3,
        (events) => {
          others += events.filter((e) => e.t === 'crewTool').length;
        },
      );
    }
    expect(others).toBe(0);
  });

  it('is sold at once when the supplies are full', () => {
    const full = (s: RunState): RunState => {
      let q = s;
      while (q.supplies.length < rules.slots(q).supplies) {
        q = rules.apply(q, {
          t: 'debug',
          op: 'giveGood',
          good: { kind: 'fixture', id: 'skylight' },
        }).state;
      }
      return q;
    };
    const sold: number[] = [];
    let budgetBefore = 0;
    let budgetAfter = 0;
    let last: RunState = start('generalContractor');
    play(
      last,
      (s) => s.phase === 3,
      (events, state) => {
        for (const e of events) {
          if (e.t === 'crewTool') {
            sold.push(e.sold ?? 0);
            budgetBefore = last.budget;
            budgetAfter = state.budget;
            expect(tools(state)).toEqual([]);
          }
        }
        last = state;
      },
      full,
    );
    // Half its list price, as anything sold is (D-049); the same step may pay other budget too.
    expect(sold).toEqual([Math.floor(CONTENT.tools.weekendCrew.price / 2)]);
    expect(budgetAfter - budgetBefore).toBeGreaterThanOrEqual(sold[0]!);
  });

  it('a first job’s comes at the same milestones, long after its guided opening', () => {
    const came: number[] = [];
    play(
      start('generalContractor', 'crews-free', 'firstJob'),
      () => false,
      (events) => {
        for (const e of events) if (e.t === 'crewTool') came.push(e.phase);
      },
    );
    expect(came).toEqual([2, 4, 6]);
  });
});

describe('the Handyman’s fixtures (D-171)', () => {
  /** A Bedroom on the lot (the week's play), then a Skylight at the front of the hand. */
  const withFixture = (crewId: CrewId): RunState => {
    const s = placeFromHand(start(crewId), 'bedroom');
    return { ...s, hand: [{ kind: 'fixture', id: 'skylight' }, ...s.hand] };
  };

  it('go in from the hand without ending the week', () => {
    const s = withFixture('handyman');
    const uid = s.house.pieces[0]!.uid;
    const install = { t: 'install', from: 'hand', i: 0, uid } as const;
    expect(rules.rule(s, 'freeInstalls')).toBe(1);
    expect(rules.endsWeek(s, install)).toBe(false);
    const out = rules.apply(s, install);
    expect(out.state.week).toBe(s.week);
    expect(out.state.screen).toBe('build');
    expect(out.state.hand).toHaveLength(s.hand.length - 1);
    expect(out.state.house.pieces[0]!.fixture?.id).toBe('skylight');
    expect(out.events.map((e) => e.t)).toEqual(['installed']);
    // A piece from the hand is still the week's play.
    const piece = rules.legalPlacements(out.state).find((p) => p.from === 'hand')!;
    expect(rules.endsWeek(out.state, piece)).toBe(true);
  });

  it('leave a Weekend Crew ready for the next card', () => {
    const s: RunState = { ...withFixture('handyman'), freePlay: 'ready' };
    const uid = s.house.pieces[0]!.uid;
    const out = rules.apply(s, { t: 'install', from: 'hand', i: 0, uid });
    expect(out.state.freePlay).toBe('ready');
    expect(out.events[0]).not.toHaveProperty('free');
  });

  it('are the week’s play for every other crew', () => {
    for (const crewId of ['generalContractor', 'landscaper', 'architect'] as const) {
      const s = withFixture(crewId);
      const uid = s.house.pieces[0]!.uid;
      expect(rules.rule(s, 'freeInstalls'), crewId).toBe(0);
      expect(rules.endsWeek(s, { t: 'install', from: 'hand', i: 0, uid }), crewId).toBe(true);
    }
  });
});
