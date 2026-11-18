// The job board's lot map (M4, D-110): a contract's lot as one canvas pixel per tile, with the
// street a row below it, in LimeZu's colors (D-097), drawn at a whole number of UI pixels per
// tile (jobs.css's --map-px), so every tile lands on whole device pixels. Kept apart from
// JobBoard.tsx so lot-map.test.ts can hold its colors to the palette.

import { sunSideText, terrainAt, type Lot, type TerrainId } from '../../rules/index.ts';
import { lotLook, type Look } from '../board/terrain/biome.ts';

/** What a tile of the map shows: its terrain, else open ground; or the street. */
export type LotMapKind = TerrainId | 'ground' | 'street';

/**
 * Each kind's color on the map: LimeZu's own (art/palette.ts), as the lot's art draws them.
 * Hex, not tokens: a canvas fills with colors, and these are art, not the interface's chrome.
 */
export const LOT_COLORS: Readonly<Record<LotMapKind, string>> = {
  /** The lawn, as the board's grass and --lawn. */
  ground: '#63a650',
  tree: '#32675a',
  pond: '#4995e3',
  creek: '#50a7e8',
  /** D-174: the lake, a deeper blue than the pond. */
  lake: '#4280dd',
  boulder: '#989ebe',
  oldShed: '#7e6151',
  timeCapsule: '#b48f54',
  /** The street's row, under the lot: the road's grey. */
  street: '#8b8bab',
};

/**
 * A biome's own grass and trees on the map (D-174), as its board draws them; the rest as
 * LOT_COLORS. Also LimeZu's.
 */
export const LOOK_COLORS: Readonly<Record<Look, Readonly<Partial<Record<LotMapKind, string>>>>> = {
  meadow: {},
  autumn: { ground: '#8d9580', tree: '#b35e3f' },
  dry: { ground: '#c8c27e', tree: '#b29638' },
};

/** Tile (x, y)'s color on the map, in the lot's look. */
export function lotMapColor(lot: Lot, x: number, y: number): string {
  const kind = lotMapKind(lot, x, y);
  return LOOK_COLORS[lotLook(lot)][kind] ?? LOT_COLORS[kind];
}

/** The map's size in tiles: the lot, and the street's row under it. */
export function lotMapSize(lot: Lot): { w: number; h: number } {
  return { w: lot.width, h: lot.height + 1 };
}

/** What tile (x, y) of the map shows: the lot's own rows, then the street's row under them. */
export function lotMapKind(lot: Lot, x: number, y: number): LotMapKind {
  if (y >= lot.height) return 'street';
  return terrainAt(lot, x, y) ?? 'ground';
}

/** "A pond, a creek, woods, and 2 boulders · sun from the right" (D-120). */
export function lotSummary(lot: Lot): string {
  const count = (id: TerrainId) => lot.terrain.filter((t) => t === id).length;
  const parts: string[] = [];
  if (count('lake') > 0) parts.push('a lake');
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
  return `${list[0]!.toUpperCase()}${list.slice(1)} · sun from the ${sunSideText(lot.sun)}`;
}
