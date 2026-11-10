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
// Start of week: transforms resolve (a Sapling old enough becomes a Tree), the household's
// arrivals move in at their phase's first week (M4b, D-103: their cards go into the reserve's
// extra slots), and the hand is drawn in two rows, Rooms then Layout (D-121). A card with no
// play at all (no spot, no host, no Renovation) is swapped for another from its row, trying up
// to `swapTries` cards; that replaced D-070's free redraw. A reroll redraws both rows, then
// swaps (D-132; D-121 had a reroll per row).
//
// Change orders (M4b): when a milestone resolves, the phase effects that ran through it end
// and its accepted requests and restrictions resolve (a request met and a restriction kept
// pay their reward). After milestones 2, 4, and 6 (`changeOrderAfter`) one change order is
// then drawn from `co/<milestone>` among the eligible ones (the client's and the generic ones,
// never one offered before, minus Appendix A's skips), and the 'changeOrder' screen waits for
// the answer before the shop opens. An accepted order runs through the next phase. Placing a
// piece a running restriction forbids breaks it; the placement stays legal.
//
// Early completion (D-040): the bonus is computed at once from this phase's earnings and the
// weeks saved; the remaining weeks then fast-forward (pieces earn and timers tick, but no
// hands are drawn), and the milestone resolves as 'early'.

import type {
  Action,
  ArrivalDef,
  Availability,
  BuyAction,
  Card,
  DrawRow,
  Cell,
  ChangeOrderDef,
  ChangeOrderId,
  ChangeOrderOffer,
  ChangeOrderRecord,
  ChangeOrderResult,
  ChangeOrderView,
  ChecklistLine,
  ClientDef,
  Content,
  DebugAction,
  DemolishPreview,
  FixtureId,
  FixtureValue,
  GameEvent,
  HouseState,
  InstallAction,
  InstallGain,
  Legality,
  MilestoneRecord,
  MilestoneResult,
  OfferView,
  PieceDef,
  PieceId,
  PieceInfo,
  PieceScore,
  PlaceAction,
  PlacedPiece,
  Region,
  Play,
  Preview,
  PreviewLine,
  ReplayResult,
  Reward,
  RenovateAction,
  ReservePiece,
  Rot,
  RuleKey,
  RunSetup,
  RunState,
  SellAction,
  SwappedCard,
  SetScore,
  Slots,
  Tag,
  TagSource,
  Tally,
  TileInfo,
  ToolId,
  TypeLimit,
  UseToolAction,
  WeekScore,
} from './index.ts';
import {
  demolitionsNeeded,
  limitReached,
  meetsHouse,
  neededTypes,
  newPiecesNeeded,
  progressOf,
  typeLimits,
  typesAtLimit,
  type CondCtx,
  type NounFn,
} from './conditions.ts';
import { DRAW_ROWS, drawHand, drawWeights, rowOf, slotKey, swapCandidates } from './draw.ts';
import { estimatePlay, type Estimate } from './estimate.ts';
import { checkInstall, installHosts, withFixture } from './fixtures.ts';
import {
  bounds,
  cellIndex,
  packShapeProblem,
  placedCells,
  rotateShape,
  shapeCells,
  uniqueRotations,
} from './grid.ts';
import {
  fencedYardsBordered,
  isBuilding,
  isLayoutModifier,
  layoutCache,
  NO_LAYOUT_MODS,
  pieceDef,
  pieceIn,
  REGION_BIT,
  tilesIn,
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
  nextVerdictFor,
  verdictFor,
} from './milestones.ts';
import { ruleFrom, runModifiers, setupRule, type ActiveMod } from './modifiers.ts';
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
import { wowParts } from './attribution.ts';
import { ageOf, onCadence, tallyHouse, unmetRequirement, type TallyContext } from './scoring.ts';
import { isType, matchesPiece, rootType } from './selectors.ts';
import { isRoom } from './layout.ts';
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
import {
  article,
  changeOrderText,
  conditionText,
  definite,
  ordinal,
  selectorText,
  specText,
} from './text.ts';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  checkPlay(state: RunState, play: PlaceAction | InstallAction | RenovateAction): Legality;
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
  /** The verdict above a won run's, and the score it starts at; null at the top or if not won. */
  nextVerdict(state: RunState): { name: string; score: number } | null;
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
  /** Every legal play that ends the week: placements, hand fixtures in each host, and Renovations. */
  legalPlays(state: RunState): (PlaceAction | InstallAction | RenovateAction)[];
  /** The rooms a hand or reserve card could renovate now (empty unless its type is at its limit). */
  renovateTargets(state: RunState, from: RenovateAction['from'], i: number): number[];
  /** The checklist's ceilings as they stand (M4a): types at their limit can renovate. */
  limits(state: RunState): readonly TypeLimit[];
  /** The client's checklist with progress, as the house stands (or with a play, as it would). */
  checklist(state: RunState, play?: Play): ChecklistLine[];
  /** The pieces a hand or supplies fixture could go in now. */
  installHosts(state: RunState, from: 'hand' | 'supplies', i: number): number[];
  /**
   * D-107: every legal host of a hand or supplies fixture, in placement order, each with its
   * install preview's delta (net of the fixture it would replace, which it names). Empty off
   * the build screen.
   */
  installGains(state: RunState, from: 'hand' | 'supplies', i: number): InstallGain[];
  /**
   * D-107: what a fixture not yet owned would add, for the shop's line: the legal host in the
   * house as it stands whose install gains this week's total the most, by that install's
   * preview delta (as if bought into the supplies), with the weeks still to play in the run and
   * gain × those weeks. In the shop it scores the next week, the next phase's first, after the
   * transforms that start it, and names the host's piece as it is then (`hostDefId`). Null if
   * no piece can take it, or off the build and shop screens.
   */
  fixtureValue(state: RunState, fixture: FixtureId): FixtureValue | null;
  /**
   * A cheap local estimate of a legal play's change to the week's total, for ranking
   * candidates before scoring the best few exactly (§4, Performance), checklist lines that
   * counts decide included (`specFlips`). Its hints mark plays whose payoff it can't see:
   * `setHint`, one that might complete a set; `yardHint`, a Fence that would close a new
   * fenced yard; `linkHint`, a Hallway that would link rooms anew; `specHint`, a piece that
   * would join an unmet pair line's types.
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
  /** M4b: the change order waiting on the 'changeOrder' screen, or null. */
  changeOrderOffer(state: RunState): ChangeOrderView | null;
  /**
   * M4b: the change orders running now, in the order answered: accepted requests (with their
   * progress) and restrictions (broken or not), and acknowledged phase effects.
   */
  activeChangeOrders(state: RunState): ChangeOrderView[];
  /**
   * M4b: the change orders that could be offered now (the client's own and the generic ones,
   * listed in that order, none offered before, minus the skipped), for tests and the ?debug panel.
   */
  eligibleChangeOrders(state: RunState): ChangeOrderId[];
  replay(setup: RunSetup, actions: readonly Action[]): ReplayResult;
}

export interface ToolPreview extends Availability {
  before: WeekScore;
  after: WeekScore;
  delta: number;
  /** For the Moving Truck: where the piece would go. */
  cells: readonly Cell[];
  /** Checklist lines the use would turn on, and off (spec ids). */
  specsGained: readonly string[];
  specsLost: readonly string[];
  /**
   * Sets the use would complete, and break (a Moving Truck's move); one that re-forms from other
   * pieces is neither, as in DemolishPreview.
   */
  setsGained: readonly SetScore[];
  setsLost: readonly SetScore[];
}

interface WeekResult {
  house: HouseState;
  tally: Tally;
  placed: Extract<GameEvent, { t: 'placed' }> | null;
  installed: Extract<GameEvent, { t: 'installed' }> | null;
  renovated: Extract<GameEvent, { t: 'renovated' }> | null;
}

/** One shape a card is listed at: a rotation of its own, or a pack's tiles at rot 0. */
interface PlacementShape {
  rot: Rot;
  shape?: readonly string[];
  cells: readonly Cell[];
}

/** A play's legality, with what resolving it needs. */
type PlayCheck = PlacementCheck & {
  install?: { uid: number; fixture: FixtureId; replaces?: FixtureId };
  renovate?: { uid: number; level: number; card: PieceId };
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

  /** The run's client (M4a): its checklist, tastes, pool, and target factor. */
  const clientOf = (state: RunState): ClientDef => {
    const c = content.clients[state.setup.clientId];
    if (!c) throw new Error(`Unknown client "${state.setup.clientId}"`);
    return c;
  };
  const pctOf = (state: RunState) => clientOf(state).targetPct;
  /** This phase's target for the run's client (the curve × its targetPct). */
  const targetOf = (state: RunState) => phaseTarget(b, state.phase, pctOf(state));

  const limitsCache = new WeakMap<RunState, TypeLimit[]>();
  /** The checklist's ceilings as they stand: a type at its limit can renovate, and draws less. */
  function limitsOf(state: RunState): TypeLimit[] {
    let l = limitsCache.get(state);
    if (!l) {
      l = typeLimits(content, layoutFor(state), clientOf(state).specs, { phase: state.phase });
      limitsCache.set(state, l);
    }
    return l;
  }

  /** A phase's last week or an overtime week, actually played: Last-Minute Push's ×2. */
  const isLastWeek = (state: RunState) => state.overtimeWeek > 0 || state.slot >= W;

  /** Why the build screen's plays and queries aren't available on this screen. */
  function offScreen(state: RunState): string {
    if (state.screen === 'shop') return 'The shop is open.';
    if (state.screen === 'changeOrder') return 'A change order is waiting for your answer.';
    return 'The run is over.';
  }

  function tallyCtx(state: RunState, fastForward: boolean): TallyContext {
    return {
      mods: modsOf(state).active,
      setLevels: state.setLevels,
      lastWeek: !fastForward && isLastWeek(state),
      stats: { milestonesEarly: state.milestonesEarly },
      specs: clientOf(state).specs,
      phase: state.phase,
    };
  }

  function tallyOf(state: RunState, house: HouseState, withLines: boolean, ff = false): Tally {
    return tallyHouse(content, layoutFor(state, house), state.week, withLines, tallyCtx(state, ff));
  }

  /** The piece a placement would build (or a Renovation spend): a hand card or a reserve piece. */
  function placeDef(state: RunState, play: PlaceAction | RenovateAction): PieceDef | null {
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

  function checkPlay(
    state: RunState,
    play: PlaceAction | InstallAction | RenovateAction,
  ): PlayCheck {
    if (state.screen !== 'build') return { ...NO_PLAY, reason: offScreen(state) };
    if (play.t === 'renovate') return checkRenovate(state, play);
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
    // A pack (D-106) places the tiles the player clicked out; any other card, its own shape.
    if (def.pack) {
      if (play.shape === undefined) {
        return {
          ...NO_PLAY,
          reason: `Click out the ${def.name}’s tiles: up to ${def.pack.maxTiles}.`,
        };
      }
      const problem = packShapeProblem(play.shape, def.pack.maxTiles);
      if (problem) return { ...NO_PLAY, reason: problem };
      // The tiles are where they go: one way to write each placement.
      if (play.rot !== 0) {
        return { ...NO_PLAY, reason: `A ${def.name}’s tiles go down as clicked out, unturned.` };
      }
    } else if (play.shape !== undefined) {
      return { ...NO_PLAY, reason: `A ${def.name} has its own shape.` };
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
      def.pack ? play.shape : def.shape,
    );
  }

  /**
   * Renovate (M4a): a room card whose type is at its limit, on a room of that type below the
   * top level. The limit comes from the client's checklist (one Kitchen, …).
   */
  function checkRenovate(state: RunState, play: RenovateAction): PlayCheck {
    const def = placeDef(state, play);
    if (!def) return { ...NO_PLAY, reason: 'There is no card there.' };
    const card = capitalize(article(def.name));
    // M4b: a member's room is placed, never spent on another room (a Bedroom card can renovate it).
    if (def.member) {
      return { ...NO_PLAY, reason: `${card} card can’t renovate: it’s a household member’s room.` };
    }
    // A room card on a room (house-systems-review.md §4), whose type the checklist caps.
    const root = rootType(def);
    const capped = isRoom(def) && limitsOf(state).some((l) => l.types.includes(root));
    if (!capped) {
      return { ...NO_PLAY, reason: `${card} card can’t renovate: the checklist doesn’t cap them.` };
    }
    const limit = limitReached(limitsOf(state), root);
    if (!limit) {
      const many = selectorText(content, { piece: root }, 'some');
      return {
        ...NO_PLAY,
        reason: `${card} card can renovate once the house has all the ${many} it wants.`,
      };
    }
    const target = Number.isInteger(play.uid) ? layoutFor(state).byUid.get(play.uid) : undefined;
    if (!target) return { ...NO_PLAY, reason: 'Pick a room to renovate.' };
    const targetDef = content.pieces[target.defId];
    if (!limit.types.some((t) => isType(targetDef, t))) {
      const rooms = selectorText(content, { piece: limit.types }, 'one');
      return { ...NO_PLAY, reason: `${card} card renovates ${article(rooms)}.` };
    }
    const level = target.level ?? 0;
    if (level >= b.renovate.maxLevel) {
      // "That Kitchen", but "Grandma’s Room": a possessive name takes no determiner.
      const room = capitalize(definite(targetDef.name, 'that'));
      return { ...NO_PLAY, reason: `${room} is fully renovated.` };
    }
    const cells = layoutFor(state).cells.get(target.uid) ?? [];
    return {
      ...NO_PLAY,
      legal: true,
      cells,
      renovate: { uid: target.uid, level: level + 1, card: def.id },
    };
  }

  /** A play's change to the house (checked here), with its event. */
  function applyPlay(
    state: RunState,
    play: PlaceAction | InstallAction | RenovateAction,
    legality?: PlayCheck,
  ): Omit<WeekResult, 'tally'> {
    const check = legality ?? checkPlay(state, play);
    if (!check.legal) throw new IllegalAction(check.reason ?? 'You can’t build there.');
    if (play.t === 'renovate') {
      const { uid, level, card } = check.renovate!;
      const piece = state.house.pieces.find((p) => p.uid === uid)!;
      return {
        house: {
          ...state.house,
          pieces: state.house.pieces.map((p) => (p.uid === uid ? { ...p, level } : p)),
        },
        placed: null,
        installed: null,
        renovated: { t: 'renovated', uid, defId: piece.defId, level, card },
      };
    }
    if (play.t === 'install') {
      const { uid, fixture, replaces } = check.install!;
      return {
        house: withFixture(state.house, uid, fixture, state.week),
        placed: null,
        renovated: null,
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
        : addPiece(
            state.house,
            def.id,
            play.x,
            play.y,
            play.rot,
            state.week,
            [...check.clearedTrees, ...(check.finds ?? [])],
            def.pack ? play.shape : undefined,
          );
    return {
      house,
      installed: null,
      renovated: null,
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
        renovated: null,
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

  /**
   * Start of week, step 1: pieces old enough transform. The Sapling becomes a Tree tile; it
   * never holds a fixture (checkInstall, D-095), so none is lost with it.
   */
  function resolveTransforms(state: RunState, events: GameEvent[]): RunState {
    let house = state.house;
    for (const piece of state.house.pieces) {
      const def = content.pieces[piece.defId];
      const t = def.effects.find((e) => e.kind === 'transform');
      if (!t || t.kind !== 'transform' || ageOf(piece, state.week) < t.afterWeeks) continue;
      const cells = shapeCells(piece.shape ?? def.shape, piece.rot).map((c) => ({
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

  function drawOpts(state: RunState, row: DrawRow, special = false) {
    return {
      struck: state.struck,
      mods: modsOf(state).active.map((a) => a.mod),
      special,
      atLimit: typesAtLimit(limitsOf(state)),
      row,
    };
  }

  /** One row of the hand (D-121): `roomsRow` or `layoutRow` cards on that row's stream. */
  function drawRowFor(state: RunState, n: number, row: DrawRow, special = false): Card[] {
    return drawHand(
      content,
      state.setup.seed,
      state.phase,
      slotKey(state.slot, state.overtimeWeek),
      n,
      rule(state, row === 'rooms' ? 'roomsRow' : 'layoutRow'),
      drawOpts(state, row, special),
    );
  }

  /** A whole hand: the Rooms row, then the Layout row. */
  function drawFor(state: RunState, n: number, special = false): Card[] {
    return DRAW_ROWS.flatMap((row) => drawRowFor(state, n, row, special));
  }

  /** A card has a play: a spot, a host, or a Renovation (D-102). */
  function cardHasPlay(state: RunState, i: number): boolean {
    return cardFits(state, i) || renovateTargets(state, 'hand', i).length > 0;
  }

  /**
   * Swaps (D-121): each card of `row` (both rows when unset) with no play is replaced by the
   * first of up to `swapTries` cards from its row that has one, or by the last tried. The
   * draw's `n` keys the swaps' streams, one per card. The draw's one `handDrawn` event carries
   * the hand after its swaps, and what each swapped card replaced.
   */
  function swapDead(state: RunState, n: number): { state: RunState; swapped: SwappedCard[] } {
    const slot = slotKey(state.slot, state.overtimeWeek);
    let s = state;
    const swapped: SwappedCard[] = [];
    for (const r of DRAW_ROWS) {
      const at = s.hand.flatMap((c, i) => (rowOf(content, c) === r ? [i] : []));
      at.forEach((i, k) => {
        if (cardHasPlay(s, i)) return;
        const was = s.hand[i]!;
        const inRow = at.map((j) => s.hand[j]!);
        const tries = swapCandidates(
          content,
          s.setup.seed,
          s.phase,
          slot,
          n,
          k,
          b.swapTries,
          inRow,
          drawOpts(s, r),
        );
        for (const card of tries) {
          s = { ...s, hand: s.hand.map((c, j) => (j === i ? card : c)) };
          if (cardHasPlay(s, i)) break;
        }
        if (tries.length > 0) swapped.push({ i, was });
      });
    }
    if (swapped.length === 0) return { state: s, swapped };
    const notes = [...s.swapped.filter((w) => !swapped.some((x) => x.i === w.i)), ...swapped];
    return { state: { ...s, swapped: notes }, swapped };
  }

  /** The swaps' part of a `handDrawn` event. */
  const swapNote = (swapped: readonly SwappedCard[]) =>
    swapped.length > 0 ? { free: true, swapped } : { free: false };

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
      const target = targetOf(s);
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

  // -------------------------------------------------------------------------------------
  // The household's arrivals (M4b, D-103).

  /** A member moves in: their cards go into the reserve's extra slots. */
  function land(s: RunState, a: ArrivalDef, events: GameEvent[], forced = false): RunState {
    events.push({
      t: 'arrived',
      arrival: a.id,
      phase: s.phase,
      cards: [...a.cards],
      ...(forced ? { forced: true as const } : {}),
    });
    return {
      ...s,
      reserve: [...s.reserve, ...a.cards.map((id): ReservePiece => ({ id, arrival: a.id }))],
      arrived: [...s.arrived, a.id],
    };
  }

  /** Start of week, step 2: in the first week of an arrival's phase, its member moves in. */
  function arrive(state: RunState, events: GameEvent[]): RunState {
    if (state.slot !== 1 || state.overtimeWeek !== 0) return state;
    let s = state;
    for (const a of clientOf(state).household.arrivals) {
      if (a.phase === s.phase && !s.arrived.includes(a.id)) s = land(s, a, events);
    }
    return s;
  }

  // -------------------------------------------------------------------------------------
  // Change orders (M4b).

  const orderDef = (id: ChangeOrderId): ChangeOrderDef => content.changeOrders[id];

  /** What a request is checked with: the phase, and what's new since it was accepted. */
  const orderCtx = (state: RunState, r: { sinceUid: number; demolished: number }): CondCtx => ({
    phase: state.phase,
    order: { sinceUid: r.sinceUid, demolished: r.demolished },
  });

  /** Accepted requests and restrictions still running. */
  const running = (state: RunState) =>
    state.changeOrders.filter((r) => r.answer === 'accepted' && r.result === undefined);

  /**
   * Why a change order isn't offered now (Appendix A · M4b), or null: a request whose
   * condition the house already meets, or that clearly can't be met (more new pieces than a
   * phase has weeks, more demolitions than are left, or a piece type it needs that's neither in
   * the draw for this phase nor in the reserve). Restrictions and phase effects are always
   * offered.
   */
  function skipReason(state: RunState, def: ChangeOrderDef): string | null {
    if (def.kind !== 'request') return null;
    const cond = def.condition;
    const fresh = orderCtx(state, { sinceUid: state.house.nextUid, demolished: 0 });
    if (meetsHouse(content, layoutFor(state), cond, fresh)) return 'The house already meets it.';
    if (newPiecesNeeded(cond) > W) return 'It needs more new pieces than a phase has weeks.';
    if (demolitionsNeeded(cond) > state.demolitionsLeft) return 'No demolitions are left for it.';
    const pool = drawWeights(content, state.phase, {
      struck: state.struck,
      mods: modsOf(state).active.map((a) => a.mod),
    });
    const available = (id: PieceId) =>
      pool.some((w) => w.card.kind === 'piece' && isType(content.pieces[w.card.id], id)) ||
      state.reserve.some((r) => isType(content.pieces[r.id], id));
    for (const types of neededTypes(cond)) {
      if (!types.some(available)) return 'A piece it needs isn’t in the draw or the reserve.';
    }
    return null;
  }

  /**
   * The client's own change orders and the generic ones, listed in that order (the pick among
   * them is even, not own first): never one offered before, minus the skipped, and before the
   * last phase only phase effects.
   */
  function eligibleOrders(state: RunState): ChangeOrderId[] {
    const offered = new Set(state.changeOrders.map((r) => r.id));
    const pending = state.offers?.changeOrder;
    if (pending) offered.add(pending.id);
    const generic = (Object.keys(content.changeOrders) as ChangeOrderId[]).filter(
      (id) => orderDef(id).scope === 'generic',
    );
    const ids = [...new Set([...clientOf(state).changeOrders, ...generic])];
    // Before the last phase, only phase effects: a request's or a restriction's reward would
    // come at the run's end, where budget buys nothing.
    const last = state.phase >= phaseCount(b) - 1;
    return ids.filter(
      (id) =>
        !offered.has(id) &&
        (!last || orderDef(id).kind === 'phase') &&
        skipReason(state, orderDef(id)) === null,
    );
  }

  /** The 'changeOrder' screen, with this offer: it runs through the state's phase. */
  function offerOrder(
    s: RunState,
    id: ChangeOrderId,
    forced: boolean,
    events: GameEvent[],
  ): RunState {
    const flag = forced ? { forced: true as const } : {};
    const offer: ChangeOrderOffer = { id, phase: s.phase, ...flag };
    events.push({ t: 'changeOrderOffered', id, kind: orderDef(id).kind, phase: s.phase, ...flag });
    return { ...s, screen: 'changeOrder', offers: { ...s.offers, changeOrder: offer } };
  }

  /**
   * The answer: a request or restriction accepted or declined, a phase effect acknowledged (it
   * then runs as a timed effect until its phase's milestone). Then the shop opens, or a forced
   * offer goes back to its week.
   */
  function answerOrder(state: RunState, accept: unknown, events: GameEvent[]): RunState {
    const offer = state.screen === 'changeOrder' ? state.offers?.changeOrder : undefined;
    if (!offer) throw new IllegalAction('There’s no change order to answer.');
    if (typeof accept !== 'boolean')
      throw new IllegalAction('Accept the change order or decline it.');
    const def = orderDef(offer.id);
    if (def.kind === 'phase' && !accept) {
      throw new IllegalAction(`${def.name} can’t be declined: it’s coming either way.`);
    }
    const record: ChangeOrderRecord = {
      id: def.id,
      phase: offer.phase,
      answer: def.kind === 'phase' ? 'acknowledged' : accept ? 'accepted' : 'declined',
      week: state.week,
      sinceUid: state.house.nextUid,
      demolished: 0,
    };
    events.push({
      t: 'changeOrderAnswered',
      id: def.id,
      kind: def.kind,
      accepted: record.answer !== 'declined',
    });
    const { offers: _offers, ...rest } = state;
    const { changeOrder: _answered, ...others } = state.offers ?? {};
    let s: RunState = {
      ...rest,
      ...(Object.keys(others).length > 0 ? { offers: others } : {}),
      changeOrders: [...state.changeOrders, record],
    };
    if (def.kind === 'phase') {
      s = {
        ...s,
        timedEffects: [
          ...s.timedEffects,
          { source: def.id, until: { phase: offer.phase }, modifiers: def.modifiers },
        ],
      };
    }
    if (offer.forced) return { ...s, screen: 'build' };
    return openShop(s, s.phase, false, events);
  }

  /**
   * At a phase's milestone (when it's met): the phase effects that ran through it end, and its
   * accepted requests and restrictions resolve. A request met or a restriction kept pays.
   */
  function resolveOrders(s: RunState, events: GameEvent[]): RunState {
    const ends = (r: ChangeOrderRecord) =>
      r.result === undefined && r.answer !== 'declined' && r.phase <= s.phase;
    const timedEffects = s.timedEffects.filter(
      (e) => !('phase' in e.until) || e.until.phase > s.phase,
    );
    let next = timedEffects.length === s.timedEffects.length ? s : { ...s, timedEffects };
    if (!s.changeOrders.some(ends)) return next;
    const layout = layoutFor(s);
    const rewards: { reward: NonNullable<ChangeOrderRecord['reward']>; key: string }[] = [];
    const changeOrders = s.changeOrders.map((r) => {
      if (!ends(r)) return r;
      const def = orderDef(r.id);
      let result: ChangeOrderResult;
      let reward: ChangeOrderRecord['reward'];
      if (def.kind === 'phase') result = 'ended';
      else if (def.kind === 'request') {
        result = meetsHouse(content, layout, def.condition, orderCtx(s, r)) ? 'met' : 'missed';
        if (result === 'met') reward = def.reward;
      } else {
        result = r.brokenBy === undefined ? 'kept' : 'broken';
        if (result === 'kept') reward = def.reward;
      }
      events.push({
        t: 'changeOrderResolved',
        id: def.id,
        kind: def.kind,
        result,
        ...(reward ? { reward } : {}),
      });
      if (reward) rewards.push({ reward, key: `co/${r.phase}/${r.id}` });
      return { ...r, result, ...(reward ? { reward } : {}) };
    });
    next = { ...next, changeOrders };
    for (const { reward, key } of rewards) next = payReward(next, reward, key, events);
    return next;
  }

  /** The running restrictions a new piece breaks: it matches what one forbids. */
  function breaksOf(state: RunState, house: HouseState, uid: number): ChangeOrderId[] {
    const out: ChangeOrderId[] = [];
    for (const r of running(state)) {
      const def = orderDef(r.id);
      if (def.kind !== 'restriction' || r.brokenBy !== undefined) continue;
      if (matchesPiece(content, layoutFor(state, house), def.forbid, uid)) out.push(def.id);
    }
    return out;
  }

  /** Marks the restrictions a placement broke: from now on they pay nothing. */
  function markBroken(
    state: RunState,
    ids: readonly ChangeOrderId[],
    uid: number,
    events: GameEvent[],
  ): RunState {
    if (ids.length === 0) return state;
    for (const id of ids) events.push({ t: 'changeOrderBroken', id, uid });
    return {
      ...state,
      changeOrders: state.changeOrders.map((r) =>
        ids.includes(r.id) &&
        r.answer === 'accepted' &&
        r.result === undefined &&
        r.brokenBy === undefined
          ? { ...r, brokenBy: uid }
          : r,
      ),
    };
  }

  /** A change order as the UI shows it, with a request's progress. */
  function orderView(
    state: RunState,
    id: ChangeOrderId,
    phase: number,
    record?: ChangeOrderRecord,
  ): ChangeOrderView {
    const def = orderDef(id);
    const view: ChangeOrderView = {
      id,
      name: def.name,
      kind: def.kind,
      text: def.text,
      terms: changeOrderText(content, def),
      phase,
      declinable: def.kind !== 'phase',
    };
    if (def.kind === 'phase') return view;
    if (def.kind === 'restriction') {
      const broken = record?.brokenBy;
      return { ...view, reward: def.reward, ...(broken !== undefined ? { brokenBy: broken } : {}) };
    }
    const layout = layoutFor(state);
    const ctx = orderCtx(state, record ?? { sinceUid: state.house.nextUid, demolished: 0 });
    return {
      ...view,
      reward: def.reward,
      met: meetsHouse(content, layout, def.condition, ctx),
      progress: progressOf(content, layout, def.condition, ctx, noun),
    };
  }

  function startWeek(state: RunState, events: GameEvent[]): RunState {
    // Step 1: transforms; step 2 (M4b): arrivals, in their phase's first week; step 3: the draw.
    let s = arrive(resolveTransforms(state, events), events);
    s = { ...s, draws: 1, hand: drawFor(s, 0), swapped: [], freePlay: 'none' };
    // Start of week, step 4 (D-121): a card with no play is swapped for one from its row.
    const after = swapDead(s, 0);
    events.push({
      t: 'handDrawn',
      phase: s.phase,
      slot: s.slot,
      overtimeWeek: s.overtimeWeek,
      hand: after.state.hand,
      reroll: false,
      ...swapNote(after.swapped),
    });
    return after.state;
  }

  /** A phase starts (after the shop): say if its target is already met, then its first week. */
  function startPhase(state: RunState, events: GameEvent[]): RunState {
    // Again here, so a Foreman bought in the shop counts from this phase.
    const s = { ...state, rerollsLeft: rule(state, 'rerollsPerPhase') };
    const target = targetOf(s);
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
      pace: paceFor(b, state.phase, state.phaseStartScore, pctOf(state)),
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
    // The checklist's lines that flipped since the last tally (M4a).
    const wasMet = state.lastTally?.specsMet ?? [];
    tally.specs.forEach((sp, index) => {
      const was = wasMet[index] ?? false;
      if (sp.met && !was) events.push({ t: 'specMet', id: sp.id, index });
      else if (!sp.met && was) events.push({ t: 'specLost', id: sp.id, index });
    });
    const target = targetOf(state);
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
      // Tools' effects last for this week's tally only; a phase effect until its milestone.
      timedEffects: state.timedEffects.filter(
        (e) => !('week' in e.until) || e.until.week > state.week,
      ),
      lastTally: {
        points: tally.points,
        mult: tally.mult,
        total: tally.total,
        setInstances: tally.sets.map((s) => s.key),
        specsMet: tally.specs.map((sp) => sp.met),
      },
    };
  }

  /** End of week, after the tally: early completion, the milestone, overtime, or the next week. */
  function afterTally(s: RunState, events: GameEvent[]): RunState {
    const target = targetOf(s);
    if (s.overtimeWeek === 0 && s.slot < W && s.autoComplete && s.score >= target) {
      return completeEarly(s, W - s.slot, false, events);
    }
    if (s.overtimeWeek > 0 || s.slot >= W) return endOfPhase(s, events);
    return startWeek({ ...s, slot: s.slot + 1, week: s.week + 1 }, events);
  }

  function endOfPhase(s: RunState, events: GameEvent[]): RunState {
    const target = targetOf(s);
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
    const target = targetOf(s);
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
    // M4b: the phase's effects end, and its accepted change orders resolve (a met milestone only).
    if (result !== 'failed') next = resolveOrders(next, events);
    const last = s.phase === phaseCount(b) - 1;
    if (result === 'failed' || last) {
      const won = result !== 'failed';
      events.push({
        t: 'runEnded',
        result: won ? 'won' : 'lost',
        score: next.score,
        phase: s.phase,
        verdict: verdictFor(b, next.score, won, pctOf(s)),
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
      phaseStartScore: next.score,
      rerollsLeft: rule(s, 'rerollsPerPhase'),
    };
    // M4b: after milestones 2, 4, and 6, one change order first, from `co/<milestone>`; with
    // none eligible, straight to the shop.
    const milestone = s.phase + 1;
    if (b.changeOrderAfter.includes(milestone)) {
      const eligible = eligibleOrders(next);
      if (eligible.length > 0) {
        const id = stream(next.setup.seed, `co/${milestone}`).pick(eligible);
        return offerOrder(next, id, false, events);
      }
    }
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
    if (state.screen !== 'build') return { ok: false, reason: offScreen(state) };
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
    if (state.screen !== 'build') return no(offScreen(state));
    if (state.overtimeWeek > 0) return no('An overtime week can’t be completed early.');
    if (state.score < targetOf(state)) return no('Reach the target first.');
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
      // A shop the ?debug panel opened mid-week: back to the same week, with a fresh hand,
      // drawn and swapped as a reroll of both rows would be.
      const after = swapDead(
        { ...s, hand: drawFor(s, s.draws), draws: s.draws + 1, swapped: [] },
        s.draws,
      );
      events.push({
        t: 'handDrawn',
        phase: s.phase,
        slot: s.slot,
        overtimeWeek: s.overtimeWeek,
        hand: after.state.hand,
        reroll: false,
        ...swapNote(after.swapped),
      });
      return after.state;
    }
    return startPhase(s, events);
  }

  // -------------------------------------------------------------------------------------
  // New runs and actions.

  function newRun(setup: RunSetup): RunState {
    if (
      typeof setup.seed !== 'string' ||
      setup.mode !== 'standard' ||
      !Object.hasOwn(content.crews, setup.crewId) ||
      !Object.hasOwn(content.clients, setup.clientId)
    ) {
      throw new Error('Bad run setup');
    }
    const lot = generateLot(setup.seed, b.lot);
    const clean: RunSetup = {
      seed: setup.seed,
      clientId: setup.clientId,
      crewId: setup.crewId,
      mode: setup.mode,
    };
    // M4b: a crew's starting cards wait in the reserve's extra slots.
    const crewCards = (content.crews[clean.crewId].startReserve ?? []).map((id): ReservePiece => ({
      id,
      crew: true,
    }));
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
      reserve: crewCards,
      supplies: [],
      blueprints: [],
      upgrades: [],
      setLevels: {},
      timedEffects: [],
      freePlay: 'none',
      servicesBought: { reroll: 0, demolition: 0, strike: 0 },
      struck: [],
      rerollsLeft: setupRule(content, clean, 'rerollsPerPhase'),
      bonusRerolls: 0,
      demolitionsLeft: setupRule(content, clean, 'demolitions'),
      overtimeLeft: setupRule(content, clean, 'overtime'),
      swapped: [],
      autoComplete: false,
      milestonesEarly: 0,
      milestones: [],
      lastTally: null,
      screen: 'build',
      changeOrders: [],
      arrived: [],
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
        const target = targetOf(s);
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
      case 'forceChangeOrder': {
        // M4b: offered now, as if a milestone had just been met; it runs through this phase.
        if (s.screen !== 'build')
          throw new IllegalAction('A change order is forced from the build screen.');
        if (typeof action.id !== 'string' || !Object.hasOwn(content.changeOrders, action.id)) {
          throw new IllegalAction('Unknown change order.');
        }
        return offerOrder(s, action.id, true, events);
      }
      case 'forceArrival': {
        // M4b: this household's member moves in now.
        const a = clientOf(s).household.arrivals.find((x) => x.id === action.id);
        if (!a) throw new IllegalAction('No one by that name is joining this household.');
        if (s.arrived.includes(a.id)) throw new IllegalAction(`${a.name} already moved in.`);
        return land(s, a, events, true);
      }
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
  /** M4b: the 'changeOrder' screen waits for its answer (the auto-complete toggle and cheats aside). */
  const CHANGE_ORDER_ACTIONS = new Set<Action['t']>([
    'answerChangeOrder',
    'setAutoComplete',
    'debug',
  ]);

  function apply(state: RunState, action: Action): { state: RunState; events: GameEvent[] } {
    if (state.screen === 'won' || state.screen === 'lost')
      throw new IllegalAction('The run is over.');
    if (state.screen === 'shop' && !SHOP_ACTIONS.has(action.t)) {
      throw new IllegalAction('The shop is open. Leave it to start the next phase.');
    }
    if (state.screen === 'changeOrder' && !CHANGE_ORDER_ACTIONS.has(action.t)) {
      throw new IllegalAction('A change order is waiting for your answer.');
    }
    const shopOnly =
      action.t === 'buy' ||
      action.t === 'refreshShop' ||
      action.t === 'leaveShop' ||
      action.t === 'pick';
    if (state.screen === 'build' && shopOnly) throw new IllegalAction(SHOP_REASONS.notOpen);
    // An open crate waits for its pick (or a discard); selling to make room is fine.
    if (state.offers?.pick && shopOnly && action.t !== 'pick') {
      throw new IllegalAction(SHOP_REASONS.picking);
    }
    const events: GameEvent[] = [];
    const done = (s: RunState) => ({ state: s, events });
    switch (action.t) {
      case 'pass':
      case 'place':
      case 'install':
      case 'renovate': {
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
        const fromReserve =
          (play?.t === 'place' || play?.t === 'renovate') && play.from === 'reserve';
        if (play && state.freePlay === 'ready') {
          // Weekend Crew (D-075): this play doesn't end the week. A Renovation can be it (D-083).
          const result = applyPlay(state, play, check);
          if (result.placed) events.push({ ...result.placed, free: true });
          if (result.installed) events.push({ ...result.installed, free: true });
          if (result.renovated) events.push({ ...result.renovated, free: true });
          let s: RunState = { ...state, house: result.house, freePlay: 'used' };
          s = fromReserve
            ? { ...s, reserve: s.reserve.filter((_, k) => k !== play.i) }
            : { ...s, hand: s.hand.filter((_, k) => k !== play.i) };
          // M4b: a piece a running restriction forbids breaks it.
          if (result.placed) {
            const uid = result.placed.uid;
            s = markBroken(s, breaksOf(state, result.house, uid), uid, events);
          }
          return done(payFinds(s, check?.finds, events, state.house.lot));
        }
        const week = resolveWeek(state, play, true, check);
        if (week.placed) events.push(week.placed);
        if (week.installed) events.push(week.installed);
        if (week.renovated) events.push(week.renovated);
        let s = state;
        if (play && fromReserve) {
          s = { ...s, reserve: s.reserve.filter((_, k) => k !== play.i) };
        }
        // M4b: a piece a running restriction forbids breaks it, before the milestone can resolve.
        if (week.placed) {
          const uid = week.placed.uid;
          s = markBroken(s, breaksOf(state, week.house, uid), uid, events);
        }
        // A Time Capsule built over pays before the tally.
        s = payFinds(s, check?.finds, events);
        s = recordTally(s, week.house, week.tally, play === null, false, events);
        return done(afterTally(s, events));
      }
      case 'reroll': {
        const can = canReroll(state);
        if (!can.ok) throw new IllegalAction(can.reason!);
        // Both rows (D-132), then their swaps, as at the start of a week.
        const n = state.draws;
        // The phase's own rerolls go first; bought ones never expire.
        const fromPhase = state.rerollsLeft > 0;
        const after = swapDead(
          {
            ...state,
            hand: drawFor(state, n),
            swapped: [],
            draws: n + 1,
            rerollsLeft: fromPhase ? state.rerollsLeft - 1 : state.rerollsLeft,
            bonusRerolls: fromPhase ? state.bonusRerolls : state.bonusRerolls - 1,
          },
          n,
        );
        events.push({
          t: 'handDrawn',
          phase: state.phase,
          slot: state.slot,
          overtimeWeek: state.overtimeWeek,
          hand: after.state.hand,
          reroll: true,
          ...swapNote(after.swapped),
        });
        return done(after.state);
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
        // M4b: a running request counts the pieces demolished since it was accepted (Declutter).
        if (target.kind === 'piece' && running(s).length > 0) {
          s = {
            ...s,
            changeOrders: s.changeOrders.map((r) =>
              r.answer === 'accepted' && r.result === undefined
                ? { ...r, demolished: r.demolished + 1 }
                : r,
            ),
          };
        }
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
      case 'answerChangeOrder':
        return done(answerOrder(state, action.accept, events));
      case 'debug':
        return done(applyDebug(state, action, events));
      default:
        throw new IllegalAction(`Unknown action "${(action as { t: unknown }).t}".`);
    }
  }

  // -------------------------------------------------------------------------------------
  // Queries.

  const shapesCache = new Map<PieceDef, PlacementShape[]>();
  /**
   * The shapes a card is listed at: its distinct rotations, or for a pack (D-106) a single
   * tile and each suggested shape in each rotation, as its own rows at rot 0.
   */
  function placementShapes(def: PieceDef): PlacementShape[] {
    let out = shapesCache.get(def);
    if (out) return out;
    out = [];
    if (!def.pack) {
      for (const rot of uniqueRotations(def.shape)) {
        out.push({ rot, cells: shapeCells(def.shape, rot) });
      }
    } else {
      const seen = new Set<string>();
      for (const s of [['#'], ...def.pack.shapes]) {
        for (const rot of uniqueRotations(s)) {
          const rows = rotateShape(s, rot);
          const key = rows.join('/');
          if (seen.has(key) || packShapeProblem(rows, def.pack.maxTiles)) continue;
          seen.add(key);
          out.push({ rot: 0, shape: rows, cells: shapeCells(rows, 0) });
        }
      }
    }
    shapesCache.set(def, out);
    return out;
  }

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
    for (const ps of placementShapes(def)) {
      const { w, h } = bounds(ps.cells);
      for (let y = 0; y + h <= height; y++) {
        for (let x = 0; x + w <= width; x++) {
          const play: PlaceAction = ps.shape
            ? { t: 'place', from, i, x, y, rot: ps.rot, shape: ps.shape }
            : { t: 'place', from, i, x, y, rot: ps.rot };
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

  /** D-107: each legal host with its install preview's delta, net of what it would replace. */
  function installGains(state: RunState, from: InstallAction['from'], i: number): InstallGain[] {
    return hostsFor(state, from, i).map((uid) => {
      const p = preview(state, { t: 'install', from, i, uid });
      return p.replaces ? { uid, gain: p.delta, replaces: p.replaces } : { uid, gain: p.delta };
    });
  }

  /**
   * Whether the state's week has started (its transforms, arrivals, and draw have run): on the
   * build screen, and in a shop or change order the ?debug panel opened mid-week, which go back
   * to it. A shop or change order a milestone opened comes before the next phase's first week,
   * which leaving the shop starts. The end screens come after the run's last week.
   */
  function weekStarted(state: RunState): boolean {
    if (state.screen === 'shop') return !!state.offers?.shop?.forced;
    if (state.screen === 'changeOrder') return !!state.offers?.changeOrder?.forced;
    return true;
  }

  /**
   * The build screen's state for the week a fixture bought now would first earn in (D-107):
   * this one, or in the shop the next phase's first week, its transforms resolved as leaving
   * starts it (its arrivals only fill the reserve). A shop the ?debug panel opened mid-week
   * goes back to that week. Null on the other screens.
   */
  function installWeek(state: RunState): RunState | null {
    if (state.screen === 'build') return state;
    if (state.screen !== 'shop') return null;
    const { offers: _offers, ...rest } = state;
    const s: RunState = { ...rest, screen: 'build' };
    return weekStarted(state) ? s : resolveTransforms(s, []);
  }

  function fixtureValue(state: RunState, fixture: FixtureId): FixtureValue | null {
    if (!Object.hasOwn(content.fixtures, fixture)) return null;
    const week = installWeek(state);
    if (!week) return null;
    // As if bought: one more supply, whose free install previews as the same change.
    const s: RunState = { ...week, supplies: [...week.supplies, { kind: 'fixture', id: fixture }] };
    let best: InstallGain | null = null;
    for (const g of installGains(s, 'supplies', s.supplies.length - 1)) {
      if (!best || g.gain > best.gain) best = g;
    }
    if (!best) return null;
    const host = best.uid;
    // This phase's weeks left, then every later phase's (overtime can't be foreseen).
    const weeks = weeksLeft(s) + Math.max(0, phaseCount(b) - 1 - s.phase) * W;
    return {
      host,
      // The host as it's valued: in the shop, a Nursery that grows into a Kids' Room as the
      // next phase starts is one here.
      hostDefId: s.house.pieces.find((p) => p.uid === host)!.defId,
      gain: best.gain,
      ...(best.replaces ? { replaces: best.replaces } : {}),
      weeksLeft: weeks,
      overRun: best.gain * weeks,
    };
  }

  function legalPlacements(state: RunState): PlaceAction[] {
    const out: PlaceAction[] = [];
    state.hand.forEach((_, i) => eachLegalSpot(state, 'hand', i, (play) => void out.push(play)));
    state.reserve.forEach((_, i) =>
      eachLegalSpot(state, 'reserve', i, (play) => void out.push(play)),
    );
    return out;
  }

  function renovateTargets(state: RunState, from: RenovateAction['from'], i: number): number[] {
    if (state.screen !== 'build') return [];
    const def = placeDef(state, { t: 'renovate', from, i, uid: 0 });
    if (!def || !limitReached(limitsOf(state), rootType(def))) return [];
    const out: number[] = [];
    for (const p of state.house.pieces) {
      if (checkRenovate(state, { t: 'renovate', from, i, uid: p.uid }).legal) out.push(p.uid);
    }
    return out;
  }

  function legalPlays(state: RunState): (PlaceAction | InstallAction | RenovateAction)[] {
    const out: (PlaceAction | InstallAction | RenovateAction)[] = legalPlacements(state);
    state.hand.forEach((card, i) => {
      if (card.kind !== 'fixture') return;
      for (const uid of hostsFor(state, 'hand', i))
        out.push({ t: 'install', from: 'hand', i, uid });
    });
    // Renovations, after placements, so a bot that takes the first legal play still builds.
    state.hand.forEach((card, i) => {
      if (card.kind !== 'piece') return;
      for (const uid of renovateTargets(state, 'hand', i))
        out.push({ t: 'renovate', from: 'hand', i, uid });
    });
    state.reserve.forEach((_, i) => {
      for (const uid of renovateTargets(state, 'reserve', i))
        out.push({ t: 'renovate', from: 'reserve', i, uid });
    });
    return out;
  }

  function legalActions(state: RunState): Action[] {
    if (state.screen === 'changeOrder') {
      // M4b: accept or decline; a phase effect is only acknowledged.
      const offer = state.offers?.changeOrder;
      if (!offer) return [];
      const yes: Action = { t: 'answerChangeOrder', accept: true };
      if (orderDef(offer.id).kind === 'phase') return [yes];
      return [yes, { t: 'answerChangeOrder', accept: false }];
    }
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
    // Transforms happen at a week's start. Once this week's has run, a piece already old
    // enough (Fertilizer, mid-week) changes at the next one; in a shop or change order a
    // milestone opened, the next phase's first week is still to start, so it changes then.
    const soonest = weekStarted(state) ? 1 : 0;
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
        const when = state.week + Math.max(soonest, e.afterWeeks - age);
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
      specsGained: [],
      specsLost: [],
      xMults: beforeTally?.xMults ?? [],
      finds: [],
      parts: [],
    });
    if (!beforeTally) return empty(offScreen(state));
    if (!play) {
      return { ...empty(undefined), legal: true };
    }
    const check = checkPlay(state, play);
    if (!check.legal) return empty(check.reason, check.cells);
    const week = resolveWeek(state, play, true, check);
    // M4b: a running restriction this placement would break, for the warning.
    const breaks = week.placed ? breaksOf(state, week.house, week.placed.uid)[0] : undefined;
    const focus = week.placed?.uid ?? week.installed?.uid ?? week.renovated!.uid;
    const beforeEarned = new Map<number, PieceScore>(beforeTally.pieces.map((p) => [p.uid, p]));
    const lines: PreviewLine[] = [];
    let newPiece: PieceScore | null = null;
    for (const p of week.tally.pieces) {
      // The new piece, or an install's host, or the room a Renovation levels.
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
    const wasMet = new Map(beforeTally.specs.map((sp) => [sp.id, sp.met]));
    const sunny =
      !!week.placed && !!layoutFor(state, week.house).tags.get(week.placed.uid)?.has('Sunny');
    // D-122: where the change comes from, named on the board.
    const specs = clientOf(state).specs;
    const specName = (id: string) => specs.find((sp) => sp.id === id)?.name ?? id;
    return {
      legal: true,
      ...(sunny ? { sunny: true as const } : {}),
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
      specsGained: week.tally.specs.filter((sp) => sp.met && !wasMet.get(sp.id)).map((sp) => sp.id),
      specsLost: week.tally.specs.filter((sp) => !sp.met && wasMet.get(sp.id)).map((sp) => sp.id),
      xMults: week.tally.xMults,
      finds: (check.finds ?? []).flatMap((c) => {
        const feature = state.house.lot.terrain[cellIndex(state.house.lot.width, c.x, c.y)];
        const reward = feature ? content.features[feature].reward : undefined;
        return feature && reward ? [{ x: c.x, y: c.y, feature, reward }] : [];
      }),
      ...(week.installed
        ? {
            host: week.installed.uid,
            ...(week.installed.replaced ? { replaces: week.installed.replaced } : {}),
          }
        : {}),
      ...(week.renovated
        ? { renovates: { uid: week.renovated.uid, level: week.renovated.level } }
        : {}),
      ...(breaks ? { breaks } : {}),
      parts: wowParts(content, beforeTally, week.tally, focus, specName),
    };
  }

  /** "Bedrooms", "rooms": what a selector's pieces are called. */
  const noun: NounFn = (sel, n) => selectorText(content, sel, n === 1 ? 'one' : 'some');

  function checklist(state: RunState, play?: Play): ChecklistLine[] {
    let house = state.house;
    if (play && state.screen === 'build') {
      const check = checkPlay(state, play);
      if (check.legal) house = applyPlay(state, play, check).house;
    }
    const layout = layoutFor(state, house);
    const ctx = { phase: state.phase };
    return clientOf(state).specs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      group: spec.group,
      met: meetsHouse(content, layout, spec.condition, ctx),
      text: specText(content, spec),
      progress: progressOf(content, layout, spec.condition, ctx, noun),
    }));
  }

  function scoreOnly(state: RunState, play: Play): number {
    if (state.screen !== 'build') return 0;
    return resolveWeek(state, play, false).tally.total;
  }

  /** The checklist lines that flip from one tally to another (spec ids). */
  function specFlips(before: Tally, after: Tally): { specsGained: string[]; specsLost: string[] } {
    const was = new Map(before.specs.map((sp) => [sp.id, sp.met]));
    return {
      specsGained: after.specs.filter((sp) => sp.met && !was.get(sp.id)).map((sp) => sp.id),
      specsLost: after.specs.filter((sp) => !sp.met && was.get(sp.id)).map((sp) => sp.id),
    };
  }

  /**
   * The sets one tally holds that another doesn't, by key (as preview's), except that an
   * instance re-formed from other pieces (the same set, new members) is neither lost nor
   * gained: a lost instance and a gained one of the same set cancel out.
   */
  function setFlips(before: Tally, after: Tally): { setsGained: SetScore[]; setsLost: SetScore[] } {
    const was = new Set(before.sets.map((s) => s.key));
    const now = new Set(after.sets.map((s) => s.key));
    const setsGained = after.sets.filter((s) => !was.has(s.key));
    const setsLost: SetScore[] = [];
    for (const s of before.sets) {
      if (now.has(s.key)) continue;
      const again = setsGained.findIndex((g) => g.set === s.set);
      if (again >= 0) setsGained.splice(again, 1);
      else setsLost.push(s);
    }
    return { setsGained, setsLost };
  }

  function previewDemolish(state: RunState, x: number, y: number): DemolishPreview {
    const beforeTally = state.screen === 'build' ? passTally(state) : null;
    const before = beforeTally ? score(beforeTally) : { points: 0, mult: 100, total: 0 };
    const base = {
      before,
      after: before,
      delta: 0,
      specsGained: [],
      specsLost: [],
      setsGained: [],
      setsLost: [],
    };
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
    const afterTally = tallyOf(state, house, false);
    const after = score(afterTally);
    return {
      legal: true,
      target,
      cells,
      before,
      after,
      delta: after.total - before.total,
      ...specFlips(beforeTally, afterTally),
      ...setFlips(beforeTally, afterTally),
    };
  }

  /**
   * Where each of a piece's effective tags comes from (describePiece): its card, the layout,
   * then each modifier granting it, once each. The layout names a run modifier's grant by its
   * index among the run's layout modifiers, which are this state's, in the same order (equal
   * lists share one interned array).
   */
  function tagSourcesOf(
    state: RunState,
    layout: Layout,
    piece: PlacedPiece,
    tags: readonly Tag[],
  ): Partial<Record<Tag, TagSource[]>> {
    const own = content.pieces[piece.defId].tags;
    const runLayout = modsOf(state).active.filter((a) => isLayoutModifier(a.mod));
    const grants = layout.grants.get(piece.uid) ?? [];
    const out: Partial<Record<Tag, TagSource[]>> = {};
    for (const tag of tags) {
      const from: TagSource[] = [];
      if (own.includes(tag)) from.push({ kind: 'card' });
      if (tag === 'Dark' && layout.interior.has(piece.uid)) from.push({ kind: 'interior' });
      if (
        tag === 'Sunny' &&
        isBuilding(pieceDef(content, piece)) &&
        tilesIn(layout, piece.uid, 'sunny') > 0
      )
        from.push({ kind: 'sunny' });
      for (const g of grants) {
        if (g.tag !== tag) continue;
        const host = 'host' in g ? layout.byUid.get(g.host) : undefined;
        const source: TagSource | undefined =
          'mod' in g
            ? runLayout[g.mod]?.source
            : host?.fixture && { kind: 'fixture', id: host.fixture.id, uid: host.uid };
        const key = JSON.stringify(source);
        if (source && !from.some((f) => JSON.stringify(f) === key)) from.push(source);
      }
      out[tag] = from;
    }
    return out;
  }

  function replay(setup: RunSetup, actions: readonly Action[]): ReplayResult {
    let state: RunState;
    try {
      state = newRun(setup);
    } catch (e) {
      // A setup this build can't start (a crew or client it doesn't have): fail softly at step
      // 0, from the same seed with the default crew and client, so a stale code never crashes
      // the page.
      const crewId = Object.keys(content.crews)[0] as RunSetup['crewId'];
      const clientId = Object.keys(content.clients)[0] as RunSetup['clientId'];
      return {
        state: newRun({ seed: String(setup?.seed ?? ''), clientId, crewId, mode: 'standard' }),
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
    target: (state) => targetOf(state),
    pace: (state) => paceFor(b, state.phase, state.phaseStartScore, pctOf(state)),
    phaseName: (phase) => phaseName(b, phase),
    verdict: (state) => verdictFor(b, state.score, state.screen === 'won', pctOf(state)),
    nextVerdict: (state) => nextVerdictFor(b, state.score, state.screen === 'won', pctOf(state)),
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
    renovateTargets,
    limits: limitsOf,
    checklist,
    installHosts: hostsFor,
    installGains,
    fixtureValue,
    estimatePlay: (state, play) => {
      const def = placeDef(state, play);
      if (!def) throw new IllegalAction('There is no card there.');
      return estimatePlay(
        content,
        layoutFor(state),
        passTally(state),
        def,
        placedCells(play.shape ?? def.shape, play.x, play.y, play.rot),
        modsOf(state).active,
        { specs: clientOf(state).specs, phase: state.phase },
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
      const piece = layout.byUid.get(uid);
      if (!piece) return null;
      const regions = (Object.keys(REGION_BIT) as Region[]).filter((r) => pieceIn(layout, uid, r));
      const tags = [...(layout.tags.get(uid) ?? [])];
      const { width } = state.house.lot;
      const sunlit = (layout.cells.get(uid) ?? [])
        .filter((c) => layout.regionBits[cellIndex(width, c.x, c.y)]! & REGION_BIT.sunny)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      return {
        tags,
        tagSources: tagSourcesOf(state, layout, piece, tags),
        side: layout.exterior.has(uid) ? 'exterior' : layout.interior.has(uid) ? 'interior' : null,
        regions,
        sunlit,
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
      const base = {
        before,
        after: before,
        delta: 0,
        cells: [] as readonly Cell[],
        specsGained: [],
        specsLost: [],
        setsGained: [],
        setsLost: [],
      };
      const can = canUseTool(toolCtx, state, action);
      if (!can.ok) return { ok: false, reason: can.reason, ...base };
      const afterTally = passTally(useTool(toolCtx, state, action, []));
      const after = score(afterTally);
      const move = action.target?.x !== undefined ? toolCtx.checkMove(state, action) : null;
      const cells = move?.legal ? move.cells : [];
      return {
        ok: true,
        before,
        after,
        delta: after.total - before.total,
        cells,
        ...specFlips(passTally(state), afterTally),
        ...setFlips(passTally(state), afterTally),
      };
    },
    changeOrderOffer: (state) => {
      const offer = state.screen === 'changeOrder' ? state.offers?.changeOrder : undefined;
      return offer ? orderView(state, offer.id, offer.phase) : null;
    },
    activeChangeOrders: (state) =>
      state.changeOrders
        .filter((r) => r.result === undefined && r.answer !== 'declined')
        .map((r) => orderView(state, r.id, r.phase, r)),
    eligibleChangeOrders: eligibleOrders,
    replay,
  };
}
