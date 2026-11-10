// The app: the title screen, the job board, then the game screen (the top bar, the score panel,
// the checklist and inspect panels, the board, the hand or the end screen, and the controls
// strip), with overlays for banners, notes, first-time hints, the menu, settings, How to play,
// and the ?debug panel. The shop and (M4b) a change order are sheets over the board.

import { useEffect } from 'preact/hooks';
import { audio } from './audio/audio.ts';
import { startAudio } from './audio/scene.ts';
import { Board, rotate } from './board/Board.tsx';
import { toggleFit, zoomIn, zoomOut } from './board/camera.ts';
import { BUILD_LABEL } from './build-info.ts';
import { DebugPanel } from './debug/DebugPanel.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { busy, setHold, skip } from './fx/director.ts';
import {
  anyModalOpen,
  cancelPlacement,
  closeTopModal,
  requestEndWeek,
  selectCard,
  toggleDemolish,
} from './hud/actions.ts';
import { Checklist } from './hud/Checklist.tsx';
import { FirstHints } from './hud/FirstHints.tsx';
import { Hints } from './hud/Hints.tsx';
import './hud/board-chrome.css';
import { GameMenu } from './hud/Menu.tsx';
import { Hand } from './hud/Hand.tsx';
import { Inspect } from './hud/Inspect.tsx';
import { Inventory } from './hud/Inventory.tsx';
import { TipLayer } from './hud/Tip.tsx';
import { ScorePanel } from './hud/ScorePanel.tsx';
import { TopBar } from './hud/TopBar.tsx';
import { EndCaption, EndScreen } from './screens/EndScreen.tsx';
import { HowToPlay } from './screens/HowToPlay.tsx';
import {
  CopyFallback,
  MilestoneBanner,
  ModalToast,
  Notes,
  SmallScreenNotice,
  TargetFlash,
  useSkipOnClick,
} from './screens/Overlays.tsx';
import { SettingsPanel } from './screens/Settings.tsx';
import { ChangeOrderScreen, changeOrderKey } from './screens/ChangeOrderScreen.tsx';
import { JobBoard } from './screens/JobBoard.tsx';
import { ShopScreen } from './screens/ShopScreen.tsx';
import { Title } from './screens/Title.tsx';
import { appScreen, heldPiece, run, selected, tool } from './store.ts';

/** Esc closes the top sheet on any screen (modals.ts). */
function useModalKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && anyModalOpen()) {
        e.preventDefault();
        closeTopModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Whether the player is moving through the page with the keyboard (Tab) rather than the
 * mouse. Chrome makes any focused element match :focus-visible on a keydown, so that can't
 * tell a button reached with Tab from one that was clicked.
 */
let keyboardNav = false;
window.addEventListener('keydown', (e) => e.key === 'Tab' && (keyboardNav = true), true);
window.addEventListener('pointerdown', () => (keyboardNav = false), true);

function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      // A key a sheet already handled (Esc closing Settings) does nothing else.
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      // Sheets take the keyboard; useModalKeys closes them on Esc.
      if (anyModalOpen()) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (target?.tagName === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A button or link the player reached with Tab keeps Enter and Space. One that only has
      // focus because it was clicked doesn't, so Enter after clicking a button still ends the
      // week.
      const keyboardFocused = !!target?.closest('button, a, [role=button]') && keyboardNav;
      if ((e.key === 'Enter' || e.key === ' ') && keyboardFocused) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (busy.value) setHold(true);
        return;
      }
      if (run.value.screen === 'changeOrder') {
        // M4b: a change order waits for its answer. Only the sheet's keys work (Enter accepts,
        // Esc or D declines one that can be declined); nothing reaches the week's controls
        // behind it. Before the sheet is up, the milestone's beats play over the board: Esc
        // skips them, and the camera's keys still work. Enter is always claimed, as below.
        if (e.key === 'Enter') e.preventDefault();
        if (e.repeat) return;
        if (!busy.value) {
          if (changeOrderKey(e.key)) e.preventDefault();
        } else if (e.key === 'Escape') skip();
        else if (e.key === '+' || e.key === '=') zoomIn();
        else if (e.key === '-' || e.key === '_') zoomOut();
        else if (e.key === 'f' || e.key === 'F') toggleFit();
        return;
      }
      if (e.key === 'Enter') {
        // Always claim Enter, repeats included, so holding it can't click a focused button
        // over and over and pass week after week.
        e.preventDefault();
        if (!e.repeat) requestEndWeek();
        return;
      }
      if (e.repeat) return;
      if (/^[1-9]$/.test(e.key)) {
        // The hand is 4 cards, or more with a crew or a blueprint (D-121).
        selectCard(Number(e.key) - 1);
      } else if (e.key === 'r' || e.key === 'R') {
        // In demolish mode a pending placement is hidden, so R leaves it alone.
        if (selected.value !== null && tool.value !== 'demolish') rotate();
      } else if (e.key === 'd' || e.key === 'D') {
        if (run.value.screen === 'build') toggleDemolish();
      } else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === 'f' || e.key === 'F') toggleFit();
      else if (e.key === 'Escape') {
        if (busy.value) skip();
        else cancelPlacement();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setHold(false);
    };
    // A key or button released outside the window never sends its up event.
    const release = () => setHold(false);
    const onVisibility = () => document.hidden && release();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

function Game() {
  useKeyboard();
  useSkipOnClick();
  const screen = run.value.screen;
  const over = (screen === 'won' || screen === 'lost') && !busy.value;
  // A play being looked at (placing, installing, a tool, demolishing), or a piece held in
  // Inspect by a click: Inspect gets the left column's room first, so its preview, warnings,
  // Use button, or the held piece's notes are in view (app.css).
  const looking = selected.value !== null || tool.value === 'demolish' || heldPiece.value !== null;
  const right = over ? (
    <EndScreen />
  ) : screen === 'shop' ? (
    <Inventory shop />
  ) : (
    <>
      <Inventory />
      <Hand />
    </>
  );
  return (
    <div class="game">
      <TopBar />
      <aside class={looking ? 'left looking' : 'left'}>
        <ScorePanel />
        {/* What the score panel leaves, which the checklist and Inspect share (app.css). */}
        <div class="left-rest">
          <Checklist />
          <Inspect />
        </div>
      </aside>
      <main class="center">
        <Board />
        <Notes />
        <MilestoneBanner />
        <TargetFlash />
        <EndCaption />
        <ShopScreen />
        <ChangeOrderScreen />
      </main>
      <aside class="right">{right}</aside>
      <Hints />
    </div>
  );
}

export function App() {
  useModalKeys();
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    // M5b: the music follows the screen, and the sound files load once the first one is up.
    const stopAudio = startAudio();
    return () => {
      window.removeEventListener('pointerdown', unlock);
      stopAudio();
    };
  }, []);
  // The game screen shows its notes over the board (.center); the title and the job board show
  // theirs at the top of the window (overlays.css's .title-screen ~ .notes).
  const screen = appScreen.value;
  return (
    <>
      <ErrorBoundary>
        {screen === 'game' ? (
          <Game />
        ) : (
          <>
            {screen === 'jobs' ? <JobBoard /> : <Title />}
            <Notes />
          </>
        )}
        {screen === 'game' && <FirstHints />}
        <GameMenu />
        <HowToPlay />
        <SettingsPanel />
        <CopyFallback />
        <ModalToast />
        <TipLayer />
      </ErrorBoundary>
      <SmallScreenNotice />
      <DebugPanel />
      <BuildLabel />
    </>
  );
}

function BuildLabel() {
  return (
    <div class="build-label" title="Build: channel · git commit">
      {BUILD_LABEL}
    </div>
  );
}
