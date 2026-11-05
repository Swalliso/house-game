// Lot features (Appendix B, D-049). Generation numbers live in balance.ts.

import type { FeatureDef, FeatureId } from '../rules/index.ts';

export const FEATURES: Readonly<Record<FeatureId, FeatureDef>> = {
  // Along the bottom edge, outside the grid: one Loud neighbor for any piece touching it.
  street: { id: 'street', name: 'Street', tier: 'core', tags: ['Loud'], blocks: false },
  // Woods and lone Trees: each tile is its own neighbor, so effects that count them have a max.
  tree: {
    id: 'tree',
    name: 'Tree',
    tier: 'core',
    tags: ['Quiet', 'Green'],
    blocks: false,
    clear: 'buildOver',
    viewSource: true,
  },
  pond: {
    id: 'pond',
    name: 'Pond',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
  },
  creek: {
    id: 'creek',
    name: 'Creek',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
  },
  // Demolishing a boulder arrives with demolitions in M2.
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
    inert: true,
  },
};
