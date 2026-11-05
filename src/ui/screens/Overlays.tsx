// Overlays: the milestone banner, the target flash, notes and toasts, the small-screen notice
// (D-047), and the run-end screen.

import { useEffect, useState } from 'preact/hooks';
import { CONTENT, rules, SCORE_LABELS } from '../../rules/index.ts';
import { banner, busy, flash, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { copyFallback, copyRunCode, copyText, startNewRun, toast } from '../hud/actions.ts';
import { log, notice, run } from '../store.ts';

export function MilestoneBanner() {
  const b = banner.value;
  if (!b) return null;
  return (
    <div class={`banner ${b.tone}`} key={b.id} role="status" onClick={() => (banner.value = null)}>
      <div class="banner-title">{b.title}</div>
      <div class="banner-detail">{b.detail}</div>
    </div>
  );
}

export function TargetFlash() {
  const f = flash.value;
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!f) return;
    setShown(f.id);
    const t = setTimeout(() => setShown(null), FEEL.targetFlashMs);
    return () => clearTimeout(t);
  }, [f?.id]);
  if (!f || shown !== f.id) return null;
  return (
    <div class="target-flash" key={f.id} role="status">
      {f.text}
    </div>
  );
}

export function Notice() {
  const n = notice.value;
  if (!n) return null;
  return (
    <div class="notice" role="status">
      <span>{n.text}</span>
      {n.oldCode && (
        <button type="button" onClick={() => void copyText(n.oldCode!, 'Old run code copied')}>
          Copy the old run code
        </button>
      )}
      <button
        type="button"
        class="close"
        onClick={() => (notice.value = null)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function Toast() {
  const t = toast.value;
  return t ? (
    <div class="toast" key={t.id} role="status">
      {t.text}
    </div>
  ) : null;
}

export function SmallScreenNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div class="small-screen">
      <div>
        <h2>Open House</h2>
        <p>It's best played on a computer, with a mouse and a bigger screen.</p>
        <button type="button" onClick={() => setDismissed(true)}>
          Play anyway
        </button>
      </div>
    </div>
  );
}

/** The run-end screen: the house stays visible beside it, captioned "It's a house." */
export function EndScreen() {
  const s = run.value;
  // Let the last tally and banner play before the end screen covers them.
  if (s.screen === 'build' || busy.value) return null;
  const won = s.screen === 'won';
  const phases = CONTENT.balance.phases;
  const reached = won ? phases.length : s.phase;
  const verdict = rules.verdict(s);
  return (
    <section class={`end-screen ${won ? 'won' : 'lost'}`} aria-label="The run is over">
      <p class="caption">It's a house.</p>
      <h2>
        {won
          ? `${phases[phases.length - 1]!.name} complete`
          : `The client walked at ${phases[s.phase]!.name}`}
      </h2>
      <p class="verdict">{verdict}</p>
      <dl>
        <dt>{SCORE_LABELS.total}</dt>
        <dd>{formatNumber(s.score)}</dd>
        <dt>Milestones</dt>
        <dd>
          {reached} of {phases.length}
        </dd>
        <dt>Pieces built</dt>
        <dd>{s.house.pieces.length}</dd>
        <dt>Weeks</dt>
        <dd>{log.value.length}</dd>
      </dl>
      <p class="muted">
        {won
          ? 'That’s the whole slice: 3 milestones, 12 weeks.'
          : `It needed ${formatNumber(rules.target(s))} ${SCORE_LABELS.total}.`}
      </p>
      <div class="end-buttons">
        <button type="button" class="primary" onClick={startNewRun}>
          New run
        </button>
        <button type="button" onClick={() => void copyRunCode()}>
          Copy run code
        </button>
      </div>
    </section>
  );
}

/** A click anywhere outside the panels skips the tally (the board handles its own clicks). */
export function useSkipOnClick(): void {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!busy.value || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, .board')) return;
      skip();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);
}

/** Shows text to copy by hand when the clipboard is off limits. */
export function CopyFallback() {
  const c = copyFallback.value;
  if (!c) return null;
  const close = () => (copyFallback.value = null);
  return (
    <div class="modal-backdrop" onClick={close}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{c.title}</h2>
        <p class="muted">This browser won't let the game copy it, so copy it from here.</p>
        <textarea
          class="copy-text"
          readOnly
          rows={5}
          value={c.text}
          ref={(el) => el?.select()}
          onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div class="modal-buttons">
          <button type="button" class="primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
