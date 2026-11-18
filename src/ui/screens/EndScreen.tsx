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
// ragged (playtest 5a). M6's photo of the house at each milestone is a strip under the board
// (EndPhotos.tsx, D-136).
//
// M6 (D-135): Copy result copies the run as one line for the group chat, with a link that
// starts the same lot (result-line.ts).
//
// D-139: under the verdict, the next verdict up and the Wow it starts at, and how this house
// stands against the company's record for its client (company.ts): a new best, or the best to
// beat.
//
// D-150: a loss leads into the next run: "Try this lot again", which starts the same lot, client
// and crew at once, as the Portfolio's Play this lot again does (a win says that too, under the
// stats), and a "Next time" tip read from the run (next-time.ts). Both sit in the column, not in
// the sticky bar (D-148).
//
// D-152 (playtest, 2026-11-11): Copy run code sits on the plank beside "Job done!" ("Run
// over"), in view at the column's top on every window. Under the stats (D-148) it was a scroll
// away that nothing on screen showed (617 px below the fold on a 1728×963 laptop), and a
// playtester couldn't find it. After a loss, Try this lot again and the tip come straight under
// the verdict, over the milestones: under the stats they were below the fold on every window.

import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  rules,
  SCORE_LABELS,
  type MilestoneRecord,
  type RunState,
} from '../../rules/index.ts';
import { bestFor, company, jobKey, lastStanding } from '../company.ts';
import { busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { copyRunCode, copyText, endScreenAgain, startNewRun } from '../hud/actions.ts';
import { Button, Icon, Panel, type IconName } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { goToTitle, run } from '../store.ts';
import { ICON_SIZES } from '../theme/art.ts';
import { nextTime } from './next-time.ts';
import { endSignShown, Notes } from './Overlays.tsx';
import { resultLine } from './result-line.ts';
import './end.css';

const WOW = SCORE_LABELS.total;

function weeks(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

/** A milestone's result as a short tag (an early one's bonus is its own part: Milestones). */
export function resultTag(m: MilestoneRecord): string {
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
          // The early bonus, and the last milestone's leftover budget (D-145): both Wow it paid.
          const bonus =
            (m.result === 'early' ? m.reward.score : 0) + (m.reward.leftover?.score ?? 0);
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
  const left = s.milestones.at(-1)?.reward.leftover;
  const rows: StatRow[] = [
    // Every placement takes the next uid, so this counts demolished and grown pieces too.
    { icon: 'House', label: 'Pieces built', value: s.house.nextUid - 1 },
    { icon: 'clock', label: 'Weeks played', value: s.week },
    { icon: 'coin', label: 'Budget earned', value: formatNumber(s.budgetEarned) },
    // What was still held at the last milestone, and the Wow it paid (D-145). Kept short: with
    // the unit on it, this row alone put every stat on two lines at 1920×1080. The Final
    // Walkthrough's row above says "+1,700 Wow".
    ...(left
      ? [
          {
            icon: 'coin' as const,
            label: `${formatNumber(left.budget)} budget left`,
            value: `+${formatNumber(left.score)}`,
          },
        ]
      : []),
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

/** A client's name inside a sentence: "the Hendersons", "Count Vladislav". */
export function clientInText(clientId: string): string {
  const name = CONTENT.clients[clientId as keyof typeof CONTENT.clients]?.name;
  return name ? name.replace(/^The\s/, 'the ') : 'this client';
}

/**
 * Under the verdict (D-139): the verdict above this one and the Wow it starts at, then how the
 * house stands against the company's record for its client. A debug run is never filed, so it
 * says neither a best nor a first.
 */
function Standing({ s }: { s: RunState }) {
  const next = rules.nextVerdict(s);
  const filed = lastStanding.value;
  const mine = filed && filed.key === jobKey(s.setup) ? filed.standing : null;
  const client = clientInText(s.setup.clientId);
  // Loaded already finished (not filed this visit): the record as it stands.
  const best = mine ? mine.previous : s.debug ? null : bestFor(company.value, s.setup.clientId);
  let record = null;
  if (mine?.newBest) {
    record = (
      <p class="run-end-record best">
        <Icon name="star" /> New best for {client}
        {mine.previous?.won && (
          <span class="was">
            was <span class="num">{formatNumber(mine.previous.score)}</span>
          </span>
        )}
      </p>
    );
  } else if (mine && !mine.previous) {
    record = <p class="run-end-record">Your first house for {client}</p>;
  } else if (best) {
    record = (
      <p class="run-end-record">
        Your best for {client}: <span class="num">{formatNumber(best.score)}</span>
      </p>
    );
  }
  if (!next && !record) return null;
  return (
    <div class="run-end-standing">
      {next && (
        <p class="run-end-next">
          {next.name} at <span class="num">{formatNumber(next.score)}</span>
        </p>
      )}
      {record}
    </div>
  );
}

/** D-150: a lost run's tip for the next one (next-time.ts), just under Try this lot again (D-152). */
function NextTimeTip({ s }: { s: RunState }) {
  const tip = nextTime(s);
  if (!tip) return null;
  return (
    <section class="run-end-section run-end-tip">
      <h3 class="plank-tag">Next time</h3>
      <p class={`run-end-tip-text ${tip.kind}`}>
        <Icon name={tip.kind === 'set' ? 'charm' : 'reroll'} />
        <span>{tip.text}</span>
      </p>
    </section>
  );
}

/** When the end screen came up (EndScreen's layout effect), for `settled`. */
let shownAt = -Infinity;

/** The end screen is up as of `now`: its buttons wait out FEEL.endScreen.clickDelayMs. */
export function endScreenShown(now = performance.now()): void {
  shownAt = now;
}

/**
 * Whether the end screen has been up long enough for a click on its buttons to be meant for
 * them. They come up where End week was, the moment the last tally ends, so the second click of
 * a double-click that skipped the tally used to land on Title or New run, and the end screen
 * can't be opened again.
 */
export function settled(now = performance.now()): boolean {
  return now - shownAt >= FEEL.endScreen.clickDelayMs;
}

/** A button's action, once the screen has settled. */
const whenSettled = (act: () => void) => () => {
  if (settled()) act();
};

/**
 * Copy run code on the plank (D-152), as Reroll is on the hand's: in view at the column's top
 * on every window as the screen comes up. Its words shorten as the plank narrows, to the icon
 * alone, so the plank's title always shows (end.css); its name is always "Copy run code". The
 * Menu has it too.
 */
function CopyRunCode() {
  return (
    <Button
      size="sm"
      icon="copy"
      class="run-end-code"
      tip="Copy run code"
      aria-label="Copy run code"
      onClick={whenSettled(() => void copyRunCode())}
    >
      <span class="run-end-code-long">Copy run code</span>
      <span class="run-end-code-short">Copy code</span>
    </Button>
  );
}

/**
 * Try this lot again, or Play this lot again after a win (D-150): a new run on this lot, for the
 * same client with the same crew, at once.
 */
function AgainButton({ s, won }: { s: RunState; won: boolean }) {
  return (
    <Button
      class="run-end-again"
      icon="House"
      tip="A new run on this lot, for the same client with the same crew"
      onClick={(e) => {
        if (!settled()) return;
        // The game stays on screen, and the column may have been scrolled to reach this button:
        // the new run's goods and hand start at its top, as a run from the board does.
        const column = e.currentTarget.closest('.right');
        endScreenAgain(s);
        column?.scrollTo({ top: 0, behavior: 'instant' });
      }}
    >
      {/* The short word where the long one doesn't fit (end.css): one is display: none, so the
          name read out is the one on screen. */}
      <span class="run-end-again-long">{won ? 'Play this lot again' : 'Try this lot again'}</span>
      <span class="run-end-again-short">{won ? 'Play again' : 'Try again'}</span>
    </Button>
  );
}

/**
 * The run-end screen, in place of the hand. It waits for the last tally and banner to play
 * (busy), so the player sees the final week land before the summary.
 */
export function EndScreen() {
  const s = run.value;
  const shown = (s.screen === 'won' || s.screen === 'lost') && !busy.value;
  // Before the browser can deliver a click: a layout effect runs with the render that shows it.
  useLayoutEffect(() => {
    if (shown) endScreenShown();
  }, [shown]);
  if (!shown) return null;
  return <EndPanel s={s} />;
}

/** The end screen's panel for a finished run. No hooks of its own (end-panel.test.tsx walks it). */
export function EndPanel({ s }: { s: RunState }) {
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
      head={<CopyRunCode />}
    >
      <header class="run-end-head">
        {won && <Icon name="trophy" class="run-end-trophy" />}
        <p class="run-end-title">{title}</p>
        <p class="run-end-verdict">{rules.verdict(s)}</p>
        <p class="run-end-score">
          <span class="value num">{formatNumber(s.score)}</span>
          <span class="unit">{won ? WOW : `of ${formatNumber(rules.target(s))} ${WOW}`}</span>
        </p>
        <Standing s={s} />
      </header>
      {/* After a loss, Try this lot again and the "Next time" tip come first (D-150, D-152):
          under the stats they were below the fold on every window. The button leads, so it
          shows on a 1280×720 window too, where the tip's lines would push it under the sticky
          bar. */}
      {!won && (
        <>
          <div class="run-end-retry">
            <AgainButton s={s} won={false} />
          </div>
          <NextTimeTip s={s} />
        </>
      )}
      <Milestones s={s} />
      <Stats s={s} />
      {s.debug && <p class="run-end-debug">A debug run: cheats were used.</p>}
      {/* Title sits in the column, under the stats, not in the sticky bar (D-148): four rows of
          buttons hid the milestones on a laptop. The Menu has it too. After a win, Play this lot
          again (D-150) leads the group, on a row of its own. */}
      <div class="run-end-more">
        {won && <AgainButton s={s} won />}
        <Button icon="exit" onClick={whenSettled(() => goToTitle())}>
          Title
        </Button>
      </div>
      <div class="run-end-actions">
        <Button variant="primary" size="lg" block onClick={whenSettled(() => startNewRun())}>
          New run
        </Button>
        <Button
          class="run-end-share"
          icon="copy"
          tip="One line for the group chat: your verdict, Wow and milestones, and a link to play this lot"
          onClick={whenSettled(() => void copyText(resultLine(s), 'Result copied'))}
        >
          Copy result
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
