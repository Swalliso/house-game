import { describe, expect, it } from 'vitest';
import { drawHand, drawKey, drawWeights } from './draw.ts';
import { TEST_CONTENT as C, withPieces } from './testing.ts';

describe('hands', () => {
  it('are handSize distinct cards, the same for the same key', () => {
    for (let slot = 1; slot <= 20; slot++) {
      const hand = drawHand(C, 'seed', 0, slot, 0);
      expect(hand).toHaveLength(3);
      expect(new Set(hand.map((c) => c.id)).size).toBe(3);
      expect(drawHand(C, 'seed', 0, slot, 0)).toEqual(hand);
    }
  });

  it('are keyed by phase, slot, and draw count', () => {
    const hand = (phase: number, slot: number, n: number) =>
      JSON.stringify(drawHand(C, 'keyed-2', phase, slot, n));
    expect(drawKey(0, 1, 0)).toBe('draw/0/1/0');
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
      if (drawHand(C, 'freq', 0, slot, 0).some((c) => c.id === 'lawn')) lawns++;
    }
    // Lawn weight 3 against six cards at 10: it shows up in well under half of hands.
    expect(lawns).toBeGreaterThan(150);
    expect(lawns).toBeLessThan(700);
  });

  it('keep complex pieces drawable early, just rarely (D-055)', () => {
    const c = withPieces({ lawn: { complexity: 3 } });
    // 10 × 5% would round to nothing; in hundredths it's 50 against the others' 1,000.
    expect(drawWeights(c, 0).find((w) => w.card.id === 'lawn')!.weight).toBe(50);
    let lawns = 0;
    for (let slot = 0; slot < 4000; slot++) {
      if (drawHand(c, 'rare', 0, slot, 0).some((x) => x.id === 'lawn')) lawns++;
    }
    expect(lawns).toBeGreaterThan(40);
    expect(lawns).toBeLessThan(400);
  });

  it('skip cards with no weight or not yet in their phase', () => {
    const c = withPieces({ lawn: { drawWeight: 0 }, bathroom: { fromPhase: 1 } });
    for (let slot = 0; slot < 200; slot++) {
      const ids = drawHand(c, 'gate', 0, slot, 0).map((x) => x.id);
      expect(ids).not.toContain('lawn');
      expect(ids).not.toContain('bathroom');
    }
    expect(drawWeights(c, 1).some((w) => w.card.id === 'bathroom')).toBe(true);
  });

  it('come up short when the pool is smaller than a hand', () => {
    const c = withPieces({
      bedroom: { drawWeight: 0 },
      bathroom: { drawWeight: 0 },
      kitchen: { drawWeight: 0 },
      lKitchen: { drawWeight: 0 },
      diningRoom: { drawWeight: 0 },
    });
    expect(
      drawHand(c, 'small', 0, 1, 0)
        .map((x) => x.id)
        .sort(),
    ).toEqual(['lawn', 'livingRoom']);
  });
});
