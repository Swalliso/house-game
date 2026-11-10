// Set matching with linked rooms (D-065): a link made later, by a Hallway or by a room that
// bridges two of Open Concept's groups, can complete a new instance on its own step, but never
// re-dates or swaps an instance the house already holds. With the real content, where the
// Entertainer holds at most one instance, a swap would move a Chandelier's ×Mult between rooms.
//
// Houses are built with houseFrom on an empty 12 × 10 lot, so uids follow the placement order.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/index.ts';
import type { Modifier } from './index.ts';
import { computeLayout, isLayoutModifier } from './layout.ts';
import { matchSets } from './sets.ts';
import { emptyRows, houseFrom, type Placement } from './testing.ts';

// A link among the Entertainer's rooms. Open Concept carried it until D-143; the rules still
// know the modifier, and a set must never be re-dated or swapped by one.
const LINK: Modifier = { kind: 'link', among: ['kitchen', 'diningRoom', 'livingRoom'] };
const OPEN_CONCEPT = [LINK].filter(isLayoutModifier);

function keys(placements: readonly Placement[], openConcept: boolean): string[] {
  const house = houseFrom(CONTENT, emptyRows(12, 10), placements);
  const layout = computeLayout(CONTENT, house, openConcept ? OPEN_CONCEPT : []);
  return matchSets(CONTENT, layout).map((s) => s.key);
}

describe('linked rooms in sets (D-065)', () => {
  it('a later Hallway never swaps the held Entertainer, with or without Open Concept', () => {
    const before: Placement[] = [
      ['diningRoom', 0, 0], // 1
      ['kitchen', 0, 2], // 2
      ['closet', 2, 0], // 3
      ['livingRoom', 3, 0], // 4: touches only the Closet
      ['livingRoom', 0, 4, 1], // 5
    ];
    // The Hallway links Living Room 4 to the Dining Room and the Kitchen, at its own step (6).
    const after: Placement[] = [...before, ['hallway', 2, 1, 1]];
    for (const openConcept of [false, true]) {
      expect(keys(before, openConcept)).toContain('entertainer:1,2,5');
      const held = keys(after, openConcept).filter((k) => k.startsWith('entertainer:'));
      expect(held).toEqual(['entertainer:1,2,5']);
    }
  });

  it('a room that bridges two Open Concept groups links them from its own step only', () => {
    const before: Placement[] = [
      ['diningRoom', 0, 0], // 1
      ['kitchen', 0, 2], // 2
      ['bathroom', 0, 4], // 3
      ['livingRoom', 0, 5, 1], // 4: not in the Kitchen's group yet
      ['livingRoom', 2, 0], // 5
    ];
    // A second Dining Room touching the Kitchen, Living Room 5, and Living Room 4 joins all of
    // them into one group at step 6. Living Room 4 mustn't count as linked back at step 4.
    const after: Placement[] = [...before, ['diningRoom', 2, 3]];
    expect(keys(before, true)).toContain('entertainer:1,2,5');
    const held = keys(after, true).filter((k) => k.startsWith('entertainer:'));
    expect(held).toEqual(['entertainer:1,2,5']);
  });

  it('Open Concept links still count once made', () => {
    // A Kitchen and a Living Room that don't touch, joined through a Dining Room placed last:
    // the Entertainer forms at the Dining Room's step, through the group it makes.
    const house: Placement[] = [
      ['kitchen', 0, 0], // 1
      ['closet', 2, 0], // 2
      ['livingRoom', 3, 0], // 3
      ['diningRoom', 2, 1], // 4: touches the Kitchen and the Living Room
    ];
    expect(keys(house, true).filter((k) => k.startsWith('entertainer:'))).toEqual([
      'entertainer:1,3,4',
    ]);
  });
});
