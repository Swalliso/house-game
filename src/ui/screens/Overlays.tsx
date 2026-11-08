// Overlays: the milestone banner, the target flash, notes and toasts, the small-screen notice
// (D-047). The run-end screen is in EndScreen.tsx.
//
// M5a draws them in the pixel style: the milestone's banner is a ribbon stamped in, gold for a
// milestone met and orange for one missed or in overtime; notes and toasts sit at the top
// center, under the top bar, or inside the shop's sheet under its header, so they never cover
// the goods or the hand. While a banner is up, and once the run is over, they sit just under it
// or the board's "It's a house." sign (both in that spot) instead, so both read. A toast raised
// while a sheet or the menu is open (Copy run code, from the menu) shows over it instead, under
// where the sign is when it's there.

import { useEffect, useState } from 'preact/hooks';
import { banner, busy, flash, played, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { anyModalOpen, copyFallback, copyText, shopShown, toast } from '../hud/actions.ts';
import { Button, Icon, Sheet } from '../kit/kit.tsx';
import { appScreen, notice, run } from '../store.ts';
import './overlays.css';

/** The milestone's banner, at the board's top center, and any notes and toasts just under it. */
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
      <Notes under="banner" />
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
        style={{ '--flash-ms': `${FEEL.targetFlashMs}ms` }}
      >
        {f.tone === 'good' && <Icon name="flag" />}
        {f.text}
      </div>
    </div>
  );
}

/**
 * The run is over and the board shows its "It's a house." sign (EndCaption, EndScreen.tsx):
 * once the last tally and the run-end banner have played, since the banner sits in the same
 * spot. Notes and toasts then sit just under the sign.
 */
export function endSignShown(): boolean {
  const screen = run.value.screen;
  return (
    appScreen.value === 'game' &&
    (screen === 'won' || screen === 'lost') &&
    !busy.value &&
    !banner.value
  );
}

/**
 * Where notes and toasts sit when it isn't the top center of the board: just under the board's
 * "It's a house." sign once the run is over, or the milestone's banner while it's up, since both
 * sit in that spot (null while the shop's sheet docks them, and on the title).
 */
export function notesUnder(): 'sign' | 'banner' | null {
  if (appScreen.value !== 'game' || shopShown.value) return null;
  if (endSignShown()) return 'sign';
  return banner.value ? 'banner' : null;
}

/**
 * Notes and toasts, at the top center under the top bar. While the shop's sheet is open they
 * sit inside it instead (`docked`, rendered by the shop), under its header, and while the
 * milestone's banner is up or once the run is over, under it or the board's "It's a house."
 * sign (`under`, rendered by the banner and the sign), so neither covers them. A toast waits in
 * ModalToast while a sheet or the menu is open.
 */
export function Notes({
  docked = false,
  under = null,
}: {
  docked?: boolean;
  under?: 'sign' | 'banner' | null;
}) {
  const n = notice.value;
  const t = anyModalOpen() ? null : toast.value;
  if (docked !== shopShown.value || under !== notesUnder() || (!n && !t)) return null;
  return (
    <div class={`notes ui ${docked ? 'docked' : ''} ${under ? `under-${under}` : ''}`}>
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

/**
 * A toast raised while a sheet or the menu is open, over its scrim at the top center: where notes
 * show, so under the "It's a house." sign once the run is over (Copy run code, from the menu).
 */
export function ModalToast() {
  const t = toast.value;
  if (!t || !anyModalOpen()) return null;
  return (
    <div class={`toast-layer ui ${endSignShown() ? 'under-sign' : ''}`}>
      <div class="toast" key={t.id} role="status">
        {t.text}
      </div>
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
        data-autofocus
        onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
      />
    </Sheet>
  );
}
