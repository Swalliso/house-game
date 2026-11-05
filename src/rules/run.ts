// RunState, apply(), and the week's transitions (implementation-plan.md §4, Transitions).
//
// The rules are a reducer: apply(state, action) → { state, events }. It never mutates its
// input and throws IllegalAction with a reason. resolveWeek() is the one end-of-week step;
// apply() and preview() both call it, so they can't disagree.
//
// A week: place a card from the hand or pass (which ends the week), with free actions before
// that: reroll, demolish, complete early, and the auto-complete toggle.
//
// End of week: the tally adds to the score and budget. If auto-complete is on, the target is
// met, and weeks remain, the milestone completes early. At the phase's last week (or an
// overtime week): target met → the milestone resolves; otherwise an overtime week starts if
// any are left (D-041), or the run is lost.
//
// Start of week: transforms resolve (a Sapling old enough becomes a Tree), a hand is drawn,
// and if none of it fits anywhere there's one free redraw.
//
// Early completion (D-040): the bonus is computed at once from this phase's earnings and the
// weeks saved; the remaining weeks then fast-forward (pieces earn and timers tick, but no
// hands are drawn), and the milestone resolves as 'early'.

import type {
  Action,
  Availability,
  Card,
  Cell,
  Content,
  DebugAction,
  DemolishPreview,
  GameEvent,
  HouseState,
  Legality,
  MilestoneRecord,
  MilestoneResult,
  PieceScore,
  PlaceAction,
  Play,
  Preview,
  PreviewLine,
  ReplayResult,
  RuleKey,
  RunSetup,
  RunState,
  SetScore,
  Tally,
  WeekScore,
} from './index.ts';
import { drawHand, slotKey } from './draw.ts';
import { bounds, cellIndex, shapeCells, uniqueRotations } from './grid.ts';
import { layoutCache } from './layout.ts';
import { generateLot } from './lot.ts';
import {
  earlyBonus,
  paceFor,
  phaseCount,
  phaseName,
  phaseTarget,
  verdictFor,
} from './milestones.ts';
import { ruleValue } from './modifiers.ts';
import {
  addPiece,
  checkDemolish as checkDemolishOn,
  checkPlacement,
  removeTarget,
  REASONS,
  type PlacementCheck,
} from './placement.ts';
import { ageOf, onCadence, tallyHouse } from './scoring.ts';
import { effectText, ordinal } from './text.ts';

export class IllegalAction extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'IllegalAction';
    this.reason = reason;
  }
}

export interface EarlyOffer extends Availability {
  /** Weeks of the phase not yet tallied, this one included. */
  weeksSaved: number;
  bonus: { score: number; budget: number };
}

export interface Rules {
  readonly content: Content;
  newRun(setup: RunSetup): RunState;
  apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] };
  /**
   * Every legal action: each card at each distinct rotation and spot, pass, then the free
   * actions (reroll, complete early, each demolition target). For bots and tests.
   */
  legalActions(state: RunState): Action[];
  /** Whether a card has any legal spot, for greying it out. */
  cardFits(state: RunState, i: number): boolean;
  checkPlay(state: RunState, play: PlaceAction): Legality;
  preview(state: RunState, play: Play): Preview;
  /** The week's total with this play, without breakdown lines (the sim's cheap path). */
  scoreOnly(state: RunState, play: Play): number;
  /** The house's tally as it stands (what a pass would score): each piece's current earnings. */
  currentTally(state: RunState): Tally;
  target(state: RunState): number;
  pace(state: RunState): number;
  phaseName(phase: number): string;
  /** The run-end verdict by score band (§12); the lowest one until the run is won. */
  verdict(state: RunState): string;
  /** Weeks of the phase not yet tallied, this one included (1 in an overtime week). */
  weeksLeft(state: RunState): number;
  /**
   * A rough guide for the progress bar, not a promise: the score plus this week's total (with
   * the play, if any) for each week left in the phase.
   */
  forecast(state: RunState, play?: Play): number;
  /** A run-level rule's value, after the crew's modifiers. */
  rule(state: RunState, key: RuleKey): number;
  canReroll(state: RunState): Availability;
  canCompleteEarly(state: RunState): EarlyOffer;
  /** What demolishing the tile at (x, y) would do. */
  previewDemolish(state: RunState, x: number, y: number): DemolishPreview;
  /** A piece's timers as text: "Becomes a Tree at the start of week 9". */
  pieceTimers(state: RunState, uid: number): string[];
  replay(setup: RunSetup, actions: readonly Action[]): ReplayResult;
}

interface WeekResult {
  house: HouseState;
  tally: Tally;
  placed: Extract<GameEvent, { t: 'placed' }> | null;
}

const NO_PLAY: Legality = { legal: false, cells: [], clearedTrees: [] };

export function createRules(content: Content): Rules {
  const b = content.balance;
  const W = b.weeksPerPhase;
  const layoutOf = layoutCache(content);
  const passCache = new WeakMap<RunState, Tally>();

  const rule = (state: RunState, key: RuleKey) => ruleValue(content, state.setup.crewId, key);

  function cardDef(state: RunState, i: number) {
    const card: Card | undefined = state.hand[i];
    if (!card) throw new IllegalAction('There is no card there.');
    return content.pieces[card.id];
  }

  function checkPlay(state: RunState, play: PlaceAction): PlacementCheck {
    if (state.screen !== 'build') return { ...NO_PLAY, reason: 'The run is over.' };
    const card = Number.isInteger(play.i) ? state.hand[play.i] : undefined;
    if (!card || play.from !== 'hand') return { ...NO_PLAY, reason: 'There is no card there.' };
    if (
      ![0, 1, 2, 3].includes(play.rot) ||
      !Number.isInteger(play.x) ||
      !Number.isInteger(play.y)
    ) {
      return { ...NO_PLAY, reason: 'That is not a spot on the lot.' };
    }
    return checkPlacement(
      content,
      layoutOf(state.house),
      content.pieces[card.id],
      play.x,
      play.y,
      play.rot,
      state.week,
      layoutOf,
    );
  }

  /** The end-of-week step: apply the week's play (checked here), then tally. */
  function resolveWeek(
    state: RunState,
    play: Play,
    withLines: boolean,
    legality?: PlacementCheck,
  ): WeekResult {
    if (!play) {
      return {
        house: state.house,
        tally: tallyHouse(content, layoutOf(state.house), state.week, withLines),
        placed: null,
      };
    }
    const def = cardDef(state, play.i);
    const check = legality ?? checkPlay(state, play);
    if (!check.legal) throw new IllegalAction(check.reason ?? 'You can’t build there.');
    const { house, piece } =
      check.house && check.piece
        ? { house: check.house, piece: check.piece }
        : addPiece(state.house, def.id, play.x, play.y, play.rot, state.week, check.clearedTrees);
    return {
      house,
      tally: tallyHouse(content, layoutOf(house), state.week, withLines),
      placed: {
        t: 'placed',
        uid: piece.uid,
        defId: piece.defId,
        x: piece.x,
        y: piece.y,
        rot: piece.rot,
        cells: check.cells,
        clearedTrees: check.clearedTrees,
      },
    };
  }

  function passTally(state: RunState): Tally {
    let t = passCache.get(state);
    if (!t) {
      t = resolveWeek(state, null, true).tally;
      passCache.set(state, t);
    }
    return t;
  }

  // -------------------------------------------------------------------------------------
  // Transitions.

  /** Start of week, step 1: pieces old enough transform. The Sapling becomes a Tree tile. */
  function resolveTransforms(state: RunState, events: GameEvent[]): RunState {
    let house = state.house;
    for (const piece of state.house.pieces) {
      const def = content.pieces[piece.defId];
      const t = def.effects.find((e) => e.kind === 'transform');
      if (!t || t.kind !== 'transform' || state.week - piece.placedWeek < t.afterWeeks) continue;
      const cells = shapeCells(def.shape, piece.rot).map((c) => ({
        x: c.x + piece.x,
        y: c.y + piece.y,
      }));
      if ('feature' in t.into) {
        const terrain = house.lot.terrain.slice();
        for (const c of cells) terrain[cellIndex(house.lot.width, c.x, c.y)] = t.into.feature;
        house = {
          ...house,
          lot: { ...house.lot, terrain },
          pieces: house.pieces.filter((p) => p.uid !== piece.uid),
        };
      } else {
        const into = t.into.piece;
        house = {
          ...house,
          pieces: house.pieces.map((p) =>
            p.uid === piece.uid ? { ...p, defId: into, placedWeek: state.week } : p,
          ),
        };
      }
      events.push({ t: 'transformed', uid: piece.uid, defId: piece.defId, into: t.into, cells });
    }
    return house === state.house ? state : { ...state, house };
  }

  function startWeek(state: RunState, events: GameEvent[]): RunState {
    let s = resolveTransforms(state, events);
    const key = slotKey(s.slot, s.overtimeWeek);
    const size = rule(s, 'handSize');
    const hand = drawHand(content, s.setup.seed, s.phase, key, 0, size);
    const drawn = { phase: s.phase, slot: s.slot, overtimeWeek: s.overtimeWeek, reroll: false };
    events.push({ t: 'handDrawn', ...drawn, hand, free: false });
    s = { ...s, draws: 1, hand, freeRedrawUsed: false };
    // Start of week, step 3: one free redraw if nothing in the first hand fits anywhere.
    if (hand.length > 0 && !hand.some((_, i) => cardFits(s, i))) {
      const redraw = drawHand(content, s.setup.seed, s.phase, key, 1, size);
      events.push({ t: 'handDrawn', ...drawn, hand: redraw, free: true });
      s = { ...s, draws: 2, hand: redraw, freeRedrawUsed: true };
    }
    return s;
  }

  /** Adds a tally to the run: score, budget, the tally event, new sets, and targetReached. */
  function recordTally(
    state: RunState,
    house: HouseState,
    tally: Tally,
    passed: boolean,
    fastForward: boolean,
    events: GameEvent[],
  ): RunState {
    const scoreBefore = state.score;
    const score = scoreBefore + tally.total;
    const budget = state.budget + tally.budget;
    events.push({
      t: 'tally',
      week: state.week,
      phase: state.phase,
      slot: state.slot,
      overtimeWeek: state.overtimeWeek,
      passed,
      fastForward,
      tally,
      pace: paceFor(b, state.phase, state.phaseStartScore),
      scoreBefore,
      score,
      budgetBefore: state.budget,
      budget,
    });
    const had = new Set(state.lastTally?.setInstances ?? []);
    for (const s of tally.sets) {
      if (!had.has(s.key))
        events.push({ t: 'setCompleted', set: s.set, key: s.key, members: s.members });
    }
    const target = phaseTarget(b, state.phase);
    if (scoreBefore < target && score >= target) {
      events.push({ t: 'targetReached', phase: state.phase, target, score });
    }
    return {
      ...state,
      house,
      score,
      budget,
      hand: [],
      lastTally: {
        points: tally.points,
        mult: tally.mult,
        total: tally.total,
        setInstances: tally.sets.map((s) => s.key),
      },
    };
  }

  /** End of week, after the tally: early completion, the milestone, overtime, or the next week. */
  function afterTally(s: RunState, events: GameEvent[]): RunState {
    const target = phaseTarget(b, s.phase);
    if (s.overtimeWeek === 0 && s.slot < W && s.autoComplete && s.score >= target) {
      return completeEarly(s, W - s.slot, false, events);
    }
    if (s.overtimeWeek > 0 || s.slot >= W) return endOfPhase(s, events);
    return startWeek({ ...s, slot: s.slot + 1, week: s.week + 1 }, events);
  }

  function endOfPhase(s: RunState, events: GameEvent[]): RunState {
    const target = phaseTarget(b, s.phase);
    const forced = s.forcedMiss === s.phase && s.overtimeWeek === 0;
    if (s.score >= target && !forced) {
      return resolveMilestone(s, s.overtimeWeek > 0 ? 'overtime' : 'onTime', 0, null, events);
    }
    if (s.overtimeLeft > 0) {
      const next: RunState = {
        ...s,
        overtimeLeft: s.overtimeLeft - 1,
        overtimeWeek: s.overtimeWeek + 1,
        slot: s.slot + 1,
        week: s.week + 1,
      };
      events.push({
        t: 'overtimeUsed',
        phase: s.phase,
        overtimeLeft: next.overtimeLeft,
        target,
        score: s.score,
      });
      return startWeek(next, events);
    }
    return resolveMilestone(s, 'failed', 0, null, events);
  }

  function resolveMilestone(
    s: RunState,
    result: MilestoneResult,
    weeksSaved: number,
    bonus: { score: number; budget: number } | null,
    events: GameEvent[],
  ): RunState {
    const target = phaseTarget(b, s.phase);
    const reward =
      result === 'failed'
        ? { budget: 0, score: 0 }
        : { budget: b.milestoneBudget + (bonus?.budget ?? 0), score: bonus?.score ?? 0 };
    const score = s.score + reward.score;
    const record: MilestoneRecord = {
      phase: s.phase,
      result,
      target,
      score,
      weeksSaved,
      overtimeUsed: s.overtimeWeek,
      reward,
    };
    events.push({ t: 'milestone', name: phaseName(b, s.phase), ...record });
    let next: RunState = {
      ...s,
      score,
      budget: s.budget + reward.budget,
      hand: [],
      milestones: [...s.milestones, record],
      milestonesEarly: s.milestonesEarly + (result === 'early' ? 1 : 0),
    };
    const last = s.phase === phaseCount(b) - 1;
    if (result === 'failed' || last) {
      const won = result !== 'failed';
      events.push({
        t: 'runEnded',
        result: won ? 'won' : 'lost',
        score,
        phase: s.phase,
        verdict: verdictFor(b, score, won),
      });
      return { ...next, draws: 0, screen: won ? 'won' : 'lost' };
    }
    next = {
      ...next,
      phase: s.phase + 1,
      slot: 1,
      overtimeWeek: 0,
      week: s.week + 1,
      phaseStartScore: score,
      rerollsLeft: rule(s, 'rerollsPerPhase'),
    };
    return startWeek(next, events);
  }

  /**
   * Fast-forward (§4): the bonus is fixed now; each remaining week then tallies with nothing
   * placed. `manual` means the current week hasn't been tallied yet (its hand is discarded).
   */
  function completeEarly(
    s: RunState,
    weeksSaved: number,
    manual: boolean,
    events: GameEvent[],
  ): RunState {
    const bonus = earlyBonus(
      b,
      s.phase,
      s.score - s.phaseStartScore,
      weeksSaved,
      rule(s, 'earlyRewardPct'),
    );
    let cur: RunState = { ...s, hand: [], draws: 0 };
    for (let k = 0; k < weeksSaved; k++) {
      if (!(manual && k === 0)) {
        cur = resolveTransforms({ ...cur, slot: cur.slot + 1, week: cur.week + 1 }, events);
      }
      cur = recordTally(cur, cur.house, passTally(cur), false, true, events);
    }
    return resolveMilestone(cur, 'early', weeksSaved, bonus, events);
  }

  function weeksLeft(state: RunState): number {
    return state.overtimeWeek > 0 ? 1 : Math.max(0, W - state.slot + 1);
  }

  function canReroll(state: RunState): Availability {
    if (state.screen !== 'build') return { ok: false, reason: 'The run is over.' };
    if (state.rerollsLeft <= 0) return { ok: false, reason: 'No rerolls left this phase.' };
    return { ok: true };
  }

  function canCompleteEarly(state: RunState): EarlyOffer {
    const weeksSaved = state.screen === 'build' && state.overtimeWeek === 0 ? weeksLeft(state) : 0;
    const bonus = earlyBonus(
      b,
      state.phase,
      state.score - state.phaseStartScore,
      weeksSaved,
      rule(state, 'earlyRewardPct'),
    );
    const no = (reason: string): EarlyOffer => ({ ok: false, reason, weeksSaved, bonus });
    if (state.screen !== 'build') return no('The run is over.');
    if (state.overtimeWeek > 0) return no('An overtime week can’t be completed early.');
    if (state.score < phaseTarget(b, state.phase)) return no('Reach the target first.');
    return { ok: true, weeksSaved, bonus };
  }

  // -------------------------------------------------------------------------------------
  // New runs and actions.

  function newRun(setup: RunSetup): RunState {
    if (
      typeof setup.seed !== 'string' ||
      setup.mode !== 'standard' ||
      !content.crews[setup.crewId]
    ) {
      throw new Error('Bad run setup');
    }
    const lot = generateLot(setup.seed, b.lot);
    const clean: RunSetup = { seed: setup.seed, crewId: setup.crewId, mode: setup.mode };
    const state: RunState = {
      setup: clean,
      house: { lot, pieces: [], nextUid: 1 },
      phase: 0,
      slot: 1,
      overtimeWeek: 0,
      week: 1,
      draws: 0,
      score: 0,
      phaseStartScore: 0,
      budget: 0,
      hand: [],
      rerollsLeft: ruleValue(content, clean.crewId, 'rerollsPerPhase'),
      demolitionsLeft: ruleValue(content, clean.crewId, 'demolitions'),
      overtimeLeft: ruleValue(content, clean.crewId, 'overtime'),
      freeRedrawUsed: false,
      autoComplete: false,
      milestonesEarly: 0,
      milestones: [],
      lastTally: null,
      screen: 'build',
    };
    return startWeek(state, []);
  }

  function applyDebug(state: RunState, action: DebugAction, events: GameEvent[]): RunState {
    const s: RunState = { ...state, debug: true };
    switch (action.op) {
      case 'addScore': {
        if (!Number.isInteger(action.amount)) throw new IllegalAction('Bad amount.');
        const score = Math.max(0, s.score + action.amount);
        const target = phaseTarget(b, s.phase);
        if (s.score < target && score >= target) {
          events.push({ t: 'targetReached', phase: s.phase, target, score });
        }
        return { ...s, score };
      }
      case 'addBudget':
        if (!Number.isInteger(action.amount)) throw new IllegalAction('Bad amount.');
        return { ...s, budget: Math.max(0, s.budget + action.amount) };
      case 'giveCard':
        if (!content.pieces[action.id]) throw new IllegalAction('Unknown piece.');
        return { ...s, hand: [...s.hand, { kind: 'piece', id: action.id }] };
      case 'forceMiss':
        return { ...s, forcedMiss: s.phase };
      default:
        throw new IllegalAction('Unknown debug action.');
    }
  }

  function apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] } {
    if (state.screen !== 'build') throw new IllegalAction('The run is over.');
    const events: GameEvent[] = [];
    const done = (s: RunState) => ({ state: s, events });
    switch (action.t) {
      case 'pass':
      case 'place': {
        const play = action.t === 'pass' ? null : action;
        const week = resolveWeek(state, play, true);
        if (week.placed) events.push(week.placed);
        const s = recordTally(state, week.house, week.tally, play === null, false, events);
        return done(afterTally(s, events));
      }
      case 'reroll': {
        const can = canReroll(state);
        if (!can.ok) throw new IllegalAction(can.reason!);
        const key = slotKey(state.slot, state.overtimeWeek);
        const hand = drawHand(
          content,
          state.setup.seed,
          state.phase,
          key,
          state.draws,
          rule(state, 'handSize'),
        );
        events.push({
          t: 'handDrawn',
          phase: state.phase,
          slot: state.slot,
          overtimeWeek: state.overtimeWeek,
          hand,
          free: false,
          reroll: true,
        });
        return done({
          ...state,
          hand,
          draws: state.draws + 1,
          rerollsLeft: state.rerollsLeft - 1,
        });
      }
      case 'demolish': {
        if (state.demolitionsLeft <= 0) throw new IllegalAction(REASONS.noDemolitions);
        const check = checkDemolishOn(content, layoutOf(state.house), action.x, action.y);
        if (!check.legal) throw new IllegalAction(check.reason);
        const target = check.target;
        const house = removeTarget(state.house, target);
        const demolitionsLeft = state.demolitionsLeft - 1;
        events.push(
          target.kind === 'piece'
            ? {
                t: 'demolished',
                uid: target.piece.uid,
                defId: target.piece.defId,
                cells: target.cells,
                demolitionsLeft,
              }
            : { t: 'demolished', feature: target.feature, cells: target.cells, demolitionsLeft },
        );
        return done({ ...state, house, demolitionsLeft });
      }
      case 'completeEarly': {
        const offer = canCompleteEarly(state);
        if (!offer.ok) throw new IllegalAction(offer.reason!);
        return done(completeEarly(state, offer.weeksSaved, true, events));
      }
      case 'setAutoComplete':
        if (typeof action.on !== 'boolean') throw new IllegalAction('Bad toggle.');
        return done({ ...state, autoComplete: action.on });
      case 'debug':
        return done(applyDebug(state, action, events));
      default:
        throw new IllegalAction(`Unknown action "${(action as { t: unknown }).t}".`);
    }
  }

  // -------------------------------------------------------------------------------------
  // Queries.

  /** Calls `visit` for each legal placement of card i (distinct rotations); stops when it returns true. */
  function eachLegalSpot(
    state: RunState,
    i: number,
    visit: (play: PlaceAction) => boolean | void,
  ): void {
    const card = state.hand[i];
    if (!card || state.screen !== 'build') return;
    const def = content.pieces[card.id];
    const { width, height } = state.house.lot;
    for (const rot of uniqueRotations(def.shape)) {
      const { w, h } = bounds(shapeCells(def.shape, rot));
      for (let y = 0; y + h <= height; y++) {
        for (let x = 0; x + w <= width; x++) {
          const play: PlaceAction = { t: 'place', from: 'hand', i, x, y, rot };
          if (checkPlay(state, play).legal && visit(play) === true) return;
        }
      }
    }
  }

  function legalActions(state: RunState): Action[] {
    if (state.screen !== 'build') return [];
    const out: Action[] = [];
    state.hand.forEach((_, i) => eachLegalSpot(state, i, (play) => void out.push(play)));
    out.push({ t: 'pass' });
    if (canReroll(state).ok) out.push({ t: 'reroll' });
    if (canCompleteEarly(state).ok) out.push({ t: 'completeEarly' });
    if (state.demolitionsLeft > 0) {
      const layout = layoutOf(state.house);
      for (const piece of state.house.pieces) {
        const c = layout.cells.get(piece.uid)![0]!;
        if (checkDemolishOn(content, layout, c.x, c.y).legal) {
          out.push({ t: 'demolish', x: c.x, y: c.y });
        }
      }
      const { lot } = state.house;
      lot.terrain.forEach((t, idx) => {
        if (t === null || content.features[t].clear !== 'demolish') return;
        out.push({ t: 'demolish', x: idx % lot.width, y: Math.floor(idx / lot.width) });
      });
    }
    return out;
  }

  function cardFits(state: RunState, i: number): boolean {
    let fits = false;
    eachLegalSpot(state, i, () => (fits = true));
    return fits;
  }

  function score(t: Tally): WeekScore {
    return { points: t.points, mult: t.mult, total: t.total };
  }

  function pieceTimers(state: RunState, uid: number): string[] {
    const piece = state.house.pieces.find((p) => p.uid === uid);
    if (!piece) return [];
    const def = content.pieces[piece.defId];
    const out: string[] = [];
    const age = ageOf(piece, state.week);
    const next = (every: number) => {
      for (let a = age; a < age + every; a++) if (onCadence(a, every)) return piece.placedWeek + a;
      return state.week;
    };
    for (const e of def.effects) {
      if (e.kind === 'transform') {
        out.push(
          `${effectText(content, e)}: at the start of week ${piece.placedWeek + e.afterWeeks}`,
        );
      } else if (e.kind === 'rhythm') {
        const w = next(e.every);
        out.push(w === state.week ? `Pays +${e.amount} this week` : `Next +${e.amount}: week ${w}`);
      } else if (e.kind === 'economy' && (e.every ?? 1) > 1) {
        const w = next(e.every!);
        out.push(
          w === state.week
            ? `Pays ${e.budget} budget this week`
            : `Next ${e.budget} budget: week ${w} (every ${ordinal(e.every!)} week)`,
        );
      }
    }
    return out;
  }

  function preview(state: RunState, play: Play): Preview {
    const beforeTally = state.screen === 'build' ? passTally(state) : null;
    const before = beforeTally ? score(beforeTally) : { points: 0, mult: 100, total: 0 };
    const budgetBefore = beforeTally?.budget ?? 0;
    const empty = (reason: string | undefined, cells: readonly Cell[] = []): Preview => ({
      legal: false,
      reason,
      before,
      after: before,
      budgetBefore,
      budgetAfter: budgetBefore,
      delta: 0,
      lines: [],
      newPiece: null,
      setsGained: [],
      setsLost: [],
      cells,
      clearedTrees: [],
      upcoming: [],
    });
    if (!beforeTally) return empty('The run is over.');
    if (!play) {
      return { ...empty(undefined), legal: true };
    }
    const check = checkPlay(state, play);
    if (!check.legal) return empty(check.reason, check.cells);
    const week = resolveWeek(state, play, true, check);
    const newUid = week.placed!.uid;
    const beforeEarned = new Map<number, PieceScore>(beforeTally.pieces.map((p) => [p.uid, p]));
    const lines: PreviewLine[] = [];
    let newPiece: PieceScore | null = null;
    for (const p of week.tally.pieces) {
      const isNew = p.uid === newUid;
      if (isNew) newPiece = p;
      const was = beforeEarned.get(p.uid)?.earned ?? 0;
      if (isNew || was !== p.earned) {
        lines.push({
          uid: p.uid,
          defId: p.defId,
          isNew,
          before: was,
          after: p.earned,
          reasons: p.lines,
        });
      }
    }
    lines.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    const beforeKeys = new Set(beforeTally.sets.map((s) => s.key));
    const afterKeys = new Set(week.tally.sets.map((s) => s.key));
    const after = score(week.tally);
    return {
      legal: true,
      before,
      after,
      budgetBefore,
      budgetAfter: week.tally.budget,
      delta: after.total - before.total,
      lines,
      newPiece,
      setsGained: week.tally.sets.filter((s: SetScore) => !beforeKeys.has(s.key)),
      setsLost: beforeTally.sets.filter((s: SetScore) => !afterKeys.has(s.key)),
      cells: check.cells,
      clearedTrees: check.clearedTrees,
      upcoming: pieceTimers({ ...state, house: week.house }, newUid),
    };
  }

  function scoreOnly(state: RunState, play: Play): number {
    if (state.screen !== 'build') return 0;
    return resolveWeek(state, play, false).tally.total;
  }

  function previewDemolish(state: RunState, x: number, y: number): DemolishPreview {
    const beforeTally = state.screen === 'build' ? passTally(state) : null;
    const before = beforeTally ? score(beforeTally) : { points: 0, mult: 100, total: 0 };
    const base = { before, after: before, delta: 0 };
    if (!beforeTally)
      return { legal: false, reason: 'The run is over.', target: null, cells: [], ...base };
    const check = checkDemolishOn(content, layoutOf(state.house), x, y);
    const target = !check.target
      ? null
      : check.target.kind === 'piece'
        ? { uid: check.target.piece.uid, defId: check.target.piece.defId }
        : { feature: check.target.feature };
    const cells = check.target?.cells ?? [];
    if (!check.legal) return { legal: false, reason: check.reason, target, cells, ...base };
    if (state.demolitionsLeft <= 0) {
      return { legal: false, reason: REASONS.noDemolitions, target, cells, ...base };
    }
    const house = removeTarget(state.house, check.target);
    const after = score(tallyHouse(content, layoutOf(house), state.week, false));
    return { legal: true, target, cells, before, after, delta: after.total - before.total };
  }

  function replay(setup: RunSetup, actions: readonly Action[]): ReplayResult {
    let state = newRun(setup);
    for (let i = 0; i < actions.length; i++) {
      try {
        state = apply(state, actions[i]!).state;
      } catch (e) {
        return { state, failedAt: i, error: e instanceof Error ? e.message : String(e) };
      }
    }
    return { state };
  }

  return {
    content,
    newRun,
    apply,
    legalActions,
    cardFits,
    checkPlay,
    preview,
    scoreOnly,
    currentTally: (state) => passTally(state),
    target: (state) => phaseTarget(b, state.phase),
    pace: (state) => paceFor(b, state.phase, state.phaseStartScore),
    phaseName: (phase) => phaseName(b, phase),
    verdict: (state) => verdictFor(b, state.score, state.screen === 'won'),
    weeksLeft,
    forecast: (state, play) => {
      if (state.screen !== 'build') return state.score;
      const weekly = play ? scoreOnly(state, play) : passTally(state).total;
      return state.score + weekly * weeksLeft(state);
    },
    rule,
    canReroll,
    canCompleteEarly,
    previewDemolish,
    pieceTimers,
    replay,
  };
}
