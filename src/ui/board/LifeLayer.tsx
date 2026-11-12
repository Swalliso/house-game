// Life on and around the lot (D-155): decoration only, never the rules and never a click.
// - A flock of crows pecks on the lot's open grass. It takes off, up and away, fading, when the
//   pointer, the piece being placed or a change to the house comes near, with a soft flap; a
//   flock still there at End week leaves quietly. The next week's flock glides in once the
//   week's tally is over.
// - The street's regulars come by now and then: a walker each way on the sidewalk and a car in
//   each lane, in from past one edge of the view and out past the other, driving the way the
//   title's car does (fx/Drive.tsx).
// It's all CSS animation, transform and opacity only, so nothing wakes the main thread between
// events; which grass, and when, is life.ts. It sits on the canopy's layer, after the canopy,
// so a crow in flight crosses over the tree tops, and under the labels. Each part is a box the
// size of the view's reach around the board that clips, so nothing in it makes the view scroll
// further. Off with Reduce motion; still under the shop's sheet (life.css).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Cell, HouseState, Lot } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy } from '../fx/director.ts';
import { Drive, FxSprite } from '../fx/Drive.tsx';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { CELL, spritePos } from '../sprites.ts';
import { hoverCell } from '../store.ts';
import { boardRows } from './geometry.ts';
import { flight, flock, groundKey, regulars, startledBy, type Crow } from './life.ts';
import type { Around } from './TerrainLayer.tsx';
import './life.css';

/**
 * The street's regulars, in a box over the sidewalk and the road that runs as far past the
 * board's sides as the view does, from a row above the street row (a walker's head rises over
 * the lot's edge) to the board's foot. Twice, in step: once over the lot's own columns, and once
 * past them, dimmed as the garden and the road out there are (terrain/outside.ts dim), so a car
 * comes out of the same light as the road it's on.
 */
function Street({ lot, scale, around }: { lot: Lot; scale: number; around: Around }) {
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
        class="life life-street"
        aria-hidden="true"
        style={{ ...box, clipPath: `inset(0 ${around.right}px 0 ${around.left}px)` }}
      >
        <Regulars width={width} scale={scale} />
      </div>
      <div
        class="life life-street off-lot"
        aria-hidden="true"
        style={{
          ...box,
          maskImage: `linear-gradient(to right, #000 ${from}, transparent ${from}, transparent ${to}, #000 ${to})`,
        }}
      >
        <Regulars width={width} scale={scale} />
      </div>
    </>
  );
}

/** The regulars along a street box `width` CSS px wide. */
function Regulars({ width, scale }: { width: number; scale: number }) {
  const f = FEEL.street;
  return (
    <>
      {regulars(FEEL.life.street).map((r) => {
        const h = Math.max(...r.ids.map((id) => spritePos(id).h));
        return (
          <Drive
            key={r.ids[0]}
            ids={r.ids}
            span={width / scale}
            speed={r.kind === 'car' ? f.carPxPerSecond : f.walkerPxPerSecond}
            pauseMs={r.pauseMs}
            dir={r.dir}
            phase={r.phase}
            scale={scale}
            // Its wheels or feet `base` art px down the street row, a row below the box's top.
            style={{ top: `${(CELL + r.base - h) * scale}px` }}
          />
        );
      })}
    </>
  );
}

/** A flock on its way in or out: where each crow stands, and where it flies from or to. */
interface Flight {
  readonly week: number;
  readonly crows: readonly Crow[];
  readonly to: readonly { readonly x: number; readonly y: number }[];
}

/** The flock on the grass: what stood around it as it landed, and when it touched down. */
interface Landed extends Flight {
  readonly key: string;
  readonly down: number;
}

/** A flock's crows, landing (then pecking) or flying off. */
function Crows({
  flock: fl,
  state,
  scale,
  around,
}: {
  flock: Flight;
  state: 'landing' | 'flying';
  scale: number;
  around: Around;
}) {
  const f = FEEL.life.crows;
  const px = CELL * scale;
  return (
    <div
      class={`life-crows ${state}`}
      style={{ '--land-ms': `${f.landMs}ms`, '--fly-ms': `${f.flyMs}ms` }}
    >
      {fl.crows.map((c, i) => (
        <div
          key={i}
          class="life-crow"
          style={{
            left: `${around.left + (c.x * CELL + c.dx) * scale}px`,
            top: `${around.top + (c.y * CELL + c.dy) * scale}px`,
            '--fly-x': `${fl.to[i]!.x * px}px`,
            '--fly-y': `${fl.to[i]!.y * px}px`,
            '--crow-delay': `${i * f.staggerMs}ms`,
          }}
        >
          <FxSprite id={c.west ? 'life-crow-l' : 'life-crow-r'} scale={scale} class="crow-idle" />
          {/* The flapping crow is 48 art px wide to the pecking one's 32: centered over it. */}
          <FxSprite
            id="life-crow-fly"
            scale={scale}
            class="crow-flap"
            style={{ left: `${-8 * scale}px` }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The lot's flock (life.ts flock): it lands once the week's tally is over, away from the pointer
 * and the piece in hand, and takes off when they come within FEEL's startleCells of a crow or the
 * ground around it changes. One flock a week: once it has gone, the grass stays empty until the
 * next week's lands.
 */
function Flock({
  house,
  seed,
  week,
  scale,
  around,
  ghost,
}: {
  house: HouseState;
  seed: string;
  week: number;
  scale: number;
  around: Around;
  ghost: readonly Cell[];
}) {
  const f = FEEL.life.crows;
  const lot = house.lot;
  const [landed, setLanded] = useState<Landed | null>(null);
  const [leaving, setLeaving] = useState<Flight | null>(null);
  // The week whose flock has come down already.
  const came = useRef(0);
  // The latest of what moves, for the landing's timer.
  const now = useRef({ house, ghost });
  now.current = { house, ghost };
  const tallying = busy.value;
  const hover = hoverCell.value;

  const away = (crows: readonly Crow[], from: Cell | null) =>
    flight(crows, from, lot.width, f.flyUpCells, f.flyAwayCells);

  // A new week: a flock still on the grass leaves, quietly (time passes).
  useEffect(() => {
    if (!landed || landed.week === week) return;
    setLeaving({ week: landed.week, crows: landed.crows, to: away(landed.crows, null) });
    setLanded(null);
  }, [week]);

  // Once the week's tally is over, the week's flock lands.
  useEffect(() => {
    if (tallying || landed || came.current === week) return;
    const t = window.setTimeout(() => {
      came.current = week;
      const { house: h, ghost: g } = now.current;
      const crows = flock(h, seed, week, [hoverCell.peek(), ...g].filter(isCell), f.startleCells);
      if (crows.length === 0) return;
      setLanded({
        week,
        crows,
        to: away(crows, null),
        key: groundKey(h, crows, f.startleCells),
        down: performance.now() + f.landMs + f.staggerMs * crows.length,
      });
    }, f.landDelayMs);
    return () => window.clearTimeout(t);
  }, [tallying, landed, week, seed]);

  // Startled: the pointer or the piece in hand comes near, or the ground around changes.
  useEffect(() => {
    if (!landed || landed.week !== week || performance.now() < landed.down) return;
    const by = startledBy(landed.crows, [hover, ...ghost], f.startleCells);
    if (!by && groundKey(house, landed.crows, f.startleCells) === landed.key) return;
    setLeaving({ week: landed.week, crows: landed.crows, to: away(landed.crows, by) });
    setLanded(null);
    audio.play('flap');
  });

  // Gone once they're out of sight.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(
      () => setLeaving(null),
      f.flyMs + f.staggerMs * leaving.crows.length,
    );
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!landed && !leaving) return null;
  const px = CELL * scale;
  return (
    <div
      class="life life-flock"
      aria-hidden="true"
      style={{
        left: `${-around.left}px`,
        top: `${-around.top}px`,
        width: `${lot.width * px + around.left + around.right}px`,
        height: `${around.top + boardRows(lot.height) * px}px`,
      }}
    >
      {leaving && (
        <Crows
          key={`off-${leaving.week}`}
          flock={leaving}
          state="flying"
          scale={scale}
          around={around}
        />
      )}
      {landed && (
        <Crows
          key={`in-${landed.week}`}
          flock={landed}
          state="landing"
          scale={scale}
          around={around}
        />
      )}
    </div>
  );
}

const isCell = (c: Cell | null): c is Cell => c !== null;

/**
 * The lot's life: its flock and the street's regulars. `ghost`: the cells of the piece being
 * placed, if any. Nothing at all with Reduce motion.
 */
export function LifeLayer({
  run,
  house,
  seed,
  week,
  scale,
  around,
  ghost,
}: {
  /** The run's setup: a new run, or one loaded, gets a flock of its own. */
  run: object;
  house: HouseState;
  seed: string;
  week: number;
  scale: number;
  around: Around;
  ghost: readonly Cell[];
}) {
  const { lot } = house;
  const runs = useRef<{ run: object | null; n: number }>({ run: null, n: 0 });
  if (runs.current.run !== run) runs.current = { run, n: runs.current.n + 1 };
  const street = useMemo(
    () => <Street lot={lot} scale={scale} around={around} />,
    // The street changes only with the zoom and the view's reach.
    [lot.width, lot.height, scale, around.left, around.right],
  );
  if (settings.value.reduceMotion) return null;
  return (
    <>
      <Flock
        key={runs.current.n}
        house={house}
        seed={seed}
        week={week}
        scale={scale}
        around={around}
        ghost={ghost}
      />
      {street}
    </>
  );
}
