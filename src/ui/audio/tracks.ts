// The music (M5b; implementation-plan.md §12, Music; D-058): the tracks the player shuffles
// through, and how each screen mixes them. Data only; music.ts plays it.
//
// A track is one or more stems of the same length, tempo, and key, cut by `npm run audio:cut`
// from art/audio.json into assets/audio/music/<track>/. They start together and never restart
// on a screen change: each screen crossfades to its own mix (§12, Synced stems). A track with
// one stem changes with the screen through the music bus's filter and level instead.

import type { Key } from './kit.ts';

/** What the player is looking at, as far as the music cares. */
export type Scene = 'title' | 'menu' | 'build' | 'shop' | 'crate' | 'review' | 'won' | 'lost';

export const SCENES: readonly Scene[] = [
  'title',
  'menu',
  'build',
  'shop',
  'crate',
  'review',
  'won',
  'lost',
];

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** The ladder and the jingles play in it (kit.ts). */
  readonly key: Key;
  readonly bpm: number;
  /** Cut ids, all the same length: music/<track>/<stem>. */
  readonly stems: readonly string[];
  /** Each stem's gain on a screen, in `stems` order; a screen not listed plays them all at 1. */
  readonly mix?: Partial<Record<Scene, readonly number[]>>;
}

/**
 * Each screen's music bus: its level and a low-pass filter's cutoff. The shop and the job board
 * sound a room away, a crate's reveal hushes it, and the build screen plays it plain.
 */
export const SCENE_MIX: Readonly<
  Record<Scene, { readonly level: number; readonly cutoff: number }>
> = {
  title: { level: 0.75, cutoff: 2200 },
  menu: { level: 0.85, cutoff: 4500 },
  build: { level: 1, cutoff: 20000 },
  shop: { level: 0.85, cutoff: 3000 },
  crate: { level: 0.65, cutoff: 1300 },
  review: { level: 0.95, cutoff: 9000 },
  won: { level: 1, cutoff: 20000 },
  lost: { level: 0.85, cutoff: 5000 },
};

/** The tracks, in no particular order: the player shuffles them. Chosen by ear (D-128). */
export const TRACKS: readonly Track[] = [];
