// Our small Web Audio wrapper (implementation-plan.md §12, "Sound" and "Audio
// implementation"; D-058). M1 has placeholder ZzFX sounds, a master bus, a sound-effect
// bus, and the tally's pitch ladder. M5 adds the music bus, stems, ducking, and the
// audio-clock scheduler. Nothing here runs at import: the AudioContext is created on the
// first unlock(), and each sound's buffer is built the first time it plays.

import { buildSamples, type ZzfxParams } from './zzfx.ts';

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
  | 'sparkle';

export interface PlayOptions {
  /** Exact playback rate. Giving one also turns off the random rate and gain spread. */
  rate?: number;
  /** Linear gain multiplier, default 1. */
  gain?: number;
  /** Seconds from now, on the audio clock. */
  delay?: number;
}

export interface AudioApi {
  unlock(): void;
  setVolumes(v: { master: number; sfx: number }): void;
  play(id: SoundId, opts?: PlayOptions): void;
  ladder(step: number, opts?: { delay?: number }): void;
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

/** The ladder climbs a major pentatonic scale: two octaves in ten steps. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;
export const LADDER_TOP_STEP = 10;
/** Step 0 is an octave below the plink's own pitch (C6), so the ladder spans C5 to C7. */
const LADDER_ROOT_SEMITONES = -12;
const LADDER_SPARKLE_GAIN = 0.35;

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

/** The ladder's pitch for a step, in semitones above its root. Holds at two octaves. */
export function ladderSemitones(step: number): number {
  if (step >= LADDER_TOP_STEP) return 24;
  const s = step > 0 ? Math.floor(step) : 0; // NaN lands on the root
  return 12 * Math.floor(s / PENTATONIC.length) + PENTATONIC[s % PENTATONIC.length]!;
}

// ---- The audio graph ----

let ctx: AudioContext | null = null;
let masterBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
// M5: a music bus goes here, beside sfxBus and into masterBus, with the stem crossfades
// and the ducking automation under tier jingles.
let resuming = false;
let voices = 0;
let volumes = { master: 0.7, sfx: 0.8 };
const buffers = new Map<SoundId, AudioBuffer>();

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
  masterBus = master;
  sfxBus = sfx;
}

function unlock(): void {
  try {
    if (!ctx) {
      const AudioContextClass = audioContextClass();
      if (!AudioContextClass) return; // No Web Audio: stay silent.
      const c = new AudioContextClass();
      createGraph(c);
      ctx = c;
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

function setVolumes(v: { master: number; sfx: number }): void {
  volumes = { master: clamp01(v.master, volumes.master), sfx: clamp01(v.sfx, volumes.sfx) };
  if (!ctx || !masterBus || !sfxBus) return;
  const t = ctx.currentTime;
  masterBus.gain.setTargetAtTime(taper(volumes.master) * OUTPUT_TRIM, t, VOLUME_SMOOTHING_S);
  sfxBus.gain.setTargetAtTime(taper(volumes.sfx), t, VOLUME_SMOOTHING_S);
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

function play(id: SoundId, opts: PlayOptions = {}): void {
  const c = ctx;
  const bus = sfxBus;
  if (!c || !bus || !(c.state === 'running' || resuming) || voices >= MAX_VOICES) return;
  try {
    const exact = opts.rate !== undefined;
    const rate = exact ? finite(opts.rate, 1) : 1 + spread(RATE_SPREAD);
    const gainDb = exact ? 0 : spread(GAIN_SPREAD_DB);
    const source = c.createBufferSource();
    source.buffer = bufferFor(c, id);
    source.playbackRate.value = rate > 0 ? rate : 1;
    const voice = c.createGain();
    voice.gain.value = Math.max(0, finite(opts.gain, 1)) * 10 ** (gainDb / 20);
    source.connect(voice);
    voice.connect(bus);
    source.onended = () => {
      voices--;
      source.disconnect();
      voice.disconnect();
    };
    source.start(c.currentTime + Math.max(0, finite(opts.delay, 0)));
    voices++;
  } catch {
    // A sound that can't play is skipped.
  }
}

function ladder(step: number, opts: { delay?: number } = {}): void {
  const rate = 2 ** ((ladderSemitones(step) + LADDER_ROOT_SEMITONES) / 12);
  play('plink', { rate, gain: 1, delay: opts.delay });
  if (step >= LADDER_TOP_STEP) {
    play('sparkle', { rate: 1, gain: LADDER_SPARKLE_GAIN, delay: opts.delay });
  }
}

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/** The game's one audio player. Its methods don't use `this`, so they can be passed around. */
export const audio: AudioApi = { unlock, setVolumes, play, ladder, now };
