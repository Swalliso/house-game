// Change orders (M4b; implementation-plan.md §5, D-109, D-144): after milestones 2, 4, and 6
// the client changes their mind, on a sheet over the board, before the shop. The sheet shows
// two orders side by side and one must be picked: the other goes back in the pool. A request or
// a restriction pays if it's seen through the phase; a phase effect changes what earns, and
// says what it would do to the house as it stands. The sheet arrives with a paper flourish, and
// the pick is stamped on its card as it goes (director.ts plays both beats). What each order
// asks, pays and changes comes from the rules' changeOrderOffer(): the UI only lays it out.
//
// In the pixel UI (D-110): a kit Panel on a scrim over the board, as the shop's sheet is. It
// holds the keyboard on its text, never on a button, so a held key can't answer it before
// FEEL.changeOrder.keyDelayMs: App.tsx's keys (1 picks the left order, 2 the right; Enter
// takes an order offered alone) answer it, and it stays out of anyModalOpen() so they still
// reach it. Tab cycles through the pick buttons, and focus goes back where it was when it
// closes. The pick is a pixel stamp that rests unrotated.

import type { RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import {
  CONTENT,
  rewardText,
  rules,
  SCORE_LABELS,
  type ChangeOrderKind,
  type ChangeOrderOfferView,
  type ChangeOrderView,
  type Reward,
} from '../../rules/index.ts';
import { busy, orderStamp, type OrderStamp } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { signed } from '../format.ts';
import { pickKeys } from '../hud/actions.ts';
import { orderTerms, ProgressParts } from '../hud/Checklist.tsx';
import { Button, Chip, Icon, Keycap, Panel, useDialogFocus, type IconName } from '../kit/kit.tsx';
import { answerChangeOrder, run } from '../store.ts';
import { Notes } from './Overlays.tsx';
import './change-order.css';

/**
 * An order's tag. It shows as the phase it runs through begins (the top bar already names
 * it), so a phase effect is "This phase", as its sentence says (change-orders.ts).
 */
export const KIND_LABEL: Readonly<Record<ChangeOrderKind, string>> = {
  request: 'A request',
  restriction: 'A restriction',
  phase: 'This phase',
};

/** Each kind's mark on its tag: a letter asking, a cross forbidding, a clock for a phase. */
const KIND_ICON: Readonly<Record<ChangeOrderKind, IconName>> = {
  request: 'mail',
  restriction: 'cross',
  phase: 'clock',
};

/** When the sheet last arrived: its keys wait out its flourish (FEEL.changeOrder.keyDelayMs). */
let shownAt = 0;

/** The offer on the sheet, while it waits for a pick (not during a tally or the stamp). */
function waitingOffer(): ChangeOrderOfferView | null {
  const s = run.value;
  if (s.screen !== 'changeOrder' || busy.value || orderStamp.value) return null;
  return rules.changeOrderOffer(s);
}

/** Picks the offer's `i`-th order. Its stamp plays as the sheet goes. */
function pick(i: number): boolean {
  const offer = waitingOffer();
  if (!offer || !offer.options[i]) return false;
  return answerChangeOrder(i);
}

/**
 * The sheet's keys, from the game's keyboard handler (App.tsx). Not until the sheet has landed,
 * so a key pressed to end the week can't answer the orders that week brought.
 */
export function changeOrderKey(key: string): boolean {
  const offer = waitingOffer();
  if (!offer) return false;
  if (performance.now() - shownAt < FEEL.changeOrder.keyDelayMs) return false;
  const i = pickKeys(offer.options.length).indexOf(key);
  return i >= 0 && pick(i);
}

/** A press on a button leaves focus on the sheet's text, where the keys wait out their delay. */
const noFocus = (e: MouseEvent) => e.preventDefault();

/** "the Hendersons", "Count Vladislav": the client mid-sentence. */
const fromName = (name: string) => name.replace(/^The\s/, 'the ');

export function ChangeOrderScreen() {
  const stamp = orderStamp.value;
  const s = run.value;
  // Waiting for a pick once the milestone's beats are done, or picked, with its stamp: the
  // rules have moved on by then, so the stamp carries the sheet as it was.
  const live = stamp ? null : waitingOffer();
  const offer = stamp?.offer ?? live;
  const shown = live?.options.map((o) => o.id).join('/');
  // Before the browser can deliver a key: a layout effect runs with the render that shows it.
  useLayoutEffect(() => {
    if (shown) shownAt = performance.now();
  }, [shown]);
  if (!offer) return null;
  const client = CONTENT.clients[stamp?.clientId ?? s.setup.clientId];
  // One sheet from the live offer through its stamp: it never remounts, so its arrival plays
  // once and its hold on the keyboard lasts until it goes.
  return (
    <ChangeOrderSheet
      offer={offer}
      stamp={stamp}
      from={fromName(client.name)}
      backTo={offer.forced ? s.slot : null}
    />
  );
}

/**
 * The terms a card lists. A request's or a restriction's last term says what it pays ("Met:
 * +3 budget", text.ts changeOrderText), which the card's Pays line shows, coin first, so the
 * list leaves it out rather than say it twice. A phase effect's terms are its modifiers.
 */
export function sheetTerms(view: ChangeOrderView): readonly string[] {
  const terms = orderTerms(view.id, view.terms);
  return view.kind !== 'phase' && view.reward ? terms.slice(0, -1) : terms;
}

/** What it pays: the coin before the amount (D-098) for budget, else the reward in words. */
function Pays({ reward }: { reward: Reward }) {
  const budgetOnly = Object.entries(reward).every(([k, v]) => k === 'budget' || !v);
  if (budgetOnly && reward.budget) {
    return (
      <>
        <Icon name="coin" label="Budget" />
        <span class="co-amount">+{reward.budget}</span>
      </>
    );
  }
  return <>{rewardText(CONTENT, reward)}</>;
}

/**
 * D-144: what a phase effect would do to the house as it stands, from the rules' houseGain: a
 * strip like a fixture's worth in the shop (D-107), a gain in blue with an up icon, a loss in
 * orange with a down icon (never color alone, D-047), quiet when it changes nothing yet. The
 * house will change over the phase, so it says "today".
 */
export function todayText(gain: number): string {
  const wow = SCORE_LABELS.total;
  if (gain === 0) return `No ${wow} either way on your house today`;
  return `${signed(gain)} ${wow} a week on your house today`;
}

const TODAY_TIP =
  'What it would change this week, with your house as it stands. It runs all phase, and what you build changes it.';

function Today({ gain }: { gain: number }) {
  const wow = SCORE_LABELS.total;
  if (gain === 0) {
    return (
      <p class="co-today none" title={TODAY_TIP}>
        {todayText(0)}
      </p>
    );
  }
  return (
    <p class={`co-today ${gain > 0 ? 'good' : 'bad'}`} title={TODAY_TIP}>
      <span class="co-today-num">
        <Icon name={gain > 0 ? 'up' : 'down'} />
        {signed(gain)}
      </span>{' '}
      {wow} a week on your house today
    </p>
  );
}

/**
 * Keeps a centered box on whole device pixels: an odd height (the readable font's line heights
 * are odd) would center it, its frame, its icons and its text on half a pixel. It nudges the box
 * by the fraction (a relative offset, which moves nothing else) as it and its container resize.
 */
function useWholePixelTop(ref: RefObject<HTMLElement>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const snap = () => {
      el.style.top = '';
      const dpr = window.devicePixelRatio || 1;
      const top = el.getBoundingClientRect().top * dpr;
      const nudge = Math.round(top) - top;
      if (Math.abs(nudge) > 0.01) el.style.top = `${nudge / dpr}px`;
    };
    snap();
    const watch = new ResizeObserver(snap);
    watch.observe(el);
    if (el.parentElement) watch.observe(el.parentElement);
    return () => watch.disconnect();
  }, []);
}

/**
 * One order on the sheet: what it asks or changes, what it pays, and its pick button. No hooks,
 * here or in what it renders: change-order.test.tsx calls it in place.
 */
export function OrderCard({
  view,
  i,
  keycap,
  alone,
  stamp,
}: {
  view: ChangeOrderView;
  i: number;
  /** The key that picks it, as its button shows. */
  keycap: string;
  /** The only order on the sheet. */
  alone: boolean;
  stamp: OrderStamp | null;
}) {
  const picked = stamp?.picked === i;
  const state = !stamp ? '' : picked ? 'picked' : 'passed';
  return (
    <section class={`co-option kind-${view.kind} ${state}`} aria-labelledby={`co-name-${i}`}>
      <div class="co-option-body">
        <div class="co-title">
          <h3 id={`co-name-${i}`}>{view.name}</h3>
          <Chip icon={KIND_ICON[view.kind]}>{KIND_LABEL[view.kind]}</Chip>
        </div>
        {/* The client's own words: the pixel font has no italics, so the quotes carry them. */}
        <blockquote class="co-text">“{view.text}”</blockquote>
        <ul class="pcard-lines co-terms">
          {/* A phase effect's say what it changes; the sheet's first line says until when. */}
          {sheetTerms(view).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {view.progress && view.progress.length > 0 && (
          <p class="co-progress">
            So far: <ProgressParts parts={view.progress} />
          </p>
        )}
        {view.houseGain !== undefined && <Today gain={view.houseGain} />}
      </div>
      <div class="co-foot">
        {view.reward && (
          <span class="co-reward">
            <span class="co-pays">Pays</span>
            <Pays reward={view.reward} />
          </span>
        )}
        <Button
          variant="primary"
          disabled={!!stamp}
          onMouseDown={noFocus}
          onClick={() => pick(i)}
          title={alone ? `Accept ${view.name} (${keycap})` : `Pick ${view.name} (${keycap})`}
        >
          {alone ? 'Accept' : 'Pick'}
          <Keycap>{keycap}</Keycap>
        </Button>
      </div>
      {picked && (
        <div class="co-stamp-place">
          <div class="co-stamp accepted" role="status">
            <Icon name="check" />
            Accepted
          </div>
        </div>
      )}
    </section>
  );
}

function ChangeOrderSheet({
  offer,
  stamp,
  from,
  backTo,
}: {
  offer: ChangeOrderOfferView;
  stamp: OrderStamp | null;
  /** The client mid-sentence. */
  from: string;
  /** The week a ?debug offer goes back to, or null. */
  backTo: number | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  // Focus on the text, never a button: a focused button would let a held Enter press it,
  // skipping the key delay.
  useDialogFocus(dialog, () => text.current);
  useWholePixelTop(dialog);
  const f = FEEL.changeOrder;
  const style = {
    '--co-in': `${f.inMs}ms`,
    '--co-tilt': `${f.tiltDeg}deg`,
    '--co-stamp': `${f.stampInMs}ms`,
  };
  const due = `the ${rules.phaseName(offer.phase)} milestone`;
  const forced = backTo !== null;
  const alone = offer.options.length === 1;
  const keys = pickKeys(offer.options.length);
  return (
    <div class={`change-order ui ${stamp ? 'answered' : ''}`} style={style}>
      <div
        ref={dialog}
        class={`co-dialog ${alone ? 'alone' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={alone ? 'Change order' : 'Change order: pick one'}
        aria-describedby="co-lede"
      >
        <Panel
          class="co-sheet"
          title={
            <>
              <Icon name="mail" />
              Change order
            </>
          }
          head={
            <span class="co-from">
              from {from}
              {forced ? ' (debug)' : ''}
            </span>
          }
          bodyClass="co-body"
        >
          {/* Notes and toasts sit here while the sheet is up, not over it (Overlays.tsx). A
              note's Dismiss puts focus back on the text, which holds the keyboard. */}
          <Notes docked refocus={text} />
          <div class="co-pick" ref={text} tabIndex={-1}>
            <p id="co-lede" class="co-lede">
              {!alone && <b>Pick one. </b>}
              It runs until
              <span class="co-due">
                <Icon name="clock" />
                {due}.
              </span>
              {forced ? ` Picking goes back to week ${backTo}.` : ''}
            </p>
            <div class="co-options">
              {offer.options.map((view, i) => (
                <OrderCard
                  key={view.id}
                  view={view}
                  i={i}
                  keycap={keys[i]!}
                  alone={alone}
                  stamp={stamp}
                />
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
