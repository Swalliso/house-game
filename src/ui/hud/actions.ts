// Small UI actions shared by the HUD's buttons and the keyboard.

import { signal } from '@preact/signals';
import { audio } from '../audio/audio.ts';
import { busy, skip } from '../fx/director.ts';
import {
  demolishArmed,
  endWeek,
  newRun,
  notice,
  preview,
  run,
  runCode,
  selected,
  tentative,
  tool,
} from '../store.ts';

export const settingsOpen = signal(false);
/** The How to play sheet, from the title screen or the top bar. */
export const howToPlayOpen = signal(false);
export const toast = signal<{ id: number; text: string } | null>(null);
let toastId = 0;

export function showToast(text: string): void {
  const id = ++toastId;
  toast.value = { id, text };
  setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2200);
}

/** Text to copy by hand, when the browser won't let us write the clipboard (some iframes). */
export const copyFallback = signal<{ title: string; text: string } | null>(null);

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
  const midRun = s.screen === 'build' && s.house.pieces.length > 0;
  if (midRun && !window.confirm('Start a new run? This one will be lost.')) return;
  notice.value = null;
  newRun();
}

export function selectCard(i: number): void {
  const s = run.value;
  if (s.screen !== 'build' || i >= s.hand.length) return;
  if (tool.value === 'demolish') {
    tool.value = 'build';
    demolishArmed.value = null;
  }
  if (busy.value) skip();
  tentative.value = null;
  selected.value = selected.value === i ? null : i;
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
  else selected.value = null;
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
  if (tentative.value && !preview.value?.legal) {
    audio.play('illegal');
    return;
  }
  if (busy.value) skip();
  endWeek();
}
