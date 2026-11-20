// The lot's grass (D-097): LimeZu's grass, muted so the pieces stand out, with light tufts and
// tiny flowers. The sunny band's warmer grass went with the band (D-120): the sun shines on the
// whole lot, and shade.ts darkens the tiles a Tree shades. D-190: the lot's ground is laid by
// ground.ts now (the grass in patches, the scatter in drifts); the title screen's lawn still
// strews its grass evenly, by grassSprite.

import type { SpriteId } from '../../sprites.ts';
import { tileHash } from './hash.ts';

/** About one subtile of the title screen's lawn in this many gets a tuft… */
export const TUFT_EVERY = 11;
/** …and one in this many of the others a few tiny flowers. */
export const WILDFLOWERS_EVERY = 23;

const TUFTS = ['tuft-0', 'tuft-1'] as const satisfies readonly SpriteId[];
const WILDFLOWERS = [
  'wildflowers-0',
  'wildflowers-1',
  'wildflowers-2',
  'wildflowers-3',
  'wildflowers-4',
] as const satisfies readonly SpriteId[];

/** A 16 px sprite on one subtile: (sx, sy) on the subtile grid, SUB × SUB per cell. */
export interface SubtileSprite {
  readonly sx: number;
  readonly sy: number;
  readonly id: SpriteId;
}

/** The tuft or the flowers on subtile (sx, sy) of the title screen's lawn, if any, by tile hash. */
export function grassSprite(sx: number, sy: number, salt = 0): SpriteId | null {
  const h = tileHash(sx, sy, salt);
  if (h % TUFT_EVERY === 0) return TUFTS[(h >>> 4) & 1]!;
  if (h % WILDFLOWERS_EVERY === 0) return WILDFLOWERS[(h >>> 5) % WILDFLOWERS.length]!;
  return null;
}
