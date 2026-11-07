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
    1,
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
        // A pack whose suggested shape has more tiles than it places, and shape variants.
        fence: { ...CONTENT.pieces.fence, pack: { maxTiles: 3, shapes: [['##', '##']] } },
        driveway: { ...CONTENT.pieces.driveway, countsAs: 'patio' },
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
    expect(problems).toMatch(/piece fence: pack shape ####: Up to 3 tiles/);
    expect(problems).toMatch(/piece fence: pack shape ##\/##: Up to 3 tiles/);
    expect(problems).toMatch(/piece driveway: a pack has no shape variants/);
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

  it('has the base pool: 19 piece types as 21 cards, four sets, and seven milestones', () => {
    // The base pool is what the weekly draw deals; special pieces (weight 0) come from the shop.
    const defs = Object.values(CONTENT.pieces).filter((d) => d.drawWeight > 0);
    expect(defs).toHaveLength(21);
    const types = new Set(defs.map((d) => d.countsAs ?? d.id));
    expect(types.size).toBe(19);
    const count = (cat: string) =>
      new Set(defs.filter((d) => d.category === cat).map((d) => d.countsAs ?? d.id)).size;
    expect([count('indoor'), count('yard'), count('outbuilding')]).toEqual([9, 7, 3]);
    // Two shape variants share a type; the Fence and the Driveway are packs instead (D-102).
    expect(defs.filter((d) => d.countsAs).map((d) => d.id)).toEqual(['lKitchen', 'longHallway']);
    expect(defs.filter((d) => d.pack).map((d) => d.id)).toEqual(['fence', 'driveway']);
    expect(CONTENT.pieces.lKitchen.countsAs).toBe('kitchen');
    expect(Object.keys(CONTENT.sets)).toEqual(['jackAndJill', 'entertainer', 'suite', 'fullHouse']);
    expect(CONTENT.balance.phases.map((p) => p.name)).toEqual([
      'Groundbreaking',
      'Foundation',
      'Framing',
      'Roofing',
      'Drywall',
      'Finishes',
      'Final Walkthrough',
    ]);
    expect(Object.keys(CONTENT.crews)).toEqual(['generalContractor', 'landscaper', 'architect']);
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
  it('play a full run to the end without breaking', () => {
    const r = createRules(CONTENT);
    for (const seed of ['smoke-1', 'smoke-2']) {
      let s = r.newRun({
        seed,
        clientId: 'hendersons',
        crewId: 'generalContractor',
        mode: 'standard',
      });
      let weeks = 0;
      while (s.screen === 'build' || s.screen === 'shop' || s.screen === 'changeOrder') {
        if (s.screen === 'changeOrder') {
          // M4b: take whatever's offered (a phase effect can only be acknowledged).
          s = r.apply(s, { t: 'answerChangeOrder', accept: true }).state;
          continue;
        }
        if (s.screen === 'shop') {
          // The Housewarming crate first (keep its first option), then leave.
          s = r.apply(s, s.offers?.pick ? { t: 'pick', i: 0 } : { t: 'leaveShop' }).state;
          continue;
        }
        // A cheap greedy bot: the best of a sample of legal spots, or a pass.
        const options: PlaceAction[] = r.legalPlacements(s).filter((_, i) => i % 15 === 0);
        let best: PlaceAction | null = null;
        let bestScore = r.scoreOnly(s, null);
        for (const a of options) {
          const v = r.scoreOnly(s, a);
          if (v > bestScore) [best, bestScore] = [a, v];
        }
        s = r.apply(s, best ?? { t: 'pass' }).state;
        weeks++;
      }
      expect(['won', 'lost']).toContain(s.screen);
      expect(weeks).toBeLessThanOrEqual(30);
    }
    // A shared CI runner can be several times slower than a laptop.
  }, 30_000);

  it('are exported ready-bound', () => {
    expect(rules.content).toBe(CONTENT);
  });
});
