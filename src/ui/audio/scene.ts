// Which screen the music is mixed for (M5b; §12, Synced stems): the title, the job board, the
// week's build, the shop, an open crate, a milestone's review, and a run won or lost. It follows
// what the player sees, not the rules: the rules move on to the shop (or the end) as soon as a
// milestone's week is played, while the tally and the milestone's beats still play over the
// board, so a run already in the shop or over is "review" until the beats are done.

import { effect } from '@preact/signals';
import type { RunState } from '../../rules/index.ts';
import { busy } from '../fx/director.ts';
import { appScreen, run } from '../store.ts';
import { audio } from './audio.ts';
import type { Scene } from './tracks.ts';

export function sceneFor(
  app: 'title' | 'jobs' | 'game',
  screen: RunState['screen'],
  picking: boolean,
  playing: boolean,
): Scene {
  if (app === 'title') return 'title';
  if (app === 'jobs') return 'menu';
  switch (screen) {
    case 'build':
      return 'build';
    case 'changeOrder':
      return 'review';
    case 'shop':
      return playing ? 'review' : picking ? 'crate' : 'shop';
    case 'won':
      return playing ? 'review' : 'won';
    case 'lost':
      return playing ? 'review' : 'lost';
  }
}

/** How long after the page has loaded the sound files start loading (§12, Files). */
const PRELOAD_DELAY_MS = 600;

/** The small-screen notice's window (overlays.css, D-047). */
const SMALL_SCREEN = '(max-width: 899px), (max-height: 499px)';

/**
 * Mixes the music for each screen from now on, and loads the sounds once the page is up: after
 * its fonts and art, which on a slow link they used to hold up, leaving the title's sign empty.
 * Behind the small-screen notice they don't load at all until the sound unlocks (a phone may
 * never play): the first click loads the set then, as a preload that hasn't run does.
 */
export function startAudio(): () => void {
  const stop = effect(() => {
    const s = run.value;
    audio.setScene(sceneFor(appScreen.value, s.screen, !!s.offers?.pick, busy.value));
  });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((resolve) =>
          window.addEventListener('load', () => resolve(), { once: true }),
        );
  void Promise.all([loaded, document.fonts?.ready]).then(() => {
    if (stopped || window.matchMedia?.(SMALL_SCREEN).matches) return;
    timer = setTimeout(() => audio.preload(), PRELOAD_DELAY_MS);
  });
  return () => {
    stopped = true;
    stop();
    clearTimeout(timer);
  };
}
