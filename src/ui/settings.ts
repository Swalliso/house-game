// Player settings (implementation-plan.md §12, Settings and accessibility), kept in the
// browser. Settings aren't saves, so they're shared across channels, and a bad stored value
// falls back to its default.

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

function load(): Settings {
  const d = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw || typeof raw !== 'object') return d;
    return {
      tallySpeed: (FEEL.speeds as readonly number[]).includes(raw.tallySpeed as number)
        ? (raw.tallySpeed as TallySpeed)
        : d.tallySpeed,
      reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : d.reduceMotion,
      shake: clamp100(raw.shake, d.shake),
      masterVolume: clamp100(raw.masterVolume, d.masterVolume),
      sfxVolume: clamp100(raw.sfxVolume, d.sfxVolume),
    };
  } catch {
    return d;
  }
}

export const settings = signal<Settings>(load());

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  const s = settings.value;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private windows and blocked storage: settings last for this visit only.
  }
  audio.setVolumes({ master: s.masterVolume / 100, sfx: s.sfxVolume / 100 });
  document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
});
