// The yard sets (D-164) on the real content: set matching is type-generic, so yard pieces,
// packs (a Fence or a Driveway is one piece of up to 8 tiles), and outbuildings are members
// with no rules change. Each yard set is one per house, and its members touch; a Hallway links
// only rooms, so it never joins a yard piece to one. A piece joins one instance of each set
// type, so one Lawn can serve the Backyard, the Dog Run, and the Play Yard at once, and a
// Kitchen the Entertainer and the Harvest.
//
// Houses are built with houseFrom on an empty 12 × 12 lot, placed unchecked, so uids follow the
// placement order (1, 2, …). The street runs below row 11.

import { describe, expect, it } from 'vitest';
import type { PieceId, RunState } from './index.ts';
import { CONTENT } from './index.ts';
import { computeLayout } from './layout.ts';
import { createRules } from './run.ts';
import { NO_CONTEXT, tallyHouse } from './scoring.ts';
import { matchSets } from './sets.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT, type Placement } from './testing.ts';

const L = emptyRows(12, 12);

const keys = (placements: readonly Placement[]): string[] =>
  matchSets(CONTENT, computeLayout(CONTENT, houseFrom(CONTENT, L, placements))).map((s) => s.key);

function tally(placements: readonly Placement[]) {
  const house = houseFrom(CONTENT, L, placements);
  return tallyHouse(CONTENT, computeLayout(CONTENT, house), 1, true, NO_CONTEXT);
}

/**
 * A Backyard as a chain: the Living Room (uid 1), the Patio beside it (2), and the Lawn beside
 * the Patio (3), which doesn't touch the Living Room.
 *   y0  LLPPgg
 *   y1  LLPPgg
 *   y2  LL....
 */
const BACKYARD: Placement[] = [
  ['livingRoom', 0, 0],
  ['patio', 2, 0],
  ['lawn', 4, 0],
];

describe('the yard sets (D-164)', () => {
  it('match yard pieces like rooms: the Backyard is a Living Room, a Patio, and a Lawn, touching', () => {
    expect(keys(BACKYARD)).toEqual(['backyard:1,2,3']);
    // A member apart breaks it: the Lawn one tile further on.
    expect(
      keys([
        ['livingRoom', 0, 0],
        ['patio', 2, 0],
        ['lawn', 6, 0],
      ]),
    ).toEqual([]);
    // It pays like any set, every week it holds: +15 Comfort and +0.5 Charm.
    const t = tally(BACKYARD);
    expect(t.sets.map((s) => [s.set, s.points, s.mult])).toEqual([['backyard', 15, 50]]);
  });

  it('never joins a yard piece to a room through a Hallway, which links rooms only', () => {
    // The Patio (uid 3) touches only the Hallway (uid 2), not the Living Room.
    //   y0  LLHHPPgg
    //   y1  LL..PPgg
    const viaHall: Placement[] = [
      ['livingRoom', 0, 0],
      ['hallway', 2, 0],
      ['patio', 4, 0],
      ['lawn', 6, 0],
    ];
    expect(keys(viaHall)).toEqual([]);
    // The Patio rule says the same: touching only a Hallway, it earns nothing (D-105).
    expect(tally(viaHall).pieces.find((p) => p.defId === 'patio')!.unmet).toBeDefined();
  });

  it('count a Fence pack as one member, whatever its shape', () => {
    // The Doghouse (uid 1), the Lawn (2), and a five-tile Fence (3) that touches both.
    //   y0  dgg.
    //   y1  Fgg.
    //   y2  FFFF
    const dogRun: Placement[] = [
      ['doghouse', 0, 0],
      ['lawn', 1, 0],
      ['fence', 0, 1, 0, ['#...', '####']],
    ];
    expect(keys(dogRun)).toEqual(['dogRun:1,2,3']);
    expect(keys(dogRun.slice(0, 2))).toEqual([]);
  });

  it('share one Lawn and one Fence among the Backyard, the Dog Run, and the Play Yard', () => {
    // A piece joins one instance of each set type, so the Lawn (uid 3) is in all three and the
    // Fence (uid 6) in both of the Fence's sets.
    //   y3  LL..FFFFF
    //   y4  LLPPggd.F
    //   y5  LLPPggttF
    //   y6  ......tt.
    const three: Placement[] = [
      ['livingRoom', 0, 3],
      ['patio', 2, 4],
      ['lawn', 4, 4],
      ['doghouse', 6, 4],
      ['treehouse', 6, 5],
      ['fence', 4, 3, 0, ['#####', '....#', '....#']],
    ];
    expect(keys(three)).toEqual(['backyard:1,2,3', 'dogRun:3,4,6', 'playYard:3,5,6']);
    expect(tally(three).sets.map((s) => [s.set, s.points, s.mult])).toEqual([
      ['backyard', 15, 50],
      ['dogRun', 10, 50],
      ['playYard', 10, 50],
    ]);
  });

  it('hold one of each per house: the first completed', () => {
    const twice: Placement[] = [...BACKYARD, ['livingRoom', 0, 6], ['patio', 2, 6], ['lawn', 4, 6]];
    expect(keys(twice)).toEqual(['backyard:1,2,3']);
  });

  it('let a Kitchen serve the Entertainer and the Harvest, an L-Kitchen as a Kitchen', () => {
    // The L-Kitchen (uid 1), the Herb Garden (2) beside it, and the Greenhouse (3), an
    // outbuilding, beside the Herb Garden: a Harvest. The Dining Room (4) and the Living Room
    // (5) make the same Kitchen an Entertainer too.
    //   y0  K...
    //   y1  KKhh
    //   y2  DDGG
    //   y3  DDGG
    //   y4  LL..
    const both: Placement[] = [
      ['lKitchen', 0, 0],
      ['herbGarden', 2, 1],
      ['greenhouse', 2, 2],
      ['diningRoom', 0, 2],
      ['livingRoom', 0, 4],
    ];
    expect(keys(both)).toEqual(['entertainer:1,4,5', 'harvest:1,2,3']);
  });

  it('make a Drive-In of a Garage and a Driveway pack, which reaches it from the street', () => {
    //   y8   GG
    //   y9   GG
    //   y10  =.
    //   y11  =.   (the street below)
    const driveIn: Placement[] = [
      ['garage', 0, 8],
      ['driveway', 0, 10, 0, ['#', '#']],
    ];
    expect(keys(driveIn)).toEqual(['driveIn:1,2']);
    expect(tally(driveIn).pieces.find((p) => p.defId === 'garage')!.unmet).toBeUndefined();
    // A Garage on the street earns without a Driveway, but makes no Drive-In.
    expect(keys([['garage', 0, 10]])).toEqual([]);
  });
});

describe('the greedy bot’s estimate and the yard sets', () => {
  const rules = createRules(TEST_CONTENT);
  function built(placements: Placement[], ...ids: PieceId[]): RunState {
    const s = rules.newRun(setup('yard-sets'));
    return {
      ...s,
      house: houseFrom(TEST_CONTENT, emptyRows(8, 8), placements),
      hand: ids.map((id) => ({ kind: 'piece', id })),
    };
  }

  it('flags a yard piece that might complete a set, so the bot scores it exactly', () => {
    const s = built(BACKYARD.slice(0, 2), 'lawn');
    const completes = { t: 'place', from: 'hand', i: 0, x: 4, y: 0, rot: 0 } as const;
    const apart = { ...completes, x: 4, y: 5 };
    expect(rules.estimatePlay(s, completes).setHint).toBe(true);
    expect(rules.estimatePlay(s, apart).setHint).toBe(false);
    expect(rules.preview(s, completes).setsGained.map((g) => g.set)).toEqual(['backyard']);
  });
});
