// Bunk Beds count twice only up to a range's top (D-198, the backlog's S30, changing D-101): a
// `count` with a `max` reads max(once, min(weighted, max)), where `once` counts each matching
// piece once and `weighted` is D-101's count, with Bunk Beds' Bedroom as two. So Bunk Beds still
// lift a house to the bottom of Room for everyone's range, and a house at its top keeps the
// line with them in, while one with more plain Bedrooms than the top still fails. A count with
// no max reads the weighted count as before, and the limits (Renovate, the half-weight draws)
// keep reading it too: they reach the max at the same moment.
//
// TEST_CONTENT's Bunk Beds only count twice (no +25%), and its Hendersons have no checklist, so
// each test gives them one line. Bedrooms are 2 × 2, side by side in rows 4–5 of an empty 10 ×
// 10 lot (uids 1, 2, 3 at x 0, 2, 4), clear of the sunny rows and the street.

import { describe, expect, it } from 'vitest';
import type { Content, PlaceAction, RunState, SpecDef } from './index.ts';
import {
  cappedCount,
  countFor,
  countMatching,
  countOnce,
  limitReached,
  typeLimits,
} from './conditions.ts';
import { withFixture } from './fixtures.ts';
import { computeLayout } from './layout.ts';
import { createRules, type Rules } from './run.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

const L = emptyRows(10, 10);

/** Long phases with targets out of reach, so weeks go by without a milestone. */
const LONG: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: 8,
    phases: [
      { name: 'Groundbreaking', target: 100_000 },
      { name: 'Foundation', target: 200_000 },
    ],
  },
};

const BEDROOMS = { piece: 'bedroom' } as const;

/** Room for everyone with this range (no max: a floor only). */
function roomFor(min: number, max?: number): SpecDef {
  return {
    id: 'roomForEveryone',
    name: 'Room for everyone',
    group: 'household',
    condition: max === undefined ? { count: BEDROOMS, min } : { count: BEDROOMS, min, max },
  };
}

/** `n` Bedrooms side by side, from x 0. */
const bedrooms = (n: number): Placement[] =>
  Array.from({ length: n }, (_, k): Placement => ['bedroom', 2 * k, 4]);

/** A run whose Hendersons have this one line, with `n` Bedrooms and Bunk Beds in these uids. */
function runWith(
  spec: SpecDef,
  n: number,
  bunks: readonly number[] = [],
): { r: Rules; s: RunState } {
  const r = createRules(withClient({ specs: [spec] }, LONG));
  let house = houseFrom(r.content, L, bedrooms(n));
  for (const uid of bunks) house = withFixture(house, uid, 'bunkBeds', 1);
  return { r, s: { ...r.newRun(setup('bunk-beds')), house } };
}

/** The line as the checklist shows it: whether it holds, and its progress. */
function lineOf(spec: SpecDef, n: number, bunks: readonly number[] = []): [boolean, string] {
  const { r, s } = runWith(spec, n, bunks);
  const line = r.checklist(s)[0]!;
  return [line.met, line.progress.map((p) => p.text).join(' · ')];
}

describe('Bunk Beds count twice only up to a range’s top (D-198)', () => {
  it('keep a house at the top of its range there: the line holds, and reads the top', () => {
    // Two Bedrooms, at the top of 1–2. D-101 read 3 with Bunk Beds in one, and broke the line.
    expect(lineOf(roomFor(1, 2), 2)).toEqual([true, '2 Bedrooms (1–2)']);
    expect(lineOf(roomFor(1, 2), 2, [1])).toEqual([true, '2 Bedrooms (1–2)']);
    expect(lineOf(roomFor(1, 2), 2, [1, 2])).toEqual([true, '2 Bedrooms (1–2)']);
    // Exactly 2: the same.
    expect(lineOf(roomFor(2, 2), 2, [2])).toEqual([true, '2 Bedrooms (exactly 2)']);
  });

  it('below the top, still add a Bedroom; a Bedroom short of the bottom, they reach it', () => {
    expect(lineOf(roomFor(1, 2), 1)).toEqual([true, '1 Bedroom (1–2)']);
    expect(lineOf(roomFor(1, 2), 1, [1])).toEqual([true, '2 Bedrooms (1–2)']);
    expect(lineOf(roomFor(2, 3), 1)).toEqual([false, '1 Bedroom (2–3)']);
    expect(lineOf(roomFor(2, 3), 1, [1])).toEqual([true, '2 Bedrooms (2–3)']);
    // Two Bedrooms with Bunk Beds in both reach the top of 3–4 and stop there.
    expect(lineOf(roomFor(3, 4), 2, [1, 2])).toEqual([true, '4 Bedrooms (3–4)']);
    expect(lineOf(roomFor(3, 3), 2, [1, 2])).toEqual([true, '3 Bedrooms (exactly 3)']);
  });

  it('never rescue a house with more plain Bedrooms than the top: it fails, as before', () => {
    expect(lineOf(roomFor(1, 2), 3)).toEqual([false, '3 Bedrooms (1–2)']);
    expect(lineOf(roomFor(1, 2), 3, [1])).toEqual([false, '3 Bedrooms (1–2)']);
    expect(lineOf(roomFor(1, 2), 3, [1, 2, 3])).toEqual([false, '3 Bedrooms (1–2)']);
  });

  it('a count with no top reads the weighted count, as D-101 had it', () => {
    expect(lineOf(roomFor(2), 1, [1])).toEqual([true, '2 Bedrooms (≥ 2)']);
    expect(lineOf(roomFor(2), 2, [1, 2])).toEqual([true, '4 Bedrooms (≥ 2)']);
  });

  it('a staged line caps at its current stage’s top', () => {
    const staged: SpecDef = {
      id: 'roomForEveryone',
      name: 'Room for everyone',
      group: 'household',
      condition: {
        stages: [
          { fromPhase: 0, condition: { count: BEDROOMS, min: 1, max: 2 } },
          { fromPhase: 1, condition: { count: BEDROOMS, min: 2, max: 3 } },
        ],
      },
    };
    const { r, s } = runWith(staged, 2, [1]);
    expect(r.checklist(s)[0]).toMatchObject({
      met: true,
      progress: [{ text: '2 Bedrooms (1–2)' }],
    });
    expect(r.checklist({ ...s, phase: 1 })[0]).toMatchObject({
      met: true,
      progress: [{ text: '3 Bedrooms (2–3)' }],
    });
  });

  it('reads max(once, min(weighted, max)), and caches the once count apart from the weighted', () => {
    expect(cappedCount(3, 2, 2)).toBe(2);
    expect(cappedCount(2, 1, 2)).toBe(2);
    expect(cappedCount(4, 3, 2)).toBe(3);
    expect(cappedCount(5, 3)).toBe(5);
    const house = withFixture(houseFrom(C, L, bedrooms(2)), 1, 'bunkBeds', 1);
    const layout = computeLayout(C, house);
    const capped = { count: BEDROOMS, min: 1, max: 2 };
    // The capped read first, then the plain ones of the same selector: none leaks into another.
    expect(countFor(C, layout, capped)).toBe(2);
    expect(countMatching(C, layout, BEDROOMS)).toBe(3);
    expect(countOnce(C, layout, BEDROOMS)).toBe(2);
    expect(countFor(C, layout, { count: BEDROOMS, min: 1 })).toBe(3);
    expect(countFor(C, layout, capped)).toBe(2);
  });

  it('leaves the limits alone: Renovate and the half-weight draws read the weighted count', () => {
    // [Bedrooms, Bunk Beds in, the weighted count, at the limit]. The capped count reaches the
    // top exactly when the weighted one does, so each case is at its limit as before.
    const cases: [number, number[], number, boolean][] = [
      [1, [], 1, false],
      [1, [1], 2, true],
      [2, [], 2, true],
      [2, [1], 3, true],
      [3, [], 3, true],
    ];
    const spec = roomFor(1, 2);
    for (const [n, bunks, count, atLimit] of cases) {
      let house = houseFrom(C, L, bedrooms(n));
      for (const uid of bunks) house = withFixture(house, uid, 'bunkBeds', 1);
      const layout = computeLayout(C, house);
      const limits = typeLimits(C, layout, [spec], { phase: 0 });
      expect(limits, `${n} ${bunks}`).toEqual([{ types: ['bedroom'], max: 2, count }]);
      expect(limitReached(limits, 'bedroom') !== null, `${n} ${bunks}`).toBe(atLimit);
      const read = countFor(C, layout, { count: BEDROOMS, min: 1, max: 2 });
      expect(read >= 2, `${n} ${bunks}`).toBe(atLimit);
    }
  });

  it('at the top, installing them is no longer a loss; a Bedroom short of the bottom, a gain', () => {
    // At the top of 1–2: D-101 lost the line with them in, and the shop's line showed a loss.
    const top = runWith(roomFor(1, 2), 2);
    expect(top.r.fixtureValue(top.s, 'bunkBeds')).toMatchObject({ gain: 0 });
    const s = { ...top.s, supplies: [{ kind: 'fixture' as const, id: 'bunkBeds' as const }] };
    expect(top.r.preview(s, { t: 'install', from: 'supplies', i: 0, uid: 1 })).toMatchObject({
      legal: true,
      delta: 0,
      specsGained: [],
      specsLost: [],
    });
    // A Bedroom short of 2–3: they reach it, and the line's Charm is the gain.
    const short = runWith(roomFor(2, 3), 1);
    const gain = short.r.fixtureValue(short.s, 'bunkBeds')!.gain;
    expect(gain).toBeGreaterThan(0);
    const t = { ...short.s, supplies: [{ kind: 'fixture' as const, id: 'bunkBeds' as const }] };
    expect(short.r.preview(t, { t: 'install', from: 'supplies', i: 0, uid: 1 })).toMatchObject({
      delta: gain,
      specsGained: ['roomForEveryone'],
      specsLost: [],
    });
  });

  it('the estimate follows the capped count, as the exact preview does', () => {
    // One Bedroom with Bunk Beds sits at the top of 1–2. A second Bedroom keeps the line (2
    // pieces, read as 2); a third breaks it (3 plain pieces past the top).
    const second: PlaceAction = { t: 'place', from: 'hand', i: 0, x: 2, y: 4, rot: 0 };
    const third: PlaceAction = { t: 'place', from: 'hand', i: 0, x: 4, y: 4, rot: 0 };
    const cases: [number, PlaceAction, string[], number][] = [
      [1, second, [], 0],
      [2, third, ['roomForEveryone'], -1],
    ];
    for (const [n, play, lost, flips] of cases) {
      const { r, s } = runWith(roomFor(1, 2), n, [1]);
      const st: RunState = { ...s, hand: [{ kind: 'piece', id: 'bedroom' }] };
      expect(r.checklist(st)[0]!.met).toBe(true);
      const p = r.preview(st, play);
      expect([p.legal, p.specsGained, p.specsLost]).toEqual([true, [], lost]);
      expect(r.estimatePlay(st, play).specFlips).toBe(flips);
    }
  });
});
