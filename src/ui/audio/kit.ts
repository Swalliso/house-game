// The recorded sound set (M5b; implementation-plan.md §12, Sound; D-058): sampled
// instruments, round-robin sets, and a recipe for each sound that has one. A sound without a
// recipe, or whose samples haven't loaded, plays its ZzFX placeholder (audio.ts), so a new
// moment can start with a placeholder and get a recipe later.
//
// The files are cut by `npm run audio:cut` from art/audio.json into assets/audio/sfx/. Each
// layer's timbre follows §12: Comfort (Points) is a marimba's soft wooden plink, Charm (+Mult)
// a warm hand chime, and Sparkle (×Mult) a tubular bell over a gong, lower and a little quieter,
// used for nothing else. Rooms land with a slit drum's thock, yard pieces with a cloth's fwp.
//
// Everything pitched is in the current track's key (music.ts): a note is a step of the key's
// scale, the ladder climbs its pentatonic scale, and a caller's `rate` on a pitched sound moves
// each note to the nearest note of that pentatonic scale, so nothing a moment asks for clashes
// with the music. Pure, so the tests can check every recipe.

import type { SoundId } from './audio.ts';

export interface Key {
  /** The tonic's pitch class: 0 = C … 11 = B. */
  readonly root: number;
  readonly mode: 'major' | 'minor';
}

/** C major: the key before any track has played, and the placeholders' key. */
export const DEFAULT_KEY: Key = { root: 0, mode: 'major' };

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const;
const PENTATONICS = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
} as const;

export type Instrument = 'marimba' | 'chime' | 'vibes' | 'glock' | 'bell';
export type SampleSet =
  | 'thock'
  | 'fwp'
  | 'chip'
  | 'coins'
  | 'click'
  | 'nope'
  | 'gong'
  | 'wind-chimes'
  | 'creak'
  | 'pop'
  | 'book';

export interface Sample {
  /** The cut's id: a path under assets/audio/ without its extension. */
  readonly file: string;
  /** The note it sounds, as a MIDI number (VCSL names its notes an octave low). */
  readonly midi: number;
  /** How far it's tuned off that note, measured, in cents. */
  readonly cents?: number;
}

/**
 * Each instrument's samples, and `home`: the lowest MIDI note its key's tonic sits on (the
 * tonic is the first one at or above it), so every key lands in the same register.
 */
export const INSTRUMENTS: Readonly<
  Record<Instrument, { readonly home: number; readonly samples: readonly Sample[] }>
> = {
  // Comfort's plink and the ladder: a tonic from F♯4 to F5, and two octaves up from there.
  marimba: {
    home: 66,
    samples: [
      { file: 'sfx/marimba-f4', midi: 65 },
      { file: 'sfx/marimba-c5', midi: 72, cents: 5 },
      { file: 'sfx/marimba-g5', midi: 79, cents: -2 },
      { file: 'sfx/marimba-b5', midi: 83 },
      { file: 'sfx/marimba-f6', midi: 89, cents: -2 },
      { file: 'sfx/marimba-c7', midi: 96 },
    ],
  },
  // Charm's chime: a hand chime, its tonic from C5 to B5 (so in C, the chime's fifth is G5).
  chime: {
    home: 72,
    samples: [
      { file: 'sfx/chime-c5', midi: 72 },
      { file: 'sfx/chime-e5', midi: 76, cents: 3 },
      { file: 'sfx/chime-c6', midi: 84 },
      { file: 'sfx/chime-e6', midi: 88, cents: 4 },
      { file: 'sfx/chime-gs6', midi: 92, cents: 5 },
    ],
  },
  // The jingles' chords: soft vibraphone, its tonic from F♯4 to F5.
  vibes: {
    home: 66,
    samples: [
      { file: 'sfx/vibes-f3', midi: 53 },
      { file: 'sfx/vibes-c4', midi: 60 },
      { file: 'sfx/vibes-g4', midi: 67 },
      { file: 'sfx/vibes-d5', midi: 74 },
      { file: 'sfx/vibes-a5', midi: 81 },
      { file: 'sfx/vibes-e6', midi: 88 },
    ],
  },
  // The jingles' bright top: glockenspiel, its tonic from G5 to F♯6.
  glock: {
    home: 79,
    samples: [
      { file: 'sfx/glock-g5', midi: 79, cents: 8 },
      { file: 'sfx/glock-c6', midi: 84, cents: 12 },
      { file: 'sfx/glock-g6', midi: 91, cents: 12 },
      { file: 'sfx/glock-c7', midi: 96, cents: 16 },
      { file: 'sfx/glock-g7', midi: 103, cents: 16 },
    ],
  },
  // Sparkle's bell, reserved for ×Mult: a tubular bell on the tonic, from C5 to B5, a fifth
  // under the chime.
  bell: {
    home: 72,
    samples: [
      { file: 'sfx/bell-c5', midi: 72, cents: 5 },
      { file: 'sfx/bell-d5', midi: 74 },
      { file: 'sfx/bell-e5', midi: 76, cents: 6 },
      { file: 'sfx/bell-g5', midi: 79 },
      { file: 'sfx/bell-c6', midi: 84, cents: 8 },
    ],
  },
};

/** Round-robin sets: each play takes the next file in a shuffled order, never the last one. */
export const SETS: Readonly<Record<SampleSet, readonly string[]>> = {
  thock: ['sfx/thock-1', 'sfx/thock-2', 'sfx/thock-3', 'sfx/thock-4'],
  fwp: ['sfx/fwp-1', 'sfx/fwp-2', 'sfx/fwp-3', 'sfx/fwp-4'],
  chip: ['sfx/chip-1', 'sfx/chip-2', 'sfx/chip-3', 'sfx/chip-4'],
  coins: ['sfx/coins'],
  click: ['sfx/click-1', 'sfx/click-2', 'sfx/click-3'],
  nope: ['sfx/nope'],
  gong: ['sfx/gong'],
  'wind-chimes': ['sfx/wind-chimes'],
  // The juice PR's moments: a crate's lid and a change order's stamp.
  creak: ['sfx/creak'],
  pop: ['sfx/pop'],
  book: ['sfx/book-1', 'sfx/book-2', 'sfx/book-3'],
};

/** A note: `step` of the key's scale (0 the tonic, 7 the octave above) on an instrument. */
export interface NoteLayer {
  readonly at?: number;
  readonly inst: Instrument;
  readonly step: number;
  /** Gain in dB. */
  readonly db?: number;
}

/** A hit from a round-robin set, unpitched (or pitched only by `rate`). */
export interface HitLayer {
  readonly at?: number;
  readonly set: SampleSet;
  readonly db?: number;
  readonly rate?: number;
}

export type Layer = NoteLayer | HitLayer;

export interface Recipe {
  readonly layers: readonly Layer[];
  /** Ducks the music for as long as it rings (a jingle; §12, Ducking). */
  readonly duck?: boolean;
}

export const isNote = (layer: Layer): layer is NoteLayer => 'inst' in layer;

/**
 * The recipes. Gains are set so the sounds sit together: the chime over the plink, the bell
 * about 3 dB under the chime with the gong's low end beneath it (§12, Sound).
 */
export const RECIPES: Partial<Record<SoundId, Recipe>> = {
  'place-room': { layers: [{ set: 'thock', db: -1 }] },
  'place-yard': { layers: [{ set: 'fwp', db: -2 }] },
  // Comfort: the ladder plays it up the scale (ladder()); on its own it's the tonic.
  plink: { layers: [{ inst: 'marimba', step: 7, db: -5 }] },
  // Charm: the key's fifth, a warm hand chime.
  chime: { layers: [{ inst: 'chime', step: 4, db: -7 }] },
  // Sparkle (×Mult): the tonic on a tubular bell over a gong. Reserved: nothing else uses
  // either (audio.test.ts).
  stamp: {
    layers: [
      { inst: 'bell', step: 0, db: -8 },
      { set: 'gong', db: -14 },
    ],
  },
  buy: {
    layers: [
      { set: 'coins', db: -3 },
      { at: 0.06, inst: 'glock', step: 4, db: -10 },
    ],
  },
  // The multiply moment: a soft chord to land on, over the vibraphone's low tonic.
  total: {
    layers: [
      { inst: 'vibes', step: -7, db: -6 },
      { at: 0.05, inst: 'vibes', step: 0, db: -8 },
      { at: 0.05, inst: 'vibes', step: 4, db: -10 },
    ],
  },
  coin: { layers: [{ set: 'chip', db: -8 }] },
  // A big week: up the tonic chord on marimba, a glockenspiel on top.
  'big-week': {
    duck: true,
    layers: [
      { at: 0, inst: 'marimba', step: 0, db: -8.5 },
      { at: 0.085, inst: 'marimba', step: 2, db: -8.5 },
      { at: 0.17, inst: 'marimba', step: 4, db: -8.5 },
      { at: 0.255, inst: 'marimba', step: 7, db: -7.5 },
      { at: 0.255, inst: 'vibes', step: 2, db: -14.5 },
      { at: 0.255, inst: 'glock', step: 7, db: -17.5 },
    ],
  },
  // A milestone met: a vibraphone chord that rises to a chime.
  milestone: {
    duck: true,
    layers: [
      { at: 0, inst: 'vibes', step: -7, db: -11.5 },
      { at: 0, inst: 'vibes', step: -3, db: -13.5 },
      { at: 0, inst: 'vibes', step: 2, db: -14.5 },
      { at: 0.12, inst: 'chime', step: 0, db: -10.5 },
      { at: 0.12, inst: 'marimba', step: 7, db: -10.5 },
    ],
  },
  // A milestone missed: a gentle fall from the third to the tonic.
  fail: {
    duck: true,
    layers: [
      { at: 0, inst: 'vibes', step: 2, db: -11 },
      { at: 0.24, inst: 'vibes', step: 0, db: -10 },
      { at: 0.24, inst: 'vibes', step: -7, db: -14 },
    ],
  },
  select: { layers: [{ set: 'click', db: -7 }] },
  illegal: { layers: [{ set: 'nope', db: -4 }] },
  // The milestone target reached: a bright ding-ding, the third then the sixth.
  target: {
    layers: [
      { at: 0, inst: 'glock', step: 2, db: -6 },
      { at: 0.12, inst: 'glock', step: 5, db: -6 },
      { at: 0.12, inst: 'chime', step: 2, db: -10 },
    ],
  },
  sparkle: { layers: [{ set: 'wind-chimes', db: -7 }] },

  // ---- The juice PR's moments (D-124 to D-126), after its placeholders' shapes ----
  // A Good week: a short chime, the tonic up to the fifth, with a soft glockenspiel octave.
  // (The hand chimes stop at G♯6, so their notes stay at or under the fifth; the glockenspiel
  // takes the octave.)
  'tier-good': {
    duck: true,
    layers: [
      { inst: 'chime', step: 0, db: -11 },
      { at: 0.09, inst: 'chime', step: 4, db: -10 },
      { at: 0.09, inst: 'glock', step: 7, db: -18 },
    ],
  },
  // A Huge week: the full fanfare, up the tonic chord into a held chord with a shimmer.
  'tier-huge': {
    duck: true,
    layers: [
      { at: 0, inst: 'marimba', step: 0, db: -8 },
      { at: 0.1, inst: 'marimba', step: 2, db: -8 },
      { at: 0.2, inst: 'marimba', step: 4, db: -8 },
      { at: 0.3, inst: 'marimba', step: 7, db: -7 },
      { at: 0.45, inst: 'vibes', step: 0, db: -11 },
      { at: 0.45, inst: 'vibes', step: 2, db: -12 },
      { at: 0.45, inst: 'vibes', step: 4, db: -12 },
      { at: 0.45, inst: 'glock', step: 7, db: -15 },
      { at: 0.5, set: 'wind-chimes', db: -12 },
    ],
  },
  // A set completing: a bright chord, the tonic and the fifth, the third on top a beat later.
  'set-complete': {
    layers: [
      { inst: 'chime', step: 0, db: -12 },
      { inst: 'chime', step: 4, db: -11 },
      { at: 0.07, inst: 'glock', step: 2, db: -14 },
    ],
  },
  // A Rhythm payout: ba-dum, two soft wooden knocks.
  rhythm: {
    layers: [
      { set: 'thock', db: -3, rate: 0.9 },
      { at: 0.13, set: 'thock', db: -1, rate: 1.2 },
    ],
  },
  // A find: a scoop of dirt, then a ta-da.
  find: {
    layers: [
      { set: 'fwp', db: -5, rate: 0.8 },
      { at: 0.12, inst: 'marimba', step: 4, db: -7 },
      { at: 0.22, inst: 'marimba', step: 7, db: -6 },
    ],
  },
  // A crate opening: the lid's creak, a pop, and a note.
  'crate-open': {
    layers: [
      { set: 'creak', db: -6 },
      { at: 0.14, set: 'pop', db: -8 },
      { at: 0.16, inst: 'glock', step: 7, db: -12 },
    ],
  },
  // A Rare on the shelf: a shimmer, and a high glockenspiel ring on the third over a chime.
  rare: {
    layers: [
      { set: 'wind-chimes', db: -9 },
      { at: 0.05, inst: 'glock', step: 2, db: -11 },
      { at: 0.1, inst: 'chime', step: 4, db: -15 },
    ],
  },
  // A client's wish met: a warm chime rising up the tonic chord.
  'wish-met': {
    layers: [
      { inst: 'chime', step: 0, db: -12 },
      { at: 0.08, inst: 'chime', step: 2, db: -11 },
      { at: 0.16, inst: 'chime', step: 4, db: -10 },
    ],
  },
  // A house rule met: a crisp check, the tonic up to the fifth.
  'rule-met': {
    layers: [
      { inst: 'glock', step: 0, db: -10 },
      { at: 0.07, inst: 'glock', step: 4, db: -9 },
    ],
  },
  // A house rule lost: a soft low knock and a falling third.
  'rule-lost': {
    layers: [
      { set: 'thock', db: -9, rate: 0.8 },
      { inst: 'vibes', step: 2, db: -13 },
      { at: 0.12, inst: 'vibes', step: 0, db: -12 },
    ],
  },
  // A Renovation's level-up: three notes up, the tonic, the fifth, the octave, with a glint.
  'level-up': {
    layers: [
      { inst: 'marimba', step: 0, db: -8 },
      { at: 0.07, inst: 'marimba', step: 4, db: -8 },
      { at: 0.14, inst: 'marimba', step: 7, db: -7 },
      { at: 0.14, inst: 'glock', step: 7, db: -16 },
    ],
  },
  // An arrival: ding-dong, the third down to the tonic, on the long-ringing hand chimes.
  doorbell: {
    layers: [
      { inst: 'chime', step: 2, db: -8 },
      { at: 0.32, inst: 'chime', step: 0, db: -8 },
    ],
  },
  // A change order's stamp: a papery thump with some wood in it.
  'order-stamp': {
    layers: [
      { set: 'book', db: -4 },
      { set: 'thock', db: -14 },
    ],
  },
  // Topped out: a quick rising cheer and a ring on top.
  'topped-out': {
    duck: true,
    layers: [
      { at: 0, inst: 'marimba', step: 0, db: -8 },
      { at: 0.06, inst: 'marimba', step: 2, db: -8 },
      { at: 0.12, inst: 'marimba', step: 4, db: -8 },
      { at: 0.18, inst: 'marimba', step: 7, db: -8 },
      { at: 0.26, inst: 'chime', step: 4, db: -10 },
      { at: 0.26, inst: 'glock', step: 7, db: -14 },
    ],
  },
  // The milestone's drumroll keeps its ZzFX placeholder: no recording here rolls.
};

// ---- Pitch ----

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Semitones above the tonic for a step of the key's scale (any step; 7 is the octave). */
export function scaleSemitones(key: Key, step: number): number {
  const scale = SCALES[key.mode];
  const s = Math.round(step);
  return 12 * Math.floor(s / scale.length) + scale[mod(s, scale.length)]!;
}

/** The tonic's MIDI note in an instrument's register: the first one at or above its home. */
export function homeTonic(key: Key, inst: Instrument): number {
  const home = INSTRUMENTS[inst].home;
  return home + mod(key.root - home, 12);
}

/** The pentatonic scale's notes nearest a MIDI note (fractional allowed), in the key. */
export function snapToPentatonic(key: Key, midi: number): number {
  const pent = PENTATONICS[key.mode];
  let best = Math.round(midi);
  let bestDistance = Infinity;
  for (let n = Math.floor(midi) - 3; n <= Math.ceil(midi) + 3; n++) {
    if (!(pent as readonly number[]).includes(mod(n - key.root, 12))) continue;
    const d = Math.abs(n - midi);
    if (d < bestDistance - 1e-9) {
      best = n;
      bestDistance = d;
    }
  }
  return best;
}

/** The ladder climbs the key's pentatonic scale: two octaves in ten steps, then holds. */
export const LADDER_TOP_STEP = 10;

/** The ladder's pitch for a step, in semitones above the tonic. Holds at two octaves. */
export function ladderSemitones(step: number, key: Key = DEFAULT_KEY): number {
  if (step >= LADDER_TOP_STEP) return 24;
  const pent = PENTATONICS[key.mode];
  const s = step > 0 ? Math.floor(step) : 0; // NaN lands on the tonic
  return 12 * Math.floor(s / pent.length) + pent[s % pent.length]!;
}

/** The sample nearest a MIDI note, and the rate that plays it there. */
export function pick(inst: Instrument, midi: number): { file: string; rate: number } {
  let best = INSTRUMENTS[inst].samples[0]!;
  for (const s of INSTRUMENTS[inst].samples) {
    if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  }
  return { file: best.file, rate: 2 ** ((midi - best.midi - (best.cents ?? 0) / 100) / 12) };
}

/** A note layer's MIDI note in a key, moved by `shift` semitones and snapped into the key. */
export function noteMidi(key: Key, layer: NoteLayer, shift = 0): number {
  const midi = homeTonic(key, layer.inst) + scaleSemitones(key, layer.step);
  return Math.abs(shift) < 1e-6 ? midi : snapToPentatonic(key, midi + shift);
}

/** Every file a recipe can play, for preloading and the tests. */
export function recipeFiles(recipe: Recipe): string[] {
  return recipe.layers.flatMap((l) =>
    isNote(l) ? INSTRUMENTS[l.inst].samples.map((s) => s.file) : [...SETS[l.set]],
  );
}

/** Every file the kit uses. */
export function kitFiles(): string[] {
  const files = new Set<string>();
  for (const inst of Object.values(INSTRUMENTS)) for (const s of inst.samples) files.add(s.file);
  for (const set of Object.values(SETS)) for (const f of set) files.add(f);
  return [...files].sort();
}

/**
 * A shuffle bag per set: each play takes the next file, and a new shuffle never starts with the
 * file just played. `random` is the UI's own (rules code never comes here).
 */
export function roundRobin(random: () => number = Math.random): (set: SampleSet) => string {
  const bags = new Map<SampleSet, { order: string[]; at: number }>();
  return (set) => {
    const files = SETS[set];
    if (files.length === 1) return files[0]!;
    let bag = bags.get(set);
    if (!bag || bag.at >= bag.order.length) {
      const last = bag?.order[bag.order.length - 1];
      const order = [...files];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      if (order[0] === last) [order[0], order[1]] = [order[1]!, order[0]!];
      bag = { order, at: 0 };
      bags.set(set, bag);
    }
    return bag.order[bag.at++]!;
  };
}
