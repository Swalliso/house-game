// The sprite atlas (D-057): 16×16 sprites in 18×18 cells (1px extruded), built from art/ by
// scripts/build-atlas.ts. Pieces use it as a CSS background; the terrain canvas draws from it.
// Positions are whole multiples of the scale, so pixel art stays crisp.

import atlasUrl from '../../assets/atlas.png';
import atlas from '../../assets/atlas.json';
import type { FixtureId, PieceId, Supply, ToolId } from '../rules/index.ts';

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
  closet: { floor: 'floor-wood', furniture: 'wardrobe' },
  hallway: { floor: 'floor-hall', furniture: 'plant' },
  longHallway: { floor: 'floor-hall', furniture: 'plant' },
  garage: { floor: 'floor-garage', furniture: 'car' },
  homeOffice: { floor: 'floor-office', furniture: 'desk' },
  lawn: { floor: 'lawn', furniture: 'flowers' },
  sapling: { floor: 'grass-0', furniture: 'sapling' },
  // Where the floor is the whole picture, the furniture is the same sprite (it lands on a
  // whole cell, or the sprite repeats every 8px, so it shows no seam) or the empty 'none'.
  // Sprites don't rotate, so the fence is drawn as a panel that also reads stacked.
  flowerBed: { floor: 'flowerbed', furniture: 'flowerbed' },
  herbGarden: { floor: 'herbs', furniture: 'herbs' },
  patio: { floor: 'patio', furniture: 'parasol' },
  fence: { floor: 'fence', furniture: 'none' },
  driveway: { floor: 'driveway', furniture: 'driveway' },
  doghouse: { floor: 'grass-0', furniture: 'doghouse' },
  treehouse: { floor: 'canopy', furniture: 'treehouse' },
  greenhouse: { floor: 'greenhouse', furniture: 'greenhouse' },
  // Special pieces (M3a).
  playroom: { floor: 'floor-carpet', furniture: 'toys' },
  library: { floor: 'floor-parquet', furniture: 'books' },
  mudroom: { floor: 'floor-tile', furniture: 'boots' },
  pool: { floor: 'pool', furniture: 'pool' },
  sunroom: { floor: 'floor-sunroom', furniture: 'plant' },
  hotTub: { floor: 'patio', furniture: 'hottub' },
  firePit: { floor: 'grass-0', furniture: 'firepit' },
  henhouse: { floor: 'grass-0', furniture: 'henhouse' },
  birdhouse: { floor: 'grass-0', furniture: 'birdhouse' },
  // Members' rooms (M4b, D-103): placeholders from the rooms they're most like, until M5's art.
  nursery: { floor: 'floor-carpet', furniture: 'toys' },
  kidsRoom: { floor: 'floor-wood', furniture: 'toys' },
  grandmasRoom: { floor: 'floor-carpet', furniture: 'bed' },
  renfieldsRoom: { floor: 'floor-parquet', furniture: 'wardrobe' },
  nanasRoom: { floor: 'floor-carpet', furniture: 'bed' },
  rowansStudio: { floor: 'floor-sunroom', furniture: 'desk' },
  ivysRoom: { floor: 'floor-wood', furniture: 'books' },
};

/** A text glyph per fixture for its badge on the board and its card (placeholders, D-057). */
export const FIXTURE_GLYPHS: Record<FixtureId, string> = {
  fireplace: '\u2668\uFE0E', // ♨
  skylight: '\u2600\uFE0E', // ☀
  blackoutCurtains: '\u263E\uFE0E', // ☾
  soundproofing: '\u266B\uFE0E', // ♫
  kitchenIsland: '\u25AD', // ▭
  bunkBeds: '\u2261', // ≡
  bayWindow: '\u25EB', // ◫
  sprinkler: '\u2749', // ❉
  pergola: '\u2302', // ⌂
  gardenLights: '\u2726', // ✦
  chandelier: '\u2748', // ❈
};

/** A text glyph per tool, for its supply slot and its shop card. */
export const TOOL_GLYPHS: Record<ToolId, string> = {
  movingTruck: '\u21C4', // ⇄
  copyMachine: '\u2398', // ⎘
  rushOrder: '\u23F1\uFE0E', // ⏱
  openHouseParty: '\u266A\uFE0E', // ♪
  catalog: '\u2630', // ☰
  fertilizer: '\u2618\uFE0E', // ☘
  inspectorsVisit: '\u2611\uFE0E', // ☑
  dumpster: '\u2672', // ♲
  remodelJackAndJill: '\u2191', // ↑
  remodelEntertainer: '\u2191', // ↑
  remodelSuite: '\u2191', // ↑
  remodelFullHouse: '\u2191', // ↑
  weekendCrew: '\u2692\uFE0E', // ⚒
};

export function supplyGlyph(s: Supply): string {
  return s.kind === 'fixture' ? FIXTURE_GLYPHS[s.id] : TOOL_GLYPHS[s.id];
}

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
