// A change order (M4b; implementation-plan.md §5, D-105): after milestones 2, 4, and 6 the
// client changes their mind, on a sheet over the board, before the shop. A request or a
// restriction can be accepted or declined (declining costs nothing); a phase effect is only
// acknowledged. The sheet arrives with a paper flourish, and the answer is stamped on it as it
// goes (director.ts plays both beats). What it asks and pays comes from the rules'
// changeOrderOffer(): the UI only lays it out.

import { useLayoutEffect } from 'preact/hooks';
import {
  CONTENT,
  rewardText,
  rules,
  type ChangeOrderKind,
  type ChangeOrderView,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy, orderStamp, type OrderStamp } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { ProgressParts } from '../hud/Checklist.tsx';
import { answerChangeOrder, run } from '../store.ts';
import './change-order.css';

export const KIND_LABEL: Readonly<Record<ChangeOrderKind, string>> = {
  request: 'A request',
  restriction: 'A restriction',
  phase: 'This phase',
};

const STAMP_TEXT: Readonly<Record<OrderStamp['answer'], string>> = {
  accepted: '✓ Accepted',
  declined: '✕ Declined',
  noted: '✓ Noted',
};

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
  const due = `the ${rules.phaseName(view.phase)} milestone`;
  const f = FEEL.changeOrder;
  const style = {
    '--co-in': `${f.inMs}ms`,
    '--co-tilt': `${f.tiltDeg}deg`,
    '--co-stamp': `${f.stampInMs}ms`,
  };
  return (
    <div
      class={`change-order ${stamp ? 'answered' : ''}`}
      style={style}
      role="dialog"
      aria-labelledby="co-name"
      aria-describedby="co-text"
    >
      <article class={`co-sheet kind-${view.kind}`}>
        <header class="co-head">
          <span class="co-form">Change order</span>
          <span class="co-from">
            from {fromName(client.name)}
            {forced ? ' (debug)' : ''}
          </span>
        </header>
        <div class="co-title">
          <h2 id="co-name">{view.name}</h2>
          <span class="co-kind">{KIND_LABEL[view.kind]}</span>
        </div>
        <p id="co-text" class="co-text">
          “{view.text}”
        </p>
        <ul class="co-terms">
          {view.terms.map((t) => (
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
            <dd>{due}</dd>
          </div>
          {view.reward && (
            <div>
              <dt>Pays</dt>
              <dd class="co-reward">{rewardText(CONTENT, view.reward)}</dd>
            </div>
          )}
        </dl>
        <p class="co-note">
          {view.declinable
            ? 'Declining costs nothing.'
            : 'It’s coming either way: it can’t be declined.'}
          {forced ? ` Answering goes back to week ${s.slot}.` : ''}
        </p>
        <footer class="co-buttons">
          {view.declinable && (
            <button
              type="button"
              class="co-decline"
              disabled={!!stamp}
              onMouseDown={noFocus}
              onClick={() => answer(false)}
              title="Decline it: it costs nothing (Esc or D)"
            >
              Decline <kbd>Esc</kbd>
            </button>
          )}
          <button
            type="button"
            class="co-accept"
            disabled={!!stamp}
            onMouseDown={noFocus}
            onClick={() => answer(true)}
            title={view.declinable ? 'Accept it (Enter)' : 'Got it (Enter)'}
          >
            {view.declinable ? 'Accept' : 'Got it'} <kbd>Enter</kbd>
          </button>
        </footer>
        {stamp && (
          <div class={`co-stamp ${stamp.answer}`} role="status">
            {STAMP_TEXT[stamp.answer]}
          </div>
        )}
      </article>
    </div>
  );
}
