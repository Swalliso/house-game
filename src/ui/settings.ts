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
  /**
   * Flashing (§12, Settings; D-125): the screen-wide washes and flashes of the big moments (a
   * Huge week's white flash, the score panel's pulse). Off, they're still tints that fade.
   */
  flashing: boolean;
  /** 0–100. */
  masterVolume: number;
  sfxVolume: number;
  /**
   * The readable-font option (§12, Settings; D-059): every UI text in the system font instead
   * of the pixel fonts, at its own sizes.
   */
  readableFont: boolean;
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
    flashing: true,
    masterVolume: 70,
    sfxVolume: 80,
    readableFont: false,
  };
}

const clamp100 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : fallback;

/**
 * The stored settings that are valid, from what was saved (parsed JSON, or anything else): a
 * value of the wrong kind is left out, so its setting follows the default; a volume out of
 * range is clamped.
 */
export function parseStored(raw: unknown, d: Settings = defaultSettings()): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if ((FEEL.speeds as readonly unknown[]).includes(r.tallySpeed)) {
    out.tallySpeed = r.tallySpeed as TallySpeed;
  }
  if (typeof r.reduceMotion === 'boolean') out.reduceMotion = r.reduceMotion;
  if (typeof r.readableFont === 'boolean') out.readableFont = r.readableFont;
  if (typeof r.flashing === 'boolean') out.flashing = r.flashing;
  for (const k of ['shake', 'masterVolume', 'sfxVolume'] as const) {
    if (k in r) out[k] = clamp100(r[k], d[k]);
  }
  return out;
}

/** Only the settings the player has changed are stored; the rest follow the defaults. */
function loadStored(): Partial<Settings> {
  // Outside a browser (a test) there's nothing stored.
  if (typeof window === 'undefined') return {};
  try {
    return parseStored(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    // Unreadable or blocked storage: defaults for this visit.
    return {};
  }
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

// The page follows the settings (a test imports this module without one).
if (typeof document !== 'undefined') {
  effect(() => {
    const s = settings.value;
    audio.setVolumes({ master: s.masterVolume / 100, sfx: s.sfxVolume / 100 });
    document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
    document.documentElement.classList.toggle('no-flashing', !s.flashing);
    document.documentElement.dataset.font = s.readableFont ? 'readable' : 'pixel';
  });
}
