// Lot traits (D-119, D-166): what a lot has that changes how you'd build there, as chips on the
// contract's card. A lot has a trait when it holds at least `min` tiles of the terrain, or was
// shaped to the kind, as the run begins, and keeps it all run. Each pays all run, like a crew,
// and tilts the draw toward the cards that use it, like a client's pool; it stays on the
// checklist.
//
// Most lots are shaped as they're drawn (balance.ts `lot.kinds`): Rocky, Open and Pondside come
// from that, Creekside from the creek, and Wooded from the woods as they grew.

import type { LotTraitDef, LotTraitId } from '../rules/index.ts';

export const LOT_TRAITS: Readonly<Record<LotTraitId, LotTraitDef>> = {
  // About one lot in four has a creek, and it pays: the house's bank is a decision. Water lots
  // deal Patios, a deck by the water (D-166).
  creekside: {
    id: 'creekside',
    name: 'Creekside',
    blurb: 'Only a Driveway crosses it.',
    when: { terrain: 'creek', min: 1 },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'creek' } }, pct: 50 },
      { kind: 'drawWeight', target: { piece: 'patio' }, pct: 100 },
    ],
  },
  // D-166: a pond lot's pond is 14–20 tiles (a plain lot's 4–9). Its bank is short beside a
  // creek's, so it pays double: at +50% it cost greedy wins on the lots it shaped.
  pondside: {
    id: 'pondside',
    name: 'Pondside',
    blurb: 'A big pond, and views from its banks.',
    when: { kind: 'pond' },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'pond' } }, pct: 100 },
      { kind: 'drawWeight', target: { piece: 'patio' }, pct: 100 },
    ],
  },
  // About a fifth of lots, from the woods as they grew (the median lot has 86 Tree tiles; an Open
  // lot none of its woods). D-166 gives it teeth: Trees are everywhere on it, so it pays half
  // the creek's rate. The Count likes pieces by Trees.
  wooded: {
    id: 'wooded',
    name: 'Wooded',
    blurb: 'Building over a Tree clears it.',
    when: { terrain: 'tree', min: 100 },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 25 },
      { kind: 'drawWeight', target: { piece: ['treehouse', 'birdhouse'] }, pct: 100 },
    ],
    suits: ['vladislav'],
  },
  // D-166: 14–22 Boulders (a plain lot 6–10). Lawns, Flower Beds and the Fire Pit count them.
  rocky: {
    id: 'rocky',
    name: 'Rocky',
    blurb: 'A demolition clears a Boulder.',
    when: { kind: 'rocky' },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'boulder' } }, pct: 50 },
      { kind: 'drawWeight', target: { piece: ['flowerBed', 'firePit'] }, pct: 100 },
    ],
  },
  // D-166: only the lone Trees are left (6–10; a plain lot has 50 or more), so there's room and
  // sun for a yard, and yard pieces earn double: at +50% the Trees' loss outweighed it. The
  // Hendersons and the Barkers like Lawns.
  open: {
    id: 'open',
    name: 'Open',
    blurb: 'Few Trees, lots of sun.',
    when: { kind: 'open' },
    modifiers: [
      { kind: 'earn', target: { property: 'yard' }, pct: 100 },
      { kind: 'drawWeight', target: { piece: ['lawn', 'herbGarden'] }, pct: 100 },
    ],
    suits: ['hendersons', 'barkers'],
  },
};
