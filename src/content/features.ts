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
  // Finds (Appendix B, M3b): each pays once. They give nothing as neighbors.
  // The Old Shed (2×2) blocks building until it's demolished, which pays a random tool.
  oldShed: {
    id: 'oldShed',
    name: 'Old Shed',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
    inert: true,
    size: [2, 2],
    reward: { tool: 'random' },
  },
  // A Time Capsule doesn't block: the first piece built over it pays.
  timeCapsule: {
    id: 'timeCapsule',
    name: 'Time Capsule',
    tier: 'core',
    tags: [],
    blocks: false,
    clear: 'buildOver',
    inert: true,
    reward: { budget: 3 },
  },
};
