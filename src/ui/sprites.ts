// The sprite atlas (D-057, D-095), built by scripts/build-atlas.ts from the art/ placeholders
// (doubled to 32×32) and the LimeZu cuts in assets/limezu/ (at their own sizes). atlas.json
// (version 2) gives each sprite's rect, { x, y, w, h }, at even positions and extruded by 1px.
// Pieces use it as a CSS background; the terrain canvas draws from it.

import atlasUrl from '../../assets/atlas.png';
import atlas from '../../assets/atlas.json';
import type { FixtureId, PieceId, Supply, ToolId } from '../rules/index.ts';

export type SpriteId = keyof typeof atlas.sprites;
/** The board's cell size in CSS px at scale 1 (until the switch to 32 px cells, D-095). */
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
  lFence: { floor: 'fence', furniture: 'none' },
  driveway: { floor: 'driveway', furniture: 'driveway' },
  longDriveway: { floor: 'driveway', furniture: 'driveway' },
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
  weekendCrew: '\u2692\uFE0E', // ⚒
};

export function supplyGlyph(s: Supply): string {
  return s.kind === 'fixture' ? FIXTURE_GLYPHS[s.id] : TOOL_GLYPHS[s.id];
}

/** A sprite's rect in the atlas (an animation's first frame). */
export function spritePos(id: SpriteId): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = atlas.sprites[id];
  return { x, y, w, h };
}

/**
 * CSS for a sprite drawn into one TILE × scale box, at a whole-number scale.
 *
 * M5a shim, until the board lays out 32 px cells (D-095): the atlas holds every sprite at 32 art
 * px per cell, the placeholders doubled, but the board still lays out 16 px cells. So the
 * sprite's whole rect is shrunk into the box (by TILE / w), and nearest-neighbor halving gives
 * back the placeholders' own pixels. Atlas positions are even, so every whole scale still lands
 * on whole CSS pixels. The 32 px switch replaces this with a plain `scale` per art pixel.
 */
export function spriteStyle(id: SpriteId, scale: number): Record<string, string> {
  const { x, y, w, h } = spritePos(id);
  const kx = (TILE * scale) / w;
  const ky = (TILE * scale) / h;
  return {
    backgroundImage: `url(${atlasUrl})`,
    backgroundPosition: `${-x * kx}px ${-y * ky}px`,
    backgroundSize: `${atlas.width * kx}px ${atlas.height * ky}px`,
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
