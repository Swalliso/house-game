// The smoke sim in npm test (§9): bots play the real game end to end through simulateRun, for
// each Core client (M4a):
// - random plays 5 seeded runs to the end with no run-breaking bugs, and each run code replays
//   to the same state;
// - greedy plays the same 5 seeds to the end, and each run code replays. At least 3 of them
//   reach shop 3 and use a tool or install a supply, so later shops and the real tools run in
//   npm test (counted over the 5, so one harsh seed after a content change doesn't fail it).
//   Over all 5 greedy sets a floor: it beats random at the same week on every seed, meets
//   milestone 1 on every seed, and meets milestone 3 on most;
// - the same seed and policy give the same results (§8, Determinism);
// - a bot that loops or breaks stops with a SimError that names the seed and carries a run
//   code that replays to where it stopped, so a sweep can’t hang CI.
// The chaos test (chaos.test.ts) plays every action and checks every step; the report's math
// is in report.test.ts. Long sweeps stay in npm run sim.

import { describe, expect, it } from 'vitest';
import type { Action, ClientId, RunState } from '../src/rules/index.ts';
import {
  CONTENT,
  contentHash,
  decodeRunCode,
  encodeRunCode,
  IllegalAction,
  rules,
} from '../src/rules/index.ts';
import { POLICIES, type Policy } from './policies/index.ts';
import { SimError, simulateRun } from './simulate.ts';

const SEEDS = ['smoke-0', 'smoke-1', 'smoke-2', 'smoke-3', 'smoke-4'];
const CLIENTS = Object.values(CONTENT.clients)
  .filter((c) => c.tier === 'core')
  .map((c) => c.id);

type Played = ReturnType<typeof simulateRun>;
const played = new Map<string, Played>();
/** Each policy, seed, and client is played once and shared (greedy with the fence probe). */
function play(policy: 'random' | 'greedy', seed: string, clientId: ClientId): Played {
  const key = `${policy}/${seed}/${clientId}`;
  let p = played.get(key);
  if (!p) {
    const opts = policy === 'random' ? { probePhase: null, clientId } : { clientId };
    played.set(key, (p = simulateRun(rules, seed, POLICIES[policy]!, opts)));
  }
  return p;
}

/** The run's code decodes and replays to the same state. */
function expectReplays({ state, actions }: Played) {
  const code = encodeRunCode({
    build: 'test',
    contentHash: contentHash(CONTENT),
    setup: state.setup,
    actions,
  });
  const decoded = decodeRunCode(code);
  if (!decoded.ok) throw new Error(decoded.error);
  const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
  expect(replayed.failedAt).toBeUndefined();
  expect(replayed.state).toEqual(state);
}

/** The SimError simulateRun throws. */
function simError(seed: string, policy: Policy, opts = {}): SimError {
  try {
    simulateRun(rules, seed, policy, { probePhase: null, ...opts });
  } catch (e) {
    if (e instanceof SimError) return e;
    throw e;
  }
  throw new Error('simulateRun finished without a SimError');
}

/** A SimError's run code: it decodes, names the seed, and replays every action it holds. */
function replayCode(e: SimError): {
  actions: readonly Action[];
  state: RunState;
  pending?: Action;
} {
  const decoded = decodeRunCode(e.runCode);
  if (!decoded.ok) throw new Error(decoded.error);
  expect(decoded.data.setup.seed).toBe(e.seed);
  expect(decoded.data.contentHash).toBe(contentHash(CONTENT));
  expect(decoded.data.actions).toHaveLength(e.step);
  const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
  expect(replayed.failedAt).toBeUndefined();
  return { actions: decoded.data.actions, state: replayed.state, pending: decoded.data.pending };
}

describe.each(CLIENTS)('the smoke sim for %s', (client) => {
  it('plays 5 random runs to the end, and each one replays from its run code', () => {
    for (const seed of SEEDS) {
      const run = play('random', seed, client);
      expect(run.state.setup.clientId).toBe(client);
      expect(['won', 'lost']).toContain(run.state.screen);
      expect(run.record.weeks).toBeLessThanOrEqual(30);
      expect(run.record.weekly.length).toBeGreaterThan(0);
      expectReplays(run);
    }
  }, 30_000);

  it('greedy plays 5 runs to the end, most of them into the economy, and each one replays', () => {
    let economy = 0;
    for (const seed of SEEDS) {
      const run = play('greedy', seed, client);
      const { record, state } = run;
      expect(['won', 'lost']).toContain(state.screen);
      // Shop 3 stocks tools, crates, and an upgrade; greedy uses a tool or installs a supply.
      const supplied = record.economy.installs.filter((x) => x.from === 'supplies').length;
      if (record.economy.visits >= 3 && record.economy.tools.length + supplied > 0) economy++;
      // The fence probe ran on the house after milestone 3.
      if (record.cleared >= 3) expect(record.enclosure, seed).not.toBeNull();
      expectReplays(run);
    }
    expect(economy).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it('greedy sets a floor over 5 seeds: it beats random, meets milestone 1, mostly 3', () => {
    const cleared: number[] = [];
    for (const seed of SEEDS) {
      const greedy = play('greedy', seed, client).record;
      const random = play('random', seed, client).record;
      // Random play often loses early, so compare the score each had at the last week both played.
      const k = Math.min(greedy.weekly.length, random.weekly.length) - 1;
      expect(greedy.weekly[k], seed).toBeGreaterThan(random.weekly[k]!);
      expect(greedy.cleared, seed).toBeGreaterThanOrEqual(Math.max(1, random.cleared));
      cleared.push(greedy.cleared);
    }
    // Greedy meets milestones 1–3 in about 95% of runs (D-085), so 3 of 5 leaves room for noise.
    expect(cleared.filter((n) => n >= 3).length, `cleared: ${cleared}`).toBeGreaterThanOrEqual(3);
  }, 30_000);
});

describe('the smoke sim', () => {
  it('gives the same results for the same seed and policy', () => {
    for (const policy of [POLICIES.random!, POLICIES.greedy!, POLICIES.novice!]) {
      const a = simulateRun(rules, 'determinism', policy, { maxWeeks: 10 });
      const b = simulateRun(rules, 'determinism', policy, { maxWeeks: 10 });
      expect(b.actions).toEqual(a.actions);
      expect(b.state).toEqual(a.state);
      expect({ ...b.record, ms: 0 }).toEqual({ ...a.record, ms: 0 });
    }
  }, 30_000);
});

describe('a bot that loops or breaks', () => {
  it('stops at the step cap for a week with a SimError that names the seed', () => {
    // Toggling auto-complete forever never ends the week.
    const looping: Policy = {
      name: 'looping',
      act: (_rules, s) => ({ t: 'setAutoComplete', on: !s.autoComplete }),
    };
    const e = simError('smoke-loop', looping);
    expect(e.message).toContain('smoke-loop');
    expect(e.message).toContain('looping');
    expect(e.reason).toMatch(/step cap/);
    expect([e.seed, e.policy, e.step, e.week, e.screen]).toEqual([
      'smoke-loop',
      'looping',
      400,
      1,
      'build',
    ]);
    expect(e.action).toEqual({ t: 'setAutoComplete', on: false });
    // The run code replays the 400 toggles, ending back where it started.
    const { state } = replayCode(e);
    expect([state.week, state.screen, state.autoComplete]).toEqual([1, 'build', false]);
  });

  it('stops at the step cap for the run', () => {
    const passing: Policy = { name: 'passing', act: () => ({ t: 'pass' }) };
    const e = simError('smoke-cap', passing, { maxSteps: 5 });
    expect(e.reason).toMatch(/5 actions in the run/);
    expect(e.step).toBe(5);
    expect(replayCode(e).state.week).toBe(6);
  });

  it('wraps a throw from the policy, keeping it as the cause', () => {
    const broken: Policy = {
      name: 'broken',
      act: (_rules, s) => {
        if (s.week === 3) throw new Error('boom');
        return { t: 'pass' };
      },
    };
    const e = simError('smoke-broken', broken);
    expect(e.reason).toBe('the policy threw: boom');
    expect(e.message).toContain('smoke-broken');
    expect(e.cause).toBeInstanceOf(Error);
    expect([e.action, e.step, e.week]).toEqual([null, 2, 3]);
    expect(replayCode(e).state.week).toBe(3);
  });

  it('wraps an illegal action, and its run code holds it as the pending play', () => {
    const offLot: Action = { t: 'place', from: 'hand', i: 0, x: -5, y: 0, rot: 0 };
    const careless: Policy = {
      name: 'careless',
      act: (_rules, s) => (s.week === 2 ? offLot : { t: 'pass' }),
    };
    const e = simError('smoke-illegal', careless);
    expect(e.cause).toBeInstanceOf(IllegalAction);
    expect(e.reason).toBe((e.cause as IllegalAction).reason);
    expect([e.action, e.step, e.week]).toEqual([offLot, 1, 2]);
    const { state, pending } = replayCode(e);
    expect(pending).toEqual(offLot);
    expect(() => rules.apply(state, pending!)).toThrow(IllegalAction);
  });
});
