// D-206: the neighbor's ask (S18). The lot's left and right edges, `neighborAsk.depth` columns
// deep, are regions (leftSide, rightSide), and a house condition counts the tiles of matching
// pieces inside a region (a Fence pack is one piece of several tiles). Once a run, in the first
// week of `neighborAsk.phase`, a neighbor asks for `tiles` tiles of Fence in the strip along their
// side, by that phase's milestone: the side the seed picks (`neighbor/<phase>`), or the other when
// that one has water or kept Trees in its strip, is met already, or has no room for what's
// missing in one group. Never in a first job. Met at the milestone, it pays its reward once; a
// run code replays it, since it takes no action. On TEST_CONTENT, with the ask turned on.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Content,
  GameEvent,
  HouseCondition,
  NeighborSide,
  RunState,
} from './index.ts';
import { meetsHouse, progressOf, tilesInRegion } from './conditions.ts';
import { computeLayout as layoutFor, pieceIn, REGION_BIT, sideStrip } from './layout.ts';
import { stream } from './rng.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, type Rules } from './run.ts';
import { houseConditionText } from './text.ts';
import { houseFrom, setup, TEST_CONTENT, type Placement } from './testing.ts';

/** Four two-week phases with targets of 0, and the neighbor's ask at the third's start. */
function asking(over: Partial<Content['balance']['neighborAsk']> = {}, targets = [0, 0, 0, 0]) {
  return {
    ...TEST_CONTENT,
    balance: {
      ...TEST_CONTENT.balance,
      phases: targets.map((target, k) => ({ name: `Phase ${k + 1}`, target })),
      neighborAsk: {
        phase: 2,
        piece: 'fence' as const,
        depth: 2,
        tiles: 5,
        reward: { overtime: 1 },
        ...over,
      },
    },
  } satisfies Content;
}

const C = asking();
const r = createRules(C);

/** A 12 × 8 lot of open ground, with a room in the middle so Fences can go anywhere else. */
const OPEN = ['............', ...Array.from({ length: 7 }, () => '............')];

/** A run of `seed` on the lot `rows`, with these pieces already standing. */
function runOn(
  rows: readonly string[],
  placements: readonly Placement[] = [['bedroom', 5, 3]],
  seed = 'side',
  rr: Rules = r,
  mode: 'standard' | 'firstJob' = 'standard',
): RunState {
  const s = rr.newRun({ ...setup(seed), mode });
  return { ...s, house: houseFrom(rr.content, rows, placements) };
}

/** Passes, leaves shops, until `stop`; returns the events on the way and the actions taken. */
function playUntil(s: RunState, stop: (s: RunState) => boolean, rr: Rules = r, max = 100) {
  const events: GameEvent[] = [];
  const actions: Action[] = [];
  for (let k = 0; k < max && !stop(s) && s.screen !== 'won' && s.screen !== 'lost'; k++) {
    const a: Action = s.screen === 'shop' ? { t: 'leaveShop' } : { t: 'pass' };
    const out = rr.apply(s, a);
    actions.push(a);
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events, actions };
}

const at =
  (phase: number, slot = 1) =>
  (s: RunState) =>
    s.screen === 'build' && s.phase === phase && s.slot === slot;

const asked = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { t: 'neighborAsked' }> => e.t === 'neighborAsked');
const resolved = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { t: 'neighborResolved' }> => e.t === 'neighborResolved',
  );

/** The side a run of `seed` tries first. */
const firstSide = (seed: string, phase = 2): NeighborSide =>
  stream(seed, `neighbor/${phase}`).pick(['left', 'right'] as const);
const other = (side: NeighborSide): NeighborSide => (side === 'left' ? 'right' : 'left');

/** A Fence pack down column x, from row y, `n` tiles long. */
const fenceDown = (x: number, y: number, n: number): Placement => [
  'fence',
  x,
  y,
  0,
  Array.from({ length: n }, () => '#'),
];

/** The column a side's strip starts at on a lot `w` wide (depth 2). */
const col = (side: NeighborSide, w = 12) => (side === 'left' ? 0 : w - 2);

/** A Fence from Your goods, laid down the strip on `side` from row `y`, `n` tiles. */
function layFence(s: RunState, side: NeighborSide, y: number, n: number, rr: Rules = r): RunState {
  const withFence: RunState = { ...s, reserve: [...s.reserve, { id: 'fence', stock: true }] };
  const i = withFence.reserve.length - 1;
  const shape = Array.from({ length: n }, () => '#');
  const out = rr.apply(withFence, {
    t: 'place',
    from: 'reserve',
    i,
    x: col(side, s.house.lot.width),
    y,
    rot: 0,
    shape,
  });
  return out.state;
}

describe('the lot’s side strips (D-206)', () => {
  it('are the two columns along each side, every row, whatever stands there', () => {
    const house = houseFrom(C, OPEN, [['bedroom', 0, 0], fenceDown(11, 2, 3)]);
    const layout = layoutFor(C, house);
    const w = house.lot.width;
    for (let y = 0; y < house.lot.height; y++) {
      for (let x = 0; x < w; x++) {
        const bits = layout.regionBits[y * w + x]!;
        expect(!!(bits & REGION_BIT.leftSide), `${x},${y}`).toBe(x < 2);
        expect(!!(bits & REGION_BIT.rightSide), `${x},${y}`).toBe(x >= w - 2);
      }
    }
    // A Bedroom (2 × 2) in the corner is in the left strip, as the Fence is in the right one.
    expect(pieceIn(layout, 1, 'leftSide')).toBe(true);
    expect(pieceIn(layout, 2, 'rightSide')).toBe(true);
    expect(pieceIn(layout, 2, 'leftSide')).toBe(false);
    expect(sideStrip(house.lot, 'left', 2)).toEqual(
      Array.from({ length: 8 }, (_, y) => [y * w, y * w + 1]).flat(),
    );
    expect(sideStrip(house.lot, 'right', 1)).toEqual(
      Array.from({ length: 8 }, (_, y) => y * w + 11),
    );
  });

  it('follow the depth in balance.ts', () => {
    const C3 = asking({ depth: 3 });
    const layout = layoutFor(C3, houseFrom(C3, OPEN));
    const row = Array.from({ length: 12 }, (_, x) => layout.regionBits[x]!);
    expect(
      row
        .map((b) => (b & REGION_BIT.leftSide ? 'L' : b & REGION_BIT.rightSide ? 'R' : '.'))
        .join(''),
    ).toBe('LLL......RRR');
  });
});

describe('tiles of a piece in a region (D-206)', () => {
  const cond: HouseCondition = { tilesIn: { of: { piece: 'fence' }, region: 'leftSide', min: 5 } };
  const ctx = { phase: 0 };
  const noun = () => 'pieces';

  it('counts every tile inside, across pieces, and none outside', () => {
    // A Fence of 3 down the strip, and one of 4 across it (2 of its tiles inside), a Lawn too.
    const house = houseFrom(C, OPEN, [
      fenceDown(0, 0, 3),
      ['fence', 0, 5, 0, ['####']],
      ['lawn', 0, 6],
    ]);
    const layout = layoutFor(C, house);
    expect(tilesInRegion(C, layout, { piece: 'fence' }, 'leftSide')).toBe(5);
    expect(tilesInRegion(C, layout, { piece: 'fence' }, 'rightSide')).toBe(0);
    expect(meetsHouse(C, layout, cond, ctx)).toBe(true);
    expect(progressOf(C, layout, cond, ctx, noun)).toEqual([{ text: '5 of 5 tiles', ok: true }]);
    const short = layoutFor(C, houseFrom(C, OPEN, [fenceDown(1, 0, 3)]));
    expect(meetsHouse(C, short, cond, ctx)).toBe(false);
    expect(progressOf(C, short, cond, ctx, noun)).toEqual([{ text: '3 of 5 tiles', ok: false }]);
  });

  it('reads as words', () => {
    expect(houseConditionText(C, cond)).toBe('5 tiles of Fence along the lot’s left side');
    expect(
      houseConditionText(C, { tilesIn: { of: { piece: 'fence' }, region: 'rightSide', min: 1 } }),
    ).toBe('a tile of Fence along the lot’s right side');
  });
});

describe('the neighbor’s ask (D-206)', () => {
  it('comes once, as its phase’s first week starts, from the side the seed picks', () => {
    for (const seed of ['side', 'oak', 'elm', 'ash']) {
      const { state, events } = playUntil(runOn(OPEN, undefined, seed), at(2));
      const side = firstSide(seed);
      expect(asked(events), seed).toEqual([
        { t: 'neighborAsked', side, phase: 2, tiles: 5, have: 0 },
      ]);
      expect(state.neighbor).toEqual({ side, phase: 2, tiles: 5 });
      // Before the week's hand is drawn.
      const k = events.findIndex((e) => e.t === 'neighborAsked');
      expect(events.slice(k + 1).map((e) => e.t)).toEqual(['handDrawn']);
      // And no other ask, to the run's end.
      const rest = playUntil(state, () => false);
      expect(asked(rest.events)).toEqual([]);
    }
  });

  it('is off with no tiles, and never comes in a first job', () => {
    const off = createRules(asking({ tiles: 0 }));
    const none = playUntil(runOn(OPEN, undefined, 'side', off), () => false, off);
    expect(asked(none.events)).toEqual([]);
    expect(none.state.neighbor).toBeUndefined();
    const first = playUntil(runOn(OPEN, undefined, 'side', r, 'firstJob'), () => false);
    expect(asked(first.events)).toEqual([]);
    expect(first.state.neighbor).toBeUndefined();
  });

  describe('passes over a side', () => {
    const seed = 'side';
    const side = firstSide(seed);
    const x = col(side);
    /** OPEN with `ch` at (cx, cy). */
    const mark = (ch: string, cx: number, cy: number) =>
      OPEN.map((row, y) => (y === cy ? row.slice(0, cx) + ch + row.slice(cx + 1) : row));
    const sideTaken = (rows: readonly string[], placements?: readonly Placement[]) =>
      asked(playUntil(runOn(rows, placements, seed), at(2)).events).map((e) => e.side);

    it('with water in its strip: a pond, a creek or a lake', () => {
      expect(sideTaken(OPEN)).toEqual([side]);
      for (const ch of ['P', 'C', 'L']) {
        expect(sideTaken(mark(ch, x + 1, 4)), ch).toEqual([other(side)]);
      }
      // Water just past the strip doesn't count.
      expect(sideTaken(mark('P', side === 'left' ? 2 : 9, 4))).toEqual([side]);
    });

    it('with a kept Tree in its strip (Old Woods), but not a Tree it would clear', () => {
      const rows = mark('T', x, 2);
      expect(sideTaken(rows)).toEqual([side]);
      const s = runOn(rows, undefined, seed);
      const woods: RunState = {
        ...s,
        house: { ...s.house, lot: { ...s.house.lot, kind: 'oldWoods' } },
      };
      expect(asked(playUntil(woods, at(2)).events).map((e) => e.side)).toEqual([other(side)]);
    });

    it('met already', () => {
      expect(sideTaken(OPEN, [['bedroom', 5, 3], fenceDown(x, 1, 5)])).toEqual([other(side)]);
      // Short of it, it asks for the rest, and says what's there.
      const e = asked(
        playUntil(runOn(OPEN, [['bedroom', 5, 3], fenceDown(x, 1, 4)], seed), at(2)).events,
      );
      expect(e).toEqual([{ t: 'neighborAsked', side, phase: 2, tiles: 5, have: 4 }]);
    });

    it('without room in one group for what’s missing', () => {
      // Boulders across the strip at rows 2 and 5: groups of 4, 4 and 4 tiles.
      const rows = OPEN.map((row, y) =>
        y === 2 || y === 5 ? row.slice(0, x) + 'BB' + row.slice(x + 2) : row,
      );
      expect(sideTaken(rows)).toEqual([other(side)]);
      // A Fence of 1 already there needs only 4 more: a group of 4 holds them.
      expect(sideTaken(rows, [['bedroom', 5, 3], fenceDown(x, 0, 1)])).toEqual([side]);
      // Pieces fill a strip as Boulders do.
      expect(
        sideTaken(OPEN, [
          ['bedroom', 5, 3],
          ['bedroom', x, 1],
          ['bedroom', x, 5],
        ]),
      ).toEqual([other(side)]);
    });

    it('both: no ask', () => {
      const wet = OPEN.map((row, y) => (y === 4 ? 'C' + row.slice(1, 11) + 'C' : row));
      const { state, events } = playUntil(runOn(wet, undefined, seed), () => false);
      expect(asked(events)).toEqual([]);
      expect(state.neighbor).toBeUndefined();
    });
  });

  it('pays its reward at the milestone, once, with enough tiles there', () => {
    const seed = 'side';
    const side = firstSide(seed);
    const { state: s2 } = playUntil(runOn(OPEN, undefined, seed), at(2));
    expect(s2.overtimeLeft).toBe(2);
    // Three tiles in week 1, two more in week 2: from Your goods, so the week goes on (D-163).
    const s3 = layFence(layFence(s2, side, 0, 3), side, 4, 2);
    expect(r.neighbor(s3)).toMatchObject({ have: 5, met: true });
    const { state, events } = playUntil(s3, at(3));
    const e = resolved(events);
    expect(e).toEqual([
      {
        t: 'neighborResolved',
        side,
        phase: 2,
        tiles: 5,
        have: 5,
        result: 'met',
        reward: { overtime: 1 },
      },
    ]);
    // After the milestone, and its change orders.
    expect(events.findIndex((x) => x.t === 'milestone')).toBeLessThan(events.indexOf(e[0]!));
    expect(state.overtimeLeft).toBe(3);
    expect(state.neighbor).toEqual({ side, phase: 2, tiles: 5, result: 'met' });
    expect(r.neighbor(state)).toMatchObject({ result: 'met', have: 5 });
    // Never again.
    const rest = playUntil(state, () => false);
    expect(resolved(rest.events)).toEqual([]);
    expect(rest.state.overtimeLeft).toBe(3);
  });

  it('counts only tiles in the strip when the milestone comes', () => {
    const seed = 'side';
    const side = firstSide(seed);
    const { state: s2 } = playUntil(runOn(OPEN, undefined, seed), at(2));
    // Four tiles: one short.
    const { state, events } = playUntil(layFence(s2, side, 0, 4), at(3));
    expect(resolved(events)).toEqual([
      { t: 'neighborResolved', side, phase: 2, tiles: 5, have: 4, result: 'missed' },
    ]);
    expect(state.overtimeLeft).toBe(2);
    expect(state.neighbor?.result).toBe('missed');
  });

  it('runs through its phase’s overtime weeks, and a milestone missed leaves it running', () => {
    // Targets the third phase can't meet: its overtime weeks are spent, then the run is lost.
    const rr = createRules(asking({}, [0, 0, 1e9, 1e9]));
    const seed = 'side';
    const side = firstSide(seed);
    const { state: s2 } = playUntil(runOn(OPEN, undefined, seed, rr), at(2), rr);
    const met = layFence(s2, side, 0, 5, rr);
    const { state, events } = playUntil(met, () => false, rr);
    expect(state.screen).toBe('lost');
    expect(events.filter((e) => e.t === 'overtimeUsed')).toHaveLength(2);
    expect(resolved(events)).toEqual([]);
    expect(state.neighbor).toEqual({ side, phase: 2, tiles: 5 });
    // With the target met in an overtime week, it resolves at that milestone.
    const late = createRules(asking({}, [0, 0, 1, 0]));
    const { state: t2 } = playUntil(runOn(OPEN, undefined, seed, late), at(2), late);
    const forced: RunState = { ...layFence(t2, side, 0, 5, late), forcedMiss: 2 };
    const out = playUntil(forced, at(3), late);
    expect(out.events.some((e) => e.t === 'overtimeUsed')).toBe(true);
    expect(resolved(out.events).map((e) => e.result)).toEqual(['met']);
    // One overtime week spent, one given back.
    expect(out.state.overtimeLeft).toBe(2);
  });

  it('shows its count with a play looked at, and its strip', () => {
    const seed = 'side';
    const side = firstSide(seed);
    const { state: s2 } = playUntil(runOn(OPEN, undefined, seed), at(2));
    const s = { ...s2, reserve: [...s2.reserve, { id: 'fence' as const, stock: true as const }] };
    const play: Action = {
      t: 'place',
      from: 'reserve',
      i: s.reserve.length - 1,
      x: col(side),
      y: 1,
      rot: 0,
      shape: ['#', '#', '#'],
    };
    expect(r.neighbor(s)).toEqual({
      side,
      phase: 2,
      piece: 'fence',
      tiles: 5,
      have: 0,
      met: false,
      reward: { overtime: 1 },
      strip: sideStrip(s.house.lot, side, 2),
    });
    expect(r.neighbor(s, play as never)?.have).toBe(3);
    expect(r.neighbor(runOn(OPEN))).toBeNull();
  });

  it('names the strip in Inspect only while it runs, on its side', () => {
    const seed = 'side';
    const side = firstSide(seed);
    const x = col(side);
    const before = runOn(OPEN, undefined, seed);
    expect(r.describeTile(before, x, 0)?.regions).not.toContain(`${side}Side`);
    const { state } = playUntil(before, at(2));
    expect(r.describeTile(state, x, 0)?.regions).toContain(`${side}Side`);
    expect(r.describeTile(state, col(other(side)), 0)?.regions).not.toContain(`${other(side)}Side`);
    const done = playUntil(state, at(3)).state;
    expect(r.describeTile(done, x, 0)?.regions).not.toContain(`${side}Side`);
  });

  it('replays from a run code: it takes no action, so a code is as it was', () => {
    const start = r.newRun(setup('side'));
    const { state: s2, actions } = playUntil(start, at(2));
    expect(s2.neighbor).toBeDefined();
    const code = encodeRunCode({
      build: 'test',
      contentHash: contentHash(C),
      setup: start.setup,
      actions,
    });
    const decoded = decodeRunCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const replayed = r.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(s2);
  });
});
