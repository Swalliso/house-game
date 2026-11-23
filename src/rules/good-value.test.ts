// What a piece and a tool are worth (D-193): the rules' numbers behind the lines on the shop's
// pieces and tools, on a crate's piece options, and in Inspect.
//
// - pieceValue: a piece's best play from Your goods (its best spot, or for a type at its limit a
//   Renovation or an extension), the week's total with it less without, and each week left in
//   the run added up with nothing more built (D-141's projection): the house's timers run on, so
//   a rhythm pays in its weeks and a Henhouse lays in its. In the shop the first week is the next
//   phase's first. Null with no legal play.
// - toolValue: a one-week tool's gain the week it's used; a Remodel Plan's next level, this week
//   and over the run, or what it's waiting for; and for the rest, what it would do here or why
//   it has no number.
// - Neither changes the state, and each keeps its values by state.
//
// Rules tests use TEST_CONTENT (testing.ts). Houses are built on a 12×12 lot with houseFrom, so
// uids follow the placement order and every piece has placedWeek 1; the street runs along the
// bottom edge (y = 11), so pieces near the top never touch it. Here 4 phases of 3 weeks, with
// targets out of reach, and no sets but those a test builds, so a week's Mult is ×1 and its
// total is its points.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/index.ts';
import type {
  Action,
  BlueprintDef,
  BlueprintId,
  Content,
  PieceId,
  PlaceAction,
  RunState,
  ShopOffer,
  Supply,
  ToolId,
} from './index.ts';
import { createRules, type Rules } from './run.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withPieces,
  type Placement,
} from './testing.ts';

const W = 3;
const PHASES = 4;
const ALL_WEEKS = W * PHASES;
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

/** Week 1 of a run with these pieces on these rows, and nothing in hand. */
function build(
  placements: readonly Placement[],
  opts: { rows?: readonly string[]; r?: Rules } = {},
): RunState {
  const r = opts.r ?? R;
  const s = r.newRun(setup('good-value'));
  return {
    ...s,
    house: houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: [],
  };
}

/** The same run at another week of its phase, or of a later one. */
const at = (s: RunState, phase: number, slot: number): RunState => ({
  ...s,
  phase,
  slot,
  week: phase * W + slot,
});

/** Lot rows with these cells set to a terrain code (T tree, B boulder, S Old Shed, C creek). */
function rowsWith(code: string, ...cells: readonly [number, number][]): string[] {
  const rows = emptyRows(12, 12).map((r) => r.split(''));
  for (const [x, y] of cells) rows[y]![x] = code;
  return rows.map((r) => r.join(''));
}

/** Meets the phase's target, then passes until the milestone resolves and the shop opens. */
function toShop(r: Rules, s: RunState): RunState {
  s = { ...s, score: Math.max(s.score, r.target(s)) };
  while (s.screen === 'build') s = r.apply(s, PASS).state;
  expect(s.screen).toBe('shop');
  return s;
}

/**
 * The run's next week with nothing built: passes, meeting the target in a phase's last week so
 * the milestone resolves on time, and leaves the shop that opens.
 */
function nextWeek(r: Rules, s: RunState): RunState {
  const last = s.slot >= W;
  s = r.apply(last ? { ...s, score: Math.max(s.score, r.target(s)) } : s, PASS).state;
  while (s.screen === 'shop') s = r.apply(s, { t: 'leaveShop' }).state;
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

/** Every legal spot's exact gain this week for a piece put in Your goods: the brute force. */
function bestGain(r: Rules, s: RunState, id: PieceId): { gain: number; spots: PlaceAction[] } {
  const st: RunState = { ...s, reserve: [...s.reserve, { id }] };
  const i = st.reserve.length - 1;
  const pass = r.scoreOnly(st, null);
  let gain = -Infinity;
  let spots: PlaceAction[] = [];
  for (const p of r.legalPlacements(st)) {
    if (p.from !== 'reserve' || p.i !== i) continue;
    const g = r.scoreOnly(st, p) - pass;
    if (g > gain) [gain, spots] = [g, [p]];
    else if (g === gain) spots.push(p);
  }
  return { gain, spots };
}

// Two Bedrooms side by side (uids 1, 2: steady 3 + 1 for the Quiet neighbor = 4 each), and a
// Living Room (uid 3, 2×3) with two Trees beside it (+2 per view source = 4): 12 Wow a week.
const HOUSE: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
  ['livingRoom', 6, 0],
];
const HOUSE_ROWS = rowsWith('T', [8, 0], [8, 1]);

// ---------------------------------------------------------------------------------------

describe('pieceValue: a piece’s worth in the house as it stands (D-193)', () => {
  it('is its best spot’s gain this week, and each week left added up', () => {
    // A Library: +2 for each Quiet neighbor (up to 3), and Quiet itself, so the Bedrooms it
    // touches earn +1 each. Below both Bedrooms it's +4 for itself and +2 for them.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(R.currentTally(s).total).toBe(12);
    const v = R.pieceValue(s, 'library')!;
    const brute = bestGain(R, s, 'library');
    expect(brute.gain).toBe(6);
    expect(v).toMatchObject({ how: 'place', gain: 6, weeksLeft: ALL_WEEKS, budget: 0 });
    // Nothing on the lot has a timer, so every week left adds the same.
    expect(v.overRun).toBe(6 * ALL_WEEKS);
    expect(v.rhythm).toBeUndefined();
    // Its spot is one of the best, and placing it there from Your goods gains that much.
    const { x, y, rot } = v.spot!;
    expect(brute.spots.some((p) => p.x === x && p.y === y && p.rot === rot)).toBe(true);
    const st: RunState = { ...s, reserve: [...s.reserve, { id: 'library' }] };
    const play: PlaceAction = { t: 'place', from: 'reserve', i: st.reserve.length - 1, x, y, rot };
    expect(R.scoreOnly(st, play) - R.scoreOnly(st, null)).toBe(v.gain);
  });

  it('finds what the bots’ estimate can’t see: a piece by the creek on a Creekside lot', () => {
    // Creekside: a piece touching the creek earns +100%. The estimate the bots rank by counts
    // "touching" as never, so every open spot looks alike to them; the value reads it.
    const creek = Array.from({ length: 12 }, (_, y) => [11, y] as [number, number]);
    const content: Content = {
      ...CONTENT_4x3,
      lotTraits: {
        ...CONTENT_4x3.lotTraits,
        creekside: {
          id: 'creekside',
          name: 'Creekside',
          blurb: '',
          when: { terrain: 'creek', min: 1 },
          modifiers: [{ kind: 'earn', target: { touching: { feature: 'creek' } }, pct: 100 }],
        },
      },
    };
    const r = createRules(content);
    const s = build(HOUSE, { rows: rowsWith('C', ...creek), r });
    // A Henhouse earns +1 for each Herb Garden or Flower Bed it touches: one by the creek.
    const garden = build([...HOUSE, ['herbGarden', 9, 5]], { rows: rowsWith('C', ...creek), r });
    const v = r.pieceValue(garden, 'henhouse')!;
    const brute = bestGain(r, garden, 'henhouse');
    expect(v.gain).toBe(brute.gain);
    expect(v.gain).toBe(2);
    expect(r.pieceValue(s, 'henhouse')!.gain).toBe(bestGain(r, s, 'henhouse').gain);
  });

  it('counts a rhythm’s paying weeks, and leads with the week it pays (the Pool)', () => {
    // The Pool: +12 every 3rd week, its build week counting as the first, so it pays in weeks 3,
    // 6, 9 and 12. It's Loud, so it keeps away from the Bedrooms, and from the Trees.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const v = R.pieceValue(s, 'pool')!;
    expect(v).toMatchObject({ how: 'place', gain: 0, weeksLeft: ALL_WEEKS, budget: 0 });
    expect(v.rhythm).toEqual({ every: 3, gain: 12 });
    expect(v.overRun).toBe(12 * 4);
  });

  it('counts budget over the run apart from Wow (the Henhouse’s eggs)', () => {
    // Budget 1 every 2nd week: weeks 2, 4, … 12, and no Wow with nothing to touch.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const v = R.pieceValue(s, 'henhouse')!;
    expect(v).toMatchObject({ gain: 0, overRun: 0, budget: ALL_WEEKS / 2 });
  });

  it('runs the house’s timers on: a Sapling becomes a Tree', () => {
    // A Sapling earns 1 a week until it's a Tree (4 weeks on), then nothing of its own; as a
    // Tree it's a view for the Living Room beside it (+2) and a neighbor for a Bedroom (+1).
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const v = R.pieceValue(s, 'sapling')!;
    let k = 0;
    let total = 0;
    // Each week's gain by hand: place it at its spot, then pass week after week.
    const st: RunState = { ...s, reserve: [...s.reserve, { id: 'sapling' }] };
    const { x, y, rot } = v.spot!;
    const placed = R.apply(st, {
      t: 'place',
      from: 'reserve',
      i: st.reserve.length - 1,
      x,
      y,
      rot,
    }).state;
    let cur = placed;
    let base = s;
    const gains: number[] = [];
    while (k < ALL_WEEKS && cur.screen === 'build') {
      gains.push(R.currentTally(cur).total - R.currentTally(base).total);
      total += gains[k]!;
      cur = nextWeek(R, cur);
      base = nextWeek(R, base);
      k++;
    }
    expect(k).toBe(ALL_WEEKS);
    expect(v.overRun).toBe(total);
    // And the Sapling became a Tree on the way.
    expect(placed.house.pieces.some((p) => p.defId === 'sapling')).toBe(true);
    expect(cur.house.pieces.some((p) => p.defId === 'sapling')).toBe(false);
    expect(gains).toHaveLength(ALL_WEEKS);
  });

  it('is null with no legal spot', () => {
    // Boulders everywhere but the top row: a 2×3 Pool fits nowhere, a Closet does.
    const rows = emptyRows(12, 12).map((r, y) => (y === 0 ? r : 'B'.repeat(12)));
    const s = build([], { rows });
    expect(R.pieceValue(s, 'pool')).toBeNull();
    expect(R.pieceValue(s, 'closet')).not.toBeNull();
  });

  it('says what has it earn nothing, when that’s why it adds nothing', () => {
    // A blueprint as a change order's A litter of puppies is: Flower Beds earn nothing.
    const puppies: BlueprintDef = {
      id: 'puppies' as BlueprintId,
      name: 'Puppies',
      tier: 'core',
      rarity: 'common',
      price: 4,
      modifiers: [{ kind: 'earnNothing', target: { piece: 'flowerBed' } }],
      offered: false,
    };
    const r = createRules({
      ...CONTENT_4x3,
      blueprints: { ...CONTENT_4x3.blueprints, [puppies.id]: puppies },
    });
    const s: RunState = { ...build([], { r }), blueprints: [{ id: puppies.id, boughtWeek: 1 }] };
    expect(r.pieceValue(s, 'flowerBed')).toMatchObject({ gain: 0, overRun: 0, nothing: 'Puppies' });
    // A piece it doesn't stop has no such note, nor one that adds nothing for another reason.
    expect(r.pieceValue(s, 'sapling')!.nothing).toBeUndefined();
    expect(R.pieceValue(build([]), 'henhouse')).toMatchObject({ gain: 0, overRun: 0 });
    expect(R.pieceValue(build([]), 'henhouse')!.nothing).toBeUndefined();
  });

  it('renovates for a type at its limit: one Library a house', () => {
    const content = withPieces({ library: { perHouse: 1 } }, CONTENT_4x3);
    const r = createRules(content);
    const s = build([...HOUSE, ['library', 0, 2]], { rows: HOUSE_ROWS, r });
    const v = r.pieceValue(s, 'library')!;
    expect(v.how).toBe('renovate');
    expect(v.spot).toBeUndefined();
    expect(v.room).toEqual({ uid: 4, defId: 'library' });
    // A level is +4 points a week (the test balance's pointsPerLevel).
    expect(v.gain).toBe(4);
    expect(v.overRun).toBe(4 * ALL_WEEKS);
  });

  it('values the next week in the shop, as leaving it starts that week', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const shop = withGoods(toShop(R, s), [{ kind: 'piece', id: 'pool' }]);
    const v = R.pieceValue(shop, 'pool')!;
    // Phase 2's first week: 9 weeks left, so the Pool pays in 3 of them.
    expect(v.weeksLeft).toBe(ALL_WEEKS - W);
    expect(v.overRun).toBe(12 * 3);
    const next = R.apply(shop, { t: 'leaveShop' }).state;
    expect(next.screen).toBe('build');
    expect(R.pieceValue(next, 'pool')).toEqual(v);
  });

  it('carries its values over a click in the shop that changes nothing they read', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    const shop = withGoods(toShop(R, s), [
      { kind: 'piece', id: 'pool' },
      { kind: 'piece', id: 'library' },
      { kind: 'blueprint', id: 'quietHours' },
    ]);
    const pool = R.pieceValue(shop, 'pool');
    const rush = R.toolValue(shop, 'rushOrder');
    // Buying the Library changes the budget, Your goods and the shelf: nothing a value reads.
    const library = R.apply(shop, { t: 'buy', i: 1 }).state;
    expect(R.pieceValue(library, 'pool')).toBe(pool);
    expect(R.toolValue(library, 'rushOrder')).toBe(rush);
    // D-196: so does holding a good for the next shop.
    const held = R.apply(library, { t: 'hold', i: 2 }).state;
    expect(held.held).toEqual({ kind: 'blueprint', id: 'quietHours' });
    expect(R.pieceValue(held, 'pool')).toBe(pool);
    expect(R.toolValue(held, 'rushOrder')).toBe(rush);
    // A blueprint changes what the house earns, so the values are worked out again.
    const quiet = R.apply(library, { t: 'buy', i: 2 }).state;
    expect(R.pieceValue(quiet, 'pool')).not.toBe(pool);
    expect(R.toolValue(quiet, 'rushOrder')).not.toEqual(rush);
    // And the state before still has its own.
    expect(R.pieceValue(shop, 'pool')).toEqual(pool);
  });

  it('never changes the state, keeps its values by state, and is null off those screens', () => {
    const s = deepFreeze(build(HOUSE, { rows: HOUSE_ROWS }));
    const v = R.pieceValue(s, 'library');
    expect(R.pieceValue(s, 'library')).toBe(v);
    expect(R.pieceValue({ ...s, screen: 'lost' }, 'library')).toBeNull();
    expect(R.pieceValue(s, 'nope' as PieceId)).toBeNull();
  });
});

describe('toolValue: a tool’s worth in the house as it stands (D-193)', () => {
  const value = (s: RunState, id: ToolId) => R.toolValue(s, id);

  it('gives a one-week tool’s gain the week it’s used: Rush Order', () => {
    // +0.5 Mult for the week: 12 → 18.
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(value(s, 'rushOrder')).toEqual({ kind: 'week', gain: 6 });
    // And what it's waiting for when it would add nothing.
    expect(value(build([]), 'rushOrder')).toEqual({
      kind: 'needs',
      needs: 'Nothing is earning yet',
    });
    // Open House Party: Social and Pretty pieces earn double. The Living Room is Social...
    expect(value(s, 'openHouseParty')).toEqual({ kind: 'week', gain: 4 });
    // ...and Bedrooms are neither.
    const beds = build(HOUSE.slice(0, 2));
    expect(value(beds, 'openHouseParty')).toEqual({ kind: 'needs', needs: 'No Social pieces yet' });
  });

  // D-210: a second Photo Shoot can't be used in a week that has one. Valued as if used, it added
  // nothing, and its line said "Adds nothing to your house yet", which read as a good to sell.
  it('says a second Photo Shoot waits for next week in a week that has one (D-210)', () => {
    const shoot: Supply = { kind: 'tool', id: 'photoShoot' };
    const s: RunState = { ...build(HOUSE, { rows: HOUSE_ROWS }), supplies: [shoot, shoot] };
    // ×1.5 on 12 Wow: 18.
    expect(value(s, 'photoShoot')).toEqual({ kind: 'week', gain: 6 });
    const used = R.apply(s, { t: 'useTool', i: 0 }).state;
    expect(R.canUseTool(used, { t: 'useTool', i: 0 }).ok).toBe(false);
    expect(value(used, 'photoShoot')).toEqual({
      kind: 'needs',
      needs: 'Waits for next week: this week has a Photo Shoot',
    });
    // Next week it's worth its ×1.5 again.
    expect(value(nextWeek(R, used), 'photoShoot')).toEqual({ kind: 'week', gain: 6 });
    // The run's last week has no next week to wait for: only why.
    const last = R.apply(at(s, PHASES - 1, W), { t: 'useTool', i: 0 }).state;
    expect(value(last, 'photoShoot')).toEqual({
      kind: 'needs',
      needs: 'This week already has its Photo Shoot',
    });
  });

  it('gives a Remodel Plan’s next level for a set the house holds, this week and over the run', () => {
    // A Jack-and-Jill: two Bedrooms around a Bathroom. Its next level is +8 points and +0.25
    // Mult, for every week left.
    const jj: Placement[] = [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ];
    const s = build(jj);
    const before = R.currentTally(s);
    expect(before.sets.map((x) => x.set)).toEqual(['jackAndJill']);
    const after = R.currentTally({ ...s, setLevels: { jackAndJill: 2 } }).total;
    const v = value(s, 'remodelJackAndJill');
    expect(v).toEqual({
      kind: 'level',
      set: 'jackAndJill',
      level: 2,
      gain: after - before.total,
      weeksLeft: ALL_WEEKS,
      overRun: (after - before.total) * ALL_WEEKS,
    });
    // A plan already used goes a level higher.
    const v3 = value({ ...s, setLevels: { jackAndJill: 2 } }, 'remodelJackAndJill');
    expect(v3).toMatchObject({ kind: 'level', level: 3 });
  });

  it('says what a Remodel Plan for a set the house doesn’t hold is waiting for', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    expect(value(s, 'remodelEntertainer')).toEqual({
      kind: 'needs',
      needs: 'No Entertainer yet',
      set: 'entertainer',
    });
    // Full House's members needn't touch: it says how far the house is.
    expect(value(s, 'remodelFullHouse')).toEqual({
      kind: 'needs',
      needs: 'No Full House yet: 2 of 9 built',
      set: 'fullHouse',
    });
  });

  it('says what a Fertilizer would bring forward', () => {
    // A Sapling becomes a Tree 4 weeks after it's planted; Fertilizer jumps its timer 2 weeks.
    const s = build([...HOUSE, ['sapling', 10, 6, 0, ['#']]], { rows: HOUSE_ROWS });
    expect(value(s, 'fertilizer')).toEqual({
      kind: 'note',
      note: 'Your Sapling becomes a Tree 2 weeks sooner',
    });
    const later = at(s, 0, 3);
    expect(value(later, 'fertilizer')).toEqual({
      kind: 'note',
      note: 'Your Sapling becomes a Tree the week after you use it',
    });
    // A pack of three becomes three Trees (D-195).
    const row = build([...HOUSE, ['sapling', 9, 6, 0, ['###']]], { rows: HOUSE_ROWS });
    expect(value(row, 'fertilizer')).toEqual({
      kind: 'note',
      note: 'Your Sapling becomes 3 Trees 2 weeks sooner',
    });
    const two = build([...HOUSE, ['sapling', 10, 6, 0, ['#']], ['sapling', 9, 8, 0, ['###']]], {
      rows: HOUSE_ROWS,
    });
    expect(value(at(two, 0, 3), 'fertilizer')).toEqual({
      kind: 'note',
      note: 'Your 2 Saplings become Trees the week after you use it',
    });
    expect(value(build(HOUSE, { rows: HOUSE_ROWS }), 'fertilizer')).toEqual({
      kind: 'note',
      note: 'Nothing here grows or changes yet',
    });
  });

  it('names what a Copy Machine would copy, and what a Dumpster could clear', () => {
    // The Living Room by its two Trees (4) and a third (6) earns the most.
    const rows = rowsWith('T', [8, 0], [8, 1], [8, 2]);
    const s = build(HOUSE, { rows });
    expect(value(s, 'copyMachine')).toEqual({
      kind: 'note',
      note: 'Your top earner to copy: your Living Room',
    });
    expect(value(build([]), 'copyMachine')).toEqual({
      kind: 'note',
      note: 'Nothing built to copy yet',
    });
    const lot = rowsWith('B', [5, 8], [7, 8]).map((r, y) =>
      y === 5 || y === 6 ? `${r.slice(0, 9)}SS${r.slice(11)}` : r,
    );
    expect(value(build([], { rows: lot }), 'dumpster')).toEqual({
      kind: 'note',
      note: 'On your lot to clear: 2 Boulders and the Old Shed',
    });
    expect(value(build([]), 'dumpster')).toEqual({
      kind: 'note',
      note: 'Nothing in the way on your lot',
    });
  });

  it('says why a tool whose worth hangs on a later choice has no number', () => {
    const s = build(HOUSE, { rows: HOUSE_ROWS });
    for (const id of ['weekendCrew', 'catalog', 'movingTruck'] as ToolId[]) {
      const v = value(s, id);
      expect(v?.kind, id).toBe('note');
    }
  });

  it('gives every tool a line, never changes the state, and is null off those screens', () => {
    const s = deepFreeze(build(HOUSE, { rows: HOUSE_ROWS }));
    for (const id of Object.keys(CONTENT_4x3.tools) as ToolId[]) {
      expect(value(s, id), id).not.toBeNull();
      expect(value(s, id), id).toBe(value(s, id));
    }
    expect(value({ ...s, screen: 'won' }, 'rushOrder')).toBeNull();
  });
});

describe('the game’s own pieces and tools (D-193)', () => {
  const rules = createRules(CONTENT);
  const s = rules.newRun({
    seed: 'good-value',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });

  it('gives every tool a number or a short line, from a run’s first week', () => {
    expect(s.screen).toBe('build');
    for (const id of Object.keys(CONTENT.tools) as ToolId[]) {
      const v = rules.toolValue(s, id);
      expect(v, id).not.toBeNull();
      // A few words: it has to fit a shop card.
      if (v!.kind === 'needs') expect(v!.needs.length, id).toBeLessThanOrEqual(48);
      if (v!.kind === 'note') expect(v!.note.length, id).toBeLessThanOrEqual(60);
    }
  });

  it('values every piece with a legal spot', () => {
    for (const id of Object.keys(CONTENT.pieces) as PieceId[]) {
      const st: RunState = { ...s, reserve: [...s.reserve, { id }] };
      const i = st.reserve.length - 1;
      const fits = rules.legalPlacements(st).some((p) => p.from === 'reserve' && p.i === i);
      const v = rules.pieceValue(s, id);
      if (fits) expect(v, id).not.toBeNull();
      if (v?.how === 'place') expect(fits, id).toBe(true);
    }
  });
});
