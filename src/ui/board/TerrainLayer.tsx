// The lot's ground (§12, Rendering; D-097), in a group of its own at LAYER.terrain:
// - The terrain canvas: (lot width × CELL) × (boardRows × CELL) art px (768×864 for a 24×24
//   lot): the lot, the street row, and the road below it (geometry.ts ROAD_ROWS). Smoothing
//   off, shown at that size × scale with image-rendering: pixelated. It redraws only when the
//   lot changes (building over a Tree replaces it, a Sapling grows into one) or a piece comes
//   or goes on the street's edge: the grass, the woods' floor, the sunny side, then what stands
//   on the lot (terrain/objects.ts) on its own cells, and the street (terrain/).
// - The water canvas, above it at LAYER.water: only over the water's bounding box, redrawn
//   when its animation changes frame, frozen under Reduce motion (and, since it runs on
//   requestAnimationFrame, while the tab is hidden).
// - Past the board's edges, in the garden around the lot: the road and each creek mouth running
//   on (terrain/outside.ts), as slices painted once per lot and repeated by CSS.
// The group is a stacking context below everything else on the board, so the water stays
// under the pieces whatever their own z-index. Outside it, at LAYER.canopy, the canopy canvas
// holds what rises above its own cells (tree tops), over the pieces, redrawn with the
// terrain; the board's scroll area keeps room for it above the lot (geometry.ts CANOPY_ROOM).
// No canvas takes the pointer.
// Over the group, under the pieces, a soft tint shows the house's fenced yards.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { rules, type Cell, type HouseState, type Lot, type RunState } from '../../rules/index.ts';
import { settings } from '../settings.ts';
import { atlasImage, CELL } from '../sprites.ts';
import { boardRows, cellsOutline, occupancy, uidAt } from './geometry.ts';
import { sheetRect } from './terrain/atlas.ts';
import { paintGrass } from './terrain/grass.ts';
import { seedSalt, tileHash } from './terrain/hash.ts';
import {
  canopyBox,
  lotObjects,
  paintCanopy,
  paintObjects,
  type ArtBox,
  type Placed,
} from './terrain/objects.ts';
import { outsideSlices, paintSlice, sliceSize, type Slice } from './terrain/outside.ts';
import { paintStreet, streetTiles } from './terrain/street.ts';
import { paintSunnyEdge, sunnyEdge } from './terrain/sunny.ts';
import { paintWater, waterPlan, type WaterPlan } from './terrain/water.ts';
import { paintWoodsFloor, woodsFloor } from './terrain/woods.ts';
import './terrain/terrain.css';

export { tileHash };

/** How far the view reaches past the board's left, right and top edges, in CSS px. */
export interface Around {
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

function draw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  lot: Lot,
  objects: readonly Placed[],
  salt: number,
  front: readonly boolean[],
): void {
  ctx.imageSmoothingEnabled = false;
  paintGrass(ctx, img, lot, salt);
  paintWoodsFloor(ctx, img, woodsFloor(lot));
  paintSunnyEdge(ctx, img, sunnyEdge(lot));
  paintObjects(ctx, img, objects);
  paintStreet(ctx, img, streetTiles(lot, front));
}

/** Which columns of the lot's bottom row a piece stands on: the street's grass stops there. */
function streetFront(house: HouseState | undefined): boolean[] {
  if (!house) return [];
  const occ = occupancy(house);
  return Array.from({ length: occ.width }, (_, x) => uidAt(occ, x, occ.height - 1) !== 0);
}

/**
 * The lot's ground. `seed` is the run's: each run's lot is decorated its own way (hash.ts
 * seedSalt). `house`: where its pieces meet the street, the street's grass fringe stops.
 * `around`: how far past the board the view reaches, for what runs on (geometry.ts viewReach).
 */
export function TerrainLayer({
  lot,
  scale,
  seed = '',
  house,
  around,
}: {
  lot: Lot;
  scale: number;
  seed?: string;
  house?: HouseState;
  around?: Around;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const canopyRef = useRef<HTMLCanvasElement>(null);
  const salt = useMemo(() => seedSalt(seed), [seed]);
  // Redrawn when a piece comes or goes on the bottom row, not for every change to the house.
  const frontKey = streetFront(house).map(Number).join('');
  const front = useMemo(() => [...frontKey].map((c) => c === '1'), [frontKey]);
  const objects = useMemo(() => lotObjects(lot, salt), [lot, salt]);
  const canopy = useMemo(() => canopyBox(lot, objects), [lot, objects]);
  useEffect(() => {
    let cancelled = false;
    atlasImage()
      .then((img) => {
        if (cancelled) return;
        const ctx = ref.current?.getContext('2d');
        if (ctx) draw(ctx, img, lot, objects, salt, front);
        const top = canopyRef.current?.getContext('2d');
        if (top && canopy) {
          top.imageSmoothingEnabled = false;
          paintCanopy(top, img, objects, canopy);
        }
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [lot, objects, canopy, salt, front]);
  const water = useMemo(() => waterPlan(lot, salt), [lot, salt]);
  const slices = useMemo(() => outsideSlices(lot), [lot]);
  const rows = boardRows(lot.height);
  const px = CELL * scale;
  return (
    <>
      <div class="ground" aria-hidden="true">
        {around && <Outside slices={slices} scale={scale} around={around} />}
        <canvas
          ref={ref}
          class="terrain"
          width={lot.width * CELL}
          height={rows * CELL}
          style={{ width: `${lot.width * px}px`, height: `${rows * px}px` }}
        />
        {water.box && <WaterCanvas plan={water} scale={scale} />}
        <div
          class="lot-line"
          style={{ width: `${lot.width * px}px`, height: `${lot.height * px}px` }}
        />
      </div>
      {canopy && <CanopyCanvas canvasRef={canopyRef} box={canopy} scale={scale} />}
    </>
  );
}

/**
 * What runs on past the board's edges (terrain/outside.ts): each slice painted once into a
 * small image and repeated by CSS away from the board, as far as the view reaches. The strips
 * end where the scroll area does, so they never make it scroll further, and start a cell under
 * the board's edge, below the terrain canvas, so no sliver of grass shows between the two at a
 * fractional devicePixelRatio.
 */
function Outside({
  slices,
  scale,
  around,
}: {
  slices: readonly Slice[];
  scale: number;
  around: Around;
}) {
  const [painted, setPainted] = useState<{ slices: readonly Slice[]; urls: string[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    atlasImage()
      .then((img) => {
        if (cancelled) return;
        const urls = slices.map((s) => {
          const { w, h } = sliceSize(s);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return '';
          paintSlice(ctx, img, s);
          return canvas.toDataURL();
        });
        setPainted({ slices, urls });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [slices]);
  if (painted?.slices !== slices) return null;
  const px = CELL * scale;
  return (
    <>
      {slices.map((s, i) =>
        painted.urls[i] ? (
          <div
            key={`${s.side}-${s.at}`}
            class={`outside outside-${s.side}`}
            style={stripStyle(s, painted.urls[i]!, px, around)}
          />
        ) : null,
      )}
    </>
  );
}

/**
 * A slice's strip: from a cell inside the board's edge out as far as the view reaches, the
 * slice repeating (a whole cell under the board keeps its step).
 */
function stripStyle(s: Slice, url: string, px: number, around: Around): JSX.CSSProperties {
  const at = `${s.at * px}px`;
  const span = `${s.span * px}px`;
  const under = `calc(100% - ${px}px)`;
  const image = { backgroundImage: `url(${url})` };
  if (s.side === 'top') {
    return {
      ...image,
      left: at,
      width: span,
      bottom: under,
      height: `${around.top + px}px`,
      backgroundSize: `${span} ${px}px`,
      backgroundRepeat: 'repeat-y',
      backgroundPosition: 'left bottom',
    };
  }
  return {
    ...image,
    top: at,
    height: span,
    ...(s.side === 'left'
      ? { right: under, width: `${around.left + px}px`, backgroundPosition: 'right top' }
      : { left: under, width: `${around.right + px}px`, backgroundPosition: 'left top' }),
    backgroundSize: `${px}px ${span}`,
    backgroundRepeat: 'repeat-x',
  };
}

/** The canopy's canvas over its box, which reaches a row above the lot's top edge. */
function CanopyCanvas({
  canvasRef,
  box,
  scale,
}: {
  canvasRef: { current: HTMLCanvasElement | null };
  box: ArtBox;
  scale: number;
}) {
  return (
    <canvas
      ref={canvasRef}
      class="canopy"
      aria-hidden="true"
      width={box.w}
      height={box.h}
      style={{
        left: `${box.x * scale}px`,
        top: `${box.y * scale}px`,
        width: `${box.w * scale}px`,
        height: `${box.h * scale}px`,
      }}
    />
  );
}

/** The water's own canvas: one frame of the shore animation at a time. */
function WaterCanvas({ plan, scale }: { plan: WaterPlan; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const still = settings.value.reduceMotion;
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    atlasImage()
      .then((img) => {
        const ctx = ref.current?.getContext('2d');
        if (cancelled || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        const { frames, ms } = sheetRect('shore');
        let shown = -1;
        const show = (frame: number) => {
          if (frame === shown) return;
          shown = frame;
          paintWater(ctx, img, plan, frame);
        };
        if (still || frames < 2 || ms <= 0) {
          show(0);
          return;
        }
        const tick = (now: number) => {
          show(Math.floor(now / ms) % frames);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [plan, still]);
  const box = plan.box!;
  const px = CELL * scale;
  return (
    <canvas
      ref={ref}
      class="water"
      width={box.w * CELL}
      height={box.h * CELL}
      style={{
        left: `${box.x * px}px`,
        top: `${box.y * px}px`,
        width: `${box.w * px}px`,
        height: `${box.h * px}px`,
      }}
    />
  );
}

/**
 * A set of cells drawn as one SVG region: a fill, and an outline around the region's edge.
 * The look comes from the class (board-m2.css). Fills the board; never takes the pointer.
 */
export function Outline({
  cells,
  scale,
  lot,
  class: cls,
}: {
  cells: readonly Cell[];
  scale: number;
  lot: Lot;
  class: string;
}) {
  const px = CELL * scale;
  const { fill, edge } = useMemo(() => cellsOutline(cells, px), [cells, px]);
  if (cells.length === 0) return null;
  return (
    <svg
      class={`cells-outline ${cls}`}
      width={lot.width * px}
      height={boardRows(lot.height) * px}
      aria-hidden="true"
    >
      <path class="fill" d={fill} />
      <path class="edge" d={edge} />
    </svg>
  );
}

/** The fenced yards (rules.fencedTiles), tinted under the pieces so players can see them. */
export function YardTint({ state, scale }: { state: RunState; scale: number }) {
  const { house } = state;
  const cells = useMemo(() => {
    const w = house.lot.width;
    return rules.fencedTiles(state).map((i) => ({ x: i % w, y: Math.floor(i / w) }));
  }, [house]); // The yards depend only on the house.
  return <Outline cells={cells} scale={scale} lot={house.lot} class="yard-tint" />;
}
