// The job board (src/rules/jobs.ts): contracts from `jobs/<i>`, clients by rarity and never
// twice, and the Hendersons first on a first visit.

import { describe, expect, it } from 'vitest';
import type { ClientId } from './index.ts';
import { jobBoard } from './jobs.ts';
import { TEST_CONTENT } from './testing.ts';

const C = TEST_CONTENT;

describe('jobBoard', () => {
  it('deals three contracts, each its own client and a six-letter seed', () => {
    const board = jobBoard(C, 'board', { firstVisit: false });
    expect(board).toHaveLength(3);
    expect(new Set(board.map((c) => c.clientId)).size).toBe(3);
    for (const c of board) {
      expect(c.seed).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
      expect(c.recommended).toBe(false);
    }
    expect(new Set(board.map((c) => c.seed)).size).toBe(3);
  });

  it('is the same board for the same seed, and a different one for another', () => {
    expect(jobBoard(C, 'same', { firstVisit: false })).toEqual(
      jobBoard(C, 'same', { firstVisit: false }),
    );
    const boards = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(jobBoard(C, `b${i}`, { firstVisit: false })),
      ),
    );
    expect(boards.size).toBe(20);
  });

  it('puts the Hendersons first on a first visit, marked recommended, and nowhere else', () => {
    for (let i = 0; i < 50; i++) {
      const board = jobBoard(C, `first-${i}`, { firstVisit: true });
      expect(board[0]).toMatchObject({ clientId: 'hendersons', recommended: true });
      expect(board.slice(1).map((c) => c.clientId)).not.toContain('hendersons');
      expect(board.slice(1).every((c) => !c.recommended)).toBe(true);
    }
  });

  it('keeps contract seeds from their own streams, so the first-visit mark never moves a lot', () => {
    const first = jobBoard(C, 'lots', { firstVisit: true });
    const later = jobBoard(C, 'lots', { firstVisit: false });
    expect(first.map((c) => c.seed)).toEqual(later.map((c) => c.seed));
  });

  it('deals by rarity: the commons most, the uncommon less, the rare least, none guaranteed', () => {
    // TEST_CONTENT: three common clients, Juniper uncommon, Vladislav rare.
    const n: Partial<Record<ClientId, number>> = {};
    let noRare = 0;
    for (let i = 0; i < 1500; i++) {
      const board = jobBoard(C, `r${i}`, { firstVisit: false });
      for (const c of board) n[c.clientId] = (n[c.clientId] ?? 0) + 1;
      if (!board.some((c) => c.clientId === 'vladislav')) noRare++;
    }
    const common = Math.min(n.hendersons!, n.barkers!, n.dale!);
    expect(common).toBeGreaterThan(n.juniper!);
    expect(n.juniper!).toBeGreaterThan(n.vladislav!);
    expect(n.vladislav!).toBeGreaterThan(0);
    expect(noRare).toBeGreaterThan(1000);
  });
});
