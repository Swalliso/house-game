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
  type RunSetup,
  type RunState,
  type SellAction,
  type ToolId,
  type ToolPreview,
  type UseToolAction,
  type ClientId,
  type Contract,
  type CrewId,
} from '../rules/index.ts';
import { BUILD_CHANNEL, BUILD_SHA } from './build-info.ts';
import { isIndoor, occupancy, uidAt } from './board/geometry.ts';
import { roofed } from './fx/moments.ts';

export const CONTENT_HASH = contentHash(CONTENT);
const SAVE_KEY = `openhouse:${BUILD_CHANNEL}:run`;

// ---------------------------------------------------------------------------------------
// The app's screens. The title screen comes first unless a link starts a run (?run=, ?seed=,
// ?client=). Start opens the job board (M4a), which starts the run.

export const appScreen = signal<'title' | 'jobs' | 'game'>('title');

/** The job board's seed: contracts come from its `jobs/<i>` streams (outside the run code). */
export const jobBoardSeed = signal<string>('board');
const VISITED_KEY = `openhouse:${BUILD_CHANNEL}:visited`;

/** A first visit (no run started from the board yet): contract 0 is the Hendersons, Recommended. */
export function firstVisit(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) === null;
  } catch {
    return true;
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
  try {
    localStorage.setItem(VISITED_KEY, '1');
  } catch {
    // A private window: the board just recommends the Hendersons again next time.
  }
  notice.value = null;
  startRun({ seed: contract.seed, clientId: contract.clientId, crewId, mode: 'standard' });
  canContinue.value = false;
  appScreen.value = 'game';
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

/** A one-line note for the player, such as "The game updated, so this is a fresh run." */
export const notice = signal<{ text: string; oldCode?: string } | null>(null);
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
 * The roof view (D-133): the house from outside, under the roof the Roofing milestone put on
 * (D-127). The reveal at Roofing puts it on, and so does the end screen; the camera's Roof
 * button and T turn it on and off (actions.ts toggleRoof). Building takes it off, so it never
 * covers a play: picking anything, demolishing, holding a room in Inspect, or ending the week.
 * The sheets after a milestone (a change order, the shop) leave it on, so it's still there when
 * the lot comes back. UI only.
 */
export const roofOn = signal(false);
effect(() => {
  if (!roofOn.value) return;
  if (selected.value !== null || tool.value === 'demolish' || heldRoom()) roofOn.value = false;
});

/** Whether a room (under the roof) is held in Inspect. */
export function heldRoom(): boolean {
  const uid = heldPiece.value;
  const s = run.value;
  if (uid === null || s.screen !== 'build') return false;
  const piece = s.house.pieces.find((p) => p.uid === uid);
  return !!piece && isIndoor(piece.defId);
}

export type Inspected =
  | { kind: 'piece'; uid: number }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'street'; x: number }
  | { kind: 'card'; i: number }
  | { kind: 'reserve'; i: number }
  | { kind: 'supply'; i: number }
  | { kind: 'blueprint'; i: number }
  | { kind: 'upgrade'; i: number }
  | { kind: 'offer'; i: number };

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

function readSave(): { build?: unknown; code?: unknown } | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Before a link or a game update replaces the saved run, keep its code (in the browser and in
 * the note), so a run in progress is never silently lost. Returns the code if it had any weeks.
 */
function keepPreviousRun(saved: { code?: unknown } | null): string | undefined {
  if (typeof saved?.code !== 'string') return undefined;
  const decoded = decodeRunCode(saved.code);
  if (decoded.ok && decoded.data.actions.length === 0) return undefined;
  try {
    localStorage.setItem(PREVIOUS_KEY, saved.code);
  } catch {
    // Best effort.
  }
  return saved.code;
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ build: BUILD_SHA, code: runCode(false) }));
  } catch {
    // Best effort: itch.io's iframe and private windows can lose storage.
  }
}

/** A short, readable seed for a new run. */
export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function resetWeek(): void {
  heldPiece.value = null;
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
    // A finished run loads on its end screen, which opens with the roof on (D-133).
    const over = result.state.screen === 'won' || result.state.screen === 'lost';
    roofOn.value = over && roofed(result.state);
  });
  resetListeners.forEach((l) => l());
  save();
  return { failedAt: result.failedAt, error: result.error };
}

/** Starts a run at once, without the job board (a ?seed=, ?client=, or ?crew= link). */
export function newRun(
  seed = randomSeed(),
  clientId: ClientId = 'hendersons',
  crewId: CrewId = 'generalContractor',
): void {
  notice.value = null;
  startRun({ seed, clientId, crewId, mode: 'standard' });
  canContinue.value = false;
  appScreen.value = 'game';
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
  // The weeks it fast-forwards tally on the lot: the roof comes off for them (D-133).
  roofOn.value = false;
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
 * M4b: accepts or declines the change order waiting on its screen (a phase effect is only
 * acknowledged: `accept` true). Then the shop opens, or a forced one goes back to its week.
 */
export function answerChangeOrder(accept: boolean): boolean {
  return dispatch({ t: 'answerChangeOrder', accept });
}

/** The ?debug panel's cheats. They're actions, so the run code still replays. */
export function debugAction(action: DebugAction): boolean {
  return dispatch(action, { keepWeek: true });
}

/** End week: commit the tentative placement, or pass. */
export function endWeek(): void {
  const play = tentative.value;
  // The week's tally plays on the lot: the roof comes off for it, before the events play, so a
  // Roofing milestone's reveal puts it back on (D-133).
  roofOn.value = false;
  dispatch(play ?? { t: 'pass' });
}

/**
 * On page load: a ?run= code first (a bug report), then the saved run if it's from this build
 * and still replays, otherwise a fresh run with a note. Loading never blocks or crashes.
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
      if (previous) addNote('Your run in progress was put aside.', previous);
      appScreen.value = 'game';
      return;
    }
    // The link couldn't be read: say why once the fallback run has loaded.
    linkError = notice.value?.text;
    notice.value = null;
  }
  if (seedParam || clientId || crewId) {
    const previous = keepPreviousRun(saved);
    newRun(seedParam || randomSeed(), clientId ?? 'hendersons', crewId ?? 'generalContractor');
    if (previous) addNote('Your run in progress was put aside.', previous);
    if (clientParam !== null && !clientId) {
      addNote(`There's no client "${clientParam}": this run is for the Hendersons.`);
    }
    if (crewParam !== null && !crewId) {
      addNote(`There's no crew "${crewParam}": this run has the General Contractor.`);
    }
    return;
  }
  if (saved && typeof saved.code === 'string') {
    const decoded = decodeRunCode(saved.code);
    if (saved.build === BUILD_SHA && decoded.ok) {
      const { failedAt } = startRun(decoded.data.setup, decoded.data.actions);
      if (failedAt === undefined) {
        // The title screen offers Continue for a run in progress.
        canContinue.value = inProgress() && log.value.length > 0;
        appScreen.value = 'title';
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
    addNote('The game updated, so your last run couldn’t continue.', previous);
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

/** Adds a sentence to the note, keeping any old run code it already offers. */
function addNote(text: string, oldCode?: string): void {
  const current = notice.value;
  notice.value = {
    text: current ? `${current.text} ${text}` : text,
    oldCode: oldCode ?? current?.oldCode,
  };
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
