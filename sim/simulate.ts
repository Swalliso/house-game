// Plays one run with a policy, headless, through the rules' own apply() (§8). Each run is a
// pure function of the seed, the policy, and the content, so results never depend on order or
// the machine. Records what the report needs: cumulative Wow after every tallied week, each
// milestone, lot fill, fence use, and the enclosure probe after milestone 3.

import { performance } from 'node:perf_hooks';
import type {
  Action,
  MilestoneResult,
  PickOption,
  Rules,
  RunState,
  ShopOffer,
} from '../src/rules/index.ts';
import { placedCells, stream } from '../src/rules/index.ts';
import { enclosureCost, type EnclosureCost } from './enclosure.ts';
import type { Policy } from './policies/index.ts';

export interface RunRecord {
  seed: string;
  policy: string;
  result: 'won' | 'lost';
  /** Milestones met (0–7). */
  cleared: number;
  /** The score when each milestone resolved, and how. */
  milestones: { phase: number; result: MilestoneResult; score: number; target: number }[];
  /** Cumulative Wow after each tallied week, by week of the run (index 0 = week 1). */
  weekly: number[];
  weeks: number;
  placements: number;
  passes: number;
  rerolls: number;
  fencePlacements: number;
  /** Percent of the lot's tiles covered by pieces at the end. */
  fillPct: number;
  /** The largest fenced yard at the end, in tiles (0 for none). */
  fencedYard: number;
  overtimeUsed: number;
  /** The fewest Fence cards that would make a fenced yard, probed after milestone 3. */
  enclosure: EnclosureCost | null;
  /** The economy (M3): what the shop offered and sold, and what fixtures and tools did. */
  economy: Economy;
  ms: number;
}

export interface Economy {
  /** Good key (`blueprint:fengShui`) → times on offer (each visit and refresh counts). */
  offered: Record<string, number>;
  bought: Record<string, number>;
  /** Kept from crates and the Housewarming crate. */
  picked: Record<string, number>;
  sold: number;
  refreshes: number;
  /** Shop visits left without buying (the skip reward). */
  skips: number;
  visits: number;
  budgetEarned: number;
  /** Budget held when the run ended: never spent. */
  budgetLeft: number;
  /** Each fixture install: where from, and the change to that week's total. */
  installs: { id: string; from: 'hand' | 'supplies'; gain: number }[];
  /** Each tool use and the change to that week's total. */
  tools: { id: string; gain: number }[];
}

export function goodKey(o: ShopOffer | PickOption): string {
  return o.kind === 'service' ? `service:${o.service}` : `${o.kind}:${o.id}`;
}

export interface SimOptions {
  /** Probe the enclosure cost at the start of this phase (0-based); null to skip. */
  probePhase?: number | null;
  /** Stop after this many weeks (for benchmarks and quick checks). */
  maxWeeks?: number;
}

export function simulateRun(
  rules: Rules,
  seed: string,
  policy: Policy,
  opts: SimOptions = {},
): { record: RunRecord; actions: Action[]; state: RunState } {
  const start = performance.now();
  const probePhase = opts.probePhase === undefined ? 3 : opts.probePhase;
  let s = rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' });
  const actions: Action[] = [];
  const weekly: number[] = [];
  const milestones: RunRecord['milestones'] = [];
  let placements = 0;
  let passes = 0;
  let rerolls = 0;
  let fencePlacements = 0;
  let overtimeUsed = 0;
  let enclosure: EnclosureCost | null = null;
  let probed = false;
  let step = 0;
  const economy: Economy = {
    offered: {},
    bought: {},
    picked: {},
    sold: 0,
    refreshes: 0,
    skips: 0,
    visits: 0,
    budgetEarned: 0,
    budgetLeft: 0,
    installs: [],
    tools: [],
  };
  const bump = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
  while (
    (s.screen === 'build' || s.screen === 'shop') &&
    (opts.maxWeeks === undefined || s.week <= opts.maxWeeks)
  ) {
    if (probePhase !== null && !probed && s.phase === probePhase) {
      probed = true;
      enclosure = enclosureCost(rules, s);
    }
    const rng = stream(seed, `bot/${policy.name}/${s.week}/${s.draws}/${step++}`);
    const action = policy.act(rules, s, rng);
    // Each install's and tool's gain this week, measured before it happens.
    if (action.t === 'install') {
      const fixture = action.from === 'hand' ? s.hand[action.i] : s.supplies[action.i];
      economy.installs.push({
        id: fixture?.id ?? '?',
        from: action.from,
        gain: rules.preview(s, action).delta,
      });
    } else if (action.t === 'useTool') {
      economy.tools.push({
        id: s.supplies[action.i]?.id ?? '?',
        gain: rules.previewTool(s, action).delta,
      });
    }
    // Weekend Crew's gain is the free build it makes room for.
    if (s.freePlay === 'ready' && (action.t === 'place' || action.t === 'install')) {
      const crew = economy.tools.findLast((t) => t.id === 'weekendCrew');
      if (crew) crew.gain = rules.preview(s, action).delta;
    }
    const { state, events } = rules.apply(s, action);
    actions.push(action);
    if (action.t === 'reroll') rerolls++;
    for (const e of events) {
      if (e.t === 'tally') {
        weekly[e.week - 1] = e.score;
        if (e.passed && !e.fastForward) passes++;
      } else if (e.t === 'placed') {
        placements++;
        if (rules.content.pieces[e.defId].wall) fencePlacements++;
      } else if (e.t === 'milestone') {
        milestones.push({ phase: e.phase, result: e.result, score: e.score, target: e.target });
        overtimeUsed += e.overtimeUsed;
      } else if (e.t === 'shopOpened' || e.t === 'shopRefreshed') {
        if (e.t === 'shopOpened') economy.visits++;
        else economy.refreshes++;
        for (const o of e.offers) bump(economy.offered, goodKey(o));
      } else if (e.t === 'bought') {
        bump(economy.bought, goodKey(e.offer));
      } else if (e.t === 'picked') {
        if (e.option) bump(economy.picked, goodKey(e.option));
      } else if (e.t === 'sold') {
        economy.sold++;
      } else if (e.t === 'shopClosed') {
        if (e.skipReward > 0) economy.skips++;
      }
    }
    s = state;
  }
  const { lot } = s.house;
  let covered = 0;
  for (const p of s.house.pieces) {
    covered += placedCells(rules.content.pieces[p.defId].shape, p.x, p.y, p.rot).length;
  }
  const yards = rules.fencedYards(s);
  return {
    record: {
      seed,
      policy: policy.name,
      result: s.screen === 'won' ? 'won' : 'lost',
      cleared: milestones.filter((m) => m.result !== 'failed').length,
      milestones,
      weekly,
      weeks: s.week,
      placements,
      passes,
      rerolls,
      fencePlacements,
      fillPct: (covered * 100) / (lot.width * lot.height),
      fencedYard: yards.reduce((a, b) => Math.max(a, b), 0),
      overtimeUsed,
      enclosure,
      economy: { ...economy, budgetEarned: s.budgetEarned, budgetLeft: s.budget },
      ms: performance.now() - start,
    },
    actions,
    state: s,
  };
}
