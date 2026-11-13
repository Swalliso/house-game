// D-166, the lot decides: five lot traits, each a chip with a short blurb, a payoff that lasts
// the run, and a tilt to the draw toward the cards that use it.

import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  createRules,
  lotTraits,
  type Lot,
  type LotTraitId,
  type PieceId,
  type RunState,
} from '../rules/index.ts';
import { drawWeights } from '../rules/draw.ts';
import { lotFromRows } from '../rules/lot.ts';
import { runModifiers } from '../rules/modifiers.ts';
import { houseFrom } from '../rules/testing.ts';

const R = createRules(CONTENT);
/** Juniper: no taste for a yard piece or for anything by the lot's features, and no pool. */
const start = () =>
  R.newRun({ seed: 'lot-traits', clientId: 'juniper', crewId: 'generalContractor', mode: 'standard' });

describe('lot traits (D-166)', () => {
  it('each pays all run, tilts the draw, and says so in eight words or fewer', () => {
    const ids = Object.keys(CONTENT.lotTraits);
    expect(ids).toEqual(['creekside', 'pondside', 'wooded', 'rocky', 'open']);
    for (const def of Object.values(CONTENT.lotTraits)) {
      expect(
        def.modifiers.some((m) => m.kind === 'earn'),
        def.id,
      ).toBe(true);
      const tilt = def.modifiers.find((m) => m.kind === 'drawWeight');
      expect(tilt, def.id).toBeDefined();
      expect(def.blurb.split(/\s+/).length, def.id).toBeLessThanOrEqual(8);
    }
  });

  it('a lot’s trait deals its cards twice as often, from its own modifiers', () => {
    const tilted: Record<LotTraitId, PieceId[]> = {
      creekside: ['patio'],
      pondside: ['patio'],
      wooded: ['treehouse', 'birdhouse'],
      rocky: ['flowerBed', 'firePit'],
      open: ['lawn', 'herbGarden'],
    };
    for (const [id, pieces] of Object.entries(tilted) as [LotTraitId, PieceId[]][]) {
      const s: RunState = { ...start(), house: { ...start().house, lot: { ...start().house.lot, traits: [id] } } };
      const all = runModifiers(CONTENT, s);
      expect(all.filter((a) => a.source.kind === 'lot').map((a) => a.source)).toContainEqual({
        kind: 'lot',
        id,
      });
      const weight = (lotToo: boolean, piece: PieceId) =>
        drawWeights(CONTENT, 4, {
          mods: all.filter((a) => lotToo || a.source.kind !== 'lot').map((a) => a.mod),
        }).find((w) => w.card.id === piece)?.weight ?? 0;
      for (const piece of pieces) {
        expect(weight(false, piece), `${id} ${piece}`).toBeGreaterThan(0);
        expect(weight(true, piece), `${id} ${piece}`).toBe(2 * weight(false, piece));
      }
      // Nothing else moves.
      expect(weight(true, 'bedroom')).toBe(weight(false, 'bedroom'));
    }
  });

  /** A tally on a 6 × 6 lot from rows, shaped to `kind` or keeping `traits`. */
  const tally = (
    rows: readonly string[],
    placements: [PieceId, number, number][],
    lot: Partial<Lot>,
  ) => {
    const house = houseFrom(CONTENT, rows, placements);
    const s: RunState = { ...start(), house: { ...house, lot: { ...house.lot, ...lot } } };
    return R.currentTally(s).pieces;
  };
  const LOT = ['......', '......', '......', '......', '......', '......'];
  const withAt = (ch: string, x: number, y: number) =>
    LOT.map((r, j) => (j === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

  it('Rocky: pieces touching a Boulder earn +50%', () => {
    // Two Bedrooms, each 3 + 1 for the other (Quiet). The top one touches the Boulder at (2, 1).
    const [top, below] = tally(withAt('B', 2, 1), [['bedroom', 0, 0], ['bedroom', 0, 2]], {
      kind: 'rocky',
    });
    expect(top).toMatchObject({ points: 4, pct: 50, earned: 6 });
    expect(top!.lines.filter((l) => l.op === 'pct')).toEqual([
      { label: 'Rocky', op: 'pct', value: 50, from: [] },
    ]);
    expect(below).toMatchObject({ points: 4, pct: 0, earned: 4 });
    // The same lot, not shaped: no trait.
    expect(tally(withAt('B', 2, 1), [['bedroom', 0, 0]], {})[0]).toMatchObject({ pct: 0 });
  });

  it('Pondside: pieces touching the pond earn double', () => {
    const [top, below] = tally(withAt('P', 2, 1), [['bedroom', 0, 0], ['bedroom', 0, 2]], {
      kind: 'pond',
    });
    expect(top).toMatchObject({ points: 4, pct: 100, earned: 8 });
    expect(below).toMatchObject({ points: 4, pct: 0, earned: 4 });
  });

  it('Wooded: pieces touching a Tree earn +25%, kept all run', () => {
    // The Bedroom: 3, +1 for the Tree. The lot keeps Wooded with one Tree left (its traits).
    const [bed] = tally(withAt('T', 2, 1), [['bedroom', 0, 0]], { traits: ['wooded'] });
    expect(bed).toMatchObject({ points: 4, pct: 25, earned: 5 });
  });

  it('Open: yard pieces earn double, and rooms don’t', () => {
    // Two Lawns touching: 1 + 1 each, in front of the Bedroom.
    const [bed, a, b] = tally(LOT, [['bedroom', 0, 0], ['lawn', 2, 4], ['lawn', 3, 4]], {
      kind: 'open',
    });
    expect(bed).toMatchObject({ pct: 0 });
    expect(a).toMatchObject({ points: 2, pct: 100, earned: 4 });
    expect(b).toMatchObject({ points: 2, pct: 100, earned: 4 });
  });

  it('a test’s lot from rows has no shaped trait, however bare', () => {
    expect(lotTraits(CONTENT, lotFromRows(LOT))).toEqual([]);
  });
});
