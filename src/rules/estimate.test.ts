import { describe, expect, it } from 'vitest';
import type { PieceId, PlaceAction, RunState } from './index.ts';
import { lotFromRows } from './lot.ts';
import { createRules } from './run.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';

const rules = createRules(C);

function onLot(rows: string[], ...ids: PieceId[]): RunState {
  const s = rules.newRun(setup('estimate'));
  return {
    ...s,
    house: { ...s.house, lot: lotFromRows(rows) },
    hand: ids.map((id) => ({ kind: 'piece', id })),
  };
}

const place = (i: number, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot,
});

/** A house built unchecked on an empty 8×8 lot, with this hand. */
function built(placements: Placement[], ...ids: PieceId[]): RunState {
  const s = rules.newRun(setup('estimate'));
  return {
    ...s,
    house: houseFrom(C, emptyRows(8, 8), placements),
    hand: ids.map((id) => ({ kind: 'piece', id })),
  };
}

const exact = (s: RunState, p: PlaceAction) => rules.scoreOnly(s, p) - rules.scoreOnly(s, null);

/** Plays a card, leaving the shop if that week ended a phase, then sets the next hand. */
function playThen(s: RunState, p: PlaceAction, ...ids: PieceId[]): RunState {
  let next = rules.apply(s, p).state;
  if (next.screen === 'shop') next = rules.apply(next, { t: 'leaveShop' }).state;
  return { ...next, hand: ids.map((id) => ({ kind: 'piece', id })) };
}

describe('the greedy bot’s cheap estimate', () => {
  it('matches the exact change for neighbor bonuses, penalties, and auras', () => {
    let s = onLot(
      ['T.......', '........', '........', '........'],
      'bedroom',
      'kitchen',
      'diningRoom',
    );
    // A Bedroom touching a Tree: 3 + 1.
    expect(rules.estimatePlay(s, place(0, 1, 0)).delta).toBe(exact(s, place(0, 1, 0)));
    s = rules.apply(s, place(1, 2, 0)).state; // a Kitchen
    s = {
      ...s,
      hand: [
        { kind: 'piece', id: 'diningRoom' },
        { kind: 'piece', id: 'bathroom' },
      ],
    };
    // The Dining Room adds +2 to the Kitchen, then its aura makes that +50%.
    expect(rules.estimatePlay(s, place(0, 4, 0)).delta).toBe(exact(s, place(0, 4, 0)));
    // A Bathroom next to the Kitchen: −2, clamped at 0.
    expect(rules.estimatePlay(s, place(1, 2, 2)).delta).toBe(exact(s, place(1, 2, 2)));
  });

  it('respects caps on what a neighbor already counts', () => {
    let s = onLot(emptyRows(10, 4), 'lawn');
    for (const x of [0, 2, 4, 6]) s = playThen(s, place(0, x, 0), 'lawn');
    expect(rules.estimatePlay(s, place(0, 2, 2)).delta).toBe(exact(s, place(0, 2, 2)));
  });

  it('sees rooms linked through a Hallway', () => {
    let s = onLot(emptyRows(10, 10), 'bedroom', 'longHallway', 'bathroom');
    s = playThen(s, place(0, 0, 0), 'longHallway');
    s = playThen(s, place(0, 2, 1), 'bedroom');
    s = playThen(s, place(0, 5, 0), 'bathroom');
    // The Bathroom touches only the Hallway, which links it to both Bedrooms.
    const est = rules.estimatePlay(s, place(0, 3, 2));
    expect(est.setHint).toBe(true);
    expect(est.delta).toBeGreaterThan(0);
  });

  it('flags plays that might complete a set', () => {
    let s = onLot(emptyRows(8, 6), 'bedroom', 'bathroom');
    s = playThen(s, place(0, 0, 0), 'bathroom');
    expect(rules.estimatePlay(s, place(0, 2, 0)).setHint).toBe(true);
    expect(rules.estimatePlay(s, place(0, 6, 4)).setHint).toBe(false);
  });

  // A Bedroom in the top-left corner and a Fence under the yard beside it (fencedYardMin 4).
  //   y0  BB..?...
  //   y1  BB..?...
  //   y2  ----?...
  //   y3  ....?...
  const corner: Placement[] = [
    ['bedroom', 0, 0],
    ['fence', 0, 2],
  ];

  it('flags a Fence that closes a new fenced yard', () => {
    const s = built(corner, 'fence');
    const closing = place(0, 4, 0, 1); // (4,0) .. (4,3)
    expect(rules.fencedYards(s)).toEqual([]);
    expect(rules.estimatePlay(s, closing).yardHint).toBe(true);
    // The estimate can't see the yard's own payoff, which is why the hint exists.
    expect(exact(s, closing)).toBeGreaterThan(rules.estimatePlay(s, closing).delta);
    expect(rules.fencedYards(rules.apply(s, closing).state)).toEqual([4]);
  });

  it('doesn’t flag a Fence that leaves the yard open, or one inside a yard already fenced', () => {
    const s = built(corner, 'fence');
    // One column further right: the yard leaks out under it, past the first Fence's end.
    expect(rules.estimatePlay(s, place(0, 5, 0, 1)).yardHint).toBe(false);
    expect(rules.estimatePlay(s, place(0, 0, 6)).yardHint).toBe(false);
    // Row 5 all Fence: everything behind it is one fenced yard, and a Fence inside it only
    // shrinks or splits that yard.
    const behind = built(
      [
        ['bedroom', 0, 0],
        ['fence', 0, 5],
        ['fence', 4, 5],
      ],
      'fence',
    );
    expect(rules.fencedYards(behind)).toEqual([36]);
    expect(rules.estimatePlay(behind, place(0, 2, 3)).yardHint).toBe(false);
    expect(rules.estimatePlay(behind, place(0, 3, 0, 1)).yardHint).toBe(false);
  });

  // Two Bedrooms with a Closet between them on row 0: they touch the Closet, not each other.
  //   y0  BBCbb...
  //   y1  BB?bb...
  //   y2  ..?.....
  const rooms: Placement[] = [
    ['bedroom', 0, 0],
    ['closet', 2, 0],
    ['bedroom', 3, 0],
  ];

  it('flags a Hallway that links rooms not linked yet', () => {
    const s = built(rooms, 'hallway');
    const linking = place(0, 2, 1, 1); // (2,1) (2,2): touches both Bedrooms and the Closet
    const est = rules.estimatePlay(s, linking);
    expect(est.linkHint).toBe(true);
    // Linked Bedrooms count as neighbors (Quiet +1 each), which the estimate misses.
    expect(exact(s, linking)).toBeGreaterThan(est.delta);
    // Touching one room links nothing.
    expect(rules.estimatePlay(s, place(0, 0, 2)).linkHint).toBe(false);
  });

  it('doesn’t flag a Hallway joining a group that already links the same rooms', () => {
    const s = built([...rooms, ['hallway', 2, 1, 1]], 'hallway');
    // (3,2) (4,2): touches the second Bedroom and the first Hallway, whose rooms it already links.
    expect(rules.estimatePlay(s, place(0, 3, 2)).linkHint).toBe(false);
    // With a Bathroom at (4,3), a Hallway at (2,3) (3,3) joins the group and brings it a new room.
    const t = built([...rooms, ['hallway', 2, 1, 1], ['bathroom', 4, 3]], 'hallway');
    expect(rules.estimatePlay(t, place(0, 2, 3)).linkHint).toBe(true);
  });

  it('only checks yards for wall pieces and links for connectors', () => {
    const s = built(corner, 'closet', 'lawn');
    for (const p of rules.legalPlacements(s)) {
      const est = rules.estimatePlay(s, p);
      expect(est.yardHint || est.linkHint).toBe(false);
    }
  });
});
