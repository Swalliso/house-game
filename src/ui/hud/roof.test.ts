// The roof view (D-133): once the Roofing milestone is met, the Roof button and T put the roof
// on and take it off. Building takes it off (picking a card, demolishing, holding a room in
// Inspect), and a yard piece held doesn't; it never goes on over a play, a tally or a sheet, and
// putting it on lets go of a held room, which it would cover.

import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT, type MilestoneRecord, type RunState } from '../../rules/index.ts';
import { emptyRows, houseFrom } from '../../rules/testing.ts';
import { busy } from '../fx/director.ts';
import { ROOFING_PHASE } from '../fx/moments.ts';
import { appScreen, heldPiece, roofOn, run, selected, tool } from '../store.ts';
import { canRoof, toggleRoof } from './actions.ts';

const start = run.value;

function met(phase: number): MilestoneRecord {
  return {
    phase,
    result: 'onTime',
    target: 0,
    score: 0,
    weeksSaved: 0,
    overtimeUsed: 0,
    reward: { score: 0, budget: 0, interest: 0 },
  };
}

/** The Closet, a room, and the Patio, in the yard. */
const CLOSET = 1;
const PATIO = 2;

/** A run past the Roofing milestone, on `screen`, with a Closet and a Patio built. */
function pastRoofing(screen: RunState['screen'] = 'build'): void {
  run.value = {
    ...start,
    screen,
    milestones: Array.from({ length: ROOFING_PHASE + 1 }, (_, p) => met(p)),
    house: houseFrom(CONTENT, emptyRows(8, 8), [
      ['closet', 1, 1],
      ['patio', 4, 4],
    ]),
  };
}

afterEach(() => {
  run.value = start;
  roofOn.value = false;
  busy.value = false;
  selected.value = null;
  tool.value = 'build';
  heldPiece.value = null;
  appScreen.value = 'title';
});

describe('the Roof button', () => {
  it('does nothing before the Roofing milestone is met', () => {
    expect(canRoof.value).toBe(false);
    toggleRoof();
    expect(roofOn.value).toBe(false);
  });

  it('puts the roof on and takes it off once Roofing is met', () => {
    pastRoofing();
    expect(canRoof.value).toBe(true);
    toggleRoof();
    expect(roofOn.value).toBe(true);
    toggleRoof();
    expect(roofOn.value).toBe(false);
  });

  it('never puts it on over a play or a tally, but takes it off during one', () => {
    pastRoofing();
    selected.value = 0;
    toggleRoof();
    expect(roofOn.value).toBe(false);
    selected.value = null;
    tool.value = 'demolish';
    toggleRoof();
    expect(roofOn.value).toBe(false);
    tool.value = 'build';
    // The Roofing milestone's beats play with the roof on: T takes it off, and can't put it
    // back until they're done.
    roofOn.value = true;
    busy.value = true;
    toggleRoof();
    expect(roofOn.value).toBe(false);
    toggleRoof();
    expect(roofOn.value).toBe(false);
    busy.value = false;
    toggleRoof();
    expect(roofOn.value).toBe(true);
  });

  it("leaves the roof as it is under a change order's sheet, which it can't be seen under", () => {
    pastRoofing('changeOrder');
    appScreen.value = 'game';
    roofOn.value = true;
    toggleRoof();
    expect(roofOn.value).toBe(true);
    roofOn.value = false;
    toggleRoof();
    expect(roofOn.value).toBe(false);
  });

  it('lets go of a room held in Inspect as it goes on, and keeps a yard piece held', () => {
    pastRoofing();
    heldPiece.value = PATIO;
    toggleRoof();
    expect([roofOn.value, heldPiece.value]).toEqual([true, PATIO]);
    toggleRoof();
    heldPiece.value = CLOSET;
    toggleRoof();
    expect([roofOn.value, heldPiece.value]).toEqual([true, null]);
  });
});

describe('what takes the roof off', () => {
  it('picking a card, or demolishing', () => {
    pastRoofing();
    roofOn.value = true;
    selected.value = 0;
    expect(roofOn.value).toBe(false);
    selected.value = null;
    roofOn.value = true;
    tool.value = 'demolish';
    expect(roofOn.value).toBe(false);
  });

  it('holding a room in Inspect, and not holding a yard piece', () => {
    pastRoofing();
    roofOn.value = true;
    heldPiece.value = PATIO;
    expect(roofOn.value).toBe(true);
    heldPiece.value = CLOSET;
    expect(roofOn.value).toBe(false);
  });

  it('nothing on the end screen, where nothing is built', () => {
    pastRoofing('won');
    roofOn.value = true;
    // Inspect holds nothing once the run is over (store.ts heldPiece).
    heldPiece.value = CLOSET;
    expect(roofOn.value).toBe(true);
    toggleRoof();
    expect(roofOn.value).toBe(false);
    toggleRoof();
    expect(roofOn.value).toBe(true);
  });
});
