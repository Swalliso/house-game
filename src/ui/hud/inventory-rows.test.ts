// The goods panel's rows (M5a): hidden until the supply yard first opens, unless something is
// in them; then every row shows, and the shop always shows them all. D-157: the types struck this
// run, once there are some, from the hand dealt after the strike.

import { describe, expect, it } from 'vitest';
import { rules, type MilestoneRecord, type RunState } from '../../rules/index.ts';
import { foldCounts, foldedEmpty, inventoryRows, showsInventory } from './inventory-rows.ts';

const fresh = (): RunState =>
  rules.newRun({
    seed: 'goods',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });

const MET: MilestoneRecord = {
  phase: 0,
  result: 'onTime',
  target: 100,
  score: 120,
  weeksSaved: 0,
  overtimeUsed: 0,
  reward: { budget: 3, score: 0, interest: 0 },
};

describe("the goods panel's rows", () => {
  it('stay hidden before the first shop, with nothing in them', () => {
    const rows = inventoryRows({ ...fresh(), reserve: [] }, false);
    expect(rows).toEqual({
      reserve: false,
      supplies: false,
      blueprints: false,
      upgrades: false,
      freePlay: false,
      struck: false,
    });
    expect(showsInventory(rows)).toBe(false);
  });

  it('show a row that has something in it, even before the first shop', () => {
    const s: RunState = {
      ...fresh(),
      reserve: [],
      supplies: [{ kind: 'fixture', id: 'fireplace' }],
    };
    const rows = inventoryRows(s, false);
    expect(rows.supplies).toBe(true);
    expect(rows.reserve).toBe(false);
    expect(rows.blueprints).toBe(false);
    expect(showsInventory(rows)).toBe(true);
  });

  it("show the reserve from week 1 when the crew's starting cards are in it (M4b)", () => {
    const s = rules.newRun({
      seed: 'goods',
      clientId: 'hendersons',
      crewId: 'landscaper',
      mode: 'standard',
    });
    expect(s.reserve.length).toBeGreaterThan(0);
    expect(s.reserve.every((r) => r.crew)).toBe(true);
    const rows = inventoryRows(s, false);
    expect(rows.reserve).toBe(true);
    expect(rows.blueprints).toBe(false);
    expect(showsInventory(rows)).toBe(true);
  });

  it('show every row once a milestone has passed, and always in the shop', () => {
    const empty: RunState = { ...fresh(), reserve: [], supplies: [], blueprints: [] };
    for (const rows of [
      inventoryRows({ ...empty, milestones: [MET] }, false),
      inventoryRows(empty, true),
    ]) {
      expect(rows).toMatchObject({ reserve: true, supplies: true, blueprints: true });
    }
  });

  it('show the upgrades and the free play only when there are some', () => {
    const s: RunState = { ...fresh(), upgrades: [], freePlay: 'none' };
    expect(inventoryRows(s, true)).toMatchObject({ upgrades: false, freePlay: false });
    const ready: RunState = { ...s, freePlay: 'ready' };
    expect(inventoryRows(ready, false).freePlay).toBe(true);
    expect(showsInventory(inventoryRows({ ...ready, reserve: [] }, false))).toBe(true);
  });

  it('show the struck types from the hand dealt after the strike, and at once in the shop', () => {
    const s: RunState = {
      ...fresh(),
      reserve: [],
      supplies: [],
      struck: [
        { kind: 'piece', id: 'garage' },
        { kind: 'fixture', id: 'skylight' },
      ],
    };
    // Struck this week, after the hand was dealt: not yet while building.
    const now = inventoryRows(s, false, 0);
    expect(now.struck).toBe(false);
    expect(showsInventory(now)).toBe(false);
    expect(foldedEmpty(s, now)).toBe(true);
    // The next week's hand brings them in, the folded plank included.
    const next = inventoryRows(s, false, 2);
    expect(next).toMatchObject({ struck: true, reserve: false, supplies: false });
    expect(showsInventory(next)).toBe(true);
    expect(foldedEmpty(s, next)).toBe(false);
    // The shop shows them as they are; with no snapshot, so does the build screen.
    expect(inventoryRows(s, true, 0).struck).toBe(true);
    expect(inventoryRows(s, false).struck).toBe(true);
    // None struck, none shown, whatever the snapshot says.
    expect(inventoryRows({ ...s, struck: [] }, false, 2).struck).toBe(false);
  });

  it("count each kind on the folded plank, the struck types named in the count's title", () => {
    const s: RunState = {
      ...fresh(),
      reserve: [],
      supplies: [{ kind: 'fixture', id: 'fireplace' }],
      struck: [
        { kind: 'piece', id: 'garage' },
        { kind: 'fixture', id: 'skylight' },
      ],
    };
    expect(foldCounts(s)).toEqual([
      ['tool', 1, '1 in the supplies'],
      ['strike', 2, 'Struck: Garage, Skylight'],
    ]);
    expect(foldCounts({ ...s, supplies: [], struck: [] })).toEqual([]);
  });
});
