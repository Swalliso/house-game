// Renovate (M4a; house-systems-review.md §4 "Settling in: Renovate" and its M4a list; D-083 and
// D-070 as settled for it; D-043 as amended for the half-weight draws). A room card whose root
// type is at its limit can be played on a placed room of that type instead of being placed:
// the room gains a level, and each level adds `renovate.pointsPerLevel` flat Comfort before
// percentages, up to `renovate.maxLevel`.
// - a limit is a checklist `count` with a `max` over `{ piece }` (through `and` and the current
//   `stages` stage); a type is at its limit when the weighted count (Bunk Beds: 2) ≥ max
// - a Renovation is the week's play, from the hand or the reserve; Weekend Crew can make it free
// - a card that can only renovate doesn't count as fitting, for the free redraw
// - while a type is at its limit, its cards draw at `drawAtLimitPct` of their weight
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts), whose clients have empty checklists; these
// give the Hendersons one with withClient. Houses are built on an empty 12×12 lot with houseFrom,
// so uids follow the placement order and every piece has placedWeek 1. The street runs along the
// bottom edge (y = 11). TEST_BALANCE: +4 Comfort a level, 2 levels at most, half weight at a
// limit, and each spec met adds +0.25 to the Mult (25 in hundredths).

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Card,
  Cell,
  Content,
  GameEvent,
  Modifier,
  PieceId,
  RenovateAction,
  ReservePiece,
  RunCodeData,
  RunState,
  SpecDef,
  Supply,
  ToolId,
  UseToolAction,
} from './index.ts';
import { drawHand, drawWeights, slotKey } from './draw.ts';
import { placedCells } from './grid.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { base64urlEncode, contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import {
  drawnBefore,
  drawRows,
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  withPieces,
  type Placement,
} from './testing.ts';

// ---------------------------------------------------------------------------------------
// Checklists and content.

const ONE_KITCHEN: SpecDef = {
  id: 'oneKitchen',
  name: 'One Kitchen',
  group: 'household',
  condition: { count: { piece: 'kitchen' }, min: 1, max: 1 },
};

/** Two ceilings in one line, through `and`: 1–2 Living Rooms, and at most one Dining Room. */
const LIVING_ROOMS: SpecDef = {
  id: 'livingRooms',
  name: 'A living room or two',
  group: 'household',
  condition: {
    and: [
      { count: { piece: 'livingRoom' }, min: 1, max: 2 },
      { count: { piece: 'diningRoom' }, max: 1 },
    ],
  },
};

/** A Bedroom range that steps up: 1–2 in the first phase, 2–3 from the second. */
const ROOM_FOR_EVERYONE: SpecDef = {
  id: 'roomForEveryone',
  name: 'Room for everyone',
  group: 'household',
  condition: {
    stages: [
      { fromPhase: 0, condition: { count: { piece: 'bedroom' }, min: 1, max: 2 } },
      { fromPhase: 1, condition: { count: { piece: 'bedroom' }, min: 2, max: 3 } },
    ],
  },
};

/**
 * The Hendersons with this checklist (and tastes), far-off targets, and 4-week phases, so no
 * tally here ends a phase or opens the shop.
 */
function contentWith(
  specs: readonly SpecDef[],
  opts: { tastes?: readonly Modifier[]; base?: Content; balance?: Partial<Balance> } = {},
): Content {
  const base = withClient({ specs, tastes: opts.tastes ?? [] }, opts.base ?? C);
  return {
    ...base,
    balance: {
      ...base.balance,
      weeksPerPhase: 4,
      phases: [
        { name: 'Phase 1', target: 100_000 },
        { name: 'Phase 2', target: 200_000 },
      ],
      ...opts.balance,
    },
  };
}

const K = contentWith([ONE_KITCHEN]);
const R = createRules(K);

const KITCHEN_AT_LIMIT: ReadonlySet<PieceId> = new Set<PieceId>(['kitchen']);

// ---------------------------------------------------------------------------------------
// Helpers.

const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const renovate = (
  i: number,
  uid: number,
  from: RenovateAction['from'] = 'hand',
): RenovateAction => ({ t: 'renovate', from, i, uid });
const use = (i: number, target?: UseToolAction['target']): UseToolAction =>
  target ? { t: 'useTool', i, target } : { t: 'useTool', i };
const PASS: Action = { t: 'pass' };

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);

function eventsOf<T extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: T,
): Extract<GameEvent, { t: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
}

const isKitchenCard = (c: Card) =>
  c.kind === 'piece' && (c.id === 'kitchen' || c.id === 'lKitchen');

/**
 * A run in week 1 on a 12×12 lot (empty unless `rows`) with these pieces (and room levels,
 * by uid), cards, and supplies. The hand is empty unless given.
 */
function build(
  placements: readonly Placement[],
  opts: {
    rules?: Rules;
    rows?: readonly string[];
    levels?: Readonly<Record<number, number>>;
    hand?: readonly Card[];
    reserve?: readonly ReservePiece[];
    supplies?: readonly Supply[];
    seed?: string;
  } = {},
): RunState {
  const r = opts.rules ?? R;
  const s = r.newRun(setup(opts.seed ?? 'renovate'));
  const house = houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements);
  const levels = opts.levels ?? {};
  return {
    ...s,
    house: {
      ...house,
      pieces: house.pieces.map((p) => {
        const level = levels[p.uid];
        return level ? { ...p, level } : p;
      }),
    },
    hand: opts.hand ?? [],
    reserve: opts.reserve ?? [],
    supplies: opts.supplies ?? [],
  };
}

const pieceOf = (s: RunState, uid: number) => s.house.pieces.find((p) => p.uid === uid);
const scoreOf = (r: Rules, s: RunState, uid: number) =>
  r.currentTally(s).pieces.find((p) => p.uid === uid)!;
const sortCells = (cells: readonly Cell[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => `${c.x},${c.y}`);
const weightOf = (list: ReturnType<typeof drawWeights>, id: PieceId) =>
  list.find((w) => w.card.kind === 'piece' && w.card.id === id)?.weight;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** A run code from raw JSON, so a test can put anything in it. ASCII only. */
function rawCode(payload: unknown): string {
  const json = JSON.stringify(payload);
  expect(json).toMatch(/^[\x20-\x7e]*$/);
  return 'OH1.' + base64urlEncode([...json].map((c) => c.charCodeAt(0)));
}

// ---------------------------------------------------------------------------------------

describe('when a Renovation is legal', () => {
  it('a Kitchen card at the Kitchen limit renovates the Kitchen; checkPlay gives the room’s cells', () => {
    const s = build([['kitchen', 3, 4]], { hand: [pc('kitchen')] });
    expect(R.limits(s)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    const check = R.checkPlay(s, renovate(0, 1));
    expect(check.legal).toBe(true);
    expect(check.reason).toBeUndefined();
    expect(sortCells(check.cells)).toEqual(['3,4', '4,4', '3,5', '4,5']);
    expect(check.clearedTrees).toEqual([]);
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([1]);
  });

  it('works by root type: an L-Kitchen card renovates a Kitchen, and a Kitchen card an L-Kitchen', () => {
    // The L-Kitchen counts as a Kitchen, so either one puts the house at its one-Kitchen limit.
    const onKitchen = build([['kitchen', 0, 0]], { hand: [pc('lKitchen')] });
    const onL = build([['lKitchen', 5, 5, 1]], { hand: [pc('kitchen')] });
    expect(R.limits(onL)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    expect(R.checkPlay(onKitchen, renovate(0, 1)).legal).toBe(true);
    const check = R.checkPlay(onL, renovate(0, 1));
    expect(check.legal).toBe(true);
    expect(sortCells(check.cells)).toEqual(
      sortCells(placedCells(C.pieces.lKitchen.shape, 5, 5, 1)),
    );
    // The event names the room's type and the card's.
    expect(eventsOf(R.apply(onKitchen, renovate(0, 1)).events, 'renovated')).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 1, card: 'lKitchen' },
    ]);
    expect(eventsOf(R.apply(onL, renovate(0, 1)).events, 'renovated')).toEqual([
      { t: 'renovated', uid: 1, defId: 'lKitchen', level: 1, card: 'kitchen' },
    ]);
  });

  it('below the limit it’s illegal, with a reason, and lists no rooms', () => {
    // A living room or two: one Living Room is below its ceiling of 2.
    const r = createRules(contentWith([LIVING_ROOMS]));
    const s = build([['livingRoom', 0, 0]], { rules: r, hand: [pc('livingRoom')] });
    expect(r.limits(s)).toEqual([
      { types: ['livingRoom'], max: 2, count: 1 },
      { types: ['diningRoom'], max: 1, count: 0 },
    ]);
    const reason =
      'A Living Room card can renovate once the house has all the Living Rooms it wants.';
    expect(r.checkPlay(s, renovate(0, 1))).toEqual({
      legal: false,
      reason,
      cells: [],
      clearedTrees: [],
    });
    expect(() => r.apply(s, renovate(0, 1))).toThrow(IllegalAction);
    expect(() => r.apply(s, renovate(0, 1))).toThrow(reason);
    expect(r.renovateTargets(s, 'hand', 0)).toEqual([]);
    expect(r.preview(s, renovate(0, 1))).toMatchObject({ legal: false, reason, delta: 0 });
    expect(r.legalPlays(s).some((p) => p.t === 'renovate')).toBe(false);
    // A second Living Room reaches the ceiling: now either one can be renovated.
    const two = build(
      [
        ['livingRoom', 0, 0],
        ['livingRoom', 2, 0],
      ],
      { rules: r, hand: [pc('livingRoom')] },
    );
    expect(r.renovateTargets(two, 'hand', 0)).toEqual([1, 2]);
  });

  it('a room of another type is illegal, even one at its own limit', () => {
    const r = createRules(contentWith([ONE_KITCHEN, LIVING_ROOMS]));
    // The Kitchen (uid 1) and the Dining Room (uid 2) are each at their ceiling of 1.
    const house: Placement[] = [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ];
    const kitchenCard = build(house, { rules: r, hand: [pc('kitchen')] });
    expect(r.checkPlay(kitchenCard, renovate(0, 2))).toMatchObject({
      legal: false,
      reason: 'A Kitchen card renovates a Kitchen.',
      cells: [],
    });
    expect(() => r.apply(kitchenCard, renovate(0, 2))).toThrow(
      'A Kitchen card renovates a Kitchen.',
    );
    expect(r.renovateTargets(kitchenCard, 'hand', 0)).toEqual([1]);
    const diningCard = build(house, { rules: r, hand: [pc('diningRoom')] });
    expect(r.checkPlay(diningCard, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'A Dining Room card renovates a Dining Room.',
    });
    expect(r.renovateTargets(diningCard, 'hand', 0)).toEqual([2]);
  });

  it('a room at the top level is illegal; maxLevel comes from the balance', () => {
    const top = build([['kitchen', 0, 0]], { hand: [pc('kitchen')], levels: { 1: 2 } });
    expect(R.checkPlay(top, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'That Kitchen is fully renovated.',
    });
    expect(() => R.apply(top, renovate(0, 1))).toThrow('That Kitchen is fully renovated.');
    expect(R.renovateTargets(top, 'hand', 0)).toEqual([]);
    // One level below the top: legal, and it reaches the top.
    const one = build([['kitchen', 0, 0]], { hand: [pc('kitchen')], levels: { 1: 1 } });
    expect(R.preview(one, renovate(0, 1)).renovates).toEqual({ uid: 1, level: 2 });
    // An L-Kitchen at the top says so by its own name.
    const l = build([['lKitchen', 0, 0]], { hand: [pc('kitchen')], levels: { 1: 2 } });
    expect(R.checkPlay(l, renovate(0, 1)).reason).toBe('That L-Kitchen is fully renovated.');
    // With a maxLevel of 3, level 2 can go up once more.
    const renovate3 = { ...K.balance.renovate, maxLevel: 3 };
    const r3 = createRules(contentWith([ONE_KITCHEN], { balance: { renovate: renovate3 } }));
    const two = build([['kitchen', 0, 0]], { rules: r3, hand: [pc('kitchen')], levels: { 1: 2 } });
    expect(r3.preview(two, renovate(0, 1)).renovates).toEqual({ uid: 1, level: 3 });
  });

  it('a missing card or room is illegal', () => {
    const s = build([['kitchen', 0, 0]], {
      hand: [pc('kitchen'), { kind: 'fixture', id: 'fireplace' }],
    });
    const noCard = 'There is no card there.';
    const badCards: RenovateAction[] = [
      renovate(2, 1), // past the end of the hand
      renovate(-1, 1),
      renovate(0.5, 1),
      renovate(1, 1), // a fixture card
      renovate(0, 1, 'reserve'), // the reserve is empty
      { t: 'renovate', from: 'supplies', i: 0, uid: 1 } as unknown as RenovateAction,
    ];
    for (const play of badCards) {
      expect(R.checkPlay(s, play), JSON.stringify(play)).toMatchObject({
        legal: false,
        reason: noCard,
      });
      expect(() => R.apply(s, play)).toThrow(noCard);
    }
    const noRoom = 'Pick a room to renovate.';
    for (const uid of [99, 0, -1, 1.5, Number.NaN]) {
      expect(R.checkPlay(s, renovate(0, uid)), String(uid)).toMatchObject({
        legal: false,
        reason: noRoom,
      });
      expect(() => R.apply(s, renovate(0, uid))).toThrow(noRoom);
    }
    expect(R.renovateTargets(s, 'hand', 1)).toEqual([]);
    expect(R.renovateTargets(s, 'hand', 5)).toEqual([]);
    expect(R.renovateTargets(s, 'reserve', 0)).toEqual([]);
  });

  it('can’t renovate on the shop screen, or once the run is over', () => {
    // TEST_BALANCE's own targets: meeting the first one and passing twice opens shop 1.
    const shopRules = createRules(withClient({ specs: [ONE_KITCHEN] }));
    let s = shopRules.newRun(setup('renovate-shop'));
    s = { ...s, score: shopRules.target(s) };
    s = shopRules.apply(shopRules.apply(s, PASS).state, PASS).state;
    expect(s.screen).toBe('shop');
    const shop: RunState = {
      ...s,
      house: houseFrom(shopRules.content, emptyRows(12, 12), [['kitchen', 0, 0]]),
      hand: [pc('kitchen')],
      reserve: [{ id: 'kitchen' }],
    };
    expect(shopRules.limits(shop)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    expect(shopRules.checkPlay(shop, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'The shop is open.',
    });
    expect(() => shopRules.apply(shop, renovate(0, 1))).toThrow(
      'The shop is open. Leave it to start the next phase.',
    );
    expect(shopRules.renovateTargets(shop, 'hand', 0)).toEqual([]);
    expect(shopRules.renovateTargets(shop, 'reserve', 0)).toEqual([]);
    expect(shopRules.legalActions(shop).some((a) => a.t === 'renovate')).toBe(false);
    expect(shopRules.preview(shop, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'The shop is open.',
    });

    const over: RunState = {
      ...build([['kitchen', 0, 0]], { hand: [pc('kitchen')] }),
      screen: 'lost',
    };
    expect(R.checkPlay(over, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'The run is over.',
    });
    expect(() => R.apply(over, renovate(0, 1))).toThrow('The run is over.');
    expect(R.renovateTargets(over, 'hand', 0)).toEqual([]);
  });

  it('a type with no limit never renovates: a Garage card on a Garage', () => {
    // The checklist's only ceiling is the Kitchen's (uid 1, at it), however many Garages
    // (uids 2 and 3) there are. Another type's limit doesn't help a Garage card either.
    const s = build(
      [
        ['kitchen', 0, 0],
        ['garage', 0, 10],
        ['garage', 2, 10],
      ],
      { hand: [pc('garage')], reserve: [{ id: 'garage' }] },
    );
    expect(R.limits(s)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    const reason = 'A Garage card can’t renovate: the checklist doesn’t cap them.';
    const plays = [renovate(0, 1), renovate(0, 2), renovate(0, 3), renovate(0, 2, 'reserve')];
    for (const play of plays) {
      const check = R.checkPlay(s, play);
      expect(check.legal).toBe(false);
      expect(check.reason).toBe(reason);
      expect(() => R.apply(s, play)).toThrow(IllegalAction);
    }
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([]);
    expect(R.renovateTargets(s, 'reserve', 0)).toEqual([]);
    expect(R.legalActions(s).some((a) => a.t === 'renovate')).toBe(false);
  });

  // The reasons take their article from text.ts, which reads a letter aloud: "an L-Kitchen".
  it('names an L-Kitchen card with “an” in its reasons', () => {
    // No Kitchen ceiling here: the checklist doesn't cap the L-Kitchen card's type.
    const noLimit = createRules(contentWith([LIVING_ROOMS]));
    const s = build([['kitchen', 0, 0]], { rules: noLimit, hand: [pc('lKitchen')] });
    expect(noLimit.checkPlay(s, renovate(0, 1)).reason).toBe(
      'An L-Kitchen card can’t renovate: the checklist doesn’t cap them.',
    );
    // A Kitchen ceiling the house is below: no Kitchen yet, only a Dining Room.
    const r = createRules(contentWith([ONE_KITCHEN]));
    const below = build([['diningRoom', 0, 0]], { rules: r, hand: [pc('lKitchen')] });
    expect(r.checkPlay(below, renovate(0, 1)).reason).toBe(
      'An L-Kitchen card can renovate once the house has all the Kitchens it wants.',
    );
    // At the Kitchen's ceiling, on the Dining Room.
    const t = build(
      [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ],
      { rules: r, hand: [pc('lKitchen')] },
    );
    expect(r.checkPlay(t, renovate(0, 2)).reason).toBe('An L-Kitchen card renovates a Kitchen.');
  });
});

// ---------------------------------------------------------------------------------------

describe('resolving a Renovation', () => {
  it('levels the room up by one and ends the week: renovated, then the tally, then next week', () => {
    const hand = [pc('kitchen'), pc('closet'), pc('bedroom')];
    const s = deepFreeze(build([['kitchen', 0, 0]], { hand }));
    const before = JSON.stringify(s);
    const { state, events } = R.apply(s, renovate(0, 1));
    // One Kitchen holds for the first time this run (the state was built by hand), so a
    // specMet follows the tally.
    expect(types(events)).toEqual(['renovated', 'tally', 'specMet', 'handDrawn']);
    expect(events[0]).toEqual({
      t: 'renovated',
      uid: 1,
      defId: 'kitchen',
      level: 1,
      card: 'kitchen',
    });
    expect(state.house.pieces).toEqual([
      { uid: 1, defId: 'kitchen', x: 0, y: 0, rot: 0, placedWeek: 1, level: 1 },
    ]);
    expect(state.house.nextUid).toBe(2);
    expect(state).toMatchObject({ week: 2, slot: 2, draws: 1, freePlay: 'none' });
    expect(state.hand).toHaveLength(4); // two rows of 2 (D-121)
    // The level's +4 Comfort counts this week: Points 4 × Mult (1 + 0.25 for One Kitchen) = 5.
    const tally = eventsOf(events, 'tally')[0]!.tally;
    expect(tally.pieces).toMatchObject([{ uid: 1, points: 4, pct: 0, earned: 4 }]);
    expect(tally.pieces[0]!.lines).toEqual([
      { label: 'Renovated (level 1)', op: 'add', value: 4, from: [] },
    ]);
    expect(tally).toMatchObject({ points: 4, mult: 125, total: 5 });
    expect(state.score).toBe(5);
    // A level adds no room: the Kitchen count stays 1.
    expect(R.limits(state)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    // The input is untouched.
    expect(JSON.stringify(s)).toBe(before);
    expect(s.house.pieces[0]!.level).toBeUndefined();
  });

  it('a second Renovation takes the room to level 2: +8 Comfort', () => {
    const s = build([['kitchen', 0, 0]], { hand: [pc('lKitchen')], levels: { 1: 1 } });
    expect(scoreOf(R, s, 1)).toMatchObject({ points: 4, earned: 4 });
    const { state, events } = R.apply(s, renovate(0, 1));
    expect(eventsOf(events, 'renovated')).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 2, card: 'lKitchen' },
    ]);
    expect(pieceOf(state, 1)!.level).toBe(2);
    const tally = eventsOf(events, 'tally')[0]!.tally;
    // 8 × 1.25 = 10.
    expect(tally.pieces[0]).toMatchObject({ points: 8, earned: 8 });
    expect(tally.pieces[0]!.lines).toEqual([
      { label: 'Renovated (level 2)', op: 'add', value: 8, from: [] },
    ]);
    expect(tally.total).toBe(10);
  });

  it('from the reserve: the card leaves the reserve, and the rest keep their order', () => {
    const s = build([['kitchen', 0, 0]], {
      hand: [pc('closet')],
      reserve: [{ id: 'bedroom' }, { id: 'lKitchen' }],
    });
    expect(R.renovateTargets(s, 'reserve', 1)).toEqual([1]);
    expect(R.renovateTargets(s, 'reserve', 0)).toEqual([]);
    expect(R.checkPlay(s, renovate(1, 1, 'reserve')).legal).toBe(true);
    const { state, events } = R.apply(s, renovate(1, 1, 'reserve'));
    expect(eventsOf(events, 'renovated')).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 1, card: 'lKitchen' },
    ]);
    expect(state.reserve).toEqual([{ id: 'bedroom' }]);
    expect(pieceOf(state, 1)!.level).toBe(1);
    expect(state.week).toBe(2);
  });

  it('the level comes before percentages: an earn +100% doubles it', () => {
    const r = createRules(
      contentWith([ONE_KITCHEN], {
        tastes: [{ kind: 'earn', target: { piece: 'kitchen' }, pct: 100 }],
      }),
    );
    const s = build([['kitchen', 0, 0]], { rules: r, hand: [pc('kitchen')] });
    // Alone, the Kitchen earns nothing, doubled or not.
    expect(scoreOf(r, s, 1)).toMatchObject({ points: 0, pct: 100, earned: 0 });
    const kitchen = eventsOf(r.apply(s, renovate(0, 1)).events, 'tally')[0]!.tally.pieces[0]!;
    // 4 × (100 + 100)% = 8.
    expect(kitchen).toMatchObject({ points: 4, pct: 100, earned: 8 });
    expect(kitchen.lines).toEqual([
      { label: 'Renovated (level 1)', op: 'add', value: 4, from: [] },
      { label: 'The Hendersons', op: 'pct', value: 100, from: [] },
    ]);
    // Level 2: 8 × 2 = 16.
    const two = build([['kitchen', 0, 0]], { rules: r, levels: { 1: 2 } });
    expect(scoreOf(r, two, 1)).toMatchObject({ points: 8, earned: 16 });
  });

  it('beside a Dining Room, its aura’s +50% applies to the level too', () => {
    const s = build(
      [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ],
      { levels: { 1: 1 } },
    );
    const kitchen = scoreOf(R, s, 1);
    // (Touching a Dining Room +2, Renovated +4) × 150% = 9. The level's line sits with the
    // room's own, before the auras.
    expect(kitchen).toMatchObject({ points: 6, pct: 50, earned: 9 });
    expect(kitchen.lines.map((l) => [l.label, l.op, l.value])).toEqual([
      ['Touching a Dining Room', 'add', 2],
      ['Renovated (level 1)', 'add', 4],
      ['Dining Room next door', 'pct', 50],
    ]);
  });

  it('integer math: rounds half up, and a level offsets penalties before the clamp at 0', () => {
    const closetRule: SpecDef = {
      id: 'oneCloset',
      name: 'One Closet',
      group: 'wishes',
      condition: { count: { piece: 'closet' }, max: 1 },
    };
    const r = createRules(
      contentWith([closetRule], {
        tastes: [{ kind: 'earn', target: { piece: 'closet' }, pct: 10 }],
      }),
    );
    const closet = (level?: number) =>
      scoreOf(r, build([['closet', 0, 0]], { rules: r, levels: level ? { 1: level } : {} }), 1);
    // A Closet at +10%: 1 × 110% = 1.1 → 1; level 1: (1 + 4) × 110% = 5.5 → 6 (half up);
    // level 2: (1 + 8) × 110% = 9.9 → 10.
    expect(closet().earned).toBe(1);
    expect(closet(1)).toMatchObject({ points: 5, pct: 10, earned: 6 });
    expect(closet(2)).toMatchObject({ points: 9, pct: 10, earned: 10 });
    // A Bedroom on the street beside a Garage: 3 − 2 (the street) − 2 (the Garage) = −1,
    // which earns 0. A level brings the flat sum to −1 + 4 = 3, before clamping.
    const house: Placement[] = [
      ['bedroom', 0, 10],
      ['garage', 2, 10],
    ];
    expect(scoreOf(R, build(house), 1)).toMatchObject({ points: -1, earned: 0 });
    expect(scoreOf(R, build(house, { levels: { 1: 1 } }), 1)).toMatchObject({
      points: 3,
      earned: 3,
    });
  });

  it('earnNothing zeroes a renovated room, and so does an unmet requirement', () => {
    const r = createRules(
      contentWith([ONE_KITCHEN], {
        tastes: [{ kind: 'earnNothing', target: { piece: 'kitchen' } }],
      }),
    );
    const kitchen = scoreOf(r, build([['kitchen', 0, 0]], { rules: r, levels: { 1: 2 } }), 1);
    expect(kitchen).toMatchObject({ points: 8, earned: 0 });
    expect(kitchen.lines).toEqual([
      { label: 'Renovated (level 2)', op: 'add', value: 8, from: [] },
      { label: 'Earns nothing (The Hendersons)', op: 'none', value: 0, from: [] },
    ]);

    // A Garage ceiling lets a Garage card renovate a Garage that isn't on the street: it's
    // legal, but the Garage still earns nothing, and its only line says why.
    const garageRule: SpecDef = {
      id: 'oneGarage',
      name: 'One Garage',
      group: 'wishes',
      condition: { count: { piece: 'garage' }, max: 1 },
    };
    const rg = createRules(contentWith([garageRule]));
    const s = build([['garage', 0, 0]], { rules: rg, hand: [pc('garage')] });
    const { state, events } = rg.apply(s, renovate(0, 1));
    expect(pieceOf(state, 1)!.level).toBe(1);
    const garage = eventsOf(events, 'tally')[0]!.tally.pieces[0]!;
    expect(garage).toMatchObject({ uid: 1, earned: 0, unmet: 'touching the street or a Driveway' });
    expect(garage.lines).toEqual([
      {
        label: 'Earns nothing: it must be touching the street or a Driveway',
        op: 'none',
        value: 0,
        from: [],
      },
    ]);
    // On the street, a level-1 Garage earns its 1 + 4 = 5.
    const onStreet = build([['garage', 0, 10]], { rules: rg, levels: { 1: 1 } });
    expect(scoreOf(rg, onStreet, 1)).toMatchObject({ points: 5, earned: 5 });
  });
});

// ---------------------------------------------------------------------------------------

describe('previewing a Renovation', () => {
  it('shows the room, its new level, and the change; after is what apply() tallies', () => {
    // The Kitchen beside a Dining Room earns 2 × 150% = 3 now, and (2 + 4) × 150% = 9
    // renovated. The week, at Mult 1.25 (One Kitchen): 3 × 1.25 = 3.75 → 4, then
    // 9 × 1.25 = 11.25 → 11.
    const s = build(
      [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ],
      { hand: [pc('lKitchen')] },
    );
    const play = renovate(0, 1);
    const p = R.preview(s, play);
    expect(p).toMatchObject({
      legal: true,
      before: { points: 3, mult: 125, total: 4 },
      after: { points: 9, mult: 125, total: 11 },
      delta: 7,
      renovates: { uid: 1, level: 1 },
      budgetBefore: 0,
      budgetAfter: 0,
      setsGained: [],
      setsLost: [],
      specsGained: [],
      specsLost: [],
      upcoming: [],
      clearedTrees: [],
      finds: [],
    });
    expect(p.reason).toBeUndefined();
    expect(p.host).toBeUndefined();
    expect(sortCells(p.cells)).toEqual(['0,0', '1,0', '0,1', '1,1']);
    // Only the Kitchen's earnings change (the Dining Room earns nothing either way).
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({
      uid: 1,
      defId: 'kitchen',
      isNew: true,
      before: 3,
      after: 9,
    });
    expect(p.lines[0]!.reasons.map((l) => l.label)).toEqual([
      'Touching a Dining Room',
      'Renovated (level 1)',
      'Dining Room next door',
    ]);
    expect(p.newPiece).toMatchObject({ uid: 1, defId: 'kitchen', points: 6, earned: 9 });

    // The preview is the week's tally.
    const tally = eventsOf(R.apply(s, play).events, 'tally')[0]!.tally;
    expect({ points: tally.points, mult: tally.mult, total: tally.total }).toEqual(p.after);
    expect(R.scoreOnly(s, play)).toBe(p.after.total);
    // The forecast: this week's total for each of the phase's 4 weeks.
    expect(R.weeksLeft(s)).toBe(4);
    expect(R.forecast(s, play)).toBe(s.score + 4 * 11);
    // A level changes no checklist line.
    expect(R.checklist(s, play)).toEqual(R.checklist(s));
  });

  it('a reserve Renovation from level 1 to 2 previews the same way', () => {
    const s = build([['kitchen', 0, 0]], { reserve: [{ id: 'kitchen' }], levels: { 1: 1 } });
    const play = renovate(0, 1, 'reserve');
    const p = R.preview(s, play);
    // 4 × 1.25 = 5 now, and 8 × 1.25 = 10.
    expect(p).toMatchObject({
      legal: true,
      before: { total: 5 },
      after: { total: 10 },
      delta: 5,
      renovates: { uid: 1, level: 2 },
    });
    expect(R.scoreOnly(s, play)).toBe(10);
    expect(eventsOf(R.apply(s, play).events, 'tally')[0]!.tally.total).toBe(10);
  });

  it('an illegal Renovation previews as no change, with its reason', () => {
    const s = build([['kitchen', 0, 0]], { hand: [pc('kitchen')], levels: { 1: 2 } });
    const p = R.preview(s, renovate(0, 1));
    expect(p).toMatchObject({
      legal: false,
      reason: 'That Kitchen is fully renovated.',
      delta: 0,
      lines: [],
      cells: [],
      newPiece: null,
    });
    expect(p.after).toEqual(p.before);
    expect(p.renovates).toBeUndefined();
    // The forecast ignores an illegal play.
    expect(R.forecast(s, renovate(0, 1))).toBe(s.score + 4 * R.currentTally(s).total);
  });
});

// ---------------------------------------------------------------------------------------

describe('Weekend Crew: a Renovation can be its free play (D-083)', () => {
  it('a free Renovation doesn’t end the week; the next play does', () => {
    const hand = [pc('kitchen'), pc('lKitchen'), pc('closet')];
    const s = build([['kitchen', 0, 0]], { hand, supplies: [tool('weekendCrew')] });
    const ready = R.apply(s, use(0)).state;
    expect(ready.freePlay).toBe('ready');

    const free = R.apply(ready, renovate(0, 1));
    expect(free.events).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 1, card: 'kitchen', free: true },
    ]);
    expect(free.state).toMatchObject({
      week: 1,
      slot: 1,
      draws: s.draws,
      score: 0,
      freePlay: 'used',
    });
    expect(free.state.hand).toEqual([pc('lKitchen'), pc('closet')]);
    expect(pieceOf(free.state, 1)!.level).toBe(1);

    // The L-Kitchen card on the same Kitchen ends the week: one tally, at level 2:
    // 8 × 1.25 = 10.
    const second = R.apply(free.state, renovate(0, 1));
    expect(types(second.events)).toEqual(['renovated', 'tally', 'specMet', 'handDrawn']);
    expect(second.events[0]).toEqual({
      t: 'renovated',
      uid: 1,
      defId: 'kitchen',
      level: 2,
      card: 'lKitchen',
    });
    const tallies = eventsOf(second.events, 'tally');
    expect(tallies).toHaveLength(1);
    expect(tallies[0]!.week).toBe(1);
    expect(tallies[0]!.tally.total).toBe(10);
    expect(second.state).toMatchObject({ week: 2, freePlay: 'none', score: 10 });
  });

  it('works from the reserve, and a placement can end the week after it', () => {
    const s = build([['kitchen', 0, 0]], {
      hand: [pc('closet')],
      reserve: [{ id: 'kitchen' }],
      supplies: [tool('weekendCrew')],
    });
    const ready = R.apply(s, use(0)).state;
    const free = R.apply(ready, renovate(0, 1, 'reserve'));
    expect(free.events).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 1, card: 'kitchen', free: true },
    ]);
    expect(free.state.reserve).toEqual([]);
    expect(free.state.hand).toEqual([pc('closet')]);
    expect(free.state.week).toBe(1);
    // The Closet beside the Kitchen ends the week: (Kitchen 4 + Closet 1) × 1.25 = 6.25 → 6.
    const { events } = R.apply(free.state, { t: 'place', from: 'hand', i: 0, x: 2, y: 0, rot: 0 });
    expect(types(events).slice(0, 2)).toEqual(['placed', 'tally']);
    expect(eventsOf(events, 'placed')[0]).not.toHaveProperty('free');
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(6);
  });

  it('a Kitchen placed as the free play is at its limit at once, so the next play can renovate it', () => {
    const s = build([], { hand: [pc('kitchen'), pc('lKitchen')], supplies: [tool('weekendCrew')] });
    expect(R.renovateTargets(s, 'hand', 1)).toEqual([]);
    const ready = R.apply(s, use(0)).state;
    const placed = R.apply(ready, { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 }).state;
    expect(R.limits(placed)).toEqual([{ types: ['kitchen'], max: 1, count: 1 }]);
    expect(R.renovateTargets(placed, 'hand', 0)).toEqual([1]);
    const { state, events } = R.apply(placed, renovate(0, 1));
    expect(eventsOf(events, 'renovated')).toEqual([
      { t: 'renovated', uid: 1, defId: 'kitchen', level: 1, card: 'lKitchen' },
    ]);
    expect(pieceOf(state, 1)).toMatchObject({ placedWeek: 1, level: 1 });
    // Built and renovated in one week: 4 × 1.25 = 5.
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------

describe('a card that can only renovate (D-070, D-121): it doesn’t fit, but it has a play', () => {
  // A 2×2 lot the Kitchen fills, so nothing can be placed anywhere.
  const FULL = ['..', '..'];

  it('cardFits and reserveFits are false for it, though renovateTargets lists its room', () => {
    const s = build([['kitchen', 0, 0]], {
      rows: FULL,
      hand: [pc('kitchen'), pc('lKitchen')],
      reserve: [{ id: 'kitchen' }],
    });
    expect(R.cardFits(s, 0)).toBe(false);
    expect(R.cardFits(s, 1)).toBe(false);
    expect(R.reserveFits(s, 0)).toBe(false);
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([1]);
    expect(R.renovateTargets(s, 'hand', 1)).toEqual([1]);
    expect(R.renovateTargets(s, 'reserve', 0)).toEqual([1]);
    expect(R.legalPlacements(s)).toEqual([]);
    expect(R.legalPlays(s)).toEqual([renovate(0, 1), renovate(1, 1), renovate(0, 1, 'reserve')]);
  });

  it('a card whose only play is a Renovation isn’t swapped; the cards with no play are', () => {
    // A seed whose week-2 Rooms row, drawn with the Kitchen at its limit, has a Kitchen card.
    const opts = { atLimit: KITCHEN_AT_LIMIT };
    const seed = Array.from({ length: 200 }, (_, k) => `swap-${k}`).find((sd) =>
      drawRows(K, sd, 0, slotKey(2, 0), 0, opts).some(isKitchenCard),
    )!;
    expect(seed).toBeDefined();
    const s = build([['kitchen', 0, 0]], { rows: FULL, seed });
    const { state, events } = R.apply(s, PASS);
    const hands = eventsOf(events, 'handDrawn');
    expect(hands).toHaveLength(1);
    const first = drawRows(K, seed, 0, '2', 0, opts);
    expect(drawnBefore(hands[0])).toEqual(first);
    // Nothing fits on the full lot: every card is swapped but the Kitchen card, which can
    // renovate the Kitchen.
    const k = first.findIndex(isKitchenCard);
    expect(state.hand[k]).toEqual(first[k]);
    expect(R.renovateTargets(state, 'hand', k)).toEqual([1]);
    expect(state.swapped.map((w) => w.i)).toEqual(first.flatMap((_, i) => (i === k ? [] : [i])));
    expect(state).toMatchObject({ week: 2, draws: 1 });
  });
});

// ---------------------------------------------------------------------------------------

describe('listing Renovations', () => {
  it('renovateTargets lists each room a card could renovate, in placement order', () => {
    const r = createRules(contentWith([ONE_KITCHEN, LIVING_ROOMS]));
    // Living Rooms (uids 1 and 3) at their ceiling of 2, the Kitchen (uid 2) between them.
    const house: Placement[] = [
      ['livingRoom', 0, 0],
      ['kitchen', 2, 0],
      ['livingRoom', 4, 0],
    ];
    const hand: Card[] = [
      pc('livingRoom'),
      pc('lKitchen'),
      pc('bedroom'),
      { kind: 'fixture', id: 'fireplace' },
    ];
    const s = build(house, { rules: r, hand });
    expect(r.renovateTargets(s, 'hand', 0)).toEqual([1, 3]);
    expect(r.renovateTargets(s, 'hand', 1)).toEqual([2]);
    expect(r.renovateTargets(s, 'hand', 2)).toEqual([]); // no Bedroom ceiling
    expect(r.renovateTargets(s, 'hand', 3)).toEqual([]); // a fixture card
    expect(r.renovateTargets(s, 'hand', 4)).toEqual([]); // nothing there
    // Once the second Living Room is fully renovated, only the first is listed.
    const topped = build(house, { rules: r, hand, levels: { 3: 2 } });
    expect(r.renovateTargets(topped, 'hand', 0)).toEqual([1]);
  });

  it('legalPlays lists each Renovation after the placements and installs; legalActions includes them', () => {
    const s = build([['kitchen', 0, 0]], {
      hand: [pc('kitchen'), pc('closet'), { kind: 'fixture', id: 'fireplace' }],
      reserve: [{ id: 'lKitchen' }],
    });
    const plays = R.legalPlays(s);
    const renovations = plays.filter((p) => p.t === 'renovate');
    expect(renovations).toEqual([renovate(0, 1), renovate(0, 1, 'reserve')]);
    // The Kitchen cards can also be placed elsewhere: those come first, then the install.
    expect(plays.some((p) => p.t === 'place' && p.from === 'hand' && p.i === 0)).toBe(true);
    expect(plays.some((p) => p.t === 'place' && p.from === 'reserve')).toBe(true);
    expect(plays.filter((p) => p.t === 'install')).toEqual([
      { t: 'install', from: 'hand', i: 2, uid: 1 },
    ]);
    const first = plays.findIndex((p) => p.t === 'renovate');
    expect(first).toBe(plays.length - 2);
    // legalActions starts with the plays, so it lists the same Renovations.
    const actions = R.legalActions(s);
    expect(actions.filter((a) => a.t === 'renovate')).toEqual(renovations);
    expect(actions.slice(0, plays.length)).toEqual(plays);
    for (const play of renovations) expect(() => R.apply(s, play)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------

describe('a room keeps its level', () => {
  it('through the Moving Truck', () => {
    const s = build([['kitchen', 0, 0]], {
      levels: { 1: 2 },
      supplies: [tool('movingTruck')],
      hand: [pc('lKitchen')],
    });
    // 8 × 1.25 = 10, before the move and after it.
    expect(R.currentTally(s).total).toBe(10);
    const move = use(0, { uid: 1, x: 6, y: 6, rot: 0 });
    expect(R.previewTool(s, move)).toMatchObject({
      ok: true,
      before: { total: 10 },
      after: { total: 10 },
      delta: 0,
    });
    const { state } = R.apply(s, move);
    expect(state.house.pieces).toEqual([
      { uid: 1, defId: 'kitchen', x: 6, y: 6, rot: 0, placedWeek: 1, level: 2 },
    ]);
    expect(scoreOf(R, state, 1)).toMatchObject({ points: 8, earned: 8 });
    // Still at the top level after the move.
    expect(R.checkPlay(state, renovate(0, 1)).reason).toBe('That Kitchen is fully renovated.');
  });

  it('through a transform into a piece', () => {
    // A test Kitchen that becomes a Library (both 2×2) once it's a week old.
    const base = withPieces({
      kitchen: {
        effects: [
          ...C.pieces.kitchen.effects,
          { kind: 'transform', into: { piece: 'library' }, afterWeeks: 1 },
        ],
      },
    });
    const r = createRules(contentWith([ONE_KITCHEN], { base }));
    const s = build([['kitchen', 0, 0]], { rules: r, levels: { 1: 2 } });
    const { state, events } = r.apply(s, PASS);
    expect(eventsOf(events, 'transformed')).toMatchObject([
      { t: 'transformed', uid: 1, defId: 'kitchen', into: { piece: 'library' } },
    ]);
    expect(state.house.pieces).toEqual([
      {
        uid: 1,
        defId: 'library',
        x: 0,
        y: 0,
        rot: 0,
        placedWeek: 2,
        ageBonus: 0,
        level: 2,
      },
    ]);
    // The Library (no Quiet neighbors here) earns its two levels: 8.
    expect(scoreOf(r, state, 1)).toMatchObject({ defId: 'library', points: 8, earned: 8 });
    expect(scoreOf(r, state, 1).lines).toEqual([
      { label: 'Renovated (level 2)', op: 'add', value: 8, from: [] },
    ]);
    // With no Kitchen left, the Kitchen is below its limit again.
    expect(r.limits(state)).toEqual([{ types: ['kitchen'], max: 1, count: 0 }]);
  });
});

// ---------------------------------------------------------------------------------------

describe('limits', () => {
  it('lists each ceiling over piece types with its count, through `and` and the current stage', () => {
    const checklist: SpecDef[] = [
      ROOM_FOR_EVERYONE,
      {
        id: 'bathrooms',
        name: 'A Bathroom for every two Bedrooms',
        group: 'household',
        condition: {
          ratio: { count: { piece: 'bathroom' }, per: { piece: 'bedroom' }, every: 2, min: 1 },
        },
      },
      ONE_KITCHEN,
      LIVING_ROOMS,
      // Not ceilings over piece types: a floor alone, and a ceiling over a property.
      {
        id: 'closet',
        name: 'A Closet',
        group: 'wishes',
        condition: { count: { piece: 'closet' }, min: 1 },
      },
      {
        id: 'smallHouse',
        name: 'At most 8 rooms',
        group: 'shape',
        condition: { count: { property: 'room' }, max: 8 },
      },
    ];
    const r = createRules(contentWith(checklist));
    const s = build(
      [
        ['bedroom', 0, 0],
        ['kitchen', 2, 0],
        ['livingRoom', 4, 0],
        ['diningRoom', 6, 0],
      ],
      { rules: r },
    );
    expect(r.limits(s)).toEqual([
      { types: ['bedroom'], max: 2, count: 1 },
      { types: ['kitchen'], max: 1, count: 1 },
      { types: ['livingRoom'], max: 2, count: 1 },
      { types: ['diningRoom'], max: 1, count: 1 },
    ]);
    // From the second phase, Room for everyone's stage is 2–3.
    expect(r.limits({ ...s, phase: 1 })).toEqual([
      { types: ['bedroom'], max: 3, count: 1 },
      { types: ['kitchen'], max: 1, count: 1 },
      { types: ['livingRoom'], max: 2, count: 1 },
      { types: ['diningRoom'], max: 1, count: 1 },
    ]);
    // A client with no checklist has no limits.
    const plain = createRules(C);
    expect(plain.limits(build([['kitchen', 0, 0]], { rules: plain }))).toEqual([]);
  });

  it('Bunk Beds count a Bedroom twice, so one Bedroom can put Bedrooms at the limit', () => {
    const r = createRules(contentWith([ROOM_FOR_EVERYONE]));
    const s = build([['bedroom', 0, 0]], {
      rules: r,
      hand: [pc('bedroom')],
      supplies: [{ kind: 'fixture', id: 'bunkBeds' }],
    });
    expect(r.limits(s)).toEqual([{ types: ['bedroom'], max: 2, count: 1 }]);
    expect(r.renovateTargets(s, 'hand', 0)).toEqual([]);
    // Bunk Beds from the supplies (a free action): the Bedroom counts 2, at the ceiling of 1–2.
    const bunk = r.apply(s, { t: 'install', from: 'supplies', i: 0, uid: 1 }).state;
    expect(r.limits(bunk)).toEqual([{ types: ['bedroom'], max: 2, count: 2 }]);
    expect(r.renovateTargets(bunk, 'hand', 0)).toEqual([1]);
    const { state } = r.apply(bunk, renovate(0, 1));
    expect(pieceOf(state, 1)).toMatchObject({ level: 1, fixture: { id: 'bunkBeds', week: 1 } });
    // From the second phase (2–3), the same house is below its ceiling.
    expect(r.renovateTargets({ ...bunk, phase: 1 }, 'hand', 0)).toEqual([]);
  });

  it('over the limit counts as at it: either of two Kitchens can be renovated', () => {
    const s = build(
      [
        ['kitchen', 0, 0],
        ['lKitchen', 2, 0],
      ],
      { hand: [pc('kitchen')] },
    );
    expect(R.limits(s)).toEqual([{ types: ['kitchen'], max: 1, count: 2 }]);
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([1, 2]);
  });

  it('a demolition can take a type back below its limit, and the level goes with the room', () => {
    // A level-1 Kitchen (uid 1) beside a Closet (uid 2), on its own: demolishing it is legal.
    const s = build(
      [
        ['kitchen', 0, 0],
        ['closet', 2, 0],
      ],
      { hand: [pc('lKitchen')], levels: { 1: 1 } },
    );
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([1]);
    const { state } = R.apply(s, { t: 'demolish', x: 0, y: 0 });
    expect(state.house.pieces.map((p) => p.uid)).toEqual([2]);
    expect(R.limits(state)).toEqual([{ types: ['kitchen'], max: 1, count: 0 }]);
    expect(R.renovateTargets(state, 'hand', 0)).toEqual([]);
    // The L-Kitchen card can be placed instead (beside the Closet), and starts at no level.
    const placed = R.apply(state, { t: 'place', from: 'hand', i: 0, x: 3, y: 0, rot: 0 }).state;
    expect(pieceOf(placed, 3)).toEqual({
      uid: 3,
      defId: 'lKitchen',
      x: 3,
      y: 0,
      rot: 0,
      placedWeek: 1,
    });
  });

  it('a ceiling over two types lets a card of either renovate a room of either', () => {
    const shared: SpecDef = {
      id: 'sharedRooms',
      name: 'Two shared rooms at most',
      group: 'wishes',
      condition: { count: { piece: ['livingRoom', 'diningRoom'] }, max: 2 },
    };
    const r = createRules(contentWith([shared]));
    const s = build(
      [
        ['livingRoom', 0, 0],
        ['diningRoom', 2, 0],
      ],
      { rules: r, hand: [pc('livingRoom'), pc('diningRoom'), pc('kitchen')] },
    );
    expect(r.limits(s)).toEqual([{ types: ['livingRoom', 'diningRoom'], max: 2, count: 2 }]);
    expect(r.renovateTargets(s, 'hand', 0)).toEqual([1, 2]);
    expect(r.renovateTargets(s, 'hand', 1)).toEqual([1, 2]);
    expect(r.renovateTargets(s, 'hand', 2)).toEqual([]);
    expect(eventsOf(r.apply(s, renovate(0, 2)).events, 'renovated')).toEqual([
      { t: 'renovated', uid: 2, defId: 'diningRoom', level: 1, card: 'livingRoom' },
    ]);
  });
});

// ---------------------------------------------------------------------------------------

describe('half-weight draws for types at their limit (D-043, amended)', () => {
  it('drawWeights gives every card of the type floor(weight × 50%) and leaves the rest alone', () => {
    for (const phase of [0, 1]) {
      const plain = drawWeights(K, phase);
      const half = drawWeights(K, phase, { atLimit: KITCHEN_AT_LIMIT });
      expect(half.map((w) => w.card)).toEqual(plain.map((w) => w.card));
      half.forEach((w, k) => {
        const base = plain[k]!.weight;
        const expected = isKitchenCard(w.card) ? Math.floor((base * 50) / 100) : base;
        expect(w.weight, `${phase} ${JSON.stringify(w.card)}`).toBe(expected);
      });
      // Phase 2 draws fixtures too: they're never a type at a limit.
      if (phase === 1) expect(half.some((w) => w.card.kind === 'fixture')).toBe(true);
    }
    // In numbers: weight 10 × complexity 1's 100% = 1,000, so 500 at the limit, for the
    // L-Kitchen as well.
    const half = drawWeights(K, 0, { atLimit: KITCHEN_AT_LIMIT });
    expect(weightOf(half, 'kitchen')).toBe(500);
    expect(weightOf(half, 'lKitchen')).toBe(500);
    expect(weightOf(half, 'bedroom')).toBe(1000);
  });

  it('halves after the client’s drawWeight modifiers and the complexity percentage', () => {
    // A pool's +100% on Kitchens (the L-Kitchen counts): (10 × 200%) × 100% = 2,000, then
    // 1,000 at the limit.
    const mods: Modifier[] = [{ kind: 'drawWeight', target: { piece: 'kitchen' }, pct: 100 }];
    expect(weightOf(drawWeights(K, 0, { mods }), 'kitchen')).toBe(2000);
    const half = drawWeights(K, 0, { mods, atLimit: KITCHEN_AT_LIMIT });
    expect(weightOf(half, 'kitchen')).toBe(1000);
    expect(weightOf(half, 'lKitchen')).toBe(1000);
    // A complexity-2 Garage in the first phase (10 × 30% = 300), at a Garage limit: 150.
    const garage = drawWeights(K, 0, { atLimit: new Set<PieceId>(['garage']) });
    expect(weightOf(garage, 'garage')).toBe(150);
  });

  it('rounds down: at 33%, a Hallway’s 50 draws at 16', () => {
    const k33 = contentWith([ONE_KITCHEN], { balance: { drawAtLimitPct: 33 } });
    const w = drawWeights(k33, 0, { atLimit: new Set<PieceId>(['hallway']) });
    // Weight 10 × complexity 3's 5% = 50, and 50 × 33% = 16.5 → 16, for the Long Hallway too.
    expect(weightOf(w, 'hallway')).toBe(16);
    expect(weightOf(w, 'longHallway')).toBe(16);
    expect(weightOf(w, 'kitchen')).toBe(1000);
    // 1,000 × 33% = 330.
    expect(weightOf(drawWeights(k33, 0, { atLimit: KITCHEN_AT_LIMIT }), 'kitchen')).toBe(330);
  });

  it('the Catalog’s special draw is unaffected for types without limits', () => {
    // Kitchens aren't special pieces: the Catalog's pool and weights don't change.
    expect(drawWeights(K, 0, { special: true, atLimit: KITCHEN_AT_LIMIT })).toEqual(
      drawWeights(K, 0, { special: true }),
    );
    expect(drawWeights(K, 1, { special: true, atLimit: KITCHEN_AT_LIMIT })).toEqual(
      drawWeights(K, 1, { special: true }),
    );
    // A special piece's own type at a limit draws at half there too: 100 → 50.
    const special = drawWeights(K, 0, { special: true, atLimit: new Set<PieceId>(['library']) });
    expect(weightOf(special, 'library')).toBe(50);
    expect(weightOf(special, 'playroom')).toBe(100);
  });

  it('in a run, a hand drawn while the Kitchen is at its limit uses the half weights', () => {
    const plainOf = (sd: string, n = 0) => drawRows(K, sd, 0, slotKey(2, 0), n);
    const halfOf = (sd: string, n = 0, held: readonly Card[] = []) =>
      drawRows(K, sd, 0, slotKey(2, 0), n, { atLimit: KITCHEN_AT_LIMIT, held });
    // A seed where the halving changes week 2's hand.
    const seed = Array.from({ length: 200 }, (_, k) => `half-${k}`).find(
      (sd) => JSON.stringify(plainOf(sd)) !== JSON.stringify(halfOf(sd)),
    )!;
    expect(seed).toBeDefined();
    const before = (events: readonly GameEvent[]) =>
      eventsOf(events, 'handDrawn').map((h) => drawnBefore(h));
    const atLimit = R.apply(build([['kitchen', 0, 0]], { seed }), PASS);
    expect(before(atLimit.events)).toEqual([halfOf(seed)]);
    // A reroll that week draws at half weight too, leaving out the hand it replaces (D-132).
    const rerolled = R.apply(atLimit.state, { t: 'reroll' });
    expect(before(rerolled.events)).toEqual([halfOf(seed, 1, atLimit.state.hand)]);
    // Below the limit (no Kitchen yet), the same week draws at full weight.
    const below = R.apply(build([['bedroom', 0, 0]], { seed }), PASS);
    expect(before(below.events)).toEqual([plainOf(seed)]);
  });

  it('Kitchen cards come up about half as often while the Kitchen is at its limit', () => {
    let plain = 0;
    let half = 0;
    for (let k = 0; k < 2000; k++) {
      const seed = `odds-${k}`;
      plain += drawHand(K, seed, 0, '2', 0, 3).filter(isKitchenCard).length;
      half += drawHand(K, seed, 0, '2', 0, 3, { atLimit: KITCHEN_AT_LIMIT }).filter(
        isKitchenCard,
      ).length;
    }
    // Weight 2,000 of 11,000 against 1,000 of 10,000, three cards drawn without replacement:
    // a little over half as many (0.55 on these seeds).
    expect(half / plain).toBeGreaterThan(0.45);
    expect(half / plain).toBeLessThan(0.65);
  });
});

// ---------------------------------------------------------------------------------------

describe('run codes', () => {
  const BASE: RunCodeData = {
    build: 'renovate',
    contentHash: contentHash(K),
    setup: setup('renovate-code'),
    actions: [],
  };

  it('a renovate action round-trips, from the hand or the reserve, and as the pending play', () => {
    const data: RunCodeData = {
      ...BASE,
      actions: [renovate(0, 1), renovate(2, 7, 'reserve'), PASS, renovate(0, 0)],
      pending: renovate(1, 3, 'reserve'),
    };
    const code = encodeRunCode(data);
    const decoded = decodeRunCode(code);
    expect(decoded).toStrictEqual({ ok: true, data });
    expect(decoded.ok && encodeRunCode(decoded.data)).toBe(code);
  });

  it('decoding keeps only a Renovation’s known fields, and rejects a damaged one', () => {
    const extra = { t: 'renovate', from: 'hand', i: 1, uid: 2, level: 9, free: true };
    expect(decodeRunCode(rawCode({ ...BASE, actions: [extra] }))).toStrictEqual({
      ok: true,
      data: { ...BASE, actions: [renovate(1, 2)] },
    });
    const damaged = [
      { t: 'renovate', from: 'supplies', i: 0, uid: 1 },
      { t: 'renovate', from: 'hand', i: 0.5, uid: 1 },
      { t: 'renovate', from: 'hand', i: 0 },
      { t: 'renovate', from: 'hand', i: 0, uid: '1' },
    ];
    for (const bad of damaged) {
      expect(decodeRunCode(rawCode({ ...BASE, actions: [bad] })), JSON.stringify(bad)).toEqual({
        ok: false,
        error: 'That run code has an action this build doesn’t know.',
      });
    }
    expect(
      decodeRunCode(rawCode({ ...BASE, pending: { t: 'renovate', from: 'reserve', i: 0 } })),
    ).toEqual({ ok: false, error: 'That run code has a damaged pending placement.' });
  });

  it('replay() rebuilds the levels: a Kitchen renovated twice', () => {
    const runSetup = setup('renovate-replay');
    let s = R.newRun(runSetup);
    const actions: Action[] = [];
    const act = (a: Action) => {
      actions.push(a);
      s = R.apply(s, a).state;
    };
    // Week 1: a Kitchen, from the debug panel so the test doesn't depend on the draw.
    act({ t: 'debug', op: 'giveCard', id: 'kitchen' });
    act(R.legalPlacements(s).find((p) => p.from === 'hand' && p.i === s.hand.length - 1)!);
    const uid = s.house.pieces.find((p) => p.defId === 'kitchen')!.uid;
    // Weeks 2 and 3: an L-Kitchen card, then a Kitchen card, on it.
    act({ t: 'debug', op: 'giveCard', id: 'lKitchen' });
    act(renovate(s.hand.length - 1, uid));
    act({ t: 'debug', op: 'giveCard', id: 'kitchen' });
    act(renovate(s.hand.length - 1, uid));
    expect(pieceOf(s, uid)!.level).toBe(2);
    expect(s.week).toBe(4);

    const code = encodeRunCode({ ...BASE, setup: runSetup, actions });
    const decoded = decodeRunCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.actions).toEqual(actions);
    expect(R.replay(decoded.data.setup, decoded.data.actions)).toEqual({ state: s });

    // A third Renovation is one too many: the replay stops there, with the state before it.
    const stale: Action[] = [
      ...actions,
      { t: 'debug', op: 'giveCard', id: 'lKitchen' },
      renovate(s.hand.length, uid),
    ];
    const result = R.replay(runSetup, stale);
    expect(result.failedAt).toBe(actions.length + 1);
    expect(result.error).toBe('That Kitchen is fully renovated.');
    expect(pieceOf(result.state, uid)!.level).toBe(2);
  });
});
