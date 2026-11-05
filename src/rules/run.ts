// RunState, apply(), and the week's transitions (implementation-plan.md §4).
//
// The rules are a reducer: apply(state, action) → { state, events }. It never mutates its
// input and throws IllegalAction with a reason. resolveWeek() is the one end-of-week step;
// apply() and preview() both call it, so they can't disagree.
//
// M1's week: place a card from the hand or pass, then End week. The new piece earns that same
// week. At a phase's last week the milestone resolves: target met → the next phase (or a win
// after the last), otherwise the run is lost. Rerolls, demolitions, overtime, early completion,
// and the shop arrive in M2 and M3.

import type {
  Action,
  Card,
  Cell,
  Content,
  GameEvent,
  HouseState,
  Legality,
  PieceScore,
  PlaceAction,
  Play,
  Preview,
  PreviewLine,
  ReplayResult,
  RunSetup,
  RunState,
  SetScore,
  Tally,
  WeekScore,
} from './index.ts';
import { drawHand } from './draw.ts';
import { uniqueRotations, bounds, shapeCells } from './grid.ts';
import { layoutCache } from './layout.ts';
import { generateLot } from './lot.ts';
import { paceFor, phaseCount, phaseName, phaseTarget, verdictFor } from './milestones.ts';
import { addPiece, checkPlacement } from './placement.ts';
import { tallyHouse } from './scoring.ts';

export class IllegalAction extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'IllegalAction';
    this.reason = reason;
  }
}

export interface Rules {
  readonly content: Content;
  newRun(setup: RunSetup): RunState;
  apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] };
  /** Every legal action: each card at each distinct rotation and spot, then pass. For bots and tests. */
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
  replay(setup: RunSetup, actions: readonly Action[]): ReplayResult;
}

interface WeekResult {
  house: HouseState;
  tally: Tally;
  placed: Extract<GameEvent, { t: 'placed' }> | null;
}

export function createRules(content: Content): Rules {
  const b = content.balance;
  const layoutOf = layoutCache(content);
  const passCache = new WeakMap<RunState, Tally>();

  function cardDef(state: RunState, i: number) {
    const card: Card | undefined = state.hand[i];
    if (!card) throw new IllegalAction('There is no card there.');
    return content.pieces[card.id];
  }

  function checkPlay(state: RunState, play: PlaceAction): Legality {
    if (state.screen !== 'build')
      return { legal: false, reason: 'The run is over.', cells: [], clearedTrees: [] };
    const card = state.hand[play.i];
    if (!card || play.from !== 'hand')
      return { legal: false, reason: 'There is no card there.', cells: [], clearedTrees: [] };
    if (
      ![0, 1, 2, 3].includes(play.rot) ||
      !Number.isInteger(play.x) ||
      !Number.isInteger(play.y)
    ) {
      return {
        legal: false,
        reason: 'That is not a spot on the lot.',
        cells: [],
        clearedTrees: [],
      };
    }
    return checkPlacement(
      content,
      layoutOf(state.house),
      content.pieces[card.id],
      play.x,
      play.y,
      play.rot,
    );
  }

  /** The end-of-week step: apply the week's play (already checked), then tally. */
  function resolveWeek(
    state: RunState,
    play: Play,
    withLines: boolean,
    legality?: Legality,
  ): WeekResult {
    if (!play)
      return {
        house: state.house,
        tally: tallyHouse(content, layoutOf(state.house), withLines),
        placed: null,
      };
    const def = cardDef(state, play.i);
    const check = legality ?? checkPlay(state, play);
    if (!check.legal) throw new IllegalAction(check.reason ?? 'You can’t build there.');
    const { house, piece } = addPiece(
      state.house,
      def.id,
      play.x,
      play.y,
      play.rot,
      state.week,
      check.clearedTrees,
    );
    return {
      house,
      tally: tallyHouse(content, layoutOf(house), withLines),
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

  function startWeek(state: RunState, events: GameEvent[]): RunState {
    const hand = drawHand(content, state.setup.seed, state.phase, state.slot, 0);
    events.push({ t: 'handDrawn', phase: state.phase, slot: state.slot, hand });
    return { ...state, draws: 1, hand };
  }

  function newRun(setup: RunSetup): RunState {
    if (typeof setup.seed !== 'string' || setup.mode !== 'standard')
      throw new Error('Bad run setup');
    const lot = generateLot(setup.seed, b.lot);
    const state: RunState = {
      setup: { seed: setup.seed, mode: setup.mode },
      house: { lot, pieces: [], nextUid: 1 },
      phase: 0,
      slot: 1,
      week: 1,
      draws: 0,
      score: 0,
      phaseStartScore: 0,
      hand: [],
      lastTally: null,
      screen: 'build',
    };
    return startWeek(state, []);
  }

  function apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] } {
    if (state.screen !== 'build') throw new IllegalAction('The run is over.');
    let play: Play;
    if (action.t === 'pass') play = null;
    else if (action.t === 'place') play = action;
    else throw new IllegalAction(`Unknown action "${(action as { t: unknown }).t}".`);

    const events: GameEvent[] = [];
    const week = resolveWeek(state, play, true);
    if (week.placed) events.push(week.placed);

    const scoreBefore = state.score;
    const score = scoreBefore + week.tally.total;
    events.push({
      t: 'tally',
      week: state.week,
      phase: state.phase,
      slot: state.slot,
      passed: play === null,
      tally: week.tally,
      pace: paceFor(b, state.phase, state.phaseStartScore),
      scoreBefore,
      score,
    });
    const had = new Set(state.lastTally?.setInstances ?? []);
    for (const s of week.tally.sets) {
      if (!had.has(s.key))
        events.push({ t: 'setCompleted', set: s.set, key: s.key, members: s.members });
    }

    const target = phaseTarget(b, state.phase);
    if (scoreBefore < target && score >= target) {
      events.push({ t: 'targetReached', phase: state.phase, target, score });
    }

    let next: RunState = {
      ...state,
      house: week.house,
      score,
      hand: [],
      lastTally: {
        points: week.tally.points,
        mult: week.tally.mult,
        total: week.tally.total,
        setInstances: week.tally.sets.map((s) => s.key),
      },
    };

    if (state.slot < b.weeksPerPhase) {
      next = { ...next, slot: state.slot + 1, week: state.week + 1 };
      return { state: startWeek(next, events), events };
    }

    // The phase's last week: the milestone resolves.
    const met = score >= target;
    events.push({
      t: 'milestone',
      phase: state.phase,
      name: phaseName(b, state.phase),
      result: met ? 'onTime' : 'failed',
      target,
      score,
    });
    const last = state.phase === phaseCount(b) - 1;
    if (!met || last) {
      const won = met;
      events.push({
        t: 'runEnded',
        result: won ? 'won' : 'lost',
        score,
        phase: state.phase,
        verdict: verdictFor(b, score, won),
      });
      return { state: { ...next, draws: 0, screen: won ? 'won' : 'lost' }, events };
    }
    next = {
      ...next,
      phase: state.phase + 1,
      slot: 1,
      week: state.week + 1,
      phaseStartScore: score,
    };
    return { state: startWeek(next, events), events };
  }

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

  function preview(state: RunState, play: Play): Preview {
    const beforeTally = state.screen === 'build' ? passTally(state) : null;
    const before = beforeTally ? score(beforeTally) : { points: 0, mult: 100, total: 0 };
    const empty = (reason: string | undefined, cells: readonly Cell[] = []): Preview => ({
      legal: false,
      reason,
      before,
      after: before,
      delta: 0,
      lines: [],
      newPiece: null,
      setsGained: [],
      setsLost: [],
      cells,
      clearedTrees: [],
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
      delta: after.total - before.total,
      lines,
      newPiece,
      setsGained: week.tally.sets.filter((s: SetScore) => !beforeKeys.has(s.key)),
      setsLost: beforeTally.sets.filter((s: SetScore) => !afterKeys.has(s.key)),
      cells: check.cells,
      clearedTrees: check.clearedTrees,
    };
  }

  function scoreOnly(state: RunState, play: Play): number {
    if (state.screen !== 'build') return 0;
    return resolveWeek(state, play, false).tally.total;
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
    replay,
  };
}
