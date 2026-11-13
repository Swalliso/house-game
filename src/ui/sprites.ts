// The sprite atlas (D-057, D-097), built by scripts/build-atlas.ts from the LimeZu cuts in
// assets/limezu/ (at their own sizes), and any art/ placeholder no cut covers (doubled to 32×32;
// today there are none). atlas.json (version 2) gives each sprite's rect, { x, y, w, h }, at even
// positions and extruded by 1px. Furniture and props use it as a CSS background; the canvases
// draw from it. The rooms' floors and wallpapers are in art/house-paint.ts (FLOOR, FACE).
//
// Sizes are in art px. A board `scale` is CSS px per art px, so one cell is CELL × scale CSS
// px. Sprites come in any size: a cell's floor is CELL × CELL, and furniture may be smaller or
// taller.

import atlasUrl from '../../assets/atlas.png';
import atlas from '../../assets/atlas.json';
import type { BlueprintId, CrewId, FixtureId, LotTraitId, Supply, ToolId } from '../rules/index.ts';
import type { IconName } from './theme/art.ts';

export type SpriteId = keyof typeof atlas.sprites;

/** Whether the atlas has a sprite by this id (D-174's biome cuts are looked up by name). */
export function hasSprite(id: string): id is SpriteId {
  return Object.hasOwn(atlas.sprites, id);
}

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
  remodelSuite: 'remodel',
  remodelFullHouse: 'remodel',
  weekendCrew: 'weekendCrew',
};

/**
 * Each blueprint's icon (theme/icons.ts, D-141): its art slot in the shop and in a crate, its
 * slot in your goods, and its heading in the inspect panel. One each, so a shelf of blueprints
 * can be told apart at a glance; a blueprint without one fails typecheck.
 */
export const BLUEPRINT_ICONS: Record<BlueprintId, IconName> = {
  fengShui: 'fengShui',
  curbAppeal: 'curbAppeal',
  quietHours: 'quietHours',
  greenThumb: 'greenThumb',
  partyHouse: 'partyHouse',
  waterfront: 'waterfront',
  openConcept: 'openConcept',
  goodBones: 'goodBones',
  itsAHouse: 'itsAHouse',
  countryLiving: 'countryLiving',
  moodLighting: 'moodLighting',
  showHome: 'showHome',
  solarPanels: 'solarPanels',
  crownJewel: 'crownJewel',
  dreamHome: 'dreamHome',
  lastMinutePush: 'lastMinutePush',
  modelHome: 'modelHome',
  aheadOfSchedule: 'aheadOfSchedule',
};

export function supplyIcon(s: Supply): IconName {
  return s.kind === 'fixture' ? FIXTURE_ICONS[s.id] : TOOL_ICONS[s.id];
}

/**
 * Each crew's icon (theme/icons.ts, D-111), 8×8: its chip with the client's checklist and in the
 * menu, and its card's picture on the crew pick, at 4 UI px per art px. The General Contractor
 * wears the crew's hard hat, as the Weekend Crew and the company upgrades do; the hammer is
 * Demolish's. The Landscaper's spade stands for every yard piece; the leaf is the Green tag's,
 * which most yard pieces don't carry, and the sack is the Fertilizer's.
 */
export const CREW_ICONS: Record<CrewId, IconName> = {
  generalContractor: 'weekendCrew',
  landscaper: 'landscaper',
  architect: 'architect',
};

/**
 * Each lot trait's icon (D-119), on its chip on the contract's card and beside the crew's on the
 * checklist: the Wet tag's drop for the creek, the Green tag's leaf for the woods, and (D-166) a
 * pond, a Boulder, and a meadow for an Open lot (not the sun: the lot's sun chip sits beside it).
 * D-174: the pond's for the lake, and the leaf for Old Woods, which never sits beside Wooded.
 */
export const LOT_TRAIT_ICONS: Record<LotTraitId, IconName> = {
  creekside: 'Wet',
  pondside: 'pond',
  wooded: 'Green',
  rocky: 'boulder',
  open: 'meadow',
  lakefront: 'pond',
  oldWoods: 'Green',
};

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
