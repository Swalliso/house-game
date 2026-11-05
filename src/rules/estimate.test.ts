import { describe, expect, it } from 'vitest';
import type { PlaceAction, RunState } from './index.ts';
import { lotFromRows } from './lot.ts';
import { createRules } from './run.ts';
import { emptyRows, setup, TEST_CONTENT as C } from './testing.ts';

const rules = createRules(C);

function onLot(rows: string[], ...ids: RunState['hand'][number]['id'][]): RunState {
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

const exact = (s: RunState, p: PlaceAction) => rules.scoreOnly(s, p) - rules.scoreOnly(s, null);

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
    for (const x of [0, 2, 4, 6]) {
      s = { ...rules.apply(s, place(0, x, 0)).state, hand: [{ kind: 'piece', id: 'lawn' }] };
    }
    expect(rules.estimatePlay(s, place(0, 2, 2)).delta).toBe(exact(s, place(0, 2, 2)));
  });

  it('sees rooms linked through a Hallway', () => {
    let s = onLot(emptyRows(10, 10), 'bedroom', 'longHallway', 'bathroom');
    s = { ...rules.apply(s, place(0, 0, 0)).state, hand: [{ kind: 'piece', id: 'longHallway' }] };
    s = { ...rules.apply(s, place(0, 2, 1)).state, hand: [{ kind: 'piece', id: 'bedroom' }] };
    s = { ...rules.apply(s, place(0, 5, 0)).state, hand: [{ kind: 'piece', id: 'bathroom' }] };
    // The Bathroom touches only the Hallway, which links it to both Bedrooms.
    const est = rules.estimatePlay(s, place(0, 3, 2));
    expect(est.setHint).toBe(true);
    expect(est.delta).toBeGreaterThan(0);
  });

  it('flags plays that might complete a set', () => {
    let s = onLot(emptyRows(8, 6), 'bedroom', 'bathroom');
    s = { ...rules.apply(s, place(0, 0, 0)).state, hand: [{ kind: 'piece', id: 'bathroom' }] };
    expect(rules.estimatePlay(s, place(0, 2, 0)).setHint).toBe(true);
    expect(rules.estimatePlay(s, place(0, 6, 4)).setHint).toBe(false);
  });
});
