// D-206: the neighbor's ask on the board, the part that decides (neighbor-ask.ts), and the
// overtime weeks the top bar and the household's lines count once a neighbor has given one
// (hud/household.ts overtimeUsed).

import { describe, expect, it } from 'vitest';
import { rules, type Action, type PlaceAction, type RunState } from '../../rules/index.ts';
import { overtimeUsed } from '../hud/household.ts';
import { CELL, spritePos } from '../sprites.ts';
import { WALKERS } from './crowd.ts';
import { askCount, neighborFeet, neighborFigure, overHead, stripCells } from './neighbor-ask.ts';
import { STREET } from './neighbors.ts';

describe('the neighbor on the board (D-206)', () => {
  const lot = { width: 24, height: 24 };

  it('stands in the gap beside the lot on their side, by its front row', () => {
    const left = neighborFeet(lot, 'left');
    const right = neighborFeet(lot, 'right');
    const w = spritePos(neighborFigure('oak')).w;
    // Past the property line, and short of the house beside the lot.
    expect(left.x + w / 2).toBeLessThanOrEqual(0);
    expect(left.x - w / 2).toBeGreaterThanOrEqual(-STREET.beside);
    expect(right.x - w / 2).toBeGreaterThanOrEqual(lot.width * CELL);
    expect(right.x + w / 2).toBeLessThanOrEqual(lot.width * CELL + STREET.beside);
    // Beside the front row, not on the street.
    expect(left.y).toBe(right.y);
    expect(left.y).toBeGreaterThan((lot.height - 1) * CELL);
    expect(left.y).toBeLessThan(lot.height * CELL);
    // Their bubble points at the top of their head.
    expect(overHead(left)).toEqual({ x: left.x, y: left.y - 27 });
  });

  it('is one of the street’s walkers, the same one for a seed', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, k) => neighborFigure(`seed-${k}`)));
    expect([...seen].every((id) => WALKERS.includes(id))).toBe(true);
    expect(seen.size).toBe(WALKERS.length);
    expect(neighborFigure('oak')).toBe(neighborFigure('oak'));
  });

  it('counts the tiles up to the ask, and which way a placement looked at moves it', () => {
    expect(askCount(0, 5)).toEqual({ text: '0/5', met: false, change: null });
    expect(askCount(3, 5, 0)).toEqual({ text: '3/5', met: false, change: 'up' });
    expect(askCount(7, 5, 4)).toEqual({ text: '5/5', met: true, change: 'up' });
    expect(askCount(2, 5, 4)).toEqual({ text: '2/5', met: false, change: 'down' });
    // Past the ask, more tiles change nothing it shows.
    expect(askCount(8, 5, 6)).toEqual({ text: '5/5', met: true, change: null });
  });

  it('shades the strip’s cells', () => {
    expect(stripCells([0, 1, 24, 25, 22, 23], 24)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 22, y: 0 },
      { x: 23, y: 0 },
    ]);
  });
});

describe('overtime weeks used, after a neighbor gave one (D-206)', () => {
  /** Passes on, meeting each target by a cheat (a forced miss still misses), until `stop`. */
  function playUntil(from: RunState, stop: (s: RunState) => boolean): RunState {
    let s = from;
    for (let k = 0; k < 400 && !stop(s) && s.screen !== 'won' && s.screen !== 'lost'; k++) {
      const a: Action =
        s.screen === 'shop'
          ? s.offers?.pick
            ? { t: 'pick', i: -1 }
            : { t: 'leaveShop' }
          : s.screen === 'changeOrder'
            ? { t: 'answerChangeOrder', i: 0 }
            : s.score < rules.target(s)
              ? { t: 'debug', op: 'addScore', amount: rules.target(s) }
              : { t: 'pass' };
      s = rules.apply(s, a).state;
    }
    return s;
  }
  const firstWeek = (phase: number) => (s: RunState) =>
    s.screen === 'build' && s.phase === phase && s.slot === 1 && s.overtimeWeek === 0;

  it('counts the weeks spent, whatever is left', () => {
    // Framing misses once (an overtime week spent), then Roofing's ask is met: a week back.
    const start = rules.newRun({
      seed: 'oak',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    const framing = playUntil(start, firstWeek(2));
    const roofing = playUntil({ ...framing, forcedMiss: 2 }, firstWeek(3));
    expect(roofing.overtimeLeft).toBe(1);
    expect(overtimeUsed(roofing)).toBe(1);
    expect(roofing.neighbor?.side).toBe('left');
    const i = roofing.reserve.findIndex((c) => c.id === 'fence');
    const lay: PlaceAction = {
      t: 'place',
      from: 'reserve',
      i,
      x: 0,
      y: 0,
      rot: 0,
      shape: ['#', '#', '#', '#', '#'],
    };
    let at = roofing;
    for (let y = 0; y + 5 <= at.house.lot.height && !rules.checkPlay(at, lay).legal; y++) {
      lay.y = y;
    }
    at = rules.apply(roofing, lay).state;
    const drywall = playUntil(at, firstWeek(4));
    expect(drywall.neighbor?.result).toBe('met');
    // Two at the start, one spent, one given: two left, and still one used.
    expect(drywall.overtimeLeft).toBe(2);
    expect(overtimeUsed(drywall)).toBe(1);
  });
});
