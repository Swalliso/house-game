// The win and lose screens (implementation-plan.md §7, M2; Appendix A · M2): the verdict, the
// final Wow, each milestone's result, and the run's stats, in the right-hand column. The house
// stays on the board beside it, captioned "It's a house." A loss gets the same screen, gently.
// Every number comes from the rules' state; the UI only counts and formats.
//
// M5a draws it as a wood panel: the verdict as a stamp (gold for a win), the final Wow on the
// score panel's framed plaque, the milestones and the stats as rows with icons, and New run as
// the one primary button, kept in view at the column's foot. The full-width finale with a
// photo per milestone is M6's.

import {
  CONTENT,
  rules,
  SCORE_LABELS,
  type MilestoneRecord,
  type RunState,
} from '../../rules/index.ts';
import { banner, busy } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import { copyRunCode, startNewRun } from '../hud/actions.ts';
import { Button, Icon, Panel, type IconName } from '../kit/kit.tsx';
import { goToTitle, run } from '../store.ts';
import './end.css';

const WOW = SCORE_LABELS.total;

function weeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

/** A milestone's result as a short tag. */
function resultTag(m: MilestoneRecord): string {
  switch (m.result) {
    case 'onTime':
      return 'On time';
    case 'early': {
      const bonus = m.reward.score > 0 ? ` (+${formatNumber(m.reward.score)} ${WOW})` : '';
      return `${weeks(m.weeksSaved)} early${bonus}`;
    }
    case 'overtime':
      return m.overtimeUsed > 1 ? `${weeks(m.overtimeUsed)} of overtime` : 'Overtime';
    case 'failed':
      return 'Missed';
  }
}

/** Every milestone in order: the ones resolved with their result, the rest greyed. */
function Milestones({ s }: { s: RunState }) {
  const phases = CONTENT.balance.phases;
  const byPhase = new Map(s.milestones.map((m) => [m.phase, m]));
  const met = s.milestones.filter((m) => m.result !== 'failed').length;
  return (
    <section class="run-end-section">
      <h3 class="plank-tag" aria-label={`Milestones: ${met} of ${phases.length}`}>
        Milestones · {met}/{phases.length}
      </h3>
      <ol class="run-end-milestones">
        {phases.map((p, i) => {
          const m = byPhase.get(i);
          if (!m) {
            // The rules own the targets (a client may scale them later), so ask them.
            const target = rules.target({ ...s, phase: i });
            return (
              <li key={i} class="todo">
                <Icon name="pending" class="mark" />
                <span class="name">
                  {p.name}
                  <span class="run-end-sr"> (not reached)</span>
                </span>
                <span class="figures">of {formatNumber(target)}</span>
              </li>
            );
          }
          const failed = m.result === 'failed';
          return (
            <li key={i} class={`${failed ? 'failed' : 'met'} ${m.result}`}>
              <Icon name={failed ? 'cross' : 'check'} class="mark" />
              <span class="name">{p.name}</span>
              <span class="detail">
                <span class="tag">{resultTag(m)}</span>
                <span class="figures">
                  <span class="score num">{formatNumber(m.score)}</span> of {formatNumber(m.target)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string | number }) {
  return (
    <>
      <dt>
        <Icon name={icon} />
        {label}
      </dt>
      <dd class="num">{value}</dd>
    </>
  );
}

function Stats({ s }: { s: RunState }) {
  const overtime = s.milestones.reduce((sum, m) => sum + m.overtimeUsed, 0);
  return (
    <section class="run-end-section">
      <h3 class="plank-tag">The run</h3>
      <dl class="run-end-stats">
        {/* Every placement takes the next uid, so this counts demolished and grown pieces too. */}
        <Stat icon="House" label="Pieces built" value={s.house.nextUid - 1} />
        <Stat icon="clock" label="Weeks played" value={s.week} />
        <Stat icon="coin" label="Budget earned" value={formatNumber(s.budgetEarned)} />
        <Stat icon="flag" label="Finished early" value={s.milestonesEarly} />
        <Stat icon="warn" label="Overtime weeks" value={overtime} />
      </dl>
    </section>
  );
}

/**
 * The run-end screen, in place of the hand. It waits for the last tally and banner to play
 * (busy), so the player sees the final week land before the summary.
 */
export function EndScreen() {
  const s = run.value;
  if ((s.screen !== 'won' && s.screen !== 'lost') || busy.value) return null;
  const won = s.screen === 'won';
  const phases = CONTENT.balance.phases;
  const title = won
    ? `${phases[phases.length - 1]?.name ?? 'The house'} complete`
    : `The client walked at ${rules.phaseName(s.phase)}`;
  return (
    <Panel
      class={`run-end ${won ? 'won' : 'lost'}`}
      title={won ? 'The house is done' : 'Run over'}
      label={title}
    >
      <header class="run-end-head">
        {won && <Icon name="trophy" class="run-end-trophy" />}
        <p class="run-end-title">{title}</p>
        <p class="run-end-verdict">{rules.verdict(s)}</p>
        <p class="run-end-score">
          <span class="value num">{formatNumber(s.score)}</span>
          <span class="unit">{won ? WOW : `of ${formatNumber(rules.target(s))} ${WOW}`}</span>
        </p>
      </header>
      <Milestones s={s} />
      <Stats s={s} />
      {s.debug && <p class="run-end-debug">A debug run: cheats were used.</p>}
      <div class="run-end-actions">
        <Button variant="primary" size="lg" block onClick={() => startNewRun()}>
          New run
        </Button>
        <Button icon="copy" onClick={() => void copyRunCode()}>
          Copy run code
        </Button>
        <Button icon="exit" onClick={() => goToTitle()}>
          Title
        </Button>
      </div>
    </Panel>
  );
}

/**
 * "It's a house." over the top of the board once the run is over: a little wood sign. It waits
 * for the run-end banner to clear (that banner sits in the same spot), and never takes a click
 * from the board.
 */
export function EndCaption() {
  const s = run.value;
  if ((s.screen !== 'won' && s.screen !== 'lost') || busy.value || banner.value) return null;
  return (
    <div class="run-end-caption-place">
      <p class={`run-end-caption ui ${s.screen}`}>It’s a house.</p>
    </div>
  );
}
