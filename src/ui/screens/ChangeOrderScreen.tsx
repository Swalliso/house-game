// A change order (M4b; implementation-plan.md §5, D-109): after milestones 2, 4, and 6 the
// client changes their mind, on a sheet over the board, before the shop. A request or a
// restriction can be accepted or declined (declining costs nothing); a phase effect is only
// acknowledged. The sheet arrives with a paper flourish, and the answer is stamped on it as it
// goes (director.ts plays both beats). What it asks and pays comes from the rules'
// changeOrderOffer(): the UI only lays it out.
//
// In the pixel UI (D-110): a kit Panel on a scrim over the board, as the shop's sheet is. It
// holds the keyboard on its text, never on a button, so a held Enter can't answer it before
// FEEL.changeOrder.keyDelayMs: App.tsx's keys (Enter accepts, Esc or D declines) answer it, and
// it stays out of anyModalOpen() so they still reach it. Tab cycles inside it, and focus goes
// back where it was when it closes. The answer is a pixel stamp that rests unrotated.

import type { RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import {
  CONTENT,
  rewardText,
  rules,
  type ChangeOrderKind,
  type ChangeOrderView,
  type Reward,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy, orderStamp, type OrderStamp } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { orderTerms, ProgressParts } from '../hud/Checklist.tsx';
import { Button, Chip, Icon, Keycap, Panel, useDialogFocus, type IconName } from '../kit/kit.tsx';
import { answerChangeOrder, run } from '../store.ts';
import { Notes } from './Overlays.tsx';
import './change-order.css';

/**
 * The sheet's tag. It shows as the phase it runs through begins (the top bar already names
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

/** The stamp's word and mark. */
const STAMP: Readonly<Record<OrderStamp['answer'], { text: string; icon: IconName }>> = {
  accepted: { text: 'Accepted', icon: 'check' },
  declined: { text: 'Declined', icon: 'cross' },
  noted: { text: 'Noted', icon: 'check' },
};

/**
 * A phase effect can't be declined, which the missing Decline button already says. About one
 * in four says it in a line of its own instead (playtest 4 liked "It's coming either way"), picked
 * from the run's seed and the order, so a replay shows the same line. UI only.
 */
export const ORDER_FLAVOR = [
  'It’s coming either way.',
  'No takebacks: the paperwork is already stapled.',
  'The clipboard has spoken.',
  'Signed in pencil, but the pencil is very firm.',
  'The foreman read it and went to lunch.',
] as const;

/** The flavor line a phase effect shows, or null for most (FNV-1a over seed, order and phase). */
export function orderFlavor(seed: string, id: string, phase: number): string | null {
  let h = 0x811c9dc5;
  for (const ch of `${seed}/${id}/${phase}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h % 4 === 0 ? ORDER_FLAVOR[Math.floor(h / 4) % ORDER_FLAVOR.length]! : null;
}

/** When the sheet last arrived: its keys wait out its flourish (FEEL.changeOrder.keyDelayMs). */
let shownAt = 0;

/** The offer on the sheet, while it waits for an answer (not during a tally or the stamp). */
function waitingOffer(): ChangeOrderView | null {
  const s = run.value;
  if (s.screen !== 'changeOrder' || busy.value || orderStamp.value) return null;
  return rules.changeOrderOffer(s);
}

/** Accepts (or acknowledges) the change order, or declines it. Its stamp plays as it goes. */
function answer(accept: boolean): boolean {
  const view = waitingOffer();
  if (!view) return false;
  if (!accept && !view.declinable) {
    // A phase effect is coming either way.
    audio.play('illegal');
    return false;
  }
  return answerChangeOrder(accept);
}

/**
 * The sheet's keys, from the game's keyboard handler (App.tsx): Enter accepts or acknowledges,
 * Esc or D declines where it can. Not until the sheet has landed, so an Enter pressed to end the
 * week can't answer the order that week brought.
 */
export function changeOrderKey(key: string): boolean {
  if (!waitingOffer()) return false;
  if (performance.now() - shownAt < FEEL.changeOrder.keyDelayMs) return false;
  if (key === 'Enter') return answer(true);
  if (key === 'Escape' || key === 'd' || key === 'D') return answer(false);
  return false;
}

/** A press on a button leaves focus on the sheet's text, where the keys wait out their delay. */
const noFocus = (e: MouseEvent) => e.preventDefault();

/** "the Hendersons", "Count Vladislav": the client mid-sentence. */
const fromName = (name: string) => name.replace(/^The\s/, 'the ');

export function ChangeOrderScreen() {
  const stamp = orderStamp.value;
  const s = run.value;
  // Waiting for an answer once the milestone's beats are done, or answered, with its stamp: the
  // rules have moved on by then, so the stamp carries the sheet as it was.
  const live = stamp ? null : waitingOffer();
  const view = stamp?.view ?? live;
  // Before the browser can deliver a key: a layout effect runs with the render that shows it.
  useLayoutEffect(() => {
    if (live) shownAt = performance.now();
  }, [live?.id]);
  if (!view) return null;
  const client = CONTENT.clients[stamp?.clientId ?? s.setup.clientId];
  const forced = stamp ? stamp.forced : !!s.offers?.changeOrder?.forced;
  // One sheet from the live offer through its stamp: it never remounts, so its arrival plays
  // once and its hold on the keyboard lasts until it goes.
  return (
    <ChangeOrderSheet
      view={view}
      stamp={stamp}
      from={fromName(client.name)}
      backTo={forced ? s.slot : null}
    />
  );
}

/**
 * The terms the sheet lists. A request's or a restriction's last term says what it pays ("Met:
 * +3 budget", text.ts changeOrderText), which the sheet's Pays line shows, coin first, so the
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

function ChangeOrderSheet({
  view,
  stamp,
  from,
  backTo,
}: {
  view: ChangeOrderView;
  stamp: OrderStamp | null;
  /** The client mid-sentence. */
  from: string;
  /** The week a ?debug order goes back to, or null. */
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
  const due = `the ${rules.phaseName(view.phase)} milestone`;
  const forced = backTo !== null;
  const note = view.declinable
    ? 'Declining costs nothing.'
    : orderFlavor(run.value.setup.seed, view.id, view.phase);
  const mark = stamp ? STAMP[stamp.answer] : null;
  return (
    <div class={`change-order ui ${stamp ? 'answered' : ''}`} style={style}>
      <div
        ref={dialog}
        class="co-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="co-name"
        aria-describedby="co-text"
      >
        <Panel
          class={`co-sheet kind-${view.kind}`}
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
          <div class="co-scroll" ref={text} tabIndex={-1}>
            <div class="co-title">
              <h2 id="co-name">{view.name}</h2>
              <Chip icon={KIND_ICON[view.kind]}>{KIND_LABEL[view.kind]}</Chip>
            </div>
            {/* The client's own words: the pixel font has no italics, so the quotes carry them. */}
            <blockquote id="co-text" class="co-text">
              “{view.text}”
            </blockquote>
            <ul class="pcard-lines co-terms">
              {/* A phase effect's say what it changes; "Until" below says when (this phase). */}
              {sheetTerms(view).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {view.progress && view.progress.length > 0 && (
              <p class="co-progress">
                So far: <ProgressParts parts={view.progress} />
              </p>
            )}
            <dl class="co-facts">
              <div>
                <dt>Until</dt>
                <dd>
                  <Icon name="clock" />
                  {due}
                </dd>
              </div>
              {view.reward && (
                <div>
                  <dt>Pays</dt>
                  <dd class="co-reward">
                    <Pays reward={view.reward} />
                  </dd>
                </div>
              )}
            </dl>
            {(note || forced) && (
              <p class="co-note">
                {note}
                {forced ? `${note ? ' ' : ''}Answering goes back to week ${backTo}.` : ''}
              </p>
            )}
          </div>
          <div class="co-foot">
            {view.declinable && (
              <Button
                disabled={!!stamp}
                onMouseDown={noFocus}
                onClick={() => answer(false)}
                title="Decline it: it costs nothing (Esc or D)"
              >
                Decline
                <Keycap>Esc</Keycap>
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!!stamp}
              onMouseDown={noFocus}
              onClick={() => answer(true)}
              title={view.declinable ? 'Accept it (Enter)' : 'Got it (Enter)'}
            >
              {view.declinable ? 'Accept' : 'Got it'}
              <Keycap>Enter</Keycap>
            </Button>
          </div>
          {stamp && mark && (
            <div class="co-stamp-place">
              <div class={`co-stamp ${stamp.answer}`} role="status">
                <Icon name={mark.icon} />
                {mark.text}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
