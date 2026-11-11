import { describe, expect, it } from 'vitest';
import { DRAW_ROWS, drawHand, drawKey, drawWeights, swapCandidates } from './draw.ts';
import type { Card, DrawRow, PieceId } from './index.ts';
import { TEST_CONTENT as C, withPieces } from './testing.ts';

const ids = (cards: readonly Card[]) => cards.map((c) => c.id);
const shares = (a: readonly Card[], b: readonly Card[]) =>
  a.some((c) => b.some((d) => d.kind === c.kind && d.id === c.id));

/** TEST_CONTENT with only these pieces drawable. */
const onlyDrawable = (keep: readonly PieceId[]) =>
  withPieces(
    Object.fromEntries(
      Object.keys(C.pieces)
        .filter((id) => !keep.includes(id as PieceId))
        .map((id) => [id, { drawWeight: 0 }]),
    ),
  );

describe('hands', () => {
  it('are handSize distinct cards, the same for the same key', () => {
    expect(drawHand(C, 'seed', 0, '1', 0, 4)).toHaveLength(4);
    for (let slot = 1; slot <= 20; slot++) {
      const hand = drawHand(C, 'seed', 0, String(slot), 0, 3);
      expect(hand).toHaveLength(3);
      expect(new Set(hand.map((c) => c.id)).size).toBe(3);
      expect(drawHand(C, 'seed', 0, String(slot), 0, 3)).toEqual(hand);
    }
  });

  it('are keyed by phase, slot, and draw count', () => {
    const hand = (phase: number, slot: number, n: number) =>
      JSON.stringify(drawHand(C, 'keyed-2', phase, String(slot), n, 3));
    expect(drawKey(0, '1', 0)).toBe('draw/0/1/0');
    expect(drawKey(2, 'ot1', 0)).toBe('draw/2/ot1/0');
    // Changing any one part of the key changes the stream (checked on several bases, since two
    // different streams can still happen to draw the same three cards).
    const differs = (f: (slot: number) => [number, number, number]) =>
      [1, 2, 3, 4, 5, 6].some((slot) => hand(0, slot, 0) !== hand(...f(slot)));
    expect(differs((slot) => [1, slot, 0])).toBe(true);
    expect(differs((slot) => [0, slot + 10, 0])).toBe(true);
    expect(differs((slot) => [0, slot, 1])).toBe(true);
  });

  it('weight pieces by complexity per phase (D-055)', () => {
    // In the test content, the Lawn is complexity 2: 30% in phase 1, 60% in phase 2.
    const lawn = (phase: number) => drawWeights(C, phase).find((w) => w.card.id === 'lawn')!.weight;
    // Weights are in hundredths, so nothing rounds away.
    expect(lawn(0)).toBe(300);
    expect(lawn(1)).toBe(600);
    expect(lawn(9)).toBe(600); // the last row repeats
    const bedroom = drawWeights(C, 0).find((w) => w.card.id === 'bedroom')!.weight;
    expect(bedroom).toBe(1000);

    let lawns = 0;
    for (let slot = 0; slot < 2000; slot++) {
      if (drawHand(C, 'freq', 0, String(slot), 0, 3).some((c) => c.id === 'lawn')) lawns++;
    }
    // Lawn weight 3 against eight complexity-1 cards at 10 and the rest scaled down (about
    // 110 in all): about 8% of hands.
    expect(lawns).toBeGreaterThan(90);
    expect(lawns).toBeLessThan(300);
  });

  it('keep complex pieces drawable early, just rarely (D-055)', () => {
    const c = withPieces({ lawn: { complexity: 3 } });
    // 10 × 5% would round to nothing; in hundredths it's 50 against the others' 1,000.
    expect(drawWeights(c, 0).find((w) => w.card.id === 'lawn')!.weight).toBe(50);
    let lawns = 0;
    for (let slot = 0; slot < 4000; slot++) {
      if (drawHand(c, 'rare', 0, String(slot), 0, 3).some((x) => x.id === 'lawn')) lawns++;
    }
    // About 1.4% of hands.
    expect(lawns).toBeGreaterThan(20);
    expect(lawns).toBeLessThan(150);
  });

  it('skip cards with no weight or not yet in their phase', () => {
    const c = withPieces({ lawn: { drawWeight: 0 }, bathroom: { fromPhase: 1 } });
    for (let slot = 0; slot < 200; slot++) {
      const ids = drawHand(c, 'gate', 0, String(slot), 0, 3).map((x) => x.id);
      expect(ids).not.toContain('lawn');
      expect(ids).not.toContain('bathroom');
    }
    expect(drawWeights(c, 1).some((w) => w.card.id === 'bathroom')).toBe(true);
  });

  it('come up short when the pool is smaller than a hand', () => {
    const c = withPieces(
      Object.fromEntries(
        Object.keys(C.pieces)
          .filter((id) => id !== 'lawn' && id !== 'livingRoom')
          .map((id) => [id, { drawWeight: 0 }]),
      ),
    );
    expect(
      drawHand(c, 'small', 0, String(1), 0, 3)
        .map((x) => x.id)
        .sort(),
    ).toEqual(['lawn', 'livingRoom']);
  });
});

describe('a reroll’s draw (D-132)', () => {
  it('leaves out the cards the row holds while the pool has enough others', () => {
    // Phase 0 has 8 Rooms cards and 13 Layout cards: enough for 3 held and 3 new in each row.
    for (const row of DRAW_ROWS) {
      for (let slot = 1; slot <= 200; slot++) {
        const held = drawHand(C, 'held', 0, String(slot), 0, 3, { row });
        const hand = drawHand(C, 'held', 0, String(slot), 1, 3, { row, held });
        expect(hand).toHaveLength(3);
        expect(new Set(ids(hand)).size).toBe(3);
        expect(shares(hand, held)).toBe(false);
      }
    }
  });

  it('tops up from the held cards, on the same stream, only when too few others remain', () => {
    // Three Rooms cards: two held leave one other, so it comes first and a held card follows.
    const three = onlyDrawable(['bedroom', 'kitchen', 'closet']);
    for (let slot = 1; slot <= 50; slot++) {
      const held = drawHand(three, 'short', 0, String(slot), 0, 2, { row: 'rooms' });
      const hand = drawHand(three, 'short', 0, String(slot), 1, 2, { row: 'rooms', held });
      expect(hand).toHaveLength(2);
      expect(ids(held)).not.toContain(hand[0]!.id);
      expect(ids(held)).toContain(hand[1]!.id);
    }
    // With no others at all, the held cards come back, so the row stays full.
    const two = onlyDrawable(['bedroom', 'kitchen']);
    const held = drawHand(two, 'short', 0, '1', 0, 2, { row: 'rooms' });
    const hand = drawHand(two, 'short', 0, '1', 1, 2, { row: 'rooms', held });
    expect(ids(hand).sort()).toEqual(['bedroom', 'kitchen']);
  });

  it('is the plain draw on the same key when none of the held cards is in the pool', () => {
    for (let slot = 1; slot <= 50; slot++) {
      const draw = (held?: readonly Card[]) =>
        drawHand(C, 'same', 0, String(slot), 1, 2, { row: 'rooms', held });
      // Layout cards aren't in the Rooms pool, so holding them changes nothing.
      const layout = drawHand(C, 'same', 0, String(slot), 0, 2, { row: 'layout' });
      expect(draw([])).toEqual(draw());
      expect(draw(layout)).toEqual(draw());
    }
  });

  it('leaves a week’s first draw as it was: the same seed, the same cards', () => {
    // Pinned on develop at 87aa6ae, before a reroll left out the hand it replaces.
    const row = (slot: string, r: DrawRow) => ids(drawHand(C, 'pinned', 0, slot, 0, 2, { row: r }));
    expect(DRAW_ROWS.map((r) => row('1', r))).toEqual([
      ['homeOffice', 'diningRoom'],
      ['garage', 'herbGarden'],
    ]);
    expect(DRAW_ROWS.map((r) => row('ot1', r))).toEqual([
      ['bathroom', 'bedroom'],
      ['fence', 'doghouse'],
    ]);
    expect(drawHand(C, 'pinned', 1, '1', 0, 4)).toEqual([
      { kind: 'piece', id: 'lKitchen' },
      { kind: 'fixture', id: 'bayWindow' },
      { kind: 'fixture', id: 'sprinkler' },
      { kind: 'piece', id: 'garage' },
    ]);
  });

  it('its swaps leave out the cards it replaced too, while enough others remain', () => {
    for (let slot = 1; slot <= 100; slot++) {
      const s = String(slot);
      const held = drawHand(C, 'swap', 0, s, 0, 2, { row: 'rooms' });
      const row = drawHand(C, 'swap', 0, s, 1, 2, { row: 'rooms', held });
      const tries = (h?: readonly Card[]) =>
        swapCandidates(C, 'swap', 0, s, 1, 0, 3, row, { row: 'rooms', held: h });
      // 8 Rooms cards, 2 in the row and 2 held: 4 others, so all 3 tries come from them.
      expect(tries(held)).toHaveLength(3);
      expect(shares(tries(held), row)).toBe(false);
      expect(shares(tries(held), held)).toBe(false);
      // Nothing held: a week's own swaps, on the same key, as before.
      expect(tries([])).toEqual(tries());
    }
    // Five Rooms cards, 2 in the row and 2 held: the other is tried first, then the held ones.
    const five = onlyDrawable(['bedroom', 'bathroom', 'kitchen', 'closet', 'livingRoom']);
    const piece = (id: PieceId): Card => ({ kind: 'piece', id });
    const tries = swapCandidates(
      five,
      'swap',
      0,
      '1',
      1,
      0,
      3,
      [piece('kitchen'), piece('closet')],
      { row: 'rooms', held: [piece('bedroom'), piece('bathroom')] },
    );
    expect(ids(tries)[0]).toBe('livingRoom');
    expect(ids(tries.slice(1)).sort()).toEqual(['bathroom', 'bedroom']);
  });
});
