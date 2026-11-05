// The win and lose screens (implementation-plan.md §7, M2; Appendix A · M2): the verdict, the
// final Wow, each milestone's result, and the run's stats, in the right-hand column. The house
// stays on the board beside it, captioned "It's a house." A loss gets the same screen, gently.
// Every number comes from the rules' state; the UI only counts and formats.

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
    <>
      <h3>
        Milestones · {met} of {phases.length}
      </h3>
      <ol class="run-end-milestones">
        {phases.map((p, i) => {
          const m = byPhase.get(i);
          if (!m) {
            // The rules own the targets (a client may scale them later), so ask them.
            const target = rules.target({ ...s, phase: i });
            return (
              <li key={i} class="todo">
                <span class="mark" aria-hidden="true">
                  ○
                </span>
                <span class="name">
                  {p.name}
                  <span class="run-end-sr"> (not reached)</span>
                </span>
                <span class="of">of {formatNumber(target)}</span>
              </li>
            );
          }
          const failed = m.result === 'failed';
          return (
            <li key={i} class={`${failed ? 'failed' : 'met'} ${m.result}`}>
              <span class="mark" aria-hidden="true">
                {failed ? '✕' : '✓'}
              </span>
              <span class="name">{p.name}</span>
              <span class="score">{formatNumber(m.score)}</span>
              <span class="tag">{resultTag(m)}</span>
              <span class="of">of {formatNumber(m.target)}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Stats({ s }: { s: RunState }) {
  const overtime = s.milestones.reduce((sum, m) => sum + m.overtimeUsed, 0);
  return (
    <>
      <h3>The run</h3>
      <dl class="run-end-stats">
        <dt>Pieces built</dt>
        {/* Every placement takes the next uid, so this counts demolished and grown pieces too. */}
        <dd>{s.house.nextUid - 1}</dd>
        <dt>Weeks played</dt>
        <dd>{s.week}</dd>
        <dt>Budget earned</dt>
        <dd>{formatNumber(s.budget)}</dd>
        <dt>Finished early</dt>
        <dd>{s.milestonesEarly}</dd>
        <dt>Overtime weeks</dt>
        <dd>{overtime}</dd>
      </dl>
    </>
  );
}

/**
 * The run-end screen, in place of the hand. It waits for the last tally and banner to play
 * (busy), so the player sees the final week land before the summary.
 */
export function EndScreen() {
  const s = run.value;
  if (s.screen === 'build' || busy.value) return null;
  const won = s.screen === 'won';
  const phases = CONTENT.balance.phases;
  const title = won
    ? `${phases[phases.length - 1]?.name ?? 'The house'} complete`
    : `The client walked at ${rules.phaseName(s.phase)}`;
  return (
    <section class={`run-end ${won ? 'won' : 'lost'}`} aria-labelledby="run-end-title">
      <header class="run-end-head">
        <h2 id="run-end-title" class="run-end-title">
          {title}
        </h2>
        <p class="run-end-verdict">{rules.verdict(s)}</p>
        <p class="run-end-score">
          <span class="value">{formatNumber(s.score)}</span>
          <span class="unit">{won ? WOW : `of ${formatNumber(rules.target(s))} ${WOW}`}</span>
        </p>
      </header>
      <Milestones s={s} />
      <Stats s={s} />
      {s.debug && <p class="run-end-debug">A debug run: cheats were used.</p>}
      <div class="run-end-actions">
        <button type="button" class="primary" onClick={() => startNewRun()}>
          New run
        </button>
        <button type="button" onClick={() => void copyRunCode()}>
          Copy run code
        </button>
        <button type="button" onClick={() => goToTitle()}>
          Title
        </button>
      </div>
    </section>
  );
}

/**
 * "It's a house." over the top of the board once the run is over. It waits for the run-end
 * banner to clear (that banner sits in the same spot), and never takes a click from the board.
 */
export function EndCaption() {
  const s = run.value;
  if (s.screen === 'build' || busy.value || banner.value) return null;
  return <p class={`run-end-caption ${s.screen}`}>It’s a house.</p>;
}
