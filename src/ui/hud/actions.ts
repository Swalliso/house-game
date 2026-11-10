// Small UI actions shared by the HUD's buttons and the keyboard.

import { batch, computed, signal } from '@preact/signals';
import { rules } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy, orderStamp, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { roofed } from '../fx/moments.ts';
import { copyFallback, settingsOpen } from './modals.ts';
import {
  appScreen,
  demolishArmed,
  endWeek,
  heldPiece,
  heldRoom,
  inProgress,
  openJobBoard,
  notice,
  roofOn,
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
/** Notes and toasts sit inside a sheet, not over the board: the shop's or a change order's. */
export const notesDocked = computed(() => shopShown.value || changeOrderShown.value);

/**
 * Whether the camera's Roof button can put the roof on now (D-133): once the Roofing milestone
 * is met, with the lot in view (no sheet over it), no tally playing, and nothing being built.
 */
export const canRoof = computed(
  () =>
    roofed(run.value) &&
    !busy.value &&
    !notesDocked.value &&
    selected.value === null &&
    tool.value !== 'demolish',
);

/**
 * The camera's Roof button and T (D-133): the roof on, or off to look inside. It comes off
 * whenever the lot is in view, and goes on when canRoof says so, letting go of a room held in
 * Inspect, which it would cover.
 */
export function toggleRoof(): void {
  if (notesDocked.value) return;
  if (roofOn.value) {
    roofOn.value = false;
    audio.play('place-yard', { rate: 1.2, gain: 0.5 });
    return;
  }
  if (!canRoof.value) return;
  batch(() => {
    if (heldRoom()) heldPiece.value = null;
    roofOn.value = true;
  });
  // The roof's thump as it lands, without the reveal's chime and the music's duck.
  audio.play('place-room', { rate: 0.75, gain: 0.7, delay: FEEL.roof.thumpMs / 1000 });
}

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

export function requestEndWeek(): void {
  if (run.value.screen !== 'build') return;
  if (!tentative.value && !passArmed.value) {
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
