// The street's traffic: a sprite crossing a span over and over, then out of sight for a pause
// before it comes by again. The title screen's car (M5a) and the lot's regulars (D-155,
// board/LifeLayer.tsx) both drive this way. Each crossing is one CSS animation that moves a
// whole art px at a time (steps), transform only, like the water's frames, so the traffic never
// wakes the main thread; a sprite's own frames (a car's bounce, a walker's steps) step behind
// its box the same way.

import type { JSX } from 'preact';
import { spriteFrames, spritePos, spriteStyle, type SpriteId } from '../sprites.ts';
import './drive.css';

/**
 * One crossing, in art px: a sprite `w` wide comes in from just past one end of `span`, goes on
 * past the other end, then on out of sight for `pauseMs`, at `speed` art px a second. `distance`
 * is how far it moves in all, and `ms` how long that takes.
 */
export function drivePlan(
  span: number,
  w: number,
  speed: number,
  pauseMs: number,
): { distance: number; ms: number } {
  const distance = Math.ceil(span) + 2 * w + Math.round((speed * pauseMs) / 1000);
  return { distance, ms: Math.round((distance / speed) * 1000) };
}

/**
 * A sprite at `scale` CSS px per art px, standing on its box's bottom edge. An animated one's
 * frames step behind its box (transform only). `flip` mirrors it: the cars and the walkers are
 * cut facing east, and mirrored to go west.
 */
export function FxSprite({
  id,
  scale,
  flip = false,
  class: cls = '',
  style,
}: {
  id: SpriteId;
  scale: number;
  flip?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}) {
  const { w, h } = spritePos(id);
  const anim = spriteFrames(id);
  const box: JSX.CSSProperties = { ...style, width: `${w * scale}px`, height: `${h * scale}px` };
  const classes = ['fx-sprite', flip ? 'flip' : '', cls].filter(Boolean).join(' ');
  if (!anim) return <span class={classes} style={{ ...spriteStyle(id, scale), ...box }} />;
  return (
    <span class={classes} style={box}>
      <span
        class="fx-frames"
        style={{
          ...spriteStyle(id, scale),
          width: `${anim.stride * anim.frames * scale}px`,
          animationDuration: `${anim.ms * anim.frames}ms`,
          animationTimingFunction: `steps(${anim.frames})`,
          '--fx-frames': `${-anim.stride * anim.frames * scale}px`,
        }}
      />
    </span>
  );
}

/**
 * A sprite driving (or walking) across `span` art px, over and over: east (`dir` 1, in from
 * the left) or west, at `speed` art px a second, out of sight for `pauseMs` between crossings.
 * With two `ids` they take turns, a crossing each, swapping while out of sight. `phase` (0–1)
 * is how far into its loop it starts, so a street isn't empty when it first shows. `parkedAt`
 * (the title with Reduce motion) stands it still at that share of the span instead.
 */
export function Drive({
  ids,
  span,
  speed,
  pauseMs,
  scale,
  dir = 1,
  phase = 0,
  parkedAt = null,
  class: cls = '',
  style,
}: {
  ids: readonly SpriteId[];
  span: number;
  speed: number;
  pauseMs: number;
  scale: number;
  dir?: 1 | -1;
  phase?: number;
  parkedAt?: number | null;
  class?: string;
  style?: JSX.CSSProperties;
}) {
  const sizes = ids.map((id) => spritePos(id));
  const w = Math.max(...sizes.map((s) => s.w));
  const h = Math.max(...sizes.map((s) => s.h));
  const { distance, ms } = drivePlan(span, w, speed, pauseMs);
  const parked = parkedAt !== null;
  const left = parked ? Math.round(span * parkedAt) : dir > 0 ? -w : Math.ceil(span);
  const delay = -Math.round(phase * ms);
  const turns = ids.length > 1;
  return (
    <span
      class={['drive', parked ? 'parked' : '', turns ? 'turns' : '', cls].filter(Boolean).join(' ')}
      style={{
        ...style,
        left: `${left * scale}px`,
        width: `${w * scale}px`,
        height: `${h * scale}px`,
        '--drive': `${dir * distance * scale}px`,
        '--drive-steps': String(distance),
        '--drive-ms': `${ms}ms`,
        '--drive-delay': `${delay}ms`,
      }}
    >
      {ids.map((id, k) => (
        <FxSprite
          key={id}
          id={id}
          scale={scale}
          flip={dir < 0}
          // Each takes its turn a crossing after the one before.
          style={turns ? { '--turn-delay': `${delay - k * ms}ms` } : undefined}
        />
      ))}
    </span>
  );
}
