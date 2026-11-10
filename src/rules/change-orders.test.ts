// Change orders (M4b; implementation-plan.md §4–§5, Appendix A · M4b): the offer after
// milestones 2, 4, and 6 (`changeOrderAfter`), drawn from `co/<milestone>` among the eligible
// ones; Appendix A's skip rules; the answer; requests met or missed, restrictions kept or broken
// (with the preview's warning), and phase effects for the next phase only; the debug panel's
// forced offer; and run codes with answers. On TEST_CONTENT with seven two-week phases whose
// targets are 0, so passing every week meets every milestone.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  ChangeOrderDef,
  ChangeOrderId,
  Content,
  GameEvent,
  Rules,
  RunState,
} from './index.ts';
import { withFixture } from './fixtures.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, IllegalAction } from './run.ts';
import { stream } from './rng.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

/** Seven phases (D-018's count) of TEST_BALANCE's two weeks, every target 0. */
function seven(content: Content = C, after: readonly number[] = [2, 4, 6]): Content {
  return {
    ...content,
    balance: {
      ...content.balance,
      phases: Array.from({ length: 7 }, (_, k) => ({ name: `Phase ${k + 1}`, target: 0 })),
      changeOrderAfter: after,
    },
  };
}

/** Content with some change orders changed: a test's own numbers, or scopes. */
function withOrders(over: Partial<Record<ChangeOrderId, Partial<ChangeOrderDef>>>, base = C) {
  const changeOrders = { ...base.changeOrders };
  for (const [id, o] of Object.entries(over) as [ChangeOrderId, Partial<ChangeOrderDef>][]) {
    changeOrders[id] = { ...changeOrders[id], ...o } as ChangeOrderDef;
  }
  return { ...base, changeOrders };
}

/** The generic orders, as Appendix B lists them: M4b's two, then D-137's three. */
const GENERIC = (Object.keys(C.changeOrders) as ChangeOrderId[]).filter(
  (id) => C.changeOrders[id].scope === 'generic',
);

/**
 * Content where only `keep` of the generic orders stay generic. The rest go to Dale, whom no test
 * client is, so they're never on offer, and a test's seed can't pick them.
 */
function onlyGeneric(keep: readonly ChangeOrderId[], base = C): Content {
  const moved = GENERIC.filter((id) => !keep.includes(id)).map((id) => [id, { scope: 'dale' }]);
  return withOrders(Object.fromEntries(moved), base);
}

/** Only Working from home is generic: the one order on offer. */
const ONLY_WFH = onlyGeneric(['workingFromHome']);

const HEAT_WAVE = C.changeOrders.heatWave as Extract<ChangeOrderDef, { kind: 'phase' }>;

/**
 * Plays on: a pass each week, leaving each shop (discarding a crate), and answering change
 * orders (`accept`, or true for a phase effect), until `stop` holds.
 */
function playUntil(
  r: Rules,
  s: RunState,
  stop: (s: RunState) => boolean,
  accept = true,
  max = 300,
): { state: RunState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  for (let k = 0; k < max && !stop(s); k++) {
    let a: Action;
    if (s.screen === 'build') a = { t: 'pass' };
    else if (s.screen === 'shop') a = s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
    else if (s.screen === 'changeOrder') {
      const kind = r.content.changeOrders[s.offers!.changeOrder!.id].kind;
      a = { t: 'answerChangeOrder', accept: kind === 'phase' || accept };
    } else break;
    const out = r.apply(s, a);
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events };
}

const offered = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.t === 'changeOrderOffered' ? [e] : []));
const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) =>
  events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);

/** A run on the 'changeOrder' screen after milestone 2, with this order offered. */
function offeredAfter2(r: Rules, seed = 'co'): RunState {
  const { state } = playUntil(r, r.newRun(setup(seed)), (s) => s.screen === 'changeOrder');
  expect(state.screen).toBe('changeOrder');
  return state;
}

/** Puts a card in the hand (a cheat) and places it, ending the week. */
function build(r: Rules, s: RunState, id: Parameters<typeof giveCard>[0], x: number, y: number) {
  const given = r.apply(s, giveCard(id)).state;
  return r.apply(given, { t: 'place', from: 'hand', i: given.hand.length - 1, x, y, rot: 0 });
}
function giveCard(id: 'homeOffice' | 'bedroom' | 'playroom' | 'closet' | 'patio' | 'lawn') {
  return { t: 'debug', op: 'giveCard', id } as const;
}

describe('the offer', () => {
  it('comes after milestones 2, 4, and 6 only: none after the last, and the shop follows', () => {
    const r = createRules(seven(withClient({ changeOrders: ['thanksgiving', 'goldenRetriever'] })));
    const { state, events } = playUntil(r, r.newRun(setup('timing')), (s) => s.screen === 'won');
    expect(state.screen).toBe('won');
    // Each runs through the phase after its milestone: Framing, Drywall, the last.
    expect(offered(events).map((e) => e.phase)).toEqual([2, 4, 6]);
    // The milestone first, then the offer; its answer, then the shop.
    const types = events.map((e) => e.t);
    for (const at of types.flatMap((t, k) => (t === 'changeOrderOffered' ? [k] : []))) {
      expect(types[at - 1]).toBe('milestone');
      expect(types[at + 1]).toBe('changeOrderAnswered');
      expect(types[at + 2]).toBe('shopOpened');
    }
    // Milestone 7 ends the run: no offer after it.
    const last = types.lastIndexOf('milestone');
    expect(types.slice(last)).not.toContain('changeOrderOffered');
    expect(state.changeOrders.map((o) => o.phase)).toEqual([2, 4, 6]);
  });

  it('never comes after a missed milestone, or with nothing eligible', () => {
    // Milestone 2 can't be met, so the run is lost there (after its overtime).
    const hard = seven();
    const lost = createRules({
      ...hard,
      balance: {
        ...hard.balance,
        phases: hard.balance.phases.map((p, k) => (k === 1 ? { ...p, target: 999 } : p)),
      },
    });
    const run = playUntil(lost, lost.newRun(setup('lost')), (s) => s.screen === 'lost');
    expect(run.state.screen).toBe('lost');
    expect(offered(run.events)).toEqual([]);
    // Two generic orders (M4b's), three offers: the third milestone goes straight to the shop.
    const two = createRules(seven(onlyGeneric(['workingFromHome', 'heatWave'])));
    const plain = playUntil(two, two.newRun(setup('few')), (s) => s.screen === 'won');
    expect(offered(plain.events).map((e) => e.phase)).toEqual([2, 4]);
  });

  it('is drawn evenly from co/<milestone> among the client’s own and the generic ones', () => {
    const content = seven(withClient({ changeOrders: ['thanksgiving', 'goldenRetriever'] }));
    const r = createRules(content);
    const ids: ChangeOrderId[] = ['thanksgiving', 'goldenRetriever', ...GENERIC];
    expect(GENERIC).toEqual([
      'workingFromHome',
      'heatWave',
      'coldSnap',
      'rainySeason',
      'hoaLetter',
    ]);
    const seen = new Set<ChangeOrderId>();
    for (let k = 0; k < 12; k++) {
      const seed = `draw-${k}`;
      const s = offeredAfter2(r, seed);
      expect(r.eligibleChangeOrders({ ...s, offers: undefined })).toEqual(ids);
      const want = stream(seed, 'co/2').pick(ids);
      expect(s.offers?.changeOrder).toEqual({ id: want, phase: 2 });
      seen.add(want);
    }
    // The stream decides, so different seeds offer different orders.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never offers one twice in a run', () => {
    const r = createRules(seven(withClient({ changeOrders: ['thanksgiving', 'goldenRetriever'] })));
    const { events } = playUntil(r, r.newRun(setup('twice')), (s) => s.screen === 'won');
    const ids = offered(events).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows on its screen: the order, whether it can be declined, and a request’s progress', () => {
    const r = createRules(seven(ONLY_WFH));
    const s = offeredAfter2(r);
    expect(r.changeOrderOffer(s)).toEqual({
      id: 'workingFromHome',
      name: 'Working from home',
      kind: 'request',
      text: 'A new Home Office.',
      terms: ['A new Home Office, by the next milestone', 'Met: +3 budget'],
      reward: { budget: 3 },
      phase: 2,
      declinable: true,
      met: false,
      progress: [{ text: '0 new of 1', ok: false }],
    });
    expect(r.legalActions(s)).toEqual([
      { t: 'answerChangeOrder', accept: true },
      { t: 'answerChangeOrder', accept: false },
    ]);
    // Only the answer, the auto-complete toggle, and cheats while it waits.
    for (const a of [{ t: 'pass' }, { t: 'leaveShop' }, { t: 'reroll' }] as Action[]) {
      expect(() => r.apply(s, a)).toThrow(IllegalAction);
    }
    expect(r.apply(s, { t: 'setAutoComplete', on: true }).state.screen).toBe('changeOrder');
    expect(r.checkPlay(s, { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 }).reason).toBe(
      'A change order is waiting for your answer.',
    );
    expect(r.changeOrderOffer({ ...s, screen: 'build' })).toBeNull();
  });
});

describe('the skip rules (Appendix A · M4b)', () => {
  const r = createRules(seven(withClient({ changeOrders: ['goldenRetriever'] })));
  const at = (patch: Partial<RunState>): ChangeOrderId[] =>
    r.eligibleChangeOrders({ ...r.newRun(setup('skips')), ...patch });

  it('skips a request the house already meets', () => {
    expect(at({})).toContain('goldenRetriever');
    // A Doghouse in a fenced yard: the house, a Fence closing the corner, and the Doghouse.
    const fence = ['...#', '...#', '...#', '...#', '####'];
    const house = houseFrom(C, emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['fence', 0, 0, 0, fence],
      ['doghouse', 1, 3],
    ]);
    expect(r.fencedYards({ ...r.newRun(setup('skips')), house })).toEqual([8]);
    expect(at({ house })).not.toContain('goldenRetriever');
  });

  it('skips a request whose pieces aren’t in the draw or the reserve', () => {
    expect(at({ struck: [{ kind: 'piece', id: 'homeOffice' }] })).not.toContain('workingFromHome');
    // A card in the reserve can still be placed.
    expect(
      at({ struck: [{ kind: 'piece', id: 'homeOffice' }], reserve: [{ id: 'homeOffice' }] }),
    ).toContain('workingFromHome');
  });

  it('skips one that needs more new pieces than a phase has weeks', () => {
    const many = createRules(
      seven(
        withOrders({
          workingFromHome: { condition: { countNew: { piece: 'homeOffice' }, min: 3 } },
        }),
      ),
    );
    expect(many.eligibleChangeOrders(many.newRun(setup('skips')))).not.toContain('workingFromHome');
  });

  it('skips a demolition request with no demolitions left', () => {
    const jun = createRules(seven(withClient({ changeOrders: ['declutter'] })));
    const s = jun.newRun(setup('skips'));
    expect(jun.eligibleChangeOrders(s)).toContain('declutter');
    expect(jun.eligibleChangeOrders({ ...s, demolitionsLeft: 0 })).not.toContain('declutter');
  });

  it('never skips a restriction or a phase effect', () => {
    const dale = createRules(seven(withClient({ changeOrders: ['bigDeadline'] })));
    expect(dale.eligibleChangeOrders(dale.newRun(setup('skips')))).toEqual([
      'bigDeadline',
      ...GENERIC,
    ]);
  });

  it('offers only phase effects for the last phase, where a reward of budget buys nothing', () => {
    const dale = createRules(seven(withClient({ changeOrders: ['bigDeadline'] })));
    const s = dale.newRun(setup('skips'));
    const last = 6; // seven() has seven phases
    expect(dale.eligibleChangeOrders({ ...s, phase: last - 1 })).toEqual([
      'bigDeadline',
      ...GENERIC,
    ]);
    expect(dale.eligibleChangeOrders({ ...s, phase: last })).toEqual([
      'heatWave',
      'coldSnap',
      'rainySeason',
    ]);
  });
});

describe('answers', () => {
  const r = createRules(seven(ONLY_WFH));

  it('accepting a request records it from the next phase’s first week, then opens the shop', () => {
    const s = offeredAfter2(r);
    const { state, events } = r.apply(s, { t: 'answerChangeOrder', accept: true });
    expect(events.map((e) => e.t)).toEqual(['changeOrderAnswered', 'shopOpened']);
    expect(events[0]).toEqual({
      t: 'changeOrderAnswered',
      id: 'workingFromHome',
      kind: 'request',
      accepted: true,
    });
    expect(state.screen).toBe('shop');
    expect(state.offers?.changeOrder).toBeUndefined();
    expect(state.changeOrders).toEqual([
      {
        id: 'workingFromHome',
        phase: 2,
        answer: 'accepted',
        week: s.week,
        sinceUid: s.house.nextUid,
        demolished: 0,
      },
    ]);
    // A request is a temporary goal: the checklist doesn't change.
    expect(r.checklist(state).map((l) => l.id)).toEqual(r.checklist(s).map((l) => l.id));
  });

  it('declining costs nothing, and it never resolves', () => {
    const s = offeredAfter2(r);
    const declined = r.apply(s, { t: 'answerChangeOrder', accept: false });
    expect(declined.state.changeOrders[0]).toMatchObject({ answer: 'declined' });
    expect(declined.state.budget).toBe(s.budget);
    const on = playUntil(r, declined.state, (x) => x.milestones.length === 3);
    expect(ofType(on.events, 'changeOrderResolved')).toEqual([]);
    expect(r.activeChangeOrders(on.state)).toEqual([]);
  });

  it('a phase effect can only be acknowledged', () => {
    const heat = createRules(seven(onlyGeneric(['heatWave'])));
    const s = offeredAfter2(heat);
    expect(s.offers?.changeOrder?.id).toBe('heatWave');
    expect(heat.changeOrderOffer(s)).toMatchObject({ kind: 'phase', declinable: false });
    expect(heat.legalActions(s)).toEqual([{ t: 'answerChangeOrder', accept: true }]);
    expect(() => heat.apply(s, { t: 'answerChangeOrder', accept: false })).toThrow(
      'Heat wave can’t be declined: it’s coming either way.',
    );
    const { state, events } = heat.apply(s, { t: 'answerChangeOrder', accept: true });
    expect(events[0]).toMatchObject({ t: 'changeOrderAnswered', accepted: true });
    expect(state.changeOrders[0]).toMatchObject({ answer: 'acknowledged', phase: 2 });
    expect(state.timedEffects).toEqual([
      { source: 'heatWave', until: { phase: 2 }, modifiers: HEAT_WAVE.modifiers },
    ]);
  });

  it('a bad answer, or one with nothing to answer, throws', () => {
    const s = offeredAfter2(r);
    expect(() => r.apply(s, { t: 'answerChangeOrder', accept: 'yes' } as never)).toThrow(
      IllegalAction,
    );
    const build = r.newRun(setup('none'));
    expect(() => r.apply(build, { t: 'answerChangeOrder', accept: true })).toThrow(
      'There’s no change order to answer.',
    );
  });
});

describe('requests', () => {
  const r = createRules(seven(ONLY_WFH));
  const open = emptyRows(10, 10);

  /** Accepts Working from home after milestone 2, on an empty 10 × 10 lot, and leaves the shop. */
  function accepted(seed = 'request'): RunState {
    const s = offeredAfter2(r, seed);
    const shop = r.apply(
      { ...s, house: houseFrom(C, open) },
      { t: 'answerChangeOrder', accept: true },
    );
    return r.apply(shop.state, { t: 'leaveShop' }).state;
  }

  it('met by the milestone: the reward is paid when that milestone resolves, not before', () => {
    let s = accepted();
    expect(s.phase).toBe(2);
    expect(r.activeChangeOrders(s)).toMatchObject([
      { id: 'workingFromHome', met: false, progress: [{ text: '0 new of 1', ok: false }] },
    ]);
    // A Home Office in the phase's first week: met, but nothing pays until the milestone.
    const placed = build(r, s, 'homeOffice', 4, 4);
    s = placed.state;
    expect(ofType(placed.events, 'changeOrderResolved')).toEqual([]);
    expect(r.activeChangeOrders(s)[0]).toMatchObject({ met: true });
    const budget = s.budget;
    const end = r.apply(s, { t: 'pass' }); // the phase's last week: the milestone resolves
    expect(ofType(end.events, 'changeOrderResolved')).toEqual([
      {
        t: 'changeOrderResolved',
        id: 'workingFromHome',
        kind: 'request',
        result: 'met',
        reward: { budget: 3 },
      },
    ]);
    const milestone = ofType(end.events, 'milestone')[0]!;
    // The milestone event comes first; the reward is on top of the milestone's.
    expect(end.events.indexOf(milestone)).toBeLessThan(
      end.events.findIndex((e) => e.t === 'changeOrderResolved'),
    );
    const tally = ofType(end.events, 'tally')[0]!;
    expect(end.state.budget).toBe(budget + tally.tally.budget + milestone.reward.budget + 3);
    expect(end.state.changeOrders[0]).toMatchObject({ result: 'met', reward: { budget: 3 } });
    expect(r.activeChangeOrders(end.state)).toEqual([]);
  });

  it('missed: nothing new placed, so no reward', () => {
    const s = accepted();
    const end = playUntil(r, s, (x) => x.milestones.length === 3);
    expect(ofType(end.events, 'changeOrderResolved')).toEqual([
      { t: 'changeOrderResolved', id: 'workingFromHome', kind: 'request', result: 'missed' },
    ]);
  });

  it('counts only pieces placed since it was accepted', () => {
    // A Home Office built before the offer doesn't count.
    const s = offeredAfter2(r);
    const before = houseFrom(C, open, [['homeOffice', 0, 0]]);
    const shop = r.apply({ ...s, house: before }, { t: 'answerChangeOrder', accept: true });
    const end = playUntil(r, shop.state, (x) => x.milestones.length === 3);
    expect(ofType(end.events, 'changeOrderResolved')[0]).toMatchObject({ result: 'missed' });
  });

  it('Declutter counts the pieces demolished since it was accepted', () => {
    const jun = createRules(seven(onlyGeneric([], withClient({ changeOrders: ['declutter'] }))));
    const s = offeredAfter2(jun);
    expect(s.offers?.changeOrder?.id).toBe('declutter');
    const house = houseFrom(
      C,
      ['B.........', ...emptyRows(10, 9)],
      [
        ['bedroom', 4, 4],
        ['closet', 6, 4],
      ],
    );
    const shop = jun.apply({ ...s, house }, { t: 'answerChangeOrder', accept: true });
    let t = jun.apply(shop.state, { t: 'leaveShop' }).state;
    // A Boulder isn't a piece: it doesn't count.
    t = jun.apply(t, { t: 'demolish', x: 0, y: 0 }).state;
    expect(t.changeOrders[0]!.demolished).toBe(0);
    expect(jun.activeChangeOrders(t)[0]).toMatchObject({
      met: false,
      progress: [{ text: '0 of 1 demolished', ok: false }],
    });
    t = jun.apply(t, { t: 'demolish', x: 6, y: 4 }).state; // the Closet
    expect(t.changeOrders[0]!.demolished).toBe(1);
    const end = playUntil(jun, t, (x) => x.milestones.length === 3);
    expect(ofType(end.events, 'changeOrderResolved')[0]).toMatchObject({ result: 'met' });
  });
});

describe('restrictions', () => {
  const r = createRules(seven(onlyGeneric([], withClient({ changeOrders: ['bigDeadline'] }))));
  const open = emptyRows(10, 10);

  function accepted(): RunState {
    const s = offeredAfter2(r);
    expect(s.offers?.changeOrder?.id).toBe('bigDeadline');
    expect(r.changeOrderOffer(s)).toMatchObject({
      kind: 'restriction',
      declinable: true,
      reward: { budget: 4 },
      terms: ['Place no Loud pieces until the next milestone', 'Kept: +4 budget'],
    });
    const shop = r.apply(
      { ...s, house: houseFrom(C, open, [['bedroom', 4, 4]]) },
      {
        t: 'answerChangeOrder',
        accept: true,
      },
    );
    return r.apply(shop.state, { t: 'leaveShop' }).state;
  }

  it('a forbidden placement breaks it: the preview warns, the placement stays legal', () => {
    const s = r.apply(accepted(), giveCard('playroom')).state; // Loud
    const i = s.hand.length - 1;
    const loud = { t: 'place', from: 'hand', i, x: 6, y: 4, rot: 0 } as const;
    const p = r.preview(s, loud);
    expect(p.legal).toBe(true);
    expect(p.breaks).toBe('bigDeadline');
    const quiet = r.apply(s, giveCard('closet')).state;
    expect(
      r.preview(quiet, { t: 'place', from: 'hand', i: quiet.hand.length - 1, x: 6, y: 4, rot: 0 })
        .breaks,
    ).toBeUndefined();
    const { state, events } = r.apply(s, loud);
    const broken = ofType(events, 'changeOrderBroken');
    expect(broken).toEqual([{ t: 'changeOrderBroken', id: 'bigDeadline', uid: s.house.nextUid }]);
    // Right after the placement, before the tally.
    expect(events.findIndex((e) => e.t === 'changeOrderBroken')).toBe(
      events.findIndex((e) => e.t === 'placed') + 1,
    );
    expect(state.changeOrders[0]).toMatchObject({ brokenBy: s.house.nextUid });
    expect(r.activeChangeOrders(state)[0]).toMatchObject({ brokenBy: s.house.nextUid });
    const end = playUntil(r, state, (x) => x.milestones.length === 3);
    expect(ofType(end.events, 'changeOrderResolved')).toEqual([
      { t: 'changeOrderResolved', id: 'bigDeadline', kind: 'restriction', result: 'broken' },
    ]);
  });

  it('kept to the milestone: the reward', () => {
    const placed = build(r, accepted(), 'closet', 6, 4);
    const end = playUntil(r, placed.state, (x) => x.milestones.length === 3);
    expect(ofType(end.events, 'changeOrderResolved')).toEqual([
      {
        t: 'changeOrderResolved',
        id: 'bigDeadline',
        kind: 'restriction',
        result: 'kept',
        reward: { budget: 4 },
      },
    ]);
  });
});

describe('phase effects', () => {
  it('apply in the next phase only, through its milestone, then end', () => {
    // Heat wave: pieces touching a Tree earn +100% (TEST_BALANCE's two weeks a phase).
    const r = createRules(seven(onlyGeneric(['heatWave'])));
    const s = offeredAfter2(r);
    // Trees above it keep it out of the sun (D-120), so Heat wave's Sunny rooms −50% stays out
    // of it.
    const lot = emptyRows(10, 10).map((row, y) =>
      y === 6 ? `T${row.slice(1)}` : y === 5 ? `.TT${row.slice(3)}` : row,
    );
    const house = houseFrom(C, lot, [['bedroom', 1, 6]]); // touching the Tree
    const before = r.currentTally({ ...s, screen: 'build', house }).pieces[0]!;
    const shop = r.apply({ ...s, house }, { t: 'answerChangeOrder', accept: true });
    const t = r.apply(shop.state, { t: 'leaveShop' }).state;
    const during = r.currentTally(t).pieces[0]!;
    expect(during.pct).toBe(before.pct + 100);
    // Its line says which of its three effects it is.
    expect(during.lines).toContainEqual({
      label: 'Heat wave (touching a Tree)',
      op: 'pct',
      value: 100,
      from: [],
    });
    expect(r.activeChangeOrders(t)).toMatchObject([{ id: 'heatWave', kind: 'phase' }]);
    // It lasts through the phase's tallies (not just a week), and ends at its milestone.
    const week1 = r.apply(t, { t: 'pass' });
    expect(ofType(week1.events, 'tally')[0]!.tally.pieces[0]!.pct).toBe(before.pct + 100);
    const end = r.apply(week1.state, { t: 'pass' });
    expect(ofType(end.events, 'tally')[0]!.tally.pieces[0]!.pct).toBe(before.pct + 100);
    expect(ofType(end.events, 'changeOrderResolved')).toEqual([
      { t: 'changeOrderResolved', id: 'heatWave', kind: 'phase', result: 'ended' },
    ]);
    expect(end.state.timedEffects).toEqual([]);
    const after = playUntil(r, end.state, (x) => x.screen === 'build');
    expect(r.currentTally(after.state).pieces[0]!.pct).toBe(before.pct);
  });

  it('a layout modifier (Eternal night) changes the layout while it runs', () => {
    const r = createRules(seven(onlyGeneric([], withClient({ changeOrders: ['eternalNight'] }))));
    const s = offeredAfter2(r);
    const house = houseFrom(C, emptyRows(10, 10), [['bedroom', 4, 4]]);
    const shop = r.apply({ ...s, house }, { t: 'answerChangeOrder', accept: true });
    const t = r.apply(shop.state, { t: 'leaveShop' }).state;
    const uid = t.house.pieces[0]!.uid;
    expect(r.describePiece(t, uid)?.tags).toContain('Dark');
    expect(r.describePiece({ ...t, timedEffects: [] }, uid)?.tags).not.toContain('Dark');
  });

  it('describePiece says where each tag comes from: the card, the layout, Eternal night, a fixture', () => {
    const r = createRules(seven(onlyGeneric([], withClient({ changeOrders: ['eternalNight'] }))));
    const s = offeredAfter2(r);
    // Nine Bathrooms in a 3 × 3 block (uids 1–9; the middle one, uid 5, is interior), an
    // exterior Bedroom (uid 10), and a Bedroom with Blackout Curtains (uid 11), both in the sun
    // (D-120).
    let house = houseFrom(C, emptyRows(10, 10), [
      ...[5, 6, 7].flatMap((y) => [1, 2, 3].map((x): Placement => ['bathroom', x, y])),
      ['bedroom', 6, 4],
      ['bedroom', 6, 7],
    ]);
    house = withFixture(house, 11, 'blackoutCurtains', 1);
    const before = { ...s, screen: 'build' as const, house };
    const night = r.apply(
      r.apply({ ...s, house }, { t: 'answerChangeOrder', accept: true }).state,
      {
        t: 'leaveShop',
      },
    ).state;
    const sources = (state: RunState, uid: number) => r.describePiece(state, uid)!.tagSources;
    const ETERNAL = { kind: 'changeOrder', id: 'eternalNight' } as const;
    const CURTAINS = { kind: 'fixture', id: 'blackoutCurtains', uid: 11 } as const;

    // Before the order: the card's tags, the sun's Sunny, the interior room's Dark, the
    // Curtains' Dark.
    const SUN = { kind: 'sunny' } as const;
    expect(sources(before, 10)).toEqual({ Quiet: [{ kind: 'card' }], Sunny: [SUN] });
    expect(sources(before, 5)).toEqual({ Wet: [{ kind: 'card' }], Dark: [{ kind: 'interior' }] });
    expect(sources(before, 11)).toEqual({
      Quiet: [{ kind: 'card' }],
      Sunny: [SUN],
      Dark: [CURTAINS],
    });
    // While it runs, every room is Dark from Eternal night too: an exterior room only from it.
    expect(r.describePiece(night, 10)).toMatchObject({
      side: 'exterior',
      tags: ['Quiet', 'Sunny', 'Dark'],
    });
    expect(sources(night, 10)).toEqual({
      Quiet: [{ kind: 'card' }],
      Sunny: [SUN],
      Dark: [ETERNAL],
    });
    expect(sources(night, 5).Dark).toEqual([{ kind: 'interior' }, ETERNAL]);
    expect(sources(night, 11).Dark).toEqual([ETERNAL, CURTAINS]);
  });

  it('a tool’s timed effect still ends with its week beside a phase effect', () => {
    const r = createRules(seven(onlyGeneric(['heatWave'])));
    const shop = r.apply(offeredAfter2(r), { t: 'answerChangeOrder', accept: true });
    let t = r.apply(shop.state, { t: 'leaveShop' }).state;
    t = r.apply(t, { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'rushOrder' } }).state;
    t = r.apply(t, { t: 'useTool', i: 0 }).state;
    expect(t.timedEffects.map((e) => e.source)).toEqual(['heatWave', 'rushOrder']);
    t = r.apply(t, { t: 'pass' }).state;
    expect(t.timedEffects.map((e) => e.source)).toEqual(['heatWave']);
  });
});

describe('forceChangeOrder (the ?debug panel)', () => {
  const r = createRules(seven());

  it('offers any order mid-week; it runs through this phase, and the answer returns to the week', () => {
    const s = r.newRun(setup('force'));
    const forced = r.apply(s, { t: 'debug', op: 'forceChangeOrder', id: 'bigDeadline' });
    expect(forced.events).toEqual([
      { t: 'changeOrderOffered', id: 'bigDeadline', kind: 'restriction', phase: 0, forced: true },
    ]);
    expect(forced.state).toMatchObject({ screen: 'changeOrder', debug: true });
    expect(forced.state.offers?.changeOrder).toEqual({ id: 'bigDeadline', phase: 0, forced: true });
    const back = r.apply(forced.state, { t: 'answerChangeOrder', accept: true });
    expect(back.events.map((e) => e.t)).toEqual(['changeOrderAnswered']);
    expect(back.state.screen).toBe('build');
    expect(back.state.offers).toBeUndefined();
    for (const k of ['week', 'slot', 'phase', 'hand', 'draws'] as const) {
      expect(back.state[k]).toEqual(s[k]);
    }
    expect(r.activeChangeOrders(back.state)).toMatchObject([{ id: 'bigDeadline', phase: 0 }]);
    // It resolves at this phase's milestone.
    const end = playUntil(r, back.state, (x) => x.milestones.length === 1);
    expect(ofType(end.events, 'changeOrderResolved')[0]).toMatchObject({ result: 'kept' });
  });

  it('only from the build screen, and only a real order', () => {
    const s = r.newRun(setup('force'));
    expect(() =>
      r.apply(s, { t: 'debug', op: 'forceChangeOrder', id: 'nope' as ChangeOrderId }),
    ).toThrow('Unknown change order.');
    const shop = playUntil(r, s, (x) => x.screen === 'shop').state;
    expect(() => r.apply(shop, { t: 'debug', op: 'forceChangeOrder', id: 'heatWave' })).toThrow(
      'A change order is forced from the build screen.',
    );
  });
});

describe('run codes', () => {
  it('carry the answers and the debug ops, and replay exactly', () => {
    const content = seven(withClient({ changeOrders: ['thanksgiving', 'bigDeadline'] }));
    const r = createRules(content);
    const actions: Action[] = [{ t: 'debug', op: 'forceChangeOrder', id: 'heatWave' }];
    let s = r.apply(r.newRun(setup('codes')), actions[0]!).state;
    const answer: Action = { t: 'answerChangeOrder', accept: true };
    actions.push(answer);
    s = r.apply(s, answer).state;
    for (let k = 0; k < 120 && s.screen !== 'won'; k++) {
      const a: Action =
        s.screen === 'build'
          ? { t: 'pass' }
          : s.screen === 'shop'
            ? { t: 'leaveShop' }
            : { t: 'answerChangeOrder', accept: k % 2 === 0 || r.legalActions(s).length === 1 };
      actions.push(a);
      s = r.apply(s, a).state;
    }
    expect(s.screen).toBe('won');
    expect(s.changeOrders.length).toBeGreaterThanOrEqual(3);
    const code = encodeRunCode({
      build: 'test',
      contentHash: contentHash(content),
      setup: s.setup,
      actions,
    });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.actions).toEqual(actions);
    const replayed = r.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toStrictEqual(s);
    // A fresh rules object, with no caches, agrees.
    expect(JSON.stringify(createRules(content).replay(s.setup, actions).state)).toBe(
      JSON.stringify(s),
    );
  });

  it('refuse a malformed answer', () => {
    const bad = encodeRunCode({
      build: 'test',
      contentHash: 'x',
      setup: setup('bad'),
      actions: [{ t: 'answerChangeOrder', accept: 'yes' } as never],
    });
    expect(decodeRunCode(bad).ok).toBe(false);
    const debug = encodeRunCode({
      build: 'test',
      contentHash: 'x',
      setup: setup('bad'),
      actions: [{ t: 'debug', op: 'forceChangeOrder', id: 7 } as never],
    });
    expect(decodeRunCode(debug).ok).toBe(false);
  });
});
