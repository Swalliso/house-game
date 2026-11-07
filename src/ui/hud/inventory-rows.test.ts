// The goods panel's rows (M5a): hidden until the supply yard first opens, unless something is
// in them; then every row shows, and the shop always shows them all.

import { describe, expect, it } from 'vitest';
import { rules, type MilestoneRecord, type RunState } from '../../rules/index.ts';
import { inventoryRows, showsInventory } from './inventory-rows.ts';

const fresh = (): RunState =>
  rules.newRun({ seed: 'goods', crewId: 'generalContractor', mode: 'standard' });

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
});
