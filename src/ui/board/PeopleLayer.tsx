// The household at the front door (D-177): each member still waiting for a room stands at the
// doormat, or at the kerb when the house has no front door, with their suitcase beside them; and
// once the doorbell has rung for one (director.ts walkIn), they first walk up from the street,
// over the kerb, to their place (from partway up a deep front yard, or from behind what stands in
// the yard in their way), pulling the suitcase behind them. Where each one stands is people.ts;
// the members in their rooms are drawn with the rooms' furniture (HouseLayers.tsx).
//
// Decoration only: it never takes the pointer. It comes after the overhang, on its z-index, so a
// figure at the door stands in front of the house's south wall, the room behind it and its tall
// furniture, and under the tree tops, the labels, the ghost and the popups. The walk moves a whole
// art px a step, transform only, as the street's walkers do (fx/Drive.tsx); with Reduce motion
// there's no walk, and the figure stands there all the same, since it says someone is waiting.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ArrivalId } from '../../rules/index.ts';
import { walkIn } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { spriteFrames, spritePos, spriteStyle, type SpriteId } from '../sprites.ts';
import type { HouseModel, Rect } from './house-model.ts';
import { FIGURE, PULLED, suitcaseAt, walkPlan, walkStart, type Person } from './people.ts';
import './people.css';

/** The last walk played: a board mounted again (Menu, then Continue) doesn't play it twice. */
let playedWalk = 0;

/** A sprite as a box at `scale` CSS px per art px, its top-left at (x, y) lot art px. */
function boxAt(id: SpriteId, x: number, y: number, scale: number): JSX.CSSProperties {
  const { w, h } = spritePos(id);
  return {
    ...spriteStyle(id, scale),
    left: `${x * scale}px`,
    top: `${y * scale}px`,
    width: `${w * scale}px`,
    height: `${h * scale}px`,
  };
}

/** A member waiting, facing south, with their suitcase to their right, a pixel in front. */
function Waiting({ p, scale, cls = '' }: { p: Person; scale: number; cls?: string }) {
  const bag = suitcaseAt(p, p.cast.suitcase);
  return (
    <>
      <span
        class={`person ${cls}`}
        style={boxAt(p.cast.stand, p.x - FIGURE.w / 2, p.y - FIGURE.h, scale)}
      />
      <span class={`suitcase ${cls}`} style={boxAt(p.cast.suitcase, bag.x, bag.y, scale)} />
    </>
  );
}

/**
 * A member walking north from `from` to their place, in whole art px steps over `ms`, after
 * `delayMs`, fading in as they set off; their walk cycle steps behind its box every `frameMs`, and
 * their suitcase rolls along behind them.
 */
function Walker({
  p,
  from,
  ms,
  frameMs,
  delayMs,
  scale,
}: {
  p: Person;
  from: number;
  ms: number;
  frameMs: number;
  delayMs: number;
  scale: number;
}) {
  const { walk, suitcase } = p.cast;
  const anim = spriteFrames(walk);
  const bag = spritePos(suitcase);
  const distance = from - p.y;
  return (
    <span
      class="walker"
      style={{
        left: `${(p.x - FIGURE.w / 2) * scale}px`,
        top: `${(p.y - FIGURE.h) * scale}px`,
        width: `${FIGURE.w * scale}px`,
        height: `${FIGURE.h * scale}px`,
        '--walk-from': `${distance * scale}px`,
        '--walk-steps': String(Math.max(1, distance)),
        '--walk-ms': `${ms}ms`,
        '--walk-delay': `${delayMs}ms`,
        '--walk-fade-ms': `${FEEL.arrival.walk.fadeMs}ms`,
      }}
    >
      <span class="walker-figure">
        {anim ? (
          <span
            class="walker-frames"
            style={{
              ...spriteStyle(walk, scale),
              width: `${anim.stride * anim.frames * scale}px`,
              animationDuration: `${frameMs * anim.frames}ms`,
              animationTimingFunction: `steps(${anim.frames})`,
              '--walker-frames': `${-anim.stride * anim.frames * scale}px`,
            }}
          />
        ) : (
          <span class="walker-frames" style={spriteStyle(walk, scale)} />
        )}
      </span>
      <span
        class="suitcase"
        style={{
          ...spriteStyle(suitcase, scale),
          left: `${(FIGURE.w / 2 + PULLED.dx) * scale}px`,
          top: `${(FIGURE.h + PULLED.dy - bag.h) * scale}px`,
          width: `${bag.w * scale}px`,
          height: `${bag.h * scale}px`,
        }}
      />
    </span>
  );
}

/** A walk: whose, and the doorbell it's for (director.ts walkIn's id). */
export interface Walk {
  readonly arrival: ArrivalId;
  readonly id: number;
}

/**
 * The walk to draw this render, from the latest doorbell (`bell`, director.ts walkIn), the walk
 * under way (`under`) and the last doorbell walked (`played`). A doorbell not walked yet walks
 * from this very render, unless Reduce motion is on: the first frame they're drawn in is the
 * walk's (still unseen, before its delay), never one of them already at the door. A walk under way
 * lasts while its doorbell is the latest: the next one, even for someone who doesn't walk, or a
 * run reset (no doorbell), ends it.
 */
export function walkNow(
  bell: Walk | null,
  under: Walk | null,
  played: number,
  reduceMotion: boolean,
): Walk | null {
  if (bell && bell.id > played && !reduceMotion) return { arrival: bell.arrival, id: bell.id };
  return under && under.id === bell?.id ? under : null;
}

/**
 * The members outside the house: waiting at the door or the kerb, and the one the doorbell just
 * rang for walking up first. `people` is people.ts's, for the board's run and house, and
 * `obstacles` what stands in the yard in a walk's way (people.ts walkObstacles).
 */
export function PeopleLayer({
  people,
  model,
  obstacles,
  scale,
}: {
  people: readonly Person[];
  model: HouseModel;
  obstacles: readonly Rect[];
  scale: number;
}) {
  const [walking, setWalking] = useState<Walk | null>(null);
  const latest = useRef({ people, model, obstacles });
  latest.current = { people, model, obstacles };
  const w = walkIn.value;
  const f = FEEL.arrival.walk;
  // The longest walk, in art px: a deeper front yard is crossed from partway up (walkStart).
  const reach = (f.maxMs * f.maxPxPerSecond) / 1000;
  const start = (m: HouseModel, p: Person, o: readonly Rect[]) =>
    walkStart(m, p, reach, o, f.minPx);
  const active = walkNow(w, walking, playedWalk, settings.value.reduceMotion);

  // A doorbell for a member: their walk, once, unless Reduce motion is on. It's over after its
  // delay and its own length, or at once if they don't wait outside (a room of theirs was built),
  // or when the next doorbell, or a run reset, tears it down.
  useEffect(() => {
    if (!w || w.id <= playedWalk) return;
    playedWalk = w.id;
    if (settings.value.reduceMotion) return;
    const { people: all, model: m, obstacles: o } = latest.current;
    const p = all.find((q) => q.arrival === w.arrival && q.place !== 'room');
    if (!p) return;
    const from = start(m, p, o);
    const frames = spriteFrames(p.cast.walk)?.frames ?? 1;
    const ms = from ? walkPlan(from.y - p.y, frames, f).ms : f.standInMs;
    setWalking({ arrival: w.arrival, id: w.id });
    const done = () => setWalking((cur) => (cur?.id === w.id ? null : cur));
    const t = window.setTimeout(done, f.delayMs + ms);
    return () => {
      window.clearTimeout(t);
      done();
    };
  }, [w?.id]);

  const outside = people.filter((p) => p.place !== 'room');
  if (outside.length === 0) return null;
  return (
    <div class="people" aria-hidden="true">
      {outside.map((p) => {
        if (active?.arrival !== p.arrival) {
          return <Waiting key={p.arrival} p={p} scale={scale} />;
        }
        const from = start(model, p, obstacles);
        if (!from) {
          // No way up from the street: they fade in where they wait.
          return (
            <span
              key={`${p.arrival}-${active.id}`}
              class="stand-in"
              style={{ '--walk-delay': `${f.delayMs}ms`, '--stand-in-ms': `${f.standInMs}ms` }}
            >
              <Waiting p={p} scale={scale} />
            </span>
          );
        }
        const frames = spriteFrames(p.cast.walk)?.frames ?? 1;
        const plan = walkPlan(from.y - p.y, frames, f);
        return (
          <Walker
            key={`${p.arrival}-${active.id}`}
            p={p}
            from={from.y}
            ms={plan.ms}
            frameMs={plan.frameMs}
            delayMs={f.delayMs}
            scale={scale}
          />
        );
      })}
    </div>
  );
}
