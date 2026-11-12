// UI state: the run, its action log, and what the player is pointing at. The rules decide
// everything; the store only keeps their state, asks them for previews, sends them actions,
// and hands the events to the tally director. Saves and run codes live here too.

import { batch, computed, effect, signal } from '@preact/signals';
import {
  CONTENT,
  contentHash,
  decodeRunCode,
  encodeRunCode,
  cellsToShape,
  IllegalAction,
  placedCells,
  rules,
  shapeCells,
  type Action,
  type CardType,
  type Cell,
  type DebugAction,
  type DemolishPreview,
  type EarlyOffer,
  type GameEvent,
  type InstallAction,
  type InstallGain,
  type Play,
  type RenovateAction,
  type PieceId,
  type FixtureId,
  type PlaceAction,
  type Preview,
  type Rot,
  type RunMode,
  type RunSetup,
  type RunState,
  type SellAction,
  type ToolId,
  type ToolPreview,
  type UseToolAction,
  type ClientId,
  type Contract,
  type CrewId,
  type RunCodeData,
} from '../rules/index.ts';
import { BUILD_CHANNEL, BUILD_SHA } from './build-info.ts';
import { occupancy, uidAt } from './board/geometry.ts';
import { company } from './company.ts';

export const CONTENT_HASH = contentHash(CONTENT);
const SAVE_KEY = `openhouse:${BUILD_CHANNEL}:run`;

// ---------------------------------------------------------------------------------------
// The app's screens. The title screen comes first unless a link starts a run (?run=, ?seed=,
// ?client=). Start opens the job board (M4a), which starts the run.

export const appScreen = signal<'title' | 'jobs' | 'game'>('title');

/** The job board's seed: contracts come from its `jobs/<i>` streams (outside the run code). */
export const jobBoardSeed = signal<string>('board');
const VISITED_KEY = `openhouse:${BUILD_CHANNEL}:visited`;
const FIRST_JOB_KEY = `openhouse:${BUILD_CHANNEL}:firstJob`;
const GUIDED_KEY = `openhouse:${BUILD_CHANNEL}:guided`;
/** The visited key after the ?debug panel's "First visit again": `again:<houses built then>`. */
const AGAIN = /^again:(\d+)$/;

/**
 * A first visit (D-149): no contract taken from the board and no house finished in this browser.
 * The board opens one contract, the first job, and shows the others locked. After the ?debug
 * panel's "First visit again", only a house finished since counts.
 */
export function firstVisit(): boolean {
  let visited: string | null = null;
  try {
    visited = localStorage.getItem(VISITED_KEY);
  } catch {
    // Blocked storage: the company's record still counts this visit's houses.
  }
  const built = company.value.built;
  if (visited === null) return built === 0;
  const again = AGAIN.exec(visited);
  return again !== null && built <= Number(again[1]);
}

/**
 * The first job's seed (D-149), kept in the browser while that run is the one being played: the
 * first run a browser starts, from the board or from a link, and the board's first job while it
 * is still a first visit. The guidance is UI only: its screen fills in week by week
 * (hud/first-job.ts). Its targets are the rules' own: the run starts in `firstJob` mode (D-151).
 */
export const firstJobSeed = signal<string | null>(
  (() => {
    try {
      return localStorage.getItem(FIRST_JOB_KEY);
    } catch {
      return null;
    }
  })(),
);

function setFirstJob(seed: string | null): void {
  if (firstJobSeed.value === seed) return;
  firstJobSeed.value = seed;
  try {
    if (seed === null) localStorage.removeItem(FIRST_JOB_KEY);
    else localStorage.setItem(FIRST_JOB_KEY, seed);
    // A first job starting or ending: this browser has had one. Kept at its end too, for a first
    // job saved before this key was.
    localStorage.setItem(GUIDED_KEY, '1');
  } catch {
    // A private window: the first job is guided for this visit only.
  }
}

/**
 * Whether this browser has had a first job (D-149), from the board or a link, still going or
 * over. A link, a replay or a new run after a crash is guided only before it has.
 */
function guidedBefore(): boolean {
  if (firstJobSeed.value !== null) return true;
  try {
    return localStorage.getItem(GUIDED_KEY) !== null;
  } catch {
    return false;
  }
}

/** Opens the job board with a fresh set of contracts. */
export function openJobBoard(): void {
  notice.value = null;
  jobBoardSeed.value = randomSeed();
  appScreen.value = 'jobs';
}

/** Takes a contract from the board with a crew: its seed and client start the run. */
export function takeContract(contract: Contract, crewId: CrewId = 'generalContractor'): void {
  // The first contract a browser takes is its first job; from then on the board is open. The
  // first job has its gentler targets (D-151).
  const first = firstVisit();
  if (first) setFirstJob(contract.seed);
  try {
    localStorage.setItem(VISITED_KEY, '1');
  } catch {
    // A private window: the board just opens with the first job again next time.
  }
  notice.value = null;
  startRun({
    seed: contract.seed,
    clientId: contract.clientId,
    crewId,
    mode: first ? 'firstJob' : 'standard',
  });
  canContinue.value = false;
  appScreen.value = 'game';
}

/**
 * The ?debug panel's "First visit again": forgets that this browser has started a run, so the
 * board opens with the first job, that run's screen fills in again, and so does a link's until a
 * first job has run. The houses already in the record don't count against it; one finished from
 * now on ends it, as it would a new browser's. The hints are Settings' to reset.
 */
export function forgetFirstVisit(): void {
  setFirstJob(null);
  try {
    localStorage.setItem(VISITED_KEY, `again:${company.value.built}`);
    localStorage.removeItem(GUIDED_KEY);
  } catch {
    // Nothing to forget.
  }
}
/** The ?debug panel (implementation-plan.md §7, M2 · Debug tools). */
export const debugEnabled = (() => {
  try {
    return new URLSearchParams(location.search).has('debug');
  } catch {
    return false;
  }
})();
/** A run in progress was loaded from the save, so the title screen can offer Continue. */
export const canContinue = signal(false);

// ---------------------------------------------------------------------------------------
// The run.

export const run = signal<RunState>(
  rules.newRun({
    seed: 'placeholder',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  }),
);
export const log = signal<readonly Action[]>([]);

/** Whether the run being played is this browser's first job, still in progress (D-149). */
export const firstJob = computed(
  () => firstJobSeed.value !== null && run.value.setup.seed === firstJobSeed.value && inProgress(),
);
// The first job is over once its run ends, so the same lot played again later is an ordinary run.
effect(() => {
  const s = run.value;
  if (firstJobSeed.value !== s.setup.seed) return;
  if (s.screen === 'won' || s.screen === 'lost') setFirstJob(null);
});

/**
 * A one-line note for the player, such as "The game updated, so this is a fresh run." `oldCode`
 * is a run that was put aside, for the note's Copy button; `goBack` says the note can also
 * offer to go back to it (restorePreviousRun).
 */
export const notice = signal<{ text: string; oldCode?: string; goBack?: boolean } | null>(null);
/** Set when something broke: the error boundary shows it with the run code. */
export const crash = signal<{ message: string; stack?: string; action?: Action } | null>(null);

// ---------------------------------------------------------------------------------------
// What the player is doing this week.

/** What a click on the lot does: build the selected card, or demolish (a free action). */
export const tool = signal<'build' | 'demolish'>('build');
/** In demolish mode, the tile clicked once: a second click (or Demolish) confirms. */
export const demolishArmed = signal<Cell | null>(null);

/** Where the selected item comes from: a hand card, a reserve piece, or a supply. */
export type Source = 'hand' | 'reserve' | 'supplies';
export const source = signal<Source>('hand');
/** The item being placed or installed, by its index in `source`'s list, if any. */
export const selected = signal<number | null>(null);
export const rotation = signal<Rot>(0);
/** The lot cell under the pointer. */
export const hoverCell = signal<Cell | null>(null);
/**
 * A placement (or a hand install, or a Renovation) waiting for End week (D-036): a tap places
 * tentatively. A pack (D-106) grows here a tile per click.
 */
export const tentative = signal<PlaceAction | InstallAction | RenovateAction | null>(null);
/** A supply install's first click: a second click on the same piece installs it (D-073). */
export const installArmed = signal<number | null>(null);
/** The Moving Truck: the piece picked up to move, by uid. */
export const movingUid = signal<number | null>(null);
/** A tool's first click on the lot (a Copy Machine target, a Moving Truck spot): a second confirms. */
export const toolArmed = signal<UseToolAction | null>(null);
/** What the inspect panel shows when nothing is being placed. */
export const inspected = signal<Inspected | null>(null);

/**
 * A placed piece held in Inspect (playtest 4: Inspect followed the pointer, so a long note
 * couldn't be scrolled). With nothing picked, a click on a piece holds Inspect on it while the
 * pointer goes elsewhere. A second click on it, a click on open ground or the street, Esc, the
 * panel's ✕, picking something, demolishing, a new week, another screen, or the piece going
 * lets go. UI only.
 */
export const heldPiece = signal<number | null>(null);
effect(() => {
  const uid = heldPiece.value;
  if (uid === null) return;
  const s = run.value;
  const gone = !s.house.pieces.some((p) => p.uid === uid);
  if (gone || s.screen !== 'build' || selected.value !== null || tool.value === 'demolish') {
    heldPiece.value = null;
  }
});

/**
 * A house on the street held in Inspect (D-156), by its key (board/neighbors.ts): a click on one
 * holds it there, with its Play this lot again, while the pointer goes to the panel. Let go as a
 * held piece is, except that the end screen keeps it: a finished run is a good time to pick an
 * old lot to play again. UI only.
 */
export const heldNeighbor = signal<string | null>(null);
effect(() => {
  if (heldNeighbor.value !== null && (selected.value !== null || tool.value === 'demolish')) {
    heldNeighbor.value = null;
  }
});

export type Inspected =
  | { kind: 'piece'; uid: number }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'street'; x: number }
  | { kind: 'card'; i: number }
  | { kind: 'reserve'; i: number }
  | { kind: 'supply'; i: number }
  | { kind: 'blueprint'; i: number }
  | { kind: 'upgrade'; i: number }
  | { kind: 'offer'; i: number }
  | { kind: 'neighbor'; key: string };

/** What's selected: a piece to place or a fixture to install, and where it's from. */
export const selection = computed<
  | { kind: 'piece'; id: PieceId; from: 'hand' | 'reserve'; i: number }
  | { kind: 'fixture'; id: FixtureId; from: 'hand' | 'supplies'; i: number }
  | { kind: 'tool'; id: ToolId; from: 'supplies'; i: number }
  | null
>(() => {
  const i = selected.value;
  const s = run.value;
  if (i === null || s.screen !== 'build') return null;
  if (source.value === 'reserve') {
    const r = s.reserve[i];
    return r ? { kind: 'piece', id: r.id, from: 'reserve', i } : null;
  }
  if (source.value === 'supplies') {
    const sup = s.supplies[i];
    if (!sup) return null;
    return sup.kind === 'fixture'
      ? { kind: 'fixture', id: sup.id, from: 'supplies', i }
      : { kind: 'tool', id: sup.id, from: 'supplies', i };
  }
  const card = s.hand[i];
  if (!card) return null;
  return card.kind === 'piece'
    ? { kind: 'piece', id: card.id, from: 'hand', i }
    : { kind: 'fixture', id: card.id, from: 'hand', i };
});

/** The piece on a lot cell, or 0. */
export function pieceAt(state: RunState, cell: Cell): number {
  return uidAt(occupancy(state.house), cell.x, cell.y);
}

/** The rooms the selected card can renovate now (M4a): its type is at the checklist's limit. */
export const renovateUids = computed<readonly number[]>(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== 'piece' || run.value.screen !== 'build') return [];
  return rules.renovateTargets(run.value, sel.from, sel.i);
});

/**
 * D-107: while a fixture is selected (hand or supplies), every legal host with what installing
 * it there does to this week's Wow, from the rules' installGains: once per selection (and per
 * state), never per pointer move.
 */
export const installGains = computed<readonly InstallGain[]>(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== 'fixture') return [];
  return rules.installGains(run.value, sel.from, sel.i);
});

/**
 * The types the checklist caps for the selected card (a Bedroom card: Bedrooms), or null. A
 * card over a room of these types renovates it, or says why it can't yet. Not a member's card
 * (M4b, D-103): it counts as a Bedroom but can't renovate, so it only ever places.
 */
const cappedTypes = computed<readonly PieceId[] | null>(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== 'piece') return null;
  const def = CONTENT.pieces[sel.id];
  if (def.category !== 'indoor' || def.member) return null;
  const root = def.countsAs ?? def.id;
  return rules.limits(run.value).find((l) => l.types.includes(root))?.types ?? null;
});

/** A pack's tiles (D-106), as lot cells. */
export function packCells(play: PlaceAction): Cell[] {
  return play.shape ? placedCells(play.shape, play.x, play.y, 0) : [];
}

/** A pack placement of these tiles (any order). */
export function packPlay(from: 'hand' | 'reserve', i: number, cells: readonly Cell[]): PlaceAction {
  return { t: 'place', from, i, rot: 0, ...cellsToShape(cells) };
}

/**
 * The play under the cursor (a placement centered on it, or an install in the piece under it),
 * or the tentative one. A pack being clicked out is the tentative itself, the tiles End week
 * would build: the tile under the pointer is the board's alone (packNext).
 */
export const activePlay = computed<Play>(() => {
  const pending = tentative.value;
  if (pending) return pending;
  const sel = selection.value;
  const cell = hoverCell.value;
  if (!sel || !cell || sel.kind === 'tool') return null;
  if (sel.kind === 'fixture') {
    const uid = installArmed.value ?? pieceAt(run.value, cell);
    return { t: 'install', from: sel.from, i: sel.i, uid };
  }
  const def = CONTENT.pieces[sel.id];
  // The card centered on the pointer; a pack starts with the tile under it.
  let place: PlaceAction;
  let covers = true;
  if (def.pack) {
    place = packPlay(sel.from, sel.i, [cell]);
  } else {
    const cells = shapeCells(def.shape, rotation.value);
    const ax = Math.floor(Math.max(...cells.map((c) => c.x)) / 2);
    const ay = Math.floor(Math.max(...cells.map((c) => c.y)) / 2);
    place = {
      t: 'place',
      from: sel.from,
      i: sel.i,
      x: cell.x - ax,
      y: cell.y - ay,
      rot: rotation.value,
    };
    covers = cells.some((c) => c.x === ax && c.y === ay);
  }
  // Over a room the checklist caps for this card: renovate it (or hear why not yet). Not when
  // the card leaves the pointer's cell empty (an L's notch) and fits there: that places it
  // beside the room.
  const under = covers || !rules.checkPlay(run.value, place).legal ? pieceAt(run.value, cell) : 0;
  if (under && renovateUids.value.includes(under)) {
    return { t: 'renovate', from: sel.from, i: sel.i, uid: under };
  }
  const types = cappedTypes.value;
  if (under && types) {
    const t = CONTENT.pieces[run.value.house.pieces.find((p) => p.uid === under)!.defId];
    if (types.includes(t.countsAs ?? t.id)) {
      return { t: 'renovate', from: sel.from, i: sel.i, uid: under };
    }
  }
  return place;
});

/**
 * What a click on the tile under the pointer would do to a pack being clicked out (D-106), for
 * the board only: take a tile of the pack off, or add one, if the rules allow the pack that
 * leaves (and if not, why). `tiles` is how many the pack would have after the click.
 */
export interface PackNext {
  kind: 'add' | 'remove';
  cell: Cell;
  legal: boolean;
  reason?: string;
  tiles: number;
  maxTiles: number;
}

export const packNext = computed<PackNext | null>(() => {
  const pending = tentative.value;
  const sel = selection.value;
  const cell = hoverCell.value;
  if (tool.value !== 'build' || !cell || pending?.t !== 'place' || !pending.shape) return null;
  const pack = sel?.kind === 'piece' ? CONTENT.pieces[sel.id].pack : undefined;
  if (!pack) return null;
  const tiles = packCells(pending);
  const had = tiles.some((c) => c.x === cell.x && c.y === cell.y);
  const next = had ? tiles.filter((c) => c.x !== cell.x || c.y !== cell.y) : [...tiles, cell];
  // Taking the last tile off just clears the pack.
  const check: { legal: boolean; reason?: string } =
    next.length === 0
      ? { legal: true }
      : rules.checkPlay(run.value, packPlay(pending.from, pending.i, next));
  return {
    kind: had ? 'remove' : 'add',
    cell,
    legal: check.legal,
    reason: check.reason,
    tiles: next.length,
    maxTiles: pack.maxTiles,
  };
});

export const preview = computed<Preview | null>(() => {
  const play = activePlay.value;
  return play && run.value.screen === 'build' ? rules.preview(run.value, play) : null;
});

/** What demolishing the hovered (or armed) tile would do, in demolish mode. */
export const demolishPreview = computed<DemolishPreview | null>(() => {
  if (tool.value !== 'demolish' || run.value.screen !== 'build') return null;
  const cell = demolishArmed.value ?? hoverCell.value;
  return cell ? rules.previewDemolish(run.value, cell.x, cell.y) : null;
});

/** Early completion: whether it's offered now, and what it would pay (D-040). */
export const earlyOffer = computed<EarlyOffer>(() => rules.canCompleteEarly(run.value));

/**
 * The forecast line (§4): the score plus this week's total, with the placement being looked at
 * if it's legal, for each week left in the phase. A rough guide, not a promise.
 */
export const forecast = computed(() => {
  const p = preview.value;
  return rules.forecast(run.value, p?.legal ? activePlay.value : null);
});

/** What the house earns per week as it stands: the corner digits and the inspect panel. */
export const currentTally = computed(() => rules.currentTally(run.value));

/** The phase's pace (§12), the yardstick for the glow and the big-week tier. */
export const pace = computed(() => rules.pace(run.value));

/**
 * The tool use under the cursor: the selected tool, with the piece under the pointer for the
 * Copy Machine, or the picked-up piece at the pointer's spot for the Moving Truck.
 */
export const toolAction = computed<UseToolAction | null>(() => {
  const sel = selection.value;
  if (!sel || sel.kind !== 'tool') return null;
  if (toolArmed.value) return toolArmed.value;
  const use = CONTENT.tools[sel.id].use.kind;
  const cell = hoverCell.value;
  if (use === 'copy')
    return cell ? { t: 'useTool', i: sel.i, target: { uid: pieceAt(run.value, cell) } } : null;
  if (use === 'move') {
    const uid = movingUid.value;
    if (uid === null || !cell) return null;
    const piece = run.value.house.pieces.find((p) => p.uid === uid);
    if (!piece) return null;
    const cells = shapeCells(piece.shape ?? CONTENT.pieces[piece.defId].shape, rotation.value);
    const w = Math.max(...cells.map((c) => c.x)) + 1;
    const h = Math.max(...cells.map((c) => c.y)) + 1;
    return {
      t: 'useTool',
      i: sel.i,
      target: {
        uid,
        x: cell.x - Math.floor((w - 1) / 2),
        y: cell.y - Math.floor((h - 1) / 2),
        rot: rotation.value,
      },
    };
  }
  return { t: 'useTool', i: sel.i };
});

export const toolPreview = computed<ToolPreview | null>(() => {
  const a = toolAction.value;
  return a && run.value.screen === 'build' ? rules.previewTool(run.value, a) : null;
});

/**
 * Which hand cards can renovate a room now (D-102): they show a Renovate chip (playtest 4:
 * nothing on a card said it could, so the option went unseen).
 */
export const cardsRenovate = computed(() =>
  run.value.hand.map((_, i) => rules.renovateTargets(run.value, 'hand', i).length > 0),
);

/**
 * Which cards have somewhere to go, for greying out the rest: a spot, or a room to renovate
 * (a renovate-only card still doesn't count for the free redraw, D-070).
 */
export const cardsFit = computed(() =>
  run.value.hand.map((_, i) => rules.cardFits(run.value, i) || !!cardsRenovate.value[i]),
);
/** The same for reserve pieces and supplies. */
export const reserveFit = computed(() =>
  run.value.reserve.map(
    (_, i) =>
      rules.reserveFits(run.value, i) || rules.renovateTargets(run.value, 'reserve', i).length > 0,
  ),
);
export const suppliesFit = computed(() =>
  run.value.supplies.map((sup, i) =>
    sup.kind === 'fixture'
      ? rules.installHosts(run.value, 'supplies', i).length > 0
      : rules.canUseTool(run.value, { t: 'useTool', i }).ok ||
        ['copy', 'move'].includes(CONTENT.tools[sup.id].use.kind),
  ),
);

// ---------------------------------------------------------------------------------------
// Run codes and saves (implementation-plan.md §6).

export function runCode(withPending = true): string {
  const pending = withPending ? tentative.value : null;
  return encodeRunCode({
    build: BUILD_SHA,
    contentHash: CONTENT_HASH,
    setup: run.value.setup,
    actions: log.value,
    ...(pending ? { pending } : {}),
  });
}

/**
 * The run code for a crash report: the action that crashed goes on the end, so replaying the
 * code fails at that step with the same error; otherwise the placement being looked at.
 */
export function crashRunCode(): string {
  const c = crash.value;
  const pending = tentative.value ?? activePlay.value;
  return encodeRunCode({
    build: BUILD_SHA,
    contentHash: CONTENT_HASH,
    setup: run.value.setup,
    actions: c?.action ? [...log.value, c.action] : log.value,
    ...(!c?.action && pending ? { pending } : {}),
  });
}

const PREVIOUS_KEY = `openhouse:${BUILD_CHANNEL}:previous`;

/**
 * What a saved run looked like when it was saved, kept beside its code: a save from another
 * build carries on only if this build replays it to the same week, Wow, budget and pieces
 * (D-068). A rules change that plays the same actions out differently shows in one of them.
 */
interface SaveCheck {
  week: number;
  score: number;
  budget: number;
  pieces: number;
}

function saveCheck(s: RunState): SaveCheck {
  return { week: s.week, score: s.score, budget: s.budget, pieces: s.house.pieces.length };
}

function readSave(): { build?: unknown; code?: unknown; check?: unknown } | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

/** Whether a saved run had already ended (won or lost), as far as this build replays it. */
function runOver(code: string): boolean {
  const decoded = decodeRunCode(code);
  if (!decoded.ok) return false;
  try {
    const { state, failedAt } = rules.replay(decoded.data.setup, decoded.data.actions);
    return failedAt === undefined && !inProgress(state);
  } catch {
    // A setup this build can't start: as good as in progress, so its code is kept.
    return false;
  }
}

/**
 * Whether a save from another build can carry on in this one (D-068): its content is this
 * build's, and this build's rules replay every action, back to the run as it was saved. A save
 * from before the check was kept beside the code (2026-11-11) has none: the content and a clean
 * replay have to do, unless it used a reroll.
 */
function carriesOver(data: RunCodeData, check: unknown): boolean {
  if (data.contentHash !== CONTENT_HASH) return false;
  // A reroll deals other cards since D-132's note of 2026-11-11, so a save that used one can
  // replay cleanly to a house the player never built, and only a check would catch it. Without
  // one, the run starts fresh (the user's call, D-068's note of the same day).
  if (check === undefined && data.actions.some((a) => a.t === 'reroll')) return false;
  let replayed: ReturnType<typeof rules.replay>;
  try {
    replayed = rules.replay(data.setup, data.actions);
  } catch {
    return false;
  }
  if (replayed.failedAt !== undefined) return false;
  if (check === undefined) return true;
  if (!check || typeof check !== 'object') return false;
  const now = saveCheck(replayed.state);
  const was = check as Record<string, unknown>;
  return (Object.keys(now) as (keyof SaveCheck)[]).every((k) => was[k] === now[k]);
}

/** Whether this build made a run code: only then can a note offer to go back to the run. */
function fromThisBuild(code: string): boolean {
  const decoded = decodeRunCode(code);
  return decoded.ok && decoded.data.build === BUILD_SHA;
}

/**
 * Before a link or a game update replaces the saved run, keep its code (in the browser and in
 * the note), so a run in progress is never silently lost. Returns the code if it had any weeks
 * and wasn't over: a finished run's house is already in the company's record, and nothing was
 * in progress.
 */
function keepPreviousRun(saved: { code?: unknown } | null): string | undefined {
  if (typeof saved?.code !== 'string') return undefined;
  const decoded = decodeRunCode(saved.code);
  if (decoded.ok && decoded.data.actions.length === 0) return undefined;
  if (runOver(saved.code)) return undefined;
  try {
    localStorage.setItem(PREVIOUS_KEY, saved.code);
  } catch {
    // Best effort.
  }
  return saved.code;
}

/** The note about a run that can't be saved, said once a visit. */
let unsavedSaid = false;

function save(): void {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ build: BUILD_SHA, code: runCode(false), check: saveCheck(run.value) }),
    );
  } catch {
    // Best effort: itch.io's iframe and private windows can lose storage. Say so once, in a
    // run (the first save that fails there), so a closed tab doesn't take a run the player
    // thought was kept: said on the title or as a run loads, the next screen's notes wiped it.
    if (!unsavedSaid && appScreen.value === 'game') {
      unsavedSaid = true;
      addNote(UNSAVED_NOTE);
    }
  }
}

export const UNSAVED_NOTE =
  'This browser isn’t keeping this site’s data, so your run lasts until you close the tab.';

/** A short, readable seed for a new run. */
export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function resetWeek(): void {
  heldPiece.value = null;
  heldNeighbor.value = null;
  selected.value = null;
  source.value = 'hand';
  tentative.value = null;
  installArmed.value = null;
  movingUid.value = null;
  toolArmed.value = null;
  rotation.value = 0;
  demolishArmed.value = null;
  tool.value = 'build';
}

/** Picks an item to place or install (or puts it back if it's already picked). */
export function selectItem(from: Source, i: number): void {
  const same = selected.value === i && source.value === from;
  batch(() => {
    tentative.value = null;
    installArmed.value = null;
    movingUid.value = null;
    toolArmed.value = null;
    source.value = from;
    selected.value = same ? null : i;
  });
}

/** Listeners for each action's events: the tally director subscribes. */
type EventListener = (events: GameEvent[], before: RunState, after: RunState) => void;
const listeners = new Set<EventListener>();
export function onEvents(listener: EventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Listeners for a run being replaced (a new run or a load), so effects can reset. */
const resetListeners = new Set<() => void>();
export function onRunReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function startRun(
  setup: RunSetup,
  actions: readonly Action[] = [],
): { failedAt?: number; error?: string } {
  let result: ReturnType<typeof rules.replay>;
  try {
    result = rules.replay(setup, actions);
  } catch (e) {
    // A setup this build can't start (an unknown crew): a fresh run instead.
    result = rules.replay(
      { seed: randomSeed(), clientId: 'hendersons', crewId: 'generalContractor', mode: 'standard' },
      [],
    );
    actions = [];
    notice.value = { text: `That run couldn't start: ${e instanceof Error ? e.message : e}` };
  }
  batch(() => {
    run.value = result.state;
    log.value = result.failedAt === undefined ? actions : actions.slice(0, result.failedAt);
    resetWeek();
    inspected.value = null;
    // Another run takes the first job's place (D-149): the first job is behind this browser.
    if (firstJobSeed.value !== null && firstJobSeed.value !== result.state.setup.seed) {
      setFirstJob(null);
    }
  });
  resetListeners.forEach((l) => l());
  save();
  return { failedAt: result.failedAt, error: result.error };
}

/**
 * Starts a run at once, without the job board (a ?seed=, ?client=, or ?crew= link, or a lot
 * played again). `mode` keeps a first job's gentler targets for its own retry (D-151).
 */
export function newRun(
  seed = randomSeed(),
  clientId: ClientId = 'hendersons',
  crewId: CrewId = 'generalContractor',
  mode: RunMode = 'standard',
): void {
  notice.value = null;
  // A friend's link is a first contact too (D-149): its screen fills in as the first job's does,
  // once. A browser that has had a first job, from a link or the board, isn't guided again by a
  // link, a Portfolio replay or a new run after a crash. The board stays as a first visit finds
  // it, so Start still opens with the first job until a contract is taken or a house finished.
  // A guided run is the browser's first job, with its gentler targets (D-151). So is a run on
  // the first job's own lot while that job is going (the same link opened twice, or a friend's
  // first-job result after the board's): startRun keeps it the first job, guided.
  const guided = firstVisit() && !guidedBefore();
  if (guided) setFirstJob(seed);
  const first = guided || firstJobSeed.value === seed;
  startRun({ seed, clientId, crewId, mode: first ? 'firstJob' : mode });
  canContinue.value = false;
  appScreen.value = 'game';
}

/**
 * The crash screen's "Start a new run" (ErrorBoundary.tsx): the run that broke is put aside
 * first, as a link does, so its code is kept and the note can go back to it.
 */
export function newRunAfterCrash(): void {
  const previous = keepPreviousRun(readSave());
  crash.value = null;
  newRun();
  if (previous) addPutAsideNote(previous);
}

/** Back to the run that was loaded from the save. */
export function continueRun(): void {
  appScreen.value = 'game';
}

export function goToTitle(): void {
  resetWeek();
  canContinue.value = inProgress() && log.value.length > 0;
  appScreen.value = 'title';
}

/**
 * A run that hasn't ended: building, in the shop between milestones, or (M4b) with a change
 * order waiting for its answer.
 */
export function inProgress(state: RunState = run.value): boolean {
  return state.screen === 'build' || state.screen === 'shop' || state.screen === 'changeOrder';
}

/** Sends an action to the rules. Illegal actions are a bug in the UI, not a crash. */
export function dispatch(action: Action, opts: { keepWeek?: boolean } = {}): boolean {
  const before = run.value;
  let result: ReturnType<typeof rules.apply>;
  try {
    result = rules.apply(before, action);
  } catch (e) {
    if (e instanceof IllegalAction) {
      notice.value = { text: e.reason };
      return false;
    }
    crash.value = {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      action,
    };
    return false;
  }
  batch(() => {
    run.value = result.state;
    log.value = [...log.value, action];
    if (opts.keepWeek) {
      // A free action keeps the card being placed, unless the list it came from changed: a
      // reroll redraws the whole hand (D-132).
      const changed =
        action.t === 'reroll' ||
        action.t === 'debug' ||
        action.t === 'sell' ||
        action.t === 'useTool' ||
        (action.t === 'install' && action.from === 'supplies');
      if (changed) {
        selected.value = null;
        source.value = 'hand';
        tentative.value = null;
      } else if (tentative.value && !rules.checkPlay(result.state, tentative.value).legal) {
        tentative.value = null;
      }
      installArmed.value = null;
      movingUid.value = null;
      toolArmed.value = null;
      demolishArmed.value = null;
    } else {
      resetWeek();
    }
  });
  save();
  listeners.forEach((l) => l(result.events, before, result.state));
  return true;
}

// Free actions: they don't end the week.

/** Redraws the whole hand, both rows (D-132). */
export function reroll(): boolean {
  return dispatch({ t: 'reroll' }, { keepWeek: true });
}

export function demolishAt(x: number, y: number): boolean {
  const ok = dispatch({ t: 'demolish', x, y }, { keepWeek: true });
  if (ok) tool.value = 'build';
  return ok;
}

/** Completes the milestone now; the rest of the phase fast-forwards (D-040). */
export function completeEarly(): boolean {
  return dispatch({ t: 'completeEarly' });
}

export function setAutoComplete(on: boolean): boolean {
  return dispatch({ t: 'setAutoComplete', on }, { keepWeek: true });
}

/** Installs a fixture from the supplies: a free action, so the week goes on (D-050). */
export function installSupply(i: number, uid: number): boolean {
  return dispatch({ t: 'install', from: 'supplies', i, uid }, { keepWeek: true });
}

/** Sells a blueprint or a supply for half its price, on the build or shop screen. */
export function sell(from: SellAction['from'], i: number): boolean {
  const ok = dispatch({ t: 'sell', from, i }, { keepWeek: true });
  if (ok && inspected.value && inspected.value.kind !== 'piece') inspected.value = null;
  return ok;
}

/** Uses a supply tool: a free action, so the week goes on. */
export function useToolNow(action: UseToolAction): boolean {
  return dispatch(action, { keepWeek: true });
}

/** Keeps an option from the open crate, or (−1) sets the crate aside. */
export function pickOption(i: number): boolean {
  return dispatch({ t: 'pick', i });
}

// The shop (D-051).

export function buy(i: number, strike?: CardType): boolean {
  return dispatch(strike ? { t: 'buy', i, strike } : { t: 'buy', i });
}

export function refreshShop(): boolean {
  return dispatch({ t: 'refreshShop' });
}

export function leaveShop(): boolean {
  return dispatch({ t: 'leaveShop' });
}

/**
 * M4b, D-144: picks one of the change orders waiting on their screen (the offer's `i`-th).
 * Then the shop opens, or a forced offer goes back to its week.
 */
export function answerChangeOrder(i: number): boolean {
  return dispatch({ t: 'answerChangeOrder', i });
}

/** The ?debug panel's cheats. They're actions, so the run code still replays. */
export function debugAction(action: DebugAction): boolean {
  return dispatch(action, { keepWeek: true });
}

/** End week: commit the tentative placement, or pass. */
export function endWeek(): void {
  dispatch(tentative.value ?? { t: 'pass' });
}

/**
 * On page load: a ?run= code first (a bug report), then the saved run if it still replays and
 * is from this build, or from another build with the same content that replays it to the same
 * run (D-068), otherwise a fresh run with a note. Loading never blocks or crashes.
 */
export function loadInitialRun(): void {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('run');
  const seedParam = params.get('seed');
  // ?client= and ?crew= (debug hooks, M4a and M4b): start with this client and crew, on ?seed=
  // or a random lot.
  const clientParam = params.get('client');
  const clientId =
    clientParam !== null && Object.hasOwn(CONTENT.clients, clientParam)
      ? (clientParam as ClientId)
      : null;
  const crewParam = params.get('crew');
  const crewId =
    crewParam !== null && Object.hasOwn(CONTENT.crews, crewParam) ? (crewParam as CrewId) : null;
  if (fromUrl !== null || seedParam !== null || clientParam !== null || crewParam !== null) {
    // Drop them from the address bar, so a reload resumes the saved run instead of starting
    // this one over.
    params.delete('run');
    params.delete('seed');
    params.delete('client');
    params.delete('crew');
    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
    );
  }
  const saved = readSave();
  let linkError: string | undefined;
  if (fromUrl) {
    const previous = keepPreviousRun(saved);
    if (loadRunCode(fromUrl)) {
      if (previous) addPutAsideNote(previous);
      appScreen.value = 'game';
      return;
    }
    // The link couldn't be read: say why once the fallback run has loaded.
    linkError = notice.value?.text;
    notice.value = null;
  }
  // A link that names a client or crew the game doesn't have still starts a run, with a note
  // that says so: it used to land on the title with no word of what happened to the link.
  if (seedParam || clientParam || crewParam) {
    const previous = keepPreviousRun(saved);
    newRun(seedParam || randomSeed(), clientId ?? 'hendersons', crewId ?? 'generalContractor');
    // Say what the link opened (D-135): whose house, with which crew.
    addNote(linkNote(run.value.setup, !!seedParam));
    if (linkError) addNote(linkError);
    if (previous) addPutAsideNote(previous);
    if (clientParam && !clientId) {
      addNote(`There's no client "${clientParam}": this run is for the Hendersons.`);
    }
    if (crewParam && !crewId) {
      addNote(`There's no crew "${crewParam}": this run has the General Contractor.`);
    }
    return;
  }
  if (saved && typeof saved.code === 'string') {
    const decoded = decodeRunCode(saved.code);
    // A save from this build, or from another one that plays it out the same (D-068).
    const sameBuild = saved.build === BUILD_SHA;
    if (decoded.ok && (sameBuild || carriesOver(decoded.data, saved.check))) {
      const { failedAt } = startRun(decoded.data.setup, decoded.data.actions);
      if (failedAt === undefined) {
        // The title screen offers Continue for a run in progress.
        canContinue.value = inProgress() && log.value.length > 0;
        appScreen.value = 'title';
        if (!sameBuild && canContinue.value) {
          addNote('The game updated, and your run carried over.');
        }
        if (linkError) addNote(linkError);
        return;
      }
    }
    const previous = keepPreviousRun(saved);
    startRun({
      seed: randomSeed(),
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    // A run that was already over had nothing left to continue: no note for it.
    if (previous || !runOver(saved.code)) {
      addNote('The game updated, so your last run couldn’t continue.', previous);
    }
    if (linkError) addNote(linkError);
    appScreen.value = 'title';
    return;
  }
  startRun({
    seed: randomSeed(),
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  if (linkError) addNote(linkError);
  appScreen.value = 'title';
}

/**
 * What a ?seed=, ?client= or ?crew= link opened, by the content's names: "A shared lot: you’re
 * building for the Hendersons with the General Contractor." A link without a seed starts a
 * random lot.
 */
function linkNote(setup: RunSetup, shared: boolean): string {
  const client = CONTENT.clients[setup.clientId].name.replace(/^The\s/, 'the ');
  const crew = CONTENT.crews[setup.crewId].name;
  return `${shared ? 'A shared lot' : 'A new lot'}: you’re building for ${client} with the ${crew}.`;
}

/** Adds a sentence to the note, keeping any old run code it already offers. */
function addNote(text: string, oldCode?: string): void {
  const current = notice.value;
  // The way back goes with the code it loads: a new code drops the old one's.
  const goBack = oldCode === undefined && current?.goBack;
  notice.value = {
    text: current ? `${current.text} ${text}` : text,
    oldCode: oldCode ?? current?.oldCode,
    ...(goBack ? { goBack } : {}),
  };
}

/**
 * The note for a run in progress that a link (or a new run after a crash) took the place of. A
 * run from this build can come back (restorePreviousRun); one from an older build may stop
 * replaying, so its note only offers the code.
 */
function addPutAsideNote(code: string, text = 'Your run in progress was put aside.'): void {
  addNote(text, code);
  if (notice.value && fromThisBuild(code)) notice.value = { ...notice.value, goBack: true };
}

/**
 * The note's "Go back to it": loads the run that was put aside, and puts the run being left
 * aside in turn (if it has any weeks), so the same button swaps them back.
 */
export function restorePreviousRun(code: string): boolean {
  const decoded = decodeRunCode(code);
  if (!decoded.ok) {
    notice.value = { text: decoded.error };
    return false;
  }
  notice.value = null;
  const leaving = keepPreviousRun(readSave());
  const { failedAt, error } = startRun(decoded.data.setup, decoded.data.actions);
  appScreen.value = 'game';
  if (failedAt !== undefined) {
    addNote(`Your run stopped replaying at action ${failedAt + 1}: ${error}`);
  } else if (!notice.value) {
    // (startRun leaves its own note when a run can't start at all.)
    addNote('You’re back in your run.');
  }
  if (leaving) addPutAsideNote(leaving, 'The other run was put aside.');
  return true;
}

/** Loads a pasted run code. Returns false (with a note) if it can't be read at all. */
export function loadRunCode(code: string): boolean {
  const decoded = decodeRunCode(code);
  if (!decoded.ok) {
    notice.value = { text: decoded.error };
    return false;
  }
  const { data } = decoded;
  const { failedAt, error } = startRun(data.setup, data.actions);
  const notes: string[] = [];
  if (data.build !== BUILD_SHA)
    notes.push(`This run code is from build ${data.build}; this is ${BUILD_SHA}.`);
  if (data.contentHash !== CONTENT_HASH) notes.push('The content has changed since it was made.');
  if (failedAt !== undefined)
    notes.push(`It stopped replaying at action ${failedAt + 1}: ${error}`);
  else notes.push(`Replayed ${data.actions.length} actions.`);
  const pending = data.pending;
  if (pending?.t === 'place' && pending.from === 'hand' && failedAt === undefined) {
    // Show the placement the report was looking at.
    batch(() => {
      selected.value = pending.i;
      rotation.value = pending.rot;
      tentative.value = pending;
    });
  }
  notice.value = { text: notes.join(' ') };
  return true;
}
