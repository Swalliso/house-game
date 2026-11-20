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
  type GameEvent,
  type HouseState,
  type PlacedPiece,
  type RunState,
} from '../../rules/index.ts';
import { boardRows, isIndoor } from '../board/geometry.ts';
import { CELL } from '../sprites.ts';
import { buildSteps, milestoneShots, photoFrame } from './photos.ts';

// The greedy bot completing every milestone early that it can, on the first seeds where it wins
// with early and overtime milestones, and loses with a missed one. Found by search, so tuning
// the content never leaves these tests without the runs they need.
const early = makeGreedy({ early: 'always' });
const runs = new Map<string, ReturnType<typeof simulateRun>>();
function firstRun(want: (r: ReturnType<typeof simulateRun>) => boolean) {
  for (let i = 0; i < 24; i++) {
    const seed = `photo${i}`;
    let r = runs.get(seed);
    if (!r) runs.set(seed, (r = simulateRun(rules, seed, early)));
    if (want(r)) return r;
  }
  throw new Error('no seed gives the run this test needs');
}
const results = (r: ReturnType<typeof simulateRun>) =>
  new Set(r.state.milestones.map((m) => m.result));
const won = firstRun((r) => {
  const res = results(r);
  return r.state.screen === 'won' && res.has('early') && res.has('overtime') && res.has('onTime');
});
const lost = firstRun((r) => r.state.screen === 'lost' && r.state.milestones.length > 1);

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

// The house building itself at the end of a run (D-187): every action that changed how the house
// looks, in order, from the lot as the run began to the finished house.
describe('the time-lapse’s builds', () => {
  /** The actions whose events change the house's look, and each one's state after it. */
  function replayed(r: ReturnType<typeof simulateRun>) {
    const looks = new Set([
      'placed',
      'moved',
      'demolished',
      'transformed',
      'extended',
      'renovated',
      'installed',
    ]);
    const kept: { state: RunState; events: readonly GameEvent[] }[] = [];
    let s = rules.newRun(r.state.setup);
    for (const a of r.actions) {
      const out = rules.apply(s, a);
      s = out.state;
      if (out.events.some((e) => looks.has(e.t))) kept.push(out);
    }
    return kept;
  }

  it('starts from the lot as the run began, with nothing built', () => {
    const { start } = buildSteps(won.state.setup, won.actions);
    expect(start).toEqual(rules.newRun(won.state.setup));
    expect(start.house.pieces).toHaveLength(0);
  });

  for (const [name, run] of [
    ['won', won],
    ['lost', lost],
  ] as const) {
    it(`keeps the state after each action that changed the house, in order (${name})`, () => {
      const { steps } = buildSteps(run.state.setup, run.actions);
      const want = replayed(run);
      expect(steps.length).toBe(want.length);
      expect(steps.length).toBeGreaterThan(10);
      steps.forEach((step, i) => expect(step.state).toEqual(want[i]!.state));
      // Fewer builds than actions: passes, the shop and change orders build nothing.
      expect(steps.length).toBeLessThan(run.actions.length);
    });

    it(`ends on the finished house (${name})`, () => {
      const { steps } = buildSteps(run.state.setup, run.actions);
      expect(steps.at(-1)!.state.house).toEqual(run.state.house);
    });
  }

  it('says whether each build was a room or the yard, for its sound', () => {
    // A won run with a fixture installed, since a fixture's build sounds as its host does. Found
    // by search like the runs above: the first won run need not install one (D-188's delivery
    // left photo0's without).
    const fitted = firstRun(
      (r) => r.state.screen === 'won' && r.actions.some((a) => a.t === 'install'),
    );
    const { steps } = buildSteps(fitted.state.setup, fitted.actions);
    const want = replayed(fitted);
    expect(new Set(steps.map((s) => s.kind))).toEqual(new Set(['room', 'yard']));
    let placed = 0;
    let installed = 0;
    steps.forEach((step, i) => {
      const e = want[i]!.events.find((ev) => ev.t === 'placed' || ev.t === 'installed');
      if (e?.t === 'placed') {
        placed++;
        expect(step.kind).toBe(isIndoor(e.defId) ? 'room' : 'yard');
      } else if (e?.t === 'installed') {
        // A fixture goes with its host: into a room, a room's sound.
        installed++;
        const host = step.state.house.pieces.find((p) => p.uid === e.uid)!;
        expect(step.kind).toBe(isIndoor(host.defId) ? 'room' : 'yard');
      }
    });
    expect(placed).toBeGreaterThan(0);
    expect(installed).toBeGreaterThan(0);
  });

  it('replays once for the same run, and again for another', () => {
    const a = buildSteps(won.state.setup, won.actions);
    expect(buildSteps(won.state.setup, won.actions)).toBe(a);
    const b = buildSteps(lost.state.setup, lost.actions);
    expect(b).not.toBe(a);
    expect(buildSteps(won.state.setup, [...won.actions])).toEqual(a);
  });

  it('stops quietly where the log stops applying, keeping the builds before it', () => {
    // Half the run, then an action that can't apply (no hand card 99), then the rest.
    const half = Math.floor(won.actions.length / 2);
    const broken: Action[] = [
      ...won.actions.slice(0, half),
      { t: 'place', from: 'hand', i: 99, x: 0, y: 0, rot: 0 },
      ...won.actions.slice(half),
    ];
    const { steps } = buildSteps(won.state.setup, broken);
    const before = buildSteps(won.state.setup, won.actions.slice(0, half)).steps;
    expect(steps.length).toBe(before.length);
    expect(steps.map((s) => s.state)).toEqual(before.map((s) => s.state));
    expect(steps.length).toBeLessThan(buildSteps(won.state.setup, won.actions).steps.length);
  });

  it('has no builds before the first piece goes down', () => {
    const first = won.actions.findIndex((a) => a.t === 'place');
    expect(buildSteps(won.state.setup, won.actions.slice(0, first)).steps).toEqual([]);
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
