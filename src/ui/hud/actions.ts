// Small UI actions shared by the HUD's buttons and the keyboard.

import { computed, signal } from '@preact/signals';
import {
  rules,
  type ClientId,
  type CrewId,
  type RunMode,
  type RunState,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy, orderStamp, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { copyFallback, portfolioOpen, settingsOpen } from './modals.ts';
import {
  appScreen,
  demolishArmed,
  endWeek,
  heldPiece,
  inProgress,
  log,
  newRun,
  openJobBoard,
  notice,
  onRunReset,
  run,
  runCode,
  selected,
  selectItem,
  source,
  tentative,
  tool,
  type Source,
} from '../store.ts';

export {
  anyModalOpen,
  closeTopModal,
  copyFallback,
  howToPlayOpen,
  menuOpen,
  photoShown,
  portfolioOpen,
  settingsOpen,
} from './modals.ts';
export const toast = signal<{ id: number; text: string } | null>(null);
let toastId = 0;

export function showToast(text: string): void {
  const id = ++toastId;
  toast.value = { id, text };
  setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2200);
}

/** The shop is hidden to look at the lot (it's still open). */
export const shopHidden = signal(false);
// A new run's first shop opens on screen, not as the last run's hidden handle.
onRunReset(() => (shopHidden.value = false));
/** The shop's sheet is on screen: notes then sit inside it, under its header (Overlays.tsx). */
export const shopShown = computed(
  () =>
    appScreen.value === 'game' &&
    run.value.screen === 'shop' &&
    !!run.value.offers?.shop &&
    !busy.value &&
    !shopHidden.value,
);
/**
 * A change order's sheet is on screen (M4b): waiting for an answer once the milestone's beats
 * are done, or carrying its stamp. Notes then sit inside it too (ChangeOrderScreen.tsx).
 */
export const changeOrderShown = computed(
  () =>
    appScreen.value === 'game' &&
    (orderStamp.value !== null || (run.value.screen === 'changeOrder' && !busy.value)),
);
/**
 * D-144: the key that picks each change order on the sheet: 1 for the left and 2 for the right,
 * as the buttons and the controls strip say. An order offered alone (only one was eligible, or
 * the ?debug panel forced it) takes Enter.
 */
export function pickKeys(count: number): readonly string[] {
  return count === 1 ? ['Enter'] : Array.from({ length: count }, (_, i) => String(i + 1));
}

/** Notes and toasts sit inside a sheet, not over the board: the shop's or a change order's. */
export const notesDocked = computed(() => shopShown.value || changeOrderShown.value);

export async function copyText(text: string, done = 'Copied'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(done);
  } catch {
    copyFallback.value = { title: done.replace(/ copied$/, ''), text };
  }
}

export function copyRunCode(): Promise<void> {
  return copyText(runCode(), 'Run code copied');
}

export function openSettings(): void {
  settingsOpen.value = true;
}

export function startNewRun(): void {
  const s = run.value;
  const midRun = inProgress(s) && s.house.pieces.length > 0;
  if (midRun && !window.confirm('Start a new run? This one will be lost.')) return;
  notice.value = null;
  openJobBoard();
}

/**
 * The Portfolio's "Play this lot again" (D-139): a new run on a finished house's lot, for the same
 * client with the same crew, straight into the game. The run in progress would be lost, so it
 * asks first, as the title's New run does while Continue is offered. The end screen's Try this
 * lot again (D-150) passes its run's setup, so a first job played again keeps its gentler
 * targets (D-151); the Portfolio's lots are ordinary runs.
 */
export function playLotAgain(lot: {
  seed: string;
  clientId: ClientId;
  crewId: CrewId;
  mode?: RunMode;
}): void {
  const atStake = inProgress() && log.value.length > 0;
  if (atStake && !window.confirm('Play this lot again? The run in progress will be lost.')) return;
  audio.unlock();
  portfolioOpen.value = false;
  newRun(lot.seed, lot.clientId, lot.crewId, lot.mode);
}

/**
 * The end screen's Try this lot again (D-150): the run's own lot, client and crew. A lost first
 * job is tried again at its gentler targets; a won one is played again at the client's own, so
 * the first job's targets don't outlast it (D-151).
 */
export function endScreenAgain(s: RunState): void {
  playLotAgain(s.screen === 'won' ? { ...s.setup, mode: 'standard' } : s.setup);
}

export function selectCard(i: number, from: Source = 'hand'): void {
  const s = run.value;
  const list = from === 'hand' ? s.hand : from === 'reserve' ? s.reserve : s.supplies;
  if (s.screen !== 'build' || i >= list.length) return;
  if (tool.value === 'demolish') {
    tool.value = 'build';
    demolishArmed.value = null;
    // Back to building: the card being placed stays picked, with its pending placement.
    if (selected.value === i && source.value === from) return;
  }
  if (busy.value) skip();
  selectItem(from, i);
  audio.play('select');
}

/** Demolish mode (D, or the Demolish button): a click on the lot demolishes instead of building. */
export function toggleDemolish(): void {
  const s = run.value;
  if (tool.value === 'demolish') {
    tool.value = 'build';
    demolishArmed.value = null;
    return;
  }
  if (s.screen !== 'build' || s.demolitionsLeft <= 0) {
    audio.play('illegal');
    return;
  }
  // A card only being looked at goes back to the hand; a placement waiting for End week stays.
  if (!tentative.value) selected.value = null;
  demolishArmed.value = null;
  tool.value = 'demolish';
  audio.play('select', { rate: 0.7 });
}

export function cancelPlacement(): void {
  if (tool.value === 'demolish') {
    tool.value = 'build';
    demolishArmed.value = null;
    return;
  }
  if (tentative.value) tentative.value = null;
  else if (selected.value !== null) selected.value = null;
  // Nothing picked: Esc lets go of a piece held in Inspect (store.ts heldPiece).
  else heldPiece.value = null;
}

/** Is this item the one being placed or installed? */
export function isSelected(from: Source, i: number): boolean {
  return selected.value === i && source.value === from;
}

/** Passing places nothing all week, so it takes a second press within a few seconds. */
export const passArmed = signal(false);
let passTimer: ReturnType<typeof setTimeout> | undefined;
/** When End week last hurried a tally, or last pressed on as still hurrying (FEEL.endWeek). */
let hurriedAt = -Infinity;

export function requestEndWeek(): void {
  if (run.value.screen !== 'build') return;
  // While a tally plays with nothing waiting to be placed, Enter or a click on End week only
  // hurries the tally, as a click anywhere else does. It never arms or confirms a pass: a
  // double-click on End week used to pass the next week unseen (D-068).
  if (busy.value && !tentative.value) {
    skip();
    hurriedAt = performance.now();
    return;
  }
  if (!tentative.value && !passArmed.value) {
    // The tally is gone a moment after it's hurried, so the next quick press lands on a quiet
    // board. It is still hurrying, not the first press of a pass, and so is every press that
    // follows it closely: steady clicking used to wait out the gap, arm a pass with one press
    // and confirm it with the next, passing the new week unseen.
    const now = performance.now();
    if (now - hurriedAt < FEEL.endWeek.hurryMs) {
      hurriedAt = now;
      return;
    }
    passArmed.value = true;
    clearTimeout(passTimer);
    passTimer = setTimeout(() => (passArmed.value = false), 2500);
    return;
  }
  passArmed.value = false;
  // The play waiting for End week, not the pointer's (a pack's next tile can be illegal).
  if (tentative.value && !rules.checkPlay(run.value, tentative.value).legal) {
    audio.play('illegal');
    return;
  }
  if (busy.value) skip();
  endWeek();
}
