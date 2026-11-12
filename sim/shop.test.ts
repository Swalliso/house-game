// The shop bot's blueprint values (sim/policies/shop.ts) on the real content: the house as it
// stands, plus the planning that keeps a build-around from being worth nothing before its
// build starts (D-143).

import { describe, expect, it } from 'vitest';
import { CONTENT, rules, stream, type BlueprintId, type RunState } from '../src/rules/index.ts';
import { emptyRows, houseFrom, type Placement } from '../src/rules/testing.ts';
import { goodValue, strikeAct, strikesWanted, STRIKE_ORDER } from './policies/shop.ts';

// Two Bedrooms and a Living Room, well back from the street: rooms that earn, and no "-house"
// piece, Dark room, or fixture.
const ROOMS: Placement[] = [
  ['bedroom', 0, 0],
  ['bedroom', 2, 0],
  ['livingRoom', 6, 0],
];

function run(placements: readonly Placement[], phase = 1): RunState {
  const s = rules.newRun({
    seed: 'shop-bot',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  const W = CONTENT.balance.weeksPerPhase;
  return {
    ...s,
    phase,
    week: phase * W + 1,
    house: houseFrom(CONTENT, emptyRows(12, 12), placements),
    hand: [],
  };
}

const value = (s: RunState, id: BlueprintId) =>
  goodValue(rules, s, { kind: 'blueprint', id }, stream('shop-bot', 'test'), { salt: 0 });

describe('the shop bot', () => {
  it('values a blueprint that counts pieces before the house has any (D-143)', () => {
    const s = run(ROOMS);
    expect(rules.currentTally(s).total).toBeGreaterThan(0);
    // It's a House adds nothing to this house today, and the rules say what each piece would.
    expect(rules.blueprintValue(s, 'itsAHouse')).toMatchObject({ gain: 0, overRun: 0 });
    expect(rules.blueprintValue(s, 'itsAHouse')!.perPiece!.gain).toBeGreaterThan(0);
    expect(value(s, 'itsAHouse')).toBeGreaterThan(0);
    // So does Model Home, whose pieces with a fixture the draw can't promise.
    expect(value(s, 'modelHome')).toBeGreaterThan(0);
  });

  it('plans for fewer pieces as the weeks run out, and for more once one stands', () => {
    const early = value(run(ROOMS, 1), 'itsAHouse');
    const late = value(run(ROOMS, 5), 'itsAHouse');
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
    const started = value(run([...ROOMS, ['birdhouse', 0, 6]], 1), 'itsAHouse');
    expect(started).toBeGreaterThan(early);
  });

  it('plans for a set bonus once the set is half there, and for nothing it can’t see', () => {
    // Open Concept with no Entertainer: a Living Room alone is one of its three rooms, a
    // Kitchen beside it makes two, and then the bot expects the set.
    expect(value(run(ROOMS), 'openConcept')).toBe(0);
    const twoOfThree = run([...ROOMS, ['kitchen', 0, 4]]);
    expect(rules.currentTally(twoOfThree).sets).toEqual([]);
    expect(value(twoOfThree, 'openConcept')).toBeGreaterThan(0);
    // Curb Appeal with nothing in the front yard: it can't see a garden it would have to plant.
    expect(value(run(ROOMS), 'curbAppeal')).toBe(0);
    // And a blueprint it already holds is worth nothing more.
    const held = { ...run(ROOMS), blueprints: [{ id: 'itsAHouse' as const, boughtWeek: 1 }] };
    expect(value(held, 'itsAHouse')).toBe(0);
  });

  it('strikes with strikes fixed: the hand card earliest in STRIKE_ORDER, by its root (D-157)', () => {
    const s: RunState = {
      ...run(ROOMS),
      hand: [
        { kind: 'piece', id: 'sapling' },
        { kind: 'piece', id: 'kitchen' },
        { kind: 'piece', id: 'longHallway' },
      ],
    };
    // The Long Hallway is a Hallway, which comes before the Sapling.
    expect(s.strikesLeft).toBe(1);
    expect(strikeAct(rules, s)).toEqual({ t: 'strikeCard', i: 2 });
    expect(strikeAct(rules, { ...s, strikesLeft: 0 })).toBeNull();
    expect(strikeAct(rules, { ...s, hand: [{ kind: 'piece', id: 'kitchen' }] })).toBeNull();
    // +1 strike is wanted while it holds fewer than the STRIKE_ORDER types it could strike.
    expect(strikesWanted(rules, s)).toBe(STRIKE_ORDER.length);
    const struck = STRIKE_ORDER.slice(0, 3).map((id) => ({ kind: 'piece' as const, id }));
    expect(strikesWanted(rules, { ...s, struck })).toBe(2);
    expect(strikeAct(rules, { ...s, struck })).toEqual({ t: 'strikeCard', i: 0 });
  });
});
