// A lot's look by its biome (D-174). The autumn woods and a dry lot draw their own cuts of the
// terrain's sprites (art/limezu/biomes.json: LimeZu's autumn and olive colorways of our trees,
// muted alike, and the grass to match), and the garden around the lot in the same colors
// (terrain.css). The lakeside looks like the meadow. A sprite with no cut in a look (the
// street, a lily, the Old Shed) draws as it is.

import { lotBiome, type BiomeId, type Lot } from '../../../rules/index.ts';
import { hasSprite, type SpriteId } from '../../sprites.ts';

export type Look = 'meadow' | 'autumn' | 'dry';

export function biomeLook(biome: BiomeId): Look {
  return biome === 'autumn' || biome === 'dry' ? biome : 'meadow';
}

export function lotLook(lot: Lot): Look {
  return biomeLook(lotBiome(lot));
}

/** The sprite in a look: its `-autumn` or `-dry` cut where there is one. */
export function inLook(id: SpriteId, look: Look): SpriteId {
  if (look === 'meadow') return id;
  const cut = `${id}-${look}`;
  return hasSprite(cut) ? cut : id;
}
