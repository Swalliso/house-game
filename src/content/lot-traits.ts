// Lot traits (D-119, D-166): what a lot has that changes how you'd build there, as chips on the
// contract's card. A lot has a trait when it holds at least `min` tiles of the terrain, or was
// shaped to the kind, as the run begins, and keeps it all run. Each pays all run, like a crew,
// and tilts the draw toward the cards that use it, like a client's pool; it stays on the
// checklist.
//
// Most lots are shaped as they're drawn (balance.ts `lot.biomes`' kinds): Rocky, Open,
// Pondside, Lakefront and Old Woods come from that, Creekside from the creek, and Wooded from
// the woods as they grew.

import type { LotTraitDef, LotTraitId } from '../rules/index.ts';

export const LOT_TRAITS: Readonly<Record<LotTraitId, LotTraitDef>> = {
  // About one lot in four has a creek, and it pays: the house's bank is a decision. Water lots
  // deal Patios, a deck by the water (D-166). D-174: +100%, as the pond and the lake pay. At +50%
  // a creek lot was greedy's weakest (38.7% of 463 lots of hold-*, all lots 44.9%, on D-171's
  // targets), and a creek through the middle won 40.0%: what the creek takes from the lot cost
  // more than its bank paid back.
  creekside: {
    id: 'creekside',
    name: 'Creekside',
    blurb: 'Only a Driveway crosses it.',
    when: { terrain: 'creek', min: 1 },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'creek' } }, pct: 100 },
      { kind: 'drawWeight', target: { piece: 'patio' }, pct: 100 },
    ],
  },
  // D-166: a pond lot's pond is 14–20 tiles (a plain lot's 4–9). Its bank is short beside a
  // creek's, so it paid double the creek's +50%: at +50% it cost greedy wins on the lots it
  // shaped. D-174 pays the creek +100% too.
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
  // D-174: the batch (D-162–D-169) grew every other lot's houses more than an Open lot's, and
  // its re-fit left Open 21 points under the same lots (27% against 48.5%). Its tilt toward
  // Lawns and Herb Gardens cost 10 of them; the sun it promises pays the rest back: with the
  // tilt gone and Sunny pieces at +50%, 49.5%. The Count earns nothing from the sun.
  open: {
    id: 'open',
    name: 'Open',
    blurb: 'Few Trees, lots of sun.',
    when: { kind: 'open' },
    modifiers: [
      { kind: 'earn', target: { property: 'yard' }, pct: 100 },
      { kind: 'earn', target: { tag: 'Sunny' }, pct: 50 },
    ],
    suits: ['hendersons', 'barkers'],
  },
  // D-174: the lakeside's lake along the back edge. Its shore runs the lot's width, so the house
  // can string along it. It pays the pond's rate: forced onto every lot, greedy built 2.4 rooms
  // on the shore at +50% and 2.7 at +100%.
  lakefront: {
    id: 'lakefront',
    name: 'Lakefront',
    blurb: 'A lake, and views from its shore.',
    when: { kind: 'lake' },
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'lake' } }, pct: 100 },
      { kind: 'drawWeight', target: { piece: 'patio' }, pct: 100 },
    ],
  },
  // D-174: an autumn wood whose Trees all stay: the house fits between them, and placement says
  // why when a piece would go over one. It replaces Wooded, which is about clearing them. Greedy
  // on its 81 lots of hold-0 to hold-999 won 33% at +50%, 40% at +75% and 53% at +100% (develop
  // 46% on the same seeds); a roomier lot (75% free, not 65%) didn't help.
  oldWoods: {
    id: 'oldWoods',
    name: 'Old Woods',
    blurb: 'Its Trees stay: build around them.',
    when: { kind: 'oldWoods' },
    protects: ['tree'],
    modifiers: [
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 100 },
      { kind: 'drawWeight', target: { piece: ['treehouse', 'birdhouse'] }, pct: 100 },
    ],
    suits: ['vladislav'],
  },
};
