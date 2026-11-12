// Our small Web Audio wrapper (implementation-plan.md §12, "Sound" and "Audio
// implementation"; D-058). M1 has placeholder ZzFX sounds, a master bus, a sound-effect
// bus, and the tally's pitch ladder. M5b adds the recorded sound set (kit.ts: a recipe per
// sound, in the music's key, with its placeholder until its samples load), the music bus
// (music.ts: tracks, stems, screen mixes, ducking, the losing glide), and the music volume.
// Nothing here runs at import: preload() fetches the files once the title screen is up, the
// AudioContext is created on the first unlock(), and the files are decoded then.

import {
  isNote,
  kitFiles,
  ladderSemitones,
  LADDER_TOP_STEP,
  noteMidi,
  pick,
  RECIPES,
  recipeFiles,
  roundRobin,
  homeTonic,
  type Recipe,
} from './kit.ts';
import { loadBuffer, prefetch } from './loader.ts';
import { music } from './music.ts';
import type { Scene } from './tracks.ts';
import { buildSamples, type ZzfxParams } from './zzfx.ts';

export { LADDER_TOP_STEP, ladderSemitones };

export type SoundId =
  | 'place-room'
  | 'place-yard'
  | 'plink'
  | 'chime'
  | 'stamp'
  | 'buy'
  | 'total'
  | 'coin'
  | 'big-week'
  | 'milestone'
  | 'fail'
  | 'select'
  | 'rotate'
  | 'illegal'
  | 'target'
  | 'sparkle'
  // The juice PR's moments (D-124, D-125, D-126): ZzFX placeholders for M5b's sound pass.
  | 'tier-good'
  | 'tier-huge'
  | 'set-complete'
  | 'rhythm'
  | 'find'
  | 'crate-open'
  | 'rare'
  | 'wish-met'
  | 'rule-met'
  | 'rule-lost'
  | 'level-up'
  | 'doorbell'
  | 'order-stamp'
  | 'topped-out'
  | 'drumroll'
  // The week's stamp (D-154): a page of the schedule turning, and the last week's clock.
  | 'week-start'
  | 'last-week';

export interface PlayOptions {
  /** Exact playback rate. Giving one also turns off the random rate and gain spread. */
  rate?: number;
  /** Linear gain multiplier, default 1. */
  gain?: number;
  /** Seconds from now, on the audio clock. */
  delay?: number;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface AudioApi {
  unlock(): void;
  /** Starts fetching the sound files (once the title screen is up); decoding waits for unlock. */
  preload(): void;
  setVolumes(v: Volumes): void;
  play(id: SoundId, opts?: PlayOptions): void;
  ladder(step: number, opts?: { delay?: number }): void;
  /** Which screen the music is mixed for (scene.ts). */
  setScene(scene: Scene): void;
  /** Ducks the music for `seconds` (a jingle without a recipe of its own, say). */
  duck(seconds: number): void;
  now(): number;
}

// ---- Mix and feel numbers ----

/** The master bus at full volume; ZzFX itself plays at 0.3. Keeps the mix calm. */
const OUTPUT_TRIM = 0.8;
/** Volume sliders are squared, so the slider's middle sounds like the middle. */
const taper = (v: number) => v * v;
const VOLUME_SMOOTHING_S = 0.02;
/** Each play() picks a rate within ±0.05 and a gain within ±1.5 dB. */
const RATE_SPREAD = 0.05;
const GAIN_SPREAD_DB = 1.5;
/** Mixed sounds are scaled down if their layers add up past this peak. */
const MAX_PEAK = 0.95;
const MAX_VOICES = 48;
/**
 * The music bus at full volume: tracks are cut to −16 LUFS, and this keeps them 8–10 dB under
 * the sound effects' peaks (§12, Mix).
 */
const MUSIC_TRIM = 0.5;
/**
 * A small room for the recorded instruments: a 1.3 s tail, sent at −16 dB, so the dry, close-
 * miked mallets sit in the same space as the music. Foley and clicks stay dry.
 */
const ROOM_SECONDS = 1.3;
const ROOM_SEND_DB = -16;

/** The placeholder ladder's step 0 is an octave below the plink's own pitch (C6): C5 to C7. */
const LADDER_ROOT_SEMITONES = -12;
const LADDER_SPARKLE_GAIN = 0.35;
/** The recorded ladder's plink, in dB: as loud as the plink on its own. */
const LADDER_DB = -5;

// ---- The placeholder sounds ----

/** One ZzFX sound in a mix, starting `at` seconds in. */
interface Layer {
  readonly at: number;
  readonly params: ZzfxParams;
}

// Notes by MIDI number, all in C major pentatonic (C D E G A) to match the ladder.
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const notes = <const T extends readonly number[]>(midi: T) =>
  midi.map(hz) as { -readonly [K in keyof T]: number };
const [C3, C4, E4, G4, C5, E5, G5, C6, E6, G6, A6, C7, E7, G7] = notes([
  48, 60, 64, 67, 72, 76, 79, 84, 88, 91, 93, 96, 100, 103,
]);

const one = (params: ZzfxParams): readonly Layer[] => [{ at: 0, params }];
/** A soft, low-passed triangle note for jingles. */
const note = (at: number, frequency: number, volume: number, release: number): Layer => ({
  at,
  params: [volume, 0, frequency, 0.006, 0.02, release, 1, 1, , , , , , , , , , 0.7, 0.03, , -2200],
});

// ZzFX order, to paste into the designer at https://killedbyapixel.github.io/ZzFX/:
// [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
//  deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
//  sustainVolume, decay, tremolo, filter]. Randomness is always 0: buffers are built once,
// and play() adds its own spread.
const SOUNDS: Record<SoundId, readonly Layer[]> = {
  // Placing a room: a soft, woody thock.
  'place-room': one([0.7, 0, 170, 0.002, 0, 0.12, 1, 1, -1, , , , , , , , , 0.5, 0.025, , -900]),
  // Placing a yard piece: a softer, grassy fwp of low-passed noise.
  'place-yard': one([0.55, 0, 600, 0.035, 0, 0.09, 4, 1, , , , , , , , , , 1, , , -1100]),
  // Comfort (points): a soft wooden plink. The ladder repitches it.
  plink: [
    { at: 0, params: [0.6, 0, C6, 0.002, 0, 0.16, 0, 1, , , , , , , , , , 0.5, 0.02] },
    { at: 0, params: [0.08, 0, C6 * 4, 0.001, 0, 0.03] },
  ],
  // Charm (+Mult): a warm chime with a slow shimmer.
  chime: [
    { at: 0, params: [0.42, 0, G5, 0.004, 0, 0.6, 0, 1, , , , , 0.11, , , , , 0.6, 0.06, 0.12] },
    { at: 0, params: [0.16, 0, G5 * 2, 0.003, 0, 0.35, 0, 1, , , , , , , , , , 0.5, 0.04] },
    { at: 0, params: [0.07, 0, G5 * 3, 0.002, 0, 0.18] },
  ],
  // Sparkle (×Mult): a lower bell, about 3 dB under the chime, with more low end and gong-like
  // partials. Reserved: it plays for each ×Mult source and nothing else (§12, Sound; D-058).
  stamp: [
    { at: 0, params: [0.17, 0, C4, 0.005, 0, 1, 0, 1, , , , , 0.14, , , , , 0.6, 0.08, 0.15] },
    { at: 0, params: [0.155, 0, C3, 0.01, 0, 1.1, 0, 1, , , , , , , , , , 0.7, 0.1] },
    { at: 0, params: [0.054, 0, C4 * 2.76, 0.003, 0, 0.45] },
    { at: 0, params: [0.027, 0, C4 * 5.4, 0.002, 0, 0.2] },
  ],
  // A purchase, or a good gained (a crate's keep, a Copy Machine's copy): a coin's tick, then
  // a bright, short ding a fourth above it, G to C.
  buy: [
    { at: 0, params: [0.3, 0, G6, 0.001, 0.005, 0.03, 1, 1, , , , , , , , , , 1, , , -2600] },
    { at: 0.06, params: [0.26, 0, C7, 0.002, 0, 0.3, 0, 1, , , , , , , , , , 0.6, 0.02] },
    { at: 0.06, params: [0.05, 0, C7 * 2, 0.001, 0, 0.1] },
  ],
  // The multiply moment: a rising whoomp, a breath of noise, and a note to land on.
  total: [
    { at: 0, params: [0.55, 0, 110, 0.03, 0.05, 0.28, 0, 1, 1.2] },
    { at: 0, params: [0.15, 0, 300, 0.05, 0, 0.15, 4, 1, , , , , , , , , , 1, , , -700] },
    { at: 0.07, params: [0.25, 0, C5, 0.005, 0, 0.35, 1, 1, , , , , , , , , , 0.6, 0.04, , -1400] },
  ],
  // The run total counting up: a tiny tick.
  coin: one([0.32, 0, G6, 0.001, 0.005, 0.03, 1, 1, , , , , , , , , , 1, , , -2600]),
  // A big week: a cheerful rising arpeggio, C E G C, with an E on top.
  'big-week': [
    note(0, C5, 0.4, 0.25),
    note(0.085, E5, 0.4, 0.25),
    note(0.17, G5, 0.4, 0.3),
    note(0.255, C6, 0.42, 0.55),
    { at: 0.255, params: [0.15, 0, E6, 0.004, 0.02, 0.5, 0, 1, , , , , , , , , , 0.7, 0.03] },
  ],
  // A milestone met: a warm chord that swells and rises to C.
  milestone: [
    { at: 0, params: [0.3, 0, C4, 0.02, 0.05, 0.7, 1, 1, , , , , , , , , , 0.8, 0.05, , -900] },
    { at: 0, params: [0.22, 0, G4, 0.02, 0.05, 0.6, 1, 1, , , , , , , , , , 0.8, 0.05, , -900] },
    { at: 0, params: [0.16, 0, E5, 0.02, 0.05, 0.55, 0, 1, , , , , , , , , , 0.8, 0.05] },
    { at: 0.1, params: [0.3, 0, C5, 0.01, 0.1, 0.7, 0, 1, , , , , 0.12, , , , , 0.8, 0.05, 0.1] },
  ],
  // A milestone missed: a gentle falling E to C that droops a little.
  fail: [
    { at: 0, params: [0.38, 0, E4, 0.01, 0.06, 0.3, 1, 1, , , , , , , , , , 0.8, 0.04, , -800] },
    {
      at: 0.24,
      params: [0.38, 0, C4, 0.01, 0.1, 0.55, 1, 1, -0.03, , , , , , , , , 0.8, 0.05, , -800],
    },
  ],
  // UI: a light click, a tiny swish, and a soft low bonk.
  select: one([0.3, 0, 1400, 0.001, 0, 0.02, 1, 1, , , , , , , , , , 1, , , -2500]),
  rotate: one([0.18, 0, 900, 0.025, 0, 0.05, 4, 1, , , , , , , , , , 1, , , 1500]),
  illegal: one([0.5, 0, 150, 0.004, 0.02, 0.12, 1, 1, -0.6, , , , , , , , , 0.6, 0.02, , -700]),
  // The milestone target reached: a bright ding-ding, E then A.
  target: [
    { at: 0, params: [0.35, 0, E6, 0.002, 0, 0.3, 0, 1, , , , , , , , , , 0.6, 0.02] },
    { at: 0, params: [0.08, 0, E6 * 2, 0.001, 0, 0.12] },
    { at: 0.12, params: [0.35, 0, A6, 0.002, 0, 0.5, 0, 1, , , , , , , , , , 0.6, 0.02] },
    { at: 0.12, params: [0.07, 0, A6 * 2, 0.001, 0, 0.15] },
  ],
  // A light shimmer: C E G high up, each with a fast tremolo. The ladder's top adds it.
  sparkle: [
    { at: 0, params: [0.16, 0, C7, 0.005, 0, 0.22, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
    { at: 0.045, params: [0.14, 0, E7, 0.005, 0, 0.2, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
    { at: 0.09, params: [0.12, 0, G7, 0.005, 0, 0.25, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
  ],

  // ---- The juice PR's moments (D-124 to D-126): placeholders for M5b to replace ----
  // A Good week: a short chime, G up to C.
  'tier-good': [note(0, G5, 0.3, 0.25), note(0.09, C6, 0.34, 0.55)],
  // A Huge week: the full fanfare, C E G C rising into a held C major chord with a shimmer.
  'tier-huge': [
    note(0, C5, 0.34, 0.2),
    note(0.1, E5, 0.34, 0.2),
    note(0.2, G5, 0.34, 0.2),
    note(0.3, C6, 0.36, 0.3),
    note(0.45, G5, 0.26, 1.1),
    note(0.45, C6, 0.28, 1.1),
    note(0.45, E6, 0.3, 1.1),
    { at: 0.5, params: [0.1, 0, C7, 0.005, 0.1, 0.5, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
  ],
  // A set completing: a bright chord, G and C, with E on top a beat later.
  'set-complete': [note(0, G5, 0.28, 0.45), note(0, C6, 0.26, 0.5), note(0.07, E6, 0.28, 0.6)],
  // A Rhythm payout: ba-dum, a soft low double knock.
  rhythm: [
    {
      at: 0,
      params: [0.5, 0, 140, 0.002, 0.01, 0.1, 1, 1, -0.5, , , , , , , , , 0.6, 0.02, , -800],
    },
    {
      at: 0.13,
      params: [0.55, 0, 190, 0.002, 0.01, 0.15, 1, 1, -0.5, , , , , , , , , 0.6, , , -800],
    },
  ],
  // A find: a scoop of dirt, then a ta-da up to C.
  find: [
    { at: 0, params: [0.3, 0, 300, 0.01, 0.02, 0.12, 4, 1, , , , , , , , , , 1, , , -900] },
    note(0.12, G5, 0.3, 0.2),
    note(0.22, C6, 0.34, 0.55),
  ],
  // A crate opening: a creak of wood, a pop, and a note.
  'crate-open': [
    {
      at: 0,
      params: [0.22, 0, 220, 0.03, 0.08, 0.1, 2, 1, 0.8, , , , , 0.3, , , , 0.6, , , -1200],
    },
    { at: 0.14, params: [0.38, 0, 400, 0.001, 0.01, 0.06, 4, 1, , , , , , , , , , 1, , , -1500] },
    note(0.16, C6, 0.28, 0.4),
  ],
  // A Rare on the shelf: a shimmering bell, E high up.
  rare: [
    { at: 0, params: [0.24, 0, E6, 0.004, 0, 0.9, 0, 1, , , , , 0.06, , , , , 0.6, 0.05, 0.2] },
    { at: 0.05, params: [0.1, 0, E6 * 2, 0.003, 0, 0.5, 0, 1, , , , , 0.04, , , , , 1, , 0.5] },
    { at: 0.1, params: [0.08, 0, G7, 0.005, 0, 0.3, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
  ],
  // A client's wish met: a warm rising chime, E G C.
  'wish-met': [note(0, E5, 0.28, 0.3), note(0.08, G5, 0.3, 0.3), note(0.16, C6, 0.32, 0.6)],
  // A house rule met: a crisp check, C up to G.
  'rule-met': [note(0, C6, 0.28, 0.15), note(0.07, G6, 0.28, 0.35)],
  // A house rule lost: a soft low bonk that sags.
  'rule-lost': one([0.45, 0, 196, 0.004, 0.03, 0.2, 1, 1, -0.8, , , , , , , , , 0.6, 0.03, , -700]),
  // A Renovation's level-up: three notes up, C G C, with a glint.
  'level-up': [
    note(0, C5, 0.3, 0.15),
    note(0.07, G5, 0.3, 0.15),
    note(0.14, C6, 0.34, 0.45),
    { at: 0.14, params: [0.08, 0, C7, 0.003, 0, 0.2, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
  ],
  // The doorbell: ding-dong, E then C, a bell's long ring.
  doorbell: [
    { at: 0, params: [0.36, 0, E6, 0.002, 0, 0.9, 0, 1, , , , , 0.09, , , , , 0.6, 0.06, 0.08] },
    { at: 0, params: [0.08, 0, E6 * 2.4, 0.001, 0, 0.3] },
    { at: 0.32, params: [0.38, 0, C6, 0.002, 0, 1.1, 0, 1, , , , , 0.09, , , , , 0.6, 0.06, 0.08] },
    { at: 0.32, params: [0.08, 0, C6 * 2.4, 0.001, 0, 0.35] },
  ],
  // A change order's rubber stamp: a dull thunk on paper.
  'order-stamp': [
    { at: 0, params: [0.6, 0, 90, 0.001, 0.01, 0.12, 1, 1, -1, , , , , , , , , 0.5, 0.02, , -600] },
    { at: 0, params: [0.2, 0, 500, 0.001, 0, 0.05, 4, 1, , , , , , , , , , 1, , , -1200] },
  ],
  // Topped out: a quick rising cheer and a ring on top.
  'topped-out': [
    note(0, G4, 0.3, 0.12),
    note(0.06, C5, 0.3, 0.12),
    note(0.12, E5, 0.3, 0.12),
    note(0.18, G5, 0.32, 0.2),
    note(0.26, C6, 0.34, 0.7),
    { at: 0.26, params: [0.1, 0, C7, 0.004, 0, 0.6, 0, 1, , , , , 0.035, , , , , 1, , 0.5] },
  ],
  // The milestone moment's drumroll: a soft rolled snare under the count.
  drumroll: one([0.22, 0, 320, 0.05, 1.1, 0.15, 4, 1, , , , , 0.035, , , , , 0.7, , 0.9, -1600]),
  // A week's stamp: a soft papery flick.
  'week-start': one([0.12, 0, 900, 0.004, 0.02, 0.06, 4, 1, , , , , , , , , , 1, , , -1400]),
  // The last week's stamp: a clock's tick-tock, twice, fading.
  'last-week': [
    { at: 0, params: [0.18, 0, 1400, 0.001, 0, 0.03, 4, 1, , , , , , , , , , 1, , , -2000] },
    { at: 0.36, params: [0.18, 0, 1000, 0.001, 0, 0.03, 4, 1, , , , , , , , , , 1, , , -2000] },
    { at: 0.72, params: [0.12, 0, 1400, 0.001, 0, 0.03, 4, 1, , , , , , , , , , 1, , , -2000] },
    { at: 1.08, params: [0.12, 0, 1000, 0.001, 0, 0.03, 4, 1, , , , , , , , , , 1, , , -2000] },
  ],
};

export const SOUND_IDS = Object.keys(SOUNDS) as readonly SoundId[];

/** Mixes a sound's layers into one channel. Pure, so tests and tools can render sounds. */
export function renderSound(id: SoundId, sampleRate: number): Float32Array {
  const parts = SOUNDS[id].map((layer) => {
    const [volume, , ...rest] = layer.params;
    return {
      offset: Math.round(layer.at * sampleRate),
      samples: buildSamples(sampleRate, [volume, 0, ...rest]),
    };
  });
  const out = new Float32Array(Math.max(0, ...parts.map((p) => p.offset + p.samples.length)));
  for (const { offset, samples } of parts) {
    for (let i = 0; i < samples.length; i++) {
      out[offset + i] = (out[offset + i] ?? 0) + (samples[i] ?? 0);
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > MAX_PEAK) {
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) * (MAX_PEAK / peak);
  }
  return out;
}

// ---- The audio graph ----

let ctx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let roomSend: GainNode | null = null;
let resuming = false;
let voices = 0;
let volumes: Volumes = { master: 0.7, music: 0.7, sfx: 0.8 };
/** The placeholders, built the first time each plays. */
const buffers = new Map<SoundId, AudioBuffer>();
/** The recorded samples by cut id, once decoded (kit.ts). */
const samples = new Map<string, AudioBuffer>();
/** The sounds whose recipe has every sample it needs. */
const ready = new Set<SoundId>();
let preloading = false;
let decoding = false;
const nextFile = roundRobin();

function audioContextClass(): typeof AudioContext | undefined {
  const g = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

function createGraph(c: AudioContext): void {
  // A gentle limiter keeps stacked tally sounds from clipping.
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(c.destination);
  const master = c.createGain();
  master.gain.value = taper(volumes.master) * OUTPUT_TRIM;
  master.connect(limiter);
  const sfx = c.createGain();
  sfx.gain.value = taper(volumes.sfx);
  sfx.connect(master);
  const musicGain = c.createGain();
  musicGain.gain.value = taper(volumes.music) * MUSIC_TRIM;
  musicGain.connect(master);
  try {
    const room = c.createConvolver();
    room.buffer = roomImpulse(c, ROOM_SECONDS);
    room.connect(sfx);
    const send = c.createGain();
    send.gain.value = dbToGain(ROOM_SEND_DB);
    send.connect(room);
    roomSend = send;
  } catch {
    // No room: the sounds play dry.
  }
  masterBus = master;
  sfxBus = sfx;
  musicBus = musicGain;
  music.attach(c, musicGain);
  music.setEnabled(volumes.music > 0);
}

/** A soft room's impulse: decaying, darkening noise after a 10 ms pre-delay. */
function roomImpulse(c: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.round(c.sampleRate * seconds);
  const pre = Math.round(c.sampleRate * 0.01);
  const buffer = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let low = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre);
      // The tail darkens as it decays: a one-pole low-pass that closes as it goes.
      low += (0.6 - 0.45 * t) * (Math.random() * 2 - 1 - low);
      d[i] = low * (1 - t) ** 3;
    }
  }
  return buffer;
}

/** Fetches the sound set's files; they're decoded when audio unlocks. */
function preload(): void {
  if (preloading) return;
  preloading = true;
  for (const id of kitFiles()) prefetch(id).catch(() => {});
  music.prefetchFirst();
}

async function decodeKit(c: AudioContext): Promise<void> {
  if (decoding) return;
  decoding = true;
  preload();
  await Promise.all(
    kitFiles().map(async (id) => {
      try {
        samples.set(id, await loadBuffer(c, id));
      } catch {
        // Its sounds keep their placeholders.
      }
    }),
  );
}

function unlock(): void {
  try {
    if (!ctx) {
      const AudioContextClass = audioContextClass();
      if (!AudioContextClass) return; // No Web Audio: stay silent.
      const c = new AudioContextClass();
      createGraph(c);
      ctx = c;
      void decodeKit(c);
      music.start();
    }
    if (ctx.state !== 'running' && ctx.state !== 'closed' && !resuming) {
      resuming = true;
      const done = () => {
        resuming = false;
      };
      ctx.resume().then(done, done);
    }
  } catch {
    // A browser that refuses Web Audio leaves the game silent, never broken.
  }
}

const clamp01 = (v: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

function setVolumes(v: Volumes): void {
  volumes = {
    master: clamp01(v.master, volumes.master),
    music: clamp01(v.music, volumes.music),
    sfx: clamp01(v.sfx, volumes.sfx),
  };
  music.setEnabled(volumes.music > 0);
  if (!ctx || !masterBus || !sfxBus || !musicBus) return;
  const t = ctx.currentTime;
  masterBus.gain.setTargetAtTime(taper(volumes.master) * OUTPUT_TRIM, t, VOLUME_SMOOTHING_S);
  sfxBus.gain.setTargetAtTime(taper(volumes.sfx), t, VOLUME_SMOOTHING_S);
  musicBus.gain.setTargetAtTime(taper(volumes.music) * MUSIC_TRIM, t, VOLUME_SMOOTHING_S);
}

function bufferFor(c: BaseAudioContext, id: SoundId): AudioBuffer {
  let buffer = buffers.get(id);
  if (!buffer) {
    const samples = renderSound(id, c.sampleRate);
    buffer = c.createBuffer(1, Math.max(1, samples.length), c.sampleRate);
    buffer.getChannelData(0).set(samples);
    buffers.set(id, buffer);
  }
  return buffer;
}

const spread = (amount: number) => (Math.random() * 2 - 1) * amount;
const finite = (v: number | undefined, fallback: number) =>
  v !== undefined && Number.isFinite(v) ? v : fallback;
const dbToGain = (db: number) => 10 ** (db / 20);

/**
 * Starts one buffer `at` seconds from now, in the room if `room`; returns when it ends, or −1
 * if it didn't start.
 */
function voice(
  c: AudioContext,
  buffer: AudioBuffer,
  rate: number,
  gain: number,
  at: number,
  room = false,
): number {
  const bus = sfxBus;
  if (!bus || voices >= MAX_VOICES) return -1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate > 0 ? rate : 1;
  const v = c.createGain();
  v.gain.value = gain;
  source.connect(v);
  v.connect(bus);
  if (room && roomSend) v.connect(roomSend);
  source.onended = () => {
    voices--;
    source.disconnect();
    v.disconnect();
  };
  source.start(c.currentTime + at);
  voices++;
  return at + buffer.duration / source.playbackRate.value;
}

function hasSamples(id: SoundId, recipe: Recipe): boolean {
  if (ready.has(id)) return true;
  if (!recipeFiles(recipe).every((f) => samples.has(f))) return false;
  ready.add(id);
  return true;
}

/**
 * A recipe's layers. A caller's exact `rate` moves a pitched layer to the nearest note of the
 * key's pentatonic scale, and speeds an unpitched one up; otherwise unpitched layers get the
 * random rate spread, and every layer the gain spread (§12, Variation).
 */
function playRecipe(c: AudioContext, recipe: Recipe, opts: PlayOptions): void {
  const exact = opts.rate !== undefined;
  const requested = exact ? finite(opts.rate, 1) : 1;
  const shift = 12 * Math.log2(requested > 0 ? requested : 1);
  const gain = Math.max(0, finite(opts.gain, 1)) * dbToGain(exact ? 0 : spread(GAIN_SPREAD_DB));
  const delay = Math.max(0, finite(opts.delay, 0));
  const key = music.key();
  let end = 0;
  for (const layer of recipe.layers) {
    let file: string;
    let rate: number;
    if (isNote(layer)) {
      ({ file, rate } = pick(layer.inst, noteMidi(key, layer, shift)));
    } else {
      file = nextFile(layer.set);
      rate = (layer.rate ?? 1) * (exact ? requested : 1 + spread(RATE_SPREAD));
    }
    const buffer = samples.get(file);
    if (!buffer) continue;
    end = Math.max(
      end,
      voice(
        c,
        buffer,
        rate,
        gain * dbToGain(layer.db ?? 0),
        delay + (layer.at ?? 0),
        isNote(layer) || layer.set === 'wind-chimes',
      ),
    );
  }
  // A jingle ducks the music when it's the moment itself: played as written. The director also
  // reuses the jingles small (a checklist line lost is 'fail' at 1.45× and half gain), and a
  // pop like that shouldn't pull the music down.
  if (recipe.duck && end > 0 && !exact && (opts.gain ?? 1) >= 0.75) music.duck(end);
}

function playPlaceholder(c: AudioContext, id: SoundId, opts: PlayOptions): void {
  const exact = opts.rate !== undefined;
  const rate = exact ? finite(opts.rate, 1) : 1 + spread(RATE_SPREAD);
  const gainDb = exact ? 0 : spread(GAIN_SPREAD_DB);
  voice(
    c,
    bufferFor(c, id),
    rate,
    Math.max(0, finite(opts.gain, 1)) * dbToGain(gainDb),
    Math.max(0, finite(opts.delay, 0)),
  );
}

function play(id: SoundId, opts: PlayOptions = {}): void {
  const c = ctx;
  if (!c || !sfxBus || !(c.state === 'running' || resuming)) return;
  try {
    const recipe = RECIPES[id];
    if (recipe && hasSamples(id, recipe)) playRecipe(c, recipe, opts);
    else playPlaceholder(c, id, opts);
  } catch {
    // A sound that can't play is skipped.
  }
}

/** The tally's ladder: the plink up the music's pentatonic scale (§12, A pitch ladder in key). */
function ladder(step: number, opts: { delay?: number } = {}): void {
  const c = ctx;
  if (!c || !sfxBus || !(c.state === 'running' || resuming)) return;
  const key = music.key();
  const delay = Math.max(0, finite(opts.delay, 0));
  const recipe = RECIPES.plink;
  try {
    if (recipe && hasSamples('plink', recipe)) {
      const { file, rate } = pick(
        'marimba',
        homeTonic(key, 'marimba') + ladderSemitones(step, key),
      );
      const buffer = samples.get(file);
      if (buffer) voice(c, buffer, rate, dbToGain(LADDER_DB), delay, true);
    } else {
      const semitones = key.root + ladderSemitones(step, key) + LADDER_ROOT_SEMITONES;
      voice(c, bufferFor(c, 'plink'), 2 ** (semitones / 12), 1, delay);
    }
  } catch {
    // A sound that can't play is skipped.
  }
  if (step >= LADDER_TOP_STEP) {
    play('sparkle', { rate: 1, gain: LADDER_SPARKLE_GAIN, delay: opts.delay });
  }
}

function setScene(scene: Scene): void {
  music.setScene(scene);
}

function duck(seconds: number): void {
  music.duck(seconds);
}

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/** The game's one audio player. Its methods don't use `this`, so they can be passed around. */
export const audio: AudioApi = { unlock, preload, setVolumes, play, ladder, setScene, duck, now };

/** For the ?debug panel and checks in the browser: what's loaded and playing. */
export function audioStatus() {
  return {
    state: ctx?.state ?? 'locked',
    samples: `${samples.size}/${kitFiles().length}`,
    recorded: (Object.keys(RECIPES) as SoundId[]).filter((id) => hasSamples(id, RECIPES[id]!)),
    voices,
    music: music.status(),
    key: music.key(),
  };
}
