// The lot's ground (§12, Rendering; D-097), in a group of its own at LAYER.terrain:
// - The terrain canvas: (lot width × CELL) × (boardRows × CELL) art px (768×864 for a 24×24
//   lot): the lot, the street row, and the road below it (geometry.ts ROAD_ROWS). Smoothing
//   off, shown at that size × scale with image-rendering: pixelated. It redraws only when the
//   lot changes (building over a Tree replaces it, a Sapling grows into one): the grass, the
//   woods' floor, the sunny side, then what stands on the lot (terrain/objects.ts) on its own
//   cells, and the street (terrain/).
// - The water canvas, above it at LAYER.water: only over the water's bounding box, redrawn
//   when its animation changes frame, frozen under Reduce motion (and, since it runs on
//   requestAnimationFrame, while the tab is hidden).
// The group is a stacking context below everything else on the board, so the water stays
// under the pieces whatever their own z-index. Outside it, at LAYER.canopy, the canopy canvas
// holds what rises above its own cells (tree tops), over the pieces, redrawn with the
// terrain. No canvas takes the pointer.
// Over the group, under the pieces, a soft tint shows the house's fenced yards.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import { rules, type Cell, type Lot, type RunState } from '../../rules/index.ts';
import { settings } from '../settings.ts';
import { atlasImage, CELL } from '../sprites.ts';
import { boardRows, cellsOutline } from './geometry.ts';
import { sheetRect } from './terrain/atlas.ts';
import { paintGrass } from './terrain/grass.ts';
import { tileHash } from './terrain/hash.ts';
import {
  canopyBox,
  lotObjects,
  paintCanopy,
  paintObjects,
  type ArtBox,
  type Placed,
} from './terrain/objects.ts';
import { paintStreet, streetTiles } from './terrain/street.ts';
import { paintSunnyEdge, sunnyEdge } from './terrain/sunny.ts';
import { paintWater, waterPlan, type WaterPlan } from './terrain/water.ts';
import { paintWoodsFloor, woodsFloor } from './terrain/woods.ts';
import './terrain/terrain.css';

export { tileHash };

function draw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  lot: Lot,
  objects: readonly Placed[],
): void {
  ctx.imageSmoothingEnabled = false;
  paintGrass(ctx, img, lot);
  paintWoodsFloor(ctx, img, woodsFloor(lot));
  paintSunnyEdge(ctx, img, sunnyEdge(lot));
  paintObjects(ctx, img, objects);
  paintStreet(ctx, img, streetTiles(lot));
}

export function TerrainLayer({ lot, scale }: { lot: Lot; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const canopyRef = useRef<HTMLCanvasElement>(null);
  const objects = useMemo(() => lotObjects(lot), [lot]);
  const canopy = useMemo(() => canopyBox(objects), [objects]);
  useEffect(() => {
    let cancelled = false;
    atlasImage()
      .then((img) => {
        if (cancelled) return;
        const ctx = ref.current?.getContext('2d');
        if (ctx) draw(ctx, img, lot, objects);
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
  }, [lot, objects, canopy]);
  const water = useMemo(() => waterPlan(lot), [lot]);
  const rows = boardRows(lot.height);
  const px = CELL * scale;
  return (
    <>
      <div class="ground" aria-hidden="true">
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

/** The canopy's canvas over its box, which may reach above the lot's top edge. */
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
