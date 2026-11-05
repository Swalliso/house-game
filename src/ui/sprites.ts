// The sprite atlas (D-057): 16×16 sprites in 18×18 cells (1px extruded), built from art/ by
// scripts/build-atlas.ts. Pieces use it as a CSS background; the terrain canvas draws from it.
// Positions are whole multiples of the scale, so pixel art stays crisp.

import atlasUrl from '../../assets/atlas.png';
import atlas from '../../assets/atlas.json';
import type { PieceId } from '../rules/index.ts';

export type SpriteId = keyof typeof atlas.sprites;
export const TILE = 16;

export const ATLAS_URL: string = atlasUrl;

/** Each piece's floor and its one key furniture sprite (the cutaway look, §12 Art). */
export const PIECE_SPRITES: Record<PieceId, { floor: SpriteId; furniture: SpriteId }> = {
  bedroom: { floor: 'floor-wood', furniture: 'bed' },
  bathroom: { floor: 'floor-tile', furniture: 'tub' },
  kitchen: { floor: 'floor-kitchen', furniture: 'stove' },
  lKitchen: { floor: 'floor-kitchen', furniture: 'stove' },
  diningRoom: { floor: 'floor-parquet', furniture: 'table' },
  livingRoom: { floor: 'floor-carpet', furniture: 'sofa' },
  lawn: { floor: 'lawn', furniture: 'flowers' },
};

export function spritePos(id: SpriteId): { x: number; y: number } {
  return atlas.sprites[id];
}

/** CSS for a sprite at a whole-number scale. */
export function spriteStyle(id: SpriteId, scale: number): Record<string, string> {
  const { x, y } = spritePos(id);
  return {
    backgroundImage: `url(${atlasUrl})`,
    backgroundPosition: `${-x * scale}px ${-y * scale}px`,
    backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

let image: Promise<HTMLImageElement> | null = null;

/** The atlas as an image, for drawing terrain into a canvas. */
export function atlasImage(): Promise<HTMLImageElement> {
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The sprite atlas failed to load'));
      img.src = atlasUrl;
    });
  }
  return image;
}
