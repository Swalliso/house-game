import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  type BreakdownLine,
  type PieceScore,
  type PreviewLine,
} from '../../rules/index.ts';
import { computeLayout } from '../../rules/layout.ts';
import { tallyHouse } from '../../rules/scoring.ts';
import { emptyRows, houseFrom } from '../../rules/testing.ts';
import { chainOrder, previewArcs } from './chain.ts';

/** A line that adds `value`, counting the pieces given. */
const line = (value: number, ...uids: number[]): BreakdownLine => ({
  label: 'line',
  op: 'add',
  value,
  from: uids.map((uid) => ({ kind: 'piece', uid })),
});
const piece = (uid: number, ...lines: BreakdownLine[]): PieceScore => ({
  uid,
  defId: 'closet',
  points: 0,
  pct: 0,
  earned: 1,
  budget: 0,
  lines,
});
const uids = (pieces: readonly PieceScore[]) => chainOrder(pieces).map((s) => s.piece.uid);
const bys = (pieces: readonly PieceScore[]) => chainOrder(pieces).map((s) => s.by);

describe("chainOrder (D-094's option 1)", () => {
  it('keeps placement order when nothing boosts anything', () => {
    const pieces = [piece(1), piece(2, line(3)), piece(3)];
    expect(uids(pieces)).toEqual([1, 2, 3]);
    expect(bys(pieces)).toEqual([null, null, null]);
  });

  it('plays what a piece boosts right after it, ahead of its own place', () => {
    const pieces = [piece(1), piece(2), piece(3, line(2, 1))];
    expect(uids(pieces)).toEqual([1, 3, 2]);
    expect(bys(pieces)).toEqual([null, 1, null]);
  });

  it('goes depth first: a chain plays out before the next piece that started it', () => {
    // 1 boosts 3 and 5; 3 boosts 4.
    const pieces = [
      piece(1),
      piece(2),
      piece(3, line(2, 1)),
      piece(4, line(2, 3)),
      piece(5, line(1, 1)),
    ];
    expect(uids(pieces)).toEqual([1, 3, 4, 5, 2]);
    expect(bys(pieces)).toEqual([null, 1, 3, 1, null]);
  });

  it('plays each piece once, however the boosts loop', () => {
    const pieces = [piece(1, line(2, 3)), piece(2, line(2, 1)), piece(3, line(2, 2), line(1, 1))];
    expect(uids(pieces)).toEqual([1, 2, 3]);
    expect(bys(pieces)).toEqual([null, 1, 2]);
  });

  it('counts a percentage from a neighbor, but not a penalty, a modifier, or a piece itself', () => {
    const aura: BreakdownLine = {
      label: 'next door',
      op: 'pct',
      value: 50,
      from: [{ kind: 'piece', uid: 1 }],
    };
    expect(uids([piece(1), piece(2), piece(3, aura)])).toEqual([1, 3, 2]);
    const modifier: BreakdownLine = { label: 'Crew', op: 'pct', value: 25, from: [] };
    const lot: BreakdownLine = {
      label: 'Touching Trees',
      op: 'add',
      value: 2,
      from: [{ kind: 'terrain', feature: 'tree', x: 0, y: 0 }],
    };
    expect(uids([piece(1), piece(2), piece(3, line(-2, 1), modifier, lot, line(4, 3))])).toEqual([
      1, 2, 3,
    ]);
  });

  it("reads the rules' own breakdown: a Bathroom plays right after the Bedroom it touches", () => {
    const w = CONTENT.pieces.bedroom.shape[0]!.length;
    const house = houseFrom(CONTENT, emptyRows(12, 12), [
      ['bedroom', 1, 1],
      ['livingRoom', 6, 7],
      ['bathroom', 1 + w, 1],
    ]);
    const t = tallyHouse(CONTENT, computeLayout(CONTENT, house), 1, true);
    const order = chainOrder(t.pieces);
    const name = (uid: number) => house.pieces.find((p) => p.uid === uid)!.defId;
    expect(order.map((s) => name(s.piece.uid))).toEqual(['bedroom', 'bathroom', 'livingRoom']);
    expect(order[1]!.by).toBe(order[0]!.piece.uid);
    // Every piece plays exactly once.
    expect(new Set(order.map((s) => s.piece.uid)).size).toBe(t.pieces.length);
  });
});

describe("previewArcs (D-094's option 1, the preview's arcs)", () => {
  const changed = (uid: number, ...reasons: BreakdownLine[]): PreviewLine => ({
    uid,
    defId: 'closet',
    isNew: false,
    before: 0,
    after: 1,
    reasons,
  });

  it('runs from each piece that would boost the new piece, and from it to each it would boost', () => {
    // 1 would boost the new piece (9) and 2 would hurt it; 9 would boost 4 and hurt 5.
    const newPiece = piece(9, line(3, 1), line(-2, 2));
    const lines = [
      { ...changed(9, ...newPiece.lines), isNew: true },
      changed(4, line(2, 9)),
      changed(5, line(-1, 9)),
      changed(6, line(2, 1)),
    ];
    expect(previewArcs({ newPiece, lines })).toEqual([
      { from: 1, to: 9 },
      { from: 9, to: 4 },
    ]);
  });

  it('draws nothing without a piece in focus', () => {
    expect(previewArcs({ newPiece: null, lines: [] })).toEqual([]);
  });
});
