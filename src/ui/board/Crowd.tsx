// A won run's open house (D-175): the crowd that walks in along the sidewalk and stops in front
// of the house, and the cars that pull up at the kerb. crowd.ts plans them, and fx/open-house.ts
// starts them as the end of the run looks down the street. Each walks or rolls one way and
// stops, a whole art px a step (fx/Drive.tsx Arrive), and stays where it stopped until the next
// run. Drawn twice, like the street's regulars (LifeLayer.tsx Street): over the lot's own columns,
// and past them, dimmed as the garden and the road out there are. Back to front: the sidewalk's
// far lane, its near lane, then the cars; the street's far-lane car, drawn after, passes in front
// of them all. It never takes the pointer, and nothing is drawn with Reduce motion (LifeLayer).

import { useEffect, useRef } from 'preact/hooks';
import type { Lot } from '../../rules/index.ts';
import { Arrive } from '../fx/Drive.tsx';
import { FEEL } from '../fx/feel.ts';
import { CELL, spriteFrames, spritePos } from '../sprites.ts';
import { PARK_FRAME, STAND_FRAME, type Crowd as Plan } from './crowd.ts';
import { boardRows } from './geometry.ts';
import { LANES } from './life.ts';
import type { Around } from './TerrainLayer.tsx';
import './crowd.css';

/** The crowd and the cars along a street box, set off `since` ms ago (0: just now). */
function People({
  plan,
  scale,
  around,
  since,
}: {
  plan: Plan;
  scale: number;
  around: Around;
  since: number;
}) {
  const f = FEEL.openHouse;
  // The sidewalk's far lane first, so its people stand behind the near lane's.
  const visitors = plan.visitors
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v.base - b.v.base || a.i - b.i);
  const at = (x: number, base: number, h: number) => ({
    left: `${around.left + x * scale}px`,
    // Feet or wheels `base` art px down the street row, a row below the box's top.
    top: `${(CELL + base - h) * scale}px`,
  });
  return (
    <>
      {visitors.map(({ v, i }) => {
        const anim = spriteFrames(v.id);
        return (
          <Arrive
            key={`v${i}`}
            id={v.id}
            scale={scale}
            from={(v.from === 'west' ? -1 : 1) * f.walkPx}
            speed={f.walkPxPerSecond}
            delayMs={v.delayMs - since}
            fadeMs={f.fadeMs}
            // The walk cycle keeps pace with the sidewalk at the regulars' stroll: quicker here.
            frameMs={
              anim ? (anim.ms * FEEL.street.walkerPxPerSecond) / f.walkPxPerSecond : undefined
            }
            stand={STAND_FRAME}
            flip={v.from === 'east'}
            style={at(v.x, v.base, spritePos(v.id).h)}
          />
        );
      })}
      {plan.cars.map((c, i) => (
        <Arrive
          key={`c${i}`}
          id={c.id}
          scale={scale}
          // The lane by the sidewalk goes west: in from the east, mirrored.
          from={f.rollPx}
          speed={FEEL.street.carPxPerSecond}
          delayMs={c.delayMs - since}
          fadeMs={f.fadeMs}
          stand={PARK_FRAME}
          flip
          style={at(c.x, LANES.nearCar, spritePos(c.id).h)}
        />
      ))}
    </>
  );
}

/**
 * The open house on the street: `plan` from crowd.ts, started at `startedAt` (performance.now()).
 * A crowd drawn later (the board back from the title) stands where it got to. `hurried`: a
 * click, a key or the wheel hurried the look, and the rest of the walk plays faster.
 */
export function Crowd({
  plan,
  lot,
  scale,
  around,
  startedAt,
  hurried,
}: {
  plan: Plan;
  lot: Lot;
  scale: number;
  around: Around;
  startedAt: number;
  hurried: boolean;
}) {
  const since = useRef<number | null>(null);
  if (since.current === null) since.current = Math.max(0, performance.now() - startedAt);
  const lotBox = useRef<HTMLDivElement>(null);
  const offBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hurried) return;
    for (const el of [lotBox.current, offBox.current]) {
      for (const a of el?.getAnimations({ subtree: true }) ?? []) {
        a.updatePlaybackRate(FEEL.openHouse.hurry);
      }
    }
  }, [hurried]);
  const px = CELL * scale;
  const width = lot.width * px + around.left + around.right;
  const rows = boardRows(lot.height) - lot.height + 1;
  const box = {
    left: `${-around.left}px`,
    top: `${(lot.height - 1) * px}px`,
    width: `${width}px`,
    height: `${rows * px}px`,
  };
  const from = `${around.left}px`;
  const to = `${around.left + lot.width * px}px`;
  return (
    <>
      <div
        ref={lotBox}
        class="life life-street crowd"
        aria-hidden="true"
        style={{ ...box, clipPath: `inset(0 ${around.right}px 0 ${around.left}px)` }}
      >
        <People plan={plan} scale={scale} around={around} since={since.current} />
      </div>
      <div
        ref={offBox}
        class="life life-street off-lot crowd"
        aria-hidden="true"
        style={{
          ...box,
          maskImage: `linear-gradient(to right, #000 ${from}, transparent ${from}, transparent ${to}, #000 ${to})`,
        }}
      >
        <People plan={plan} scale={scale} around={around} since={since.current} />
      </div>
    </>
  );
}
