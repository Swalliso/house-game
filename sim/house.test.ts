// The house report's two realism checks (D-189): extra Bathrooms, more than the Bathroom
// ratio's floor plus one, and a Garage that neither the street nor a Driveway reaches (D-140).
// The Garage's reach is checked against the rules' own tally, so a change to its requirement
// shows here rather than in a report that quietly drifts.
//
// Houses are built with houseFrom on a 12×12 lot, pieces placed unchecked; the street runs
// along the bottom edge (y = 11).

import { describe, expect, it } from 'vitest';
import { CONTENT, rules } from '../src/rules/index.ts';
import { emptyRows, houseFrom, setup, type Placement } from '../src/rules/testing.ts';
import { houseStats } from './house.ts';

const ROWS = emptyRows(12, 12);
const statsOf = (placements: readonly Placement[]) =>
  houseStats(CONTENT, houseFrom(CONTENT, ROWS, placements));

/** Bedrooms (2×2) along the top rows, then 1×1 Bathrooms in row 3. */
function household(bedrooms: number, bathrooms: number, extra: Placement[] = []): Placement[] {
  return [
    ...Array.from({ length: bedrooms }, (_, k): Placement => ['bedroom', 2 * k, 0]),
    ...Array.from({ length: bathrooms }, (_, k): Placement => ['bathroom', k, 3]),
    ...extra,
  ];
}

describe('extra Bathrooms (D-189)', () => {
  it.each([
    [0, 2, false],
    [0, 3, true],
    [2, 2, false],
    [2, 3, true],
    [3, 3, false],
    [4, 3, false],
    [4, 4, true],
    [5, 4, false],
    [5, 5, true],
  ])('%i Bedrooms with %i Bathrooms: %s', (bedrooms, bathrooms, extra) => {
    const s = statsOf(household(bedrooms, bathrooms));
    expect([s.bedrooms, s.bathrooms]).toEqual([bedrooms, bathrooms]);
    expect(s.extraBathrooms).toBe(extra);
  });

  it("counts a member's room as a Bedroom (D-103)", () => {
    const grandma: Placement = ['grandmasRoom', 6, 0];
    expect(statsOf(household(1, 3, [grandma])).extraBathrooms).toBe(true);
    expect(statsOf(household(2, 3, [grandma])).extraBathrooms).toBe(false);
  });

  it('leaves the Bathroom ratio as it was', () => {
    expect(statsOf(household(4, 1)).bathroomRatio).toBe(false);
    expect(statsOf(household(4, 2)).bathroomRatio).toBe(true);
    expect(statsOf(household(4, 4)).bathroomRatio).toBe(true);
  });
});

describe('a Garage nothing reaches (D-189)', () => {
  const drive = (x: number, y: number, tiles: number): Placement => [
    'driveway',
    x,
    y,
    0,
    Array.from({ length: tiles }, () => '#'),
  ];
  const cases: [string, Placement[], boolean][] = [
    ['no Garage', [['kitchen', 4, 4]], false],
    ['a Garage on the street edge', [['garage', 4, 10]], false],
    ['a Garage in the middle of the lot', [['garage', 4, 4]], true],
    ['a Garage a Driveway runs up to', [['garage', 4, 4], drive(4, 6, 6)], false],
    ['a Driveway beside its side', [['garage', 4, 4], drive(6, 4, 8)], false],
    ['a Driveway that stops a tile short', [['garage', 4, 4], drive(4, 7, 5)], true],
    ['a Driveway a column away', [['garage', 4, 4], drive(7, 4, 8)], true],
  ];

  it.each(cases)('%s', (_, placements, unreached) => {
    expect(statsOf(placements).garageUnreached).toBe(unreached);
  });

  it("agrees with the rules' tally: the Garage earns nothing exactly when it's unreached", () => {
    const s = rules.newRun(setup('house-stats'));
    for (const [name, placements, unreached] of cases) {
      const house = houseFrom(CONTENT, ROWS, placements);
      const garage = rules
        .currentTally({ ...s, house, hand: [] })
        .pieces.find((p) => p.defId === 'garage');
      if (!garage) continue;
      expect({ name, unmet: garage.unmet !== undefined }).toEqual({ name, unmet: unreached });
    }
  });
});
