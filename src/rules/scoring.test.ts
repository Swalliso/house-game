import { describe, expect, it } from 'vitest';
import type { Content, PieceId } from './index.ts';
import { computeLayout } from './layout.ts';
import { earnedFor, roundHalfUp, tallyHouse, weekTotal } from './scoring.ts';
import { matchSets } from './sets.ts';
import { emptyRows, houseFrom, TEST_CONTENT as C, withPieces, type Placement } from './testing.ts';

function tally(content: Content, rows: readonly string[], placements: readonly Placement[]) {
  return tallyHouse(content, computeLayout(content, houseFrom(content, rows, placements)), 1, true);
}

function earned(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[],
  uid: number,
) {
  return tally(content, rows, placements).pieces.find((p) => p.uid === uid)!.earned;
}

describe('the scoring formula', () => {
  it('rounds half up in integer math', () => {
    expect(earnedFor(3, 50)).toBe(5); // 4.5 → 5
    expect(earnedFor(1, 50)).toBe(2); // 1.5 → 2
    expect(earnedFor(5, -10)).toBe(5); // 4.5 → 5
    expect(earnedFor(3, -50)).toBe(2); // 1.5 → 2
    expect(earnedFor(7, 0)).toBe(7);
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(4, 3)).toBe(1);
    expect(weekTotal(15, 150)).toBe(23); // 22.5 → 23
  });

  it('never lets penalties go below zero, or combine into a positive', () => {
    expect(earnedFor(-4, 0)).toBe(0);
    expect(earnedFor(-4, -200)).toBe(0); // two negatives don't make a positive
    expect(earnedFor(5, -100)).toBe(0);
    expect(earnedFor(5, -250)).toBe(0); // percentages below −100 floor at 0
    expect(weekTotal(-3, 150)).toBe(0);
  });

  it('treats a +200% total as ×3 (auras adding is tested below)', () => {
    expect(earnedFor(4, 100 + 100)).toBe(12); // +200% is ×3, not ×4
  });
});

describe('effect kinds', () => {
  it('steady earns its amount', () => {
    const c = withPieces({ lawn: { effects: [{ kind: 'steady', amount: 4 }] } });
    expect(earned(c, emptyRows(6, 6), [['lawn', 0, 0]], 1)).toBe(4);
  });

  it('neighbor counts distinct matching neighbors, up to max', () => {
    // A Bedroom: 3 steady, +1 per Tree or Quiet neighbor (max 3), −2 per Loud neighbor.
    const rows = ['TTT...', 'T.....', 'T.....', '......', '......', '......'];
    // Bedroom at (1,1): Trees at (1,0), (2,0), (0,1), (0,2) = 4, capped at 3.
    expect(earned(C, rows, [['bedroom', 1, 1]], 1)).toBe(3 + 3);
    const t = tally(C, rows, [['bedroom', 1, 1]]);
    expect(t.pieces[0]!.lines).toEqual([
      { label: 'Every week', op: 'add', value: 3, from: [] },
      {
        label: 'Touching 4 Trees (3 count)',
        op: 'add',
        value: 3,
        from: [
          { kind: 'terrain', feature: 'tree', x: 1, y: 0 },
          { kind: 'terrain', feature: 'tree', x: 2, y: 0 },
          { kind: 'terrain', feature: 'tree', x: 0, y: 1 },
        ],
      },
    ]);
  });

  it('a capped neighbor bonus credits the rooms it touches before rooms linked across a hall', () => {
    // A Closet earning +1 per room, max 1. The Bathroom (uid 1) is linked to it through the
    // Hallway; the Bedroom (uid 4) touches it. The count is the same either way; the credit
    // (the breakdown's sources and the tally's arcs) goes to the Bedroom.
    const c = withPieces({
      closet: { effects: [{ kind: 'neighbor', match: { property: 'room' }, amount: 1, max: 1 }] },
    });
    const t = tally(c, emptyRows(8, 6), [
      ['bathroom', 0, 0], // 1
      ['hallway', 1, 0], // 2
      ['closet', 3, 0], // 3
      ['bedroom', 3, 1], // 4
    ]);
    const closet = t.pieces.find((p) => p.uid === 3)!;
    expect(closet.earned).toBe(1);
    expect(closet.lines).toEqual([
      {
        label: 'Touching a Bathroom and a Bedroom (1 count)',
        op: 'add',
        value: 1,
        from: [{ kind: 'piece', uid: 4 }],
      },
    ]);
  });

  it('neighbor penalties apply, and the street is Loud', () => {
    // A Bedroom on the street: 3 − 2.
    expect(earned(C, emptyRows(6, 4), [['bedroom', 0, 2]], 1)).toBe(1);
    const line = tally(C, emptyRows(6, 4), [['bedroom', 0, 2]]).pieces[0]!.lines[1]!;
    expect(line).toEqual({
      label: 'Touching the street',
      op: 'add',
      value: -2,
      from: [{ kind: 'street', x: 0 }],
    });
  });

  it('a neighbor counts once per effect even if it matches several parts of it', () => {
    // A Tree is both a Tree and Quiet: one neighbor, +1.
    expect(
      earned(
        C,
        ['T.....', '......', '......', '......', '......', '......'],
        [['bedroom', 1, 0]],
        1,
      ),
    ).toBe(4);
  });

  it('a piece that only earns with a neighbor earns nothing alone', () => {
    expect(earned(C, emptyRows(6, 6), [['bathroom', 0, 0]], 1)).toBe(0);
    // Touching two Bedrooms still pays one Bedroom's worth (max 1).
    expect(
      earned(
        C,
        emptyRows(6, 6),
        [
          ['bedroom', 0, 0],
          ['bathroom', 2, 1],
          ['bedroom', 3, 0],
        ],
        2,
      ),
    ).toBe(3);
  });

  it('countsAs makes the L-Kitchen a Kitchen for neighbor effects', () => {
    // Bathroom touching an L-Kitchen: −2, floored at 0 alone; with a Bedroom: 3 − 2 = 1.
    expect(
      earned(
        C,
        emptyRows(6, 6),
        [
          ['bedroom', 0, 0],
          ['bathroom', 2, 0],
          ['lKitchen', 2, 1],
        ],
        2,
      ),
    ).toBe(1);
  });

  it('aura adds a percentage to matching neighbors', () => {
    // Kitchen next to a Dining Room: +2, then +50% from the Dining Room's aura = 3.
    const t = tally(C, emptyRows(6, 6), [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ]);
    expect(t.pieces[0]).toMatchObject({ points: 2, pct: 50, earned: 3 });
    expect(t.pieces[0]!.lines[1]).toEqual({
      label: 'Dining Room next door',
      op: 'pct',
      value: 50,
      from: [{ kind: 'piece', uid: 2 }],
    });
    expect(t.pieces[1]).toMatchObject({ earned: 0 }); // the Dining Room earns nothing itself
  });

  it('two auras add their percentages, shown as one line', () => {
    // Kitchen between two Dining Rooms: 2 + 2 = 4 points, +100% = 8.
    const t = tally(C, emptyRows(8, 6), [
      ['diningRoom', 0, 0],
      ['kitchen', 2, 0],
      ['diningRoom', 4, 0],
    ]);
    expect(t.pieces[1]!.lines.at(-1)).toEqual({
      label: '2 Dining Rooms next door',
      op: 'pct',
      value: 100,
      from: [
        { kind: 'piece', uid: 1 },
        { kind: 'piece', uid: 3 },
      ],
    });
    expect(
      earned(
        C,
        emptyRows(8, 6),
        [
          ['diningRoom', 0, 0],
          ['kitchen', 2, 0],
          ['diningRoom', 4, 0],
        ],
        2,
      ),
    ).toBe(8);
  });

  it('aura can add or remove flat points', () => {
    const c = withPieces({
      diningRoom: {
        effects: [{ kind: 'aura', match: { tag: 'Quiet' }, scope: 'adjacent', amount: -2 }],
      },
    });
    // Bedroom 3 − 2 (aura) = 1; the aura doesn't touch the Kitchen (not Quiet).
    expect(
      earned(
        c,
        emptyRows(6, 6),
        [
          ['bedroom', 0, 0],
          ['diningRoom', 2, 0],
        ],
        1,
      ),
    ).toBe(1);
    const c2 = withPieces({
      diningRoom: {
        effects: [{ kind: 'aura', match: { tag: 'Quiet' }, scope: 'adjacent', amount: -5 }],
      },
    });
    expect(
      earned(
        c2,
        emptyRows(6, 6),
        [
          ['bedroom', 0, 0],
          ['diningRoom', 2, 0],
        ],
        1,
      ),
    ).toBe(0);
  });

  it('view sources: Trees per tile, the pond and the creek once each, capped', () => {
    // Living Room (2×3): +2 per view source, max 3.
    const rows = ['T......', '.......', '.......', 'CC.....', '.......', '.......'];
    // At (1,0) it covers x 1–2, y 0–2: it touches the Tree at (0,0) and the creek below.
    expect(earned(C, rows, [['livingRoom', 1, 0]], 1)).toBe(4);
    const rows2 = ['T..P...', 'T..P...', '...P...', 'CCC....', '.......', '.......'];
    // Trees (0,0) and (0,1), the pond once, the creek once = 4 sources, capped at 3.
    expect(earned(C, rows2, [['livingRoom', 1, 0]], 1)).toBe(6);
    // Under the cap: three pond tiles are one view, but two Tree tiles are two.
    expect(earned(C, ['..P....', '..P....', '..P....', '.......'], [['livingRoom', 0, 0]], 1)).toBe(
      2,
    );
    expect(earned(C, ['..T....', '..T....', '.......', '.......'], [['livingRoom', 0, 0]], 1)).toBe(
      4,
    );
  });
});

describe('sets', () => {
  const ids = (content: Content, rows: readonly string[], placements: readonly Placement[]) =>
    matchSets(content, computeLayout(content, houseFrom(content, rows, placements))).map(
      (s) => s.key,
    );

  it('Jack-and-Jill: a Bathroom touching two Bedrooms', () => {
    const rows = emptyRows(8, 6);
    expect(
      ids(C, rows, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0],
      ]),
    ).toEqual(['jackAndJill:1,2,3']);
    // Two Bedrooms touching each other with the Bathroom touching only one: no set.
    expect(
      ids(C, rows, [
        ['bedroom', 0, 0],
        ['bedroom', 2, 0],
        ['bathroom', 4, 0],
      ]),
    ).toEqual([]);
  });

  it('a piece joins at most one instance per set type, matched in placement order', () => {
    const rows = emptyRows(10, 6);
    // Bedroom · Bathroom · Bedroom · Bathroom · Bedroom: the first Bathroom takes Bedrooms 1 and 3;
    // the second has only Bedroom 5 left, so there's one instance.
    const keys = ids(C, rows, [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
      ['bathroom', 5, 0],
      ['bedroom', 6, 0],
    ]);
    expect(keys).toEqual(['jackAndJill:1,2,3']);
  });

  it('Entertainer: Kitchen, Dining Room, and Living Room connected, with the L-Kitchen counting', () => {
    const rows = emptyRows(10, 6);
    expect(
      ids(C, rows, [
        ['lKitchen', 0, 0],
        ['diningRoom', 2, 0],
        ['livingRoom', 4, 0],
      ]),
    ).toEqual(['entertainer:1,2,3']);
    // Not connected: the Living Room is apart.
    expect(
      ids(C, rows, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
        ['livingRoom', 6, 0],
      ]),
    ).toEqual([]);
  });

  it('finds a valid group even when the earliest pick is a dead end', () => {
    // Dining Room 2 (placed first) touches the Kitchen but not the Living Room; Dining Room 3
    // touches both. The search backs off Dining Room 2 and finds Kitchen + Dining 3 + Living.
    const rows = emptyRows(10, 8);
    const keys = ids(C, rows, [
      ['kitchen', 2, 2],
      ['diningRoom', 0, 2],
      ['diningRoom', 4, 2],
      ['livingRoom', 6, 2],
    ]);
    expect(keys).toEqual(['entertainer:1,3,4']);
  });

  it('never reshuffle or break a held set when a piece is added (completion order)', () => {
    const rows = emptyRows(16, 10);
    const base: Placement[] = [
      ['kitchen', 4, 3],
      ['diningRoom', 6, 3],
      ['diningRoom', 2, 3],
      ['livingRoom', 0, 3],
      ['kitchen', 8, 3],
      ['livingRoom', 10, 3],
    ];
    const before = ids(C, rows, base);
    expect(before).toEqual(['entertainer:1,3,4', 'entertainer:2,5,6']);
    // A Living Room touching only the second Dining Room used to pull it into a new instance
    // and leave the house with one Entertainer instead of two.
    const after = ids(C, rows, [...base, ['livingRoom', 6, 0]]);
    expect(after).toEqual(before);
  });

  it('keep Jack-and-Jill stable when a later Bedroom lets an earlier Bathroom complete', () => {
    const rows = emptyRows(12, 12);
    // Bathroom 2 touches Bedroom 1 only; Bathroom 3 sits between Bedrooms 1 and 4.
    const base: Placement[] = [
      ['bedroom', 2, 2],
      ['bathroom', 2, 4],
      ['bathroom', 4, 2],
      ['bedroom', 5, 2],
    ];
    expect(ids(C, rows, base)).toEqual(['jackAndJill:1,3,4']);
    // Before, a Bedroom beside Bathroom 2 let it (the earlier hub) take Bedroom 1 and strand
    // Bathroom 3. Now Bedroom 1 stays in its set, and Bathroom 2 waits for another Bedroom.
    expect(ids(C, rows, [...base, ['bedroom', 0, 4]])).toEqual(['jackAndJill:1,3,4']);
    expect(ids(C, rows, [...base, ['bedroom', 3, 4]])).toEqual(['jackAndJill:1,3,4']);
    expect(ids(C, rows, [...base, ['bathroom', 7, 2], ['bedroom', 8, 2]])).toEqual([
      'jackAndJill:1,3,4',
    ]);
  });

  it('pay Points and Mult every week, and Points × Mult makes the total', () => {
    const rows = emptyRows(10, 6);
    const t = tally(C, rows, [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ]);
    // Bedrooms: 3 each, Quiet neighbors? No (the Bathroom is Wet). Bathroom: 3.
    expect(t.pieces.map((p) => p.earned)).toEqual([3, 3, 3]);
    expect(t.sets).toEqual([
      { set: 'jackAndJill', key: 'jackAndJill:1,2,3', members: [1, 2, 3], points: 10, mult: 50 },
    ]);
    expect(t.points).toBe(19);
    expect(t.mult).toBe(150);
    expect(t.total).toBe(29); // 28.5 → 29
  });
});

describe('a whole week', () => {
  it('sums pieces in placement order', () => {
    const placements: Placement[] = [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
      ['livingRoom', 4, 0],
      ['lawn', 0, 4],
      ['lawn', 2, 4],
    ];
    const t = tally(C, ['T.........', ...emptyRows(10, 7)], placements);
    const byId = (id: PieceId) => t.pieces.find((p) => p.defId === id)!.earned;
    expect(t.pieces.map((p) => p.uid)).toEqual([1, 2, 3, 4, 5]);
    expect(byId('kitchen')).toBe(3);
    expect(byId('livingRoom')).toBe(0); // no view, so +50% of 0
    expect(t.sets.map((s) => s.set)).toEqual(['entertainer']);
    // Lawns: 1 + 1 each = 4; Kitchen 3; Entertainer 25 → 32 × 2 = 64.
    expect(t.points).toBe(32);
    expect(t.mult).toBe(200);
    expect(t.total).toBe(64);
  });
});
