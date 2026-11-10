// D-122: a play's change to the week's Wow, split into causes that add up to it exactly. The
// chaos suite checks the sum on every previewed play of its runs (sim/chaos.test.ts); these
// tests pin each kind of part on tallies built by hand, and one real preview.

import { describe, expect, it } from 'vitest';
import { roundParts, wowParts } from './attribution.ts';
import type { PieceId, PieceScore, SetScore, Tally, XMultTerm } from './index.ts';
import { weekTotal } from './scoring.ts';
import { TEST_CONTENT as C } from './testing.ts';

const piece = (uid: number, defId: PieceId, earned: number): PieceScore =>
  ({ uid, defId, earned, points: earned, pct: 0, lines: [] }) as unknown as PieceScore;

/** A tally from its parts, totalled the way scoring.ts does. */
function tally(t: {
  pieces?: PieceScore[];
  sets?: SetScore[];
  specs?: { id: string; met: boolean }[];
  specBonus?: number;
  multTerms?: Tally['multTerms'];
  times?: number[];
}): Tally {
  const pieces = t.pieces ?? [];
  const sets = t.sets ?? [];
  const specs = t.specs ?? [];
  const specBonus = t.specBonus ?? 25;
  const multTerms = t.multTerms ?? [];
  let points = pieces.reduce((n, p) => n + p.earned, 0);
  let mult = 100;
  for (const s of sets) {
    points += s.points;
    mult += s.mult;
  }
  for (const s of specs) if (s.met) mult += specBonus;
  for (const m of multTerms) mult += m.add;
  const xMults: XMultTerm[] = [];
  for (const times of t.times ?? []) {
    const before = mult;
    mult = Math.floor((mult * times + 50) / 100);
    xMults.push({
      source: { kind: 'set', id: 'fullHouse' },
      label: 'Full House',
      times,
      before,
      after: mult,
    });
  }
  return {
    pieces,
    sets,
    specs,
    specBonus,
    multTerms,
    xMults,
    best: null,
    points,
    mult,
    total: weekTotal(points, mult),
    budget: 0,
  };
}

const NAMES: Record<string, string> = { cozy: 'Cozy', room: 'Room for everyone' };
const specName = (id: string) => NAMES[id] ?? id;
const sum = (parts: readonly { wow: number }[]) => parts.reduce((n, p) => n + p.wow, 0);

describe('wowParts (D-122)', () => {
  it('names a set the play completes, at the old Charm for its Comfort and the new Comfort for its Charm', () => {
    // Before: a Bedroom and a Bathroom, 118 Comfort... in small numbers: 20 Comfort at ×5.
    const before = tally({
      pieces: [piece(1, 'bedroom', 12), piece(2, 'bathroom', 8)],
      multTerms: [{ source: { kind: 'blueprint', id: 'fengShui' }, label: 'Feng Shui', add: 400 }],
    });
    // The Closet earns 1 and completes a set worth +15 Comfort and +0.5 Charm.
    const suite: SetScore = {
      set: 'suite',
      key: 'suite:1,2,3',
      members: [1, 2, 3],
      points: 15,
      mult: 50,
    };
    const after = tally({
      pieces: [piece(1, 'bedroom', 12), piece(2, 'bathroom', 8), piece(3, 'closet', 1)],
      sets: [suite],
      multTerms: [{ source: { kind: 'blueprint', id: 'fengShui' }, label: 'Feng Shui', add: 400 }],
    });
    const parts = wowParts(C, before, after, 3, specName);
    expect(sum(parts)).toBe(after.total - before.total);
    // The set: 15 × 5.0 + 0.5 × 36 = 75 + 18 = 93; the Closet: 1 × 5.0 = 5.
    expect(parts).toEqual([
      { kind: 'set', label: C.sets.suite.name, wow: 93 },
      { kind: 'piece', label: C.pieces.closet.name, wow: 5, uid: 3 },
    ]);
  });

  it('names a checklist line turned off, and a neighbor that earns less, behind a positive net', () => {
    const before = tally({
      pieces: [piece(1, 'livingRoom', 30), piece(2, 'bedroom', 10)],
      specs: [
        { id: 'cozy', met: true },
        { id: 'room', met: false },
      ],
    });
    const after = tally({
      pieces: [piece(1, 'livingRoom', 30), piece(2, 'bedroom', 6), piece(3, 'garage', 40)],
      specs: [
        { id: 'cozy', met: false },
        { id: 'room', met: false },
      ],
    });
    const parts = wowParts(C, before, after, 3, specName);
    expect(sum(parts)).toBe(after.total - before.total);
    expect(parts.map((p) => [p.kind, p.label])).toEqual([
      ['piece', C.pieces.garage.name],
      ['spec', 'Cozy off'],
      ['neighbor', `${C.pieces.bedroom.name} earns less`],
    ]);
    expect(parts.find((p) => p.kind === 'spec')!.wow).toBeLessThan(0);
  });

  it('a new ×Mult source is a Sparkle part, and the parts still add up through its rounding', () => {
    const before = tally({ pieces: [piece(1, 'bedroom', 37)], specs: [{ id: 'room', met: true }] });
    const after = tally({
      pieces: [piece(1, 'bedroom', 37), piece(2, 'closet', 3)],
      specs: [{ id: 'room', met: true }],
      times: [150],
    });
    const parts = wowParts(C, before, after, 2, specName);
    expect(sum(parts)).toBe(after.total - before.total);
    expect(parts[0]).toMatchObject({ kind: 'sparkle', label: 'Full House' });
    expect(parts.some((p) => p.kind === 'piece' && p.uid === 2)).toBe(true);
  });

  it('a +Mult modifier whose count changes is its own part', () => {
    const term = (add: number, n: number) => ({
      source: { kind: 'blueprint' as const, id: 'moodLighting' as const },
      label: `Mood Lighting (${n})`,
      add,
    });
    const before = tally({ pieces: [piece(1, 'bedroom', 20)], multTerms: [term(20, 2)] });
    const after = tally({
      pieces: [piece(1, 'bedroom', 20), piece(2, 'bedroom', 0)],
      multTerms: [term(30, 3)],
    });
    const parts = wowParts(C, before, after, 2, specName);
    expect(sum(parts)).toBe(after.total - before.total);
    expect(parts).toEqual([{ kind: 'charm', label: 'Mood Lighting (3)', wow: 2 }]);
  });
});

describe('roundParts', () => {
  it('rounds down, then hands the shortfall to the parts that lost the most', () => {
    const parts = roundParts(
      [
        { kind: 'set', label: 'a', wow: 2.6 },
        { kind: 'piece', label: 'b', wow: 1.3 },
        { kind: 'spec', label: 'c', wow: 1.1 },
      ],
      5,
    );
    // Equal parts keep the kinds' order: a checklist line before the piece's own.
    expect(parts.map((p) => [p.label, p.wow])).toEqual([
      ['a', 3],
      ['c', 1],
      ['b', 1],
    ]);
  });

  it('a change from the total rounding alone is "Other changes"; parts of 0 go', () => {
    expect(roundParts([{ kind: 'piece', label: 'b', wow: 0.2 }], 1)).toEqual([
      { kind: 'piece', label: 'b', wow: 1 },
    ]);
    expect(roundParts([], 1)).toEqual([{ kind: 'other', label: 'Other changes', wow: 1 }]);
    expect(roundParts([{ kind: 'piece', label: 'b', wow: 0.2 }], 0)).toEqual([]);
  });

  it('negative parts round down too, and the sum still holds', () => {
    const raw = [
      { kind: 'piece' as const, label: 'own', wow: 10.4 },
      { kind: 'spec' as const, label: 'Cozy off', wow: -6.7 },
    ];
    const parts = roundParts(raw, 4);
    expect(sum(parts)).toBe(4);
    expect(parts).toEqual([
      { kind: 'piece', label: 'own', wow: 11 },
      { kind: 'spec', label: 'Cozy off', wow: -7 },
    ]);
  });
});
