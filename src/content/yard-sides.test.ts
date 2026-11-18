// D-166, the lot decides: each yard piece has a side. What goes out back earns more in the back
// yard, what greets the street in the front yard, and the board shades the yard a picked card
// reads (rules.yardTiles, yardsRead).

import { describe, expect, it } from 'vitest';
import { CONTENT, createRules, yardsRead, type PieceId, type RunState } from '../rules/index.ts';
import { emptyRows, houseFrom } from '../rules/testing.ts';

const R = createRules(CONTENT);

const BACK: readonly PieceId[] = [
  'patio',
  'lawn',
  'firePit',
  'hotTub',
  'pool',
  'treehouse',
  'doghouse',
];
const FRONT: readonly PieceId[] = ['flowerBed', 'driveway', 'porch'];

describe('yard sides (D-166)', () => {
  it('back-yard pieces earn +1 out back; front-yard pieces +2 in front', () => {
    for (const id of BACK) {
      expect(yardsRead(CONTENT, { kind: 'piece', id }), id).toEqual(['backYard']);
      expect(CONTENT.pieces[id].effects.at(-1), id).toEqual({
        kind: 'conditional',
        when: { in: 'backYard' },
        effect: { kind: 'steady', amount: 1 },
      });
    }
    for (const id of FRONT) {
      expect(yardsRead(CONTENT, { kind: 'piece', id }), id).toEqual(['frontYard']);
      expect(
        CONTENT.pieces[id].effects.some(
          (e) =>
            e.kind === 'conditional' &&
            'in' in e.when &&
            e.when.in === 'frontYard' &&
            e.effect.kind === 'steady' &&
            e.effect.amount === 2,
        ),
        id,
      ).toBe(true);
    }
  });

  it('no other card has a side, and a hand card still shows what it is for', () => {
    const sided = new Set<PieceId>([...BACK, ...FRONT]);
    for (const def of Object.values(CONTENT.pieces)) {
      if (sided.has(def.id)) continue;
      expect(yardsRead(CONTENT, { kind: 'piece', id: def.id }), def.id).toEqual([]);
    }
    // The side line comes last, so the hand's line (the first that pays) is as it was.
    for (const id of [...BACK, ...FRONT]) {
      const first = CONTENT.pieces[id].effects.findIndex(
        (e) => e.kind === 'conditional' && 'in' in e.when,
      );
      expect(first, id).toBeGreaterThan(0);
    }
  });

  it('reads a fixture’s yard too: Garden Lights shade the front', () => {
    expect(yardsRead(CONTENT, { kind: 'fixture', id: 'gardenLights' })).toEqual(['frontYard']);
    expect(yardsRead(CONTENT, { kind: 'fixture', id: 'fireplace' })).toEqual([]);
  });

  it('the board’s yards are the rules’ regions, split at the house’s front row', () => {
    const start = R.newRun({
      seed: 'yards',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    const lot = emptyRows(6, 6);
    // No room yet: the whole lot is front yard, and there's no back yard to shade.
    const bare: RunState = { ...start, house: houseFrom(CONTENT, lot, []) };
    expect(R.yardTiles(bare, 'frontYard')).toHaveLength(36);
    expect(R.yardTiles(bare, 'backYard')).toEqual([]);
    // A Bedroom on rows 2–3: rows 4–5 are front yard; rows 0–3 beside and behind it, back.
    const s: RunState = { ...start, house: houseFrom(CONTENT, lot, [['bedroom', 0, 2]]) };
    expect(R.yardTiles(s, 'frontYard')).toEqual([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]);
    const back = R.yardTiles(s, 'backYard');
    expect(back).toHaveLength(24 - 4);
    expect(back).not.toContain(12); // the Bedroom's own tile
    expect(back).toContain(0);
    expect(back).toContain(23);
  });

  it('where the house sits decides the side: a Lawn by the street is out back once a room is in front', () => {
    // The front yard is counted by rows (D-049), so a room nearer the street moves it. Dale has
    // no taste for Lawns (the Hendersons pay them +50%).
    const lot = emptyRows(6, 8);
    const lawn = (rooms: [PieceId, number, number][]) =>
      R.currentTally({
        ...R.newRun({
          seed: 'yards',
          clientId: 'dale',
          crewId: 'generalContractor',
          mode: 'standard',
        }),
        house: houseFrom(CONTENT, lot, [['lawn', 4, 4], ...rooms]),
      }).pieces[0]!.earned;
    expect(lawn([['bedroom', 0, 0]])).toBe(1); // in front of the house
    expect(lawn([['bedroom', 0, 6]])).toBe(2); // the house comes down to the street
  });
});
