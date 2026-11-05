// The app: the title screen, then the game screen (the top bar, the score and inspect panels,
// the board, the hand or the end screen, and the controls strip), with overlays for banners,
// notes, settings, How to play, and the ?debug panel.

import { useEffect } from 'preact/hooks';
import { audio } from './audio/audio.ts';
import { Board, rotate } from './board/Board.tsx';
import { toggleFit, zoomIn, zoomOut } from './board/camera.ts';
import { BUILD_LABEL } from './build-info.ts';
import { DebugPanel } from './debug/DebugPanel.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { busy, setHold, skip } from './fx/director.ts';
import {
  cancelPlacement,
  copyFallback,
  howToPlayOpen,
  requestEndWeek,
  selectCard,
  settingsOpen,
  toggleDemolish,
} from './hud/actions.ts';
import { Hand } from './hud/Hand.tsx';
import { Inspect } from './hud/Inspect.tsx';
import { ScorePanel } from './hud/ScorePanel.tsx';
import { TopBar } from './hud/TopBar.tsx';
import { EndCaption, EndScreen } from './screens/EndScreen.tsx';
import { HowToPlay } from './screens/HowToPlay.tsx';
import {
  CopyFallback,
  MilestoneBanner,
  Notice,
  SmallScreenNotice,
  TargetFlash,
  Toast,
  useSkipOnClick,
} from './screens/Overlays.tsx';
import { SettingsPanel } from './screens/Settings.tsx';
import { Title } from './screens/Title.tsx';
import { appScreen, run, selected } from './store.ts';

function anyModalOpen(): boolean {
  return settingsOpen.value || howToPlayOpen.value || !!copyFallback.value;
}

function closeModals(): void {
  settingsOpen.value = false;
  howToPlayOpen.value = false;
  copyFallback.value = null;
}

/** Esc closes a sheet on any screen. */
function useModalKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && anyModalOpen()) {
        e.preventDefault();
        closeModals();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      const target = e.target instanceof HTMLElement ? e.target : null;
      // Sheets take the keyboard; useModalKeys closes them on Esc.
      if (anyModalOpen()) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (target?.tagName === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A button or link the player reached with the keyboard keeps Enter and Space. One that
      // only has focus because it was clicked (not :focus-visible) doesn't, so Enter after
      // clicking a card still ends the week.
      const keyboardFocused =
        !!target?.closest('button, a, [role=button]') && target.matches(':focus-visible');
      if ((e.key === 'Enter' || e.key === ' ') && keyboardFocused) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (busy.value) setHold(true);
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
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        selectCard(Number(e.key) - 1);
      } else if (e.key === 'r' || e.key === 'R') {
        if (selected.value !== null) rotate();
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
  const over = run.value.screen !== 'build' && !busy.value;
  return (
    <div class="game">
      <TopBar />
      <aside class="left">
        <ScorePanel />
        <Inspect />
      </aside>
      <main class="center">
        <Board />
        <MilestoneBanner />
        <TargetFlash />
        <EndCaption />
      </main>
      <aside class="right">{over ? <EndScreen /> : <Hand />}</aside>
      <footer class="hints">
        Pick a card (1–3) · R or right-click to rotate · click to place · Enter to end the week · D
        to demolish · scroll to zoom, drag to pan, F to fit · hold Space to speed up the tally,
        click to skip it
      </footer>
    </div>
  );
}

export function App() {
  useModalKeys();
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  return (
    <>
      <ErrorBoundary>
        {appScreen.value === 'title' ? <Title /> : <Game />}
        <Notice />
        <Toast />
        <HowToPlay />
        <SettingsPanel />
        <CopyFallback />
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
