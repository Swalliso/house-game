// Packs (D-102): the Fence and the Driveway place 1 to `maxTiles` connected tiles from one card,
// as one piece with its own shape. A pack's play carries its tiles (PlaceAction.shape: (x, y) is
// their top-left corner, at rot 0), and the placed piece keeps them (PlacedPiece.shape, turned by
// rot like any shape). Here: a pack play's legality and its reasons; one piece in the house, the
// layout, the events, and describePiece; the Fence's one enclosure payout; the Driveway's street
// rule, the creek, and the Garage; demolition and the Moving Truck; preview against the tally;
// legalPlacements and cardFits; Weekend Crew; run codes and replay.
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts): the Fence takes up to 8 tiles and
// suggests ['####'] and the L; the Driveway takes up to 6 and suggests ['###'] and ['#####'].
// Most houses are built on an empty 12×12 lot with houseFrom, so uids follow the placement order
// (1, 2, …) and every piece has placedWeek 1. The street runs along the bottom edge (y = 11),
// rows 0–3 are the sunny side, and a fenced yard needs 4 tiles (fencedYardMin).

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Card,
  Cell,
  Content,
  GameEvent,
  PieceId,
  PlaceAction,
  Rot,
  RunCodeData,
  RunState,
  Supply,
  ToolId,
  UseToolAction,
} from './index.ts';
import { placedCells, rotateShape } from './grid.ts';
import { computeLayout } from './layout.ts';
import { REASONS } from './placement.ts';
import { createRules, IllegalAction } from './run.ts';
import { base64urlEncode, contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';

/** TEST_CONTENT with targets far out of reach and 4-week phases, so no tally ends a phase. */
const BIG: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: 4,
    phases: [
      { name: 'Phase 1', target: 100_000 },
      { name: 'Phase 2', target: 200_000 },
    ],
  },
};
const R = createRules(BIG);

/** The Fence's suggested L. */
const L = ['#..', '#..', '###'];
const STREET = 'Driveway must be built touching the street or a Driveway.';

const pc = (id: PieceId): Card => ({ kind: 'piece', id });

/** A pack card's play (D-102): these tiles, their top-left corner at (x, y), at rot 0. */
const pack = (
  i: number,
  x: number,
  y: number,
  shape: readonly string[],
  from: PlaceAction['from'] = 'hand',
): PlaceAction => ({ t: 'place', from, i, x, y, rot: 0, shape });

/** Any other card's play: its own shape, turned. */
const place = (i: number, x: number, y: number, rot: Rot = 0): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot,
});

const moveTo = (i: number, uid: number, x: number, y: number, rot: Rot = 0): UseToolAction => ({
  t: 'useTool',
  i,
  target: { uid, x, y, rot },
});

/** A run in week 1 on a 12×12 lot (empty unless `rows`) with these pieces, hand, and tools. */
function build(
  placements: readonly Placement[],
  opts: { hand?: readonly Card[]; tools?: readonly ToolId[]; rows?: readonly string[] } = {},
): RunState {
  const s = R.newRun(setup('packs'));
  return {
    ...s,
    house: houseFrom(BIG, opts.rows ?? emptyRows(12, 12), placements),
    hand: opts.hand ?? [pc('fence'), pc('driveway'), pc('bedroom')],
    reserve: [],
    supplies: (opts.tools ?? []).map((id): Supply => ({ kind: 'tool', id })),
  };
}

/** Cells as "x,y", row by row, so lists compare whatever their order. */
const sortCells = (cells: readonly Cell[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => `${c.x},${c.y}`);

/** The tiles a shape covers with its corner at (x, y), turned `rot`, as sortCells lists them. */
const tilesOf = (shape: readonly string[], x: number, y: number, rot: Rot = 0) =>
  sortCells(placedCells(shape, x, y, rot));

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

const earnedOf = (s: RunState, uid: number) =>
  R.currentTally(s).pieces.find((p) => p.uid === uid)?.earned;

// ---------------------------------------------------------------------------------------

describe('a pack’s play', () => {
  it('takes any 1 to maxTiles touching tiles, (x, y) their top-left corner', () => {
    const s = build([]);
    const shapes = [
      ['#'],
      ['####'],
      L,
      ['##', '##'],
      ['.#.', '###'],
      ['#.#', '###'],
      ['########'], // 8 in a row
      ['####', '####'], // 8 in a block
    ];
    for (const shape of shapes) {
      const check = R.checkPlay(s, pack(0, 2, 2, shape));
      expect(check.legal, shape.join('/')).toBe(true);
      expect(sortCells(check.cells), shape.join('/')).toEqual(tilesOf(shape, 2, 2));
    }
    // The Driveway takes up to 6, here along the street row.
    expect(R.checkPlay(s, pack(1, 0, 11, ['######'])).legal).toBe(true);
    expect(R.checkPlay(s, pack(1, 0, 10, ['###', '###'])).legal).toBe(true);
  });

  it('refuses too many tiles, tiles apart, an empty first row or column, other characters, or none', () => {
    const s = build([]);
    const TOO_MANY = 'Up to 8 tiles, all touching.';
    const APART = 'A pack’s tiles must all touch.';
    const EDGE = 'That shape has an empty edge.';
    const cases: [unknown, string][] = [
      [['#########'], TOO_MANY], // 9 in a row
      [['#####', '####.'], TOO_MANY], // 9 in two rows
      [['###', '###', '###'], TOO_MANY],
      [['#.#'], APART],
      [['#.', '.#'], APART], // corners don't touch
      [['##.', '...', '.##'], APART],
      [['.#'], EDGE], // the first column is empty
      [['..', '##'], EDGE], // the first row is empty
      [['#x#'], TOO_MANY], // '#' and '.' only
      [['##', '#'], TOO_MANY], // rows of one length
      [['....'], TOO_MANY], // no tiles
      [[], TOO_MANY],
      [[''], TOO_MANY],
      ['####', TOO_MANY], // not rows at all
    ];
    for (const [shape, reason] of cases) {
      const play = { ...pack(0, 2, 2, ['#']), shape: shape as string[] };
      expect(R.checkPlay(s, play), JSON.stringify(shape)).toMatchObject({ legal: false, reason });
    }
    // The Driveway's limit is its own.
    expect(R.checkPlay(s, pack(1, 0, 11, ['#######'])).reason).toBe('Up to 6 tiles, all touching.');
    // A pack card needs its tiles, and any other card refuses them.
    expect(R.checkPlay(s, place(0, 2, 2))).toMatchObject({
      legal: false,
      reason: 'Click out the Fence’s tiles: up to 8.',
    });
    expect(R.checkPlay(s, place(1, 0, 11))).toMatchObject({
      legal: false,
      reason: 'Click out the Driveway’s tiles: up to 6.',
    });
    expect(R.checkPlay(s, { ...place(2, 2, 2), shape: ['##', '##'] })).toMatchObject({
      legal: false,
      reason: 'A Bedroom has its own shape.',
    });
    // apply() throws with the same reason, and preview() shows it.
    expect(() => R.apply(s, pack(0, 2, 2, ['#.#']))).toThrow(IllegalAction);
    expect(() => R.apply(s, pack(0, 2, 2, ['#.#']))).toThrow(APART);
    expect(() => R.apply(s, place(0, 2, 2))).toThrow('Click out the Fence’s tiles: up to 8.');
    expect(R.preview(s, pack(0, 2, 2, ['#.#']))).toMatchObject({
      legal: false,
      reason: APART,
      delta: 0,
    });
  });

  it('is checked tile by tile like any placement, and clears the Trees under it', () => {
    const rows = emptyRows(12, 12);
    rows[0] = '..P.........';
    rows[5] = '.....T......';
    const s = build([['bedroom', 6, 0]], { rows }); // (6..7, 0..1)
    expect(R.checkPlay(s, pack(0, 9, 3, ['####'])).reason).toBe(REASONS.offLot); // x 9..12
    expect(R.checkPlay(s, pack(0, 4, 1, ['####'])).reason).toBe(REASONS.occupied); // (6..7, 1)
    expect(R.checkPlay(s, pack(0, 0, 0, ['####'])).reason).toBe(REASONS.pond); // (2, 0)
    expect(R.checkPlay(s, pack(0, 3, 5, ['####']))).toMatchObject({
      legal: true,
      clearedTrees: [{ x: 5, y: 5 }],
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('a placed pack is one piece', () => {
  // The Bedroom (uid 1) in the corner; 7 tiles of Fence along its side and front close the
  // 4 tiles beside it (x 2–3, rows 0–1).
  //   y0  BB..#
  //   y1  BB..#
  //   y2  #####
  const SHAPE = ['....#', '....#', '#####'];

  it('with the shape’s tiles: in the house, the layout, the placed event, and describePiece', () => {
    const s = build([['bedroom', 0, 0]]);
    const { state, events } = R.apply(s, pack(0, 0, 0, SHAPE));
    const want = ['4,0', '4,1', '0,2', '1,2', '2,2', '3,2', '4,2'];
    expect(tilesOf(SHAPE, 0, 0)).toEqual(want);
    // One piece, uid 2, keeping its own tiles at rot 0.
    expect(state.house.pieces).toEqual([
      s.house.pieces[0],
      { uid: 2, defId: 'fence', x: 0, y: 0, rot: 0, placedWeek: 1, shape: SHAPE },
    ]);
    expect(state.house.nextUid).toBe(3);
    const placed = eventsOf(events, 'placed');
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ uid: 2, defId: 'fence', x: 0, y: 0, rot: 0 });
    expect(sortCells(placed[0]!.cells)).toEqual(want);
    // The layout gives the piece every tile, and every tile to the piece.
    const layout = computeLayout(BIG, state.house);
    expect(sortCells(layout.cells.get(2)!)).toEqual(want);
    for (const c of layout.cells.get(2)!) expect(layout.occupant[c.y * 12 + c.x]).toBe(2);
    expect(layout.fencedSizes).toEqual([4]);
    // describePiece reads it whole. Its regions are those of every tile: all sunny, but it's
    // partly behind the house's front row (row 1) and partly in front, so in neither yard.
    expect(R.describePiece(state, 2)).toEqual({
      tags: ['Sunny'],
      tagSources: { Sunny: [{ kind: 'sunny' }] },
      side: null,
      regions: ['sunny'],
      view: false,
      linked: [],
      fencedYardTiles: 4,
    });
    // One piece earns once: +1 per tile of the yard it borders.
    expect(earnedOf(state, 2)).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------

describe('the Fence pack’s enclosure', () => {
  // A Bedroom in the corner of a 5-wide lot; a Fence across row 3 closes the 11 tiles behind
  // it. Tiles hanging below row 3 are outside the yard, which runs down to the street.
  //   y0  BB...
  //   y1  BB...
  //   y2  .....
  //   y3  #####
  const LOT = emptyRows(5, 8);
  const yard = (...fences: Placement[]) => build([['bedroom', 0, 0], ...fences], { rows: LOT });

  it('pays once for the yard it closes, capped at 6, however many tiles it has', () => {
    const shapes = [
      ['#####'],
      ['#####', '....#'],
      ['#####', '#...#', '#....'],
      ['#####', '....#', '....#', '....#'],
    ];
    for (const shape of shapes) {
      const s = yard(['fence', 0, 3, 0, shape]);
      expect(R.fencedYards(s), shape.join('/')).toEqual([11]);
      const t = R.currentTally(s);
      expect(
        t.pieces.map((p) => p.earned),
        shape.join('/'),
      ).toEqual([3, 6]);
      expect(t.pieces[1]!.lines).toEqual([
        { label: 'Fenced yard of 11 tiles (up to 6)', op: 'add', value: 6, from: [] },
      ]);
    }
    // The same yard closed by two Fences pays each of them.
    const two = yard(['fence', 0, 3, 0, ['##']], ['fence', 2, 3, 0, ['###']]);
    expect(R.fencedYards(two)).toEqual([11]);
    expect(R.currentTally(two).pieces.map((p) => p.earned)).toEqual([3, 6, 6]);
  });

  it('pays a tile each under the cap, and nothing for a yard it doesn’t border', () => {
    // On a 4-wide lot, a 1×4 across row 2 closes x 2–3, rows 0–1: 4 tiles.
    const small = build(
      [
        ['bedroom', 0, 0],
        ['fence', 0, 2, 0, ['####']],
      ],
      { rows: emptyRows(4, 8) },
    );
    expect(R.fencedYards(small)).toEqual([4]);
    expect(earnedOf(small, 2)).toBe(4);
    // A second pack out by the street borders no fenced yard.
    const apart = yard(['fence', 0, 3, 0, ['#####']], ['fence', 0, 6, 0, ['###', '#..']]);
    expect(R.fencedYards(apart)).toEqual([11]);
    expect(earnedOf(apart, 2)).toBe(6);
    expect(earnedOf(apart, 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------

describe('the Driveway pack', () => {
  it('must touch the street or a Driveway with one of its tiles, any one', () => {
    const s = build([], { hand: [pc('driveway')] });
    // An L whose foot is on the street row (11); a row higher, it touches neither.
    expect(R.checkPlay(s, pack(0, 4, 9, L)).legal).toBe(true);
    expect(R.checkPlay(s, pack(0, 4, 8, L))).toMatchObject({ legal: false, reason: STREET });
    // Upright, only its bottom tile reaches the street.
    expect(R.checkPlay(s, pack(0, 0, 6, ['#', '#', '#', '#', '#', '#'])).legal).toBe(true);
    // Off another Driveway (uid 1, at (6, 9..11)): one tile on its top is enough.
    const off = build([['driveway', 6, 9, 1]], { hand: [pc('driveway')] });
    expect(R.checkPlay(off, pack(0, 3, 8, ['####'])).legal).toBe(true); // (3..6, 8)
    expect(R.checkPlay(off, pack(0, 2, 8, ['####']))).toMatchObject({
      legal: false,
      reason: STREET,
    });
  });

  it('crosses the creek, which stays, and a Garage on the far bank can touch it', () => {
    // The creek runs across row 8; the street is below row 11.
    const rows = emptyRows(12, 12);
    rows[8] = 'CCCCCCCCCCCC';
    const s = build([], { rows, hand: [pc('driveway'), pc('garage'), pc('lawn')] });
    const UP = ['#', '#', '#', '#', '#', '#']; // (5, 6..11)
    expect(R.checkPlay(s, pack(0, 5, 6, UP))).toMatchObject({ legal: true, clearedTrees: [] });
    // Nothing else crosses it.
    expect(R.checkPlay(s, place(2, 4, 7)).reason).toBe(REASONS.creek);
    const { state } = R.apply(s, pack(0, 5, 6, UP));
    expect(state.house.lot.terrain[8 * 12 + 5]).toBe('creek');
    // A Garage at (6..7, 5..6), on the far bank, touches only the Driveway's top tile (5, 6).
    const far: RunState = { ...state, hand: [pc('garage')] };
    expect(R.checkPlay(far, place(0, 6, 5)).legal).toBe(true);
    expect(R.checkPlay(far, place(0, 8, 5))).toMatchObject({
      legal: false,
      reason: 'Garage must be built touching the street or a Driveway.',
    });
    const after = R.apply(far, place(0, 6, 5)).state;
    const garage = R.currentTally(after).pieces.find((p) => p.defId === 'garage')!;
    expect(garage.unmet).toBeUndefined();
    expect(garage.earned).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------

describe('demolishing a pack', () => {
  it('takes the whole piece down from any of its tiles', () => {
    const s = build([['fence', 2, 2, 0, L]]); // uid 1: (2,2) (2,3) (2,4) (3,4) (4,4)
    expect(s.demolitionsLeft).toBeGreaterThan(0);
    const all = tilesOf(L, 2, 2);
    // Listed once, at its first tile.
    expect(R.legalActions(s).filter((a) => a.t === 'demolish')).toEqual([
      { t: 'demolish', x: 2, y: 2 },
    ]);
    for (const { x, y } of placedCells(L, 2, 2, 0)) {
      const p = R.previewDemolish(s, x, y);
      expect(p, `${x},${y}`).toMatchObject({ legal: true, target: { uid: 1, defId: 'fence' } });
      expect(sortCells(p.cells)).toEqual(all);
      const { state, events } = R.apply(s, { t: 'demolish', x, y });
      expect(state.house.pieces).toEqual([]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        t: 'demolished',
        uid: 1,
        defId: 'fence',
        demolitionsLeft: s.demolitionsLeft - 1,
      });
      expect(sortCells(eventsOf(events, 'demolished')[0]!.cells)).toEqual(all);
    }
    // The tile in the L's crook isn't the pack's.
    expect(R.previewDemolish(s, 3, 3)).toMatchObject({
      legal: false,
      reason: REASONS.nothingThere,
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('the Moving Truck and a pack', () => {
  it('moves it whole, keeping its tiles; turned, its tiles turn with it', () => {
    const s = build([['fence', 2, 2, 0, L]], { tools: ['movingTruck'] });
    const { state, events } = R.apply(s, moveTo(0, 1, 6, 6));
    expect(state.house.pieces).toEqual([
      { uid: 1, defId: 'fence', x: 6, y: 6, rot: 0, placedWeek: 1, shape: L },
    ]);
    const moved = eventsOf(events, 'moved')[0]!;
    expect(sortCells(moved.from)).toEqual(tilesOf(L, 2, 2));
    expect(sortCells(moved.cells)).toEqual(tilesOf(L, 6, 6));
    // A quarter turn: the L's rows turn too, from the same corner.
    expect(rotateShape(L, 1)).toEqual(['###', '#..', '#..']);
    const want = tilesOf(['###', '#..', '#..'], 6, 6);
    const turn = moveTo(0, 1, 6, 6, 1);
    expect(sortCells(R.previewTool(s, turn).cells)).toEqual(want);
    const turned = R.apply(s, turn).state;
    expect(turned.house.pieces).toEqual([
      { uid: 1, defId: 'fence', x: 6, y: 6, rot: 1, placedWeek: 1, shape: L },
    ]);
    expect(sortCells(computeLayout(BIG, turned.house).cells.get(1)!)).toEqual(want);
    // It's checked as the pack it is: every tile on the lot.
    expect(R.canUseTool(s, moveTo(0, 1, 10, 0))).toEqual({ ok: false, reason: REASONS.offLot });
  });

  it('keeps a Driveway pack to its street rule', () => {
    // uid 1 at (0, 9..11), upright, on the street.
    const s = build([['driveway', 0, 9, 0, ['#', '#', '#']]], { tools: ['movingTruck'] });
    expect(R.canUseTool(s, moveTo(0, 1, 5, 9))).toEqual({ ok: true });
    expect(R.canUseTool(s, moveTo(0, 1, 5, 5))).toEqual({ ok: false, reason: STREET });
    // Turned flat along the street row, it still reaches it.
    expect(R.canUseTool(s, moveTo(0, 1, 5, 11, 1))).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------------------

describe('preview and the tally agree on a pack', () => {
  it('preview’s after is the week’s tally from apply(), and scoreOnly’s total', () => {
    // The Bedroom in the corner; 8 tiles of Fence close the 6 tiles beside it.
    //   y0  BB...#
    //   y1  BB...#
    //   y2  ######
    const CLOSE = ['.....#', '.....#', '######'];
    const s = build([['bedroom', 0, 0]]);
    const play = pack(0, 0, 0, CLOSE);
    const p = R.preview(s, play);
    // The Bedroom's 3, and the Fence's 6 for the yard.
    expect(p).toMatchObject({ legal: true, after: { points: 9, mult: 100, total: 9 }, delta: 6 });
    expect(p.newPiece).toMatchObject({ uid: 2, defId: 'fence', earned: 6 });
    expect(sortCells(p.cells)).toEqual(tilesOf(CLOSE, 0, 0));
    const tally = eventsOf(R.apply(s, play).events, 'tally')[0]!.tally;
    expect({ points: tally.points, mult: tally.mult, total: tally.total }).toEqual(p.after);
    expect(R.scoreOnly(s, play)).toBe(p.after.total);
  });

  it('agrees for pack plays across a lot, the ones that close a yard among them', () => {
    // A Bedroom and a short Fence below it: an upright pack at x 3 closes 5 tiles, and others
    // close yards of their own.
    const s = build([
      ['bedroom', 0, 0],
      ['fence', 0, 3, 0, ['###']],
    ]);
    const plays = R.legalPlacements(s).filter((p) => p.shape);
    expect(plays.length).toBeGreaterThan(500);
    const closing = plays.filter((p) => R.estimatePlay(s, p).yardHint);
    expect(closing).toContainEqual(pack(0, 3, 0, ['#', '#', '#', '#']));
    const sample = [...closing, ...plays.filter((_, k) => k % 23 === 0)];
    for (const play of sample) {
      const what = JSON.stringify(play);
      const p = R.preview(s, play);
      const tally = eventsOf(R.apply(s, play).events, 'tally')[0]!.tally;
      expect(p.after.total, what).toBe(tally.total);
      expect(R.scoreOnly(s, play), what).toBe(tally.total);
    }
  });
});

// ---------------------------------------------------------------------------------------

describe('legalPlacements and cardFits for a pack', () => {
  it('lists a single tile and each suggested shape in each rotation, at rot 0 with its tiles', () => {
    const s = build([], { hand: [pc('fence'), pc('bedroom')] });
    const plays = R.legalPlacements(s);
    const fences = plays.filter((p) => p.i === 0);
    expect(fences.every((p) => p.rot === 0 && p.shape !== undefined)).toBe(true);
    expect([...new Set(fences.map((p) => p.shape!.join('/')))]).toEqual([
      '#',
      '####',
      '#/#/#/#',
      '#../#../###',
      '###/#../#..',
      '###/..#/..#',
      '..#/..#/###',
    ]);
    // Each at every spot on the empty 12×12 lot: 144 single tiles, 2 × 108 bars, 4 × 100 Ls.
    expect(fences).toHaveLength(144 + 2 * 9 * 12 + 4 * 10 * 10);
    // Every one is legal, with its shape's tiles.
    for (const p of fences.filter((_, k) => k % 17 === 0)) {
      const check = R.checkPlay(s, p);
      expect(check.legal).toBe(true);
      expect(sortCells(check.cells)).toEqual(tilesOf(p.shape!, p.x, p.y));
    }
    // Other cards keep their own shapes.
    const bedrooms = plays.filter((p) => p.i === 1);
    expect(bedrooms).toHaveLength(11 * 11);
    expect(bedrooms.every((p) => p.shape === undefined)).toBe(true);
    // A Driveway only where a tile reaches the street: 12 single tiles, 10 + 12 of 3, 8 + 12 of 5.
    const drives = R.legalPlacements(build([], { hand: [pc('driveway')] }));
    expect([...new Set(drives.map((p) => p.shape!.join('/')))]).toEqual([
      '#',
      '###',
      '#/#/#',
      '#####',
      '#/#/#/#/#',
    ]);
    expect(drives).toHaveLength(12 + 10 + 12 + 8 + 12);
    for (const p of drives) {
      expect(placedCells(p.shape!, p.x, p.y, 0).some((c) => c.y === 11)).toBe(true);
    }
    // A pack in the reserve is listed the same way.
    const reserved: RunState = { ...build([], { hand: [] }), reserve: [{ id: 'fence' }] };
    const fromReserve = R.legalPlacements(reserved);
    expect(fromReserve).toHaveLength(fences.length);
    expect(fromReserve.every((p) => p.from === 'reserve' && p.shape !== undefined)).toBe(true);
    expect(R.reserveFits(reserved, 0)).toBe(true);
  });

  it('cardFits when a single tile fits, though no suggested shape does', () => {
    // Boulders on every other tile: no two open tiles touch.
    const s = build([], { rows: ['B.B', '.B.', 'B.B'], hand: [pc('fence'), pc('lawn')] });
    expect(R.cardFits(s, 0)).toBe(true);
    expect(R.legalPlacements(s).map((p) => [p.i, p.x, p.y, p.shape])).toEqual([
      [0, 1, 0, ['#']],
      [0, 0, 1, ['#']],
      [0, 2, 1, ['#']],
      [0, 1, 2, ['#']],
    ]);
    expect(R.cardFits(s, 1)).toBe(false); // the Lawn's 2×2 fits nowhere
    // A Driveway with one open tile on the street row.
    const d = build([], { rows: ['BBB', 'BBB', 'B.B'], hand: [pc('driveway')] });
    expect(R.cardFits(d, 0)).toBe(true);
    expect(R.legalPlacements(d)).toEqual([pack(0, 1, 2, ['#'])]);
    // No open tile at all: it fits nowhere.
    const full = build([], { rows: ['BBB', 'BBB', 'BBB'], hand: [pc('fence')] });
    expect(R.cardFits(full, 0)).toBe(false);
    expect(R.legalPlacements(full)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------

describe('Weekend Crew and packs (D-083)', () => {
  it('a pack is one play: placed free as one piece, and the next play ends the week', () => {
    const s = build([], { tools: ['weekendCrew'], hand: [pc('fence'), pc('fence'), pc('lawn')] });
    const ready = R.apply(s, { t: 'useTool', i: 0 }).state;
    expect(ready.freePlay).toBe('ready');
    // 5 tiles of Fence: one placed event, free, and one piece.
    const SHAPE = ['####', '#...'];
    const free = R.apply(ready, pack(0, 0, 0, SHAPE));
    expect(free.events.map((e) => e.t)).toEqual(['placed']);
    expect(free.events[0]).toMatchObject({ uid: 1, defId: 'fence', free: true });
    expect(sortCells(eventsOf(free.events, 'placed')[0]!.cells)).toEqual(tilesOf(SHAPE, 0, 0));
    expect(free.state.house.pieces).toEqual([
      { uid: 1, defId: 'fence', x: 0, y: 0, rot: 0, placedWeek: 1, shape: SHAPE },
    ]);
    expect(free.state).toMatchObject({ freePlay: 'used', week: 1, score: 0 });
    expect(free.state.hand).toEqual([pc('fence'), pc('lawn')]);
    // The other Fence, a pack of its own, ends the week: one tally for both.
    const second = R.apply(free.state, pack(0, 6, 6, ['##', '##']));
    const placed = eventsOf(second.events, 'placed');
    expect(placed).toHaveLength(1);
    expect(placed[0]).not.toHaveProperty('free');
    expect(eventsOf(second.events, 'tally')).toHaveLength(1);
    expect(second.state.week).toBe(2);
    expect(second.state.house.pieces.map((p) => [p.uid, p.shape])).toEqual([
      [1, SHAPE],
      [2, ['##', '##']],
    ]);
  });
});

// ---------------------------------------------------------------------------------------

describe('run codes and replay', () => {
  const BASE: RunCodeData = {
    build: 'packs',
    contentHash: contentHash(BIG),
    setup: setup('packs-code'),
    actions: [],
  };

  /** The first spot on the lot where a hand card's pack of these tiles is legal. */
  function firstSpot(s: RunState, i: number, shape: readonly string[]): PlaceAction {
    const { width, height } = s.house.lot;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const play = pack(i, x, y, shape);
        if (R.checkPlay(s, play).legal) return play;
      }
    }
    throw new Error(`no spot for ${shape.join('/')}`);
  }

  it('keep a pack placement’s tiles, and replay() builds the same piece', () => {
    // A plus of 5 tiles: not one of the Fence's suggested shapes.
    const PLUS = ['.#.', '###', '.#.'];
    const give: Action = { t: 'debug', op: 'giveCard', id: 'fence' };
    const s = R.apply(R.newRun(BASE.setup), give).state;
    const play = firstSpot(s, s.hand.length - 1, PLUS);
    const { state: final, events } = R.apply(s, play);
    const uid = eventsOf(events, 'placed')[0]!.uid;
    expect(final.house.pieces.find((p) => p.uid === uid)!.shape).toEqual(PLUS);
    // The code keeps the tiles, a pending pack placement's too.
    const data: RunCodeData = {
      ...BASE,
      actions: [give, play],
      pending: pack(0, 1, 2, ['##', '#.']),
    };
    const code = encodeRunCode(data);
    const decoded = decodeRunCode(code);
    expect(decoded).toStrictEqual({ ok: true, data });
    if (!decoded.ok) return;
    expect(encodeRunCode(decoded.data)).toBe(code);
    const replayed = R.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toStrictEqual(final);
    expect(replayed.state.house.pieces.find((p) => p.uid === uid)).toMatchObject({
      defId: 'fence',
      rot: 0,
      shape: PLUS,
    });
    // A fresh rules object (no caches carried over) agrees, down to the JSON.
    const fresh = createRules(BIG).replay(decoded.data.setup, decoded.data.actions);
    expect(JSON.stringify(fresh.state)).toBe(JSON.stringify(final));
  });

  it('a damaged shape fails to decode; tiles the rules refuse stop the replay at their step', () => {
    /** A run code from raw JSON (ASCII only), so it can hold anything. */
    const raw = (payload: unknown) =>
      'OH1.' + base64urlEncode([...JSON.stringify(payload)].map((c) => c.charCodeAt(0)));
    const at = (shape: unknown) => ({ t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0, shape });
    const shapes: unknown[] = [
      ['#x#'],
      ['#', '-'],
      ['# '],
      [],
      [''],
      '####',
      [1],
      [['#']],
      null,
      ['#'.repeat(17)],
      Array<string>(17).fill('#'),
    ];
    for (const shape of shapes) {
      expect(decodeRunCode(raw({ ...BASE, actions: [at(shape)] })), JSON.stringify(shape)).toEqual({
        ok: false,
        error: 'That run code has an action this build doesn’t know.',
      });
    }
    expect(decodeRunCode(raw({ ...BASE, pending: at(['#?']) }))).toEqual({
      ok: false,
      error: 'That run code has a damaged pending placement.',
    });
    // Rows of '#' and '.' decode, and the rules check the rest as the code replays: tiles apart,
    // or tiles for a card that isn't a pack, stop it at that step with the reason.
    const n = R.newRun(BASE.setup).hand.length;
    const stops: [PieceId, PlaceAction, string][] = [
      ['fence', pack(n, 0, 0, ['#.#']), 'A pack’s tiles must all touch.'],
      ['bedroom', pack(n, 0, 0, ['##', '##']), 'A Bedroom has its own shape.'],
    ];
    for (const [id, play, error] of stops) {
      const actions: Action[] = [{ t: 'debug', op: 'giveCard', id }, play];
      const decoded = decodeRunCode(encodeRunCode({ ...BASE, actions }));
      expect(decoded).toStrictEqual({ ok: true, data: { ...BASE, actions } });
      if (!decoded.ok) continue;
      expect(R.replay(decoded.data.setup, decoded.data.actions)).toMatchObject({
        failedAt: 1,
        error,
      });
    }
  });
});
