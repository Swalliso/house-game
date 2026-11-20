// The house builds itself (S10, D-187): once the end of a run has looked down the street and come
// back, a canvas over the lot shows it as the run began, then the house going up again build by
// build (screens/photos.ts buildSteps), plain cuts, each with its place sound a little higher up
// the tally's ladder (timelapse.ts). The finished house holds a moment; then the canvas goes, the
// live board is under it as it was, and the photos deal in.
//
// It paints with the end screen's own painter (screens/photo-paint.ts paintPhoto), the whole lot
// and nothing past it, one build at a time, the latest one due: a slow frame skips builds rather
// than stretch the whole. It sits over the live lot and the household and under the tree tops and
// the lot's life (layers.ts), so the street's crowd stays in front; the board hides the flock
// while it plays (timelapse.css). A click, a key or the wheel skips it at once. It never takes
// the pointer.

import { useEffect, useRef } from 'preact/hooks';
import type { RunState } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { paintPhoto } from '../screens/photo-paint.ts';
import { buildSteps } from '../screens/photos.ts';
import { settings } from '../settings.ts';
import { CELL } from '../sprites.ts';
import { log } from '../store.ts';
import { streetView } from './camera.ts';
import { buildRate, frameAt, timelapse, timelapsePlan, type Timelapse } from './timelapse.ts';
import './timelapse.css';

const F = FEEL.timelapse;
const SKIP = ['pointerdown', 'keydown', 'wheel'] as const;

/** Whether the house is building itself on this run's board now. */
export const timelapseOn = (run: object) => {
  const t = timelapse.value;
  return t?.phase === 'on' && t.run === run;
};

/**
 * The time-lapse's place on the board: due once the run's last tally has played and the look
 * down the street is over (or never started), `delayMs` later it plays.
 */
export function TimelapseLayer({ state, scale }: { state: RunState; scale: number }) {
  const t = timelapse.value;
  const looking = streetView.value !== null;
  const tallying = busy.value;
  const still = settings.value.reduceMotion;
  const run = state.setup;
  useEffect(() => {
    if (!t) return;
    // Meant for a run that's no longer on the board, or motion was reduced meanwhile.
    if (t.run !== run || still) {
      timelapse.value = null;
      return;
    }
    if (t.phase !== 'due' || looking || tallying) return;
    const id = window.setTimeout(() => {
      if (timelapse.peek() === t) timelapse.value = { phase: 'on', run };
    }, F.delayMs);
    return () => window.clearTimeout(id);
  }, [t, looking, tallying, run, still]);
  if (t?.phase !== 'on' || t.run !== run) return null;
  return <Rebuild state={state} scale={scale} lapse={t} />;
}

function Rebuild({ state, scale, lapse }: { state: RunState; scale: number; lapse: Timelapse }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lot } = state.house;
  const w = lot.width * CELL;
  const h = lot.height * CELL;
  useEffect(() => {
    const end = () => {
      if (timelapse.peek() === lapse) timelapse.value = null;
    };
    const ctx = ref.current?.getContext('2d');
    const { start, steps } = buildSteps(state.setup, log.peek());
    const builds = steps.length;
    if (!ctx || builds === 0) {
      end();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    const frames = [start, ...steps.map((s) => s.state)];
    const { stepMs, totalMs } = timelapsePlan(builds);
    // The whole lot, and nothing past it: the street row and the road stay live.
    const frame = { x: 0, y: 0, w, h };
    let stopped = false;
    let painting = false;
    let shown = -1;
    let from = 0;
    let raf = 0;
    /** Paints frame i (0: the cleared lot; i: the i-th build) and plays its build's sound. */
    const show = async (i: number) => {
      painting = true;
      try {
        const picture = await paintPhoto(frames[i]!, frame);
        if (stopped) return;
        ctx.drawImage(picture, 0, 0);
        shown = i;
        const step = steps[i - 1];
        if (step) {
          audio.play(step.kind === 'room' ? 'place-room' : 'place-yard', {
            rate: buildRate(i - 1, builds),
            gain: F.gain,
          });
        }
      } catch (e) {
        // A frame that can't be painted ends it: the live board is the finished house.
        console.error(e);
        stopped = true;
        end();
      } finally {
        painting = false;
      }
    };
    const tick = (now: number) => {
      if (stopped) return;
      const ms = now - from;
      if (ms >= totalMs) {
        end();
        return;
      }
      const due = frameAt(ms, builds, stepMs);
      if (!painting && due > shown) void show(due);
      raf = requestAnimationFrame(tick);
    };
    // The cleared lot first; the clock starts once it's up, so no build is skipped for its paint.
    void show(0).then(() => {
      if (stopped) return;
      from = performance.now();
      raf = requestAnimationFrame(tick);
    });
    const skip = () => end();
    for (const type of SKIP) window.addEventListener(type, skip, true);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const type of SKIP) window.removeEventListener(type, skip, true);
      // Gone before it finished (another screen, another run): it doesn't come back.
      end();
    };
  }, [lapse]);
  return (
    <canvas
      ref={ref}
      class="timelapse"
      width={w}
      height={h}
      aria-hidden="true"
      style={{ width: `${w * scale}px`, height: `${h * scale}px` }}
    />
  );
}
