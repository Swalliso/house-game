// The end screen's photos (D-136): a photo for every milestone that resolved (early, on time, in
// overtime, or the missed one that ended a lost run), each of the house as it stood then, and
// one frame for all of them around the finished house.

import { describe, expect, it } from 'vitest';
import { makeGreedy } from '../../../sim/policies/index.ts';
import { simulateRun } from '../../../sim/simulate.ts';
import {
  CONTENT,
  placedCells,
  rules,
  type Action,
  type HouseState,
  type PlacedPiece,
} from '../../rules/index.ts';
import { boardRows, isIndoor } from '../board/geometry.ts';
import { CELL } from '../sprites.ts';
import { milestoneShots, photoFrame } from './photos.ts';

// The greedy bot completing every milestone early that it can: on these seeds it wins with
// early, on-time and overtime milestones, and loses with a missed one.
const early = makeGreedy({ early: 'always' });
const won = simulateRun(rules, 'photo3', early);
const lost = simulateRun(rules, 'photo1', early);

describe('the milestones’ photos', () => {
  it('has a photo for every milestone of a won run, in order', () => {
    const shots = milestoneShots(won.state.setup, won.actions);
    expect(won.state.screen).toBe('won');
    expect(shots.map((s) => s.record)).toEqual(won.state.milestones);
    expect(shots).toHaveLength(CONTENT.balance.phases.length);
    const results = new Set(shots.map((s) => s.record.result));
    expect(results).toContain('early');
    expect(results).toContain('overtime');
    expect(results).toContain('onTime');
  });

  it('takes each one as the milestone resolved: its record is the last in its state', () => {
    for (const [i, shot] of milestoneShots(won.state.setup, won.actions).entries()) {
      expect(shot.state.milestones[i]).toEqual(shot.record);
      expect(shot.state.score).toBe(shot.record.score);
    }
  });

  it('takes the missed milestone that ended a lost run, with the house as it ended', () => {
    const shots = milestoneShots(lost.state.setup, lost.actions);
    expect(lost.state.screen).toBe('lost');
    expect(shots.map((s) => s.record)).toEqual(lost.state.milestones);
    expect(shots.at(-1)!.record.result).toBe('failed');
    expect(shots.at(-1)!.state.house).toEqual(lost.state.house);
  });

  it('shows the house growing: each photo’s house is the run’s at that point', () => {
    const shots = milestoneShots(won.state.setup, won.actions);
    // Replaying the actions up to the one that resolved each milestone gives the same house.
    let s = rules.newRun(won.state.setup);
    let n = 0;
    for (const a of won.actions) {
      s = rules.apply(s, a).state;
      while (n < s.milestones.length) expect(shots[n++]!.state.house).toEqual(s.house);
    }
    expect(n).toBe(shots.length);
    expect(shots[0]!.state.house.pieces.length).toBeLessThan(
      shots.at(-1)!.state.house.pieces.length,
    );
  });

  it('replays once for the same run, and again for another', () => {
    const a = milestoneShots(won.state.setup, won.actions);
    expect(milestoneShots(won.state.setup, won.actions)).toBe(a);
    const b = milestoneShots(lost.state.setup, lost.actions);
    expect(b).not.toBe(a);
    expect(milestoneShots(won.state.setup, [...won.actions])).toEqual(a);
  });

  it('stops quietly at an action that no longer applies', () => {
    const extra: Action[] = [...won.actions, { t: 'pass' }, { t: 'pass' }];
    expect(milestoneShots(won.state.setup, extra).map((s) => s.record)).toEqual(
      won.state.milestones,
    );
  });

  it('has no photos before the first milestone resolves', () => {
    expect(milestoneShots(won.state.setup, won.actions.slice(0, 2))).toEqual([]);
  });
});

/** The rooms' cells. */
function roomCells(house: HouseState) {
  return house.pieces
    .filter((p: PlacedPiece) => isIndoor(p.defId))
    .flatMap((p: PlacedPiece) =>
      placedCells(p.shape ?? CONTENT.pieces[p.defId].shape, p.x, p.y, p.rot),
    );
}

describe('the photos’ frame', () => {
  for (const [name, run] of [
    ['won', won],
    ['lost', lost],
  ] as const) {
    it(`is 4:3 on the board, around the finished house with a cell to spare (${name})`, () => {
      const house = run.state.house;
      const f = photoFrame(house);
      expect(f.w * 3).toBe(f.h * 4);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(house.lot.width * CELL);
      expect(f.y + f.h).toBeLessThanOrEqual(boardRows(house.lot.height) * CELL);
      const cells = roomCells(house);
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) {
        // A cell around the house, where the board leaves room for it.
        const left = Math.max(0, (c.x - 1) * CELL);
        const top = Math.max(0, (c.y - 1) * CELL);
        expect(f.x).toBeLessThanOrEqual(left);
        expect(f.y).toBeLessThanOrEqual(top);
        expect(f.x + f.w).toBeGreaterThanOrEqual(Math.min(house.lot.width, c.x + 2) * CELL);
        expect(f.y + f.h).toBeGreaterThanOrEqual((c.y + 2) * CELL);
      }
    });
  }

  it('frames every photo of a run the same way, so the house grows in place', () => {
    // The end screen frames them all by the finished house (EndPhotos.tsx): the earlier houses
    // fit inside it, as long as nothing was built and then torn down outside it.
    const f = photoFrame(won.state.house);
    for (const shot of milestoneShots(won.state.setup, won.actions)) {
      const g = photoFrame(shot.state.house);
      expect(g.w).toBeLessThanOrEqual(f.w);
    }
  });

  it('frames the middle of an empty lot', () => {
    const house = rules.newRun(won.state.setup).house;
    expect(house.pieces).toHaveLength(0);
    const f = photoFrame(house);
    expect(f).toEqual({
      x: ((house.lot.width - 12) / 2) * CELL,
      y: ((house.lot.height - 9) / 2) * CELL,
      w: 12 * CELL,
      h: 9 * CELL,
    });
  });

  it('frames the yard pieces when there are no rooms', () => {
    const house = won.state.house;
    const yard = house.pieces.filter((p) => !isIndoor(p.defId));
    expect(yard.length).toBeGreaterThan(0);
    const f = photoFrame({ ...house, pieces: yard });
    for (const p of yard) {
      for (const c of placedCells(p.shape ?? CONTENT.pieces[p.defId].shape, p.x, p.y, p.rot)) {
        expect(f.x).toBeLessThanOrEqual(c.x * CELL);
        expect(f.x + f.w).toBeGreaterThanOrEqual((c.x + 1) * CELL);
      }
    }
  });

  it('keeps as much of a very tall house as a frame the board’s width holds', () => {
    const house = won.state.house;
    const room = house.pieces.find((p) => isIndoor(p.defId))!;
    // Rooms from the back of the lot to the street: taller than a 4:3 frame the lot's width.
    const tall: HouseState = {
      ...house,
      pieces: [
        { ...room, x: 4, y: 0 },
        { ...room, uid: 999, x: 4, y: house.lot.height - 2 },
      ],
    };
    const f = photoFrame(tall);
    expect(f).toMatchObject({ x: 0, w: house.lot.width * CELL });
    expect(f.w * 3).toBe(f.h * 4);
    expect(f.y + f.h).toBeLessThanOrEqual(boardRows(house.lot.height) * CELL);
  });

  it('stays on the board when the house stands at its edge', () => {
    const house = won.state.house;
    const room = house.pieces.find((p) => isIndoor(p.defId))!;
    const corner: HouseState = {
      ...house,
      pieces: [{ ...room, x: 0, y: house.lot.height - 2 }],
    };
    const f = photoFrame(corner);
    expect(f.x).toBe(0);
    expect(f.w * 3).toBe(f.h * 4);
    expect(f.y + f.h).toBeLessThanOrEqual(boardRows(house.lot.height) * CELL);
  });
});
