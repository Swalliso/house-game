// D-206 on the real content: the neighbor's ask (S18). Once a run, as Roofing starts, a neighbor
// asks for 5 tiles of Fence in the two columns along their side of the lot, and gives a week of
// overtime if they're there by Roofing's milestone. Your goods always holds a Fence then (the
// standing stock, D-160), so the player can always answer. A first job, and a side with water or
// kept Trees in its strip, get none: a lake lot never does. The numbers follow balance.ts;
// src/rules/neighbor.test.ts holds the rule on the test content.

import { describe, expect, it } from 'vitest';
import type { Action, Content, GameEvent, PlaceAction, RunMode, RunState } from '../rules/index.ts';
import { rules } from '../rules/index.ts';
import { sideStrip } from '../rules/layout.ts';
import { isWater } from '../rules/lot.ts';
import { CONTENT, validateContent } from './index.ts';

const start = (seed: string, mode: RunMode = 'standard') =>
  rules.newRun({ seed, clientId: 'hendersons', crewId: 'generalContractor', mode });

/** The next step of a run that only passes: shops left, change orders answered, targets met by a cheat. */
function passOn(s: RunState): Action {
  if (s.screen === 'shop') return s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
  if (s.screen === 'changeOrder') return { t: 'answerChangeOrder', i: 0 };
  if (s.score < rules.target(s)) return { t: 'debug', op: 'addScore', amount: rules.target(s) };
  return { t: 'pass' };
}

/** Plays a run on with passes until `stop` or its end, collecting the events on the way. */
function play(from: RunState, stop: (s: RunState) => boolean, seen: GameEvent[] = []): RunState {
  let s = from;
  for (let k = 0; k < 2000 && !stop(s) && s.screen !== 'won' && s.screen !== 'lost'; k++) {
    const out = rules.apply(s, passOn(s));
    seen.push(...out.events);
    s = out.state;
  }
  return s;
}

const firstWeekOf = (phase: number) => (s: RunState) =>
  s.screen === 'build' && s.phase === phase && s.slot === 1;
const roofing = firstWeekOf(3);
const never = () => false;

const asks = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { t: 'neighborAsked' }> => e.t === 'neighborAsked');
const answers = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { t: 'neighborResolved' }> => e.t === 'neighborResolved',
  );

/** The standing stock's Fence laid straight down a column of `side`'s strip, 5 tiles, where it fits. */
function fenceAlong(s: RunState, side: 'left' | 'right'): PlaceAction | null {
  const i = s.reserve.findIndex((c) => c.id === 'fence');
  if (i < 0) return null;
  const w = s.house.lot.width;
  for (const x of side === 'left' ? [0, 1] : [w - 2, w - 1]) {
    for (let y = 0; y + 5 <= s.house.lot.height; y++) {
      const play: PlaceAction = {
        t: 'place',
        from: 'reserve',
        i,
        x,
        y,
        rot: 0,
        shape: ['#', '#', '#', '#', '#'],
      };
      if (rules.checkPlay(s, play).legal) return play;
    }
  }
  return null;
}

describe('the neighbor’s ask (D-206)', () => {
  it('asks for 5 tiles of Fence, 2 columns deep, as Roofing starts, for a week of overtime', () => {
    expect(CONTENT.balance.neighborAsk).toEqual({
      phase: 3,
      piece: 'fence',
      depth: 2,
      tiles: 5,
      reward: { overtime: 1 },
    });
    expect(rules.phaseName(3)).toBe('Roofing');
  });

  it('flags numbers that can’t work', () => {
    const askWith = (over: Partial<Content['balance']['neighborAsk']>) =>
      validateContent({
        ...CONTENT,
        balance: {
          ...CONTENT.balance,
          neighborAsk: { ...CONTENT.balance.neighborAsk, ...over },
        },
      } as Content).filter((p) => p.startsWith('balance neighborAsk'));
    expect(askWith({})).toEqual([]);
    expect(askWith({ piece: 'gazebo?' as never })).toEqual([
      'balance neighborAsk: unknown piece "gazebo?"',
    ]);
    expect(askWith({ phase: 6 })).toEqual([
      'balance neighborAsk: phase must be a phase of the run before the last',
    ]);
    for (const depth of [0, 1.5, 12]) {
      expect(askWith({ depth }), String(depth)).toContain(
        'balance neighborAsk: depth must be a whole number of columns, under half the lot',
      );
    }
    for (const tiles of [-1, 2.5, 49]) {
      expect(askWith({ tiles }), String(tiles)).toEqual([
        'balance neighborAsk: tiles must be a whole number the strip can hold',
      ]);
    }
    expect(askWith({ reward: {} })).toEqual(['balance neighborAsk: an ask pays something']);
    // Turned off, it needs no reward.
    expect(askWith({ tiles: 0, reward: {} })).toEqual([]);
  });

  it('comes once on most runs, as Roofing starts, on a side with room and no water', () => {
    let n = 0;
    const seeds = Array.from({ length: 40 }, (_, k) => `neighbor-${k}`);
    for (const seed of seeds) {
      const seen: GameEvent[] = [];
      const s = play(start(seed), roofing, seen);
      const [e, ...more] = asks(seen);
      expect(more, seed).toEqual([]);
      play(s, never, seen);
      expect(asks(seen), seed).toHaveLength(e ? 1 : 0);
      if (!e) continue;
      n++;
      expect(e, seed).toMatchObject({ phase: 3, tiles: 5 });
      expect(e.have, seed).toBeLessThan(5);
      expect(s.neighbor, seed).toEqual({ side: e.side, phase: 3, tiles: 5 });
      const strip = sideStrip(s.house.lot, e.side, 2);
      expect(
        strip.some((i) => isWater(s.house.lot.terrain[i] ?? null)),
        seed,
      ).toBe(false);
      // The standing stock's Fence is there to answer it.
      expect(
        s.reserve.some((c) => c.id === 'fence'),
        seed,
      ).toBe(true);
    }
    // About two runs in three: lake lots, creeks across both strips and Old Woods skip it.
    expect(n).toBeGreaterThanOrEqual(seeds.length / 2);
  });

  it('never comes on a lake lot, or a first job', () => {
    // A lake lot's lake runs along its back, through both strips.
    for (const seed of ['elm', 'maple']) {
      const lake = start(seed);
      expect(lake.house.lot.kind, seed).toBe('lake');
      const seen: GameEvent[] = [];
      expect(play(lake, never, seen).neighbor, seed).toBeUndefined();
      expect(asks(seen), seed).toEqual([]);
    }
    for (const seed of ['oak', 'birch', 'pine']) {
      const seen: GameEvent[] = [];
      expect(play(start(seed, 'firstJob'), never, seen).neighbor, seed).toBeUndefined();
      expect(asks(seen), seed).toEqual([]);
    }
  });

  it('pays a week of overtime at Roofing’s milestone for the stock Fence along their side, once', () => {
    for (const [seed, side] of [
      ['oak', 'left'],
      ['birch', 'right'],
    ] as const) {
      const s = play(start(seed), roofing);
      expect(s.neighbor?.side, seed).toBe(side);
      const fence = fenceAlong(s, side);
      expect(fence, seed).not.toBeNull();
      const laid = rules.apply(s, fence!).state;
      expect(rules.neighbor(laid), seed).toMatchObject({ have: 5, met: true });
      const seen: GameEvent[] = [];
      const after = play(laid, firstWeekOf(4), seen);
      expect(answers(seen), seed).toEqual([
        {
          t: 'neighborResolved',
          side,
          phase: 3,
          tiles: 5,
          have: 5,
          result: 'met',
          reward: { overtime: 1 },
        },
      ]);
      expect(after.overtimeLeft, seed).toBe(s.overtimeLeft + 1);
      const rest: GameEvent[] = [];
      play(after, never, rest);
      expect(answers(rest), seed).toEqual([]);
    }
  });

  it('pays nothing for a Fence along the other side', () => {
    const s = play(start('oak'), roofing);
    expect(s.neighbor?.side).toBe('left');
    const laid = rules.apply(s, fenceAlong(s, 'right')!).state;
    const seen: GameEvent[] = [];
    const after = play(laid, firstWeekOf(4), seen);
    expect(answers(seen)).toEqual([
      { t: 'neighborResolved', side: 'left', phase: 3, tiles: 5, have: 0, result: 'missed' },
    ]);
    expect(after.overtimeLeft).toBe(s.overtimeLeft);
  });
});
