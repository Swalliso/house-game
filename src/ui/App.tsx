// The M1 slice's one screen: the top bar, the score and inspect panels, the board, the hand,
// and the controls strip, with overlays for banners, the end screen, and settings.

import { useEffect } from 'preact/hooks';
import { audio } from './audio/audio.ts';
import { Board, rotate } from './board/Board.tsx';
import { BUILD_LABEL } from './build-info.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { busy, setHold, skip } from './fx/director.ts';
import {
  cancelPlacement,
  copyFallback,
  requestEndWeek,
  selectCard,
  settingsOpen,
} from './hud/actions.ts';
import { Hand } from './hud/Hand.tsx';
import { Inspect } from './hud/Inspect.tsx';
import { ScorePanel } from './hud/ScorePanel.tsx';
import { TopBar } from './hud/TopBar.tsx';
import {
  CopyFallback,
  EndScreen,
  MilestoneBanner,
  Notice,
  SmallScreenNotice,
  TargetFlash,
  Toast,
  useSkipOnClick,
} from './screens/Overlays.tsx';
import { SettingsPanel } from './screens/Settings.tsx';
import { selected } from './store.ts';

function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      audio.unlock();
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (settingsOpen.value || copyFallback.value) {
        if (e.key === 'Escape') {
          settingsOpen.value = false;
          copyFallback.value = null;
        }
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (busy.value) setHold(true);
        return;
      }
      if (e.repeat) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') selectCard(Number(e.key) - 1);
      else if (e.key === 'r' || e.key === 'R') {
        if (selected.value !== null) rotate();
      } else if (e.key === 'Escape') {
        if (busy.value) skip();
        else cancelPlacement();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        requestEndWeek();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setHold(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, []);
}

function Game() {
  useKeyboard();
  useSkipOnClick();
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
      </main>
      <aside class="right">
        <Hand />
        <EndScreen />
      </aside>
      <footer class="hints">
        Pick a card (1–3) · R or right-click to rotate · click to place · Enter to end the week ·
        hold Space to speed up the tally, click to skip it
      </footer>
      <Notice />
      <Toast />
      <SettingsPanel />
      <CopyFallback />
    </div>
  );
}

export function App() {
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  return (
    <>
      <ErrorBoundary>
        <Game />
      </ErrorBoundary>
      <SmallScreenNotice />
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
