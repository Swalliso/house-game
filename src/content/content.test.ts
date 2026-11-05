import { describe, expect, it } from 'vitest';
import type { Content, PlaceAction } from '../rules/index.ts';
import { cardText, createRules, rules } from '../rules/index.ts';
import { computeLayout } from '../rules/layout.ts';
import { tallyHouse } from '../rules/scoring.ts';
import { houseFrom, emptyRows, type Placement } from '../rules/testing.ts';
import { CONTENT, SCORE_LABELS, validateContent } from './index.ts';

function earnedOf(rows: readonly string[], placements: readonly Placement[]) {
  const t = tallyHouse(
    CONTENT,
    computeLayout(CONTENT, houseFrom(CONTENT, rows, placements)),
    false,
  );
  return { pieces: t.pieces.map((p) => p.earned), points: t.points, mult: t.mult, total: t.total };
}

describe('content', () => {
  it('validates', () => {
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('catches the mistakes types cannot', () => {
    const broken: Content = {
      ...CONTENT,
      pieces: {
        ...CONTENT.pieces,
        lawn: { ...CONTENT.pieces.lawn, id: 'bedroom', shape: ['#.', '.#'] },
      },
      balance: {
        ...CONTENT.balance,
        phases: [
          { name: 'A', target: 10 },
          { name: 'B', target: 5 },
        ],
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/piece lawn: id is "bedroom"/);
    expect(problems).toMatch(/connected polyomino/);
    expect(problems).toMatch(/target 2 doesn't rise/);
  });

  it('generates card text for every piece', () => {
    for (const def of Object.values(CONTENT.pieces)) {
      const text = cardText(CONTENT, def);
      expect(text.effects.length).toBe(def.effects.length);
    }
    expect(cardText(CONTENT, CONTENT.pieces.livingRoom).effects).toEqual([
      '+2 per touching view (up to 3)',
    ]);
  });

  it('names the score layers (D-019)', () => {
    expect(SCORE_LABELS).toEqual({
      points: 'Comfort',
      mult: 'Charm',
      xMult: 'Sparkle',
      total: 'Wow',
    });
  });

  it('has the slice: six pieces as seven cards, and two sets', () => {
    expect(Object.keys(CONTENT.pieces)).toHaveLength(7);
    expect(CONTENT.pieces.lKitchen.countsAs).toBe('kitchen');
    expect(Object.keys(CONTENT.sets)).toEqual(['jackAndJill', 'entertainer']);
    expect(CONTENT.balance.phases.map((p) => p.name)).toEqual([
      'Groundbreaking',
      'Foundation',
      'Framing',
    ]);
  });
});

describe('the slice pieces', () => {
  const open = emptyRows(10, 10);

  it('Bedroom: 3, +1 per Tree or Quiet neighbor (max 3), −2 on the street', () => {
    expect(earnedOf(open, [['bedroom', 0, 0]]).pieces).toEqual([3]);
    expect(
      earnedOf(open, [
        ['bedroom', 0, 0],
        ['bedroom', 2, 0],
      ]).pieces,
    ).toEqual([4, 4]);
    expect(earnedOf(['TTT', 'T..', 'T..'], [['bedroom', 1, 1]]).pieces).toEqual([3 + 3 - 2]);
  });

  it('Bathroom: +3 next to a Bedroom (once), −2 next to a Kitchen', () => {
    expect(earnedOf(open, [['bathroom', 0, 0]]).pieces).toEqual([0]);
    expect(
      earnedOf(open, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['kitchen', 3, 0],
      ]).pieces,
    ).toEqual([3, 1, 0]);
  });

  it('Kitchen and L-Kitchen: +2 per Dining Room, boosted by its aura', () => {
    expect(
      earnedOf(open, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]).pieces,
    ).toEqual([3, 0]);
    expect(
      earnedOf(open, [
        ['lKitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]).pieces,
    ).toEqual([3, 0]);
  });

  it('Living Room: +2 per view (max 3), and the Dining Room boosts it too', () => {
    expect(
      earnedOf(['T....', '.....', '.....', '.....', 'CCCCC'], [['livingRoom', 1, 0]]).pieces,
    ).toEqual([2]);
    expect(
      earnedOf(
        ['T.....', '......', '......', '......', '......'],
        [
          ['livingRoom', 1, 0],
          ['diningRoom', 3, 0],
        ],
      ).pieces,
    ).toEqual([3, 0]);
  });

  it('Lawn: 1, +1 per touching Lawn (max 4)', () => {
    expect(
      earnedOf(open, [
        ['lawn', 0, 0],
        ['lawn', 2, 0],
        ['lawn', 0, 2],
      ]).pieces,
    ).toEqual([3, 2, 2]);
  });

  it('Entertainer and Jack-and-Jill multiply the week', () => {
    const t = earnedOf(open, [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
      ['livingRoom', 4, 0],
      ['bedroom', 0, 2],
      ['bathroom', 2, 2],
      ['bedroom', 2, 3],
    ]);
    // Kitchen 3; Dining 0; Living 0 (no view); the Bedrooms touch, so 4 each; Bathroom 3.
    // Sets: 25 + 10 Points and +1 + 0.5 Mult.
    expect(t.pieces).toEqual([3, 0, 0, 4, 3, 4]);
    expect(t.points).toBe(14 + 25 + 10);
    expect(t.mult).toBe(250);
    expect(t.total).toBe(123); // 49 × 2.5 = 122.5 → 123
  });
});

describe('the real rules', () => {
  it('play a full 12-week run to the end without breaking', () => {
    const r = createRules(CONTENT);
    for (const seed of ['smoke-1', 'smoke-2', 'smoke-3']) {
      let s = r.newRun({ seed, mode: 'standard' });
      let weeks = 0;
      while (s.screen === 'build') {
        // A cheap greedy bot: the best of the first few legal spots per card.
        const options = r.legalActions(s).filter((a, i) => a.t === 'pass' || i % 7 === 0);
        let best = options.at(-1)!;
        let bestScore = -1;
        for (const a of options) {
          const v = r.scoreOnly(s, a.t === 'pass' ? null : (a as PlaceAction));
          if (v > bestScore) [best, bestScore] = [a, v];
        }
        s = r.apply(s, best).state;
        weeks++;
      }
      expect(['won', 'lost']).toContain(s.screen);
      expect(weeks).toBeLessThanOrEqual(12);
    }
  });

  it('are exported ready-bound', () => {
    expect(rules.content).toBe(CONTENT);
  });
});
