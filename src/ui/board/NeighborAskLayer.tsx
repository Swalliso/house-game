// The neighbor's ask on the board (D-206). While it runs, one of the street's walkers stands just
// past the lot's edge on their side, facing it, with a bubble over them: the Fence icon and how
// many of its tiles stand in their strip, "3/5", and no words; and the strip they mean is shaded,
// as D-166 shades the yard a picked card reads. With a placement looked at, the count is the
// play's, marked up or down. Where it all goes is neighbor-ask.ts; which side and how many are the
// rules' (rules.neighbor). The checklist's line says it in words (hud/Checklist.tsx).
//
// The director plays the moments (fx/director.ts neighborMoment): as the ask comes, they walk
// over from their house, a whole art px a step (fx/Drive.tsx Arrive), and their bubble pops; met
// at the milestone, a heart pops over them (the client's visit's bubble, D-182), and they fade
// away; missed, they just fade. With Reduce motion they're simply there, the heart stands still,
// and they go. Decoration only: it never takes the pointer.

import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { rules, type Lot, type NeighborSide } from '../../rules/index.ts';
import { neighborMoment, shownRun, tallyView } from '../fx/director.ts';
import { Arrive, FxSprite } from '../fx/Drive.tsx';
import { FEEL } from '../fx/feel.ts';
import { BUBBLE, bubbleOpensMs } from '../fx/visit.ts';
import { Icon } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { spriteFrames, spritePos, spriteStyle, type SpriteId } from '../sprites.ts';
import { activePlay, preview, run } from '../store.ts';
import { STAND_FRAME } from './crowd.ts';
import { Bubble } from './MomentLayers.tsx';
import {
  askCount,
  neighborFeet,
  neighborFigure,
  overHead,
  stripCells,
  type ArtPoint,
} from './neighbor-ask.ts';
import { Outline } from './TerrainLayer.tsx';
import './neighbor-ask.css';

/** A walker standing on its feet-together frame, its box's bottom middle at `feet`. */
function Standing({
  id,
  feet,
  flip,
  scale,
  class: cls = '',
  style,
}: {
  id: SpriteId;
  feet: ArtPoint;
  flip: boolean;
  scale: number;
  class?: string;
  style?: JSX.CSSProperties;
}) {
  const { x, y, w, h } = spritePos(id);
  const stride = spriteFrames(id)?.stride ?? w;
  return (
    <span
      class={['fx-sprite', 'neighbor-figure', flip ? 'flip' : '', cls].filter(Boolean).join(' ')}
      style={{
        ...spriteStyle(id, scale),
        ...style,
        backgroundPosition: `${-(x + STAND_FRAME * stride) * scale}px ${-y * scale}px`,
        left: `${(feet.x - w / 2) * scale}px`,
        top: `${(feet.y - h) * scale}px`,
        width: `${w * scale}px`,
        height: `${h * scale}px`,
      }}
    />
  );
}

/** The ask's strip, shaded while it runs (cells only change with the lot and the side). */
function StripTint({ strip, lot, scale }: { strip: readonly number[]; lot: Lot; scale: number }) {
  const cells = useMemo(() => stripCells(strip, lot.width), [strip.join(), lot.width]);
  return <Outline cells={cells} scale={scale} lot={lot} class="side-tint neighbor-tint" />;
}

/** How close to the view's edge the count may come, in CSS px. */
const KEEP_PX = 4;

/**
 * The ask's count over the neighbor: its corner over their head and the rest out over the lot.
 * It keeps to the board's view (as the tally's popups do, Board.tsx PopupLayer), however the
 * view is scrolled: where the lot's edge is out of it (a window too narrow for the lot at this
 * zoom), the count waits at the view's edge on their side, without its tail. `popAt`: it pops in
 * that long from now, the neighbor having walked over; null, it's simply there.
 */
function CountBubble({
  side,
  head,
  scale,
  count,
  popAt,
}: {
  side: NeighborSide;
  head: ArtPoint;
  scale: number;
  count: ReturnType<typeof askCount>;
  popAt: number | null;
}) {
  const keep = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = keep.current;
    const bubble = el?.firstElementChild;
    const view = el?.closest('.board-scroll');
    if (!el || !(bubble instanceof HTMLElement) || !view) return;
    const place = () => {
      // Its box as laid out, before the pop's scale: the anchor's point, and the bubble in it.
      el.style.transform = '';
      const a = el.getBoundingClientRect();
      const v = view.getBoundingClientRect();
      const left = a.left + bubble.offsetLeft;
      const top = a.top + bubble.offsetTop;
      const right = left + bubble.offsetWidth;
      const bottom = top + bubble.offsetHeight;
      const dx =
        left < v.left + KEEP_PX
          ? v.left + KEEP_PX - left
          : right > v.right - KEEP_PX
            ? v.right - KEEP_PX - right
            : 0;
      const dy =
        top < v.top + KEEP_PX
          ? v.top + KEEP_PX - top
          : bottom > v.bottom - KEEP_PX
            ? v.bottom - KEEP_PX - bottom
            : 0;
      const kept = dx !== 0 || dy !== 0;
      el.classList.toggle('kept', kept);
      el.style.transform = kept ? `translate(${Math.round(dx)}px, ${Math.round(dy)}px)` : '';
    };
    place();
    view.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      view.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  });
  const f = FEEL.neighbor;
  return (
    <span
      ref={keep}
      class="neighbor-keep"
      style={{ left: `${head.x * scale}px`, top: `${head.y * scale}px` }}
    >
      <span
        class={[
          'neighbor-bubble',
          `from-${side}`,
          count.met ? 'met' : '',
          count.change ?? '',
          popAt !== null ? 'pop' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={popAt !== null ? { '--pop-at': `${popAt}ms`, '--pop-ms': `${f.popMs}ms` } : {}}
      >
        <Icon name="fence" />
        <span class="neighbor-count num">{count.text}</span>
        {count.met && <Icon name="check" />}
      </span>
    </span>
  );
}

/**
 * The neighbor and their ask, for the board's run, drawn at `scale` CSS px per art px. `seed`
 * picks which of the street's walkers they are.
 */
export function NeighborAskLayer({ lot, seed, scale }: { lot: Lot; seed: string; scale: number }) {
  const s = run.value;
  const shown = shownRun.value;
  // While an action plays back, the ask as its beats have it (a resolve lands with its own), and
  // the house as it stands: the checklist's run (Checklist.tsx judged).
  const judged = shown && shown !== s ? { ...shown, house: s.house } : s;
  const looking = tallyView.value === null && preview.value?.legal ? activePlay.value : null;
  const view = rules.neighbor(judged);
  const m = neighborMoment.value;
  const running = view !== null && view.result === undefined;
  const going = m && m.kind !== 'asked' ? m : null;
  if (!view || (!running && !going)) return null;
  const f = FEEL.neighbor;
  const still = settings.value.reduceMotion;
  const side: NeighborSide = going?.side ?? view.side;
  const feet = neighborFeet(lot, side);
  const id = neighborFigure(seed);
  const flip = side === 'right';
  const arriving = running && m?.kind === 'asked' && !still ? m : null;
  const walkMs = (f.walkPx / f.walkPxPerSecond) * 1000;
  const count = askCount(
    looking ? (rules.neighbor(judged, looking)?.have ?? view.have) : view.have,
    view.tiles,
    view.have,
  );
  const head = overHead(feet);
  const { w, h } = spritePos(id);
  return (
    <>
      {running && <StripTint strip={view.strip} lot={lot} scale={scale} />}
      <div class="neighbor-ask" aria-hidden="true">
        {arriving ? (
          <Arrive
            key={arriving.id}
            id={id}
            scale={scale}
            from={flip ? f.walkPx : -f.walkPx}
            speed={f.walkPxPerSecond}
            delayMs={arriving.delayMs}
            fadeMs={f.fadeMs}
            stand={STAND_FRAME}
            flip={flip}
            style={{ left: `${(feet.x - w / 2) * scale}px`, top: `${(feet.y - h) * scale}px` }}
          />
        ) : (
          <Standing
            key={going ? `going-${going.id}` : 'standing'}
            id={id}
            feet={feet}
            flip={flip}
            scale={scale}
            class={going ? `going ${going.kind}` : ''}
            style={
              going
                ? {
                    '--going-at': `${going.kind === 'met' ? f.metMs : f.metMs / 2}ms`,
                    '--going-ms': `${f.outMs}ms`,
                  }
                : undefined
            }
          />
        )}
        {going?.kind === 'met' &&
          (still ? (
            <FxSprite
              id="visit-heart"
              scale={scale}
              class="neighbor-heart"
              style={{
                left: `${(head.x - BUBBLE.tailX) * scale}px`,
                top: `${Math.max(0, head.y - BUBBLE.tailY) * scale}px`,
              }}
            />
          ) : (
            <span
              class="neighbor-hearts"
              key={going.id}
              style={{
                '--visit-opens-ms': `${bubbleOpensMs()}ms`,
                '--going-at': `${f.metMs}ms`,
                '--going-ms': `${f.outMs}ms`,
              }}
            >
              <Bubble icon="heart" tail={head} delayMs={0} scale={scale} />
            </span>
          ))}
      </div>
      {running && (
        <div class="neighbor-ask-bubbles" aria-hidden="true">
          <CountBubble
            key={arriving ? `pop-${arriving.id}` : 'bubble'}
            side={side}
            head={head}
            scale={scale}
            count={count}
            popAt={arriving ? arriving.delayMs + walkMs + f.bubbleMs : null}
          />
        </div>
      )}
    </>
  );
}
