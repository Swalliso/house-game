// RunState, apply(), and the week's transitions (implementation-plan.md §4, Transitions).
//
// The rules are a reducer: apply(state, action) → { state, events }. It never mutates its
// input and throws IllegalAction with a reason. resolveWeek() is the one end-of-week step;
// apply() and preview() both call it, so they can't disagree.
//
// A week: place a card from the hand, install a fixture from the hand, or pass (each ends the
// week), with free actions before that: place a piece from the reserve (D-163: Your goods don't
// use the week), install from the supplies, sell, reroll, demolish, complete early, and the
// auto-complete toggle.
//
// End of week: the tally adds to the score and budget. If auto-complete is on, the target is
// met, and weeks remain, the milestone completes early. At the phase's last week (or an
// overtime week): target met → the milestone resolves; otherwise an overtime week starts if
// any are left (D-041), or the run is lost.
//
// Milestones: after milestones 1–6 the shop opens (D-051); leaving it starts the next phase.
// After the last one the run is won. Tools (M3b) are free actions; Weekend Crew makes the
// week's next card from the hand free too (D-075, D-163). Finds pay once: the Old Shed when
// demolished, a Time Capsule when first built over.
//
// Start of week: transforms resolve (a Sapling old enough becomes a Tree), the household's
// arrivals move in at their phase's first week (M4b, D-103: their cards go into the reserve's
// extra slots), what the client brings for that phase follows them, and the standing stock fills
// those slots up to a Hallway and a Fence (D-160: only what's missing): once, in week 1 (D-162; a
// first job's in Foundation's third week), and again at each milestone's first week only with
// `refill` (D-163). Then the hand is drawn in two rows, Rooms then Layout (D-121).
// A card with no play at all (no spot, no host, no Renovation) is swapped for another from its
// row, trying up to `swapTries` cards; that replaced D-070's free redraw. A reroll redraws both
// rows, then swaps (D-132; D-121 had a reroll per row). Neither its draw nor its swaps deal back
// a card it replaced while its row's pool has enough others.
//
// Strikes (D-157): a free action on a hand card. Its type (a piece's root type, or a fixture)
// is never drawn again this run (D-084's per-row floors hold), and it and any other hand card
// of that type leave at once, each slot taking a card from its row as a swap would, on a
// stream of its own. The run starts with the `strikes` rule's count and gains
// `strikesPerMilestone` at each milestone it goes on from; the shop's service is +1 strike.
//
// Change orders (M4b): when a milestone resolves, the phase effects that ran through it end
// and its requests and restrictions resolve (a request met and a restriction kept pay their
// reward). After milestones 2, 4, and 6 (`changeOrderAfter`) two change orders are then drawn
// from `co/<milestone>` among the eligible ones (the client's and the generic ones, never one
// picked before, minus Appendix A's skips), and the 'changeOrder' screen waits for one to be
// picked before the shop opens (D-144). The one picked runs through the next phase; the other
// goes back in the pool. Placing a piece a running restriction forbids breaks it; the
// placement stays legal.
//
// Early completion (D-040): the bonus is computed at once from this phase's earnings and the
// weeks saved; the remaining weeks then fast-forward (pieces earn and timers tick, but no
// hands are drawn), and the milestone resolves as 'early'.

import type {
  Action,
  ArrivalDef,
  Availability,
  BlueprintId,
  BlueprintValue,
  BuyAction,
  Card,
  CardType,
  DrawRow,
  Cell,
  ExtendAction,
  ChangeOrderDef,
  ChangeOrderId,
  ChangeOrderOffer,
  ChangeOrderOfferView,
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
  HoldDrop,
  HouseState,
  InstallAction,
  InstallGain,
  Legality,
  MilestoneRecord,
  MilestoneReward,
  MilestoneResult,
  OfferView,
  PieceDef,
  PieceId,
  PieceInfo,
  PieceScore,
  PieceValue,
  PlaceAction,
  PlacedPiece,
  Region,
  Play,
  Preview,
  PreviewLine,
  ReachOf,
  ReplayResult,
  Reward,
  RenovateAction,
  ReservePiece,
  Rot,
  RuleKey,
  RunSetup,
  RunState,
  SellAction,
  StrikePreview,
  StruckSlot,
  SwappedCard,
  SetId,
  SetProgress,
  SetScore,
  ShelfGood,
  ShopVisit,
  Slots,
  Tag,
  TagSource,
  Tally,
  TileInfo,
  ToolId,
  ToolValue,
  TypeLimit,
  UpgradeDelivery,
  UpgradeId,
  UseToolAction,
  WeekScore,
} from './index.ts';
import {
  demolitionsNeeded,
  limitReached,
  meetsHouse,
  neededTypes,
  newPiecesNeeded,
  perHouseLimits,
  progressOf,
  typeLimits,
  typesAtLimit,
  type CondCtx,
  type NounFn,
} from './conditions.ts';
import {
  blueprintNeeds,
  countedNoun,
  countingMod,
  grows,
  lastWeekOnly,
  modifiersNeeds,
  scalingStat,
  scoresWeek,
  totalWithOneMore,
} from './blueprint-value.ts';
import {
  clearNote,
  copyNote,
  NO_NUMBER,
  payingDef,
  rhythmOf,
  setNeeds,
  timersNote,
} from './good-value.ts';
import {
  DRAW_ROWS,
  drawableTypes,
  drawHand,
  drawWeights,
  isStruck,
  rowOf,
  slotKey,
  strikeCandidates,
  swapCandidates,
} from './draw.ts';
import { estimatePlay, type Estimate, type EstimateOptions } from './estimate.ts';
import { checkInstall, installHosts, withFixture } from './fixtures.ts';
import { isFinished } from './finished.ts';
import {
  bounds,
  cellIndex,
  cellsToShape,
  ORTHOGONAL,
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
  reachOf,
  REGION_BIT,
  tilesIn,
  tilesWithin,
  type Layout,
  type LayoutModifier,
} from './layout.ts';
import { generateLot, withTraits } from './lot.ts';
import {
  earlyBonus,
  isRunMode,
  paceFor,
  phaseCount,
  phaseName,
  phaseTarget,
  nextVerdictFor,
  targetPctFor,
  verdictFor,
} from './milestones.ts';
import { ruleFrom, runModifiers, setupRule, sourceName, type ActiveMod } from './modifiers.ts';
import {
  addPiece,
  clearTiles,
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
import { isType, matchesPiece, meetsCondition, rootType, type Yard } from './selectors.ts';
import { setProgress as setProgressOf } from './sets.ts';
import { shelfFor, type Shelf } from './shelf.ts';
import { isRoom } from './layout.ts';
import {
  canStrike,
  crateOptions,
  heldIndex,
  HOLD_REASONS,
  inExtraSlot,
  offerPrice,
  openVisit,
  refreshPrice,
  refreshVisit,
  reserveUsed,
  roomFor,
  roomForOption,
  sellPrice,
  shelfGood,
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
  perHouseOf,
  plural,
  selectorText,
  specText,
  strikeText,
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
  checkPlay(state: RunState, play: NonNullable<Play>): Legality;
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
  /** The Wow the phase's target still needs, 0 once it's met: the week's stamp says it (D-154). */
  toGo(state: RunState): number;
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
  /**
   * D-163: whether a play ends the week. A play from Your goods (the reserve) never does; nor
   * does the next hand card while Weekend Crew is ready (D-083).
   */
  endsWeek(state: RunState, play: NonNullable<Play>): boolean;
  /**
   * Every legal play: placements, hand fixtures in each host, Renovations, and extensions
   * (D-168). `endsWeek` says which end the week (D-163: a play from Your goods doesn't).
   */
  legalPlays(state: RunState): NonNullable<Play>[];
  /** The rooms a hand or reserve card could renovate now (empty unless its type is at its limit). */
  renovateTargets(state: RunState, from: RenovateAction['from'], i: number): number[];
  /**
   * D-168: every legal extension by a hand or reserve card, of room `uid` or of every room it
   * can extend, rooms in placement order, then by rotation and spot.
   */
  extendSpots(state: RunState, from: ExtendAction['from'], i: number, uid?: number): ExtendAction[];
  /** D-168: the rooms a hand or reserve card could extend now, in placement order. */
  extendTargets(state: RunState, from: ExtendAction['from'], i: number): number[];
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
   * D-141: what a blueprint would add to the house as it stands, for the shop's line: the
   * week's total with it in play, less without, and each week left in the run added up with
   * nothing more built (the house's timers run on, each phase's last week counts as one, and
   * overtime is left out). It's valued as if bought now, or, if it's held already, against the
   * run without it. In the shop the first week is the next phase's first, after the transforms
   * that start it, as for a fixture. A blueprint that acts only in a phase's last week gives
   * that week's gain (`when`); one that grows says how far (`growsTo`); budget is counted
   * apart; and one that would add nothing says what it's waiting for (`needs`). Null off the
   * build and shop screens, or for a blueprint that changes no tally.
   */
  blueprintValue(state: RunState, id: BlueprintId): BlueprintValue | null;
  /**
   * D-193: what a piece would add to the house as it stands, for its line on a shop card, a
   * crate's option, or in Inspect: its best play from Your goods (a spot, or for a type at its
   * limit a Renovation or an extension), found as the shop bot finds one (the best few spots by
   * estimatePlay, and the few it flags as blind spots, each scored exactly), with the week's
   * total with it less without, and each week left in the run added up with nothing more built,
   * as blueprintValue's are. In the shop the first week is the next phase's first, after the
   * transforms that start it. Null if it has no legal play, or off the build and shop screens.
   */
  pieceValue(state: RunState, id: PieceId): PieceValue | null;
  /**
   * D-193: what a tool would do for the house as it stands, used in the week a fixture would be
   * valued in: a one-week tool's gain that week (Rush Order); a Remodel Plan's next level, that
   * week and over the run, or what it's waiting for; and for a tool whose worth hangs on a
   * choice made when it's used, what it would do here (a Fertilizer, a Copy Machine, a
   * Dumpster) or why it has no number. Null off the build and shop screens.
   */
  toolValue(state: RunState, id: ToolId): ToolValue | null;
  /**
   * A cheap local estimate of a legal play's change to the week's total, for ranking
   * candidates before scoring the best few exactly (§4, Performance), checklist lines that
   * counts decide included (`specFlips`). Its hints mark plays whose payoff it can't see:
   * `setHint`, one that might complete a set; `yardHint`, a Fence that would close a new
   * fenced yard; `linkHint`, a Hallway that would link rooms anew; `specHint`, a piece that
   * would join an unmet pair line's types. `opts`: what it reads beyond what the bots ask of
   * it, as the value lines do (D-193).
   */
  estimatePlay(state: RunState, play: PlaceAction, opts?: EstimateOptions): Estimate;
  /** The tile counts of the house's fenced yards. */
  fencedYards(state: RunState): readonly number[];
  /** Every tile in a fenced yard, as lot indexes (y × width + x), for the board's tint. */
  fencedTiles(state: RunState): readonly number[];
  /**
   * D-166: every tile of the front or the back yard as the house stands, as lot indexes, for the
   * board's shading while a card that reads one is picked.
   */
  yardTiles(state: RunState, yard: Yard): readonly number[];
  /**
   * D-199: the square a landmark reaches (its auras' `within`, the widest of them), its own tiles
   * included, as lot indexes in reading order, for the board's shading: around a placed piece
   * (`uid`), or around a card's tiles before it's placed (`defId` and `cells`: the ghost's). Empty
   * for a piece with no reach, so the board never works one out.
   */
  reachTiles(state: RunState, of: ReachOf): readonly number[];
  describePiece(state: RunState, uid: number): PieceInfo | null;
  describeTile(state: RunState, x: number, y: number): TileInfo | null;
  /**
   * D-153: how far the house is toward a set whose members needn't touch (Full House), for a
   * card's set chip and Inspect. Only the pieces placed count, never one being placed or
   * previewed. Null for a set whose members must touch.
   */
  setProgress(state: RunState, set: SetId): SetProgress | null;
  /**
   * D-192: whether a good could pay in the house as it stands, the check the shop's shelf leans
   * on (shelf.ts): a fixture some piece could take, Remodel Plans for a set the house holds (or
   * Full House one member short), a special piece under its limit, a blueprint the lot allows,
   * and every crate and upgrade.
   */
  canPay(state: RunState, good: ShelfGood): boolean;
  /** The shop's offers with prices and whether each can be bought. Empty outside the shop. */
  shopOffers(state: RunState): OfferView[];
  canRefresh(state: RunState): Availability & { price: number };
  /** What selling a blueprint or a supply pays now. */
  sellPrice(state: RunState, from: SellAction['from'], i: number): number;
  /** Card types a strike could take now (D-076, D-157): each row keeps its floor. */
  strikeOptions(state: RunState): readonly Card[];
  /** D-157: whether Strike can be used at all now (the plank's button, S), and why not. */
  canStrikeAny(state: RunState): Availability;
  /** D-157: whether hand card i can be struck now, and why not. */
  canStrikeCard(state: RunState, i: number): Availability;
  /**
   * D-157: what striking hand card i would do, for the hand's strike mode: whether it can,
   * the type, the hand cards that would leave (it, and any other of its type), and the words.
   */
  previewStrike(state: RunState, i: number): StrikePreview;
  /**
   * D-186: whether hand card i can be pinned for next week now, or its pin taken off, and why
   * not: the card last week's pin kept can't be pinned again, and D-207, no card can be in the
   * run's last week.
   */
  canPin(state: RunState, i: number): Availability;
  /**
   * D-207: whether this is the run's last week, which no week follows: the last phase's last
   * week, or an overtime week of it, with no overtime left. Its tally ends the run, won or lost.
   */
  lastWeekOfRun(state: RunState): boolean;
  /**
   * D-196: whether shop offer i can be held for the next visit now, or let go, and why not: not
   * a service, a sold good, one the run couldn't own by then, or in a shop no shop follows.
   */
  canHold(state: RunState, i: number): Availability;
  /** Whether a tool can be used now, with this target. */
  canUseTool(state: RunState, action: UseToolAction): Availability;
  /**
   * What a tool would do to this week's total (a move, Rush Order, Fertilizer): the house's
   * tally before and after. Illegal uses come back with their reason.
   */
  previewTool(state: RunState, action: UseToolAction): ToolPreview;
  /**
   * M4b, D-144: the change orders waiting on the 'changeOrder' screen for one to be picked, or
   * null. A phase effect says what it would change a week's total by as the house stands.
   */
  changeOrderOffer(state: RunState): ChangeOrderOfferView | null;
  /**
   * M4b: the change orders running now, in the order picked: requests (with their progress),
   * restrictions (broken or not), and phase effects.
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
  extended: Extract<GameEvent, { t: 'extended' }> | null;
}

/** D-186: the card a pin carries into the next week's hand, and its place in its row. */
interface Keep {
  card: Card;
  /** Its slot in its row: the slot it comes back to. */
  k: number;
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
  /** D-168: the room that grows, and its outline once it has (its box's corner and rows). */
  extend?: { uid: number; card: PieceId; x: number; y: number; shape: string[] };
};

const NO_PLAY: Legality = { legal: false, cells: [], clearedTrees: [] };
const NO_SCORE: WeekScore = { points: 0, mult: 100, total: 0 };

/** D-144: how many change orders an offer shows, to pick one from. */
const ORDERS_OFFERED = 2;
const ORDER_WAITING = 'A change order is waiting: pick one.';
const ORDER_PICK_REASON = 'Pick one of the change orders on offer.';

/** What a run's modifiers add up to, computed once per state. */
interface RunMods {
  active: readonly ActiveMod[];
  layout: readonly LayoutModifier[];
}

/** D-168: how many tiles of wall two sets of cells share (pairs of tiles side by side). */
function sharedWall(a: readonly Cell[], b: readonly Cell[]): number {
  const inB = new Set(b.map((c) => `${c.x},${c.y}`));
  let n = 0;
  for (const c of a) {
    for (const [dx, dy] of ORTHOGONAL) if (inB.has(`${c.x + dx},${c.y + dy}`)) n++;
  }
  return n;
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
  /** The run's target factor: its client's, and a first job's on top of it (D-151). */
  const pctOf = (state: RunState) => targetPctFor(content, state.setup);
  /** This phase's target for the run's client (the curve × its targetPct). */
  const targetOf = (state: RunState) => phaseTarget(b, state.phase, pctOf(state));

  const limitsCache = new WeakMap<RunState, TypeLimit[]>();
  /**
   * The checklist's ceilings as they stand, then the cards' per-house caps (D-165): a type at
   * its limit can renovate, and draws less.
   */
  function limitsOf(state: RunState): TypeLimit[] {
    let l = limitsCache.get(state);
    if (!l) {
      const layout = layoutFor(state);
      l = [
        ...typeLimits(content, layout, clientOf(state).specs, { phase: state.phase }),
        ...perHouseLimits(content, layout),
      ];
      limitsCache.set(state, l);
    }
    return l;
  }

  /** D-192: what a shop's shelf leans toward, read through the run's own layout and limits. */
  const shelfOf = (state: RunState): Shelf =>
    shelfFor(content, state, { layout: () => layoutFor(state), limits: () => limitsOf(state) });

  /** D-165: the per-house cap a card's type has reached (one Kitchen), if any. */
  function capReached(state: RunState, def: PieceDef): TypeLimit | null {
    const cap = perHouseOf(content, def);
    if (cap === undefined) return null;
    const root = rootType(def);
    return (
      limitsOf(state).find((l) => l.max === cap && l.count >= l.max && l.types.includes(root)) ??
      null
    );
  }

  /** A phase's last week or an overtime week, actually played: Last-Minute Push's ×2. */
  const isLastWeek = (state: RunState) => state.overtimeWeek > 0 || state.slot >= W;

  /** Why the build screen's plays and queries aren't available on this screen. */
  function offScreen(state: RunState): string {
    if (state.screen === 'shop') return 'The shop is open.';
    if (state.screen === 'changeOrder') return ORDER_WAITING;
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

  /**
   * The piece a placement would build (or a Renovation or an extension spend): a hand card or a
   * reserve piece.
   */
  function placeDef(
    state: RunState,
    play: PlaceAction | RenovateAction | ExtendAction,
  ): PieceDef | null {
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

  function checkPlay(state: RunState, play: NonNullable<Play>): PlayCheck {
    if (state.screen !== 'build') return { ...NO_PLAY, reason: offScreen(state) };
    if (play.t === 'renovate') return checkRenovate(state, play);
    if (play.t === 'extend') return checkExtend(state, play);
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
    // D-171: an Addition is never a room of its own.
    if (def.addition) {
      const rooms = selectorText(content, { piece: [...b.extend.types] }, 'one');
      return { ...NO_PLAY, reason: `An Addition grows a room: lay it beside ${article(rooms)}.` };
    }
    // D-165: a house holds one Kitchen; another Kitchen card extends it where it can grow
    // (D-168), and renovates it otherwise (D-169).
    if (capReached(state, def)) {
      const room = content.pieces[rootType(def)].name;
      return {
        ...NO_PLAY,
        reason:
          perHouseOf(content, def) === 1
            ? `The house has its ${room}: this card extends or renovates it.`
            : `The house has its ${plural(room)}: this card extends or renovates one.`,
      };
    }
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
    return checkSpot(state, def, play);
  }

  /**
   * Where a placement can go, once its card, spot, and shape are known to be well formed:
   * checkPlay's last step, and all eachLegalSpot needs, since placementShapes lists only
   * shapes that pass. Skipping the pack shape check there keeps a Fence's scan cheap (D-161).
   */
  function checkSpot(state: RunState, def: PieceDef, play: PlaceAction): PlacementCheck {
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
   * top level. The limit comes from the client's checklist (one Kitchen, …). D-168: only on a
   * room the card can't extend.
   */
  function checkRenovate(state: RunState, play: RenovateAction): PlayCheck {
    const def = placeDef(state, play);
    if (!def) return { ...NO_PLAY, reason: 'There is no card there.' };
    const card = capitalize(article(def.name));
    // M4b: a member's room is placed, never spent on another room (a Bedroom card can renovate it).
    if (def.member) {
      return { ...NO_PLAY, reason: `${card} card can’t renovate: it’s a household member’s room.` };
    }
    // A room card on a room (house-systems-review.md §4), whose type the checklist or its own
    // card caps (D-165).
    const root = rootType(def);
    const capped = isRoom(def) && limitsOf(state).some((l) => l.types.includes(root));
    if (!capped) {
      return { ...NO_PLAY, reason: `${card} card can’t renovate: a house takes any number.` };
    }
    const limit = limitReached(limitsOf(state), root);
    if (!limit) {
      const many = selectorText(content, { piece: root }, 'some');
      return {
        ...NO_PLAY,
        reason: `${card} card can renovate once the house has all the ${many} it takes.`,
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
    // D-168: a room that can grow grows; Renovate is for one boxed in or grown as far as it goes.
    if (extendSpots(state, play.from, play.i, target.uid).length > 0) {
      return {
        ...NO_PLAY,
        reason: `${capitalize(definite(targetDef.name, 'that'))} can still grow.`,
      };
    }
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

  /** D-168: the room types a card can extend, by root type. */
  const extendable: ReadonlySet<PieceId> = new Set(b.extend.types);

  /**
   * D-168: a room card that could extend a room: an extendable type, and not a member's card.
   * D-171: or the Addition, which extends a room of any extendable type.
   */
  function extendsAny(def: PieceDef | null): def is PieceDef {
    if (!def) return false;
    return !!def.addition || (!def.member && isRoom(def) && extendable.has(rootType(def)));
  }

  /** D-168, D-171: whether this card extends a room of that type. */
  function extendsType(card: PieceDef, room: PieceDef): boolean {
    return card.addition
      ? isRoom(room) && extendable.has(rootType(room))
      : isType(room, rootType(card));
  }

  /**
   * D-168, Extend a room: a room card of an extendable type, laid on open ground beside a room of
   * its type with room for another card, sharing at least `minShared` tiles of wall with it.
   * Placement's own rules hold for the card's tiles (on the lot, nothing built there, no water,
   * boulder or Old Shed; Trees under it go, and finds pay). Its tiles join the room.
   */
  function checkExtend(state: RunState, play: ExtendAction): PlayCheck {
    const def = placeDef(state, play);
    if (!def) return { ...NO_PLAY, reason: 'There is no card there.' };
    const card = capitalize(article(def.name));
    // A member's room is placed, never spent on another room (D-103).
    if (def.member) {
      return {
        ...NO_PLAY,
        reason: `${card} card can’t extend a room: it’s a household member’s room.`,
      };
    }
    if (!extendsAny(def)) return { ...NO_PLAY, reason: `${card} card can’t extend a room.` };
    const root = rootType(def);
    const layout = layoutFor(state);
    const target = Number.isInteger(play.uid) ? layout.byUid.get(play.uid) : undefined;
    if (!target) return { ...NO_PLAY, reason: 'Pick a room to extend.' };
    const targetDef = content.pieces[target.defId];
    if (!extendsType(def, targetDef)) {
      const rooms = selectorText(
        content,
        { piece: def.addition ? [...b.extend.types] : root },
        'one',
      );
      return {
        ...NO_PLAY,
        reason: `${card} ${def.addition ? '' : 'card '}extends ${article(rooms)}.`,
      };
    }
    if ((target.extended ?? 0) >= b.extend.maxPerRoom) {
      // "That Kitchen", but "Grandma’s Room": a possessive name takes no determiner.
      const room = capitalize(definite(targetDef.name, 'that'));
      return { ...NO_PLAY, reason: `${room} is as big as it gets.` };
    }
    if (
      ![0, 1, 2, 3].includes(play.rot) ||
      !Number.isInteger(play.x) ||
      !Number.isInteger(play.y)
    ) {
      return { ...NO_PLAY, reason: 'That is not a spot on the lot.' };
    }
    const roomCells = layout.cells.get(target.uid)!;
    const cells = placedCells(def.shape, play.x, play.y, play.rot);
    const { width } = state.house.lot;
    const own = new Set(roomCells.map((c) => cellIndex(width, c.x, c.y)));
    if (cells.some((c) => own.has(cellIndex(width, c.x, c.y)))) {
      // Laid on the room itself (the board's way of asking about a room that can't grow).
      const room = definite(targetDef.name);
      return {
        ...NO_PLAY,
        reason:
          extendSpots(state, play.from, play.i, target.uid).length === 0
            ? `There’s no open ground beside ${room} to grow into.`
            : `Lay the card beside ${room}, not on it.`,
      };
    }
    const spot = checkPlacement(
      content,
      layout,
      def,
      play.x,
      play.y,
      play.rot,
      state.week,
      (house) => layoutFor(state, house),
    );
    if (!spot.legal) return { ...NO_PLAY, reason: spot.reason, cells: spot.cells };
    if (sharedWall(spot.cells, roomCells) < b.extend.minShared) {
      return {
        ...NO_PLAY,
        reason: `It must share ${b.extend.minShared} tiles of wall with ${definite(targetDef.name)}.`,
        cells: spot.cells,
      };
    }
    const grown = cellsToShape([...roomCells, ...spot.cells]);
    return {
      legal: true,
      cells: spot.cells,
      clearedTrees: spot.clearedTrees,
      ...(spot.finds ? { finds: spot.finds } : {}),
      extend: { uid: target.uid, card: def.id, x: grown.x, y: grown.y, shape: grown.shape },
    };
  }

  /** A play's change to the house (checked here), with its event. */
  function applyPlay(
    state: RunState,
    play: NonNullable<Play>,
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
        extended: null,
      };
    }
    if (play.t === 'extend') {
      // D-168: the room takes the card's tiles. It keeps its uid, fixture, timers, level and
      // place in the placement order; its own shape is the whole outline, unturned.
      const { uid, card, x, y, shape } = check.extend!;
      const piece = state.house.pieces.find((p) => p.uid === uid)!;
      const grown: PlacedPiece = {
        ...piece,
        x,
        y,
        rot: 0,
        shape,
        extended: (piece.extended ?? 0) + 1,
      };
      return {
        house: {
          ...state.house,
          lot: clearTiles(state.house.lot, [...check.clearedTrees, ...(check.finds ?? [])]),
          pieces: state.house.pieces.map((p) => (p.uid === uid ? grown : p)),
        },
        placed: null,
        installed: null,
        renovated: null,
        extended: {
          t: 'extended',
          uid,
          defId: piece.defId,
          card,
          cells: check.cells,
          clearedTrees: check.clearedTrees,
        },
      };
    }
    if (play.t === 'install') {
      const { uid, fixture, replaces } = check.install!;
      return {
        house: withFixture(state.house, uid, fixture, state.week),
        placed: null,
        renovated: null,
        extended: null,
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
      extended: null,
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
        extended: null,
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
   * Start of week, step 1: pieces old enough transform. Each of a Sapling's tiles becomes a Tree
   * (a pack since D-195: one to three); it never holds a fixture (checkInstall, D-095), so none
   * is lost with it.
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
      // D-166: a standard run deals the lot's cards at full weight from week 1.
      lotCardsFull: b.lotCardsFullIn.includes(state.setup.mode),
    };
  }

  /**
   * One row of the hand (D-121): `roomsRow` or `layoutRow` cards on that row's stream. A
   * reroll's leaves out the `held` cards while enough others remain (D-132).
   */
  function drawRowFor(
    state: RunState,
    n: number,
    row: DrawRow,
    special = false,
    held: readonly Card[] = [],
  ): Card[] {
    return drawHand(
      content,
      state.setup.seed,
      state.phase,
      slotKey(state.slot, state.overtimeWeek),
      n,
      rule(state, row === 'rooms' ? 'roomsRow' : 'layoutRow'),
      { ...drawOpts(state, row, special), held },
    );
  }

  /** A whole hand: the Rooms row, then the Layout row. */
  function drawFor(
    state: RunState,
    n: number,
    special = false,
    held: readonly Card[] = [],
  ): Card[] {
    return DRAW_ROWS.flatMap((row) => drawRowFor(state, n, row, special, held));
  }

  /** A card has a play: a spot, a host, a Renovation (D-102), or an extension (D-168). */
  function cardHasPlay(state: RunState, i: number): boolean {
    return (
      cardFits(state, i) ||
      renovateTargets(state, 'hand', i).length > 0 ||
      extendTargets(state, 'hand', i).length > 0
    );
  }

  /**
   * Swaps (D-121): each card of `row` (both rows when unset) with no play is replaced by the
   * first of up to `swapTries` cards from its row that has one, or by the last tried. The
   * draw's `n` keys the swaps' streams, one per card. The draw's one `handDrawn` event carries
   * the hand after its swaps, and what each swapped card replaced. A reroll's swaps leave out
   * the `held` cards it replaced while enough others remain (D-132). The card a pin kept is
   * never swapped (D-186).
   */
  function swapDead(
    state: RunState,
    n: number,
    held: readonly Card[] = [],
  ): { state: RunState; swapped: SwappedCard[] } {
    const slot = slotKey(state.slot, state.overtimeWeek);
    let s = state;
    const swapped: SwappedCard[] = [];
    for (const r of DRAW_ROWS) {
      const at = s.hand.flatMap((c, i) => (rowOf(content, c) === r ? [i] : []));
      at.forEach((i, k) => {
        // The card a pin kept stays, with a play or without one (D-186).
        if (i === s.kept || cardHasPlay(s, i)) return;
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
          { ...drawOpts(s, r), held },
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

  /** D-211: whether a reward pays anything at all (an empty one pays nothing). */
  const pays = (reward: Reward): boolean =>
    !!(
      reward.score ||
      reward.budget ||
      reward.rerolls ||
      reward.demolitions ||
      reward.overtime ||
      reward.tool
    );

  /**
   * D-211 (backlog S07, stage 2): the rooms finished in `after` that weren't in `before` (a
   * fixture, and grown by Extend or Renovate: `isFinished`), in placement order. A play touches
   * one room, so it finishes one at most. A new room is never finished, and finished never goes
   * back (finished.ts), so a room is finished once in its life: only a demolished room's
   * successor, a new room with a new uid, can be finished again.
   */
  function finishedBy(before: HouseState, after: HouseState): PlacedPiece[] {
    const was = new Set(before.pieces.filter((p) => isFinished(p)).map((p) => p.uid));
    return after.pieces.filter((p) => isFinished(p) && !was.has(p.uid));
  }

  /**
   * D-211: each room a play finished pays `balance.finishReward` through payReward, once, on
   * its own key (`finish/<uid>`), with a `roomFinished` event after the play's own. All three
   * ways a play goes down call this: the free install from the supplies, a play that doesn't
   * end the week, and the week's play (before its tally, as a find pays). `after` is the house
   * the play left; `state` may still hold the one before it.
   */
  function payFinished(
    state: RunState,
    before: HouseState,
    after: HouseState,
    events: GameEvent[],
  ): RunState {
    const reward = b.finishReward;
    if (!pays(reward)) return state;
    let s = state;
    for (const room of finishedBy(before, after)) {
      events.push({ t: 'roomFinished', uid: room.uid, defId: room.defId, reward });
      s = payReward(s, reward, `finish/${room.uid}`, events);
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
    // D-186: the card a pin kept stays where it is through the Catalog's redraw.
    drawSpecial: (state) => {
      const hand = drawFor(state, state.draws, true);
      const keep = keptNow(state);
      return keep ? withKept(hand, keep) : { hand };
    },
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

  /**
   * Start of week, step 2: in the first week of an arrival's phase, its member moves in; then
   * what the client brings for that phase, the standing stock's top-up (D-160), the crew's own
   * card and the wrong delivery's piece (D-171, D-188), a company upgrade's special piece
   * (D-209), the crew's tool, and a company upgrade's tool.
   */
  function arrive(state: RunState, events: GameEvent[]): RunState {
    if (state.overtimeWeek !== 0) return state;
    let s = state;
    if (s.slot === 1) {
      for (const a of clientOf(state).household.arrivals) {
        if (a.phase === s.phase && !s.arrived.includes(a.id)) s = land(s, a, events);
      }
      s = deliver(s, events);
    }
    s = surprise(crewStock(restock(s, events), events), events);
    return upgradeTools(crewTool(upgradePieces(s, events), events), events);
  }

  /**
   * Cards into the reserve's extra slots, marked by where they came from (D-160, D-171, D-188),
   * and (D-209) a company upgrade's by the upgrade.
   */
  function addExtra(
    s: RunState,
    from: 'client' | 'stock' | 'crew' | 'surprise' | 'upgrade',
    cards: readonly PieceId[],
    events: GameEvent[],
    upgrade?: UpgradeId,
  ): RunState {
    if (cards.length === 0) return s;
    events.push({
      t: 'delivered',
      from,
      phase: s.phase,
      cards: [...cards],
      ...(upgrade ? { upgrade } : {}),
    });
    const mark: Omit<ReservePiece, 'id'> =
      from === 'client'
        ? { client: true }
        : from === 'crew'
          ? { crew: true }
          : from === 'surprise'
            ? { surprise: true }
            : from === 'upgrade'
              ? { upgrade: upgrade! }
              : { stock: true };
    return { ...s, reserve: [...s.reserve, ...cards.map((id): ReservePiece => ({ id, ...mark }))] };
  }

  /**
   * D-160: what the client brings in the first week of this phase. Not a member: nothing joins
   * `arrived`, and Room for everyone is as it was. A week starts once, so no list is kept.
   */
  function deliver(s: RunState, events: GameEvent[]): RunState {
    const due = (clientOf(s).deliveries ?? []).filter((d) => d.phase === s.phase);
    return addExtra(
      s,
      'client',
      due.flatMap((d) => d.cards),
      events,
    );
  }

  /**
   * D-160: whether the standing stock comes this week: the first week of `fromPhase` (D-162:
   * week 1; a first job's is week `firstJobSlot` of `firstJobPhase`), then each later
   * milestone's first with `refill`. Without it (D-163) the stock comes once: a first job that
   * completed that milestone before its week gets it at the next milestone's first.
   */
  function stockDue(s: RunState): boolean {
    const stock = b.standingStock;
    if (s.overtimeWeek !== 0) return false;
    if (s.stocked && !stock.refill) return false;
    const [phase, slot] =
      s.setup.mode === 'firstJob'
        ? [stock.firstJobPhase, stock.firstJobSlot]
        : [stock.fromPhase, 1];
    if (s.phase < phase) return false;
    return s.slot === (s.phase === phase ? slot : 1);
  }

  /**
   * D-160: the standing stock fills the reserve's extra slots up to one of each of its pieces. A
   * piece of that type already waiting in an extra slot (the Landscaper's Fence, an arrival's or
   * the client's card) counts, so it only adds what's missing. A strike never touches the
   * reserve.
   */
  /**
   * `pool` in an order drawn once a run from the stream `key`: D-171's crew stock
   * (`crew/stock`), every card before any comes again, D-188's wrong delivery
   * (`delivery/surprise`), and D-209's company upgrades' deliveries (`upgrade/<id>`).
   */
  function runOrder<T>(seed: string, key: string, pool: readonly T[]): T[] {
    const rng = stream(seed, key);
    const left = [...pool];
    const order: T[] = [];
    while (left.length > 0) order.push(...left.splice(rng.int(left.length), 1));
    return order;
  }

  /**
   * D-171: the week the crew's own card and the standing stock's first cards come is the same;
   * after it the crew's comes at each milestone's first week, whether or not the standing stock
   * refills.
   */
  function crewStockDue(s: RunState): boolean {
    const stock = b.standingStock;
    if (s.overtimeWeek !== 0) return false;
    const [phase, slot] =
      s.setup.mode === 'firstJob'
        ? [stock.firstJobPhase, stock.firstJobSlot]
        : [stock.fromPhase, 1];
    if (s.phase < phase) return false;
    return s.slot === (s.phase === phase ? slot : 1);
  }

  /**
   * D-171: the crew's own card (CrewDef.stock): one into the reserve's extra slots when it's
   * due, the milestone's in the run's order, unless one of the crew's still waits there.
   */
  function crewStock(s: RunState, events: GameEvent[]): RunState {
    const pool = content.crews[s.setup.crewId].stock;
    if (!pool || pool.length === 0 || !crewStockDue(s)) return s;
    if (s.reserve.some((r) => r.crew)) return s;
    const order = runOrder(s.setup.seed, 'crew/stock', pool);
    return addExtra(s, 'crew', [order[s.phase % order.length]!], events);
  }

  /**
   * D-188: the wrong delivery. Once a run, in the first week of `surpriseDelivery.phase` (never
   * in a first job or an overtime week), a piece nobody ordered lands in the reserve's extra
   * slots: the first in the run's order (`delivery/surprise`, the seed alone) whose type isn't at
   * a limit for this client; if none fits, nothing comes. A struck type still comes, as the
   * standing stock does (D-157). The week starts once, so nothing marks it as done.
   */
  function surprise(s: RunState, events: GameEvent[]): RunState {
    const due = b.surpriseDelivery;
    if (due.pieces.length === 0 || s.setup.mode === 'firstJob') return s;
    if (s.overtimeWeek !== 0 || s.slot !== 1 || s.phase !== due.phase) return s;
    const full = typesAtLimit(limitsOf(s));
    const id = runOrder(s.setup.seed, 'delivery/surprise', due.pieces).find(
      (p) => !full.has(rootType(content.pieces[p])),
    );
    return id ? addExtra(s, 'surprise', [id], events) : s;
  }

  /**
   * D-171: the crew's tool (CrewDef.orderTool), in the first week of each milestone that
   * follows a change order. Into the supplies, or sold at once when they're full (payReward's
   * rule for a reward's tool).
   */
  function crewTool(s: RunState, events: GameEvent[]): RunState {
    const tool = content.crews[s.setup.crewId].orderTool;
    if (!tool || s.overtimeWeek !== 0 || s.slot !== 1) return s;
    if (!b.changeOrderAfter.includes(s.phase)) return s;
    if (s.supplies.length < slotsFor(content, s).supplies) {
      events.push({ t: 'crewTool', tool, phase: s.phase });
      return { ...s, supplies: [...s.supplies, { kind: 'tool', id: tool }] };
    }
    const sold = sellPrice(content, s, content.tools[tool].price);
    events.push({ t: 'crewTool', tool, phase: s.phase, sold });
    return { ...s, budget: s.budget + sold, budgetEarned: s.budgetEarned + sold };
  }

  // -------------------------------------------------------------------------------------
  // What the company upgrades bring (D-209, S26).

  /**
   * The upgrades the run owns that deliver `kind` each milestone, in the order they were
   * bought: due in the first week of each milestone (`arrive` skips overtime weeks). Bought in a
   * shop, one first delivers as the next milestone starts.
   */
  function upgradesDue(s: RunState, kind: 'specialPiece' | 'tool'): UpgradeId[] {
    if (s.overtimeWeek !== 0 || s.slot !== 1) return [];
    return s.upgrades.filter((id) => content.upgrades[id].delivers?.kind === kind);
  }

  /** The special pieces, in the content's order: the pool a `specialPiece` delivery draws on. */
  const specialPieces = (Object.keys(content.pieces) as PieceId[]).filter((id) => {
    const def = content.pieces[id];
    return !!def.special && !def.member && !def.addition;
  });

  /**
   * The special piece an upgrade brings this milestone: the first in its run's order
   * (`upgrade/<id>`) that the house doesn't have yet, built or waiting in Your goods, and whose
   * type isn't at a limit for the client (the checklist's ceilings and the per-house caps, as
   * the wrong delivery reads them). With every one there, the first a house can hold two of
   * (a second Pool, never a second Library: D-165's one of each special room), and only failing
   * that the first whose type isn't at a limit. So it brings a different one each milestone, and
   * a second Pool only once all six are in.
   */
  function upgradePiece(s: RunState, id: UpgradeId): PieceId | null {
    const full = typesAtLimit(limitsOf(s));
    const root = (p: PieceId) => rootType(content.pieces[p]);
    const open = runOrder(s.setup.seed, `upgrade/${id}`, specialPieces).filter(
      (p) => !full.has(root(p)),
    );
    const have = new Set([
      ...s.house.pieces.map((p) => root(p.defId)),
      ...s.reserve.map((r) => root(r.id)),
    ]);
    const holdsTwo = (p: PieceId) => (perHouseOf(content, content.pieces[p]) ?? Infinity) > 1;
    return open.find((p) => !have.has(root(p))) ?? open.find(holdsTwo) ?? open[0] ?? null;
  }

  /**
   * D-209: each upgrade that delivers a special piece (the Storage Unit) adds the milestone's to
   * the reserve's extra slots, marked with the upgrade, after the wrong delivery's piece.
   */
  function upgradePieces(state: RunState, events: GameEvent[]): RunState {
    let s = state;
    for (const id of upgradesDue(s, 'specialPiece')) {
      const piece = upgradePiece(s, id);
      if (piece) s = addExtra(s, 'upgrade', [piece], events, id);
    }
    return s;
  }

  /**
   * The tool an upgrade brings this milestone: the milestone's in its run's order
   * (`upgrade/<id>`, the offered tools of its rarity), as the crew's own card is (D-171), or the
   * next after it that isn't in the supplies already and can pay in the house as it stands
   * (D-192: Remodel Plans for a set the house is near). If none is, the milestone's own.
   */
  function upgradeTool(s: RunState, id: UpgradeId, d: Extract<UpgradeDelivery, { kind: 'tool' }>) {
    const pool = (Object.keys(content.tools) as ToolId[]).filter(
      (t) => content.tools[t].offered && content.tools[t].rarity === d.rarity,
    );
    if (pool.length === 0) return null;
    const order = runOrder(s.setup.seed, `upgrade/${id}`, pool);
    const shelf = shelfOf(s);
    const held = new Set(s.supplies.flatMap((x) => (x.kind === 'tool' ? [x.id] : [])));
    for (let k = 0; k < order.length; k++) {
      const tool = order[(s.phase + k) % order.length]!;
      if (!held.has(tool) && shelf.canPay({ kind: 'tool', id: tool })) return tool;
    }
    return order[s.phase % order.length]!;
  }

  /**
   * D-209: each upgrade that delivers a tool (the Tool Belt) puts the milestone's in the
   * supplies, after the crew's, or sells it at once when they're full (crewTool's rule).
   */
  function upgradeTools(state: RunState, events: GameEvent[]): RunState {
    let s = state;
    for (const id of upgradesDue(s, 'tool')) {
      const d = content.upgrades[id].delivers;
      const tool = d?.kind === 'tool' ? upgradeTool(s, id, d) : null;
      if (!tool) continue;
      if (s.supplies.length < slotsFor(content, s).supplies) {
        events.push({ t: 'upgradeTool', upgrade: id, tool, phase: s.phase });
        s = { ...s, supplies: [...s.supplies, { kind: 'tool', id: tool }] };
        continue;
      }
      const sold = sellPrice(content, s, content.tools[tool].price);
      events.push({ t: 'upgradeTool', upgrade: id, tool, phase: s.phase, sold });
      s = { ...s, budget: s.budget + sold, budgetEarned: s.budgetEarned + sold };
    }
    return s;
  }

  /**
   * D-209: an upgrade with a pick (the Drafting Table) opens it as it's bought, as shop 1's
   * Housewarming gift does: its options on their own stream (`crate/<shop>/<refresh>/<id>`), for
   * the slot it adds. With nothing left to offer, no pick opens.
   */
  function openUpgradePick(s: RunState, id: UpgradeId, events: GameEvent[]): RunState {
    const d = content.upgrades[id].delivers;
    const v = s.offers?.shop;
    if (d?.kind !== 'blueprintPick' || !v) return s;
    const key = `crate/${v.number}/${v.refreshes}/${id}`;
    const options = crateOptions(content, s, id, key, d.options, shelfOf(s));
    if (options.length === 0) return s;
    events.push({ t: 'crateOpened', source: id, options });
    return { ...s, offers: { ...s.offers, pick: { source: id, options } } };
  }

  function restock(s: RunState, events: GameEvent[]): RunState {
    if (!stockDue(s)) return s;
    const waiting = s.reserve.filter(inExtraSlot).map((r) => r.id);
    const missing: PieceId[] = [];
    for (const id of b.standingStock.pieces) {
      const k = waiting.indexOf(id);
      if (k >= 0) waiting.splice(k, 1);
      else missing.push(id);
    }
    return { ...addExtra(s, 'stock', missing, events), stocked: true };
  }

  // -------------------------------------------------------------------------------------
  // Change orders (M4b).

  const orderDef = (id: ChangeOrderId): ChangeOrderDef => content.changeOrders[id];

  /** What a request is checked with: the phase, and what's new since it was picked. */
  const orderCtx = (state: RunState, r: { sinceUid: number; demolished: number }): CondCtx => ({
    phase: state.phase,
    order: { sinceUid: r.sinceUid, demolished: r.demolished },
  });

  /** The change orders still running. */
  const running = (state: RunState) => state.changeOrders.filter((r) => r.result === undefined);

  /**
   * Why a change order isn't offered now (Appendix A · M4b), or null: a request whose
   * condition the house already meets, or that clearly can't be met (more new pieces than a
   * phase has weeks, more demolitions than are left, a piece type it needs that's neither in
   * the draw for this phase nor in the reserve, or, D-165, one whose per-house cap the house
   * has reached). Restrictions and phase effects are always offered.
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
    const capped = (id: PieceId) => {
      const def = content.pieces[id];
      return !!def && capReached(state, def) !== null;
    };
    for (const types of neededTypes(cond)) {
      if (!types.some(available)) return 'A piece it needs isn’t in the draw or the reserve.';
      if (types.every(capped)) return 'The house can’t take another of a piece it needs.';
    }
    return null;
  }

  /**
   * The client's own change orders and the generic ones, listed in that order (the draw among
   * them is even, not own first): never one picked before or on offer now, minus the skipped,
   * and before the last phase only phase effects. One offered and passed over is back in
   * (D-144).
   */
  function eligibleOrders(state: RunState): ChangeOrderId[] {
    const offered = new Set(state.changeOrders.map((r) => r.id));
    for (const id of state.offers?.changeOrder?.ids ?? []) offered.add(id);
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

  /**
   * The orders a milestone's offer shows (D-144): two of the eligible ones, drawn evenly and
   * in the order shown from `co/<milestone>`; one when only one is eligible; none with none.
   */
  function drawOrders(state: RunState, milestone: number): ChangeOrderId[] {
    const pool = eligibleOrders(state);
    const rng = stream(state.setup.seed, `co/${milestone}`);
    const ids: ChangeOrderId[] = [];
    while (ids.length < ORDERS_OFFERED && pool.length > 0) {
      ids.push(...pool.splice(rng.int(pool.length), 1));
    }
    return ids;
  }

  /** The 'changeOrder' screen, with these on offer: the pick runs through the state's phase. */
  function offerOrders(
    s: RunState,
    ids: readonly ChangeOrderId[],
    forced: boolean,
    events: GameEvent[],
  ): RunState {
    const flag = forced ? { forced: true as const } : {};
    const offer: ChangeOrderOffer = { ids, phase: s.phase, ...flag };
    events.push({
      t: 'changeOrderOffered',
      options: ids.map((id) => ({ id, kind: orderDef(id).kind })),
      phase: s.phase,
      ...flag,
    });
    return { ...s, screen: 'changeOrder', offers: { ...s.offers, changeOrder: offer } };
  }

  /**
   * The answer (D-144): one of the offer's orders is picked, and the rest go back in the pool.
   * A request or a restriction then runs to its phase's milestone, and a phase effect runs as a
   * timed effect until then. Then the shop opens, or a forced offer goes back to its week.
   */
  function answerOrder(state: RunState, i: unknown, events: GameEvent[]): RunState {
    const offer = state.screen === 'changeOrder' ? state.offers?.changeOrder : undefined;
    if (!offer) throw new IllegalAction('There’s no change order to answer.');
    const id = typeof i === 'number' && Number.isInteger(i) ? offer.ids[i] : undefined;
    if (id === undefined) throw new IllegalAction(ORDER_PICK_REASON);
    const def = orderDef(id);
    const passedOver = offer.ids.filter((_, k) => k !== i);
    const record: ChangeOrderRecord = {
      id: def.id,
      phase: offer.phase,
      week: state.week,
      sinceUid: state.house.nextUid,
      demolished: 0,
      passedOver,
    };
    events.push({
      t: 'changeOrderAnswered',
      id: def.id,
      kind: def.kind,
      i: i as number,
      passedOver,
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
   * requests and restrictions resolve. A request met or a restriction kept pays.
   */
  function resolveOrders(s: RunState, events: GameEvent[]): RunState {
    const ends = (r: ChangeOrderRecord) => r.result === undefined && r.phase <= s.phase;
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
        ids.includes(r.id) && r.result === undefined && r.brokenBy === undefined
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

  /**
   * D-144: what a phase effect on offer would change a week's total by, with the house as it
   * stands in the week the effect starts: after a milestone, the next phase's first week, its
   * transforms resolved as leaving the shop starts it (as a fixture in the shop is valued,
   * D-107); for a ?debug offer, the week it interrupted. Null for a request or a restriction,
   * which change no earnings.
   */
  function orderHouseGain(state: RunState, id: ChangeOrderId): number | null {
    const def = orderDef(id);
    const offer = state.screen === 'changeOrder' ? state.offers?.changeOrder : undefined;
    if (def.kind !== 'phase' || !offer) return null;
    const { offers: _offers, ...rest } = state;
    const build: RunState = { ...rest, screen: 'build' };
    const week = weekStarted(state) ? build : resolveTransforms(build, []);
    const during: RunState = {
      ...week,
      timedEffects: [
        ...week.timedEffects,
        { source: def.id, until: { phase: offer.phase }, modifiers: def.modifiers },
      ],
    };
    return tallyOf(during, during.house, false).total - tallyOf(week, week.house, false).total;
  }

  const offerViews = new WeakMap<RunState, ChangeOrderOfferView>();
  /** The offer on the 'changeOrder' screen as the UI shows it, computed once per state. */
  function offerView(state: RunState): ChangeOrderOfferView | null {
    const offer = state.screen === 'changeOrder' ? state.offers?.changeOrder : undefined;
    if (!offer) return null;
    let view = offerViews.get(state);
    if (!view) {
      view = {
        options: offer.ids.map((id) => {
          const order = orderView(state, id, offer.phase);
          const houseGain = orderHouseGain(state, id);
          return houseGain === null ? order : { ...order, houseGain };
        }),
        phase: offer.phase,
        forced: !!offer.forced,
      };
      offerViews.set(state, view);
    }
    return view;
  }

  /** `keep`: the card last week's pin carries in (D-186). */
  function startWeek(state: RunState, events: GameEvent[], keep?: Keep): RunState {
    // Step 1: transforms; step 2 (M4b): arrivals, in their phase's first week; step 3: the draw.
    let s = unpinned(arrive(resolveTransforms(state, events), events));
    s = { ...s, draws: 1, hand: drawFor(s, 0), swapped: [], freePlay: 'none' };
    // D-186: the kept card takes a slot of its row, on the draw's own keys: nothing shifts.
    if (keep) {
      const put = withKept(s.hand, keep);
      s = { ...s, hand: put.hand, kept: put.kept };
    }
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
      ...(s.kept === undefined ? {} : { kept: s.kept }),
    });
    return after.state;
  }

  /** A phase starts (after the shop): say if its target is already met, then its first week. */
  function startPhase(state: RunState, events: GameEvent[]): RunState {
    // D-207: the card a pin carried past the milestone comes into this first week, unless its
    // type was struck since (an old run code's typed strike, D-076), as a strike takes a pin.
    const { pinnedOver, ...rest } = state;
    const keep =
      pinnedOver && !isStruck(content, rest.struck, pinnedOver.card) ? pinnedOver : undefined;
    // Again here, so a Foreman bought in the shop counts from this phase.
    const s = { ...rest, rerollsLeft: rule(state, 'rerollsPerPhase') };
    const target = targetOf(s);
    if (s.score >= target) {
      events.push({ t: 'targetReached', phase: s.phase, target, score: s.score });
    }
    return startWeek(s, events, keep);
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
      // The hand goes, and a pin with it: what it keeps travels as afterTally's `keep` (D-186).
      ...unpinned(state),
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
  /**
   * `keep`: the card a pin carries into the next week you play (D-186): the phase's next week,
   * an overtime week, or past a milestone and its shop (Complete early's too), the next phase's
   * first week (D-207). The end of the run drops it.
   */
  function afterTally(s: RunState, events: GameEvent[], keep?: Keep): RunState {
    const target = targetOf(s);
    if (s.overtimeWeek === 0 && s.slot < W && s.autoComplete && s.score >= target) {
      return completeEarly(s, W - s.slot, false, events, keep);
    }
    if (s.overtimeWeek > 0 || s.slot >= W) return endOfPhase(s, events, keep);
    return startWeek({ ...s, slot: s.slot + 1, week: s.week + 1 }, events, keep);
  }

  function endOfPhase(s: RunState, events: GameEvent[], keep?: Keep): RunState {
    const target = targetOf(s);
    const forced = s.forcedMiss === s.phase && s.overtimeWeek === 0;
    if (s.score >= target && !forced) {
      const result = s.overtimeWeek > 0 ? 'overtime' : 'onTime';
      return resolveMilestone(s, result, 0, null, events, keep);
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
      // D-186: a pin carries into an overtime week: no shop comes between.
      return startWeek(next, events, keep);
    }
    return resolveMilestone(s, 'failed', 0, null, events);
  }

  /** `keep`: the card a pin carries past the milestone, if the run goes on (D-207). */
  function resolveMilestone(
    s: RunState,
    result: MilestoneResult,
    weeksSaved: number,
    bonus: { score: number; budget: number } | null,
    events: GameEvent[],
    keep?: Keep,
  ): RunState {
    const target = targetOf(s);
    // Savings Account (M3b): +1 per 5 budget held, up to `interestMax`, before the reward.
    const interest =
      result === 'failed'
        ? 0
        : Math.min(Math.floor(s.budget / b.shop.interestPer), rule(s, 'interestMax'));
    const last = s.phase === phaseCount(b) - 1;
    // D-157: strikes at each milestone the run goes on from (1–6), never the last.
    const strikes = result === 'failed' || last ? 0 : b.strikesPerMilestone;
    const paid: MilestoneReward =
      result === 'failed'
        ? { budget: 0, score: 0, interest: 0 }
        : {
            budget: b.milestoneBudget + (bonus?.budget ?? 0) + interest,
            score: bonus?.score ?? 0,
            interest,
            ...(strikes > 0 ? { strikes } : {}),
          };
    // D-145: no shop follows the last milestone, so the budget held when it's met, this payout
    // included, pays Wow. It comes after the target is met, so it never turns a loss into a win.
    const held = s.budget + paid.budget;
    const leftover =
      last && result !== 'failed' && held > 0 && b.leftoverBudgetWow > 0
        ? { budget: held, score: held * b.leftoverBudgetWow }
        : null;
    const reward: MilestoneReward = leftover ? { ...paid, leftover } : paid;
    const score = s.score + reward.score + (leftover?.score ?? 0);
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
      ...unpinned(s),
      score,
      budget: s.budget + reward.budget,
      budgetEarned: s.budgetEarned + reward.budget,
      hand: [],
      milestones: [...s.milestones, record],
      milestonesEarly: s.milestonesEarly + (result === 'early' ? 1 : 0),
    };
    // M4b: the phase's effects end, and its accepted change orders resolve (a met milestone only).
    if (result !== 'failed') next = resolveOrders(next, events);
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
      strikesLeft: next.strikesLeft + strikes,
      // D-207: a pin's card waits through the change orders and the shop for the next phase's
      // first week, as the pin's tip promises: it stays for next week.
      ...(keep ? { pinnedOver: keep } : {}),
    };
    // M4b, D-144: after milestones 2, 4, and 6, two change orders first, from
    // `co/<milestone>`, to pick one of; with none eligible, straight to the shop.
    const milestone = s.phase + 1;
    if (b.changeOrderAfter.includes(milestone)) {
      const ids = drawOrders(next, milestone);
      if (ids.length > 0) return offerOrders(next, ids, false, events);
    }
    // The shop opens after milestones 1–6 (D-051); shop k follows milestone k.
    return openShop(next, next.phase, false, events);
  }

  function openShop(s: RunState, number: number, forced: boolean, events: GameEvent[]): RunState {
    // D-196: a held good the run can't own by now is dropped as the shelf is stocked.
    const kept = dropHold(s, events);
    s = kept.state;
    const stocked = openVisit(content, s, number, forced, shelfOf(s));
    const shop = kept.dropped ? { ...stocked, dropped: kept.dropped } : stocked;
    events.push({ t: 'shopOpened', number, offers: shop.offers, sale: shop.sale });
    // The hand is set aside, and a pin with it (D-186). After a milestone, the pinned card waits
    // for the next phase as `pinnedOver` (D-207); the ?debug panel's shop, opened mid-week,
    // deals a fresh hand in the same week, which takes a pin as a reroll does.
    let next: RunState = { ...unpinned(s), screen: 'shop', hand: [], offers: { shop } };
    // Shop 1's free Housewarming crate: 1 of 3 Common blueprints, to teach blueprints.
    const n = stockFor(content, number).housewarming;
    if (n > 0) {
      const key = `crate/${number}/0/housewarming`;
      const options = crateOptions(content, next, 'housewarming', key, n, shelfOf(next));
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
   * `keep`: the card a pin carries past the milestone to the next week played (D-207).
   */
  function completeEarly(
    s: RunState,
    weeksSaved: number,
    manual: boolean,
    events: GameEvent[],
    keep?: Keep,
  ): RunState {
    const bonus = earlyBonus(
      b,
      s.phase,
      s.score - s.phaseStartScore,
      weeksSaved,
      rule(s, 'earlyRewardPct'),
    );
    // The hand goes: what a pin keeps travels as `keep` (D-207).
    let cur: RunState = { ...unpinned(s), hand: [], draws: 0 };
    for (let k = 0; k < weeksSaved; k++) {
      if (!(manual && k === 0)) {
        cur = resolveTransforms({ ...cur, slot: cur.slot + 1, week: cur.week + 1 }, events);
      }
      // A fast-forwarded week isn't played, so Last-Minute Push's last week doesn't count.
      cur = recordTally(cur, cur.house, tallyOf(cur, cur.house, true, true), false, true, events);
    }
    return resolveMilestone(cur, 'early', weeksSaved, bonus, events, keep);
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

  // -------------------------------------------------------------------------------------
  // Strikes from the hand (D-157).

  /** A card's type as a strike names it: a piece's root type (the L-Kitchen is a Kitchen). */
  function strikeType(card: Card): CardType {
    return card.kind === 'piece'
      ? { kind: 'piece', id: rootType(content.pieces[card.id]) }
      : { kind: 'fixture', id: card.id };
  }

  const sameType = (a: Card, c: Card) => a.kind === c.kind && a.id === c.id;

  /** The hand cards a strike of `type` takes out, in hand order. */
  const struckSlots = (state: RunState, type: CardType): number[] =>
    state.hand.flatMap((c, j) => (isStruck(content, [type], c) ? [j] : []));

  const NOT_IN_DRAW = 'That card never comes up in the weekly draw.';

  function canStrikeCard(state: RunState, i: number): Availability {
    if (state.screen !== 'build') return { ok: false, reason: offScreen(state) };
    if (state.strikesLeft <= 0) return { ok: false, reason: 'No strikes left.' };
    const card = Number.isInteger(i) ? state.hand[i] : undefined;
    if (!card) return { ok: false, reason: 'Pick a card in your hand.' };
    // Only what the weekly draw deals: not a member's room (the ?debug panel's), nor a special
    // piece this run's client and crew don't draw (the Catalog's).
    const known =
      card.kind === 'piece'
        ? Object.hasOwn(content.pieces, card.id)
        : Object.hasOwn(content.fixtures, card.id);
    if (!known || (card.kind === 'piece' && content.pieces[card.id].member)) {
      return { ok: false, reason: NOT_IN_DRAW };
    }
    const type = strikeType(card);
    const mods = modsOf(state).active.map((a) => a.mod);
    if (!drawableTypes(content, [], undefined, mods).some((t) => sameType(t, type))) {
      return { ok: false, reason: NOT_IN_DRAW };
    }
    // Already struck (a ?debug card), the row at its floor, or nothing left to strike.
    const can = canStrike(content, state, type, mods);
    if (!can.ok) return can;
    // Each slot it empties takes a card from its row: the hand never shrinks.
    const gone = struckSlots(state, type);
    for (const row of DRAW_ROWS) {
      const need = gone.filter((j) => rowOf(content, state.hand[j]!) === row).length;
      if (need === 0) continue;
      const inRow = state.hand.filter((c) => rowOf(content, c) === row);
      const pool = drawWeights(content, state.phase, {
        ...drawOpts(state, row),
        struck: [...state.struck, type],
      }).filter((p) => !inRow.some((c) => sameType(c, p.card)));
      if (pool.length < need) {
        return { ok: false, reason: 'Nothing else in its row can come up this week.' };
      }
    }
    return { ok: true };
  }

  /** D-157: whether Strike can be used at all (the plank's button and S), and why not. */
  function canStrikeAny(state: RunState): Availability {
    if (state.screen !== 'build') return { ok: false, reason: offScreen(state) };
    if (state.strikesLeft <= 0) return { ok: false, reason: 'No strikes left.' };
    const mods = modsOf(state).active.map((a) => a.mod);
    if (strikeOptions(content, state, mods).length === 0) {
      return { ok: false, reason: SHOP_REASONS.noStrike };
    }
    // A hand none of whose cards can go (special pieces the run doesn't draw, rows at their
    // floor, nothing else in a row this week): the mode would only hatch every card.
    if (!state.hand.some((_, i) => canStrikeCard(state, i).ok)) {
      return { ok: false, reason: 'No card in your hand can be struck.' };
    }
    return { ok: true };
  }

  function previewStrike(state: RunState, i: number): StrikePreview {
    const can = canStrikeCard(state, i);
    const card = Number.isInteger(i) ? state.hand[i] : undefined;
    const known =
      card &&
      (card.kind === 'piece'
        ? Object.hasOwn(content.pieces, card.id)
        : Object.hasOwn(content.fixtures, card.id));
    if (!card || !known) return { ...can, type: null, cards: [], text: '' };
    const type = strikeType(card);
    return { ...can, type, cards: struckSlots(state, type), text: strikeText(content, type) };
  }

  /**
   * D-157: strikes hand card i (already checked). Its type is never drawn again this run; it
   * and every other hand card of that type leave, and each slot takes a card from its row as
   * a swap does: the first of up to `swapTries` with a play, else the last tried, from
   * `draw/<phase>/<slot>/<n>/<row>/strike<m>/<k>` (n: the hand's draw, m: the run's struck
   * types with this one, k: the slot's place in its row). No other card moves, and the week's
   * draws don't count it, so nothing else shifts.
   */
  function strikeFromHand(state: RunState, i: number, events: GameEvent[]): RunState {
    const type = strikeType(state.hand[i]!);
    const gone = struckSlots(state, type);
    const struck = [...state.struck, type];
    const n = Math.max(0, state.draws - 1);
    const slot = slotKey(state.slot, state.overtimeWeek);
    let s: RunState = {
      ...state,
      struck,
      strikesLeft: state.strikesLeft - 1,
      // A swapped-in card's note (D-121) goes with it.
      swapped: state.swapped.filter((w) => !gone.includes(w.i)),
    };
    const slots: StruckSlot[] = [];
    for (const j of gone) {
      const was = s.hand[j]!;
      const row = rowOf(content, was);
      const at = s.hand.flatMap((c, x) => (rowOf(content, c) === row ? [x] : []));
      const tries = strikeCandidates(
        content,
        s.setup.seed,
        s.phase,
        slot,
        n,
        struck.length,
        at.indexOf(j),
        b.swapTries,
        at.map((x) => s.hand[x]!),
        drawOpts(s, row),
      );
      for (const card of tries) {
        s = { ...s, hand: s.hand.map((c, x) => (x === j ? card : c)) };
        if (cardHasPlay(s, j)) break;
      }
      slots.push({ i: j, was, card: s.hand[j]! });
    }
    events.push({ t: 'cardStruck', i, type, slots, strikesLeft: s.strikesLeft });
    // A pin, or the card a pin kept, goes with its card (D-186).
    return withMarks(
      s,
      s.pinned !== undefined && gone.includes(s.pinned) ? undefined : s.pinned,
      s.kept !== undefined && gone.includes(s.kept) ? undefined : s.kept,
    );
  }

  // -------------------------------------------------------------------------------------
  // Pins (D-186): one hand card kept for next week, in its row in place of a fresh card.

  const KEPT_AGAIN = 'Kept from last week: it can’t be pinned again.';
  const NO_WEEK_AFTER = 'No week comes after this one.';

  function lastWeekOfRun(state: RunState): boolean {
    return state.phase >= phaseCount(b) - 1 && isLastWeek(state) && state.overtimeLeft <= 0;
  }

  function canPin(state: RunState, i: number): Availability {
    if (state.screen !== 'build') return { ok: false, reason: offScreen(state) };
    if (!Number.isInteger(i) || !state.hand[i]) {
      return { ok: false, reason: 'Pick a card in your hand.' };
    }
    // Pinned again and again, a card would stand in the hand for good (D-121 turned that down).
    if (i === state.kept) return { ok: false, reason: KEPT_AGAIN };
    // D-207: a pin keeps its card for the next week played, past a milestone and its shop too,
    // and the run's last week has none after it, as the last shop has no hold (D-196).
    if (lastWeekOfRun(state)) return { ok: false, reason: NO_WEEK_AFTER };
    return { ok: true };
  }

  /** Pins hand card i (already checked), moving the pin from another card, or takes it off. */
  function pin(state: RunState, i: number, events: GameEvent[]): RunState {
    const on = state.pinned !== i;
    events.push({ t: 'cardPinned', i, pinned: on });
    return withMarks(state, on ? i : undefined, state.kept);
  }

  /** The state with no pin and no kept card: the hand they pointed into is gone. */
  function unpinned(state: RunState): RunState {
    if (state.pinned === undefined && state.kept === undefined) return state;
    const { pinned: _pinned, kept: _kept, ...rest } = state;
    return rest;
  }

  /** `state` with its pin and its kept card at these places in the hand (none if undefined). */
  function withMarks(
    state: RunState,
    pinned: number | undefined,
    kept: number | undefined,
  ): RunState {
    if (state.pinned === pinned && state.kept === kept) return state;
    return {
      ...unpinned(state),
      ...(pinned === undefined ? {} : { pinned }),
      ...(kept === undefined ? {} : { kept }),
    };
  }

  /**
   * Hand card i leaves mid-week (Weekend Crew's play, D-075; the Handyman's install, D-171):
   * the cards after it move up, and the pin and the kept card's places with them. A pin on it
   * goes with it.
   */
  function withoutHandCard(state: RunState, i: number): RunState {
    const shift = (j: number | undefined) =>
      j === undefined || j === i ? undefined : j > i ? j - 1 : j;
    return withMarks(
      { ...state, hand: state.hand.filter((_, k) => k !== i) },
      shift(state.pinned),
      shift(state.kept),
    );
  }

  /** Hand card i's place in its row: the slot a pin brings it back to. */
  function rowSlot(hand: readonly Card[], i: number): number {
    const row = rowOf(content, hand[i]!);
    return hand.slice(0, i).filter((c) => rowOf(content, c) === row).length;
  }

  /**
   * What a pin carries out of the week ending now: the pinned card, and its place in its row.
   * Nothing when `played`, the hand card that ends the week, is the pinned one.
   */
  function keepOf(state: RunState, played?: number): Keep | undefined {
    const i = state.pinned;
    if (i === undefined || i === played) return undefined;
    const card = state.hand[i];
    return card ? { card, k: rowSlot(state.hand, i) } : undefined;
  }

  /** The card the hand's kept card is, to carry through a redraw in the same week. */
  function keptNow(state: RunState): Keep | undefined {
    const i = state.kept;
    const card = i === undefined ? undefined : state.hand[i];
    return card ? { card, k: rowSlot(state.hand, i!) } : undefined;
  }

  /**
   * A drawn hand with the kept card in it: in its row's k-th slot (the row's last when the row
   * is shorter), in place of the card drawn there. Where the draw dealt the same card in
   * another slot of the row, that slot takes the card it displaced instead, so the row stays
   * distinct (D-043) and the kept card stays where it was pinned. A row the draw left empty
   * (a pool run dry) gets it on its own.
   */
  function withKept(hand: readonly Card[], keep: Keep): { hand: Card[]; kept: number } {
    const row = rowOf(content, keep.card);
    const out = [...hand];
    const at = out.flatMap((c, j) => (rowOf(content, c) === row ? [j] : []));
    if (at.length === 0) {
      const r = DRAW_ROWS.indexOf(row);
      const before = out.filter((c) => DRAW_ROWS.indexOf(rowOf(content, c)) < r).length;
      out.splice(before, 0, keep.card);
      return { hand: out, kept: before };
    }
    const i = at[Math.min(keep.k, at.length - 1)]!;
    const dealt = at.find((j) => j !== i && sameType(out[j]!, keep.card));
    if (dealt !== undefined) out[dealt] = out[i]!;
    out[i] = keep.card;
    return { hand: out, kept: i };
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
        else if (action.strike === undefined) {
          // D-157: +1 strike, used from the hand.
          s = { ...s, strikesLeft: s.strikesLeft + 1 };
        } else {
          // A run code from before D-157 names the type, and replays as D-076 struck it.
          const strike = action.strike;
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
    // D-196: buying the held good lets its hold go.
    if (action.i === heldIndex(visit, state.held)) s = unheld(s);
    events.push({
      t: 'bought',
      i: action.i,
      offer,
      price,
      budgetBefore: state.budget,
      budget: s.budget,
      ...(offer.kind === 'service' && offer.service === 'strike' && action.strike
        ? { strike: action.strike }
        : {}),
    });
    if (offer.kind === 'crate') {
      const v = s.offers!.shop!;
      const key = `crate/${v.number}/${v.refreshes}/${action.i}`;
      const options = crateOptions(content, s, offer.id, key, undefined, shelfOf(s));
      events.push({ t: 'crateOpened', source: offer.id, options });
      s = { ...s, offers: { ...s.offers, pick: { source: offer.id, options } } };
    }
    // D-209: the Drafting Table opens its pick as it's bought.
    if (offer.kind === 'upgrade') s = openUpgradePick(s, offer.id, events);
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
      // A shop the ?debug panel opened mid-week: back to the same week, with a fresh hand on
      // the week's next draw, swapped as at the start of a week (it may deal back old cards).
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
  // Holds (D-196): one shop good kept for the next visit, in place of a fresh good of its kind.

  /**
   * Why a good couldn't come back to the shelf now, or null if it can: the run owns it (a
   * blueprint or an upgrade), or its type is at its limit (a special piece, as the draw reads
   * the limits).
   */
  function holdDrop(state: RunState, good: ShelfGood): HoldDrop | null {
    switch (good.kind) {
      case 'blueprint':
        return state.blueprints.some((o) => o.id === good.id) ? 'owned' : null;
      case 'upgrade':
        return state.upgrades.includes(good.id) ? 'owned' : null;
      case 'piece': {
        const root = rootType(content.pieces[good.id]);
        return typesAtLimit(limitsOf(state)).has(root) ? 'limit' : null;
      }
      default:
        return null;
    }
  }

  function canHold(state: RunState, i: number): Availability {
    const visit = state.screen === 'shop' ? state.offers?.shop : undefined;
    if (!visit) return { ok: false, reason: SHOP_REASONS.notOpen };
    if (state.offers?.pick) return { ok: false, reason: SHOP_REASONS.picking };
    // No shop follows the last phase's milestone (D-051), so a hold there would keep nothing.
    if (state.phase >= phaseCount(b) - 1) return { ok: false, reason: HOLD_REASONS.lastShop };
    const offer = Number.isInteger(i) ? visit.offers[i] : undefined;
    if (!offer) return { ok: false, reason: HOLD_REASONS.nothing };
    if (offer.kind === 'service') return { ok: false, reason: HOLD_REASONS.service };
    if (offer.sold) return { ok: false, reason: SHOP_REASONS.sold };
    // The held good can always be let go.
    if (i === heldIndex(visit, state.held)) return { ok: true };
    // One the next stocking would drop can't be held.
    const drop = holdDrop(state, offer);
    if (drop === 'owned') return { ok: false, reason: SHOP_REASONS.owned };
    if (drop === 'limit') return { ok: false, reason: HOLD_REASONS.atLimit };
    return { ok: true };
  }

  /** Holds offer i (already checked), moving the hold from another good, or lets it go. */
  function hold(state: RunState, i: number, events: GameEvent[]): RunState {
    const visit = state.offers!.shop!;
    const offer = visit.offers[i]!;
    if (offer.kind === 'service') return state;
    const good = shelfGood(offer);
    const on = i !== heldIndex(visit, state.held);
    events.push({ t: 'goodHeld', i, good, held: on });
    return on ? { ...state, held: good } : unheld(state);
  }

  /** The state with no hold. */
  function unheld(state: RunState): RunState {
    if (state.held === undefined) return state;
    const { held: _held, ...rest } = state;
    return rest;
  }

  /**
   * As a shelf is stocked (a visit's, or a refresh's): the hold let go if its good can't come
   * back now, with an event, and the visit's line about it.
   */
  function dropHold(
    state: RunState,
    events: GameEvent[],
  ): { state: RunState; dropped?: ShopVisit['dropped'] } {
    const good = state.held;
    const why = good ? holdDrop(state, good) : null;
    if (!good || !why) return { state };
    events.push({ t: 'holdDropped', good, why });
    return { state: unheld(state), dropped: { good, why } };
  }

  // -------------------------------------------------------------------------------------
  // New runs and actions.

  function newRun(setup: RunSetup): RunState {
    if (
      typeof setup.seed !== 'string' ||
      !isRunMode(setup.mode) ||
      !Object.hasOwn(content.crews, setup.crewId) ||
      !Object.hasOwn(content.clients, setup.clientId)
    ) {
      throw new Error('Bad run setup');
    }
    // A run keeps the traits its lot begins with (D-166). The first job's lot stays plain, in
    // any mode: it's the lot, not the run, that the guided job was built on (D-149).
    const plain = !!b.jobBoard.firstSeed && setup.seed === b.jobBoard.firstSeed;
    const lot = withTraits(content, generateLot(setup.seed, b.lot, { plain }));
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
      strikesLeft: setupRule(content, clean, 'strikes'),
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
        const ids = action.other === undefined ? [action.id] : [action.id, action.other];
        if (ids.some((id) => typeof id !== 'string' || !Object.hasOwn(content.changeOrders, id))) {
          throw new IllegalAction('Unknown change order.');
        }
        if (new Set(ids).size < ids.length) {
          throw new IllegalAction('Two different change orders, or one alone.');
        }
        return offerOrders(s, ids, true, events);
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
    'hold',
    'leaveShop',
    'pick',
    'setAutoComplete',
    'debug',
  ]);
  /** M4b: the 'changeOrder' screen waits for its pick (the auto-complete toggle and cheats aside). */
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
      throw new IllegalAction(ORDER_WAITING);
    }
    const shopOnly =
      action.t === 'buy' ||
      action.t === 'refreshShop' ||
      action.t === 'hold' ||
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
      case 'renovate':
      case 'extend': {
        const play = action.t === 'pass' ? null : action;
        if (play?.t === 'install' && play.from === 'supplies') {
          // A free action: the fixture goes in, and the week goes on. D-211: a room it finishes
          // pays.
          const week = applyPlay(state, play);
          events.push(week.installed!);
          const s: RunState = {
            ...state,
            house: week.house,
            supplies: state.supplies.filter((_, k) => k !== play.i),
          };
          return done(payFinished(s, state.house, week.house, events));
        }
        const check = play ? checkPlay(state, play) : undefined;
        const fromReserve = !!play && fromGoods(play);
        if (play && !endsWeek(state, play)) {
          // D-163: a piece from Your goods goes down at once, and the week goes on: placed,
          // renovating, or extending a room (D-168, D-169). So does Weekend Crew's next card
          // (D-075), which a Renovation (D-083) or an extension can be: `free` marks it.
          // D-171: the Handyman's install isn't Weekend Crew's card: that stays ready.
          const crew = !fromReserve && !freeInstall(state, play);
          const result = applyPlay(state, play, check);
          const mark = crew ? { free: true as const } : {};
          if (result.placed) events.push({ ...result.placed, ...mark });
          if (result.installed) events.push({ ...result.installed, ...mark });
          if (result.renovated) events.push({ ...result.renovated, ...mark });
          if (result.extended) events.push({ ...result.extended, ...mark });
          let s: RunState = crew
            ? { ...state, house: result.house, freePlay: 'used' }
            : { ...state, house: result.house };
          // A hand card's place goes, and the pin's and the kept card's move with it (D-186).
          s = fromReserve
            ? { ...s, reserve: s.reserve.filter((_, k) => k !== play.i) }
            : withoutHandCard(s, play.i);
          // M4b: a piece a running restriction forbids breaks it.
          if (result.placed) {
            const uid = result.placed.uid;
            s = markBroken(s, breaksOf(state, result.house, uid), uid, events);
          }
          // D-211: a room the play finished pays, then any find it dug up.
          s = payFinished(s, state.house, result.house, events);
          return done(payFinds(s, check?.finds, events, state.house.lot));
        }
        const week = resolveWeek(state, play, true, check);
        if (week.placed) events.push(week.placed);
        if (week.installed) events.push(week.installed);
        if (week.renovated) events.push(week.renovated);
        if (week.extended) events.push(week.extended);
        // Only a hand card or a pass gets here: a piece from Your goods never ends the week.
        let s = state;
        // M4b: a piece a running restriction forbids breaks it, before the milestone can resolve.
        if (week.placed) {
          const uid = week.placed.uid;
          s = markBroken(s, breaksOf(state, week.house, uid), uid, events);
        }
        // D-211: a room the play finished pays before the tally, as a find does; then a Time
        // Capsule built over.
        s = payFinished(s, state.house, week.house, events);
        s = payFinds(s, check?.finds, events);
        // D-186: the pinned card comes into next week's hand, unless it's the card played.
        const keep = keepOf(s, play?.from === 'hand' ? play.i : undefined);
        s = recordTally(s, week.house, week.tally, play === null, false, events);
        return done(afterTally(s, events, keep));
      }
      case 'reroll': {
        const can = canReroll(state);
        if (!can.ok) throw new IllegalAction(can.reason!);
        // Both rows (D-132), then their swaps, as at the start of a week, on the same streams.
        // Neither deals back a card the hand holds now while its row's pool has enough others.
        const n = state.draws;
        const held = state.hand;
        // D-186: the card a pin kept stays where it is, on the draw's own keys; a card pinned
        // this week goes with the rest, and its pin with it.
        let hand = drawFor(state, n, false, held);
        let kept: number | undefined;
        const keep = keptNow(state);
        if (keep) ({ hand, kept } = withKept(hand, keep));
        // The phase's own rerolls go first; bought ones never expire.
        const fromPhase = state.rerollsLeft > 0;
        const after = swapDead(
          withMarks(
            {
              ...state,
              hand,
              swapped: [],
              draws: n + 1,
              rerollsLeft: fromPhase ? state.rerollsLeft - 1 : state.rerollsLeft,
              bonusRerolls: fromPhase ? state.bonusRerolls : state.bonusRerolls - 1,
            },
            undefined,
            kept,
          ),
          n,
          held,
        );
        events.push({
          t: 'handDrawn',
          phase: state.phase,
          slot: state.slot,
          overtimeWeek: state.overtimeWeek,
          hand: after.state.hand,
          reroll: true,
          ...swapNote(after.swapped),
          ...(kept === undefined ? {} : { kept }),
        });
        return done(after.state);
      }
      case 'strikeCard': {
        const can = canStrikeCard(state, action.i);
        if (!can.ok) throw new IllegalAction(can.reason!);
        return done(strikeFromHand(state, action.i, events));
      }
      case 'pin': {
        const can = canPin(state, action.i);
        if (!can.ok) throw new IllegalAction(can.reason!);
        return done(pin(state, action.i, events));
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
        // M4b: a running request counts the pieces demolished since it was picked (Declutter).
        if (target.kind === 'piece' && running(s).length > 0) {
          s = {
            ...s,
            changeOrders: s.changeOrders.map((r) =>
              r.result === undefined ? { ...r, demolished: r.demolished + 1 } : r,
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
        // D-207: the pinned card goes on to the next phase's first week.
        return done(completeEarly(state, offer.weeksSaved, true, events, keepOf(state)));
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
        // D-196: the held good stays on the shelf, unless the run came to own it this visit.
        const kept = dropHold(state, events);
        const s = kept.state;
        const refreshed = refreshVisit(content, s, visit, shelfOf(s));
        const next = kept.dropped ? { ...refreshed, dropped: kept.dropped } : refreshed;
        const budget = s.budget - can.price;
        events.push({
          t: 'shopRefreshed',
          refreshes: next.refreshes,
          price: can.price,
          budget,
          offers: next.offers,
          sale: next.sale,
        });
        return done({ ...s, budget, offers: { ...s.offers, shop: next } });
      }
      case 'hold': {
        const can = canHold(state, action.i);
        if (!can.ok) throw new IllegalAction(can.reason!);
        return done(hold(state, action.i, events));
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
        return done(answerOrder(state, action.i, events));
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
    // D-171: an Addition has no spot of its own.
    if (!def || def.addition || capReached(state, def)) return;
    const { width, height } = state.house.lot;
    for (const ps of placementShapes(def)) {
      const { w, h } = bounds(ps.cells);
      for (let y = 0; y + h <= height; y++) {
        for (let x = 0; x + w <= width; x++) {
          const play: PlaceAction = ps.shape
            ? { t: 'place', from, i, x, y, rot: ps.rot, shape: ps.shape }
            : { t: 'place', from, i, x, y, rot: ps.rot };
          if (checkSpot(state, def, play).legal && visit(play) === true) return;
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
   * The build screen's state for the week a fixture or a blueprint bought now would first earn
   * in (D-107, D-141): this one, or in the shop the next phase's first week, its transforms
   * resolved as leaving starts it (its arrivals only fill the reserve). A shop the ?debug panel
   * opened mid-week goes back to that week. Null on the other screens.
   */
  function installWeek(state: RunState): RunState | null {
    if (state.screen === 'build') return state;
    if (state.screen !== 'shop') return null;
    const { offers: _offers, ...rest } = state;
    const s: RunState = { ...rest, screen: 'build' };
    return weekStarted(state) ? s : resolveTransforms(s, []);
  }

  /**
   * D-193: what no good's value reads. A click in the shop (buying, selling, a refresh, opening
   * a crate, a hold) changes only these, so its values carry over from the state before.
   */
  const VALUE_BLIND: ReadonlySet<string> = new Set<keyof RunState>([
    'budget',
    'reserve',
    'supplies',
    'offers',
    'servicesBought',
    'bonusRerolls',
    'demolitionsLeft',
    'strikesLeft',
    'struck',
    // D-196: the good held for the next shop only changes what a shelf stocks.
    'held',
  ]);
  let valuedLast: RunState | null = null;

  /**
   * D-193: the state a good's values are kept by: the last one valued, while this one differs
   * from it only in what no value reads (VALUE_BLIND, and of the offers, only whether the ?debug
   * panel forced them), else this one.
   */
  function valuedState(state: RunState): RunState {
    const last = valuedLast;
    if (last === state) return state;
    if (last && sameForValues(last, state)) return last;
    valuedLast = state;
    return state;
  }

  function sameForValues(a: RunState, b: RunState): boolean {
    if (!!a.offers?.shop?.forced !== !!b.offers?.shop?.forced) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!VALUE_BLIND.has(k) && a[k as keyof RunState] !== b[k as keyof RunState]) return false;
    }
    return true;
  }

  /** Each kind of value, kept by the state it's worked out from (valuedState). */
  function kept<K, V>(
    cache: WeakMap<RunState, Map<K, V>>,
    state: RunState,
    key: K,
    work: (s: RunState, key: K) => V,
  ): V {
    const s = valuedState(state);
    let known = cache.get(s);
    if (!known) cache.set(s, (known = new Map()));
    if (!known.has(key)) known.set(key, work(s, key));
    return known.get(key)!;
  }

  /** Kept (D-193): Inspect asks again as it renders, as for a blueprint. */
  const fixtureValues = new WeakMap<RunState, Map<FixtureId, FixtureValue | null>>();

  function fixtureValue(state: RunState, fixture: FixtureId): FixtureValue | null {
    return kept(fixtureValues, state, fixture, valueFixture);
  }

  function valueFixture(state: RunState, fixture: FixtureId): FixtureValue | null {
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

  /**
   * The week after this one in a run where nothing more is built (D-141's projection): the next
   * slot, or the next phase's first week after a phase's last (or an overtime week), with the
   * transforms that start it. Timed effects end as they would: a tool's with its week's tally,
   * a phase effect with its phase.
   */
  function idleNextWeek(s: RunState): RunState {
    const last = s.overtimeWeek > 0 || s.slot >= W;
    const timedEffects = s.timedEffects.filter((e) =>
      'week' in e.until ? e.until.week > s.week : !last || e.until.phase > s.phase,
    );
    const next: RunState = last
      ? { ...s, phase: s.phase + 1, slot: 1, overtimeWeek: 0, week: s.week + 1, timedEffects }
      : { ...s, slot: s.slot + 1, week: s.week + 1, timedEffects };
    return resolveTransforms(next, []);
  }

  /**
   * D-141's projection (D-193 shares it): the week a good bought now would first count in
   * (installWeek's), then each week after it to the run's end with nothing more built, the
   * house's timers running on. This phase's weeks left, then every later phase's; overtime can't
   * be foreseen. Kept by state, so every good on a shelf walks the same weeks. Null on the
   * screens installWeek has none for.
   */
  const idleRuns = new WeakMap<RunState, readonly RunState[] | null>();

  function idleRun(state: RunState): readonly RunState[] | null {
    let run = idleRuns.get(state);
    if (run === undefined) {
      const first = installWeek(state);
      if (first) {
        const weeks = weeksLeft(first) + Math.max(0, phaseCount(b) - 1 - first.phase) * W;
        const out = [first];
        for (let k = 1; k < weeks; k++) out.push(idleNextWeek(out[k - 1]!));
        run = out;
      } else run = null;
      idleRuns.set(state, run);
    }
    return run;
  }

  /** Each of idleRun's weeks' Wow and budget as the house stands, for D-193's gains. */
  const idleTallies = new WeakMap<RunState, { wow: number[]; budget: number[] }>();

  function idleTotals(
    state: RunState,
    run: readonly RunState[],
  ): { wow: number[]; budget: number[] } {
    let t = idleTallies.get(state);
    if (!t) {
      t = { wow: [], budget: [] };
      for (const s of run) {
        const tally = tallyOf(s, s.house, false);
        t.wow.push(tally.total);
        t.budget.push(tally.budget);
      }
      idleTallies.set(state, t);
    }
    return t;
  }

  const blueprintValues = new WeakMap<RunState, Map<BlueprintId, BlueprintValue | null>>();

  function blueprintValue(state: RunState, id: BlueprintId): BlueprintValue | null {
    return kept(blueprintValues, state, id, valueBlueprint);
  }

  function valueBlueprint(state: RunState, id: BlueprintId): BlueprintValue | null {
    if (!Object.hasOwn(content.blueprints, id)) return null;
    const def = content.blueprints[id];
    const scoring = def.modifiers.filter(scoresWeek);
    const run = idleRun(state);
    if (scoring.length === 0 || !run) return null;
    const first = run[0]!;
    // As if bought now (its granted timers count from here), or as it is if it's held already.
    const held = first.blueprints.some((o) => o.id === id);
    const boughtWeek = first.week;
    const withIt = (s: RunState): RunState =>
      held ? s : { ...s, blueprints: [...s.blueprints, { id, boughtWeek }] };
    const without = (s: RunState): RunState =>
      held ? { ...s, blueprints: s.blueprints.filter((o) => o.id !== id) } : s;
    const gainIn = (s: RunState) => {
      const a = tallyOf(withIt(s), s.house, false);
      const z = tallyOf(without(s), s.house, false);
      return { wow: a.total - z.total, budget: a.budget - z.budget };
    };

    // Each week left in the run, tallied with and without it, with nothing more built.
    const weeks = run.length;
    const lastOnly = lastWeekOnly(scoring);
    let shown: RunState | null = null;
    let overRun = 0;
    let budget = 0;
    let top = 0;
    let any = false;
    for (const cur of run) {
      // The week the line's gain is for: the first, or the first that's a phase's last.
      if (!shown && (!lastOnly || isLastWeek(cur))) shown = cur;
      const g = gainIn(cur);
      overRun += g.wow;
      budget += g.budget;
      top = Math.max(top, g.wow);
      any ||= g.wow !== 0 || g.budget !== 0;
    }
    shown ??= first;
    const gain = gainIn(shown).wow;
    const value: BlueprintValue = {
      gain,
      when: lastOnly ? 'lastWeek' : 'week',
      weeksLeft: weeks,
      overRun,
      budget,
      held,
    };
    if (grows(scoring) && top > gain) value.growsTo = top;
    const stat = scalingStat(scoring);
    if (stat) {
      const more: RunState = { ...shown, [stat]: shown[stat] + 1 };
      value.perStat = { stat, gain: gainIn(more).wow - gain };
    }
    const counting = countingMod(scoring);
    if (counting) {
      const s = withIt(shown);
      const tally = tallyOf(s, s.house, false);
      const more = totalWithOneMore(tally, id, counting) - tally.total;
      if (more !== 0) value.perPiece = { what: countedNoun(content, counting), gain: more };
    }
    if (!any) {
      const s = withIt(shown);
      value.needs = blueprintNeeds(content, def, layoutFor(s), tallyOf(s, s.house, false), {
        milestonesEarly: s.milestonesEarly,
      });
    }
    return value;
  }

  /**
   * D-193: a piece's spots scored exactly when it's valued: the best few by the rules' estimate,
   * as the shop bot's bestPlacement takes (sim/policies/shop.ts)...
   */
  const VALUE_TOP = 8;
  /** ...and the next few the estimate flags as its blind spots, as greedy's shortlist adds. */
  const VALUE_HINTS = 8;
  const VIEW_ESTIMATE = { touching: true, earnNothing: true } as const;

  const pieceValues = new WeakMap<RunState, Map<PieceId, PieceValue | null>>();

  function pieceValue(state: RunState, id: PieceId): PieceValue | null {
    return kept(pieceValues, state, id, valuePiece);
  }

  /**
   * D-193: reserve piece `i`'s play that adds the most to the week: its legal spots ranked by
   * the estimate, the best few and the few it flags as blind spots (a set, a fenced yard, a
   * link, a pair line, the sun) scored exactly, and every Renovation and extension it could
   * make, which are few. Ties go to the first: the estimate's order, then the lot's.
   *
   * A rhythm piece (the Pool) is ranked by the weeks it pays as well (`pay`): the estimate reads
   * it as paying, and each play's exact gain this week and in its first paying week count by
   * how many of the run's weeks are like each.
   */
  function bestPlayOf(
    s: RunState,
    i: number,
    pay: { def: PieceDef; at: RunState; weeks: number; rest: number } | null,
  ): { play: PlaceAction | RenovateAction | ExtendAction; gain: number } | null {
    const def = content.pieces[s.reserve[i]!.id];
    const estDef = pay?.def ?? def;
    const pass = tallyOf(s, s.house, false);
    const layout = layoutFor(s);
    const mods = modsOf(s).active;
    const checklist = { specs: clientOf(s).specs, phase: s.phase };
    const ranked: { play: PlaceAction; est: Estimate }[] = [];
    eachLegalSpot(s, 'reserve', i, (play) => {
      const cells = placedCells(play.shape ?? def.shape, play.x, play.y, play.rot);
      // What it would touch counts here (Creekside's creek), and a modifier that has it earn
      // nothing, though the bots' estimate skips both.
      const est = estimatePlay(
        content,
        layout,
        pass,
        estDef,
        cells,
        mods,
        checklist,
        VIEW_ESTIMATE,
      );
      ranked.push({ play, est });
    });
    // A stable sort: equal estimates keep the lot's order.
    ranked.sort((p, q) => q.est.delta - p.est.delta);
    const exact: (PlaceAction | RenovateAction | ExtendAction)[] = [];
    let hints = 0;
    ranked.forEach(({ play, est }, k) => {
      if (k < VALUE_TOP) exact.push(play);
      else if (
        hints < VALUE_HINTS &&
        (est.setHint || est.yardHint || est.linkHint || est.specHint || est.sunHint)
      ) {
        hints++;
        exact.push(play);
      }
    });
    for (const uid of renovateTargets(s, 'reserve', i)) {
      exact.push({ t: 'renovate', from: 'reserve', i, uid });
    }
    exact.push(...extendSpots(s, 'reserve', i));
    let best: { play: PlaceAction | RenovateAction | ExtendAction; gain: number } | null = null;
    let bestScore = -Infinity;
    for (const play of exact) {
      const house = applyPlay(s, play).house;
      const gain = tallyOf(s, house, false).total - pass.total;
      // The paying week's base is the same for every play, so it's left out of the ranking.
      const score = pay ? gain * pay.rest + tallyOf(pay.at, house, false).total * pay.weeks : gain;
      if (score > bestScore) [best, bestScore] = [{ play, gain }, score];
    }
    return best;
  }

  function valuePiece(state: RunState, id: PieceId): PieceValue | null {
    if (!Object.hasOwn(content.pieces, id)) return null;
    const run = idleRun(state);
    if (!run) return null;
    const first = run[0]!;
    // As if bought: one more piece in Your goods, which goes down without using the week.
    const s: RunState = { ...first, reserve: [...first.reserve, { id }] };
    // Built in the week valued, a rhythm first pays in its `every`th week (onCadence).
    const every = rhythmOf(content.pieces[id]);
    const paying = every === null ? null : Math.floor(run.length / every);
    const pay =
      every !== null && paying
        ? {
            def: payingDef(content.pieces[id])!,
            at: run[every - 1]!,
            weeks: paying,
            rest: run.length - paying,
          }
        : null;
    const best = bestPlayOf(s, s.reserve.length - 1, pay);
    if (!best) return null;
    const { play } = best;
    // The house with it, through each week left: its own timers run on with the rest.
    const base = idleTotals(state, run);
    let cur: RunState = { ...first, house: applyPlay(s, play).house };
    const gains: number[] = [];
    let overRun = 0;
    let budget = 0;
    for (let k = 0; k < run.length; k++) {
      const tally = tallyOf(cur, cur.house, false);
      const g = tally.total - base.wow[k]!;
      gains.push(g);
      overRun += g;
      budget += tally.budget - base.budget[k]!;
      if (k < run.length - 1) cur = idleNextWeek(cur);
    }
    const value: PieceValue = {
      how: play.t,
      gain: gains[0]!,
      weeksLeft: run.length,
      overRun,
      budget,
    };
    if (overRun === 0 && budget === 0 && gains.every((g) => g === 0)) {
      // Nothing at its best spot: say so if something has it earn nothing there.
      const placed: RunState = { ...first, house: applyPlay(s, play).house };
      const uid =
        play.t === 'place'
          ? placed.house.pieces.find((p) => !first.house.pieces.some((q) => q.uid === p.uid))?.uid
          : play.uid;
      const why = uid === undefined ? null : zeroedBy(placed, uid);
      if (why) value.nothing = why;
    }
    if (play.t === 'place') {
      value.spot = play.shape
        ? { x: play.x, y: play.y, rot: play.rot, shape: play.shape }
        : { x: play.x, y: play.y, rot: play.rot };
      const pays = every === null ? undefined : gains[every - 1];
      if (every !== null && pays !== undefined && pays > value.gain) {
        value.rhythm = { every, gain: pays };
      }
    } else {
      if (play.t === 'extend') value.spot = { x: play.x, y: play.y, rot: play.rot };
      const room = first.house.pieces.find((p) => p.uid === play.uid)!;
      value.room = { uid: room.uid, defId: room.defId };
    }
    return value;
  }

  /** What has a placed piece earn nothing (a change order's puppies on Flower Beds), if any. */
  function zeroedBy(state: RunState, uid: number): string | null {
    const layout = layoutFor(state);
    for (const m of modsOf(state).active) {
      if (
        m.mod.kind === 'earnNothing' &&
        matchesPiece(content, layout, m.mod.target, uid, m.host)
      ) {
        return sourceName(content, m.source);
      }
    }
    return null;
  }

  const toolValues = new WeakMap<RunState, Map<ToolId, ToolValue | null>>();

  function toolValue(state: RunState, id: ToolId): ToolValue | null {
    return kept(toolValues, state, id, valueTool);
  }

  function valueTool(state: RunState, id: ToolId): ToolValue | null {
    if (!Object.hasOwn(content.tools, id)) return null;
    const run = idleRun(state);
    if (!run) return null;
    const first = run[0]!;
    const use = content.tools[id].use;
    // As if bought and used in the week valued, as tools.ts uses it.
    const s: RunState = { ...first, supplies: [...first.supplies, { kind: 'tool', id }] };
    const used = (): RunState =>
      useTool(toolCtx, s, { t: 'useTool', i: s.supplies.length - 1 }, []);
    const before = tallyOf(first, first.house, false);
    switch (use.kind) {
      case 'weekModifiers': {
        const after = used();
        const tally = tallyOf(after, after.house, false);
        const gain = tally.total - before.total;
        if (gain !== 0) return { kind: 'week', gain };
        const stats = { milestonesEarly: after.milestonesEarly };
        const needs = modifiersNeeds(content, use.modifiers, layoutFor(after), tally, stats);
        return { kind: 'needs', needs };
      }
      case 'levelSet': {
        // The level lasts the run: each week left, with it and without.
        const setLevels = used().setLevels;
        const base = idleTotals(state, run);
        let gain = 0;
        let overRun = 0;
        run.forEach((cur, k) => {
          const g = tallyOf({ ...cur, setLevels }, cur.house, false).total - base.wow[k]!;
          if (k === 0) gain = g;
          overRun += g;
        });
        if (gain === 0 && overRun === 0) {
          const progress = setProgressOf(content, layoutFor(first), use.set);
          return { kind: 'needs', needs: setNeeds(content, use.set, progress), set: use.set };
        }
        const level = setLevels[use.set]!;
        return { kind: 'level', set: use.set, level, gain, weeksLeft: run.length, overRun };
      }
      case 'advanceTimers': {
        const after = used();
        const grows = tallyOf(after, after.house, false).total > before.total;
        const note = timersNote(content, first.house, first.week, use.weeks, grows);
        return { kind: 'note', note };
      }
      case 'copy':
        return { kind: 'note', note: copyNote(content, before, first.house) };
      case 'reward':
        return use.reward.demolitions
          ? { kind: 'note', note: clearNote(content, first.house) }
          : null;
      case 'extraPlay':
      case 'specialHand':
      case 'move':
        return { kind: 'note', note: NO_NUMBER[use.kind] };
    }
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

  /**
   * D-163: a play from Your goods: a reserve piece placed, renovating with one, or extending a
   * room with one (D-168, D-169). It never ends the week, and it isn't Weekend Crew's next play
   * either.
   */
  const fromGoods = (play: NonNullable<Play>): boolean =>
    play.t !== 'install' && play.from === 'reserve';

  /**
   * D-163: whether a play ends the week. A play from Your goods never does, nor does the next
   * hand card while Weekend Crew is ready (D-083), nor (D-171) a fixture from the hand under
   * `freeInstalls`. Every other play does, as a pass does.
   */
  /** D-171: a fixture from the hand under `freeInstalls` (the Handyman): the week goes on. */
  const freeInstall = (state: RunState, play: NonNullable<Play>): boolean =>
    play.t === 'install' && play.from === 'hand' && rule(state, 'freeInstalls') > 0;

  function endsWeek(state: RunState, play: NonNullable<Play>): boolean {
    return !fromGoods(play) && !freeInstall(state, play) && state.freePlay !== 'ready';
  }

  /** D-168: extension spots by state, then by card and room. */
  const spotsCache = new WeakMap<RunState, Map<string, ExtendAction[]>>();

  function extendSpots(
    state: RunState,
    from: ExtendAction['from'],
    i: number,
    uid?: number,
  ): ExtendAction[] {
    if (state.screen !== 'build') return [];
    const def = placeDef(state, { t: 'extend', from, i, uid: 0, x: 0, y: 0, rot: 0 });
    if (!extendsAny(def)) return [];
    let byKey = spotsCache.get(state);
    if (!byKey) spotsCache.set(state, (byKey = new Map()));
    const key = `${from}/${i}/${uid ?? '*'}`;
    const hit = byKey.get(key);
    if (hit) return hit;
    const out: ExtendAction[] = [];
    const layout = layoutFor(state);
    const { width: w, height: h } = state.house.lot;
    const root = rootType(def);
    for (const room of state.house.pieces) {
      if (uid !== undefined && room.uid !== uid) continue;
      if (!extendsType(def, content.pieces[room.defId])) continue;
      if ((room.extended ?? 0) >= b.extend.maxPerRoom) continue;
      const roomCells = layout.cells.get(room.uid)!;
      const own = new Set(roomCells.map((c) => cellIndex(w, c.x, c.y)));
      // The open tiles around the room: a spot must cover one of them, so each of the card's
      // tiles on each of them is a candidate corner.
      const around: { x: number; y: number }[] = [];
      for (const c of roomCells) {
        for (const [dx, dy] of ORTHOGONAL) {
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const k = cellIndex(w, x, y);
          if (own.has(k) || layout.occupant[k]! >= 0) continue;
          around.push({ x, y });
        }
      }
      for (const rot of uniqueRotations(def.shape)) {
        const cells = shapeCells(def.shape, rot);
        const seen = new Set<string>();
        const spots: { x: number; y: number }[] = [];
        for (const a of around) {
          for (const c of cells) {
            const x = a.x - c.x;
            const y = a.y - c.y;
            const k = `${x},${y}`;
            if (seen.has(k)) continue;
            seen.add(k);
            spots.push({ x, y });
          }
        }
        spots.sort((p, q) => p.y - q.y || p.x - q.x);
        for (const { x, y } of spots) {
          // Off the lot or on something built (the room itself included): no spot. checkExtend
          // would say so too, but asking it about the room itself asks for these spots again.
          const clear = cells.every((c) => {
            const cx = c.x + x;
            const cy = c.y + y;
            return (
              cx >= 0 && cy >= 0 && cx < w && cy < h && layout.occupant[cellIndex(w, cx, cy)]! < 0
            );
          });
          if (!clear) continue;
          const play: ExtendAction = { t: 'extend', from, i, uid: room.uid, x, y, rot };
          if (checkExtend(state, play).legal) out.push(play);
        }
      }
    }
    byKey.set(key, out);
    return out;
  }

  function extendTargets(state: RunState, from: ExtendAction['from'], i: number): number[] {
    return [...new Set(extendSpots(state, from, i).map((p) => p.uid))];
  }

  function legalPlays(state: RunState): NonNullable<Play>[] {
    const out: NonNullable<Play>[] = legalPlacements(state);
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
    // D-168: extensions, after the Renovations.
    state.hand.forEach((card, i) => {
      if (card.kind === 'piece') out.push(...extendSpots(state, 'hand', i));
    });
    state.reserve.forEach((_, i) => out.push(...extendSpots(state, 'reserve', i)));
    return out;
  }

  function legalActions(state: RunState): Action[] {
    if (state.screen === 'changeOrder') {
      // M4b, D-144: pick one of the orders on offer.
      const ids = state.offers?.changeOrder?.ids ?? [];
      return ids.map((_, i): Action => ({ t: 'answerChangeOrder', i }));
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
      // The strike service is +1 strike (D-157): a run code's typed strike is never listed.
      for (const o of viewOffers(content, state)) if (o.ok) out.push({ t: 'buy', i: o.i });
      state.blueprints.forEach((_, i) => out.push({ t: 'sell', from: 'blueprints', i }));
      state.supplies.forEach((_, i) => out.push({ t: 'sell', from: 'supplies', i }));
      // D-196: a hold on any good but a service, moved to it, or let go; none in the last shop.
      (state.offers?.shop?.offers ?? []).forEach((_, i) => {
        if (canHold(state, i).ok) out.push({ t: 'hold', i });
      });
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
    state.hand.forEach((_, i) => {
      if (canStrikeCard(state, i).ok) out.push({ t: 'strikeCard', i });
    });
    // D-186: a pin on any card the last week's pin didn't keep, or off the pinned one.
    state.hand.forEach((_, i) => {
      if (canPin(state, i).ok) out.push({ t: 'pin', i });
    });
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
    const layout = layoutFor(state);
    const unmet = unmetRequirement(content, layout, def, uid);
    const next = (every: number) => {
      for (let a = age; a < age + every; a++)
        if (onCadence(a, every)) return state.week + (a - age);
      return state.week;
    };
    for (const outer of def.effects) {
      // A timer under a condition (D-195: the Garage's garage sales, once its drive comes) waits
      // while the condition doesn't hold, as one under a requirement does.
      const waits =
        outer.kind === 'conditional' && !meetsCondition(content, layout, outer.when, uid)
          ? outer.when
          : null;
      const e = outer.kind === 'conditional' ? outer.effect : outer;
      if (e.kind === 'transform') {
        const into =
          'piece' in e.into
            ? content.pieces[e.into.piece].name
            : content.features[e.into.feature].name;
        const when = state.week + Math.max(soonest, e.afterWeeks - age);
        // A pack's tiles each become one (D-195: a Sapling of three becomes three Trees).
        const n = shapeCells(piece.shape ?? def.shape, 0).length;
        const what = n > 1 && 'feature' in e.into ? `${n} ${plural(into)}` : article(into);
        out.push(`Becomes ${what} at the start of week ${when}`);
      } else if ((unmet || waits) && (e.kind === 'rhythm' || e.kind === 'economy')) {
        out.push(`Paused: it must be ${conditionText(content, unmet?.condition ?? waits!)}`);
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
    const focus =
      week.placed?.uid ?? week.installed?.uid ?? week.renovated?.uid ?? week.extended!.uid;
    const beforeEarned = new Map<number, PieceScore>(beforeTally.pieces.map((p) => [p.uid, p]));
    const lines: PreviewLine[] = [];
    let newPiece: PieceScore | null = null;
    for (const p of week.tally.pieces) {
      // The new piece, or an install's host, or the room a Renovation levels or an extension grows.
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
    // D-211: the room this play would finish, and what that pays (a play touches one room).
    const finished = pays(b.finishReward) ? finishedBy(state.house, week.house)[0] : undefined;
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
      ...(week.extended
        ? {
            extends: {
              uid: week.extended.uid,
              cells: layoutFor(state, week.house).cells.get(week.extended.uid) ?? [],
            },
          }
        : {}),
      ...(finished ? { finishes: { uid: finished.uid, reward: b.finishReward } } : {}),
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
    endsWeek,
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
    toGo: (state) => Math.max(0, targetOf(state) - state.score),
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
    extendSpots,
    extendTargets,
    limits: limitsOf,
    checklist,
    installHosts: hostsFor,
    installGains,
    fixtureValue,
    blueprintValue,
    pieceValue,
    toolValue,
    estimatePlay: (state, play, opts) => {
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
        opts,
      );
    },
    fencedYards: (state) => layoutFor(state).fencedSizes,
    fencedTiles: (state) => {
      const ids = layoutFor(state).fencedId;
      const out: number[] = [];
      ids.forEach((id, i) => id >= 0 && out.push(i));
      return out;
    },
    yardTiles: (state, yard) => {
      const bit = REGION_BIT[yard];
      const out: number[] = [];
      layoutFor(state).regionBits.forEach((bits, i) => bits & bit && out.push(i));
      return out;
    },
    reachTiles: (state, of) => {
      const { lot } = state.house;
      let def: PieceDef | undefined;
      let cells: readonly Cell[];
      if ('uid' in of) {
        const layout = layoutFor(state);
        const piece = layout.byUid.get(of.uid);
        if (!piece) return [];
        def = content.pieces[piece.defId];
        cells = layout.cells.get(of.uid) ?? [];
      } else {
        def = content.pieces[of.defId];
        cells = of.cells;
      }
      const r = def ? reachOf(def) : 0;
      if (r === 0 || cells.length === 0) return [];
      const w = lot.width;
      const own = cells
        .filter((c) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < lot.height)
        .map((c) => c.y * w + c.x);
      return [...new Set([...tilesWithin(lot, cells, r), ...own])].sort((a, b) => a - b);
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
    setProgress: (state, set) => setProgressOf(content, layoutFor(state), set),
    canPay: (state, good) => shelfOf(state).canPay(good),
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
    strikeOptions: (state) =>
      strikeOptions(
        content,
        state,
        modsOf(state).active.map((a) => a.mod),
      ),
    canStrikeAny,
    canStrikeCard,
    previewStrike,
    canPin,
    lastWeekOfRun,
    canHold,
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
    changeOrderOffer: offerView,
    activeChangeOrders: (state) => running(state).map((r) => orderView(state, r.id, r.phase, r)),
    eligibleChangeOrders: eligibleOrders,
    replay,
  };
}
