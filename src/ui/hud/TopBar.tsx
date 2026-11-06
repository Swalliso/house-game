// The top bar: the milestone and week on a plaque, Wow against the target on the milestone
// meter (week ticks, the forecast, the target's flag), the run's resources (budget, overtime),
// the auto-complete switch, Complete early, and the run's buttons: How to play, Settings, and
// the Menu, which holds Copy run code and the seed (M5a).

import { signal } from '@preact/signals';
import { CONTENT, rules, SCORE_LABELS } from '../../rules/index.ts';
import { busy, shownRun, shownScore, skip } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import { Button, Icon, Switch } from '../kit/kit.tsx';
import { completeEarly, earlyOffer, forecast, preview, run, setAutoComplete } from '../store.ts';
import { howToPlayOpen, menuOpen, openSettings } from './actions.ts';
import { BudgetCount } from './BudgetCount.tsx';
import { Tip } from './Tip.tsx';
import './topbar.css';

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
    <div
      class="tb-phase"
      aria-label="Milestone and week"
      title={`Milestone ${s.phase + 1} of ${phases.length} · week ${s.week} of the run's ${runWeeks}`}
    >
      <div class="tb-phase-line">
        <span class="tb-phase-name">{rules.phaseName(s.phase)}</span>
        <span class="tb-phase-count">
          {s.phase + 1}/{phases.length}
        </span>
      </div>
      <div class="tb-week">
        {ended ? (
          'Run over'
        ) : shopping ? (
          'Shopping'
        ) : s.overtimeWeek > 0 ? (
          <span
            class="overtime-week"
            title="An extra week to reach the target. The next milestone still gets all its weeks."
          >
            Overtime {s.overtimeWeek}
          </span>
        ) : (
          `Week ${s.slot} of ${weeks}`
        )}
        <span class="tb-run-week">
          {' '}
          · {s.week}/{runWeeks}
        </span>
      </div>
    </div>
  );
}

/** Where the meter's ticks go: the phase's start, then an even share of the target each week. */
function weekTicks(start: number, target: number, weeks: number): number[] {
  const from = Math.min(1, start / Math.max(1, target));
  return Array.from({ length: weeks - 1 }, (_, k) => from + ((1 - from) * (k + 1)) / weeks);
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
  const ticks = weekTicks(s.phaseStartScore, target, CONTENT.balance.weeksPerPhase);
  return (
    <div class="tb-progress" aria-label={`${SCORE_LABELS.total} ${score} of ${target}`}>
      <div class="tb-progress-line">
        <span class="tb-score">
          <span class="num tb-wow">{formatNumber(score)}</span>
          <span class="tb-target">
            {' '}
            / {formatNumber(target)} {SCORE_LABELS.total}
          </span>
        </span>
        {met && (
          <span class="tb-met" title="Target met">
            ✓<span class="tb-met-text"> Target met</span>
          </span>
        )}
        {showForecast && (
          <span
            class={`tb-forecast ${fMet ? 'met' : ''} ${placing ? 'placing' : ''}`}
            title={guide}
          >
            <span class="tb-forecast-word">Forecast </span>~{formatNumber(f)}
          </span>
        )}
      </div>
      <div class="tb-meter-row">
        <div class="meter tb-meter" title={showForecast ? guide : undefined}>
          {showForecast && f > score && (
            <div
              class={`tb-forecast-fill ${placing ? 'placing' : ''} ${fMet ? 'met' : ''}`}
              style={{ width: `${fpct}%` }}
            />
          )}
          <div class={`meter-fill tb-fill ${met ? 'met' : ''}`} style={{ width: `${pct}%` }} />
          {ticks.map((t) => (
            <div key={t} class="meter-tick" style={{ left: `${t * 100}%` }} />
          ))}
          {showForecast && f > score && (
            <div
              class={`tb-forecast-tick ${placing ? 'placing' : ''}`}
              style={{ left: `${fpct}%` }}
            />
          )}
        </div>
        <Icon name="flag" class="tb-flag" label={`Target: ${formatNumber(target)}`} />
      </div>
    </div>
  );
}

function Resources() {
  const s = shownRun.value ?? run.value;
  const total = rules.rule(s, 'overtime');
  const left = Math.max(0, s.overtimeLeft);
  const overtimeTitle = 'Overtime weeks left: spent automatically when a target is missed';
  return (
    <>
      <div class="tb-budget">
        <Tip term="budget">
          <Icon name="coin" label="Budget" />
        </Tip>
        <BudgetCount value={s.budget} />
      </div>
      <div
        class="tb-overtime"
        title={overtimeTitle}
        aria-label={`Overtime weeks left: ${left} of ${total}`}
        role="img"
      >
        {Array.from({ length: Math.max(total, left) }, (_, i) => (
          <Icon key={i} name="clock" class={i < left ? '' : 'spent'} />
        ))}
      </div>
    </>
  );
}

function AutoComplete() {
  const s = run.value;
  const ended = s.screen === 'won' || s.screen === 'lost';
  return (
    <Switch
      class="tb-switch"
      checked={s.autoComplete}
      disabled={ended}
      title="Complete each milestone as soon as its target is met"
      onMouseDown={noFocus}
      onChange={(want) => setAutoComplete(want)}
    >
      Auto<span class="switch-text-more">-complete</span>
    </Switch>
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
    <Button
      variant={armed ? 'armed' : 'secondary'}
      class={`tb-early ${armed ? 'confirm' : ''}`}
      onMouseDown={noFocus}
      onClick={requestCompleteEarly}
      title={`Finish ${phase} now: the weeks left play out quickly, and you get the early bonus (${bonus}). Press twice.`}
      aria-label={armed ? 'Press again to complete early' : `Complete early: ${detail}`}
    >
      <span class="tb-early-label">
        {armed ? 'Press again' : <Tip term="early">Complete early</Tip>}
      </span>
      <span class="tb-early-detail">
        <span>
          +{formatNumber(offer.bonus.score)}
          <span class="tb-early-word"> {SCORE_LABELS.total}</span>
        </span>
        <span class="tb-early-budget">
          +{offer.bonus.budget}
          <Icon name="coin" />
        </span>
      </span>
    </Button>
  );
}

export function TopBar() {
  return (
    <header class="topbar ui">
      <PhaseBlock />
      <Progress />
      <Resources />
      <AutoComplete />
      <CompleteEarly />
      <nav class="tb-buttons" aria-label="Game">
        <Button
          iconOnly
          icon="help"
          onClick={() => (howToPlayOpen.value = true)}
          aria-label="How to play"
          title="How to play"
        />
        <Button
          iconOnly
          icon="gear"
          onClick={openSettings}
          aria-label="Settings"
          title="Settings"
        />
        <Button
          iconOnly
          icon="menu"
          onClick={() => (menuOpen.value = true)}
          aria-label="Menu"
          title="Menu: copy the run code, or quit to the title"
        />
      </nav>
    </header>
  );
}
