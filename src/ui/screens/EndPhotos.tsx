// The end screen's photos (M6, D-136): under the roofed house, a strip of polaroids, one for each
// milestone that resolved, of the house as it stood then: on time, early, in overtime, or the
// one the client walked at. They share one frame (photos.ts photoFrame), so the house grows in
// place from one to the next. Each says its milestone, its mark, and its Wow against the target;
// a click shows it larger (PhotoViewer).
//
// They deal in one after another once the end screen is up (FEEL.photos), each with a soft
// flick, and each picture develops from a warm blank once it's painted (photo-paint.ts, a photo
// at a time, so the end screen never hitches). Reduce motion puts them down at once.
//
// The strip shows the photos downscaled, smoothly: like the Fit overview, an exception to D-097's
// whole device pixels per art pixel. The larger view keeps whole device pixels where it can.
// Where the strip is narrower than the polaroids, they overlap like a hand of cards, and the one
// pointed at or focused comes to the front.

import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CONTENT, SCORE_LABELS, type Action, type MilestoneRecord } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { cameraEls, cameraScale } from '../board/camera.ts';
import { busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { photoShown } from '../hud/actions.ts';
import { Button, Icon, Sheet, type IconName } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { log, run } from '../store.ts';
import { resultTag } from './EndScreen.tsx';
import { paintPhoto } from './photo-paint.ts';
import { milestoneShots, photoFrame, type MilestoneShot, type PhotoFrame } from './photos.ts';
import './photos.css';

const WOW = SCORE_LABELS.total;
const F = FEEL.photos;

/** Each photo's image (an object URL), null until it's painted, for the run they're of. */
const photoUrls = signal<readonly (string | null)[]>([]);
let paintedFor: readonly Action[] | null = null;
/** The run whose strip has been dealt: coming back to its end screen doesn't deal it again. */
let dealtFor: readonly Action[] | null = null;
/** The run whose end screen has brought its house into view, once. */
let framedFor: readonly Action[] | null = null;

/**
 * Pans the board so the house is in the middle of the view the strip leaves (in a window too
 * small for the whole lot; at 1080p it's all in view and nothing moves): the roofed house is the
 * end screen's hero. Once per run, so a pan the player makes afterwards stays.
 */
function showHouse(frame: PhotoFrame, still: boolean): void {
  const { scroll, board } = cameraEls;
  if (!scroll || !board) return;
  const scale = cameraScale.value;
  const b = board.getBoundingClientRect();
  const v = scroll.getBoundingClientRect();
  scroll.scrollBy({
    left: b.left + (frame.x + frame.w / 2) * scale - (v.left + v.width / 2),
    top: b.top + (frame.y + frame.h / 2) * scale - (v.top + v.height / 2),
    behavior: still ? 'auto' : 'smooth',
  });
}

/** Paints the run's photos a frame apart, once per run; the last run's images are let go. */
function paintAll(actions: readonly Action[], shots: readonly MilestoneShot[], frame: PhotoFrame) {
  if (paintedFor === actions) return;
  paintedFor = actions;
  for (const url of photoUrls.value) if (url) URL.revokeObjectURL(url);
  photoUrls.value = shots.map(() => null);
  void (async () => {
    for (const [i, shot] of shots.entries()) {
      // A frame between photos, so the deal keeps its pace.
      await new Promise((r) => requestAnimationFrame(r));
      if (paintedFor !== actions) return;
      try {
        const canvas = await paintPhoto(shot.state, frame);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r));
        if (!blob || paintedFor !== actions) return;
        const next = [...photoUrls.value];
        next[i] = URL.createObjectURL(blob);
        photoUrls.value = next;
      } catch (e) {
        // A photo that can't be painted stays blank; the rest still come.
        console.error(e);
      }
    }
  })();
}

/** When the i-th polaroid lands, in ms after the strip comes up. */
const landsAt = (i: number) => F.delayMs + i * F.staggerMs + F.dealMs;

/** A milestone's mark: met or missed, and how (early's flag, overtime's clock). */
function marks(m: MilestoneRecord): IconName[] {
  if (m.result === 'failed') return ['cross'];
  if (m.result === 'early') return ['check', 'flag'];
  if (m.result === 'overtime') return ['check', 'clock'];
  return ['check'];
}

const phaseName = (m: MilestoneRecord) => CONTENT.balance.phases[m.phase]?.name ?? 'Milestone';

/**
 * Where the milestones' long words may break across a caption's two lines (soft hyphens): the
 * browsers that don't hyphenate English (Chrome, without its dictionary) would break them
 * anywhere. A name not listed still breaks anywhere rather than spill out of its polaroid.
 */
const SOFT_BREAKS: Readonly<Record<string, string>> = {
  Groundbreaking: 'Ground\u00ADbreaking',
  Foundation: 'Foun\u00ADdation',
  Walkthrough: 'Walk\u00ADthrough',
};
const breakable = (name: string) =>
  name
    .split(' ')
    .map((w) => SOFT_BREAKS[w] ?? w)
    .join(' ');

/** The strip, once the run is over and its last tally has played (as EndScreen waits). */
export function EndPhotos() {
  const s = run.value;
  if ((s.screen !== 'won' && s.screen !== 'lost') || busy.value) return null;
  return <Strip />;
}

function Strip() {
  const s = run.value;
  const actions = log.value;
  const shots = milestoneShots(s.setup, actions);
  const frame = photoFrame(s.house);
  const still = settings.value.reduceMotion;
  // Dealt once per run, unless motion is reduced.
  const deal = useRef(!still && dealtFor !== actions);
  const mounted = useRef(performance.now());
  useEffect(() => {
    paintAll(actions, shots, frame);
    let raf = 0;
    if (framedFor !== actions) {
      framedFor = actions;
      // Once the board has re-measured for the strip (a frame for the resize, one to lay out).
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => showHouse(frame, still));
      });
    }
    const cancel = () => cancelAnimationFrame(raf);
    if (!deal.current) return cancel;
    dealtFor = actions;
    // A soft flick as each one lands, a little higher each time.
    shots.forEach((_, i) =>
      audio.play('place-yard', { rate: 1.1 + i * 0.05, gain: 0.45, delay: landsAt(i) / 1000 }),
    );
    return cancel;
  }, [actions]);
  if (shots.length === 0) return null;
  const urls = photoUrls.value;
  const style = {
    '--photo-deal-ms': `${F.dealMs}ms`,
    '--photo-develop-ms': `${F.developMs}ms`,
    '--photo-from': `${F.fromPx}px`,
    '--photo-spin': `${F.spinDeg}deg`,
    '--photo-lift': `${-F.liftPx}px`,
    '--photo-n': String(shots.length),
  } as JSX.CSSProperties;
  return (
    <section
      class={`end-photos ui ${deal.current ? 'dealing' : ''}`}
      style={style}
      aria-label="Photos of the house at each milestone"
    >
      <ol class="photo-strip">
        {shots.map((shot, i) => (
          <Polaroid
            key={i}
            i={i}
            shot={shot}
            url={urls[i] ?? null}
            // A picture painted after its polaroid landed develops at once; one painted sooner
            // waits for the landing.
            developIn={
              deal.current ? Math.max(0, mounted.current + landsAt(i) - performance.now()) : 0
            }
          />
        ))}
      </ol>
    </section>
  );
}

function Polaroid({
  i,
  shot,
  url,
  developIn,
}: {
  i: number;
  shot: MilestoneShot;
  url: string | null;
  developIn: number;
}) {
  const m = shot.record;
  const name = phaseName(m);
  const failed = m.result === 'failed';
  const label = `${name}: ${resultTag(m)}, ${formatNumber(m.score)} of ${formatNumber(m.target)} ${WOW}. Show it larger.`;
  return (
    <li
      class="end-photo"
      style={{ '--photo-at': `${F.delayMs + i * F.staggerMs}ms` } as JSX.CSSProperties}
    >
      <button
        type="button"
        class={`polaroid ${failed ? 'failed' : 'met'} ${m.result}`}
        aria-label={label}
        title={`${name}: ${resultTag(m)}. Click to see it larger.`}
        onClick={() => {
          audio.play('select');
          photoShown.value = i;
        }}
      >
        <span class="polaroid-photo">
          {url && (
            <img
              src={url}
              alt=""
              style={{ animationDelay: `${Math.round(developIn)}ms` } as JSX.CSSProperties}
            />
          )}
        </span>
        <span class="polaroid-caption">
          <span class="polaroid-name">{breakable(name)}</span>
          <span class="polaroid-score">
            {marks(m).map((icon) => (
              <Icon key={icon} name={icon} class="mark" />
            ))}
            <span class="num">{formatNumber(m.score)}</span>
          </span>
          <span class="polaroid-target">of {formatNumber(m.target)}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * A photo larger, over a scrim: at whole device pixels per art pixel when the window holds at
 * least one (D-097), else smoothly smaller. ← and → step through the strip; Esc closes it.
 */
export function PhotoViewer() {
  const i = photoShown.value;
  if (i === null) return null;
  const s = run.value;
  const shots = milestoneShots(s.setup, log.value);
  const shot = shots[i];
  if (!shot) return null;
  const close = () => (photoShown.value = null);
  const go = (d: number) => {
    const n = i + d;
    if (n < 0 || n >= shots.length) return;
    audio.play('select');
    photoShown.value = n;
  };
  const m = shot.record;
  const name = phaseName(m);
  const frame = photoFrame(s.house);
  const url = photoUrls.value[i] ?? null;
  // The room the sheet leaves for the photo (its plank, caption and buttons take the rest).
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(
    (window.innerWidth * 0.94 - 64) / frame.w,
    (window.innerHeight * 0.9 - 230) / frame.h,
  );
  const crisp = fit * dpr >= 1;
  const scale = crisp ? Math.floor(fit * dpr) / dpr : Math.max(fit, 0.1);
  const width = Math.round(frame.w * scale * dpr) / dpr;
  const height = Math.round(frame.h * scale * dpr) / dpr;
  return (
    <Sheet
      title={name}
      class="photo-sheet"
      label={`Photo of the house at ${name}`}
      onClose={close}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else return;
        e.preventDefault();
      }}
      footer={
        <>
          <span class="photo-count num">
            {i + 1}/{shots.length}
          </span>
          <Button disabled={i === 0} onClick={() => go(-1)} title="The milestone before (←)">
            ← Previous
          </Button>
          <Button
            disabled={i === shots.length - 1}
            onClick={() => go(1)}
            title="The milestone after (→)"
          >
            Next →
          </Button>
        </>
      }
    >
      <figure class="photo-large">
        <span
          class={`photo-large-frame ${crisp ? 'crisp' : ''}`}
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          {url && <img src={url} alt={`The house at ${name}, week ${shot.state.week}`} />}
        </span>
        <figcaption class={`photo-large-caption ${m.result === 'failed' ? 'failed' : 'met'}`}>
          {marks(m).map((icon) => (
            <Icon key={icon} name={icon} class="mark" />
          ))}
          <span class="tag">{resultTag(m)}</span>
          <span class="figures">
            <span class="num">{formatNumber(m.score)}</span> of {formatNumber(m.target)} {WOW}
          </span>
          <span class="week">Week {shot.state.week}</span>
        </figcaption>
      </figure>
    </Sheet>
  );
}
