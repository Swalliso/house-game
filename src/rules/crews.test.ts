// Crews (M4b; Appendix B · Crews, Appendix A · M4a's pool): a crew's starting cards wait in the
// reserve's extra slots from week 1; the Landscaper draws yard pieces at +50% and they earn
// +25%; the Architect draws the four Core special rooms at weight 5 and every set pays +50%;
// and a run code carries the crew, old codes included. On TEST_CONTENT.

import { describe, expect, it } from 'vitest';
import type { CrewId, PieceId, RunState } from './index.ts';
import { drawWeights } from './draw.ts';
import { createRules } from './run.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { reserveUsed } from './shop.ts';
import { emptyRows, houseFrom, TEST_CONTENT as C } from './testing.ts';

const r = createRules(C);
const run = (crewId: CrewId, seed = 'crew'): RunState =>
  r.newRun({ seed, clientId: 'hendersons', crewId, mode: 'standard' });
const weightOf = (crewId: CrewId, id: PieceId, phase = 1) =>
  drawWeights(C, phase, { mods: C.crews[crewId].modifiers }).find((w) => w.card.id === id)
    ?.weight ?? 0;

describe('the Landscaper', () => {
  it('starts with a Sapling and a Fence in extra reserve slots', () => {
    const s = run('landscaper');
    expect(s.reserve).toEqual([
      { id: 'sapling', crew: true },
      { id: 'fence', crew: true },
    ]);
    expect(reserveUsed(s)).toBe(0);
    // Two bought pieces still fit beside them.
    const give = (x: RunState) =>
      r.apply(x, { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'library' } }).state;
    expect(give(give(s)).reserve).toHaveLength(4);
    expect(() => give(give(give(s)))).toThrow('Your reserve is full.');
    // The other crews start with an empty reserve.
    expect(run('generalContractor').reserve).toEqual([]);
    expect(run('architect').reserve).toEqual([]);
  });

  it('places its starting Fence as a pack from the reserve', () => {
    const s: RunState = { ...run('landscaper'), house: houseFrom(C, emptyRows(8, 8)) };
    const { state, events } = r.apply(s, {
      t: 'place',
      from: 'reserve',
      i: 1,
      x: 0,
      y: 0,
      rot: 0,
      shape: ['####'],
    });
    expect(events[0]).toMatchObject({ t: 'placed', defId: 'fence' });
    expect(state.reserve).toEqual([{ id: 'sapling', crew: true }]);
  });

  it('draws yard pieces at +50%, and they earn +25%', () => {
    expect(weightOf('landscaper', 'lawn')).toBe((weightOf('generalContractor', 'lawn') * 3) / 2);
    expect(weightOf('landscaper', 'bedroom')).toBe(weightOf('generalContractor', 'bedroom'));
    const house = houseFrom(C, emptyRows(8, 8), [
      ['lawn', 0, 0],
      ['lawn', 2, 0],
      ['bedroom', 0, 2],
    ]);
    const tally = r.currentTally({ ...run('landscaper'), house });
    // Each Lawn: 1, +1 for the other = 2, +25% → 2.5, rounded half up.
    expect(tally.pieces.map((p) => [p.defId, p.pct, p.earned])).toEqual([
      ['lawn', 25, 3],
      ['lawn', 25, 3],
      ['bedroom', 0, 3],
    ]);
  });
});

describe('the Architect', () => {
  it('draws the four Core special rooms at weight 5', () => {
    for (const id of ['playroom', 'library', 'mudroom', 'pool'] as const) {
      expect(weightOf('generalContractor', id)).toBe(0);
      // Weight 5, times its complexity's percent for the phase (hundredths, D-055).
      const pct = C.balance.complexityPct[1]![C.pieces[id].complexity - 1]!;
      expect(weightOf('architect', id)).toBe(5 * pct);
    }
    expect(weightOf('architect', 'sunroom')).toBe(0);
  });

  it('pays every set 50% more: its Points and its Mult', () => {
    const house = houseFrom(C, emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ]);
    const plain = r.currentTally({ ...run('generalContractor'), house }).sets;
    const arch = r.currentTally({ ...run('architect'), house }).sets;
    expect(plain.map((x) => [x.set, x.points, x.mult])).toEqual([['jackAndJill', 10, 50]]);
    expect(arch.map((x) => [x.set, x.points, x.mult])).toEqual([['jackAndJill', 15, 75]]);
  });
});

describe('a run code’s crew', () => {
  it('round-trips each crew, and an old code with the General Contractor still replays', () => {
    for (const crewId of ['generalContractor', 'landscaper', 'architect'] as const) {
      const setup = {
        seed: `code-${crewId}`,
        clientId: 'hendersons',
        crewId,
        mode: 'standard',
      } as const;
      const actions = [{ t: 'pass' }, { t: 'pass' }] as const;
      const code = encodeRunCode({
        build: 'test',
        contentHash: contentHash(C),
        setup,
        actions: [...actions],
      });
      const decoded = decodeRunCode(code);
      if (!decoded.ok) throw new Error(decoded.error);
      expect(decoded.data.setup).toEqual(setup);
      const replayed = r.replay(decoded.data.setup, decoded.data.actions);
      expect(replayed.failedAt).toBeUndefined();
      expect(replayed.state.setup.crewId).toBe(crewId);
    }
  });
});
