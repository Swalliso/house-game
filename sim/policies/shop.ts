// The shop bot (implementation-plan.md §7 M3b, §8): each offer is valued by one tally with it
// applied, times the weeks left in the run, per unit of budget. It buys the best value while
// the value clears a bar, picks from crates the same way, sells its weakest blueprint to make
// room for a much better one, refreshes once when it's rich and nothing is worth buying, and
// otherwise leaves. The reroll service is worth nothing while it still holds a bonus reroll
// (it used 1 of the 212 it bought in 100 runs when it bought them freely; it still buys about
// one a run, and the state can't tell it whether the last phase ran out). Strikes (D-157) are
// used from the hand only with strikes 'fixed': a card whose type is in STRIKE_ORDER, earliest
// first (strikeAct), and +1 strike is bought only while the bot holds fewer strikes than the
// STRIKE_ORDER types it could still strike. By default it never strikes and never buys one, so
// reports on the struck types aren't the bot's own doing.
//
// During a week it uses tools by simple rules (useTools): Remodel Plans and the Dumpster at
// once, Fertilizer and the Copy Machine when they help, Weekend Crew when a placement would
// help, Rush Order and Open House Party in a phase's last week when it's short of the target
// (or in the run's last week), and a Catalog it was given on a hand with nothing worth
// building. Supply fixtures go in their best host. It never uses the Moving Truck.
//
// A blueprint is valued on the house as it stands, plus a little planning (D-143): one whose
// Mult counts pieces (It's a House, Model Home) is also worth the pieces it expects to add, at
// the rate the draw shows them, and a bonus to a set (Open Concept) is worth something once the
// set is half there, so a build-around isn't worth nothing before the build starts.
//
// Values are rough Wow-over-the-run estimates; the sim reports show what it buys. BOT_BLIND
// lists the goods it values at 0 by construction, so their buy rate isn't read as weakness.
// Options come in through ShopBot, never module state: policies are pure.

import {
  countedSelector,
  countingMod,
  DRAW_ROWS,
  matchesDef,
  rowOf,
  ruleValue,
  totalWithOneMore,
  weekTotal,
  type Action,
  type BlueprintId,
  type InstallAction,
  type OfferView,
  type PickOption,
  type PieceId,
  type Rng,
  type Rules,
  type RunState,
  type Selector,
  type ShopOffer,
  type UseToolAction,
} from '../../src/rules/index.ts';
import { rankPlays, type EarlyMode } from './greedy.ts';

/**
 * Whether the bot uses its strikes (D-157): 'none' never strikes and never buys +1 strike;
 * 'fixed' strikes hand cards by STRIKE_ORDER and buys +1 strike while it's short of them.
 */
export type StrikeMode = 'none' | 'fixed';

/** What the shop and tool rules need from the policy besides its stream: the salt and options. */
export interface ShopBot {
  /** The decision's tie-break salt (greedy draws it once per decision). */
  salt: number;
  strikes?: StrikeMode;
  /** With an early mode, Ahead of Schedule is valued as if one more milestone were early. */
  early?: EarlyMode;
}

/**
 * Goods the shop bot can't value or use, by good key (`tool:movingTruck`), with the reason. The
 * report marks them, so their 0% buy rate reads as the bot's blind spot, not the good's.
 */
export const BOT_BLIND: Readonly<Record<string, string>> = {
  'tool:movingTruck': 'no rule for moving pieces',
  'tool:dumpster': 'never demolishes',
  'service:demolition': 'never demolishes',
  'blueprint:solarPanels': 'values Wow, not budget',
  'blueprint:aheadOfSchedule': 'only with --early',
  // A fair rule needs the special hand's expected best play, which it can't see without
  // peeking at the draw. The old rule (no reroll left and nothing worth building) almost never
  // fired: greedy bought 21 Catalogs in 100 runs and used none. So it's valued at 0, and a
  // Catalog it's given still goes on such a hand.
  'tool:catalog': 'no fair rule for when a special hand beats this one',
  'service:strike': 'only --strikes fixed',
};

/** A good must earn at least this many weeks of current income per budget to be bought. */
const BAR_WEEKS_PER_BUDGET = 0.12;
/** Blueprints keep paying on pieces built later, so their value is scaled up a little. */
const FUTURE_PIECES = 1.25;
/** A reserve piece takes a week's build, so it's worth a share of what it adds. */
const RESERVE_SHARE = 0.5;
/** The share of the cards a counting blueprint counts that the bot expects to build (D-143). */
const TAKE_RATE = 0.5;
/**
 * Pieces a week it expects to add when the draw can't say (Model Home's pieces with a fixture,
 * Mood Lighting's Dark rooms): greedy installs about 3.8 fixtures in a 28-week run.
 */
const UNSEEN_RATE = 0.12;
/**
 * The root types strikes 'fixed' strikes from the hand, earliest first: D-084's order, the types
 * M2's greedy found least worth building. A shape variant goes with its root (D-157).
 */
export const STRIKE_ORDER: readonly PieceId[] = [
  'driveway',
  'fence',
  'hallway',
  'doghouse',
  'sapling',
];

const total = (rules: Rules, s: RunState) => rules.currentTally(s).total;

/** Weeks of the run still to play, this one (or, in the shop, the next phase's first) included. */
export function weeksLeftInRun(rules: Rules, s: RunState): number {
  const b = rules.content.balance;
  return Math.max(1, (b.phases.length - s.phase) * b.weeksPerPhase - (s.slot - 1));
}

function phasesLeft(rules: Rules, s: RunState): number {
  return Math.max(1, rules.content.balance.phases.length - s.phase);
}

/** The state as if a week were being built, with these cards, for valuing pieces and installs. */
function asBuild(s: RunState, patch: Partial<RunState>): RunState {
  return { ...s, screen: 'build', offers: undefined, ...patch };
}

/** The best change to this week's total from placing a piece (the top 8 by rankPlays). */
function bestPlacement(rules: Rules, s: RunState, salt: number): number {
  const plays = rules.legalPlacements(s);
  if (plays.length === 0) return 0;
  const pass = rules.scoreOnly(s, null);
  let best = 0;
  for (const r of rankPlays(rules, s, plays, salt).slice(0, 8)) {
    best = Math.max(best, rules.scoreOnly(s, r.play) - pass);
  }
  return best;
}

/** The best change to this week's total from installing supply 0 in any host. */
function bestInstall(rules: Rules, s: RunState): number {
  const pass = rules.scoreOnly(s, null);
  let best = 0;
  for (const uid of rules.installHosts(s, 'supplies', 0)) {
    const play: InstallAction = { t: 'install', from: 'supplies', i: 0, uid };
    best = Math.max(best, rules.scoreOnly(s, play) - pass);
  }
  return best;
}

/**
 * Cards matching a selector in a week's first hand, on average: each row's share of matching
 * weight times its cards. Rough: the base weights, whatever the phase or the client's pool.
 * It's 0 for pieces a card alone can't tell (a Dark room, a piece with a fixture).
 */
function offeredPerWeek(rules: Rules, s: RunState, sel: Selector): number {
  const c = rules.content;
  let n = 0;
  for (const row of DRAW_ROWS) {
    let all = 0;
    let hit = 0;
    for (const def of Object.values(c.pieces)) {
      if (def.drawWeight <= 0 || rowOf(c, { kind: 'piece', id: def.id }) !== row) continue;
      all += def.drawWeight;
      if (matchesDef(sel, def)) hit += def.drawWeight;
    }
    for (const def of Object.values(c.fixtures)) {
      if (rowOf(c, { kind: 'fixture', id: def.id }) === row) all += def.drawWeight;
    }
    if (all > 0) n += (hit / all) * ruleValue(c, s, row === 'rooms' ? 'roomsRow' : 'layoutRow');
  }
  return n;
}

/**
 * The planning part of a blueprint's value (D-143), with `held` the state with it in play.
 * - A Mult counted per piece: what the pieces it expects to add over the weeks left would pay.
 *   Each adds what one more adds today (its own Comfort aside), they come at an even pace, and
 *   each pays from its week on, so about half the weeks left.
 * - A bonus to a set the house doesn't hold yet (Open Concept's Entertainer): once the house
 *   has at least half the set's member types, it expects the set for half the weeks left, the
 *   surer the more of them it has.
 */
function plannedValue(rules: Rules, held: RunState, id: BlueprintId, left: number): number {
  const c = rules.content;
  const mods = c.blueprints[id].modifiers;
  const tally = rules.currentTally(held);
  let value = 0;
  const counting = countingMod(mods);
  if (counting) {
    const each = totalWithOneMore(tally, id, counting) - tally.total;
    const offered = offeredPerWeek(rules, held, countedSelector(counting));
    const perWeek = offered > 0 ? offered * TAKE_RATE : UNSEEN_RATE;
    if (each > 0) value += (each * perWeek * left * left) / 2;
  }
  for (const m of mods) {
    if (m.kind !== 'setBonus' || !m.set || tally.sets.some((x) => x.set === m.set)) continue;
    const set = c.sets[m.set];
    const types = Object.keys(set.members);
    const built = new Set(held.house.pieces.map((p) => c.pieces[p.defId].countsAs ?? p.defId));
    const have = types.filter((t) => built.has(t as PieceId)).length;
    if (have * 2 < types.length) continue;
    const level = held.setLevels[m.set] ?? 1;
    const points = set.points + (level - 1) * set.level.points;
    const mult = set.mult + (level - 1) * set.level.mult;
    const more = (n: number) => Math.floor((n * (100 + m.pct)) / 100);
    const plain = weekTotal(tally.points + points, tally.mult + mult);
    const boosted = weekTotal(tally.points + more(points), tally.mult + more(mult));
    value += (((boosted - plain) * left) / 2) * (have / types.length);
  }
  return value;
}

type Good = Exclude<ShopOffer, { kind: 'service' }> | PickOption;

/** A good's value in Wow over the rest of the run (rough). */
export function goodValue(rules: Rules, s: RunState, good: Good, rng: Rng, bot: ShopBot): number {
  const c = rules.content;
  const W = c.balance.weeksPerPhase;
  const left = weeksLeftInRun(rules, s);
  const weekly = Math.max(1, total(rules, s));
  switch (good.kind) {
    case 'blueprint': {
      if (s.blueprints.some((b) => b.id === good.id)) return 0;
      // An early-completing bot expects more early milestones (Ahead of Schedule counts them).
      const base =
        (bot.early ?? 'never') === 'never' ? s : { ...s, milestonesEarly: s.milestonesEarly + 1 };
      const withIt = {
        ...base,
        blueprints: [...base.blueprints, { id: good.id, boughtWeek: s.week }],
      };
      const normal = total(rules, withIt) - total(rules, base);
      // Last-Minute Push and other last-week effects pay one week in W.
      const last = total(rules, { ...withIt, slot: W }) - total(rules, { ...base, slot: W });
      let perWeek = ((W - 1) * normal + last) / W;
      // A granted growth timer (Good Bones, Green Thumb) keeps growing, up to its cap: on
      // average it pays what it will halfway through the weeks left, so that week is tallied.
      const grows = c.blueprints[good.id].modifiers.some(
        (m) => m.kind === 'grantEffect' && m.effect.kind === 'growth',
      );
      if (grows) {
        const later = (st: RunState): RunState => ({ ...st, week: st.week + Math.floor(left / 2) });
        perWeek = Math.max(perWeek, total(rules, later(withIt)) - total(rules, later(base)));
      }
      const now = Math.max(0, perWeek) * left * FUTURE_PIECES;
      return now + plannedValue(rules, withIt, good.id, left);
    }
    case 'piece': {
      const b = asBuild(s, { hand: [{ kind: 'piece', id: good.id }], reserve: [] });
      return bestPlacement(rules, b, bot.salt) * left * RESERVE_SHARE;
    }
    case 'fixture': {
      const b = asBuild(s, { supplies: [{ kind: 'fixture', id: good.id }] });
      return bestInstall(rules, b) * left;
    }
    case 'tool': {
      const use = c.tools[good.id].use;
      switch (use.kind) {
        case 'weekModifiers': {
          const t = {
            ...s,
            timedEffects: [
              ...s.timedEffects,
              { source: good.id, until: { week: s.week }, modifiers: use.modifiers },
            ],
          };
          // Saved for a later, bigger week.
          return Math.max(0, total(rules, t) - total(rules, s)) * 2;
        }
        case 'levelSet': {
          const lv = {
            ...s,
            setLevels: { ...s.setLevels, [use.set]: (s.setLevels[use.set] ?? 1) + 1 },
          };
          return Math.max(0, total(rules, lv) - total(rules, s)) * left;
        }
        case 'extraPlay':
          // About one more average piece for the rest of the run.
          return (weekly / Math.max(1, s.house.pieces.length)) * left * 0.8;
        case 'copy': {
          const top = Math.max(0, ...rules.currentTally(s).pieces.map((p) => p.earned));
          return top * left * RESERVE_SHARE * 0.6;
        }
        case 'advanceTimers':
          return weekly * 0.4;
        case 'specialHand':
          return 0; // BOT_BLIND: see there.
        case 'move':
        case 'reward':
          return 0;
      }
      return 0;
    }
    case 'crate': {
      // The best of a few sample options, from the bot's own stream (not the crate's).
      const crate = c.crates[good.id];
      const pool: Good[] =
        crate.contents === 'blueprint'
          ? Object.values(c.blueprints)
              .filter((d) => d.offered && !s.blueprints.some((o) => o.id === d.id))
              .map((d) => ({ kind: 'blueprint', id: d.id }))
          : crate.contents === 'fixture'
            ? Object.values(c.fixtures).map((d) => ({ kind: 'fixture', id: d.id }))
            : Object.values(c.pieces)
                // A member's room (M4b) is never in a crate.
                .filter((d) => !d.member)
                .filter((d) => (crate.pool === 'special' ? d.drawWeight === 0 : true))
                .filter((d) => !crate.filter || d.category !== 'indoor')
                .map((d) => ({ kind: 'piece', id: d.id }));
      let best = 0;
      for (let k = 0; k < 3 && pool.length > 0; k++) {
        best = Math.max(best, goodValue(rules, s, rng.pick(pool), rng, bot));
      }
      return best * 0.9;
    }
    case 'upgrade': {
      const slots = rules.slots(s);
      switch (good.id) {
        case 'biggerTruck':
          return weekly * left * 0.12;
        case 'foreman':
          return weekly * phasesLeft(rules, s) * 0.3;
        case 'storageUnit': {
          // Only bought pieces fill the slots (a crew's and an arrival's cards sit in extra ones).
          const used = s.reserve.filter((r) => !r.crew && !r.arrival).length;
          return used >= slots.reserve ? weekly * left * 0.04 : weekly * 0.5;
        }
        case 'toolBelt':
          return s.supplies.length >= slots.supplies ? weekly * left * 0.04 : weekly * 0.5;
        case 'draftingTable':
          return s.blueprints.length >= slots.blueprints ? weekly * left * 0.08 : weekly * 0.5;
        case 'supplierDiscount':
        case 'savingsAccount':
          return weekly * phasesLeft(rules, s) * 0.6;
      }
    }
  }
  return 0;
}

function offerValue(rules: Rules, s: RunState, o: OfferView, rng: Rng, bot: ShopBot): number {
  const offer = o.offer;
  if (offer.kind !== 'service') return goodValue(rules, s, offer, rng, bot);
  const weekly = Math.max(1, total(rules, s));
  // It rarely runs out of the phase's own rerolls, so one in hand is plenty.
  if (offer.service === 'reroll') return s.bonusRerolls >= 1 ? 0 : weekly * 0.4;
  // D-157: +1 strike, while it holds fewer than the STRIKE_ORDER types it could still strike.
  if (offer.service === 'strike') {
    if (bot.strikes !== 'fixed' || s.strikesLeft >= strikesWanted(rules, s)) return 0;
    return weekly * 0.25 * phasesLeft(rules, s);
  }
  return 0;
}

/** STRIKE_ORDER's types still in the draws, with their row above its floor (D-121). */
export function strikesWanted(rules: Rules, s: RunState): number {
  const options = rules.strikeOptions(s);
  return STRIKE_ORDER.filter((id) => options.some((o) => o.kind === 'piece' && o.id === id)).length;
}

/**
 * Strikes 'fixed' (D-157): strike the hand card whose root type comes earliest in STRIKE_ORDER,
 * when the bot holds a strike and the rules allow it; else null.
 */
export function strikeAct(rules: Rules, s: RunState): Action | null {
  if (s.strikesLeft <= 0) return null;
  let best = -1;
  let rank = STRIKE_ORDER.length;
  s.hand.forEach((card, i) => {
    if (card.kind !== 'piece') return;
    const k = STRIKE_ORDER.indexOf(rules.content.pieces[card.id].countsAs ?? card.id);
    if (k >= 0 && k < rank && rules.canStrikeCard(s, i).ok) [best, rank] = [i, k];
  });
  return best >= 0 ? { t: 'strikeCard', i: best } : null;
}

/** One shop action: a pick, a buy, a sell to make room, a refresh, or leaving. */
export function shopAct(rules: Rules, s: RunState, rng: Rng, bot: ShopBot): Action {
  const open = s.offers?.pick;
  if (open) {
    let best = -1;
    let bestValue = 0;
    open.options.forEach((o, i) => {
      const legal = rules.legalActions(s).some((a) => a.t === 'pick' && a.i === i);
      const v = legal ? goodValue(rules, s, o, rng, bot) : 0;
      if (legal && (best < 0 || v > bestValue)) [best, bestValue] = [i, v];
    });
    return { t: 'pick', i: best };
  }
  const weekly = Math.max(1, total(rules, s));
  const bar = weekly * BAR_WEEKS_PER_BUDGET;
  const offers = rules.shopOffers(s);
  let pick: { o: OfferView; ratio: number } | null = null;
  for (const o of offers) {
    if (!o.ok) continue;
    const ratio = offerValue(rules, s, o, rng, bot) / Math.max(1, o.price);
    if (ratio >= bar && (!pick || ratio > pick.ratio)) pick = { o, ratio };
  }
  if (pick) return { t: 'buy', i: pick.o.i };
  // Blueprint slots full: sell the weakest for a much better one it can then afford.
  const full = s.blueprints.length >= rules.slots(s).blueprints;
  if (full && s.blueprints.length > 0) {
    const left = weeksLeftInRun(rules, s);
    const owned = s.blueprints.map((b, i) => {
      const without = { ...s, blueprints: s.blueprints.filter((_, k) => k !== i) };
      const now = (total(rules, s) - total(rules, without)) * left;
      // What it's still building toward counts too, or a build-around is sold half built.
      return { i, value: now + plannedValue(rules, s, b.id, left) };
    });
    const weakest = owned.reduce((a, b) => (b.value < a.value ? b : a));
    const refund = rules.sellPrice(s, 'blueprints', weakest.i);
    for (const o of offers) {
      if (o.offer.kind !== 'blueprint' || o.offer.sold || o.price > s.budget + refund) continue;
      const v = goodValue(rules, s, o.offer, rng, bot);
      if (v > weakest.value * 2 && v / o.price >= bar) {
        return { t: 'sell', from: 'blueprints', i: weakest.i };
      }
    }
  }
  const refresh = rules.canRefresh(s);
  const visit = s.offers?.shop;
  if (refresh.ok && visit && visit.refreshes === 0 && s.budget >= refresh.price + 8) {
    return { t: 'refreshShop' };
  }
  return { t: 'leaveShop' };
}

// ---------------------------------------------------------------------------------------
// Tools and supplies during a week.

/** A free action worth taking before the week's play, or null. `salt` breaks placement ties. */
export function useTools(rules: Rules, s: RunState, salt: number): Action | null {
  const c = rules.content;
  const W = c.balance.weeksPerPhase;
  const lastWeek = s.overtimeWeek > 0 || s.slot >= W;
  const runsOut = s.phase === c.balance.phases.length - 1 && lastWeek;
  for (let i = 0; i < s.supplies.length; i++) {
    const sup = s.supplies[i]!;
    if (sup.kind === 'fixture') {
      let best: InstallAction | null = null;
      let gain = 0;
      const pass = rules.scoreOnly(s, null);
      for (const uid of rules.installHosts(s, 'supplies', i)) {
        const play: InstallAction = { t: 'install', from: 'supplies', i, uid };
        const d = rules.scoreOnly(s, play) - pass;
        if (d > gain) [best, gain] = [play, d];
      }
      if (best) return best;
      continue;
    }
    const use = c.tools[sup.id].use;
    const plain: UseToolAction = { t: 'useTool', i };
    switch (use.kind) {
      case 'levelSet':
      case 'reward':
        if (rules.canUseTool(s, plain).ok) return plain;
        break;
      case 'advanceTimers':
        // Timers pay later, not always this week: use it unless it costs this week's total.
        if (rules.previewTool(s, plain).delta >= 0) return plain;
        break;
      case 'weekModifiers':
        if (lastWeek && (s.score + rules.scoreOnly(s, null) < rules.target(s) || runsOut)) {
          if (rules.canUseTool(s, plain).ok) return plain;
        }
        break;
      case 'extraPlay':
        if (rules.canUseTool(s, plain).ok && bestPlacement(rules, s, salt) > 0) return plain;
        break;
      case 'copy': {
        const top = [...rules.currentTally(s).pieces].sort((a, b) => b.earned - a.earned)[0];
        if (!top || top.earned <= 0) break;
        const a: UseToolAction = { t: 'useTool', i, target: { uid: top.uid } };
        if (rules.canUseTool(s, a).ok) return a;
        break;
      }
      case 'specialHand':
        if (
          !rules.canReroll(s).ok &&
          bestPlacement(rules, s, salt) <= 0 &&
          rules.canUseTool(s, plain).ok
        ) {
          return plain;
        }
        break;
      case 'move':
        break;
    }
  }
  return null;
}
