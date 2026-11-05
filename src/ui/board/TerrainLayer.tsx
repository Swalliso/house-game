// The terrain: one canvas of (lot width × 16) × ((lot height + 1) × 16) pixels, smoothing off,
// shown at that size × scale with image-rendering: pixelated (§12, Rendering). The extra row
// is the street. It redraws only when the lot changes (building over a Tree replaces it).

import { useEffect, useRef } from 'preact/hooks';
import { isSunny, terrainAt, type Lot } from '../../rules/index.ts';
import { atlasImage, spritePos, TILE, type SpriteId } from '../sprites.ts';

/** A stable per-tile variation that isn't game randomness. */
function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lot: Lot): void {
  const put = (id: SpriteId, x: number, y: number) => {
    const p = spritePos(id);
    ctx.drawImage(img, p.x, p.y, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
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
      width={lot.width * TILE}
      height={(lot.height + 1) * TILE}
      style={{
        width: `${lot.width * TILE * scale}px`,
        height: `${(lot.height + 1) * TILE * scale}px`,
      }}
      aria-hidden="true"
    />
  );
}
