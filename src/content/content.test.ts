import { describe, expect, it } from 'vitest';
import type { Content, DrawRow, PlaceAction } from '../rules/index.ts';
import { cardText, createRules, featureWantedText, glossary, rules } from '../rules/index.ts';
import { drawWeights, rowOf } from '../rules/draw.ts';
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
      // A per-type cap with nothing to count (D-143).
      blueprints: {
        ...CONTENT.blueprints,
        fengShui: {
          ...CONTENT.blueprints.fengShui,
          modifiers: [{ kind: 'mult', add: 5, maxEach: 3 }],
        },
      },
      balance: {
        ...CONTENT.balance,
        phases: [
          { name: 'A', target: 10 },
          { name: 'B', target: 5 },
        ],
        strikesPerMilestone: 0.5,
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/blueprint fengShui.*: mult maxEach needs per/);
    expect(problems).toMatch(/piece lawn: id is "bedroom"/);
    expect(problems).toMatch(/connected polyomino/);
    expect(problems).toMatch(/piece fence: pack shape ####: Up to 3 tiles/);
    expect(problems).toMatch(/piece fence: pack shape ##\/##: Up to 3 tiles/);
    expect(problems).toMatch(/piece driveway: a pack has no shape variants/);
    expect(problems).toMatch(/target 2 doesn't rise/);
    expect(problems).toMatch(/strikesPerMilestone must be a whole number ≥ 0/);
  });

  it('generates card text for every piece', () => {
    for (const def of Object.values(CONTENT.pieces)) {
      const text = cardText(CONTENT, def);
      expect(text.effects.length).toBe(def.effects.length);
    }
    expect(cardText(CONTENT, CONTENT.pieces.livingRoom).effects).toEqual([
      '+2 per touching view (up to 3)',
      '+2 every week while Sunny',
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

  it('has the base pool: 23 piece types as 25 cards, four sets, and seven milestones', () => {
    // The base pool is what the weekly draw deals; special pieces (weight 0) come from the shop.
    // The Sunroom left them for the draw (D-120), then the Birdhouse and the Fire Pit, which
    // arrive late with the Porch (D-145).
    const defs = Object.values(CONTENT.pieces).filter((d) => d.drawWeight > 0);
    expect(defs).toHaveLength(25);
    const types = new Set(defs.map((d) => d.countsAs ?? d.id));
    expect(types.size).toBe(23);
    const count = (cat: string) =>
      new Set(defs.filter((d) => d.category === cat).map((d) => d.countsAs ?? d.id)).size;
    expect([count('indoor'), count('yard'), count('outbuilding')]).toEqual([10, 9, 4]);
    // The late arrivals (D-145), by the milestone they join the draw at (0-based).
    expect(
      defs.filter((d) => d.fromPhase >= 3).map((d) => [d.id, d.fromPhase, d.drawWeight]),
    ).toEqual([
      ['firePit', 4, 5],
      ['birdhouse', 3, 5],
      ['porch', 4, 5],
    ]);
    // Two shape variants share a type; the Fence and the Driveway are packs instead (D-106).
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

  it('pays 100 Wow for each budget left at the last milestone (D-145)', () => {
    expect(CONTENT.balance.leftoverBudgetWow).toBe(100);
    expect(glossary(CONTENT).budget.text).toContain(
      'What you still hold when the last milestone is met pays 100 Wow each.',
    );
  });

  it('says who wants a Boulder and the Old Shed beside them, from the cards (D-145)', () => {
    expect(featureWantedText(CONTENT, 'boulder')).toBe(
      'Lawns, Flower Beds, and Fire Pits earn more beside one.',
    );
    expect(featureWantedText(CONTENT, 'oldShed')).toBe(
      'Garages, Herb Gardens, Greenhouses, and Henhouses earn more beside it.',
    );
    // A penalty isn't wanting: the Pool loses to Trees, and isn't in their list.
    expect(featureWantedText(CONTENT, 'tree')).not.toContain('Pool');
    expect(featureWantedText(CONTENT, 'timeCapsule')).toBeNull();
  });

  it('deals the week in two rows: Rooms, then Layout (D-121)', () => {
    // Rooms: the rooms and the fixtures that go in them. Layout: hallways, the Garage, the yard,
    // outbuildings, and the yard's fixtures.
    const pool = drawWeights(CONTENT, 6, {});
    const ids = (row: DrawRow) =>
      pool.filter((w) => rowOf(CONTENT, w.card) === row).map((w) => w.card.id);
    expect(ids('rooms')).toEqual([
      'bedroom',
      'bathroom',
      'kitchen',
      'lKitchen',
      'diningRoom',
      'livingRoom',
      'closet',
      'homeOffice',
      // The Sunroom, a room, from Foundation (D-120).
      'sunroom',
      'fireplace',
      'skylight',
      'blackoutCurtains',
      'soundproofing',
      'kitchenIsland',
      'bunkBeds',
      'bayWindow',
    ]);
    expect(ids('layout')).toEqual([
      'hallway',
      'longHallway',
      'garage',
      'lawn',
      'sapling',
      'flowerBed',
      'herbGarden',
      'patio',
      'fence',
      'driveway',
      'doghouse',
      'treehouse',
      'greenhouse',
      // The late arrivals (D-145).
      'firePit',
      'birdhouse',
      'porch',
      'sprinkler',
      'pergola',
      'gardenLights',
    ]);
    // Two of each a week; the Landscaper's Layout row has three.
    for (const crewId of ['generalContractor', 'landscaper', 'architect'] as const) {
      const s = rules.newRun({ seed: 'rows', clientId: 'hendersons', crewId, mode: 'standard' });
      const layout = crewId === 'landscaper' ? 3 : 2;
      expect(s.hand.map((c) => rowOf(CONTENT, c))).toEqual([
        'rooms',
        'rooms',
        ...Array<DrawRow>(layout).fill('layout'),
      ]);
    }
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
    ).toEqual([3, 1, 5]); // the Kitchen in the sun: +2 (D-120), and +3 of its own (D-165)
  });

  it('Kitchen and L-Kitchen: +2 per Dining Room, boosted by its aura', () => {
    // Both in the sun (D-120): the Kitchen's +2, +2 and its own +3 (D-165) at +50% is 10.5 →
    // 11, the Dining Room's +2.
    expect(
      earnedOf(open, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]).pieces,
    ).toEqual([11, 2]);
    expect(
      earnedOf(open, [
        ['lKitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]).pieces,
    ).toEqual([11, 2]);
  });

  it('Living Room: +2 per view (max 3), and the Dining Room boosts it too', () => {
    expect(
      earnedOf(['T....', '.....', '.....', '.....', 'CCCCC'], [['livingRoom', 1, 0]]).pieces,
    ).toEqual([2 + 2]); // a view, and the sun (D-120)
    expect(
      earnedOf(
        ['T.....', '......', '......', '......', '......'],
        [
          ['livingRoom', 1, 0],
          ['diningRoom', 3, 0],
        ],
      ).pieces,
    ).toEqual([6, 2]);
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
    // The Kitchen, the Dining Room and the Living Room face the sun, +2 each (D-120): Kitchen 11
    // (with its own +3, D-165); Dining 2; Living 3 (no view); the Bedrooms touch, so 4 each;
    // Bathroom 3. Sets: 25 + 10 Points and +1 + 0.5 Mult.
    expect(t.pieces).toEqual([11, 2, 3, 4, 3, 4]);
    expect(t.points).toBe(27 + 25 + 10);
    expect(t.mult).toBe(250);
    expect(t.total).toBe(155); // 62 × 2.5
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
          // M4b, D-144: pick the first of the two on offer.
          s = r.apply(s, { t: 'answerChangeOrder', i: 0 }).state;
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
