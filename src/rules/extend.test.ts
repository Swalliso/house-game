// D-168, Extend a room: a room card of an extendable type (balance.extend.types: Bedroom, Kitchen,
// Living Room, Dining Room, by root type), laid on open ground beside a room of its type and
// sharing at least `extend.minShared` tiles of wall with it, joins that room. The room stays one
// piece (its uid, fixture, timers, level and place in the placement order) with the card's tiles
// in its own shape, up to `extend.maxPerRoom` cards a room, and earns `extend.pointsPerTile` flat
// Comfort for each tile beyond its own card's, before percentages. Counts don't change, so sets
// and the checklist count it once, as before.
// - placement's own rules hold for the card's tiles: on the lot, nothing built there, no water,
//   boulder or Old Shed; Trees under it go, and finds pay
// - it's the week's play, from the hand or the reserve; Weekend Crew can make it free
// - the Moving Truck carries the whole room, a demolition takes the whole room, and a transform
//   keeps its outline
//
// - Renovate is the fallback: a card renovates a room only where it can't extend it (no open
//   ground beside it, or grown already)
// - the Copy Machine copies the card, not the outline
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts), whose balance extends nothing: these turn
// on Bedrooms, Kitchens, Living Rooms and Dining Rooms (EXTEND). Houses are built on an empty 12×12 lot
// with houseFrom, so uids follow the placement order and every piece has placedWeek 1. The
// street runs along the bottom edge (y = 11), and it's Loud, so these houses keep off it. The
// Hendersons get an empty checklist here unless a test gives them one, so a week's total is its
// Points.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Card,
  Cell,
  Content,
  ExtendAction,
  GameEvent,
  PieceId,
  RenovateAction,
  ReservePiece,
  RunState,
  SpecDef,
  Supply,
  ToolId,
  UseToolAction,
} from './index.ts';
import { placedCells } from './grid.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { decodeRunCode, encodeRunCode, contentHash } from './runcode.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  withPieces,
  type Placement,
} from './testing.ts';

/** The balance's extendable types, at TEST_BALANCE's +1 Comfort a tile. */
const EXTEND: Balance['extend'] = {
  ...C.balance.extend,
  types: ['bedroom', 'kitchen', 'livingRoom', 'diningRoom'],
};

/** The Hendersons with this checklist, far-off targets, extensions on, and 4-week phases. */
function contentWith(
  specs: readonly SpecDef[],
  opts: { base?: Content; balance?: Partial<Balance> } = {},
): Content {
  const base = withClient({ specs, tastes: [] }, opts.base ?? C);
  return {
    ...base,
    balance: {
      ...base.balance,
      weeksPerPhase: 4,
      phases: [
        { name: 'Phase 1', target: 100_000 },
        { name: 'Phase 2', target: 200_000 },
      ],
      extend: EXTEND,
      ...opts.balance,
    },
  };
}

const R = createRules(contentWith([]));

const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const extend = (
  i: number,
  uid: number,
  x: number,
  y: number,
  rot: ExtendAction['rot'] = 0,
  from: ExtendAction['from'] = 'hand',
): ExtendAction => ({ t: 'extend', from, i, uid, x, y, rot });
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

/** A run in week 1 on a 12×12 lot (empty unless `rows`) with these pieces, cards and supplies. */
function build(
  placements: readonly Placement[],
  opts: {
    rules?: Rules;
    rows?: readonly string[];
    hand?: readonly Card[];
    reserve?: readonly ReservePiece[];
    supplies?: readonly Supply[];
  } = {},
): RunState {
  const r = opts.rules ?? R;
  const s = r.newRun(setup('extend'));
  return {
    ...s,
    house: houseFrom(r.content, opts.rows ?? emptyRows(12, 12), placements),
    hand: opts.hand ?? [],
    reserve: opts.reserve ?? [],
    supplies: opts.supplies ?? [],
  };
}

const pieceOf = (s: RunState, uid: number) => s.house.pieces.find((p) => p.uid === uid)!;
const scoreOf = (r: Rules, s: RunState, uid: number) =>
  r.currentTally(s).pieces.find((p) => p.uid === uid)!;
const cellsOf = (s: RunState, uid: number) => {
  const p = pieceOf(s, uid);
  return sorted(placedCells(p.shape ?? C.pieces[p.defId].shape, p.x, p.y, p.rot));
};
const sorted = (cells: readonly Cell[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => `${c.x},${c.y}`);

/** A lone Bedroom (uid 1) at (2, 2): its cells are (2–3, 2–3). */
const BEDROOM: Placement[] = [['bedroom', 2, 2]];

describe('extending a room', () => {
  it('a Bedroom card beside a Bedroom joins it: one piece, a bigger outline, +1 Comfort a tile', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom'), pc('closet')] });
    expect(scoreOf(R, s, 1)).toMatchObject({ points: 3, earned: 3 });
    const play = extend(0, 1, 4, 2);
    const check = R.checkPlay(s, play);
    expect(check).toMatchObject({ legal: true, clearedTrees: [] });
    // checkPlay gives the card's own tiles: where the ghost's new part goes.
    expect(sorted(check.cells)).toEqual(['4,2', '5,2', '4,3', '5,3']);

    const { state, events } = R.apply(s, play);
    expect(types(events)).toEqual(['extended', 'tally', 'handDrawn']);
    expect(eventsOf(events, 'extended')).toEqual([
      {
        t: 'extended',
        uid: 1,
        defId: 'bedroom',
        card: 'bedroom',
        cells: check.cells,
        clearedTrees: [],
      },
    ]);
    // The same uid, placement order and week; its own shape is the whole outline, unturned.
    expect(state.house.pieces).toEqual([
      {
        uid: 1,
        defId: 'bedroom',
        x: 2,
        y: 2,
        rot: 0,
        placedWeek: 1,
        shape: ['####', '####'],
        extended: 1,
      },
    ]);
    expect(state.house.nextUid).toBe(s.house.nextUid);
    // 3 steady + 4 for its 4 more tiles; the week's tally had it already.
    const score = scoreOf(R, state, 1);
    expect(score).toMatchObject({ points: 7, earned: 7 });
    expect(score.lines).toContainEqual({
      label: 'Extended (4 more tiles)',
      op: 'add',
      value: 4,
      from: [],
    });
    expect(eventsOf(events, 'tally')[0]!.tally.total).toBe(7);
  });

  it('growing the room up or left moves its corner; the cells are the room’s and the card’s', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom')] });
    const up = R.apply(s, extend(0, 1, 2, 0)).state;
    expect(pieceOf(up, 1)).toMatchObject({ x: 2, y: 0, rot: 0, shape: ['##', '##', '##', '##'] });
    expect(cellsOf(up, 1)).toEqual(sorted(placedCells(['##', '##', '##', '##'], 2, 0, 0)));
    const left = R.apply(s, extend(0, 1, 0, 2)).state;
    expect(pieceOf(left, 1)).toMatchObject({ x: 0, y: 2, shape: ['####', '####'] });
  });

  it('the card must share 2 tiles of wall with the room', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom')] });
    // One step down from flush: only one tile of wall in common.
    const reason = 'It must share 2 tiles of wall with the Bedroom.';
    expect(R.checkPlay(s, extend(0, 1, 4, 3))).toMatchObject({ legal: false, reason });
    expect(() => R.apply(s, extend(0, 1, 4, 3))).toThrow(IllegalAction);
    expect(() => R.apply(s, extend(0, 1, 4, 3))).toThrow(reason);
    // Off on its own, it isn't beside the house at all.
    expect(R.checkPlay(s, extend(0, 1, 8, 8)).reason).toBe('Rooms must connect to the house.');
    // A 2×2 beside a 2×2 room fits only flush: once on each side.
    expect(R.extendSpots(s, 'hand', 0)).toEqual([
      extend(0, 1, 2, 0),
      extend(0, 1, 0, 2),
      extend(0, 1, 4, 2),
      extend(0, 1, 2, 4),
    ]);
    expect(R.extendTargets(s, 'hand', 0)).toEqual([1]);
  });

  it('the shared wall comes from the balance', () => {
    const r = createRules(contentWith([], { balance: { extend: { ...EXTEND, minShared: 1 } } }));
    const s = build(BEDROOM, { rules: r, hand: [pc('bedroom')] });
    expect(r.checkPlay(s, extend(0, 1, 4, 3)).legal).toBe(true);
    expect(r.extendSpots(s, 'hand', 0)).toHaveLength(12);
  });

  it('works by root type: an L-Kitchen card grows a Kitchen, and a Bedroom card a member’s room', () => {
    const k = build([['kitchen', 2, 2]], { hand: [pc('lKitchen')] });
    // The L, turned so its two tiles in a column stand against the Kitchen's east wall.
    const spots = R.extendSpots(k, 'hand', 0);
    expect(spots.length).toBeGreaterThan(0);
    const { state, events } = R.apply(k, spots[0]!);
    expect(eventsOf(events, 'extended')[0]).toMatchObject({ defId: 'kitchen', card: 'lKitchen' });
    expect(cellsOf(state, 1)).toHaveLength(7);
    // 3 more tiles than the Kitchen's own 4.
    expect(scoreOf(R, state, 1).points).toBe(3);
    // Grandma's Room counts as a Bedroom: a Bedroom card can grow it.
    const g = build([['grandmasRoom', 2, 2]], { hand: [pc('bedroom'), pc('grandmasRoom')] });
    expect(R.checkPlay(g, extend(0, 1, 4, 2)).legal).toBe(true);
    // Her own card can't be spent on a room.
    expect(R.checkPlay(g, extend(1, 1, 4, 2))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('household member’s room'),
    });
    expect(R.extendTargets(g, 'hand', 1)).toEqual([]);
  });

  it('a card of another type, or one that never extends, is illegal', () => {
    const s = build(
      [
        ['bedroom', 2, 2],
        ['kitchen', 4, 2],
      ],
      { hand: [pc('kitchen'), pc('bathroom')] },
    );
    expect(R.checkPlay(s, extend(0, 1, 2, 0))).toMatchObject({
      legal: false,
      reason: 'A Kitchen card extends a Kitchen.',
    });
    expect(R.extendTargets(s, 'hand', 0)).toEqual([2]);
    expect(R.checkPlay(s, extend(1, 1, 2, 0))).toMatchObject({
      legal: false,
      reason: 'A Bathroom card can’t extend a room.',
    });
    expect(R.extendTargets(s, 'hand', 1)).toEqual([]);
    expect(R.checkPlay(s, extend(2, 1, 2, 0)).reason).toBe('There is no card there.');
    expect(R.checkPlay(s, extend(0, 9, 2, 0)).reason).toBe('Pick a room to extend.');
  });

  it('a room grows once: then it’s as big as it gets', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom'), pc('bedroom')] });
    const once = R.apply(s, extend(0, 1, 4, 2)).state;
    const again = { ...once, hand: [pc('bedroom')] };
    expect(R.checkPlay(again, extend(0, 1, 2, 0))).toMatchObject({
      legal: false,
      reason: 'That Bedroom is as big as it gets.',
    });
    expect(R.extendTargets(again, 'hand', 0)).toEqual([]);
    expect(R.legalPlays(again).some((p) => p.t === 'extend')).toBe(false);
  });

  it('placement’s ground rules hold for the card’s tiles', () => {
    // A pond tile east of the Bedroom, a Tree south of it.
    const rows = emptyRows(12, 12).map((row, y) =>
      y === 2
        ? `${row.slice(0, 5)}P${row.slice(6)}`
        : y === 4
          ? `${row.slice(0, 3)}T${row.slice(4)}`
          : row,
    );
    const s = build(BEDROOM, { rows, hand: [pc('bedroom')] });
    expect(R.checkPlay(s, extend(0, 1, 4, 2))).toMatchObject({
      legal: false,
      reason: "You can't build on the pond.",
    });
    const south = R.checkPlay(s, extend(0, 1, 2, 4));
    expect(south).toMatchObject({ legal: true, clearedTrees: [{ x: 3, y: 4 }] });
    const { state, events } = R.apply(s, extend(0, 1, 2, 4));
    expect(eventsOf(events, 'extended')[0]!.clearedTrees).toEqual([{ x: 3, y: 4 }]);
    expect(state.house.lot.terrain[4 * 12 + 3]).toBeNull();
    // Something built there already.
    const busy = build([...BEDROOM, ['closet', 4, 3]], { hand: [pc('bedroom')] });
    expect(R.checkPlay(busy, extend(0, 1, 4, 2)).legal).toBe(false);
  });

  it('counts don’t change: the house still has one Bedroom', () => {
    const spec: SpecDef = {
      id: 'beds',
      name: 'Two Bedrooms',
      group: 'household',
      condition: { count: { piece: 'bedroom' }, min: 2, max: 2 },
    };
    const r = createRules(contentWith([spec]));
    const s = build(BEDROOM, { rules: r, hand: [pc('bedroom')] });
    const { state } = r.apply(s, extend(0, 1, 4, 2));
    expect(r.limits(state)).toEqual([{ types: ['bedroom'], max: 2, count: 1 }]);
    expect(r.checklist(state)[0]).toMatchObject({ id: 'beds', met: false });
  });

  it('from the reserve, the reserve card is spent', () => {
    const s = build(BEDROOM, { reserve: [{ id: 'bedroom' }] });
    expect(R.extendTargets(s, 'reserve', 0)).toEqual([1]);
    const { state } = R.apply(s, extend(0, 1, 4, 2, 0, 'reserve'));
    expect(state.reserve).toEqual([]);
    expect(pieceOf(state, 1).extended).toBe(1);
  });

  it('preview names the room and its outline once grown; the room is the new line', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom')] });
    const p = R.preview(s, extend(0, 1, 4, 2));
    expect(p).toMatchObject({ legal: true, delta: 4, before: { total: 3 }, after: { total: 7 } });
    expect(p.extends!.uid).toBe(1);
    expect(sorted(p.extends!.cells)).toEqual(sorted(placedCells(['####', '####'], 2, 2, 0)));
    expect(p.lines[0]).toMatchObject({ uid: 1, isNew: true, before: 3, after: 7 });
    expect(p.newPiece).toMatchObject({ uid: 1, earned: 7 });
    // A refused spot says why, and shows where the card would go.
    const bad = R.preview(s, extend(0, 1, 4, 3));
    expect(bad).toMatchObject({ legal: false, reason: expect.stringContaining('2 tiles') });
    expect(bad.cells).toHaveLength(4);
  });

  it('legalPlays lists each extension; a card that can only extend has a play', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom')] });
    const ext = R.legalPlays(s).filter((p) => p.t === 'extend');
    expect(ext).toEqual(R.extendSpots(s, 'hand', 0));
  });
});

describe('Renovate is the fallback', () => {
  const ONE_KITCHEN: SpecDef = {
    id: 'oneKitchen',
    name: 'One Kitchen',
    group: 'household',
    condition: { count: { piece: 'kitchen' }, min: 1, max: 1 },
  };
  const r = createRules(contentWith([ONE_KITCHEN]));
  const renovate = (i: number, uid: number): RenovateAction => ({
    t: 'renovate',
    from: 'hand',
    i,
    uid,
  });

  it('a capped card on a room that can grow grows it; it renovates only a room boxed in', () => {
    const open = build([['kitchen', 2, 2]], { rules: r, hand: [pc('kitchen')] });
    expect(r.checkPlay(open, renovate(0, 1))).toMatchObject({
      legal: false,
      reason: 'That Kitchen can still grow.',
    });
    expect(r.renovateTargets(open, 'hand', 0)).toEqual([]);
    expect(r.extendTargets(open, 'hand', 0)).toEqual([1]);
    // In the lot's corner, a Closet on each side it could grow into.
    const boxed = build(
      [
        ['kitchen', 0, 0],
        ['closet', 2, 1],
        ['closet', 0, 2],
      ],
      { rules: r, hand: [pc('kitchen')] },
    );
    expect(r.extendSpots(boxed, 'hand', 0)).toEqual([]);
    expect(r.checkPlay(boxed, renovate(0, 1))).toMatchObject({
      legal: true,
      renovate: { uid: 1, level: 1, card: 'kitchen' },
    });
  });

  it('a room grown already can be renovated', () => {
    const s = build([['kitchen', 2, 2]], { rules: r, hand: [pc('kitchen')] });
    const grown = { ...r.apply(s, extend(0, 1, 4, 2)).state, hand: [pc('kitchen')] };
    expect(r.extendTargets(grown, 'hand', 0)).toEqual([]);
    expect(r.checkPlay(grown, renovate(0, 1))).toMatchObject({
      legal: true,
      renovate: { uid: 1, level: 1, card: 'kitchen' },
    });
  });
});

describe('Weekend Crew: an extension can be its free play', () => {
  it('a free extension doesn’t end the week', () => {
    const s = build(BEDROOM, {
      hand: [pc('bedroom'), pc('closet')],
      supplies: [tool('weekendCrew')],
    });
    const ready = R.apply(s, use(0)).state;
    expect(ready.freePlay).toBe('ready');
    const free = R.apply(ready, extend(0, 1, 4, 2));
    expect(free.events).toEqual([
      {
        t: 'extended',
        uid: 1,
        defId: 'bedroom',
        card: 'bedroom',
        cells: [
          { x: 4, y: 2 },
          { x: 5, y: 2 },
          { x: 4, y: 3 },
          { x: 5, y: 3 },
        ],
        clearedTrees: [],
        free: true,
      },
    ]);
    expect(free.state).toMatchObject({ week: 1, freePlay: 'used', score: 0 });
    expect(free.state.hand).toEqual([pc('closet')]);
  });
});

describe('an extended room stays one piece', () => {
  const grown = () =>
    R.apply(build(BEDROOM, { hand: [pc('bedroom')], supplies: [tool('movingTruck')] }), {
      ...extend(0, 1, 4, 2),
    }).state;

  it('the Moving Truck carries the whole room, and can turn it', () => {
    const s = { ...grown(), supplies: [tool('movingTruck')] };
    const move = use(0, { uid: 1, x: 6, y: 5, rot: 1 });
    expect(R.previewTool(s, move)).toMatchObject({ ok: true, delta: 0 });
    const { state } = R.apply(s, move);
    expect(pieceOf(state, 1)).toMatchObject({
      x: 6,
      y: 5,
      rot: 1,
      shape: ['####', '####'],
      extended: 1,
    });
    expect(cellsOf(state, 1)).toEqual(sorted(placedCells(['##', '##', '##', '##'], 6, 5, 0)));
    expect(scoreOf(R, state, 1).points).toBe(7);
  });

  it('a demolition takes the whole room, from any of its tiles', () => {
    const s = grown();
    const { state } = R.apply(s, { t: 'demolish', x: 5, y: 3 });
    expect(state.house.pieces).toEqual([]);
  });

  it('a transform keeps its outline and what its size pays', () => {
    // A test Bedroom that becomes a Library (both 2×2) once it's a week old.
    const base = withPieces({
      bedroom: {
        effects: [
          ...C.pieces.bedroom.effects,
          { kind: 'transform', into: { piece: 'library' }, afterWeeks: 1 },
        ],
      },
    });
    const r = createRules(contentWith([], { base }));
    const s = build(BEDROOM, { rules: r, hand: [pc('bedroom')] });
    const { state, events } = r.apply(s, extend(0, 1, 4, 2));
    expect(eventsOf(events, 'transformed')).toMatchObject([{ uid: 1, into: { piece: 'library' } }]);
    expect(pieceOf(state, 1)).toMatchObject({
      defId: 'library',
      shape: ['####', '####'],
      extended: 1,
    });
    const lines = scoreOf(r, state, 1).lines;
    expect(lines).toContainEqual(expect.objectContaining({ label: 'Extended (4 more tiles)' }));
  });

  it('a run code carries the extension, and replays it', () => {
    const s = build(BEDROOM, { hand: [pc('bedroom')] });
    const play = extend(0, 1, 4, 2);
    const code = encodeRunCode({
      build: 'test',
      contentHash: contentHash(R.content),
      setup: s.setup,
      actions: [play],
      pending: play,
    });
    const decoded = decodeRunCode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.data.actions).toEqual([play]);
      expect(decoded.data.pending).toEqual(play);
    }
  });

  it('the Copy Machine copies the card, not the outline', () => {
    const s = { ...grown(), supplies: [tool('copyMachine')] };
    const { state } = R.apply(s, use(0, { uid: 1 }));
    expect(state.reserve).toEqual([{ id: 'bedroom' }]);
    expect(pieceOf(state, 1)).toEqual(pieceOf(s, 1));
  });

  it('a pass after it changes nothing', () => {
    const s = grown();
    const next = R.apply({ ...s, hand: [] }, PASS).state;
    expect(pieceOf(next, 1)).toEqual(pieceOf(s, 1));
  });
});
