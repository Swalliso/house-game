// The neighbor's ask on the board (D-206), the part that decides, kept pure so tests can check
// it: which of the street's walkers asks (by the run's seed), where they stand (just past the
// lot's edge on their side, in the gap before the house beside it, near the street, facing the
// lot), where their bubble points, the strip's cells and the bubble's count.
// NeighborAskLayer.tsx draws it. Which side, and how many tiles stand there, are the rules'
// (rules.neighbor); none of this reads the company's record (D-016, D-156).

import type { Cell, Lot, NeighborSide } from '../../rules/index.ts';
import { CELL, type SpriteId } from '../sprites.ts';
import { WALKERS } from './crowd.ts';
import { STREET } from './neighbors.ts';
import { seedSalt } from './terrain/hash.ts';

/** A point on the board in art px, from the lot's top-left corner (negative: left of it). */
export interface ArtPoint {
  readonly x: number;
  readonly y: number;
}

/** One of the street's four walkers (D-155), by the run's seed: the neighbor who asks. */
export function neighborFigure(seed: string): SpriteId {
  return WALKERS[seedSalt(`${seed}/neighbor`) % WALKERS.length]!;
}

/** How far up from the street their feet are, in art px: half a cell, beside the front row. */
export const FEET_UP = CELL / 2;

/**
 * Where the neighbor stands: the middle of their feet, in the gap between the lot and the house
 * beside it (STREET.beside), `FEET_UP` up from the street. The walkers are cut facing east, so
 * the right side's is mirrored to face the lot.
 */
export function neighborFeet(lot: Pick<Lot, 'width' | 'height'>, side: NeighborSide): ArtPoint {
  const x = side === 'left' ? -STREET.beside / 2 : lot.width * CELL + STREET.beside / 2;
  return { x, y: lot.height * CELL - FEET_UP };
}

/** A walker's frame from its feet: 16 art px wide, its head 26 px up its 32 px frame. */
const HEAD_PX = 26;

/** A pixel over their head: where their count's bubble and a heart's tail point. */
export function overHead(feet: ArtPoint): ArtPoint {
  return { x: feet.x, y: feet.y - HEAD_PX - 1 };
}

/** The strip's tiles (rules.neighbor's `strip`, by index) as cells, for the board's tint. */
export function stripCells(strip: readonly number[], width: number): Cell[] {
  return strip.map((i) => ({ x: i % width, y: Math.floor(i / width) }));
}

/**
 * The bubble's count: the tiles there, at most the ask's ("5/5" once met, however many more
 * stand there), and how a play being looked at changes it. No words (the story's), so a count.
 */
export function askCount(
  have: number,
  tiles: number,
  before: number = have,
): { text: string; met: boolean; change: 'up' | 'down' | null } {
  const shown = Math.min(have, tiles);
  const was = Math.min(before, tiles);
  return {
    text: `${shown}/${tiles}`,
    met: have >= tiles,
    change: shown > was ? 'up' : shown < was ? 'down' : null,
  };
}
