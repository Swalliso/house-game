// Every Modifier kind and every RuleKey (implementation-plan.md §5, "Sets, rewards, modifiers";
// §4, Scoring pipeline and Layout rules; Appendix A · M3a; Appendix B, Fixtures and Blueprints).
// Tally kinds run through tallyHouse() with a TallyContext built from blueprints; layout kinds
// through computeLayout(); a few run through a real run so the run's own context (the last
// week, early milestones, purchase weeks) is covered too. Rules tests use TEST_CONTENT, whose
// fixtures and blueprints are Appendix B's first encodings (the game's blueprints were
// re-weighed in D-143). Every piece houseFrom places has placedWeek 1, so tallying in week w
// means age w − 1.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  BlueprintId,
  Content,
  FixtureId,
  GameEvent,
  HouseState,
  Modifier,
  PieceScore,
  RuleKey,
  RunState,
  Tally,
} from './index.ts';
import { CONTENT } from '../content/index.ts';
import { drawHand, drawWeights } from './draw.ts';
import { withFixture } from './fixtures.ts';
import { computeLayout, isLayoutModifier, type Layout } from './layout.ts';
import { lotFromRows } from './lot.ts';
import { ruleFrom, runModifiers, sourceName, type ActiveMod } from './modifiers.ts';
import { createRules, type Rules } from './run.ts';
import { roundHalfUp, tallyHouse } from './scoring.ts';
import { blueprintText, lotTraitText, modifierText } from './text.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_BALANCE,
  TEST_CONTENT as C,
  withClient,
  withPieces,
  type Placement,
} from './testing.ts';

// ---------------------------------------------------------------------------------------
// Helpers.

/** A 10 × 10 empty lot. The top 4 rows are sunny; the street runs below row 9. */
const L = emptyRows(10, 10);

/** The lot with Trees at these cells. */
function withTrees(...cells: [x: number, y: number][]): string[] {
  const rows = L.map((r) => r.split(''));
  for (const [x, y] of cells) rows[y]![x] = 'T';
  return rows.map((r) => r.join(''));
}

/** The blueprint slot that withBlueprint rewrites, for modifiers no real blueprint has. */
const TEST_PLAN: BlueprintId = 'fengShui';

/** Content where one blueprint (Feng Shui's slot by default) carries these modifiers. */
function withBlueprint(
  mods: readonly Modifier[],
  name = 'Test Plan',
  base: Content = C,
  id: BlueprintId = TEST_PLAN,
): Content {
  return {
    ...base,
    blueprints: { ...base.blueprints, [id]: { ...base.blueprints[id], name, modifiers: mods } },
  };
}

/** Installs fixtures (in week 1) into placed pieces, unchecked. */
function installed(house: HouseState, ...fixtures: [uid: number, id: FixtureId][]): HouseState {
  return fixtures.reduce((h, [uid, id]) => withFixture(h, uid, id, 1), house);
}

/** Sets some pieces' placement weeks, by uid. */
function placedIn(house: HouseState, weeks: Record<number, number>): HouseState {
  return {
    ...house,
    pieces: house.pieces.map((p) =>
      weeks[p.uid] === undefined ? p : { ...p, placedWeek: weeks[p.uid]! },
    ),
  };
}

/** The run's modifiers (the crew's, then these blueprints'), as runModifiers() builds them. */
function modsFor(content: Content, ids: readonly BlueprintId[], since = 1): ActiveMod[] {
  return runModifiers(content, {
    setup: setup('mods'),
    blueprints: ids.map((id) => ({ id, boughtWeek: since })),
  });
}

/** The layout under the run's layout modifiers (fixtures' come from the house itself). */
function layoutOf(content: Content, house: HouseState, mods: readonly ActiveMod[] = []): Layout {
  return computeLayout(content, house, mods.map((m) => m.mod).filter(isLayoutModifier));
}

interface TallyOpts {
  blueprints?: readonly BlueprintId[];
  /** The week the blueprints were bought (1 by default). */
  since?: number;
  week?: number;
  lastWeek?: boolean;
  milestonesEarly?: number;
}

function tally(content: Content, house: HouseState, o: TallyOpts = {}): Tally {
  const mods = modsFor(content, o.blueprints ?? [], o.since);
  return tallyHouse(content, layoutOf(content, house, mods), o.week ?? 1, true, {
    mods,
    setLevels: {},
    lastWeek: o.lastWeek ?? false,
    stats: { milestonesEarly: o.milestonesEarly ?? 0 },
    specs: [],
    phase: 0,
  });
}

function scoreOf(t: Tally, uid: number): PieceScore {
  const s = t.pieces.find((p) => p.uid === uid);
  if (!s) throw new Error(`no piece ${uid} in the tally`);
  return s;
}
const earned = (t: Tally, uid: number) => scoreOf(t, uid).earned;
const sorted = (tags: Iterable<string> | undefined) => [...(tags ?? [])].sort();

/** Two touching Bedrooms: 3 + 1 (a Quiet neighbor) each, so 8 Points a week. */
const TWO_BEDROOMS: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
];

/**
 * An Entertainer in a row: Kitchen (uid 1), Dining Room (uid 2), Living Room (uid 3). The
 * Kitchen earns 2 (the Dining Room) × 1.5 (its aura) = 3, the others 0; the set adds 25 Points
 * and +1 Mult.
 */
const ENT: Placement[] = [
  ['kitchen', 0, 0],
  ['diningRoom', 2, 0],
  ['livingRoom', 4, 0],
];

const rules = createRules(C);

/** A run on the empty lot with these pieces (placed in week 1). */
function runOn(r: Rules, placements: readonly Placement[], seed = 'mods'): RunState {
  const s = r.newRun(setup(seed));
  return { ...s, house: houseFrom(r.content, L, placements) };
}

const PASS: Action = { t: 'pass' };
const LEAVE: Action = { t: 'leaveShop' };

function applyAll(r: Rules, s: RunState, actions: readonly Action[]) {
  const events: GameEvent[] = [];
  for (const a of actions) {
    const out = r.apply(s, a);
    s = out.state;
    events.push(...out.events);
  }
  return { state: s, events };
}

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

// ---------------------------------------------------------------------------------------
// earn

describe('earn', () => {
  it('adds its pct to every matching piece, with a breakdown line named after its source', () => {
    const house = houseFrom(C, L, [
      ['bedroom', 0, 0],
      ['closet', 5, 5],
    ]);
    const t = tally(C, house, { blueprints: ['quietHours'] });
    // Quiet Hours: Quiet pieces +50%. The Bedroom: 3 × 1.5 = 4.5 → 5.
    expect(scoreOf(t, 1)).toMatchObject({ points: 3, pct: 50, earned: 5 });
    expect(scoreOf(t, 1).lines).toContainEqual({
      label: 'Quiet Hours',
      op: 'pct',
      value: 50,
      from: [],
    });
    // The Closet has no tags.
    expect(scoreOf(t, 2)).toMatchObject({ pct: 0, earned: 1 });
  });

  it('percentages add: Quiet Hours and a Fireplace make ×2, and a Fireplace in a Living Room is +100%', () => {
    const house = installed(
      houseFrom(C, withTrees([2, 0]), [
        ['livingRoom', 0, 0],
        ['bedroom', 6, 0],
      ]),
      [1, 'fireplace'],
      [2, 'fireplace'],
    );
    const t = tally(C, house, { blueprints: ['quietHours'] });
    // Living Room: 2 (one Tree, a view source); the Fireplace's +50 twice (host, and host in a
    // Living Room or Library): 2 × 2 = 4. Its second line says what it's for, so the two can be
    // told apart.
    expect(scoreOf(t, 1)).toMatchObject({ points: 2, pct: 100, earned: 4 });
    expect(
      scoreOf(t, 1)
        .lines.filter((l) => l.label.startsWith('Fireplace'))
        .map((l) => [l.label, l.value]),
    ).toEqual([
      ['Fireplace', 50],
      ['Fireplace (in a Living Room or Library)', 50],
    ]);
    // Bedroom: 3 × (100 + 50 + 50)% = 6, not 3 × 1.5 × 1.5. One Fireplace line: its plain name.
    expect(scoreOf(t, 2)).toMatchObject({ points: 3, pct: 100, earned: 6 });
    expect(scoreOf(t, 2).lines.filter((l) => l.label.startsWith('Fireplace'))).toEqual([
      { label: 'Fireplace', op: 'pct', value: 50, from: [] },
    ]);
  });

  it('a source with several earn modifiers says which each line is: "Count Vladislav (Dark pieces)"', () => {
    // Count Vladislav's two tastes, on the test client: Dark pieces +100%, and pieces touching a
    // Tree +50% (shade). Below the sunny side, Bedroom 2 touches the Tree at (4, 5).
    const client = withClient({
      tastes: [
        { kind: 'earn', target: { tag: 'Dark' }, pct: 100 },
        { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 50 },
      ],
    });
    const house = houseFrom(client, withTrees([4, 5]), [
      ['bedroom', 0, 5],
      ['bedroom', 2, 5],
    ]);
    const pctLines = (t: Tally, uid: number) =>
      scoreOf(t, uid)
        .lines.filter((l) => l.op === 'pct')
        .map((l) => [l.label, l.value]);
    // Both are exterior, so not Dark: the shade line alone, still saying which taste it is.
    expect(pctLines(tally(client, house), 2)).toEqual([['The Hendersons (touching a Tree)', 50]]);
    expect(pctLines(tally(client, house), 1)).toEqual([]);
    // Every room Dark (Eternal night's grant, on a blueprint here): two lines from one source,
    // which can be told apart. The blueprint's one modifier isn't an earn, and a source with one
    // earn modifier keeps its plain name (Quiet Hours).
    const night = withBlueprint(
      [{ kind: 'grantTag', target: { property: 'room' }, tag: 'Dark' }],
      'Night',
      client,
    );
    const dark = tally(night, house, { blueprints: [TEST_PLAN, 'quietHours'] });
    expect(pctLines(dark, 2)).toEqual([
      ['The Hendersons (Dark pieces)', 100],
      ['The Hendersons (touching a Tree)', 50],
      ['Quiet Hours', 50],
    ]);
    expect(pctLines(dark, 1)).toEqual([
      ['The Hendersons (Dark pieces)', 100],
      ['Quiet Hours', 50],
    ]);
  });

  it("a fixture's earn applies to its host only", () => {
    const house = installed(houseFrom(C, L, TWO_BEDROOMS), [1, 'fireplace']);
    const t = tally(C, house);
    // 4 × 1.5 = 6 in the host; the Bedroom next door keeps its 4.
    expect(earned(t, 1)).toBe(6);
    expect(earned(t, 2)).toBe(4);
  });

  it('with when lastWeekOfPhase, it counts only when the tally is a played last week', () => {
    const c = withBlueprint([{ kind: 'earn', target: 'all', pct: 100, when: 'lastWeekOfPhase' }]);
    const house = houseFrom(c, L, [['bedroom', 0, 0]]);
    expect(earned(tally(c, house, { blueprints: [TEST_PLAN] }), 1)).toBe(3);
    const last = tally(c, house, { blueprints: [TEST_PLAN], lastWeek: true });
    expect(earned(last, 1)).toBe(6);
    expect(scoreOf(last, 1).lines).toContainEqual({
      label: 'Test Plan',
      op: 'pct',
      value: 100,
      from: [],
    });
  });
});

// ---------------------------------------------------------------------------------------
// bestPiece

describe('bestPiece (Crown Jewel)', () => {
  it("raises the week's top earner after every other term", () => {
    const house = installed(
      houseFrom(C, L, [
        ['bedroom', 0, 0],
        ['bedroom', 5, 0],
      ]),
      [1, 'fireplace'],
    );
    const t = tally(C, house, { blueprints: ['crownJewel'] });
    // The Fireplace's Bedroom: 3 × 1.5 = 4.5 → 5, then +100% → 10 (not 3 × 2.5 = 7.5 → 8).
    expect(t.best).toEqual({ uid: 1, pct: 100, before: 5, after: 10 });
    expect(earned(t, 1)).toBe(10);
    expect(earned(t, 2)).toBe(3);
    expect(t.points).toBe(13);
    expect(scoreOf(t, 1).lines).toContainEqual({
      label: 'Crown Jewel: top earner',
      op: 'pct',
      value: 100,
      from: [],
    });
  });

  it('ties go to the earliest-placed piece, wherever it sits', () => {
    const house = houseFrom(C, L, [
      ['bedroom', 5, 0],
      ['bedroom', 0, 0],
    ]);
    const t = tally(C, house, { blueprints: ['crownJewel'] });
    expect(t.best).toEqual({ uid: 1, pct: 100, before: 3, after: 6 });
    expect(earned(t, 2)).toBe(3);
  });

  it('a piece that earned nothing is never chosen', () => {
    // A lone Kitchen earns 0 (no Dining Room).
    const t = tally(C, houseFrom(C, L, [['kitchen', 0, 0]]), { blueprints: ['crownJewel'] });
    expect(t.best).toBeNull();
    expect(t.points).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// mult

describe('mult', () => {
  it("It's a House adds +0.15 Mult per House piece, as one multTerm", () => {
    const house = houseFrom(C, L, [
      ...TWO_BEDROOMS,
      ['birdhouse', 6, 6],
      ['birdhouse', 8, 6],
      ['henhouse', 6, 8],
    ]);
    const t = tally(C, house, { blueprints: ['itsAHouse'] });
    expect(t.multTerms).toEqual([
      { source: { kind: 'blueprint', id: 'itsAHouse' }, label: 'It’s a House (3)', add: 45 },
    ]);
    // Mult 100 + 45; total 8 × 1.45 = 11.6 → 12.
    expect(t.mult).toBe(145);
    expect(t.points).toBe(8);
    expect(t.total).toBe(12);
  });

  it('a mult without per adds once; a per that matches nothing adds no term', () => {
    const c = withBlueprint([{ kind: 'mult', add: 20 }]);
    const t = tally(c, houseFrom(c, L, TWO_BEDROOMS), { blueprints: [TEST_PLAN, 'itsAHouse'] });
    expect(t.multTerms).toEqual([
      { source: { kind: 'blueprint', id: TEST_PLAN }, label: 'Test Plan', add: 20 },
    ]);
    // 8 × 1.2 = 9.6 → 10.
    expect(t.mult).toBe(120);
    expect(t.total).toBe(10);
  });

  it('with maxEach, no more than that many pieces of one type count (D-143)', () => {
    const mod: Modifier = { kind: 'mult', add: 50, per: { tag: 'House' }, maxEach: 2 };
    const c = withBlueprint([mod]);
    const birdhouses: Placement[] = [
      ['birdhouse', 6, 6],
      ['birdhouse', 8, 6],
      ['birdhouse', 6, 4],
    ];
    const of = (placements: readonly Placement[]) =>
      tally(c, houseFrom(c, L, [...TWO_BEDROOMS, ...placements]), { blueprints: [TEST_PLAN] });
    // The third Birdhouse adds nothing; a Henhouse is another type, so it counts.
    expect(of(birdhouses.slice(0, 2)).multTerms).toMatchObject([
      { label: 'Test Plan (2)', add: 100 },
    ]);
    expect(of(birdhouses).multTerms).toMatchObject([{ label: 'Test Plan (2)', add: 100 }]);
    const t = of([...birdhouses, ['henhouse', 6, 8]]);
    expect(t.multTerms).toMatchObject([{ label: 'Test Plan (3)', add: 150 }]);
    // 8 × (1 + 3 × 0.5) = 20.
    expect(t).toMatchObject({ points: 8, mult: 250, total: 20 });
    expect(modifierText(c, mod)).toBe('+0.5 Charm per House piece, up to 2 of a type');
  });

  it('maxEach counts by root type: an L-Kitchen is a Kitchen', () => {
    const c = withBlueprint([{ kind: 'mult', add: 10, per: { tag: 'Social' }, maxEach: 1 }]);
    const house = houseFrom(c, L, [
      ['kitchen', 0, 0],
      ['lKitchen', 4, 0],
      ['diningRoom', 0, 4],
    ]);
    expect(tally(c, house, { blueprints: [TEST_PLAN] }).multTerms).toMatchObject([
      { label: 'Test Plan (2)', add: 20 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// xMult

describe('xMult', () => {
  it('Last-Minute Push doubles Mult in a last week only', () => {
    const house = houseFrom(C, L, TWO_BEDROOMS);
    const last = tally(C, house, { blueprints: ['lastMinutePush'], lastWeek: true });
    expect(last.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'lastMinutePush' },
        label: 'Last-Minute Push',
        times: 200,
        before: 100,
        after: 200,
      },
    ]);
    expect(last.total).toBe(16);
    const other = tally(C, house, { blueprints: ['lastMinutePush'] });
    expect(other.xMults).toEqual([]);
    expect(other.mult).toBe(100);
    expect(other.total).toBe(8);
  });

  it('Model Home: ×(1 + 0.1 per piece with a fixture); with none it never lands', () => {
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['bedroom', 5, 0],
      ['closet', 8, 8],
    ];
    const house = installed(houseFrom(C, L, placements), [1, 'fireplace'], [2, 'soundproofing']);
    const t = tally(C, house, { blueprints: ['modelHome'] });
    // Two pieces have a fixture: 100 + 2 × 10 = 120.
    expect(t.xMults).toEqual([
      {
        source: { kind: 'blueprint', id: 'modelHome' },
        label: 'Model Home',
        times: 120,
        before: 100,
        after: 120,
      },
    ]);
    // Points 5 (3 × 1.5) + 3 + 1 = 9; 9 × 1.2 = 10.8 → 11.
    expect(t.points).toBe(9);
    expect(t.total).toBe(11);
    // ×1 is skipped, so no Sparkle lands.
    const bare = tally(C, houseFrom(C, L, placements), { blueprints: ['modelHome'] });
    expect(bare.xMults).toEqual([]);
    expect(bare.mult).toBe(100);
  });

  it('Ahead of Schedule: ×(1 + 0.2 per milestone completed early)', () => {
    const house = houseFrom(C, L, TWO_BEDROOMS);
    const t = tally(C, house, { blueprints: ['aheadOfSchedule'], milestonesEarly: 3 });
    expect(t.xMults.map((x) => [x.times, x.before, x.after])).toEqual([[160, 100, 160]]);
    // 8 × 1.6 = 12.8 → 13.
    expect(t.total).toBe(13);
    expect(tally(C, house, { blueprints: ['aheadOfSchedule'] }).xMults).toEqual([]);
  });

  it('the Chandelier is ×1.25 while its room is part of an Entertainer', () => {
    const t = tally(C, installed(houseFrom(C, L, ENT), [2, 'chandelier']));
    expect(t.sets.map((s) => s.set)).toEqual(['entertainer']);
    // Mult 100 + 100 (the set) = 200, then ×1.25 = 250. Points 3 + 25; 28 × 2.5 = 70.
    expect(t.xMults).toEqual([
      {
        source: { kind: 'fixture', id: 'chandelier', uid: 2 },
        label: 'Chandelier',
        times: 125,
        before: 200,
        after: 250,
      },
    ]);
    expect(t.total).toBe(70);
    // Without the Living Room there's no set, so no ×Mult.
    const noSet = tally(C, installed(houseFrom(C, L, ENT.slice(0, 2)), [2, 'chandelier']));
    expect(noSet.sets).toEqual([]);
    expect(noSet.xMults).toEqual([]);
  });

  it('two Chandeliers are one source, and any one host in an Entertainer is enough', () => {
    // A lone Dining Room first (uid 1, in no set), then the Entertainer (uids 2–4).
    const house = installed(
      houseFrom(C, L, [['diningRoom', 7, 6], ...ENT]),
      [1, 'chandelier'],
      [3, 'chandelier'],
    );
    const t = tally(C, house);
    expect(t.sets.map((s) => s.members)).toEqual([[2, 3, 4]]);
    expect(t.xMults.map((x) => [x.label, x.times, x.before, x.after])).toEqual([
      ['Chandelier', 125, 200, 250],
    ]);
    expect(t.mult).toBe(250);
  });

  it('distinct sources multiply once each, fixtures before blueprints, rounding at every step', () => {
    const house = installed(houseFrom(C, L, [...ENT, ['birdhouse', 8, 8]]), [2, 'chandelier']);
    // Blueprint modifiers come first in the run's list, but fixtures multiply first.
    const t = tally(C, house, { blueprints: ['aheadOfSchedule', 'itsAHouse'], milestonesEarly: 2 });
    // Mult 100 + 100 (Entertainer) + 15 (one House piece) = 215.
    // Chandelier: 215 × 1.25 = 268.75 → 269. Ahead of Schedule (2 early): 269 × 1.4 = 376.6 → 377.
    // (Blueprint first would give 215 × 1.4 = 301, × 1.25 = 376.25 → 376.)
    expect(t.xMults.map((x) => [x.source.kind, x.times, x.before, x.after])).toEqual([
      ['fixture', 125, 215, 269],
      ['blueprint', 140, 269, 377],
    ]);
    expect(t.mult).toBe(377);
    // 28 × 3.77 = 105.56 → 106.
    expect(t.total).toBe(106);
  });

  it('two blueprint sources multiply in the order they were bought', () => {
    const house = houseFrom(C, L, TWO_BEDROOMS);
    const t = tally(C, house, {
      blueprints: ['aheadOfSchedule', 'lastMinutePush'],
      milestonesEarly: 1,
      lastWeek: true,
    });
    // 100 × 1.2 = 120, then × 2 = 240; 8 × 2.4 = 19.2 → 19.
    expect(t.xMults.map((x) => [x.label, x.before, x.after])).toEqual([
      ['Ahead of Schedule', 100, 120],
      ['Last-Minute Push', 120, 240],
    ]);
    expect(t.total).toBe(19);
  });
});

// ---------------------------------------------------------------------------------------
// earnNothing

describe('earnNothing', () => {
  it("zeroes matching pieces' earnings, but they still count for sets", () => {
    const c = withBlueprint([{ kind: 'earnNothing', target: { piece: 'kitchen' } }]);
    const house = houseFrom(c, L, ENT);
    const t = tally(c, house, { blueprints: [TEST_PLAN] });
    expect(scoreOf(t, 1)).toMatchObject({ points: 2, earned: 0 });
    expect(scoreOf(t, 1).lines).toContainEqual({
      label: 'Earns nothing (Test Plan)',
      op: 'none',
      value: 0,
      from: [],
    });
    expect(t.sets.map((s) => s.set)).toEqual(['entertainer']);
    // Points: the set's 25 only; × 2 = 50 (without it, 28 × 2 = 56).
    expect(t.points).toBe(25);
    expect(t.total).toBe(50);
    expect(tally(c, house).total).toBe(56);
  });

  it("a zeroed piece still counts for It's a House (§4: only its earnings go)", () => {
    const c = withBlueprint([{ kind: 'earnNothing', target: { tag: 'House' } }]);
    // Birdhouses earn +1 per touching Tree: 1 each here, then nothing.
    const house = houseFrom(c, withTrees([1, 6], [4, 6]), [
      ['birdhouse', 0, 6],
      ['birdhouse', 3, 6],
    ]);
    expect(tally(c, house).points).toBe(2);
    const t = tally(c, house, { blueprints: [TEST_PLAN, 'itsAHouse'] });
    expect(t.pieces.map((p) => p.earned)).toEqual([0, 0]);
    expect(t.multTerms.map((m) => m.add)).toEqual([30]);
  });
});

// ---------------------------------------------------------------------------------------
// grantTag and removeTag

/**
 * A Living Room (uid 1), a Kitchen (uid 2), and three Closets in the gap between them (uids
 * 3–5). The middle Closet (uid 4, at 2,5) is walled in: interior, so Dark, and out of the sun.
 */
const INTERIOR: Placement[] = [
  ['livingRoom', 0, 4],
  ['kitchen', 3, 4],
  ['closet', 2, 4],
  ['closet', 2, 5],
  ['closet', 2, 6],
];

describe('grantTag and removeTag', () => {
  it('a Skylight makes its room Sunny and never Dark; Blackout Curtains make a room Dark', () => {
    const base = houseFrom(C, L, INTERIOR);
    expect(sorted(computeLayout(C, base).tags.get(4))).toEqual(['Dark']);
    // The Kitchen's wall faces the sun (D-120).
    expect(sorted(computeLayout(C, base).tags.get(2))).toEqual(['Social', 'Sunny']);
    const layout = computeLayout(C, installed(base, [4, 'skylight'], [2, 'blackoutCurtains']));
    expect(sorted(layout.tags.get(4))).toEqual(['Sunny']);
    expect(sorted(layout.tags.get(2))).toEqual(['Dark', 'Social', 'Sunny']);
    // It changes tags only: the Closet is still interior.
    expect(layout.interior.has(4)).toBe(true);
  });

  it('removeTag wins over grantTag', () => {
    const c = withBlueprint([{ kind: 'grantTag', target: { property: 'room' }, tag: 'Dark' }]);
    const house = installed(
      houseFrom(c, L, [
        ['bedroom', 0, 6],
        ['bedroom', 5, 6],
      ]),
      [1, 'skylight'],
    );
    const layout = layoutOf(c, house, modsFor(c, [TEST_PLAN]));
    expect(sorted(layout.tags.get(1))).toEqual(['Quiet', 'Sunny']);
    expect(sorted(layout.tags.get(2))).toEqual(['Dark', 'Quiet', 'Sunny']);
  });

  it("targets see the tags from before any modifier, so grants don't chain", () => {
    const c = withBlueprint([{ kind: 'grantTag', target: { tag: 'Sunny' }, tag: 'Pretty' }]);
    // uid 1 is in the sun; uid 2 is in two Trees' shade and gets Sunny from a Skylight.
    const house = installed(
      houseFrom(c, withTrees([0, 5], [1, 5]), [
        ['bedroom', 0, 0],
        ['bedroom', 0, 6],
      ]),
      [2, 'skylight'],
    );
    const layout = layoutOf(c, house, modsFor(c, [TEST_PLAN]));
    expect(sorted(layout.tags.get(1))).toEqual(['Pretty', 'Quiet', 'Sunny']);
    expect(sorted(layout.tags.get(2))).toEqual(['Quiet', 'Sunny']);
  });

  it('tally modifiers see the resolved tags: Mood Lighting pays a room made Dark, not one made light', () => {
    // Mood Lighting: Dark rooms +100%.
    const dark = installed(
      houseFrom(C, L, [
        ['bedroom', 0, 0],
        ['bedroom', 5, 0],
      ]),
      [1, 'blackoutCurtains'],
    );
    const t = tally(C, dark, { blueprints: ['moodLighting'] });
    expect(earned(t, 1)).toBe(6);
    expect(earned(t, 2)).toBe(3);
    // The interior Closet: 1 × 2; with a Skylight it's no longer Dark.
    const inner = houseFrom(C, L, INTERIOR);
    expect(earned(tally(C, inner, { blueprints: ['moodLighting'] }), 4)).toBe(2);
    const lit = installed(inner, [4, 'skylight']);
    expect(earned(tally(C, lit, { blueprints: ['moodLighting'] }), 4)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------
// grantView

describe('grantView', () => {
  it('a Bay Window gives its room the view property', () => {
    const house = installed(
      houseFrom(C, L, [
        ['bedroom', 0, 0],
        ['bedroom', 5, 0],
      ]),
      [1, 'bayWindow'],
    );
    const layout = computeLayout(C, house);
    expect(layout.hasView.has(1)).toBe(true);
    expect(layout.hasView.has(2)).toBe(false);
    // Feng Shui: pieces with a view +50%. 3 × 1.5 = 4.5 → 5.
    const t = tally(C, house, { blueprints: ['fengShui'] });
    expect(earned(t, 1)).toBe(5);
    expect(earned(t, 2)).toBe(3);
  });

  it("it counts as one more view for the room's own per-view bonus, up to that bonus's max", () => {
    // Living Room: +2 per view source touched, up to 3.
    const one = houseFrom(C, withTrees([2, 4]), [['livingRoom', 0, 4]]);
    expect(earned(tally(C, one), 1)).toBe(2);
    const withBay = tally(C, installed(one, [1, 'bayWindow']));
    expect(earned(withBay, 1)).toBe(4);
    expect(scoreOf(withBay, 1).lines.some((l) => l.label.includes('view from its window'))).toBe(
      true,
    );
    // Three Trees already reach the max: still 3 × 2.
    const three = houseFrom(C, withTrees([2, 4], [2, 5], [2, 6]), [['livingRoom', 0, 4]]);
    expect(earned(tally(C, three), 1)).toBe(6);
    expect(earned(tally(C, installed(three, [1, 'bayWindow'])), 1)).toBe(6);
  });

  it("the granted view isn't a view source for neighbors; a Pergola's Patio counts its own", () => {
    const house = installed(
      houseFrom(C, L, [
        ['livingRoom', 0, 4],
        ['patio', 2, 4],
      ]),
      [1, 'bayWindow'],
    );
    const t = tally(C, house);
    // Living Room: its window's view, +2. Patio: +2 for the Living Room, nothing for views.
    expect(earned(t, 1)).toBe(2);
    expect(earned(t, 2)).toBe(2);
    // Pergola: the Patio's own view (+1), then +50%: 3 × 1.5 = 4.5 → 5.
    const pergola = tally(C, installed(house, [2, 'pergola']));
    expect(scoreOf(pergola, 2)).toMatchObject({ points: 3, pct: 50, earned: 5 });
    // A yard piece has the view, not a window: the breakdown says so.
    const labels = scoreOf(pergola, 2).lines.map((l) => l.label);
    expect(labels.some((l) => l.includes('the view'))).toBe(true);
    expect(labels.some((l) => l.includes('window'))).toBe(false);
  });

  it("the window's view counts only for per-view bonuses, not as a neighbor of every kind", () => {
    // A Closet earning +1 per neighbor of any kind: alone on the lot it has none, and a Bay
    // Window gives it a view, not a neighbor ("one more view" for viewSource effects only).
    const c = withPieces({ closet: { effects: [{ kind: 'neighbor', match: 'all', amount: 1 }] } });
    const house = houseFrom(c, L, [['closet', 0, 5]]);
    expect(earned(tally(c, house), 1)).toBe(0);
    expect(earned(tally(c, installed(house, [1, 'bayWindow'])), 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// blockPenalties

describe('blockPenalties (Soundproofing)', () => {
  it("drops a Loud neighbor's penalty and the street's on a Bedroom", () => {
    // Bedroom (uid 1) on the street, beside a Garage (Loud).
    const house = houseFrom(C, L, [
      ['bedroom', 0, 8],
      ['garage', 2, 8],
    ]);
    // 3 − 2 (the street) − 2 (the Garage) = −1 → 0.
    const plain = tally(C, house);
    expect(scoreOf(plain, 1)).toMatchObject({ points: -1, earned: 0 });
    const quiet = tally(C, installed(house, [1, 'soundproofing']));
    expect(scoreOf(quiet, 1)).toMatchObject({ points: 3, earned: 3 });
    expect(scoreOf(quiet, 1).lines.filter((l) => l.value < 0)).toEqual([]);
    // The Garage itself is unaffected.
    expect(earned(quiet, 2)).toBe(earned(plain, 2));
  });

  it("blocks a Playroom's −2 aura on a Quiet room", () => {
    // Library (uid 1, Quiet): +2 per Quiet neighbor (the Bedroom below), −2 from the
    // Playroom's aura beside it = 0.
    const house = houseFrom(C, L, [
      ['library', 0, 0],
      ['playroom', 2, 0],
      ['bedroom', 0, 2],
    ]);
    expect(scoreOf(tally(C, house), 1)).toMatchObject({ points: 0, earned: 0 });
    const quiet = tally(C, installed(house, [1, 'soundproofing']));
    expect(scoreOf(quiet, 1)).toMatchObject({ points: 2, earned: 2 });
  });

  it("penalties from neighbors that don't match still apply", () => {
    // Bathroom: +3 for a Bedroom, −2 for a Kitchen (not Loud) = 1, with or without it.
    const house = houseFrom(C, L, [
      ['kitchen', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ]);
    expect(earned(tally(C, house), 2)).toBe(1);
    expect(earned(tally(C, installed(house, [2, 'soundproofing'])), 2)).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------
// countsAs

describe('countsAs', () => {
  it("Kitchen Island: other pieces' Dining Room effects count its Kitchen, which earns +25%", () => {
    // Kitchen A (uid 1) with a Dining Room below it (uid 3); Kitchen B (uid 2) beside A.
    const house = houseFrom(C, L, [
      ['kitchen', 0, 0],
      ['kitchen', 2, 0],
      ['diningRoom', 0, 2],
    ]);
    const plain = tally(C, house);
    // A: 2 (the Dining Room) × 1.5 (its aura) = 3. B touches no Dining Room.
    expect(earned(plain, 1)).toBe(3);
    expect(earned(plain, 2)).toBe(0);
    const island = installed(house, [1, 'kitchenIsland']);
    expect([...computeLayout(C, island).countsAs.get(1)!]).toEqual([['diningRoom', 1]]);
    const t = tally(C, island);
    // A: 2 × (100 + 50 + 25)% = 3.5 → 4. B: +2, since A now counts as a Dining Room.
    expect(scoreOf(t, 1)).toMatchObject({ points: 2, pct: 75, earned: 4 });
    expect(earned(t, 2)).toBe(2);
  });

  it('Bunk Beds count a Bedroom twice, but once for neighbor effects and sets', () => {
    // A Closet that earns +1 per touching Bedroom.
    const c = withPieces({
      closet: { effects: [{ kind: 'neighbor', match: { piece: 'bedroom' }, amount: 1 }] },
    });
    const house = installed(
      houseFrom(c, L, [
        ['bedroom', 0, 0],
        ['closet', 2, 0],
        ['bathroom', 2, 1],
      ]),
      [1, 'bunkBeds'],
    );
    expect(computeLayout(c, house).countsAs.get(1)?.get('bedroom')).toBe(2);
    const t = tally(c, house);
    expect(earned(t, 2)).toBe(1);
    // Jack-and-Jill needs two Bedrooms: one with Bunk Beds is still one. (The Bedroom, Closet,
    // and Bathroom do make a Suite.)
    expect(t.sets.map((s) => s.set)).toEqual(['suite']);
  });
});

// ---------------------------------------------------------------------------------------
// link (Open Concept)

describe('link (Open Concept)', () => {
  // Kitchen (uid 1), Living Room (uid 2), Dining Room (uid 3): the Kitchen and the Dining Room
  // don't touch.
  const CHAIN: Placement[] = [
    ['kitchen', 0, 0],
    ['livingRoom', 2, 0],
    ['diningRoom', 4, 0],
  ];

  it("links a Kitchen–Living Room–Dining Room chain, so the Dining Room's aura reaches the Kitchen", () => {
    const house = houseFrom(C, L, CHAIN);
    expect(computeLayout(C, house).links.get(1)).toBeUndefined();
    expect(earned(tally(C, house), 1)).toBe(0);
    const layout = layoutOf(C, house, modsFor(C, ['openConcept']));
    expect([...layout.links.get(1)!].sort()).toEqual([2, 3]);
    expect(layout.neighbors.get(1)).toContainEqual({ kind: 'piece', uid: 3 });
    // Kitchen: +2 for the linked Dining Room, × 1.5 from its aura = 3.
    const t = tally(C, house, { blueprints: ['openConcept'] });
    expect(scoreOf(t, 1)).toMatchObject({ points: 2, pct: 50, earned: 3 });
  });

  it('only a connected group of those types links: a Bedroom in between breaks it', () => {
    const house = houseFrom(C, L, [
      ['kitchen', 0, 0],
      ['bedroom', 2, 0],
      ['diningRoom', 4, 0],
    ]);
    const layout = layoutOf(C, house, modsFor(C, ['openConcept']));
    expect(layout.links.get(1)?.has(3) ?? false).toBe(false);
    expect(earned(tally(C, house, { blueprints: ['openConcept'] }), 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// grantEffect

describe('grantEffect', () => {
  it('Good Bones: rooms grow 1 a week from the later of placement and purchase, up to 10', () => {
    // uid 1 placed in week 1, uid 2 in week 4, uid 3 a Lawn (not a room); bought in week 3.
    const house = placedIn(
      houseFrom(C, L, [
        ['bedroom', 0, 0],
        ['bedroom', 5, 0],
        ['lawn', 0, 6],
      ]),
      { 2: 4 },
    );
    const wk3 = tally(C, house, { blueprints: ['goodBones'], since: 3, week: 3 });
    // Bought in week 3: uid 1 has grown 1 week, though it was built in week 1.
    expect(earned(wk3, 1)).toBe(4);
    expect(scoreOf(wk3, 1).lines).toContainEqual({
      label: 'Grown for 1 week (Good Bones)',
      op: 'add',
      value: 1,
      from: [],
    });
    const wk5 = tally(C, house, { blueprints: ['goodBones'], since: 3, week: 5 });
    expect(earned(wk5, 1)).toBe(3 + 3); // weeks 3–5
    expect(earned(wk5, 2)).toBe(3 + 2); // weeks 4–5
    expect(earned(wk5, 3)).toBe(1); // the Lawn's own 1
    // The cap: 10 at most.
    expect(earned(tally(C, house, { blueprints: ['goodBones'], week: 20 }), 1)).toBe(3 + 10);
  });

  it('Good Bones in a real run: a room built before the purchase earns 1 in the purchase week', () => {
    // One Bedroom (3 a week) meets the first target (5) in week 2; the shop opens before week 3.
    let s = runOn(rules, [['bedroom', 0, 0]]);
    s = applyAll(rules, s, [PASS, PASS]).state;
    expect([s.screen, s.week]).toEqual(['shop', 3]);
    s = rules.apply(s, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'blueprint', id: 'goodBones' },
    }).state;
    expect(s.blueprints).toEqual([{ id: 'goodBones', boughtWeek: 3 }]);
    s = rules.apply(s, LEAVE).state;
    expect(earned(rules.currentTally(s), 1)).toBe(4);
    const { state, events } = applyAll(rules, s, [PASS]);
    expect(earned(eventsOf(events, 'tally')[0]!.tally, 1)).toBe(4);
    expect(earned(rules.currentTally(state), 1)).toBe(5);
  });

  it('Country Living: every piece earns +1 per touching Tree, up to 3, on top of its own', () => {
    const rows = withTrees([2, 4], [2, 5]);
    // A Lawn (uid 1) and a Bedroom (uid 2) on either side of two Trees.
    const house = houseFrom(C, rows, [
      ['lawn', 0, 4],
      ['bedroom', 3, 4],
    ]);
    const plain = tally(C, house);
    expect(earned(plain, 1)).toBe(1);
    expect(earned(plain, 2)).toBe(3 + 2);
    const t = tally(C, house, { blueprints: ['countryLiving'] });
    expect(earned(t, 1)).toBe(1 + 2);
    expect(earned(t, 2)).toBe(3 + 2 + 2);
    expect(scoreOf(t, 1).lines.some((l) => l.label.endsWith('(Country Living)'))).toBe(true);
  });

  it('Solar Panels: Sunny pieces pay 1 budget every 4th week, counted from purchase', () => {
    // uid 1 in the sun, uid 2 in two Trees' shade.
    const house = houseFrom(C, withTrees([0, 5], [1, 5]), [
      ['bedroom', 0, 0],
      ['bedroom', 0, 6],
    ]);
    const budgets = [5, 6, 7, 8, 9].map(
      (week) => tally(C, house, { blueprints: ['solarPanels'], since: 5, week }).budget,
    );
    expect(budgets).toEqual([0, 0, 0, 1, 0]);
    const wk8 = tally(C, house, { blueprints: ['solarPanels'], since: 5, week: 8 });
    expect(scoreOf(wk8, 1)).toMatchObject({ budget: 1 });
    expect(scoreOf(wk8, 2)).toMatchObject({ budget: 0 });
    expect(scoreOf(wk8, 1).lines).toContainEqual({
      label: 'Every 4th week (Solar Panels)',
      op: 'budget',
      value: 1,
      from: [],
    });
    // Counted from placement instead, it would have paid in week 4.
    expect(tally(C, house, { blueprints: ['solarPanels'], since: 1, week: 4 }).budget).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------
// perCountOver

describe('perCountOver', () => {
  const c = withBlueprint([
    { kind: 'perCountOver', match: { property: 'room' }, over: 2, pct: 50 },
  ]);
  const rooms: Placement[] = [
    ['bedroom', 0, 0],
    ['bedroom', 3, 0],
    ['bedroom', 6, 0],
    ['bedroom', 0, 5],
  ];
  const lawn: Placement = ['lawn', 6, 5];

  it('every matching piece earns pct for each one over the limit', () => {
    const three = tally(c, houseFrom(c, L, [...rooms.slice(0, 3), lawn]), {
      blueprints: [TEST_PLAN],
    });
    // One room over 2: +50%, 3 × 1.5 = 4.5 → 5. The Lawn isn't a room.
    expect(scoreOf(three, 1)).toMatchObject({ pct: 50, earned: 5 });
    expect(scoreOf(three, 1).lines).toContainEqual({
      label: 'Test Plan (1 over 2)',
      op: 'pct',
      value: 50,
      from: [],
    });
    expect(earned(three, 4)).toBe(1);
    // Two over: +100%.
    const four = tally(c, houseFrom(c, L, [...rooms, lawn]), { blueprints: [TEST_PLAN] });
    expect(scoreOf(four, 1)).toMatchObject({ pct: 100, earned: 6 });
    // At the limit, nothing.
    const two = tally(c, houseFrom(c, L, rooms.slice(0, 2)), { blueprints: [TEST_PLAN] });
    expect(scoreOf(two, 1)).toMatchObject({ pct: 0, earned: 3 });
  });
});

// ---------------------------------------------------------------------------------------
// setBonus

describe('setBonus', () => {
  // A Jack-and-Jill (10 Points, +0.5 Mult) on top, an Entertainer (25, +1) below it.
  const SETS: Placement[] = [
    ['bedroom', 0, 0],
    ['bathroom', 2, 0],
    ['bedroom', 3, 0],
    ['kitchen', 0, 4],
    ['diningRoom', 2, 4],
    ['livingRoom', 4, 4],
  ];
  const setsOf = (t: Tally) => Object.fromEntries(t.sets.map((s) => [s.set, [s.points, s.mult]]));

  it("with no set named, it scales every set's Points and Mult", () => {
    const c = withBlueprint([{ kind: 'setBonus', pct: 50 }]);
    const house = houseFrom(c, L, SETS);
    expect(setsOf(tally(c, house))).toEqual({ jackAndJill: [10, 50], entertainer: [25, 100] });
    const t = tally(c, house, { blueprints: [TEST_PLAN] });
    // 10 × 1.5 = 15, 50 × 1.5 = 75; 25 × 1.5 = 37.5 → 38, 100 × 1.5 = 150.
    expect(setsOf(t)).toEqual({ jackAndJill: [15, 75], entertainer: [38, 150] });
    expect(t.mult).toBe(100 + 75 + 150);
  });

  it('a setBonus for one set leaves the others alone, and bonuses add', () => {
    const one = withBlueprint([{ kind: 'setBonus', set: 'entertainer', pct: 100 }]);
    expect(setsOf(tally(one, houseFrom(one, L, SETS), { blueprints: [TEST_PLAN] }))).toEqual({
      jackAndJill: [10, 50],
      entertainer: [50, 200],
    });
    const both = withBlueprint([
      { kind: 'setBonus', set: 'entertainer', pct: 100 },
      { kind: 'setBonus', pct: 50 },
    ]);
    // Entertainer +150%: 25 × 2.5 = 62.5 → 63, 100 × 2.5 = 250.
    expect(setsOf(tally(both, houseFrom(both, L, SETS), { blueprints: [TEST_PLAN] }))).toEqual({
      jackAndJill: [15, 75],
      entertainer: [63, 250],
    });
  });
});

// ---------------------------------------------------------------------------------------
// budget

describe('budget', () => {
  it('scales economy output, for every piece or for matching ones', () => {
    // A Garage (uid 1, 1 every 3rd week) and a Home Office (uid 2, 1 every 2nd week): both pay
    // in week 6.
    const house = houseFrom(C, L, [
      ['garage', 0, 8],
      ['homeOffice', 5, 0],
    ]);
    const plain = tally(C, house, { week: 6 });
    expect(plain.pieces.map((p) => p.budget)).toEqual([1, 1]);
    const all = withBlueprint([{ kind: 'budget', target: 'all', pct: 100 }]);
    const doubled = tally(all, house, { blueprints: [TEST_PLAN], week: 6 });
    expect(doubled.pieces.map((p) => p.budget)).toEqual([2, 2]);
    expect(doubled.budget).toBe(4);
    // Budget only: Points are unchanged.
    expect(doubled.points).toBe(plain.points);
    // Offices only, +50%: 1.5 → 2 for the office, the Garage's stays 1.
    const offices = withBlueprint([{ kind: 'budget', target: { piece: 'homeOffice' }, pct: 50 }]);
    const t = tally(offices, house, { blueprints: [TEST_PLAN], week: 6 });
    expect(t.pieces.map((p) => p.budget)).toEqual([1, 2]);
    expect(t.budget).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------
// drawWeight

describe('drawWeight', () => {
  const weightOf = (ws: ReturnType<typeof drawWeights>, id: string) =>
    ws.find((w) => w.card.id === id)?.weight;

  it("changes a piece's weight as (weight + add) × (100 + pct) / 100, matched on its definition", () => {
    const base = drawWeights(C, 0);
    // Weights are in hundredths: drawWeight × the phase's complexity percentage.
    expect(weightOf(base, 'kitchen')).toBe(10 * 100);
    expect(weightOf(base, 'homeOffice')).toBe(10 * 30);
    const boosted = drawWeights(C, 0, {
      mods: [{ kind: 'drawWeight', target: { piece: 'kitchen' }, add: 10, pct: 50 }],
    });
    // (10 + 10) × 1.5 = 30; the L-Kitchen counts as a Kitchen.
    expect(weightOf(boosted, 'kitchen')).toBe(30 * 100);
    expect(weightOf(boosted, 'lKitchen')).toBe(30 * 100);
    expect(weightOf(boosted, 'bedroom')).toBe(10 * 100);
    const cut = drawWeights(C, 0, {
      mods: [{ kind: 'drawWeight', target: { tag: 'Quiet' }, pct: -100 }],
    });
    expect(weightOf(cut, 'bedroom')).toBeUndefined();
    expect(weightOf(cut, 'homeOffice')).toBeUndefined();
    expect(weightOf(cut, 'kitchen')).toBe(10 * 100);
  });

  it("Appendix B's crews: a pct on a category, and an add that puts a special piece in the draws", () => {
    // The Landscaper: yard pieces +50%. A Lawn (complexity 2, 30% in phase 0): 15 × 30.
    const yard = drawWeights(C, 0, {
      mods: [{ kind: 'drawWeight', target: { property: 'yard' }, pct: 50 }],
    });
    expect(weightOf(yard, 'lawn')).toBe(15 * 30);
    expect(weightOf(yard, 'patio')).toBe(15 * 100);
    expect(weightOf(yard, 'bedroom')).toBe(10 * 100);
    // The Architect: special pieces add 5, so a weight-0 Library becomes drawable.
    expect(weightOf(drawWeights(C, 0), 'library')).toBeUndefined();
    const special = drawWeights(C, 0, {
      mods: [{ kind: 'drawWeight', target: { piece: ['library', 'playroom'] }, add: 5 }],
    });
    expect(weightOf(special, 'library')).toBe(5 * 100);
    expect(weightOf(special, 'playroom')).toBe(5 * 100);
  });

  it("a weight cut to 0 never comes up, and a crew's drawWeight reaches the run's hands", () => {
    const seeds = Array.from({ length: 40 }, (_, k) => `dw${k}`);
    const noBed: Modifier = { kind: 'drawWeight', target: { piece: 'bedroom' }, pct: -100 };
    const hasBed = (hand: readonly { id: string }[]) => hand.some((c) => c.id === 'bedroom');
    expect(seeds.some((sd) => hasBed(drawHand(C, sd, 0, '1', 0, 3)))).toBe(true);
    expect(seeds.some((sd) => hasBed(drawHand(C, sd, 0, '1', 0, 3, { mods: [noBed] })))).toBe(
      false,
    );
    const gc = C.crews.generalContractor;
    const crewContent: Content = {
      ...C,
      crews: { ...C.crews, generalContractor: { ...gc, modifiers: [...gc.modifiers, noBed] } },
    };
    const r = createRules(crewContent);
    expect(seeds.some((sd) => hasBed(rules.newRun(setup(sd)).hand))).toBe(true);
    expect(seeds.some((sd) => hasBed(r.newRun(setup(sd)).hand))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// rule

/** Every RuleKey, so a new key without a base fails to compile here. */
const RULE_KEYS: Record<RuleKey, true> = {
  rerollsPerPhase: true,
  demolitions: true,
  overtime: true,
  roomsRow: true,
  layoutRow: true,
  earlyRewardPct: true,
  reserveSlots: true,
  supplySlots: true,
  blueprintSlots: true,
  shopPricePct: true,
  specBonus: true,
  interestMax: true,
  strikes: true,
  freeInstalls: true,
};

describe('rule', () => {
  const active = (...mods: Modifier[]): ActiveMod[] =>
    mods.map((mod) => ({ mod, source: { kind: 'crew', id: 'generalContractor' }, since: 0 }));
  const slots = (...mods: Modifier[]) => ruleFrom(C, active(...mods), 'supplySlots');

  it('ruleFrom: (base + Σ add) × (100 + Σ pct) / 100, rounded half up, never below 0', () => {
    // supplySlots' base is 3.
    expect(slots()).toBe(3);
    expect(
      slots(
        { kind: 'rule', key: 'supplySlots', add: 1 },
        { kind: 'rule', key: 'supplySlots', add: 1 },
      ),
    ).toBe(5);
    // (3 + 2) × 1.5 = 7.5 → 8.
    expect(slots({ kind: 'rule', key: 'supplySlots', add: 2, pct: 50 })).toBe(8);
    // Percentages add: 3 × (100 + 25 + 25)% = 4.5 → 5.
    expect(
      slots(
        { kind: 'rule', key: 'supplySlots', pct: 25 },
        { kind: 'rule', key: 'supplySlots', pct: 25 },
      ),
    ).toBe(5);
    // 3 × 0.5 = 1.5 → 2.
    expect(slots({ kind: 'rule', key: 'supplySlots', pct: -50 })).toBe(2);
    expect(slots({ kind: 'rule', key: 'supplySlots', add: -5 })).toBe(0);
    expect(slots({ kind: 'rule', key: 'supplySlots', pct: -200 })).toBe(0);
    // Other keys and other kinds don't count.
    expect(slots({ kind: 'rule', key: 'demolitions', add: 4 }, { kind: 'mult', add: 50 })).toBe(3);
  });

  it('every rule key has a base in balance, and rules.rule reads the crew and the blueprints', () => {
    const keys = Object.keys(RULE_KEYS) as RuleKey[];
    expect(keys.sort()).toEqual(Object.keys(TEST_BALANCE.rules).sort());
    const s = rules.newRun(setup('rules'));
    for (const key of keys) {
      expect(Number.isInteger(TEST_BALANCE.rules[key])).toBe(true);
      // The General Contractor adds a reroll each phase.
      const crew = key === 'rerollsPerPhase' ? 1 : 0;
      expect(rules.rule(s, key)).toBe(TEST_BALANCE.rules[key] + crew);
    }
    // Appendix A · M3a's slots and shop numbers.
    expect(
      (
        [
          'reserveSlots',
          'supplySlots',
          'blueprintSlots',
          'shopPricePct',
          'specBonus',
          'interestMax',
        ] as const
      ).map((k) => rules.rule(s, k)),
    ).toEqual([2, 3, 4, 100, 25, 0]);
    // Dream Home: specBonus +10.
    const dream = { ...s, blueprints: [{ id: 'dreamHome' as const, boughtWeek: 1 }] };
    expect(rules.rule(dream, 'specBonus')).toBe(35);
  });

  it("a blueprint's rules change the run: slots, a row of the hand, and the next phase's rerolls", () => {
    const c = withBlueprint([
      { kind: 'rule', key: 'reserveSlots', add: 1 },
      { kind: 'rule', key: 'supplySlots', add: 2 },
      { kind: 'rule', key: 'blueprintSlots', add: 1 },
      { kind: 'rule', key: 'roomsRow', add: 1 },
      { kind: 'rule', key: 'rerollsPerPhase', add: 1 },
    ]);
    const r = createRules(c);
    let s = runOn(r, [['bedroom', 0, 0]]);
    // Two rows of 2 (D-121).
    expect(s.hand).toHaveLength(4);
    expect(r.slots(s)).toEqual({ reserve: 2, supplies: 3, blueprints: 4 });
    s = r.apply(s, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'blueprint', id: TEST_PLAN },
    }).state;
    expect(r.slots(s)).toEqual({ reserve: 3, supplies: 5, blueprints: 5 });
    // The next hand drawn has a third Rooms card: 5 cards.
    s = r.apply(s, { t: 'reroll' }).state;
    expect(s.hand).toHaveLength(5);
    // This phase's rerolls are already set; the next phase starts with 1 + 1 (crew) + 1.
    expect(s.rerollsLeft).toBe(1);
    s = applyAll(r, s, [PASS, PASS]).state;
    expect(s.screen).toBe('shop');
    expect(s.rerollsLeft).toBe(3);
  });

  it("shopPricePct: a blueprint's discount reprices the shop's goods, not its services", () => {
    const c = withBlueprint([{ kind: 'rule', key: 'shopPricePct', add: -25 }]);
    const r = createRules(c);
    let s: RunState = {
      ...runOn(r, [['bedroom', 0, 0]]),
      blueprints: [{ id: TEST_PLAN, boughtWeek: 1 }],
    };
    expect(r.rule(s, 'shopPricePct')).toBe(75);
    s = applyAll(r, s, [PASS, PASS]).state;
    const views = r.shopOffers(s);
    expect(views.length).toBeGreaterThan(0);
    const service = { reroll: 1, demolition: 1, strike: 2 };
    for (const v of views) {
      const o = v.offer;
      if (o.kind === 'service') {
        expect(v.fullPrice).toBe(service[o.service]);
        continue;
      }
      const list =
        o.kind === 'blueprint'
          ? c.blueprints[o.id].price
          : o.kind === 'fixture'
            ? c.fixtures[o.id].price
            : c.balance.shop.piecePrice;
      expect(v.fullPrice).toBe(Math.max(1, roundHalfUp(list * 75, 100)));
    }
  });

  it('interestMax: min(floor(budget held / 5), the rule), paid at the milestone before its reward', () => {
    const c = withBlueprint([{ kind: 'rule', key: 'interestMax', add: 3 }]);
    const r = createRules(c);
    const s: RunState = {
      ...runOn(r, [['bedroom', 0, 0]]),
      budget: 12,
      blueprints: [{ id: TEST_PLAN, boughtWeek: 1 }],
    };
    const { state, events } = applyAll(r, s, [PASS, PASS]);
    // floor(12 / 5) = 2 (counted after the reward it would be floor(15 / 5) = 3).
    expect(eventsOf(events, 'milestone')[0]!.reward).toEqual({
      budget: 3 + 2,
      score: 0,
      interest: 2,
    });
    expect(state.budget).toBe(12 + 5);
    // M3a: interestMax is 0, so no interest.
    const plain = applyAll(rules, { ...runOn(rules, [['bedroom', 0, 0]]), budget: 12 }, [
      PASS,
      PASS,
    ]);
    expect(eventsOf(plain.events, 'milestone')[0]!.reward).toEqual({
      budget: 3,
      score: 0,
      interest: 0,
    });
  });
});

// ---------------------------------------------------------------------------------------
// The last week of a phase and early milestones, in a real run (Appendix A · M3a: "a
// fast-forwarded week 4 doesn't count").

describe('the last week and early milestones in a real run', () => {
  /** Two Bedrooms (8 a week) meet the first target (5) in week 1, with Last-Minute Push. */
  const pushRun = (): RunState => ({
    ...runOn(rules, TWO_BEDROOMS),
    blueprints: [{ id: 'lastMinutePush', boughtWeek: 1 }],
  });
  const PUSH = { label: 'Last-Minute Push', times: 200, before: 100, after: 200 };

  it("Last-Minute Push lands in a phase's last week when it's played", () => {
    let s = pushRun();
    const wk1 = applyAll(rules, s, [PASS]);
    expect(eventsOf(wk1.events, 'tally')[0]!.tally).toMatchObject({ xMults: [], total: 8 });
    s = wk1.state;
    expect(s.slot).toBe(2);
    // The week's preview already shows it.
    expect(rules.currentTally(s).xMults).toMatchObject([PUSH]);
    const wk2 = applyAll(rules, s, [PASS]);
    const t = eventsOf(wk2.events, 'tally')[0]!;
    expect(t).toMatchObject({ slot: 2, fastForward: false });
    expect(t.tally).toMatchObject({ xMults: [PUSH], total: 16 });
    expect(eventsOf(wk2.events, 'milestone')[0]!.result).toBe('onTime');
  });

  it("a fast-forwarded last week doesn't count, whether auto-completed or completed by hand", () => {
    const auto = applyAll(rules, pushRun(), [{ t: 'setAutoComplete', on: true }, PASS]);
    const tallies = eventsOf(auto.events, 'tally');
    expect(tallies.map((e) => [e.slot, e.fastForward, e.tally.total])).toEqual([
      [1, false, 8],
      [2, true, 8],
    ]);
    expect(tallies[1]!.tally.xMults).toEqual([]);
    expect(eventsOf(auto.events, 'milestone')[0]!.result).toBe('early');
    // By hand, in week 2 itself: that week is fast-forwarded, not played.
    const s = applyAll(rules, pushRun(), [PASS]).state;
    const manual = applyAll(rules, s, [{ t: 'completeEarly' }]);
    const ff = eventsOf(manual.events, 'tally');
    expect(ff.map((e) => [e.slot, e.fastForward, e.tally.total])).toEqual([[2, true, 8]]);
    expect(ff[0]!.tally.xMults).toEqual([]);
  });

  it('an overtime week counts as a last week', () => {
    const { state, events } = applyAll(rules, pushRun(), [
      { t: 'debug', op: 'forceMiss' },
      PASS,
      PASS,
    ]);
    expect(eventsOf(events, 'overtimeUsed')).toHaveLength(1);
    expect(state.overtimeWeek).toBe(1);
    const ot = applyAll(rules, state, [PASS]);
    const t = eventsOf(ot.events, 'tally')[0]!;
    expect(t.overtimeWeek).toBe(1);
    expect(t.tally).toMatchObject({ xMults: [PUSH], total: 16 });
    expect(eventsOf(ot.events, 'milestone')[0]!.result).toBe('overtime');
  });

  it('an earn when lastWeekOfPhase pays in a played last week, not a fast-forwarded one', () => {
    const c = withBlueprint(
      [{ kind: 'earn', target: 'all', pct: 100, when: 'lastWeekOfPhase' }],
      'Crunch Time',
    );
    const r = createRules(c);
    const start: RunState = {
      ...runOn(r, TWO_BEDROOMS),
      blueprints: [{ id: TEST_PLAN, boughtWeek: 1 }],
    };
    const played = eventsOf(applyAll(r, start, [PASS, PASS]).events, 'tally');
    // Week 2: each Bedroom 4 × 2 = 8.
    expect(played.map((e) => e.tally.total)).toEqual([8, 16]);
    expect(scoreOf(played[1]!.tally, 1).lines.some((l) => l.label === 'Crunch Time')).toBe(true);
    const ff = eventsOf(
      applyAll(r, start, [{ t: 'setAutoComplete', on: true }, PASS]).events,
      'tally',
    );
    expect(ff.map((e) => [e.fastForward, e.tally.total])).toEqual([
      [false, 8],
      [true, 8],
    ]);
  });

  it("Ahead of Schedule counts the run's milestones completed early", () => {
    let s = applyAll(rules, runOn(rules, TWO_BEDROOMS), [
      { t: 'setAutoComplete', on: true },
      PASS,
    ]).state;
    expect([s.screen, s.milestonesEarly]).toEqual(['shop', 1]);
    s = rules.apply(s, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'blueprint', id: 'aheadOfSchedule' },
    }).state;
    s = rules.apply(s, LEAVE).state;
    const t = rules.currentTally(s);
    // ×(1 + 0.2 × 1); 8 × 1.2 = 9.6 → 10.
    expect(t.xMults.map((x) => [x.label, x.times, x.before, x.after])).toEqual([
      ['Ahead of Schedule', 120, 100, 120],
    ]);
    expect(t.total).toBe(10);
  });
});

// ---------------------------------------------------------------------------------------
// Lot traits (D-119): the lot as a source of run modifiers.

/** Test content where Creekside pays as the real one does (the test traits pay nothing). */
const CREEKSIDE: Content = {
  ...C,
  lotTraits: {
    ...C.lotTraits,
    creekside: {
      ...C.lotTraits.creekside,
      modifiers: [{ kind: 'earn', target: { touching: { feature: 'creek' } }, pct: 50 }],
    },
  },
};

/** The 10 × 10 lot with a creek down column 5. */
const CREEK_LOT = L.map((r) => `${r.slice(0, 5)}C${r.slice(6)}`);

describe('lot traits (D-119)', () => {
  const lotMods = (rows: readonly string[]) =>
    runModifiers(CREEKSIDE, {
      setup: setup('mods'),
      blueprints: [],
      house: { lot: lotFromRows(rows) },
    }).filter((m) => m.source.kind === 'lot');

  it("join the run's modifiers when the lot has the trait, named after it", () => {
    expect(lotMods(CREEK_LOT).map((m) => [m.source, m.mod.kind])).toEqual([
      [{ kind: 'lot', id: 'creekside' }, 'earn'],
    ]);
    expect(lotMods(L)).toEqual([]);
    // A new run's setup rules have no house, so no lot.
    const noHouse = runModifiers(CREEKSIDE, { setup: setup('mods'), blueprints: [] });
    expect(noHouse.some((m) => m.source.kind === 'lot')).toBe(false);
    expect(sourceName(CREEKSIDE, { kind: 'lot', id: 'creekside' })).toBe('Creekside');
  });

  it('Creekside: a piece touching the creek earns +50%, on a Creekside line', () => {
    const r = createRules(CREEKSIDE);
    // The right Bedroom (x 3–4) touches the creek; the left one (x 1–2) touches only it.
    const s = {
      ...r.newRun(setup('creek')),
      house: houseFrom(CREEKSIDE, CREEK_LOT, [
        ['bedroom', 3, 0],
        ['bedroom', 1, 0],
      ]),
    };
    const t = r.currentTally(s);
    // Each 3 + 1 (a Quiet neighbor) = 4; by the creek × 1.5 = 6.
    expect(scoreOf(t, 1)).toMatchObject({ points: 4, pct: 50, earned: 6 });
    expect(scoreOf(t, 1).lines.filter((l) => l.op === 'pct')).toEqual([
      { label: 'Creekside', op: 'pct', value: 50, from: [] },
    ]);
    expect(scoreOf(t, 2)).toMatchObject({ points: 4, pct: 0, earned: 4 });
  });

  it('read as a tip: what they pay, all run, what they deal more of (D-166), then the blurb', () => {
    const creekside = CONTENT.lotTraits.creekside;
    expect(lotTraitText(CONTENT, creekside)).toBe(
      'Pieces touching the Creek earn +50%, all run. More Patios in the draw. Only a Driveway crosses it.',
    );
    expect(lotTraitText(CONTENT, CONTENT.lotTraits.wooded)).toBe(
      'Pieces touching a Tree earn +25%, all run. More Treehouses and Birdhouses in the draw. Building over a Tree clears it.',
    );
    // A trait that only hints reads as its blurb (the test content's).
    expect(lotTraitText(C, C.lotTraits.wooded)).toBe(C.lotTraits.wooded.blurb);
  });
});

// ---------------------------------------------------------------------------------------
// Card text for the real blueprints.

describe('blueprint text (real content)', () => {
  it('all 18 blueprints read as plain sentences', () => {
    const defs = Object.values(CONTENT.blueprints);
    expect(defs).toHaveLength(18);
    for (const def of defs) {
      const lines = blueprintText(CONTENT, def);
      expect(lines.length, def.id).toBe(def.modifiers.length);
      expect(lines.length, def.id).toBeGreaterThan(0);
      def.modifiers.forEach((m, k) => {
        const text = modifierText(CONTENT, m);
        expect(text, def.id).toBe(lines[k]);
        expect(text.trim().length, def.id).toBeGreaterThan(0);
        expect(text, def.id).not.toMatch(/undefined|NaN|\[object/);
      });
    }
  });
});
