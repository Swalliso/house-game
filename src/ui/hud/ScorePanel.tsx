// The week's score: Comfort × Charm = Wow (D-019, D-056). It shows the house as it stands,
// the preview's change while placing, and the tally's counters while they tick. M5a draws the
// layers as plaques: Comfort and Charm side by side, Wow below them at the hero size, and each
// ×Mult source as a gold Sparkle stamp.

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
import { Icon, Panel } from '../kit/kit.tsx';
import { currentTally, pace as paceSignal, preview, run } from '../store.ts';
import { Celebration } from './Celebration.tsx';
import { Tip } from './Tip.tsx';
import './score.css';

function Delta({ n, mult = false }: { n: number; mult?: boolean }) {
  if (n === 0) return null;
  return (
    <span class={`delta ${n > 0 ? 'good' : 'bad'}`}>
      <Icon name={n > 0 ? 'up' : 'down'} />
      {signed(n, mult ? formatMult : formatNumber)}
    </span>
  );
}

/** A plaque's size steps down at six digits or more, so big numbers still fit (§12, Numbers). */
function sizeClass(text: string): string {
  const digits = text.replace(/\D/g, '').length;
  return digits >= 7 ? 'longer' : digits >= 5 ? 'long' : '';
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
        No sets yet. Try a Bathroom between two Bedrooms (Jack-and-Jill), or a Kitchen, Dining Room,
        and Living Room together (Entertainer).
      </p>
    );
  }
  // Each set: its name, then its level (from Remodel Plans) and its Comfort and Charm. The icon
  // for a set the placement makes or breaks leads the name, so the name keeps its line.
  return (
    <ul class="sets">
      {sets.map((s) => {
        const level = levels[s.set] ?? 1;
        return (
          <li key={s.key} class={gained.has(s.key) ? 'gained' : ''}>
            <span class="set-name">
              {gained.has(s.key) && <Icon name="star" label="New" />}
              {CONTENT.sets[s.set].name}
            </span>
            {level > 1 && <span class="set-level">Lv {level}</span>}
            <span class="set-values">
              <span class="set-comfort">+{s.points}</span>
              <span class="set-charm">+{formatMult(s.mult)}</span>
            </span>
          </li>
        );
      })}
      {lost.map((s) => (
        <li key={s.key} class="lost">
          <span class="set-name">
            <Icon name="cross" label="Broken" />
            {CONTENT.sets[s.set].name}
          </span>
          <span class="set-values">
            <span class="set-comfort">−{s.points}</span>
            <span class="set-charm">−{formatMult(s.mult)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The week's ×Mult sources as gold stamps (D-056). */
function Sparkles({ list }: { list: readonly XMultTerm[] }) {
  if (list.length === 0) return null;
  return (
    <div class="sparkles" aria-label={SCORE_LABELS.xMult}>
      <span class="sparkles-label">
        <Icon name="sparkle" />
        <Tip term="sparkle">{SCORE_LABELS.xMult}</Tip>
      </span>
      <ul class="sparkle-stamps">
        {list.map((x) => (
          <li
            key={`${x.source.kind}:${x.label}`}
            class="sparkle-stamp"
            title={`${SCORE_LABELS.xMult}: ×${formatMult(x.times)} ${SCORE_LABELS.mult}`}
          >
            {x.label} <span class="num">×{formatMult(x.times)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScorePanel() {
  const view = tallyView.value;
  const p = preview.value;
  const tally = currentTally.value;
  const pace = paceSignal.value;
  let shown: { points: number; mult: number; total: number | null } = tally;
  let before: WeekScore | null = null;
  let label = 'Each week';
  if (view) {
    shown = { points: view.points, mult: view.mult, total: view.total };
    label = view.fastForward ? 'Fast-forward' : 'This week';
  } else if (p?.legal) {
    shown = p.after;
    before = p.before;
    label = 'With this piece';
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
  const points = formatNumber(shown.points);
  const mult = formatMult(shown.mult);
  const total = shown.total === null ? '…' : formatNumber(shown.total);

  return (
    <div class={`score-panel ${view?.big ? 'big' : ''}`} style={{ '--glow': String(glow) }}>
      <Panel title={label} label={`${SCORE_LABELS.total} this week`}>
        <Celebration />
        <div class="equation" aria-live="polite">
          {/* The values are keyed by what they show, so the tick pulse restarts on every step. */}
          <div class={`layer comfort ${view?.stage === 'pieces' ? 'ticking' : ''}`}>
            <span class="layer-name">
              <Icon name="comfort" />
              <Tip term="comfort">{SCORE_LABELS.points}</Tip>
            </span>
            <span class={`plaque plaque-comfort layer-value ${sizeClass(points)}`} key={points}>
              {points}
            </span>
            {before && <Delta n={shown.points - before.points} />}
          </div>
          <span class="op" aria-hidden="true">
            ×
          </span>
          <div class={`layer charm ${view?.stage === 'sets' ? 'ticking' : ''}`}>
            <span class="layer-name">
              <span class="op-inline" aria-hidden="true">
                ×
              </span>
              <Icon name="charm" />
              <Tip term="charm">{SCORE_LABELS.mult}</Tip>
            </span>
            <span class={`plaque plaque-charm layer-value ${sizeClass(mult)}`} key={mult}>
              {mult}
            </span>
            {before && <Delta n={shown.mult - before.mult} mult />}
          </div>
        </div>
        <div class={`layer wow ${view?.stage === 'total' ? 'landed' : ''}`}>
          <span class="op" aria-hidden="true">
            =
          </span>
          <span class="plaque plaque-wow layer-value">
            <span class="layer-name">
              <Tip term="wow">{SCORE_LABELS.total}</Tip>
            </span>
            <span class={`wow-number ${sizeClass(total)}`}>{total}</span>
          </span>
          {before && shown.total !== null && <Delta n={shown.total - before.total} />}
        </div>
        <Sparkles list={view ? view.sparkles : p?.legal ? p.xMults : tally.xMults} />
        {view?.big && <div class="big-week">Big week!</div>}
        {budget !== null && (budget > 0 || (budgetBefore ?? 0) > 0) && (
          <p class="budget-line">
            <Icon name="coin" />+{formatNumber(budget)} budget this week
            {budgetBefore !== null && budget !== budgetBefore && (
              <Delta n={budget - budgetBefore} />
            )}
          </p>
        )}
        <h3 class="score-sets-title">Sets</h3>
        <SetList sets={sets} gained={gained} lost={p?.legal && !view ? p.setsLost : []} />
      </Panel>
    </div>
  );
}
