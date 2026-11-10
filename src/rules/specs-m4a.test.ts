// Clients and their checklists in the run (M4a: implementation-plan.md §4 Scoring pipeline and
// Appendix A · M4a; house-systems-review.md §4 and §6). Each spec met adds `specBonus` to the
// week's Mult after sets and before +Mult modifiers; specMet and specLost compare each tally
// with the last; previews and the checklist show what a play would turn on or off; a client's
// tastes and pool are run modifiers; its targetPct scales the targets; and the setup and run
// codes carry its id. TEST_CONTENT's clients have empty checklists, tastes, and pools, so each
// test gives the Hendersons its own with withClient(). Every piece houseFrom places has
// placedWeek 1 and uids from 1, in order.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  ClientId,
  Content,
  GameEvent,
  InstallAction,
  Modifier,
  PieceId,
  PlaceAction,
  RenovateAction,
  Rot,
  RunCodeData,
  RunSetup,
  RunState,
  SpecDef,
  Tally,
  UseToolAction,
} from './index.ts';
import { drawWeights } from './draw.ts';
import { runModifiers } from './modifiers.ts';
import { createRules, type Rules } from './run.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { specText } from './text.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

// ---------------------------------------------------------------------------------------
// Helpers.

/**
 * A 10 × 10 empty lot. The top 4 rows are sunny and the street runs below row 9, so the
 * pieces here sit in rows 4–7, clear of both.
 */
const L = emptyRows(10, 10);

/** Long phases with high targets, so weeks go by without a milestone. */
const LONG: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: 8,
    phases: [
      { name: 'Groundbreaking', target: 1000 },
      { name: 'Foundation', target: 2000 },
    ],
  },
};

// Checklist lines. In TEST_CONTENT a Bedroom earns 3, +1 per Quiet neighbor (a Bedroom is
// Quiet); a Closet earns 1; a Kitchen earns nothing on its own.
const TWO_BEDROOMS: SpecDef = {
  id: 'twoBedrooms',
  name: 'Two Bedrooms',
  group: 'household',
  condition: { count: { piece: 'bedroom' }, min: 2 },
};
const SMALL: SpecDef = {
  id: 'small',
  name: 'A small house',
  group: 'shape',
  condition: { count: { piece: 'bedroom' }, max: 1 },
};
const A_CLOSET: SpecDef = {
  id: 'closet',
  name: 'A Closet',
  group: 'wishes',
  condition: { count: { piece: 'closet' }, min: 1 },
};
const NO_GARAGE: SpecDef = {
  id: 'noGarage',
  name: 'No Garage',
  group: 'wishes',
  condition: { none: { piece: 'garage' } },
};
/** Its own text is written lower-case, to show the checklist capitalizes it. */
const ONE_KITCHEN: SpecDef = {
  id: 'oneKitchen',
  name: 'One Kitchen',
  group: 'household',
  condition: { count: { piece: 'kitchen' }, min: 1, max: 1 },
  text: 'exactly one Kitchen. An L-Kitchen counts.',
};
/** A household that grows: 1 Bedroom in Groundbreaking, 2 from Foundation. */
const GROWING: SpecDef = {
  id: 'roomForEveryone',
  name: 'Room for everyone',
  group: 'household',
  condition: {
    stages: [
      { fromPhase: 0, condition: { count: { piece: 'bedroom' }, min: 1 } },
      { fromPhase: 1, condition: { count: { piece: 'bedroom' }, min: 2 } },
    ],
  },
};

/** A Bedroom (uid 1, x 0–1, y 4–5) and a Closet (uid 2) at (2, 4) beside it: 3 + 1 = 4 Comfort. */
const BED_AND_CLOSET: Placement[] = [
  ['bedroom', 0, 4],
  ['closet', 2, 4],
];

/**
 * A Jack-and-Jill: the Bathroom (uid 2) at (2, 4) touches both Bedrooms, which don't touch
 * each other. 3 + 3 for the Bedrooms, 3 for the Bathroom (it touches a Bedroom), and the set's
 * 10: 19 Comfort, and the set's +0.5 Charm.
 */
const J_AND_J: Placement[] = [
  ['bedroom', 0, 4],
  ['bathroom', 2, 4],
  ['bedroom', 3, 4],
];

const PASS: Action = { t: 'pass' };
const LEAVE: Action = { t: 'leaveShop' };

/** Rules whose Hendersons have this checklist. */
const rulesWith = (specs: readonly SpecDef[], base: Content = C): Rules =>
  createRules(withClient({ specs }, base));

/** A Hendersons run on the empty lot with these pieces. */
function runOn(r: Rules, placements: readonly Placement[] = [], seed = 'specs'): RunState {
  const s = r.newRun(setup(seed));
  return { ...s, house: houseFrom(r.content, L, placements) };
}

/** Puts chosen piece cards in the hand. */
function withHand(s: RunState, ...ids: PieceId[]): RunState {
  return { ...s, hand: ids.map((id) => ({ kind: 'piece' as const, id })) };
}

const place = (i: number, x: number, y: number, rot: Rot = 0): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot,
});

/** The second Bedroom, under the first: x 0–1, y 6–7. */
const SECOND_BEDROOM = place(0, 0, 6);

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);
const specEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.t === 'specMet' || e.t === 'specLost');

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

/** The tally the week recorded when this action ended it. */
function tallyAfter(r: Rules, s: RunState, action: Action): Tally {
  const t = eventsOf(r.apply(s, action).events, 'tally')[0];
  if (!t) throw new Error('that action recorded no tally');
  return t.tally;
}

const scoreOf = (t: Tally) => ({ points: t.points, mult: t.mult, total: t.total });

// ---------------------------------------------------------------------------------------
// Specs in the tally.

describe('specs in the tally', () => {
  it('each spec met adds specBonus (+0.25) to the Mult; Tally.specs lists every line in order', () => {
    const r = rulesWith([A_CLOSET, TWO_BEDROOMS, NO_GARAGE]);
    const t = r.currentTally(runOn(r, BED_AND_CLOSET));
    expect(t.specs).toEqual([
      { id: 'closet', met: true },
      { id: 'twoBedrooms', met: false },
      { id: 'noGarage', met: true },
    ]);
    expect(t.specBonus).toBe(25);
    // 4 Comfort × (1 + 2 × 0.25) = 6. Specs aren't +Mult terms.
    expect(scoreOf(t)).toEqual({ points: 4, mult: 150, total: 6 });
    expect(t.multTerms).toEqual([]);
  });

  it('a client with no specs adds nothing', () => {
    const r = createRules(C);
    const t = r.currentTally(runOn(r, BED_AND_CLOSET));
    expect(t).toMatchObject({ specs: [], specBonus: 0, points: 4, mult: 100, total: 4 });
  });

  it('the week rounds half up: two Closets and one spec met are 2 × 1.25 = 2.5 → 3', () => {
    const r = rulesWith([A_CLOSET]);
    const s = runOn(r, [
      ['closet', 0, 4],
      ['closet', 1, 4],
    ]);
    expect(scoreOf(r.currentTally(s))).toEqual({ points: 2, mult: 125, total: 3 });
  });

  it('specs add after sets and before +Mult modifiers, and a ×Mult multiplies them too', () => {
    const r = rulesWith([TWO_BEDROOMS]);
    // The phase's last week (slot 2 of 2), with Last-Minute Push and a Rush Order.
    let s: RunState = {
      ...runOn(r, J_AND_J),
      slot: 2,
      week: 2,
      blueprints: [{ id: 'lastMinutePush', boughtWeek: 1 }],
      supplies: [{ kind: 'tool', id: 'rushOrder' }],
    };
    s = r.apply(s, { t: 'useTool', i: 0 }).state;
    const t = r.currentTally(s);
    expect(t.sets).toMatchObject([{ set: 'jackAndJill', points: 10, mult: 50 }]);
    expect(t.specs).toEqual([{ id: 'twoBedrooms', met: true }]);
    expect(t.multTerms).toEqual([
      { source: { kind: 'tool', id: 'rushOrder' }, label: 'Rush Order', add: 50 },
    ]);
    // 100 + 0.5 (the set) + 0.25 (the spec) + 0.5 (Rush Order) = 2.25, then ×2 = 4.5.
    expect(t.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'lastMinutePush' },
        label: 'Last-Minute Push',
        times: 200,
        before: 225,
        after: 450,
      },
    ]);
    // 19 × 4.5 = 85.5 → 86.
    expect(scoreOf(t)).toEqual({ points: 19, mult: 450, total: 86 });
  });

  it('Dream Home raises the bonus by 10 for each spec met', () => {
    const r = rulesWith([A_CLOSET, NO_GARAGE]);
    const s: RunState = {
      ...runOn(r, BED_AND_CLOSET),
      blueprints: [{ id: 'dreamHome', boughtWeek: 1 }],
    };
    expect(r.rule(s, 'specBonus')).toBe(35);
    // 4 × (1 + 2 × 0.35) = 6.8 → 7.
    expect(r.currentTally(s)).toMatchObject({ specBonus: 35, points: 4, mult: 170, total: 7 });
  });

  it('Inspector’s Visit adds 25 more, for this week’s tally only', () => {
    const r = rulesWith([A_CLOSET, NO_GARAGE]);
    let s: RunState = {
      ...runOn(r, BED_AND_CLOSET),
      supplies: [{ kind: 'tool', id: 'inspectorsVisit' }],
    };
    s = r.apply(s, { t: 'useTool', i: 0 }).state;
    expect(r.rule(s, 'specBonus')).toBe(50);
    // 4 × (1 + 2 × 0.5) = 8.
    expect(r.currentTally(s)).toMatchObject({ specBonus: 50, mult: 200, total: 8 });
    const week1 = r.apply(s, PASS);
    expect(eventsOf(week1.events, 'tally')[0]!.tally).toMatchObject({
      specBonus: 50,
      mult: 200,
      total: 8,
    });
    // The next week it's gone: 4 × 1.5 = 6.
    expect(r.currentTally(week1.state)).toMatchObject({ specBonus: 25, mult: 150, total: 6 });
    // With Dream Home too, the adds stack: 25 + 10 + 25 = 60.
    const dream: RunState = { ...s, blueprints: [{ id: 'dreamHome', boughtWeek: 1 }] };
    expect(r.currentTally(dream).specBonus).toBe(60);
  });

  it('the tool’s preview shows what Inspector’s Visit adds', () => {
    const r = rulesWith([A_CLOSET, NO_GARAGE]);
    const s: RunState = {
      ...runOn(r, BED_AND_CLOSET),
      supplies: [{ kind: 'tool', id: 'inspectorsVisit' }],
    };
    // 4 × 1.5 = 6, then 4 × 2 = 8. It turns no line on or off.
    expect(r.previewTool(s, { t: 'useTool', i: 0 })).toMatchObject({
      ok: true,
      before: { points: 4, mult: 150, total: 6 },
      after: { points: 4, mult: 200, total: 8 },
      delta: 2,
      specsGained: [],
      specsLost: [],
    });
  });

  it('a client’s rule taste can scale the bonus: adds first, then the percentage, rounded half up', () => {
    const r = createRules(
      withClient({ specs: [A_CLOSET], tastes: [{ kind: 'rule', key: 'specBonus', pct: 50 }] }),
    );
    const s = runOn(r, [['closet', 0, 4]]);
    // 25 × 150% = 37.5 → 38.
    expect(r.currentTally(s)).toMatchObject({ specBonus: 38, mult: 138 });
    // (25 + 10) × 150% = 52.5 → 53.
    const dream: RunState = { ...s, blueprints: [{ id: 'dreamHome', boughtWeek: 1 }] };
    expect(r.currentTally(dream)).toMatchObject({ specBonus: 53, mult: 153 });
  });

  it('the bonus never goes below 0, so a met spec can’t take Charm away', () => {
    const r = createRules(
      withClient({ specs: [A_CLOSET], tastes: [{ kind: 'rule', key: 'specBonus', add: -40 }] }),
    );
    const t = r.currentTally(runOn(r, [['closet', 0, 4]]));
    expect(t).toMatchObject({ specs: [{ id: 'closet', met: true }], specBonus: 0, mult: 100 });
  });

  it('a staged spec reads the phase: the last stage that has begun applies', () => {
    const r = rulesWith([GROWING]);
    const s = runOn(r, [['bedroom', 0, 4]]);
    // Groundbreaking wants 1 Bedroom: 3 × 1.25 = 3.75 → 4.
    expect(r.currentTally(s)).toMatchObject({
      specs: [{ id: 'roomForEveryone', met: true }],
      mult: 125,
      total: 4,
    });
    // Foundation wants 2: the same house no longer meets it.
    expect(r.currentTally({ ...s, phase: 1 })).toMatchObject({
      specs: [{ id: 'roomForEveryone', met: false }],
      mult: 100,
      total: 3,
    });
  });

  it('before its first stage begins, a staged spec doesn’t hold', () => {
    const later: SpecDef = {
      ...GROWING,
      condition: {
        stages: [{ fromPhase: 1, condition: { count: { piece: 'bedroom' }, min: 1 } }],
      },
    };
    const r = rulesWith([later]);
    const s = runOn(r, [['bedroom', 0, 4]]);
    expect(r.currentTally(s).specs).toEqual([{ id: 'roomForEveryone', met: false }]);
    expect(r.currentTally({ ...s, phase: 1 }).specs).toEqual([
      { id: 'roomForEveryone', met: true },
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// specMet and specLost.

describe('spec events', () => {
  it('specMet fires after the tally of the week a line first holds, with its id and index', () => {
    const r = rulesWith([A_CLOSET, TWO_BEDROOMS], LONG);
    // Week 1: the Closet line holds at the first tally.
    const w1 = r.apply(runOn(r, BED_AND_CLOSET), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'closet', index: 0 }]);
    expect(w1.state.lastTally?.specsMet).toEqual([true, false]);
    // Week 2: a second Bedroom meets line 1.
    const w2 = r.apply(withHand(w1.state, 'bedroom'), SECOND_BEDROOM);
    expect(types(w2.events)).toEqual(['placed', 'tally', 'specMet', 'handDrawn']);
    expect(specEvents(w2.events)).toEqual([{ t: 'specMet', id: 'twoBedrooms', index: 1 }]);
    expect(w2.state.lastTally?.specsMet).toEqual([true, true]);
    // Week 3: both still hold, so nothing fires again.
    const w3 = r.apply(w2.state, PASS);
    expect(specEvents(w3.events)).toEqual([]);
    expect(w3.state.lastTally?.specsMet).toEqual([true, true]);
  });

  it('specLost fires when a line held at the last tally and doesn’t now: a demolition loses one', () => {
    const r = rulesWith([TWO_BEDROOMS], LONG);
    const s = runOn(r, [
      ['bedroom', 0, 4],
      ['bedroom', 0, 6],
    ]);
    const w1 = r.apply(s, PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'twoBedrooms', index: 0 }]);
    // The demolition's preview counts the line's Charm: 8 × 1.25 = 10, then 3 × 1 = 3. It
    // names the line it loses.
    expect(r.previewDemolish(w1.state, 0, 6)).toMatchObject({
      legal: true,
      before: { points: 8, mult: 125, total: 10 },
      after: { points: 3, mult: 100, total: 3 },
      delta: -7,
      specsGained: [],
      specsLost: ['twoBedrooms'],
    });
    // Demolishing is a free action with no tally, so nothing fires yet; the checklist shows it.
    const demo = r.apply(w1.state, { t: 'demolish', x: 0, y: 6 });
    expect(types(demo.events)).toEqual(['demolished']);
    expect(r.checklist(demo.state)[0]!.met).toBe(false);
    // The week's tally loses it.
    const w2 = r.apply(demo.state, PASS);
    expect(specEvents(w2.events)).toEqual([{ t: 'specLost', id: 'twoBedrooms', index: 0 }]);
    expect(w2.state.lastTally?.specsMet).toEqual([false]);
  });

  it('a placement can lose a line too: a second Kitchen breaks One Kitchen', () => {
    const r = rulesWith([ONE_KITCHEN], LONG);
    const w1 = r.apply(runOn(r, [['kitchen', 0, 4]]), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'oneKitchen', index: 0 }]);
    const w2 = r.apply(withHand(w1.state, 'kitchen'), place(0, 2, 4));
    expect(specEvents(w2.events)).toEqual([{ t: 'specLost', id: 'oneKitchen', index: 0 }]);
    // Demolishing the second Kitchen would win the line back.
    expect(r.previewDemolish(w2.state, 2, 4)).toMatchObject({
      legal: true,
      specsGained: ['oneKitchen'],
      specsLost: [],
    });
  });

  it('lines that flip in the same week each fire, in checklist order', () => {
    const r = rulesWith([SMALL, TWO_BEDROOMS], LONG);
    const w1 = r.apply(runOn(r, [['bedroom', 0, 4]]), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'small', index: 0 }]);
    const w2 = r.apply(withHand(w1.state, 'bedroom'), SECOND_BEDROOM);
    expect(specEvents(w2.events)).toEqual([
      { t: 'specLost', id: 'small', index: 0 },
      { t: 'specMet', id: 'twoBedrooms', index: 1 },
    ]);
  });

  it('a set’s line fires after the set’s own event, in the same week', () => {
    const jj: SpecDef = {
      id: 'jackAndJill',
      name: 'A Jack-and-Jill',
      group: 'wishes',
      condition: { set: 'jackAndJill' },
    };
    const r = rulesWith([jj], LONG);
    const s = withHand(runOn(r, J_AND_J.slice(0, 2)), 'bedroom');
    expect(r.checklist(s)[0]!.progress).toEqual([{ text: 'Jack-and-Jill 0 of 1', ok: false }]);
    const { events } = r.apply(s, place(0, 3, 4));
    expect(types(events)).toEqual(['placed', 'tally', 'setCompleted', 'specMet', 'handDrawn']);
    // 19 Comfort × (1 + 0.5 for the set + 0.25 for the line) = 33.25 → 33.
    expect(scoreOf(eventsOf(events, 'tally')[0]!.tally)).toEqual({
      points: 19,
      mult: 175,
      total: 33,
    });
  });

  it('a fast-forwarded week tallies the checklist too, and fires nothing new', () => {
    const r = rulesWith([A_CLOSET]);
    // Week 1: 4 × 1.25 = 5, which meets the target of 5.
    const w1 = r.apply(runOn(r, BED_AND_CLOSET), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'closet', index: 0 }]);
    const early = r.apply(w1.state, { t: 'completeEarly' });
    const [tally] = eventsOf(early.events, 'tally');
    expect(tally).toMatchObject({ fastForward: true, tally: { mult: 125, total: 5 } });
    expect(specEvents(early.events)).toEqual([]);
    expect(eventsOf(early.events, 'milestone')[0]).toMatchObject({ result: 'early' });
  });

  it('a line that holds on an empty lot fires at the first tally, even on a pass', () => {
    const r = rulesWith([A_CLOSET, NO_GARAGE], LONG);
    const w1 = r.apply(runOn(r), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'noGarage', index: 1 }]);
    // Nothing built: 0 Comfort × 1.25 is still 0 Wow.
    expect(scoreOf(eventsOf(w1.events, 'tally')[0]!.tally)).toEqual({
      points: 0,
      mult: 125,
      total: 0,
    });
  });

  it('a staged line can be lost at a milestone, with no change to the house', () => {
    const r = rulesWith([GROWING]);
    // Groundbreaking wants 1 Bedroom: 3 × 1.25 = 3.75 → 4 a week.
    const w1 = r.apply(runOn(r, [['bedroom', 0, 4]]), PASS);
    expect(specEvents(w1.events)).toEqual([{ t: 'specMet', id: 'roomForEveryone', index: 0 }]);
    // 8 ≥ 5: the milestone is met and the shop opens, with no spec event.
    const w2 = r.apply(w1.state, PASS);
    expect(w2.state).toMatchObject({ screen: 'shop', phase: 1, score: 8 });
    expect(specEvents(w2.events)).toEqual([]);
    // Foundation wants 2: the line is unmet as the phase starts, and lost at its first tally.
    const open = r.apply(w2.state, LEAVE).state;
    expect(r.checklist(open)[0]!.met).toBe(false);
    const w3 = r.apply(open, PASS);
    expect(specEvents(w3.events)).toEqual([{ t: 'specLost', id: 'roomForEveryone', index: 0 }]);
    expect(scoreOf(eventsOf(w3.events, 'tally')[0]!.tally)).toEqual({
      points: 3,
      mult: 100,
      total: 3,
    });
  });

  it('events compare with the last tally, previews with the house as it stands', () => {
    const r = rulesWith([TWO_BEDROOMS], LONG);
    const w1 = r.apply(
      runOn(r, [
        ['bedroom', 0, 4],
        ['bedroom', 0, 6],
      ]),
      PASS,
    );
    // Demolish a Bedroom, then build it back the same week.
    const demo = withHand(r.apply(w1.state, { t: 'demolish', x: 0, y: 6 }).state, 'bedroom');
    // The preview gains the line back against this week's house...
    expect(r.preview(demo, SECOND_BEDROOM).specsGained).toEqual(['twoBedrooms']);
    // ...but it held at the last tally, so the week fires nothing.
    const w2 = r.apply(demo, SECOND_BEDROOM);
    expect(specEvents(w2.events)).toEqual([]);
    expect(w2.state.lastTally?.specsMet).toEqual([true]);
  });
});

// ---------------------------------------------------------------------------------------
// Previews.

describe('previews', () => {
  /** One Bedroom; lines that a second Bedroom or a Closet would flip. */
  function oneBedroom() {
    const r = rulesWith([SMALL, TWO_BEDROOMS, A_CLOSET], LONG);
    const s = withHand(runOn(r, [['bedroom', 0, 4]]), 'bedroom', 'closet');
    return { r, s };
  }

  it('specsGained and specsLost name the lines a play would turn on and off', () => {
    const { r, s } = oneBedroom();
    expect(r.preview(s, SECOND_BEDROOM)).toMatchObject({
      legal: true,
      specsGained: ['twoBedrooms'],
      specsLost: ['small'],
    });
    expect(r.preview(s, place(1, 2, 4))).toMatchObject({
      legal: true,
      specsGained: ['closet'],
      specsLost: [],
    });
  });

  it('a pass changes no lines, and an illegal play shows none', () => {
    const { r, s } = oneBedroom();
    expect(r.preview(s, null)).toMatchObject({ legal: true, specsGained: [], specsLost: [] });
    // A 2 × 2 at (9, 9) is off the 10 × 10 lot.
    expect(r.preview(s, place(0, 9, 9))).toMatchObject({
      legal: false,
      specsGained: [],
      specsLost: [],
    });
  });

  it('the preview’s after is the tally apply() records, for plays that flip a line', () => {
    const { r, s } = oneBedroom();
    // Before: 3 Comfort, with A small house: 3 × 1.25 = 3.75 → 4.
    expect(r.preview(s, null).before).toEqual({ points: 3, mult: 125, total: 4 });
    // The second Bedroom: 4 + 4, trading A small house for Two Bedrooms: 8 × 1.25 = 10.
    const bed = r.preview(s, SECOND_BEDROOM);
    expect(bed.after).toEqual({ points: 8, mult: 125, total: 10 });
    expect(bed.after).toEqual(scoreOf(tallyAfter(r, s, SECOND_BEDROOM)));
    expect(bed.delta).toBe(6);
    // The Closet: 3 + 1, with two lines: 4 × 1.5 = 6.
    const closet = r.preview(s, place(1, 2, 4));
    expect(closet.after).toEqual({ points: 4, mult: 150, total: 6 });
    expect(closet.after).toEqual(scoreOf(tallyAfter(r, s, place(1, 2, 4))));
    expect(closet.delta).toBe(2);
    expect(r.scoreOnly(s, place(1, 2, 4))).toBe(6);
  });

  it('for every legal play, the preview, the checklist, and the tally agree on the lines', () => {
    const r = rulesWith([SMALL, TWO_BEDROOMS, A_CLOSET, ONE_KITCHEN], LONG);
    const s = withHand(runOn(r, [['bedroom', 0, 4]]), 'bedroom', 'closet', 'kitchen');
    const before = r.currentTally(s).specs;
    const plays = r.legalPlays(s);
    for (const play of plays) {
      const p = r.preview(s, play);
      const t = tallyAfter(r, s, play);
      expect(p.after).toEqual(scoreOf(t));
      const met = t.specs.map((sp) => sp.met);
      expect(r.checklist(s, play).map((l) => l.met)).toEqual(met);
      const gained = t.specs.filter((sp, k) => sp.met && !before[k]!.met).map((sp) => sp.id);
      const lost = t.specs.filter((sp, k) => !sp.met && before[k]!.met).map((sp) => sp.id);
      expect([p.specsGained, p.specsLost]).toEqual([gained, lost]);
      // Every placement flips a line: the Bedroom two, the Closet and the Kitchen one each.
      // A Renovation flips none.
      expect([play, gained.length + lost.length > 0]).toEqual([play, play.t === 'place']);
    }
    // 7 spots for each 2 × 2 and 6 for the Closet. A small house's "at most 1" makes the
    // Bedroom a limited type, so the Bedroom card can also renovate the Bedroom.
    expect(plays.filter((p) => p.t === 'place')).toHaveLength(20);
    expect(plays.filter((p) => p.t !== 'place')).toEqual([
      { t: 'renovate', from: 'hand', i: 0, uid: 1 },
    ]);
  });

  it('an install previews its line too: Bunk Beds make a Bedroom count twice', () => {
    const r = rulesWith([TWO_BEDROOMS], LONG);
    const s: RunState = {
      ...runOn(r, [['bedroom', 0, 4]]),
      supplies: [{ kind: 'fixture', id: 'bunkBeds' }],
    };
    const install: InstallAction = { t: 'install', from: 'supplies', i: 0, uid: 1 };
    expect(r.preview(s, install)).toMatchObject({
      legal: true,
      host: 1,
      specsGained: ['twoBedrooms'],
      specsLost: [],
    });
    expect(r.checklist(s, install)[0]).toMatchObject({
      met: true,
      progress: [{ text: '2 Bedrooms (≥ 2)', ok: true }],
    });
    // From the supplies it's free: the line fires at the week's tally.
    const free = r.apply(s, install);
    expect(specEvents(free.events)).toEqual([]);
    expect(specEvents(r.apply(free.state, PASS).events)).toEqual([
      { t: 'specMet', id: 'twoBedrooms', index: 0 },
    ]);
  });

  it('a Renovation previews the level it reaches, and changes no line', () => {
    const r = rulesWith([ONE_KITCHEN], LONG);
    const s = withHand(runOn(r, [['kitchen', 0, 4]]), 'kitchen');
    const play: RenovateAction = { t: 'renovate', from: 'hand', i: 0, uid: 1 };
    const p = r.preview(s, play);
    expect(p).toMatchObject({
      legal: true,
      renovates: { uid: 1, level: 1 },
      specsGained: [],
      specsLost: [],
    });
    // The Kitchen's level adds 4 Comfort, with One Kitchen still met: 4 × 1.25 = 5.
    expect(p.after).toEqual({ points: 4, mult: 125, total: 5 });
    expect(p.after).toEqual(scoreOf(tallyAfter(r, s, play)));
  });

  it('a tool’s preview names the lines it would flip: a Moving Truck parts a Kitchen pair', () => {
    const pair: SpecDef = {
      id: 'kitchenDining',
      name: 'Kitchen beside the Dining Room',
      group: 'wishes',
      condition: { adjacentPair: [{ piece: 'kitchen' }, { piece: 'diningRoom' }] },
    };
    const r = rulesWith([pair], LONG);
    // The Kitchen (uid 1), the Dining Room (uid 2) beside it, and a Bedroom (uid 3) under the
    // Kitchen. Beside the Bedroom (x 2–3, y 6–7), the Dining Room meets the Kitchen only at a
    // corner.
    const s: RunState = {
      ...runOn(r, [
        ['kitchen', 0, 4],
        ['diningRoom', 2, 4],
        ['bedroom', 0, 6],
      ]),
      supplies: [{ kind: 'tool', id: 'movingTruck' }],
    };
    const away: UseToolAction = { t: 'useTool', i: 0, target: { uid: 2, x: 2, y: 6, rot: 0 } };
    expect(r.previewTool(s, away)).toMatchObject({
      ok: true,
      specsGained: [],
      specsLost: ['kitchenDining'],
    });
    const moved = r.apply(s, away).state;
    expect(r.checklist(moved)[0]!.met).toBe(false);
    // Another truck brings it back, and the preview gains the line.
    const back: UseToolAction = { t: 'useTool', i: 0, target: { uid: 2, x: 2, y: 4, rot: 0 } };
    const again: RunState = { ...moved, supplies: [{ kind: 'tool', id: 'movingTruck' }] };
    expect(r.previewTool(again, back)).toMatchObject({
      ok: true,
      specsGained: ['kitchenDining'],
      specsLost: [],
    });
  });
});

// ---------------------------------------------------------------------------------------
// The checklist.

describe('checklist', () => {
  const SPECS = [TWO_BEDROOMS, ONE_KITCHEN, A_CLOSET];
  const content = withClient({ specs: SPECS });
  const r = createRules(content);
  const s = withHand(runOn(r, BED_AND_CLOSET), 'bedroom', 'kitchen');

  it('has one line per spec, in order, with its id, name, group, text, and progress', () => {
    expect(r.checklist(s)).toEqual([
      {
        id: 'twoBedrooms',
        name: 'Two Bedrooms',
        group: 'household',
        met: false,
        text: specText(content, TWO_BEDROOMS),
        progress: [{ text: '1 Bedroom (≥ 2)', ok: false }],
      },
      {
        id: 'oneKitchen',
        name: 'One Kitchen',
        group: 'household',
        met: false,
        // A spec's own text, capitalized.
        text: 'Exactly one Kitchen. An L-Kitchen counts.',
        progress: [{ text: '0 Kitchens (exactly 1)', ok: false }],
      },
      {
        id: 'closet',
        name: 'A Closet',
        group: 'wishes',
        met: true,
        text: specText(content, A_CLOSET),
        progress: [{ text: '1 Closet (≥ 1)', ok: true }],
      },
    ]);
    // A generated line reads as card text, as a sentence.
    expect(r.checklist(s)[0]!.text).toBe('2 or more Bedrooms.');
    expect(r.checklist(s)[2]!.text).toBe('A Closet.');
  });

  it('agrees with the tally on which lines hold', () => {
    expect(r.checklist(s).map((l) => l.met)).toEqual(r.currentTally(s).specs.map((sp) => sp.met));
  });

  it('with a play, shows the lines as they would be after it', () => {
    const bed = r.checklist(s, SECOND_BEDROOM);
    expect(bed.map((l) => l.met)).toEqual([true, false, true]);
    expect(bed[0]!.progress).toEqual([{ text: '2 Bedrooms (≥ 2)', ok: true }]);
    // A Kitchen beside the Closet.
    const kitchen = r.checklist(s, place(1, 3, 4));
    expect(kitchen[1]).toMatchObject({
      met: true,
      progress: [{ text: '1 Kitchen (exactly 1)', ok: true }],
    });
    // The state itself is untouched.
    expect(r.checklist(s).map((l) => l.met)).toEqual([false, false, true]);
  });

  it('ignores a pass, an illegal play, and any play off the build screen', () => {
    const now = r.checklist(s);
    expect(r.checklist(s, null)).toEqual(now);
    expect(r.checklist(s, place(0, 9, 9))).toEqual(now);
    expect(r.checklist({ ...s, screen: 'shop' }, SECOND_BEDROOM)).toEqual(now);
  });

  it('is the run’s own client’s: another client’s checklist is its own', () => {
    expect(r.checklist({ ...s, setup: setup('specs', 'vladislav') })).toEqual([]);
  });

  it('a staged line’s progress follows the current stage', () => {
    const staged = withClient({ specs: [GROWING] });
    const rs = createRules(staged);
    const one = runOn(rs, [['bedroom', 0, 4]]);
    expect(rs.checklist(one)[0]).toMatchObject({
      met: true,
      text: specText(staged, GROWING),
      progress: [{ text: '1 Bedroom (≥ 1)', ok: true }],
    });
    expect(rs.checklist({ ...one, phase: 1 })[0]).toMatchObject({
      met: false,
      text: specText(staged, GROWING),
      progress: [{ text: '1 Bedroom (≥ 2)', ok: false }],
    });
  });
});

// ---------------------------------------------------------------------------------------
// Tastes and the pool.

describe('client tastes and pool', () => {
  const likesBedrooms: Modifier = { kind: 'earn', target: { piece: 'bedroom' }, pct: 50 };
  const noCloset: Modifier = { kind: 'earnNothing', target: { piece: 'closet' } };
  const morePatios: Modifier = { kind: 'drawWeight', target: { piece: 'patio' }, add: 10 };

  it('the tastes, then the pool, follow the crew as run modifiers from { kind: client, id }', () => {
    const content = withClient({ tastes: [likesBedrooms, noCloset], pool: [morePatios] });
    const mods = runModifiers(content, {
      setup: setup('mods'),
      blueprints: [{ id: 'quietHours', boughtWeek: 3 }],
    });
    const client = { kind: 'client', id: 'hendersons' } as const;
    expect(mods).toEqual([
      {
        mod: C.crews.generalContractor.modifiers[0],
        source: { kind: 'crew', id: 'generalContractor' },
        since: 0,
      },
      { mod: likesBedrooms, source: client, since: 0 },
      { mod: noCloset, source: client, since: 0 },
      { mod: morePatios, source: client, since: 0 },
      {
        mod: C.blueprints.quietHours.modifiers[0],
        source: { kind: 'blueprint', id: 'quietHours' },
        since: 3,
      },
    ]);
    // Another client of the same content brings none of them.
    const vlad = runModifiers(content, { setup: setup('mods', 'vladislav'), blueprints: [] });
    expect(vlad.map((m) => m.source)).toEqual([{ kind: 'crew', id: 'generalContractor' }]);
    // A client the content doesn't have is an error.
    const martians = { ...setup('mods'), clientId: 'martians' as ClientId };
    expect(() => runModifiers(content, { setup: martians, blueprints: [] })).toThrow(
      'Unknown client "martians"',
    );
  });

  it('an earn taste changes what a piece earns, with a breakdown line named after the client', () => {
    const r = createRules(withClient({ tastes: [likesBedrooms] }));
    const s = runOn(r, BED_AND_CLOSET);
    const [bedroom, closet] = r.currentTally(s).pieces;
    // 3 × 1.5 = 4.5 → 5.
    expect(bedroom).toMatchObject({ uid: 1, points: 3, pct: 50, earned: 5 });
    expect(bedroom!.lines).toContainEqual({
      label: 'The Hendersons',
      op: 'pct',
      value: 50,
      from: [],
    });
    expect(closet).toMatchObject({ uid: 2, pct: 0, earned: 1 });
    // Percentages add: with Quiet Hours (Quiet pieces +50%), the Bedroom earns ×2.
    const quiet: RunState = { ...s, blueprints: [{ id: 'quietHours', boughtWeek: 1 }] };
    expect(r.currentTally(quiet).pieces[0]).toMatchObject({ pct: 100, earned: 6 });
  });

  it('a dislike is a negative earn, rounded half up: 3 × 0.5 = 1.5 → 2', () => {
    const r = createRules(
      withClient({ tastes: [{ kind: 'earn', target: { piece: 'bedroom' }, pct: -50 }] }),
    );
    const bedroom = r.currentTally(runOn(r, BED_AND_CLOSET)).pieces[0]!;
    expect(bedroom).toMatchObject({ points: 3, pct: -50, earned: 2 });
    expect(bedroom.lines).toContainEqual({
      label: 'The Hendersons',
      op: 'pct',
      value: -50,
      from: [],
    });
  });

  it('an earnNothing taste zeroes a piece, which still counts for the checklist', () => {
    const r = createRules(withClient({ specs: [A_CLOSET], tastes: [noCloset] }));
    const t = r.currentTally(runOn(r, BED_AND_CLOSET));
    expect(t.pieces[1]).toMatchObject({ defId: 'closet', earned: 0 });
    expect(t.pieces[1]!.lines).toContainEqual({
      label: 'Earns nothing (The Hendersons)',
      op: 'none',
      value: 0,
      from: [],
    });
    // "Earns nothing" zeroes earnings only: the Closet still meets A Closet. 3 × 1.25 → 4.
    expect(t.specs).toEqual([{ id: 'closet', met: true }]);
    expect(scoreOf(t)).toEqual({ points: 3, mult: 125, total: 4 });
  });

  it('a perCountOver taste (Juniper’s room limit) is labelled with the client and the count', () => {
    const r = createRules(
      withClient({
        tastes: [{ kind: 'perCountOver', match: { property: 'room' }, over: 1, pct: -50 }],
      }),
    );
    const [bedroom, closet] = r.currentTally(runOn(r, BED_AND_CLOSET)).pieces;
    // 2 rooms, 1 over: each earns −50%. 3 × 0.5 = 1.5 → 2, and 1 × 0.5 = 0.5 → 1.
    const line = { label: 'The Hendersons (1 over 1)', op: 'pct', value: -50, from: [] };
    expect(bedroom).toMatchObject({ pct: -50, earned: 2 });
    expect(bedroom!.lines).toContainEqual(line);
    expect(closet).toMatchObject({ pct: -50, earned: 1 });
    expect(closet!.lines).toContainEqual(line);
  });

  it('budget and rule tastes reach the run: its budget, its starting numbers, and rule()', () => {
    const r = createRules(
      withClient({
        tastes: [
          { kind: 'budget', target: 'all', pct: 100 },
          { kind: 'rule', key: 'demolitions', add: 1 },
          { kind: 'rule', key: 'earlyRewardPct', add: 100 },
        ],
      }),
    );
    // A Home Office pays 1 budget every 2nd week: in week 2 it pays, doubled.
    const office = { ...runOn(r, [['homeOffice', 0, 4]]), week: 2 };
    expect(r.currentTally(office).budget).toBe(2);
    // newRun reads the client's rules too: 2 + 1 demolitions.
    const s = r.newRun(setup('tastes'));
    expect(s.demolitionsLeft).toBe(3);
    expect(r.rule(s, 'earlyRewardPct')).toBe(200);
    // Another client starts with the base numbers.
    const vlad = r.newRun(setup('tastes', 'vladislav'));
    expect(vlad.demolitionsLeft).toBe(2);
    expect(r.rule(vlad, 'earlyRewardPct')).toBe(100);
    expect(r.currentTally({ ...office, setup: vlad.setup }).budget).toBe(1);
  });

  it('a drawWeight pool modifier changes the draw weights, for that client only', () => {
    const content = withClient({
      pool: [
        { kind: 'drawWeight', target: { piece: 'kitchen' }, pct: 100 },
        { kind: 'drawWeight', target: { piece: 'closet' }, add: 5 },
      ],
    });
    const weights = (clientId: ClientId) => {
      const mods = runModifiers(content, { setup: setup('pool', clientId), blueprints: [] });
      const list = drawWeights(content, 0, { mods: mods.map((m) => m.mod) });
      return new Map(list.map((w) => [w.card.id, w.weight]));
    };
    // In hundredths: the draw weight × 100% (complexity 1 at phase 0).
    const hendersons = weights('hendersons');
    // Kitchens +100%: 10 → 20, and the L-Kitchen is a Kitchen too.
    expect(hendersons.get('kitchen')).toBe(2000);
    expect(hendersons.get('lKitchen')).toBe(2000);
    // Closets +5: 10 → 15.
    expect(hendersons.get('closet')).toBe(1500);
    expect(hendersons.get('bedroom')).toBe(1000);
    // Vladislav's are the plain weights.
    const vlad = weights('vladislav');
    expect([vlad.get('kitchen'), vlad.get('lKitchen'), vlad.get('closet')]).toEqual([
      1000, 1000, 1000,
    ]);
  });

  it('the run’s hands are drawn with the client’s pool', () => {
    // A pool that takes the Bedroom out of the Hendersons' draws.
    const r = createRules(
      withClient({ pool: [{ kind: 'drawWeight', target: { piece: 'bedroom' }, pct: -100 }] }),
    );
    const seeds = Array.from({ length: 30 }, (_, k) => `pool-${k}`);
    const withBedroom = (clientId: ClientId) =>
      seeds.filter((seed) => r.newRun(setup(seed, clientId)).hand.some((c) => c.id === 'bedroom'))
        .length;
    expect(withBedroom('hendersons')).toBe(0);
    expect(withBedroom('vladislav')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------
// targetPct.

describe('targetPct', () => {
  const rulesAt = (targetPct: number) => createRules(withClient({ targetPct }));

  it('the target is the curve’s × targetPct / 100, rounded half up', () => {
    // TEST_BALANCE's curve: 5, then 30.
    const cases: [targetPct: number, phase: number, target: number][] = [
      [100, 0, 5],
      [100, 1, 30],
      [150, 0, 8], // 7.5
      [130, 0, 7], // 6.5
      [110, 0, 6], // 5.5
      [90, 0, 5], // 4.5
      [70, 0, 4], // 3.5
      [149, 0, 7], // 7.45
      [151, 0, 8], // 7.55
      [0, 0, 0],
      [115, 1, 35], // 34.5
      [105, 1, 32], // 31.5
      [101, 1, 30], // 30.3
      [250, 1, 75],
    ];
    for (const [targetPct, phase, target] of cases) {
      const r = rulesAt(targetPct);
      const s = { ...r.newRun(setup('target')), phase };
      expect([targetPct, phase, r.target(s)]).toEqual([targetPct, phase, target]);
    }
  });

  it('pace uses the client’s target', () => {
    const r = rulesAt(130);
    const s = r.newRun(setup('pace'));
    // 5 × 130% = 6.5 → 7, over 2 weeks: 3.5 a week.
    expect(r.pace(s)).toBe(3.5);
    // From a phase start of 3: (7 − 3) / 2 = 2.
    expect(r.pace({ ...s, phaseStartScore: 3 })).toBe(2);
    // The tally event carries the same pace.
    expect(eventsOf(r.apply(s, PASS).events, 'tally')[0]!.pace).toBe(3.5);
  });

  it('the verdict uses the client’s last target', () => {
    // The curve's last target is 30; at 150%, 45. Dream Home is 200% of it, Starter Home 100%.
    const r = rulesAt(150);
    const won: RunState = { ...r.newRun(setup('verdict')), screen: 'won' };
    expect(r.verdict({ ...won, score: 90 })).toBe('Dream Home');
    expect(r.verdict({ ...won, score: 89 })).toBe('Starter Home');
    expect(r.verdict({ ...won, score: 45 })).toBe('Starter Home');
    expect(r.verdict({ ...won, score: 44 })).toBe('Fixer-Upper');
    // On the curve, 60 is already 200% of 30.
    expect(createRules(C).verdict({ ...won, score: 60 })).toBe('Dream Home');
    // A lost run is the lowest verdict, whatever the score.
    expect(r.verdict({ ...won, screen: 'lost', score: 500 })).toBe('Fixer-Upper');
  });

  it('the next verdict is the band above, at the score where it starts (D-139)', () => {
    // At 150% the last target is 45: Starter Home from 45, Dream Home from 90.
    const r = rulesAt(150);
    const won: RunState = { ...r.newRun(setup('verdict')), screen: 'won' };
    expect(r.nextVerdict({ ...won, score: 45 })).toEqual({ name: 'Dream Home', score: 90 });
    expect(r.nextVerdict({ ...won, score: 89 })).toEqual({ name: 'Dream Home', score: 90 });
    // At the top there's nothing above, and a lost run has no next verdict.
    expect(r.nextVerdict({ ...won, score: 90 })).toBeNull();
    expect(r.nextVerdict({ ...won, screen: 'lost', score: 10 })).toBeNull();
    // Each verdict's first score earns it: the two never disagree.
    for (let score = 40; score <= 95; score++) {
      const next = r.nextVerdict({ ...won, score });
      if (next) expect(r.verdict({ ...won, score: next.score })).toBe(next.name);
    }
  });

  it('a milestone resolves against the client’s target: a score past the curve’s can miss', () => {
    // 5 × 200% = 10. A Bedroom earns 3 a week.
    const r = rulesAt(200);
    const w1 = r.apply(runOn(r, [['bedroom', 0, 4]]), PASS);
    // 6 is past the curve's 5, but short of 10: it can't complete early.
    expect(r.canCompleteEarly({ ...w1.state, score: 6 })).toMatchObject({
      ok: false,
      reason: 'Reach the target first.',
    });
    const end = r.apply(w1.state, PASS);
    expect(end.state.score).toBe(6);
    expect(eventsOf(end.events, 'milestone')).toEqual([]);
    expect(eventsOf(end.events, 'overtimeUsed')).toEqual([
      { t: 'overtimeUsed', phase: 0, overtimeLeft: 1, target: 10, score: 6 },
    ]);
  });

  it('a milestone resolves against the client’s target: a score short of the curve’s can meet it', () => {
    // 5 × 50% = 2.5 → 3.
    const r = rulesAt(50);
    const w1 = r.apply(runOn(r, [['bedroom', 0, 4]]), PASS);
    expect(eventsOf(w1.events, 'targetReached')).toEqual([
      { t: 'targetReached', phase: 0, target: 3, score: 3 },
    ]);
    expect(r.canCompleteEarly(w1.state).ok).toBe(true);
    const w2 = r.apply(w1.state, PASS);
    expect(eventsOf(w2.events, 'milestone')[0]).toMatchObject({
      phase: 0,
      result: 'onTime',
      target: 3,
      score: 6,
    });
    expect(w2.state.milestones[0]!.target).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------
// The setup, replays, and run codes.

describe('run setup', () => {
  const r = createRules(C);

  it('newRun keeps the clientId in state.setup, and drops fields it doesn’t know', () => {
    const s = r.newRun({ ...setup('setup', 'juniper'), extra: true } as RunSetup);
    expect(s.setup).toEqual({
      seed: 'setup',
      clientId: 'juniper',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    expect(Object.keys(s.setup)).toEqual(['seed', 'clientId', 'crewId', 'mode']);
  });

  it('an unknown or missing clientId throws “Bad run setup”', () => {
    const bad = (clientId: unknown) => () =>
      r.newRun({ ...setup('bad'), clientId } as unknown as RunSetup);
    expect(bad('martians')).toThrow('Bad run setup');
    expect(bad(undefined)).toThrow('Bad run setup');
    expect(bad(7)).toThrow('Bad run setup');
    // Names every object inherits aren't clients.
    expect(bad('toString')).toThrow('Bad run setup');
    expect(bad('__proto__')).toThrow('Bad run setup');
  });

  it('replay() of a setup with an unknown client fails softly at step 0, with the default client', () => {
    const result = r.replay({ ...setup('replay'), clientId: 'martians' as ClientId }, [PASS]);
    expect(result.failedAt).toBe(0);
    expect(result.error).toMatch(/Bad run setup/);
    // The first client in the content, from the same seed, with nothing replayed.
    expect(result.state.setup).toEqual(setup('replay', 'hendersons'));
    expect(result.state).toEqual(r.newRun(setup('replay')));
  });

  it('replay() of a known client replays its actions', () => {
    const result = r.replay(setup('replay', 'barkers'), [PASS]);
    expect(result.failedAt).toBeUndefined();
    expect(result.state).toEqual(r.apply(r.newRun(setup('replay', 'barkers')), PASS).state);
    expect(result.state.setup.clientId).toBe('barkers');
  });
});

describe('run codes', () => {
  const data: RunCodeData = {
    build: 'abc1234',
    contentHash: contentHash(C),
    setup: setup('code', 'vladislav'),
    actions: [PASS],
  };
  const MISSING = { ok: false, error: 'That run code is missing its setup.' };

  it('round-trip the clientId', () => {
    expect(decodeRunCode(encodeRunCode(data))).toEqual({ ok: true, data });
  });

  it('drop setup fields this build doesn’t know', () => {
    const code = encodeRunCode({ ...data, setup: { ...data.setup, cheat: 'yes' } as RunSetup });
    const decoded = decodeRunCode(code);
    expect(decoded).toEqual({ ok: true, data });
    if (decoded.ok) expect(Object.keys(decoded.data.setup)).toEqual(Object.keys(data.setup));
  });

  it('reject a setup without a clientId, or with one that isn’t a string', () => {
    for (const clientId of [undefined, 5, null, true, { id: 'hendersons' }, ['hendersons']]) {
      const bad = { ...data.setup, clientId } as unknown as RunSetup;
      expect([clientId, decodeRunCode(encodeRunCode({ ...data, setup: bad }))]).toEqual([
        clientId,
        MISSING,
      ]);
    }
  });

  it('accept a client this build doesn’t have, for the replay to report', () => {
    const setupX = { ...data.setup, clientId: 'martians' as ClientId };
    const decoded = decodeRunCode(encodeRunCode({ ...data, setup: setupX }));
    expect(decoded).toEqual({ ok: true, data: { ...data, setup: setupX } });
    if (!decoded.ok) return;
    const replayed = createRules(C).replay(decoded.data.setup, decoded.data.actions);
    expect(replayed).toMatchObject({ failedAt: 0, error: expect.stringMatching(/Bad run setup/) });
  });

  it('spot a change to a client in the content hash', () => {
    expect(contentHash(withClient({ specs: [A_CLOSET] }))).not.toBe(contentHash(C));
    expect(contentHash(withClient({ targetPct: 110 }))).not.toBe(contentHash(C));
  });

  it('round-trip a pending Renovation, with only its own fields', () => {
    const pending: RenovateAction = { t: 'renovate', from: 'reserve', i: 1, uid: 7 };
    expect(decodeRunCode(encodeRunCode({ ...data, pending }))).toEqual({
      ok: true,
      data: { ...data, pending },
    });
    const extra = { ...pending, level: 3, x: 0 } as RenovateAction;
    expect(decodeRunCode(encodeRunCode({ ...data, pending: extra }))).toEqual({
      ok: true,
      data: { ...data, pending },
    });
  });

  it('report a damaged pending Renovation', () => {
    const pending = { t: 'renovate', from: 'hand', i: 0, uid: 1 };
    const damaged = [
      { ...pending, from: 'supplies' },
      { ...pending, uid: 1.5 },
      { ...pending, i: '0' },
      { t: 'renovate', from: 'hand', i: 0 },
    ];
    for (const bad of damaged) {
      const code = encodeRunCode({ ...data, pending: bad as unknown as RenovateAction });
      expect(decodeRunCode(code)).toEqual({
        ok: false,
        error: 'That run code has a damaged pending placement.',
      });
    }
  });

  it('round-trip a Renovation in the action log; a damaged one is an action it doesn’t know', () => {
    const renovate: RenovateAction = { t: 'renovate', from: 'hand', i: 2, uid: 4 };
    expect(decodeRunCode(encodeRunCode({ ...data, actions: [renovate, PASS] }))).toEqual({
      ok: true,
      data: { ...data, actions: [renovate, PASS] },
    });
    const dirty = { ...renovate, x: 3 } as RenovateAction;
    expect(decodeRunCode(encodeRunCode({ ...data, actions: [dirty] }))).toEqual({
      ok: true,
      data: { ...data, actions: [renovate] },
    });
    const bad = { ...renovate, from: 'supplies' } as unknown as RenovateAction;
    expect(decodeRunCode(encodeRunCode({ ...data, actions: [bad] }))).toEqual({
      ok: false,
      error: 'That run code has an action this build doesn’t know.',
    });
  });

  it('replay to a state where a pending Renovation previews, end to end', () => {
    // One Kitchen is the Kitchen's limit, so a second Kitchen card renovates the first.
    const content = withClient({ specs: [ONE_KITCHEN] });
    const r = createRules(content);
    const start = setup('renovate-code', 'hendersons');
    const give: Action = { t: 'debug', op: 'giveCard', id: 'kitchen' };
    let s = r.apply(r.newRun(start), give).state;
    const spot = r.legalPlacements(s).find((p) => p.from === 'hand' && p.i === s.hand.length - 1);
    if (!spot) throw new Error('no spot for the Kitchen');
    s = r.apply(s, spot).state;
    s = r.apply(s, give).state;
    const pending: RenovateAction = { t: 'renovate', from: 'hand', i: s.hand.length - 1, uid: 1 };
    expect(r.renovateTargets(s, 'hand', pending.i)).toEqual([1]);
    const code = encodeRunCode({
      build: 'abc1234',
      contentHash: contentHash(content),
      setup: start,
      actions: [give, spot, give],
      pending,
    });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.pending).toEqual(pending);
    const replayed = r.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(s);
    expect(r.preview(replayed.state, decoded.data.pending!)).toMatchObject({
      legal: true,
      renovates: { uid: 1, level: 1 },
    });
  });
});
