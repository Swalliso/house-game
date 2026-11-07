// The week's score: Comfort × Charm = Wow (D-019, D-056). It shows the house as it stands,
// the preview's change while placing, and the tally's counters while they tick. Under the
// sets, the checklist's part of the Charm (M4a).

import {
  CONTENT,
  SCORE_LABELS,
  type SetScore,
  type WeekScore,
  type XMultTerm,
} from '../../rules/index.ts';
import { tallyView } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatMult, formatNumber, signed } from '../format.ts';
import { currentTally, pace as paceSignal, preview, run } from '../store.ts';
import { Celebration } from './Celebration.tsx';
import { Tip } from './Tip.tsx';
import './hud-m2.css';
import './hud-m4.css';

function Delta({ n, mult = false }: { n: number; mult?: boolean }) {
  if (n === 0) return null;
  return (
    <span class={`delta ${n > 0 ? 'good' : 'bad'}`}>
      {n > 0 ? '▲' : '▼'} {signed(n, mult ? formatMult : formatNumber)}
    </span>
  );
}

function SetList({
  sets,
  gained,
  lost,
}: {
  sets: readonly SetScore[];
  gained: Set<string>;
  lost: readonly SetScore[];
}) {
  const levels = run.value.setLevels;
  if (sets.length === 0 && lost.length === 0) {
    return (
      <p class="sets-empty">
        No sets yet. Try a Bathroom between two Bedrooms (Jack-and-Jill) or a Kitchen, Dining Room,
        and Living Room together (Entertainer).
      </p>
    );
  }
  return (
    <ul class="sets">
      {sets.map((s) => (
        <li key={s.key} class={gained.has(s.key) ? 'gained' : ''}>
          <span class="set-name">
            {gained.has(s.key) ? '★ ' : ''}
            {CONTENT.sets[s.set].name}
            {(levels[s.set] ?? 1) > 1 && <span class="set-level"> Lv {levels[s.set]}</span>}
          </span>
          <span class="comfort">+{s.points}</span>
          <span class="charm">+{formatMult(s.mult)}</span>
        </li>
      ))}
      {lost.map((s) => (
        <li key={s.key} class="lost">
          <span class="set-name">✕ {CONTENT.sets[s.set].name}</span>
          <span class="comfort">−{s.points}</span>
          <span class="charm">−{formatMult(s.mult)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The checklist's part of the Charm (M4a): the lines held and what they add, each line adding
 * the tally's `specBonus`. While a play is looked at, its change; while a tally plays, the
 * lines it has counted so far, pulsing as each lands.
 */
function SpecCharm({
  count,
  bonus,
  before,
  ticking,
  waiting,
}: {
  count: number;
  bonus: number;
  /** The lines held before the play being looked at, if one is. */
  before: number | null;
  ticking: boolean;
  /** In a tally that hasn't reached the checklist yet: nothing counted so far. */
  waiting: boolean;
}) {
  return (
    <p class={`spec-charm ${waiting ? 'waiting' : ''}`}>
      {/* Keyed by the count while it ticks, so the pulse restarts on every line. */}
      <span
        key={ticking ? count : 'count'}
        class={`spec-count ${ticking ? 'ticking' : ''}`}
        style={ticking ? { animationDuration: `${FEEL.checklist.tickMs}ms` } : undefined}
      >
        {count}
      </span>{' '}
      <Tip term="checklist">checklist</Tip> {count === 1 ? 'line' : 'lines'}
      {' · '}
      <span class="charm">
        +{formatMult(count * bonus)} {SCORE_LABELS.mult}
      </span>
      {before !== null && <Delta n={(count - before) * bonus} mult />}
    </p>
  );
}

/** The week's ×Mult sources as gold stamps (D-056). */
function Sparkles({ list }: { list: readonly XMultTerm[] }) {
  if (list.length === 0) return null;
  return (
    <ul class="sparkles" aria-label={SCORE_LABELS.xMult}>
      <li class="sparkles-label">
        <Tip term="sparkle">{SCORE_LABELS.xMult}</Tip>
      </li>
      {list.map((x) => (
        <li
          key={`${x.source.kind}:${x.label}`}
          title={`${SCORE_LABELS.xMult}: ×${formatMult(x.times)} ${SCORE_LABELS.mult}`}
        >
          ✦ {x.label} ×{formatMult(x.times)}
        </li>
      ))}
    </ul>
  );
}

export function ScorePanel() {
  const view = tallyView.value;
  const p = preview.value;
  const tally = currentTally.value;
  const pace = paceSignal.value;
  let shown: { points: number; mult: number; total: number | null } = tally;
  let before: WeekScore | null = null;
  let label = 'Each week, as built';
  if (view) {
    shown = { points: view.points, mult: view.mult, total: view.total };
    label = view.fastForward ? 'Fast-forward' : 'This week';
  } else if (p?.legal) {
    shown = p.after;
    before = p.before;
    label = 'With this placement';
  }
  // A tally's glow comes from its event's total, so it stays lit through the count rather
  // than going dark until the total lands.
  const glowTotal = view ? view.weekTotal : shown.total;
  const ratio = glowTotal === null ? 0 : glowTotal / Math.max(1, view ? view.pace : pace);
  const glow =
    ratio >= FEEL.glowPace ? Math.min(1, Math.log(ratio + 1) / Math.log(FEEL.bigWeekPace * 3)) : 0;
  // This week's budget from economy pieces: the house as built, or with the placement. The
  // tally's own count shows it as a popup, so it's left out while one plays.
  const budget = view ? null : p?.legal ? p.budgetAfter : tally.budget;
  const budgetBefore = !view && p?.legal ? p.budgetBefore : null;
  const gained = new Set(p?.legal ? p.setsGained.map((s) => s.key) : []);
  const sets =
    view || !p?.legal
      ? tally.sets
      : [...tally.sets.filter((s) => !p.setsLost.some((l) => l.key === s.key)), ...p.setsGained];
  // The checklist's lines held (M4a): as built, with the play's flips, or counted so far.
  const held = tally.specs.filter((s) => s.met).length;
  const specCount = view
    ? view.specs.filter((s, k) => s.met && k <= view.specAt).length
    : p?.legal
      ? held + p.specsGained.length - p.specsLost.length
      : held;
  const hasChecklist = (view ? view.specs : tally.specs).length > 0;

  return (
    <section
      class={`score-panel ${view?.big ? 'big' : ''}`}
      style={{ '--glow': String(glow) }}
      aria-live="polite"
    >
      <Celebration />
      <h2>{label}</h2>
      <div class="equation">
        {/* The values are keyed by what they show, so the tick pulse restarts on every step. */}
        <div class={`layer comfort ${view?.stage === 'pieces' ? 'ticking' : ''}`}>
          <div class="layer-name">
            <Tip term="comfort">{SCORE_LABELS.points}</Tip>
          </div>
          <div class="layer-value" key={shown.points}>
            {formatNumber(shown.points)}
          </div>
          {before && <Delta n={shown.points - before.points} />}
        </div>
        <div class="op">×</div>
        <div
          class={`layer charm ${view?.stage === 'sets' || view?.stage === 'specs' ? 'ticking' : ''}`}
        >
          <div class="layer-name">
            <Tip term="charm">{SCORE_LABELS.mult}</Tip>
          </div>
          <div class="layer-value" key={shown.mult}>
            {formatMult(shown.mult)}
          </div>
          {before && <Delta n={shown.mult - before.mult} mult />}
        </div>
        <div class="op">=</div>
        <div class={`layer wow ${view?.stage === 'total' ? 'landed' : ''}`}>
          <div class="layer-name">
            <Tip term="wow">{SCORE_LABELS.total}</Tip>
          </div>
          <div class="layer-value">{shown.total === null ? '…' : formatNumber(shown.total)}</div>
          {before && shown.total !== null && <Delta n={shown.total - before.total} />}
        </div>
      </div>
      <Sparkles list={view ? view.sparkles : p?.legal ? p.xMults : tally.xMults} />
      {view?.big && <div class="big-week">Big week!</div>}
      {budget !== null && (budget > 0 || (budgetBefore ?? 0) > 0) && (
        <p class="budget-line">
          +{formatNumber(budget)} budget this week
          {budgetBefore !== null && budget !== budgetBefore && (
            <span class={`budget-delta ${budget > budgetBefore ? 'good' : 'bad'}`}>
              {' '}
              {budget > budgetBefore ? '▲' : '▼'} {signed(budget - budgetBefore)}
            </span>
          )}
        </p>
      )}
      <h3>Sets</h3>
      <SetList sets={sets} gained={gained} lost={p?.legal && !view ? p.setsLost : []} />
      {hasChecklist && (
        <SpecCharm
          count={specCount}
          bonus={view ? view.specBonus : tally.specBonus}
          before={!view && p?.legal ? held : null}
          ticking={view?.stage === 'specs'}
          waiting={!!view && view.specAt < 0}
        />
      )}
    </section>
  );
}
