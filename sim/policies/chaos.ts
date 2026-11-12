// The chaos bot (§9, "the rules are sound on the real content"): it plays every kind of action
// the rules have, debug cheats included, so a test reaches states no sensible bot would: every
// tool, crate, upgrade, and service, both kinds of reserve and supply play, early completion
// and its fast-forward, overtime, the loss, and with its cheats all seven phases and the six
// shops. It isn't trying to win, and its runs say nothing about balance. sim/chaos.test.ts
// drives it through simulateRun (so the step caps apply) and checks every step it takes.
// M4b: it answers change orders at random (now and then forcing one mid-week), plays the
// household's arrivals from the reserve (now and then forcing one early), and the test runs
// it with every crew and client.
//
// It picks a kind of action first and an action of that kind second, so a kind with many
// listed actions (a placement at every spot, a strike per hand card) can't crowd out the rest.
// Now and then it picks a kind it hasn't used yet this run. Its cheats keep the run going: in
// a phase's last week (and each overtime week) an addScore covers the shortfall most of the
// time, a rare one mid-phase opens early completion, addBudget keeps it shopping, and giveGood
// hands it goods the shop might never offer. With `cheat: false` it never adds score, so it
// plays on to a loss. After FREE_PER_WEEK free actions in a week it only ends the week, and
// after SHOP_STEPS actions in a visit it leaves, so runs stay short.
//
// Each makeChaos() keeps a little memory (actions this week, kinds used and goods given this
// run), so give each run its own; its choices still depend only on the states it's shown and
// its keyed stream.

import type {
  Action,
  ChangeOrderId,
  DebugAction,
  Good,
  Rng,
  Rules,
  RunState,
  ShopOffer,
  UseToolAction,
} from '../../src/rules/index.ts';
import { inExtraSlot } from '../../src/rules/index.ts';
import type { Policy } from './index.ts';

export interface ChaosOptions {
  /** Cover a phase's shortfall with addScore cheats, so the run goes on (default true). */
  cheat?: boolean;
  /**
   * Goods given (debug giveGood) on the first build screens, one per action, before anything
   * else: a way to make sure a run holds goods it would rarely be handed at random, such as
   * the ×Mult blueprints, whose conditions random play seldom meets.
   */
  gifts?: readonly Good[];
}

/** Free actions in one week before the bot only ends the week. */
export const FREE_PER_WEEK = 10;
/** Actions in one shop visit before the bot only leaves. */
export const SHOP_STEPS = 25;
/** Tries at a random nearby spot for a Moving Truck target. */
const MOVE_TRIES = 40;

interface Group {
  /** The kind it counts as for "not used yet this run"; null for kinds left to their weight. */
  kind: string | null;
  weight: number;
  actions: readonly Action[];
}

/** A shop offer's kind for grouping: services split by service. */
export const offerKind = (o: ShopOffer) => (o.kind === 'service' ? `service:${o.service}` : o.kind);

/** Goods giveGood would accept now: where buying them would put them has room. */
function goodsNow(rules: Rules, s: RunState): Good[] {
  const c = rules.content;
  const slots = rules.slots(s);
  const out: Good[] = [];
  if (s.blueprints.length < slots.blueprints) {
    for (const id of Object.values(c.blueprints).map((d) => d.id)) {
      if (!s.blueprints.some((b) => b.id === id)) out.push({ kind: 'blueprint', id });
    }
  }
  if (s.reserve.filter((r) => !inExtraSlot(r)).length < slots.reserve) {
    for (const d of Object.values(c.pieces)) {
      // Special pieces; a member's room (M4b) only ever arrives with its member.
      if (d.drawWeight === 0 && !d.member) out.push({ kind: 'piece', id: d.id });
    }
  }
  if (s.supplies.length < slots.supplies) {
    for (const d of Object.values(c.fixtures)) out.push({ kind: 'fixture', id: d.id });
    // Tools twice over: they're the goods with the most rules to exercise.
    for (const d of Object.values(c.tools))
      out.push({ kind: 'tool', id: d.id }, { kind: 'tool', id: d.id });
  }
  for (const d of Object.values(c.upgrades)) {
    if (!s.upgrades.includes(d.id)) out.push({ kind: 'upgrade', id: d.id });
  }
  if (s.screen === 'build') {
    for (const d of Object.values(c.fixtures)) out.push({ kind: 'fixtureCard', id: d.id });
  }
  return out;
}

const goodName = (g: Good) => `${g.kind}:${g.id}`;

/** A legal Moving Truck use: a random piece to a random spot near it, or null. */
export function findMove(rules: Rules, s: RunState, i: number, rng: Rng): UseToolAction | null {
  const { pieces, lot } = s.house;
  if (pieces.length === 0) return null;
  for (let k = 0; k < MOVE_TRIES; k++) {
    const p = rng.pick(pieces);
    const x = Math.min(lot.width - 1, Math.max(0, p.x + rng.range(-4, 4)));
    const y = Math.min(lot.height - 1, Math.max(0, p.y + rng.range(-4, 4)));
    const a: UseToolAction = {
      t: 'useTool',
      i,
      target: { uid: p.uid, x, y, rot: rng.pick([0, 1, 2, 3] as const) },
    };
    if (rules.canUseTool(s, a).ok) return a;
  }
  return null;
}

const debug = (a: DebugAction): Action => a;

function buildGroups(
  rules: Rules,
  s: RunState,
  rng: Rng,
  steps: number,
  given: ReadonlySet<string>,
): Group[] {
  const c = rules.content;
  const legal = rules.legalActions(s);
  const of = (f: (a: Action) => boolean) => legal.filter(f);
  // Past FREE_PER_WEEK free actions, ending the week swamps everything else.
  const end = steps >= FREE_PER_WEEK ? 1000 : 1;
  // Tools by use kind, so each kind counts as its own for "not used yet this run".
  const tools = new Map<string, Action[]>();
  const addTool = (i: number, a: Action) => {
    const sup = s.supplies[i]!;
    const k = `useTool:${sup.kind === 'tool' ? c.tools[sup.id].use.kind : '?'}`;
    tools.set(k, [...(tools.get(k) ?? []), a]);
  };
  for (const a of legal) if (a.t === 'useTool') addTool(a.i, a);
  s.supplies.forEach((sup, i) => {
    if (sup.kind !== 'tool' || c.tools[sup.id].use.kind !== 'move') return;
    const move = findMove(rules, s, i, rng);
    if (move) addTool(i, move);
  });
  // Goods not given yet this run first, so a run's cheats spread over the goods (×Mult ones
  // included) instead of repeating a few.
  const all = goodsNow(rules, s);
  const fresh = all.filter((g) => !given.has(goodName(g)));
  const goods = fresh.length > 0 ? fresh : all;
  const pieceIds = Object.values(c.pieces).map((d) => d.id);
  const orderIds = Object.values(c.changeOrders).map((d) => d.id);
  // This household's members still to come.
  const arrivals = c.clients[s.setup.clientId].household.arrivals
    .map((a) => a.id)
    .filter((id) => !s.arrived.includes(id));
  return [
    { kind: 'play', weight: 60 * end, actions: of((a) => a.t === 'place') },
    // A hand fixture has a few hosts against a placement's hundreds of spots: its own kind.
    {
      kind: 'install:hand',
      weight: 12 * end,
      actions: of((a) => a.t === 'install' && a.from === 'hand'),
    },
    // A Renovation (M4a), when a card's type is at its limit: a few rooms, like a fixture's hosts.
    { kind: 'renovate', weight: 12 * end, actions: of((a) => a.t === 'renovate') },
    { kind: 'pass', weight: 6 * end, actions: [{ t: 'pass' }] },
    {
      kind: 'install:supplies',
      weight: 16,
      actions: of((a) => a.t === 'install' && a.from === 'supplies'),
    },
    ...[...tools].map(([kind, actions]): Group => ({ kind, weight: 12, actions })),
    { kind: 'sell', weight: 6, actions: of((a) => a.t === 'sell') },
    { kind: 'reroll', weight: 10, actions: of((a) => a.t === 'reroll') },
    // D-157: a strike from the hand, when it holds one and the card's row is above its floor.
    { kind: 'strike', weight: 10, actions: of((a) => a.t === 'strikeCard') },
    { kind: 'completeEarly', weight: 10, actions: of((a) => a.t === 'completeEarly') },
    { kind: 'demolish', weight: 10, actions: of((a) => a.t === 'demolish') },
    {
      kind: 'setAutoComplete',
      weight: 4,
      actions: [{ t: 'setAutoComplete', on: !s.autoComplete }],
    },
    {
      kind: null,
      weight: s.budget < 25 ? 4 : 0,
      actions: [debug({ t: 'debug', op: 'addBudget', amount: rng.range(5, 19) })],
    },
    {
      kind: 'debug:giveGood',
      weight: 16,
      actions:
        goods.length > 0 ? [debug({ t: 'debug', op: 'giveGood', good: rng.pick(goods) })] : [],
    },
    {
      kind: null,
      weight: 2,
      actions: [debug({ t: 'debug', op: 'giveCard', id: rng.pick(pieceIds) })],
    },
    // Opening the shop early is harmless, so it's a kind the bot tries in every run; a forced
    // miss can end the run, so it stays rare.
    { kind: 'debug:forceShop', weight: 1, actions: [debug({ t: 'debug', op: 'forceShop' })] },
    { kind: null, weight: 1, actions: [debug({ t: 'debug', op: 'forceMiss' })] },
    // M4b: a change order now (any one, even one picked before), alone or beside another to
    // pick from (D-144), and a member moving in early.
    {
      kind: 'debug:forceChangeOrder',
      weight: 1,
      actions: [debug(forcedOrder(orderIds, rng))],
    },
    {
      kind: 'debug:forceArrival',
      weight: 1,
      actions: arrivals.map((id) => debug({ t: 'debug', op: 'forceArrival', id })),
    },
  ];
}

/** A forced change order (M4b): one alone, or two different ones to pick from (D-144). */
function forcedOrder(ids: readonly ChangeOrderId[], rng: Rng): DebugAction {
  const id = rng.pick(ids);
  const others = ids.filter((o) => o !== id);
  if (others.length === 0 || rng.chance(50)) return { t: 'debug', op: 'forceChangeOrder', id };
  return { t: 'debug', op: 'forceChangeOrder', id, other: rng.pick(others) };
}

/** On the 'changeOrder' screen (M4b, D-144): a pick, the first order or the second at random. */
function orderGroups(rules: Rules, s: RunState): Group[] {
  const legal = rules.legalActions(s);
  const answer = (i: number) => legal.filter((a) => a.t === 'answerChangeOrder' && a.i === i);
  return [
    { kind: 'answer:first', weight: 10, actions: answer(0) },
    { kind: 'answer:second', weight: 10, actions: answer(1) },
    { kind: null, weight: 1, actions: [{ t: 'setAutoComplete', on: !s.autoComplete }] },
  ];
}

function shopGroups(rules: Rules, s: RunState, rng: Rng, steps: number): Group[] {
  const legal = rules.legalActions(s);
  const sells = legal.filter((a) => a.t === 'sell');
  // An open crate waits for its pick (or a discard); selling to make room is allowed.
  if (s.offers?.pick) {
    return [
      { kind: 'pick', weight: 20, actions: legal.filter((a) => a.t === 'pick') },
      { kind: 'sell', weight: 1, actions: sells },
    ];
  }
  const offers = s.offers?.shop?.offers ?? [];
  const byKind = new Map<string, Action[]>();
  for (const a of legal) {
    if (a.t !== 'buy') continue;
    const k = `buy:${offerKind(offers[a.i]!)}`;
    byKind.set(k, [...(byKind.get(k) ?? []), a]);
  }
  return [
    ...[...byKind].map(([kind, actions]): Group => ({ kind, weight: 20, actions })),
    { kind: 'sell', weight: 4, actions: sells },
    { kind: 'refreshShop', weight: 6, actions: legal.filter((a) => a.t === 'refreshShop') },
    { kind: 'leaveShop', weight: steps >= SHOP_STEPS ? 100_000 : 8, actions: [{ t: 'leaveShop' }] },
    {
      kind: null,
      weight: s.budget < 25 ? 8 : 0,
      actions: [debug({ t: 'debug', op: 'addBudget', amount: rng.range(10, 24) })],
    },
  ];
}

/** One group by weight, or (now and then) one whose kind this run hasn't used yet. */
function pickGroup(groups: readonly Group[], used: ReadonlySet<string>, rng: Rng): Group {
  const live = groups.filter((g) => g.weight > 0 && g.actions.length > 0);
  const fresh = live.filter((g) => g.kind !== null && !used.has(g.kind));
  if (fresh.length > 0 && rng.chance(20)) return rng.pick(fresh);
  let r = rng.int(live.reduce((sum, g) => sum + g.weight, 0));
  return live.find((g) => (r -= g.weight) < 0)!;
}

/** A chaos bot for one run. */
export function makeChaos(opts: ChaosOptions = {}): Policy {
  const cheat = opts.cheat ?? true;
  const gifts = opts.gifts ?? [];
  let gifted = 0;
  let seed = '';
  let at = '';
  let steps = 0;
  const used = new Set<string>();
  const given = new Set<string>();
  return {
    name: 'chaos',
    label: cheat ? 'chaos' : 'chaos · no cheats',
    act(rules: Rules, s: RunState, rng: Rng): Action {
      if (s.setup.seed !== seed) {
        seed = s.setup.seed;
        used.clear();
        given.clear();
        gifted = 0;
      }
      if (s.screen === 'build' && gifted < gifts.length) {
        return { t: 'debug', op: 'giveGood', good: gifts[gifted++]! };
      }
      const here = `${s.week}/${s.screen}/${s.offers?.shop?.number ?? 0}`;
      if (here !== at) [at, steps] = [here, 0];
      steps++;
      if (s.screen === 'build' && cheat) {
        const target = rules.target(s);
        const lastWeek = s.slot >= rules.content.balance.weeksPerPhase || s.overtimeWeek > 0;
        if (s.score < target) {
          const short = lastWeek && s.score + rules.scoreOnly(s, null) < target;
          if ((short && rng.chance(85)) || (!lastWeek && rng.chance(2))) {
            return { t: 'debug', op: 'addScore', amount: target - s.score };
          }
        }
      }
      const groups =
        s.screen === 'shop'
          ? shopGroups(rules, s, rng, steps)
          : s.screen === 'changeOrder'
            ? orderGroups(rules, s)
            : buildGroups(rules, s, rng, steps, given);
      const group = pickGroup(groups, used, rng);
      if (group.kind !== null) used.add(group.kind);
      const action = rng.pick(group.actions);
      if (action.t === 'debug' && action.op === 'giveGood') given.add(goodName(action.good));
      return action;
    },
  };
}
