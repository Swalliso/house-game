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
  // D-205: a lot's one wish is the Pond's where it has one (balance.lotWish): three Green pieces
  // beside it bring a Hot Tub to Your goods, once. Starting numbers.
  pond: {
    id: 'pond',
    name: 'Pond',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
    wish: { count: { tag: 'Green' }, need: 3, reward: { piece: 'hotTub' } },
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
  // D-174: a lake along a lakeside lot's back edge, running on past it. One body, like the pond:
  // a piece touching it touches the Lake once, and it's a view from its shore.
  lake: {
    id: 'lake',
    name: 'Lake',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
  },
  // A demolition clears one. Each Boulder is its own neighbor, like a Tree, with no tags and no
  // view (D-145): only the pieces that name it count it (a Lawn, a Flower Bed, the Fire Pit).
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
  },
  // Finds (Appendix B, M3b): each pays once.
  // The Old Shed (2×2) blocks building until it's demolished, which pays a random tool. While it
  // stands it's one neighbor, like the pond (D-145): the pieces that would use a shed name it
  // (the Greenhouse, a Herb Garden, the Henhouse), so keeping it competes with clearing it.
  // D-205: on a lot without a Pond it carries the lot's wish: two of the pieces that would use
  // it (not the Henhouse, its prize) bring a Henhouse to Your goods, once, if it's still standing.
  oldShed: {
    id: 'oldShed',
    name: 'Old Shed',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
    body: true,
    size: [2, 2],
    reward: { tool: 'random' },
    wish: {
      count: { piece: ['greenhouse', 'garage', 'herbGarden'] },
      need: 2,
      reward: { piece: 'henhouse' },
    },
  },
  // A Time Capsule doesn't block: the first piece built over it pays. It gives nothing as a
  // neighbor.
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
