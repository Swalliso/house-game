// Plays one run with a policy, headless, through the rules' own apply() (§8). Each run is a
// pure function of the seed, the policy, and the content, so results never depend on order or
// the machine. Records what the report needs, read from the events apply() already returns:
// cumulative Wow after every tallied week, each milestone, lot fill, fence use, the enclosure
// probe after milestone 3, and the economy; and for §8's M3 and M4 reports, per-piece offers,
// picks and earnings, the score layers, flat points by source, house siting, early
// completions, and strikes.
//
// A bot that loops or breaks must not hang CI or sink a sweep without a trace (§9): each run
// caps its steps per week and in all, and any throw from the policy or from apply() comes back
// as a SimError that names the seed and carries a run code that replays it (?run=).

import { performance } from 'node:perf_hooks';
import type {
  Action,
  Card,
  Cell,
  GameEvent,
  HouseState,
  MilestoneResult,
  PieceId,
  PickOption,
  Rules,
  RunState,
  ShopOffer,
  Tally,
} from '../src/rules/index.ts';
import { contentHash, encodeRunCode, placedCells, stream, weekTotal } from '../src/rules/index.ts';
import { enclosureCost, type EnclosureCost } from './enclosure.ts';
import type { Policy } from './policies/index.ts';

export interface RunRecord {
  seed: string;
  /** The policy's name (it keys the bot's random streams). */
  policy: string;
  /** The policy's label for reports ("greedy · early always"), or its name. */
  label: string;
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
  /** Every overtime week was spent: the run had none left at the end. */
  overtimeExhausted: boolean;
  /** The fewest Fence cards that would make a fenced yard, probed after milestone 3. */
  enclosure: EnclosureCost | null;
  /** The economy (M3): what the shop offered and sold, and what fixtures and tools did. */
  economy: Economy;
  /** By piece type (defId). */
  pieces: Record<string, PieceStats>;
  /** The Wow of every tally, split into the score's layers; they sum to the tallied Wow. */
  layers: { comfort: number; charm: number; sparkle: number };
  /** Flat points (before percentages) by what caused them; `sets` is the sets' Points. */
  sources: { terrain: number; street: number; piece: number; plain: number; sets: number };
  /**
   * The sets' Points' share of each week's Wow, attributed as each piece's is (its Points ÷ the
   * week's Points × the total), so this plus every piece's `wow` sums to the tallied Wow.
   */
  setWow: number;
  siting: Siting;
  /** Each milestone completed early: weeks saved and the bonus it paid. */
  early: { phase: number; weeksSaved: number; score: number; budget: number }[];
  /** Each strike bought: the card type (a piece's countsAs root, or a fixture) and the shop. */
  struck: { type: string; shop: number }[];
  /** Fence-type (wall) cards in each week's first hand, summed per phase (index = phase). */
  wallOffers: number[];
  /** The score when the run ended (early bonuses included). */
  finalScore: number;
  ms: number;
}

/**
 * One piece type over a run. "Offered" counts each week's first hand (and the free redraw, if
 * nothing in it fit), never rerolls or the Catalog's special hand.
 */
export interface PieceStats {
  offered: number;
  /** Offered cards with no legal spot at the time. */
  dead: number;
  placed: number;
  /** Its own earnings, summed over tallies. */
  earned: number;
  /** Each week's total, attributed by flat-points share: earned ÷ max(1, Points) × total. */
  wow: number;
  pieceWeeks: number;
  zeroWeeks: number;
  unmetWeeks: number;
  /** Piece-weeks touching another placed piece of the same root type (countsAs, or its id). */
  clusteredWeeks: number;
}

/** Rows from the street: the street-edge row (y = height − 1) is 0. */
export interface Siting {
  /** The first piece placed, by its cell nearest the street; NaN if nothing was placed. */
  firstRow: number;
  /** The first indoor piece placed, the same way. */
  firstIndoorRow: number | null;
  /** The house's front row at the end: its indoor tile nearest the street. */
  frontGap: number | null;
  /** A piece (indoor or not) sits on the street-edge row at the end. */
  touchesStreet: boolean;
}

export interface Economy {
  /** Good key (`blueprint:fengShui`) → times on offer (each visit and refresh counts). */
  offered: Record<string, number>;
  bought: Record<string, number>;
  /** Kept from crates and the Housewarming crate. */
  picked: Record<string, number>;
  /** Good key → times shown as an opened crate's option (the Housewarming crate included). */
  inCrates: Record<string, number>;
  sold: number;
  refreshes: number;
  /** Shop visits left without buying (the skip reward). */
  skips: number;
  visits: number;
  budgetEarned: number;
  /** Budget held when the run ended: never spent. */
  budgetLeft: number;
  /** The last milestone's budget: no shop follows it, so it can't be spent. */
  finalReward: number;
  /** Budget held as each shop closed. */
  budgetAtLeave: number[];
  /** Tool ids still in the supplies at the end. */
  heldAtEnd: string[];
  bonusRerollsBought: number;
  /** Rerolls taken with no phase rerolls left, so a bonus one was spent. */
  bonusRerollsUsed: number;
  bonusRerollsHeld: number;
  /**
   * Each fixture install: where from, and the change to that week's total. `weeksLeft` counts
   * the run's regular weeks still to tally, this one included.
   */
  installs: {
    id: string;
    from: 'hand' | 'supplies';
    gain: number;
    week: number;
    weeksLeft: number;
  }[];
  /** Each tool use and the change to that week's total. */
  tools: { id: string; gain: number; week: number; weeksLeft: number }[];
}

export function goodKey(o: ShopOffer | PickOption): string {
  return o.kind === 'service' ? `service:${o.service}` : `${o.kind}:${o.id}`;
}

export interface SimOptions {
  /** Probe the enclosure cost at the start of this phase (0-based); null to skip. */
  probePhase?: number | null;
  /** Stop after this many weeks (for benchmarks and quick checks). */
  maxWeeks?: number;
  /** A SimError past this many actions in one week of the run (default 400). */
  maxStepsPerWeek?: number;
  /** A SimError past this many actions in the run (default 20,000). */
  maxSteps?: number;
}

/** What went wrong in a sim run, where, and a run code that replays it. */
export interface SimErrorInfo {
  seed: string;
  /** The policy's label (or name). */
  policy: string;
  /** Actions applied so far. */
  step: number;
  week: number;
  phase: number;
  screen: string;
  /** The action that failed; for a step cap, the last one applied; null if the policy threw. */
  action: Action | null;
  reason: string;
  /** Every action applied so far; a failing placement or install rides along as `pending`. */
  runCode: string;
}

/** Thrown by simulateRun for a policy or apply() error or a step cap. The original is `cause`. */
export class SimError extends Error implements SimErrorInfo {
  readonly seed: string;
  readonly policy: string;
  readonly step: number;
  readonly week: number;
  readonly phase: number;
  readonly screen: string;
  readonly action: Action | null;
  readonly reason: string;
  readonly runCode: string;
  constructor(info: SimErrorInfo, cause?: unknown) {
    const at = info.action ? ` at ${JSON.stringify(info.action)}` : '';
    super(
      `${info.policy} run "${info.seed}": ${info.reason}${at}` +
        ` (step ${info.step}, week ${info.week}, phase ${info.phase}, ${info.screen} screen)`,
      cause === undefined ? undefined : { cause },
    );
    this.name = 'SimError';
    this.seed = info.seed;
    this.policy = info.policy;
    this.step = info.step;
    this.week = info.week;
    this.phase = info.phase;
    this.screen = info.screen;
    this.action = info.action;
    this.reason = info.reason;
    this.runCode = info.runCode;
  }
}

const MAX_STEPS_PER_WEEK = 400;
const MAX_STEPS = 20_000;

const reasonOf = (e: unknown): string =>
  e instanceof Error ? ((e as { reason?: string }).reason ?? e.message) : String(e);

/**
 * Which piece covers each tile and which tiles each piece covers, for "touching" checks. The
 * tally's house is the state's after apply(); a piece that transformed at the next week's start
 * (the Sapling into a Tree) is missing from it and counts as touching nothing that week.
 */
interface Occupancy {
  house: HouseState;
  uidAt: Int32Array;
  cells: Map<number, readonly Cell[]>;
  defOf: Map<number, PieceId>;
}

function occupancy(rules: Rules, house: HouseState): Occupancy {
  const { width } = house.lot;
  const uidAt = new Int32Array(width * house.lot.height);
  const cells = new Map<number, readonly Cell[]>();
  const defOf = new Map<number, PieceId>();
  for (const p of house.pieces) {
    const cs = placedCells(rules.content.pieces[p.defId].shape, p.x, p.y, p.rot);
    for (const c of cs) uidAt[c.y * width + c.x] = p.uid;
    cells.set(p.uid, cs);
    defOf.set(p.uid, p.defId);
  }
  return { house, uidAt, cells, defOf };
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function simulateRun(
  rules: Rules,
  seed: string,
  policy: Policy,
  opts: SimOptions = {},
): { record: RunRecord; actions: Action[]; state: RunState } {
  const start = performance.now();
  const { content } = rules;
  const b = content.balance;
  const phaseCount = b.phases.length;
  const probePhase = opts.probePhase === undefined ? 3 : opts.probePhase;
  const maxStepsPerWeek = opts.maxStepsPerWeek ?? MAX_STEPS_PER_WEEK;
  const maxSteps = opts.maxSteps ?? MAX_STEPS;
  const label = policy.label ?? policy.name;
  let s = rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' });
  const { width, height } = s.house.lot;
  const rowsFromStreet = (y: number) => height - 1 - y;
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
  let stepWeek = s.week;
  let weekSteps = 0;
  const economy: Economy = {
    offered: {},
    bought: {},
    picked: {},
    inCrates: {},
    sold: 0,
    refreshes: 0,
    skips: 0,
    visits: 0,
    budgetEarned: 0,
    budgetLeft: 0,
    finalReward: 0,
    budgetAtLeave: [],
    heldAtEnd: [],
    bonusRerollsBought: 0,
    bonusRerollsUsed: 0,
    bonusRerollsHeld: 0,
    installs: [],
    tools: [],
  };
  const pieces: Record<string, PieceStats> = {};
  const layers = { comfort: 0, charm: 0, sparkle: 0 };
  const sources = { terrain: 0, street: 0, piece: 0, plain: 0, sets: 0 };
  let setWow = 0;
  const early: RunRecord['early'] = [];
  const struck: RunRecord['struck'] = [];
  const wallOffers = Array.from({ length: phaseCount }, () => 0);
  let firstRow = NaN;
  let firstIndoorRow: number | null = null;
  let occ: Occupancy | null = null;

  const bump = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
  const statsOf = (id: string): PieceStats =>
    (pieces[id] ??= {
      offered: 0,
      dead: 0,
      placed: 0,
      earned: 0,
      wow: 0,
      pieceWeeks: 0,
      zeroWeeks: 0,
      unmetWeeks: 0,
      clusteredWeeks: 0,
    });
  const rootOf = (id: PieceId) => content.pieces[id].countsAs ?? id;
  /** The run's regular weeks still to tally, this one included. */
  const weeksLeftInRun = (st: RunState) =>
    (phaseCount - 1 - st.phase) * b.weeksPerPhase + rules.weeksLeft(st);

  /** A week's first hand: offers and dead cards per piece type, and Fence-type cards. */
  const countHand = (st: RunState, hand: readonly Card[], phase: number, allDead: boolean) => {
    hand.forEach((card, i) => {
      if (card.kind !== 'piece') return;
      const ps = statsOf(card.id);
      ps.offered++;
      if (allDead || !rules.cardFits(st, i)) ps.dead++;
      if (content.pieces[card.id].wall && phase < phaseCount) wallOffers[phase]!++;
    });
  };

  const touchesSameType = (o: Occupancy, uid: number, defId: PieceId): boolean => {
    const cells = o.cells.get(uid);
    if (!cells) return false;
    const root = rootOf(defId);
    for (const c of cells) {
      for (const [dx, dy] of STEPS) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const other = o.uidAt[ny * width + nx]!;
        if (other !== 0 && other !== uid && rootOf(o.defOf.get(other)!) === root) return true;
      }
    }
    return false;
  };

  const addTally = (t: Tally, house: HouseState) => {
    // The layers (D-019): Comfort is Points; Charm what the additive Mult adds to it; Sparkle
    // what ×Mult adds after that. The week's total before any ×Mult is weekTotal(Points, the
    // Mult before the first ×Mult), so with no ×Mult Sparkle is exactly 0 and the three sum
    // to the total in whole Wow.
    const additive = t.xMults.length > 0 ? t.xMults[0]!.before : t.mult;
    const base = weekTotal(t.points, additive);
    layers.comfort += t.points;
    layers.charm += base - t.points;
    layers.sparkle += t.total - base;
    for (const set of t.sets) {
      sources.sets += set.points;
      setWow += (set.points / Math.max(1, t.points)) * t.total;
    }
    if (t.pieces.length === 0) return;
    if (occ?.house !== house) occ = occupancy(rules, house);
    for (const p of t.pieces) {
      const ps = statsOf(p.defId);
      ps.pieceWeeks++;
      ps.earned += p.earned;
      ps.wow += (p.earned / Math.max(1, t.points)) * t.total;
      if (p.earned <= 0) ps.zeroWeeks++;
      if (p.unmet !== undefined) ps.unmetWeeks++;
      if (touchesSameType(occ, p.uid, p.defId)) ps.clusteredWeeks++;
      for (const line of p.lines) {
        if (line.op !== 'add') continue;
        if (line.from.length === 0) {
          sources.plain += line.value;
          continue;
        }
        const share = line.value / line.from.length;
        for (const f of line.from) sources[f.kind] += share;
      }
    }
  };

  /** `failed`: the action threw in apply(), so it isn't in `actions`; a play rides as pending. */
  const fail = (
    reason: string,
    action: Action | null,
    cause?: unknown,
    failed = false,
  ): SimError => {
    const pending =
      failed && action && (action.t === 'place' || action.t === 'install') ? action : undefined;
    const runCode = encodeRunCode({
      build: 'sim',
      contentHash: contentHash(content),
      setup: s.setup,
      actions,
      ...(pending ? { pending } : {}),
    });
    return new SimError(
      {
        seed,
        policy: label,
        step: actions.length,
        week: s.week,
        phase: s.phase,
        screen: s.screen,
        action,
        reason,
        runCode,
      },
      cause,
    );
  };

  if (s.screen === 'build') countHand(s, s.hand, s.phase, false);
  while (
    (s.screen === 'build' || s.screen === 'shop') &&
    (opts.maxWeeks === undefined || s.week <= opts.maxWeeks)
  ) {
    if (s.week !== stepWeek) {
      stepWeek = s.week;
      weekSteps = 0;
    }
    if (actions.length >= maxSteps) {
      throw fail(`step cap: ${maxSteps} actions in the run`, actions.at(-1) ?? null);
    }
    if (weekSteps >= maxStepsPerWeek) {
      throw fail(`step cap: ${maxStepsPerWeek} actions in week ${s.week}`, actions.at(-1) ?? null);
    }
    weekSteps++;
    if (probePhase !== null && !probed && s.phase === probePhase) {
      probed = true;
      enclosure = enclosureCost(rules, s);
    }
    const rng = stream(seed, `bot/${policy.name}/${s.week}/${s.draws}/${step++}`);
    let action: Action;
    try {
      action = policy.act(rules, s, rng);
    } catch (e) {
      throw fail(`the policy threw: ${reasonOf(e)}`, null, e);
    }
    let applied: { state: RunState; events: GameEvent[] };
    try {
      // Each install's and tool's gain this week, measured before it happens.
      if (action.t === 'install') {
        const fixture = action.from === 'hand' ? s.hand[action.i] : s.supplies[action.i];
        economy.installs.push({
          id: fixture?.id ?? '?',
          from: action.from,
          gain: rules.preview(s, action).delta,
          week: s.week,
          weeksLeft: weeksLeftInRun(s),
        });
      } else if (action.t === 'useTool') {
        economy.tools.push({
          id: s.supplies[action.i]?.id ?? '?',
          gain: rules.previewTool(s, action).delta,
          week: s.week,
          weeksLeft: weeksLeftInRun(s),
        });
      }
      // Weekend Crew's gain is the free build it makes room for.
      if (s.freePlay === 'ready' && (action.t === 'place' || action.t === 'install')) {
        const crew = economy.tools.findLast((t) => t.id === 'weekendCrew');
        if (crew) crew.gain = rules.preview(s, action).delta;
      }
      applied = rules.apply(s, action);
    } catch (e) {
      throw fail(reasonOf(e), action, e, true);
    }
    const { state, events } = applied;
    actions.push(action);
    if (action.t === 'reroll') {
      rerolls++;
      if (s.rerollsLeft <= 0) economy.bonusRerollsUsed++;
    }
    let drawn = false;
    for (const e of events) {
      if (e.t === 'tally') {
        weekly[e.week - 1] = e.score;
        if (e.passed && !e.fastForward) passes++;
        addTally(e.tally, state.house);
      } else if (e.t === 'placed') {
        placements++;
        const def = content.pieces[e.defId];
        if (def.wall) fencePlacements++;
        statsOf(e.defId).placed++;
        const row = Math.min(...e.cells.map((c) => rowsFromStreet(c.y)));
        if (Number.isNaN(firstRow)) firstRow = row;
        if (firstIndoorRow === null && def.category === 'indoor') firstIndoorRow = row;
      } else if (e.t === 'handDrawn') {
        drawn ||= !e.reroll && !e.special;
      } else if (e.t === 'milestone') {
        milestones.push({ phase: e.phase, result: e.result, score: e.score, target: e.target });
        overtimeUsed += e.overtimeUsed;
        if (e.result === 'early') {
          early.push({
            phase: e.phase,
            weeksSaved: e.weeksSaved,
            score: e.reward.score,
            budget: e.reward.budget - b.milestoneBudget - e.reward.interest,
          });
        }
        if (e.phase === phaseCount - 1) economy.finalReward = e.reward.budget;
      } else if (e.t === 'shopOpened' || e.t === 'shopRefreshed') {
        if (e.t === 'shopOpened') economy.visits++;
        else economy.refreshes++;
        for (const o of e.offers) bump(economy.offered, goodKey(o));
      } else if (e.t === 'crateOpened') {
        for (const o of e.options) bump(economy.inCrates, goodKey(o));
      } else if (e.t === 'bought') {
        bump(economy.bought, goodKey(e.offer));
        if (e.offer.kind === 'service' && e.offer.service === 'reroll') {
          economy.bonusRerollsBought++;
        }
        if (e.strike) struck.push({ type: e.strike.id, shop: s.offers?.shop?.number ?? 0 });
      } else if (e.t === 'picked') {
        if (e.option) bump(economy.picked, goodKey(e.option));
      } else if (e.t === 'sold') {
        economy.sold++;
      } else if (e.t === 'shopClosed') {
        if (e.skipReward > 0) economy.skips++;
        economy.budgetAtLeave.push(e.budget);
      }
    }
    if (drawn) {
      // The week's first hand, and the free redraw when nothing in it fit (so all of it was
      // dead). Rerolls and the Catalog's special hand don't count as offers.
      const hands = events.filter(
        (e): e is Extract<GameEvent, { t: 'handDrawn' }> =>
          e.t === 'handDrawn' && !e.reroll && !e.special,
      );
      hands.forEach((e, k) => {
        const redrawn = !e.free && hands[k + 1]?.free === true;
        const at = redrawn || state.hand === e.hand ? state : { ...state, hand: e.hand };
        countHand(at, e.hand, e.phase, redrawn);
      });
    }
    s = state;
  }
  const { lot } = s.house;
  let covered = 0;
  let frontGap: number | null = null;
  let touchesStreet = false;
  for (const p of s.house.pieces) {
    const def = content.pieces[p.defId];
    const cells = placedCells(def.shape, p.x, p.y, p.rot);
    covered += cells.length;
    for (const c of cells) {
      const row = rowsFromStreet(c.y);
      if (row === 0) touchesStreet = true;
      if (def.category === 'indoor' && (frontGap === null || row < frontGap)) frontGap = row;
    }
  }
  const yards = rules.fencedYards(s);
  return {
    record: {
      seed,
      policy: policy.name,
      label,
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
      overtimeExhausted: overtimeUsed > 0 && s.overtimeLeft === 0,
      enclosure,
      economy: {
        ...economy,
        budgetEarned: s.budgetEarned,
        budgetLeft: s.budget,
        heldAtEnd: s.supplies.flatMap((x) => (x.kind === 'tool' ? [x.id] : [])),
        bonusRerollsHeld: s.bonusRerolls,
      },
      pieces,
      layers,
      sources,
      setWow,
      siting: { firstRow, firstIndoorRow, frontGap, touchesStreet },
      early,
      struck,
      wallOffers,
      finalScore: s.score,
      ms: performance.now() - start,
    },
    actions,
    state: s,
  };
}
