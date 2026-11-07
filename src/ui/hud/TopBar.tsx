// The top bar: the game's name with the run's client and crew, the milestone and week, Wow
// against the target with the forecast, the run's resources (budget, overtime), the
// auto-complete switch, Complete early, and the run's buttons.

import { signal } from '@preact/signals';
import { CONTENT, modifierText, rules, SCORE_LABELS, type RunState } from '../../rules/index.ts';
import { busy, shownRun, shownScore, skip } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import {
  completeEarly,
  earlyOffer,
  forecast,
  goToTitle,
  preview,
  run,
  setAutoComplete,
} from '../store.ts';
import { copyRunCode, howToPlayOpen, openSettings } from './actions.ts';
import { BudgetCount } from './BudgetCount.tsx';
import { Tip } from './Tip.tsx';
import './hud-m2.css';

/** Complete early takes a second press within this long, like Pass. */
const CONFIRM_MS = 2500;
const earlyArmed = signal(false);
let earlyTimer: ReturnType<typeof setTimeout> | undefined;

function requestCompleteEarly(): void {
  if (!earlyOffer.value.ok) return;
  if (!earlyArmed.value) {
    earlyArmed.value = true;
    clearTimeout(earlyTimer);
    earlyTimer = setTimeout(() => (earlyArmed.value = false), CONFIRM_MS);
    return;
  }
  clearTimeout(earlyTimer);
  earlyArmed.value = false;
  if (busy.value) skip();
  completeEarly();
}

/** A click on a bar control shouldn't keep focus, so Enter and 1–3 keep working after it. */
const noFocus = (e: MouseEvent) => e.preventDefault();

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PhaseBlock() {
  // While a tally plays, the bar stays on the week being tallied.
  const s = shownRun.value ?? run.value;
  const phases = CONTENT.balance.phases;
  const weeks = CONTENT.balance.weeksPerPhase;
  // Each overtime week used makes the run a week longer (D-041).
  const overtimeUsed = Math.max(0, rules.rule(s, 'overtime') - s.overtimeLeft);
  const runWeeks = phases.length * weeks + overtimeUsed;
  const ended = s.screen === 'won' || s.screen === 'lost';
  const shopping = s.screen === 'shop';
  return (
    <div class="phase" aria-label="Milestone and week">
      <div class="phase-name">{rules.phaseName(s.phase)}</div>
      <div class="tb-small muted">
        milestone {s.phase + 1} of {phases.length}
      </div>
      <div class="week">
        {ended ? (
          'Run over'
        ) : shopping ? (
          'Shopping'
        ) : s.screen === 'changeOrder' ? (
          'Change order'
        ) : s.overtimeWeek > 0 ? (
          <span
            class="overtime-week"
            title="An extra week to reach the target. The next milestone still gets all its weeks."
          >
            Overtime week {s.overtimeWeek}
          </span>
        ) : (
          `Week ${s.slot} of ${weeks}`
        )}
        <span class="muted">
          {' '}
          · week {s.week} of {runWeeks}
        </span>
      </div>
    </div>
  );
}

function Progress() {
  const s = shownRun.value ?? run.value;
  const tallying = shownRun.value !== null;
  const target = rules.target(s);
  const score = shownScore.value ?? s.score;
  const met = score >= target;
  const pct = Math.min(100, (score / Math.max(1, target)) * 100);
  const phase = rules.phaseName(s.phase);
  // The forecast follows the live run, so it's hidden while a tally catches the bar up.
  const showForecast = !tallying && s.screen === 'build';
  const f = forecast.value;
  const placing = !!preview.value?.legal;
  const fpct = Math.min(100, (f / Math.max(1, target)) * 100);
  const fMet = f >= target;
  const guide =
    `A rough guide, not a promise: this week's ${SCORE_LABELS.total} for each week left in ` +
    `${phase}.${placing ? ' It includes the piece you’re placing.' : ''}`;
  return (
    <div class="progress" aria-label={`${SCORE_LABELS.total} ${score} of ${target}`}>
      <div class="progress-numbers">
        <span class="wow">{formatNumber(score)}</span>
        <span class="muted">
          {' '}
          / {formatNumber(target)} {SCORE_LABELS.total}
        </span>
        {met && (
          <span class="reached" title="Target met">
            {' '}
            ✓<span class="reached-text"> target met</span>
          </span>
        )}
      </div>
      <div class="bar" title={showForecast ? guide : undefined}>
        {showForecast && f > score && (
          <div
            class={`forecast-fill ${placing ? 'placing' : ''} ${fMet ? 'met' : ''}`}
            style={{ width: `${fpct}%` }}
          />
        )}
        <div class={`fill ${met ? 'met' : ''}`} style={{ width: `${pct}%` }} />
        {showForecast && f > score && (
          <div
            class={`forecast-tick ${placing ? 'placing' : ''}`}
            style={{ left: `calc(${fpct}% - 2px)` }}
          />
        )}
      </div>
      {showForecast && (
        <div
          class={`forecast-label ${fMet ? 'met' : ''} ${placing ? 'placing' : ''}`}
          title={guide}
        >
          Forecast ~{formatNumber(f)} by the end of {phase}
        </div>
      )}
    </div>
  );
}

function Resources() {
  const s = shownRun.value ?? run.value;
  const total = rules.rule(s, 'overtime');
  const left = Math.max(0, s.overtimeLeft);
  const overtimeTitle = 'Overtime weeks left: spent automatically when a target is missed';
  return (
    <div class="tb-resources">
      <div class="tb-budget">
        <Tip term="budget">Budget</Tip> <BudgetCount value={s.budget} />
      </div>
      <div
        class="tb-overtime"
        title={overtimeTitle}
        aria-label={`Overtime weeks left: ${left} of ${total}`}
        role="img"
      >
        {Array.from({ length: Math.max(total, left) }, (_, i) => (
          <span key={i} class={`clock ${i < left ? '' : 'spent'}`} aria-hidden="true" />
        ))}
        <span class="tb-small muted"> ×{left}</span>
      </div>
    </div>
  );
}

function AutoComplete() {
  const s = run.value;
  const on = s.autoComplete;
  const ended = s.screen === 'won' || s.screen === 'lost';
  return (
    <label
      class={`tb-switch ${on ? 'on' : ''} ${ended ? 'disabled' : ''}`}
      title="Complete each milestone as soon as its target is met"
      onMouseDown={noFocus}
    >
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={ended}
        onChange={(e) => {
          const want = e.currentTarget.checked;
          if (!setAutoComplete(want)) e.currentTarget.checked = run.value.autoComplete;
        }}
      />
      <span class="switch-track" aria-hidden="true">
        <span class="switch-knob" />
      </span>
      <span class="switch-text">Auto-complete</span>
    </label>
  );
}

function CompleteEarly() {
  const offer = earlyOffer.value;
  // Hidden while a tally plays: the offer follows the live run, not the week on show.
  if (!offer.ok || shownRun.value !== null) return null;
  const armed = earlyArmed.value;
  const bonus = `+${formatNumber(offer.bonus.score)} ${SCORE_LABELS.total} · +${offer.bonus.budget} budget`;
  const detail = `saves ${plural(offer.weeksSaved, 'week')} · ${bonus}`;
  const phase = rules.phaseName(run.value.phase);
  return (
    <button
      type="button"
      class={`tb-early ${armed ? 'confirm' : ''}`}
      onMouseDown={noFocus}
      onClick={requestCompleteEarly}
      title={`Finish ${phase} now: the weeks left play out quickly, and you get the early bonus (${bonus}). Press twice.`}
      aria-label={armed ? 'Press again to complete early' : `Complete early: ${detail}`}
    >
      <span class="tb-early-label">
        {armed ? 'Press again to complete' : <Tip term="early">Complete early</Tip>}
      </span>
      <span class="tb-early-detail">{detail}</span>
    </button>
  );
}

/**
 * Who the house is for and who's building it, under the game's name: the client (their brief
 * as a tip) and the crew (what it does all run as a tip).
 */
function RunWho({ s }: { s: RunState }) {
  const client = CONTENT.clients[s.setup.clientId];
  const crew = CONTENT.crews[s.setup.crewId];
  const crewText = `${crew.blurb} All run: ${crew.modifiers.map((m) => modifierText(CONTENT, m)).join(' · ')}.`;
  return (
    <>
      <span class="brand-who">
        <Tip title={client.name} text={client.brief}>
          {client.name}
        </Tip>
      </span>
      <span class="brand-who">
        <Tip title={`${crew.name}: your crew`} text={crewText}>
          {crew.name}
        </Tip>
      </span>
    </>
  );
}

export function TopBar() {
  const s = shownRun.value ?? run.value;
  return (
    <header class="topbar m2">
      <div class="brand">
        <span class="brand-name">
          Open House{' '}
          <span class="seed" title="This run's seed">
            #{s.setup.seed}
          </span>
        </span>
        <RunWho s={s} />
      </div>
      <PhaseBlock />
      <Progress />
      <Resources />
      <AutoComplete />
      <CompleteEarly />
      <nav class="buttons">
        <button type="button" onClick={goToTitle} title="Back to the title screen">
          Menu
        </button>
        <button
          type="button"
          onClick={() => (howToPlayOpen.value = true)}
          aria-label="How to play"
          title="How to play"
        >
          ?
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
