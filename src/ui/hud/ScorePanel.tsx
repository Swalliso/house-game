// The week's score: Comfort × Charm = Wow (D-019, D-056). It shows the house as it stands,
// the preview's change while placing, and the tally's counters while they tick. M5a draws the
// layers as plaques: Comfort and Charm side by side, Wow below them at the hero size, and each
// ×Mult source as a gold Sparkle stamp.
//
// D-167 (the text diet): at rest, and while a play is looked at, the panel is its equation. The
// sets as one row, and the checklist's part of the Charm (M4a), slide in under it as a tally
// starts and count up there, then slide away once it ends. At rest the plaques' tips say what
// the sets and the checklist's lines add.

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

/** What the sets add together: the folded row's Comfort and Charm (in hundredths). */
const sumOf = (sets: readonly SetScore[]) => ({
  points: sets.reduce((n, s) => n + s.points, 0),
  mult: sets.reduce((n, s) => n + s.mult, 0),
});

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Comfort's plaque tip (D-167): what the sets add to it, then each set on a line of its own, as
 * the sets' row's tip lists them. With no sets yet, the first set to try.
 */
export function comfortTip(sets: readonly SetScore[], level: (set: SetId) => number): string {
  if (sets.length === 0) return `No sets yet. ${FIRST_SET}`;
  const { points } = sumOf(sets);
  const add = sets.length === 1 ? 'adds' : 'add';
  const sum = `${plural(sets.length, 'set')} ${add} +${formatNumber(points)} ${SCORE_LABELS.points}.`;
  return `${sum}\n${setsTip(sets, level)}`;
}

/**
 * Charm's plaque tip (D-167): what the sets add to it, and what the checklist's lines that hold
 * add, each line `bonus` (in hundredths), where the checklist's row would show.
 */
export function charmTip(sets: readonly SetScore[], lines: number | null, bonus: number): string {
  const { mult } = sumOf(sets);
  const out = [
    sets.length > 0 ? `+${formatMult(mult)} from ${plural(sets.length, 'set')}.` : 'No sets yet.',
  ];
  if (lines !== null)
    out.push(`+${formatMult(lines * bonus)} from ${plural(lines, 'checklist line')}.`);
  return out.join('\n');
}

/**
 * The sets as one row (D-098, amended 2026-11-08), in a tally on every window (D-167): it has a
 * set's shape, how many with what they add to Comfort and Charm at the right, and the whole list
 * is its tip. `lit` (a key, new for each beat) lights it in the board's set highlight, Charm's
 * rose, and pops its numbers. In a tally it shows the sets counted so far, `waiting` (dimmed,
 * from 0) until the first. Hook-free, so tests call it in place.
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
 * The checklist's part of the Charm (M4a): the lines held and what they add, each line adding
 * the tally's `specBonus`. It shows in a tally (D-167): the lines counted so far, pulsing as
 * each lands. It's drawn as a set's row (score.css), so
 * it takes the sets' two lines in the pixel font and one in the readable font.
 */
function SpecCharm({
  count,
  bonus,
  ticking,
  waiting,
}: {
  count: number;
  bonus: number;
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
            data-tip={`${SCORE_LABELS.xMult}: ×${formatMult(x.times)} ${SCORE_LABELS.mult}`}
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
  // The first job's checklist comes in after the opening (D-149): until then the checklist's
  // row, and its part of Charm's tip, wait until a line holds, to say where that Charm is from.
  const checklistShown = hasChecklist && (onScreen.value.checklist || specCount > 0);
  const specBonus = view ? view.specBonus : tally.specBonus;
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
            {/* What the sets add is its tip (D-167): the sets' row shows only in a tally. */}
            <span
              class={`plaque plaque-comfort layer-value ${sizeClass(points)}`}
              key={points}
              data-tip={comfortTip(sets, levelOf)}
            >
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
            <span
              class={`plaque plaque-charm layer-value ${sizeClass(mult)}`}
              key={mult}
              data-tip={charmTip(sets, checklistShown ? specCount : null, specBonus)}
            >
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
        {/* The sets' row and the checklist's slide in as a tally starts and count up there, then
            slide away once it ends (D-167, score.css): at rest, and while a play is looked at,
            the panel is its equation. Inspect's notes say which sets and checklist lines a play
            would change, and the plaques' tips what they add. Closed, it's hidden from the
            keyboard and screen readers too. */}
        <div class={`score-detail ${view ? 'open' : ''}`} aria-hidden={view ? undefined : 'true'}>
          <div class="score-detail-rows">
            {/* The sets the tally has counted so far: it counts up with Comfort and Charm. */}
            <FoldRow
              sets={view ? view.sets.slice(0, view.setAt) : tally.sets}
              level={levelOf}
              lit={beat}
              waiting={!!view && view.setAt === 0 && view.sets.length > 0}
            />
            {checklistShown && (
              <SpecCharm
                count={specCount}
                bonus={specBonus}
                ticking={view?.stage === 'specs'}
                waiting={!!view && view.specAt < 0}
              />
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
