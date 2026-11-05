// Player settings (implementation-plan.md §12, Settings and accessibility), kept in the
// browser. Settings aren't saves, so they're shared across channels. Only what the player
// changes is stored, so Reduce motion follows the browser until it's toggled, and a bad
// stored value falls back to its default.

import { effect, signal } from '@preact/signals';
import { FEEL, type TallySpeed } from './fx/feel.ts';
import { audio } from './audio/audio.ts';

export interface Settings {
  tallySpeed: TallySpeed;
  reduceMotion: boolean;
  /** 0–100. */
  shake: number;
  /** 0–100. */
  masterVolume: number;
  sfxVolume: number;
}

const KEY = 'openhouse:settings';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return {
    tallySpeed: 1,
    reduceMotion: prefersReducedMotion(),
    shake: 50,
    masterVolume: 70,
    sfxVolume: 80,
  };
}

const clamp100 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : fallback;

/** Only the settings the player has changed are stored; the rest follow the defaults. */
function loadStored(): Partial<Settings> {
  const d = defaultSettings();
  const out: Partial<Settings> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return out;
    if ((FEEL.speeds as readonly unknown[]).includes(raw.tallySpeed)) {
      out.tallySpeed = raw.tallySpeed as TallySpeed;
    }
    if (typeof raw.reduceMotion === 'boolean') out.reduceMotion = raw.reduceMotion;
    for (const k of ['shake', 'masterVolume', 'sfxVolume'] as const) {
      if (k in raw) out[k] = clamp100(raw[k], d[k]);
    }
  } catch {
    // Unreadable or blocked storage: defaults for this visit.
  }
  return out;
}

let stored = loadStored();

export const settings = signal<Settings>({ ...defaultSettings(), ...stored });

export function updateSettings(patch: Partial<Settings>): void {
  stored = { ...stored, ...patch };
  settings.value = { ...settings.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Private windows and blocked storage: settings last for this visit only.
  }
}

effect(() => {
  const s = settings.value;
  audio.setVolumes({ master: s.masterVolume / 100, sfx: s.sfxVolume / 100 });
  document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
});
