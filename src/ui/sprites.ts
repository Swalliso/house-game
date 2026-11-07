// The sprite atlas (D-057, D-097), built by scripts/build-atlas.ts from the art/ placeholders
// (doubled to 32×32) and the LimeZu cuts in assets/limezu/ (at their own sizes). atlas.json
// (version 2) gives each sprite's rect, { x, y, w, h }, at even positions and extruded by 1px.
// Pieces use it as a CSS background; the terrain canvas draws from it.
//
// Sizes are in art px. A board `scale` is CSS px per art px, so one cell is CELL × scale CSS
// px. Sprites come in any size: a cell's floor is CELL × CELL, and furniture may be smaller or
// taller.

import atlasUrl from '../../assets/atlas.png';
import atlas from '../../assets/atlas.json';
import type { FixtureId, PieceId, Supply, ToolId } from '../rules/index.ts';
import type { IconName } from './theme/art.ts';

export type SpriteId = keyof typeof atlas.sprites;

/** Art px per game cell: a 2×2 block of LimeZu's 16 px tiles (D-097). */
export const CELL = 32;

/**
 * One sixteenth of a cell, in CSS px, for a cell of `px` CSS px: one pixel of the old 16 px
 * art. Text, badges, offsets, and the placeholder walls are sized in these, so they keep the
 * size they had at 2× with 16 px cells (1× now) and grow with the zoom the same way.
 */
export function cellUnit(px: number): number {
  return px / 16;
}

export const ATLAS_URL: string = atlasUrl;

/**
 * Each piece's floor and its one key furniture sprite: the piece's icon (the hand cards, the
 * coming pile). Every room type has its own floor (D-093); the two kitchens share one, as do
 * the two halls. The board's richer art (wall faces, furniture layouts) is in src/ui/art/.
 */
export const PIECE_SPRITES: Record<PieceId, { floor: SpriteId; furniture: SpriteId }> = {
  bedroom: { floor: 'floor-wood', furniture: 'bed' },
  bathroom: { floor: 'floor-tile', furniture: 'tub' },
  kitchen: { floor: 'floor-kitchen', furniture: 'stove' },
  lKitchen: { floor: 'floor-kitchen', furniture: 'stove' },
  diningRoom: { floor: 'floor-parquet', furniture: 'table' },
  livingRoom: { floor: 'floor-carpet', furniture: 'sofa' },
  closet: { floor: 'floor-closet', furniture: 'wardrobe' },
  hallway: { floor: 'floor-hall', furniture: 'plant' },
  longHallway: { floor: 'floor-hall', furniture: 'plant' },
  garage: { floor: 'floor-garage', furniture: 'car' },
  homeOffice: { floor: 'floor-office', furniture: 'desk' },
  lawn: { floor: 'lawn', furniture: 'flowers' },
  sapling: { floor: 'grass-0', furniture: 'sapling' },
  // Where the floor is the whole picture, the furniture is the same sprite (it lands on a
  // whole cell, or the sprite repeats every half cell, so it shows no seam) or the empty 'none'.
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
  playroom: { floor: 'floor-playroom', furniture: 'toys' },
  library: { floor: 'floor-library', furniture: 'books' },
  mudroom: { floor: 'floor-mudroom', furniture: 'boots' },
  pool: { floor: 'pool', furniture: 'pool' },
  sunroom: { floor: 'floor-sunroom', furniture: 'plant' },
  hotTub: { floor: 'patio', furniture: 'hottub' },
  firePit: { floor: 'grass-0', furniture: 'firepit' },
  henhouse: { floor: 'grass-0', furniture: 'henhouse' },
  birdhouse: { floor: 'grass-0', furniture: 'birdhouse' },
};

/**
 * Each fixture's icon (theme/icons.ts): its badge on the board where it can't be drawn, its
 * supply slot, and the shop's art slot where it has no art on the board (hud/PieceArt.tsx).
 */
export const FIXTURE_ICONS: Record<FixtureId, IconName> = {
  fireplace: 'fireplace',
  skylight: 'skylight',
  blackoutCurtains: 'blackoutCurtains',
  soundproofing: 'soundproofing',
  kitchenIsland: 'kitchenIsland',
  bunkBeds: 'bunkBeds',
  bayWindow: 'bayWindow',
  sprinkler: 'sprinkler',
  pergola: 'pergola',
  gardenLights: 'gardenLights',
  chandelier: 'chandelier',
};

/** Each tool's icon (theme/icons.ts), for its supply slot and its art slot in the shop. */
export const TOOL_ICONS: Record<ToolId, IconName> = {
  movingTruck: 'movingTruck',
  copyMachine: 'copyMachine',
  rushOrder: 'rushOrder',
  openHouseParty: 'openHouseParty',
  catalog: 'catalog',
  fertilizer: 'fertilizer',
  inspectorsVisit: 'inspectorsVisit',
  dumpster: 'dumpster',
  remodelJackAndJill: 'remodel',
  remodelEntertainer: 'remodel',
  weekendCrew: 'weekendCrew',
};

export function supplyIcon(s: Supply): IconName {
  return s.kind === 'fixture' ? FIXTURE_ICONS[s.id] : TOOL_ICONS[s.id];
}

/** A sprite's rect in the atlas (an animation's first frame). */
export function spritePos(id: SpriteId): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = atlas.sprites[id];
  return { x, y, w, h };
}

/** An animated sprite's frames: how many, frame k's x offset (k × stride), and each frame's ms. */
export function spriteFrames(id: SpriteId): { frames: number; stride: number; ms: number } | null {
  const s = atlas.sprites[id];
  return 'frames' in s && 'stride' in s && 'ms' in s
    ? { frames: s.frames, stride: s.stride, ms: s.ms }
    : null;
}

/**
 * CSS for a sprite as a background at `scale` CSS px per art px. The element's box is the
 * caller's: w × scale by h × scale shows the whole sprite (a cell-sized sprite fills a cell).
 * Atlas positions are even, so a scale in half CSS px (0.5× steps on a Retina screen) still
 * lands on whole CSS px; Fit's fractional scale relies on the 1px extrusion instead.
 */
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
/** The atlas once it has loaded: from then on the lot's canvases paint before the browser does. */
let loaded: HTMLImageElement | null = null;

/** The atlas as an image, for drawing terrain into a canvas. */
export function atlasImage(): Promise<HTMLImageElement> {
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        loaded = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('The sprite atlas failed to load'));
      img.src = atlasUrl;
    });
  }
  return image;
}

/**
 * Paints with the atlas image: at once when it has loaded, so a canvas changes in the same frame
 * as the DOM around it (a cleared tree's crown goes with the piece built over it); only the very
 * first paint waits for it. Returns a canceller for a paint that's still waiting.
 */
export function withAtlasImage(paint: (img: HTMLImageElement) => void): () => void {
  if (loaded) {
    paint(loaded);
    return () => {};
  }
  let cancelled = false;
  atlasImage()
    .then((img) => {
      if (!cancelled) paint(img);
    })
    .catch((e) => console.error(e));
  return () => {
    cancelled = true;
  };
}
