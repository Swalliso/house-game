// Tools (M3b; implementation-plan.md §5 "Shop goods" ToolDef/ToolUse, Appendix A · M3a and
// M3b "Tools", Appendix B "Tools"; D-075 for the Weekend Crew). One-shot free actions from the
// supplies, used only on the build screen:
// - move (Moving Truck), copy (Copy Machine), weekModifiers (Rush Order, Open House Party),
//   specialHand (Catalog), advanceTimers (Fertilizer), reward (Dumpster), levelSet (Remodel
//   Plans), extraPlay (Weekend Crew)
// - each is a free action: the week, slot, draws, and hand stay (the Catalog's draws + 1)
// - rules.canUseTool says why a use isn't allowed; rules.previewTool shows the house's pass
//   tally before and after
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts). Most houses are built on an empty 12×12
// lot with houseFrom, so uids follow the placement order (1, 2, …) and every piece has
// placedWeek 1. The street runs along the bottom edge (y = 11); rows 0–3 are the sunny side.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Card,
  Cell,
  Content,
  GameEvent,
  PieceId,
  PlaceAction,
  ReservePiece,
  Rot,
  RunState,
  Supply,
  ToolId,
  UseToolAction,
} from './index.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { drawHand, drawWeights, slotKey } from './draw.ts';
import { withFixture } from './fixtures.ts';
import { REASONS } from './placement.ts';
import { SHOP_REASONS } from './shop.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withPieces,
  type Placement,
} from './testing.ts';

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

// Targets far out of reach and 4-week phases, so no tally here ends the phase or opens the shop.
const BIG = content([100_000, 200_000], 4);
const R = createRules(BIG);

const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const use = (i: number, target?: UseToolAction['target']): UseToolAction =>
  target ? { t: 'useTool', i, target } : { t: 'useTool', i };
const moveTo = (i: number, uid: number, x: number, y: number, rot: Rot = 0): UseToolAction =>
  use(i, { uid, x, y, rot });
const place = (i: number, x: number, y: number, from: PlaceAction['from'] = 'hand'): Action => ({
  t: 'place',
  from,
  i,
  x,
  y,
  rot: 0,
});
const PASS: Action = { t: 'pass' };

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

/** Applies actions in turn; returns the last state and every event along the way. */
function applyAll(r: Rules, s: RunState, actions: readonly Action[]) {
  const events: GameEvent[] = [];
  for (const a of actions) {
    const out = r.apply(s, a);
    s = out.state;
    events.push(...out.events);
  }
  return { state: s, events };
}

/** A run in week 1 on a 12×12 lot (empty unless `rows`) with these pieces and supplies. */
function build(
  placements: readonly Placement[],
  opts: {
    tools?: readonly ToolId[];
    supplies?: readonly Supply[];
    hand?: readonly Card[];
    reserve?: readonly ReservePiece[];
    rows?: readonly string[];
    rules?: Rules;
    seed?: string;
  } = {},
): RunState {
  const r = opts.rules ?? R;
  const s = r.newRun(setup(opts.seed ?? 'tools'));
  return {
    ...s,
    house: houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: opts.hand ?? s.hand,
    reserve: opts.reserve ?? [],
    supplies: opts.supplies ?? (opts.tools ?? []).map(tool),
  };
}

const sortCells = (cells: readonly Cell[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => `${c.x},${c.y}`);

const earnedOf = (r: Rules, s: RunState, uid: number) =>
  r.currentTally(s).pieces.find((p) => p.uid === uid)!.earned;

const terrainAt = (s: RunState, x: number, y: number) =>
  s.house.lot.terrain[y * s.house.lot.width + x];

/**
 * A Jack-and-Jill on an empty lot (runloop.test.ts): two Bedrooms (3 each) and the Bathroom
 * between them (+3 for its Bedroom), plus the set's 10 Points and +50% Mult:
 * Points 9 + 10 = 19, Mult 150 → 19 × 1.5 = 28.5 → 29 a week.
 */
const JACK_AND_JILL: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['bedroom', 3, 0],
];

// ---------------------------------------------------------------------------------------

describe('tools are free actions on the build screen', () => {
  it('a use removes the supply, emits toolUsed, and keeps the week, slot, draws, and hand', () => {
    const s = build(JACK_AND_JILL, { tools: ['dumpster', 'rushOrder', 'catalog'] });
    const { state, events } = R.apply(s, use(1));
    expect(events).toEqual([{ t: 'toolUsed', tool: 'rushOrder' }]);
    // The Rush Order (index 1) is gone; the others keep their order.
    expect(state.supplies).toEqual([tool('dumpster'), tool('catalog')]);
    expect(state.week).toBe(s.week);
    expect(state.slot).toBe(s.slot);
    expect(state.draws).toBe(s.draws);
    expect(state.hand).toEqual(s.hand);
    expect(state.score).toBe(s.score);
    expect(state.screen).toBe('build');
  });

  it('there’s no tool at an empty index or at a fixture supply', () => {
    const s = build([['bedroom', 0, 0]], {
      supplies: [{ kind: 'fixture', id: 'fireplace' }, tool('rushOrder')],
    });
    const none = { ok: false, reason: 'There’s no tool there.' };
    expect(R.canUseTool(s, use(0))).toEqual(none);
    expect(R.canUseTool(s, use(2))).toEqual(none);
    expect(R.canUseTool(s, use(-1))).toEqual(none);
    expect(R.canUseTool(s, use(0.5))).toEqual(none);
    expect(() => R.apply(s, use(0))).toThrow(IllegalAction);
    expect(R.canUseTool(s, use(1))).toEqual({ ok: true });
  });

  it('can’t be used in the shop: apply throws, and canUseTool and previewTool say why', () => {
    // TEST_CONTENT: phase 1's target is 5 over 2 weeks, so meeting it and passing twice opens
    // shop 1.
    const r = createRules(C);
    let s = r.newRun(setup('tools-shop'));
    s = { ...s, score: r.target(s) };
    s = applyAll(r, s, [PASS, PASS]).state;
    expect(s.screen).toBe('shop');
    s = { ...s, supplies: [tool('rushOrder')] };
    expect(() => r.apply(s, use(0))).toThrow(IllegalAction);
    const reason = 'Tools are used while building.';
    expect(r.canUseTool(s, use(0))).toEqual({ ok: false, reason });
    const p = r.previewTool(s, use(0));
    expect(p.ok).toBe(false);
    expect(p.reason).toBe(reason);
    expect(p.delta).toBe(0);
    expect(p.cells).toEqual([]);
    // Nothing on the shop screen's legal list uses a tool.
    expect(r.legalActions(s).some((a) => a.t === 'useTool')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------

describe('Moving Truck (move)', () => {
  it('moves a piece with its fixture, keeping its uid, timers, and place in the order', () => {
    // Bedroom (uid 1) with a Fireplace and 1 week of Fertilizer, the Bathroom (uid 2) beside it,
    // a Lawn (uid 3). Passing first makes it week 2, so a fresh placement would say week 2.
    let s = build(
      [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['lawn', 0, 6],
      ],
      { tools: ['movingTruck'] },
    );
    s = R.apply(s, PASS).state;
    expect(s.week).toBe(2);
    const house = withFixture(s.house, 1, 'fireplace', 1);
    s = {
      ...s,
      house: {
        ...house,
        pieces: house.pieces.map((p) => (p.uid === 1 ? { ...p, ageBonus: 1 } : p)),
      },
    };

    // To (3, 0): on the Bathroom's other side, so the house stays connected.
    const { state, events } = R.apply(s, moveTo(0, 1, 3, 0));
    expect(state.house.pieces.map((p) => p.uid)).toEqual([1, 2, 3]);
    expect(state.house.pieces[0]).toEqual({
      uid: 1,
      defId: 'bedroom',
      x: 3,
      y: 0,
      rot: 0,
      placedWeek: 1,
      ageBonus: 1,
      fixture: { id: 'fireplace', week: 1 },
    });
    expect(state.house.pieces.slice(1)).toEqual(s.house.pieces.slice(1));
    expect(state.house.nextUid).toBe(s.house.nextUid);
    expect(state.supplies).toEqual([]);
    expect(state.week).toBe(2);
    expect(state.draws).toBe(s.draws);
    expect(state.hand).toEqual(s.hand);

    expect(types(events)).toEqual(['toolUsed', 'moved']);
    expect(events[0]).toEqual({ t: 'toolUsed', tool: 'movingTruck', uid: 1 });
    const moved = eventsOf(events, 'moved')[0]!;
    expect(moved.uid).toBe(1);
    expect(moved.defId).toBe('bedroom');
    expect(sortCells(moved.from)).toEqual(['0,0', '1,0', '0,1', '1,1']);
    expect(sortCells(moved.cells)).toEqual(['3,0', '4,0', '3,1', '4,1']);
    expect(moved.clearedTrees).toEqual([]);
  });

  it('a move can overlap the piece’s own old tiles, and can rotate it', () => {
    // The Hallway (##) at (0, 5), alone: one tile right, then upright at (0, 5).
    const s = build([['hallway', 0, 5]], { tools: ['movingTruck', 'movingTruck'] });
    expect(R.canUseTool(s, moveTo(0, 1, 1, 5))).toEqual({ ok: true });
    const { state } = R.apply(s, moveTo(0, 1, 0, 5, 1));
    expect(state.house.pieces[0]).toMatchObject({ x: 0, y: 5, rot: 1 });
  });

  it('says why a target isn’t a move', () => {
    const s = build(
      [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
      ],
      { tools: ['movingTruck'] },
    );
    const no = (reason: string) => ({ ok: false, reason });
    expect(R.canUseTool(s, use(0))).toEqual(no('Pick a piece to move.'));
    expect(R.canUseTool(s, use(0, { uid: 2 }))).toEqual(no('Pick a piece and a new spot for it.'));
    expect(R.canUseTool(s, moveTo(0, 2, 5, 5, 4 as Rot))).toEqual(
      no('Pick a piece and a new spot for it.'),
    );
    expect(R.canUseTool(s, moveTo(0, 99, 5, 5))).toEqual(no('Pick a piece to move.'));
    // The same spot and rotation isn't a move.
    expect(R.canUseTool(s, moveTo(0, 2, 2, 0))).toEqual(no('Pick a new spot for it.'));
    expect(R.canUseTool(s, moveTo(0, 2, 0, 0))).toEqual(no(REASONS.occupied));
    expect(R.canUseTool(s, moveTo(0, 2, 12, 0))).toEqual(no(REASONS.offLot));
    // An indoor piece must still touch the house.
    expect(R.canUseTool(s, moveTo(0, 2, 8, 8))).toEqual(no(REASONS.disconnected));
    expect(() => R.apply(s, moveTo(0, 2, 8, 8))).toThrow(REASONS.disconnected);
  });

  it('can’t split the house: the Bathroom between two Bedrooms stays', () => {
    const s = build(JACK_AND_JILL, { tools: ['movingTruck'] });
    // Without the Bathroom, the Bedrooms at x 0–1 and x 3–4 don't touch.
    expect(R.canUseTool(s, moveTo(0, 2, 0, 2))).toEqual({ ok: false, reason: REASONS.split });
    // An end Bedroom can go: the other two still touch.
    expect(R.canUseTool(s, moveTo(0, 3, 2, 1))).toEqual({ ok: true });
  });

  it('checks the new spot as a fresh placement: terrain and blocking requirements', () => {
    const rows = emptyRows(12, 12);
    rows[2] = '......P.....';
    rows[4] = '......SS....';
    rows[5] = '......SS....';
    // A Garage (uid 1) touching the street; a Lawn (uid 2).
    const s = build(
      [
        ['garage', 0, 10],
        ['lawn', 0, 0],
      ],
      { rows, tools: ['movingTruck'] },
    );
    expect(R.canUseTool(s, moveTo(0, 2, 5, 2))).toEqual({ ok: false, reason: REASONS.pond });
    expect(R.canUseTool(s, moveTo(0, 2, 5, 4))).toEqual({ ok: false, reason: REASONS.oldShed });
    // The Garage must touch the street (or a Driveway): the same reason a Garage card gets on
    // the house without it.
    const withoutGarage: RunState = {
      ...s,
      house: { ...s.house, pieces: s.house.pieces.filter((p) => p.uid !== 1) },
      hand: [pc('garage')],
    };
    const fresh = R.checkPlay(withoutGarage, {
      t: 'place',
      from: 'hand',
      i: 0,
      x: 4,
      y: 7,
      rot: 0,
    });
    expect(fresh.legal).toBe(false);
    expect(fresh.reason).toMatch(/^Garage must be built/);
    expect(R.canUseTool(s, moveTo(0, 1, 4, 7))).toEqual({ ok: false, reason: fresh.reason });
    // Along the street it's fine.
    expect(R.canUseTool(s, moveTo(0, 1, 4, 10))).toEqual({ ok: true });
  });

  it('building over a Tree clears it', () => {
    const rows = emptyRows(12, 12);
    rows[6] = '......T.....';
    const s = build([['lawn', 0, 8]], { rows, tools: ['movingTruck'] });
    const { state, events } = R.apply(s, moveTo(0, 1, 6, 6));
    expect(eventsOf(events, 'moved')[0]!.clearedTrees).toEqual([{ x: 6, y: 6 }]);
    expect(terrainAt(state, 6, 6)).toBeNull();
    expect(terrainAt(s, 6, 6)).toBe('tree');
  });

  it('a Time Capsule under the new spot is cleared and pays its +3 budget', () => {
    // The capsule is looked up on the lot before the move (the moved house's lot no longer has it).
    const rows = emptyRows(12, 12);
    rows[7] = '.......K....';
    const s = build([['lawn', 0, 8]], { rows, tools: ['movingTruck'] });
    expect(terrainAt(s, 7, 7)).toBe('timeCapsule');
    const { state, events } = R.apply(s, moveTo(0, 1, 6, 6));
    expect(terrainAt(state, 7, 7)).toBeNull();
    // Only Trees are listed as cleared trees.
    expect(eventsOf(events, 'moved')[0]!.clearedTrees).toEqual([]);
    expect(eventsOf(events, 'findClaimed')).toEqual([
      { t: 'findClaimed', feature: 'timeCapsule', x: 7, y: 7, reward: { budget: 3 } },
    ]);
    expect(state.budget).toBe(s.budget + 3);
    expect(state.budgetEarned).toBe(s.budgetEarned + 3);
  });

  it('previewTool shows a move that changes neighbors, with the new cells', () => {
    // Kitchen (uid 1, 0,0), Bathroom (uid 2, 2,0) touching it, Bedroom (uid 3, 0,2) below it.
    // Now: Kitchen 0 (no Dining Room), Bathroom 0 (−2 for the Kitchen, floored at 0), Bedroom 3
    // (no Quiet neighbor) → 3. The Bathroom to (2, 2): it touches only the Bedroom: +3 → 6.
    const s = build(
      [
        ['kitchen', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 0, 2],
      ],
      { tools: ['movingTruck'] },
    );
    const p = R.previewTool(s, moveTo(0, 2, 2, 2));
    expect(p).toEqual({
      ok: true,
      before: { points: 3, mult: 100, total: 3 },
      after: { points: 6, mult: 100, total: 6 },
      delta: 3,
      cells: [{ x: 2, y: 2 }],
    });
    // And the move does what it previewed.
    const { state } = R.apply(s, moveTo(0, 2, 2, 2));
    expect(R.currentTally(state).total).toBe(6);
    expect(earnedOf(R, state, 2)).toBe(3);
  });

  it('previewTool of an illegal move gives its reason and no change', () => {
    const s = build(JACK_AND_JILL, { tools: ['movingTruck'] });
    const p = R.previewTool(s, moveTo(0, 2, 0, 2));
    const now = { points: 19, mult: 150, total: 29 };
    expect(p).toEqual({
      ok: false,
      reason: REASONS.split,
      before: now,
      after: now,
      delta: 0,
      cells: [],
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('Copy Machine (copy)', () => {
  const placements: Placement[] = [
    ['bedroom', 0, 0],
    ['lawn', 0, 6],
  ];

  it('puts a placed piece’s card in the reserve', () => {
    const s = build(placements, { tools: ['copyMachine'], reserve: [{ id: 'closet' }] });
    const { state, events } = R.apply(s, use(0, { uid: 2 }));
    expect(events).toEqual([{ t: 'toolUsed', tool: 'copyMachine', uid: 2 }]);
    expect(state.reserve).toEqual([{ id: 'closet' }, { id: 'lawn' }]);
    // The house is untouched.
    expect(state.house).toEqual(s.house);
    expect(state.supplies).toEqual([]);
  });

  it('needs a piece and a free reserve slot; crew pieces don’t count', () => {
    const s = build(placements, { tools: ['copyMachine'] });
    const pick = { ok: false, reason: 'Pick a piece to copy.' };
    expect(R.canUseTool(s, use(0))).toEqual(pick);
    expect(R.canUseTool(s, use(0, { uid: 99 }))).toEqual(pick);
    // reserveSlots 2: two bought pieces fill it.
    const full = { ...s, reserve: [{ id: 'closet' }, { id: 'lawn' }] as ReservePiece[] };
    expect(R.canUseTool(full, use(0, { uid: 1 }))).toEqual({
      ok: false,
      reason: SHOP_REASONS.reserveFull,
    });
    // A crew piece sits in an extra slot: 1 of 2 used.
    const crew = {
      ...s,
      reserve: [{ id: 'closet', crew: true }, { id: 'lawn' }] as ReservePiece[],
    };
    expect(R.canUseTool(crew, use(0, { uid: 1 }))).toEqual({ ok: true });
    expect(R.apply(crew, use(0, { uid: 1 })).state.reserve).toHaveLength(3);
    // A Storage Unit (+1 reserve slot) makes room too.
    expect(R.canUseTool({ ...full, upgrades: ['storageUnit'] }, use(0, { uid: 1 }))).toEqual({
      ok: true,
    });
  });

  it('the copy can be placed later as a week’s turn', () => {
    const s = build(placements, { tools: ['copyMachine'] });
    const copied = R.apply(s, use(0, { uid: 1 })).state;
    // A second Bedroom beside the first: both earn 3 + 1 (a Quiet neighbor).
    const { state, events } = R.apply(copied, place(0, 2, 0, 'reserve'));
    expect(state.reserve).toEqual([]);
    expect(eventsOf(events, 'placed')[0]!.defId).toBe('bedroom');
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(4 + 4 + 1);
  });
});

// ---------------------------------------------------------------------------------------

describe('Rush Order and Open House Party (weekModifiers)', () => {
  it('Rush Order: +0.5 Mult in previewTool, on a known house', () => {
    // Jack-and-Jill: 19 Points at ×1.5 = 29. Rush Order: ×2.0 → 38.
    const s = build(JACK_AND_JILL, { tools: ['rushOrder'] });
    expect(R.previewTool(s, use(0))).toEqual({
      ok: true,
      before: { points: 19, mult: 150, total: 29 },
      after: { points: 19, mult: 200, total: 38 },
      delta: 9,
      cells: [],
    });
  });

  it('adds a timed effect that counts in this week’s tally and is gone after it', () => {
    const s = build(JACK_AND_JILL, { tools: ['rushOrder'] });
    const used = R.apply(s, use(0)).state;
    expect(used.timedEffects).toEqual([
      { source: 'rushOrder', until: { week: 1 }, modifiers: [{ kind: 'mult', add: 50 }] },
    ]);
    expect(R.currentTally(used).multTerms).toEqual([
      { source: { kind: 'tool', id: 'rushOrder' }, label: 'Rush Order', add: 50 },
    ]);
    const week1 = R.apply(used, PASS);
    expect(eventsOf(week1.events, 'tally')[0]!.tally.total).toBe(38);
    expect(week1.state.timedEffects).toEqual([]);
    // Week 2 is back to 29.
    const week2 = R.apply(week1.state, PASS);
    expect(eventsOf(week2.events, 'tally')[0]!.tally.total).toBe(29);
    expect(week2.state.score).toBe(38 + 29);
  });

  it('also counts in a placement’s tally that same week', () => {
    // The week's turn: a Closet (steady 1) beside the Bedroom at (3, 0), which ignores it.
    // Points 19 + 1 = 20, × 2.0 → 40.
    const s = build(JACK_AND_JILL, { tools: ['rushOrder'], hand: [pc('closet')] });
    const used = R.apply(s, use(0)).state;
    const { events } = R.apply(used, place(0, 5, 0));
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(40);
  });

  it('applies to a manual complete-early’s fast-forwarded current week only', () => {
    // Phase 1: target 5 over 4 weeks. The Jack-and-Jill (29 a week) at week 1 with the target
    // met: completing early fast-forwards weeks 1–4. Rush Order counts in week 1 only.
    const r = createRules(content([5, 100_000], 4));
    let s = build(JACK_AND_JILL, { rules: r, tools: ['rushOrder'] });
    s = { ...s, score: 5 };
    s = r.apply(s, use(0)).state;
    const { state, events } = r.apply(s, { t: 'completeEarly' });
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => [t.week, t.fastForward, t.tally.total])).toEqual([
      [1, true, 38],
      [2, true, 29],
      [3, true, 29],
      [4, true, 29],
    ]);
    expect(eventsOf(events, 'milestone')[0]!.result).toBe('early');
    expect(state.timedEffects).toEqual([]);
  });

  it('Open House Party: Social and Pretty pieces earn +100% this week', () => {
    // Bedroom (uid 1, Quiet): 3. Patio (uid 2, Social): 0. Hot Tub (uid 3, Social) beside the
    // Patio: +3. Flower Bed (uid 4, Pretty) in the front yard: 1 + 2 = 3. Total 9.
    // With the party: the Hot Tub 3 → 6, the Flower Bed 3 → 6, the rest the same → 15.
    const s = build(
      [
        ['bedroom', 0, 0],
        ['patio', 6, 0],
        ['hotTub', 8, 0],
        ['flowerBed', 0, 8],
      ],
      { tools: ['openHouseParty'] },
    );
    expect(R.currentTally(s).pieces.map((p) => p.earned)).toEqual([3, 0, 3, 3]);
    const p = R.previewTool(s, use(0));
    expect(p.before.total).toBe(9);
    expect(p.after.total).toBe(15);
    expect(p.delta).toBe(6);
    const used = R.apply(s, use(0)).state;
    expect(R.currentTally(used).pieces.map((x) => x.earned)).toEqual([3, 0, 6, 6]);
    expect(used.timedEffects[0]!.source).toBe('openHouseParty');
    const next = R.apply(used, PASS).state;
    expect(R.currentTally(next).total).toBe(9);
  });
});

// ---------------------------------------------------------------------------------------

describe('Catalog (specialHand)', () => {
  it('redraws the hand from special pieces as a draw (n + 1) without a reroll', () => {
    const s = build([['bedroom', 0, 0]], { tools: ['catalog'], seed: 'catalog' });
    const { state, events } = R.apply(s, use(0));
    // The same stream a reroll would use: draw/<phase>/<slot>/<draws>, at the handSize rule (3).
    const expected = drawHand(BIG, 'catalog', 0, slotKey(1, 0), s.draws, 3, { special: true });
    expect(state.hand).toEqual(expected);
    expect(state.hand).toHaveLength(3);
    expect(events).toEqual([
      { t: 'toolUsed', tool: 'catalog' },
      {
        t: 'handDrawn',
        phase: 0,
        slot: 1,
        overtimeWeek: 0,
        hand: expected,
        free: false,
        reroll: false,
        special: true,
      },
    ]);
    expect(state.draws).toBe(s.draws + 1);
    expect(state.rerollsLeft).toBe(s.rerollsLeft);
    expect(state.bonusRerolls).toBe(s.bonusRerolls);
    expect(state.week).toBe(s.week);
    // Phase 0 has no fixtures (fromPhase 1): only special pieces (drawWeight 0).
    for (const card of state.hand) {
      expect(card.kind).toBe('piece');
      expect(BIG.pieces[card.id as PieceId].drawWeight).toBe(0);
    }
  });

  it('draws special pieces and drawable fixtures at equal weight, respecting fromPhase', () => {
    // The pool's weights: every special piece and every fixture with drawWeight > 0 at 100.
    const pool = drawWeights(C, 1, { special: true });
    expect(new Set(pool.map((p) => p.weight))).toEqual(new Set([100]));
    expect(pool.some((p) => p.card.kind === 'fixture' && p.card.id === 'chandelier')).toBe(false);
    expect(pool.filter((p) => p.card.kind === 'fixture')).toHaveLength(10);
    expect(pool.filter((p) => p.card.kind === 'piece')).toHaveLength(9);

    // In phase 1 (after shop 1 in TEST_CONTENT), fixtures come up too; the Chandelier never.
    const r = createRules(C);
    let sawFixture = false;
    for (let k = 0; k < 12; k++) {
      let s = r.newRun(setup(`catalog-${k}`));
      s = applyAll(r, { ...s, score: 5 }, [PASS, PASS, { t: 'leaveShop' }]).state;
      expect(s.phase).toBe(1);
      s = { ...s, supplies: [tool('catalog')] };
      const hand = r.apply(s, use(0)).state.hand;
      expect(hand).toEqual(
        drawHand(C, `catalog-${k}`, 1, slotKey(s.slot, s.overtimeWeek), s.draws, 3, {
          special: true,
        }),
      );
      for (const card of hand) {
        if (card.kind === 'fixture') {
          sawFixture = true;
          expect(card.id).not.toBe('chandelier');
        } else expect(C.pieces[card.id].drawWeight).toBe(0);
      }
    }
    expect(sawFixture).toBe(true);
  });

  it('skips struck types and special pieces from a later phase; its size is the handSize rule', () => {
    // The Pool from phase 1 on, and the Library struck: neither comes up in phase 0. With a
    // Bigger Truck (+1 handSize) the hand has 4 cards.
    const late = createRules(withPieces({ pool: { fromPhase: 1 } }, BIG));
    for (let k = 0; k < 15; k++) {
      let s = build([], { rules: late, seed: `catalog-strike-${k}`, tools: ['catalog'] });
      s = { ...s, struck: [pc('library')], upgrades: ['biggerTruck'] };
      const hand = late.apply(s, use(0)).state.hand;
      expect(hand).toHaveLength(4);
      expect(hand.map((c) => c.id)).not.toContain('pool');
      expect(hand.map((c) => c.id)).not.toContain('library');
    }
  });

  it('needs a hand to redraw', () => {
    const s = build([], { tools: ['catalog'], hand: [] });
    expect(R.canUseTool(s, use(0))).toEqual({ ok: false, reason: 'There’s no hand to redraw.' });
  });
});

// ---------------------------------------------------------------------------------------

describe('Fertilizer (advanceTimers)', () => {
  it('adds 2 to every piece’s ageBonus', () => {
    let s = build(
      [
        ['bedroom', 0, 0],
        ['lawn', 0, 6],
      ],
      { tools: ['fertilizer'] },
    );
    s = {
      ...s,
      house: {
        ...s.house,
        pieces: s.house.pieces.map((p) => (p.uid === 2 ? { ...p, ageBonus: 1 } : p)),
      },
    };
    const { state, events } = R.apply(s, use(0));
    expect(events).toEqual([{ t: 'toolUsed', tool: 'fertilizer' }]);
    expect(state.house.pieces.map((p) => p.ageBonus)).toEqual([2, 3]);
  });

  it('moves a Pool’s rhythm payment: previewTool, the timer text, and the weeks it pays', () => {
    // Pool (rhythm 12 every 3rd week) placed in week 1: age 0, so it pays at age 2 (week 3).
    // Fertilizer makes it age 2 now: +12 this week. With a Bedroom (3): 3 → 15.
    const placements: Placement[] = [
      ['bedroom', 0, 0],
      ['pool', 0, 6],
    ];
    const s = build(placements, { tools: ['fertilizer'] });
    expect(R.pieceTimers(s, 2)).toEqual(['Next +12: week 3']);
    expect(R.previewTool(s, use(0))).toEqual({
      ok: true,
      before: { points: 3, mult: 100, total: 3 },
      after: { points: 15, mult: 100, total: 15 },
      delta: 12,
      cells: [],
    });
    const used = R.apply(s, use(0)).state;
    expect(R.pieceTimers(used, 2)).toEqual(['Pays +12 this week']);

    const totals = (start: RunState) =>
      eventsOf(applyAll(R, start, [PASS, PASS, PASS, PASS]).events, 'tally').map(
        (t) => t.tally.total,
      );
    // Ages 2, 3, 4, 5 pay at 2 and 5 (weeks 1 and 4); without it, ages 0–3 pay at 2 (week 3).
    expect(totals(used)).toEqual([15, 3, 3, 15]);
    expect(totals(s)).toEqual([3, 3, 15, 3]);
  });

  it('brings a Sapling’s transform forward two weeks', () => {
    // A Sapling becomes a Tree after 4 weeks: placed in week 1, at the start of week 5. With
    // Fertilizer, ageOf = (week − 1) + 2 reaches 4 at the start of week 3.
    const s = build([['sapling', 5, 5]], { tools: ['fertilizer'] });
    const used = R.apply(s, use(0)).state;
    expect(R.pieceTimers(used, 1)).toEqual(['Becomes a Tree at the start of week 3']);
    const week1 = R.apply(used, PASS);
    expect(eventsOf(week1.events, 'transformed')).toEqual([]);
    const week2 = R.apply(week1.state, PASS);
    expect(eventsOf(week2.events, 'transformed')).toEqual([
      {
        t: 'transformed',
        uid: 1,
        defId: 'sapling',
        into: { feature: 'tree' },
        cells: [{ x: 5, y: 5 }],
      },
    ]);
    expect(week2.state.week).toBe(3);
    expect(terrainAt(week2.state, 5, 5)).toBe('tree');
    expect(week2.state.house.pieces).toEqual([]);
    // Without it, the Sapling is still there at the start of week 3.
    const plain = applyAll(R, s, [PASS, PASS]);
    expect(eventsOf(plain.events, 'transformed')).toEqual([]);
    expect(plain.state.house.pieces).toHaveLength(1);
  });

  it('counts for economy cadence and Growth', () => {
    // Garage (budget 1 every 3rd week) touching the street, placed this week: age 0, no budget.
    // At age 2 it pays this week.
    const garage = build([['garage', 0, 10]], { tools: ['fertilizer'] });
    expect(R.currentTally(garage).budget).toBe(0);
    expect(R.currentTally(R.apply(garage, use(0)).state).budget).toBe(1);

    // Good Bones (bought week 1): a room grows +1 × (age + 1), so a Bedroom earns 3 + 1 = 4 at
    // age 0 and 3 + 3 = 6 at age 2.
    let bones = build([['bedroom', 0, 0]], { tools: ['fertilizer'] });
    bones = { ...bones, blueprints: [{ id: 'goodBones', boughtWeek: 1 }] };
    const p = R.previewTool(bones, use(0));
    expect(p.before.total).toBe(4);
    expect(p.after.total).toBe(6);
  });
});

// ---------------------------------------------------------------------------------------

describe('Dumpster (reward) and Remodel Plans (levelSet)', () => {
  it('Dumpster: +2 demolitions', () => {
    const s = build([['bedroom', 0, 0]], { tools: ['dumpster'] });
    expect(s.demolitionsLeft).toBe(2);
    const { state, events } = R.apply(s, use(0));
    expect(state.demolitionsLeft).toBe(4);
    expect(events).toEqual([{ t: 'toolUsed', tool: 'dumpster' }]);
    expect(R.previewTool(s, use(0)).delta).toBe(0);
  });

  it('Remodel Plans: +1 level for the set type, paying set + (level − 1) × level', () => {
    // Jack-and-Jill: 10 Points and +50 Mult, +8 and +25 per level.
    // Level 2: (9 + 18) × 1.75 = 47.25 → 47. Level 3: (9 + 26) × 2.0 = 70.
    const s = build(JACK_AND_JILL, { tools: ['remodelJackAndJill', 'remodelJackAndJill'] });
    expect(s.setLevels).toEqual({});
    expect(R.previewTool(s, use(0))).toEqual({
      ok: true,
      before: { points: 19, mult: 150, total: 29 },
      after: { points: 27, mult: 175, total: 47 },
      delta: 18,
      cells: [],
    });
    const l2 = R.apply(s, use(0));
    expect(l2.events).toEqual([{ t: 'toolUsed', tool: 'remodelJackAndJill' }]);
    expect(l2.state.setLevels).toEqual({ jackAndJill: 2 });
    const l3 = R.apply(l2.state, use(0)).state;
    expect(l3.setLevels).toEqual({ jackAndJill: 3 });
    expect(R.currentTally(l3).sets[0]).toMatchObject({ points: 26, mult: 100 });
    expect(R.currentTally(l3).total).toBe(70);
    // The level lasts for the run.
    const later = applyAll(R, l3, [PASS, PASS]).state;
    expect(R.currentTally(later).total).toBe(70);
    // The other set's plans don't touch it.
    const other = build(JACK_AND_JILL, { tools: ['remodelEntertainer'] });
    const o = R.apply(other, use(0)).state;
    expect(o.setLevels).toEqual({ entertainer: 2 });
    expect(R.currentTally(o).total).toBe(29);
  });

  it('Remodel Plans for a set the content lacks can’t be used', () => {
    const noEntertainer: Content = {
      ...BIG,
      sets: { jackAndJill: BIG.sets.jackAndJill } as Content['sets'],
    };
    const r = createRules(noEntertainer);
    const s = build([], { rules: r, tools: ['remodelEntertainer'] });
    expect(r.canUseTool(s, use(0))).toEqual({
      ok: false,
      reason: 'That set isn’t in the game yet.',
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('Weekend Crew (extraPlay, D-075)', () => {
  const hand = [pc('bedroom'), pc('closet'), pc('lawn')];

  it('makes the week’s next placement free: no tally, and the following play ends the week', () => {
    const s = build([], { tools: ['weekendCrew'], hand });
    expect(s.freePlay).toBe('none');
    const ready = R.apply(s, use(0));
    expect(ready.events).toEqual([{ t: 'toolUsed', tool: 'weekendCrew' }]);
    expect(ready.state.freePlay).toBe('ready');

    // The Bedroom at (0, 0): placed with free: true, nothing else.
    const free = R.apply(ready.state, place(0, 0, 0));
    expect(types(free.events)).toEqual(['placed']);
    expect(free.events[0]).toMatchObject({
      t: 'placed',
      uid: 1,
      defId: 'bedroom',
      x: 0,
      y: 0,
      rot: 0,
      clearedTrees: [],
      free: true,
    });
    expect(free.state.freePlay).toBe('used');
    expect(free.state.week).toBe(1);
    expect(free.state.draws).toBe(s.draws);
    expect(free.state.hand).toEqual([pc('closet'), pc('lawn')]);
    expect(free.state.score).toBe(0);

    // The Closet beside it ends the week: one tally, for both: Bedroom 3 + Closet 1 = 4.
    const second = R.apply(free.state, place(0, 2, 0));
    expect(types(second.events).slice(0, 3)).toEqual(['placed', 'tally', 'handDrawn']);
    expect(second.events[0]).not.toHaveProperty('free');
    const tallies = eventsOf(second.events, 'tally');
    expect(tallies).toHaveLength(1);
    expect(tallies[0]!.week).toBe(1);
    expect(tallies[0]!.tally.total).toBe(4);
    expect(second.state.week).toBe(2);
    expect(second.state.house.pieces).toHaveLength(2);
    // A new week: the crew is gone.
    expect(second.state.freePlay).toBe('none');
  });

  it('one a week: a second can’t be used until the next week', () => {
    const s = build([], { tools: ['weekendCrew', 'weekendCrew'], hand });
    const reason = 'A Weekend Crew already worked this week.';
    const ready = R.apply(s, use(0)).state;
    expect(R.canUseTool(ready, use(0))).toEqual({ ok: false, reason });
    expect(() => R.apply(ready, use(0))).toThrow(reason);
    const used = R.apply(ready, place(0, 0, 0)).state;
    expect(R.canUseTool(used, use(0))).toEqual({ ok: false, reason });
    // The next play ends the week; next week the second crew can work.
    const next = R.apply(used, place(0, 2, 0)).state;
    expect(next.week).toBe(2);
    expect(R.canUseTool(next, use(0))).toEqual({ ok: true });
  });

  it('a pass still ends the week, and the unused crew doesn’t carry over', () => {
    const s = build([], { tools: ['weekendCrew'], hand });
    const ready = R.apply(s, use(0)).state;
    const { state, events } = R.apply(ready, PASS);
    expect(eventsOf(events, 'tally')).toHaveLength(1);
    expect(state.week).toBe(2);
    expect(state.freePlay).toBe('none');
  });

  it('works from the reserve', () => {
    const s = build([], { tools: ['weekendCrew'], hand, reserve: [{ id: 'lawn' }] });
    const ready = R.apply(s, use(0)).state;
    const { state, events } = R.apply(ready, place(0, 5, 5, 'reserve'));
    expect(types(events)).toEqual(['placed']);
    expect(eventsOf(events, 'placed')[0]).toMatchObject({ defId: 'lawn', free: true });
    expect(state.reserve).toEqual([]);
    expect(state.hand).toEqual(hand);
    expect(state.freePlay).toBe('used');
    expect(state.week).toBe(1);
  });

  it('works with a hand install; a supplies install doesn’t use it up', () => {
    const fireplace: Card = { kind: 'fixture', id: 'fireplace' };
    const s = build([['bedroom', 0, 0]], {
      supplies: [tool('weekendCrew'), { kind: 'fixture', id: 'skylight' }],
      hand: [fireplace, pc('closet')],
    });
    const ready = R.apply(s, use(0)).state;
    // The Skylight from the supplies: a free action anyway, so the crew is still ready.
    const sky = R.apply(ready, { t: 'install', from: 'supplies', i: 0, uid: 1 });
    expect(sky.events).toEqual([{ t: 'installed', uid: 1, fixture: 'skylight', from: 'supplies' }]);
    expect(sky.state.freePlay).toBe('ready');
    // The Fireplace from the hand (replacing the Skylight) is the free play.
    const { state, events } = R.apply(sky.state, { t: 'install', from: 'hand', i: 0, uid: 1 });
    expect(events).toEqual([
      {
        t: 'installed',
        uid: 1,
        fixture: 'fireplace',
        from: 'hand',
        replaced: 'skylight',
        free: true,
      },
    ]);
    expect(state.hand).toEqual([pc('closet')]);
    expect(state.freePlay).toBe('used');
    expect(state.week).toBe(1);
    expect(state.house.pieces[0]!.fixture).toEqual({ id: 'fireplace', week: 1 });
  });

  it('a free play over a Time Capsule pays its +3 budget', () => {
    const rows = emptyRows(12, 12);
    rows[5] = '.....K......';
    const s = build([], { rows, tools: ['weekendCrew'], hand });
    const ready = R.apply(s, use(0)).state;
    // The Lawn (2×2) at (5, 5) covers the capsule.
    const { state, events } = R.apply(ready, place(2, 5, 5));
    expect(types(events)).toEqual(['placed', 'findClaimed']);
    expect(eventsOf(events, 'findClaimed')[0]).toEqual({
      t: 'findClaimed',
      feature: 'timeCapsule',
      x: 5,
      y: 5,
      reward: { budget: 3 },
    });
    expect(state.budget).toBe(s.budget + 3);
    expect(state.budgetEarned).toBe(s.budgetEarned + 3);
    expect(terrainAt(state, 5, 5)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------

describe('legalActions on the build screen', () => {
  it('lists each Copy Machine target and one use of the others; no Moving Truck moves', () => {
    const s = build(
      [
        ['bedroom', 0, 0],
        ['lawn', 0, 6],
      ],
      { tools: ['movingTruck', 'copyMachine', 'rushOrder', 'weekendCrew'] },
    );
    const uses = R.legalActions(s).filter((a) => a.t === 'useTool');
    expect(uses).toEqual([use(1, { uid: 1 }), use(1, { uid: 2 }), use(2), use(3)]);
    // Uses that canUseTool refuses aren't listed: a full reserve, a crew that already worked.
    const blocked: RunState = {
      ...s,
      reserve: [{ id: 'closet' }, { id: 'closet' }],
      freePlay: 'ready',
    };
    expect(R.legalActions(blocked).filter((a) => a.t === 'useTool')).toEqual([use(2)]);
    // Every listed use applies.
    for (const a of uses) expect(() => R.apply(s, a)).not.toThrow();
  });

  it('lists the Catalog only while there’s a hand', () => {
    const s = build([['bedroom', 0, 0]], { tools: ['catalog'], hand: [pc('closet')] });
    expect(R.legalActions(s).filter((a) => a.t === 'useTool')).toEqual([use(0)]);
    expect(R.legalActions({ ...s, hand: [] }).filter((a) => a.t === 'useTool')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------

describe('property: a tool use is a free action', () => {
  const TOOLS: readonly ToolId[] = [
    'movingTruck',
    'copyMachine',
    'rushOrder',
    'openHouseParty',
    'catalog',
    'fertilizer',
    'dumpster',
    'remodelJackAndJill',
    'remodelEntertainer',
    'weekendCrew',
  ];

  /** A legal use of the run's only supply: the first legal move for the Moving Truck. */
  function firstUse(s: RunState): UseToolAction | null {
    if (s.supplies[0]?.kind === 'tool' && s.supplies[0].id === 'movingTruck') {
      const { width, height } = s.house.lot;
      for (const p of s.house.pieces) {
        for (const rot of [0, 1, 2, 3] as Rot[]) {
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const a = moveTo(0, p.uid, x, y, rot);
              if (R.canUseTool(s, a).ok) return a;
            }
          }
        }
      }
      return null;
    }
    const a = R.legalActions(s).find((x): x is UseToolAction => x.t === 'useTool');
    return a ?? null;
  }

  /** The next week's first hand (not a free redraw) after a pass. */
  const nextHand = (s: RunState) =>
    eventsOf(R.apply(s, PASS).events, 'handDrawn').find((e) => !e.free)!.hand;

  for (const seed of ['prop-1', 'prop-2', 'prop-3', 'prop-4', 'prop-5']) {
    it(`never changes the week, slot, or later hands (seed ${seed}); only the Catalog redraws`, () => {
      // Two weeks of the first legal placement, so the house has pieces to move and copy.
      let base = R.newRun(setup(seed));
      for (let k = 0; k < 2; k++) {
        const play = R.legalPlacements(base)[0];
        base = R.apply(base, play ?? PASS).state;
      }
      expect(base.house.pieces.length).toBeGreaterThan(0);
      const baseNext = nextHand(base);
      for (const id of TOOLS) {
        const s: RunState = { ...base, supplies: [tool(id)] };
        const a = firstUse(s);
        expect(a, id).not.toBeNull();
        const { state } = R.apply(s, a!);
        expect(state.supplies, id).toEqual([]);
        expect([state.week, state.slot, state.phase, state.overtimeWeek], id).toEqual([
          s.week,
          s.slot,
          s.phase,
          s.overtimeWeek,
        ]);
        expect(state.rerollsLeft, id).toBe(s.rerollsLeft);
        if (id === 'catalog') {
          expect(state.draws).toBe(s.draws + 1);
        } else {
          expect(state.draws, id).toBe(s.draws);
          expect(state.hand, id).toEqual(s.hand);
        }
        // Next week's hand is the one it would have been.
        expect(nextHand(state), id).toEqual(baseNext);
        // previewTool's `after` is what the week's pass then scores.
        const tally = eventsOf(R.apply(state, PASS).events, 'tally')[0]!;
        expect(R.previewTool(s, a!).after.total, id).toBe(tally.tally.total);
      }
    });
  }
});
