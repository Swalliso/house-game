// The top bar: the milestone and week on a plaque (or "Change order", while a change order's
// sheet is up), Wow against the target on the milestone meter (week ticks, the forecast, the
// target's flag), the run's resources (budget, overtime), the auto-complete switch, Complete
// early, and the run's buttons: How to play, Settings, and the Menu, which holds Copy run code
// and the seed (M5a).

import { signal } from '@preact/signals';
import { CONTENT, rules, SCORE_LABELS, type RunState } from '../../rules/index.ts';
import { busy, shownRun, shownScore, skip, targetHit } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import { Button, Icon, Switch } from '../kit/kit.tsx';
import { completeEarly, earlyOffer, forecast, preview, run, setAutoComplete } from '../store.ts';
import { howToPlayOpen, menuOpen, openSettings } from './actions.ts';
import { BudgetCount } from './BudgetCount.tsx';
import { shown } from './first-job.ts';
import { arrivalWeek, isPlural, overtimeUsed, upcomingArrivals } from './household.ts';
import { weekTicks } from './meter.ts';
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

/** A click on a bar control shouldn't keep focus, so Enter and 1–4 keep working after it. */
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
        ) : s.screen === 'changeOrder' ? (
          'Change order'
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

function Progress() {
  const s = shownRun.value ?? run.value;
  const tallying = shownRun.value !== null;
  const target = rules.target(s);
  const score = shownScore.value ?? s.score;
  const met = score >= target;
  const pct = Math.min(100, (score / Math.max(1, target)) * 100);
  const phase = rules.phaseName(s.phase);
  // The forecast follows the live run, so it's hidden while a tally catches the bar up; and
  // in the first job's first week (D-149), before any week has earned.
  const showForecast = !tallying && s.screen === 'build' && shown.value.forecast;
  const f = forecast.value;
  const placing = !!preview.value?.legal;
  const fpct = Math.min(100, (f / Math.max(1, target)) * 100);
  const fMet = f >= target;
  const guide =
    `A rough guide, not a promise: this week's ${SCORE_LABELS.total} for each week left in ` +
    `${phase}.${placing ? ' It includes the piece you’re placing.' : ''}`;
  const ticks = weekTicks(s.phaseStartScore, rules.pace(s), target, CONTENT.balance.weeksPerPhase);
  // The milestone moment's crossing pops the flag (D-124): keyed, so it plays once a crossing.
  const hit = targetHit.value?.id ?? null;
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
          {ticks.map((t, k) => (
            <div key={k} class="meter-tick" style={{ left: `${t * 100}%` }} />
          ))}
          {showForecast && f > score && (
            <div
              class={`tb-forecast-tick ${placing ? 'placing' : ''}`}
              style={{ left: `${fpct}%` }}
            />
          )}
        </div>
        <Icon
          name="flag"
          class={`tb-flag ${hit ? 'hit' : ''}`}
          key={hit ?? 'flag'}
          label={`Target: ${formatNumber(target)}`}
        />
        <NextArrival s={s} />
      </div>
    </div>
  );
}

/**
 * The arrivals' marker on the progress bar (D-126): past the target's flag, the House when a
 * household member moves in as this milestone is met and the next one starts.
 */
function NextArrival({ s }: { s: RunState }) {
  const next = upcomingArrivals(s).filter((a) => a.phase === s.phase + 1);
  const first = next[0];
  if (!first) return null;
  const names = next.map((a) => a.name.charAt(0).toUpperCase() + a.name.slice(1)).join(' and ');
  const verb = next.length > 1 || isPlural(first) ? 'move in' : 'moves in';
  const when = `${rules.phaseName(first.phase)}, week ${arrivalWeek(first, overtimeUsed(s))}`;
  return (
    <span class="tb-arrival" title={`${names} ${verb} as this milestone is met (${when})`}>
      <Icon name="House" label={`${names} ${verb} next`} />
    </span>
  );
}

function Resources() {
  const s = shownRun.value ?? run.value;
  const total = rules.rule(s, 'overtime');
  const left = Math.max(0, s.overtimeLeft);
  const overtimeTitle = 'Overtime weeks left: spent automatically when a target is missed';
  // The first job brings each in when it first matters (D-149, first-job.ts).
  const on = shown.value;
  return (
    <>
      {on.budget && (
        <div class="tb-budget">
          <Tip term="budget">
            <Icon name="coin" label="Budget" />
          </Tip>
          <BudgetCount value={s.budget} />
        </div>
      )}
      {on.overtime && (
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
      )}
    </>
  );
}

/** Hidden once the run is over (D-135): there's no milestone left for it to complete. */
function AutoComplete() {
  const s = run.value;
  if (s.screen === 'won' || s.screen === 'lost' || !shown.value.early) return null;
  return (
    <Switch
      class="tb-switch"
      checked={s.autoComplete}
      title="Complete each milestone as soon as its target is met, skipping the builds for the weeks left"
      onMouseDown={noFocus}
      onChange={(want) => setAutoComplete(want)}
    >
      Auto<span class="switch-text-more">-complete</span>
    </Switch>
  );
}

function CompleteEarly() {
  const offer = earlyOffer.value;
  // Hidden while a tally plays: the offer follows the live run, not the week on show. And in
  // the first job's first milestone (D-149), where every week's build is still teaching.
  if (!offer.ok || shownRun.value !== null || !shown.value.early) return null;
  const armed = earlyArmed.value;
  const bonus = `+${formatNumber(offer.bonus.score)} ${SCORE_LABELS.total} · +${offer.bonus.budget} budget`;
  const detail = `saves ${plural(offer.weeksSaved, 'week')} · ${bonus}`;
  const phase = rules.phaseName(run.value.phase);
  // Both labels share one cell, the idle one hidden, so the button keeps its width when it's
  // armed and a second press in the same spot lands (D-073).
  return (
    <Button
      variant={armed ? 'armed' : 'secondary'}
      class={`tb-early ${armed ? 'confirm' : ''}`}
      onMouseDown={noFocus}
      onClick={requestCompleteEarly}
      title={`Finish ${phase} now and skip ${plural(offer.weeksSaved, 'build')}: the weeks left play out quickly, and you get the early bonus (${bonus}). Press twice.`}
      aria-label={armed ? 'Press again to complete early' : `Complete early: ${detail}`}
    >
      <span class="tb-early-label">
        <span class={armed ? 'is-hidden' : ''} aria-hidden={armed ? 'true' : undefined}>
          <Tip term="early">Complete early</Tip>
        </span>
        <span class={armed ? '' : 'is-hidden'} aria-hidden={armed ? undefined : 'true'}>
          Press again
        </span>
      </span>
      <span class="tb-early-detail">
        <span>
          +{formatNumber(offer.bonus.score)} {SCORE_LABELS.total}
        </span>
        <span class="tb-early-budget">
          <Icon name="coin" />+{offer.bonus.budget}
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
