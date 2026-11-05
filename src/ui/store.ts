// UI state: the run, its action log, and what the player is pointing at. The rules decide
// everything; the store only keeps their state, asks them for previews, sends them actions,
// and hands the events to the tally director. Saves and run codes live here too.

import { batch, computed, signal } from '@preact/signals';
import {
  CONTENT,
  contentHash,
  decodeRunCode,
  encodeRunCode,
  IllegalAction,
  rules,
  shapeCells,
  type Action,
  type Cell,
  type GameEvent,
  type PlaceAction,
  type Preview,
  type Rot,
  type RunSetup,
  type RunState,
} from '../rules/index.ts';
import { BUILD_CHANNEL, BUILD_SHA } from './build-info.ts';

export const CONTENT_HASH = contentHash(CONTENT);
const SAVE_KEY = `openhouse:${BUILD_CHANNEL}:run`;

// ---------------------------------------------------------------------------------------
// The run.

export const run = signal<RunState>(rules.newRun({ seed: 'placeholder', mode: 'standard' }));
export const log = signal<readonly Action[]>([]);

/** A one-line note for the player, such as "The game updated, so this is a fresh run." */
export const notice = signal<{ text: string; oldCode?: string } | null>(null);
/** Set when something broke: the error boundary shows it with the run code. */
export const crash = signal<{ message: string; stack?: string } | null>(null);

// ---------------------------------------------------------------------------------------
// What the player is doing this week.

/** The hand card being placed, if any. */
export const selected = signal<number | null>(null);
export const rotation = signal<Rot>(0);
/** The lot cell under the pointer. */
export const hoverCell = signal<Cell | null>(null);
/** A placement waiting for End week (D-036): a tap places tentatively. */
export const tentative = signal<PlaceAction | null>(null);
/** What the inspect panel shows when nothing is being placed. */
export const inspected = signal<Inspected | null>(null);

export type Inspected =
  | { kind: 'piece'; uid: number }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'street'; x: number }
  | { kind: 'card'; i: number };

/** The placement under the cursor, centered on it, or the tentative one. */
export const activePlay = computed<PlaceAction | null>(() => {
  if (tentative.value) return tentative.value;
  const i = selected.value;
  const cell = hoverCell.value;
  const card = i === null ? undefined : run.value.hand[i];
  if (i === null || !card || !cell) return null;
  const def = CONTENT.pieces[card.id];
  const cells = shapeCells(def.shape, rotation.value);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  return {
    t: 'place',
    from: 'hand',
    i,
    x: cell.x - Math.floor((w - 1) / 2),
    y: cell.y - Math.floor((h - 1) / 2),
    rot: rotation.value,
  };
});

export const preview = computed<Preview | null>(() => {
  const play = activePlay.value;
  return play && run.value.screen === 'build' ? rules.preview(run.value, play) : null;
});

/** What the house earns per week as it stands: the corner digits and the inspect panel. */
export const currentTally = computed(() => rules.currentTally(run.value));

/** The phase's pace (§12), the yardstick for the glow and the big-week tier. */
export const pace = computed(() => rules.pace(run.value));

/** Which cards have somewhere to go, for greying out the rest. */
export const cardsFit = computed(() => run.value.hand.map((_, i) => rules.cardFits(run.value, i)));

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
  selected.value = null;
  tentative.value = null;
  rotation.value = 0;
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
  const result = rules.replay(setup, actions);
  batch(() => {
    run.value = result.state;
    log.value = result.failedAt === undefined ? actions : actions.slice(0, result.failedAt);
    resetWeek();
    inspected.value = null;
  });
  resetListeners.forEach((l) => l());
  save();
  return { failedAt: result.failedAt, error: result.error };
}

export function newRun(seed = randomSeed()): void {
  notice.value = null;
  startRun({ seed, mode: 'standard' });
}

/** Sends an action to the rules. Illegal actions are a bug in the UI, not a crash. */
export function dispatch(action: Action): boolean {
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
      stack: (e as Error)?.stack,
    };
    return false;
  }
  batch(() => {
    run.value = result.state;
    log.value = [...log.value, action];
    resetWeek();
  });
  save();
  listeners.forEach((l) => l(result.events, before, result.state));
  return true;
}

/** End week: commit the tentative placement, or pass. */
export function endWeek(): void {
  const play = tentative.value;
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
  if (fromUrl !== null || seedParam !== null) {
    // Drop them from the address bar, so a reload resumes the saved run instead of starting
    // this one over.
    params.delete('run');
    params.delete('seed');
    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
    );
  }
  if (fromUrl && loadRunCode(fromUrl)) return;
  if (seedParam) {
    newRun(seedParam);
    return;
  }
  let saved: { build?: unknown; code?: unknown } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (saved && typeof saved.code === 'string') {
    const decoded = decodeRunCode(saved.code);
    if (saved.build === BUILD_SHA && decoded.ok) {
      const { failedAt } = startRun(decoded.data.setup, decoded.data.actions);
      if (failedAt === undefined) return;
    }
    newRun();
    notice.value = { text: 'The game updated, so this is a fresh run.', oldCode: saved.code };
    return;
  }
  newRun();
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
  if (data.pending && failedAt === undefined) {
    // Show the placement the report was looking at.
    batch(() => {
      selected.value = data.pending!.i;
      rotation.value = data.pending!.rot;
      tentative.value = data.pending!;
    });
  }
  notice.value = { text: notes.join(' ') };
  return true;
}
