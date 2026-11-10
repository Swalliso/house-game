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

/** How long after the first screen is up the sound files start loading (§12, Files). */
const PRELOAD_DELAY_MS = 600;

/** Mixes the music for each screen from now on, and loads the sounds once the page is up. */
export function startAudio(): () => void {
  const stop = effect(() => {
    const s = run.value;
    audio.setScene(sceneFor(appScreen.value, s.screen, !!s.offers?.pick, busy.value));
  });
  const timer = setTimeout(() => audio.preload(), PRELOAD_DELAY_MS);
  return () => {
    stop();
    clearTimeout(timer);
  };
}
