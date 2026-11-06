// Overlays: the milestone banner, the target flash, notes and toasts, the small-screen notice
// (D-047). The run-end screen is in EndScreen.tsx.
//
// M5a draws them in the pixel style: the milestone's banner is a ribbon stamped in, gold for a
// milestone met and orange for one missed or in overtime; notes and toasts sit at the top
// center, under the top bar, or inside the shop's sheet under its header, so they never cover
// the goods or the hand.

import { useEffect, useState } from 'preact/hooks';
import { banner, busy, flash, played, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { copyFallback, copyText, shopShown, toast } from '../hud/actions.ts';
import { Button, Icon, Sheet } from '../kit/kit.tsx';
import { notice } from '../store.ts';
import './overlays.css';

export function MilestoneBanner() {
  const b = banner.value;
  if (!b) return null;
  return (
    <div class="banner-place">
      <div
        class={`banner ui ${b.tone}`}
        key={b.id}
        role="status"
        onClick={() => (banner.value = null)}
      >
        <div class="banner-ribbon">
          <Icon name={b.tone === 'good' ? 'star' : 'warn'} />
          <span class="banner-title">{b.title}</span>
        </div>
        {b.detail && <p class="banner-detail">{b.detail}</p>}
      </div>
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
  // 'note' is a neutral notice (a free redraw, the saving-up bonus), not the success's stamp.
  return (
    <div class="flash-place">
      <div
        class={`target-flash ui ${f.tone}`}
        key={f.id}
        role="status"
        style={{ animationDuration: `${FEEL.targetFlashMs}ms` }}
      >
        {f.tone === 'good' && <Icon name="flag" />}
        {f.text}
      </div>
    </div>
  );
}

/**
 * Notes and toasts, at the top center under the top bar. While the shop's sheet is open they
 * sit inside it instead (`docked`, rendered by the shop), under its header.
 */
export function Notes({ docked = false }: { docked?: boolean }) {
  const n = notice.value;
  const t = toast.value;
  if (docked !== shopShown.value || (!n && !t)) return null;
  return (
    <div class={`notes ui ${docked ? 'docked' : ''}`}>
      {n && (
        <div class="notice" role="status">
          <Icon name="mail" />
          <span class="notice-text">{n.text}</span>
          {n.oldCode && (
            <Button
              size="sm"
              icon="copy"
              onClick={() => void copyText(n.oldCode!, 'Old run code copied')}
            >
              Copy the old run code
            </Button>
          )}
          <Button
            size="sm"
            iconOnly
            icon="close"
            class="notice-close"
            onClick={() => (notice.value = null)}
            aria-label="Dismiss"
            title="Dismiss"
          />
        </div>
      )}
      {t && (
        <div class="toast" key={t.id} role="status">
          {t.text}
        </div>
      )}
    </div>
  );
}

export function SmallScreenNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div class="small-screen ui">
      <div class="small-screen-card">
        <h2>Open House</h2>
        <p>It's best played on a computer, with a mouse and a bigger screen.</p>
        <Button variant="primary" onClick={() => setDismissed(true)}>
          Play anyway
        </Button>
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
    <Sheet
      title={c.title}
      class="copy-sheet"
      onClose={close}
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <p class="copy-note">This browser won't let the game copy it, so copy it from here.</p>
      <textarea
        class="copy-text"
        readOnly
        rows={5}
        value={c.text}
        ref={(el) => el?.select()}
        onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
      />
    </Sheet>
  );
}
