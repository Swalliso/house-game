// The game menu (M5a): the top bar's Menu button opens it, and Esc or Resume closes it. It holds
// what the top bar no longer shows: Copy run code and the run's seed, with How to play,
// Settings, and Quit to title (the run is saved, so Continue picks it up again). While it's
// open it holds the keyboard: Resume takes focus, Tab stays inside it, and focus goes back to
// the Menu button when it closes. M4's client and crew are beside the seed (D-110), as the
// checklist's plank and chip show them during the run.

import { useRef } from 'preact/hooks';
import { CONTENT } from '../../rules/index.ts';
import { Button, Chip, Panel, useDialogFocus, useScrimClose } from '../kit/kit.tsx';
import { CREW_ICONS } from '../sprites.ts';
import { bugReportUrl } from '../ErrorBoundary.tsx';
import { goToTitle, inProgress, run, runCode } from '../store.ts';
import { copyRunCode, howToPlayOpen, menuOpen, openSettings } from './actions.ts';
import './menu.css';

export function GameMenu() {
  return menuOpen.value ? <MenuSheet /> : null;
}

function MenuSheet() {
  const sheet = useRef<HTMLDivElement>(null);
  useDialogFocus(sheet);
  const close = () => (menuOpen.value = false);
  const setup = run.value.setup;
  const quit = () => {
    close();
    goToTitle();
  };
  const reportBug = () => window.open(bugReportUrl(runCode()), '_blank', 'noopener,noreferrer');
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
            tip="Copy a code that replays this run exactly"
          >
            Copy run code
          </Button>
          <dl class="menu-run">
            <div class="menu-run-row">
              <dt>Client</dt>
              <dd>{CONTENT.clients[setup.clientId].name}</dd>
            </div>
            <div class="menu-run-row">
              <dt>Crew</dt>
              <dd>
                <Chip tone="wood" icon={CREW_ICONS[setup.crewId]}>
                  {CONTENT.crews[setup.crewId].name}
                </Chip>
              </dd>
            </div>
            <div class="menu-run-row menu-seed">
              <dt>Seed</dt>
              <dd class="menu-seed-value">{setup.seed}</dd>
            </div>
          </dl>
          {/* A friend who sees something wrong: a GitHub issue with the build and this run's
              code filled in, so it replays (the crash screen's form). */}
          <Button
            block
            icon="flag"
            onClick={reportBug}
            tip="Open a bug report on GitHub with this run's code"
          >
            Report a bug
          </Button>
          <Button block icon="exit" onClick={quit} tip="Back to the title screen">
            Quit to title
          </Button>
          {inProgress() && <p class="menu-note">Your run is saved: Continue picks it up.</p>}
        </Panel>
      </div>
    </div>
  );
}
