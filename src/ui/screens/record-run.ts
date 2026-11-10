// Files a run in the company's record when it ends (D-139; company.ts), and paints its photo:
// the finished house through the end screen's frame (photos.ts, photo-paint.ts), kept as a small
// picture so the portfolio can show it after a game update.
//
// Only a run this browser played to its end is filed: the action that ends it comes through the
// store's dispatch. A run that loads already finished (a ?run= code, the save) isn't, and nor
// is a debug run, whose cheats would set records.

import { effect, signal } from '@preact/signals';
import { CONTENT, rules, type RunState } from '../../rules/index.ts';
import { fileJob, fileJobPhoto, jobKey, type Job } from '../company.ts';
import { busy } from '../fx/director.ts';
import { inProgress, onEvents } from '../store.ts';
import { paintPhoto } from './photo-paint.ts';
import { photoFrame } from './photos.ts';

/** The record's entry for a run that has ended. */
export function jobOf(s: RunState, at: number): Job {
  return {
    seed: s.setup.seed,
    clientId: s.setup.clientId,
    crewId: s.setup.crewId,
    won: s.screen === 'won',
    score: s.score,
    verdict: rules.verdict(s),
    milestones: s.milestones.filter((m) => m.result !== 'failed').length,
    phases: CONTENT.balance.phases.length,
    at,
  };
}

/** The run whose photo is still to paint: it waits for the last tally, so that never hitches. */
const unpainted = signal<{ key: string; state: RunState } | null>(null);

/**
 * The stored photo's width, in px: twice the portfolio's polaroid, for sharp screens. At art
 * resolution a photo is about 140 KB as a PNG data URL; this size as a JPEG is about a quarter
 * of that, and the browser's storage is shared by every channel on the site.
 */
const PHOTO_W = 320;
const PHOTO_QUALITY = 0.85;

/** A painted photo, scaled down smoothly (as the portfolio shows it) and encoded to store. */
function encode(photo: HTMLCanvasElement): string {
  const scale = Math.min(1, PHOTO_W / photo.width);
  const small = document.createElement('canvas');
  small.width = Math.round(photo.width * scale);
  small.height = Math.round(photo.height * scale);
  const ctx = small.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(photo, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', PHOTO_QUALITY);
}

async function paint(key: string, state: RunState): Promise<void> {
  try {
    fileJobPhoto(key, encode(await paintPhoto(state, photoFrame(state.house))));
  } catch (e) {
    // The house is filed without its photo.
    console.error(e);
  }
}

let started = false;

/** Starts filing runs as they end. Called once, by the app. */
export function startRecording(): void {
  if (started) return;
  started = true;
  onEvents((_events, before, after) => {
    if (!inProgress(before) || inProgress(after) || after.debug) return;
    const job = jobOf(after, Date.now());
    fileJob(job);
    // After the other listeners: the director has the last tally playing by then.
    queueMicrotask(() => (unpainted.value = { key: jobKey(job), state: after }));
  });
  effect(() => {
    const next = unpainted.value;
    if (busy.value || !next) return;
    unpainted.value = null;
    void paint(next.key, next.state);
  });
}
