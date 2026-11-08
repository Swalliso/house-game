// The game menu (M5a): the top bar's Menu button opens it, and Esc or Resume closes it. It holds
// what the top bar no longer shows: Copy run code and the run's seed, with How to play,
// Settings, and Quit to title (the run is saved, so Continue picks it up again). While it's
// open it holds the keyboard: Resume takes focus, Tab stays inside it, and focus goes back to
// the Menu button when it closes.

import { useRef } from 'preact/hooks';
import { Button, Panel, useDialogFocus, useScrimClose } from '../kit/kit.tsx';
import { goToTitle, inProgress, run } from '../store.ts';
import { copyRunCode, howToPlayOpen, menuOpen, openSettings } from './actions.ts';
import './menu.css';

export function GameMenu() {
  return menuOpen.value ? <MenuSheet /> : null;
}

function MenuSheet() {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const close = () => (menuOpen.value = false);
  const quit = () => {
    close();
    goToTitle();
  };
  return (
    <div class="menu-backdrop" {...useScrimClose(close)}>
      <div ref={sheet} class="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <Panel title="Menu">
          <Button variant="primary" size="lg" block onClick={close} data-autofocus>
            Resume
          </Button>
          <Button block icon="help" onClick={() => (howToPlayOpen.value = true)}>
            How to play
          </Button>
          <Button block icon="gear" onClick={openSettings}>
            Settings
          </Button>
          <Button
            block
            icon="copy"
            onClick={() => void copyRunCode()}
            title="Copy a code that replays this run exactly"
          >
            Copy run code
          </Button>
          <p class="menu-seed">
            Seed <span class="menu-seed-value">{run.value.setup.seed}</span>
          </p>
          <Button block icon="exit" onClick={quit} title="Back to the title screen">
            Quit to title
          </Button>
          {inProgress() && <p class="menu-note">Your run is saved: Continue picks it up.</p>}
        </Panel>
      </div>
    </div>
  );
}
