// D-192 on the real content: the shelf stocks for the house. A good that can pay in the house as
// it stands counts 3 times in its pick; Waterfront is stocked only on a lot with water, which is
// every lot today (D-119), and leans on a piece that touches it. src/rules/shelf.test.ts holds
// the rule on the test content.

import { describe, expect, it } from 'vitest';
import type { Content, RunState, ShopOffer } from '../rules/index.ts';
import { rules } from '../rules/index.ts';
import { stockGoods } from '../rules/shop.ts';
import { shelfFor } from '../rules/shelf.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const start = (seed: string): RunState =>
  rules.newRun({ seed, clientId: 'hendersons', crewId: 'generalContractor', mode: 'standard' });
const withSeed = (s: RunState, seed: string): RunState => ({ ...s, setup: { ...s.setup, seed } });
const keyOf = (o: ShopOffer) => (o.kind === 'service' ? o.service : `${o.kind}:${o.id}`);
const WATER = ['pond', 'creek', 'lake'];

describe('the shelf stocks for the house (D-192)', () => {
  it('leans at 3, and only Waterfront is stocked by the lot: by the water, leaning on it', () => {
    expect(CONTENT.balance.shop.relevantWeight).toBe(3);
    const waterfront = CONTENT.blueprints.waterfront;
    expect(waterfront.stockIf).toEqual({ lotHas: WATER });
    expect(waterfront.paysOn).toEqual({ touching: { feature: WATER } });
    // It leans on the pieces it pays on.
    expect(waterfront.modifiers).toEqual([{ kind: 'earn', target: waterfront.paysOn, pct: 100 }]);
    const others = Object.values(CONTENT.blueprints).filter((b) => b.id !== 'waterfront');
    expect(others.filter((b) => b.stockIf || b.paysOn)).toEqual([]);
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('catches a bad stockIf, paysOn or lean', () => {
    const broken: Content = {
      ...CONTENT,
      blueprints: {
        ...CONTENT.blueprints,
        waterfront: {
          ...CONTENT.blueprints.waterfront,
          stockIf: { lotHas: ['pond', 'pond', 'street' as 'pond'] },
          paysOn: { all: [{ host: true }, { touching: { piece: 'jacuzzi' as 'pool' } }] },
        },
        fengShui: { ...CONTENT.blueprints.fengShui, stockIf: { lotHas: [] } },
      },
      balance: { ...CONTENT.balance, shop: { ...CONTENT.balance.shop, relevantWeight: 0.5 } },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toContain('blueprint waterfront: stockIf.lotHas repeats one');
    expect(problems).toContain(
      'blueprint waterfront: stockIf.lotHas: "street" isn\'t a lot feature',
    );
    expect(problems).toContain('blueprint waterfront paysOn: unknown piece "jacuzzi"');
    expect(problems).toContain("blueprint waterfront: paysOn can't name a host");
    expect(problems).toContain('blueprint fengShui: stockIf.lotHas names no feature');
    expect(problems).toContain('balance: shop.relevantWeight must be a whole number ≥ 1');
  });

  it('every lot has water, so Waterfront is stocked on every one, by every biome (D-119)', () => {
    for (let k = 0; k < 100; k++) {
      const s = start(`s22-${k}`);
      expect(
        s.house.lot.terrain.some((t) => t !== null && WATER.includes(t)),
        s.setup.seed,
      ).toBe(true);
      expect(shelfFor(CONTENT, s).stocks('waterfront')).toBe(true);
    }
  });

  it('Remodel Plans: Entertainer turns up more once the house holds the Entertainer', () => {
    // A Kitchen, a Dining Room and a Living Room in a row: the Entertainer, and no other set.
    const entertainer: Placement[] = [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
      ['livingRoom', 4, 0],
    ];
    const base = start('s22-ent');
    const s = { ...base, phase: 1, house: houseFrom(CONTENT, emptyRows(24, 24), entertainer) };
    expect(rules.currentTally(s).sets.map((x) => x.set)).toEqual(['entertainer']);
    expect(rules.canPay(s, { kind: 'tool', id: 'remodelEntertainer' })).toBe(true);
    expect(rules.canPay(s, { kind: 'tool', id: 'remodelSuite' })).toBe(false);
    const count = (content: Content) => {
      const out: Record<string, number> = {};
      for (let k = 0; k < 1500; k++) {
        for (const o of stockGoods(content, withSeed(s, `ent/${k}`), 2, 0)) {
          out[keyOf(o)] = (out[keyOf(o)] ?? 0) + 1;
        }
      }
      return out;
    };
    const on = count(CONTENT);
    const off = count({
      ...CONTENT,
      balance: { ...CONTENT.balance, shop: { ...CONTENT.balance.shop, relevantWeight: 1 } },
    });
    const held = on['tool:remodelEntertainer']!;
    const notHeld = (on['tool:remodelSuite']! + on['tool:remodelJackAndJill']!) / 2;
    expect(held / notHeld).toBeGreaterThan(2.3);
    expect(held).toBeGreaterThan(off['tool:remodelEntertainer']! * 1.1);
  });
});
