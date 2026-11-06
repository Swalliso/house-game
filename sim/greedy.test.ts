// The greedy bot on the real content (§8), with fixed seeds: what its numbers rest on. Its
// shortlist must not lean on list order (legalPlacements runs from the back row, and ranking by
// position built every house against the back of the lot); it must find the week's best play
// nearly always (recall against scoring every legal play); it must see a Fence that closes a
// yard, which the cheap estimate can't value; and its variants must complete early when told to,
// and play the same seed alike until they do.

import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  rules,
  stream,
  type Action,
  type PlaceAction,
  type RunState,
} from '../src/rules/index.ts';
import { emptyRows, houseFrom } from '../src/rules/testing.ts';
import { rankPlays, shortlist, TOP_K } from './policies/greedy.ts';
import { greedy, makeGreedy, POLICIES, type Policy } from './policies/index.ts';
import { simulateRun } from './simulate.ts';

const newRun = (seed: string) =>
  rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' });
const sameSpot = (a: PlaceAction) => (b: PlaceAction) =>
  a.from === b.from && a.i === b.i && a.x === b.x && a.y === b.y && a.rot === b.rot;
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

/** The states a policy's run passes through at the start of these weeks' builds. */
function statesAt(seed: string, policy: Policy, weeks: readonly number[]): RunState[] {
  const { actions } = simulateRun(rules, seed, policy, {
    probePhase: null,
    maxWeeks: Math.max(...weeks),
  });
  const out: RunState[] = [];
  let s = newRun(seed);
  for (const a of actions) {
    if (s.screen === 'build' && weeks.includes(s.week) && !out.some((o) => o.week === s.week)) {
      out.push(s);
    }
    s = rules.apply(s, a).state;
  }
  return out;
}

describe('the greedy bot', () => {
  it('breaks estimate ties by a seeded key, not by list order', () => {
    const h = CONTENT.balance.lot.height;
    const rows: number[] = [];
    for (let k = 0; k < 4; k++) {
      const seed = `tiebreak-${k}`;
      const s = newRun(seed);
      const plays = rules.legalPlacements(s);
      const salt = stream(seed, 'tiebreak').u32();
      const list = shortlist(rules, s, plays, salt);
      // The same plays in any order give the same shortlist.
      const reversed = shortlist(rules, s, [...plays].reverse(), salt);
      expect(reversed).toEqual(list);
      rows.push(...list.map((p) => p.y));
    }
    // Ranked by position, week 1's shortlist sat in the back rows (median row 0).
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThanOrEqual(h / 2);
    expect(median(rows)).toBeGreaterThanOrEqual(h / 4);
    expect(median(rows)).toBeLessThanOrEqual((3 * h) / 4);
  });

  it('finds the week’s best play nearly always', () => {
    // 5 seeds × weeks 4, 10, 16, 22 (20 states, ~12,800 legal plays) when this was written: the
    // shortlist's best exact total matched the best over every legal play in 20 of 20, losing
    // 0 Wow of 3,725. (Before the yard and link hints and an uncapped set hint, a 54-state
    // sample matched in 93% and lost 2.7%.)
    let states = 0;
    let hits = 0;
    let lost = 0;
    let bestSum = 0;
    for (let k = 0; k < 5; k++) {
      const seed = `recall-${k}`;
      for (const s of statesAt(seed, greedy, [4, 10, 16, 22])) {
        const plays = rules.legalPlacements(s);
        if (plays.length === 0) continue;
        let best = -Infinity;
        for (const p of plays) best = Math.max(best, rules.scoreOnly(s, p));
        let found = -Infinity;
        const salt = stream(seed, `recall/${s.week}`).u32();
        for (const p of shortlist(rules, s, plays, salt)) {
          found = Math.max(found, rules.scoreOnly(s, p));
        }
        states++;
        if (found === best) hits++;
        lost += best - found;
        bestSum += best;
      }
    }
    // Runs that end early leave fewer states; 12 of the 20 is still a fair sample.
    expect(states).toBeGreaterThanOrEqual(12);
    expect(hits / states).toBeGreaterThanOrEqual(0.85);
    expect(lost).toBeLessThanOrEqual(0.02 * bestSum);
  }, 20_000);

  it('scores a Fence that closes a fenced yard, though the estimate can’t see it', () => {
    // Two Bedrooms on rows 3–4 of an empty lot; the yard behind them (columns 0–3, rows 0–2,
    // 12 tiles) is open on its right. One Fence, upright in column 4, closes it.
    const s: RunState = {
      ...newRun('fence'),
      house: houseFrom(CONTENT, emptyRows(24, 24), [
        ['bedroom', 0, 3],
        ['bedroom', 2, 3],
      ]),
      hand: (['fence', 'flowerBed', 'lawn'] as const).map((id) => ({ kind: 'piece', id })),
    };
    const closing: PlaceAction = { t: 'place', from: 'hand', i: 0, x: 4, y: 0, rot: 1 };
    const plays = rules.legalPlacements(s);
    expect(plays.filter((p) => rules.estimatePlay(s, p).yardHint)).toEqual([closing]);
    const salt = stream('fence', 'shortlist').u32();
    // Ranked near the bottom by the estimate, it's on the shortlist for its hint alone.
    const rank = rankPlays(rules, s, plays, salt).findIndex((r) => sameSpot(closing)(r.play));
    expect(rank).toBeGreaterThan(TOP_K);
    expect(shortlist(rules, s, plays, salt).some(sameSpot(closing))).toBe(true);
    // And it's the week's best play (the Fence's enclosure bonus), so greedy builds it.
    expect(greedy.act(rules, s, stream('fence', 'act'))).toEqual(closing);
  });

  it('completes milestones early only when its early mode says so', () => {
    const W = CONTENT.balance.weeksPerPhase;
    const early = (policy: Policy, seed: string) => {
      const run = simulateRun(rules, seed, policy, { probePhase: null, maxWeeks: 10 });
      return { ...run, early: run.record.milestones.filter((m) => m.result === 'early').length };
    };
    let always = 0;
    let last = 0;
    for (let k = 0; k < 3; k++) {
      const seed = `early-${k}`;
      const never = early(greedy, seed);
      expect(never.early).toBe(0);
      expect(never.actions.some((a) => a.t === 'completeEarly')).toBe(false);
      const a = early(makeGreedy({ early: 'always' }), seed);
      always += a.early;
      // Same name, same streams: it plays like plain greedy until it first completes early.
      const first = a.actions.findIndex((x) => x.t === 'completeEarly');
      if (first >= 0) expect(a.actions.slice(0, first)).toEqual(never.actions.slice(0, first));
      // 'last' completes early only in a phase's last week, saving exactly that week.
      const l = early(makeGreedy({ early: 'last' }), seed);
      last += l.early;
      let s = newRun(seed);
      for (const x of l.actions) {
        if (x.t === 'completeEarly') {
          expect(s.slot).toBe(W);
          expect(rules.canCompleteEarly(s).weeksSaved).toBe(1);
        }
        s = rules.apply(s, x).state;
      }
    }
    expect(always).toBeGreaterThanOrEqual(1);
    expect(last).toBeGreaterThanOrEqual(1);
  }, 20_000);

  it('buys the strike service only with strikes fixed', () => {
    const strikes = (policy: Policy, seed: string): Action[] =>
      simulateRun(rules, seed, policy, { probePhase: null, maxWeeks: 13 }).actions.filter(
        (a) => a.t === 'buy' && a.strike !== undefined,
      );
    let fixed = 0;
    for (let k = 0; k < 2; k++) {
      expect(strikes(greedy, `strike-${k}`)).toEqual([]);
      fixed += strikes(makeGreedy({ strikes: 'fixed' }), `strike-${k}`).length;
    }
    expect(fixed).toBeGreaterThanOrEqual(1);
  }, 20_000);

  it('labels its variants for reports and keeps one name for their streams', () => {
    expect(POLICIES.greedy).toBe(greedy);
    expect(greedy.label).toBe('greedy');
    const v = makeGreedy({ early: 'always', strikes: 'fixed' });
    expect(v.name).toBe('greedy');
    expect(v.label).toBe('greedy · early always · strikes fixed');
    expect(Object.keys(POLICIES).sort()).toEqual(['greedy', 'novice', 'random']);
  });
});
