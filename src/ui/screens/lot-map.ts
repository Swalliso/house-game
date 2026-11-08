// The job board's lot map (M4, D-110): a contract's lot as one canvas pixel per tile, with the
// street a row below it, in LimeZu's colors (D-097), drawn at a whole number of UI pixels per
// tile (jobs.css's --map-px), so every tile lands on whole device pixels. Kept apart from
// JobBoard.tsx so lot-map.test.ts can hold its colors to the palette.

import { isSunny, terrainAt, type Lot, type TerrainId } from '../../rules/index.ts';

/** What a tile of the map shows: its terrain, else the sunny side or open ground; or the street. */
export type LotMapKind = TerrainId | 'ground' | 'sunny' | 'street';

/**
 * Each kind's color on the map: LimeZu's own (art/palette.ts), as the lot's art draws them.
 * Hex, not tokens: a canvas fills with colors, and these are art, not the interface's chrome.
 */
export const LOT_COLORS: Readonly<Record<LotMapKind, string>> = {
  /** The lawn, as the board's grass and --lawn. */
  ground: '#63a650',
  /** The sunny side: the lime of the brighter strip. */
  sunny: '#9bc246',
  tree: '#32675a',
  pond: '#4995e3',
  creek: '#50a7e8',
  boulder: '#989ebe',
  oldShed: '#7e6151',
  timeCapsule: '#b48f54',
  /** The street's row, under the lot: the road's grey. */
  street: '#8b8bab',
};

/** The map's size in tiles: the lot, and the street's row under it. */
export function lotMapSize(lot: Lot): { w: number; h: number } {
  return { w: lot.width, h: lot.height + 1 };
}

/** What tile (x, y) of the map shows: the lot's own rows, then the street's row under them. */
export function lotMapKind(lot: Lot, x: number, y: number): LotMapKind {
  if (y >= lot.height) return 'street';
  return terrainAt(lot, x, y) ?? (isSunny(lot, x, y) ? 'sunny' : 'ground');
}

/** "A pond, a creek, woods, and 2 boulders · sunny on the right". */
export function lotSummary(lot: Lot): string {
  const count = (id: TerrainId) => lot.terrain.filter((t) => t === id).length;
  const parts: string[] = [];
  if (count('pond') > 0) parts.push('a pond');
  if (count('creek') > 0) parts.push('a creek');
  const trees = count('tree');
  if (trees >= 12) parts.push('woods');
  else if (trees > 0) parts.push(trees === 1 ? 'a tree' : `${trees} trees`);
  const boulders = count('boulder');
  if (boulders > 0) parts.push(boulders === 1 ? 'a boulder' : `${boulders} boulders`);
  if (count('oldShed') > 0) parts.push('an old shed');
  const list =
    parts.length === 0
      ? 'Open ground'
      : parts.length <= 2
        ? parts.join(' and ')
        : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  const side = lot.sunnySide === 'top' ? 'at the back' : `on the ${lot.sunnySide}`;
  return `${list[0]!.toUpperCase()}${list.slice(1)} · sunny ${side}`;
}
