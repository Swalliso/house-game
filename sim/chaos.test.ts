// The chaos test (§9: the rules are sound on the real content). The chaos bot
// (policies/chaos.ts) plays seeded runs of the real CONTENT through simulateRun, so the step
// caps apply and a bot or rules error comes back as a SimError with a run code. Each run is
// then walked again from newRun, and every step is checked:
// - invariants on the state and the events: whole non-negative numbers, slots, no overlapping
//   pieces or pieces off the lot or on blocking terrain, the tally's arithmetic (Points, Mult,
//   each ×Mult, the total, the score and budget), a score that never falls without a cheat;
// - the queries agree with apply(): preview() and scoreOnly() with the tally a play makes (or
//   the house's tally after a free play), previewTool() and canUseTool() with using the tool,
//   previewDemolish() with demolishing, and cardFits, reserveFits, canReroll,
//   canCompleteEarly, canRefresh, and the shop's offers with whether apply() accepts them;
// - a tool use is a free action (§9): the week and the hand stay (the Catalog redraws), and
//   next week's first hand is the same as without it;
// - malformed actions throw IllegalAction (never a TypeError) and change nothing, and a
//   sample of listed legal actions apply;
// - no query or apply() changes the state it's given;
// - the walk, rules.replay, and the run code all reproduce the sim's final state.
// Across the seeds the runs must reach every Action kind and debug op, every tool use kind,
// every milestone result, every kind of good bought, shops 1–6, and a win and a loss, and the
// checks above must each have run. The seeds are fixed, so the test is deterministic. A
// content change reshuffles the runs; when the fixed seeds then fall short, the coverage tests
// play up to MAX_EXTRA more (each checked the same way) before they fail.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  ClientId,
  CrewId,
  DebugAction,
  Good,
  GameEvent,
  InstallAction,
  MilestoneResult,
  PlaceAction,
  RenovateAction,
  Rng,
  RunSetup,
  RunState,
  Tally,
  ToolUse,
  UseToolAction,
} from '../src/rules/index.ts';
import {
  CONTENT,
  contentHash,
  decodeRunCode,
  encodeRunCode,
  IllegalAction,
  placedCells,
  rules,
  stream,
  weekTotal,
} from '../src/rules/index.ts';
import { drawnBefore } from '../src/rules/testing.ts';
import { findMove, makeChaos, offerKind } from './policies/chaos.ts';
import { SimError, simulateRun } from './simulate.ts';

interface Seed {
  seed: string;
  cheat: boolean;
  gifts?: readonly Good[];
  /** M4b: every crew and client gets runs (the default: the Hendersons, the General Contractor). */
  clientId?: ClientId;
  crewId?: CrewId;
}

const CLIENTS: readonly ClientId[] = ['hendersons', 'vladislav', 'barkers', 'juniper', 'dale'];
const CREWS: readonly CrewId[] = ['generalContractor', 'landscaper', 'architect'];

/** Runs with cheats (most reach the end), and one without (it plays on to a loss). */
const SEEDS: readonly Seed[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    seed: `chaos-${i}`,
    cheat: true,
    clientId: CLIENTS[i % CLIENTS.length]!,
    crewId: CREWS[i % CREWS.length]!,
  })),
  { seed: 'chaos-honest', cheat: false },
  // ×Mult needs a condition random play seldom meets, so one run starts with its sources:
  // Last-Minute Push (each phase's last week), Model Home (pieces with fixtures), and a
  // Chandelier for an Entertainer.
  {
    seed: 'chaos-sparkle',
    cheat: true,
    gifts: [
      { kind: 'blueprint', id: 'lastMinutePush' },
      { kind: 'blueprint', id: 'modelHome' },
      { kind: 'fixture', id: 'chandelier' },
    ],
  },
];

/** Problems kept per run: past this the run is broken enough. */
const MAX_PROBLEMS = 25;

const setupOf = (
  seed: string,
  clientId: ClientId = 'hendersons',
  crewId: CrewId = 'generalContractor',
): RunSetup => ({ seed, clientId, crewId, mode: 'standard' });
const J = (x: unknown) => JSON.stringify(x);
const isBuild = (s: RunState) => s.screen === 'build';

type Tallied = Extract<GameEvent, { t: 'tally' }>;
const tallyEvent = (events: readonly GameEvent[]) =>
  events.find((e): e is Tallied => e.t === 'tally');
/** What a pass would tally now (on the build screen). */
const passTally = (s: RunState): Tally | undefined =>
  tallyEvent(rules.apply(s, { t: 'pass' }).events)?.tally;
/**
 * The first hand drawn in these events that isn't a reroll or the Catalog's, as it was drawn:
 * before its swaps (D-121), which depend on the lot.
 */
const firstHand = (events: readonly GameEvent[]) => {
  const e = events.find((e) => e.t === 'handDrawn' && !e.reroll && !e.special);
  return e ? drawnBefore(e) : undefined;
};

/** Whether apply() accepts the action: true, false for an IllegalAction, or the other error. */
function accepts(s: RunState, a: Action): boolean | string {
  try {
    rules.apply(s, a);
    return true;
  } catch (e) {
    return e instanceof IllegalAction ? false : `${(e as Error)?.name}: ${(e as Error)?.message}`;
  }
}

/** Paths to numbers that aren't finite, and to undefined array entries or functions. */
function badValues(x: unknown, path = '$', out: string[] = []): string[] {
  if (out.length > 5) return out;
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) out.push(`${path}=${x}`);
  } else if (typeof x === 'function') out.push(`${path} is a function`);
  else if (Array.isArray(x)) {
    x.forEach((v, i) =>
      v === undefined ? out.push(`${path}[${i}]=undefined`) : badValues(v, `${path}[${i}]`, out),
    );
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) if (v !== undefined) badValues(v, `${path}.${k}`, out);
  }
  return out;
}

const ACTION_KINDS: Record<Action['t'], true> = {
  place: true,
  install: true,
  renovate: true,
  pass: true,
  reroll: true,
  demolish: true,
  completeEarly: true,
  setAutoComplete: true,
  sell: true,
  buy: true,
  refreshShop: true,
  leaveShop: true,
  pick: true,
  useTool: true,
  answerChangeOrder: true,
  debug: true,
};
const DEBUG_OPS: Record<DebugAction['op'], true> = {
  addScore: true,
  addBudget: true,
  giveCard: true,
  forceMiss: true,
  forceShop: true,
  giveGood: true,
  forceChangeOrder: true,
  forceArrival: true,
};
const TOOL_USES: Record<ToolUse['kind'], true> = {
  move: true,
  copy: true,
  weekModifiers: true,
  specialHand: true,
  advanceTimers: true,
  reward: true,
  levelSet: true,
  extraPlay: true,
};
const RESULTS: Record<MilestoneResult, true> = {
  onTime: true,
  early: true,
  overtime: true,
  failed: true,
};
const OFFER_KINDS: Record<ReturnType<typeof offerKind>, true> = {
  blueprint: true,
  piece: true,
  fixture: true,
  tool: true,
  crate: true,
  upgrade: true,
  'service:reroll': true,
  'service:demolition': true,
  'service:strike': true,
};
const keys = (r: object) => Object.keys(r);

interface Played {
  seed: string;
  actions: Action[];
  state: RunState;
  problems: string[];
  /** What the run reached and which checks ran, by key. */
  seen: Map<string, number>;
}

/** Walks a run step by step, checking each one. */
class Checker {
  readonly problems: string[] = [];
  readonly seen = new Map<string, number>();
  private where = '';
  private readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
  }

  see(key: string) {
    this.seen.set(key, (this.seen.get(key) ?? 0) + 1);
  }

  fail(check: string, detail?: unknown) {
    if (this.problems.length >= MAX_PROBLEMS) return;
    this.problems.push(`${this.where}: ${check}${detail === undefined ? '' : ` ${J(detail)}`}`);
  }

  /** Checks the run's first state. */
  first(s: RunState) {
    this.where = 'the first state';
    this.see(`crew:${s.setup.crewId}`);
    this.see(`client:${s.setup.clientId}`);
    // M4b: a crew's starting cards are in the reserve's extra slots from week 1.
    const start = CONTENT.crews[s.setup.crewId].startReserve ?? [];
    if (J(s.reserve.map((r) => [r.id, r.crew])) !== J(start.map((id) => [id, true]))) {
      this.fail('the crew’s starting cards aren’t in the reserve', s.reserve);
    }
    this.invariants(s, s, null, []);
  }

  /** Checks the state before action `n`, applies it, checks the result, and returns it. */
  step(s: RunState, a: Action, n: number): RunState {
    this.where = `step ${n} (week ${s.week}, phase ${s.phase}, ${s.screen}) ${J(a)}`;
    const rng = stream(this.seed, `chaos-check/${n}`);
    const before = J(s);
    // Listing every placement is the costly query, so each step lists the actions once.
    const legal = rules.legalActions(s);
    if (isBuild(s)) {
      this.checkPlays(s, legal, rng);
      this.checkTools(s, rng);
      this.checkDemolish(s, legal, rng);
      this.checkBuildQueries(s);
    } else this.checkShopQueries(s);
    this.checkOrderQueries(s, legal);
    this.checkMalformed(s);
    this.checkListed(s, legal, rng);
    let out: { state: RunState; events: GameEvent[] };
    try {
      out = rules.apply(s, a);
    } catch (e) {
      this.fail('the sim applied this action, but the walk could not', (e as Error).message);
      return s;
    }
    this.invariants(out.state, s, a, out.events);
    if (J(s) !== before) this.fail('a query or apply() changed the state it was given');
    this.record(s, a, out.events);
    return out.state;
  }

  /** preview() and scoreOnly() against the tally the play makes. */
  checkPlays(s: RunState, legal: readonly Action[], rng: Rng) {
    // legalActions lists legalPlays first, then the pass and the free actions.
    const plays = legal.filter(
      (a): a is PlaceAction | InstallAction | RenovateAction =>
        a.t === 'place' || a.t === 'renovate' || (a.t === 'install' && a.from === 'hand'),
    );
    const sample: (PlaceAction | InstallAction | RenovateAction)[] = [];
    const reserve = plays.filter((p) => p.t === 'place' && p.from === 'reserve');
    const installs = plays.filter((p) => p.t === 'install');
    const renovations = plays.filter((p) => p.t === 'renovate');
    if (reserve.length > 0) sample.push(rng.pick(reserve));
    if (installs.length > 0) sample.push(rng.pick(installs));
    if (renovations.length > 0) sample.push(rng.pick(renovations));
    for (let k = 0; k < 2 && plays.length > 0; k++) sample.push(rng.pick(plays));
    s.supplies.forEach((sup, i) => {
      if (sup.kind !== 'fixture') return;
      const hosts = rules.installHosts(s, 'supplies', i);
      if (hosts.length > 0)
        sample.push({ t: 'install', from: 'supplies', i, uid: rng.pick(hosts) });
    });
    // cardFits and reserveFits agree with the plays listed. A card that can only renovate
    // doesn't fit (D-070), so Renovations don't count here.
    const fits = plays.filter((p) => p.t !== 'renovate');
    s.hand.forEach((_, i) => {
      const listed = fits.some((p) => p.from === 'hand' && p.i === i);
      if (rules.cardFits(s, i) !== listed)
        this.fail('cardFits disagrees with legalPlays', { i, listed });
    });
    s.reserve.forEach((_, i) => {
      const listed = fits.some((p) => p.from === 'reserve' && p.i === i);
      if (rules.reserveFits(s, i) !== listed)
        this.fail('reserveFits disagrees with legalPlays', { i, listed });
    });
    if (sample.length === 0) return;
    const pass = passTally(s);
    if (!pass) return this.fail('a pass made no tally');
    for (const play of sample) this.checkPlay(s, play, pass);
  }

  checkPlay(s: RunState, play: PlaceAction | InstallAction | RenovateAction, pass: Tally) {
    const free = (play.t === 'install' && play.from === 'supplies') || s.freePlay === 'ready';
    const kind = `${play.t}:${play.from}${s.freePlay === 'ready' ? ':free' : ''}`;
    this.see(`check:preview:${kind}`);
    const p = rules.preview(s, play);
    if (!p.legal) return this.fail('a listed play previews as illegal', { play, reason: p.reason });
    if (p.xMults.length > 0) this.see('check:preview:xMult');
    if (s.timedEffects.length > 0) this.see('check:preview:timedEffect');
    if (s.freePlay === 'ready') this.see('check:preview:free');
    const { state: s2, events } = rules.apply(s, play);
    const real = free ? rules.currentTally(s2) : tallyEvent(events)?.tally;
    if (!real) return this.fail('a week-ending play made no tally', play);
    const ws = (t: { points: number; mult: number; total: number }) => [t.points, t.mult, t.total];
    if (J(ws(p.before)) !== J(ws(pass))) {
      this.fail('preview.before differs from a pass', { play, before: p.before, pass: ws(pass) });
    }
    if (J(ws(p.after)) !== J(ws(real))) {
      this.fail('preview.after differs from the tally', { play, after: p.after, real: ws(real) });
    }
    if (p.delta !== real.total - pass.total)
      this.fail('preview.delta is off', { play, delta: p.delta });
    // D-122: the board names a cause from the parts, so they add up to the delta exactly,
    // biggest first, with no empty parts.
    const sum = p.parts.reduce((n, x) => n + x.wow, 0);
    const sorted = p.parts.every(
      (x, k) => k === 0 || Math.abs(p.parts[k - 1]!.wow) >= Math.abs(x.wow),
    );
    if (
      sum !== p.delta ||
      !sorted ||
      p.parts.some((x) => x.wow === 0 || !Number.isInteger(x.wow))
    ) {
      this.fail('preview.parts disagree with the delta', { play, delta: p.delta, parts: p.parts });
    }
    if (p.budgetAfter !== real.budget) {
      this.fail('preview.budgetAfter differs from the tally', {
        play,
        p: p.budgetAfter,
        real: real.budget,
      });
    }
    if (rules.scoreOnly(s, play) !== p.after.total)
      this.fail('scoreOnly differs from preview', play);
    // M4b: the preview warns of exactly the restriction the placement breaks.
    const broke = events.find((e) => e.t === 'changeOrderBroken');
    if ((broke?.t === 'changeOrderBroken' ? broke.id : undefined) !== p.breaks) {
      this.fail('preview.breaks disagrees with apply', { play, breaks: p.breaks });
    }
    if (p.breaks) this.see('check:preview:breaks');
    // Breakdown lines: exactly the pieces whose earnings change, the new or host piece included.
    const was = new Map(pass.pieces.map((x) => [x.uid, x.earned]));
    const changed = new Set(
      real.pieces.filter((x) => was.get(x.uid) !== x.earned).map((x) => x.uid),
    );
    // The preview always lists its focus: the new piece, an install's host, or the renovated
    // room (whose earnings may not change: a Sunny room earns Count Vladislav nothing).
    if (play.t === 'install' || play.t === 'renovate') changed.add(play.uid);
    else if (real.pieces.some((x) => x.uid === s.house.nextUid)) changed.add(s.house.nextUid);
    const listed = p.lines.map((l) => l.uid).sort((x, y) => x - y);
    const want = [...changed].sort((x, y) => x - y);
    if (J(listed) !== J(want))
      this.fail('preview.lines differ from the changed pieces', { play, listed, want });
  }

  /** previewTool and canUseTool against using it; a use is a free action. */
  checkTools(s: RunState, rng: Rng) {
    s.supplies.forEach((sup, i) => {
      if (sup.kind !== 'tool') return;
      const use = CONTENT.tools[sup.id].use.kind;
      const targets: UseToolAction[] = [];
      if (use === 'copy') {
        for (const p of s.house.pieces.slice(0, 2))
          targets.push({ t: 'useTool', i, target: { uid: p.uid } });
        targets.push({ t: 'useTool', i });
      } else if (use === 'move') {
        const move = findMove(rules, s, i, rng);
        if (move) targets.push(move);
        const p = s.house.pieces[0];
        // Onto the street row's far corner: usually illegal, so the refusal is checked too.
        if (p)
          targets.push({
            t: 'useTool',
            i,
            target: { uid: p.uid, x: 0, y: s.house.lot.height - 1, rot: 0 },
          });
      } else targets.push({ t: 'useTool', i });
      for (const a of targets) this.checkTool(s, a, use);
    });
  }

  checkTool(s: RunState, a: UseToolAction, use: ToolUse['kind']) {
    const tp = rules.previewTool(s, a);
    const can = rules.canUseTool(s, a);
    const ok = accepts(s, a);
    if (typeof ok === 'string') return this.fail('a tool use threw a non-IllegalAction', { a, ok });
    if (tp.ok !== can.ok || can.ok !== ok) {
      return this.fail('previewTool, canUseTool, and apply disagree', {
        a,
        preview: tp.ok,
        can: can.ok,
        ok,
      });
    }
    if (!ok) return this.see(`check:toolRefused:${use}`);
    this.see(`check:previewTool:${use}`);
    const pass = passTally(s);
    const s2 = rules.apply(s, a).state;
    if (pass && tp.before.total !== pass.total) {
      this.fail('previewTool.before differs from a pass', {
        a,
        before: tp.before.total,
        pass: pass.total,
      });
    }
    const after = isBuild(s2) ? passTally(s2) : undefined;
    if (after && tp.after.total !== after.total) {
      this.fail('previewTool.after differs from a pass after the use', {
        a,
        after: tp.after.total,
        real: after.total,
      });
    }
    // §9: a free action. Only the Catalog redraws the hand (as the week's next draw).
    const clock = (x: RunState) => [x.screen, x.week, x.slot, x.phase, x.overtimeWeek];
    if (J(clock(s2)) !== J(clock(s)))
      this.fail('a tool use moved the week', { a, from: clock(s), to: clock(s2) });
    const catalog = use === 'specialHand';
    if (s2.draws !== s.draws + (catalog ? 1 : 0)) this.fail('a tool use changed the draws', a);
    if (!catalog && J(s2.hand) !== J(s.hand)) this.fail('a tool use changed the hand', a);
    // Next week's first hand is the same with or without it (when both reach the same week).
    const next = (x: RunState) => rules.apply(x, { t: 'pass' });
    const n1 = next(s);
    const n2 = next(s2);
    if (isBuild(n1.state) && isBuild(n2.state) && J(clock(n1.state)) === J(clock(n2.state))) {
      this.see(`check:nextHand:${use}`);
      const h1 = firstHand(n1.events);
      const h2 = firstHand(n2.events);
      if (J(h1) !== J(h2)) this.fail('a tool use changed next week’s first hand', a);
    }
  }

  /** previewDemolish against demolishing: a listed target, and a random tile. */
  checkDemolish(s: RunState, legal: readonly Action[], rng: Rng) {
    const { width, height } = s.house.lot;
    const spots: { x: number; y: number }[] = [{ x: rng.int(width), y: rng.int(height) }];
    const listed = legal.filter((a) => a.t === 'demolish');
    if (listed.length > 0) spots.push(rng.pick(listed));
    for (const { x, y } of spots) {
      const d = rules.previewDemolish(s, x, y);
      const a: Action = { t: 'demolish', x, y };
      const ok = accepts(s, a);
      if (typeof ok === 'string')
        return this.fail('a demolish threw a non-IllegalAction', { a, ok });
      if (d.legal !== ok) {
        this.fail('previewDemolish and apply disagree', {
          a,
          preview: d.legal,
          reason: d.reason,
          ok,
        });
        continue;
      }
      if (!ok) continue;
      this.see('check:previewDemolish');
      const after = passTally(rules.apply(s, a).state);
      if (after && d.after.total !== after.total) {
        this.fail('previewDemolish.after differs from a pass after it', {
          a,
          d: d.after.total,
          real: after.total,
        });
      }
    }
  }

  checkBuildQueries(s: RunState) {
    const agree = (name: string, ok: boolean, a: Action) => {
      const applied = accepts(s, a);
      if (applied !== ok) this.fail(`${name} disagrees with apply`, { ok, applied });
    };
    agree('canReroll', rules.canReroll(s).ok, { t: 'reroll' });
    agree('canCompleteEarly', rules.canCompleteEarly(s).ok, { t: 'completeEarly' });
  }

  /** M4b: the change-order queries agree with the screen, the state, and apply(). */
  checkOrderQueries(s: RunState, legal: readonly Action[]) {
    const offer = rules.changeOrderOffer(s);
    if ((offer !== null) !== (s.screen === 'changeOrder')) {
      this.fail('changeOrderOffer disagrees with the screen', { offer: offer?.id });
    }
    const running = s.changeOrders.filter((r) => r.result === undefined && r.answer !== 'declined');
    const active = rules.activeChangeOrders(s);
    if (J(active.map((v) => v.id)) !== J(running.map((r) => r.id))) {
      this.fail(
        'activeChangeOrders disagrees with the state',
        active.map((v) => v.id),
      );
    }
    if (active.length > 0) this.see('check:activeChangeOrders');
    if (!offer) return;
    this.see('check:changeOrderOffer');
    const declines = legal.some((a) => a.t === 'answerChangeOrder' && !a.accept);
    const declined = accepts(s, { t: 'answerChangeOrder', accept: false });
    if (declines !== offer.declinable || declined !== offer.declinable) {
      this.fail('the offer, legalActions, and apply disagree on declining', {
        id: offer.id,
        declines,
        declined,
      });
    }
  }

  checkShopQueries(s: RunState) {
    if (s.screen !== 'shop' || s.offers?.pick) return;
    this.see('check:shopQueries');
    const refresh = rules.canRefresh(s);
    if (accepts(s, { t: 'refreshShop' }) !== refresh.ok)
      this.fail('canRefresh disagrees with apply');
    const strikes = rules.strikeOptions(s);
    for (const o of rules.shopOffers(s)) {
      const strike = o.offer.kind === 'service' && o.offer.service === 'strike';
      if (strike && strikes.length === 0) continue;
      const a: Action = strike ? { t: 'buy', i: o.i, strike: strikes[0]! } : { t: 'buy', i: o.i };
      const ok = accepts(s, a);
      if (ok !== o.ok)
        this.fail('shopOffers disagrees with apply', {
          i: o.i,
          offer: o.offer,
          view: o.ok,
          reason: o.reason,
          ok,
        });
    }
  }

  /** Actions that can't be legal must throw IllegalAction; the rest may apply or throw it. */
  checkMalformed(s: RunState) {
    const hand = s.hand.length;
    const sup = s.supplies.length;
    const strikeAt =
      s.offers?.shop?.offers.findIndex((o) => o.kind === 'service' && o.service === 'strike') ?? -1;
    const never: unknown[] = [
      { t: 'place', from: 'hand', i: hand + 2, x: 0, y: 0, rot: 0 },
      { t: 'place', from: 'reserve', i: s.reserve.length, x: 0, y: 0, rot: 0 },
      { t: 'place', from: 'hand', i: 0, x: -1, y: 0, rot: 0 },
      { t: 'place', from: 'hand', i: 0, x: 0.5, y: 0, rot: 0 },
      { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 7 },
      { t: 'place', from: 'nowhere', i: 0, x: 0, y: 0, rot: 0 },
      { t: 'place', from: 'hand', i: '0', x: 0, y: 0, rot: 0 },
      { t: 'install', from: 'hand', i: -1, uid: 1 },
      { t: 'install', from: 'supplies', i: sup, uid: 1 },
      { t: 'install', from: 'supplies', i: 0, uid: 99_999 },
      { t: 'useTool', i: sup + 1 },
      { t: 'useTool', i: 0.5 },
      { t: 'sell', from: 'blueprints', i: s.blueprints.length },
      { t: 'sell', from: 'supplies', i: -1 },
      { t: 'sell', from: 'elsewhere', i: 0 },
      { t: 'buy', i: 999 },
      { t: 'buy', i: -1 },
      { t: 'pick', i: 99 },
      { t: 'demolish', x: -1, y: -1 },
      { t: 'demolish', x: 1.5, y: 0 },
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'zzz' } },
      { t: 'debug', op: 'giveGood', good: null },
      { t: 'debug', op: 'giveGood', good: { kind: 'nothing', id: 'bedroom' } },
      { t: 'debug', op: 'giveCard', id: 'nope' },
      { t: 'debug', op: 'addBudget', amount: 1.5 },
      { t: 'debug', op: 'addScore', amount: Number.NaN },
      { t: 'debug', op: 'teleport' },
      { t: 'nonsense' },
      // M4b.
      { t: 'answerChangeOrder', accept: 'yes' },
      { t: 'debug', op: 'forceChangeOrder', id: 'nope' },
      { t: 'debug', op: 'forceArrival', id: 'nobody' },
      ...(s.screen === 'changeOrder'
        ? [{ t: 'leaveShop' }, { t: 'buy', i: 0 }, { t: 'sell', from: 'supplies', i: 0 }]
        : [{ t: 'answerChangeOrder', accept: true }]),
      ...(strikeAt >= 0 ? [{ t: 'buy', i: strikeAt, strike: { kind: 'piece', id: 'nope' } }] : []),
      // The wrong screen.
      ...(isBuild(s)
        ? [{ t: 'leaveShop' }, { t: 'refreshShop' }, { t: 'buy', i: 0 }, { t: 'pick', i: 0 }]
        : [
            { t: 'pass' },
            { t: 'reroll' },
            { t: 'completeEarly' },
            { t: 'useTool', i: 0 },
            { t: 'demolish', x: 0, y: 0 },
          ]),
    ];
    const maybe: unknown[] = [
      { t: 'useTool', i: 0, target: { uid: 99_999, x: 0, y: 0, rot: 0 } },
      { t: 'useTool', i: 0, target: { uid: 'x' } },
      { t: 'buy', i: 0, strike: { kind: 'piece', id: 'nope' } },
      { t: 'pick', i: -1 },
      { t: 'place', from: 'hand', i: 0, x: 0, y: 0 },
    ];
    for (const bad of never) {
      this.see('check:malformed');
      const ok = accepts(s, bad as Action);
      if (ok !== false)
        this.fail('a malformed action was not refused with IllegalAction', { bad, ok });
    }
    for (const odd of maybe) {
      const ok = accepts(s, odd as Action);
      if (typeof ok === 'string') this.fail('an odd action threw a non-IllegalAction', { odd, ok });
    }
  }

  /** A sample of the listed legal actions all apply. */
  checkListed(s: RunState, legal: readonly Action[], rng: Rng) {
    for (let k = 0; k < 3 && legal.length > 0; k++) {
      const a = rng.pick(legal);
      const ok = accepts(s, a);
      if (ok !== true) this.fail('a listed legal action was refused', { a, ok });
    }
  }

  /** The state after `a` (null for the run's first state, with prev the same state). */
  invariants(s: RunState, prev: RunState, a: Action | null, events: readonly GameEvent[]) {
    const bad = badValues(s);
    if (bad.length > 0) this.fail('bad values in the state', bad);
    for (const k of [
      'score',
      'budget',
      'budgetEarned',
      'demolitionsLeft',
      'rerollsLeft',
      'bonusRerolls',
      'overtimeLeft',
      'week',
      'draws',
    ] as const) {
      const v = s[k];
      if (!Number.isInteger(v) || v < 0) this.fail(`${k} is not a whole number >= 0`, v);
    }
    if (s.phase < 0 || s.phase >= CONTENT.balance.phases.length)
      this.fail('phase out of range', s.phase);
    if (s.score < prev.score && a?.t !== 'debug')
      this.fail('the score fell', { from: prev.score, to: s.score });
    if (s.week < prev.week) this.fail('the week went back', { from: prev.week, to: s.week });
    if (s.milestones.length < prev.milestones.length) this.fail('a milestone record vanished');
    if (s.screen === 'build' || s.screen === 'shop' || s.screen === 'changeOrder') {
      const slots = rules.slots(s);
      if (s.supplies.length > slots.supplies)
        this.fail('supplies over their slots', [s.supplies.length, slots]);
      // A crew's and an arrival's cards sit in extra slots (M4b).
      if (s.reserve.filter((r) => !r.crew && !r.arrival).length > slots.reserve)
        this.fail('reserve over its slots');
      if (s.blueprints.length > slots.blueprints)
        this.fail('blueprints over their slots', [s.blueprints.length, slots]);
    }
    if (s.screen === 'shop' && !s.offers?.shop) this.fail('the shop screen has no visit');
    if ((s.screen === 'changeOrder') !== !!s.offers?.changeOrder) {
      this.fail('a change order offer off its screen, or the screen without one');
    }
    // M4b: each member arrives once, and nothing draws, sells, or copies a member's room.
    if (new Set(s.arrived).size !== s.arrived.length) this.fail('a member arrived twice');
    for (const e of events) {
      if (e.t === 'handDrawn') {
        for (const c of e.hand) {
          if (c.kind === 'piece' && CONTENT.pieces[c.id].member) this.fail('a member’s room drawn');
        }
      }
      if (e.t === 'shopOpened' || e.t === 'shopRefreshed') {
        for (const o of e.offers) {
          if (o.kind === 'piece' && CONTENT.pieces[o.id].member)
            this.fail('a member’s room for sale');
        }
      }
      if (e.t === 'crateOpened') {
        for (const o of e.options) {
          if (o.kind === 'piece' && CONTENT.pieces[o.id].member)
            this.fail('a member’s room in a crate');
        }
      }
    }
    if (new Set(s.blueprints.map((b) => b.id)).size !== s.blueprints.length)
      this.fail('a blueprint twice');
    if (new Set(s.upgrades).size !== s.upgrades.length) this.fail('an upgrade twice');
    // The house.
    const { lot, pieces, nextUid } = s.house;
    const at = new Map<number, number>();
    const uids = new Set<number>();
    for (const p of pieces) {
      if (uids.has(p.uid) || p.uid >= nextUid) this.fail('a bad uid', p.uid);
      uids.add(p.uid);
      const def = CONTENT.pieces[p.defId];
      for (const c of placedCells(p.shape ?? def.shape, p.x, p.y, p.rot)) {
        if (c.x < 0 || c.y < 0 || c.x >= lot.width || c.y >= lot.height) {
          this.fail('a piece off the lot', p);
          continue;
        }
        const i = c.y * lot.width + c.x;
        if (at.has(i)) this.fail('pieces overlap', [at.get(i), p.uid]);
        at.set(i, p.uid);
        const t = lot.terrain[i];
        if (t && CONTENT.features[t].blocks && !(def.canCover ?? []).includes(t)) {
          this.fail('a piece on blocking terrain', { piece: p.defId, terrain: t });
        }
      }
      if (p.fixture && !Object.hasOwn(CONTENT.fixtures, p.fixture.id))
        this.fail('an unknown fixture', p.fixture);
    }
    // The tallies' arithmetic.
    for (const e of events) {
      if (e.t === 'tally') this.tallyArithmetic(e);
      if (e.t === 'runEnded' && s.screen !== e.result)
        this.fail('runEnded on a running screen', s.screen);
    }
    if ((s.screen === 'won' || s.screen === 'lost') && !events.some((e) => e.t === 'runEnded')) {
      this.fail('the run ended without a runEnded event');
    }
  }

  tallyArithmetic(e: Tallied) {
    const t = e.tally;
    let points = 0;
    let mult = 100;
    for (const p of t.pieces) points += p.earned;
    for (const set of t.sets) {
      points += set.points;
      mult += set.mult;
    }
    // Each checklist line met adds specBonus (M4a).
    for (const sp of t.specs) if (sp.met) mult += t.specBonus;
    for (const m of t.multTerms) mult += m.add;
    for (const x of t.xMults) {
      if (x.before !== mult) this.fail('a ×Mult starts from the wrong Mult', { x, mult });
      mult = Math.floor((Math.max(0, x.before) * x.times + 50) / 100);
      if (x.after !== mult) this.fail('a ×Mult ends on the wrong Mult', { x, mult });
    }
    const sums = { points: t.points, mult: t.mult, total: t.total };
    if (points !== t.points || mult !== t.mult || t.total !== weekTotal(t.points, t.mult)) {
      this.fail('the tally doesn’t add up', { sums, points, mult });
    }
    if (!Number.isInteger(t.total) || t.total < 0) this.fail('a bad total', t.total);
    if (e.score !== e.scoreBefore + t.total) this.fail('score is not scoreBefore + total');
    if (e.budget !== e.budgetBefore + t.budget)
      this.fail('budget is not budgetBefore + the tally’s');
  }

  /** What the run reached. */
  record(s: RunState, a: Action, events: readonly GameEvent[]) {
    this.see(`action:${a.t}`);
    if (a.t === 'debug') this.see(`debug:${a.op}`);
    if (a.t === 'place' || a.t === 'install' || a.t === 'sell') this.see(`${a.t}:${a.from}`);
    if ((a.t === 'place' || a.t === 'install') && s.freePlay === 'ready') this.see('play:free');
    if (a.t === 'place' && a.from === 'reserve') {
      // M4b: a member's room (D-103) or a crew's starting card, from the extra slots.
      if (s.reserve[a.i]?.arrival) this.see('place:arrival');
      if (s.reserve[a.i]?.crew) this.see('place:crew');
    }
    if (a.t === 'answerChangeOrder') this.see(`answer:${a.accept}`);
    if (a.t === 'useTool') {
      const sup = s.supplies[a.i];
      if (sup?.kind === 'tool') this.see(`toolUse:${CONTENT.tools[sup.id].use.kind}`);
    }
    if (a.t === 'buy') {
      const o = s.offers?.shop?.offers[a.i];
      if (o) this.see(`buy:${offerKind(o)}`);
    }
    for (const e of events) {
      this.see(`event:${e.t}`);
      if (e.t === 'milestone') this.see(`milestone:${e.result}`);
      if (e.t === 'shopOpened') this.see(`shop:${e.number}`);
      if (e.t === 'tally' && e.fastForward) this.see('tally:fastForward');
      if (e.t === 'tally' && e.tally.xMults.length > 0) this.see('tally:xMult');
      if (e.t === 'crateOpened') this.see(`crate:${e.source}`);
      if (e.t === 'runEnded') this.see(`result:${e.result}`);
      if (e.t === 'changeOrderOffered') this.see(`changeOrder:${e.kind}`);
      if (e.t === 'changeOrderResolved') this.see(`changeOrder:${e.result}`);
      if (e.t === 'arrived') this.see(e.forced ? 'arrived:forced' : 'arrived:due');
    }
  }
}

function play({ seed, cheat, gifts, clientId, crewId }: Seed): Played {
  let sim: ReturnType<typeof simulateRun>;
  try {
    sim = simulateRun(rules, seed, makeChaos({ cheat, gifts }), {
      probePhase: null,
      ...(clientId ? { clientId } : {}),
      ...(crewId ? { crewId } : {}),
    });
  } catch (e) {
    if (e instanceof SimError)
      throw new Error(`${e.message}\nrun code: ${e.runCode}`, { cause: e });
    throw e;
  }
  const { actions, state } = sim;
  const checker = new Checker(seed);
  let s = rules.newRun(setupOf(seed, clientId, crewId));
  checker.first(s);
  actions.forEach((a, n) => (s = checker.step(s, a, n)));
  if (J(s) !== J(state)) checker.fail('the walk ended somewhere other than the sim');
  return { seed, actions, state, problems: checker.problems, seen: checker.seen };
}

const memo = new Map<string, Played>();
const played = (run: Seed): Played => {
  let p = memo.get(run.seed);
  if (!p) memo.set(run.seed, (p = play(run)));
  return p;
};

const prefixed = (prefix: string, names: readonly string[]) => names.map((n) => `${prefix}:${n}`);

/** What the runs must reach between them. */
const COVERAGE: readonly string[] = [
  ...prefixed('action', keys(ACTION_KINDS)),
  ...prefixed('debug', keys(DEBUG_OPS)),
  ...prefixed('toolUse', keys(TOOL_USES)),
  ...prefixed('milestone', keys(RESULTS)),
  ...prefixed('buy', keys(OFFER_KINDS)),
  ...prefixed('shop', ['1', '2', '3', '4', '5', '6']),
  ...prefixed('result', ['won', 'lost']),
  ...prefixed('place', ['hand', 'reserve']),
  ...prefixed('install', ['hand', 'supplies']),
  ...prefixed('sell', ['blueprints', 'supplies']),
  ...prefixed('crate', [...keys(CONTENT.crates), 'housewarming']),
  ...prefixed('play', ['free']),
  ...prefixed('tally', ['fastForward', 'xMult']),
  ...prefixed('event', ['moved', 'demolished', 'transformed', 'findClaimed', 'overtimeUsed']),
  // M4b: every crew and client, change orders of each kind answered both ways (a phase effect
  // only one way), resolved, and the household's arrivals, due and forced, played.
  ...prefixed('crew', keys(CONTENT.crews)),
  ...prefixed('client', keys(CONTENT.clients)),
  ...prefixed('changeOrder', ['request', 'restriction', 'phase', 'missed', 'ended']),
  ...prefixed('answer', ['true', 'false']),
  ...prefixed('event', ['changeOrderAnswered', 'changeOrderResolved']),
  ...prefixed('arrived', ['due', 'forced']),
  ...prefixed('place', ['arrival', 'crew']),
];

/** The kinds of check that must each have run. */
const CHECKS: readonly string[] = [
  'check:preview:place:hand',
  'check:preview:place:reserve',
  'check:preview:install:hand',
  'check:preview:install:supplies',
  'check:preview:renovate:hand',
  'check:preview:free',
  'check:preview:xMult',
  'check:preview:timedEffect',
  'check:previewDemolish',
  'check:shopQueries',
  'check:malformed',
  ...keys(TOOL_USES).map((k) => `check:previewTool:${k}`),
  'check:toolRefused:move',
  'check:changeOrderOffer',
  'check:activeChangeOrders',
];

/**
 * Extra seeds the coverage tests may play, in order, when the fixed ones fall short of COVERAGE
 * or CHECKS. A content change reshuffles every run, and a rarely reached item (a Copy Machine
 * use, a find) can drop out without anything being broken; the next seeds usually bring it
 * back. Each extra run is checked step by step like the fixed ones. Past this many, coverage
 * really has fallen: look at the chaos bot.
 */
// M4b's balance moved a Weekend Crew free play past the first six extra seeds.
const MAX_EXTRA = 16;

let coverage: { runs: Played[]; missing: string[] } | null = null;
function covered(): { runs: Played[]; missing: string[] } {
  if (coverage) return coverage;
  const runs = SEEDS.map(played);
  const seen = new Set<string>();
  const missing = () => [...COVERAGE, ...CHECKS].filter((k) => !seen.has(k));
  for (const r of runs) for (const k of r.seen.keys()) seen.add(k);
  for (let k = 0; k < MAX_EXTRA && missing().length > 0; k++) {
    const r = played({
      seed: `chaos-extra-${k}`,
      cheat: true,
      clientId: CLIENTS[(k + 3) % CLIENTS.length]!,
      crewId: CREWS[(k + 1) % CREWS.length]!,
    });
    runs.push(r);
    for (const key of r.seen.keys()) seen.add(key);
  }
  return (coverage = { runs, missing: missing() });
}

describe('the chaos bot on the real content', () => {
  it.each(SEEDS)(
    '$seed: every step checks out, and the run replays',
    (entry) => {
      const run = played(entry);
      const setup = setupOf(entry.seed, entry.clientId, entry.crewId);
      const code = encodeRunCode({
        build: 'test',
        contentHash: contentHash(CONTENT),
        setup,
        actions: run.actions,
      });
      expect(run.problems, `run code: ${code}`).toEqual([]);
      expect(['won', 'lost']).toContain(run.state.screen);
      // rules.replay and the run code reach the same state.
      const replayed = rules.replay(setup, run.actions);
      expect(replayed.failedAt).toBeUndefined();
      expect(replayed.state).toEqual(run.state);
      const decoded = decodeRunCode(code);
      if (!decoded.ok) throw new Error(decoded.error);
      expect(decoded.data.actions).toEqual(run.actions);
      const fromCode = rules.replay(decoded.data.setup, decoded.data.actions);
      expect(fromCode.failedAt).toBeUndefined();
      expect(fromCode.state).toEqual(run.state);
    },
    30_000,
  );

  it('reaches every action, tool use, milestone result, good, and shop, a win and a loss', () => {
    const { runs, missing } = covered();
    expect(missing.filter((k) => !k.startsWith('check:'))).toEqual([]);
    // Any extra seeds played for coverage pass the same step checks.
    for (const r of runs.slice(SEEDS.length)) expect(r.problems, r.seed).toEqual([]);
  }, 60_000);

  it('ran each kind of check', () => {
    expect(covered().missing.filter((k) => k.startsWith('check:'))).toEqual([]);
  }, 60_000);
});
