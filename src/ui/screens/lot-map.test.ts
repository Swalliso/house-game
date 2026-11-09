// The job board's lot map (M4, D-110): LimeZu's colors (D-097), one for every kind of tile, each
// its own; the lot tile by tile with the street a row below it; and the summary in words that
// the map's title and screen readers give.

import { describe, expect, it } from 'vitest';
import { CONTENT, rules, type Lot, type TerrainId } from '../../rules/index.ts';
import { isLimeZuColor } from '../art/palette.ts';
import { LOT_COLORS, lotMapKind, lotMapSize, lotSummary, type LotMapKind } from './lot-map.ts';

/** A hand-built lot, a character a tile: . open, T tree, P pond, C creek, B boulder, S old shed. */
function lot(rows: readonly string[], sunnySide: Lot['sunnySide'] = 'left'): Lot {
  const key: Record<string, TerrainId | null> = {
    '.': null,
    T: 'tree',
    P: 'pond',
    C: 'creek',
    B: 'boulder',
    S: 'oldShed',
  };
  return {
    width: rows[0]!.length,
    height: rows.length,
    terrain: rows.flatMap((r) => [...r].map((ch) => key[ch]!)),
    sunnySide,
    sunnyRows: 1,
    attempt: 0,
  };
}

describe("the job board's lot map", () => {
  it("draws only in LimeZu's palette", () => {
    for (const [kind, hex] of Object.entries(LOT_COLORS)) {
      expect(isLimeZuColor(hex), `${kind} ${hex}`).toBe(true);
    }
  });

  it('has a color for every terrain, the sunny side, open ground, and the street', () => {
    const terrain = Object.keys(CONTENT.features).filter((id) => id !== 'street');
    for (const kind of [...terrain, 'ground', 'sunny', 'street']) {
      expect(LOT_COLORS, kind).toHaveProperty(kind);
    }
  });

  it('gives each kind of tile its own color', () => {
    const colors = Object.values(LOT_COLORS).map((c) => c.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("maps a contract's lot tile by tile, the street a row below it", () => {
    for (const clientId of ['hendersons', 'vladislav', 'dale'] as const) {
      const l = rules.newRun({
        seed: `lot-map-${clientId}`,
        clientId,
        crewId: 'generalContractor',
        mode: 'standard',
      }).house.lot;
      const { w, h } = lotMapSize(l);
      expect([w, h]).toEqual([l.width, l.height + 1]);
      const seen = new Set<LotMapKind>();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const kind = lotMapKind(l, x, y);
          seen.add(kind);
          if (y === l.height) expect(kind).toBe('street');
          else expect(kind).not.toBe('street');
          const t = y < l.height ? l.terrain[y * l.width + x] : null;
          if (t) expect(kind).toBe(t);
        }
      }
      // Every lot has open ground and a sunny side.
      expect(seen).toContain('ground');
      expect(seen).toContain('sunny');
    }
  });

  it('shows the sunny side along its edge, but never under a tree', () => {
    const l = lot(['T...', '....', '....'], 'left');
    expect(lotMapKind(l, 0, 0)).toBe('tree');
    expect(lotMapKind(l, 0, 1)).toBe('sunny');
    expect(lotMapKind(l, 1, 1)).toBe('ground');
    const top = lot(['....', '....'], 'top');
    expect(lotMapKind(top, 3, 0)).toBe('sunny');
    expect(lotMapKind(top, 3, 1)).toBe('ground');
  });

  it('sums the lot up in words', () => {
    expect(lotSummary(lot(['....', '....']))).toBe('Open ground · sunny on the left');
    expect(lotSummary(lot(['..T.', 'TT..'], 'right'))).toBe('3 trees · sunny on the right');
    expect(lotSummary(lot(['P...', '..T.'], 'right'))).toBe(
      'A pond and a tree · sunny on the right',
    );
    expect(lotSummary(lot(['PC..', 'BB.S'], 'top'))).toBe(
      'A pond, a creek, 2 boulders, and an old shed · sunny at the back',
    );
    // Twelve trees or more are woods.
    expect(lotSummary(lot(['TTTTTT', 'TTTTTT', '..B...']))).toBe(
      'Woods and a boulder · sunny on the left',
    );
  });
});
