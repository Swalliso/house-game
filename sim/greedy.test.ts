// The greedy bot on the real content (§8), with fixed seeds: what its numbers rest on. Its
// shortlist must not lean on list order (legalPlacements runs from the back row, and ranking by
// position built every house against the back of the lot); it must find the week's best play
// nearly always (recall against scoring every legal play); it must keep a checklist line its
// best-looking spots would break, when keeping it is worth more (its estimate counts the lines
// counts decide, exactly); it must see a Fence that closes a yard, which the cheap estimate
// can't value, and a Driveway that reaches a Garage, which the rules' suggested shapes don't
// list (D-140); and its variants must complete early when told to, and play the same seed alike
// until they do.

import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  createRules,
  rules,
  stream,
  type Action,
  type ClientId,
  type PieceId,
  type PlaceAction,
  type RunState,
} from '../src/rules/index.ts';
import { followedLines } from '../src/rules/estimate.ts';
import { computeLayout } from '../src/rules/layout.ts';
import { emptyRows, houseFrom, type Placement } from '../src/rules/testing.ts';
import { drivePlans, unreached } from './drive.ts';
import { fencePlans, openGround } from './enclosure.ts';
import { rankPlays, shortlist, shortlistOf, TOP_K, withoutLookalikes } from './policies/greedy.ts';
import { greedy, makeGreedy, POLICIES, type Policy } from './policies/index.ts';
import { STRIKE_ORDER } from './policies/shop.ts';
import { simulateRun } from './simulate.ts';

const newRun = (seed: string, clientId: ClientId = 'hendersons') =>
  rules.newRun({ seed, clientId, crewId: 'generalContractor', mode: 'standard' });
const sameSpot = (a: PlaceAction) => (b: PlaceAction) =>
  a.from === b.from &&
  a.i === b.i &&
  a.x === b.x &&
  a.y === b.y &&
  a.rot === b.rot &&
  (a.shape ?? []).join('/') === (b.shape ?? []).join('/');
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

/** The states a policy's run passes through at the start of these weeks' builds. */
function statesAt(
  seed: string,
  policy: Policy,
  weeks: readonly number[],
  clientId: ClientId = 'hendersons',
): RunState[] {
  const { actions } = simulateRun(rules, seed, policy, {
    probePhase: null,
    maxWeeks: Math.max(...weeks),
    clientId,
  });
  const out: RunState[] = [];
  let s = newRun(seed, clientId);
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
    // D-160: with the standing stock's Hallway and Fence in the reserve from Foundation on,
    // these 5 seeds matched in 15 of 18 states, losing 0.5% (an L-Kitchen's 20 hinted plays
    // and the stock Hallway's 4 took the hint cap from a Closet's Suite). On 20 seeds it was 63
    // of 71 (88.7%, 0.34% lost) against 66 of 73 before (90.4%, 0.19%): noise, not a slip.
    // The stock's Fence also lists its pack's shapes all over the yard: of the 18 states'
    // 57,336 legal plays, 31,860 are its (24,272 plays in all before). Scoring them all took
    // 20 s on a quiet laptop (8.6 s before), and CI took 18–25 s before, hence the timeout.
    // D-161: the same shortlist, from far fewer estimates, and a faster layout: 14 s against
    // D-160's 21 s, back to back. Every legal play is still scored, so the timeout stays.
    expect(states).toBeGreaterThanOrEqual(12);
    expect(hits / states).toBeGreaterThanOrEqual(0.8);
    expect(lost).toBeLessThanOrEqual(0.02 * bestSum);
  }, 120_000); // ~57,000 plays scored exactly: about a minute on a slow CI runner

  it('keeps A compact house when the spots a card likes best would break it', () => {
    // An 8 × 4 house at 2:1 (two Living Rooms, the Kitchen, the Dining Room, and Hallways)
    // with Trees down both sides. A Bedroom earns most beside the Trees, but there the box
    // grows to 10 × 4, and A compact house's +0.25 Mult is worth more than the Trees. A
    // corner, or a row above or below, keeps it. The Hallways only link here, as before D-114,
    // so nothing but the Trees pulls; with their pay, see the end.
    const linkOnly = (id: 'hallway' | 'longHallway') => ({
      ...CONTENT.pieces[id],
      effects: [{ kind: 'link' as const }],
    });
    const pieces = {
      ...CONTENT.pieces,
      hallway: linkOnly('hallway'),
      longHallway: linkOnly('longHallway'),
    };
    const r = createRules({ ...CONTENT, pieces });
    const rows = emptyRows(16, 12).map((row, y) =>
      y >= 4 && y <= 7 ? `.T${'.'.repeat(12)}T.` : row,
    );
    const s: RunState = {
      ...newRun('roof'),
      house: houseFrom(CONTENT, rows, [
        ['livingRoom', 4, 4],
        ['kitchen', 6, 4],
        ['diningRoom', 8, 4],
        ['livingRoom', 10, 4],
        ['hallway', 6, 6],
        ['hallway', 8, 6],
        ['longHallway', 4, 7],
        ['longHallway', 7, 7],
        ['hallway', 10, 7],
      ]),
      hand: (['bedroom', 'bedroom', 'bedroom'] as const).map((id) => ({ kind: 'piece', id })),
      // The hand's Bedrooms alone: the standing stock waits from week 1 (D-162).
      reserve: [],
    };
    expect(r.checklist(s).find((l) => l.id === 'underOneRoof')?.met).toBe(true);
    const keeps = (p: PlaceAction) => !r.preview(s, p).specsLost.includes('underOneRoof');
    const plays = r.legalPlacements(s);
    let best = -Infinity;
    for (const p of plays) best = Math.max(best, r.scoreOnly(s, p));
    // Ranked as if there were no checklist, the shortlist is all Bedrooms by the Trees.
    const hendersons = { ...CONTENT.clients.hendersons, specs: [] };
    const blind = createRules({ ...CONTENT, pieces, clients: { ...CONTENT.clients, hendersons } });
    const salt = stream('roof', 'shortlist').u32();
    const blindList = shortlist(blind, s, plays, salt);
    expect(blindList.some(keeps)).toBe(false);
    expect(Math.max(...blindList.map((p) => r.scoreOnly(s, p)))).toBeLessThan(best);
    // Seeing the line, the estimate ranks a keeper first, and greedy builds the week's best.
    expect(keeps(rankPlays(r, s, plays, salt)[0]!.play)).toBe(true);
    const act = greedy.act(r, s, stream('roof', 'act'));
    expect(act).toMatchObject({ t: 'place', from: 'hand' });
    expect(keeps(act as PlaceAction)).toBe(true);
    expect(r.scoreOnly(s, act as PlaceAction)).toBe(best);
    // With the pay, a Bedroom under the hall row keeps the line and pays the Hallway it
    // touches. The estimate sees the Hallway's +2, so greedy builds that, the week's best.
    const paid = greedy.act(rules, s, stream('roof', 'act')) as PlaceAction;
    const paidBest = Math.max(...plays.map((p) => rules.scoreOnly(s, p)));
    expect(keeps(paid)).toBe(true);
    expect(paid.y).toBe(8);
    expect(rules.scoreOnly(s, paid)).toBe(paidBest);
  });

  it('sees the real checklists’ count, ratio, outline, and variety lines flip exactly', () => {
    // Every client, three weeks of a greedy run: the lines a placement turns on and off, as
    // the estimate counts them, are the exact tally's, on the lines it follows. Every client
    // has the house rules counts decide; Cozy (every room touching two) is left out.
    const RULES = ['roomForEveryone', 'bathrooms', 'oneKitchen', 'livingRooms', 'underOneRoof'];
    let checked = 0;
    let on = 0;
    let off = 0;
    for (const clientId of Object.keys(CONTENT.clients) as ClientId[]) {
      const { specs } = CONTENT.clients[clientId];
      for (const s of statesAt(`flips-${clientId}`, greedy, [3, 9, 15], clientId)) {
        const ctx = { specs, phase: s.phase };
        const ids = followedLines(CONTENT, computeLayout(CONTENT, s.house), ctx);
        expect(ids).toEqual(expect.arrayContaining([...RULES, 'tidyYard']));
        expect(ids).not.toContain('cozy');
        // Every fifth placement (about 3,700 in all when this was written, 40 flipping a line).
        const plays = rules.legalPlacements(s);
        for (let k = 0; k < plays.length; k += 5) {
          const p = plays[k]!;
          const { specsGained, specsLost } = rules.preview(s, p);
          const gained = specsGained.filter((id) => ids.includes(id)).length;
          const lost = specsLost.filter((id) => ids.includes(id)).length;
          expect(rules.estimatePlay(s, p).specFlips).toBe(gained - lost);
          checked++;
          on += gained;
          off += lost;
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
    expect(on).toBeGreaterThan(5);
    expect(off).toBeGreaterThan(5);
  }, 30_000);

  it('builds a Fence pack that closes a fenced yard, though the estimate can’t see it', () => {
    // Two Bedrooms on rows 3–4 of an empty lot; the yard behind them (columns 0–3, rows 0–2,
    // 12 tiles) is open on its right. A Fence pack of 3 tiles up column 4 closes it (D-106).
    const s: RunState = {
      ...newRun('fence'),
      house: houseFrom(CONTENT, emptyRows(24, 24), [
        ['bedroom', 0, 3],
        ['bedroom', 2, 3],
      ]),
      hand: (['fence', 'flowerBed', 'lawn'] as const).map((id) => ({ kind: 'piece', id })),
      // The hand's Fence alone: the standing stock waits from week 1 (D-162), and it's free
      // (D-163), so greedy would build it first.
      reserve: [],
    };
    // The rules list the pack's suggested shapes: the upright 1×4 in column 4 closes the yard,
    // and the estimate flags it; ranked near the bottom, it's on the shortlist for its hint.
    const upright: PlaceAction = {
      t: 'place',
      from: 'hand',
      i: 0,
      x: 4,
      y: 0,
      rot: 0,
      shape: ['#', '#', '#', '#'],
    };
    const plays = rules.legalPlacements(s);
    expect(plays.some(sameSpot(upright))).toBe(true);
    expect(rules.estimatePlay(s, upright).yardHint).toBe(true);
    const salt = stream('fence', 'shortlist').u32();
    const rank = rankPlays(rules, s, plays, salt).findIndex((r) => sameSpot(upright)(r.play));
    expect(rank).toBeGreaterThan(TOP_K);
    expect(shortlist(rules, s, plays, salt).some(sameSpot(upright))).toBe(true);
    // The fence planner finds the shortest run that closes it: 3 tiles up column 4.
    expect(fencePlans(rules, s, 'hand', 0)[0]).toEqual({
      t: 'place',
      from: 'hand',
      i: 0,
      x: 4,
      y: 0,
      rot: 0,
      shape: ['#', '#', '#'],
    });
    // And a closing pack is the week's best play (the Fence's enclosure bonus), so greedy
    // builds one: the week after, the house has a fenced yard.
    const act = greedy.act(rules, s, stream('fence', 'act'));
    expect(act).toMatchObject({ t: 'place', from: 'hand', i: 0 });
    expect(rules.fencedYards(rules.apply(s, act).state)).toHaveLength(1);
  });

  it('ranks only the few open-ground Fence plays that key first, and shortlists the same (D-161)', () => {
    // The rules list a Fence pack's shapes all over the lot (most of a week's plays once the
    // stock keeps one in the reserve, D-160). Out in the open they all estimate alike, so the
    // bots rank just the first few by tie key; the shortlist must come out as if all were ranked.
    let ground = 0;
    let dropped = 0;
    for (const seed of ['lookalike-0', 'lookalike-1']) {
      for (const s of statesAt(seed, greedy, [6, 12, 18])) {
        const all = rules.legalPlacements(s);
        const mask = openGround(rules, s, all);
        const byCard = new Map<string, ReturnType<typeof rules.estimatePlay>>();
        all.forEach((p, n) => {
          if (!mask[n]) return;
          ground++;
          const est = rules.estimatePlay(s, p);
          const first = byCard.get(`${p.from}${p.i}`);
          if (first) expect(est).toEqual(first);
          else byCard.set(`${p.from}${p.i}`, est);
          expect(est.yardHint || est.setHint || est.specHint || est.sunHint).toBe(false);
        });
        const plays = all.filter((p) => !(p.shape?.length === 1 && p.shape[0] === '#'));
        const salt = stream(seed, `lookalike/${s.week}`).u32();
        const few = withoutLookalikes(rules, s, plays, salt, TOP_K);
        dropped += plays.length - few.length;
        expect(shortlist(rules, s, plays, salt)).toEqual(
          shortlistOf(rankPlays(rules, s, plays, salt)),
        );
        // And the shop bot's top 8 of every placement, single tiles too.
        const top8 = (list: readonly PlaceAction[]) =>
          rankPlays(rules, s, list, salt)
            .slice(0, 8)
            .map((r) => r.play);
        expect(top8(withoutLookalikes(rules, s, all, salt, 8))).toEqual(top8(all));
      }
    }
    expect(ground).toBeGreaterThan(1000);
    expect(dropped).toBeGreaterThan(1000);

    // A Fence that closes a yard is never open ground, though it touches no piece: here it
    // meets an old Fence only at a corner, and the lot's edge closes the rest. Two Bedrooms on
    // rows 3–4 and a Fence tile beside them at (4, 4); an upright 1×4 up column 5 shuts in
    // columns 0–4 above the house (16 tiles). The same 1×4 up column 7 is open ground.
    const s: RunState = {
      ...newRun('fence'),
      house: houseFrom(CONTENT, emptyRows(24, 24), [
        ['bedroom', 0, 3],
        ['bedroom', 2, 3],
        ['fence', 4, 4, 0, ['#']],
      ]),
      hand: (['fence', 'flowerBed', 'lawn'] as const).map((id) => ({ kind: 'piece', id })),
    };
    const upright = (x: number): PlaceAction => ({
      t: 'place',
      from: 'hand',
      i: 0,
      x,
      y: 0,
      rot: 0,
      shape: ['#', '#', '#', '#'],
    });
    expect(rules.estimatePlay(s, upright(5)).yardHint).toBe(true);
    expect(rules.estimatePlay(s, upright(7)).yardHint).toBe(false);
    expect([...openGround(rules, s, [upright(5), upright(7)])]).toEqual([0, 1]);
  });

  it('lays a Driveway pack to a Garage nothing reaches, though no suggested shape does (D-140)', () => {
    // A Bedroom on rows 12–13 of an empty 24 × 24 lot and a Garage under it, on rows 14–15: the
    // street is 8 rows below. The rules list the pack as a straight 3 or 5, which can't reach.
    const lot = emptyRows(24, 24);
    const hand = (['driveway', 'flowerBed', 'lawn'] as const).map((id) => ({
      kind: 'piece' as const,
      id,
    }));
    const s: RunState = {
      ...newRun('drive'),
      house: houseFrom(CONTENT, lot, [
        ['bedroom', 4, 12],
        ['garage', 4, 14],
      ]),
      hand,
      // The hand's Driveway alone: the standing stock waits from week 1 (D-162).
      reserve: [],
    };
    expect(unreached(rules, s, CONTENT.pieces.driveway).map((p) => p.defId)).toEqual(['garage']);
    const garage = () => rules.currentTally(s).pieces.find((p) => p.defId === 'garage')!;
    expect(garage().unmet).toBe('touching the street or a Driveway');
    const listed = rules.legalPlacements(s).filter((p) => p.i === 0);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((p) => rules.scoreOnly(s, p) === rules.scoreOnly(s, listed[0]!))).toBe(
      true,
    );
    // The planner's run: 8 tiles straight up from the street, under one of the Garage's columns.
    const plans = drivePlans(rules, s, 'hand', 0);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ reaches: true, run: 8, target: 2 });
    expect(plans[0]!.play).toMatchObject({
      y: 16,
      shape: ['#', '#', '#', '#', '#', '#', '#', '#'],
    });
    expect([4, 5]).toContain(plans[0]!.play.x);
    // It's the week's best play (the Garage's 5 and the Driveway's 1 + 3), so greedy lays it.
    const act = greedy.act(rules, s, stream('drive', 'act'));
    expect(act).toEqual(plans[0]!.play);
    const after = rules.apply(s, act).state;
    expect(unreached(rules, after, CONTENT.pieces.driveway)).toEqual([]);
    // Nothing to plan without a Garage that waits, or for another pack.
    expect(drivePlans(rules, after, 'hand', 0)).toEqual([]);
    const fence: RunState = { ...s, hand: [{ kind: 'piece', id: 'fence' }] };
    expect(drivePlans(rules, fence, 'hand', 0)).toEqual([]);
    expect(drivePlans(rules, s, 'hand', 1)).toEqual([]);
  });

  it('plans a longer drive in legs, around Trees and over the creek (D-140)', () => {
    // The Garage two rows further back (rows 12–13): 10 tiles to the street, more than a pack.
    const far: Placement[] = [
      ['bedroom', 4, 10],
      ['garage', 4, 12],
    ];
    const hand = [{ kind: 'piece' as const, id: 'driveway' as const }];
    const s: RunState = {
      ...newRun('drive'),
      house: houseFrom(CONTENT, emptyRows(24, 24), far),
      hand,
    };
    const [first] = drivePlans(rules, s, 'hand', 0);
    // The first leg: a full pack from the street end, which doesn't reach yet.
    expect(first).toMatchObject({ reaches: false, run: 10 });
    expect(first!.play).toMatchObject({ y: 16, shape: ['#', '#', '#', '#', '#', '#', '#', '#'] });
    expect(rules.checkPlay(s, first!.play).legal).toBe(true);
    // With that leg down, the next pack finishes the run from the Driveway's end.
    const leg: Placement = ['driveway', first!.play.x, 16, 0, first!.play.shape];
    const s2: RunState = { ...s, house: houseFrom(CONTENT, emptyRows(24, 24), [...far, leg]) };
    const [second] = drivePlans(rules, s2, 'hand', 0);
    expect(second).toMatchObject({ reaches: true, run: 2 });
    expect(second!.play).toMatchObject({ x: first!.play.x, y: 14, shape: ['#', '#'] });
    expect(unreached(rules, rules.apply(s2, second!.play).state, CONTENT.pieces.driveway)).toEqual(
      [],
    );

    // Trees under the Garage's two columns (row 19), with the Garage on rows 15–16: straight
    // through is 7 tiles and a Tree, around is 8 tiles of open ground. It goes around.
    const woods = emptyRows(24, 24).map((r, y) => (y === 19 ? `....TT${r.slice(6)}` : r));
    const near: Placement[] = [
      ['bedroom', 4, 13],
      ['garage', 4, 15],
    ];
    const s3: RunState = { ...s, house: houseFrom(CONTENT, woods, near) };
    const [around] = drivePlans(rules, s3, 'hand', 0);
    expect(around).toMatchObject({ reaches: true, run: 8 });
    expect(rules.checkPlay(s3, around!.play).clearedTrees).toEqual([]);
    // A creek across the lot is no bar to a Driveway (its culvert); a pond across it is.
    const creek = emptyRows(24, 24).map((r, y) => (y === 20 ? 'C'.repeat(24) : r));
    const s4: RunState = { ...s, house: houseFrom(CONTENT, creek, near) };
    expect(drivePlans(rules, s4, 'hand', 0)[0]).toMatchObject({ reaches: true, run: 7 });
    const pond = emptyRows(24, 24).map((r, y) => (y === 20 ? 'P'.repeat(24) : r));
    const s5: RunState = { ...s, house: houseFrom(CONTENT, pond, near) };
    expect(drivePlans(rules, s5, 'hand', 0)).toEqual([]);
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

  it('strikes from the hand only with strikes fixed, by STRIKE_ORDER (D-157)', () => {
    const run = (policy: Policy, seed: string) =>
      simulateRun(rules, seed, policy, { probePhase: null, maxWeeks: 13 }).actions;
    let struck = 0;
    for (let k = 0; k < 2; k++) {
      const seed = `strike-${k}`;
      const plain = run(greedy, seed);
      expect(plain.some((a) => a.t === 'strikeCard')).toBe(false);
      expect(plain.some((a) => a.t === 'buy' && a.strike !== undefined)).toBe(false);
      const fixed = run(makeGreedy({ strikes: 'fixed' }), seed);
      // Same name, same streams: it plays like plain greedy until its first strike.
      const first = fixed.findIndex((a) => a.t === 'strikeCard');
      if (first >= 0) expect(fixed.slice(0, first)).toEqual(plain.slice(0, first));
      // Each strike names a hand card whose root type is in STRIKE_ORDER; no typed buys.
      let s = newRun(seed);
      for (const a of fixed) {
        if (a.t === 'strikeCard') {
          const card = s.hand[a.i]!;
          expect(card.kind).toBe('piece');
          const def = CONTENT.pieces[card.id as PieceId];
          expect(STRIKE_ORDER).toContain(def.countsAs ?? def.id);
          struck++;
        }
        expect(a.t === 'buy' && a.strike !== undefined).toBe(false);
        s = rules.apply(s, a).state;
      }
    }
    expect(struck).toBeGreaterThanOrEqual(1);
  }, 20_000);

  it('builds a piece from Your goods first when it adds, then plays the week (D-163)', () => {
    // A bought Bedroom in the reserve in week 1: it doesn't use the week, so greedy builds it
    // first, and the hand's best card is still the week's play.
    const s: RunState = { ...newRun('goods-0'), reserve: [{ id: 'bedroom' }] };
    const first = greedy.act(rules, s, stream('goods-0', 'first'));
    expect(first).toMatchObject({ t: 'place', from: 'reserve', i: 0 });
    expect(rules.endsWeek(s, first as PlaceAction)).toBe(false);
    const after = rules.apply(s, first).state;
    expect(after).toMatchObject({ week: s.week, hand: s.hand, reserve: [] });
    const second = greedy.act(rules, after, stream('goods-0', 'second'));
    expect(second).toMatchObject({ t: 'place', from: 'hand' });
    expect(rules.endsWeek(after, second as PlaceAction)).toBe(true);
  });

  it('labels its variants for reports and keeps one name for their streams', () => {
    expect(POLICIES.greedy).toBe(greedy);
    expect(greedy.label).toBe('greedy');
    const v = makeGreedy({ early: 'always', strikes: 'fixed' });
    expect(v.name).toBe('greedy');
    expect(v.label).toBe('greedy · early always · strikes fixed');
    expect(Object.keys(POLICIES).sort()).toEqual(['greedy', 'novice', 'random']);
  });
});
