// The music bus (M5b; implementation-plan.md §12, Music, Ducking and Losing; D-058). It plays
// the tracks in a shuffled order with a short rest between them, and never restarts one on a
// screen change: each screen crossfades the track's stems and the bus's filter and level to
// its own mix (tracks.ts). Tier jingles duck it, and losing a run glides it down to 0.6× speed
// instead of cutting it off, as Balatro does. It's silent until the first click unlocks audio,
// and a music volume of 0 stops it (and loads nothing).
//
// The graph: each stem → its gain → the track's fade → the scene's level → the scene's
// low-pass → the duck → the music bus (audio.ts, the music volume) → the master bus.

import { DEFAULT_KEY, type Key } from './kit.ts';
import { loadBuffer, prefetch } from './loader.ts';
import { SCENE_MIX, TRACKS, type Scene, type Track } from './tracks.ts';

// ---- Feel numbers (§12) ----

/** Screen changes crossfade with about a 0.3 s time constant. */
const CROSSFADE_TAU_S = 0.3;
/** Ducking: down 10 dB over 50 ms, back over a second. */
const DUCK_DB = -10;
const DUCK_ATTACK_S = 0.05;
const DUCK_RELEASE_S = 1;
/** Losing: the music glides to 0.6× speed over a second, and back over 1.5 s for a new run. */
export const LOSE_RATE = 0.6;
const LOSE_GLIDE_S = 1;
const RECOVER_GLIDE_S = 1.5;
/** A rest between tracks, and a fade in for the first one (and after the music is turned on). */
const GAP_S = 2.5;
const FADE_IN_S = 2.5;
const FADE_OUT_TAU_S = 0.4;

export interface MusicStatus {
  track: string | null;
  scene: Scene;
  rate: number;
  enabled: boolean;
}

interface Playing {
  readonly track: Track;
  readonly sources: readonly AudioBufferSourceNode[];
  readonly stems: readonly GainNode[];
  readonly fade: GainNode;
}

let ctx: AudioContext | null = null;
let sceneGain: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let duckGain: GainNode | null = null;
let scene: Scene = 'title';
let enabled = true;
let started = false;
let current: Playing | null = null;
let last: Track | null = null;
let queue: Track[] = [];
let rate = 1;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumped when the music stops, so a track still loading for the old run doesn't start. */
let generation = 0;
let failures = 0;
let duckedUntil = 0;
/** The tracks to play; tests and the ?debug panel can swap them. */
let tracks: readonly Track[] = TRACKS;

/** Each stem's gain on a screen. */
export function stemLevels(track: Track, on: Scene): number[] {
  const mix = track.mix?.[on];
  return track.stems.map((_, i) => Math.max(0, mix?.[i] ?? 1));
}

/**
 * The next tracks in a shuffled order: every track once before any repeats, and never the one
 * that just played first. `random` is the UI's own Math.random by default.
 */
export function shuffled(
  all: readonly Track[],
  previous: Track | null,
  random: () => number = Math.random,
): Track[] {
  const order = [...all];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (order.length > 1 && order[0] === previous) [order[0], order[1]] = [order[1]!, order[0]!];
  return order;
}

function upcoming(): Track | undefined {
  if (queue.length === 0) queue = shuffled(tracks, last);
  return queue[0];
}

function attach(c: AudioContext, out: AudioNode): void {
  ctx = c;
  duckGain = c.createGain();
  duckGain.connect(out);
  filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0;
  filter.connect(duckGain);
  sceneGain = c.createGain();
  sceneGain.connect(filter);
  const mix = SCENE_MIX[scene];
  sceneGain.gain.value = mix.level;
  filter.frequency.value = Math.min(mix.cutoff, c.sampleRate / 2);
}

function disconnect(p: Playing): void {
  for (const node of [...p.sources, ...p.stems, p.fade]) {
    try {
      node.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}

function clearGap(): void {
  if (gapTimer !== null) clearTimeout(gapTimer);
  gapTimer = null;
}

function scheduleNext(seconds: number, fadeIn: boolean): void {
  clearGap();
  gapTimer = setTimeout(() => {
    gapTimer = null;
    void playNext(fadeIn);
  }, seconds * 1000);
}

async function playNext(fadeIn: boolean): Promise<void> {
  const c = ctx;
  const into = sceneGain;
  if (!c || !into || !enabled || !started || current || tracks.length === 0) return;
  const track = upcoming();
  if (!track) return;
  queue.shift();
  const gen = generation;
  let buffers: AudioBuffer[];
  try {
    buffers = await Promise.all(track.stems.map((id) => loadBuffer(c, id)));
  } catch {
    // A track that won't load is skipped; after every track has failed twice, the music stops.
    failures++;
    if (gen === generation && failures < tracks.length * 2) scheduleNext(GAP_S, fadeIn);
    return;
  }
  if (gen !== generation || !enabled || current) return;
  failures = 0;
  const t = c.currentTime + 0.05;
  const fade = c.createGain();
  fade.connect(into);
  if (fadeIn) {
    fade.gain.setValueAtTime(0, t);
    fade.gain.linearRampToValueAtTime(1, t + FADE_IN_S);
  }
  const levels = stemLevels(track, scene);
  const stems = buffers.map((_, i) => {
    const g = c.createGain();
    g.gain.value = levels[i]!;
    g.connect(fade);
    return g;
  });
  const sources = buffers.map((buffer, i) => {
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = rate;
    s.connect(stems[i]!);
    s.start(t);
    return s;
  });
  const playing: Playing = { track, sources, stems, fade };
  current = playing;
  last = track;
  sources[0]!.onended = () => {
    if (current !== playing) return;
    current = null;
    disconnect(playing);
    scheduleNext(GAP_S, false);
  };
  // The next track's bytes load while this one plays; it's decoded when it's due.
  const next = upcoming();
  if (next && next !== track) for (const id of next.stems) prefetch(id).catch(() => {});
}

function stopCurrent(): void {
  const p = current;
  current = null;
  if (!p || !ctx) return;
  const t = ctx.currentTime;
  const g = p.fade.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.setTargetAtTime(0, t, FADE_OUT_TAU_S);
  const end = t + FADE_OUT_TAU_S * 6;
  for (const s of p.sources) {
    s.onended = null;
    try {
      s.stop(end);
    } catch {
      // Never started.
    }
  }
  setTimeout(() => disconnect(p), (end - t + 0.5) * 1000);
}

function glide(to: number, seconds: number): void {
  rate = to;
  if (!ctx || !current) return;
  const t = ctx.currentTime;
  for (const s of current.sources) {
    const r = s.playbackRate;
    r.cancelScheduledValues(t);
    r.setValueAtTime(r.value, t);
    r.linearRampToValueAtTime(to, t + seconds);
  }
}

/** Starts the music once audio is unlocked (audio.ts). */
function start(): void {
  started = true;
  if (enabled && !current && gapTimer === null) void playNext(true);
}

/** Turned off (music volume 0), the track fades out and nothing more loads. */
function setEnabled(on: boolean): void {
  if (on === enabled) return;
  enabled = on;
  if (!on) {
    generation++;
    clearGap();
    stopCurrent();
  } else if (started && !current && gapTimer === null) {
    void playNext(true);
  }
}

function setScene(next: Scene): void {
  if (next === scene) return;
  scene = next;
  const wantRate = next === 'lost' ? LOSE_RATE : 1;
  if (wantRate !== rate) glide(wantRate, wantRate < 1 ? LOSE_GLIDE_S : RECOVER_GLIDE_S);
  if (!ctx || !sceneGain || !filter) return;
  const t = ctx.currentTime;
  const mix = SCENE_MIX[next];
  sceneGain.gain.setTargetAtTime(mix.level, t, CROSSFADE_TAU_S);
  filter.frequency.setTargetAtTime(Math.min(mix.cutoff, ctx.sampleRate / 2), t, CROSSFADE_TAU_S);
  if (current) {
    const levels = stemLevels(current.track, next);
    current.stems.forEach((g, i) => g.gain.setTargetAtTime(levels[i]!, t, CROSSFADE_TAU_S));
  }
}

/** Ducks the music under a jingle for `seconds`, then lets it back up (§12, Ducking). */
function duck(seconds: number): void {
  if (!ctx || !duckGain) return;
  const t = ctx.currentTime;
  const until = t + DUCK_ATTACK_S + Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  if (until <= duckedUntil) return;
  duckedUntil = until;
  const low = 10 ** (DUCK_DB / 20);
  const g = duckGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(low, t + DUCK_ATTACK_S);
  g.setValueAtTime(low, until);
  g.linearRampToValueAtTime(1, until + DUCK_RELEASE_S);
}

/** The key the music is in: the playing track's, or the last one's. */
function key(): Key {
  return (current?.track ?? last)?.key ?? DEFAULT_KEY;
}

function status(): MusicStatus {
  return { track: current?.track.id ?? null, scene, rate, enabled };
}

/** Plays these tracks from now on (the ?debug panel's audition, and tests). */
function useTracks(list: readonly Track[]): void {
  tracks = list;
  queue = [];
  generation++;
  clearGap();
  stopCurrent();
  if (started && enabled) scheduleNext(FADE_OUT_TAU_S * 2, true);
}

/** The game's one music player. Its methods don't use `this`. */
export const music = {
  attach,
  start,
  setEnabled,
  setScene,
  duck,
  key,
  status,
  useTracks,
};
