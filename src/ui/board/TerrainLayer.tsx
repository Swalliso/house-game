// The terrain: one canvas of (lot width × CELL) × ((lot height + 1) × CELL) art px (768×800
// for a 24×24 lot), smoothing off, shown at that size × scale with image-rendering: pixelated
// (§12, Rendering). The extra row is the street. It redraws only when the lot changes
// (building over a Tree replaces it). Over it, under the pieces, a soft tint shows the
// house's fenced yards.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import {
  isSunny,
  rules,
  terrainAt,
  type Cell,
  type Lot,
  type RunState,
} from '../../rules/index.ts';
import { atlasImage, CELL, spritePos, type SpriteId } from '../sprites.ts';
import { cellsOutline } from './geometry.ts';

/** A stable per-tile variation that isn't game randomness. */
function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lot: Lot): void {
  // Each sprite at its own size, from its cell's top-left corner: every terrain sprite is one
  // CELL × CELL cell for now.
  const put = (id: SpriteId, x: number, y: number) => {
    const p = spritePos(id);
    ctx.drawImage(img, p.x, p.y, p.w, p.h, x * CELL, y * CELL, p.w, p.h);
  };
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      const t = terrainAt(lot, x, y);
      const h = tileHash(x, y);
      if (t === 'pond' || t === 'creek') {
        put(h % 3 === 0 ? 'water-1' : 'water-0', x, y);
        continue;
      }
      const grass: SpriteId = isSunny(lot, x, y)
        ? 'grass-sunny'
        : (['grass-0', 'grass-1', 'grass-2'] as const)[h % 7 === 0 ? 2 : h % 3 === 0 ? 1 : 0]!;
      put(grass, x, y);
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
  return (
    <canvas
      ref={ref}
      class="terrain"
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
