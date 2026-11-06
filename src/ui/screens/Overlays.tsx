// Overlays: the milestone banner, the target flash, notes and toasts, the small-screen notice
// (D-047). The run-end screen is in EndScreen.tsx.

import { useEffect, useState } from 'preact/hooks';
import { banner, busy, flash, played, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { copyFallback, copyText, toast } from '../hud/actions.ts';
import { notice } from '../store.ts';

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
    if (!f || f.id <= played.flash) return;
    played.flash = f.id;
    setShown(f.id);
    const t = setTimeout(() => setShown(null), FEEL.targetFlashMs);
    return () => clearTimeout(t);
  }, [f?.id]);
  if (!f || shown !== f.id) return null;
  // 'note' is a neutral notice (a free redraw, the saving-up bonus), not the green success.
  return (
    <div class={`target-flash ${f.tone}`} key={f.id} role="status">
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

/** A click anywhere outside the panels skips the tally (the board handles its own clicks). */
export function useSkipOnClick(): void {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!busy.value || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, select, .board-scroll, .debug-panel')) return;
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
