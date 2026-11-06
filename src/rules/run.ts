// RunState, apply(), and the week's transitions (implementation-plan.md §4, Transitions).
//
// The rules are a reducer: apply(state, action) → { state, events }. It never mutates its
// input and throws IllegalAction with a reason. resolveWeek() is the one end-of-week step;
// apply() and preview() both call it, so they can't disagree.
//
// A week: place a card from the hand or the reserve, install a fixture from the hand, or pass
// (each ends the week), with free actions before that: install from the supplies, sell, reroll,
// demolish, complete early, and the auto-complete toggle.
//
// End of week: the tally adds to the score and budget. If auto-complete is on, the target is
// met, and weeks remain, the milestone completes early. At the phase's last week (or an
// overtime week): target met → the milestone resolves; otherwise an overtime week starts if
// any are left (D-041), or the run is lost.
//
// Milestones: after milestones 1–6 the shop opens (D-051); leaving it starts the next phase.
// After the last one the run is won. Tools (M3b) are free actions; Weekend Crew makes the
// week's next play free too (D-075). Finds pay once: the Old Shed when demolished, a Time
// Capsule when first built over.
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
  BuyAction,
  Card,
  Cell,
  Content,
  DebugAction,
  DemolishPreview,
  FixtureId,
  GameEvent,
  HouseState,
  InstallAction,
  Legality,
  MilestoneRecord,
  MilestoneResult,
  OfferView,
  PieceDef,
  PieceInfo,
  PieceScore,
  PlaceAction,
  Region,
  Play,
  Preview,
  PreviewLine,
  ReplayResult,
  Reward,
  RuleKey,
  RunSetup,
  RunState,
  SellAction,
  SetScore,
  Slots,
  Tally,
  TileInfo,
  ToolId,
  UseToolAction,
  WeekScore,
} from './index.ts';
import { drawHand, slotKey } from './draw.ts';
import { estimatePlay, type Estimate } from './estimate.ts';
import { checkInstall, installHosts, withFixture } from './fixtures.ts';
import { bounds, cellIndex, placedCells, shapeCells, uniqueRotations } from './grid.ts';
import {
  fencedYardsBordered,
  isLayoutModifier,
  layoutCache,
  NO_LAYOUT_MODS,
  pieceIn,
  REGION_BIT,
  type Layout,
  type LayoutModifier,
} from './layout.ts';
import { generateLot } from './lot.ts';
import {
  earlyBonus,
  paceFor,
  phaseCount,
  phaseName,
  phaseTarget,
  verdictFor,
} from './milestones.ts';
import { crewRule, ruleFrom, runModifiers, type ActiveMod } from './modifiers.ts';
import {
  addPiece,
  checkDemolish as checkDemolishOn,
  checkMove,
  checkPlacement,
  removeTarget,
  REASONS,
  type PlacementCheck,
} from './placement.ts';
import { stream } from './rng.ts';
import { canUseTool, useTool, type ToolCtx } from './tools.ts';
import { ageOf, onCadence, tallyHouse, unmetRequirement, type TallyContext } from './scoring.ts';
import {
  canStrike,
  crateOptions,
  offerPrice,
  openVisit,
  refreshPrice,
  refreshVisit,
  reserveUsed,
  roomFor,
  roomForOption,
  sellPrice,
  SHOP_REASONS,
  slotsFor,
  stockFor,
  strikeOptions,
  supplyPrice,
  viewOffers,
} from './shop.ts';
import { conditionText, ordinal } from './text.ts';

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
   * Every legal action: each play (cards from the hand and the reserve at each distinct
   * rotation and spot, fixtures in each host), pass, then the free actions (supply installs,
   * sells, reroll, complete early, each demolition target); in the shop, each good to buy,
   * sells, the refresh, and leaving. For bots and tests.
   */
  legalActions(state: RunState): Action[];
  /** Whether a hand card has any legal spot (or, for a fixture, any host), for greying it out. */
  cardFits(state: RunState, i: number): boolean;
  /** Whether a reserve piece has any legal spot. */
  reserveFits(state: RunState, i: number): boolean;
  checkPlay(state: RunState, play: PlaceAction | InstallAction): Legality;
  /** A play's effect on this week's total. A supplies install previews as the same change. */
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
  /** A run-level rule's value, after the crew's, blueprints', and upgrades' modifiers. */
  rule(state: RunState, key: RuleKey): number;
  slots(state: RunState): Slots;
  canReroll(state: RunState): Availability;
  canCompleteEarly(state: RunState): EarlyOffer;
  /** What demolishing the tile at (x, y) would do. */
  previewDemolish(state: RunState, x: number, y: number): DemolishPreview;
  /** A piece's timers as text: "Becomes a Tree at the start of week 9". */
  pieceTimers(state: RunState, uid: number): string[];
  /** Every legal placement of every card in the hand and the reserve (distinct rotations). */
  legalPlacements(state: RunState): PlaceAction[];
  /** Every legal play that ends the week: placements, and hand fixtures in each host. */
  legalPlays(state: RunState): (PlaceAction | InstallAction)[];
  /** The pieces a hand or supplies fixture could go in now. */
  installHosts(state: RunState, from: 'hand' | 'supplies', i: number): number[];
  /**
   * A cheap local estimate of a legal play's change to the week's total, for ranking
   * candidates before scoring the best few exactly (§4, Performance). `setHint` marks plays
   * that might complete a set.
   */
  estimatePlay(state: RunState, play: PlaceAction): Estimate;
  /** The tile counts of the house's fenced yards. */
  fencedYards(state: RunState): readonly number[];
  /** Every tile in a fenced yard, as lot indexes (y × width + x), for the board's tint. */
  fencedTiles(state: RunState): readonly number[];
  describePiece(state: RunState, uid: number): PieceInfo | null;
  describeTile(state: RunState, x: number, y: number): TileInfo | null;
  /** The shop's offers with prices and whether each can be bought. Empty outside the shop. */
  shopOffers(state: RunState): OfferView[];
  canRefresh(state: RunState): Availability & { price: number };
  /** What selling a blueprint or a supply pays now. */
  sellPrice(state: RunState, from: SellAction['from'], i: number): number;
  /** Card types the strike service could name now (D-076). */
  strikeOptions(state: RunState): readonly Card[];
  /** Whether a tool can be used now, with this target. */
  canUseTool(state: RunState, action: UseToolAction): Availability;
  /**
   * What a tool would do to this week's total (a move, Rush Order, Fertilizer): the house's
   * tally before and after. Illegal uses come back with their reason.
   */
  previewTool(state: RunState, action: UseToolAction): ToolPreview;
  replay(setup: RunSetup, actions: readonly Action[]): ReplayResult;
}

export interface ToolPreview extends Availability {
  before: WeekScore;
  after: WeekScore;
  delta: number;
  /** For the Moving Truck: where the piece would go. */
  cells: readonly Cell[];
}

interface WeekResult {
  house: HouseState;
  tally: Tally;
  placed: Extract<GameEvent, { t: 'placed' }> | null;
  installed: Extract<GameEvent, { t: 'installed' }> | null;
}

/** A play's legality, with what resolving it needs. */
type PlayCheck = PlacementCheck & {
  install?: { uid: number; fixture: FixtureId; replaces?: FixtureId };
};

const NO_PLAY: Legality = { legal: false, cells: [], clearedTrees: [] };
const NO_SCORE: WeekScore = { points: 0, mult: 100, total: 0 };

/** What a run's modifiers add up to, computed once per state. */
interface RunMods {
  active: readonly ActiveMod[];
  layout: readonly LayoutModifier[];
}

export function createRules(content: Content): Rules {
  const b = content.balance;
  const W = b.weeksPerPhase;
  const layoutOf = layoutCache(content);
  const passCache = new WeakMap<RunState, Tally>();
  const modsCache = new WeakMap<RunState, RunMods>();
  // Equal layout-modifier lists share one array, so the layout cache hits across states.
  const interned = new Map<string, readonly LayoutModifier[]>();

  function modsOf(state: RunState): RunMods {
    let m = modsCache.get(state);
    if (!m) {
      const active = runModifiers(content, state);
      const layoutList = active.map((a) => a.mod).filter(isLayoutModifier);
      let layout = NO_LAYOUT_MODS;
      if (layoutList.length > 0) {
        const key = JSON.stringify(layoutList);
        layout = interned.get(key) ?? layoutList;
        interned.set(key, layout);
      }
      m = { active, layout };
      modsCache.set(state, m);
    }
    return m;
  }

  /** The layout of a house (by default the state's) under the run's modifiers. */
  const layoutFor = (state: RunState, house: HouseState = state.house): Layout =>
    layoutOf(house, modsOf(state).layout);

  const rule = (state: RunState, key: RuleKey) => ruleFrom(content, modsOf(state).active, key);

  /** A phase's last week or an overtime week, actually played: Last-Minute Push's ×2. */
  const isLastWeek = (state: RunState) => state.overtimeWeek > 0 || state.slot >= W;

  function tallyCtx(state: RunState, fastForward: boolean): TallyContext {
    return {
      mods: modsOf(state).active,
      setLevels: state.setLevels,
      lastWeek: !fastForward && isLastWeek(state),
      stats: { milestonesEarly: state.milestonesEarly },
    };
  }

  function tallyOf(state: RunState, house: HouseState, withLines: boolean, ff = false): Tally {
    return tallyHouse(content, layoutFor(state, house), state.week, withLines, tallyCtx(state, ff));
  }

  /** The piece a placement would build: a hand card or a reserve piece. */
  function placeDef(state: RunState, play: PlaceAction): PieceDef | null {
    if (!Number.isInteger(play.i)) return null;
    if (play.from === 'hand') {
      const card = state.hand[play.i];
      return card?.kind === 'piece' ? content.pieces[card.id] : null;
    }
    if (play.from === 'reserve') {
      const r = state.reserve[play.i];
      return r ? content.pieces[r.id] : null;
    }
    return null;
  }

  /** The fixture an install would put in: a hand card or a supply. */
  function installFixture(state: RunState, play: InstallAction): FixtureId | null {
    if (!Number.isInteger(play.i)) return null;
    if (play.from === 'hand') {
      const card = state.hand[play.i];
      return card?.kind === 'fixture' ? card.id : null;
    }
    if (play.from === 'supplies') {
      const s = state.supplies[play.i];
      return s?.kind === 'fixture' ? s.id : null;
    }
    return null;
  }

  function checkPlay(state: RunState, play: PlaceAction | InstallAction): PlayCheck {
    if (state.screen !== 'build') {
      return {
        ...NO_PLAY,
        reason: state.screen === 'shop' ? 'The shop is open.' : 'The run is over.',
      };
    }
    if (play.t === 'install') {
      const fixture = installFixture(state, play);
      if (!fixture) return { ...NO_PLAY, reason: 'There is no fixture there.' };
      const check = checkInstall(content, layoutFor(state), fixture, play.uid);
      if (!check.legal) return { ...NO_PLAY, reason: check.reason };
      return {
        ...NO_PLAY,
        legal: true,
        install: { uid: play.uid, fixture, replaces: check.replaces },
      };
    }
    const def = placeDef(state, play);
    if (!def) return { ...NO_PLAY, reason: 'There is no card there.' };
    if (
      ![0, 1, 2, 3].includes(play.rot) ||
      !Number.isInteger(play.x) ||
      !Number.isInteger(play.y)
    ) {
      return { ...NO_PLAY, reason: 'That is not a spot on the lot.' };
    }
    return checkPlacement(
      content,
      layoutFor(state),
      def,
      play.x,
      play.y,
      play.rot,
      state.week,
      (house) => layoutFor(state, house),
    );
  }

  /** A play's change to the house (checked here), with its event. */
  function applyPlay(
    state: RunState,
    play: PlaceAction | InstallAction,
    legality?: PlayCheck,
  ): Omit<WeekResult, 'tally'> {
    const check = legality ?? checkPlay(state, play);
    if (!check.legal) throw new IllegalAction(check.reason ?? 'You can’t build there.');
    if (play.t === 'install') {
      const { uid, fixture, replaces } = check.install!;
      return {
        house: withFixture(state.house, uid, fixture, state.week),
        placed: null,
        installed: {
          t: 'installed',
          uid,
          fixture,
          from: play.from,
          ...(replaces ? { replaced: replaces } : {}),
        },
      };
    }
    const def = placeDef(state, play)!;
    const { house, piece } =
      check.house && check.piece
        ? { house: check.house, piece: check.piece }
        : addPiece(state.house, def.id, play.x, play.y, play.rot, state.week, [
            ...check.clearedTrees,
            ...(check.finds ?? []),
          ]);
    return {
      house,
      installed: null,
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

  /** The end-of-week step: apply the week's play (checked here), then tally. */
  function resolveWeek(
    state: RunState,
    play: Play,
    withLines: boolean,
    legality?: PlayCheck,
  ): WeekResult {
    if (!play) {
      return {
        house: state.house,
        tally: tallyOf(state, state.house, withLines),
        placed: null,
        installed: null,
      };
    }
    const result = applyPlay(state, play, legality);
    return { ...result, tally: tallyOf(state, result.house, withLines) };
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
      if (!t || t.kind !== 'transform' || ageOf(piece, state.week) < t.afterWeeks) continue;
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
            p.uid === piece.uid ? { ...p, defId: into, placedWeek: state.week, ageBonus: 0 } : p,
          ),
        };
      }
      events.push({ t: 'transformed', uid: piece.uid, defId: piece.defId, into: t.into, cells });
    }
    return house === state.house ? state : { ...state, house };
  }

  function drawFor(state: RunState, n: number, special = false): Card[] {
    return drawHand(
      content,
      state.setup.seed,
      state.phase,
      slotKey(state.slot, state.overtimeWeek),
      n,
      rule(state, 'handSize'),
      { struck: state.struck, mods: modsOf(state).active.map((a) => a.mod), special },
    );
  }

  // -------------------------------------------------------------------------------------
  // Rewards and finds.

  /** Pays a reward. A tool goes into the supplies, or is sold at once for half if they're full. */
  function payReward(
    state: RunState,
    reward: Reward,
    key: string,
    events: GameEvent[],
    find?: { feature: Extract<GameEvent, { t: 'findClaimed' }>['feature']; x: number; y: number },
  ): RunState {
    let s = state;
    const budget = reward.budget ?? 0;
    if (budget) s = { ...s, budget: s.budget + budget, budgetEarned: s.budgetEarned + budget };
    if (reward.score) {
      const target = phaseTarget(b, s.phase);
      const score = s.score + reward.score;
      if (s.score < target && score >= target) {
        events.push({ t: 'targetReached', phase: s.phase, target, score });
      }
      s = { ...s, score };
    }
    if (reward.rerolls) s = { ...s, bonusRerolls: s.bonusRerolls + reward.rerolls };
    if (reward.demolitions) s = { ...s, demolitionsLeft: s.demolitionsLeft + reward.demolitions };
    if (reward.overtime) s = { ...s, overtimeLeft: s.overtimeLeft + reward.overtime };
    let tool: ToolId | undefined;
    let soldTool: number | undefined;
    if (reward.tool) {
      const offered = (Object.keys(content.tools) as ToolId[]).filter(
        (id) => content.tools[id].offered,
      );
      tool = reward.tool === 'random' ? stream(s.setup.seed, key).pick(offered) : reward.tool;
      if (s.supplies.length < slotsFor(content, s).supplies) {
        s = { ...s, supplies: [...s.supplies, { kind: 'tool', id: tool }] };
      } else {
        soldTool = sellPrice(content, s, content.tools[tool].price);
        s = { ...s, budget: s.budget + soldTool, budgetEarned: s.budgetEarned + soldTool };
      }
    }
    if (find) {
      events.push({
        t: 'findClaimed',
        ...find,
        reward: { ...rewardWithout(reward), ...(tool ? { tool } : {}) },
        ...(soldTool !== undefined ? { soldTool } : {}),
      });
    }
    return s;
  }

  /** A reward without its tool field, so the resolved tool can take its place. */
  function rewardWithout(reward: Reward): Omit<Reward, 'tool'> {
    const { tool: _tool, ...rest } = reward;
    return rest;
  }

  /**
   * Pays each find a play built over (a Time Capsule), keyed by its tile. `lot` is the lot
   * before the play, which still has the finds on it.
   */
  function payFinds(
    state: RunState,
    finds: readonly Cell[] | undefined,
    events: GameEvent[],
    lot = state.house.lot,
  ): RunState {
    let s = state;
    for (const c of finds ?? []) {
      const feature = lot.terrain[cellIndex(lot.width, c.x, c.y)];
      const reward = feature ? content.features[feature].reward : undefined;
      if (feature && reward) {
        s = payReward(s, reward, `find/${c.x},${c.y}`, events, { feature, x: c.x, y: c.y });
      }
    }
    return s;
  }

  const toolCtx: ToolCtx = {
    content,
    layoutFor: (state, house) => layoutFor(state, house),
    checkMove: (state, action) => {
      const t = action.target;
      const ok =
        t &&
        Number.isInteger(t.uid) &&
        Number.isInteger(t.x) &&
        Number.isInteger(t.y) &&
        (t.rot === 0 || t.rot === 1 || t.rot === 2 || t.rot === 3);
      if (!ok) return { ...NO_PLAY, reason: 'Pick a piece and a new spot for it.' };
      return checkMove(content, layoutFor(state), t.uid, t.x!, t.y!, t.rot!, state.week, (h) =>
        layoutFor(state, h),
      );
    },
    drawSpecial: (state) => drawFor(state, state.draws, true),
    payReward: (state, reward, key, events) => payReward(state, reward, key, events),
    payFinds: (state, finds, events, lot) => payFinds(state, finds, events, lot),
  };

  function startWeek(state: RunState, events: GameEvent[]): RunState {
    let s = resolveTransforms(state, events);
    const hand = drawFor(s, 0);
    const drawn = { phase: s.phase, slot: s.slot, overtimeWeek: s.overtimeWeek, reroll: false };
    events.push({ t: 'handDrawn', ...drawn, hand, free: false });
    s = { ...s, draws: 1, hand, freeRedrawUsed: false, freePlay: 'none' };
    // Start of week, step 3: one free redraw if nothing in the first hand fits anywhere.
    if (hand.length > 0 && !hand.some((_, i) => cardFits(s, i))) {
      const redraw = drawFor(s, 1);
      events.push({ t: 'handDrawn', ...drawn, hand: redraw, free: true });
      s = { ...s, draws: 2, hand: redraw, freeRedrawUsed: true };
    }
    return s;
  }

  /** A phase starts (after the shop): say if its target is already met, then its first week. */
  function startPhase(state: RunState, events: GameEvent[]): RunState {
    // Again here, so a Foreman bought in the shop counts from this phase.
    const s = { ...state, rerollsLeft: rule(state, 'rerollsPerPhase') };
    const target = phaseTarget(b, s.phase);
    if (s.score >= target) {
      events.push({ t: 'targetReached', phase: s.phase, target, score: s.score });
    }
    return startWeek(s, events);
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
      budgetEarned: state.budgetEarned + tally.budget,
      hand: [],
      // Tools' effects last for this week's tally only.
      timedEffects: state.timedEffects.filter((e) => e.until.week > state.week),
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
    // Savings Account (M3b): +1 per 5 budget held, up to `interestMax`, before the reward.
    const interest =
      result === 'failed'
        ? 0
        : Math.min(Math.floor(s.budget / b.shop.interestPer), rule(s, 'interestMax'));
    const reward =
      result === 'failed'
        ? { budget: 0, score: 0, interest: 0 }
        : {
            budget: b.milestoneBudget + (bonus?.budget ?? 0) + interest,
            score: bonus?.score ?? 0,
            interest,
          };
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
      budgetEarned: s.budgetEarned + reward.budget,
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
      draws: 0,
      phaseStartScore: score,
      rerollsLeft: rule(s, 'rerollsPerPhase'),
    };
    // The shop opens after milestones 1–6 (D-051); shop k follows milestone k.
    return openShop(next, next.phase, false, events);
  }

  function openShop(s: RunState, number: number, forced: boolean, events: GameEvent[]): RunState {
    const shop = openVisit(content, s, number, forced);
    events.push({ t: 'shopOpened', number, offers: shop.offers, sale: shop.sale });
    let next: RunState = { ...s, screen: 'shop', hand: [], offers: { shop } };
    // Shop 1's free Housewarming crate: 1 of 3 Common blueprints, to teach blueprints.
    const n = stockFor(content, number).housewarming;
    if (n > 0) {
      const key = `crate/${number}/0/housewarming`;
      const options = crateOptions(content, next, 'housewarming', key, n);
      if (options.length > 0) {
        events.push({ t: 'crateOpened', source: 'housewarming', options });
        next = { ...next, offers: { shop, pick: { source: 'housewarming', options } } };
      }
    }
    return next;
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
      // A fast-forwarded week isn't played, so Last-Minute Push's last week doesn't count.
      cur = recordTally(cur, cur.house, tallyOf(cur, cur.house, true, true), false, true, events);
    }
    return resolveMilestone(cur, 'early', weeksSaved, bonus, events);
  }

  function weeksLeft(state: RunState): number {
    return state.overtimeWeek > 0 ? 1 : Math.max(0, W - state.slot + 1);
  }

  function canReroll(state: RunState): Availability {
    if (state.screen !== 'build') return { ok: false, reason: 'The run is over.' };
    if (state.rerollsLeft <= 0 && state.bonusRerolls <= 0) {
      return { ok: false, reason: 'No rerolls left this phase.' };
    }
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
  // The shop.

  function visitOf(state: RunState) {
    const visit = state.screen === 'shop' ? state.offers?.shop : undefined;
    if (!visit) throw new IllegalAction(SHOP_REASONS.notOpen);
    return visit;
  }

  function buy(state: RunState, action: BuyAction, events: GameEvent[]): RunState {
    const visit = visitOf(state);
    const offer = Number.isInteger(action.i) ? visit.offers[action.i] : undefined;
    if (!offer) throw new IllegalAction('There’s nothing there to buy.');
    if (offer.kind !== 'service' && offer.sold) throw new IllegalAction(SHOP_REASONS.sold);
    const room = roomFor(content, state, offer);
    if (!room.ok) throw new IllegalAction(room.reason!);
    const { price } = offerPrice(content, state, visit, action.i);
    if (price > state.budget) throw new IllegalAction(SHOP_REASONS.budget);
    let s: RunState = { ...state, budget: state.budget - price };
    switch (offer.kind) {
      case 'blueprint':
        s = { ...s, blueprints: [...s.blueprints, { id: offer.id, boughtWeek: s.week }] };
        break;
      case 'piece':
        s = { ...s, reserve: [...s.reserve, { id: offer.id }] };
        break;
      case 'fixture':
        s = { ...s, supplies: [...s.supplies, { kind: 'fixture', id: offer.id }] };
        break;
      case 'tool':
        s = { ...s, supplies: [...s.supplies, { kind: 'tool', id: offer.id }] };
        break;
      case 'upgrade':
        s = { ...s, upgrades: [...s.upgrades, offer.id] };
        break;
      case 'crate':
        break;
      case 'service': {
        const bought = {
          ...s.servicesBought,
          [offer.service]: s.servicesBought[offer.service] + 1,
        };
        if (offer.service === 'reroll') s = { ...s, bonusRerolls: s.bonusRerolls + 1 };
        else if (offer.service === 'demolition')
          s = { ...s, demolitionsLeft: s.demolitionsLeft + 1 };
        else {
          const strike = action.strike!;
          const can = canStrike(content, state, strike);
          if (!can.ok) throw new IllegalAction(can.reason!);
          s = { ...s, struck: [...s.struck, { kind: strike.kind, id: strike.id } as Card] };
        }
        s = { ...s, servicesBought: bought };
        break;
      }
    }
    const offers =
      offer.kind === 'service'
        ? visit.offers
        : visit.offers.map((o, k) => (k === action.i ? { ...o, sold: true as const } : o));
    // The sale ends when its good is sold.
    const sale = visit.sale === action.i && offer.kind !== 'service' ? null : visit.sale;
    s = { ...s, offers: { ...s.offers, shop: { ...visit, offers, sale, boughtAny: true } } };
    events.push({
      t: 'bought',
      i: action.i,
      offer,
      price,
      budgetBefore: state.budget,
      budget: s.budget,
      ...(offer.kind === 'service' && offer.service === 'strike' ? { strike: action.strike! } : {}),
    });
    if (offer.kind === 'crate') {
      const v = s.offers!.shop!;
      const key = `crate/${v.number}/${v.refreshes}/${action.i}`;
      const options = crateOptions(content, s, offer.id, key);
      events.push({ t: 'crateOpened', source: offer.id, options });
      s = { ...s, offers: { ...s.offers, pick: { source: offer.id, options } } };
    }
    return s;
  }

  /** Keeps one of the open crate's options, or discards the crate (i = −1). */
  function pick(state: RunState, i: number, events: GameEvent[]): RunState {
    const open = state.offers?.pick;
    if (!open) throw new IllegalAction('There’s no crate open.');
    const shop = state.offers?.shop;
    const { offers: _old, ...rest } = state;
    const closed: RunState = shop ? { ...rest, offers: { shop } } : rest;
    if (i === -1) {
      events.push({ t: 'picked', source: open.source, option: null });
      return closed;
    }
    const option = Number.isInteger(i) ? open.options[i] : undefined;
    if (!option) throw new IllegalAction('That isn’t one of the options.');
    const room = roomForOption(content, state, option);
    if (!room.ok) throw new IllegalAction(room.reason!);
    events.push({ t: 'picked', source: open.source, option });
    switch (option.kind) {
      case 'blueprint':
        return {
          ...closed,
          blueprints: [...closed.blueprints, { id: option.id, boughtWeek: state.week }],
        };
      case 'fixture':
        return { ...closed, supplies: [...closed.supplies, { kind: 'fixture', id: option.id }] };
      case 'piece':
        return { ...closed, reserve: [...closed.reserve, { id: option.id }] };
    }
  }

  function sell(state: RunState, action: SellAction, events: GameEvent[]): RunState {
    if (state.screen !== 'build' && state.screen !== 'shop')
      throw new IllegalAction('The run is over.');
    if (!Number.isInteger(action.i)) throw new IllegalAction('There’s nothing there to sell.');
    if (action.from === 'blueprints') {
      const owned = state.blueprints[action.i];
      if (!owned) throw new IllegalAction('There’s nothing there to sell.');
      const price = sellPrice(content, state, content.blueprints[owned.id].price);
      const s = {
        ...state,
        budget: state.budget + price,
        blueprints: state.blueprints.filter((_, k) => k !== action.i),
      };
      events.push({
        t: 'sold',
        from: 'blueprints',
        item: owned.id,
        price,
        budgetBefore: state.budget,
        budget: s.budget,
      });
      return s;
    }
    if (action.from === 'supplies') {
      const supply = state.supplies[action.i];
      if (!supply) throw new IllegalAction('There’s nothing there to sell.');
      const price = sellPrice(content, state, supplyPrice(content, supply));
      const s = {
        ...state,
        budget: state.budget + price,
        supplies: state.supplies.filter((_, k) => k !== action.i),
      };
      events.push({
        t: 'sold',
        from: 'supplies',
        item: supply.id,
        price,
        budgetBefore: state.budget,
        budget: s.budget,
      });
      return s;
    }
    throw new IllegalAction('You can only sell blueprints and supplies.');
  }

  function canRefresh(state: RunState): Availability & { price: number } {
    const price = refreshPrice(content, state);
    if (state.screen !== 'shop' || !state.offers?.shop) {
      return { ok: false, reason: SHOP_REASONS.notOpen, price };
    }
    if (state.offers.pick) return { ok: false, reason: SHOP_REASONS.picking, price };
    if (price > state.budget) return { ok: false, reason: SHOP_REASONS.budget, price };
    return { ok: true, price };
  }

  function leaveShop(state: RunState, events: GameEvent[]): RunState {
    const visit = visitOf(state);
    const skip = visit.boughtAny ? 0 : b.shop.skipReward;
    const { offers: _closed, ...rest } = state;
    const s: RunState = {
      ...rest,
      screen: 'build',
      budget: state.budget + skip,
      budgetEarned: state.budgetEarned + skip,
    };
    events.push({
      t: 'shopClosed',
      number: visit.number,
      skipReward: skip,
      budgetBefore: state.budget,
      budget: s.budget,
    });
    if (visit.forced) {
      // A shop the ?debug panel opened mid-week: back to the same week, with a fresh hand.
      const hand = drawFor(s, s.draws);
      events.push({
        t: 'handDrawn',
        phase: s.phase,
        slot: s.slot,
        overtimeWeek: s.overtimeWeek,
        hand,
        free: false,
        reroll: false,
      });
      return { ...s, hand, draws: s.draws + 1 };
    }
    return startPhase(s, events);
  }

  // -------------------------------------------------------------------------------------
  // New runs and actions.

  function newRun(setup: RunSetup): RunState {
    if (
      typeof setup.seed !== 'string' ||
      setup.mode !== 'standard' ||
      !Object.hasOwn(content.crews, setup.crewId)
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
      budgetEarned: 0,
      hand: [],
      reserve: [],
      supplies: [],
      blueprints: [],
      upgrades: [],
      setLevels: {},
      timedEffects: [],
      freePlay: 'none',
      servicesBought: { reroll: 0, demolition: 0, strike: 0 },
      struck: [],
      rerollsLeft: crewRule(content, clean.crewId, 'rerollsPerPhase'),
      bonusRerolls: 0,
      demolitionsLeft: crewRule(content, clean.crewId, 'demolitions'),
      overtimeLeft: crewRule(content, clean.crewId, 'overtime'),
      freeRedrawUsed: false,
      autoComplete: false,
      milestonesEarly: 0,
      milestones: [],
      lastTally: null,
      screen: 'build',
    };
    return startWeek(state, []);
  }

  function giveGood(s: RunState, good: Extract<DebugAction, { op: 'giveGood' }>['good']): RunState {
    if (!good || typeof good !== 'object') throw new IllegalAction('Unknown good.');
    const slots = slotsFor(content, s);
    switch (good.kind) {
      case 'blueprint':
        if (!Object.hasOwn(content.blueprints, good.id))
          throw new IllegalAction('Unknown blueprint.');
        if (s.blueprints.some((o) => o.id === good.id)) throw new IllegalAction(SHOP_REASONS.owned);
        if (s.blueprints.length >= slots.blueprints)
          throw new IllegalAction(SHOP_REASONS.blueprintsFull);
        return { ...s, blueprints: [...s.blueprints, { id: good.id, boughtWeek: s.week }] };
      case 'piece':
        if (!Object.hasOwn(content.pieces, good.id)) throw new IllegalAction('Unknown piece.');
        if (reserveUsed(s) >= slots.reserve) throw new IllegalAction(SHOP_REASONS.reserveFull);
        return { ...s, reserve: [...s.reserve, { id: good.id }] };
      case 'fixture':
        if (!Object.hasOwn(content.fixtures, good.id)) throw new IllegalAction('Unknown fixture.');
        if (s.supplies.length >= slots.supplies) throw new IllegalAction(SHOP_REASONS.suppliesFull);
        return { ...s, supplies: [...s.supplies, { kind: 'fixture', id: good.id }] };
      case 'tool':
        if (!Object.hasOwn(content.tools, good.id)) throw new IllegalAction('Unknown tool.');
        if (s.supplies.length >= slots.supplies) throw new IllegalAction(SHOP_REASONS.suppliesFull);
        return { ...s, supplies: [...s.supplies, { kind: 'tool', id: good.id }] };
      case 'upgrade':
        if (!Object.hasOwn(content.upgrades, good.id)) throw new IllegalAction('Unknown upgrade.');
        if (s.upgrades.includes(good.id)) throw new IllegalAction(SHOP_REASONS.owned);
        return { ...s, upgrades: [...s.upgrades, good.id] };
      case 'fixtureCard':
        if (!Object.hasOwn(content.fixtures, good.id)) throw new IllegalAction('Unknown fixture.');
        if (s.screen !== 'build')
          throw new IllegalAction('Cards go in the hand on the build screen.');
        return { ...s, hand: [...s.hand, { kind: 'fixture', id: good.id }] };
      default:
        throw new IllegalAction('Unknown good.');
    }
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
        if (typeof action.id !== 'string' || !Object.hasOwn(content.pieces, action.id)) {
          throw new IllegalAction('Unknown piece.');
        }
        if (s.screen !== 'build')
          throw new IllegalAction('Cards go in the hand on the build screen.');
        return { ...s, hand: [...s.hand, { kind: 'piece', id: action.id }] };
      case 'forceMiss':
        return { ...s, forcedMiss: s.phase };
      case 'forceShop': {
        if (s.screen !== 'build') throw new IllegalAction('The shop opens from the build screen.');
        const number = Math.min(Math.max(1, s.phase + 1), phaseCount(b) - 1);
        return openShop(s, number, true, events);
      }
      case 'giveGood':
        return giveGood(s, action.good);
      default:
        throw new IllegalAction('Unknown debug action.');
    }
  }

  /** Actions legal on each screen (§4, Transitions). Debug cheats are checked on their own. */
  const SHOP_ACTIONS = new Set<Action['t']>([
    'buy',
    'sell',
    'refreshShop',
    'leaveShop',
    'pick',
    'setAutoComplete',
    'debug',
  ]);

  function apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] } {
    if (state.screen === 'won' || state.screen === 'lost')
      throw new IllegalAction('The run is over.');
    if (state.screen === 'shop' && !SHOP_ACTIONS.has(action.t)) {
      throw new IllegalAction('The shop is open. Leave it to start the next phase.');
    }
    const shopOnly =
      action.t === 'buy' ||
      action.t === 'refreshShop' ||
      action.t === 'leaveShop' ||
      action.t === 'pick';
    if (state.screen === 'build' && shopOnly) throw new IllegalAction(SHOP_REASONS.notOpen);
    if (state.screen === 'shop' && action.t === 'useTool') {
      throw new IllegalAction('Tools are used while building.');
    }
    // An open crate waits for its pick (or a discard); selling to make room is fine.
    if (state.offers?.pick && shopOnly && action.t !== 'pick') {
      throw new IllegalAction(SHOP_REASONS.picking);
    }
    const events: GameEvent[] = [];
    const done = (s: RunState) => ({ state: s, events });
    switch (action.t) {
      case 'pass':
      case 'place':
      case 'install': {
        const play = action.t === 'pass' ? null : action;
        if (play?.t === 'install' && play.from === 'supplies') {
          // A free action: the fixture goes in, and the week goes on.
          const week = applyPlay(state, play);
          events.push(week.installed!);
          return done({
            ...state,
            house: week.house,
            supplies: state.supplies.filter((_, k) => k !== play.i),
          });
        }
        const check = play ? checkPlay(state, play) : undefined;
        if (play && state.freePlay === 'ready') {
          // Weekend Crew (D-075): this play doesn't end the week.
          const result = applyPlay(state, play, check);
          if (result.placed) events.push({ ...result.placed, free: true });
          if (result.installed) events.push({ ...result.installed, free: true });
          let s: RunState = { ...state, house: result.house, freePlay: 'used' };
          s =
            play.t === 'place' && play.from === 'reserve'
              ? { ...s, reserve: s.reserve.filter((_, k) => k !== play.i) }
              : { ...s, hand: s.hand.filter((_, k) => k !== play.i) };
          return done(payFinds(s, check?.finds, events, state.house.lot));
        }
        const week = resolveWeek(state, play, true, check);
        if (week.placed) events.push(week.placed);
        if (week.installed) events.push(week.installed);
        let s = state;
        if (play?.t === 'place' && play.from === 'reserve') {
          s = { ...s, reserve: s.reserve.filter((_, k) => k !== play.i) };
        }
        // A Time Capsule built over pays before the tally.
        s = payFinds(s, check?.finds, events);
        s = recordTally(s, week.house, week.tally, play === null, false, events);
        return done(afterTally(s, events));
      }
      case 'reroll': {
        const can = canReroll(state);
        if (!can.ok) throw new IllegalAction(can.reason!);
        const hand = drawFor(state, state.draws);
        events.push({
          t: 'handDrawn',
          phase: state.phase,
          slot: state.slot,
          overtimeWeek: state.overtimeWeek,
          hand,
          free: false,
          reroll: true,
        });
        // The phase's own rerolls go first; bought ones never expire.
        const fromPhase = state.rerollsLeft > 0;
        return done({
          ...state,
          hand,
          draws: state.draws + 1,
          rerollsLeft: fromPhase ? state.rerollsLeft - 1 : state.rerollsLeft,
          bonusRerolls: fromPhase ? state.bonusRerolls : state.bonusRerolls - 1,
        });
      }
      case 'demolish': {
        if (state.demolitionsLeft <= 0) throw new IllegalAction(REASONS.noDemolitions);
        const check = checkDemolishOn(content, layoutFor(state), action.x, action.y);
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
        let s: RunState = { ...state, house, demolitionsLeft };
        // The Old Shed pays its find reward once, keyed by its top-left tile.
        const reward = target.kind === 'feature' ? content.features[target.feature].reward : null;
        if (target.kind === 'feature' && reward) {
          const c = target.cells[0]!;
          s = payReward(s, reward, `find/${c.x},${c.y}`, events, {
            feature: target.feature,
            x: c.x,
            y: c.y,
          });
        }
        return done(s);
      }
      case 'completeEarly': {
        const offer = canCompleteEarly(state);
        if (!offer.ok) throw new IllegalAction(offer.reason!);
        return done(completeEarly(state, offer.weeksSaved, true, events));
      }
      case 'setAutoComplete':
        if (typeof action.on !== 'boolean') throw new IllegalAction('Bad toggle.');
        return done({ ...state, autoComplete: action.on });
      case 'sell':
        return done(sell(state, action, events));
      case 'buy':
        return done(buy(state, action, events));
      case 'refreshShop': {
        const can = canRefresh(state);
        if (!can.ok) throw new IllegalAction(can.reason!);
        const visit = visitOf(state);
        const next = refreshVisit(content, state, visit);
        const budget = state.budget - can.price;
        events.push({
          t: 'shopRefreshed',
          refreshes: next.refreshes,
          price: can.price,
          budget,
          offers: next.offers,
          sale: next.sale,
        });
        return done({ ...state, budget, offers: { ...state.offers, shop: next } });
      }
      case 'pick':
        return done(pick(state, action.i, events));
      case 'useTool': {
        const can = canUseTool(toolCtx, state, action);
        if (!can.ok) throw new IllegalAction(can.reason!);
        return done(useTool(toolCtx, state, action, events));
      }
      case 'leaveShop':
        return done(leaveShop(state, events));
      case 'debug':
        return done(applyDebug(state, action, events));
      default:
        throw new IllegalAction(`Unknown action "${(action as { t: unknown }).t}".`);
    }
  }

  // -------------------------------------------------------------------------------------
  // Queries.

  /** Calls `visit` for each legal placement of a piece (distinct rotations); stops when it returns true. */
  function eachLegalSpot(
    state: RunState,
    from: PlaceAction['from'],
    i: number,
    visit: (play: PlaceAction) => boolean | void,
  ): void {
    if (state.screen !== 'build') return;
    const def = placeDef(state, { t: 'place', from, i, x: 0, y: 0, rot: 0 });
    if (!def) return;
    const { width, height } = state.house.lot;
    for (const rot of uniqueRotations(def.shape)) {
      const { w, h } = bounds(shapeCells(def.shape, rot));
      for (let y = 0; y + h <= height; y++) {
        for (let x = 0; x + w <= width; x++) {
          const play: PlaceAction = { t: 'place', from, i, x, y, rot };
          if (checkPlay(state, play).legal && visit(play) === true) return;
        }
      }
    }
  }

  function hostsFor(state: RunState, from: InstallAction['from'], i: number): number[] {
    if (state.screen !== 'build') return [];
    const fixture = installFixture(state, { t: 'install', from, i, uid: 0 });
    return fixture ? installHosts(content, layoutFor(state), fixture) : [];
  }

  function legalPlacements(state: RunState): PlaceAction[] {
    const out: PlaceAction[] = [];
    state.hand.forEach((_, i) => eachLegalSpot(state, 'hand', i, (play) => void out.push(play)));
    state.reserve.forEach((_, i) =>
      eachLegalSpot(state, 'reserve', i, (play) => void out.push(play)),
    );
    return out;
  }

  function legalPlays(state: RunState): (PlaceAction | InstallAction)[] {
    const out: (PlaceAction | InstallAction)[] = legalPlacements(state);
    state.hand.forEach((card, i) => {
      if (card.kind !== 'fixture') return;
      for (const uid of hostsFor(state, 'hand', i))
        out.push({ t: 'install', from: 'hand', i, uid });
    });
    return out;
  }

  function legalActions(state: RunState): Action[] {
    const open = state.screen === 'shop' ? state.offers?.pick : undefined;
    if (open) {
      // An open crate: keep an option there's room for, discard it, or sell to make room.
      const out: Action[] = [];
      open.options.forEach((o, i) => {
        if (roomForOption(content, state, o).ok) out.push({ t: 'pick', i });
      });
      out.push({ t: 'pick', i: -1 });
      state.blueprints.forEach((_, i) => out.push({ t: 'sell', from: 'blueprints', i }));
      state.supplies.forEach((_, i) => out.push({ t: 'sell', from: 'supplies', i }));
      return out;
    }
    if (state.screen === 'shop') {
      const out: Action[] = [];
      for (const o of viewOffers(content, state)) {
        if (!o.ok) continue;
        if (o.offer.kind === 'service' && o.offer.service === 'strike') {
          for (const t of strikeOptions(content, state)) out.push({ t: 'buy', i: o.i, strike: t });
        } else out.push({ t: 'buy', i: o.i });
      }
      state.blueprints.forEach((_, i) => out.push({ t: 'sell', from: 'blueprints', i }));
      state.supplies.forEach((_, i) => out.push({ t: 'sell', from: 'supplies', i }));
      if (canRefresh(state).ok) out.push({ t: 'refreshShop' });
      out.push({ t: 'leaveShop' });
      return out;
    }
    if (state.screen !== 'build') return [];
    const out: Action[] = legalPlays(state);
    out.push({ t: 'pass' });
    state.supplies.forEach((s, i) => {
      if (s.kind !== 'fixture') return;
      for (const uid of hostsFor(state, 'supplies', i)) {
        out.push({ t: 'install', from: 'supplies', i, uid });
      }
    });
    // Tools: each target for the Copy Machine, none for the others. The Moving Truck's moves
    // (every piece to every spot) aren't listed; bots choose them with previewTool.
    state.supplies.forEach((sup, i) => {
      if (sup.kind !== 'tool') return;
      const use = content.tools[sup.id].use.kind;
      if (use === 'move') return;
      const targets: UseToolAction[] =
        use === 'copy'
          ? state.house.pieces.map((p) => ({ t: 'useTool', i, target: { uid: p.uid } }))
          : [{ t: 'useTool', i }];
      for (const a of targets) if (canUseTool(toolCtx, state, a).ok) out.push(a);
    });
    state.blueprints.forEach((_, i) => out.push({ t: 'sell', from: 'blueprints', i }));
    state.supplies.forEach((_, i) => out.push({ t: 'sell', from: 'supplies', i }));
    if (canReroll(state).ok) out.push({ t: 'reroll' });
    if (canCompleteEarly(state).ok) out.push({ t: 'completeEarly' });
    if (state.demolitionsLeft > 0) {
      const layout = layoutFor(state);
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
    const card = state.hand[i];
    if (!card) return false;
    if (card.kind === 'fixture') return hostsFor(state, 'hand', i).length > 0;
    let fits = false;
    eachLegalSpot(state, 'hand', i, () => (fits = true));
    return fits;
  }

  function reserveFits(state: RunState, i: number): boolean {
    let fits = false;
    eachLegalSpot(state, 'reserve', i, () => (fits = true));
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
    const unmet = unmetRequirement(content, layoutFor(state), def, uid);
    const next = (every: number) => {
      for (let a = age; a < age + every; a++)
        if (onCadence(a, every)) return state.week + (a - age);
      return state.week;
    };
    for (const e of def.effects) {
      if (e.kind === 'transform') {
        const into =
          'piece' in e.into
            ? content.pieces[e.into.piece].name
            : content.features[e.into.feature].name;
        const when = state.week + Math.max(0, e.afterWeeks - age);
        out.push(`Becomes a ${into} at the start of week ${when}`);
      } else if (unmet && (e.kind === 'rhythm' || e.kind === 'economy')) {
        out.push(`Paused: it must be ${conditionText(content, unmet.condition)}`);
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
    return [...new Set(out)];
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
      xMults: beforeTally?.xMults ?? [],
    });
    if (!beforeTally)
      return empty(state.screen === 'shop' ? 'The shop is open.' : 'The run is over.');
    if (!play) {
      return { ...empty(undefined), legal: true };
    }
    const check = checkPlay(state, play);
    if (!check.legal) return empty(check.reason, check.cells);
    const week = resolveWeek(state, play, true, check);
    const focus = week.placed?.uid ?? week.installed!.uid;
    const beforeEarned = new Map<number, PieceScore>(beforeTally.pieces.map((p) => [p.uid, p]));
    const lines: PreviewLine[] = [];
    let newPiece: PieceScore | null = null;
    for (const p of week.tally.pieces) {
      const isNew = p.uid === focus;
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
    const cells = play.t === 'install' ? (layoutFor(state).cells.get(play.uid) ?? []) : check.cells;
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
      cells,
      clearedTrees: check.clearedTrees,
      upcoming: week.placed ? pieceTimers({ ...state, house: week.house }, focus) : [],
      xMults: week.tally.xMults,
      ...(week.installed
        ? {
            host: week.installed.uid,
            ...(week.installed.replaced ? { replaces: week.installed.replaced } : {}),
          }
        : {}),
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
    const check = checkDemolishOn(content, layoutFor(state), x, y);
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
    const after = score(tallyOf(state, house, false));
    return { legal: true, target, cells, before, after, delta: after.total - before.total };
  }

  function replay(setup: RunSetup, actions: readonly Action[]): ReplayResult {
    let state: RunState;
    try {
      state = newRun(setup);
    } catch (e) {
      // A setup this build can't start (a crew it doesn't have): fail softly at step 0, from
      // the same seed with the default crew, so a stale code never crashes the page.
      const fallback = Object.keys(content.crews)[0] as RunSetup['crewId'];
      return {
        state: newRun({ seed: String(setup?.seed ?? ''), crewId: fallback, mode: 'standard' }),
        failedAt: 0,
        error: `This build can’t start that run: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
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
    reserveFits,
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
      const legal = play ? checkPlay(state, play).legal : false;
      const weekly = play && legal ? scoreOnly(state, play) : passTally(state).total;
      return state.score + weekly * weeksLeft(state);
    },
    rule,
    slots: (state) => slotsFor(content, state),
    canReroll,
    canCompleteEarly,
    previewDemolish,
    pieceTimers,
    legalPlacements,
    legalPlays,
    installHosts: hostsFor,
    estimatePlay: (state, play) => {
      const def = placeDef(state, play);
      if (!def) throw new IllegalAction('There is no card there.');
      return estimatePlay(
        content,
        layoutFor(state),
        passTally(state),
        def,
        placedCells(def.shape, play.x, play.y, play.rot),
        modsOf(state).active,
      );
    },
    fencedYards: (state) => layoutFor(state).fencedSizes,
    fencedTiles: (state) => {
      const ids = layoutFor(state).fencedId;
      const out: number[] = [];
      ids.forEach((id, i) => id >= 0 && out.push(i));
      return out;
    },
    describePiece: (state, uid) => {
      const layout = layoutFor(state);
      if (!layout.byUid.has(uid)) return null;
      const regions = (Object.keys(REGION_BIT) as Region[]).filter((r) => pieceIn(layout, uid, r));
      return {
        tags: [...(layout.tags.get(uid) ?? [])],
        side: layout.exterior.has(uid) ? 'exterior' : layout.interior.has(uid) ? 'interior' : null,
        regions,
        view: layout.hasView.has(uid),
        linked: [...(layout.links.get(uid) ?? [])].sort((a, b) => a - b),
        fencedYardTiles: fencedYardsBordered(layout, uid).reduce(
          (a, id) => a + layout.fencedSizes[id]!,
          0,
        ),
      };
    },
    describeTile: (state, x, y) => {
      const layout = layoutFor(state);
      const { width, height } = state.house.lot;
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const i = cellIndex(width, x, y);
      const bits = layout.regionBits[i]!;
      const id = layout.fencedId[i]!;
      return {
        regions: (Object.keys(REGION_BIT) as Region[]).filter((r) => bits & REGION_BIT[r]),
        fencedYardTiles: id >= 0 ? layout.fencedSizes[id]! : 0,
      };
    },
    shopOffers: (state) => viewOffers(content, state),
    canRefresh,
    sellPrice: (state, from, i) => {
      if (from === 'blueprints') {
        const o = state.blueprints[i];
        return o ? sellPrice(content, state, content.blueprints[o.id].price) : 0;
      }
      const s = state.supplies[i];
      return s ? sellPrice(content, state, supplyPrice(content, s)) : 0;
    },
    strikeOptions: (state) => strikeOptions(content, state),
    canUseTool: (state, action) => canUseTool(toolCtx, state, action),
    previewTool: (state, action) => {
      const before = state.screen === 'build' ? score(passTally(state)) : NO_SCORE;
      const base = { before, after: before, delta: 0, cells: [] as readonly Cell[] };
      const can = canUseTool(toolCtx, state, action);
      if (!can.ok) return { ok: false, reason: can.reason, ...base };
      const after = score(passTally(useTool(toolCtx, state, action, [])));
      const move = action.target?.x !== undefined ? toolCtx.checkMove(state, action) : null;
      const cells = move?.legal ? move.cells : [];
      return { ok: true, before, after, delta: after.total - before.total, cells };
    },
    replay,
  };
}
