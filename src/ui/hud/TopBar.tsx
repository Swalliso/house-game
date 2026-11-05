// The top bar: the phase and week, Wow against the target, and the run's buttons.

import { CONTENT, rules, SCORE_LABELS } from '../../rules/index.ts';
import { shownRun, shownScore } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import { run } from '../store.ts';
import { copyRunCode, openSettings, startNewRun } from './actions.ts';

export function TopBar() {
  // While a tally plays, the bar stays on the week being tallied.
  const s = shownRun.value ?? run.value;
  const phases = CONTENT.balance.phases;
  const weeks = CONTENT.balance.weeksPerPhase;
  const target = rules.target(s);
  const score = shownScore.value ?? s.score;
  const pct = Math.min(100, (score / Math.max(1, target)) * 100);
  const ended = s.screen !== 'build';
  return (
    <header class="topbar">
      <div class="brand">
        Open House{' '}
        <span class="seed" title="This run's seed">
          #{s.setup.seed}
        </span>
      </div>
      <div class="phase" aria-label="Phase and week">
        <div class="phase-name">
          {rules.phaseName(s.phase)}{' '}
          <span class="muted">
            · milestone {s.phase + 1} of {phases.length}
          </span>
        </div>
        <div class="week">
          {ended ? 'Run over' : `Week ${s.slot} of ${weeks}`}
          <span class="muted">
            {' '}
            · week {s.week} of {phases.length * weeks}
          </span>
        </div>
      </div>
      <div class="progress" aria-label={`${SCORE_LABELS.total} ${score} of ${target}`}>
        <div class="progress-numbers">
          <span class="wow">{formatNumber(score)}</span>
          <span class="muted">
            {' '}
            / {formatNumber(target)} {SCORE_LABELS.total}
          </span>
          {score >= target && <span class="reached"> ✓ target met</span>}
        </div>
        <div class="bar">
          <div class={`fill ${score >= target ? 'met' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <nav class="buttons">
        <button type="button" onClick={startNewRun}>
          New run
        </button>
        <button
          type="button"
          onClick={() => void copyRunCode()}
          title="Copy a code that replays this run exactly"
        >
          Copy run code
        </button>
        <button type="button" onClick={openSettings} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </nav>
    </header>
  );
}
