// The first-time hints this browser has been through (D-045): a hint dismissed with "Got it",
// or one of the opening's whose week has passed (D-149). Remembered in the browser, by channel;
// UI only, never game state. Its own file, so the hints (FirstHints.tsx) and what the first job
// shows (first-job.ts) can both read it.

import { signal } from '@preact/signals';
import { BUILD_CHANNEL } from '../build-info.ts';

const KEY = `openhouse:${BUILD_CHANNEL}:hints`;

function load(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** The hints already seen in this browser, by id. */
export const seenHints = signal<ReadonlySet<string>>(load());

export function markHintSeen(id: string): void {
  if (seenHints.value.has(id)) return;
  const next = new Set(seenHints.value);
  next.add(id);
  seenHints.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // A private window: the hint comes back next visit, which is harmless.
  }
}

/** Shows every hint again (Settings). */
export function resetHints(): void {
  seenHints.value = new Set();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
