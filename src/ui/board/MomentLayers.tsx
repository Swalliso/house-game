// The board's moments that sit on the lot (D-127): the roof reveal at the Roofing milestone, and
// "Topped out!" the first week Under one roof holds. Both are in the board, so they keep to the
// house however the lot is panned or zoomed, and both are drawn at the camera's scale.

import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Lot } from '../../rules/index.ts';
import { paintRoof } from '../art/roof.ts';
import { played, roofReveal, toppedOut } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { Icon } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { CELL } from '../sprites.ts';
import type { HouseModel } from './house-model.ts';

/**
 * The roof reveal (§12, D-127): the house gets its roof for a moment, dropping on with a thump,
 * holding under the milestone's banner, and lifting off again. With Reduce motion it fades in and
 * out where it stands. It's played once per reveal (remounting the game screen doesn't replay it).
 */
export function RoofLayer({ lot, scale, model }: { lot: Lot; scale: number; model: HouseModel }) {
  const reveal = roofReveal.value;
  const [shown, setShown] = useState<number | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!reveal || reveal.id <= played.roof) return;
    played.roof = reveal.id;
    setShown(reveal.id);
  }, [reveal?.id]);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || shown === null) return;
    const roof = paintRoof(model);
    if (!roof) {
      setShown(null);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(
      new ImageData(roof.data as Uint8ClampedArray<ArrayBuffer>, roof.w, roof.h),
      roof.x,
      roof.y,
    );
    const r = FEEL.roof;
    const total = r.dropMs + r.holdMs + r.liftMs;
    const lift = `translateY(${-r.dropPx * scale}px)`;
    const still = settings.value.reduceMotion;
    const a = canvas.animate(
      still
        ? [
            { opacity: 0 },
            { opacity: 1, offset: r.dropMs / total },
            { opacity: 1, offset: (r.dropMs + r.holdMs) / total },
            { opacity: 0 },
          ]
        : [
            { opacity: 0, transform: lift },
            {
              opacity: 1,
              transform: 'translateY(0)',
              offset: r.dropMs / total,
              easing: 'ease-out',
            },
            {
              opacity: 1,
              transform: 'translateY(0)',
              offset: (r.dropMs + r.holdMs) / total,
              easing: 'ease-in',
            },
            { opacity: 0, transform: lift },
          ],
      { duration: total, easing: still ? 'linear' : 'ease-in', fill: 'both' },
    );
    // The tiles' digits and badges step aside while the roof is on: it's the house from outside.
    const labels = canvas.closest('.board')?.querySelector<HTMLElement>('.labels');
    const hide = labels?.animate(
      [
        { opacity: 1 },
        { opacity: 0, offset: r.dropMs / total },
        { opacity: 0, offset: (r.dropMs + r.holdMs) / total },
        { opacity: 1 },
      ],
      { duration: total },
    );
    a.onfinish = () => setShown((s) => (s === shown ? null : s));
    return () => {
      a.cancel();
      hide?.cancel();
    };
  }, [shown]);
  if (shown === null) return null;
  return (
    <canvas
      ref={ref}
      class="house-roof"
      width={lot.width * CELL}
      height={(lot.height + 1) * CELL}
      style={{
        width: `${lot.width * CELL * scale}px`,
        height: `${(lot.height + 1) * CELL * scale}px`,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * "Topped out!" (D-127): a plaque with a flag over the top of the house, the first week Under
 * one roof holds, for FEEL.moments.toppedOutMs. The director's stars and cheer go with it.
 */
export function ToppedOut({ scale, model }: { scale: number; model: HouseModel }) {
  const t = toppedOut.value;
  const b = model.bounds;
  if (!t || !b) return null;
  const px = CELL * scale;
  return (
    <div
      class="topped-out ui"
      key={t.id}
      role="status"
      style={{
        left: `${(b.x + b.w / 2) * px}px`,
        top: `${b.y * px}px`,
        '--topped-ms': `${FEEL.moments.toppedOutMs}ms`,
      }}
    >
      <Icon name="flag" />
      <span>Topped out!</span>
    </div>
  );
}
