// Overlays: the milestone banner, the week's stamp (D-154), the target flash, notes and toasts,
// the small-screen notice (D-047). The run-end screen is in EndScreen.tsx.
//
// M5a draws them in the pixel style: the milestone's banner is a ribbon stamped in, gold for a
// milestone met and orange for one missed or in overtime (M4's arrivals get a card of their own
// at the board's right edge, ArrivalCard.tsx, so they never read as a milestone); notes and
// toasts sit at the top
// center, under the top bar, or inside the shop's sheet under its header (or a change order's,
// M4), so they never cover the goods, the hand or the sheet. While a banner is up, and once the
// run is over, they sit just under it or the board's "It's a house." sign (both in that spot)
// instead, so both read. A toast raised while a sheet or the menu is open (Copy run code, from
// the menu) shows over it instead, under where the sign is when it's there.
//
// M4: a note goes once the run moves on from where it came up (a week played, the shop, a
// change order), or with its Dismiss.

import { effect } from '@preact/signals';
import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { SCORE_LABELS } from '../../rules/index.ts';
import { banner, busy, dismissBanner, flash, played, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import {
  anyModalOpen,
  copyFallback,
  copyText,
  notesDocked,
  passArmed,
  toast,
} from '../hud/actions.ts';
import { Button, Icon, Sheet } from '../kit/kit.tsx';
import { appScreen, notice, restorePreviousRun, run } from '../store.ts';
import { weekStamp } from './week-stamp.ts';
import './overlays.css';

/** The milestone's banner, at the board's top center, and any notes and toasts just under it. */
export function MilestoneBanner() {
  const b = banner.value;
  if (!b) return null;
  return (
    <div class="banner-place">
      <div class={`banner ui ${b.tone}`} key={b.id} role="status" onClick={dismissBanner}>
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

/**
 * The week's stamp (D-154, week-stamp.ts), where the milestone's banner goes (they're never up
 * together): "Week 2 of 4" and the milestone's weeks as pips. A milestone's first week names it
 * and what its target needs on a slip under the plate; its middle weeks have the plate alone,
 * smaller; its last is orange, and its slip says what the target still needs. Notes and toasts
 * sit just under it, as they do under a banner.
 */
export function WeekStamp() {
  const w = weekStamp.value;
  if (!w || banner.value) return null;
  const f = FEEL.weekStamp;
  const toGo = `${formatNumber(w.toGo)} ${SCORE_LABELS.total} to go`;
  const detail =
    w.kind === 'first'
      ? w.toGo > 0
        ? `${w.phase}: ${toGo} in ${w.weeks} weeks`
        : `${w.phase}: its target is met already`
      : w.kind === 'last'
        ? w.toGo > 0
          ? `Last week of ${w.phase}: ${toGo}`
          : `Last week of ${w.phase}: its target is met`
        : null;
  return (
    <div class="banner-place week-stamp-place">
      <div
        class={`week-stamp ui ${w.kind}`}
        key={w.id}
        role="status"
        style={{
          '--ws-in': `${f.inMs}ms`,
          '--ws-out': `${f.outMs}ms`,
          '--ws-hold': `${w.ms - f.outMs}ms`,
        }}
      >
        <div class="week-stamp-plate">
          <span class="week-stamp-title">
            Week {w.slot} of {w.weeks}
          </span>
          <span class="week-stamp-pips" aria-hidden="true">
            {Array.from({ length: w.weeks }, (_, i) => (
              <i key={i} class={i + 1 < w.slot ? 'done' : i + 1 === w.slot ? 'now' : ''} />
            ))}
          </span>
        </div>
        {detail && <p class="week-stamp-detail">{detail}</p>}
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

/** Where the run stood when the note on screen came up (M4). */
let noteAt: { note: object; week: number; screen: string } | null = null;

// A note ("Replayed 58 actions.") goes once the run moves on from where it came up: a week
// played, the shop, a change order (M4). A module-level effect, not a hook in Notes: Notes
// renders in more than one place (at the top, docked in the shop, under the banner or the
// sign), and tests call it and EndCaption in place, outside a render, so both stay hook-free.
// It runs as the signals change, so a note about a run being loaded must come once that run is
// in place: raised before, the load's new week or screen would take it away.
effect(() => {
  const n = notice.value;
  const { week, screen } = run.value;
  if (!n) return;
  if (noteAt?.note !== n) noteAt = { note: n, week, screen };
  else if (noteAt.week !== week || noteAt.screen !== screen) notice.value = null;
});

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
 * sit in that spot (null while the shop's or a change order's sheet docks them, and on the
 * title).
 */
export function notesUnder(): 'sign' | 'banner' | null {
  if (appScreen.value !== 'game' || notesDocked.value) return null;
  if (endSignShown()) return 'sign';
  return banner.value || weekStamp.value ? 'banner' : null;
}

/**
 * Notes and toasts, at the top center under the top bar. While the shop's sheet is open they
 * sit inside it instead (`docked`, rendered by the shop), under its header, as they do in a
 * change order's sheet (M4, ChangeOrderScreen.tsx); and while the milestone's banner is up or
 * once the run is over, under it or the board's "It's a house." sign (`under`, rendered by the
 * banner and the sign), so neither covers them. A toast waits in ModalToast while a sheet or
 * the menu is open.
 *
 * A sheet that holds the keyboard on its text (the change order's) passes that text as
 * `refocus`: a note's Dismiss puts focus back there, by mouse or keyboard, rather than let it
 * fall to the page with the button it removes.
 */
export function Notes({
  docked = false,
  under = null,
  refocus,
}: {
  docked?: boolean;
  under?: 'sign' | 'banner' | null;
  refocus?: RefObject<HTMLElement>;
}) {
  const n = notice.value;
  const t = anyModalOpen() ? null : toast.value;
  if (docked !== notesDocked.value || under !== notesUnder() || (!n && !t)) return null;
  return (
    <div class={`notes ui ${docked ? 'docked' : ''} ${under ? `under-${under}` : ''}`}>
      {n && (
        <div class="notice" role="status">
          <Icon name="mail" />
          <span class="notice-text">{n.text}</span>
          {n.oldCode && n.goBack && (
            // The run a link put aside comes back, and the link's run is put aside in turn.
            <Button
              size="sm"
              class="notice-back"
              onClick={() => {
                // A pass armed in the run being left isn't one for the run coming back.
                passArmed.value = false;
                restorePreviousRun(n.oldCode!);
                refocus?.current?.focus({ preventScroll: true });
              }}
            >
              Go back to it
            </Button>
          )}
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
            onClick={() => {
              notice.value = null;
              refocus?.current?.focus({ preventScroll: true });
            }}
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

/**
 * The address the game was opened at, read as this file loads: starting up takes a shared lot's
 * ?seed, ?client and ?crew (and a ?run code) out of the address bar, and the notice's link must
 * still open that lot on the laptop (D-148). Empty where there's no window (the tests).
 */
const OPENED_AT = typeof window === 'undefined' ? '' : window.location.href;

/**
 * The notice on a small screen (D-047). A window too narrow to play at all (a phone held
 * upright; overlays.css picks which part shows) offers the link to open on a laptop in place of
 * "Play anyway", which led to a screen that could be neither played nor left (D-148). The copy
 * is the notice's own: it covers the toasts. With the clipboard off limits, it shows the link.
 */
export function SmallScreenNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [link, setLink] = useState<'idle' | 'copied' | 'shown'>('idle');
  if (dismissed) return null;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(OPENED_AT);
      setLink('copied');
    } catch {
      setLink('shown');
    }
  };
  return (
    <div class="small-screen ui">
      <div class="small-screen-card">
        <h2>Open House</h2>
        <p>It's best played on a computer, with a mouse and a bigger screen.</p>
        <div class="small-screen-phone">
          <p>Copy the link and open it on a laptop.</p>
          <Button variant="primary" onClick={() => void copyLink()}>
            <span role="status">{link === 'copied' ? 'Link copied' : 'Copy link'}</span>
          </Button>
          {link === 'shown' && <p class="small-screen-link">{OPENED_AT}</p>}
        </div>
        <Button variant="primary" class="small-screen-play" onClick={() => setDismissed(true)}>
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
