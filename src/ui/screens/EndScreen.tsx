// The win and lose screens (implementation-plan.md §7, M2; Appendix A · M2): the verdict, the
// final Wow, each milestone's result, and the run's stats, in the right-hand column. The house
// stays on the board beside it, captioned "It's a house." A loss gets the same screen, gently.
// Every number comes from the rules' state; the UI only counts and formats.
//
// M5a draws it as a wood panel: the verdict as a stamp (gold for a win), the final Wow on the
// score panel's framed plaque, the milestones and the stats as rows with icons, and New run as
// the one primary button, kept in view at the column's foot. Each list takes one shape for all
// its rows, the most compact that every row fits on its lines (useShape): the column is 280 to
// 404 px wide, and the pixel font is wide, so a row that wrapped on its own would leave the list
// ragged (playtest 5a). The full-width finale with a photo per milestone is M6's.
//
// M6 (D-135): Copy result, above Copy run code, copies the run as one line for the group chat,
// with a link that starts the same lot (result-line.ts).

import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  rules,
  SCORE_LABELS,
  type MilestoneRecord,
  type RunState,
} from '../../rules/index.ts';
import { busy } from '../fx/director.ts';
import { formatNumber } from '../format.ts';
import { copyRunCode, copyText, startNewRun } from '../hud/actions.ts';
import { Button, Icon, Panel, type IconName } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { goToTitle, run } from '../store.ts';
import { ICON_SIZES } from '../theme/art.ts';
import { endSignShown, Notes } from './Overlays.tsx';
import { resultLine } from './result-line.ts';
import './end.css';

const WOW = SCORE_LABELS.total;

function weeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

/** A milestone's result as a short tag (an early one's bonus is its own part: Milestones). */
function resultTag(m: MilestoneRecord): string {
  switch (m.result) {
    case 'onTime':
      return 'On time';
    case 'early':
      return `${weeks(m.weeksSaved)} early`;
    case 'overtime':
      return m.overtimeUsed > 1 ? `${weeks(m.overtimeUsed)} of overtime` : 'Overtime';
    case 'failed':
      return 'Missed';
  }
}

/**
 * The width of an element's text set on one line, in CSS px: each run of text in its own font
 * (a canvas measures it), leaving out what only screen readers get.
 */
function textWidth(el: Element | null): number {
  const ctx = (measuring ??= document.createElement('canvas').getContext('2d'));
  if (!el || !ctx) return 0;
  let w = 0;
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const parent = n.parentElement;
      if (!parent || parent.closest('.run-end-sr')) return;
      // Its parts, not the `font` shorthand: that's empty where it can't say all of the font
      // (tabular numbers, on .num).
      const f = getComputedStyle(parent);
      ctx.font = `${f.fontStyle} ${f.fontWeight} ${f.fontSize} ${f.fontFamily}`;
      w += ctx.measureText(n.textContent ?? '').width;
    } else n.childNodes.forEach(walk);
  };
  walk(el);
  return w;
}
let measuring: CanvasRenderingContext2D | null | undefined;

/** An element's width with its side margins (an icon's slot), in CSS px. */
function outerWidth(el: Element | null): number {
  if (!el) return 0;
  const m = getComputedStyle(el);
  return (
    el.getBoundingClientRect().width +
    Number.parseFloat(m.marginLeft) +
    Number.parseFloat(m.marginRight)
  );
}

/**
 * The shape a list takes, for all its rows: `measure` says the most compact one every row fits.
 * Measured from the rows' text, not their current layout, so the answer doesn't depend on the
 * shape it's in; again as the column resizes, the font switches, or the pixel fonts load (in the
 * next frame, so a new shape never resizes the list while its resize is being reported).
 */
function useShape<E extends HTMLElement, S>(measure: (el: E) => S, initial: S): [RefObject<E>, S] {
  const ref = useRef<E>(null);
  const [shape, setShape] = useState(initial);
  const readable = settings.value.readableFont;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    let frame = 0;
    const check = () => {
      if (live) setShape(measure(el));
    };
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    check();
    const watch = new ResizeObserver(later);
    watch.observe(el);
    void document.fonts?.ready.then(later);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [readable]);
  return [ref, shape];
}

/**
 * How the milestones' rows lay out, each under its name: how it went, an early one's bonus and
 * its Wow against the target on one line (`compact`); or the figures on a line of their own
 * (`narrow`); or the bonus starting that line (`split`).
 */
type MilestoneShape = 'compact' | 'narrow' | 'split';

/** The most compact shape every milestone row fits (a sub-pixel to spare). */
function milestoneShape(ol: HTMLElement): MilestoneShape {
  let compact = true;
  let narrow = true;
  for (const li of ol.querySelectorAll('li')) {
    const line = li.querySelector('.line');
    if (!line) continue;
    const room = line.clientWidth - 0.5;
    const gap = Number.parseFloat(getComputedStyle(line).columnGap) || 0;
    const head = outerWidth(li.querySelector('.mark')) + gap + textWidth(li.querySelector('.tag'));
    const bonus = li.querySelector('.bonus') ? gap + textWidth(li.querySelector('.bonus')) : 0;
    const figures = textWidth(li.querySelector('.figures'));
    if (head + bonus + gap + figures > room) compact = false;
    if (head + bonus > room || figures > room) narrow = false;
  }
  return compact ? 'compact' : narrow ? 'narrow' : 'split';
}

/** Every milestone in order: the ones resolved with their result, the rest greyed. */
function Milestones({ s }: { s: RunState }) {
  const phases = CONTENT.balance.phases;
  const byPhase = new Map(s.milestones.map((m) => [m.phase, m]));
  const met = s.milestones.filter((m) => m.result !== 'failed').length;
  const [ref, shape] = useShape<HTMLOListElement, MilestoneShape>(milestoneShape, 'split');
  return (
    <section class="run-end-section">
      <h3 class="plank-tag" aria-label={`Milestones: ${met} of ${phases.length}`}>
        Milestones
        <span class="plank-count">
          {met}/{phases.length}
        </span>
      </h3>
      <ol ref={ref} class={`run-end-milestones ${shape}`}>
        {phases.map((p, i) => {
          const m = byPhase.get(i);
          if (!m) {
            // The rules own the targets (a client may scale them later), so ask them.
            const target = rules.target({ ...s, phase: i });
            return (
              <li key={i} class="todo">
                <span class="name">{p.name}</span>
                <span class="line">
                  <Icon name="pending" class="mark" />
                  <span class="tag">Not reached</span>
                  <span class="break" />
                  <span class="figures">
                    <span class="target">of {formatNumber(target)}</span>
                  </span>
                </span>
              </li>
            );
          }
          const failed = m.result === 'failed';
          const bonus = m.result === 'early' ? m.reward.score : 0;
          return (
            <li key={i} class={`${failed ? 'failed' : 'met'} ${m.result}`}>
              <span class="name">{p.name}</span>
              <span class="line">
                <Icon name={failed ? 'cross' : 'check'} class="mark" />
                <span class="tag">{resultTag(m)}</span>
                <span class="break" />
                {bonus > 0 && (
                  <span class="bonus">
                    +{formatNumber(bonus)}
                    <span class="run-end-sr"> {WOW}</span>
                  </span>
                )}
                <span class="figures">
                  <span class="score num">{formatNumber(m.score)}</span>{' '}
                  <span class="target">of {formatNumber(m.target)}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface StatRow {
  icon: IconName;
  label: string;
  value: string | number;
}

/**
 * Where each stat's icon sits, in UI pixels: in a slot as wide as the widest icon, so the labels
 * line up (the flag is 10 wide, the house 8), centered on whole UI pixels (an odd difference
 * leaves the extra pixel on the right).
 */
export function iconSlots(icons: readonly IconName[]): { lead: number; trail: number }[] {
  const slot = Math.max(...icons.map((i) => ICON_SIZES[i].w));
  return icons.map((i) => {
    const room = slot - ICON_SIZES[i].w;
    const lead = Math.floor(room / 2);
    return { lead, trail: room - lead };
  });
}

function Stat({ icon, label, value, lead, trail }: StatRow & { lead: number; trail: number }) {
  return (
    <div class="stat">
      <dt style={{ '--icon-lead': String(lead), '--icon-trail': String(trail) }}>
        <Icon name={icon} />
        {label}
      </dt>
      <dd class="num">{value}</dd>
    </div>
  );
}

/** Each stat on one line, its value at the right, if every one fits; else each value under its label. */
function statsShape(dl: HTMLElement): 'line' | 'stacked' {
  for (const row of dl.querySelectorAll('.stat')) {
    const dt = row.querySelector('dt');
    if (!dt) continue;
    const lead =
      outerWidth(dt.querySelector('.icon')) +
      (Number.parseFloat(getComputedStyle(dt).columnGap) || 0);
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
    const need = lead + textWidth(dt) + gap + textWidth(row.querySelector('dd'));
    if (need > row.clientWidth - 0.5) return 'stacked';
  }
  return 'line';
}

function Stats({ s }: { s: RunState }) {
  const overtime = s.milestones.reduce((sum, m) => sum + m.overtimeUsed, 0);
  const rows: StatRow[] = [
    // Every placement takes the next uid, so this counts demolished and grown pieces too.
    { icon: 'House', label: 'Pieces built', value: s.house.nextUid - 1 },
    { icon: 'clock', label: 'Weeks played', value: s.week },
    { icon: 'coin', label: 'Budget earned', value: formatNumber(s.budgetEarned) },
    { icon: 'flag', label: 'Finished early', value: s.milestonesEarly },
    { icon: 'warn', label: 'Overtime weeks', value: overtime },
  ];
  const slots = iconSlots(rows.map((r) => r.icon));
  const [ref, shape] = useShape<HTMLDListElement, 'line' | 'stacked'>(statsShape, 'stacked');
  return (
    <section class="run-end-section">
      <h3 class="plank-tag">The run</h3>
      <dl ref={ref} class={`run-end-stats ${shape}`}>
        {rows.map((r, i) => (
          <Stat key={r.label} {...r} {...slots[i]!} />
        ))}
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
      title={won ? 'Job done!' : 'Run over'}
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
        <Button
          class="run-end-share"
          icon="copy"
          title="One line for the group chat: your verdict, Wow and milestones, and a link to play this lot"
          onClick={() => void copyText(resultLine(s), 'Result copied')}
        >
          Copy result
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
 * from the board. Notes and toasts (the replay's note, "Run code copied") sit just under it, in
 * its column, so they never cover it.
 */
export function EndCaption() {
  if (!endSignShown()) return null;
  return (
    <div class="run-end-caption-place">
      <p class={`run-end-caption ui ${run.value.screen}`}>It’s a house.</p>
      <Notes under="sign" />
    </div>
  );
}
