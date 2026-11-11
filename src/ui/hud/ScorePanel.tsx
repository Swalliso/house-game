// The week's score: Comfort × Charm = Wow (D-019, D-056). It shows the house as it stands,
// the preview's change while placing, and the tally's counters while they tick. M5a draws the
// layers as plaques: Comfort and Charm side by side, Wow below them at the hero size, and each
// ×Mult source as a gold Sparkle stamp. Under the sets, the checklist's part of the Charm (M4a).
// On a window under 1000 px tall the sets fold into one row, and while a play is looked at the
// panel keeps to its equation.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  SCORE_LABELS,
  type SetId,
  type SetScore,
  type WeekScore,
  type XMultTerm,
} from '../../rules/index.ts';
import { highlighted, tallyView } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { glowOf, type Tier } from '../fx/ladder.ts';
import { formatMult, formatNumber, signed } from '../format.ts';
import { Icon, Panel } from '../kit/kit.tsx';
import { currentTally, pace as paceSignal, preview, run } from '../store.ts';
import { Celebration } from './Celebration.tsx';
import { shown as onScreen } from './first-job.ts';
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

/** A plaque's size steps down at five digits or more, so big numbers still fit (§12, Numbers). */
function sizeClass(text: string): string {
  const digits = text.replace(/\D/g, '').length;
  return digits >= 7 ? 'longer' : digits >= 5 ? 'long' : '';
}

/**
 * The Wow number's steps where the browser can't fit it to its plaque (score.css sizes it from
 * the room it has, with CSS round()): small enough for the narrowest column, 280 px.
 */
export function wowSizeClass(text: string): string {
  const digits = text.replace(/\D/g, '').length;
  return digits >= 6 ? 'longer' : digits >= 4 ? 'long' : '';
}

/** A first set to try, while there are none. */
const FIRST_SET =
  'Try a Bathroom between two Bedrooms (Jack-and-Jill), or a Kitchen, Dining Room, and Living ' +
  'Room together (Entertainer).';

/** A set's level from Remodel Plans, 1 until then. */
const levelOf = (set: SetId) => run.value.setLevels[set] ?? 1;

/**
 * The folded row's tip: every set with its level and what it adds, as the list says it, on a
 * line of its own (the bubble keeps line breaks, tip.css): "Jack-and-Jill: +11 Comfort, +0.55
 * Charm.", then "Suite Lv 2: +28 Comfort, +0.83 Charm."
 */
export function setsTip(sets: readonly SetScore[], level: (set: SetId) => number): string {
  const { points: COMFORT, mult: CHARM } = SCORE_LABELS;
  return sets
    .map((s) => {
      const lv = level(s.set) > 1 ? ` Lv ${level(s.set)}` : '';
      return `${CONTENT.sets[s.set].name}${lv}: +${s.points} ${COMFORT}, +${formatMult(s.mult)} ${CHARM}.`;
    })
    .join('\n');
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
  // The list shows only on a window 1000 px tall or more (app.css), so the suggestion's short
  // form is the folded row's.
  if (sets.length === 0 && lost.length === 0) {
    return <p class="sets-empty">No sets yet. {FIRST_SET}</p>;
  }
  // Each set: its name, then its level (from Remodel Plans) and its Comfort and Charm. The icon
  // for a set the placement makes or breaks leads the name, so the name keeps its line.
  return (
    <ul class="sets">
      {sets.map((s) => {
        const level = levelOf(s.set);
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

let flashes = 0;

/**
 * A new id, held for a set's beat (FEEL.tally.setStepMs), each time `sig` changes outside a
 * tally, whose own beats light the folded row; else 0.
 */
function useChangeFlash(sig: string): number {
  const last = useRef(sig);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (last.current === sig) return;
    last.current = sig;
    if (!tallyView.value) setFlash(++flashes);
  }, [sig]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), FEEL.tally.setStepMs);
    return () => clearTimeout(t);
  }, [flash]);
  return flash;
}

/** What the sets add together: the folded row's Comfort and Charm (in hundredths). */
const sumOf = (sets: readonly SetScore[]) => ({
  points: sets.reduce((n, s) => n + s.points, 0),
  mult: sets.reduce((n, s) => n + s.mult, 0),
});

/**
 * The sets as one row (D-098, amended 2026-11-08): on a window under 1000 px tall the panel
 * shows it in place of the list (app.css), so the checklist keeps the column's room late in a
 * run. It has a set's shape, how many with what they add to Comfort and Charm at the right, and
 * the whole list is its tip. `lit` (a key, new for each beat) lights it in the board's set
 * highlight, Charm's rose, and pops its numbers. In a tally it shows the sets counted so far,
 * `waiting` (dimmed, from 0) until the first. Hook-free, so tests call it in place; SetsFold
 * keeps its light.
 */
export function FoldRow({
  sets,
  level,
  lit,
  waiting = false,
}: {
  sets: readonly SetScore[];
  level: (set: SetId) => number;
  lit: string | null;
  waiting?: boolean;
}) {
  if (sets.length === 0 && !waiting) {
    return (
      <p class="sets-empty sets-fold">
        <Tip title="No sets yet" text={FIRST_SET}>
          No sets yet.
        </Tip>
      </p>
    );
  }
  const { points, mult } = sumOf(sets);
  const count = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  return (
    <ul class="sets sets-fold">
      <li class={lit ? 'lit' : waiting ? 'waiting' : ''}>
        <span class="set-name">
          {sets.length > 0 ? (
            <Tip title="Sets" text={setsTip(sets, level)}>
              {count}
            </Tip>
          ) : (
            count
          )}
        </span>
        {/* Keyed by the beat, so its pop restarts on every set the tally counts. */}
        <span
          key={lit ?? 'rest'}
          class={`set-values ${lit ? 'popping' : ''}`}
          style={lit ? { animationDuration: `${FEEL.checklist.tickMs}ms` } : undefined}
        >
          <span class="set-comfort">+{formatNumber(points)}</span>
          <span class="set-charm">+{formatMult(mult)}</span>
        </span>
      </li>
    </ul>
  );
}

/**
 * The folded row, lit as the tally counts each set (`beat`, from the director's `highlighted`,
 * the board's set highlight), and when the sets change outside a tally (a Remodel Plans' level,
 * a demolition), so a change never goes by unseen.
 */
function SetsFold({
  sets,
  beat,
  waiting,
}: {
  sets: readonly SetScore[];
  beat: string | null;
  waiting: boolean;
}) {
  const { points, mult } = sumOf(sets);
  const flash = useChangeFlash(`${sets.length}/${points}/${mult}`);
  return (
    <FoldRow
      sets={sets}
      level={levelOf}
      lit={beat ?? (flash ? `flash-${flash}` : null)}
      waiting={waiting}
    />
  );
}

/**
 * The checklist's part of the Charm (M4a): the lines held and what they add, each line adding
 * the tally's `specBonus`. While a play is looked at, its change; while a tally plays, the
 * lines it has counted so far, pulsing as each lands. It's drawn as a set's row (score.css), so
 * it takes the sets' two lines in the pixel font and one in the readable font.
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
    <ul class="sets spec-rows">
      <li class={`spec-row ${waiting ? 'waiting' : ''}`}>
        <span class="set-name">
          <Icon name="check" />
          <span>
            {/* Keyed by the count while it ticks, so the pulse restarts on every line. */}
            <span
              key={ticking ? count : 'count'}
              class={`spec-count ${ticking ? 'ticking' : ''}`}
              style={ticking ? { animationDuration: `${FEEL.checklist.tickMs}ms` } : undefined}
            >
              {count}
            </span>{' '}
            <Tip term="checklist">checklist</Tip> {count === 1 ? 'line' : 'lines'}
          </span>
        </span>
        <span class="set-values">
          <span class="set-charm">
            <Icon name="charm" label={SCORE_LABELS.mult} />+{formatMult(count * bonus)}
          </span>
        </span>
        {before !== null && <Delta n={(count - before) * bonus} mult />}
      </li>
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

/** The tier's word on the panel as the total lands (§12, D-124); a Normal week has none. */
const TIER_WORDS: Readonly<Record<Exclude<Tier, 'normal'>, string>> = {
  good: 'Good week!',
  great: 'Great week!',
  huge: 'Huge week!',
};

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
  // than going dark until the total lands. It grows with I = log5(total ÷ pace) (§12, D-124).
  const glowTotal = view ? view.weekTotal : shown.total;
  const glow = glowOf(glowTotal, view ? view.pace : pace);
  const tier = view?.tier && view.tier !== 'normal' ? view.tier : null;
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
  // The set the tally is counting: its members light on the board, and the folded row with them.
  const counting = highlighted.value;
  const beat = view?.stage === 'sets' && counting.length > 0 ? counting.join(',') : null;
  const points = formatNumber(shown.points);
  const mult = formatMult(shown.mult);
  const total = shown.total === null ? '…' : formatNumber(shown.total);

  return (
    <div class={`score-panel ${tier ? `tier-${tier}` : ''}`} style={{ '--glow': String(glow) }}>
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
          {/* Charm ticks on each set, and on each checklist line (M4a). */}
          <div
            class={`layer charm ${view?.stage === 'sets' || view?.stage === 'specs' ? 'ticking' : ''}`}
          >
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
            {/* The number sizes itself to the room left beside "Wow" (score.css), by its length. */}
            <span class="wow-fit">
              <span
                class={`wow-number ${wowSizeClass(total)}`}
                style={{ '--wow-cells': String(total.length) }}
              >
                {total}
              </span>
            </span>
          </span>
          {before && shown.total !== null && <Delta n={shown.total - before.total} />}
        </div>
        <Sparkles list={view ? view.sparkles : p?.legal ? p.xMults : tally.xMults} />
        {tier && (
          <div class={`big-week tier-${tier}`} key={tier}>
            {TIER_WORDS[tier]}
          </div>
        )}
        {budget !== null && (budget > 0 || (budgetBefore ?? 0) > 0) && (
          <p class="budget-line">
            <Icon name="coin" />
            <span class="budget-words">+{formatNumber(budget)} budget this week</span>
            {budgetBefore !== null && budget !== budgetBefore && (
              <Delta n={budget - budgetBefore} />
            )}
          </p>
        )}
        {/* Under 1000 px tall the sets fold into one row, and while a play is looked at the
            panel keeps to its equation (app.css): Inspect's notes say which sets and checklist
            lines the play would change. */}
        <div class="score-detail">
          <div class="sets-full">
            <h3 class="score-sets-title">Sets</h3>
            <SetList sets={sets} gained={gained} lost={p?.legal && !view ? p.setsLost : []} />
          </div>
          {/* In a tally, the sets it has counted so far: it counts up with Comfort and Charm. */}
          <SetsFold
            sets={view ? view.sets.slice(0, view.setAt) : tally.sets}
            beat={beat}
            waiting={!!view && view.setAt === 0 && view.sets.length > 0}
          />
          {/* The first job's checklist comes in after the opening (D-149): until then the row
              shows only once a line holds, to say where that Charm is from. */}
          {hasChecklist && (onScreen.value.checklist || specCount > 0) && (
            <SpecCharm
              count={specCount}
              bonus={view ? view.specBonus : tally.specBonus}
              before={!view && p?.legal ? held : null}
              ticking={view?.stage === 'specs'}
              waiting={!!view && view.specAt < 0}
            />
          )}
        </div>
      </Panel>
    </div>
  );
}
