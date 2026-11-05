// The public API of the pure rules module and all its shared types: src/ui and sim/ import
// only from here (implementation-plan.md §4). Each phase writes out the types it adds; M1
// covers the vertical slice: the lot, placement, steady/neighbor/aura effects, two sets,
// Points × Mult scoring, hands, three milestones, and run codes.
//
// Pure means no DOM, no Preact, no Math.random, no Date, and imports only from src/rules
// and src/content. tsconfig.rules.json and purity.test.ts enforce it.

// ---------------------------------------------------------------------------------------
// Ids. String-literal unions, so a typo in content is a compile error (D-038). Later phases
// extend them.

export type PieceId =
  'bedroom' | 'bathroom' | 'kitchen' | 'lKitchen' | 'diningRoom' | 'livingRoom' | 'lawn';

/** Lot features (D-049). The street runs along the bottom edge, outside the grid. */
export type FeatureId = 'street' | 'tree' | 'pond' | 'creek' | 'boulder';
/** The features that sit on tiles of the lot. */
export type TerrainId = Exclude<FeatureId, 'street'>;

export type SetId = 'jackAndJill' | 'entertainer';

export type Tag =
  | 'Quiet'
  | 'Loud'
  | 'Social'
  | 'Wet'
  | 'Sunny'
  | 'Outdoor'
  | 'Green'
  | 'Kid'
  | 'Pet'
  | 'Pretty'
  | 'Dark'
  | 'House';

/** M1's layout properties. M2 adds exterior, interior, and the regions. */
export type Property = 'indoor' | 'yard' | 'outbuilding' | 'room' | 'view' | 'viewSource';

export type Rot = 0 | 1 | 2 | 3;
export type Tier = 'core' | 'stretch' | 'later';
export type Category = 'indoor' | 'yard' | 'outbuilding';

export interface Cell {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------------------
// Content (D-038). Typed object literals in src/content; card text is generated from them.

/** Which pieces or lot features an effect looks at. */
export type Selector =
  | { piece: PieceId | readonly PieceId[] } // matches the id or `countsAs`
  | { feature: FeatureId | readonly FeatureId[] }
  | { tag: Tag }
  | { property: Property }
  | { any: readonly Selector[] }
  | { all: readonly Selector[] }
  | { not: Selector }
  | 'all';

/** M1's effect kinds (§5). M2 adds rhythm, growth, transform, and the rest. */
export type Effect =
  /** Earns `amount` every week. */
  | { kind: 'steady'; amount: number }
  /** `amount` per distinct touching neighbor that matches, up to `max` of them. Negative = penalty. */
  | { kind: 'neighbor'; match: Selector; amount: number; max?: number }
  /** Changes what each touching piece that matches earns: `pct` to its percentage, `amount` to its flat points. */
  | { kind: 'aura'; match: Selector; scope: 'adjacent'; pct?: number; amount?: number };

export interface PieceDef {
  id: PieceId;
  name: string;
  tier: Tier;
  category: Category;
  /** Shape variants (the L-Kitchen) share a type for effects and sets. */
  countsAs?: PieceId;
  givesView?: true;
  /** ASCII rows: '#' filled, '.' empty. */
  shape: readonly string[];
  tags: readonly Tag[];
  /** 10 = normal; 0 = not in the base pool. */
  drawWeight: number;
  /** D-055: 1 = plain earners, 2 = conditions and timers, 3 = build-arounds. */
  complexity: 1 | 2 | 3;
  /** Hard gate: the earliest phase (0-based) it can be drawn. */
  fromPhase: number;
  effects: readonly Effect[];
}

export interface FeatureDef {
  id: FeatureId;
  name: string;
  tier: Tier;
  tags: readonly Tag[];
  /** Can't be built on. */
  blocks: boolean;
  /** Trees: building over removes them. Boulders: a demolition (M2). */
  clear?: 'buildOver' | 'demolish';
  viewSource?: true;
  /** Orthogonally connected tiles of this feature count as one neighbor (the pond, the creek). */
  body?: true;
  /** Lot features that give nothing as neighbors (boulders). */
  inert?: true;
}

export interface SetDef {
  id: SetId;
  name: string;
  tier: Tier;
  /** How many of each piece type an instance needs (`countsAs` counts). */
  members: Partial<Record<PieceId, number>>;
  /** The members form one connected group. */
  connected: boolean;
  /** The hub touches every other member (Jack-and-Jill's Bathroom). */
  hub?: PieceId;
  /** Paid every week the set holds, like a poker hand's chips and mult. Mult is in hundredths. */
  points: number;
  mult: number;
  /** Added per level from Remodel Plans (M3b). Every set is level 1 until then. */
  level: { points: number; mult: number };
}

export type Range = readonly [min: number, max: number];

/** Lot generation (Appendix A · M1). */
export interface LotBalance {
  width: number;
  height: number;
  woodsClusters: Range;
  woodsClusterSize: Range;
  loneTrees: Range;
  /** Percent of lots with a creek. */
  creekPct: number;
  /** The creek stays at least this many rows clear of the street edge. */
  creekStreetGap: number;
  pondSize: Range;
  boulders: Range;
  sunnyRows: number;
  /** Regeneration checks. */
  minFreePct: number;
  minFreeStreetTiles: number;
  minStreetSidePct: number;
  maxAttempts: number;
}

export interface PhaseDef {
  /** D-018's construction phases. */
  name: string;
  /** The cumulative Wow needed by the end of the phase. */
  target: number;
}

export interface VerdictDef {
  name: string;
  /** The final score as a percentage of the last target. A lost run is always the first verdict. */
  minPctOfTarget: number;
}

export interface Balance {
  lot: LotBalance;
  weeksPerPhase: number;
  /** Hand-set rising targets for M1; the sim sets them from M2 (D-044). */
  phases: readonly PhaseDef[];
  handSize: number;
  /** D-055: draw-weight percentages by phase (the last row repeats), for complexity 1, 2, and 3. */
  complexityPct: readonly (readonly [number, number, number])[];
  /** Run-end verdicts by score band, lowest first (§12, The score's names). */
  verdicts: readonly VerdictDef[];
}

export interface Content {
  pieces: Readonly<Record<PieceId, PieceDef>>;
  features: Readonly<Record<FeatureId, FeatureDef>>;
  sets: Readonly<Record<SetId, SetDef>>;
  balance: Balance;
}

// ---------------------------------------------------------------------------------------
// State. Plain, JSON-serializable data. D-025 keeps the house separate from the run.

export interface Lot {
  width: number;
  height: number;
  /** Row-major, width × height: what sits on each tile. The street is outside the grid. */
  terrain: readonly (TerrainId | null)[];
  /** The sunny side: `sunnyRows` rows along this edge, except Tree tiles (used from M2). */
  sunnySide: 'top' | 'left' | 'right';
  sunnyRows: number;
  /** Which `lot/<attempt>` stream made it. */
  attempt: number;
}

export interface PlacedPiece {
  uid: number;
  defId: PieceId;
  /** The top-left cell of the rotated shape's bounding box. */
  x: number;
  y: number;
  rot: Rot;
  placedWeek: number;
}

export interface HouseState {
  lot: Lot;
  /** In placement order. */
  pieces: readonly PlacedPiece[];
  nextUid: number;
}

export type Card = { kind: 'piece'; id: PieceId };

export interface RunSetup {
  seed: string;
  mode: 'standard';
}

export interface WeekScore {
  points: number;
  /** In hundredths: 250 is ×2.5. */
  mult: number;
  total: number;
}

export interface WeekSummary extends WeekScore {
  /** Keys of the set instances held, for spotting new ones. */
  setInstances: readonly string[];
}

export interface RunState {
  setup: RunSetup;
  house: HouseState;
  /** 0-based milestone index. */
  phase: number;
  /** 1-based week within the phase. */
  slot: number;
  /** 1-based week of the run: the week being played, or the last one played once the run ends. */
  week: number;
  /** Draws so far this week (keys the RNG). */
  draws: number;
  /** D-028: one running total of Wow. */
  score: number;
  phaseStartScore: number;
  hand: readonly Card[];
  lastTally: WeekSummary | null;
  screen: 'build' | 'won' | 'lost';
}

// ---------------------------------------------------------------------------------------
// Actions, plays, and events.

export interface PlaceAction {
  t: 'place';
  from: 'hand';
  i: number;
  x: number;
  y: number;
  rot: Rot;
}
export type PassAction = { t: 'pass' };
export type Action = PlaceAction | PassAction;

/** A week's play: a placement, or nothing (a pass). */
export type Play = PlaceAction | null;

/** What caused a breakdown line, so the UI can badge it. */
export type SourceRef =
  | { kind: 'piece'; uid: number }
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

export interface BreakdownLine {
  /** Plain language: "Touching Trees or Quiet neighbors (2)". */
  label: string;
  /** `add`: flat points. `pct`: a percentage term. */
  op: 'add' | 'pct';
  value: number;
  from: readonly SourceRef[];
}

export interface PieceScore {
  uid: number;
  defId: PieceId;
  /** The flat sum, before clamping at 0. */
  points: number;
  /** The sum of percentage terms. */
  pct: number;
  earned: number;
  /** Empty from scoreOnly(). */
  lines: readonly BreakdownLine[];
}

export interface SetScore {
  set: SetId;
  /** `<setId>:<member uids>`, stable while the instance holds. */
  key: string;
  members: readonly number[];
  points: number;
  mult: number;
}

export interface Tally extends WeekScore {
  pieces: readonly PieceScore[];
  sets: readonly SetScore[];
}

export type GameEvent =
  | { t: 'handDrawn'; phase: number; slot: number; hand: readonly Card[] }
  | {
      t: 'placed';
      uid: number;
      defId: PieceId;
      x: number;
      y: number;
      rot: Rot;
      cells: readonly Cell[];
      clearedTrees: readonly Cell[];
    }
  | {
      t: 'tally';
      week: number;
      phase: number;
      slot: number;
      passed: boolean;
      tally: Tally;
      /** §12: max(1, (target − score at the phase start) ÷ weeks per phase), fixed for the phase. */
      pace: number;
      scoreBefore: number;
      score: number;
    }
  | { t: 'setCompleted'; set: SetId; key: string; members: readonly number[] }
  | { t: 'targetReached'; phase: number; target: number; score: number }
  | {
      t: 'milestone';
      phase: number;
      name: string;
      result: 'onTime' | 'failed';
      target: number;
      score: number;
    }
  | { t: 'runEnded'; result: 'won' | 'lost'; score: number; phase: number; verdict: string };

export interface PreviewLine {
  uid: number;
  defId: PieceId;
  isNew: boolean;
  before: number;
  after: number;
  /** The piece's breakdown with the play. */
  reasons: readonly BreakdownLine[];
}

export interface Preview {
  legal: boolean;
  reason?: string;
  before: WeekScore;
  after: WeekScore;
  /** The change to the week's total. */
  delta: number;
  /** Every piece whose earnings change, the new piece first. */
  lines: readonly PreviewLine[];
  /** The new piece's own breakdown, with the neighbors that help or hurt it. */
  newPiece: PieceScore | null;
  setsGained: readonly SetScore[];
  setsLost: readonly SetScore[];
  cells: readonly Cell[];
  clearedTrees: readonly Cell[];
}

export interface Legality {
  legal: boolean;
  reason?: string;
  cells: readonly Cell[];
  clearedTrees: readonly Cell[];
}

export interface ReplayResult {
  state: RunState;
  /** The index of the first action that failed; the state is the one just before it. */
  failedAt?: number;
  error?: string;
}

export interface RunCodeData {
  /** The git short SHA of the build that made it (the UI passes it in). */
  build: string;
  contentHash: string;
  setup: RunSetup;
  actions: readonly Action[];
  /** A tentative placement, so a preview bug can be reproduced. */
  pending?: PlaceAction;
}

// ---------------------------------------------------------------------------------------
// The API.

export { shapeCells, placedCells, uniqueRotations, rotateCells, parseShape } from './grid.ts';
export { isSunny, terrainAt } from './lot.ts';
