// The lot's ground (§12, Rendering; D-097), in a group of its own at LAYER.terrain:
// - The terrain canvas: (lot width × CELL) × ((lot height + 1) × CELL) art px (768×800 for a
//   24×24 lot), smoothing off, shown at that size × scale with image-rendering: pixelated. The
//   extra row is the street. It redraws only when the lot changes (building over a Tree
//   replaces it, a Sapling grows into one): the grass and the sunny side (terrain/), then the
//   woods, rocks, finds, and the street (still the placeholders; M5a stage 2's next part).
// - The water canvas, above it at LAYER.water: only over the water's bounding box, redrawn
//   when its animation changes frame, frozen under Reduce motion (and, since it runs on
//   requestAnimationFrame, while the tab is hidden).
// The group is a stacking context below everything else on the board, so the water stays
// under the pieces whatever their own z-index. Anything of the lot that must draw above the
// pieces (tree tops: LAYER.canopy) goes outside it. Neither canvas takes the pointer.
// Over the group, under the pieces, a soft tint shows the house's fenced yards.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import { rules, terrainAt, type Cell, type Lot, type RunState } from '../../rules/index.ts';
import { settings } from '../settings.ts';
import { atlasImage, CELL, spritePos, type SpriteId } from '../sprites.ts';
import { cellsOutline } from './geometry.ts';
import { sheetRect } from './terrain/atlas.ts';
import { paintGrass } from './terrain/grass.ts';
import { tileHash } from './terrain/hash.ts';
import { paintSunnyEdge, sunnyEdge } from './terrain/sunny.ts';
import { paintWater, waterPlan, type WaterPlan } from './terrain/water.ts';
import './terrain/terrain.css';

export { tileHash };

function draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lot: Lot): void {
  ctx.imageSmoothingEnabled = false;
  paintGrass(ctx, img, lot);
  paintSunnyEdge(ctx, img, sunnyEdge(lot));
  drawPlaceholders(ctx, img, lot);
}

/**
 * The woods, the boulders, the finds, and the street as they were before M5a: one placeholder
 * sprite per cell. M5a stage 2's next part replaces these with LimeZu's (and the canopy).
 */
function drawPlaceholders(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lot: Lot): void {
  const put = (id: SpriteId, x: number, y: number) => {
    const p = spritePos(id);
    ctx.drawImage(img, p.x, p.y, p.w, p.h, x * CELL, y * CELL, p.w, p.h);
  };
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      const t = terrainAt(lot, x, y);
      if (t === 'tree') put('tree', x, y);
      else if (t === 'boulder') put('boulder', x, y);
      else if (t === 'timeCapsule') put('capsule', x, y);
      else if (t === 'oldShed') {
        // The shed's quadrant, from which of its neighbors are shed too.
        const right = terrainAt(lot, x - 1, y) === 'oldShed';
        const bottom = terrainAt(lot, x, y - 1) === 'oldShed';
        put(bottom ? (right ? 'shed-3' : 'shed-2') : right ? 'shed-1' : 'shed-0', x, y);
      }
    }
  }
  for (let x = 0; x < lot.width; x++) put('street', x, lot.height);
}

export function TerrainLayer({ lot, scale }: { lot: Lot; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    atlasImage()
      .then((img) => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!cancelled && ctx) draw(ctx, img, lot);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [lot]);
  const water = useMemo(() => waterPlan(lot), [lot]);
  return (
    <div class="ground" aria-hidden="true">
      <canvas
        ref={ref}
        class="terrain"
        width={lot.width * CELL}
        height={(lot.height + 1) * CELL}
        style={{
          width: `${lot.width * CELL * scale}px`,
          height: `${(lot.height + 1) * CELL * scale}px`,
        }}
      />
      {water.box && <WaterCanvas plan={water} scale={scale} />}
    </div>
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
      height={(lot.height + 1) * px}
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
